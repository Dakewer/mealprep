import { ApplicationConfig, inject, provideAppInitializer, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter, withComponentInputBinding, withViewTransitions } from '@angular/router';
import { routes } from './app.routes';
import { environment } from '../environments/environment';
import { API_BASE_URL } from './core/config/api-base-url.token';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { httpErrorInterceptor } from './core/interceptors/http-error.interceptor';
import { AuthService } from './core/services/auth.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(
      routes,
      withComponentInputBinding(),
      withViewTransitions(),
    ),
    // Capa HTTP: primero se agrega el token; un solo interceptor maneja todos los errores de la API
    provideHttpClient(withInterceptors([authInterceptor, httpErrorInterceptor])),
    // La URL base sale del entorno (src/environments)
    { provide: API_BASE_URL, useValue: environment.apiBaseUrl },
    // Al arrancar, refresca al usuario de la sesión guardada (GET /auth/me) sin bloquear la app
    provideAppInitializer(() => {
      void inject(AuthService).restoreSession();
    }),
  ],
};
