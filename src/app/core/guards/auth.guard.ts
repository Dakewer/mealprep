import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * Protege rutas privadas (dashboard, planes, perfil, etc.).
 * Si no hay sesión, redirige a /auth/login?returnUrl=<ruta solicitada>.
 */
export const authGuard: CanActivateFn = (_route, state) => {
  const auth   = inject(AuthService);
  const router = inject(Router);

  if (auth.isAuthenticated()) {
    return true;
  }

  return router.createUrlTree(['/auth/login'], {
    queryParams: { returnUrl: state.url },
  });
};

/**
 * Protege rutas con restricción de roles (por ejemplo, /admin/usuarios).
 * Lee `route.data.roles` y, si el rol del usuario no tiene permiso,
 * redirige a la vista 403 (Acceso denegado).
 */
export const roleGuard: CanActivateFn = (route, state) => {
  const auth   = inject(AuthService);
  const router = inject(Router);

  if (!auth.isAuthenticated()) {
    return router.createUrlTree(['/auth/login'], {
      queryParams: { returnUrl: state?.url ?? '/dashboard' },
    });
  }

  const allowedRoles = (route.data?.['roles'] as string[] | undefined) ?? [];
  const userRole     = auth.currentUser()?.role ?? 'user';

  if (allowedRoles.length === 0 || allowedRoles.includes(userRole)) {
    return true;
  }

  return router.createUrlTree(['/403']);
};

/**
 * Protege rutas públicas de autenticación (login, registro).
 * Un usuario con sesión activa no puede abrir login ni registro
 * y es redirigido a /dashboard. Reemplaza al anterior publicGuard.
 */
export const guestGuard: CanActivateFn = () => {
  const auth   = inject(AuthService);
  const router = inject(Router);

  if (!auth.isAuthenticated()) {
    return true;
  }

  return router.createUrlTree(['/dashboard']);
};

/**
 * Alias de retrocompatibilidad para publicGuard (ahora guestGuard).
 */
export const publicGuard = guestGuard;
