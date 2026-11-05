import { query } from '../db.js';

const DAY_MS = 24 * 3600 * 1000;

/** Borra checks de más de 30 días y sesiones vencidas. */
export async function runRetention() {
  try {
    const c = await query(`DELETE FROM system_checks WHERE checked_at < now() - interval '30 days'`);
    const s = await query('DELETE FROM sessions WHERE expires_at < now()');
    console.log(`[retencion] checks borrados: ${c.rowCount}, sesiones vencidas borradas: ${s.rowCount}`);
  } catch (err) {
    console.error('[retencion] error:', err.message);
  }
}

export function startRetention() {
  setTimeout(runRetention, 10_000).unref();
  setInterval(runRetention, DAY_MS).unref();
}
