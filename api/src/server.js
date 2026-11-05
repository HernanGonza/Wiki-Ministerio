import express from 'express';
import helmet from 'helmet';
import { config } from './config.js';
import { pool, query } from './db.js';
import { errorMiddleware, notFound, h } from './http.js';
import { requireAuth, requireJsonOnWrite } from './auth/middleware.js';
import { publicAuth, privateAuth } from './routes/auth.js';
import { spacesRouter } from './routes/spaces.js';
import { announcementsRouter } from './routes/announcements.js';
import { systemsRouter } from './routes/systems.js';
import { adminContent } from './routes/admin-content.js';
import { adminSpace } from './routes/admin-space.js';
import { adminGlobal } from './routes/admin-global.js';
import { auditRouter } from './routes/audit.js';
import { startMonitor } from './services/monitor.js';
import { startRetention } from './services/retention.js';

const app = express();
app.disable('x-powered-by');
// Detrás de nginx (un solo salto). nginx pisa X-Forwarded-For con la IP real del cliente.
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

app.get('/api/health', h(async (_req, res) => {
  await query('SELECT 1');
  res.json({ status: 'ok' });
}));

// Todo lo que modifica datos exige JSON (defensa CSRF junto con sameSite=lax).
app.use('/api', requireJsonOnWrite);

// Login: sin sesión.
app.use('/api/auth', publicAuth);

// Desde acá, sesión obligatoria.
app.use('/api', requireAuth);
app.use('/api/auth', privateAuth);
app.use('/api/spaces', spacesRouter);
app.use('/api/announcements', announcementsRouter);
app.use('/api/systems', systemsRouter);
app.use('/api/audit', auditRouter);
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
