import crypto from 'node:crypto';
import { config } from '../config.js';
import { AppError } from '../http.js';

const MAX_VIDA_S = 300; // un token del portal debe durar como máximo 5 minutos
const TOLERANCIA_S = 30; // desfase de relojes entre servidores
const usados = new Map(); // jti → exp (s). Un token sirve una sola vez.

const b64 = (s) => Buffer.from(s, 'base64url');
const invalido = () => new AppError(401, 'invalid_sso_token', 'El acceso desde el portal no es válido o venció');

/**
 * Valida un JWT HS256 emitido por el portal y devuelve el email.
 * Fija el algoritmo (nunca el del header), y exige exp, iat, iss, aud y email.
 */
export function verificarJwtPortal(token) {
  if (!config.portalJwtSecret) throw new AppError(404, 'sso_disabled', 'Ingreso desde el portal no configurado');
  if (typeof token !== 'string' || token.length > 4096) throw invalido();
  const partes = token.split('.');
  if (partes.length !== 3) throw invalido();
  const [h, p, s] = partes;

  let header;
  let claims;
  try {
    header = JSON.parse(b64(h).toString('utf8'));
    claims = JSON.parse(b64(p).toString('utf8'));
  } catch {
    throw invalido();
  }
  if (header?.alg !== 'HS256') throw invalido();

  const esperado = crypto.createHmac('sha256', config.portalJwtSecret).update(`${h}.${p}`).digest();
  const recibido = b64(s);
  if (recibido.length !== esperado.length || !crypto.timingSafeEqual(recibido, esperado)) throw invalido();

  const ahora = Math.floor(Date.now() / 1000);
  const { exp, iat, iss, aud, email, jti } = claims ?? {};
  if (!Number.isInteger(exp) || !Number.isInteger(iat)) throw invalido();
  if (exp + TOLERANCIA_S < ahora || iat - TOLERANCIA_S > ahora) throw invalido();
  if (exp - iat > MAX_VIDA_S) throw invalido();
  if (iss !== config.portalJwtIssuer) throw invalido();
  const audiencias = Array.isArray(aud) ? aud : [aud];
  if (!audiencias.includes(config.portalJwtAudience)) throw invalido();
  if (typeof email !== 'string' || !email.includes('@') || email.length > 254) throw invalido();

  // Anti-reutilización (en memoria; basta con una sola instancia de la API).
  for (const [k, v] of usados) if (v + TOLERANCIA_S < ahora) usados.delete(k);
  if (typeof jti === 'string' && jti) {
    if (usados.has(jti)) throw invalido();
    usados.set(jti, exp);
  }
  return email.trim();
}
