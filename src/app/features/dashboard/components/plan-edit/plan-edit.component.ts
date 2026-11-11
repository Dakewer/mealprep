import { Component, HostListener, computed, inject, input, viewChild } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  HasUnsavedChanges,
  UNSAVED_CHANGES_MESSAGE,
} from '../../../../core/guards/unsaved-changes.guard';
import { NutritionPlan } from '../../../../core/models/app.models';
import { PlanService } from '../../../../core/services/plan.service';
import { ConfirmModalComponent } from '../../../../shared/components/confirm-modal/confirm-modal.component';
import { LoadingStateComponent } from '../../../../shared/components/loading-state/loading-state.component';
import { RippleDirective } from '../../../../shared/directives/ripple.directive';
import { PlanBuilderComponent } from '../plan-builder/plan-builder.component';

@Component({
  selector: 'app-plan-edit',
  standalone: true,
  imports: [
    RouterLink,
    RippleDirective,
    PlanBuilderComponent,
    ConfirmModalComponent,
    LoadingStateComponent,
  ],
  templateUrl: './plan-edit.component.html',
  styleUrl: './plan-edit.component.css',
})
export class PlanEditComponent implements HasUnsavedChanges {
  private route  = inject(ActivatedRoute);
  private router = inject(Router);
  plans          = inject(PlanService);

  /** Permite recibir el ID por input de ruta o leerlo del snapshot. */
  id = input<string>();

  builder      = viewChild<PlanBuilderComponent>('builder');
  discardModal = viewChild<ConfirmModalComponent>('discardModal');

  private pendingDiscardResolver: ((confirm: boolean) => void) | null = null;

  readonly planId = computed(() => {
    return this.id() || this.route.snapshot.paramMap.get('id') || '';
  });

  readonly plan = computed(() => {
    const targetId = this.planId();
    return this.plans.plans().find(p => p.id === targetId) ?? null;
  });

  @HostListener('window:beforeunload', ['$event'])
  onBeforeUnload(event: BeforeUnloadEvent): void {
    if (this.hasUnsavedChanges()) {
      event.preventDefault();
    }
  }

  onSaved(updated: NutritionPlan): void {
    void this.router.navigate(['/dashboard/planes', updated.id]);
  }

  onCancel(): void {
    const current = this.plan();
    if (current) {
      void this.router.navigate(['/dashboard/planes', current.id]);
    } else {
      void this.router.navigate(['/dashboard']);
    }
  }

  // ── HasUnsavedChanges (C1) ────────────────────────────────
  hasUnsavedChanges(): boolean {
    return this.builder()?.hasUnsavedChanges() ?? false;
  }

  confirmDiscardChanges(): Promise<boolean> | boolean {
    const modal = this.discardModal();
    if (!modal) {
      return typeof window !== 'undefined' && typeof window.confirm === 'function'
        ? window.confirm(UNSAVED_CHANGES_MESSAGE)
        : true;
    }

    try {
      modal.open();
      return new Promise<boolean>(resolve => {
        this.pendingDiscardResolver = resolve;
      });
    } catch {
      return typeof window !== 'undefined' && typeof window.confirm === 'function'
        ? window.confirm(UNSAVED_CHANGES_MESSAGE)
        : true;
    }
  }

  onDiscardConfirmed(): void {
    this.discardModal()?.close();
    if (this.pendingDiscardResolver) {
      const resolve = this.pendingDiscardResolver;
      this.pendingDiscardResolver = null;
      resolve(true);
    }
  }

  onDiscardCancelled(): void {
    if (this.pendingDiscardResolver) {
      const resolve = this.pendingDiscardResolver;
      this.pendingDiscardResolver = null;
      resolve(false);
    }
  }
}
