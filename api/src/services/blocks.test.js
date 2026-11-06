import { test } from 'node:test';
import assert from 'node:assert/strict';
import { blocksSchema, blocksToMarkdown, collectFileIds } from './blocks.js';

const F = '123e4567-e89b-42d3-a456-426614174000';
const ok = (b) => blocksSchema.safeParse(b);

test('acepta bloques válidos de todos los tipos', () => {
  const r = ok([
    { id: 'a', type: 'paragraph', runs: [{ t: 'Hola ' }, { t: 'mundo', b: true, i: true }] },
    { id: 'b', type: 'heading', level: 2, runs: [{ t: 'Título' }] },
    { id: 'c', type: 'list', ordered: true, items: [[{ t: 'uno' }], [{ t: 'dos', u: 'https://misiones.gob.ar' }]] },
    { id: 'd', type: 'callout', tone: 'warn', runs: [{ t: 'ojo' }] },
    { id: 'e', type: 'quote', runs: [{ t: 'cita' }] },
    { id: 'f', type: 'code', text: 'ls -la' },
    { id: 'g', type: 'divider' },
    { id: 'h', type: 'image', fileId: F, alt: 'x', caption: '' },
    { id: 'i', type: 'file', fileId: F, label: 'Manual' },
    { id: 'j', type: 'table', header: true, rows: [['a', 'b'], ['1', '2']] },
  ]);
  assert.equal(r.success, true, JSON.stringify(r.error?.issues));
});

test('rechaza enlaces peligrosos', () => {
  for (const u of ['javascript:alert(1)', 'data:text/html,<script>', 'vbscript:x', '//evil.com', ' JaVaScRiPt:alert(1)']) {
    assert.equal(ok([{ id: 'a', type: 'paragraph', runs: [{ t: 'x', u }] }]).success, false, u);
  }
  for (const u of ['https://a.b', 'http://a.b/c?d=1', 'mailto:a@b.c', '/misiones/s/x', '#ancla']) {
    assert.equal(ok([{ id: 'a', type: 'paragraph', runs: [{ t: 'x', u }] }]).success, true, u);
  }
});

test('rechaza campos extra, tipos desconocidos y html', () => {
  assert.equal(ok([{ id: 'a', type: 'paragraph', runs: [], html: '<b>x</b>' }]).success, false);
  assert.equal(ok([{ id: 'a', type: 'script', runs: [] }]).success, false);
  assert.equal(ok([{ id: 'a', type: 'paragraph', runs: [{ t: 'x', style: 'color:red' }] }]).success, false);
  assert.equal(ok([{ id: 'a', type: 'image', fileId: 'no-es-uuid', alt: '', caption: '' }]).success, false);
  assert.equal(ok([{ id: 'a', type: 'heading', level: 1, runs: [] }]).success, false);
});

test('derivación a Markdown', () => {
  const md = blocksToMarkdown([
    { id: 'a', type: 'heading', level: 2, runs: [{ t: 'Intro' }] },
    { id: 'b', type: 'paragraph', runs: [{ t: 'Texto ' }, { t: 'fuerte', b: true }, { t: ' y ' }, { t: 'link', u: 'https://x.y' }] },
    { id: 'c', type: 'list', ordered: false, items: [[{ t: 'a' }], [{ t: 'b' }]] },
    { id: 'd', type: 'file', fileId: F, label: 'Manual' },
  ]);
  assert.equal(md, `## Intro\n\nTexto **fuerte** y [link](https://x.y)\n\n- a\n- b\n\n[Manual](/api/files/${F})`);
});

test('collectFileIds junta imágenes y archivos sin repetir', () => {
  const ids = collectFileIds([
    { id: 'a', type: 'image', fileId: F, alt: '', caption: '' },
    { id: 'b', type: 'file', fileId: F, label: '' },
    { id: 'c', type: 'divider' },
  ]);
  assert.deepEqual(ids, [F]);
});

test('organigrama: acepta árbol anidado, rechaza enlaces peligrosos y exceso de niveles', async () => {
  const { blocksSchema, blocksToMarkdown } = await import('./blocks.js');
  const nodo = (t, hijos = [], extra = {}) => ({ id: t, t, hijos, ...extra });
  const ok = [{ id: 'o', type: 'orgchart', nodos: [nodo('A', [nodo('B', [nodo('C')], { vertical: true })], { estilo: 'destacado' })] }];
  assert.equal(blocksSchema.safeParse(ok).success, true);
  assert.match(blocksToMarkdown(ok), /- A\n {2}- B\n {4}- C/);
  const mal = [{ id: 'o', type: 'orgchart', nodos: [nodo('A', [], { href: 'javascript:alert(1)' })] }];
  assert.equal(blocksSchema.safeParse(mal).success, false);
  let hondo = nodo('x');
  for (let i = 0; i < 9; i++) hondo = nodo('n' + i, [hondo]);
  assert.equal(blocksSchema.safeParse([{ id: 'o', type: 'orgchart', nodos: [hondo] }]).success, false);
});
