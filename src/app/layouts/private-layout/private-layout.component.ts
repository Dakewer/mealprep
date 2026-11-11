import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { HasRoleDirective } from '../../shared/directives/has-role.directive';
import { RippleDirective } from '../../shared/directives/ripple.directive';

@Component({
  selector: 'app-private-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, RippleDirective, HasRoleDirective],
  template: `
    <div class="private-shell">
      <header class="private-topbar">
        <div class="private-topbar__left">
          <a routerLink="/dashboard" class="private-logo" aria-label="Ir al Dashboard de Deficcitto">
            <span class="logo-icon-wrap" aria-hidden="true">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8z"/>
                <path d="M12 6v6l4 2"/>
              </svg>
            </span>
            <span class="logo-text">Deficcitto</span>
          </a>

          <nav class="private-nav" aria-label="Navegación principal">
            <a
              routerLink="/dashboard"
              routerLinkActive="private-nav__link--active"
              [routerLinkActiveOptions]="{ exact: true }"
              class="private-nav__link"
            >
              Dashboard
            </a>
            <a
              *appHasRole="'admin'"
              routerLink="/admin/usuarios"
              routerLinkActive="private-nav__link--active"
              class="private-nav__link private-nav__link--admin"
            >
              <span>Gestión de Usuarios</span>
              <span class="admin-chip">Admin</span>
            </a>
          </nav>
        </div>

        <div class="private-topbar__right">
          <div class="user-profile-badge">
            <span class="user-avatar" aria-hidden="true">
              {{ authService.currentUser()?.avatarInitials || 'U' }}
            </span>
            <div class="user-info">
              <span class="user-name">{{ authService.currentUser()?.name || 'Usuario' }}</span>
              <span
                class="role-pill"
                [class.role-pill--admin]="isAdmin()"
                [class.role-pill--user]="!isAdmin()"
              >
                {{ isAdmin() ? 'Administrador' : 'Usuario' }}
              </span>
            </div>
          </div>

          <button
            type="button"
            class="btn btn--ghost-dark btn--sm logout-btn"
            (click)="handleLogout()"
            appRipple
            aria-label="Cerrar sesión y volver al inicio"
          >
            <svg class="logout-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            <span>Cerrar sesión</span>
          </button>
        </div>
      </header>

      <main class="private-content">
        <router-outlet></router-outlet>
      </main>
    </div>
  `,
  styles: [`
    .private-shell {
      min-height: 100dvh;
      display: flex;
      flex-direction: column;
      background: var(--clr-light-50, #f9fafb);
    }

    .private-topbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.875rem 2rem;
      background: #ffffff;
      border-bottom: 1px solid var(--clr-light-200, #e5e7eb);
      position: sticky;
      top: 0;
      z-index: 100;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
      gap: 1rem;
    }

    .private-topbar__left {
      display: flex;
      align-items: center;
      gap: 2rem;
    }

    .private-logo {
      display: flex;
      align-items: center;
      gap: 0.625rem;
      text-decoration: none;
      color: var(--clr-primary-700, #15803d);
      font-family: var(--font-display, inherit);
      font-weight: 800;
      font-size: 1.25rem;
      letter-spacing: -0.02em;
    }

    .logo-icon-wrap {
      width: 2.25rem;
      height: 2.25rem;
      border-radius: var(--radius-md, 8px);
      background: #ecfdf5;
      color: var(--clr-primary-600, #16a34a);
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .private-nav {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .private-nav__link {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem 0.875rem;
      border-radius: var(--radius-md, 8px);
      font-size: 0.875rem;
      font-weight: 600;
      color: var(--text-on-light-3, #6b7280);
      text-decoration: none;
      transition: all var(--transition-fast, 150ms ease);
    }

    .private-nav__link:hover {
      color: var(--text-on-light, #111827);
      background: var(--clr-light-100, #f3f4f6);
    }

    .private-nav__link--active {
      color: var(--clr-primary-700, #15803d);
      background: #ecfdf5;
    }

    .admin-chip {
      font-size: 0.6875rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      padding: 0.15rem 0.45rem;
      background: #fef3c7;
      color: #92400e;
      border-radius: 9999px;
    }

    .private-topbar__right {
      display: flex;
      align-items: center;
      gap: 1.25rem;
    }

    .user-profile-badge {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .user-avatar {
      width: 2.25rem;
      height: 2.25rem;
      border-radius: 50%;
      background: linear-gradient(135deg, var(--clr-primary-600, #16a34a), var(--clr-primary-700, #15803d));
      color: #ffffff;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.8125rem;
      font-weight: 800;
      letter-spacing: -0.02em;
      box-shadow: 0 2px 4px rgba(22, 163, 74, 0.2);
    }

    .user-info {
      display: flex;
      flex-direction: column;
      gap: 0.125rem;
    }

    .user-name {
      font-size: 0.875rem;
      font-weight: 700;
      color: var(--text-on-light, #111827);
      line-height: 1.2;
    }

    .role-pill {
      display: inline-block;
      font-size: 0.6875rem;
      font-weight: 700;
      letter-spacing: 0.03em;
      text-transform: uppercase;
      padding: 0.1rem 0.5rem;
      border-radius: 9999px;
      width: fit-content;
      line-height: 1.3;
    }

    .role-pill--admin {
      background: #dcfce7;
      color: #15803d;
      border: 1px solid #bbf7d0;
    }

    .role-pill--user {
      background: #f1f5f9;
      color: #475569;
      border: 1px solid #e2e8f0;
    }

    .logout-btn {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.45rem 0.875rem;
      font-size: 0.8125rem;
      font-weight: 600;
      border-radius: var(--radius-md, 8px);
    }

    .logout-icon {
      flex-shrink: 0;
    }

    .private-content {
      flex: 1;
    }

    @media (max-width: 768px) {
      .private-topbar {
        padding: 0.75rem 1rem;
      }
      .user-info {
        display: none;
      }
      .private-nav {
        gap: 0.25rem;
      }
    }
  `],
})
export class PrivateLayoutComponent {
  readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  isAdmin(): boolean {
    return this.authService.hasRole('admin');
  }

  handleLogout(): void {
    this.authService.logout();
    this.router.navigate(['/']);
  }
}
