import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree, provideRouter } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { authGuard, guestGuard, roleGuard } from './auth.guard';
import { signal } from '@angular/core';
import { User } from '../models/app.models';

describe('Guards de Autenticación y Roles', () => {
  let router: Router;
  let mockAuthService: {
    isAuthenticated: ReturnType<typeof signal<boolean>>;
    currentUser: ReturnType<typeof signal<User | null>>;
  };

  const createMockRouteSnapshot = (data: Record<string, unknown> = {}): ActivatedRouteSnapshot => {
    return { data } as unknown as ActivatedRouteSnapshot;
  };

  const createMockStateSnapshot = (url = '/ruta-protegida'): RouterStateSnapshot => {
    return { url } as unknown as RouterStateSnapshot;
  };

  beforeEach(() => {
    mockAuthService = {
      isAuthenticated: signal<boolean>(false),
      currentUser: signal<User | null>(null),
    };

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: mockAuthService },
      ],
    });

    router = TestBed.inject(Router);
  });

  describe('authGuard', () => {
    it('permite el acceso si el usuario está autenticado', () => {
      mockAuthService.isAuthenticated.set(true);

      const route = createMockRouteSnapshot();
      const state = createMockStateSnapshot('/dashboard');

      const result = TestBed.runInInjectionContext(() => authGuard(route, state));
      expect(result).toBe(true);
    });

    it('redirige a /auth/login con returnUrl de la ruta solicitada si no hay sesión', () => {
      mockAuthService.isAuthenticated.set(false);

      const route = createMockRouteSnapshot();
      const state = createMockStateSnapshot('/dashboard/planes/plan-001');

      const result = TestBed.runInInjectionContext(() => authGuard(route, state));
      expect(result instanceof UrlTree).toBe(true);

      const urlTree = result as UrlTree;
      expect(router.serializeUrl(urlTree)).toBe('/auth/login?returnUrl=%2Fdashboard%2Fplanes%2Fplan-001');
    });
  });

  describe('roleGuard', () => {
    it('redirige a /auth/login si el usuario no tiene sesión', () => {
      mockAuthService.isAuthenticated.set(false);

      const route = createMockRouteSnapshot({ roles: ['admin'] });
      const state = createMockStateSnapshot('/admin/usuarios');

      const result = TestBed.runInInjectionContext(() => roleGuard(route, state));
      expect(result instanceof UrlTree).toBe(true);

      const urlTree = result as UrlTree;
      expect(router.serializeUrl(urlTree)).toBe('/auth/login?returnUrl=%2Fadmin%2Fusuarios');
    });

    it('permite el acceso si el rol del usuario está dentro de route.data.roles', () => {
      mockAuthService.isAuthenticated.set(true);
      mockAuthService.currentUser.set({
        id: 'user-admin',
        name: 'Admin',
        email: 'admin@deficcitto.com',
        role: 'admin',
      });

      const route = createMockRouteSnapshot({ roles: ['admin'] });
      const state = createMockStateSnapshot('/admin/usuarios');

      const result = TestBed.runInInjectionContext(() => roleGuard(route, state));
      expect(result).toBe(true);
    });

    it('redirige a /403 si el rol del usuario no tiene permiso', () => {
      mockAuthService.isAuthenticated.set(true);
      mockAuthService.currentUser.set({
        id: 'user-regular',
        name: 'Usuario Regular',
        email: 'user@deficcitto.com',
        role: 'user',
      });

      const route = createMockRouteSnapshot({ roles: ['admin'] });
      const state = createMockStateSnapshot('/admin/usuarios');

      const result = TestBed.runInInjectionContext(() => roleGuard(route, state));
      expect(result instanceof UrlTree).toBe(true);

      const urlTree = result as UrlTree;
      expect(router.serializeUrl(urlTree)).toBe('/403');
    });

    it('permite el acceso si no se configuraron roles específicos en data', () => {
      mockAuthService.isAuthenticated.set(true);
      mockAuthService.currentUser.set({
        id: 'user-regular',
        name: 'Usuario Regular',
        email: 'user@deficcitto.com',
        role: 'user',
      });

      const route = createMockRouteSnapshot({});
      const state = createMockStateSnapshot('/seccion-abierta');

      const result = TestBed.runInInjectionContext(() => roleGuard(route, state));
      expect(result).toBe(true);
    });
  });

  describe('guestGuard (reemplaza publicGuard)', () => {
    it('permite el acceso si el usuario NO está autenticado', () => {
      mockAuthService.isAuthenticated.set(false);

      const route = createMockRouteSnapshot();
      const state = createMockStateSnapshot('/auth/login');

      const result = TestBed.runInInjectionContext(() => guestGuard(route, state));
      expect(result).toBe(true);
    });

    it('redirige a /dashboard si el usuario ya tiene sesión iniciada', () => {
      mockAuthService.isAuthenticated.set(true);

      const route = createMockRouteSnapshot();
      const state = createMockStateSnapshot('/auth/login');

      const result = TestBed.runInInjectionContext(() => guestGuard(route, state));
      expect(result instanceof UrlTree).toBe(true);

      const urlTree = result as UrlTree;
      expect(router.serializeUrl(urlTree)).toBe('/dashboard');
    });
  });
});
