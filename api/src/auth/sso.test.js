import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

// config.js lee el entorno al importarse: se define antes.
Object.assign(process.env, {
  POSTGRES_DB: 'x', POSTGRES_USER: 'x', POSTGRES_PASSWORD: 'x', APP_DB_USER: 'app', APP_DB_PASSWORD: 'x',
  SESSION_SECRET: 's'.repeat(40), PORTAL_JWT_SECRET: 'p'.repeat(40),
});
const { verificarJwtPortal } = await import('./sso.js');

const SECRET = 'p'.repeat(40);
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const firmar = (claims, { secret = SECRET, header = { alg: 'HS256', typ: 'JWT' } } = {}) => {
  const body = `${b64(header)}.${b64(claims)}`;
  return `${body}.${crypto.createHmac('sha256', secret).update(body).digest('base64url')}`;
};
const now = () => Math.floor(Date.now() / 1000);
let n = 0;
const ok = (extra = {}) => ({ iss: 'portal-mernr', aud: 'wiki', email: 'ana@misiones.gob.ar', iat: now(), exp: now() + 60, jti: `j${n++}`, ...extra });

test('acepta un token válido y devuelve el email', () => {
  assert.equal(verificarJwtPortal(firmar(ok())), 'ana@misiones.gob.ar');
});
test('rechaza firma incorrecta', () => {
  assert.throws(() => verificarJwtPortal(firmar(ok(), { secret: 'q'.repeat(40) })), { code: 'invalid_sso_token' });
});
test('rechaza alg distinto de HS256 (none, HS512)', () => {
  assert.throws(() => verificarJwtPortal(`${b64({ alg: 'none' })}.${b64(ok())}.`), { code: 'invalid_sso_token' });
  assert.throws(() => verificarJwtPortal(firmar(ok(), { header: { alg: 'HS512' } })), { code: 'invalid_sso_token' });
});
test('rechaza vencido, vida excesiva, iss/aud incorrectos y sin email', () => {
  for (const extra of [
    { iat: now() - 400, exp: now() - 300 },
    { exp: now() + 3600 },
    { iss: 'otro' },
    { aud: 'otro' },
    { email: undefined },
    { email: 'sin-arroba' },
    { exp: undefined },
  ]) {
    assert.throws(() => verificarJwtPortal(firmar(ok(extra))), { code: 'invalid_sso_token' }, JSON.stringify(extra));
  }
});
test('acepta aud como arreglo', () => {
  assert.equal(verificarJwtPortal(firmar(ok({ aud: ['x', 'wiki'] }))), 'ana@misiones.gob.ar');
});
test('un jti no se reutiliza', () => {
  const t = firmar(ok({ jti: 'unico' }));
  verificarJwtPortal(t);
  assert.throws(() => verificarJwtPortal(t), { code: 'invalid_sso_token' });
});
test('basura = invalid_sso_token', () => {
  for (const t of ['', 'a.b', 'a.b.c', 'x'.repeat(5000)]) assert.throws(() => verificarJwtPortal(t), { code: 'invalid_sso_token' });
});
