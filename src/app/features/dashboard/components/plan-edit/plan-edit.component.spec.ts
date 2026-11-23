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

  it('con 403 al guardar (PUT), muestra mensaje en línea, desactiva canDeactivate y ofrece volver al detalle', async () => {
    http.expectOne(r => r.url === `${BASE}/plans`).flush([samplePlan('plan-001')]);
    await Promise.resolve();

    fixture.componentRef.setInput('id', 'plan-001');
    fixture.detectChanges();

    const builder = component.builder()!;
    builder.nameControl.setValue('Intento de edición sin permiso');
    builder.nameControl.markAsDirty();
    builder.planForm.markAsDirty();
    expect(component.hasUnsavedChanges()).toBe(true);

    const savePromise = builder.save();
    http
      .expectOne(`${BASE}/plans/plan-001`)
      .flush({ message: 'Este plan pertenece a otro usuario.' }, { status: 403, statusText: 'Forbidden' });

    await savePromise;
    fixture.detectChanges();

    expect(builder.isSaving()).toBe(false);
    expect(builder.forbiddenError()).toBe('No tienes permiso para editar este plan');
    expect(component.hasUnsavedChanges()).toBe(false);

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('No tienes permiso para editar este plan');
    expect(text).toContain('Volver al detalle');
  });
});
