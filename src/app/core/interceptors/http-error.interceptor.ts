import { HttpContext, HttpContextToken, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { toApiError } from '../errors/api-error';
import { NotificationService } from '../services/notification.service';

/**
 * Cuando es `true`, el interceptor NO muestra el aviso (toast) de error.
 * Úsalo en vistas que ya pintan su propio estado de error (lista, detalle):
 *
 *   this.http.get(url, { context: silentErrors() })
 */
export const SILENT_ERRORS = new HttpContextToken<boolean>(() => false);

export const silentErrors = (): HttpContext => new HttpContext().set(SILENT_ERRORS, true);

/**
 * Manejo GLOBAL de errores HTTP:
 *  1. Convierte cualquier fallo en un `ApiError` tipado (con mensaje en español).
 *  2. Muestra un aviso al usuario, salvo que la petición use `silentErrors()`.
 *  3. Vuelve a lanzar el `ApiError` para que quien llamó pueda reaccionar
 *     (por ejemplo, un formulario que muestra `fieldErrors`).
 */
export const httpErrorInterceptor: HttpInterceptorFn = (req, next) => {
  const notifications = inject(NotificationService);

  return next(req).pipe(
    catchError((error: unknown) => {
      const apiError = toApiError(error);
      if (!req.context.get(SILENT_ERRORS)) {
        notifications.error(apiError.message, apiError.title);
      }
      return throwError(() => apiError);
    }),
  );
};
