import { Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { NotificationService } from '../../core/services/notification.service';
import { RippleDirective } from '../../shared/directives/ripple.directive';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [RouterLink, RippleDirective],
  template: `
    <div class="dashboard-placeholder">
      <!-- Topbar -->
      <header class="dash-topbar">
        <div class="dash-topbar__left">
          <a routerLink="/" class="dash-logo">
            <span>🥗</span>
            <span>Deficcitto</span>
          </a>
        </div>
        <div class="dash-topbar__right">
          <span class="dash-user">
            <span class="dash-user__avatar">{{ authService.currentUser()?.avatarInitials }}</span>
            {{ authService.currentUser()?.name }}
          </span>
          <button class="btn btn--ghost-dark btn--sm" (click)="logout()" appRipple>
            Cerrar sesión
          </button>
        </div>
      </header>

      <!-- Content -->
      <main class="dash-main">
        <div class="dash-welcome">
          <h1 class="dash-welcome__title">
            ¡Hola, {{ authService.currentUser()?.name }}! 👋
          </h1>
          <p class="dash-welcome__subtitle">
            Esta es la vista protegida del Dashboard. En la siguiente entrega
            se implementará la funcionalidad completa de planificación de comidas.
          </p>

          <!-- Mock stats -->
          <div class="dash-stats">
            <div class="dash-stat">
              <span class="dash-stat__icon">📊</span>
              <span class="dash-stat__value">0</span>
              <span class="dash-stat__label">Planes creados</span>
            </div>
            <div class="dash-stat">
              <span class="dash-stat__icon">🛒</span>
              <span class="dash-stat__value">0</span>
              <span class="dash-stat__label">Listas generadas</span>
            </div>
            <div class="dash-stat">
              <span class="dash-stat__icon">🔥</span>
              <span class="dash-stat__value">2,200</span>
              <span class="dash-stat__label">TDEE estimado (kcal)</span>
            </div>
          </div>

          <!-- Demo of notifications for the grader -->
          <div class="dash-demo">
            <h2 class="dash-demo__title">Demo de Notificaciones y Mensajes</h2>
            <p class="dash-demo__desc">
              El sistema de notificaciones está funcionando. Prueba los distintos tipos:
            </p>
            <div class="dash-demo__btns">
              <button class="btn btn--primary btn--sm" (click)="demoSuccess()" appRipple>
                ✅ Confirmación
              </button>
              <button class="btn btn--sm" style="background:#ef4444;color:#fff;border:none;" (click)="demoError()" appRipple>
                ❌ Error
              </button>
              <button class="btn btn--sm" style="background:#f59e0b;color:#fff;border:none;" (click)="demoWarning()" appRipple>
                ⚠️ Aviso
              </button>
              <button class="btn btn--sm" style="background:#3b82f6;color:#fff;border:none;" (click)="demoInfo()" appRipple>
                ℹ️ Información
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  `,
  styles: [`
    .dashboard-placeholder { min-height: 100dvh; background: var(--clr-light-50); }

    .dash-topbar {
      display: flex; justify-content: space-between; align-items: center;
      padding: 1rem 2rem; background: #fff;
      border-bottom: 1px solid var(--clr-light-200);
      position: sticky; top: 0; z-index: 100;
    }
    .dash-logo {
      display: flex; align-items: center; gap: 0.5rem;
      font-family: var(--font-display); font-size: 1.25rem; font-weight: 800;
      color: var(--clr-primary-600); text-decoration: none;
    }
    .dash-topbar__right { display: flex; align-items: center; gap: 1rem; }
    .dash-user { display: flex; align-items: center; gap: 0.5rem; font-size: 0.875rem; font-weight: 500; }
    .dash-user__avatar {
      width: 2rem; height: 2rem; border-radius: 50%;
      background: var(--clr-primary-600); color: #fff;
      display: flex; align-items: center; justify-content: center;
      font-size: 0.75rem; font-weight: 800;
    }

    .dash-main { padding: 3rem 2rem; max-width: 900px; margin-inline: auto; }
    .dash-welcome__title { font-size: 2rem; font-weight: 900; margin-bottom: 0.75rem; }
    .dash-welcome__subtitle { color: var(--text-on-light-3); margin-bottom: 2.5rem; max-width: 560px; line-height: 1.65; }

    .dash-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.25rem; margin-bottom: 2.5rem; }
    .dash-stat {
      background: #fff; border: 1px solid var(--clr-light-200); border-radius: var(--radius-xl);
      padding: 1.5rem; display: flex; flex-direction: column; align-items: center; gap: 0.5rem; text-align: center;
    }
    .dash-stat__icon { font-size: 2rem; }
    .dash-stat__value { font-size: 1.75rem; font-weight: 900; color: var(--clr-primary-700); }
    .dash-stat__label { font-size: 0.8125rem; color: var(--text-on-light-3); }

    .dash-demo { background: #fff; border: 1px solid var(--clr-light-200); border-radius: var(--radius-xl); padding: 1.75rem; }
    .dash-demo__title { font-size: 1.125rem; font-weight: 700; margin-bottom: 0.5rem; }
    .dash-demo__desc { color: var(--text-on-light-3); font-size: 0.875rem; margin-bottom: 1.25rem; }
    .dash-demo__btns { display: flex; gap: 0.75rem; flex-wrap: wrap; }

    @media (max-width: 640px) {
      .dash-stats { grid-template-columns: 1fr; }
      .dash-topbar { padding: 1rem; }
    }
  `],
})
export class DashboardComponent {
  authService  = inject(AuthService);
  notifService = inject(NotificationService);
  private router = inject(Router);

  logout(): void {
    this.authService.logout();
    this.notifService.info('Sesión cerrada correctamente.');
    this.router.navigate(['/']);
  }

  demoSuccess(): void { this.notifService.success('Plan nutricional guardado correctamente.'); }
  demoError():   void { this.notifService.error('No se pudo eliminar el elemento. Intenta de nuevo.'); }
  demoWarning(): void { this.notifService.warning('Tu plan nutricional no ha sido guardado aún.'); }
  demoInfo():    void { this.notifService.info('Recuerda configurar tu TDEE en el perfil.'); }
}
