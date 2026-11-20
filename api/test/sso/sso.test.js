// Pruebas unitarias del SSO RS256 con los vectores oficiales (clave PRUEBA, copiados de login-central).
// Sin base de datos: la búsqueda de usuarios y el almacén de jti usan un `query` simulado.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { crearVerificador } from '../../src/sso-kit/index.js';
import { crearAlmacenJtiPostgres } from '../../src/sso/jti-store-pg.js';
import { crearBuscarUsuarioPorCorreo, nombreParaAlta } from '../../src/sso/usuarios.js';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'vectores');
const V = JSON.parse(readFileSync(path.join(dir, 'vectores.PRUEBA.json'), 'utf8'));
const JWKS = readFileSync(path.join(dir, V.jwks), 'utf8');

let servidor, jwksUrl;
before(async () => {
  servidor = http.createServer((_q, r) => { r.setHeader('content-type', 'application/json'); r.end(JWKS); });
  await new Promise((ok) => servidor.listen(0, '127.0.0.1', ok));
  jwksUrl = `http://127.0.0.1:${servidor.address().port}/.well-known/jwks.json`;
});
after(() => servidor.close());

// `query` simulado: una "tabla" users en memoria con el índice único lower(email).
function baseSimulada(inicial = []) {
  const users = new Map(inicial.map((u) => [u.email, { activo: true, es_admin_global: false, admin_espacio: false, ...u }]));
  const sql = [];
  const query = async (text, params) => {
    sql.push(text);
    if (/^\s*SELECT u\.id/.test(text)) {
      const u = users.get(params[0]);
      return { rows: u ? [{ id: u.id, activo: u.activo, es_admin_global: u.es_admin_global, admin_espacio: u.admin_espacio }] : [] };
    }
    if (/^\s*INSERT INTO users/.test(text)) {
      const [email, nombre, hash] = params;
      if (users.has(email)) return { rowCount: 0, rows: [] };
      users.set(email, { id: `n${users.size + 1}`, email, nombre, hash, activo: true, es_admin_global: false, admin_espacio: false });
      return { rowCount: 1, rows: [] };
    }
    throw new Error(`consulta inesperada: ${text}`);
  };
  return { users, query, sql };
}

const buscador = (db) => crearBuscarUsuarioPorCorreo({ query: db.query, hashClave: async () => '$argon2id$simulado' });

test('vectores oficiales a través del verificador con la búsqueda de la Wiki', async () => {
  const db = baseSimulada([{ id: 'u1', email: 'ana.perez@ecologia.test', admin_espacio: true }]);
  for (const [nombre, caso] of Object.entries(V.casos)) {
    if (nombre === 'jti_repetido') continue;
    const verificar = crearVerificador({
      issuer: V.iss, audience: V.aud_esperada, jwksUrl, ahora: () => V.ahora, cooldownJwks: 0,
      permitirMemoria: true, buscarUsuarioPorCorreo: buscador(db),
    });
    const r = await verificar(caso.token, { use: caso.use_esperado });
    if (caso.esperado === 'ok') {
      assert.equal(r.ok, true, `${nombre}: ${JSON.stringify(r)}`);
      assert.deepEqual(r.usuario, { id: 'u1', rol: 'admin', activo: true });
    } else {
      assert.deepEqual(r, { ok: false, motivo: caso.esperado }, nombre);
    }
  }
});

test('rol: admin global o admin_espacio => admin; sin filas en user_space_roles => lector', async () => {
  const db = baseSimulada([
    { id: 'g', email: 'g@x.test', es_admin_global: true },
    { id: 'e', email: 'e@x.test', admin_espacio: true },
    { id: 'l', email: 'l@x.test' },
  ]);
  const b = buscador(db);
  assert.equal((await b('g@x.test', { use: 'acceso' })).rol, 'admin');
  assert.equal((await b('e@x.test', { use: 'acceso' })).rol, 'admin');
  assert.equal((await b('l@x.test', { use: 'acceso' })).rol, 'lector');
  assert.equal((await b('L@X.test', { use: 'acceso' })).rol, 'lector', 'el correo se normaliza a minúsculas');
});

test('usuario inactivo => null, también en login (no se reactiva ni se duplica)', async () => {
  const db = baseSimulada([{ id: 'i', email: 'i@x.test', activo: false }]);
  const b = buscador(db);
  assert.equal(await b('i@x.test', { use: 'acceso' }), null);
  assert.equal(await b('i@x.test', { use: 'login', name: 'I' }), null);
  assert.equal(db.users.size, 1);
});

test('inexistente: use=acceso no crea nada; use=login crea un lector con la clave aleatoria hasheada', async () => {
  const db = baseSimulada();
  const b = buscador(db);
  assert.equal(await b('nuevo@x.test', { use: 'acceso', name: 'Nuevo' }), null);
  assert.equal(db.users.size, 0);
  assert.equal(await b('nuevo@x.test', {}), null, 'sin use tampoco crea');
  assert.equal(db.users.size, 0);
  const u = await b('Nuevo@X.test', { use: 'login', name: 'Nora Nueva' });
  assert.deepEqual(u, { id: 'n1', rol: 'lector', activo: true });
  assert.equal(db.users.get('nuevo@x.test').nombre, 'Nora Nueva');
  assert.equal(db.users.get('nuevo@x.test').hash, '$argon2id$simulado');
  // segunda vez: existe, no inserta de nuevo
  await b('nuevo@x.test', { use: 'login' });
  assert.equal(db.users.size, 1);
});

test('nombreParaAlta: claim limpio o parte local del correo', () => {
  assert.equal(nombreParaAlta('  Ana\u0000 Pérez ', 'a@x.test'), 'Ana  Pérez');
  assert.equal(nombreParaAlta(undefined, 'ana.perez@x.test'), 'ana.perez');
  assert.equal(nombreParaAlta('   ', 'ana@x.test'), 'ana');
  assert.equal(nombreParaAlta(123, 'ana@x.test'), 'ana');
  assert.equal(nombreParaAlta('x'.repeat(500), 'a@x.test').length, 200);
});

test('almacén de jti en Postgres: decide por rowCount de ON CONFLICT DO NOTHING y purga vencidos', async () => {
  const vistos = new Set();
  const llamadas = [];
  const query = async (text, params) => {
    llamadas.push(text);
    if (/^DELETE/.test(text)) return { rowCount: 0 };
    if (!/ON CONFLICT \(jti\) DO NOTHING/.test(text)) throw new Error('falta ON CONFLICT DO NOTHING');
    if (vistos.has(params[0])) return { rowCount: 0 };
    vistos.add(params[0]);
    assert.equal(params[1], 1000 + 120);
    return { rowCount: 1 };
  };
  const s = crearAlmacenJtiPostgres(query);
  assert.equal(await s.marcarUsado('a', 1000, 990), true);
  assert.equal(await s.marcarUsado('a', 1000, 991), false);
  assert.equal(await s.marcarUsado('b', 1000, 992), true);
  assert.equal(llamadas.filter((t) => /^DELETE/.test(t)).length, 1, 'purga acotada a una por minuto');
});
