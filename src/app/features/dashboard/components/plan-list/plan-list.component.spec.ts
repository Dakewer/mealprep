import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { API_BASE_URL } from '../../../../core/config/api-base-url.token';
import { httpErrorInterceptor } from '../../../../core/interceptors/http-error.interceptor';
import { NutritionPlan, PlanAttachment } from '../../../../core/models/app.models';
import { NotificationService } from '../../../../core/services/notification.service';
import { PlanService } from '../../../../core/services/plan.service';
import { RealtimeService } from '../../../../core/services/realtime.service';
import { PlanListComponent } from './plan-list.component';

const BASE = 'http://api.test';

function makePlan(id: string, over: Partial<NutritionPlan> = {}): NutritionPlan {
  return {
    id,
    name: `Plan ${id}`,
    macroGoals: { calories: 500, protein: 40, carbs: 50, fat: 15 },
    items: [{ ingredientId: 'pollo', grams: 200 }],
    createdAt: '2026-11-01T12:00:00.000Z',
    isFavorite: false,
    tags: ['deficit'],
    ...over,
  };
}

describe('PlanListComponent · B2, B3 y B4', () => {
  let fixture: ComponentFixture<PlanListComponent>;
  let http: HttpTestingController;
  let realtime: RealtimeService;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [PlanListComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([httpErrorInterceptor])),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: BASE },
      ],
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);
    realtime = TestBed.inject(RealtimeService);
    TestBed.inject(PlanService);

    const imageAtt: PlanAttachment = {
      id: 'img-1',
      planId: 'plan-1',
      name: 'portada.jpg',
      mimeType: 'image/jpeg',
      size: 120000,
      url: '/uploads/portada.jpg',
      createdAt: '2026-11-01T12:00:00.000Z',
    };
    const pdfAtt: PlanAttachment = {
      id: 'pdf-1',
      planId: 'plan-2',
      name: 'guia.pdf',
      mimeType: 'application/pdf',
      size: 350000,
      url: '/uploads/guia.pdf',
      createdAt: '2026-11-01T12:00:00.000Z',
    };

    http.expectOne(r => r.url === `${BASE}/plans`).flush([
      makePlan('plan-1', { name: 'Plan con Imagen', files: [imageAtt] }),
      makePlan('plan-2', { name: 'Plan solo PDF', files: [pdfAtt] }),
    ]);

    fixture = TestBed.createComponent(PlanListComponent);
    await Promise.resolve();
    fixture.detectChanges();
  });

  afterEach(() => {
    http.verify();
  });

  it('B3: muestra miniatura de portada en la tarjeta solo cuando el plan tiene una imagen adjunta', () => {
    const thumbs = fixture.nativeElement.querySelectorAll('[data-testid="plan-cover-thumbnail"]');
    expect(thumbs.length).toBe(1);
    expect((thumbs[0] as HTMLImageElement).src).toContain('http://api.test/uploads/portada.jpg');
  });

  it('B2: actualiza la lista sin recargar cuando llega un evento plan:created o plan:deleted en tiempo real', () => {
    realtime.emit(
      {
        type: 'plan:created',
        payload: makePlan('plan-3', { name: 'Cena Proteica RT' }),
      },
      false,
    );
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Cena Proteica RT');

    realtime.emit({ type: 'plan:deleted', payload: { id: 'plan-1' } }, false);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).not.toContain('Plan con Imagen');
  });

  it('B2: limpia la suscripción con takeUntilDestroyed al destruir el componente para no duplicar notificaciones', () => {
    const notif = TestBed.inject(NotificationService);
    notif.dismissAll();

    fixture.destroy();

    realtime.emit(
      {
        type: 'plan:created',
        payload: makePlan('plan-99', { name: 'No debe notificar en componente destruido' }),
      },
      false,
    );

    expect(notif.notifications().length).toBe(0);
  });

  it('B4: muestra aviso claro si el usuario intenta marcar favorito o eliminar sin conexión', async () => {
    const notif = TestBed.inject(NotificationService);
    notif.dismissAll();
    realtime.setConnectionStatus('disconnected');
    fixture.detectChanges();

    const banner = fixture.nativeElement.querySelector('[data-testid="plan-list-offline-banner"]');
    expect(banner).toBeTruthy();

    await fixture.componentInstance.toggleFavorite('plan-1');
    expect(notif.notifications().some(n => n.type === 'warning')).toBe(true);
  });
});
