// Lógica pura del árbol de secciones (testeable sin base de datos).

export const MAX_DEPTH = 3;

/** Indexa secciones por id y calcula `restringido_efectivo` (propio o heredado) y `depth`. */
export function indexSections(sections) {
  const byId = new Map(sections.map((s) => [s.id, { ...s }]));
  const resolve = (s, seen = new Set()) => {
    if (s.depth !== undefined) return s;
    if (seen.has(s.id)) throw new Error('Ciclo en el árbol de secciones');
    seen.add(s.id);
    const parent = s.padre_id ? byId.get(s.padre_id) : null;
    if (parent) resolve(parent, seen);
    s.depth = parent ? parent.depth + 1 : 1;
    s.restringido_efectivo = s.acceso === 'restringido' || Boolean(parent?.restringido_efectivo);
    return s;
  };
  for (const s of byId.values()) resolve(s);
  return byId;
}

/** Profundidad de la subárbol que cuelga de `id` (1 = solo la sección). */
export function subtreeHeight(byId, id) {
  let max = 1;
  for (const s of byId.values()) {
    if (s.padre_id === id) max = Math.max(max, 1 + subtreeHeight(byId, s.id));
  }
  return max;
}

/** ¿Se puede asignar `padreId` a `id` sin pasar de MAX_DEPTH ni crear ciclos? */
export function canReparent(byId, id, padreId) {
  if (!padreId) return true;
  if (padreId === id) return false;
  for (let p = byId.get(padreId); p; p = p.padre_id ? byId.get(p.padre_id) : null) {
    if (p.id === id) return false; // el padre es descendiente
  }
  const padre = byId.get(padreId);
  if (!padre) return false;
  const height = id ? subtreeHeight(byId, id) : 1;
  return padre.depth + height <= MAX_DEPTH;
}

/**
 * Árbol anidado ordenado. Si `verRestringido` es falso, se omiten las secciones
 * restringidas (y todo lo que cuelga de ellas) y sus páginas.
 */
export function buildTree(sections, pages, verRestringido) {
  const byId = indexSections(sections);
  const nodes = new Map();
  for (const s of byId.values()) {
    if (s.restringido_efectivo && !verRestringido) continue;
    nodes.set(s.id, {
      id: s.id,
      slug: s.slug,
      titulo: s.titulo,
      descripcion: s.descripcion,
      icono: s.icono,
      orden: s.orden,
      acceso: s.acceso,
      restringido: s.restringido_efectivo,
      padre_id: s.padre_id,
      pages: [],
      children: [],
    });
  }
  for (const p of pages) {
    const node = nodes.get(p.section_id);
    if (!node) continue;
    if (p.acceso === 'restringido' && !verRestringido) continue;
    node.pages.push({ id: p.id, slug: p.slug, titulo: p.titulo, restringido: p.acceso === 'restringido' || node.restringido });
  }
  const cmp = (a, b) => a.orden - b.orden || a.titulo.localeCompare(b.titulo, 'es');
  const roots = [];
  for (const n of nodes.values()) {
    const parent = n.padre_id ? nodes.get(n.padre_id) : null;
    (parent ? parent.children : roots).push(n);
  }
  const sortRec = (list) => {
    list.sort(cmp);
    list.forEach((n) => {
      n.pages.sort((a, b) => a.titulo.localeCompare(b.titulo, 'es'));
      sortRec(n.children);
    });
  };
  sortRec(roots);
  return roots;
}
