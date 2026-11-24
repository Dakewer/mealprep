import { InjectionToken } from '@angular/core';

/**
 * URL del canal WebSocket (sin "?token"). Se provee en `app.config.ts`
 * leyendo `environment.wsUrl`; en pruebas se puede sobreescribir.
 */
export const WS_URL = new InjectionToken<string>('WS_URL');
