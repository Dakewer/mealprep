import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter, withComponentInputBinding, withViewTransitions } from '@angular/router';
import { routes } from './app.routes';
import { environment } from '../environments/environment';
import { API_BASE_URL } from './core/config/api-base-url.token';
import { httpErrorInterceptor } from './core/interceptors/http-error.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(
      routes,
      withComponentInputBinding(),
      withViewTransitions(),
    ),
    // Capa HTTP: un solo interceptor para todos los errores de la API
    provideHttpClient(withInterceptors([httpErrorInterceptor])),
    // La URL base sale del entorno (src/environments)
    { provide: API_BASE_URL, useValue: environment.apiBaseUrl },
  ],
};
