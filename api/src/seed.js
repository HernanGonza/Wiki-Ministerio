// Carga los seeds (una sola vez cada uno) y crea el admin global inicial.
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import argon2 from 'argon2';
import { config } from './config.js';
import { ownerClient } from './db.js';

const LOCK_ID = 748202;

async function ensureAdmin(client) {
  const { adminEmail, adminPasswordInicial, passwordMinLength } = config;
  if (!adminEmail || !adminPasswordInicial) {
    throw new Error('ADMIN_EMAIL y ADMIN_PASSWORD_INICIAL son obligatorios para el primer arranque');
  }
  const exists = await client.query('SELECT 1 FROM users WHERE lower(email) = lower($1)', [adminEmail]);
  if (exists.rowCount) return;
  if (adminPasswordInicial.length < passwordMinLength) {
    throw new Error(`ADMIN_PASSWORD_INICIAL debe tener al menos ${passwordMinLength} caracteres`);
  }
  const hash = await argon2.hash(adminPasswordInicial, { type: argon2.argon2id });
  await client.query(
    `INSERT INTO users (email, nombre, password_hash, must_change_password, es_admin_global)
     VALUES ($1, 'Administrador', $2, true, true)`,
    [adminEmail.trim(), hash],
  );
  console.log('[seed] administrador global creado');
}

async function main() {
  const client = await ownerClient();
  try {
    await client.query('SELECT pg_advisory_lock($1)', [LOCK_ID]);
    // El admin se crea primero: algunos seeds lo referencian como autor.
    await ensureAdmin(client);

    const dir = path.join(config.dbDir, 'seed');
    const files = (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort();
    const done = new Set((await client.query('SELECT nombre FROM seed_applied')).rows.map((r) => r.nombre));
    for (const file of files) {
      if (done.has(file)) continue;
      const sql = await readFile(path.join(dir, file), 'utf8');
      console.log(`[seed] aplicando ${file}`);
      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('INSERT INTO seed_applied (nombre) VALUES ($1)', [file]);
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        throw new Error(`Falló el seed ${file}: ${err.message}`);
      }
    }
    console.log('[seed] listo');
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [LOCK_ID]).catch(() => {});
    await client.end();
  }
}

main().catch((err) => {
  console.error('[seed]', err.message);
  process.exit(1);
});
