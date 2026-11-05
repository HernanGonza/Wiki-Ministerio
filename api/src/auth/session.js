import crypto from 'node:crypto';
import { config } from '../config.js';
import { query } from '../db.js';

export const COOKIE_NAME = 'wiki_sid';
const IDLE_MS = config.sessionIdleHours * 3600 * 1000;

/** El id de sesión en la base es HMAC-SHA256(token) con SESSION_SECRET. */
export const hashToken = (token) =>
  crypto.createHmac('sha256', config.sessionSecret).update(token).digest('hex');

export function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.cookieSecure,
    path: '/',
    maxAge: IDLE_MS,
  };
}

export async function createSession(userId, ip, userAgent) {
  const token = crypto.randomBytes(32).toString('base64url');
  await query(
    `INSERT INTO sessions (id, user_id, expires_at, ip, user_agent)
     VALUES ($1, $2, now() + $3 * interval '1 millisecond', $4, $5)`,
    [hashToken(token), userId, IDLE_MS, ip ?? null, (userAgent ?? '').slice(0, 300) || null],
  );
  return token;
}

/** Devuelve el usuario de la sesión vigente (renovándola) o null. */
export async function resolveSession(token) {
  if (!token || typeof token !== 'string' || token.length > 200) return null;
  const id = hashToken(token);
  const { rows } = await query(
    `UPDATE sessions s
        SET last_seen_at = now(), expires_at = now() + $2 * interval '1 millisecond'
       FROM users u
      WHERE s.id = $1 AND s.expires_at > now() AND u.id = s.user_id AND u.activo
      RETURNING s.id AS session_id, u.id, u.email, u.nombre, u.es_admin_global, u.must_change_password`,
    [id, IDLE_MS],
  );
  return rows[0] ?? null;
}

export async function deleteSession(token) {
  if (!token) return;
  await query('DELETE FROM sessions WHERE id = $1', [hashToken(token)]);
}
