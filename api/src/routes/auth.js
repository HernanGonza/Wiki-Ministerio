import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import argon2 from 'argon2';
import { z } from 'zod';
import { config } from '../config.js';
import { query } from '../db.js';
import { h, parse, badRequest, AppError } from '../http.js';
import { audit } from '../services/audit.js';
import {
  COOKIE_NAME, cookieOptions, createSession, deleteSession, hashToken,
} from '../auth/session.js';

// Hash de relleno para igualar tiempos cuando el email no existe.
const DUMMY_HASH = await argon2.hash('relleno-no-es-una-clave', { type: argon2.argon2id });

const loginSchema = z.object({
  email: z.string().trim().min(1).max(254),
  password: z.string().min(1).max(1024),
});

const passwordSchema = z.string().min(config.passwordMinLength, `Mínimo ${config.passwordMinLength} caracteres`).max(1024);

/** 5 intentos fallidos por IP cada 15 minutos. Los logins correctos no cuentan. */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: async (req, res) => {
    await audit(req, 'login_bloqueado', 'sesion');
    res.status(429).json({ error: 'too_many_requests', message: 'Demasiados intentos. Probar de nuevo más tarde.' });
  },
});

const changePasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req) => `u:${req.user?.id ?? 'anon'}`,
  handler: (_req, res) =>
    res.status(429).json({ error: 'too_many_requests', message: 'Demasiados intentos. Probar de nuevo más tarde.' }),
});

export async function buildMe(user) {
  let spaces;
  if (user.es_admin_global) {
    const r = await query(
      `SELECT slug, nombre, 'admin_global' AS rol FROM spaces WHERE activo AND slug <> 'ministerio' ORDER BY orden, nombre`,
    );
    spaces = r.rows;
  } else {
    const r = await query(
      `SELECT s.slug, s.nombre, r.rol
         FROM user_space_roles r JOIN spaces s ON s.id = r.space_id
        WHERE r.user_id = $1 AND s.activo ORDER BY s.orden, s.nombre`,
      [user.id],
    );
    spaces = r.rows;
  }
  return {
    id: user.id,
    email: user.email,
    nombre: user.nombre,
    es_admin_global: user.es_admin_global,
    must_change_password: user.must_change_password,
    spaces,
  };
}

/** Rutas sin sesión. */
export const publicAuth = Router();

publicAuth.post('/login', loginLimiter, h(async (req, res) => {
  if (!req.is('application/json')) throw new AppError(415, 'unsupported_media_type', 'Se requiere Content-Type: application/json');
  const generic = new AppError(401, 'invalid_credentials', 'Credenciales incorrectas');
  let body;
  try {
    body = parse(loginSchema, req.body);
  } catch {
    throw generic;
  }
  const { rows } = await query(
    `SELECT id, email, nombre, password_hash, activo, must_change_password, es_admin_global
       FROM users WHERE lower(email) = lower($1)`,
    [body.email],
  );
  const user = rows[0];
  const ok = await argon2.verify(user?.password_hash ?? DUMMY_HASH, body.password).catch(() => false);
  if (!user || !user.activo || !ok) {
    req.auditUserId = user?.id ?? null;
    await audit(req, 'login_fallido', 'sesion');
    throw generic;
  }
  const token = await createSession(user.id, req.ip, req.get('user-agent'));
  await query('UPDATE users SET last_login_at = now() WHERE id = $1', [user.id]);
  req.user = user;
  await audit(req, 'login_ok', 'sesion');
  res.cookie(COOKIE_NAME, token, cookieOptions());
  res.json(await buildMe(user));
}));

/** Rutas con sesión (se montan detrás de requireAuth). */
export const privateAuth = Router();

privateAuth.get('/me', h(async (req, res) => {
  res.json(await buildMe(req.user));
}));

privateAuth.post('/logout', h(async (req, res) => {
  await audit(req, 'logout', 'sesion');
  await deleteSession(req.sessionToken);
  res.clearCookie(COOKIE_NAME, { ...cookieOptions(), maxAge: undefined });
  res.status(204).end();
}));

const changeSchema = z.object({
  actual: z.string().min(1).max(1024),
  nueva: passwordSchema,
});

privateAuth.post('/change-password', changePasswordLimiter, h(async (req, res) => {
  const body = parse(changeSchema, req.body);
  const { rows } = await query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
  if (!(await argon2.verify(rows[0].password_hash, body.actual).catch(() => false))) {
    throw new AppError(400, 'invalid_current_password', 'La contraseña actual es incorrecta');
  }
  if (body.actual === body.nueva) throw badRequest('La nueva contraseña debe ser distinta de la actual');
  const hash = await argon2.hash(body.nueva, { type: argon2.argon2id });
  await query('UPDATE users SET password_hash = $1, must_change_password = false WHERE id = $2', [hash, req.user.id]);
  // Cierra las demás sesiones del usuario.
  await query('DELETE FROM sessions WHERE user_id = $1 AND id <> $2', [req.user.id, hashToken(req.sessionToken)]);
  await audit(req, 'cambiar_password', 'usuario', req.user.id);
  res.status(204).end();
}));
