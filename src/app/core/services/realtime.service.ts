import { DestroyRef, InjectionToken, Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { Observable, Subject, filter } from 'rxjs';
import { WS_URL } from '../config/ws-url.token';
import {
  ConnectionStatus,
  NutritionPlan,
  PlanAttachment,
  RealtimeEventName,
  RealtimeMessage,
} from '../models/app.models';
import { AuthService } from './auth.service';

export type { ConnectionStatus, RealtimeEventName, RealtimeMessage };

export type RealtimeEventType = RealtimeEventName;

/** Formato flexible aceptado por `emit()` en pruebas o eventos internos. */
export interface RealtimeEventInput {
  event?: RealtimeEventName;
  type?: RealtimeEventName;
  data?: unknown;
  payload?: unknown;
  plan?: NutritionPlan;
  planId?: string;
  id?: string;
  file?: PlanAttachment;
  attachment?: PlanAttachment;
  fileId?: string;
  actorId?: string | null;
  at?: string;
}

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
  private wsUrl   = inject(WS_URL, { optional: true }) ?? 'ws://localhost:3000';
  private factory = inject(WEBSOCKET_FACTORY);

  private _connectionStatus = signal<ConnectionStatus>('disconnected');
  readonly connectionStatus = this._connectionStatus.asReadonly();

  private _forcedOffline = signal<boolean>(false);
  private _browserOnline = signal<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);

  /**
   * Indica si la app se encuentra efectivamente sin conexión para bloquear acciones de red en la UI:
   * - El navegador está offline (`navigator.onLine === false`),
   * - O se forzó el estado `'disconnected'`,
   * - O hay sesión activa y el canal cayó a `'disconnected'`.
   */
  readonly isOffline = computed(() => {
    if (!this._browserOnline()) return true;
    if (this._forcedOffline()) return this._connectionStatus() === 'disconnected';
    const hasToken = Boolean(this.auth.token?.());
    return hasToken && this._connectionStatus() === 'disconnected';
  });

  private _events = new Subject<RealtimeMessage>();
  /** Todos los mensajes recibidos, ya validados. */
  readonly events$: Observable<RealtimeMessage> = this._events.asObservable();

  private socket: WebSocket | null = null;
  private currentToken: string | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private attempts = 0;

  constructor() {
    const onOnline = () => this._browserOnline.set(true);
    const onOffline = () => {
      this._browserOnline.set(false);
      this._connectionStatus.set('disconnected');
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('online', onOnline);
      window.addEventListener('offline', onOffline);
    }

    let initialized = false;
    effect(() => {
      const token = this.auth.token?.() ?? null;
      // connect/disconnect escriben señales: se ejecutan fuera del seguimiento del effect.
      untracked(() => {
        if (token) {
          this.connect(token);
        } else if (initialized || this.currentToken !== null || this.socket !== null) {
          this.disconnect();
        }
        initialized = true;
      });
    });
    inject(DestroyRef).onDestroy(() => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('online', onOnline);
        window.removeEventListener('offline', onOffline);
      }
      this.disconnect();
    });
  }

  /** Solo los mensajes de los eventos indicados, con su carga útil tipada. */
  on<E extends RealtimeEventName>(...names: E[]): Observable<Extract<RealtimeMessage, { event: E }>> {
    return this.events$.pipe(
      filter((m): m is Extract<RealtimeMessage, { event: E }> => (names as RealtimeEventName[]).includes(m.event)),
    );
  }

  /** Publica un evento en `events$` (útil en pruebas unitarias de componentes y servicios). */
  emit(input: RealtimeMessage | RealtimeEventInput, _broadcast = false): void {
    const eventName = (input as RealtimeMessage).event ?? (input as RealtimeEventInput).type;
    if (!eventName) return;

    const raw = input as RealtimeEventInput;
    let data = raw.data ?? raw.payload;
    if (!data) {
      if (raw.plan) data = raw.plan;
      else if (raw.file || raw.attachment) data = raw.file ?? raw.attachment;
      else if (eventName === 'plan:deleted' && (raw.planId || raw.id)) data = { id: String(raw.planId ?? raw.id) };
      else if (eventName === 'plan:file-removed' && raw.fileId) {
        data = {
          id: raw.fileId,
          planId: raw.planId ?? '',
          name: '',
          mimeType: '',
          size: 0,
          url: '',
          createdAt: new Date(0).toISOString(),
        };
      }
    }

    this._events.next({
      event: eventName,
      data: data as never,
      actorId: raw.actorId ?? null,
      at: raw.at ?? new Date().toISOString(),
    } as RealtimeMessage);
  }

  /** Permite cambiar `connectionStatus` en pruebas unitarias de UI y resincronización. */
  setConnectionStatus(status: ConnectionStatus): void {
    this._forcedOffline.set(status === 'disconnected');
    this._connectionStatus.set(status);
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

    this._forcedOffline.set(false);
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
      this._forcedOffline.set(false);
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
      this.auth.checkSession?.(); // si el JWT venció, cierra la sesión y el effect limpia el resto
      return;
    }
    // Un token que dejó de servir no se reintenta (el navegador no ve el 401 del "upgrade").
    if (this.auth.checkSession && this.auth.checkSession() !== 'valid') {
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
    this._forcedOffline.set(false);

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
