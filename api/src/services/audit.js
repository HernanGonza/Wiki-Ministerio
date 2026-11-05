import { query } from '../db.js';

/**
 * Registra un evento de auditoría. Nunca incluye contraseñas, tokens ni cookies.
 * No interrumpe la request si falla el registro; solo informa el error.
 */
export async function audit(req, accion, recurso, recursoId = null, spaceId = null, client = null) {
  try {
    const ip = req.ip ?? null;
    const ua = (req.get('user-agent') ?? '').slice(0, 300) || null;
    const run = client ? client.query.bind(client) : query;
    await run(
      `INSERT INTO audit_log (user_id, accion, recurso, recurso_id, space_id, ip, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [req.user?.id ?? req.auditUserId ?? null, accion, recurso, recursoId ? String(recursoId) : null, spaceId, ip, ua],
    );
  } catch (err) {
    console.error('[audit] no se pudo registrar:', accion, err.message);
  }
}
