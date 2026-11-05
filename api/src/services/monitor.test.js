import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';

// monitor.js importa db.js → config.js, que exige variables de entorno (valores ficticios de prueba).
Object.assign(process.env, {
  POSTGRES_DB: 'x', POSTGRES_USER: 'owner', POSTGRES_PASSWORD: 'x',
  APP_DB_USER: 'app', APP_DB_PASSWORD: 'x', SESSION_SECRET: 'x'.repeat(32),
});
const { classify, checkHttp, checkTcp } = await import('./monitor.js');
test('classify', () => {
  assert.equal(classify({ status: 200, latencyMs: 120 }), 'online');
  assert.equal(classify({ status: 401, latencyMs: 300 }), 'online');
  assert.equal(classify({ status: 403, latencyMs: 300 }), 'online');
  assert.equal(classify({ status: 302, latencyMs: 300 }), 'online');
  assert.equal(classify({ status: 200, latencyMs: 2500 }), 'lento');
  assert.equal(classify({ status: 200, latencyMs: 5000 }), 'offline');
  assert.equal(classify({ status: 503, latencyMs: 10 }), 'offline');
  assert.equal(classify({ error: true }), 'offline');
});

test('checkHttp / checkTcp contra un servidor local: online y luego offline al apagarlo', async () => {
  const server = http.createServer((req, res) => {
    res.statusCode = req.method === 'HEAD' ? 405 : 200;
    res.end('ok');
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const { port } = server.address();
  const a = await checkHttp(`http://127.0.0.1:${port}/`);
  assert.equal(a.estado, 'online');
  assert.equal(a.codigo_http, 200); // HEAD→405 reintenta con GET
  assert.equal((await checkTcp('127.0.0.1', port)).estado, 'online');
  await new Promise((r) => server.close(r));
  assert.equal((await checkHttp(`http://127.0.0.1:${port}/`)).estado, 'offline');
  assert.equal((await checkTcp('127.0.0.1', port)).estado, 'offline');
});
