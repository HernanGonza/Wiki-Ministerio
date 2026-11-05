import { ZodError } from 'zod';

export class AppError extends Error {
  constructor(status, code, message, extra) {
    super(message);
    this.status = status;
    this.code = code;
    this.extra = extra;
  }
}
export const notFound = (msg = 'No encontrado') => new AppError(404, 'not_found', msg);
export const forbidden = (msg = 'Sin permiso') => new AppError(403, 'forbidden', msg);
export const badRequest = (msg, extra) => new AppError(400, 'bad_request', msg, extra);
export const conflict = (msg, extra) => new AppError(409, 'conflict', msg, extra);

/** Envuelve un handler async para que los errores lleguen al middleware de errores. */
export const h = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/** Valida con zod; los errores se traducen a 400. */
export const parse = (schema, data) => schema.parse(data);

export function errorMiddleware(err, req, res, _next) {
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: 'validation',
      message: 'Datos inválidos',
      details: err.issues.map((i) => ({ campo: i.path.join('.'), mensaje: i.message })),
    });
  }
  if (err instanceof AppError) {
    return res.status(err.status).json({ error: err.code, message: err.message, ...(err.extra ?? {}) });
  }
  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'bad_request', message: 'JSON inválido' });
  }
  if (err?.type === 'entity.too.large') {
    return res.status(413).json({ error: 'too_large', message: 'Contenido demasiado grande' });
  }
  // Violaciones de unicidad / FK de Postgres → mensajes legibles, sin filtrar detalles internos.
  if (err?.code === '23505') {
    return res.status(409).json({ error: 'conflict', message: 'Ya existe un registro con esos datos' });
  }
  if (err?.code === '23503') {
    return res.status(409).json({ error: 'conflict', message: 'El registro está referenciado por otros datos' });
  }
  if (err?.code === '23514' || err?.code === 'P0001') {
    return res.status(400).json({ error: 'bad_request', message: 'Los datos no cumplen las restricciones' });
  }
  // Solo el mensaje: nunca el request, headers ni cookies.
  console.error(`[error] ${req.method} ${req.path}:`, err?.message ?? err);
  return res.status(500).json({ error: 'internal', message: 'Error interno' });
}
