/**
 * Entorno de PRODUCCIÓN (ng build).
 * Cambia `apiBaseUrl` por la URL pública de tu API desplegada.
 */
export const environment = {
  production: true,
  apiBaseUrl: 'https://CAMBIAR-por-la-url-de-tu-api',
  /** Canal WebSocket (mismo servidor que la API). Equivale a WS_URL de .env.example. */
  wsUrl: 'wss://CAMBIAR-por-la-url-de-tu-api',
};
