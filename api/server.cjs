/**
 * API simulada con autenticación: Express + json-server.
 *  - /auth/*   registro, login y usuario actual (JWT)
 *  - /users    lista de usuarios (solo admin)
 *  - /plans    CRUD de json-server, protegido: requiere token y aplica la regla de dueño
 *  - /plans/:id/files  archivos adjuntos de un plan (subir, listar, descargar, borrar)
 *  - WebSocket (mismo puerto, ws://…/?token=<JWT>)  eventos plan:* en tiempo real
 * Todo lo demás (por ejemplo /db) queda cerrado.
 */
const express = require('express');
const cors = require('cors');
const jsonServer = require('json-server');
const config = require('./config.cjs');
const { authRouter, usersRouter } = require('./auth.cjs');
const { requireAuth, plansAccess } = require('./middleware.cjs');
const { filesRouter, deletePlanFiles } = require('./files.cjs');
const { createRealtime } = require('./realtime.cjs');

const router = jsonServer.router(config.dbFile);
const db = router.db;
db.defaults({ plans: [], users: [], files: [] }).write();

const realtime = createRealtime();

// json-server responde con router.render; aquí se avisa por WebSocket después de cada escritura exitosa.
const defaultRender = router.render;
router.render = (req, res) => {
  const isPlanItem = /^\/plans\/[^/]+\/?$/.test(req.path);
  if (res.statusCode < 400 && (isPlanItem || (req.method === 'POST' && req.path === '/plans'))) {
    const actorId = req.user?.id;
    const events = { POST: 'plan:created', PUT: 'plan:updated', PATCH: 'plan:updated' };
    if (events[req.method]) {
      const plan = res.locals.data;
      realtime.publish(events[req.method], plan, { ownerId: plan.ownerId, actorId });
    } else if (req.method === 'DELETE' && req.deletedPlan) {
      const { id, ownerId } = req.deletedPlan;
      realtime.publish('plan:deleted', { id: String(id) }, { ownerId, actorId });
      deletePlanFiles(db, id).catch(error => console.error(error));
    }
  }
  defaultRender(req, res);
};

const app = express();
app.use(cors({ origin: config.corsOrigins, exposedHeaders: ['X-Total-Count', 'Link'] }));
app.use(express.json());
if (config.delayMs) app.use((_req, _res, next) => setTimeout(next, config.delayMs));

app.use('/auth', authRouter(db));
app.use('/users', usersRouter(db));
// Los adjuntos se montan antes que json-server: /plans/:id/files/* no es un recurso de json-server.
app.use('/plans', requireAuth, filesRouter(db, (event, attachment, plan, actorId) =>
  realtime.publish(event, attachment, { ownerId: plan.ownerId, actorId }),
));
app.use('/plans', requireAuth, plansAccess(db), (req, _res, next) => {
  // json-server vacía la respuesta del DELETE; se guarda el plan antes para poder avisar quién lo era.
  if (req.method === 'DELETE') {
    const id = decodeURIComponent(req.path.slice(1).replace(/\/$/, ''));
    req.deletedPlan = db.get('plans').find(p => String(p.id) === id).cloneDeep().value();
  }
  next();
});

// Solo /plans llega a json-server; así no quedan expuestos /db ni la escritura sobre /users.
app.use((req, res, next) => (req.path.startsWith('/plans') ? next() : res.status(404).json({})));
app.use(router);

// Manejo de errores en JSON (cuerpo mal formado → 400; cualquier otro fallo → 500).
app.use((error, _req, res, _next) => {
  if (error.type === 'entity.parse.failed') {
    return res.status(400).json({ message: 'El cuerpo de la petición no es un JSON válido.' });
  }
  console.error(error);
  res.status(500).json({ message: 'Error interno del servidor.' });
});

if (db.get('users').size().value() === 0) {
  console.warn('Aviso: no hay usuarios. Ejecuta "npm run api:reset" para cargar los de prueba.');
}

const server = app.listen(config.port, () => {
  console.log(`API lista en http://localhost:${config.port} (JWT expira en ${config.jwtExpiresIn})`);
  console.log(`WebSocket en ws://localhost:${config.port}/?token=<JWT>`);
});
realtime.attach(server);
