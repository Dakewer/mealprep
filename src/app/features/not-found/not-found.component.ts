import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { RippleDirective } from '../../shared/directives/ripple.directive';

@Component({
  selector: 'app-not-found',
  standalone: true,
  imports: [RouterLink, RippleDirective],
  template: `
    <div class="not-found-page">
      <div class="not-found-card" role="alert" aria-live="assertive">
        <!-- Dish & Magnifying glass SVG icon -->
        <div class="not-found-card__icon-badge" aria-hidden="true">
          <svg
            class="not-found-svg"
            viewBox="0 0 100 100"
            width="64"
            height="64"
            fill="none"
            stroke="currentColor"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <!-- Círculo sutil exterior -->
            <circle cx="50" cy="50" r="46" class="not-found-ring" stroke-width="2" stroke-dasharray="4 4" />

            <!-- Plato base -->
            <ellipse cx="50" cy="56" rx="34" ry="14" stroke-width="3" />
            <ellipse cx="50" cy="56" rx="24" ry="9" stroke-width="2" stroke-dasharray="2 3" />

            <!-- Lupa buscando la receta -->
            <circle cx="48" cy="38" r="14" stroke-width="3.5" class="glass-rim" fill="#ffffff" />
            <line x1="58" y1="48" x2="72" y2="62" stroke-width="4.5" stroke-linecap="round" />
            <path d="M 44 35 Q 48 31 52 35" stroke-width="2" stroke-linecap="round" />
          </svg>
        </div>

        <div class="not-found-card__content">
          <span class="error-code">ERROR 404</span>
          <h1 class="not-found-card__title">Página no encontrada</h1>
          <p class="not-found-card__message">
            No encontramos la página o receta que estás buscando. Puede que el enlace esté roto o haya sido trasladado.
          </p>
        </div>

        <div class="not-found-card__actions">
          <a
            routerLink="/"
            class="btn btn--primary btn--sm action-btn"
            appRipple
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <line x1="19" y1="12" x2="5" y2="12"/>
              <polyline points="12 19 5 12 12 5"/>
            </svg>
            <span>Volver al inicio</span>
          </a>

          <a
            routerLink="/dashboard"
            class="btn btn--ghost-dark btn--sm action-btn"
            appRipple
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
              <polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
            <span>Ir al Dashboard</span>
          </a>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .not-found-page {
      min-height: calc(100dvh - 120px);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 2.5rem 1.5rem;
      background: var(--clr-light-50, #f9fafb);
    }

    .not-found-card {
      background: #ffffff;
      border: 1px solid var(--clr-light-200, #e5e7eb);
      border-radius: var(--radius-2xl, 20px);
      padding: 3rem 2rem;
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      gap: 1.5rem;
      max-width: 520px;
      width: 100%;
      box-shadow: 0 12px 30px -6px rgba(0, 0, 0, 0.06);
      transition: transform var(--transition-base, 200ms ease);
    }

    .not-found-card__icon-badge {
      width: 5.5rem;
      height: 5.5rem;
      border-radius: 50%;
      background: var(--clr-light-100, #f3f4f6);
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--clr-primary-600, #16a34a);
      transition: transform var(--transition-base, 200ms ease);
    }

    .not-found-card:hover .not-found-card__icon-badge {
      transform: scale(1.06) rotate(3deg);
    }

    .not-found-svg {
      width: 3.75rem;
      height: 3.75rem;
    }

    .not-found-ring {
      stroke: var(--clr-primary-300, #86efac);
    }

    .glass-rim {
      stroke: var(--clr-primary-600, #16a34a);
    }

    .not-found-card__content {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.5rem;
    }

    .error-code {
      font-size: 0.8125rem;
      font-weight: 800;
      letter-spacing: 0.1em;
      color: var(--clr-primary-700, #15803d);
      background: #ecfdf5;
      padding: 0.2rem 0.65rem;
      border-radius: 9999px;
    }

    .not-found-card__title {
      font-size: 1.625rem;
      font-weight: 900;
      color: var(--text-on-light, #111827);
      margin: 0;
      font-family: var(--font-display, inherit);
      letter-spacing: -0.02em;
    }

    .not-found-card__message {
      font-size: 0.9375rem;
      color: var(--text-on-light-3, #6b7280);
      line-height: 1.6;
      margin: 0;
      max-width: 420px;
    }

    .not-found-card__actions {
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
export class NotFoundComponent {}
