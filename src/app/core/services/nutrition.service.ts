import { Injectable } from '@angular/core';
import { ActivityLevel, MacroGoals, PlanItem, Ingredient, UserProfile } from '../models/app.models';

export const ACTIVITY_FACTORS: Record<ActivityLevel, number> = {
  sedentary:   1.2,
  light:       1.375,
  moderate:    1.55,
  active:      1.725,
  very_active: 1.9,
};

/** Ajuste calórico según el objetivo del usuario. */
const OBJECTIVE_ADJUSTMENT = {
  deficit:     0.8,  // -20 %
  maintenance: 1,
  surplus:     1.1,  // +10 %
} as const;

/** Cálculos de nutrición puros (sin estado). */
@Injectable({ providedIn: 'root' })
export class NutritionService {
  /** Tasa metabólica basal – fórmula Mifflin-St Jeor. */
  calculateBmr(p: UserProfile): number {
    const base = 10 * p.weightKg + 6.25 * p.heightCm - 5 * p.age;
    return p.sex === 'male' ? base + 5 : base - 161;
  }

  /** Gasto energético total diario (kcal). */
  calculateTdee(p: UserProfile): number {
    return Math.round(this.calculateBmr(p) * ACTIVITY_FACTORS[p.activity]);
  }

  /** Metas diarias de calorías y macros según el objetivo. */
  calculateMacroGoals(p: UserProfile): MacroGoals {
    const calories = Math.round(this.calculateTdee(p) * OBJECTIVE_ADJUSTMENT[p.objective]);
    const protein  = Math.round(p.weightKg * (p.objective === 'deficit' ? 2 : 1.8));
    const fat      = Math.round((calories * 0.25) / 9);
    const carbs    = Math.max(0, Math.round((calories - protein * 4 - fat * 9) / 4));
    return { calories, protein, carbs, fat };
  }

  /** Suma los macros de una lista de ingredientes con su cantidad en gramos. */
  calculateTotals(items: PlanItem[], catalog: Ingredient[]): MacroGoals {
    const totals: MacroGoals = { calories: 0, protein: 0, carbs: 0, fat: 0 };
    for (const item of items) {
      const ing = catalog.find(i => i.id === item.ingredientId);
      if (!ing) continue;
      const factor = item.grams / 100;
      totals.calories += ing.calories * factor;
      totals.protein  += ing.protein  * factor;
      totals.carbs    += ing.carbs    * factor;
      totals.fat      += ing.fat      * factor;
    }
    return {
      calories: Math.round(totals.calories),
      protein:  Math.round(totals.protein),
      carbs:    Math.round(totals.carbs),
      fat:      Math.round(totals.fat),
    };
  }
}
