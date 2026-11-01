import { TestBed } from '@angular/core/testing';
import { NutritionService } from './nutrition.service';
import { INGREDIENT_CATALOG } from '../data/ingredients.data';
import { UserProfile } from '../models/app.models';

describe('NutritionService', () => {
  let service: NutritionService;

  const profile: UserProfile = {
    sex: 'male', age: 30, weightKg: 80, heightCm: 180,
    activity: 'moderate', objective: 'maintenance',
  };

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(NutritionService);
  });

  it('calcula el BMR con Mifflin-St Jeor', () => {
    // 10*80 + 6.25*180 - 5*30 + 5 = 1780
    expect(service.calculateBmr(profile)).toBe(1780);
  });

  it('calcula el TDEE aplicando el factor de actividad', () => {
    expect(service.calculateTdee(profile)).toBe(Math.round(1780 * 1.55));
  });

  it('reduce un 20 % las calorías en déficit', () => {
    const tdee = service.calculateTdee(profile);
    const goals = service.calculateMacroGoals({ ...profile, objective: 'deficit' });
    expect(goals.calories).toBe(Math.round(tdee * 0.8));
  });

  it('suma macros de ingredientes por gramos', () => {
    const totals = service.calculateTotals(
      [{ ingredientId: 'pollo', grams: 200 }],
      INGREDIENT_CATALOG,
    );
    expect(totals.protein).toBe(62);
    expect(totals.calories).toBe(330);
  });
});
