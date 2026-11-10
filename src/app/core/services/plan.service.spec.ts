import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { API_BASE_URL } from '../config/api-base-url.token';
import { httpErrorInterceptor } from '../interceptors/http-error.interceptor';
import { NutritionPlan, PlanPayload } from '../models/app.models';
import { expInSeconds, fakeJwt } from '../testing/fake-jwt';
import { AuthService } from './auth.service';
import { NotificationService } from './notification.service';
import { PlanService } from './plan.service';

const BASE = 'http://api.test';

function plan(id: string, over: Partial<NutritionPlan> = {}): NutritionPlan {
  return {
    id,
    name: `Plan ${id}`,
    macroGoals: { calories: 330, protein: 62, carbs: 0, fat: 7 },
    items: [{ ingredientId: 'pollo', grams: 200 }],
    createdAt: '2026-10-31T12:00:00.000Z',
    isFavorite: false,
    tags: ['maintenance'],
    ...over,
  };
}

describe('PlanService', () => {
  let service: PlanService;
  let http: HttpTestingController;

  /** Crea el servicio y contesta la carga inicial de planes (GET /plans). */
  function setup(initial: NutritionPlan[] = []): void {
    service = TestBed.inject(PlanService);
    http = TestBed.inject(HttpTestingController);
    http.expectOne(r => r.url === `${BASE}/plans`).flush(initial);
  }

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([httpErrorInterceptor])),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: BASE },
      ],
    });
  });

  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('carga los planes de la API al crearse', async () => {
    setup([plan('1'), plan('2')]);
    await Promise.resolve();
    expect(service.plans().length).toBe(2);
    expect(service.plansStatus()).toBe('loaded');
  });

  it('al cambiar de cuenta vacía los planes y pide los del nuevo usuario; al salir los vacía', async () => {
    setup([plan('1')]);
    await Promise.resolve();
    expect(service.plans().map(p => p.id)).toEqual(['1']);

    const auth = TestBed.inject(AuthService);
    const login = auth.login({ email: 'ana@test.com', password: 'Clave12345' });
    http.expectOne(`${BASE}/auth/login`).flush({
      token: fakeJwt({ exp: expInSeconds(3600), sub: 'usr-2' }),
      user: { id: 'usr-2', name: 'Ana', email: 'ana@test.com' },
    });
    await login;
    TestBed.tick();

    http.expectOne(r => r.url === `${BASE}/plans`).flush([plan('7')]);
    await new Promise(resolve => setTimeout(resolve));
    expect(service.plans().map(p => p.id)).toEqual(['7']);

    auth.logout();
    TestBed.tick();

    expect(service.plans()).toEqual([]);
    expect(service.plansStatus()).toBe('idle');
  });

  it('si la API falla, deja el estado en error y avisa una sola vez', async () => {
    service = TestBed.inject(PlanService);
    http = TestBed.inject(HttpTestingController);
    http.expectOne(r => r.url === `${BASE}/plans`).flush({}, { status: 500, statusText: 'Server Error' });
    await Promise.resolve();

    expect(service.plansStatus()).toBe('error');
    expect(service.plansError()?.status).toBe(500);
    expect(TestBed.inject(NotificationService).notifications().length).toBe(1);
  });

  it('guarda un plan en la API con los macros calculados', async () => {
    setup();
    const pending = service.savePlan('Lunes', [{ ingredientId: 'pollo', grams: 200 }]);

    const req = http.expectOne(`${BASE}/plans`);
    expect(req.request.method).toBe('POST');
    const body = req.request.body as PlanPayload;
    expect(body.name).toBe('Lunes');
    expect(body.macroGoals.protein).toBe(62);
    req.flush({ ...body, id: 9 });

    const saved = await pending;
    expect(saved?.id).toBe('9');
    expect(service.plans()[0].id).toBe('9');
  });

  it('si guardar falla devuelve null y no agrega nada', async () => {
    setup();
    const pending = service.savePlan('Lunes', [{ ingredientId: 'pollo', grams: 200 }]);
    http.expectOne(`${BASE}/plans`).flush({}, { status: 500, statusText: 'Server Error' });

    expect(await pending).toBeNull();
    expect(service.plans().length).toBe(0);
  });

  it('edita un plan conservando fecha, favorito y etiquetas', async () => {
    setup([plan('5', { isFavorite: true, tags: ['deficit'] })]);
    await Promise.resolve();
    const pending = service.updatePlan('5', 'Nuevo nombre', [{ ingredientId: 'arroz', grams: 100 }]);

    const req = http.expectOne(`${BASE}/plans/5`);
    expect(req.request.method).toBe('PUT');
    const body = req.request.body as PlanPayload;
    expect(body.isFavorite).toBe(true);
    expect(body.tags).toEqual(['deficit']);
    expect(body.createdAt).toBe('2026-10-31T12:00:00.000Z');
    req.flush({ ...body, id: 5 });

    await pending;
    expect(service.plans()[0].name).toBe('Nuevo nombre');
  });

  it('marca y desmarca favoritos con PATCH', async () => {
    setup([plan('1')]);
    await Promise.resolve();

    const first = service.toggleFavorite('1');
    const on = http.expectOne(`${BASE}/plans/1`);
    expect(on.request.method).toBe('PATCH');
    expect(on.request.body).toEqual({ isFavorite: true });
    on.flush(plan('1', { isFavorite: true }));
    expect(await first).toBe(true);
    expect(service.favoritesCount()).toBe(1);

    const second = service.toggleFavorite('1');
    http.expectOne(`${BASE}/plans/1`).flush(plan('1', { isFavorite: false }));
    await second;
    expect(service.favoritesCount()).toBe(0);
  });

  it('elimina un plan con DELETE', async () => {
    setup([plan('1'), plan('2')]);
    await Promise.resolve();

    const pending = service.deletePlan('1');
    const req = http.expectOne(`${BASE}/plans/1`);
    expect(req.request.method).toBe('DELETE');
    req.flush({});

    expect(await pending).toBe(true);
    expect(service.plans().map(p => p.id)).toEqual(['2']);
  });

  it('si eliminar falla conserva el plan y devuelve false', async () => {
    setup([plan('1')]);
    await Promise.resolve();

    const pending = service.deletePlan('1');
    http.expectOne(`${BASE}/plans/1`).flush({}, { status: 404, statusText: 'Not Found' });

    expect(await pending).toBe(false);
    expect(service.plans().length).toBe(1);
  });

  it('genera una lista de compras a partir de un plan cargado', async () => {
    setup([
      plan('1', {
        items: [
          { ingredientId: 'pollo', grams: 300 },
          { ingredientId: 'brocoli', grams: 150 },
        ],
      }),
    ]);
    await Promise.resolve();

    const list = service.generateShoppingList('1');
    expect(list?.items.length).toBe(2);
    service.toggleShoppingItem(list!.id, 'pollo');
    expect(service.lists()[0].items.find(i => i.ingredientId === 'pollo')?.isChecked).toBe(true);
  });

  it('carga el perfil guardado al crearse el servicio', () => {
    localStorage.setItem(
      'deficcitto_profile_guest',
      JSON.stringify({ sex: 'female', age: 28, weightKg: 60, heightCm: 165, activity: 'light', objective: 'deficit' }),
    );
    setup();
    expect(service.profile().weightKg).toBe(60);
    expect(service.profile().objective).toBe('deficit');
  });
});
