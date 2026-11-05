#!/usr/bin/env node
// Pruebas de integración contra la Wiki MERNR en ejecución (paso 7 del plan).
// Solo usa Node >= 18 (fetch nativo) y la API pública: no toca la base directamente.
//
// Variables de entorno:
//   BASE_URL               p. ej. http://10.0.0.231:8090 (por defecto http://127.0.0.1:8090)
//   ADMIN_EMAIL            admin global
//   ADMIN_PASSWORD         contraseña actual del admin global
//   ADMIN_NEW_PASSWORD     solo si el admin aún debe cambiarla (>= 12 caracteres)
//   MONITOR_TEST_HOST      IP del equipo que corre este script, alcanzable desde el contenedor api
//                          (p. ej. 10.0.0.231). Si falta, se omite la prueba del monitor.
//
// Efectos: crea 3 usuarios de prueba (quedan DESACTIVADOS al final), anuncios/sistema/página de
// prueba (se borran) y deja la IP de origen bloqueada 15 min por la prueba de rate limit
// (reiniciar el contenedor api lo libera: `docker compose restart api`).
import http from 'node:http';

const BASE = (process.env.BASE_URL ?? 'http://127.0.0.1:8090').replace(/\/$/, '');
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const ADMIN_NEW_PASSWORD = process.env.ADMIN_NEW_PASSWORD;
const MONITOR_HOST = process.env.MONITOR_TEST_HOST;
const OT = 'ordenamiento-territorial';

if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.error('Faltan ADMIN_EMAIL y ADMIN_PASSWORD');
  process.exit(2);
}

