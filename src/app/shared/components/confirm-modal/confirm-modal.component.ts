import {
  Component,
  ElementRef,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { RippleDirective } from '../../directives/ripple.directive';

@Component({
  selector: 'app-confirm-modal',
  standalone: true,
  imports: [RippleDirective],
  template: `
    <dialog
      #dialog
      class="confirm-dialog"
      (click)="onBackdropClick($event)"
      (cancel)="onCancel($event)"
      aria-labelledby="confirm-modal-title"
      aria-describedby="confirm-modal-desc"
    >
      <div class="confirm-modal__content" role="document">
        <!-- Badge icon -->
        <div class="confirm-modal__icon-badge" [class.confirm-modal__icon-badge--danger]="variant() === 'danger'" aria-hidden="true">
          @if (variant() === 'danger') {
            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M3 6h18"/>
              <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
              <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
              <line x1="10" y1="11" x2="10" y2="17"/>
              <line x1="14" y1="11" x2="14" y2="17"/>
            </svg>
          } @else {
            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
          }
        </div>

        <h2 id="confirm-modal-title" class="confirm-modal__title">{{ title() }}</h2>

        <p id="confirm-modal-desc" class="confirm-modal__message">
          @if (targetItemName()) {
            ¿Estás seguro de que deseas eliminar <strong class="item-name">"{{ targetItemName() }}"</strong>?
            Esta acción no se puede deshacer y se borrarán sus ingredientes asociados.
          } @else {
            {{ message() }}
          }
        </p>

        <div class="confirm-modal__actions">
          <button
            type="button"
            class="btn btn--outline btn--sm modal-btn"
            (click)="close()"
            [disabled]="isProcessing()"
            appRipple
          >
            {{ cancelLabel() }}
          </button>
          <button
            type="button"
            class="btn btn--sm modal-btn"
            [class.btn--danger]="variant() === 'danger'"
            [class.btn--primary]="variant() !== 'danger'"
            (click)="onConfirm()"
            [disabled]="isProcessing()"
            appRipple
          >
            @if (isProcessing()) {
              <span class="btn-spinner" aria-hidden="true"></span>
              <span>Eliminando...</span>
            } @else {
              <span>{{ confirmLabel() }}</span>
            }
          </button>
        </div>
      </div>
    </dialog>
  `,
  styles: [`
    .confirm-dialog {
      border: none;
      border-radius: var(--radius-2xl, 20px);
      padding: 0;
      max-width: 440px;
      width: calc(100% - 2rem);
      margin: auto;
      box-shadow: 0 25px 60px -15px rgba(0, 0, 0, 0.35);
      background: #ffffff;
      color: var(--text-on-light, #111827);
      animation: dialog-enter 220ms cubic-bezier(0.16, 1, 0.3, 1);
    }

    .confirm-dialog::backdrop {
      background: rgba(10, 15, 20, 0.65);
      backdrop-filter: blur(4px);
      -webkit-backdrop-filter: blur(4px);
      animation: backdrop-fade 200ms ease;
    }

    .confirm-modal__content {
      padding: 2.25rem 2rem 1.75rem;
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      gap: 1rem;
    }

    .confirm-modal__icon-badge {
      width: 4.25rem;
      height: 4.25rem;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #fef2f2;
      color: var(--clr-error, #ef4444);
      margin-bottom: 0.25rem;
    }

    .confirm-modal__icon-badge--danger {
      background: #fee2e2;
      color: #dc2626;
    }

    .confirm-modal__title {
      font-size: 1.25rem;
      font-weight: 800;
      color: var(--text-on-light, #111827);
      margin: 0;
    }

    .confirm-modal__message {
      font-size: 0.9375rem;
      color: var(--text-on-light-3, #6b7280);
      line-height: 1.6;
      margin: 0;
      max-width: 360px;
    }

    .item-name {
      color: var(--text-on-light, #111827);
      font-weight: 700;
    }

    .confirm-modal__actions {
      display: flex;
      gap: 0.75rem;
      width: 100%;
      margin-top: 0.75rem;
      justify-content: flex-end;
    }

    .modal-btn {
      flex: 1;
      padding-block: 0.65rem;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
    }

    .btn--danger {
      background: #dc2626;
      color: #ffffff;
      border: none;
    }

    .btn--danger:hover:not(:disabled) {
      background: #b91c1c;
    }

    .btn-spinner {
      width: 0.875rem;
      height: 0.875rem;
      border: 2px solid rgba(255, 255, 255, 0.4);
      border-top-color: #ffffff;
      border-radius: 50%;
      animation: spin 600ms linear infinite;
    }

    @keyframes spin {
      to {
        transform: rotate(360deg);
      }
    }

    @keyframes dialog-enter {
      from {
        opacity: 0;
        transform: scale(0.95) translateY(10px);
      }
      to {
        opacity: 1;
        transform: scale(1) translateY(0);
      }
    }

    @keyframes backdrop-fade {
      from {
        opacity: 0;
      }
      to {
        opacity: 1;
      }
    }
  `],
})
export class ConfirmModalComponent {
  title = input('¿Eliminar plan?');
  message = input('¿Estás seguro de que deseas eliminar este elemento? Esta acción no se puede deshacer.');
  confirmLabel = input('Eliminar');
  cancelLabel = input('Cancelar');
  variant = input<'danger' | 'warning' | 'primary'>('danger');

  confirmed = output<void>();
  cancelled = output<void>();

  isProcessing = signal(false);
  targetItemName = signal<string>('');

  private dialogRef = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  open(itemName?: string): void {
    this.targetItemName.set(itemName ?? '');
    this.isProcessing.set(false);
    this.dialogRef().nativeElement.showModal();
  }

  close(): void {
    this.isProcessing.set(false);
    this.dialogRef().nativeElement.close();
    this.cancelled.emit();
  }

  onConfirm(): void {
    this.isProcessing.set(true);
    this.confirmed.emit();
  }

  onCancel(event: Event): void {
    event.preventDefault();
    this.close();
  }

  onBackdropClick(event: MouseEvent): void {
    const dialogElement = this.dialogRef().nativeElement;
    const rect = dialogElement.getBoundingClientRect();
    const isOutside =
      event.clientX < rect.left ||
      event.clientX > rect.right ||
      event.clientY < rect.top ||
      event.clientY > rect.bottom;

    if (isOutside && !this.isProcessing()) {
      this.close();
    }
  }
}
