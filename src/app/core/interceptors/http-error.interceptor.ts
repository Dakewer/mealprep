import { HttpContext, HttpContextToken, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { toApiError } from '../errors/api-error';
import { AuthService, SESSION_EXPIRED_MESSAGE } from '../services/auth.service';
import { NotificationService } from '../services/notification.service';

/**
 * Cuando es `true`, el interceptor NO muestra el aviso (toast) de error.
 * Úsalo en vistas que ya pintan su propio estado de error (lista, detalle):
 *
 *   this.http.get(url, { context: silentErrors() })
 */
export const SILENT_ERRORS = new HttpContextToken<boolean>(() => false);

export const silentErrors = (): HttpContext => new HttpContext().set(SILENT_ERRORS, true);

/** Login y registro muestran su propio mensaje (AuthService.error), así que el aviso global no aplica. */
const isCredentialsCall = (url: string): boolean =>
  url.endsWith('/auth/login') || url.endsWith('/auth/register');

/**
 * Manejo GLOBAL de errores HTTP:
 *  1. Convierte cualquier fallo en un `ApiError` tipado (con mensaje en español).
 *  2. 401 con sesión iniciada: el token venció o no sirve → cierra la sesión,
 *     avisa "Tu sesión expiró" y manda a /auth/login?returnUrl=<ruta actual>.
 *  3. 403: avisa que no hay permiso. Cualquier otro error muestra su aviso,
 *     salvo que la petición use `silentErrors()`.
 *  4. Vuelve a lanzar el `ApiError` para que quien llamó pueda reaccionar
 *     (por ejemplo, un formulario que muestra `fieldErrors`).
 */
export const httpErrorInterceptor: HttpInterceptorFn = (req, next) => {
  const notifications = inject(NotificationService);
  const auth = inject(AuthService);
  const router = inject(Router);

  return next(req).pipe(
    catchError((error: unknown) => {
      const apiError = toApiError(error);

      if (apiError.status === 401 && auth.isAuthenticated()) {
        // Si varias peticiones fallan a la vez, solo la primera encuentra la sesión abierta.
        const returnUrl = router.url;
        auth.logout('expired');
        notifications.warning(SESSION_EXPIRED_MESSAGE, 'Sesión expirada');
        if (!returnUrl.startsWith('/auth')) {
          void router.navigate(['/auth/login'], { queryParams: { returnUrl } });
        }
      } else if (!req.context.get(SILENT_ERRORS) && !isCredentialsCall(req.url)) {
        const title = apiError.status === 403 ? 'Acceso denegado' : apiError.title;
        notifications.error(apiError.message, title);
      }

      return throwError(() => apiError);
    }),
  );
};
