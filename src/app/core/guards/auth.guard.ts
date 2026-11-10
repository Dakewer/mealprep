import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService, SESSION_EXPIRED_MESSAGE } from '../services/auth.service';
import { NotificationService } from '../services/notification.service';

/**
 * Protege rutas privadas (dashboard, perfil, etc.)
 * Revisa que el token exista y no haya vencido; si no, manda al login
 * con `returnUrl` para volver a la ruta pedida después de entrar.
 */
export const authGuard: CanActivateFn = (_route, state) => {
  const auth          = inject(AuthService);
  const router        = inject(Router);
  const notifications = inject(NotificationService);

  const session = auth.checkSession();
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
 * Protege rutas públicas de auth (login, registro).
 * Redirige al dashboard si el usuario ya tiene una sesión válida.
 */
export const publicGuard: CanActivateFn = () => {
  const auth   = inject(AuthService);
  const router = inject(Router);

  if (auth.checkSession() !== 'valid') {
    return true;
  }

  return router.createUrlTree(['/dashboard']);
};
