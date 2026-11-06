#!/usr/bin/env node
// `npm run dev` desde la raíz: deja todo andando para desarrollar.
//   1. instala dependencias de api/ y web/ si faltan
//   2. crea .env con valores de desarrollo si no existe (secretos aleatorios)
//   3. levanta PostgreSQL 16 embebido en .dev/pgdata (sin Docker). Si en .env se define
//      DEV_DB=external, usa la base indicada por DB_HOST / DB_PORT y no levanta nada.
//   4. aplica migraciones y seeds
//   5. arranca la API (node --watch) y la web (Vite) con logs prefijados
// Ctrl+C detiene todo. `npm run dev:reset` borra la base de desarrollo y arranca de cero.
import { spawn, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ENV_FILE = path.join(ROOT, '.env');
const PGDIR = path.join(ROOT, '.dev', 'pgdata');
const DEV_PG_PORT = 54329;
const isWin = process.platform === 'win32';
const npm = isWin ? 'npm.cmd' : 'npm';

const c = (code) => (s) => `\x1b[${code}m${s}\x1b[0m`;
const dim = c(2), bold = c(1), green = c(32), cyan = c(36), yellow = c(33), red = c(31), magenta = c(35);
const log = (...a) => console.log(cyan('[dev]'), ...a);
const die = (msg) => { console.error(red('[dev] ' + msg)); process.exit(1); };

// ───────── 1. Dependencias ─────────
function ensureDeps(dir, probe) {
  if (existsSync(path.join(ROOT, dir, probe))) return;
  log(`instalando dependencias de ${bold(dir + '/')} (primera vez)…`);
  const r = spawnSync(npm, ['--prefix', dir, 'install', '--no-audit', '--no-fund'], { cwd: ROOT, stdio: 'inherit' });
  if (r.status !== 0) die(`falló npm install en ${dir}/`);
}
ensureDeps('api', 'node_modules/express');
ensureDeps('web', 'node_modules/vite');

// ───────── 2. .env ─────────
const rnd = (n) => randomBytes(n).toString('base64url').slice(0, n);
let generatedAdmin = null;
if (!existsSync(ENV_FILE)) {
  generatedAdmin = `Dev-${rnd(14)}`;
  writeFileSync(
    ENV_FILE,
    [
      '# Generado por `npm run dev` SOLO para desarrollo local. No usar estos valores en producción.',
      '# (En producción: copiar .env.example y completar con secretos propios.)',
      'POSTGRES_USER=wiki',
      `POSTGRES_PASSWORD=${rnd(24)}`,
      'POSTGRES_DB=wiki',
      'APP_DB_USER=wiki_app',
      `APP_DB_PASSWORD=${rnd(24)}`,
      `SESSION_SECRET=${rnd(48)}`,
      'COOKIE_SECURE=false',
      'ADMIN_EMAIL=admin@wiki.local',
      `ADMIN_PASSWORD_INICIAL=${generatedAdmin}`,
      'VAULTWARDEN_URL=',
      '',
      '# --- Solo desarrollo (los ignora docker-compose) ---',
      '# DEV_DB=external usa una Postgres propia en DB_HOST:DB_PORT en vez de la embebida.',
      'DEV_DB=embedded',
      'DB_HOST=127.0.0.1',
      `DB_PORT=${DEV_PG_PORT}`,
      '',
    ].join('\n'),
    { mode: 0o600 },
  );
  log(`creado ${bold('.env')} de desarrollo`);
}

function loadEnv(file) {
  const out = {};
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (m && !line.trimStart().startsWith('#')) out[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
  }
  return out;
}

const reset = process.argv.includes('--reset');
if (reset) {
  rmSync(path.join(ROOT, '.dev'), { recursive: true, force: true });
  log('base de desarrollo borrada (.dev/)');
}

const fileEnv = loadEnv(ENV_FILE);
const env = {
  ...process.env,
  ...fileEnv,
  DB_DIR: path.join(ROOT, 'db'),
  FILES_DIR: process.env.FILES_DIR || path.join(ROOT, '.dev', 'files'),
  NODE_ENV: 'development',
};
const external = (env.DEV_DB ?? 'embedded') === 'external';
if (!external) {
  env.DB_HOST = '127.0.0.1';
  env.DB_PORT = env.DB_PORT || String(DEV_PG_PORT);
}
for (const k of ['POSTGRES_USER', 'POSTGRES_PASSWORD', 'POSTGRES_DB', 'APP_DB_USER', 'APP_DB_PASSWORD', 'SESSION_SECRET', 'ADMIN_EMAIL', 'ADMIN_PASSWORD_INICIAL']) {
  if (!env[k]) die(`falta ${k} en .env`);
}

// ───────── 3. Base de datos ─────────
let pg = null;
async function respondeNuestraDb() {
  const { default: pgLib } = await import('pg');
  const client = new pgLib.Client({
    host: '127.0.0.1', port: Number(env.DB_PORT), database: 'postgres',
    user: env.POSTGRES_USER, password: env.POSTGRES_PASSWORD, connectionTimeoutMillis: 1500,
  });
  try {
    await client.connect();
    await client.query('SELECT 1');
    const has = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [env.POSTGRES_DB]);
    if (!has.rowCount) await client.query(`CREATE DATABASE ${client.escapeIdentifier(env.POSTGRES_DB)}`);
    return true;
  } catch {
    return false;
  } finally {
    await client.end().catch(() => {});
  }
}

