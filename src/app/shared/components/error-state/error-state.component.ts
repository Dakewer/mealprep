import { Component, input, output } from '@angular/core';
import { RippleDirective } from '../../directives/ripple.directive';

@Component({
  selector: 'app-error-state',
  standalone: true,
  imports: [RippleDirective],
  template: `
    <div class="error-card" role="alert" aria-live="assertive">
      <!-- Crossed cutlery forming an X icon -->
      <div class="error-card__icon-badge" aria-hidden="true">
        <svg
          class="crossed-cutlery-svg"
          viewBox="0 0 100 100"
          width="64"
          height="64"
          fill="none"
          stroke="currentColor"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <!-- Círculo de advertencia sutil detrás -->
          <circle cx="50" cy="50" r="46" class="cutlery-ring" stroke-width="2" stroke-dasharray="4 4" />

          <!-- Tenedor (cruzado de arriba-izquierda a abajo-derecha) -->
          <g transform="rotate(45, 50, 50)" class="cutlery-fork">
            <!-- Mango -->
            <line x1="50" y1="50" x2="50" y2="90" stroke-width="4.5" />
            <circle cx="50" cy="90" r="2.5" fill="currentColor" />
            <!-- Cuello y base de los dientes -->
            <path d="M 43 45 C 43 54, 57 54, 57 45" stroke-width="3.5" fill="none" />
            <!-- Dientes del tenedor -->
            <line x1="43" y1="45" x2="43" y2="15" stroke-width="3" />
            <line x1="47.5" y1="46" x2="47.5" y2="15" stroke-width="2.5" />
            <line x1="52.5" y1="46" x2="52.5" y2="15" stroke-width="2.5" />
            <line x1="57" y1="45" x2="57" y2="15" stroke-width="3" />
          </g>

          <!-- Cuchillo (cruzado de arriba-derecha a abajo-izquierda) -->
          <g transform="rotate(-45, 50, 50)" class="cutlery-knife">
            <!-- Mango -->
            <line x1="50" y1="50" x2="50" y2="90" stroke-width="4.5" />
            <circle cx="50" cy="90" r="2.5" fill="currentColor" />
            <!-- Hoja del cuchillo -->
            <path
              d="M 50 50 L 50 15 Q 57 18 57 32 Q 57 46 50 50 Z"
              stroke-width="3"
              fill="currentColor"
              fill-opacity="0.15"
            />
          </g>

          <!-- Destello de advertencia en el cruce (centro X) -->
          <circle cx="50" cy="50" r="4.5" fill="#ef4444" stroke="#ffffff" stroke-width="2" />
        </svg>
      </div>

      <div class="error-card__content">
        <h3 class="error-card__title">{{ title() }}</h3>
        <p class="error-card__message">{{ message() }}</p>
      </div>

      <div class="error-card__actions">
        <button
          type="button"
          class="btn btn--primary btn--sm retry-btn"
          (click)="retry.emit()"
          appRipple
        >
          <svg class="retry-svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <polyline points="23 4 23 10 17 10"/>
            <polyline points="1 20 1 14 7 14"/>
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
          </svg>
          <span>{{ retryLabel() }}</span>
        </button>
      </div>
    </div>
  `,
  styles: [`
    .error-card {
      background: #fff;
      border: 1px solid #fee2e2;
      border-radius: var(--radius-2xl, 20px);
      padding: 2.5rem 1.75rem;
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      gap: 1.25rem;
      max-width: 480px;
      margin-inline: auto;
      box-shadow: 0 10px 25px -5px rgba(239, 68, 68, 0.08);
    }

    .error-card__icon-badge {
      width: 5rem;
      height: 5rem;
      border-radius: 50%;
      background: #fef2f2;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--clr-error, #ef4444);
      transition: transform var(--transition-base, 200ms ease);
    }

    .error-card:hover .error-card__icon-badge {
      transform: scale(1.05) rotate(3deg);
    }

    .crossed-cutlery-svg {
      width: 3.5rem;
      height: 3.5rem;
    }

    .cutlery-ring {
      stroke: #fca5a5;
    }

    .cutlery-fork,
    .cutlery-knife {
      color: #dc2626;
    }

    .error-card__content {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .error-card__title {
      font-size: 1.25rem;
      font-weight: 800;
      color: #991b1b;
      margin: 0;
    }

    .error-card__message {
      font-size: 0.9375rem;
      color: var(--text-on-light-3, #6b7280);
      line-height: 1.6;
      margin: 0;
      max-width: 380px;
    }

    .error-card__actions {
      margin-top: 0.25rem;
    }

    .retry-btn {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding-inline: 1.25rem;
    }

    .retry-svg {
      flex-shrink: 0;
    }
  `],
})
export class ErrorStateComponent {
  title = input('¡Ups! Tuvimos un problema con la receta');
  message = input('No pudimos cargar la información en este momento. Revisa tu conexión o vuelve a intentarlo.');
  retryLabel = input('Reintentar');
  retry = output<void>();
}
