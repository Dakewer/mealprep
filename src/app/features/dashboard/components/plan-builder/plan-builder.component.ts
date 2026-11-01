import { Component, computed, inject, output, signal } from '@angular/core';
import { PlanItem } from '../../../../core/models/app.models';
import { NotificationService } from '../../../../core/services/notification.service';
import { NutritionService } from '../../../../core/services/nutrition.service';
import { PlanService } from '../../../../core/services/plan.service';
import { MacroBarsComponent } from '../../../../shared/components/macro-bars/macro-bars.component';
import { RippleDirective } from '../../../../shared/directives/ripple.directive';

@Component({
  selector: 'app-plan-builder',
  standalone: true,
  imports: [MacroBarsComponent, RippleDirective],
  templateUrl: './plan-builder.component.html',
  styleUrl: './plan-builder.component.css',
})
export class PlanBuilderComponent {
  private notif     = inject(NotificationService);
  private nutrition = inject(NutritionService);
  plans = inject(PlanService);

  /** Se emite cuando el plan se guarda correctamente. */
  saved = output<void>();

  planName = signal('');
  items    = signal<PlanItem[]>([]);

  readonly sliderMin  = 0;
  readonly sliderMax  = 600;
  readonly sliderStep = 10;

  /** Ingredientes del catálogo que aún no están en el plan. */
  available = computed(() => {
    const used = new Set(this.items().map(i => i.ingredientId));
    return this.plans.ingredients.filter(i => !used.has(i.id));
  });

  /** Ingredientes del plan con sus datos, para pintar la lista. */
  rows = computed(() =>
    this.items().map(item => ({
      ...item,
      ingredient: this.plans.ingredients.find(i => i.id === item.ingredientId)!,
    })),
  );

  totals = computed(() => this.nutrition.calculateTotals(this.items(), this.plans.ingredients));

  add(ingredientId: string): void {
    if (!ingredientId) return;
    this.items.update(list => [...list, { ingredientId, grams: 100 }]);
  }

  setGrams(ingredientId: string, grams: number): void {
    this.items.update(list =>
      list.map(i => (i.ingredientId === ingredientId ? { ...i, grams } : i)),
    );
  }

  remove(ingredientId: string): void {
    this.items.update(list => list.filter(i => i.ingredientId !== ingredientId));
  }

  onName(event: Event): void {
    this.planName.set((event.target as HTMLInputElement).value);
  }

  save(): void {
    if (!this.planName().trim()) {
      this.notif.error('Ponle un nombre a tu plan para poder guardarlo.');
      return;
    }
    if (this.items().length === 0) {
      this.notif.warning('Agrega al menos un ingrediente a tu plan.');
      return;
    }
    this.plans.savePlan(this.planName(), this.items());
    this.notif.success('Plan nutricional guardado correctamente.');
    this.planName.set('');
    this.items.set([]);
    this.saved.emit();
  }
}
