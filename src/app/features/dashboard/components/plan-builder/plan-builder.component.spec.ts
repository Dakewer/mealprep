import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { API_BASE_URL } from '../../../../core/config/api-base-url.token';
import { httpErrorInterceptor } from '../../../../core/interceptors/http-error.interceptor';
import { NutritionPlan } from '../../../../core/models/app.models';
import { NotificationService } from '../../../../core/services/notification.service';
import { PlanBuilderComponent } from './plan-builder.component';

const BASE = 'http://api.test';

function samplePlan(overrides: Partial<NutritionPlan> = {}): NutritionPlan {
  return {
    id: 'plan-10',
    name: 'Comida base',
    description: 'Descripción inicial',
    macroGoals: { calories: 330, protein: 62, carbs: 0, fat: 7 },
    items: [{ ingredientId: 'pollo', grams: 200 }],
    createdAt: '2026-10-31T12:00:00.000Z',
    isFavorite: false,
    tags: ['maintenance'],
    ...overrides,
  };
}

describe('PlanBuilderComponent (C2 y C3)', () => {
  let fixture: ComponentFixture<PlanBuilderComponent>;
  let component: PlanBuilderComponent;
  let http: HttpTestingController;
  let notifications: NotificationService;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [PlanBuilderComponent],
      providers: [
        provideHttpClient(withInterceptors([httpErrorInterceptor])),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: BASE },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PlanBuilderComponent);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    notifications = TestBed.inject(NotificationService);

    // Respuesta a la carga inicial de PlanService
    http.expectOne(r => r.url === `${BASE}/plans`).flush([samplePlan()]);
    fixture.detectChanges();
  });

  afterEach(() => {
    http.verify();
  });

  it('muestra errores por campo cuando se intenta guardar vacío', async () => {
    await component.save();
    fixture.detectChanges();

    expect(component.nameErrorMessage).toBe('El nombre del plan es obligatorio.');
    expect(component.itemsErrorMessage).toBe('Agrega al menos un ingrediente a tu plan.');
    expect(notifications.notifications().some(n => n.type === 'error')).toBe(true);
  });

  it('impide usar un nombre de plan ya existente (validador personalizado)', () => {
    component.nameControl.setValue('  comida base ');
    component.nameControl.markAsTouched();
    component.nameControl.updateValueAndValidity();

    expect(component.nameControl.hasError('duplicateName')).toBe(true);
    expect(component.nameErrorMessage).toContain('Ya existe un plan con este nombre');
  });

  it('deshabilita el botón mientras se envía y limpia el formulario al crear con éxito', async () => {
    component.nameControl.setValue('Cena ligera');
    component.descriptionControl.setValue('Cena rápida');
    component.add('pollo');
    component.setGrams('pollo', 180);

    expect(component.hasUnsavedChanges()).toBe(true);

    const savePromise = component.save();
    expect(component.isSaving()).toBe(true);

    const req = http.expectOne(`${BASE}/plans`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body.name).toBe('Cena ligera');
    expect(req.request.body.description).toBe('Cena rápida');
    req.flush({ ...req.request.body, id: 'plan-99' });

    await savePromise;
    expect(component.isSaving()).toBe(false);
    expect(component.nameControl.value).toBe('');
    expect(component.items().length).toBe(0);
    expect(component.hasUnsavedChanges()).toBe(false);
  });

  it('precarga datos en modo edición y permite conservar el propio nombre (C3)', async () => {
    const existing = samplePlan();
    fixture.componentRef.setInput('initialPlan', existing);
    fixture.detectChanges();

    expect(component.isEditMode()).toBe(true);
    expect(component.nameControl.value).toBe('Comida base');
    expect(component.descriptionControl.value).toBe('Descripción inicial');
    expect(component.items().length).toBe(1);
    expect(component.hasUnsavedChanges()).toBe(false);

    // Ajustar gramos y guardar edición manteniendo el mismo nombre
    component.setGrams('pollo', 250);
    expect(component.hasUnsavedChanges()).toBe(true);

    const updatePromise = component.save();
    const req = http.expectOne(`${BASE}/plans/plan-10`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body.items[0].grams).toBe(250);
    req.flush({ ...req.request.body, id: 'plan-10' });

    await updatePromise;
    expect(component.hasUnsavedChanges()).toBe(false);
  });
});
