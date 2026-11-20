import express from 'express';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function sinCache(res) {
  res.set({ 'Cache-Control': 'no-store, no-cache, must-revalidate, private', Pragma: 'no-cache', 'Referrer-Policy': 'no-referrer' });
}

/**
 * Router Express con GET /sso/acceso y POST /sso/login.
 *
 * opciones:
 *  verificar            función de crearVerificador (con buscarUsuarioPorCorreo ya inyectado)
 *  abrirSesion(req, res, usuario, claims)  abre la sesión propia del sistema (cookie, etc.)
 *  inicioUrl            adonde redirigir (302) tras abrir sesión (ej. '/')
 *  portalUrl            enlace de la página "sin acceso"
 *  origenPortal         origen del portal (def.: el de portalUrl). Defensa CSRF de POST /sso/login:
 *                       con Origin, debe ser igual (el literal 'null' se rechaza); sin Origin, se rechaza
 *                       Sec-Fetch-Site: cross-site; sin ninguno de los dos se acepta (clientes sin cabeceras).
 *  alFallar(info)       opcional, para logs: { ruta, motivo }. NUNCA recibe token ni claims.
 */
export function origenDePeticionPermitido(req, origenPortal) {
  const origin = req.get('origin');
  if (origin !== undefined) return origin === origenPortal;
  const sfs = req.get('sec-fetch-site');
  if (sfs !== undefined) return sfs.trim().toLowerCase() !== 'cross-site';
  return true;
}

export function crearRutasSSO({ verificar, abrirSesion, inicioUrl = '/', portalUrl, origenPortal, alFallar = () => {} }) {
  if (typeof verificar !== 'function' || typeof abrirSesion !== 'function' || !portalUrl) {
    throw new Error('sso-kit: faltan verificar, abrirSesion o portalUrl');
  }
  const origenEsperado = origenPortal ? new URL(origenPortal).origin : new URL(portalUrl).origin;
  const router = express.Router();

  router.get('/sso/acceso', async (req, res) => {
    sinCache(res);
    const m = /^Bearer ([^\s]+)$/i.exec(req.get('authorization') ?? '');
    if (!m) { alFallar({ ruta: 'acceso', motivo: 'formato' }); return res.status(401).end(); }
    let r;
    try { r = await verificar(m[1], { use: 'acceso' }); }
    catch { alFallar({ ruta: 'acceso', motivo: 'error' }); return res.status(401).end(); }
    if (r.ok) {
      const cuerpo = { acceso: true };
      if (r.usuario?.rol) cuerpo.rol = r.usuario.rol;
      return res.status(200).json(cuerpo);
    }
    if (r.motivo === 'usuario') return res.status(200).json({ acceso: false }); // pase válido, sin usuario/inactivo
    alFallar({ ruta: 'acceso', motivo: r.motivo });
    return res.status(401).end();
  });

  const formulario = express.urlencoded({ extended: false, limit: '16kb' });
  router.post('/sso/login', formulario, async (req, res) => {
    sinCache(res);
    if (!origenDePeticionPermitido(req, origenEsperado)) {
      alFallar({ ruta: 'login', motivo: 'origen' });
      return res.status(403).type('html').send(paginaSinAcceso(portalUrl));
    }
    const token = typeof req.body?.token === 'string' ? req.body.token : '';
    let r;
    try { r = await verificar(token, { use: 'login' }); }
    catch { r = { ok: false, motivo: 'error' }; }
    if (!r.ok) {
      alFallar({ ruta: 'login', motivo: r.motivo });
      return res.status(403).type('html').send(paginaSinAcceso(portalUrl));
    }
    try {
      await abrirSesion(req, res, r.usuario, r.claims);
    } catch {
      alFallar({ ruta: 'login', motivo: 'sesion' });
      return res.status(403).type('html').send(paginaSinAcceso(portalUrl));
    }
    return res.redirect(302, inicioUrl);
  });

  // Cualquier error del router (cuerpo >16 KB, form mal formado, etc.): página "sin acceso",
  // sin stack ni rutas. Con 4 parámetros para que Express lo trate como manejador de errores.
  // eslint-disable-next-line no-unused-vars
  router.use((err, req, res, next) => {
    sinCache(res);
    alFallar({ ruta: req.path === '/sso/acceso' ? 'acceso' : 'login', motivo: 'error' });
    if (res.headersSent) return res.end();
    if (req.path === '/sso/acceso') return res.status(401).end();
    return res.status(403).type('html').send(paginaSinAcceso(portalUrl));
  });

  return router;
}

export function paginaSinAcceso(portalUrl) {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sin acceso</title>
<style>body{font-family:Figtree,system-ui,sans-serif;background:#f4f7f4;color:#1c2b22;display:grid;place-items:center;min-height:100vh;margin:0}main{background:#fff;padding:2rem 2.5rem;border-radius:12px;max-width:28rem;box-shadow:0 2px 12px #0001}a{color:#2f6b4a;font-weight:600}</style></head>
<body><main><h1>Sin acceso</h1><p>No pudimos habilitar tu ingreso a este sistema.</p><p><a href="${esc(portalUrl)}">Volver al portal del Ministerio</a></p></main></body></html>`;
}
