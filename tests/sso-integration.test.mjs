// Integración del SSO RS256 contra una Postgres embebida real (sin Docker, sin bases reales).
// Levanta Postgres en un puerto propio y un directorio temporal, aplica migraciones y seeds,
// y monta el router /sso de la API real con un JWKS local firmado con la clave PRUEBA.
//   node --test tests/sso-integration.test.mjs
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import { createRequire } from 'node:module';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const VEC = path.join(ROOT, 'api/test/sso/vectores');
const requireApi = createRequire(path.join(ROOT, 'api/package.json'));
const PORT_PG = 54391;
// Portal bajo el mismo dominio que la Wiki, con path: el origen del anti-CSRF es solo scheme+host.
const ISS = 'https://ecodatos.ecologia.misiones.gob.ar/portal';
const PORTAL = 'https://ecodatos.ecologia.misiones.gob.ar'; // Origin que manda el navegador
const PORTAL_URL = `${PORTAL}/portal/`;
const ADMIN = 'admin@wiki.test';

let embedded, dataDir, jwksServer, apiServer, base, pool, SignJWT, privKey, express;
const env = {
  POSTGRES_USER: 'wiki', POSTGRES_PASSWORD: 'pw-' + randomBytes(8).toString('hex'), POSTGRES_DB: 'wiki',
  APP_DB_USER: 'wiki_app', APP_DB_PASSWORD: 'pw-' + randomBytes(8).toString('hex'),
  SESSION_SECRET: randomBytes(32).toString('hex'), ADMIN_EMAIL: ADMIN, ADMIN_PASSWORD_INICIAL: 'Clave-de-prueba-123',
  DB_HOST: '127.0.0.1', DB_PORT: String(PORT_PG), DB_DIR: path.join(ROOT, 'db'), COOKIE_SECURE: 'true',
};

before(async () => {
  if (!existsSync(path.join(ROOT, 'node_modules/embedded-postgres'))) throw new Error('falta `npm install` en la raíz (embedded-postgres)');
  const { default: EmbeddedPostgres } = await import('embedded-postgres');
  dataDir = mkdtempSync(path.join(tmpdir(), 'wiki-sso-pg-'));
  embedded = new EmbeddedPostgres({ databaseDir: dataDir, user: env.POSTGRES_USER, password: env.POSTGRES_PASSWORD, port: PORT_PG, persistent: false, onLog: () => {}, onError: () => {} });
  await embedded.initialise();
  await embedded.start();
  await embedded.createDatabase(env.POSTGRES_DB);
  for (const f of ['migrate.js', 'seed.js']) {
    const r = spawnSync(process.execPath, [path.join(ROOT, 'api/src', f)], { env: { ...process.env, ...env }, encoding: 'utf8' });
    assert.equal(r.status, 0, `${f}: ${r.stdout}${r.stderr}`);
  }

  // JWKS local firmado con la clave PRUEBA (kid PRUEBA-1)
  const jwks = readFileSync(path.join(VEC, 'jwks.PRUEBA.json'), 'utf8');
  jwksServer = http.createServer((_q, r) => { r.setHeader('content-type', 'application/json'); r.end(jwks); });
  await new Promise((ok) => jwksServer.listen(0, '127.0.0.1', ok));
  const jwksUrl = `http://127.0.0.1:${jwksServer.address().port}/.well-known/jwks.json`;

  Object.assign(process.env, env);
  const jose = await import(requireApi.resolve('jose'));
  SignJWT = jose.SignJWT;
  privKey = await jose.importPKCS8(readFileSync(path.join(VEC, 'clave-privada.PRUEBA.pem'), 'utf8'), 'RS256');
  ({ default: express } = await import(requireApi.resolve('express')));
  const { crearRouterSso } = await import('../api/src/sso/index.js');
  ({ pool } = await import('../api/src/db.js'));

  const app = express();
  app.set('trust proxy', 1);
  app.use(crearRouterSso({ sso: { issuer: ISS, jwksUrl, audience: 'wiki', portalUrl: PORTAL_URL, inicioUrl: '/wiki/' } }));
  app.use((err, _q, res, _n) => res.status(err.status ?? 500).json({ error: err.code ?? 'error' }));
  apiServer = http.createServer(app);
  await new Promise((ok) => apiServer.listen(0, '127.0.0.1', ok));
  base = `http://127.0.0.1:${apiServer.address().port}`;
});

