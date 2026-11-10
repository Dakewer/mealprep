const path = require('node:path');

require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true });

const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret || jwtSecret.length < 16) {
  console.error(
    'Falta JWT_SECRET (mínimo 16 caracteres). Copia .env.example a .env y define un secreto propio.',
  );
  process.exit(1);
}

// jsonwebtoken interpreta "3600" como milisegundos; un número puro lo tratamos como segundos.
const rawExpires = process.env.JWT_EXPIRES_IN || '1h';

module.exports = {
  jwtSecret,
  jwtExpiresIn: /^\d+$/.test(rawExpires) ? Number(rawExpires) : rawExpires,
  port: Number(process.env.PORT) || 3000,
  dbFile: path.join(__dirname, 'db.json'),
  // Opcionales (no están en .env.example): orígenes CORS y retraso artificial para ver los estados de carga.
  corsOrigins: (process.env.CORS_ORIGIN || 'http://localhost:4200').split(',').map(o => o.trim()),
  delayMs: Number(process.env.API_DELAY_MS) || 0,
};
