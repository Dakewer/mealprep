import {
  Component,
  computed,
  inject,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { NutritionPlan } from '../../../../core/models/app.models';
import { NotificationService } from '../../../../core/services/notification.service';
import { PlanService } from '../../../../core/services/plan.service';
import { RippleDirective } from '../../../../shared/directives/ripple.directive';
import { ConfirmModalComponent } from '../../../../shared/components/confirm-modal/confirm-modal.component';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { ErrorStateComponent } from '../../../../shared/components/error-state/error-state.component';
import { LoadingStateComponent } from '../../../../shared/components/loading-state/loading-state.component';

@Component({
  selector: 'app-plan-list',
  standalone: true,
  imports: [
    DatePipe,
    RouterLink,
    RippleDirective,
    ConfirmModalComponent,
    EmptyStateComponent,
    ErrorStateComponent,
    LoadingStateComponent,
  ],
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

  // ── Estados de UI (B1) ──────────────────────────────────
  isLoading = signal<boolean>(false);
  hasError = signal<boolean>(false);
  errorMessage = signal<string>('');

  // ── Búsqueda con Debounce (B2) ──────────────────────────
  searchInputRaw = signal<string>('');
  debouncedSearch = signal<string>('');
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  // ── Paginación (B2) ─────────────────────────────────────
  readonly pageSize = signal<number>(4);
  currentPage = signal<number>(1);

  // ── Modal de confirmación (B4) ──────────────────────────
  confirmModal = viewChild.required<ConfirmModalComponent>('deleteModal');
  planPendingDeletion = signal<{ id: string; name: string } | null>(null);

  // ── Planes Filtrados y Paginados ────────────────────────
  filteredPlans = computed(() => {
    const query = this.debouncedSearch().toLowerCase().trim();
    const all = this.plans.plans();

    if (!query) {
      return all;
    }

    return all.filter(plan => {
      const matchName = plan.name.toLowerCase().includes(query);
      const matchTag = plan.tags?.some(t => t.toLowerCase().includes(query));
      const matchIngredient = plan.items.some(item => {
        const ingName = this.ingredientName(item.ingredientId).toLowerCase();
        return ingName.includes(query);
      });
      return matchName || matchTag || matchIngredient;
    });
  });

  totalPages = computed(() => {
    const count = this.filteredPlans().length;
    return Math.max(1, Math.ceil(count / this.pageSize()));
  });

  pagedPlans = computed(() => {
    const startIndex = (this.currentPage() - 1) * this.pageSize();
    return this.filteredPlans().slice(startIndex, startIndex + this.pageSize());
  });

  paginationPages = computed(() => {
    return Array.from({ length: this.totalPages() }, (_, i) => i + 1);
  });

  ingredientName(id: string): string {
    return this.plans.ingredients.find(i => i.id === id)?.name ?? id;
  }

  // ── Manejo de Búsqueda ──────────────────────────────────
  onSearchInput(event: Event): void {
    const inputElement = event.target as HTMLInputElement;
    const value = inputElement.value;
    this.searchInputRaw.set(value);

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    // Debounce de 300 ms antes de disparar el filtrado
    this.debounceTimer = setTimeout(() => {
      this.debouncedSearch.set(value);
      this.currentPage.set(1); // Reiniciar a página 1 al buscar
    }, 300);
  }

  clearSearch(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    this.searchInputRaw.set('');
    this.debouncedSearch.set('');
    this.currentPage.set(1);
  }

  // ── Manejo de Paginación ────────────────────────────────
  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages()) {
      this.currentPage.set(page);
    }
  }

  prevPage(): void {
    if (this.currentPage() > 1) {
      this.currentPage.update(p => p - 1);
    }
  }

  nextPage(): void {
    if (this.currentPage() < this.totalPages()) {
      this.currentPage.update(p => p + 1);
    }
  }

  // ── Generar Lista de Compras ─────────────────────────────
  generate(planId: string): void {
    if (this.plans.generateShoppingList(planId)) {
      this.notif.success('Lista de compras generada correctamente.');
      this.listGenerated.emit();
    }
  }

  async toggleFavorite(planId: string): Promise<void> {
    await this.plans.toggleFavorite(planId);
  }

  // ── Eliminación Accesible con Modal (B4) ──────────────────
  requestDelete(plan: NutritionPlan): void {
    this.planPendingDeletion.set({ id: plan.id, name: plan.name });
    this.confirmModal().open(plan.name);
  }

  async remove(planId: string, name: string): Promise<void> {
    this.requestDelete({ id: planId, name } as NutritionPlan);
  }

  async onDeleteConfirmed(): Promise<void> {
    const target = this.planPendingDeletion();
    if (target) {
      const success = await this.plans.deletePlan(target.id);
      if (success) {
        this.notif.success(`Plan "${target.name}" eliminado correctamente.`);
      }
      this.confirmModal().close();
      this.planPendingDeletion.set(null);

      // Si la página actual queda vacía, retroceder una página
      if (this.pagedPlans().length === 0 && this.currentPage() > 1) {
        this.currentPage.update(p => p - 1);
      }
    }
  }

  onDeleteCancelled(): void {
    this.planPendingDeletion.set(null);
  }

  // ── Reintento y Carga (B1 conectado a la API) ─────────────
  async simulateReload(): Promise<void> {
    this.isLoading.set(true);
    this.hasError.set(false);
    await this.plans.loadPlans();
    this.isLoading.set(false);
  }

  async retryLoad(): Promise<void> {
    this.hasError.set(false);
    this.isLoading.set(true);
    await this.plans.loadPlans();
    this.isLoading.set(false);
    this.notif.info('Planes recargados exitosamente.');
  }
}
