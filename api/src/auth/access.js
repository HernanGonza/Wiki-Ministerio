import { query } from '../db.js';
import { notFound, forbidden } from '../http.js';

/**
 * Roles efectivos, de menor a mayor:
 *   general < admin_espacio < admin_global
 * En `ministerio` todo usuario autenticado es `general`; solo el admin global gestiona.
 */
const LEVEL = { general: 1, admin_espacio: 2, admin_global: 3 };

/**
 * Resuelve un espacio por slug y el rol del usuario en él.
 * Sin rol (o espacio inexistente/inactivo para no admins) → 404, para no revelar su existencia.
 */
export async function resolveSpace(user, slug) {
  const { rows } = await query(
    'SELECT id, slug, nombre, subtitulo, descripcion, activo, orden FROM spaces WHERE slug = $1',
    [slug],
  );
  const space = rows[0];
  if (!space) throw notFound('Espacio no encontrado');

  if (user.es_admin_global) return { space, rol: 'admin_global' };
  if (!space.activo) throw notFound('Espacio no encontrado');
  if (space.slug === 'ministerio') return { space, rol: 'general' };

  const r = await query('SELECT rol FROM user_space_roles WHERE user_id = $1 AND space_id = $2', [
    user.id,
    space.id,
  ]);
  if (!r.rows[0]) throw notFound('Espacio no encontrado');
  return { space, rol: r.rows[0].rol };
}

export const hasRole = (rol, min) => LEVEL[rol] >= LEVEL[min];

/** Exige un rol mínimo dentro de un espacio ya visible. 403 si no alcanza. */
export function assertRole(rol, min) {
  if (!hasRole(rol, min)) throw forbidden();
}

/**
 * Middleware: resuelve :slug y exige rol mínimo. Deja req.space y req.rol.
 * Para recursos que `ministerio` no admite (secciones, páginas, credenciales) usar noMinisterio.
 */
export function requireSpaceRole(min, { noMinisterio = false } = {}) {
  return async (req, _res, next) => {
    try {
      const { space, rol } = await resolveSpace(req.user, req.params.slug);
      if (noMinisterio && space.slug === 'ministerio') throw notFound('Espacio no encontrado');
      assertRole(rol, min);
      req.space = space;
      req.rol = rol;
      next();
    } catch (err) {
      next(err);
    }
  };
}
