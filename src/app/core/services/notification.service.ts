import { Injectable, signal } from '@angular/core';

export type NotificationType = 'success' | 'error' | 'warning' | 'info';

export interface Notification {
  id: string;
  type: NotificationType;
  title?: string;
  message: string;
  duration: number;
}

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private _notifications = signal<Notification[]>([]);

  /** Señal pública de solo lectura para el componente de toast */
  readonly notifications = this._notifications.asReadonly();

  // ── Show methods ──────────────────────────────────────────

  success(message: string, title = '¡Listo!'): void {
    this.show(message, 'success', title);
  }

  error(message: string, title = 'Error'): void {
    this.show(message, 'error', title);
  }

  warning(message: string, title = 'Aviso'): void {
    this.show(message, 'warning', title);
  }

  info(message: string, title = 'Información'): void {
    this.show(message, 'info', title);
  }

  // ── Core ──────────────────────────────────────────────────

  show(
    message: string,
    type: NotificationType = 'info',
    title?: string,
    duration = 4500
  ): string {
    const id = `notif-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const notification: Notification = { id, type, title, message, duration };

    this._notifications.update(list => [...list, notification]);

    if (duration > 0) {
      setTimeout(() => this.dismiss(id), duration);
    }

    return id;
  }

  dismiss(id: string): void {
    this._notifications.update(list => list.filter(n => n.id !== id));
  }

  dismissAll(): void {
    this._notifications.set([]);
  }
}
