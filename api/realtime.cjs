/**
 * Canal WebSocket (librería `ws`) que comparte el puerto de la API.
 *
 *  - El cliente conecta a  ws://localhost:3000/?token=<JWT>. Los navegadores no pueden poner el
 *    encabezado Authorization en un WebSocket, por eso el token viaja en la URL de conexión.
 *  - Sin token, con token inválido/expirado o desde un origen no permitido, el servidor rechaza
 *    el "upgrade" con 401/403 y nunca llega a abrirse el canal.
 *  - Cada mensaje del servidor es JSON:  { "event": "plan:updated", "data": {...}, "actorId": "usr-…", "at": "ISO" }
 *  - Regla de dueño: un evento sobre un plan solo lo reciben su dueño y los admin.
 *  - El canal es de solo lectura: lo que el cliente envíe se ignora (las escrituras van por HTTP).
 *  - Al vencer el JWT el servidor cierra el socket con el código 4401 (el cliente no reintenta).
 *
 * Eventos: plan:created, plan:updated, plan:deleted, plan:file-added, plan:file-removed.
 */
const { WebSocketServer } = require('ws');
const { verifyToken } = require('./middleware.cjs');
const config = require('./config.cjs');

const CLOSE_TOKEN_EXPIRED = 4401;
const HEARTBEAT_MS = 30_000;
const MAX_TIMER_MS = 2 ** 31 - 1; // setTimeout no admite más que esto

function reject(socket, status, text) {
  socket.write(`HTTP/1.1 ${status} ${text}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`);
  socket.destroy();
}

function createRealtime() {
  const wss = new WebSocketServer({ noServer: true });
  let heartbeat = null;

  /** Une el canal WebSocket al servidor HTTP de Express (mismo puerto). */
  function attach(server) {
    server.on('upgrade', (req, socket, head) => {
      const url = new URL(req.url, 'http://localhost');
      if (url.pathname !== '/' && url.pathname !== '/ws') return reject(socket, 404, 'Not Found');

      // CORS no aplica a WebSocket: se revisa el origen a mano (sin Origin = herramienta no-navegador).
      const origin = req.headers.origin;
      if (origin && !config.corsOrigins.includes(origin)) return reject(socket, 403, 'Forbidden');

      let user;
      try {
        user = verifyToken(url.searchParams.get('token') || '');
      } catch {
        return reject(socket, 401, 'Unauthorized');
      }

      wss.handleUpgrade(req, socket, head, ws => {
        ws.user = user;
        ws.isAlive = true;
        ws.on('pong', () => { ws.isAlive = true; });
        ws.on('error', () => ws.terminate());
        ws.on('message', () => { /* canal de solo lectura */ });

        // El JWT no se renueva: cuando vence, el canal también.
        const msLeft = user.exp * 1000 - Date.now();
        const timer = setTimeout(() => ws.close(CLOSE_TOKEN_EXPIRED, 'token expired'), Math.min(Math.max(msLeft, 0), MAX_TIMER_MS));
        ws.on('close', () => clearTimeout(timer));

        wss.emit('connection', ws, req);
      });
    });

    // Ping periódico: elimina conexiones muertas (cable desconectado, laptop dormida…).
    heartbeat = setInterval(() => {
      for (const ws of wss.clients) {
        if (!ws.isAlive) { ws.terminate(); continue; }
        ws.isAlive = false;
        ws.ping();
      }
    }, HEARTBEAT_MS);
    heartbeat.unref();
  }

  /**
   * Envía un evento a quien puede ver el plan: su dueño y los admin.
   * @param {string} event   nombre del evento (plan:created, …)
   * @param {object} data    carga útil
   * @param {{ ownerId?: string, actorId?: string }} scope  dueño del plan y quién provocó el cambio
   */
  function publish(event, data, { ownerId, actorId } = {}) {
    const message = JSON.stringify({ event, data, actorId: actorId ?? null, at: new Date().toISOString() });
    for (const ws of wss.clients) {
      if (ws.readyState !== ws.OPEN) continue;
      if (ws.user.role === 'admin' || (ownerId && ws.user.id === ownerId)) ws.send(message);
    }
  }

  function close() {
    clearInterval(heartbeat);
    for (const ws of wss.clients) ws.terminate();
    wss.close();
  }

  return { attach, publish, close, wss };
}

module.exports = { createRealtime, CLOSE_TOKEN_EXPIRED };
