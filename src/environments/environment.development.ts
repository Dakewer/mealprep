/**
 * Entorno de DESARROLLO (ng serve). Apunta a la API simulada: `npm run api`.
 */
export const environment = {
  production: false,
  apiBaseUrl: 'http://localhost:3000',
  /** Canal WebSocket (mismo servidor que la API). Equivale a WS_URL de .env.example. */
  wsUrl: 'ws://localhost:3000',
};