after(async () => {
  await pool?.end().catch(() => {});
  apiServer?.close(); jwksServer?.close();
  await embedded?.stop().catch(() => {});
  if (dataDir) rmSync(dataDir, { recursive: true, force: true });
});

const sql = async (text, p) => (await pool.query(text, p)).rows;
let n = 0;
async function pase({ email, use = 'login', name = 'Persona Prueba', aud = 'wiki', iss = ISS, jti = `jti-${Date.now()}-${n++}`, extra = {} }) {
  const t = Math.floor(Date.now() / 1000);
  return new SignJWT({ email, name, sub: 'emp-1', use, ...extra })
    .setProtectedHeader({ alg: 'RS256', kid: 'PRUEBA-1' })
    .setIssuer(iss).setAudience(aud).setIssuedAt(t).setExpirationTime(t + 60).setJti(jti).sign(privKey);
}
const acceso = (token) => fetch(`${base}/sso/acceso`, { headers: token ? { authorization: `Bearer ${token}` } : {} });
const login = (token, headers = {}) => fetch(`${base}/sso/login`, {
  method: 'POST', redirect: 'manual',
  headers: { 'content-type': 'application/x-www-form-urlencoded', ...headers },
  body: new URLSearchParams({ token }).toString(),
});
const contar = async (email) => Number((await sql('SELECT count(*) FROM users WHERE lower(email)=$1', [email]))[0].count);

test('acceso: admin global => admin', async () => {
  const r = await acceso(await pase({ email: ADMIN.toUpperCase(), use: 'acceso' }));
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('cache-control').includes('no-store'), true);
  assert.deepEqual(await r.json(), { acceso: true, rol: 'admin' });
});

test('acceso: admin_espacio => admin; sin roles => lector; inactivo => acceso:false', async () => {
  const [{ id: space }] = await sql("SELECT id FROM spaces WHERE slug <> 'ministerio' LIMIT 1");
  const mk = async (email, activo = true) => (await sql(
    `INSERT INTO users (email, nombre, password_hash, activo, must_change_password) VALUES ($1,'T','x',$2,false) RETURNING id`, [email, activo]))[0].id;
  const dir = await mk('director@wiki.test');
  await sql(`INSERT INTO user_space_roles (user_id, space_id, rol) VALUES ($1,$2,'admin_espacio')`, [dir, space]);
  await mk('lector@wiki.test');
  const gen = await mk('general@wiki.test');
  await sql(`INSERT INTO user_space_roles (user_id, space_id, rol) VALUES ($1,$2,'general')`, [gen, space]);
  await mk('inactivo@wiki.test', false);
  const rol = async (email) => (await (await acceso(await pase({ email, use: 'acceso' }))).json());
  assert.deepEqual(await rol('director@wiki.test'), { acceso: true, rol: 'admin' });
  assert.deepEqual(await rol('lector@wiki.test'), { acceso: true, rol: 'lector' });
  assert.deepEqual(await rol('general@wiki.test'), { acceso: true, rol: 'lector' });
  assert.deepEqual(await rol('inactivo@wiki.test'), { acceso: false });
});

test('acceso: inexistente => acceso:false y NO se crea el usuario; sin pase o inválido => 401', async () => {
  const antes = await sql('SELECT count(*) FROM users');
  const r = await acceso(await pase({ email: 'fantasma@wiki.test', use: 'acceso' }));
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { acceso: false });
  assert.equal(await contar('fantasma@wiki.test'), 0);
  assert.deepEqual(await sql('SELECT count(*) FROM users'), antes);
  assert.equal((await acceso()).status, 401);
  assert.equal((await acceso('basura')).status, 401);
  assert.equal((await acceso(await pase({ email: ADMIN, use: 'login' }))).status, 401, 'use equivocado');
  assert.equal((await acceso(await pase({ email: ADMIN, use: 'acceso', aud: 'otro' }))).status, 401);
});

