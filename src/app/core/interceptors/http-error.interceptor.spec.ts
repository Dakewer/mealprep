import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { API_BASE_URL } from '../config/api-base-url.token';
import { ApiError } from '../errors/api-error';
import { AuthService, TOKEN_KEY } from '../services/auth.service';
import { NotificationService } from '../services/notification.service';
import { expInSeconds, fakeJwt } from '../testing/fake-jwt';
import { httpErrorInterceptor, silentErrors } from './http-error.interceptor';

describe('httpErrorInterceptor', () => {
  let http: HttpClient;
  let controller: HttpTestingController;
  let notifications: NotificationService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([httpErrorInterceptor])),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: 'http://api.test' },
      ],
    });
    http = TestBed.inject(HttpClient);
    controller = TestBed.inject(HttpTestingController);
    notifications = TestBed.inject(NotificationService);
  });

  afterEach(() => {
    notifications.dismissAll();
    controller.verify();
  });

  it('convierte el fallo en ApiError y muestra un aviso', () => {
    let received: unknown;
    http.get('/plans').subscribe({ error: e => (received = e) });
    controller.expectOne('/plans').flush('x', { status: 500, statusText: 'Server Error' });

    expect(received).toBeInstanceOf(ApiError);
    expect((received as ApiError).status).toBe(500);
    expect(notifications.notifications().length).toBe(1);
    expect(notifications.notifications()[0].type).toBe('error');
  });

  it('con silentErrors() no muestra aviso, pero sí lanza el ApiError', () => {
    let received: unknown;
    http.get('/plans', { context: silentErrors() }).subscribe({ error: e => (received = e) });
    controller.expectOne('/plans').flush('x', { status: 404, statusText: 'Not Found' });

    expect((received as ApiError).isNotFound).toBe(true);
    expect(notifications.notifications().length).toBe(0);
  });

  it('no interviene cuando la petición sale bien', () => {
    let body: unknown;
    http.get('/plans').subscribe(b => (body = b));
    controller.expectOne('/plans').flush([{ id: '1' }]);

    expect(body).toEqual([{ id: '1' }]);
    expect(notifications.notifications().length).toBe(0);
  });

  describe('sesión y permisos', () => {
    let navigate: ReturnType<typeof vi.spyOn>;

    /** Deja una sesión iniciada (token guardado) antes de que nazca AuthService. */
    function withSession(currentUrl = '/dashboard/planes/3'): AuthService {
      localStorage.setItem(TOKEN_KEY, fakeJwt({ exp: expInSeconds(3600) }));
      const router = TestBed.inject(Router);
      vi.spyOn(router, 'url', 'get').mockReturnValue(currentUrl);
      navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
      return TestBed.inject(AuthService);
    }

    afterEach(() => localStorage.clear());

    it('401 con sesión: cierra la sesión, avisa y manda al login con returnUrl', () => {
      const auth = withSession();
      expect(auth.isAuthenticated()).toBe(true);

      let received: unknown;
      http.get('/plans').subscribe({ error: e => (received = e) });
      controller.expectOne('/plans').flush({}, { status: 401, statusText: 'Unauthorized' });

      expect((received as ApiError).status).toBe(401);
      expect(auth.isAuthenticated()).toBe(false);
      expect(auth.logoutReason()).toBe('expired');
      expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
      expect(navigate).toHaveBeenCalledWith(['/auth/login'], {
        queryParams: { returnUrl: '/dashboard/planes/3' },
      });
      const [notice] = notifications.notifications();
      expect(notice.type).toBe('warning');
      expect(notice.message).toContain('Tu sesión expiró');
    });

    it('varios 401 a la vez: un solo aviso y una sola redirección', () => {
      withSession();

      http.get('/plans').subscribe({ error: () => undefined });
      http.get('/plans/1').subscribe({ error: () => undefined });
      controller.expectOne('/plans').flush({}, { status: 401, statusText: 'Unauthorized' });
      controller.expectOne('/plans/1').flush({}, { status: 401, statusText: 'Unauthorized' });

      expect(navigate).toHaveBeenCalledTimes(1);
      expect(notifications.notifications().filter(n => n.type === 'warning').length).toBe(1);
    });

    it('401 estando ya en /auth: cierra la sesión pero no vuelve a redirigir', () => {
      const auth = withSession('/auth/login');

      http.get('/auth/me').subscribe({ error: () => undefined });
      controller.expectOne('/auth/me').flush({}, { status: 401, statusText: 'Unauthorized' });

      expect(auth.isAuthenticated()).toBe(false);
      expect(navigate).not.toHaveBeenCalled();
    });

    it('401 sin sesión no redirige ni dice que la sesión expiró', () => {
      const router = TestBed.inject(Router);
      navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);

      http.get('/plans').subscribe({ error: () => undefined });
      controller.expectOne('/plans').flush({}, { status: 401, statusText: 'Unauthorized' });

      expect(navigate).not.toHaveBeenCalled();
      expect(notifications.notifications()[0].type).toBe('error');
    });

    it('401 de login o registro no muestra el aviso global (lo pinta el formulario)', () => {
      http.post('http://api.test/auth/login', {}).subscribe({ error: () => undefined });
      controller.expectOne('http://api.test/auth/login')
        .flush({ message: 'Correo o contraseña incorrectos.' }, { status: 401, statusText: 'Unauthorized' });

      expect(notifications.notifications().length).toBe(0);
    });

    it('403 muestra "Acceso denegado" y no cierra la sesión', () => {
      const auth = withSession();

      let received: unknown;
      http.delete('/plans/9').subscribe({ error: e => (received = e) });
      controller.expectOne('/plans/9').flush({}, { status: 403, statusText: 'Forbidden' });

      expect((received as ApiError).status).toBe(403);
      expect(auth.isAuthenticated()).toBe(true);
      expect(navigate).not.toHaveBeenCalled();
      const [notice] = notifications.notifications();
      expect(notice.type).toBe('error');
      expect(notice.title).toBe('Acceso denegado');
      expect(notice.message).toContain('No tienes permiso');
    });
  });
});
