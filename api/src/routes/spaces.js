import { Router } from 'express';
import { query } from '../db.js';
import { h, notFound } from '../http.js';
import { resolveSpace, hasRole } from '../auth/access.js';
import { buildTree, indexSections } from '../services/tree.js';
import { audit } from '../services/audit.js';
import { collectFileIds } from '../services/blocks.js';
import { metaArchivos } from '../services/files.js';

export const spacesRouter = Router();

/** Espacios visibles para el usuario (más `ministerio`). */
spacesRouter.get('/', h(async (req, res) => {
  const u = req.user;
  const sql = u.es_admin_global
    ? `SELECT s.id, s.slug, s.nombre, s.subtitulo, s.descripcion, s.orden,
              CASE WHEN s.slug = 'ministerio' THEN 'general' ELSE 'admin_global' END AS rol
         FROM spaces s WHERE s.activo ORDER BY s.orden, s.nombre`
    : `SELECT s.id, s.slug, s.nombre, s.subtitulo, s.descripcion, s.orden,
              COALESCE(r.rol::text, 'general') AS rol
         FROM spaces s
         LEFT JOIN user_space_roles r ON r.space_id = s.id AND r.user_id = $1
        WHERE s.activo AND (s.slug = 'ministerio' OR r.user_id IS NOT NULL)
        ORDER BY s.orden, s.nombre`;
  const { rows } = await query(sql, u.es_admin_global ? [] : [u.id]);
  res.json(rows);
}));

spacesRouter.get('/:slug', h(async (req, res) => {
  const { space, rol } = await resolveSpace(req.user, req.params.slug);
  res.json({ ...space, rol });
}));

/** Árbol de secciones (con sus páginas). Las restringidas solo las ve admin_espacio o superior. */
spacesRouter.get('/:slug/sections', h(async (req, res) => {
  const { space, rol } = await resolveSpace(req.user, req.params.slug);
  if (space.slug === 'ministerio') throw notFound('Espacio no encontrado');
  const [secs, pages] = await Promise.all([
    query('SELECT id, slug, titulo, descripcion, padre_id, orden, icono, acceso FROM sections WHERE space_id = $1', [space.id]),
    query(
      `SELECT p.id, p.section_id, p.slug, p.titulo, p.acceso
         FROM pages p JOIN sections s ON s.id = p.section_id WHERE s.space_id = $1`,
      [space.id],
    ),
  ]);
  res.json(buildTree(secs.rows, pages.rows, hasRole(rol, 'admin_espacio')));
}));

spacesRouter.get('/:slug/sections/:seccion/pages/:pagina', h(async (req, res) => {
  const { space, rol } = await resolveSpace(req.user, req.params.slug);
  if (space.slug === 'ministerio') throw notFound();
  const secs = await query(
    'SELECT id, slug, titulo, descripcion, padre_id, orden, icono, acceso FROM sections WHERE space_id = $1',
    [space.id],
  );
  const byId = indexSections(secs.rows);
  const section = [...byId.values()].find((s) => s.slug === req.params.seccion);
  if (!section) throw notFound();

  const pg = await query(
    `SELECT p.id, p.slug, p.titulo, p.contenido_md, p.contenido_json, p.acceso, p.version, p.updated_at, u.nombre AS updated_by_nombre
       FROM pages p LEFT JOIN users u ON u.id = p.updated_by
      WHERE p.section_id = $1 AND p.slug = $2`,
    [section.id, req.params.pagina],
  );
  const page = pg.rows[0];
  if (!page) throw notFound();

  const restringida = section.restringido_efectivo || page.acceso === 'restringido';
  // Para quien no puede verla, una página restringida "no existe".
  if (restringida && !hasRole(rol, 'admin_espacio')) throw notFound();
  if (restringida) await audit(req, 'ver_pagina_restringida', 'pagina', page.id, space.id);

  const archivos = page.contenido_json ? await metaArchivos(collectFileIds(page.contenido_json)) : {};
  res.json({
    ...page,
    archivos,
    acceso_efectivo: restringida ? 'restringido' : 'general',
    section: { id: section.id, slug: section.slug, titulo: section.titulo },
    puede_editar: hasRole(rol, 'admin_espacio'),
  });
}));
