// Aplica migraciones numeradas y deja configurado el usuario de la app.
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { config } from './config.js';
import { ownerClient } from './db.js';

const LOCK_ID = 748201;

async function ensureAppRole(client) {
  const { appUser, appPassword, database } = config.db;
  const u = client.escapeIdentifier(appUser);
  const pass = client.escapeLiteral(appPassword);
  const exists = await client.query('SELECT 1 FROM pg_roles WHERE rolname = $1', [appUser]);
  const attrs = 'LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS';
  await client.query(
    exists.rowCount
      ? `ALTER ROLE ${u} WITH ${attrs} PASSWORD ${pass}`
      : `CREATE ROLE ${u} WITH ${attrs} PASSWORD ${pass}`,
  );
  await client.query(`GRANT CONNECT ON DATABASE ${client.escapeIdentifier(database)} TO ${u}`);
  await client.query(`GRANT USAGE ON SCHEMA public TO ${u}`);
  await client.query(`REVOKE CREATE ON SCHEMA public FROM ${u}`);
  await client.query(`REVOKE ALL ON ALL TABLES IN SCHEMA public FROM ${u}`);
  await client.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${u}`);
  // audit_log: solo inserción y lectura.
  await client.query(`REVOKE UPDATE, DELETE, TRUNCATE ON audit_log FROM ${u}`);
  // Tablas internas del runner: sin acceso para la app.
  await client.query(`REVOKE ALL ON schema_migrations, seed_applied FROM ${u}`);
  await client.query(`GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ${u}`);
}

async function main() {
  const client = await ownerClient();
  try {
    await client.query('SELECT pg_advisory_lock($1)', [LOCK_ID]);
    await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      nombre text PRIMARY KEY, aplicada_at timestamptz NOT NULL DEFAULT now())`);
    await client.query(`CREATE TABLE IF NOT EXISTS seed_applied (
      nombre text PRIMARY KEY, aplicado_at timestamptz NOT NULL DEFAULT now())`);

    const dir = path.join(config.dbDir, 'migrations');
    const files = (await readdir(dir)).filter((f) => /^\d+_.+\.sql$/.test(f)).sort();
    const done = new Set((await client.query('SELECT nombre FROM schema_migrations')).rows.map((r) => r.nombre));

    for (const file of files) {
      if (done.has(file)) continue;
      const sql = await readFile(path.join(dir, file), 'utf8');
      console.log(`[migrate] aplicando ${file}`);
      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (nombre) VALUES ($1)', [file]);
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        throw new Error(`Falló la migración ${file}: ${err.message}`);
      }
    }
    await ensureAppRole(client);
    console.log('[migrate] listo');
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [LOCK_ID]).catch(() => {});
    await client.end();
  }
}

main().catch((err) => {
  console.error('[migrate]', err.message);
  process.exit(1);
});
