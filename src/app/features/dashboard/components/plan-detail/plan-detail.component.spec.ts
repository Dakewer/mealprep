import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { API_BASE_URL } from '../../../../core/config/api-base-url.token';
import { ApiError } from '../../../../core/errors/api-error';
import { httpErrorInterceptor } from '../../../../core/interceptors/http-error.interceptor';
import { NutritionPlan, PlanAttachment } from '../../../../core/models/app.models';
import { expInSeconds, fakeJwt } from '../../../../core/testing/fake-jwt';
import { AuthService } from '../../../../core/services/auth.service';
import { PlanService } from '../../../../core/services/plan.service';
import { RealtimeService } from '../../../../core/services/realtime.service';
import { PlanDetailComponent } from './plan-detail.component';

const BASE = 'http://api.test';

const IMAGE_ATT: PlanAttachment = {
  id: 'file-img-1',
  planId: 'plan-1',
  name: 'bowl-avena.webp',
  mimeType: 'image/webp',
  size: 256000, // 250 KB
  url: '/uploads/bowl-avena.webp',
  createdAt: '2026-11-01T10:00:00.000Z',
};

const PDF_ATT: PlanAttachment = {
  id: 'file-pdf-1',
  planId: 'plan-1',
  name: 'guia-porciones.pdf',
  mimeType: 'application/pdf',
  size: 1572864, // 1.50 MB
  url: '/uploads/guia-porciones.pdf',
  createdAt: '2026-11-01T10:05:00.000Z',
};

function makePlan(id: string, over: Partial<NutritionPlan> = {}): NutritionPlan {
  return {
    id,
    name: 'Desayuno Fitness',
    description: 'Plan de prueba con archivos adjuntos',
    macroGoals: { calories: 450, protein: 35, carbs: 45, fat: 12 },
    items: [{ ingredientId: 'pollo', grams: 150 }],
    createdAt: '2026-11-01T08:00:00.000Z',
    isFavorite: false,
    tags: ['deficit'],
    ownerId: 'usr-1',
    ...over,
  };
}

