/**
 * Middlewares de autorización.
 *  - requireAuth: exige un JWT válido (401 si falta, es inválido o expiró).
 *  - requireRole: exige uno de los roles indicados (403). Va después de requireAuth.
 *  - plansAccess: regla de dueño para /plans (ownerId).
 */
const jwt = require('jsonwebtoken');
const { jwtSecret } = require('./config.cjs');

function requireAuth(req, res, next) {
  const [scheme, token] = (req.headers.authorization || '').split(' ');
  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ message: 'Falta el token de autenticación.' });
  }
  try {
    const payload = jwt.verify(token, jwtSecret, { algorithms: ['HS256'] });
    req.user = { id: payload.sub, role: payload.role };
    next();
  } catch (error) {
    const message = error.name === 'TokenExpiredError' ? 'El token expiró.' : 'El token no es válido.';
    res.status(401).json({ message });
  }
}

const requireRole = (...roles) => (req, res, next) =>
  roles.includes(req.user?.role)
    ? next()
    : res.status(403).json({ message: 'No tienes permiso para realizar esta acción.' });

/**
 * Regla de dueño sobre /plans (se monta con app.use('/plans', requireAuth, plansAccess(db))).
 *  - Listar: un usuario solo ve sus planes; el admin ve todos.
 *  - Crear: el servidor fija ownerId = usuario del token (el cliente no lo decide).
 *  - Leer / editar / borrar un plan ajeno: 403, salvo admin. ownerId nunca se puede cambiar.
 *  - Los planes sin dueño (datos viejos) solo los ve el admin.
 */
function plansAccess(db) {
  return (req, res, next) => {
    const isAdmin = req.user.role === 'admin';
    const item = req.path.match(/^\/([^/]+)\/?$/);

    if (!item) {
      if (req.path !== '/') return res.status(404).json({});
      if (req.method === 'GET') {
        if (!isAdmin) req.query.ownerId = req.user.id;
        return next();
      }
      if (req.method === 'POST') {
        req.body = { ...req.body, ownerId: req.user.id };
        return next();
      }
      return res.status(405).json({ message: 'Método no permitido.' });
    }

    const id = decodeURIComponent(item[1]);
    const plan = db.get('plans').find(p => String(p.id) === id).value();
    if (!plan) return next(); // json-server responde 404

    if (!isAdmin && plan.ownerId !== req.user.id) {
      return res.status(403).json({ message: 'Este plan pertenece a otro usuario.' });
    }
    if (req.method === 'PUT') req.body = { ...req.body, ownerId: plan.ownerId };
    if (req.method === 'PATCH') {
      const { ownerId, ...rest } = req.body ?? {};
      req.body = rest;
    }
    next();
  };
}

module.exports = { requireAuth, requireRole, plansAccess };
