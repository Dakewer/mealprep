import { Component, input } from '@angular/core';
import { SkeletonComponent } from '../skeleton/skeleton.component';

@Component({
  selector: 'app-loading-state',
  standalone: true,
  imports: [SkeletonComponent],
  template: `
    <div class="loading-container" role="status" [attr.aria-label]="message()">
      @if (type() === 'skeleton-grid') {
        <app-skeleton variant="plan-grid" [count]="count()" [ariaLabel]="message()" />
      } @else {
        <div class="spinner-box">
          <div class="spinner" aria-hidden="true">
            <svg viewBox="0 0 50 50" class="spinner-svg">
              <circle
                cx="25"
                cy="25"
                r="20"
                fill="none"
                stroke-width="4"
                stroke="currentColor"
                stroke-linecap="round"
                stroke-dasharray="90,150"
                stroke-dashoffset="0"
              />
            </svg>
          </div>
          <p class="loading-message">{{ message() }}</p>
        </div>
      }
    </div>
  `,
  styles: [`
    .loading-container {
      width: 100%;
      padding: 1rem 0;
    }

    .spinner-box {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 1rem;
      padding: 3rem 1rem;
      color: var(--text-on-light-3, #6b7280);
    }

    .spinner {
      width: 2.75rem;
      height: 2.75rem;
      color: var(--clr-primary-600, #16a34a);
    }

    .spinner-svg {
      animation: rotate 1.4s linear infinite;
    }

    .spinner-svg circle {
      animation: dash 1.4s ease-in-out infinite;
    }

    .loading-message {
      font-size: 0.9375rem;
      font-weight: 500;
      color: var(--text-on-light-2, #374151);
    }

    @keyframes rotate {
      to {
        transform: rotate(360deg);
      }
    }

    @keyframes dash {
      0% {
        stroke-dasharray: 1, 150;
        stroke-dashoffset: 0;
      }
      50% {
        stroke-dasharray: 90, 150;
        stroke-dashoffset: -35;
      }
      100% {
        stroke-dasharray: 90, 150;
        stroke-dashoffset: -124;
      }
    }
  `],
})
export class LoadingStateComponent {
  type = input<'skeleton-grid' | 'spinner'>('skeleton-grid');
  message = input('Cargando información...');
  count = input(3);
}
