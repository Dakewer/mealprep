import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { API_BASE_URL } from '../../../core/config/api-base-url.token';
import { AuthService } from '../../../core/services/auth.service';
import { expInSeconds, fakeJwt } from '../../../core/testing/fake-jwt';
import { LoginComponent } from './login.component';

const BASE = 'http://api.test';

describe('LoginComponent', () => {
  let fixture: ComponentFixture<LoginComponent>;
  let component: LoginComponent;
  let http: HttpTestingController;
  let auth: AuthService;

  function setup(queryParams: Record<string, string> = {}): void {
    TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: BASE },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              queryParamMap: convertToParamMap(queryParams),
            },
          },
        },
      ],
    });

    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    auth = TestBed.inject(AuthService);
    fixture.detectChanges();
  }

  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    http.verify();
    localStorage.clear();
  });

  it('deshabilita el botón mientras carga y muestra "Ingresando…"', async () => {
    setup();
    component.email.setValue('carlos@deficcitto.com');
    component.password.setValue('Carlos1234');

    const submitPromise = component.onSubmit();
    fixture.detectChanges();

    const submitBtn = fixture.nativeElement.querySelector('button[type="submit"]') as HTMLButtonElement;
    expect(component.isLoading()).toBe(true);
    expect(submitBtn.disabled).toBe(true);
    expect(submitBtn.textContent).toContain('Ingresando…');

    const req = http.expectOne(`${BASE}/auth/login`);
    req.flush({
      token: fakeJwt({ exp: expInSeconds(3600) }),
      user: { id: 'usr-002', name: 'Carlos', email: 'carlos@deficcitto.com', role: 'user' },
    });

    await submitPromise;
    fixture.detectChanges();
    expect(component.isLoading()).toBe(false);
    expect(submitBtn.disabled).toBe(false);
  });

  it('muestra el mensaje "Correo o contraseña incorrectos." con credenciales inválidas (401)', async () => {
    setup();
    component.email.setValue('carlos@deficcitto.com');
    component.password.setValue('incorrecta');

    const submitPromise = component.onSubmit();
    http
      .expectOne(`${BASE}/auth/login`)
      .flush({ message: 'No autorizado' }, { status: 401, statusText: 'Unauthorized' });

    await submitPromise;
    fixture.detectChanges();

    const alertText = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(alertText).toContain('Correo o contraseña incorrectos.');
  });

  it('muestra el aviso cuando la sesión expiró (logoutReason === expired)', () => {
    setup();
    auth.logout('expired');
    fixture.detectChanges();

    const banner = fixture.nativeElement.querySelector('.auth-form__expired-banner') as HTMLElement | null;
    expect(banner).not.toBeNull();
    expect(banner?.textContent).toContain('Tu sesión expiró. Inicia sesión de nuevo.');
  });

  it('conserva returnUrl en el enlace de registro y navega a returnUrl tras iniciar sesión', async () => {
    setup({ returnUrl: '/dashboard/planes/plan-001' });
    const router = TestBed.inject(Router);
    const navSpy = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

    expect(component.registerQueryParams()).toEqual({ returnUrl: '/dashboard/planes/plan-001' });

    component.email.setValue('admin@deficcitto.com');
    component.password.setValue('Admin1234');
    const submitPromise = component.onSubmit();

    http.expectOne(`${BASE}/auth/login`).flush({
      token: fakeJwt({ exp: expInSeconds(3600), role: 'admin' }),
      user: { id: 'usr-001', name: 'Admin', email: 'admin@deficcitto.com', role: 'admin' },
    });

    await submitPromise;
    expect(navSpy).toHaveBeenCalledWith('/dashboard/planes/plan-001');
  });
});
