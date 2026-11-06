import { test } from 'node:test';
import assert from 'node:assert/strict';
import { limpiarNombre, validarArchivo } from './file-types.js';

const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const jpg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0]);
const pdf = Buffer.from('%PDF-1.7\n...');
const zip = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0, 0]);

test('acepta archivos cuyo contenido coincide con la extensión', () => {
  assert.equal(validarArchivo('a.png', png).mime, 'image/png');
  assert.equal(validarArchivo('a.JPG', jpg).mime, 'image/jpeg');
  assert.equal(validarArchivo('a.pdf', pdf).mime, 'application/pdf');
  assert.equal(validarArchivo('a.docx', zip).imagen, false);
  assert.equal(validarArchivo('datos.csv', Buffer.from('a,b\n1,2\n')).mime, 'text/csv; charset=utf-8');
});

test('rechaza extensión y contenido que no coinciden (p. ej. un ejecutable renombrado)', () => {
  assert.throws(() => validarArchivo('virus.png', Buffer.from('MZ\x90\x00 exe')), /no coincide/);
  assert.throws(() => validarArchivo('x.pdf', png), /no coincide/);
  assert.throws(() => validarArchivo('x.txt', Buffer.from([0x68, 0x00, 0x69])), /no coincide/);
});

test('rechaza tipos no permitidos (svg, html, js, exe, sin extensión)', () => {
  for (const n of ['a.svg', 'a.html', 'a.js', 'a.exe', 'a.php', 'a.sh', 'a', 'a.png.exe']) {
    assert.throws(() => validarArchivo(n, png), /no permitido/, n);
  }
});

test('rechaza vacío y excesivo', () => {
  assert.throws(() => validarArchivo('a.png', Buffer.alloc(0)), /vacío/);
  assert.throws(() => validarArchivo('a.png', Buffer.concat([png, Buffer.alloc(11 * 1024 * 1024)])), /máximo/);
});

test('limpia nombres de archivo', () => {
  assert.equal(limpiarNombre('../../etc/passwd'), 'passwd');
  assert.equal(limpiarNombre('C:\\x\\informe 2024.pdf'), 'informe 2024.pdf');
  assert.equal(limpiarNombre('a"<b>.png'), 'ab.png');
  assert.equal(limpiarNombre(''), 'archivo');
});
