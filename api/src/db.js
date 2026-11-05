import pg from 'pg';
import { config } from './config.js';

// Conexión de la aplicación: usuario con permisos mínimos.
export const pool = new pg.Pool({
  host: config.db.host,
  port: config.db.port,
  database: config.db.database,
  user: config.db.appUser,
  password: config.db.appPassword,
  max: 10,
});

pool.on('error', (err) => console.error('[db] error en conexión inactiva:', err.message));

export const query = (text, params) => pool.query(text, params);

/** Ejecuta fn(client) dentro de una transacción. */
export async function tx(fn, p = pool) {
  const client = await p.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

/** Cliente con el superusuario: solo para migrate.js y seed.js. */
export async function ownerClient() {
  const client = new pg.Client({
    host: config.db.host,
    port: config.db.port,
    database: config.db.database,
    user: config.db.ownerUser,
    password: config.db.ownerPassword,
  });
  await client.connect();
  return client;
}
