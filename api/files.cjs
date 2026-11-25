/**
 * Archivos adjuntos de un plan (se montan en /plans/:id/files, detrás de requireAuth).
 *  GET    /plans/:id/files            lista los adjuntos del plan
 *  POST   /plans/:id/files            sube un archivo (multipart/form-data, campo "file")
 *  GET    /plans/:id/files/:fileId    descarga el archivo
 *  DELETE /plans/:id/files/:fileId    elimina el archivo
 *
 * Regla de dueño (igual que /plans): un `user` solo opera sobre sus planes, un `admin` sobre todos;
 * en otro caso 403. Si el plan no existe, 404.
 *
 * Los metadatos viven en la colección "files" de db.json (separada del plan, para que un PUT del
 * plan no borre sus adjuntos) y el contenido en api/uploads/ con un nombre aleatorio: el nombre
 * que envía el cliente nunca se usa como ruta en disco.
 */
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const express = require('express');
const multer = require('multer');
const config = require('./config.cjs');

fs.mkdirSync(config.uploadsDir, { recursive: true });

/** Firmas (primeros bytes) de los tipos permitidos: el Content-Type que declara el cliente no basta. */
const SIGNATURES = {
  'image/jpeg': buf => buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff,
  'image/png': buf => buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  'image/webp': buf => buf.subarray(0, 4).toString('latin1') === 'RIFF' && buf.subarray(8, 12).toString('latin1') === 'WEBP',
  'application/pdf': buf => buf.subarray(0, 5).toString('latin1') === '%PDF-',
};

const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const diskPath = stored => path.join(config.uploadsDir, path.basename(stored));
const removeFromDisk = stored => fs.promises.rm(diskPath(stored), { force: true });

function hasSignature(file) {
  const fd = fs.openSync(file.path, 'r');
  try {
    const buf = Buffer.alloc(12);
    fs.readSync(fd, buf, 0, 12, 0);
    return SIGNATURES[file.mimetype]?.(buf) ?? false;
  } finally {
    fs.closeSync(fd);
  }
}

/** Lo que sale de la API: sin el nombre interno en disco. */
const toAttachment = (f, req) => ({
  id: f.id,
  planId: f.planId,
  name: f.name,
  mimeType: f.mimeType,
  size: f.size,
  url: `${req.protocol}://${req.get('host')}/plans/${encodeURIComponent(f.planId)}/files/${encodeURIComponent(f.id)}`,
  createdAt: f.createdAt,
});

const upload = multer({
  storage: multer.diskStorage({
    destination: config.uploadsDir,
    filename: (_req, _file, cb) => cb(null, `${crypto.randomUUID()}.bin`),
  }),
  limits: { fileSize: config.maxFileBytes, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (config.allowedMimeTypes.includes(file.mimetype)) return cb(null, true);
    const error = new Error('Tipo de archivo no permitido. Usa JPG, PNG, WebP o PDF.');
    error.status = 415;
    cb(error);
  },
}).single('file');

/** Convierte los errores de multer en respuestas JSON con el mismo formato del resto de la API. */
function handleUpload(req, res, next) {
  upload(req, res, error => {
    if (!error) return next();
    if (error.code === 'LIMIT_FILE_SIZE') {
      const mb = config.maxFileBytes / 1024 / 1024;
      return res.status(413).json({ message: `El archivo supera el máximo de ${mb} MB.` });
    }
    if (error instanceof multer.MulterError) {
      return res.status(400).json({ message: 'Sube un solo archivo en el campo "file".' });
    }
    if (error.status === 415) return res.status(415).json({ message: error.message });
    next(error);
  });
}

/**
 * @param db  instancia lowdb de json-server
 * @param onChange  (event, attachment, plan, actorId) => void  para avisar por WebSocket
 */
