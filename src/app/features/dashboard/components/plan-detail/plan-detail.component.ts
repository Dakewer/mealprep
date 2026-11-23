import { Component, computed, effect, inject, input, signal, untracked, viewChild } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ApiError, toApiError } from '../../../../core/errors/api-error';
import { NutritionPlan } from '../../../../core/models/app.models';
import { AuthService } from '../../../../core/services/auth.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { NutritionService } from '../../../../core/services/nutrition.service';
import { PlanService } from '../../../../core/services/plan.service';
import { PlansApiService } from '../../../../core/services/plans-api.service';
import { ConfirmModalComponent } from '../../../../shared/components/confirm-modal/confirm-modal.component';
import { ErrorStateComponent } from '../../../../shared/components/error-state/error-state.component';
import { LoadingStateComponent } from '../../../../shared/components/loading-state/loading-state.component';
import { MacroBarsComponent } from '../../../../shared/components/macro-bars/macro-bars.component';
import { CanManageDirective, HasRoleDirective } from '../../../../shared/directives/has-role.directive';
import { RippleDirective } from '../../../../shared/directives/ripple.directive';

@Component({
  selector: 'app-plan-detail',
  standalone: true,
  imports: [
    DatePipe,
    RouterLink,
    RippleDirective,
    HasRoleDirective,
    CanManageDirective,
    MacroBarsComponent,
    ConfirmModalComponent,
    ErrorStateComponent,
    LoadingStateComponent,
  ],
  templateUrl: './plan-detail.component.html',
  styleUrl: './plan-detail.component.css',
})
export class PlanDetailComponent {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private notif = inject(NotificationService);
  private nutrition = inject(NutritionService);
  private plansApi = inject(PlansApiService);
  plans = inject(PlanService);
  authService = inject(AuthService);

  // Puede venir directamente por input binding o por route snapshot
  id = input<string>();

  confirmModal = viewChild<ConfirmModalComponent>('confirmModal');

  /** Plan cargado directamente por ID cuando no estaba en la caché de PlanService. */
  private readonly fetchedPlan = signal<NutritionPlan | null>(null);
  readonly isLoadingDetail = signal<boolean>(false);
  readonly detailError = signal<ApiError | null>(null);
  readonly isForbidden = computed(() => this.detailError()?.status === 403);

  readonly planId = computed(() => {
    return this.id() || this.route.snapshot.paramMap.get('id') || '';
  });

  readonly plan = computed(() => {
    const id = this.planId();
    const fromStore = this.plans.plans().find(p => p.id === id);
    if (fromStore) return fromStore;
    const fetched = this.fetchedPlan();
    return fetched?.id === id ? fetched : undefined;
  });

  private lastFetchedId = '';

  constructor() {
    effect(() => {
      const id = this.planId();
      const inStore = this.plans.plans().some(p => p.id === id);
      if (!id || inStore) {
        if (inStore) {
          untracked(() => {
            this.detailError.set(null);
            this.isLoadingDetail.set(false);
          });
        }
        return;
      }
      if (this.lastFetchedId === id) return;
      this.lastFetchedId = id;
      untracked(() => {
        void this.fetchPlanById(id);
      });
    });
  }

  async fetchPlanById(id: string): Promise<void> {
    if (!id) return;
    this.isLoadingDetail.set(true);
    this.detailError.set(null);
    try {
      const plan = await firstValueFrom(this.plansApi.get(id));
      this.fetchedPlan.set(plan);
    } catch (error) {
      this.detailError.set(toApiError(error));
    } finally {
      this.isLoadingDetail.set(false);
    }
  }

  /** Indica si el plan pertenece a otro usuario distinto al de la sesión actual. */
  isOtherUserPlan(plan: NutritionPlan): boolean {
    const currentId = this.authService.currentUser()?.id;
    return Boolean(plan.ownerId && currentId && plan.ownerId !== currentId);
  }

  backToDashboard(): void {
    void this.router.navigate(['/dashboard']);
  }

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

  async toggleFavorite(): Promise<void> {
    const currentPlan = this.plan();
    if (!currentPlan) return;
    const wasFav = currentPlan.isFavorite;
    const ok = await this.plans.toggleFavorite(currentPlan.id);
    if (ok) {
      this.notif.info(
        !wasFav
          ? `Plan "${currentPlan.name}" añadido a favoritos.`
          : `Plan "${currentPlan.name}" retirado de favoritos.`,
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
      this.confirmModal()?.open(currentPlan.name);
    }
  }

  async onDeleteConfirmed(): Promise<void> {
    const currentPlan = this.plan();
    if (currentPlan) {
      const ok = await this.plans.deletePlan(currentPlan.id);
      this.confirmModal()?.close();
      if (ok) {
        this.notif.success(`El plan "${currentPlan.name}" fue eliminado.`);
        this.router.navigate(['/dashboard']);
      }
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
