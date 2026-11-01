import { Component, input } from '@angular/core';

export type SkeletonVariant = 'text' | 'rect' | 'circle' | 'card' | 'plan-card' | 'plan-grid';

@Component({
  selector: 'app-skeleton',
  standalone: true,
  template: `
    @if (variant() === 'plan-grid') {
      <div class="skeleton-grid" role="status" aria-busy="true" [attr.aria-label]="ariaLabel()">
        @for (item of items(); track $index) {
          <div class="skeleton-plan-card">
            <div class="skeleton-plan-head">
              <div class="skeleton-line skeleton-title"></div>
              <div class="skeleton-circle-sm"></div>
            </div>
            <div class="skeleton-line skeleton-date"></div>
            <div class="skeleton-macros-box">
              <div class="skeleton-line skeleton-macros"></div>
            </div>
            <div class="skeleton-ingredients">
              <div class="skeleton-line skeleton-chip"></div>
              <div class="skeleton-line skeleton-chip"></div>
              <div class="skeleton-line skeleton-chip"></div>
            </div>
            <div class="skeleton-actions">
              <div class="skeleton-btn skeleton-btn--primary"></div>
              <div class="skeleton-btn skeleton-btn--ghost"></div>
            </div>
          </div>
        }
      </div>
    } @else if (variant() === 'plan-card') {
      <div class="skeleton-plan-card" role="status" aria-busy="true" [attr.aria-label]="ariaLabel()">
        <div class="skeleton-plan-head">
          <div class="skeleton-line skeleton-title"></div>
          <div class="skeleton-circle-sm"></div>
        </div>
        <div class="skeleton-line skeleton-date"></div>
        <div class="skeleton-macros-box">
          <div class="skeleton-line skeleton-macros"></div>
        </div>
        <div class="skeleton-ingredients">
          <div class="skeleton-line skeleton-chip"></div>
          <div class="skeleton-line skeleton-chip"></div>
          <div class="skeleton-line skeleton-chip"></div>
        </div>
        <div class="skeleton-actions">
          <div class="skeleton-btn skeleton-btn--primary"></div>
          <div class="skeleton-btn skeleton-btn--ghost"></div>
        </div>
      </div>
    } @else {
      <div
        role="status"
        aria-busy="true"
        [attr.aria-label]="ariaLabel()"
        class="skeleton-base"
        [class.skeleton-base--circle]="variant() === 'circle'"
        [class.skeleton-base--card]="variant() === 'card'"
        [style.width]="width()"
        [style.height]="height()"
        [style.border-radius]="borderRadius() || null"
      ></div>
    }
  `,
  styles: [`
    :host {
      display: block;
    }

    /* Shimmer effect base */
    .skeleton-base,
    .skeleton-line,
    .skeleton-circle-sm,
    .skeleton-btn {
      position: relative;
      overflow: hidden;
      background: #e5e7eb;
      border-radius: var(--radius-sm, 6px);
    }

    .skeleton-base::after,
    .skeleton-line::after,
    .skeleton-circle-sm::after,
    .skeleton-btn::after {
      content: '';
      position: absolute;
      inset: 0;
      transform: translateX(-100%);
      background: linear-gradient(
        90deg,
        rgba(255, 255, 255, 0) 0%,
        rgba(255, 255, 255, 0.5) 50%,
        rgba(255, 255, 255, 0) 100%
      );
      animation: shimmer 1.6s infinite ease-in-out;
    }

    @keyframes shimmer {
      100% {
        transform: translateX(100%);
      }
    }

    .skeleton-base--circle {
      border-radius: 50%;
    }

    .skeleton-base--card {
      border-radius: var(--radius-xl, 16px);
      border: 1px solid var(--clr-light-200, #e5e7eb);
      background: #f9fafb;
    }

    /* Skeleton grid for plans */
    .skeleton-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
      gap: 1.25rem;
      width: 100%;
    }

    .skeleton-plan-card {
      background: #fff;
      border: 1px solid var(--clr-light-200, #e5e7eb);
      border-radius: var(--radius-xl, 16px);
      padding: 1.25rem;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
    }

    .skeleton-plan-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 0.5rem;
    }

    .skeleton-title {
      height: 1.2rem;
      width: 65%;
      border-radius: 4px;
    }

    .skeleton-circle-sm {
      width: 1.4rem;
      height: 1.4rem;
      border-radius: 50%;
    }

    .skeleton-date {
      height: 0.75rem;
      width: 40%;
      border-radius: 4px;
    }

    .skeleton-macros-box {
      padding: 0.4rem 0;
    }

    .skeleton-macros {
      height: 1rem;
      width: 85%;
      border-radius: 4px;
    }

    .skeleton-ingredients {
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
      padding-block: 0.25rem;
    }

    .skeleton-chip {
      height: 0.8rem;
      width: 80%;
      border-radius: 4px;
    }

    .skeleton-chip:nth-child(2) {
      width: 60%;
    }

    .skeleton-chip:nth-child(3) {
      width: 70%;
    }

    .skeleton-actions {
      display: flex;
      gap: 0.5rem;
      margin-top: 0.5rem;
    }

    .skeleton-btn {
      height: 2rem;
      border-radius: var(--radius-full, 9999px);
    }

    .skeleton-btn--primary {
      width: 110px;
      background: #dcfce7;
    }

    .skeleton-btn--ghost {
      width: 75px;
      background: #f3f4f6;
    }
  `],
})
export class SkeletonComponent {
  variant = input<SkeletonVariant>('rect');
  width = input<string>('100%');
  height = input<string>('1rem');
  borderRadius = input<string>('');
  count = input<number>(3);
  ariaLabel = input<string>('Cargando contenido...');

  items = () => Array.from({ length: this.count() });
}
