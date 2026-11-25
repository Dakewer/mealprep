import { DestroyRef, InjectionToken, Injectable, effect, inject, signal, untracked } from '@angular/core';
import { Observable, Subject, filter } from 'rxjs';
import { WS_URL } from '../config/ws-url.token';
import {
  ConnectionStatus,
  RealtimeEventName,
  RealtimeMessage,
} from '../models/app.models';
import { AuthService } from './auth.service';

/** Código con el que el servidor cierra el canal cuando vence el JWT (no se reintenta). */
export const CLOSE_TOKEN_EXPIRED = 4401;

/** Tiempos de la reconexión: 1 s, 2 s, 4 s… hasta un máximo de 30 s (más un poco de azar). */
export const RECONNECT_BASE_MS = 1_000;
export const RECONNECT_MAX_MS = 30_000;

/** Cómo se crea el socket. Se puede sustituir en pruebas por uno falso. */
export const WEBSOCKET_FACTORY = new InjectionToken<(url: string) => WebSocket>('WEBSOCKET_FACTORY', {
  providedIn: 'root',
  factory: () => (url: string) => new WebSocket(url),
});

const EVENT_NAMES: readonly RealtimeEventName[] = [
  'plan:created',
  'plan:updated',
  'plan:deleted',
  'plan:file-added',
  'plan:file-removed',
];

/**
 * Canal en tiempo real: UNA sola conexión WebSocket compartida por toda la app.
 *
 *  - Un `effect` sobre `AuthService.token()` abre la conexión al iniciar sesión (enviando el JWT en
 *    `?token=`) y la cierra al hacer `logout()`. Si cambia el token (otro usuario), se reconecta.
 *  - `connectionStatus` es una señal: `'connected'`, `'reconnecting'` (abriendo o reintentando) o
 *    `'disconnected'` (sin sesión, o el servidor cerró con 4401).
 *  - Si la conexión se cae, reintenta con backoff exponencial mientras la sesión siga vigente.
 *  - Los eventos del servidor salen por `events$` / `on(...)`. El servidor solo envía los de planes
 *    propios (o todos, a un admin), así que aquí no se vuelve a filtrar por dueño.
 */
@Injectable({ providedIn: 'root' })
export class RealtimeService {
  private auth    = inject(AuthService);
  private wsUrl   = inject(WS_URL);
  private factory = inject(WEBSOCKET_FACTORY);

  private _connectionStatus = signal<ConnectionStatus>('disconnected');
  readonly connectionStatus = this._connectionStatus.asReadonly();

  private _events = new Subject<RealtimeMessage>();
  /** Todos los mensajes recibidos, ya validados. */
  readonly events$: Observable<RealtimeMessage> = this._events.asObservable();

  private socket: WebSocket | null = null;
  private currentToken: string | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private attempts = 0;

  constructor() {
    effect(() => {
      const token = this.auth.token();
      // connect/disconnect escriben señales: se ejecutan fuera del seguimiento del effect.
      untracked(() => (token ? this.connect(token) : this.disconnect()));
    });
    inject(DestroyRef).onDestroy(() => this.disconnect());
  }

  /** Solo los mensajes de los eventos indicados, con su carga útil tipada. */
  on<E extends RealtimeEventName>(...names: E[]): Observable<Extract<RealtimeMessage, { event: E }>> {
    return this.events$.pipe(
      filter((m): m is Extract<RealtimeMessage, { event: E }> => (names as RealtimeEventName[]).includes(m.event)),
    );
  }

  // ── Conexión ──────────────────────────────────────────────

  private connect(token: string): void {
    if (token === this.currentToken && this.socket) return; // ya conectado o conectando con este token
    this.disconnect();
    this.currentToken = token;
    this.open();
  }

  private open(): void {
    const token = this.currentToken;
    if (!token) return;

    this._connectionStatus.set('reconnecting');
    let socket: WebSocket;
    try {
      socket = this.factory(this.buildUrl(token));
    } catch {
      this.scheduleRetry();
      return;
    }
    this.socket = socket;

    socket.onopen = () => {
      if (this.socket !== socket) return;
      this.attempts = 0;
      this._connectionStatus.set('connected');
    };
    socket.onmessage = event => {
      if (this.socket === socket) this.handleMessage(event.data);
    };
    socket.onclose = event => {
      if (this.socket !== socket) return; // cierre provocado por nosotros (logout, cambio de token)
      this.socket = null;
      this.handleClose(event.code);
    };
    // `onerror` siempre va seguido de `onclose`, que es donde se decide si se reintenta.
    socket.onerror = () => undefined;
  }

  private handleClose(code: number): void {
    if (code === CLOSE_TOKEN_EXPIRED) {
      this._connectionStatus.set('disconnected');
      this.auth.checkSession(); // si el JWT venció, cierra la sesión y el effect limpia el resto
      return;
    }
    // Un token que dejó de servir no se reintenta (el navegador no ve el 401 del "upgrade").
    if (this.auth.checkSession() !== 'valid') {
      this._connectionStatus.set('disconnected');
      return;
    }
    this.scheduleRetry();
  }

  private scheduleRetry(): void {
    this._connectionStatus.set('reconnecting');
    const delay = Math.min(RECONNECT_BASE_MS * 2 ** this.attempts, RECONNECT_MAX_MS);
    this.attempts++;
    const jitter = delay * 0.2 * Math.random(); // evita que todos los clientes reconecten a la vez
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      this.open();
    }, delay + jitter);
  }

  private disconnect(): void {
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = null;
    this.attempts = 0;
    this.currentToken = null;

    const socket = this.socket;
    this.socket = null; // antes de cerrar: así `onclose` sabe que fue intencional
    if (socket) {
      try { socket.close(1000, 'client closed'); } catch { /* ya estaba cerrado */ }
    }
    this._connectionStatus.set('disconnected');
  }

  private buildUrl(token: string): string {
    const url = new URL(this.wsUrl);
    url.searchParams.set('token', token);
    return url.toString();
  }

  private handleMessage(raw: unknown): void {
    if (typeof raw !== 'string') return;
    try {
      const message = JSON.parse(raw) as Partial<RealtimeMessage> | null;
      if (message && EVENT_NAMES.includes(message.event as RealtimeEventName) && message.data) {
        this._events.next(message as RealtimeMessage);
      }
    } catch {
      /* mensaje mal formado: se ignora */
    }
  }
}
