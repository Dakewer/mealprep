import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { API_BASE_URL } from '../config/api-base-url.token';
import { SILENT_ERRORS } from '../interceptors/http-error.interceptor';
import { PlanPayload } from '../models/app.models';
import { PlansApiService } from './plans-api.service';

const BASE = 'http://api.test';

const payload: PlanPayload = {
  name: 'Comida',
  macroGoals: { calories: 500, protein: 30, carbs: 50, fat: 15 },
  items: [{ ingredientId: 'pollo', grams: 150 }],
  createdAt: '2026-10-31T12:00:00.000Z',
  isFavorite: false,
  tags: ['maintenance'],
};

describe('PlansApiService', () => {
  let api: PlansApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: BASE },
      ],
    });
    api = TestBed.inject(PlansApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('lista con búsqueda y paginación y lee el total del encabezado', () => {
    let result: { items: { id: string }[]; total: number; page: number; limit: number | null } | undefined;
    api.list({ q: ' pollo ', page: 2, limit: 5, sort: 'name', order: 'desc' }).subscribe(r => (result = r));

    const req = http.expectOne(r => r.url === `${BASE}/plans`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('q')).toBe('pollo');
    expect(req.request.params.get('_page')).toBe('2');
    expect(req.request.params.get('_limit')).toBe('5');
    expect(req.request.params.get('_sort')).toBe('name');
    expect(req.request.params.get('_order')).toBe('desc');
    req.flush([{ id: 7, name: 'A' }, { id: 'plan-8', name: 'B' }], {
      headers: { 'X-Total-Count': '23' },
    });

    expect(result?.total).toBe(23);
    expect(result?.page).toBe(2);
    expect(result?.limit).toBe(5);
    expect(result?.items.map(i => i.id)).toEqual(['7', 'plan-8']); // ids siempre string
  });

  it('sin parámetros no manda filtros y usa la cantidad recibida como total', () => {
    let total = -1;
    api.list().subscribe(r => (total = r.total));

    const req = http.expectOne(`${BASE}/plans`);
    expect(req.request.params.keys().length).toBe(0);
    req.flush([{ id: 1 }, { id: 2 }, { id: 3 }]);

    expect(total).toBe(3);
  });

  it('filtra por favoritos', () => {
    api.list({ favorite: true }).subscribe();
    const req = http.expectOne(r => r.url === `${BASE}/plans`);
    expect(req.request.params.get('isFavorite')).toBe('true');
    req.flush([]);
  });

  it('obtiene el detalle por id', () => {
    let name = '';
    api.get('plan-001').subscribe(p => (name = p.name));

    const req = http.expectOne(`${BASE}/plans/plan-001`);
    expect(req.request.method).toBe('GET');
    req.flush({ id: 'plan-001', name: 'Desayuno' });

    expect(name).toBe('Desayuno');
  });

  it('crea con POST y devuelve el plan con id', () => {
    let id = '';
    api.create(payload).subscribe(p => (id = p.id));

    const req = http.expectOne(`${BASE}/plans`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    req.flush({ ...payload, id: 13 });

    expect(id).toBe('13');
  });

  it('edita con PUT y con PATCH', () => {
    api.update('5', payload).subscribe();
    const put = http.expectOne(`${BASE}/plans/5`);
    expect(put.request.method).toBe('PUT');
    put.flush({ ...payload, id: 5 });

    api.patch('5', { isFavorite: true }).subscribe();
    const patch = http.expectOne(`${BASE}/plans/5`);
    expect(patch.request.method).toBe('PATCH');
    expect(patch.request.body).toEqual({ isFavorite: true });
    patch.flush({ ...payload, id: 5, isFavorite: true });
  });

  it('elimina con DELETE', () => {
    let done = false;
    api.remove('5').subscribe(() => (done = true));

    const req = http.expectOne(`${BASE}/plans/5`);
    expect(req.request.method).toBe('DELETE');
    req.flush({});

    expect(done).toBe(true);
  });

  it('las lecturas no avisan por defecto y las escrituras sí', () => {
    api.list().subscribe();
    const read = http.expectOne(`${BASE}/plans`);
    expect(read.request.context.get(SILENT_ERRORS)).toBe(true);
    read.flush([]);

    api.create(payload).subscribe();
    const write = http.expectOne(`${BASE}/plans`);
    expect(write.request.context.get(SILENT_ERRORS)).toBe(false);
    write.flush({ ...payload, id: 1 });

    api.list({}, { notify: true }).subscribe();
    const loud = http.expectOne(`${BASE}/plans`);
    expect(loud.request.context.get(SILENT_ERRORS)).toBe(false);
    loud.flush([]);
  });
});
