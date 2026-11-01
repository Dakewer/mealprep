import { TestBed } from '@angular/core/testing';
import { PlanService } from './plan.service';

describe('PlanService', () => {
  let service: PlanService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    service = TestBed.inject(PlanService);
    TestBed.tick(); // ejecuta el effect de carga inicial
  });

  it('guarda un plan con los macros calculados', () => {
    const plan = service.savePlan('Lunes', [{ ingredientId: 'pollo', grams: 200 }]);
    expect(service.plans().length).toBe(1);
    expect(plan.macroGoals.protein).toBe(62);
  });

  it('marca y desmarca favoritos', () => {
    const plan = service.savePlan('Martes', [{ ingredientId: 'arroz', grams: 100 }]);
    service.toggleFavorite(plan.id);
    expect(service.favoritesCount()).toBe(1);
    service.toggleFavorite(plan.id);
    expect(service.favoritesCount()).toBe(0);
  });

  it('genera una lista de compras a partir de un plan', () => {
    const plan = service.savePlan('Miércoles', [
      { ingredientId: 'pollo', grams: 300 },
      { ingredientId: 'brocoli', grams: 150 },
    ]);
    const list = service.generateShoppingList(plan.id);
    expect(list?.items.length).toBe(2);
    service.toggleShoppingItem(list!.id, 'pollo');
    expect(service.lists()[0].items.find(i => i.ingredientId === 'pollo')?.isChecked).toBe(true);
  });

  it('carga el perfil guardado al crearse el servicio', () => {
    TestBed.resetTestingModule();
    localStorage.setItem(
      'deficcitto_profile_guest',
      JSON.stringify({ sex: 'female', age: 28, weightKg: 60, heightCm: 165, activity: 'light', objective: 'deficit' }),
    );
    const fresh = TestBed.inject(PlanService);
    expect(fresh.profile().weightKg).toBe(60);
    expect(fresh.profile().objective).toBe('deficit');
  });
});
