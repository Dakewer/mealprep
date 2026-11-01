import { Component, computed, input } from '@angular/core';
import { MacroGoals } from '../../../core/models/app.models';

interface MacroRow {
  label: string;
  unit: string;
  value: number;
  goal: number;
  percent: number;
  over: boolean;
  color: string;
}

/**
 * Barras de progreso de calorías y macros.
 * Uso: <app-macro-bars [totals]="totales" [goals]="metas" />
 */
@Component({
  selector: 'app-macro-bars',
  standalone: true,
  templateUrl: './macro-bars.component.html',
  styleUrl: './macro-bars.component.css',
})
export class MacroBarsComponent {
  totals = input.required<MacroGoals>();
  goals  = input.required<MacroGoals>();

  rows = computed<MacroRow[]>(() => {
    const t = this.totals();
    const g = this.goals();
    const build = (label: string, unit: string, value: number, goal: number, color: string): MacroRow => ({
      label, unit, value, goal, color,
      percent: goal > 0 ? Math.min(100, Math.round((value / goal) * 100)) : 0,
      over: goal > 0 && value > goal * 1.05,
    });
    return [
      build('Calorías',      'kcal', t.calories, g.calories, 'var(--clr-secondary-500)'),
      build('Proteína',      'g',    t.protein,  g.protein,  'var(--clr-primary-600)'),
      build('Carbohidratos', 'g',    t.carbs,    g.carbs,    'var(--clr-info)'),
      build('Grasas',        'g',    t.fat,      g.fat,      'var(--clr-warning)'),
    ];
  });
}
