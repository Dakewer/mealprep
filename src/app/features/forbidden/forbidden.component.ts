import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { RippleDirective } from '../../shared/directives/ripple.directive';

@Component({
  selector: 'app-forbidden',
  standalone: true,
  imports: [RouterLink, RippleDirective],
  template: `
    <div class="forbidden-page">
      <div class="forbidden-card" role="alert" aria-live="assertive">
        <!-- Shield with lock SVG icon -->
        <div class="forbidden-card__icon-badge" aria-hidden="true">
          <svg
            class="forbidden-svg"
            viewBox="0 0 100 100"
            width="64"
            height="64"
            fill="none"
            stroke="currentColor"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <!-- Círculo de advertencia sutil detrás -->
            <circle cx="50" cy="50" r="46" class="forbidden-ring" stroke-width="2" stroke-dasharray="4 4" />

            <!-- Escudo -->
            <path
              d="M 50 18 L 74 27 C 74 54, 50 78, 50 78 C 50 78, 26 54, 26 27 Z"
              stroke-width="3.5"
              class="shield-body"
              fill="currentColor"
              fill-opacity="0.08"
            />

            <!-- Candado centrado -->
            <rect x="41" y="44" width="18" height="15" rx="3" stroke-width="3" fill="#ffffff" />
            <path d="M 45 44 V 38 C 45 35.2, 47.2 33, 50 33 C 52.8 33, 55 35.2, 55 38 V 44" stroke-width="3" />
            <circle cx="50" cy="51" r="2" fill="currentColor" />
          </svg>
        </div>

        <div class="forbidden-card__content">
          <span class="error-code">ERROR 403</span>
          <h1 class="forbidden-card__title">Acceso denegado</h1>
          <p class="forbidden-card__message">
            No cuentas con los permisos suficientes para ingresar a este recurso. Esta sección está reservada exclusivamente para administradores.
          </p>
        </div>

        <div class="forbidden-card__actions">
          <a
            routerLink="/dashboard"
            class="btn btn--primary btn--sm action-btn"
            appRipple
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
              <polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
            <span>Ir al Dashboard</span>
          </a>

          <a
            routerLink="/"
            class="btn btn--ghost-dark btn--sm action-btn"
            appRipple
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <line x1="19" y1="12" x2="5" y2="12"/>
              <polyline points="12 19 5 12 12 5"/>
            </svg>
            <span>Volver al inicio</span>
          </a>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .forbidden-page {
      min-height: calc(100dvh - 120px);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 2.5rem 1.5rem;
      background: var(--clr-light-50, #f9fafb);
    }

    .forbidden-card {
      background: #ffffff;
      border: 1px solid #fed7aa;
      border-radius: var(--radius-2xl, 20px);
      padding: 3rem 2rem;
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      gap: 1.5rem;
      max-width: 520px;
      width: 100%;
      box-shadow: 0 12px 30px -6px rgba(249, 115, 22, 0.1);
      transition: transform var(--transition-base, 200ms ease);
    }

    .forbidden-card__icon-badge {
      width: 5.5rem;
      height: 5.5rem;
      border-radius: 50%;
      background: #fff7ed;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #ea580c;
      transition: transform var(--transition-base, 200ms ease);
    }

    .forbidden-card:hover .forbidden-card__icon-badge {
      transform: scale(1.06) rotate(-2deg);
    }

    .forbidden-svg {
      width: 3.75rem;
      height: 3.75rem;
    }

    .forbidden-ring {
      stroke: #fdba74;
    }

    .shield-body {
      color: #ea580c;
    }

    .forbidden-card__content {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.5rem;
    }

    .error-code {
      font-size: 0.8125rem;
      font-weight: 800;
      letter-spacing: 0.1em;
      color: #c2410c;
      background: #ffedd5;
      padding: 0.2rem 0.65rem;
      border-radius: 9999px;
    }

    .forbidden-card__title {
      font-size: 1.625rem;
      font-weight: 900;
      color: #7c2d12;
      margin: 0;
      font-family: var(--font-display, inherit);
      letter-spacing: -0.02em;
    }

    .forbidden-card__message {
      font-size: 0.9375rem;
      color: var(--text-on-light-3, #6b7280);
      line-height: 1.6;
      margin: 0;
      max-width: 420px;
    }

    .forbidden-card__actions {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      flex-wrap: wrap;
      justify-content: center;
      margin-top: 0.5rem;
    }

    .action-btn {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding-inline: 1.25rem;
      text-decoration: none;
    }
  `],
})
export class ForbiddenComponent {}
