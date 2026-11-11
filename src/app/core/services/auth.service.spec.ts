import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { API_BASE_URL } from '../config/api-base-url.token';
import { httpErrorInterceptor } from '../interceptors/http-error.interceptor';
import { AuthService } from './auth.service';
import { NotificationService } from './notification.service';

const BASE = 'http://api.test';

describe('AuthService (C4)', () => {
  let service: AuthService;
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([httpErrorInterceptor])),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: BASE },
      ],
    });
    service = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  it('envía los datos de login a POST /users y actualiza el estado del usuario', async () => {
    const loginPromise = service.login({
      email: 'luis@iteso.mx',
      password: 'password123',
      rememberMe: true,
    });

    const req = http.expectOne(`${BASE}/users`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body.email).toBe('luis@iteso.mx');
    expect(req.request.body.action).toBe('login');
    req.flush({ id: 42, email: 'luis@iteso.mx' });

    const ok = await loginPromise;
    expect(ok).toBe(true);
    expect(service.isAuthenticated()).toBe(true);
    expect(service.currentUser()?.id).toBe('42');
    expect(service.currentUser()?.email).toBe('luis@iteso.mx');
  });

  it('envía los datos de registro a POST /users', async () => {
    const registerPromise = service.register({
      name: 'Luis Cacho',
      email: 'luis@iteso.mx',
      password: 'Password1',
      confirmPassword: 'Password1',
      objective: 'deficit',
      acceptTerms: true,
    });

    const req = http.expectOne(`${BASE}/users`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body.name).toBe('Luis Cacho');
    expect(req.request.body.objective).toBe('deficit');
    expect(req.request.body.action).toBe('register');
    req.flush({ id: 7, name: 'Luis Cacho', email: 'luis@iteso.mx' });

    const ok = await registerPromise;
    expect(ok).toBe(true);
    expect(service.isAuthenticated()).toBe(true);
    expect(service.currentUser()?.name).toBe('Luis Cacho');
    expect(service.currentUser()?.avatarInitials).toBe('LC');
  });

  it('maneja errores de la API en login dejando el estado en error', async () => {
    const loginPromise = service.login({
      email: 'luis@iteso.mx',
      password: 'password123',
    });

    http.expectOne(`${BASE}/users`).flush({}, { status: 500, statusText: 'Server Error' });

    const ok = await loginPromise;
    expect(ok).toBe(false);
    expect(service.status()).toBe('error');
    expect(service.isAuthenticated()).toBe(false);
    expect(TestBed.inject(NotificationService).notifications().length).toBe(1);
  });
});
