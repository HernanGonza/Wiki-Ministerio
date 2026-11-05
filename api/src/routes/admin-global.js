// Gestión de espacios y usuarios: solo admin global.
import { Router } from 'express';
import argon2 from 'argon2';
import { z } from 'zod';
import { config } from '../config.js';
import { query, tx } from '../db.js';
import { h, parse, notFound, badRequest, conflict } from '../http.js';
import { requireGlobalAdmin } from '../auth/middleware.js';
import { audit } from '../services/audit.js';
import { slug as slugS, rol as rolS, optText } from '../schemas.js';

export const adminGlobal = Router();
adminGlobal.use(requireGlobalAdmin);

const RESERVED = ['ministerio', 'login', 'admin', 'auditoria', 'cambiar-password', 'api'];

// ───────── Espacios ─────────
const spaceBase = {
  nombre: z.string().trim().min(1).max(120),
  subtitulo: optText(200),
  descripcion: optText(2000),
  orden: z.number().int().min(-10000).max(10000),
  activo: z.boolean(),
};
const createSpace = z.object({
  slug: slugS.refine((s) => !RESERVED.includes(s), 'Slug reservado'),
  ...spaceBase,
  orden: spaceBase.orden.default(0),
  activo: spaceBase.activo.default(true),
});
const patchSpace = z.object(spaceBase).partial();

adminGlobal.get('/spaces', h(async (_req, res) => {
  const { rows } = await query(
    `SELECT id, slug, nombre, subtitulo, descripcion, activo, orden, created_at FROM spaces ORDER BY orden, nombre`,
  );
  res.json(rows);
}));

