import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL } from '../config/api-base-url.token';
import { toApiError } from '../errors/api-error';
import { AuthResponse, LoginCredentials, RegisterData, User, UserRole } from '../models/app.models';

export type AuthStatus = 'idle' | 'loading' | 'success' | 'error';
export type LogoutReason = 'manual' | 'expired';
export type SessionCheck = 'valid' | 'missing' | 'expired';

/** Dónde se guarda la sesión. El token es la fuente de verdad; el usuario es solo una copia para pintar rápido. */
export const TOKEN_KEY = 'deficcitto_token';
export const USER_KEY = 'deficcitto_user';

export const SESSION_EXPIRED_MESSAGE = 'Tu sesión expiró. Inicia sesión de nuevo.';
const INVALID_CREDENTIALS_MESSAGE = 'Correo o contraseña incorrectos.';

/** Datos que firma la API dentro del JWT. */
interface JwtPayload {
  sub: string;
  role?: UserRole;
  exp: number; // segundos desde 1970
}

/** Lee el cuerpo del JWT (sin verificar la firma: eso solo puede hacerlo el servidor). */
function decodeJwt(token: string | null): JwtPayload | null {
  if (!token) return null;
  try {
    const part = token.split('.')[1];
    const base64 = part.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(part.length / 4) * 4, '=');
    const json = new TextDecoder().decode(Uint8Array.from(atob(base64), c => c.charCodeAt(0)));
    const data = JSON.parse(json) as Partial<JwtPayload>;
    return typeof data.sub === 'string' && typeof data.exp === 'number' ? (data as JwtPayload) : null;
  } catch {
    return null;
  }
}

const isExpired = (payload: JwtPayload): boolean => payload.exp * 1000 <= Date.now();

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http    = inject(HttpClient);
  private baseUrl = inject(API_BASE_URL);

  // ── Estado privado ────────────────────────────────────────
  private _token        = signal<string | null>(null);
  private _currentUser  = signal<User | null>(null);
  private _status       = signal<AuthStatus>('idle');
  private _error        = signal<string | null>(null);
  private _logoutReason = signal<LogoutReason | null>(null);

  // ── Señales públicas de solo lectura ──────────────────────
  readonly token        = this._token.asReadonly();
  readonly currentUser  = this._currentUser.asReadonly();
  readonly status       = this._status.asReadonly();
  readonly error        = this._error.asReadonly();
  readonly logoutReason = this._logoutReason.asReadonly();

  readonly isAuthenticated = computed(() => this._token() !== null);
  readonly isLoading       = computed(() => this._status() === 'loading');

  constructor() {
    // Solo lectura síncrona del almacenamiento: nada de HTTP aquí (los interceptores
    // inyectan este servicio, y una petición durante su construcción sería circular).
    this.restoreStoredSession();
  }

  // ── Acciones ──────────────────────────────────────────────

  /** Inicia sesión con `POST /auth/login`. Devuelve `true` si quedó autenticado. */
  async login(credentials: LoginCredentials): Promise<boolean> {
    const email = credentials.email?.trim() ?? '';
    const password = credentials.password ?? '';

    if (!email || !password) {
      return this.fail('Por favor, completa todos los campos.');
    }
    return this.authenticate('/auth/login', { email, password });
  }

  /** Crea la cuenta con `POST /auth/register` y deja la sesión iniciada. */
  async register(data: RegisterData): Promise<boolean> {
    const name = data.name?.trim() ?? '';
    const email = data.email?.trim() ?? '';
    const password = data.password ?? '';

    if (!name || !email || !password) {
      return this.fail('Por favor, completa todos los campos.');
    }
    if (password !== data.confirmPassword) {
      return this.fail('Las contraseñas no coinciden.');
    }
    return this.authenticate('/auth/register', { name, email, password });
  }

  /**
   * Cierra la sesión y limpia todo: token, usuario guardado y estado.
   * `reason = 'expired'` lo usa el interceptor cuando la API responde 401.
   */
  logout(reason: LogoutReason = 'manual'): void {
    this._token.set(null);
    this._currentUser.set(null);
    this._status.set('idle');
    this._error.set(null);
    this._logoutReason.set(reason);
    this.clearStorage();
  }

  /**
   * Revisa `exp` del token. Si ya venció, cierra la sesión.
   * Lo usan los guards antes de dejar pasar a una ruta.
   */
  checkSession(): SessionCheck {
    const token = this._token();
    if (!token) return 'missing';

    const payload = decodeJwt(token);
    if (!payload || isExpired(payload)) {
      this.logout('expired');
      return 'expired';
    }
    return 'valid';
  }

  /**
   * Al arrancar la app: si hay una sesión válida, pide `GET /auth/me` para refrescar al usuario.
   * Nunca lanza: si el token no sirve (401) el interceptor cierra la sesión;
   * si no hay conexión se conserva la sesión local.
   */
  async restoreSession(): Promise<void> {
    if (this.checkSession() !== 'valid') return;

    const token = this._token();
    try {
      const user = await firstValueFrom(this.http.get<User>(`${this.baseUrl}/auth/me`));
      if (this._token() === token) {
        this._currentUser.set(user);
        this.write(USER_KEY, JSON.stringify(user));
      }
    } catch {
      /* ver comentario del método */
    }
  }

  // ── Privado ───────────────────────────────────────────────

  private async authenticate(path: string, body: object): Promise<boolean> {
    this._status.set('loading');
    this._error.set(null);

    try {
      const res = await firstValueFrom(this.http.post<AuthResponse>(`${this.baseUrl}${path}`, body));
      this.startSession(res);
      this._status.set('success');
      return true;
    } catch (error) {
      const apiError = toApiError(error);
      return this.fail(apiError.status === 401 ? INVALID_CREDENTIALS_MESSAGE : apiError.message);
    }
  }

  private startSession({ token, user }: AuthResponse): void {
    this._token.set(token);
    this._currentUser.set(user);
    this._logoutReason.set(null);
    this.write(TOKEN_KEY, token);
    this.write(USER_KEY, JSON.stringify(user));
  }

  private fail(message: string): false {
    this._status.set('error');
    this._error.set(message);
    return false;
  }

  /** Recupera la sesión guardada al recargar la página. Un token vencido o dañado se descarta. */
  private restoreStoredSession(): void {
    const token = this.read(TOKEN_KEY);
    if (!token) return;

    const payload = decodeJwt(token);
    if (!payload || isExpired(payload)) {
      this.clearStorage();
      this._logoutReason.set('expired');
      return;
    }

    this._token.set(token);
    this._currentUser.set(this.readStoredUser(payload.sub));
  }

  private readStoredUser(expectedId: string): User | null {
    try {
      const user = JSON.parse(this.read(USER_KEY) ?? 'null') as User | null;
      return user?.id === expectedId ? user : null;
    } catch {
      return null;
    }
  }

  private clearStorage(): void {
    try {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      // claves de la versión demo anterior, que guardaba la sesión en sessionStorage
      sessionStorage.removeItem(TOKEN_KEY);
      sessionStorage.removeItem(USER_KEY);
    } catch {
      /* almacenamiento bloqueado: no hay nada que limpiar */
    }
  }

  private read(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  private write(key: string, value: string): void {
    try {
      localStorage.setItem(key, value);
    } catch {
      /* almacenamiento lleno o bloqueado: la sesión vive solo en memoria */
    }
  }
}
