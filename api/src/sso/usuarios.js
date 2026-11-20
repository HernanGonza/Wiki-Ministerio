import crypto from 'node:crypto';

/**
 * buscarUsuarioPorCorreo del ingreso único: la MISMA función para /sso/acceso y /sso/login.
 *
 *  - Usuario existente y activo  -> { id, rol, activo:true }. rol = 'admin' si es admin global o
 *    tiene algún rol `admin_espacio` en user_space_roles; si no, 'lector' (sin filas = lector).
 *  - Usuario existente e inactivo -> null (sin acceso).
 *  - Usuario inexistente: con use='acceso' NO se crea nada (null). Con use='login' se crea como
 *    lector de forma atómica (INSERT ... ON CONFLICT DO NOTHING sobre el índice único lower(email)
 *    y se vuelve a consultar, así cinco logins en paralelo dejan un solo usuario).
 *
 * Duplicados: users_email_key es UNIQUE sobre lower(email), por lo que NO puede haber dos usuarios
 * cuyo correo difiera solo en mayúsculas; el caso "correo duplicado" del contrato no puede darse
 * en la Wiki. Por las dudas, si la consulta devolviera más de una fila se responde null.
 *
 * El nombre sale del claim `name` del pase (opción `name`); si falta, la parte local del correo.
 * La clave del usuario creado es aleatoria, se hashea con argon2 y se descarta: nadie la conoce,
 * no se guarda ni se loguea. El usuario solo entra por el portal hasta que un admin le asigne clave.
 */
export function crearBuscarUsuarioPorCorreo({ query, hashClave }) {
  const buscar = async (correo) => {
    const { rows } = await query(
      `SELECT u.id, u.activo, u.es_admin_global,
              EXISTS (SELECT 1 FROM user_space_roles r
                       WHERE r.user_id = u.id AND r.rol = 'admin_espacio') AS admin_espacio
         FROM users u WHERE lower(u.email) = $1`,
      [correo],
    );
    return rows;
  };
  const resultado = (rows) => {
    if (rows.length !== 1 || rows[0].activo !== true) return null;
    const u = rows[0];
    return { id: String(u.id), rol: u.es_admin_global || u.admin_espacio ? 'admin' : 'lector', activo: true };
  };

  return async function buscarUsuarioPorCorreo(email, { use, name } = {}) {
    const correo = String(email ?? '').trim().toLowerCase();
    if (!correo.includes('@') || correo.length > 254) return null;
    let rows = await buscar(correo);
    if (rows.length === 0 && use === 'login') {
      const hash = await hashClave();
      await query(
        `INSERT INTO users (email, nombre, password_hash, activo, es_admin_global, must_change_password)
         VALUES ($1, $2, $3, true, false, false)
         ON CONFLICT (lower(email)) DO NOTHING`,
        [correo, nombreParaAlta(name, correo), hash],
      );
      rows = await buscar(correo);
    }
    return resultado(rows);
  };
}

export function nombreParaAlta(name, correo) {
  // eslint-disable-next-line no-control-regex
  const limpio = typeof name === 'string' ? name.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, 200) : '';
  return limpio || correo.split('@')[0].slice(0, 200) || correo;
}

/** Clave aleatoria inutilizable: se hashea y la clave en claro se descarta. */
export const hashClaveAleatoria = (argon2) => () =>
  argon2.hash(crypto.randomBytes(32).toString('base64url'), { type: argon2.argon2id });
