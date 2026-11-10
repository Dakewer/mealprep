/**
 * Rutas de autenticación y de usuarios.
 *  POST /auth/register   crea la cuenta (rol "user") y devuelve { token, user }
 *  POST /auth/login      valida credenciales y devuelve { token, user }
 *  GET  /auth/me         usuario del token
 *  GET  /users           lista de usuarios (solo admin)
 *
 * Las contraseñas se guardan con bcrypt (bcryptjs: mismo algoritmo, sin compilar código nativo).
 * El token es un JWT HS256 con { sub: id del usuario, role, exp }.
 */
const crypto = require('node:crypto');
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { jwtSecret, jwtExpiresIn } = require('./config.cjs');
const { requireAuth, requireRole } = require('./middleware.cjs');

const BCRYPT_ROUNDS = 10;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Se compara contra este hash cuando el correo no existe, para que login tarde lo mismo.
const DUMMY_HASH = bcrypt.hashSync('no-existe', BCRYPT_ROUNDS);

/** Usuario sin el hash de la contraseña: es lo único que sale de la API. */
const publicUser = ({ passwordHash, ...user }) => user;

const signToken = user =>
  jwt.sign({ sub: user.id, role: user.role }, jwtSecret, { algorithm: 'HS256', expiresIn: jwtExpiresIn });

const initials = name =>
  name.trim().split(/\s+/).slice(0, 2).map(w => w.charAt(0).toUpperCase()).join('');

/** Envuelve un handler async para que sus errores lleguen al manejador de errores de Express. */
const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

function validateRegister({ name, email, password }) {
  const errors = {};
  if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 60) {
    errors.name = ['El nombre debe tener entre 2 y 60 caracteres.'];
  }
  if (typeof email !== 'string' || !EMAIL_RE.test(email.trim())) {
    errors.email = ['Escribe un correo válido.'];
  }
  if (typeof password !== 'string' || password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    errors.password = ['La contraseña debe tener al menos 8 caracteres, con letras y números.'];
  }
  return errors;
}

function authRouter(db) {
  const router = express.Router();
  const users = () => db.get('users');

  router.post('/register', wrap(async (req, res) => {
    const body = req.body ?? {};
    const errors = validateRegister(body);
    if (Object.keys(errors).length) {
      return res.status(400).json({ message: 'Revisa los datos del formulario.', errors });
    }

    const email = body.email.trim().toLowerCase();
    if (users().find({ email }).value()) {
      return res.status(409).json({ message: 'Ya existe una cuenta con ese correo.' });
    }

    const name = body.name.trim();
    const user = {
      id: `usr-${crypto.randomUUID()}`,
      name,
      email,
      passwordHash: await bcrypt.hash(body.password, BCRYPT_ROUNDS),
      role: 'user', // el rol nunca viene del cliente
      avatarInitials: initials(name),
      createdAt: new Date().toISOString(),
    };
    users().push(user).write();

    res.status(201).json({ token: signToken(user), user: publicUser(user) });
  }));

  router.post('/login', wrap(async (req, res) => {
    const { email, password } = req.body ?? {};
    if (typeof email !== 'string' || typeof password !== 'string' || !email || !password) {
      return res.status(400).json({
        message: 'Escribe tu correo y tu contraseña.',
        errors: {
          ...(!email && { email: ['Es obligatorio.'] }),
          ...(!password && { password: ['Es obligatoria.'] }),
        },
      });
    }

    const user = users().find({ email: email.trim().toLowerCase() }).value();
    const ok = await bcrypt.compare(password, user ? user.passwordHash : DUMMY_HASH);
    if (!user || !ok) {
      return res.status(401).json({ message: 'Correo o contraseña incorrectos.' });
    }

    res.json({ token: signToken(user), user: publicUser(user) });
  }));

  router.get('/me', requireAuth, (req, res) => {
    const user = users().find({ id: req.user.id }).value();
    if (!user) return res.status(401).json({ message: 'La cuenta ya no existe.' });
    res.json(publicUser(user));
  });

  return router;
}

function usersRouter(db) {
  const router = express.Router();
  router.get('/', requireAuth, requireRole('admin'), (_req, res) => {
    const list = db.get('users').value().map(publicUser);
    res.set('X-Total-Count', String(list.length)).json(list);
  });
  return router;
}

module.exports = { authRouter, usersRouter };
