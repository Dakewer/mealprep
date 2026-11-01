import { Component, input, output } from '@angular/core';
import { RippleDirective } from '../../directives/ripple.directive';

@Component({
  selector: 'app-empty-state',
  standalone: true,
  imports: [RippleDirective],
  template: `
    <div class="empty-card">
      <div class="empty-card__icon-wrapper" aria-hidden="true">
        @if (customIcon()) {
          <span class="empty-card__emoji">{{ customIcon() }}</span>
        } @else {
          <!-- Plato vacío con servilleta y ramita verde de mealprep -->
          <svg class="empty-dish-svg" viewBox="0 0 100 100" width="72" height="72" fill="none">
            <!-- Plato exterior -->
            <circle cx="50" cy="50" r="44" fill="#f0fdf4" stroke="#86efac" stroke-width="2.5" />
            <!-- Plato interior (borde fondo) -->
            <circle cx="50" cy="50" r="32" fill="#ffffff" stroke="#bbf7d0" stroke-width="2" />
            <circle cx="50" cy="50" r="22" stroke="#dcfce7" stroke-width="1.5" stroke-dasharray="3 3" />
            <!-- Hoja fresca / brote verde en el centro -->
            <path
              d="M 50 56 C 42 48 44 38 52 36 C 60 38 60 48 50 56 Z"
              fill="#22c55e"
              opacity="0.85"
            />
            <path
              d="M 50 56 C 48 46 54 40 52 36"
              stroke="#ffffff"
              stroke-width="1.5"
              stroke-linecap="round"
            />
            <!-- Tenedor al costado izquierdo -->
            <path d="M 12 36 L 12 64" stroke="#9ca3af" stroke-width="2" stroke-linecap="round" />
            <path d="M 9 36 L 9 44 Q 12 47 15 44 L 15 36" stroke="#9ca3af" stroke-width="1.5" fill="none" />
            <!-- Cuchillo al costado derecho -->
            <path d="M 88 36 L 88 64" stroke="#9ca3af" stroke-width="2" stroke-linecap="round" />
            <path d="M 88 36 Q 84 42 84 48 L 88 48 Z" fill="#9ca3af" />
          </svg>
        }
      </div>

      <div class="empty-card__content">
        <h3 class="empty-card__title">{{ title() }}</h3>
        <p class="empty-card__message">{{ message() }}</p>
      </div>

      @if (actionLabel()) {
        <div class="empty-card__action">
          <button
            type="button"
            class="btn btn--primary btn--sm"
            (click)="action.emit()"
            appRipple
          >
            {{ actionLabel() }}
          </button>
        </div>
      }
    </div>
  `,
  styles: [`
    .empty-card {
      background: #fff;
      border: 2px dashed var(--clr-light-300, #d1d5db);
      border-radius: var(--radius-2xl, 20px);
      padding: 3rem 1.75rem;
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      gap: 1.25rem;
      max-width: 520px;
      margin-inline: auto;
      transition: border-color var(--transition-base, 200ms ease);
    }

    .empty-card:hover {
      border-color: var(--clr-primary-400, #4ade80);
    }

    .empty-card__icon-wrapper {
      width: 5.5rem;
      height: 5.5rem;
      border-radius: 50%;
      background: #f0fdf4;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .empty-dish-svg {
      width: 4.25rem;
      height: 4.25rem;
    }

    .empty-card__emoji {
      font-size: 2.75rem;
      line-height: 1;
    }

    .empty-card__content {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .empty-card__title {
      font-size: 1.25rem;
      font-weight: 800;
      color: var(--text-on-light, #111827);
      margin: 0;
    }

    .empty-card__message {
      font-size: 0.9375rem;
      color: var(--text-on-light-3, #6b7280);
      line-height: 1.6;
      margin: 0;
      max-width: 380px;
    }

    .empty-card__action {
      margin-top: 0.25rem;
    }
  `],
})
export class EmptyStateComponent {
  title = input('Sin planes registrados');
  message = input('Aún no tienes ningún plan guardado. Crea uno nuevo para comenzar a organizar tus comidas semanales.');
  actionLabel = input('');
  customIcon = input('');
  action = output<void>();
}
