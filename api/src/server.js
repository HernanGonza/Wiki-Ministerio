import express from 'express';
import helmet from 'helmet';
import { config } from './config.js';
import { pool, query } from './db.js';
import { errorMiddleware, notFound, h } from './http.js';
import { requireAuth, optionalAuth, requireJsonOnWrite } from './auth/middleware.js';
import { publicAuth, privateAuth } from './routes/auth.js';
import { spacesRouter } from './routes/spaces.js';
import { announcementsRouter } from './routes/announcements.js';
import { systemsRouter } from './routes/systems.js';
import { adminContent } from './routes/admin-content.js';
import { adminSpace } from './routes/admin-space.js';
import { adminGlobal } from './routes/admin-global.js';
import { auditRouter } from './routes/audit.js';
import { filesAdmin, filesPublic } from './routes/files.js';
import { crearRouterSso } from './sso/index.js';
import { startMonitor } from './services/monitor.js';
import { startRetention } from './services/retention.js';

const app = express();
app.disable('x-powered-by');
// Detrás de dos nginx (ecodatos -> wiki-web -> api), pero un solo salto cuenta: wiki-web recupera la IP real
// del cliente (X-Real-IP de ecodatos, set_real_ip_from) y PISA X-Forwarded-For con ella. Express toma la
// última entrada de X-Forwarded-For (trust proxy = 1), que es la que puso wiki-web, no la del cliente.
app.set('trust proxy', 1);
app.use(helmet());
app.use(express.json({ limit: '2mb' }));

// Log mínimo: método, ruta (sin query), estado y duración. Nunca headers, cookies ni cuerpos.
app.use((req, res, next) => {
  const t0 = Date.now();
  res.on('finish', () => {
    if (req.path === '/api/health') return;
    console.log(`${req.method} ${req.path} ${res.statusCode} ${Date.now() - t0}ms`);
  });
  next();
});

// Ingreso único (RS256) desde el portal: rutas públicas en la raíz, fuera de /api. Sin SSO_JWKS_URL: 404.
app.use(crearRouterSso());

app.get('/api/health', h(async (_req, res) => {
  await query('SELECT 1');
  res.json({ status: 'ok' });
}));

// Todo lo que modifica datos exige JSON (defensa CSRF junto con sameSite=lax).
app.use('/api', requireJsonOnWrite);

// Login: sin sesión.
app.use('/api/auth', publicAuth);

// Lectura pública (solo GET): con o sin sesión. Lo marcado `restringido` solo lo ven los admins.
const soloLectura = (req, _res, next) =>
  ['GET', 'HEAD'].includes(req.method) ? next() : next(notFound());
app.use('/api/spaces', optionalAuth, soloLectura, spacesRouter);
app.use('/api/announcements', optionalAuth, soloLectura, announcementsRouter);
app.use('/api/systems', optionalAuth, soloLectura, systemsRouter);
app.use('/api/files', optionalAuth, soloLectura, filesPublic);

// Desde acá, sesión obligatoria.
app.use('/api', requireAuth);
app.use('/api/auth', privateAuth);
app.use('/api/audit', auditRouter);
app.use('/api/admin/spaces/:slug/files', filesAdmin);
app.use('/api/admin/spaces/:slug', adminContent);
app.use('/api/admin/spaces/:slug', adminSpace);
app.use('/api/admin', adminGlobal);

app.use('/api', (_req, _res, next) => next(notFound()));
app.use(errorMiddleware);

const server = app.listen(config.port, () => {
  console.log(`[api] escuchando en :${config.port}`);
  startMonitor();
  startRetention();
});

const shutdown = () => {
  server.close(() => pool.end().finally(() => process.exit(0)));
  setTimeout(() => process.exit(1), 10_000).unref();
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
