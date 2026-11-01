import { Component, inject, output } from '@angular/core';
import { DatePipe } from '@angular/common';
import { NotificationService } from '../../../../core/services/notification.service';
import { PlanService } from '../../../../core/services/plan.service';
import { RippleDirective } from '../../../../shared/directives/ripple.directive';

@Component({
  selector: 'app-plan-list',
  standalone: true,
  imports: [DatePipe, RippleDirective],
  templateUrl: './plan-list.component.html',
  styleUrl: './plan-list.component.css',
})
export class PlanListComponent {
  private notif = inject(NotificationService);
  plans = inject(PlanService);

  /** Se emite tras generar una lista de compras, para que el dashboard cambie de pestaña. */
  listGenerated = output<void>();
  /** Se emite cuando el usuario quiere crear su primer plan. */
  createRequested = output<void>();

  ingredientName(id: string): string {
    return this.plans.ingredients.find(i => i.id === id)?.name ?? id;
  }

  generate(planId: string): void {
    if (this.plans.generateShoppingList(planId)) {
      this.notif.success('Lista de compras generada.');
      this.listGenerated.emit();
    }
  }

  toggleFavorite(planId: string): void {
    this.plans.toggleFavorite(planId);
  }

  remove(planId: string, name: string): void {
    if (!confirm(`¿Eliminar el plan "${name}"?`)) return;
    this.plans.deletePlan(planId);
    this.notif.info('Plan eliminado.');
  }
}