test('login: existente abre sesión, cookie HttpOnly/Secure/Lax, 302 a /wiki/, last_login y auditoría', async () => {
  const r = await login(await pase({ email: 'director@wiki.test' }), { origin: PORTAL });
  assert.equal(r.status, 302);
  assert.equal(r.headers.get('location'), '/wiki/');
  assert.equal(r.headers.get('cache-control').includes('no-store'), true);
  const sc = r.headers.get('set-cookie');
  assert.match(sc, /^wiki_sid=[\w-]{20,};/);
  assert.match(sc, /HttpOnly/i);
  assert.match(sc, /Secure/i);
  assert.match(sc, /SameSite=Lax/i);
  assert.match(sc, /Path=\//);
  const [u] = await sql("SELECT last_login_at FROM users WHERE email='director@wiki.test'");
  assert.ok(u.last_login_at);
  const [s] = await sql("SELECT via_sso FROM sessions s JOIN users u ON u.id=s.user_id WHERE u.email='director@wiki.test'");
  assert.equal(s.via_sso, true);
  const ev = await sql("SELECT accion FROM audit_log a JOIN users u ON u.id=a.user_id WHERE u.email='director@wiki.test'");
  assert.deepEqual(ev.map((e) => e.accion), ['login_sso']);
  // la cookie sirve: el token no se guarda en claro (id = HMAC)
  const tok = /wiki_sid=([^;]+)/.exec(sc)[1];
  assert.equal((await sql('SELECT 1 FROM sessions WHERE id = $1', [tok])).length, 0);
});

test('login: usuario inexistente se crea UNA vez como lector aunque lleguen 5 en paralelo', async () => {
  const email = 'recien.llegada@wiki.test';
  const pases = await Promise.all([1, 2, 3, 4, 5].map(() => pase({ email: email.toUpperCase(), name: 'Rita Llegada' })));
  const rs = await Promise.all(pases.map((p) => login(p)));
  assert.deepEqual(rs.map((r) => r.status), [302, 302, 302, 302, 302]);
  assert.equal(await contar(email), 1);
  const [u] = await sql('SELECT * FROM users WHERE lower(email)=$1', [email]);
  assert.equal(u.email, email);
  assert.equal(u.nombre, 'Rita Llegada');
  assert.equal(u.activo, true);
  assert.equal(u.es_admin_global, false);
  assert.equal(u.must_change_password, false);
  assert.match(u.password_hash, /^\$argon2id\$/);
  assert.equal((await sql('SELECT 1 FROM user_space_roles WHERE user_id=$1', [u.id])).length, 0);
  const a = await (await acceso(await pase({ email, use: 'acceso' }))).json();
  assert.deepEqual(a, { acceso: true, rol: 'lector' });
  // la sesión SSO no obliga a cambiar clave (via_sso) y se creó una por cada login
  assert.equal((await sql('SELECT 1 FROM sessions WHERE user_id=$1 AND via_sso', [u.id])).length, 5);
});

test('login: nombre por defecto = parte local del correo si el pase no trae name', async () => {
  const t = Math.floor(Date.now() / 1000);
  const token = await new SignJWT({ email: 'sin.nombre@wiki.test', sub: 'e', use: 'login' })
    .setProtectedHeader({ alg: 'RS256', kid: 'PRUEBA-1' }).setIssuer(ISS).setAudience('wiki')
    .setIssuedAt(t).setExpirationTime(t + 60).setJti('jti-sin-nombre').sign(privKey);
  assert.equal((await login(token)).status, 302);
  assert.equal((await sql("SELECT nombre FROM users WHERE email='sin.nombre@wiki.test'"))[0].nombre, 'sin.nombre');
});

test('login: usuario inactivo => 403, sin cookie y sin sesión', async () => {
  const r = await login(await pase({ email: 'inactivo@wiki.test' }));
  assert.equal(r.status, 403);
  assert.equal(r.headers.get('set-cookie'), null);
  const html = await r.text();
  assert.match(html, new RegExp(`href="${PORTAL_URL}"`), 'el enlace apunta a /portal/ sin ?volver');
  assert.doesNotMatch(html, /volver/);
  assert.equal(await contar('inactivo@wiki.test'), 1);
});

test('login: jti reutilizado => 403 (almacén en Postgres)', async () => {
  const t = await pase({ email: ADMIN, jti: 'jti-reuso' });
  assert.equal((await login(t)).status, 302);
  assert.equal((await login(t)).status, 403);
  const [fila] = await sql("SELECT vence > now() AS vigente FROM sso_jti_usados WHERE jti='jti-reuso'");
  assert.equal(fila.vigente, true);
});

test('login: mismo pase 5 veces en paralelo => solo una sesión', async () => {
  const t = await pase({ email: 'general@wiki.test', jti: 'jti-paralelo' });
  const rs = await Promise.all([1, 2, 3, 4, 5].map(() => login(t)));
  assert.equal(rs.filter((r) => r.status === 302).length, 1);
  assert.equal(rs.filter((r) => r.status === 403).length, 4);
});

test('login: Origin ajeno o null => 403; Sec-Fetch-Site cross-site sin Origin => 403; sin cabeceras o del portal => 302', async () => {
  assert.equal((await login(await pase({ email: ADMIN }), { origin: 'https://evil.example' })).status, 403);
  assert.equal((await login(await pase({ email: ADMIN }), { origin: 'null' })).status, 403);
  assert.equal((await login(await pase({ email: ADMIN }), { origin: PORTAL_URL })).status, 403, 'Origin nunca lleva path: con path no coincide');
  assert.equal((await login(await pase({ email: ADMIN }), { 'sec-fetch-site': 'cross-site' })).status, 403);
  assert.equal((await login(await pase({ email: ADMIN }), { origin: PORTAL })).status, 302);
  assert.equal((await login(await pase({ email: ADMIN }))).status, 302);
  // el 403 por Origin no consumió el jti: se prueba con uno fijo
  const t = await pase({ email: ADMIN, jti: 'jti-origen' });
  assert.equal((await login(t, { origin: 'https://evil.example' })).status, 403);
  assert.equal((await login(t, { origin: PORTAL })).status, 302);
});

test('login: pase inválido, aud/iss ajenos, use=acceso o GET => 403/404; nunca 401', async () => {
  for (const t of ['', 'basura', await pase({ email: ADMIN, aud: 'otro' }), await pase({ email: ADMIN, iss: 'https://otro' }), await pase({ email: ADMIN, use: 'acceso' })]) {
    assert.equal((await login(t)).status, 403);
  }
  assert.equal((await fetch(`${base}/sso/login?token=x`)).status, 404);
});

test('sin SSO_JWKS_URL las rutas responden 404', async () => {
  const { crearRouterSso } = await import('../api/src/sso/index.js');
  const app = express();
  app.use(crearRouterSso({ sso: { jwksUrl: null } }));
  app.use((err, _q, res, _n) => res.status(err.status ?? 500).end());
  const s = http.createServer(app);
  await new Promise((ok) => s.listen(0, '127.0.0.1', ok));
  const b = `http://127.0.0.1:${s.address().port}`;
  assert.equal((await fetch(`${b}/sso/acceso`)).status, 404);
  assert.equal((await fetch(`${b}/sso/login`, { method: 'POST' })).status, 404);
  s.close();
});

test('las filas de auditoría de rechazos no contienen tokens ni pases', async () => {
  const filas = await sql("SELECT accion, recurso, recurso_id FROM audit_log WHERE accion='sso_rechazado'");
  assert.ok(filas.length > 0);
  for (const f of filas) assert.match(f.recurso_id, /^(acceso|login):[a-z]+$/);
});

test('el limitador de /sso/login corta con 429 tras demasiados fallos', async () => {
  let ultimo = 0;
  for (let i = 0; i < 40 && ultimo !== 429; i++) ultimo = (await login('basura')).status;
  assert.equal(ultimo, 429);
});

test('servidor real (server.js): /api/auth/sso ya no existe y /auth/config devuelve solo portal_url; /sso 404 sin SSO_JWKS_URL', async () => {
  const { spawn } = await import('node:child_process');
  const port = 3917;
  const hijo = spawn(process.execPath, [path.join(ROOT, 'api/src/server.js')], {
    env: { ...process.env, ...env, PORT: String(port), PORTAL_URL: 'https://ecodatos.ecologia.misiones.gob.ar/portal/', SSO_JWKS_URL: '', NODE_ENV: 'development' },
    stdio: 'ignore',
  });
  try {
    const url = `http://127.0.0.1:${port}`;
    for (let i = 0; i < 50; i++) {
      if (await fetch(`${url}/api/health`).then((r) => r.ok, () => false)) break;
      await new Promise((r) => setTimeout(r, 200));
    }
    const post = (p, body) => fetch(url + p, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const viejo = await post('/api/auth/sso', { token: 'x.y.z' });
    assert.equal(viejo.status, 401, 'cae en requireAuth: la ruta no existe');
    const cfg = await (await fetch(`${url}/api/auth/config`)).json();
    assert.deepEqual(cfg, { portal_url: 'https://ecodatos.ecologia.misiones.gob.ar/portal/' });
    assert.equal((await fetch(`${url}/sso/acceso`)).status, 404);
    assert.equal((await post('/sso/login', {})).status, 404);
  } finally {
    hijo.kill('SIGTERM');
  }
});