adminGlobal.post('/spaces', h(async (req, res) => {
  const b = parse(createSpace, req.body);
  const { rows } = await query(
    `INSERT INTO spaces (slug, nombre, subtitulo, descripcion, orden, activo)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [b.slug, b.nombre, b.subtitulo ?? null, b.descripcion ?? null, b.orden, b.activo],
  );
  await audit(req, 'crear_espacio', 'espacio', rows[0].id, rows[0].id);
  res.status(201).json(rows[0]);
}));

adminGlobal.patch('/spaces/:slug', h(async (req, res) => {
  const b = parse(patchSpace, req.body);
  const cur = await query('SELECT * FROM spaces WHERE slug = $1', [req.params.slug]);
  if (!cur.rows[0]) throw notFound();
  if (cur.rows[0].slug === 'ministerio' && b.activo === false) throw badRequest('El espacio ministerio no se puede desactivar');
  const m = { ...cur.rows[0], ...b };
  const { rows } = await query(
    `UPDATE spaces SET nombre=$2, subtitulo=$3, descripcion=$4, orden=$5, activo=$6 WHERE id=$1 RETURNING *`,
    [m.id, m.nombre, m.subtitulo, m.descripcion, m.orden, m.activo],
  );
  await audit(req, 'editar_espacio', 'espacio', m.id, m.id);
  res.json(rows[0]);
}));

adminGlobal.delete('/spaces/:slug', h(async (req, res) => {
  const cur = await query('SELECT id, slug FROM spaces WHERE slug = $1', [req.params.slug]);
  const sp = cur.rows[0];
  if (!sp) throw notFound();
  if (sp.slug === 'ministerio') throw badRequest('El espacio ministerio no se puede borrar');
  const used = await query(
    `SELECT (SELECT count(*) FROM sections WHERE space_id=$1)
          + (SELECT count(*) FROM systems WHERE space_id=$1)
          + (SELECT count(*) FROM announcements WHERE space_id=$1)
          + (SELECT count(*) FROM credential_refs WHERE space_id=$1) AS n`,
    [sp.id],
  );
  if (Number(used.rows[0].n) > 0) {
    throw conflict('El espacio tiene contenido. Desactivarlo o vaciarlo antes de borrarlo.');
  }
  // audit_log referencia al espacio: se registra primero con space_id nulo.
  await audit(req, 'borrar_espacio', 'espacio', sp.slug, null);
  await query('DELETE FROM spaces WHERE id = $1', [sp.id]);
  res.status(204).end();
}));

// ───────── Usuarios ─────────
const password = z.string().min(config.passwordMinLength, `Mínimo ${config.passwordMinLength} caracteres`).max(1024);
const createUser = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  nombre: z.string().trim().min(1).max(120),
  password,
  es_admin_global: z.boolean().default(false),
});
const patchUser = z.object({
  nombre: z.string().trim().min(1).max(120),
  activo: z.boolean(),
  es_admin_global: z.boolean(),
  password,
}).partial();

adminGlobal.get('/users', h(async (_req, res) => {
  const { rows } = await query(
    `SELECT u.id, u.email, u.nombre, u.activo, u.es_admin_global, u.must_change_password, u.created_at, u.last_login_at,
            COALESCE(json_agg(json_build_object('slug', s.slug, 'nombre', s.nombre, 'rol', r.rol) ORDER BY s.nombre)
                     FILTER (WHERE s.id IS NOT NULL), '[]') AS roles
       FROM users u
       LEFT JOIN user_space_roles r ON r.user_id = u.id
       LEFT JOIN spaces s ON s.id = r.space_id
      GROUP BY u.id ORDER BY u.nombre`,
  );
  res.json(rows);
}));

adminGlobal.post('/users', h(async (req, res) => {
  const b = parse(createUser, req.body);
  const hash = await argon2.hash(b.password, { type: argon2.argon2id });
  const { rows } = await query(
    `INSERT INTO users (email, nombre, password_hash, must_change_password, es_admin_global)
     VALUES ($1,$2,$3,true,$4) RETURNING id, email, nombre, activo, es_admin_global, must_change_password`,
    [b.email, b.nombre, hash, b.es_admin_global],
  );
  await audit(req, 'crear_usuario', 'usuario', rows[0].id);
  res.status(201).json(rows[0]);
}));

async function assertAnotherAdmin(excludeId) {
  const r = await query(
    'SELECT count(*)::int AS n FROM users WHERE es_admin_global AND activo AND id <> $1',
    [excludeId],
  );
  if (r.rows[0].n === 0) throw badRequest('Debe quedar al menos un administrador global activo');
}

adminGlobal.patch('/users/:id', h(async (req, res) => {
  const id = parse(z.string().uuid(), req.params.id);
  const b = parse(patchUser, req.body);
  const cur = await query('SELECT * FROM users WHERE id = $1', [id]);
  const u = cur.rows[0];
  if (!u) throw notFound();
  const pierdeAdmin = (b.es_admin_global === false && u.es_admin_global) || (b.activo === false && u.activo && u.es_admin_global);
  if (pierdeAdmin) {
    if (id === req.user.id) throw badRequest('No se puede quitar el acceso de administración a uno mismo');
    await assertAnotherAdmin(id);
  }
  if (b.activo === false && id === req.user.id) throw badRequest('No se puede desactivar el propio usuario');

  await tx(async (c) => {
    await c.query(
      `UPDATE users SET nombre=$2, activo=$3, es_admin_global=$4 WHERE id=$1`,
      [id, b.nombre ?? u.nombre, b.activo ?? u.activo, b.es_admin_global ?? u.es_admin_global],
    );
    if (b.password) {
      const hash = await argon2.hash(b.password, { type: argon2.argon2id });
      await c.query('UPDATE users SET password_hash=$2, must_change_password=true WHERE id=$1', [id, hash]);
    }
    if (b.password || b.activo === false) await c.query('DELETE FROM sessions WHERE user_id = $1', [id]);
  });
  await audit(req, 'editar_usuario', 'usuario', id);
  res.status(204).end();
}));

// "Borrar" = desactivar.
adminGlobal.delete('/users/:id', h(async (req, res) => {
  const id = parse(z.string().uuid(), req.params.id);
  if (id === req.user.id) throw badRequest('No se puede desactivar el propio usuario');
  const cur = await query('SELECT es_admin_global, activo FROM users WHERE id = $1', [id]);
  if (!cur.rows[0]) throw notFound();
  if (cur.rows[0].es_admin_global && cur.rows[0].activo) await assertAnotherAdmin(id);
  await query('UPDATE users SET activo = false WHERE id = $1', [id]);
  await query('DELETE FROM sessions WHERE user_id = $1', [id]);
  await audit(req, 'borrar_usuario', 'usuario', id);
  res.status(204).end();
}));

adminGlobal.put('/users/:id/roles/:slug', h(async (req, res) => {
  const id = parse(z.string().uuid(), req.params.id);
  const { rol } = parse(z.object({ rol: rolS }), req.body);
  const sp = await query(`SELECT id FROM spaces WHERE slug = $1 AND slug <> 'ministerio'`, [req.params.slug]);
  if (!sp.rows[0]) throw notFound('Espacio no encontrado');
  const us = await query('SELECT 1 FROM users WHERE id = $1', [id]);
  if (!us.rows[0]) throw notFound('Usuario no encontrado');
  await query(
    `INSERT INTO user_space_roles (user_id, space_id, rol) VALUES ($1,$2,$3)
     ON CONFLICT (user_id, space_id) DO UPDATE SET rol = EXCLUDED.rol`,
    [id, sp.rows[0].id, rol],
  );
  await audit(req, 'asignar_rol', 'usuario', id, sp.rows[0].id);
  res.status(204).end();
}));

adminGlobal.delete('/users/:id/roles/:slug', h(async (req, res) => {
  const id = parse(z.string().uuid(), req.params.id);
  const sp = await query('SELECT id FROM spaces WHERE slug = $1', [req.params.slug]);
  if (!sp.rows[0]) throw notFound('Espacio no encontrado');
  await query('DELETE FROM user_space_roles WHERE user_id = $1 AND space_id = $2', [id, sp.rows[0].id]);
  await audit(req, 'quitar_rol', 'usuario', id, sp.rows[0].id);
  res.status(204).end();
}));