async function startEmbeddedPg() {
  let EmbeddedPostgres;
  try {
    ({ default: EmbeddedPostgres } = await import('embedded-postgres'));
  } catch {
    die('falta embedded-postgres: ejecutar `npm install` en la raíz del proyecto.');
  }
  // Algunos entornos bloquean el postinstall del paquete binario; esto recrea sus symlinks.
  const plat = `${process.platform}-${process.arch}`;
  const hydrate = path.join(ROOT, 'node_modules', '@embedded-postgres', plat, 'scripts', 'hydrate-symlinks.js');
  if (existsSync(hydrate)) spawnSync(process.execPath, [hydrate], { stdio: 'ignore' });

  mkdirSync(path.dirname(PGDIR), { recursive: true });
  const ep = new EmbeddedPostgres({
    databaseDir: PGDIR,
    user: env.POSTGRES_USER,
    password: env.POSTGRES_PASSWORD,
    port: Number(env.DB_PORT),
    persistent: true,
    onLog: () => {},
    onError: (m) => { if (/FATAL|PANIC/.test(String(m))) console.error(dim('[pg] ' + String(m).trim())); },
  });
  pg = ep;
  // ¿Quedó andando una instancia de una corrida anterior (p. ej. se cortó sin Ctrl+C)? Se reutiliza.
  if (await respondeNuestraDb()) {
    pg = null; // no la levantamos nosotros: tampoco la detenemos
    log(`PostgreSQL de desarrollo ya estaba corriendo en ${green('127.0.0.1:' + env.DB_PORT)}, se reutiliza`);
    return;
  }
  const fresh = !existsSync(path.join(PGDIR, 'PG_VERSION'));
  if (fresh) {
    log('creando base de datos de desarrollo (PostgreSQL 16 embebido)…');
    await pg.initialise();
  }
  try {
    await pg.start();
  } catch (e) {
    die(`no se pudo iniciar PostgreSQL en el puerto ${env.DB_PORT}: ${e?.message ?? e ?? 'error desconocido'}\n` +
      `      ¿Hay otro servicio en ese puerto? Cambiar DB_PORT en .env, o probar \`npm run dev:reset\`.`);
  }
  try {
    await pg.createDatabase(env.POSTGRES_DB);
  } catch {
    /* ya existe */
  }
  log(`PostgreSQL listo en ${green('127.0.0.1:' + env.DB_PORT)} ${dim('(datos en .dev/pgdata)')}`);
}

function runNode(file, label) {
  const r = spawnSync(process.execPath, [file], { cwd: ROOT, env, stdio: 'inherit' });
  if (r.status !== 0) throw new Error(`${label} falló`);
}

const children = [];
let closing = false;
async function shutdown(code = 0) {
  if (closing) return;
  closing = true;
  console.log('\n' + cyan('[dev]') + ' deteniendo…');
  for (const ch of children) { try { ch.kill('SIGTERM'); } catch { /* ya terminó */ } }
  if (pg) { try { await pg.stop(); } catch { /* ignorar */ } }
  process.exit(code);
}
process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
process.on('SIGHUP', () => shutdown(0));

function spawnPrefixed(label, color, cmd, args, cwd) {
  const ch = spawn(cmd, args, { cwd, env: { ...env, FORCE_COLOR: '1' }, stdio: ['ignore', 'pipe', 'pipe'] });
  const pipe = (stream, out) => {
    let buf = '';
    stream.on('data', (d) => {
      buf += d.toString();
      const lines = buf.split('\n');
      buf = lines.pop() ?? '';
      for (const l of lines) if (l.trim()) out.write(`${color(label)} ${l}\n`);
    });
  };
  pipe(ch.stdout, process.stdout);
  pipe(ch.stderr, process.stderr);
  ch.on('exit', (code) => {
    if (!closing) {
      console.error(red(`[dev] ${label} terminó (código ${code}); se detiene todo.`));
      void shutdown(code ?? 1);
    }
  });
  children.push(ch);
  return ch;
}

try {
  if (external) log(`usando PostgreSQL externa en ${env.DB_HOST}:${env.DB_PORT}`);
  else await startEmbeddedPg();

  log('aplicando migraciones y seeds…');
  runNode('api/src/migrate.js', 'migrate');
  runNode('api/src/seed.js', 'seed');
} catch (e) {
  console.error(red('[dev] ' + e.message));
  await shutdown(1);
}

spawnPrefixed('api', magenta, process.execPath, ['--watch', 'src/server.js'], path.join(ROOT, 'api'));
spawnPrefixed('web', green, npm, ['run', 'dev', '--', '--host', '127.0.0.1', '--strictPort'], path.join(ROOT, 'web'));

setTimeout(() => {
  console.log('\n' + bold('  Wiki MERNR en desarrollo'));
  console.log(`  Web   ${cyan('http://127.0.0.1:5173')}`);
  console.log(`  API   ${cyan('http://127.0.0.1:' + (env.PORT ?? 3000))}  ${dim('(la web hace proxy de /api)')}`);
  console.log(`  Admin ${yellow(env.ADMIN_EMAIL)}${generatedAdmin ? '  clave inicial: ' + yellow(generatedAdmin) : dim('  (clave inicial en .env: ADMIN_PASSWORD_INICIAL)')}`);
  console.log(dim('  Ctrl+C para detener todo.\n'));
}, 2500);
