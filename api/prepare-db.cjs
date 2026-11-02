/**
 * Prepara la base local de la API simulada.
 *  - `npm run api`        → crea api/db.json desde api/db.seed.json si no existe.
 *  - `npm run api:reset`  → la vuelve a crear (borra los cambios hechos desde la app).
 * api/db.json está en .gitignore: json-server escribe ahí con cada alta/edición/baja.
 */
const fs = require('node:fs');
const path = require('node:path');

const seed = path.join(__dirname, 'db.seed.json');
const db = path.join(__dirname, 'db.json');
const reset = process.argv.includes('--reset');

if (reset || !fs.existsSync(db)) {
  fs.copyFileSync(seed, db);
  console.log(reset ? 'api/db.json restaurado desde db.seed.json' : 'api/db.json creado desde db.seed.json');
}
