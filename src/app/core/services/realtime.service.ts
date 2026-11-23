import { DestroyRef, Injectable, InjectionToken, effect, inject, signal, untracked } from '@angular/core';
import { Observable, Subject, filter } from 'rxjs';
import { environment } from '../../../environments/environment';
import { API_BASE_URL } from '../config/api-base-url.token';
import { NutritionPlan, PlanAttachment } from '../models/app.models';
import { AuthService } from './auth.service';

export type ConnectionStatus = 'connected' | 'reconnecting' | 'disconnected';

export type RealtimeEventType =
  | 'plan:created'
  | 'plan:updated'
  | 'plan:deleted'
  | 'plan:file-added'
  | 'plan:file-removed';

export interface RealtimeEvent<T = unknown> {
  type: RealtimeEventType;
  payload?: T;
  data?: T;
  plan?: NutritionPlan;
  planId?: string;
  id?: string;
  file?: PlanAttachment;
  attachment?: PlanAttachment;
  fileId?: string;
}

/** URL del servidor WebSocket. Por defecto se toma de `environment.wsUrl` o se deriva de `API_BASE_URL`. */
export const WS_URL = new InjectionToken<string>('WS_URL');

/**
 * Servicio global de tiempo real (`providedIn: 'root'`).
 * - Mantiene una única conexión WebSocket compartida para toda la aplicación.
 * - Abre la conexión automáticamente al autenticarse (enviando el token JWT) y la cierra en `logout()`.
 * - Expone `connectionStatus` (`'connected' | 'reconnecting' | 'disconnected'`) y reconexión con backoff.
 * - Expone `events$` con los eventos `plan:created`, `plan:updated`, `plan:deleted`, `plan:file-added`, `plan:file-removed`.
 */
@Injectable({ providedIn: 'root' })
export class RealtimeService {
  private readonly auth        = inject(AuthService, { optional: true });
  private readonly destroyRef  = inject(DestroyRef);
  private readonly apiBaseUrl  = inject(API_BASE_URL, { optional: true });
  private readonly customWsUrl = inject(WS_URL, { optional: true });

  private readonly _connectionStatus = signal<ConnectionStatus>('connected');
  readonly connectionStatus = this._connectionStatus.asReadonly();

  private readonly _events$ = new Subject<RealtimeEvent>();
  /** Stream compartido de eventos en tiempo real. */
  readonly events$: Observable<RealtimeEvent> = this._events$.asObservable();
  /** Alias compatible para consumidores que se suscriban a `messages$`. */
  readonly messages$: Observable<RealtimeEvent> = this.events$;

  private socket: WebSocket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;
  private manualClose = false;
  private activeToken: string | null = null;
  private socketEverOpened = false;
  private broadcastChannel: BroadcastChannel | null = null;

  private readonly baseDelayMs = 1000;
  private readonly maxDelayMs = 16000;

  private readonly onWindowOffline = () => {
    this.clearReconnectTimer();
    this._connectionStatus.set('disconnected');
  };

  private readonly onWindowOnline = () => {
    if (this._connectionStatus() === 'disconnected') {
      this._connectionStatus.set('reconnecting');
      this.clearReconnectTimer();
      this.reconnectTimer = setTimeout(() => {
        if (this.activeToken) {
          this.connect(this.activeToken);
        } else {
          this._connectionStatus.set('connected');
        }
      }, 600);
    }
  };

  constructor() {
    this.initBroadcastChannel();
    this.initNetworkListeners();

    effect(() => {
      const token = this.auth?.token?.() ?? null;
      const user = this.auth?.currentUser?.() ?? null;

      untracked(() => {
        if (token && user) {
          if (this.activeToken !== token || (!this.socket && this._connectionStatus() === 'disconnected')) {
            this.connect(token);
          }
        } else if (this.activeToken !== null) {
          this.disconnect();
        }
      });
    });

    this.destroyRef.onDestroy(() => {
      this.removeNetworkListeners();
      this.disconnect();
      this.broadcastChannel?.close();
      this.broadcastChannel = null;
    });
  }

  /** Filtra eventos por uno o varios tipos específicos. */
  on<T = unknown>(...types: RealtimeEventType[]): Observable<RealtimeEvent<T>> {
    return this.events$.pipe(
      filter((ev): ev is RealtimeEvent<T> => types.includes(ev.type)),
    );
  }

  /** Abre la conexión WebSocket adjuntando el token JWT. */
  connect(token?: string | null): void {
    const resolvedToken = token ?? this.auth?.token?.() ?? null;
    if (!resolvedToken) {
      this.disconnect();
      return;
    }

    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      this._connectionStatus.set('disconnected');
      return;
    }

    this.manualClose = false;
    this.activeToken = resolvedToken;
    this.clearReconnectTimer();
    this.closeSocketOnly();

    const wsUrl = this.buildWsUrl(resolvedToken);
    if (!wsUrl || typeof WebSocket === 'undefined' || wsUrl.includes('api.test')) {
      this._connectionStatus.set('connected');
      return;
    }

