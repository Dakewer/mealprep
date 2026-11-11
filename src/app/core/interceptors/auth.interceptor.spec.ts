import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { API_BASE_URL } from '../config/api-base-url.token';
import { TOKEN_KEY } from '../services/auth.service';
import { expInSeconds, fakeJwt } from '../testing/fake-jwt';
import { authInterceptor } from './auth.interceptor';

const BASE = 'http://api.test';

describe('authInterceptor', () => {
  let http: HttpClient;
  let controller: HttpTestingController;

  /** Arma el TestBed; si se pasa `token`, ya hay una sesión guardada cuando nace AuthService. */
  function setup(token?: string): void {
    localStorage.clear();
    if (token) localStorage.setItem(TOKEN_KEY, token);

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: BASE },
      ],
    });
    http = TestBed.inject(HttpClient);
    controller = TestBed.inject(HttpTestingController);
  }

  afterEach(() => {
    controller.verify();
    localStorage.clear();
  });

  it('agrega Authorization: Bearer con el token de la sesión', () => {
    const token = fakeJwt({ exp: expInSeconds(3600) });
    setup(token);

    http.get(`${BASE}/plans`).subscribe();

    const req = controller.expectOne(`${BASE}/plans`);
    expect(req.request.headers.get('Authorization')).toBe(`Bearer ${token}`);
    req.flush([]);
  });

  it('no agrega el encabezado si no hay sesión', () => {
    setup();

    http.post(`${BASE}/auth/login`, {}).subscribe();

    const req = controller.expectOne(`${BASE}/auth/login`);
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush({});
  });

  it('no envía el token a otros dominios', () => {
    setup(fakeJwt({ exp: expInSeconds(3600) }));

    http.get('https://otro-sitio.test/datos').subscribe();

    const req = controller.expectOne('https://otro-sitio.test/datos');
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush({});
  });

  it('respeta un Authorization que ya traía la petición', () => {
    setup(fakeJwt({ exp: expInSeconds(3600) }));

    http.get(`${BASE}/plans`, { headers: { Authorization: 'Bearer otro' } }).subscribe();

    const req = controller.expectOne(`${BASE}/plans`);
    expect(req.request.headers.get('Authorization')).toBe('Bearer otro');
    req.flush([]);
  });
});
