import { ApplicationRef, signal } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { API_BASE_URL } from '../config/api-base-url.token';
import { httpErrorInterceptor } from '../interceptors/http-error.interceptor';
import { NutritionPlan, User } from '../models/app.models';
import { AuthService } from './auth.service';
import { PlanService } from './plan.service';

const BASE = 'http://api.test';

function plan(id: string): NutritionPlan {
  return {
    id,
    name: `Plan ${id}`,
    macroGoals: { calories: 330, protein: 62, carbs: 0, fat: 7 },
    items: [{ ingredientId: 'pollo', grams: 200 }],
    createdAt: '2026-10-31T12:00:00.000Z',
    isFavorite: false,
    tags: ['maintenance'],
  };
}

describe('PlanService · cambio de usuario', () => {
  let svc: PlanService;
  let ctl: HttpTestingController;
  let appRef: ApplicationRef;
  const currentUser = signal<User | null>(null);

  beforeEach(() => {
    localStorage.clear();
    currentUser.set(null);
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([httpErrorInterceptor])),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: BASE },
        { provide: AuthService, useValue: { currentUser } },
      ],
    });
    svc = TestBed.inject(PlanService);
    ctl = TestBed.inject(HttpTestingController);
    appRef = TestBed.inject(ApplicationRef);
  });

  afterEach(() => {
    ctl.verify();
    localStorage.clear();
  });

  it('vacía los planes del usuario anterior y recarga los del nuevo', async () => {
    // arranque sin sesión: una sola carga inicial
    ctl.expectOne(r => r.url === `${BASE}/plans`).flush([plan('a1')]);
    await Promise.resolve();
    expect(svc.plans().map(p => p.id)).toEqual(['a1']);

    // login de otro usuario: se vacían los planes viejos y se piden los nuevos
    currentUser.set({ id: 'usr-2', name: 'B', email: 'b@test.com' });
    appRef.tick();
    await Promise.resolve();
    expect(svc.plans().length).toBe(0);

    ctl.expectOne(r => r.url === `${BASE}/plans`).flush([plan('b1')]);
    appRef.tick();
    await Promise.resolve();
    expect(svc.plans().map(p => p.id)).toEqual(['b1']);
  });
});
