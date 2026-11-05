import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db.js';
import { h, parse, forbidden, notFound } from '../http.js';

export const auditRouter = Router();

const q = z.object({
  space: z.string().trim().max(80).optional(),
  usuario: z.string().uuid().optional(),
  accion: z.string().trim().max(60).optional(),
  desde: z.coerce.date().optional(),
  hasta: z.coerce.date().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

/**
 * Admin global: todo. admin_espacio: solo eventos de los espacios que administra
 * (los eventos sin espacio quedan reservados al admin global).
 */
auditRouter.get('/', h(async (req, res) => {
  const f = parse(q, req.query);
  const where = [];
  const params = [];
  const add = (sql, v) => { params.push(v); where.push(sql.replace('?', `$${params.length}`)); };

  if (!req.user.es_admin_global) {
    const r = await query(
      `SELECT space_id FROM user_space_roles WHERE user_id = $1 AND rol = 'admin_espacio'`,
      [req.user.id],
    );
    if (!r.rows.length) throw forbidden();
    add('a.space_id = ANY(?::uuid[])', r.rows.map((x) => x.space_id));
  }
  if (f.space) {
    const sp = await query('SELECT id FROM spaces WHERE slug = $1', [f.space]);
    if (!sp.rows[0]) throw notFound();
    add('a.space_id = ?', sp.rows[0].id); // si no es admin del espacio, el filtro anterior ya lo deja vacío
  }
  if (f.usuario) add('a.user_id = ?', f.usuario);
  if (f.accion) add('a.accion = ?', f.accion);
  if (f.desde) add('a.created_at >= ?', f.desde);
  if (f.hasta) add('a.created_at <= ?', f.hasta);

  params.push(f.limit + 1, f.offset);
  const { rows } = await query(
    `SELECT a.id, a.created_at, a.accion, a.recurso, a.recurso_id, host(a.ip) AS ip,
            u.email AS usuario_email, u.nombre AS usuario_nombre, s.slug AS space_slug
       FROM audit_log a
       LEFT JOIN users u ON u.id = a.user_id
       LEFT JOIN spaces s ON s.id = a.space_id
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      ORDER BY a.created_at DESC, a.id DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );
  res.json({ items: rows.slice(0, f.limit), hay_mas: rows.length > f.limit });
}));