let passed = 0;
let failed = 0;
function check(nombre, cond, detalle = '') {
  if (cond) { passed++; console.log(`  ✔ ${nombre}`); }
  else { failed++; console.log(`  ✘ ${nombre}${detalle ? ` — ${detalle}` : ''}`); }
}
const section = (t) => console.log(`\n${t}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class Client {
  constructor(nombre) { this.nombre = nombre; this.cookie = ''; this.lastSetCookie = ''; }
  async req(method, path, body) {
    const headers = {};
    if (method !== 'GET') headers['Content-Type'] = 'application/json';
    if (this.cookie) headers.Cookie = this.cookie;
    const res = await fetch(`${BASE}/api${path}`, {
      method, headers, body: method === 'GET' ? undefined : JSON.stringify(body ?? {}),
    });
    const sc = res.headers.get('set-cookie');
    if (sc) {
      this.lastSetCookie = sc;
      const pair = sc.split(';')[0];
      this.cookie = pair.endsWith('=') ? '' : pair;
    }
    let data = null;
    const text = await res.text();
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    return { status: res.status, data, headers: res.headers };
  }
  get(p) { return this.req('GET', p); }
  post(p, b) { return this.req('POST', p, b); }
  put(p, b) { return this.req('PUT', p, b); }
  patch(p, b) { return this.req('PATCH', p, b); }
  del(p) { return this.req('DELETE', p); }
}

const flat = (nodes) => nodes.flatMap((n) => [n, ...flat(n.children)]);

async function loginYCambiar(c, email, tempPassword, nuevaPassword) {
  const r = await c.post('/auth/login', { email, password: tempPassword });
  if (r.status !== 200) return r;
  if (r.data.must_change_password) {
    const bloqueado = await c.get('/spaces');
    check(`${c.nombre}: con cambio de clave pendiente la API bloquea el resto (403 must_change_password)`,
      bloqueado.status === 403 && bloqueado.data?.error === 'must_change_password', JSON.stringify(bloqueado.data));
    const ch = await c.post('/auth/change-password', { actual: tempPassword, nueva: nuevaPassword });
    check(`${c.nombre}: cambia la contraseña`, ch.status === 204, JSON.stringify(ch.data));
  }
  return r;
}

async function main() {
  const stamp = Date.now().toString(36);
  const admin = new Client('admin');
  const dir = new Client('director');
  const gen = new Client('general');
  const sin = new Client('sinrol');
  const anon = new Client('anónimo');

  section('1. Salud y sesión');
  const health = await anon.get('/health');
  check('GET /api/health = 200', health.status === 200);
  check('sin sesión, /api/spaces = 401', (await anon.get('/spaces')).status === 401);
  check('sin sesión, /api/admin/users = 401', (await anon.get('/admin/users')).status === 401);

  section('2. Login fallido y respuesta genérica');
  const f1 = await anon.post('/auth/login', { email: ADMIN_EMAIL, password: 'clave-incorrecta-xxxxx' });
  const f2 = await anon.post('/auth/login', { email: `no-existe-${stamp}@example.com`, password: 'clave-incorrecta-xxxxx' });
  check('contraseña incorrecta = 401', f1.status === 401);
  check('email inexistente = 401 con el mismo mensaje', f2.status === 401 && f1.data?.message === f2.data?.message, `${f1.data?.message} / ${f2.data?.message}`);

  section('3. Login OK, cookie y cambio de contraseña obligatorio');
  let r = await admin.post('/auth/login', { email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
  check('login del admin global = 200', r.status === 200, JSON.stringify(r.data));
  if (r.status !== 200) throw new Error('Sin login de admin no se puede seguir');
  const sc = admin.lastSetCookie.toLowerCase();
  check('cookie HttpOnly', sc.includes('httponly'));
  check('cookie SameSite=Lax', sc.includes('samesite=lax'));
  check('la respuesta no contiene el hash de la contraseña', !/password_hash|argon2/.test(JSON.stringify(r.data)));
  let adminPassword = ADMIN_PASSWORD;
  if (r.data.must_change_password) {
    check('con cambio pendiente, /api/spaces = 403 must_change_password', (await admin.get('/spaces')).data?.error === 'must_change_password');
    if (!ADMIN_NEW_PASSWORD) throw new Error('El admin debe cambiar la contraseña: definir ADMIN_NEW_PASSWORD');
    const ch = await admin.post('/auth/change-password', { actual: ADMIN_PASSWORD, nueva: ADMIN_NEW_PASSWORD });
    check('el admin cambia su contraseña', ch.status === 204, JSON.stringify(ch.data));
    adminPassword = ADMIN_NEW_PASSWORD;
  }
  const corta = await admin.post('/auth/change-password', { actual: adminPassword, nueva: 'corta' });
  check('contraseña nueva de menos de 12 caracteres = 400', corta.status === 400);
  const me = await admin.get('/auth/me');
  check('/api/auth/me indica admin global', me.data?.es_admin_global === true && me.data?.must_change_password === false);

  section('4. Estructura de OT y espacios');
  const spaces = await admin.get('/spaces');
  check('el admin ve ordenamiento-territorial y ministerio', spaces.data?.some((s) => s.slug === OT) && spaces.data?.some((s) => s.slug === 'ministerio'));
  const tree = await admin.get(`/spaces/${OT}/sections`);
  const nodes = flat(tree.data ?? []);
  check('OT tiene 27 secciones', nodes.length === 27, `hay ${nodes.length}`);
  check('9 secciones de nivel 1', tree.data?.length === 9);
  check('"accesos" es restringida', nodes.find((n) => n.slug === 'accesos')?.acceso === 'restringido');
  check('dg-alerta tiene 6 hijas', nodes.find((n) => n.slug === 'dg-alerta')?.children.length === 6);
  check('infraestructura tiene oracle-linux-server y haproxy-pfsense',
    ['oracle-linux-server', 'haproxy-pfsense'].every((s) => nodes.find((n) => n.slug === 'infraestructura')?.children.some((c) => c.slug === s)));
  check('23 páginas placeholder (una por hoja)', nodes.reduce((a, n) => a + n.pages.length, 0) === 23);
  const pg = await admin.get(`/spaces/${OT}/sections/procedimientos/pages/indice`);
  check('página placeholder legible con [PLACEHOLDER]', pg.status === 200 && pg.data?.contenido_md?.includes('[PLACEHOLDER]'));
  const ministerioSecc = await admin.get('/spaces/ministerio/sections');
  check('ministerio no tiene secciones (404)', ministerioSecc.status === 404);

  section('5. Alta de usuarios de prueba y roles por espacio');
  const tmp = `Temporal-${stamp}-Aa1!`;
  const pw = (n) => `Definitiva-${n}-${stamp}-Bb2!`;
  const mk = async (tag, extra = {}) => {
    const email = `${tag}-${stamp}@prueba.invalid`;
    const c = await admin.post('/admin/users', { email, nombre: `Prueba ${tag}`, password: tmp, ...extra });
    check(`crea usuario ${tag}`, c.status === 201, JSON.stringify(c.data));
    return { email, id: c.data?.id };
  };
  const uDir = await mk('director');
  const uGen = await mk('general');
  const uSin = await mk('sinrol');
  check('rol admin_espacio al director', (await admin.put(`/admin/users/${uDir.id}/roles/${OT}`, { rol: 'admin_espacio' })).status === 204);
  check('rol general al usuario general', (await admin.put(`/admin/users/${uGen.id}/roles/${OT}`, { rol: 'general' })).status === 204);
  check('no se asignan roles en ministerio', (await admin.put(`/admin/users/${uGen.id}/roles/ministerio`, { rol: 'general' })).status === 404);
  const usuarioCorto = await admin.post('/admin/users', { email: `corto-${stamp}@prueba.invalid`, nombre: 'x', password: 'corta' });
  check('crear usuario con clave corta = 400', usuarioCorto.status === 400);

  await loginYCambiar(dir, uDir.email, tmp, pw('dir'));
  await loginYCambiar(gen, uGen.email, tmp, pw('gen'));
  await loginYCambiar(sin, uSin.email, tmp, pw('sin'));

  section('6. Usuario general de OT: sin accesos ni credential_refs');
  const gTree = await gen.get(`/spaces/${OT}/sections`);
  const gNodes = flat(gTree.data ?? []);
  check('ve el espacio OT', gTree.status === 200 && gNodes.length > 0);
  check('el árbol NO incluye "accesos"', !gNodes.some((n) => n.slug === 'accesos'));
  check('API directa a la sección restringida: página = 404', (await gen.get(`/spaces/${OT}/sections/accesos/pages/indice`)).status === 404);
  const gCred = await gen.get(`/admin/spaces/${OT}/credential-refs`);
  check('listar credential_refs = 403', gCred.status === 403);
  check('crear credential_ref = 403', (await gen.post(`/admin/spaces/${OT}/credential-refs`, { titulo: 'x', vault_item_name: 'x' })).status === 403);
  check('crear página = 403', (await gen.post(`/admin/spaces/${OT}/pages`, { section_id: nodes[0].id, slug: 'x', titulo: 'x' })).status === 403);
  check('crear anuncio = 403', (await gen.post(`/admin/spaces/${OT}/announcements`, { titulo: 'x' })).status === 403);
  check('auditoría = 403', (await gen.get('/audit')).status === 403);
  check('gestión de usuarios = 403', (await gen.get('/admin/users')).status === 403);
  check('crear espacios = 403', (await gen.post('/admin/spaces', { slug: 'prueba', nombre: 'x' })).status === 403);

  section('7. Usuario sin rol en OT: 404 en todo el espacio');
  for (const p of [
    `/spaces/${OT}`, `/spaces/${OT}/sections`, `/spaces/${OT}/sections/procedimientos/pages/indice`,
    `/announcements?space=${OT}`, `/systems/status?space=${OT}`, `/admin/spaces/${OT}/credential-refs`,
    `/admin/spaces/${OT}/announcements`,
  ]) {
    const x = await sin.get(p);
    check(`GET ${p} = 404`, x.status === 404, `status ${x.status}`);
  }
  const sSpaces = await sin.get('/spaces');
  check('/api/spaces solo lista ministerio', sSpaces.data?.length === 1 && sSpaces.data[0].slug === 'ministerio');
  const exist = await sin.get(`/spaces/no-existe-${stamp}`);
  const noRol = await sin.get(`/spaces/${OT}`);
  check('mismo 404 y mensaje para espacio inexistente que para espacio sin rol', exist.status === 404 && noRol.status === 404 && exist.data?.message === noRol.data?.message);

  section('8. Anuncios: del espacio y transversal');
  const titDir = `Anuncio del director ${stamp}`;
  const titTrans = `Anuncio transversal ${stamp}`;
  const aDir = await dir.post(`/admin/spaces/${OT}/announcements`, { titulo: titDir, cuerpo_md: 'Hola **OT**', prioridad: 'alta', publicar: true });
  check('el director de OT crea un anuncio del espacio', aDir.status === 201, JSON.stringify(aDir.data));
  const trDir = await dir.post('/admin/spaces/ministerio/announcements', { titulo: 'no debería', cuerpo_md: 'x' });
  check('el director NO puede crear anuncios del Ministerio (403)', trDir.status === 403);
  const aTr = await admin.post('/admin/spaces/ministerio/announcements', { titulo: titTrans, cuerpo_md: 'Para todos', prioridad: 'media', publicar: true });
  check('el admin global crea un anuncio transversal', aTr.status === 201, JSON.stringify(aTr.data));
  const aBorr = await dir.post(`/admin/spaces/${OT}/announcements`, { titulo: `Borrador ${stamp}`, publicar: false });
  const gAnn = await gen.get(`/announcements?space=${OT}&limit=50`);
  const titulos = (gAnn.data ?? []).map((a) => a.titulo);
  check('el general ve el anuncio del director en OT', titulos.includes(titDir));
  check('el general ve el anuncio transversal en OT', titulos.includes(titTrans));
  check('el general NO ve borradores', !titulos.includes(`Borrador ${stamp}`));
  const sAnn = await sin.get('/announcements?space=ministerio&limit=50');
  const sTit = (sAnn.data ?? []).map((a) => a.titulo);
  check('el usuario sin rol ve el transversal en la portada del Ministerio', sTit.includes(titTrans));
  check('el usuario sin rol NO ve el anuncio de OT', !sTit.includes(titDir));
  check('el anuncio de bienvenida existe', sTit.some((t) => t.includes('Bienvenidos')));

  section('9. Credenciales (solo referencias) y auditoría');
  const cr = await dir.post(`/admin/spaces/${OT}/credential-refs`, { titulo: `Servidor ${stamp}`, usuario_referencia: 'root@srv-x', vault_item_name: `OT / srv-x / root`, vault_collection: 'OT' });
  check('el director crea una referencia', cr.status === 201, JSON.stringify(cr.data));
  const crList = await dir.get(`/admin/spaces/${OT}/credential-refs`);
  check('el director lista referencias', crList.status === 200 && crList.data.items.some((i) => i.titulo === `Servidor ${stamp}`));
  const crOne = await dir.get(`/admin/spaces/${OT}/credential-refs/${cr.data?.id}`);
  check('el director ve una referencia', crOne.status === 200);
  check('el admin global también', (await admin.get(`/admin/spaces/${OT}/credential-refs`)).status === 200);
  const aud = await dir.get(`/audit?space=${OT}&limit=200`);
  const acciones = new Set((aud.data?.items ?? []).map((i) => i.accion));
  check('auditoría del director incluye listar_credential_refs y ver_credential_ref', acciones.has('listar_credential_refs') && acciones.has('ver_credential_ref'), [...acciones].join(','));
  check('auditoría del director incluye crear_anuncio', acciones.has('crear_anuncio'));
  check('el director NO ve eventos sin espacio (login_ok)', !(aud.data?.items ?? []).some((i) => i.accion === 'login_ok'));
  const audAdmin = await admin.get('/audit?limit=200');
  const accAdmin = new Set((audAdmin.data?.items ?? []).map((i) => i.accion));
  check('el admin global ve login_ok y login_fallido', accAdmin.has('login_ok') && accAdmin.has('login_fallido'));
  check('el admin ve crear_usuario', accAdmin.has('crear_usuario'));
  const accRestr = await admin.get(`/spaces/${OT}/sections/accesos/pages/indice`);
  check('el admin global lee la página restringida', accRestr.status === 200 && accRestr.data?.acceso_efectivo === 'restringido');
  const dirRestr = await dir.get(`/spaces/${OT}/sections/accesos/pages/indice`);
  check('el director también', dirRestr.status === 200);
  const aud2 = await dir.get(`/audit?space=${OT}&accion=ver_pagina_restringida`);
  check('se audita ver_pagina_restringida', (aud2.data?.items ?? []).length > 0);

  section('10. Edición de páginas: versiones y conflicto (409)');
  const target = nodes.find((n) => n.slug === 'despacho');
  const pageId = target.pages[0].id;
  const p0 = await dir.get(`/admin/spaces/${OT}/pages/${pageId}`);
  check('el director carga la página para editar', p0.status === 200 && p0.data.version === 1);
  const p1 = await dir.put(`/admin/spaces/${OT}/pages/${pageId}`, { version: 1, contenido_md: `# Despacho\n\nVersión ${stamp}` });
  check('guardar con la versión correcta = 200 y versión 2', p1.status === 200 && p1.data.version === 2, JSON.stringify(p1.data));
  const p2 = await admin.put(`/admin/spaces/${OT}/pages/${pageId}`, { version: 1, contenido_md: 'pisando' });
  check('guardar con versión vieja = 409', p2.status === 409 && p2.data?.actual?.version === 2);
  const vers = await dir.get(`/admin/spaces/${OT}/pages/${pageId}/versions`);
  check('el historial tiene 2 versiones', vers.data?.length === 2);
  const rest = await dir.post(`/admin/spaces/${OT}/pages/${pageId}/restore`, { version: 1, version_base: 2 });
  check('restaurar la versión 1 crea la versión 3', rest.status === 200 && rest.data.version === 3 && rest.data.contenido_md.includes('[PLACEHOLDER]'));
  const gPage = await gen.get(`/spaces/${OT}/sections/despacho/pages/indice`);
  check('el general lee la página (puede_editar=false)', gPage.status === 200 && gPage.data.puede_editar === false);
  const nuevaSec = await dir.post(`/admin/spaces/${OT}/sections`, { slug: `prueba-${stamp}`, titulo: 'Prueba', padre_id: nodes.find((n) => n.slug === 'planificacion-urbana').id });
  check('no se admite un cuarto nivel de secciones (400)', nuevaSec.status === 400);

  section('11. Reglas de usuarios y espacios');
  check('el admin no puede desactivarse a sí mismo', (await admin.del(`/admin/users/${me.data.id}`)).status === 400);
  check('el espacio ministerio no se puede borrar', (await admin.del('/admin/spaces/ministerio')).status === 400);
  check('slug reservado "admin" rechazado', (await admin.post('/admin/spaces', { slug: 'admin', nombre: 'x' })).status === 400);
  check('petición sin Content-Type JSON rechazada (415)', await (async () => {
    const res = await fetch(`${BASE}/api/auth/logout`, { method: 'POST', headers: { Cookie: gen.cookie, 'Content-Type': 'text/plain' }, body: 'x' });
    return res.status === 415;
  })());

  if (MONITOR_HOST) {
    section('12. Monitor: el estado cambia al apagar un servicio de prueba');
    const srv = http.createServer((_q, s) => { s.statusCode = 200; s.end('ok'); });
    await new Promise((res) => srv.listen(0, '0.0.0.0', res));
    const port = srv.address().port;
    const sys = await admin.post(`/admin/spaces/${OT}/systems`, { nombre: `Prueba monitor ${stamp}`, slug: `prueba-monitor-${stamp}`, url: `http://${MONITOR_HOST}:${port}/`, vm: 'prueba' });
    check('crea el sistema de prueba', sys.status === 201, JSON.stringify(sys.data));
    const esperar = async (estado, maxMs) => {
      const hasta = Date.now() + maxMs;
      let ultimo = null;
      while (Date.now() < hasta) {
        const st = await admin.get(`/systems/status?space=${OT}`);
        ultimo = st.data?.find((s) => s.id === sys.data?.id);
        if (ultimo?.estado === estado && ultimo.checked_at && new Date(ultimo.checked_at).getTime() > esperar.desde) return ultimo;
        await sleep(5000);
      }
      return ultimo;
    };
    esperar.desde = Date.now() - 1000;
    const on = await esperar('online', 150_000);
    check('el sistema pasa a "online"', on?.estado === 'online', JSON.stringify(on));
    await new Promise((res) => srv.close(res));
    esperar.desde = Date.now();
    const off = await esperar('offline', 150_000);
    check('al apagar el servicio pasa a "offline"', off?.estado === 'offline', JSON.stringify(off));
    const hist = await admin.get(`/systems/${sys.data?.id}/history?horas=1`);
    check('el historial registra ambos estados', hist.data?.some((c) => c.estado === 'online') && hist.data?.some((c) => c.estado === 'offline'));
    const real = (await admin.get(`/systems/status?space=${OT}`)).data ?? [];
    check('la lista de sistemas incluye los 8 sistemas sembrados con estado real', real.filter((s) => s.estado).length >= 8, `${real.filter((s) => s.estado).length} con estado de ${real.length}`);
    await admin.del(`/admin/spaces/${OT}/systems/${sys.data?.id}`);
  } else {
    section('12. Monitor');
    console.log('  (omitido: definir MONITOR_TEST_HOST)');
  }

  section('Limpieza');
  for (const a of [aDir, aTr, aBorr]) {
    const base = a === aTr ? 'ministerio' : OT;
    if (a.data?.id) await admin.del(`/admin/spaces/${base}/announcements/${a.data.id}`);
  }
  if (cr.data?.id) await admin.del(`/admin/spaces/${OT}/credential-refs/${cr.data.id}`);
  for (const u of [uDir, uGen, uSin]) await admin.del(`/admin/users/${u.id}`);
  const tras = await gen.get('/spaces');
  check('usuario desactivado: su sesión deja de valer (401)', tras.status === 401);
  const out = await admin.post('/auth/logout', {});
  check('logout = 204', out.status === 204);
  check('después del logout la sesión no sirve (401)', (await admin.get('/spaces')).status === 401);

  section('13. Rate limit de login (5 fallos por IP / 15 min)');
  let primero429 = null;
  for (let i = 1; i <= 10; i++) {
    const x = await anon.post('/auth/login', { email: ADMIN_EMAIL, password: `incorrecta-${i}-xxxxxxxx` });
    if (x.status === 429) { primero429 = i; break; }
  }
  // Ya hubo 2 fallos en la sección 2 (cuentan para la misma IP): el 429 llega en el 4.º intento.
  check('aparece 429 tras acumular 5 intentos fallidos', primero429 !== null && primero429 <= 4, `primer 429 en el intento ${primero429}`);
  const tras429 = await anon.post('/auth/login', { email: ADMIN_EMAIL, password: adminPassword });
  check('bloqueada la IP, ni siquiera la clave correcta entra mientras dura el bloqueo', tras429.status === 429);

  console.log(`\nResultado: ${passed} correctas, ${failed} fallidas`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => { console.error('\nError no controlado:', e.message); process.exit(1); });
