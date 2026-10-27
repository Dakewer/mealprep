import { Injectable, signal, computed } from '@angular/core';
import { User, LoginCredentials, RegisterData } from '../models/app.models';

export type AuthStatus = 'idle' | 'loading' | 'success' | 'error';

@Injectable({ providedIn: 'root' })
export class AuthService {
  // ── Private state ─────────────────────────────────────────
  private _isAuthenticated = signal<boolean>(false);
  private _currentUser = signal<User | null>(null);
  private _status = signal<AuthStatus>('idle');
  private _error = signal<string | null>(null);

  // ── Public readonly signals ───────────────────────────────
  readonly isAuthenticated = this._isAuthenticated.asReadonly();
  readonly currentUser     = this._currentUser.asReadonly();
  readonly status          = this._status.asReadonly();
  readonly error           = this._error.asReadonly();

  readonly isLoading = computed(() => this._status() === 'loading');

  constructor() {
    this.checkStoredSession();
  }

  // ── Auth actions ──────────────────────────────────────────

  /**
   * Simula un login. En producción se reemplaza por una llamada HTTP.
   * Cualquier email/password válido es aceptado en esta versión demo.
   */
  async login(credentials: LoginCredentials): Promise<boolean> {
    this._status.set('loading');
    this._error.set(null);

    // Simulate network delay
    await this.simulateDelay(1000);

    if (!credentials.email || !credentials.password) {
      this._status.set('error');
      this._error.set('Por favor, completa todos los campos.');
      return false;
    }

    const user: User = {
      id: 'user-001',
      name: this.getNameFromEmail(credentials.email),
      email: credentials.email,
      avatarInitials: this.getInitials(this.getNameFromEmail(credentials.email)),
    };

    this._currentUser.set(user);
    this._isAuthenticated.set(true);
    this._status.set('success');

    if (credentials.rememberMe) {
      localStorage.setItem('deficcitto_token', 'mock-jwt-token');
      localStorage.setItem('deficcitto_user', JSON.stringify(user));
    } else {
      sessionStorage.setItem('deficcitto_token', 'mock-jwt-token');
      sessionStorage.setItem('deficcitto_user', JSON.stringify(user));
    }

    return true;
  }

  /**
   * Simula el registro de un nuevo usuario.
   */
  async register(data: RegisterData): Promise<boolean> {
    this._status.set('loading');
    this._error.set(null);

    await this.simulateDelay(1200);

    if (!data.name || !data.email || !data.password) {
      this._status.set('error');
      this._error.set('Por favor, completa todos los campos.');
      return false;
    }

    if (data.password !== data.confirmPassword) {
      this._status.set('error');
      this._error.set('Las contraseñas no coinciden.');
      return false;
    }

    const user: User = {
      id: `user-${Date.now()}`,
      name: data.name,
      email: data.email,
      avatarInitials: this.getInitials(data.name),
    };

    this._currentUser.set(user);
    this._isAuthenticated.set(true);
    this._status.set('success');

    sessionStorage.setItem('deficcitto_token', 'mock-jwt-token');
    sessionStorage.setItem('deficcitto_user', JSON.stringify(user));

    return true;
  }

  /**
   * Cierra la sesión del usuario.
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
    const token =
      localStorage.getItem('deficcitto_token') ||
      sessionStorage.getItem('deficcitto_token');
    const rawUser =
      localStorage.getItem('deficcitto_user') ||
      sessionStorage.getItem('deficcitto_user');

    if (token && rawUser) {
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

  private simulateDelay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
