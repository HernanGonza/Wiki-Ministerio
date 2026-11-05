import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTree, canReparent, indexSections } from './tree.js';

const S = (id, slug, padre_id = null, acceso = 'general', orden = 0) => ({
  id, slug, titulo: slug, descripcion: null, icono: null, orden, acceso, padre_id,
});

test('restringido se hereda a los hijos y se oculta a usuarios generales', () => {
  const secs = [S('a', 'a'), S('b', 'b', null, 'restringido'), S('c', 'c', 'b')];
  const pages = [
    { id: 'p1', section_id: 'a', slug: 'indice', titulo: 'A', acceso: 'general' },
    { id: 'p2', section_id: 'c', slug: 'indice', titulo: 'C', acceso: 'general' },
    { id: 'p3', section_id: 'a', slug: 'x', titulo: 'X', acceso: 'restringido' },
  ];
  const general = buildTree(secs, pages, false);
  assert.deepEqual(general.map((n) => n.slug), ['a']);
  assert.deepEqual(general[0].pages.map((p) => p.slug), ['indice']);
  const admin = buildTree(secs, pages, true);
  assert.deepEqual(admin.map((n) => n.slug), ['a', 'b']);
  assert.equal(admin[1].children[0].restringido, true);
});

test('máximo tres niveles y sin ciclos', () => {
  const secs = [S('1', 'n1'), S('2', 'n2', '1'), S('3', 'n3', '2'), S('x', 'otro')];
  const idx = indexSections(secs);
  assert.equal(idx.get('3').depth, 3);
  assert.equal(canReparent(idx, null, '3'), false); // un cuarto nivel
  assert.equal(canReparent(idx, null, '2'), true);
  assert.equal(canReparent(idx, '1', '3'), false); // ciclo
  assert.equal(canReparent(idx, 'x', '2'), true);
  assert.equal(canReparent(idx, '1', 'x'), false); // n1→n2→n3 bajo x pasaría a 4 niveles
});
