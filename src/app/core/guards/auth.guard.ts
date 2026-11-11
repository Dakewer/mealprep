import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService, SESSION_EXPIRED_MESSAGE } from '../services/auth.service';
import { NotificationService } from '../services/notification.service';

/**
 * Protege rutas privadas (dashboard, planes, perfil, etc.).
 * Revisa que el token exista y no haya vencido; si no, manda al login
 * con `returnUrl` para volver a la ruta pedida después de entrar.
 */
export const authGuard: CanActivateFn = (_route, state) => {
  const auth          = inject(AuthService);
  const router        = inject(Router);
  const notifications = inject(NotificationService);

  const session =
    typeof auth.checkSession === 'function'
      ? auth.checkSession()
      : auth.isAuthenticated()
        ? 'valid'
        : 'missing';

  if (session === 'valid') {
    return true;
  }

  if (session === 'expired') {
    notifications.warning(SESSION_EXPIRED_MESSAGE, 'Sesión expirada');
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

  const session =
    typeof auth.checkSession === 'function'
      ? auth.checkSession()
      : auth.isAuthenticated()
        ? 'valid'
        : 'missing';

  if (session !== 'valid') {
    return true;
  }

  return router.createUrlTree(['/dashboard']);
};

/**
 * Alias de retrocompatibilidad para publicGuard (ahora guestGuard).
 */
export const publicGuard = guestGuard;
