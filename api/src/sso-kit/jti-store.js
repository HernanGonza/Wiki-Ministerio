/**
 * Almacén de jti usados (un solo uso para pases use=login).
 *
 * Interfaz (cualquier objeto con este método):
 *   marcarUsado(jti, expira, ahora) -> Promise<boolean>
 *     expira y ahora son epoch en segundos.
 *     true  si el jti NO estaba y quedó registrado (primera vez)
 *     false si ya estaba usado
 *   Debe ser atómico: dos pedidos simultáneos con el mismo jti, solo uno obtiene true.
 *
 * Ejemplo Postgres (tabla jti_usados(jti text primary key, expira bigint)):
 *   async marcarUsado(jti, expira, ahora) {
 *     await pool.query('DELETE FROM jti_usados WHERE expira < $1', [ahora - 120]); // o por cron
 *     const r = await pool.query(
 *       'INSERT INTO jti_usados (jti, expira) VALUES ($1, $2) ON CONFLICT DO NOTHING', [jti, expira]);
 *     return r.rowCount === 1;
 *   }
 */
export function crearAlmacenJtiMemoria({ margen = 120 } = {}) {
  const usados = new Map(); // jti -> expira (s)
  return {
    async marcarUsado(jti, expira, ahora) {
      for (const [k, e] of usados) if (e + margen < ahora) usados.delete(k);
      if (usados.has(jti)) return false;
      usados.set(jti, expira);
      return true;
    },
    get tamano() { return usados.size; },
  };
}
