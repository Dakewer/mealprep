import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { API_BASE_URL } from '../config/api-base-url.token';
import { AuthService } from '../services/auth.service';

/**
 * Agrega `Authorization: Bearer <token>` a las peticiones hacia nuestra API.
 * Las que van a otros dominios no lo llevan, para no filtrar el token.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = inject(AuthService).token();
  const baseUrl = inject(API_BASE_URL);

  if (!token || !req.url.startsWith(baseUrl) || req.headers.has('Authorization')) {
    return next(req);
  }
  return next(req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }));
};