function filesRouter(db, onChange = () => {}) {
  const router = express.Router();
  const files = () => db.get('files');

  /** Busca el plan y aplica la regla de dueño. Responde 404/403 y devuelve null si no procede. */
  function loadPlan(req, res) {
    const plan = db.get('plans').find(p => String(p.id) === req.params.id).value();
    if (!plan) {
      res.status(404).json({ message: 'No encontramos lo que buscabas.' });
      return null;
    }
    if (req.user.role !== 'admin' && plan.ownerId !== req.user.id) {
      res.status(403).json({ message: 'Este plan pertenece a otro usuario.' });
      return null;
    }
    return plan;
  }

  const findFile = (req, res, plan) => {
    const file = files().find({ id: req.params.fileId, planId: String(plan.id) }).value();
    if (!file) res.status(404).json({ message: 'No encontramos lo que buscabas.' });
    return file;
  };

  router.get('/:id/files', (req, res) => {
    const plan = loadPlan(req, res);
    if (!plan) return;
    const list = files().filter({ planId: String(plan.id) }).value().map(f => toAttachment(f, req));
    res.set('X-Total-Count', String(list.length)).json(list);
  });

  // Primero se valida el dueño y después se acepta el cuerpo: así un archivo ajeno ni se guarda.
  router.post('/:id/files', (req, res, next) => (loadPlan(req, res) ? next() : undefined), handleUpload, wrap(async (req, res) => {
    const plan = db.get('plans').find(p => String(p.id) === req.params.id).value();
    const file = req.file;
    if (!file) return res.status(400).json({ message: 'Falta el archivo.', errors: { file: ['Es obligatorio.'] } });

    if (!hasSignature(file)) {
      await removeFromDisk(file.filename);
      return res.status(415).json({ message: 'El contenido del archivo no coincide con su tipo.' });
    }
    if (files().filter({ planId: String(plan.id) }).size().value() >= config.maxFilesPerPlan) {
      await removeFromDisk(file.filename);
      return res.status(409).json({ message: `Un plan admite como máximo ${config.maxFilesPerPlan} archivos.` });
    }

    const record = {
      id: `file-${crypto.randomUUID()}`,
      planId: String(plan.id),
      name: Buffer.from(file.originalname, 'latin1').toString('utf8').slice(0, 120), // multer lo entrega en latin1
      mimeType: file.mimetype,
      size: file.size,
      storedName: file.filename,
      createdAt: new Date().toISOString(),
    };
    files().push(record).write();

    const attachment = toAttachment(record, req);
    onChange('plan:file-added', attachment, plan, req.user.id);
    res.status(201).json(attachment);
  }));

  router.get('/:id/files/:fileId', (req, res) => {
    const plan = loadPlan(req, res);
    if (!plan) return;
    const file = findFile(req, res, plan);
    if (!file) return;
    if (!fs.existsSync(diskPath(file.storedName))) {
      return res.status(404).json({ message: 'El archivo ya no está disponible.' });
    }
    res.set({
      'Content-Type': file.mimeType,
      'X-Content-Type-Options': 'nosniff',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`,
    });
    res.sendFile(diskPath(file.storedName));
  });

  router.delete('/:id/files/:fileId', wrap(async (req, res) => {
    const plan = loadPlan(req, res);
    if (!plan) return;
    const file = findFile(req, res, plan);
    if (!file) return;

    files().remove({ id: file.id }).write();
    await removeFromDisk(file.storedName);

    onChange('plan:file-removed', toAttachment(file, req), plan, req.user.id);
    res.json({});
  }));

  return router;
}

/** Borra del disco y de la base todos los adjuntos de un plan (se usa al eliminar el plan). */
async function deletePlanFiles(db, planId) {
  const owned = db.get('files').filter({ planId: String(planId) }).value();
  db.get('files').remove({ planId: String(planId) }).write();
  await Promise.all(owned.map(f => removeFromDisk(f.storedName)));
}

module.exports = { filesRouter, deletePlanFiles };
