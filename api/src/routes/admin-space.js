// Anuncios, sistemas y referencias a credenciales de un espacio.
// Para `ministerio` los anuncios y sistemas son transversales (space_id NULL)
// y solo los gestiona el admin global (lo garantiza requireSpaceRole).
import { Router } from 'express';
import { z } from 'zod';
import { config } from '../config.js';
import { query } from '../db.js';
import { h, parse, notFound, badRequest } from '../http.js';
import { requireSpaceRole } from '../auth/access.js';
import { audit } from '../services/audit.js';
import { slug, uuid, prioridad, tituloT, md, optText, urlHttp, ipSchema, acceso } from '../schemas.js';

export const adminSpace = Router({ mergeParams: true });
adminSpace.use(['/announcements', '/systems', '/credential-refs'], requireSpaceRole('admin_espacio'));

// `ministerio` → NULL; otros → id del espacio. Para filtrar con IS NOT DISTINCT FROM.
const scopeId = (req) => (req.space.slug === 'ministerio' ? null : req.space.id);

// ───────── Anuncios ─────────
const annBody = z.object({
  titulo: tituloT,
  cuerpo_md: md,
  prioridad,
  visible: z.boolean(),
  publicar: z.boolean(), // true: publica ahora si aún no estaba publicado; false: vuelve a borrador
});

adminSpace.get('/announcements', h(async (req, res) => {
  const { rows } = await query(
    `SELECT a.id, a.titulo, a.cuerpo_md, a.prioridad, a.publicado_at, a.visible, a.created_at, a.updated_at,
            u.nombre AS autor
       FROM announcements a LEFT JOIN users u ON u.id = a.autor_id
      WHERE a.space_id IS NOT DISTINCT FROM $1
      ORDER BY a.created_at DESC`,
    [scopeId(req)],
  );
  res.json(rows);
}));

adminSpace.post('/announcements', h(async (req, res) => {
  const b = parse(annBody.partial({ cuerpo_md: true, prioridad: true, visible: true, publicar: true }), req.body);
  const { rows } = await query(
    `INSERT INTO announcements (space_id, titulo, cuerpo_md, prioridad, publicado_at, visible, autor_id)
     VALUES ($1,$2,$3,$4, CASE WHEN $5 THEN now() END, $6, $7) RETURNING *`,
    [scopeId(req), b.titulo, b.cuerpo_md ?? '', b.prioridad ?? 'media', b.publicar ?? true, b.visible ?? true, req.user.id],
  );
  await audit(req, 'crear_anuncio', 'anuncio', rows[0].id, scopeId(req));
  res.status(201).json(rows[0]);
}));

adminSpace.patch('/announcements/:id', h(async (req, res) => {
  const id = parse(uuid, req.params.id);
  const b = parse(annBody.partial(), req.body);
  const cur = await query('SELECT * FROM announcements WHERE id = $1 AND space_id IS NOT DISTINCT FROM $2', [id, scopeId(req)]);
  if (!cur.rows[0]) throw notFound();
  const m = { ...cur.rows[0], ...b };
  const publicadoAt = b.publicar === undefined ? m.publicado_at : b.publicar ? (m.publicado_at ?? new Date()) : null;
  const { rows } = await query(
    `UPDATE announcements SET titulo=$2, cuerpo_md=$3, prioridad=$4, visible=$5, publicado_at=$6, updated_at=now()
      WHERE id=$1 RETURNING *`,
    [id, m.titulo, m.cuerpo_md, m.prioridad, m.visible, publicadoAt],
  );
  await audit(req, 'editar_anuncio', 'anuncio', id, scopeId(req));
  res.json(rows[0]);
}));

adminSpace.delete('/announcements/:id', h(async (req, res) => {
  const id = parse(uuid, req.params.id);
  const r = await query('DELETE FROM announcements WHERE id = $1 AND space_id IS NOT DISTINCT FROM $2', [id, scopeId(req)]);
  if (!r.rowCount) throw notFound();
  await audit(req, 'borrar_anuncio', 'anuncio', id, scopeId(req));
  res.status(204).end();
}));

