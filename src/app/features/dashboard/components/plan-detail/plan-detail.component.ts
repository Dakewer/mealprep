import { Component, computed, inject, input, signal, viewChild } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../../core/services/auth.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { NutritionService } from '../../../../core/services/nutrition.service';
import { PlanService } from '../../../../core/services/plan.service';
import { ConfirmModalComponent } from '../../../../shared/components/confirm-modal/confirm-modal.component';
import { MacroBarsComponent } from '../../../../shared/components/macro-bars/macro-bars.component';
import { RippleDirective } from '../../../../shared/directives/ripple.directive';

@Component({
  selector: 'app-plan-detail',
  standalone: true,
  imports: [
    DatePipe,
    RouterLink,
    RippleDirective,
    MacroBarsComponent,
    ConfirmModalComponent,
  ],
  templateUrl: './plan-detail.component.html',
  styleUrl: './plan-detail.component.css',
})
export class PlanDetailComponent {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private notif = inject(NotificationService);
  private nutrition = inject(NutritionService);
  plans = inject(PlanService);
  authService = inject(AuthService);

  // Puede venir directamente por input binding o por route snapshot
  id = input<string>();

  confirmModal = viewChild.required<ConfirmModalComponent>('confirmModal');

  readonly planId = computed(() => {
    return this.id() || this.route.snapshot.paramMap.get('id') || '';
  });

  readonly plan = computed(() => {
    const id = this.planId();
    return this.plans.plans().find(p => p.id === id);
  });

  /** Desglose completo de ingredientes con valores calculados */
  readonly detailedItems = computed(() => {
    const currentPlan = this.plan();
    if (!currentPlan) return [];

    return currentPlan.items.map(item => {
      const ingredient = this.plans.ingredients.find(i => i.id === item.ingredientId);
      const factor = item.grams / 100;

      return {
        ...item,
        ingredientName: ingredient?.name ?? item.ingredientId,
        category: ingredient?.category ?? 'Abarrotes',
        unit: ingredient?.unit ?? 'g',
        calories: ingredient ? Math.round(ingredient.calories * factor) : 0,
        protein: ingredient ? +(ingredient.protein * factor).toFixed(1) : 0,
        carbs: ingredient ? +(ingredient.carbs * factor).toFixed(1) : 0,
        fat: ingredient ? +(ingredient.fat * factor).toFixed(1) : 0,
      };
    });
  });

  /** Porcentajes de macronutrientes del plan */
  readonly macroPercentages = computed(() => {
    const currentPlan = this.plan();
    if (!currentPlan) return { protein: 0, carbs: 0, fat: 0 };

    const { protein, carbs, fat } = currentPlan.macroGoals;
    const proteinCal = protein * 4;
    const carbsCal = carbs * 4;
    const fatCal = fat * 9;
    const totalCal = proteinCal + carbsCal + fatCal;

    if (totalCal === 0) return { protein: 0, carbs: 0, fat: 0 };

    return {
      protein: Math.round((proteinCal / totalCal) * 100),
      carbs: Math.round((carbsCal / totalCal) * 100),
      fat: Math.round((fatCal / totalCal) * 100),
    };
  });

  toggleFavorite(): void {
    const currentPlan = this.plan();
    if (currentPlan) {
      this.plans.toggleFavorite(currentPlan.id);
      const isFavNow = !currentPlan.isFavorite;
      this.notif.info(
        isFavNow
          ? `Plan "${currentPlan.name}" añadido a favoritos.`
          : `Plan "${currentPlan.name}" retirado de favoritos.`
      );
    }
  }

  generateShoppingList(): void {
    const currentPlan = this.plan();
    if (!currentPlan) return;

    if (this.plans.generateShoppingList(currentPlan.id)) {
      this.notif.success('Lista de compras generada a partir de este plan.');
      this.router.navigate(['/dashboard']);
    }
  }

  requestDelete(): void {
    const currentPlan = this.plan();
    if (currentPlan) {
      this.confirmModal().open(currentPlan.name);
    }
  }

  onDeleteConfirmed(): void {
    const currentPlan = this.plan();
    if (currentPlan) {
      this.plans.deletePlan(currentPlan.id);
      this.confirmModal().close();
      this.notif.success(`El plan "${currentPlan.name}" fue eliminado.`);
      this.router.navigate(['/dashboard']);
    }
  }

  categoryColorClass(category: string): string {
    switch (category) {
      case 'Verduras':
        return 'cat-badge--verduras';
      case 'Carnes':
        return 'cat-badge--carnes';
      case 'Lácteos':
        return 'cat-badge--lacteos';
      default:
        return 'cat-badge--abarrotes';
    }
  }
}
