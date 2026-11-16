import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db.js';
import { h, parse, notFound } from '../http.js';
import { resolveSpaceRead } from '../auth/access.js';

export const systemsRouter = Router();

/** Estado actual de los sistemas activos del espacio + los transversales. */
systemsRouter.get('/status', h(async (req, res) => {
  const { space } = await resolveSpaceRead(req.user, parse(z.string().trim().min(1).max(80), req.query.space));
  const where = space.slug === 'ministerio' ? 's.space_id IS NULL' : '(s.space_id = $1 OR s.space_id IS NULL)';
  const { rows } = await query(
    `SELECT s.id, s.nombre, s.slug, s.url, s.ip, s.puerto, s.vm, s.descripcion, s.orden,
            (s.space_id IS NULL) AS transversal,
            c.estado, c.latencia_ms, c.codigo_http, c.checked_at,
            u.checks_24h, u.online_24h
       FROM systems s
       LEFT JOIN LATERAL (
         SELECT estado, latencia_ms, codigo_http, checked_at
           FROM system_checks WHERE system_id = s.id ORDER BY checked_at DESC LIMIT 1
       ) c ON true
       LEFT JOIN LATERAL (
         SELECT count(*)::int AS checks_24h, count(*) FILTER (WHERE estado <> 'offline')::int AS online_24h
           FROM system_checks WHERE system_id = s.id AND checked_at > now() - interval '24 hours'
       ) u ON true
      WHERE s.activo AND ${where}
      ORDER BY (s.space_id IS NULL) DESC, s.orden, s.nombre`,
    space.slug === 'ministerio' ? [] : [space.id],
  );
  // Sin sesión no se exponen datos de infraestructura (IP, puerto, VM).
  res.json(req.user ? rows : rows.map(({ ip, puerto, vm, ...pub }) => pub));
}));

const historySchema = z.object({ horas: z.coerce.number().int().min(1).max(720).default(24) });

systemsRouter.get('/:id/history', h(async (req, res) => {
  const id = parse(z.string().uuid(), req.params.id);
  const { horas } = parse(historySchema, req.query);
  const sys = await query('SELECT s.id, sp.slug AS space_slug FROM systems s LEFT JOIN spaces sp ON sp.id = s.space_id WHERE s.id = $1', [id]);
  if (!sys.rows[0]) throw notFound();
  // Espacio inexistente o inactivo → 404. La lectura es pública.
  if (sys.rows[0].space_slug) await resolveSpaceRead(req.user, sys.rows[0].space_slug);
  const { rows } = await query(
    `SELECT checked_at, estado, latencia_ms, codigo_http
       FROM system_checks
      WHERE system_id = $1 AND checked_at > now() - $2 * interval '1 hour'
      ORDER BY checked_at ASC`,
    [id, horas],
  );
  res.json(rows);
}));
