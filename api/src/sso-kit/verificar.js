import { compactVerify, createRemoteJWKSet, decodeProtectedHeader } from 'jose';
import { crearAlmacenJtiMemoria } from './jti-store.js';

const TOLERANCIA_S = 60;
const UN_USO = new Set(['login']);
// Vida máxima del pase: 60 s (contrato) más la tolerancia de reloj de 60 s.
const VIDA_MAX_S = 60 + TOLERANCIA_S;

const HOSTS_LOCALES = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);

/** Exige https:// para el JWKS (salvo localhost/127.0.0.1/::1 o permitirHttp explícito). */
export function validarJwksUrl(jwksUrl, permitirHttp = false) {
  let u;
  try { u = new URL(jwksUrl); } catch { throw new Error('sso-kit: jwksUrl inválida'); }
  if (u.protocol === 'https:') return u;
  if (u.protocol === 'http:' && (permitirHttp === true || HOSTS_LOCALES.has(u.hostname))) return u;
  throw new Error('sso-kit: jwksUrl debe ser https:// (http solo en localhost o con permitirHttp)');
}

/**
 * Crea la función verificar(token, { use }) con el orden fijo del contrato (sección 2).
 * Devuelve { ok:true, claims, usuario? } o { ok:false, motivo } con motivo en:
 * formato | alg | firma | iss | aud | exp | use | jti | usuario
 * Los motivos son para el código llamador/logs; nunca se envían al cliente HTTP.
 *
 * config:
 *  issuer, audience      (obligatorios; salen de variables de entorno)
 *  jwksUrl | jwks        URL del JWKS del portal, o resolvedor de claves de jose (pruebas)
 *  ahora                 () => epoch en segundos (reloj inyectable)
 *  jtiStore              almacén de jti (obligatorio salvo NODE_ENV=development o permitirMemoria:true)
 *  permitirMemoria       true: admite el almacén de jti en memoria (pruebas/desarrollo; por proceso, NO para producción)
 *  permitirHttp          true solo en desarrollo: acepta jwksUrl http:// fuera de localhost
 *  buscarUsuarioPorCorreo(email, { use, name }) -> {id, rol?, activo} | null  (paso 8). `use` ('acceso'|'login')
 *                        permite que el alta de usuarios ocurra solo con use='login'; la búsqueda es la misma.
 *                        `name` es el claim `name` del pase (string) o undefined si falta.
 *  cooldownJwks          ms mínimos entre refrescos por kid desconocido (def. 30000)
 */
export function crearVerificador(config) {
  const { issuer, audience, jwksUrl, jwks, buscarUsuarioPorCorreo } = config;
  if (!issuer || !audience) throw new Error('sso-kit: faltan issuer/audience');
  if (!jwks && !jwksUrl) throw new Error('sso-kit: falta jwksUrl');
  const ahora = config.ahora ?? (() => Math.floor(Date.now() / 1000));
  // Guarda invertida: sin jtiStore solo se permite con NODE_ENV=development o permitirMemoria:true explícito.
  if (!config.jtiStore && process.env.NODE_ENV !== 'development' && config.permitirMemoria !== true) {
    throw new Error('sso-kit: falta jtiStore compartido (el de memoria es por proceso); solo NODE_ENV=development o permitirMemoria:true lo admiten');
  }
  const jtiStore = config.jtiStore ?? crearAlmacenJtiMemoria();
  const resolver = jwks ?? createRemoteJWKSet(validarJwksUrl(jwksUrl, config.permitirHttp), {
    cacheMaxAge: 60 * 60 * 1000, // caché 1 h
    cooldownDuration: config.cooldownJwks ?? 30_000,
    timeoutDuration: config.timeoutJwks ?? 5000,
  });

  const fallo = (motivo) => ({ ok: false, motivo });

  return async function verificar(token, { use } = {}) {
    // 1. formato y alg
    if (typeof token !== 'string' || token.length > 8192 || token.split('.').length !== 3) return fallo('formato');
    let header;
    try { header = decodeProtectedHeader(token); } catch { return fallo('formato'); }
    if (header.alg !== 'RS256') return fallo('alg');

    // 2. firma contra JWKS (refresca una vez ante kid desconocido)
    let payload;
    try {
      const r = await compactVerify(token, resolver, { algorithms: ['RS256'] });
      payload = JSON.parse(new TextDecoder().decode(r.payload));
    } catch (e) {
      return fallo(e instanceof SyntaxError ? 'formato' : 'firma');
    }
    if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) return fallo('formato');

    // 3-6
    if (payload.iss !== issuer) return fallo('iss');
    if (payload.aud !== audience) return fallo('aud');
    const t = ahora();
    if (!Number.isFinite(payload.exp) || t > payload.exp + TOLERANCIA_S) return fallo('exp');
    if (!Number.isFinite(payload.iat) || payload.iat > t + TOLERANCIA_S) return fallo('exp');
    if (payload.exp - payload.iat > VIDA_MAX_S) return fallo('exp');
    if (!use || payload.use !== use) return fallo('use');
    if (typeof payload.email !== 'string' || !payload.email) return fallo('formato');

    // 7. jti (solo login)
    if (UN_USO.has(use)) {
      if (typeof payload.jti !== 'string' || !payload.jti) return fallo('jti');
      const primera = await jtiStore.marcarUsado(payload.jti, payload.exp, ahora());
      if (!primera) return fallo('jti');
    }

    // 8. usuario por correo en minúsculas (misma función en acceso y login)
    const claims = { ...payload, email: payload.email.trim().toLowerCase() };
    if (buscarUsuarioPorCorreo) {
      const usuario = await buscarUsuarioPorCorreo(claims.email, { use, name: typeof payload.name === 'string' ? payload.name : undefined });
      if (!usuario || usuario.activo !== true) return fallo('usuario');
      return { ok: true, claims, usuario };
    }
    return { ok: true, claims };
  };
}
