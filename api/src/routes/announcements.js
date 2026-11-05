import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db.js';
import { h, parse } from '../http.js';
import { resolveSpace } from '../auth/access.js';

export const announcementsRouter = Router();

const querySchema = z.object({
  space: z.string().trim().min(1).max(80),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  offset: z.coerce.number().int().min(0).default(0),
});

/**
 * Anuncios publicados y visibles. Para un espacio incluye también los
 * transversales del Ministerio (`transversal: true`).
 */
announcementsRouter.get('/', h(async (req, res) => {
  const q = parse(querySchema, req.query);
  const { space } = await resolveSpace(req.user, q.space);
  const where = space.slug === 'ministerio' ? 'a.space_id IS NULL' : '(a.space_id = $3 OR a.space_id IS NULL)';
  const params = space.slug === 'ministerio' ? [q.limit, q.offset] : [q.limit, q.offset, space.id];
  const { rows } = await query(
    `SELECT a.id, a.titulo, a.cuerpo_md, a.prioridad, a.publicado_at, a.created_at,
            (a.space_id IS NULL) AS transversal, u.nombre AS autor
       FROM announcements a LEFT JOIN users u ON u.id = a.autor_id
      WHERE a.visible AND a.publicado_at IS NOT NULL AND a.publicado_at <= now() AND ${where}
      ORDER BY CASE a.prioridad WHEN 'alta' THEN 0 WHEN 'media' THEN 1 ELSE 2 END, a.publicado_at DESC
      LIMIT $1 OFFSET $2`,
    params,
  );
  res.json(rows);
}));
