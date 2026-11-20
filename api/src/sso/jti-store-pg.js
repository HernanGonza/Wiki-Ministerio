/**
 * Almacén de jti de un solo uso sobre Postgres (tabla sso_jti_usados, migración 004).
 * marcarUsado(jti, expira, ahora): expira y ahora en epoch (s). true = primera vez.
 * La inserción atómica ON CONFLICT DO NOTHING decide; sirve entre procesos y reinicios.
 */
const MARGEN_S = 120; // >= tolerancia del kit (60 s): pasado esto el pase ya no pasa la verificación de `exp`

export function crearAlmacenJtiPostgres(query) {
  let ultimaPurga = 0;
  return {
    async marcarUsado(jti, expira, ahora) {
      // Purga de vencidos como mucho una vez por minuto (el índice por `vence` la hace barata).
      if (ahora - ultimaPurga >= 60) {
        ultimaPurga = ahora;
        await query('DELETE FROM sso_jti_usados WHERE vence < now()').catch(() => {});
      }
      const r = await query(
        `INSERT INTO sso_jti_usados (jti, vence) VALUES ($1, to_timestamp($2))
         ON CONFLICT (jti) DO NOTHING`,
        [jti, expira + MARGEN_S],
      );
      return r.rowCount === 1;
    },
  };
}
