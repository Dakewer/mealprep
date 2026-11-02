import { InjectionToken } from '@angular/core';

/**
 * URL base de la API (sin "/" final). Se provee en `app.config.ts`
 * leyendo `environment.apiBaseUrl`; en pruebas se puede sobreescribir.
 */
export const API_BASE_URL = new InjectionToken<string>('API_BASE_URL');
