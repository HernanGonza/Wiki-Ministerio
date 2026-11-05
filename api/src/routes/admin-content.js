// Secciones y páginas de un espacio. Requiere admin_espacio (o admin global).
import { Router } from 'express';
import { z } from 'zod';
import { query, tx } from '../db.js';
import { h, parse, notFound, badRequest, conflict } from '../http.js';
import { requireSpaceRole } from '../auth/access.js';
import { audit } from '../services/audit.js';
import { canReparent, indexSections } from '../services/tree.js';
import { slug, uuid, acceso, tituloT, md, optText } from '../schemas.js';

export const adminContent = Router({ mergeParams: true });
adminContent.use(['/sections', '/pages'], requireSpaceRole('admin_espacio', { noMinisterio: true }));

// ───────── Secciones ─────────
const sectionBody = z.object({
  slug,
  titulo: tituloT,
  descripcion: optText(2000),
  padre_id: uuid.nullable(),
  orden: z.number().int().min(-10000).max(10000),
  icono: z.string().trim().max(16).nullable(),
  acceso,
});

const loadIndex = async (spaceId) => {
  const r = await query('SELECT id, slug, titulo, padre_id, acceso FROM sections WHERE space_id = $1', [spaceId]);
  return indexSections(r.rows);
};

adminContent.post('/sections', h(async (req, res) => {
  const b = parse(sectionBody.partial({ descripcion: true, padre_id: true, orden: true, icono: true, acceso: true }), req.body);
  const idx = await loadIndex(req.space.id);
  if (b.padre_id && !idx.has(b.padre_id)) throw badRequest('La sección padre no existe en este espacio');
  if (!canReparent(idx, null, b.padre_id ?? null)) throw badRequest('Se admiten hasta tres niveles de secciones');
  const { rows } = await query(
    `INSERT INTO sections (space_id, slug, titulo, descripcion, padre_id, orden, icono, acceso)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [req.space.id, b.slug, b.titulo, b.descripcion ?? null, b.padre_id ?? null, b.orden ?? 0, b.icono ?? null, b.acceso ?? 'general'],
  );
  await audit(req, 'crear_seccion', 'seccion', rows[0].id, req.space.id);
  res.status(201).json(rows[0]);
}));

adminContent.patch('/sections/:id', h(async (req, res) => {
  const id = parse(uuid, req.params.id);
  const b = parse(sectionBody.partial(), req.body);
  const idx = await loadIndex(req.space.id);
  const cur = await query('SELECT * FROM sections WHERE id = $1 AND space_id = $2', [id, req.space.id]);
  if (!cur.rows[0]) throw notFound();
  const m = { ...cur.rows[0], ...b };
  if ('padre_id' in b) {
    if (b.padre_id && !idx.has(b.padre_id)) throw badRequest('La sección padre no existe en este espacio');
    if (!canReparent(idx, id, b.padre_id ?? null)) throw badRequest('Movimiento inválido: ciclo o más de tres niveles');
  }
  const { rows } = await query(
    `UPDATE sections SET slug=$3, titulo=$4, descripcion=$5, padre_id=$6, orden=$7, icono=$8, acceso=$9
      WHERE id=$1 AND space_id=$2 RETURNING *`,
    [id, req.space.id, m.slug, m.titulo, m.descripcion, m.padre_id, m.orden, m.icono, m.acceso],
  );
  await audit(req, 'editar_seccion', 'seccion', id, req.space.id);
  res.json(rows[0]);
}));

adminContent.delete('/sections/:id', h(async (req, res) => {
  const id = parse(uuid, req.params.id);
  const cur = await query('SELECT id FROM sections WHERE id = $1 AND space_id = $2', [id, req.space.id]);
  if (!cur.rows[0]) throw notFound();
  const kids = await query('SELECT 1 FROM sections WHERE padre_id = $1 LIMIT 1', [id]);
  if (kids.rows[0]) throw conflict('La sección tiene subsecciones. Moverlas o borrarlas antes.');
  await query('DELETE FROM sections WHERE id = $1', [id]); // borra sus páginas en cascada
  await audit(req, 'borrar_seccion', 'seccion', id, req.space.id);
  res.status(204).end();
}));

// ───────── Páginas ─────────
const pageFields = {
  slug,
  titulo: tituloT,
  contenido_md: md,
  acceso,
};
const createPage = z.object({
  section_id: uuid,
  slug,
  titulo: tituloT,
  contenido_md: md.default(''),
  acceso: acceso.default('general'),
});
const updatePage = z.object({
  version: z.number().int().min(1), // versión que el cliente tenía cargada
  slug: pageFields.slug.optional(),
  titulo: pageFields.titulo.optional(),
  contenido_md: pageFields.contenido_md.optional(),
  acceso: pageFields.acceso.optional(),
  section_id: uuid.optional(),
});

async function loadPage(spaceId, id) {
  const r = await query(
    `SELECT p.* FROM pages p JOIN sections s ON s.id = p.section_id WHERE p.id = $1 AND s.space_id = $2`,
    [id, spaceId],
  );
  return r.rows[0] ?? null;
}

adminContent.get('/pages/:id', h(async (req, res) => {
  const p = await loadPage(req.space.id, parse(uuid, req.params.id));
  if (!p) throw notFound();
  res.json(p);
}));

adminContent.post('/pages', h(async (req, res) => {
  const b = parse(createPage, req.body);
  const sec = await query('SELECT id FROM sections WHERE id = $1 AND space_id = $2', [b.section_id, req.space.id]);
  if (!sec.rows[0]) throw badRequest('La sección no existe en este espacio');
  const page = await tx(async (c) => {
    const { rows } = await c.query(
      `INSERT INTO pages (section_id, slug, titulo, contenido_md, acceso, version, updated_by)
       VALUES ($1,$2,$3,$4,$5,1,$6) RETURNING *`,
      [b.section_id, b.slug, b.titulo, b.contenido_md, b.acceso, req.user.id],
    );
    await c.query(
      `INSERT INTO page_versions (page_id, version, titulo, contenido_md, created_by) VALUES ($1,1,$2,$3,$4)`,
      [rows[0].id, b.titulo, b.contenido_md, req.user.id],
    );
    return rows[0];
  });
  await audit(req, 'crear_pagina', 'pagina', page.id, req.space.id);
  res.status(201).json(page);
}));

/** Guarda una página con control optimista; crea la fila de versión en la misma transacción. */
async function savePage(req, id, changes, baseVersion) {
  const cur = await loadPage(req.space.id, id);
  if (!cur) throw notFound();
  if (changes.section_id) {
    const sec = await query('SELECT id FROM sections WHERE id = $1 AND space_id = $2', [changes.section_id, req.space.id]);
    if (!sec.rows[0]) throw badRequest('La sección no existe en este espacio');
  }
  const m = { ...cur, ...changes };
  const updated = await tx(async (c) => {
    const { rows } = await c.query(
      `UPDATE pages SET slug=$3, titulo=$4, contenido_md=$5, acceso=$6, section_id=$7,
              version = version + 1, updated_at = now(), updated_by = $8
        WHERE id = $1 AND version = $2 RETURNING *`,
      [id, baseVersion, m.slug, m.titulo, m.contenido_md, m.acceso, m.section_id, req.user.id],
    );
    if (!rows[0]) return null;
    await c.query(
      `INSERT INTO page_versions (page_id, version, titulo, contenido_md, created_by) VALUES ($1,$2,$3,$4,$5)`,
      [id, rows[0].version, rows[0].titulo, rows[0].contenido_md, req.user.id],
    );
    return rows[0];
  });
  if (!updated) {
    const now = await loadPage(req.space.id, id);
    throw conflict('La página cambió desde que se cargó', { actual: now });
  }
  return updated;
}

adminContent.put('/pages/:id', h(async (req, res) => {
  const id = parse(uuid, req.params.id);
  const { version, ...changes } = parse(updatePage, req.body);
  const page = await savePage(req, id, changes, version);
  await audit(req, 'editar_pagina', 'pagina', id, req.space.id);
  res.json(page);
}));

adminContent.delete('/pages/:id', h(async (req, res) => {
  const id = parse(uuid, req.params.id);
  if (!(await loadPage(req.space.id, id))) throw notFound();
  await query('DELETE FROM pages WHERE id = $1', [id]);
  await audit(req, 'borrar_pagina', 'pagina', id, req.space.id);
  res.status(204).end();
}));

adminContent.get('/pages/:id/versions', h(async (req, res) => {
  const id = parse(uuid, req.params.id);
  if (!(await loadPage(req.space.id, id))) throw notFound();
  const { rows } = await query(
    `SELECT v.version, v.titulo, v.created_at, u.nombre AS autor
       FROM page_versions v LEFT JOIN users u ON u.id = v.created_by
      WHERE v.page_id = $1 ORDER BY v.version DESC`,
    [id],
  );
  res.json(rows);
}));

adminContent.get('/pages/:id/versions/:version', h(async (req, res) => {
  const id = parse(uuid, req.params.id);
  const ver = parse(z.coerce.number().int().min(1), req.params.version);
  if (!(await loadPage(req.space.id, id))) throw notFound();
  const { rows } = await query(
    'SELECT version, titulo, contenido_md, created_at FROM page_versions WHERE page_id = $1 AND version = $2',
    [id, ver],
  );
  if (!rows[0]) throw notFound();
  res.json(rows[0]);
}));

// Restaurar = guardar el contenido antiguo como una versión nueva.
adminContent.post('/pages/:id/restore', h(async (req, res) => {
  const id = parse(uuid, req.params.id);
  const b = parse(z.object({ version: z.number().int().min(1), version_base: z.number().int().min(1) }), req.body);
  if (!(await loadPage(req.space.id, id))) throw notFound();
  const old = await query('SELECT titulo, contenido_md FROM page_versions WHERE page_id = $1 AND version = $2', [id, b.version]);
  if (!old.rows[0]) throw notFound('Versión no encontrada');
  const page = await savePage(req, id, old.rows[0], b.version_base);
  await audit(req, 'editar_pagina', 'pagina', id, req.space.id);
  res.json(page);
}));
