/**
 * API simulada con autenticación: Express + json-server.
 *  - /auth/*   registro, login y usuario actual (JWT)
 *  - /users    lista de usuarios (solo admin)
 *  - /plans    CRUD de json-server, protegido: requiere token y aplica la regla de dueño
 * Todo lo demás (por ejemplo /db) queda cerrado.
 */
const express = require('express');
const cors = require('cors');
const jsonServer = require('json-server');
const config = require('./config.cjs');
const { authRouter, usersRouter } = require('./auth.cjs');
const { requireAuth, plansAccess } = require('./middleware.cjs');

const router = jsonServer.router(config.dbFile);
const db = router.db;
db.defaults({ plans: [], users: [] }).write();

const app = express();
app.use(cors({ origin: config.corsOrigins, exposedHeaders: ['X-Total-Count', 'Link'] }));
app.use(express.json());
if (config.delayMs) app.use((_req, _res, next) => setTimeout(next, config.delayMs));

app.use('/auth', authRouter(db));
app.use('/users', usersRouter(db));
app.use('/plans', requireAuth, plansAccess(db));

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

app.listen(config.port, () => {
  console.log(`API lista en http://localhost:${config.port} (JWT expira en ${config.jwtExpiresIn})`);
});