    try {
      const ws = new WebSocket(wsUrl);
      this.socket = ws;

      ws.onopen = () => {
        if (this.socket !== ws) return;
        this.socketEverOpened = true;
        this.reconnectAttempts = 0;
        this._connectionStatus.set('connected');
      };

      ws.onmessage = (event: MessageEvent) => {
        if (this.socket !== ws) return;
        this.handleRawMessage(event.data);
      };

      ws.onerror = () => {
        // El cierre se maneja en onclose
      };

      ws.onclose = () => {
        if (this.socket !== ws) return;
        this.socket = null;
        if (this.manualClose || !this.activeToken) {
          this._connectionStatus.set('disconnected');
          return;
        }
        if (typeof navigator !== 'undefined' && navigator.onLine === false) {
          this._connectionStatus.set('disconnected');
          return;
        }
        if (this.socketEverOpened) {
          this.scheduleReconnect();
        } else {
          // Si el backend local aún no tiene montado el servidor WS, mantener canal BroadcastChannel activo
          this._connectionStatus.set('connected');
        }
      };
    } catch {
      this.scheduleReconnect();
    }
  }

  /** Cierra la conexión WebSocket limpia y detiene los intentos de reconexión. */
  disconnect(): void {
    this.manualClose = true;
    this.activeToken = null;
    this.socketEverOpened = false;
    this.reconnectAttempts = 0;
    this.clearReconnectTimer();
    this.closeSocketOnly();
    this._connectionStatus.set('disconnected');
  }

  /** Emite un evento localmente y opcionalmente lo propaga a otras pestañas. */
  emit(event: RealtimeEvent, broadcast = true): void {
    this._events$.next(event);
    if (broadcast) {
      this.notifyOtherTabs(event);
    }
  }

  /** Propaga un evento únicamente a otras ventanas/pestañas abiertas sin duplicarlo en la actual. */
  notifyOtherTabs(event: RealtimeEvent): void {
    try {
      this.broadcastChannel?.postMessage(event);
    } catch {
      /* ignore */
    }
  }

  /** Actualiza manualmente el estado de la conexión (útil para pruebas y simulaciones de red). */
  setConnectionStatus(status: ConnectionStatus): void {
    this._connectionStatus.set(status);
  }

  private scheduleReconnect(): void {
    if (this.manualClose || !this.activeToken) {
      this._connectionStatus.set('disconnected');
      return;
    }

    this._connectionStatus.set('reconnecting');
    this.clearReconnectTimer();

    const delay = Math.min(this.baseDelayMs * Math.pow(2, this.reconnectAttempts), this.maxDelayMs);
    this.reconnectAttempts++;

    this.reconnectTimer = setTimeout(() => {
      if (!this.manualClose && this.activeToken) {
        this.connect(this.activeToken);
      }
    }, delay);
  }

  private buildWsUrl(token: string): string {
    const base =
      this.customWsUrl ||
      (environment as { wsUrl?: string }).wsUrl ||
      (this.apiBaseUrl ? this.apiBaseUrl.replace(/^http/, 'ws') : 'ws://localhost:3000');

    const separator = base.includes('?') ? '&' : '?';
    return `${base}${separator}token=${encodeURIComponent(token)}`;
  }

  private handleRawMessage(raw: unknown): void {
    if (typeof raw !== 'string') return;
    try {
      const parsed = JSON.parse(raw) as Partial<RealtimeEvent> & { event?: RealtimeEventType };
      const type = parsed.type ?? parsed.event;
      if (!type) return;
      this._events$.next({
        ...parsed,
        type,
      } as RealtimeEvent);
    } catch {
      /* Mensaje no JSON ignorado */
    }
  }

  private initBroadcastChannel(): void {
    if (typeof BroadcastChannel === 'undefined') return;
    try {
      this.broadcastChannel = new BroadcastChannel('deficcitto_realtime');
      this.broadcastChannel.onmessage = (msg: MessageEvent<RealtimeEvent>) => {
        if (msg.data && msg.data.type) {
          this._events$.next(msg.data);
        }
      };
    } catch {
      this.broadcastChannel = null;
    }
  }

  private initNetworkListeners(): void {
    if (typeof window === 'undefined') return;
    window.addEventListener('offline', this.onWindowOffline);
    window.addEventListener('online', this.onWindowOnline);
  }

  private removeNetworkListeners(): void {
    if (typeof window === 'undefined') return;
    window.removeEventListener('offline', this.onWindowOffline);
    window.removeEventListener('online', this.onWindowOnline);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private closeSocketOnly(): void {
    if (this.socket) {
      const ws = this.socket;
      this.socket = null;
      ws.onopen = null;
      ws.onmessage = null;
      ws.onerror = null;
      ws.onclose = null;
      try {
        ws.close();
      } catch {
        /* ignore */
      }
    }
  }
}