// ───────── Sistemas ─────────
const sysBody = z.object({
  nombre: z.string().trim().min(1).max(120),
  slug,
  url: urlHttp.nullable(),
  ip: ipSchema.nullable(),
  puerto: z.number().int().min(1).max(65535).nullable(),
  vm: optText(120),
  descripcion: optText(2000),
  orden: z.number().int().min(-10000).max(10000),
  activo: z.boolean(),
});
const hasTarget = (s) => Boolean(s.url) || Boolean(s.ip && s.puerto);

adminSpace.get('/systems', h(async (req, res) => {
  const { rows } = await query(
    `SELECT id, nombre, slug, url, host(ip) AS ip, puerto, vm, descripcion, orden, activo
       FROM systems WHERE space_id IS NOT DISTINCT FROM $1 ORDER BY orden, nombre`,
    [scopeId(req)],
  );
  res.json(rows);
}));

adminSpace.post('/systems', h(async (req, res) => {
  const b = parse(sysBody.partial({ url: true, ip: true, puerto: true, vm: true, descripcion: true, orden: true, activo: true }), req.body);
  if (!hasTarget(b)) throw badRequest('Indicar una URL o una IP con puerto para el monitor');
  const { rows } = await query(
    `INSERT INTO systems (space_id, nombre, slug, url, ip, puerto, vm, descripcion, orden, activo)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
    [scopeId(req), b.nombre, b.slug, b.url ?? null, b.ip ?? null, b.puerto ?? null, b.vm ?? null, b.descripcion ?? null, b.orden ?? 0, b.activo ?? true],
  );
  await audit(req, 'crear_sistema', 'sistema', rows[0].id, scopeId(req));
  res.status(201).json(rows[0]);
}));

adminSpace.patch('/systems/:id', h(async (req, res) => {
  const id = parse(uuid, req.params.id);
  const b = parse(sysBody.partial(), req.body);
  const cur = await query(
    `SELECT id, nombre, slug, url, host(ip) AS ip, puerto, vm, descripcion, orden, activo
       FROM systems WHERE id = $1 AND space_id IS NOT DISTINCT FROM $2`,
    [id, scopeId(req)],
  );
  if (!cur.rows[0]) throw notFound();
  const m = { ...cur.rows[0], ...b };
  if (!hasTarget(m)) throw badRequest('Indicar una URL o una IP con puerto para el monitor');
  await query(
    `UPDATE systems SET nombre=$2, slug=$3, url=$4, ip=$5, puerto=$6, vm=$7, descripcion=$8, orden=$9, activo=$10 WHERE id=$1`,
    [id, m.nombre, m.slug, m.url, m.ip, m.puerto, m.vm, m.descripcion, m.orden, m.activo],
  );
  await audit(req, 'editar_sistema', 'sistema', id, scopeId(req));
  res.status(204).end();
}));

adminSpace.delete('/systems/:id', h(async (req, res) => {
  const id = parse(uuid, req.params.id);
  const r = await query('DELETE FROM systems WHERE id = $1 AND space_id IS NOT DISTINCT FROM $2', [id, scopeId(req)]);
  if (!r.rowCount) throw notFound();
  await audit(req, 'borrar_sistema', 'sistema', id, scopeId(req));
  res.status(204).end();
}));

// ───────── Referencias a credenciales (solo admin_espacio+, no aplica a ministerio) ─────────
// Guardan únicamente el nombre del item en Vaultwarden. Nunca secretos.
const credBody = z.object({
  titulo: tituloT,
  system_id: uuid.nullable(),
  usuario_referencia: optText(200),
  vault_item_name: z.string().trim().min(1).max(200),
  vault_collection: optText(200),
  notas: optText(2000),
  acceso: acceso,
});
const credCols = 'id, system_id, titulo, usuario_referencia, vault_item_name, vault_collection, notas, acceso, created_at, updated_at';

const noMinisterio = (req, _res, next) =>
  req.space.slug === 'ministerio' ? next(notFound('Espacio no encontrado')) : next();

async function assertSystemInSpace(systemId, spaceId) {
  if (!systemId) return;
  const r = await query('SELECT 1 FROM systems WHERE id = $1 AND (space_id = $2 OR space_id IS NULL)', [systemId, spaceId]);
  if (!r.rows[0]) throw badRequest('El sistema no pertenece a este espacio');
}

adminSpace.get('/credential-refs', noMinisterio, h(async (req, res) => {
  const { rows } = await query(
    `SELECT ${credCols} FROM credential_refs WHERE space_id = $1 ORDER BY titulo`,
    [req.space.id],
  );
  await audit(req, 'listar_credential_refs', 'credential_ref', null, req.space.id);
  res.json({ vault_url: config.vaultwardenUrl, items: rows });
}));

adminSpace.get('/credential-refs/:id', noMinisterio, h(async (req, res) => {
  const id = parse(uuid, req.params.id);
  const { rows } = await query(`SELECT ${credCols} FROM credential_refs WHERE id = $1 AND space_id = $2`, [id, req.space.id]);
  if (!rows[0]) throw notFound();
  await audit(req, 'ver_credential_ref', 'credential_ref', id, req.space.id);
  res.json({ vault_url: config.vaultwardenUrl, ...rows[0] });
}));

adminSpace.post('/credential-refs', noMinisterio, h(async (req, res) => {
  const b = parse(credBody.partial({ system_id: true, usuario_referencia: true, vault_collection: true, notas: true, acceso: true }), req.body);
  await assertSystemInSpace(b.system_id, req.space.id);
  const { rows } = await query(
    `INSERT INTO credential_refs (space_id, system_id, titulo, usuario_referencia, vault_item_name, vault_collection, notas, acceso)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
    [req.space.id, b.system_id ?? null, b.titulo, b.usuario_referencia ?? null, b.vault_item_name, b.vault_collection ?? null, b.notas ?? null, b.acceso ?? 'restringido'],
  );
  await audit(req, 'crear_credential_ref', 'credential_ref', rows[0].id, req.space.id);
  res.status(201).json(rows[0]);
}));

