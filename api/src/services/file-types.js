// Tipos de archivo permitidos y validación por CONTENIDO (magic bytes). Módulo puro (sin I/O),
// para poder testearlo sin base de datos ni configuración.
import path from 'node:path';
import { badRequest } from '../http.js';

const MB = 1024 * 1024;
export const MAX_IMAGE = 10 * MB;
export const MAX_FILE = 25 * MB;

const startsWith = (buf, bytes, at = 0) => bytes.every((b, i) => buf[at + i] === b);
const ascii = (s) => [...s].map((c) => c.charCodeAt(0));
const zip = (buf) => startsWith(buf, [0x50, 0x4b, 0x03, 0x04]);
const textoPlano = (buf) => {
  if (buf.subarray(0, 8000).includes(0)) return false;
  try { new TextDecoder('utf-8', { fatal: true }).decode(buf); return true; } catch { return false; }
};

// SVG queda afuera a propósito: puede contener scripts.
export const TIPOS = {
  png: { mime: 'image/png', imagen: true, ok: (b) => startsWith(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]) },
  jpg: { mime: 'image/jpeg', imagen: true, ok: (b) => startsWith(b, [0xff, 0xd8, 0xff]) },
  jpeg: { mime: 'image/jpeg', imagen: true, ok: (b) => startsWith(b, [0xff, 0xd8, 0xff]) },
  gif: { mime: 'image/gif', imagen: true, ok: (b) => startsWith(b, ascii('GIF87a')) || startsWith(b, ascii('GIF89a')) },
  webp: { mime: 'image/webp', imagen: true, ok: (b) => startsWith(b, ascii('RIFF')) && startsWith(b, ascii('WEBP'), 8) },
  pdf: { mime: 'application/pdf', ok: (b) => b.subarray(0, 1024).includes('%PDF-') },
  docx: { mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', ok: zip },
  xlsx: { mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', ok: zip },
  pptx: { mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', ok: zip },
  odt: { mime: 'application/vnd.oasis.opendocument.text', ok: zip },
  ods: { mime: 'application/vnd.oasis.opendocument.spreadsheet', ok: zip },
  odp: { mime: 'application/vnd.oasis.opendocument.presentation', ok: zip },
  txt: { mime: 'text/plain; charset=utf-8', ok: textoPlano },
  csv: { mime: 'text/csv; charset=utf-8', ok: textoPlano },
};
export const EXTENSIONES = Object.keys(TIPOS);

/** Nombre mostrable: sin rutas, sin caracteres de control, acotado. */
export function limpiarNombre(raw) {
  const base = String(raw ?? '').split(/[\\/]/).pop() ?? '';
  // eslint-disable-next-line no-control-regex
  const n = base.replace(/[\u0000-\u001f\u007f"<>:|?*]/g, '').trim().slice(-150);
  return n || 'archivo';
}

/** Devuelve { ext, mime, imagen } si el contenido corresponde a un tipo permitido; si no, lanza 400. */
export function validarArchivo(nombre, buf) {
  const ext = path.extname(nombre).slice(1).toLowerCase();
  const tipo = TIPOS[ext];
  if (!tipo) throw badRequest(`Tipo de archivo no permitido. Se admiten: ${EXTENSIONES.join(', ')}.`);
  if (!buf.length) throw badRequest('El archivo está vacío');
  if (buf.length > (tipo.imagen ? MAX_IMAGE : MAX_FILE)) {
    throw badRequest(`El archivo supera el máximo de ${(tipo.imagen ? MAX_IMAGE : MAX_FILE) / MB} MB`);
  }
  if (!tipo.ok(buf)) throw badRequest('El contenido del archivo no coincide con su extensión');
  return { ext, mime: tipo.mime, imagen: Boolean(tipo.imagen) };
}
