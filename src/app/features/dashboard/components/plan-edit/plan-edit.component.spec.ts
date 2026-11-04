import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { API_BASE_URL } from '../../../../core/config/api-base-url.token';
import { httpErrorInterceptor } from '../../../../core/interceptors/http-error.interceptor';
import { NutritionPlan } from '../../../../core/models/app.models';
import { PlanEditComponent } from './plan-edit.component';

const BASE = 'http://api.test';

function samplePlan(id = 'plan-001'): NutritionPlan {
  return {
    id,
    name: 'Desayuno proteico',
    description: 'Avena con yogur.',
    macroGoals: { calories: 411, protein: 26, carbs: 68, fat: 5 },
    items: [{ ingredientId: 'avena', grams: 60 }],
    createdAt: '2026-10-11T12:00:00.000Z',
    isFavorite: true,
    tags: ['maintenance'],
  };
}

describe('PlanEditComponent (C3)', () => {
  let fixture: ComponentFixture<PlanEditComponent>;
  let component: PlanEditComponent;
  let http: HttpTestingController;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [PlanEditComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([httpErrorInterceptor])),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: BASE },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PlanEditComponent);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  it('precarga el plan existente en el formulario de edición', async () => {
    http.expectOne(r => r.url === `${BASE}/plans`).flush([samplePlan('plan-001')]);
    await Promise.resolve();

    fixture.componentRef.setInput('id', 'plan-001');
    fixture.detectChanges();

    expect(component.plan()?.name).toBe('Desayuno proteico');
    expect(component.builder()?.nameControl.value).toBe('Desayuno proteico');
    expect(component.hasUnsavedChanges()).toBe(false);
  });

  it('muestra estado 404 cuando el plan solicitado no existe', async () => {
    http.expectOne(r => r.url === `${BASE}/plans`).flush([samplePlan('plan-001')]);
    await Promise.resolve();

    fixture.componentRef.setInput('id', 'no-existe');
    fixture.detectChanges();

    expect(component.plan()).toBeNull();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Plan no encontrado');
  });
});