adminSpace.patch('/credential-refs/:id', noMinisterio, h(async (req, res) => {
  const id = parse(uuid, req.params.id);
  const b = parse(credBody.partial(), req.body);
  const cur = await query(`SELECT ${credCols} FROM credential_refs WHERE id = $1 AND space_id = $2`, [id, req.space.id]);
  if (!cur.rows[0]) throw notFound();
  const m = { ...cur.rows[0], ...b };
  await assertSystemInSpace(m.system_id, req.space.id);
  await query(
    `UPDATE credential_refs SET system_id=$2, titulo=$3, usuario_referencia=$4, vault_item_name=$5,
            vault_collection=$6, notas=$7, acceso=$8, updated_at=now() WHERE id=$1`,
    [id, m.system_id, m.titulo, m.usuario_referencia, m.vault_item_name, m.vault_collection, m.notas, m.acceso],
  );
  await audit(req, 'editar_credential_ref', 'credential_ref', id, req.space.id);
  res.status(204).end();
}));

adminSpace.delete('/credential-refs/:id', noMinisterio, h(async (req, res) => {
  const id = parse(uuid, req.params.id);
  const r = await query('DELETE FROM credential_refs WHERE id = $1 AND space_id = $2', [id, req.space.id]);
  if (!r.rowCount) throw notFound();
  await audit(req, 'borrar_credential_ref', 'credential_ref', id, req.space.id);
  res.status(204).end();
}));
