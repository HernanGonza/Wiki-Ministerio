// Subida y descarga de archivos.
//  - POST /api/admin/spaces/:slug/files  (admin del espacio) cuerpo = binario crudo
//  - GET  /api/files/:id                 (sesión; respeta el acceso restringido)
import express, { Router } from 'express';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { query } from '../db.js';
import { h, notFound, badRequest, parse } from '../http.js';
import { requireSpaceRole, resolveSpace, hasRole } from '../auth/access.js';
import { audit } from '../services/audit.js';
import { guardarArchivo, limpiarNombre, rutaArchivo, MAX_FILE, TIPOS } from '../services/files.js';
import { uuid } from '../schemas.js';

export const filesAdmin = Router({ mergeParams: true });
filesAdmin.post(
  '/',
  requireSpaceRole('admin_espacio'),
  express.raw({ type: () => true, limit: MAX_FILE }),
  h(async (req, res) => {
    if (!Buffer.isBuffer(req.body) || !req.body.length) throw badRequest('No se recibió ningún archivo');
    let nombre;
    try { nombre = limpiarNombre(decodeURIComponent(req.get('x-file-name') ?? '')); } catch { throw badRequest('Nombre de archivo inválido'); }
    const acceso = req.get('x-file-access') === 'restringido' ? 'restringido' : 'general';
    const f = await guardarArchivo({ spaceId: req.space.id, nombre, buf: req.body, acceso, userId: req.user.id });
    await audit(req, 'subir_archivo', 'archivo', f.id, req.space.id);
    res.status(201).json(f);
  }),
);

export const filesPublic = Router();
filesPublic.get('/:id', h(async (req, res) => {
  const id = parse(uuid, req.params.id);
  const { rows } = await query(
    `SELECT f.id, f.nombre, f.mime, f.bytes, f.sha256, f.storage_key, f.acceso, s.slug
       FROM files f JOIN spaces s ON s.id = f.space_id WHERE f.id = $1`,
    [id],
  );
  const f = rows[0];
  if (!f) throw notFound();
  const { rol } = await resolveSpace(req.user, f.slug); // sin rol en el espacio → 404
  if (f.acceso === 'restringido' && !hasRole(rol, 'admin_espacio')) throw notFound();

  const etag = `"${createHash('sha1').update(f.sha256).digest('hex')}"`;
  if (req.get('if-none-match') === etag) return res.status(304).end();

  const ext = f.storage_key.split('.').pop();
  const imagen = Boolean(TIPOS[ext]?.imagen);
  res.set({
    'Content-Type': f.mime,
    'Content-Length': String(f.bytes),
    ETag: etag,
    // Privado: depende de la sesión. Nunca cacheable por proxies compartidos.
    'Cache-Control': 'private, max-age=3600',
    'X-Content-Type-Options': 'nosniff',
    // Aunque el contenido ya se validó, se sirve aislado: sin scripts ni embebido.
    'Content-Security-Policy': "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
    'Content-Disposition': `${imagen ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(f.nombre)}`,
  });
  fs.createReadStream(rutaArchivo(f.storage_key))
    .on('error', () => { if (!res.headersSent) res.status(404).json({ error: 'not_found', message: 'Archivo no encontrado' }); else res.destroy(); })
    .pipe(res);
}));
