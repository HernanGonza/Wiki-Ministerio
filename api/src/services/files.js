// Archivos subidos: validación por CONTENIDO (magic bytes), almacenamiento y metadatos.
// Nunca se confía en el Content-Type ni en la extensión que declara el cliente para decidir
// qué se sirve: el mime lo fija este módulo según lo que el archivo realmente es.
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config.js';
import { query } from '../db.js';
import { badRequest } from '../http.js';
import { validarArchivo } from './file-types.js';

export { MAX_IMAGE, MAX_FILE, TIPOS, EXTENSIONES, limpiarNombre, validarArchivo } from './file-types.js';

const abs = (key) => path.join(config.filesDir, key);

export async function guardarArchivo({ spaceId, nombre, buf, acceso, userId }) {
  const { ext, mime } = validarArchivo(nombre, buf);
  const id = crypto.randomUUID();
  const key = `${id.slice(0, 2)}/${id}.${ext}`;
  await fs.mkdir(path.dirname(abs(key)), { recursive: true });
  await fs.writeFile(abs(key), buf, { flag: 'wx', mode: 0o640 });
  try {
    const { rows } = await query(
      `INSERT INTO files (id, space_id, nombre, mime, bytes, sha256, storage_key, acceso, uploaded_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id, nombre, mime, bytes, acceso, created_at`,
      [id, spaceId, nombre, mime, buf.length, crypto.createHash('sha256').update(buf).digest('hex'), key, acceso, userId],
    );
    return rows[0];
  } catch (err) {
    await fs.rm(abs(key), { force: true });
    throw err;
  }
}

export const rutaArchivo = abs;

/** Metadatos de los archivos referenciados (para que el cliente muestre nombre y tamaño). */
export async function metaArchivos(ids) {
  if (!ids.length) return {};
  const { rows } = await query('SELECT id, nombre, mime, bytes FROM files WHERE id = ANY($1::uuid[])', [ids]);
  return Object.fromEntries(rows.map((r) => [r.id, { nombre: r.nombre, mime: r.mime, bytes: r.bytes }]));
}

/** Los bloques solo pueden referenciar archivos de este mismo espacio. */
export async function assertArchivosDelEspacio(ids, spaceId) {
  if (!ids.length) return;
  const { rows } = await query('SELECT id FROM files WHERE id = ANY($1::uuid[]) AND space_id = $2', [ids, spaceId]);
  if (rows.length !== ids.length) throw badRequest('Algún archivo referenciado no existe en este espacio');
}