describe('PlanDetailComponent · B2, B3 y B4 Galería de archivos y tiempo real', () => {
  let fixture: ComponentFixture<PlanDetailComponent>;
  let http: HttpTestingController;
  let realtime: RealtimeService;
  let auth: AuthService;

  async function initComponent(initialPlans: NutritionPlan[]): Promise<void> {
    TestBed.inject(PlanService);
    http.expectOne(r => r.url === `${BASE}/plans`).flush(initialPlans);
    await Promise.resolve();

    fixture = TestBed.createComponent(PlanDetailComponent);
    fixture.detectChanges();
  }

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [PlanDetailComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([httpErrorInterceptor])),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: BASE },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: convertToParamMap({ id: 'plan-1' }),
            },
          },
        },
      ],
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);
    realtime = TestBed.inject(RealtimeService);
    auth = TestBed.inject(AuthService);
  });

  afterEach(() => {
    http.verify();
  });

  it('B4: muestra el estado vacío "Este plan aún no tiene archivos adjuntos" cuando no hay archivos', async () => {
    await initComponent([makePlan('plan-1', { files: [] })]);

    const emptyBox: HTMLElement = fixture.nativeElement.querySelector('[data-testid="attachments-empty"]');
    expect(emptyBox).toBeTruthy();
    expect(emptyBox.textContent).toContain('Este plan aún no tiene archivos adjuntos');
  });

  it('B4: muestra los estados de carga y de error en la galería de archivos', async () => {
    await initComponent([makePlan('plan-1', { files: [] })]);

    fixture.componentInstance.isLoadingAttachments.set(true);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="attachments-loading"]')).toBeTruthy();

    fixture.componentInstance.isLoadingAttachments.set(false);
    fixture.componentInstance.attachmentsError.set(new ApiError(500, 'Fallo al leer adjuntos'));
    fixture.detectChanges();

    const errBox: HTMLElement = fixture.nativeElement.querySelector('[data-testid="attachments-error"]');
    expect(errBox).toBeTruthy();
    expect(errBox.textContent).toContain('Fallo al leer adjuntos');
  });

  it('B3: renderiza miniatura para imágenes y tarjeta con nombre, tipo (PDF) y tamaño en KB/MB para PDF', async () => {
    await initComponent([makePlan('plan-1', { files: [IMAGE_ATT, PDF_ATT] })]);

    const items = fixture.nativeElement.querySelectorAll('[data-testid="attachment-item"]');
    expect(items.length).toBe(2);

    // 1. Imagen con miniatura
    const imgThumb = items[0].querySelector('[data-testid="attachment-image-thumb"]') as HTMLImageElement;
    expect(imgThumb).toBeTruthy();
    expect(imgThumb.src).toContain('http://api.test/uploads/bowl-avena.webp');
    expect(items[0].textContent).toContain('bowl-avena.webp');
    expect(items[0].textContent).toContain('WEBP');
    expect(items[0].textContent).toContain('250 KB');

    // 2. PDF con tarjeta, nombre, tipo y tamaño en MB
    const pdfBadge = items[1].querySelector('[data-testid="attachment-pdf-badge"]');
    expect(pdfBadge).toBeTruthy();
    expect(items[1].textContent).toContain('guia-porciones.pdf');
    expect(items[1].textContent).toContain('PDF');
    expect(items[1].textContent).toContain('1.50 MB');
  });

  it('B3: el botón de descarga solicita el archivo mediante FilesApiService.download()', async () => {
    await initComponent([makePlan('plan-1', { files: [PDF_ATT] })]);

    const downloadPromise = fixture.componentInstance.openOrDownloadAttachment(PDF_ATT);
    const req = http.expectOne(`${BASE}/plans/plan-1/files/file-pdf-1`);
    expect(req.request.method).toBe('GET');
    expect(req.request.responseType).toBe('blob');
    req.flush(new Blob(['%PDF-1.4'], { type: 'application/pdf' }));

    await downloadPromise;
  });

  it('B3: muestra botón de eliminar archivo solo cuando *appCanManage lo permite y maneja confirmación y error 403', async () => {
    // Iniciar sesión como dueño del plan (usr-1)
    const loginPromise = auth.login({ email: 'usr1@test.com', password: 'Password123' });
    http.expectOne(`${BASE}/auth/login`).flush({
      token: fakeJwt({ exp: expInSeconds(3600), sub: 'usr-1', role: 'user' }),
      user: { id: 'usr-1', name: 'Dueño', email: 'usr1@test.com', role: 'user' },
    });
    await loginPromise;

    await initComponent([makePlan('plan-1', { ownerId: 'usr-1', files: [IMAGE_ATT] })]);

    const deleteBtns = fixture.nativeElement.querySelectorAll('[data-testid="delete-attachment-btn"]');
    expect(deleteBtns.length).toBe(1);

    // Simular eliminación que falla con 403 Forbidden
    fixture.componentInstance.requestDeleteAttachment(IMAGE_ATT);
    expect(fixture.componentInstance.attachmentPendingDeletion()?.id).toBe('file-img-1');

    const confirmPromise = fixture.componentInstance.onDeleteAttachmentConfirmed();
    http
      .expectOne(`${BASE}/plans/plan-1/files/file-img-1`)
      .flush({ message: 'No puedes borrar archivos de otro usuario.' }, { status: 403, statusText: 'Forbidden' });
    await confirmPromise;
    fixture.detectChanges();

    // El archivo permanece y se muestra el error 403 en la galería
    expect(fixture.componentInstance.attachments().length).toBe(1);
    const actionErr: HTMLElement = fixture.nativeElement.querySelector('[data-testid="gallery-action-error"]');
    expect(actionErr).toBeTruthy();
    expect(actionErr.textContent).toContain('No tienes permiso');

    // Ahora simular eliminación exitosa (200 OK)
    fixture.componentInstance.requestDeleteAttachment(IMAGE_ATT);
    const successPromise = fixture.componentInstance.onDeleteAttachmentConfirmed();
    http.expectOne(`${BASE}/plans/plan-1/files/file-img-1`).flush({});
    await successPromise;
    fixture.detectChanges();

    expect(fixture.componentInstance.attachments().length).toBe(0);
  });

  it('B2: actualiza los adjuntos y el detalle en tiempo real cuando llegan plan:file-added y plan:file-removed', async () => {
    await initComponent([makePlan('plan-1', { files: [] })]);
    expect(fixture.componentInstance.attachments().length).toBe(0);

    realtime.emit({ type: 'plan:file-added', planId: 'plan-1', file: IMAGE_ATT }, false);
    fixture.detectChanges();
    expect(fixture.componentInstance.attachments().length).toBe(1);
    expect(fixture.nativeElement.textContent).toContain('bowl-avena.webp');

    realtime.emit({ type: 'plan:file-removed', planId: 'plan-1', fileId: IMAGE_ATT.id }, false);
    fixture.detectChanges();
    expect(fixture.componentInstance.attachments().length).toBe(0);
  });

  it('B4: bloquea descargas o eliminaciones y muestra aviso claro cuando está sin conexión', async () => {
    await initComponent([makePlan('plan-1', { files: [IMAGE_ATT] })]);

    realtime.setConnectionStatus('disconnected');
    fixture.detectChanges();

    await fixture.componentInstance.openOrDownloadAttachment(IMAGE_ATT);
    fixture.detectChanges();

    const offlineAlert: HTMLElement = fixture.nativeElement.querySelector('[data-testid="gallery-offline-warning"]');
    expect(offlineAlert).toBeTruthy();
    expect(offlineAlert.textContent).toContain('No hay conexión');
  });
});
