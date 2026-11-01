import { Component, inject, output } from '@angular/core';
import { DatePipe } from '@angular/common';
import { IngredientCategory, ShoppingItem, ShoppingList } from '../../../../core/models/app.models';
import { NotificationService } from '../../../../core/services/notification.service';
import { PlanService } from '../../../../core/services/plan.service';
import { RippleDirective } from '../../../../shared/directives/ripple.directive';

const CATEGORY_ORDER: IngredientCategory[] = ['Verduras', 'Carnes', 'Abarrotes', 'Lácteos'];

@Component({
  selector: 'app-shopping-list',
  standalone: true,
  imports: [DatePipe, RippleDirective],
  templateUrl: './shopping-list.component.html',
  styleUrl: './shopping-list.component.css',
})
export class ShoppingListComponent {
  private notif = inject(NotificationService);
  plans = inject(PlanService);

  /** Se emite cuando el usuario quiere ir a sus planes (no hay listas aún). */
  plansRequested = output<void>();

  /** Agrupa los productos por sección del supermercado. */
  groups(list: ShoppingList): { category: IngredientCategory; items: ShoppingItem[] }[] {
    return CATEGORY_ORDER
      .map(category => ({ category, items: list.items.filter(i => i.category === category) }))
      .filter(g => g.items.length > 0);
  }

  progress(list: ShoppingList): string {
    const done = list.items.filter(i => i.isChecked).length;
    return `${done} de ${list.items.length} comprados`;
  }

  toggle(listId: string, ingredientId: string): void {
    this.plans.toggleShoppingItem(listId, ingredientId);
  }

  remove(list: ShoppingList): void {
    this.plans.deleteList(list.id);
    this.notif.info('Lista eliminada.');
  }
}
