import { COOKIE_NAME, cookieOptions, resolveSession } from './session.js';
import { AppError } from '../http.js';

export function parseCookies(header = '') {
  const out = {};
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    const k = part.slice(0, i).trim();
    if (!k) continue;
    try {
      out[k] = decodeURIComponent(part.slice(i + 1).trim());
    } catch {
      /* cookie malformada: se ignora */
    }
  }
  return out;
}

const ALLOWED_WHILE_MUST_CHANGE = new Set(['/api/auth/me', '/api/auth/logout', '/api/auth/change-password']);

/** Exige sesión válida. Con must_change_password solo permite cambiarla. */
export async function requireAuth(req, res, next) {
  try {
    const token = parseCookies(req.headers.cookie)[COOKIE_NAME];
    const user = await resolveSession(token);
    if (!user) {
      throw new AppError(401, 'unauthenticated', 'Sesión no válida');
    }
    req.user = user;
    req.sessionToken = token;
    res.cookie(COOKIE_NAME, token, cookieOptions()); // renueva la ventana de inactividad
    if (user.must_change_password && !ALLOWED_WHILE_MUST_CHANGE.has(req.baseUrl + req.path)) {
      throw new AppError(403, 'must_change_password', 'Debe cambiar la contraseña');
    }
    next();
  } catch (err) {
    next(err);
  }
}

export function requireGlobalAdmin(req, _res, next) {
  if (!req.user?.es_admin_global) return next(new AppError(403, 'forbidden', 'Sin permiso'));
  next();
}

/** CSRF: sameSite=lax + JSON obligatorio en métodos que modifican datos. */
export function requireJsonOnWrite(req, _res, next) {
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) && !req.is('application/json')) {
    return next(new AppError(415, 'unsupported_media_type', 'Se requiere Content-Type: application/json'));
  }
  next();
}
