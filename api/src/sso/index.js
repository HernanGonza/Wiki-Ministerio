import { AsyncLocalStorage } from 'node:async_hooks';
import argon2 from 'argon2';
import rateLimit from 'express-rate-limit';
import express from 'express';
import { config } from '../config.js';
import { query } from '../db.js';
import { notFound } from '../http.js';
import { audit } from '../services/audit.js';
import { COOKIE_NAME, cookieOptions, createSession } from '../auth/session.js';
import { crearVerificador, crearRutasSSO } from '../sso-kit/index.js';
import { crearAlmacenJtiPostgres } from './jti-store-pg.js';
import { crearBuscarUsuarioPorCorreo, hashClaveAleatoria } from './usuarios.js';

const SIN_CACHE = { 'Cache-Control': 'no-store, no-cache, must-revalidate, private', Pragma: 'no-cache' };

/** Limitador por IP (req.ip ya es la IP real: trust proxy = 1 detrás de wiki-web). Solo cuentan los fallos. */
const limitador = (limit) => rateLimit({
  windowMs: 15 * 60 * 1000,
  limit,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: (_req, res) => res.set(SIN_CACHE).status(429).end(),
});

/**
 * Router con /sso/acceso y /sso/login (raíz de la API, no /api; montar con app.use en la raíz). Con SSO_JWKS_URL vacío el SSO queda desactivado y
 * todo /sso responde 404.
 */
export function crearRouterSso({ sso = config.sso } = {}) {
  const router = express.Router();
  if (!sso.jwksUrl) {
    router.use('/sso', (_req, _res, next) => next(notFound()));
    return router;
  }

  // El kit entrega alFallar({ruta, motivo}) sin req: se recupera la petición para auditar con IP/UA.
  const enCurso = new AsyncLocalStorage();

  const verificar = crearVerificador({
    issuer: sso.issuer,
    audience: sso.audience,
    jwksUrl: sso.jwksUrl,
    jtiStore: crearAlmacenJtiPostgres(query),
    buscarUsuarioPorCorreo: crearBuscarUsuarioPorCorreo({ query, hashClave: hashClaveAleatoria(argon2) }),
  });

  async function abrirSesion(req, res, usuario) {
    const token = await createSession(usuario.id, req.ip, req.get('user-agent'), true);
    await query('UPDATE users SET last_login_at = now() WHERE id = $1', [usuario.id]);
    req.auditUserId = usuario.id;
    await audit(req, 'login_sso', 'sesion');
    res.cookie(COOKIE_NAME, token, cookieOptions());
  }

  // Nunca se loguean tokens, pases ni claims: solo ruta y motivo (el motivo no llega al cliente).
  function alFallar({ ruta, motivo }) {
    const req = enCurso.getStore();
    if (req) void audit(req, 'sso_rechazado', 'sesion', `${ruta}:${motivo}`);
  }

  // El router del kit define las rutas completas (/sso/acceso, /sso/login): se monta en la raíz.
  router.use('/sso', (req, _res, next) => enCurso.run(req, next));
  router.get('/sso/acceso', limitador(120));
  router.post('/sso/login', limitador(20));
  router.use(crearRutasSSO({
    verificar,
    abrirSesion,
    alFallar,
    inicioUrl: sso.inicioUrl,
    portalUrl: sso.portalUrl, // enlace "sin acceso" al portal, SIN ?volver
    origenPortal: new URL(sso.portalUrl).origin,
  }));
  return router;
}
