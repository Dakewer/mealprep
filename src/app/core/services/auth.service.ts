import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL } from '../config/api-base-url.token';
import { toApiError } from '../errors/api-error';
import { LoginCredentials, RegisterData, User } from '../models/app.models';

export type AuthStatus = 'idle' | 'loading' | 'success' | 'error';

interface ApiUserResponse {
  id?: string | number;
  name?: string;
  email?: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http    = inject(HttpClient, { optional: true });
  private baseUrl = inject(API_BASE_URL, { optional: true }) ?? 'http://localhost:3000';

  // ── Private state ─────────────────────────────────────────
  private _isAuthenticated = signal<boolean>(false);
  private _currentUser     = signal<User | null>(null);
  private _status          = signal<AuthStatus>('idle');
  private _error           = signal<string | null>(null);

  // ── Public readonly signals ───────────────────────────────
  readonly isAuthenticated = this._isAuthenticated.asReadonly();
  readonly currentUser     = this._currentUser.asReadonly();
  readonly status          = this._status.asReadonly();
  readonly error           = this._error.asReadonly();

  readonly isLoading = computed(() => this._status() === 'loading');

  private get usersUrl(): string {
    return `${this.baseUrl}/users`;
  }

  constructor() {
    this.checkStoredSession();
  }

  // ── Auth actions (C4: envío a la API sin manejar token ni sesión en servidor) ──

  /**
   * Envía los datos del formulario de inicio de sesión a `POST /users` en la API.
   * No gestiona tokens ni sesiones de servidor (como permite la entrega); solo
   * conserva el estado local de interfaz para la navegación del cliente.
   */
  async login(credentials: LoginCredentials): Promise<boolean> {
    this._status.set('loading');
    this._error.set(null);

    const email = credentials.email?.trim() ?? '';
    const password = credentials.password ?? '';

    if (!email || !password) {
      this._status.set('error');
      this._error.set('Por favor, completa todos los campos.');
      return false;
    }

    try {
      const payload = {
        email,
        password,
        rememberMe: credentials.rememberMe ?? false,
        action: 'login' as const,
        submittedAt: new Date().toISOString(),
      };

      const res = this.http
        ? await firstValueFrom(this.http.post<ApiUserResponse>(this.usersUrl, payload))
        : { id: 'user-001', email };

      const displayName = res?.name?.trim() || this.getNameFromEmail(email);
      const user: User = {
        id: res?.id !== undefined ? String(res.id) : 'user-001',
        name: displayName,
        email,
        avatarInitials: this.getInitials(displayName),
      };

      this._currentUser.set(user);
      this._isAuthenticated.set(true);
      this._status.set('success');

      if (credentials.rememberMe) {
        localStorage.setItem('deficcitto_user', JSON.stringify(user));
      } else {
        sessionStorage.setItem('deficcitto_user', JSON.stringify(user));
      }

      return true;
    } catch (error) {
      const apiErr = toApiError(error);
      this._status.set('error');
      this._error.set(apiErr.message);
      return false;
    }
  }

  /**
   * Envía los datos del formulario de registro a `POST /users` en la API.
   */
  async register(data: RegisterData): Promise<boolean> {
    this._status.set('loading');
    this._error.set(null);

    const name = data.name?.trim() ?? '';
    const email = data.email?.trim() ?? '';
    const password = data.password ?? '';

    if (!name || !email || !password) {
      this._status.set('error');
      this._error.set('Por favor, completa todos los campos.');
      return false;
    }

    if (password !== data.confirmPassword) {
      this._status.set('error');
      this._error.set('Las contraseñas no coinciden.');
      return false;
    }

    try {
      const payload = {
        name,
        email,
        password,
        objective: data.objective,
        acceptTerms: data.acceptTerms,
        action: 'register' as const,
        createdAt: new Date().toISOString(),
      };

      const res = this.http
        ? await firstValueFrom(this.http.post<ApiUserResponse>(this.usersUrl, payload))
        : { id: `user-${Date.now()}`, name, email };

      const user: User = {
        id: res?.id !== undefined ? String(res.id) : `user-${Date.now()}`,
        name: res?.name?.trim() || name,
        email: res?.email?.trim() || email,
        avatarInitials: this.getInitials(name),
      };

      this._currentUser.set(user);
      this._isAuthenticated.set(true);
      this._status.set('success');

      sessionStorage.setItem('deficcitto_user', JSON.stringify(user));
      return true;
    } catch (error) {
      const apiErr = toApiError(error);
      this._status.set('error');
      this._error.set(apiErr.message);
      return false;
    }
  }

  /**
   * Cierra la sesión activa en la interfaz.
   */
  logout(): void {
    this._isAuthenticated.set(false);
    this._currentUser.set(null);
    this._status.set('idle');
    this._error.set(null);
    localStorage.removeItem('deficcitto_token');
    localStorage.removeItem('deficcitto_user');
    sessionStorage.removeItem('deficcitto_token');
    sessionStorage.removeItem('deficcitto_user');
  }

  // ── Private helpers ───────────────────────────────────────

  private checkStoredSession(): void {
    const rawUser =
      localStorage.getItem('deficcitto_user') ||
      sessionStorage.getItem('deficcitto_user');

    if (rawUser) {
      try {
        const user: User = JSON.parse(rawUser);
        this._currentUser.set(user);
        this._isAuthenticated.set(true);
      } catch {
        this.logout();
      }
    }
  }

  private getInitials(name: string): string {
    return name
      .split(' ')
      .slice(0, 2)
      .map(n => n.charAt(0).toUpperCase())
      .join('');
  }

  private getNameFromEmail(email: string): string {
    const local = email.split('@')[0];
    return local.charAt(0).toUpperCase() + local.slice(1);
  }
}
