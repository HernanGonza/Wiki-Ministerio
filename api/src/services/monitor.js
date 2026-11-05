import net from 'node:net';
import { query } from '../db.js';

export const TIMEOUT_MS = 5000;
export const SLOW_MS = 2000;
const INTERVAL_MS = 60_000;
const BATCH = 10;

/**
 * Clasificación:
 *  - error / timeout / 5xx          → offline
 *  - 401 / 403 / resto de 1xx-4xx   → online si < 2 s, lento si 2–5 s
 */
export function classify({ error = false, status = null, latencyMs = null }) {
  if (error) return 'offline';
  if (status !== null && status >= 500) return 'offline';
  if (latencyMs === null || latencyMs >= TIMEOUT_MS) return 'offline';
  return latencyMs < SLOW_MS ? 'online' : 'lento';
}

async function httpRequest(url, method) {
  const started = performance.now();
  const res = await fetch(url, {
    method,
    redirect: 'manual', // un 3xx cuenta como online
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: { 'user-agent': 'wiki-mernr-monitor/1.0' },
  });
  const latencyMs = Math.round(performance.now() - started);
  res.body?.cancel().catch(() => {});
  return { status: res.status, latencyMs };
}

export async function checkHttp(url) {
  try {
    let r = await httpRequest(url, 'HEAD');
    if (r.status === 405) r = await httpRequest(url, 'GET');
    return { estado: classify(r), latencia_ms: r.latencyMs, codigo_http: r.status };
  } catch {
    // TLS inválido, DNS, conexión rechazada o timeout.
    return { estado: 'offline', latencia_ms: null, codigo_http: null };
  }
}

export function checkTcp(host, port) {
  return new Promise((resolve) => {
    const started = performance.now();
    const socket = net.connect({ host, port });
    let done = false;
    const finish = (result) => {
      if (done) return;
      done = true;
      socket.destroy();
      resolve(result);
    };
    socket.setTimeout(TIMEOUT_MS);
    socket.once('connect', () => {
      const latencyMs = Math.round(performance.now() - started);
      finish({ estado: classify({ latencyMs }), latencia_ms: latencyMs, codigo_http: null });
    });
    socket.once('timeout', () => finish({ estado: 'offline', latencia_ms: null, codigo_http: null }));
    socket.once('error', () => finish({ estado: 'offline', latencia_ms: null, codigo_http: null }));
  });
}

let running = false;

export async function runChecks() {
  if (running) return; // evita solaparse si una vuelta tarda más de 60 s
  running = true;
  try {
    const { rows } = await query(
      `SELECT id, url, host(ip) AS ip, puerto FROM systems WHERE activo AND (url IS NOT NULL OR (ip IS NOT NULL AND puerto IS NOT NULL))`,
    );
    for (let i = 0; i < rows.length; i += BATCH) {
      await Promise.all(
        rows.slice(i, i + BATCH).map(async (s) => {
          const r = s.url ? await checkHttp(s.url) : await checkTcp(s.ip, s.puerto);
          await query(
            `INSERT INTO system_checks (system_id, estado, latencia_ms, codigo_http) VALUES ($1,$2,$3,$4)`,
            [s.id, r.estado, r.latencia_ms, r.codigo_http],
          ).catch((err) => console.error('[monitor] no se pudo guardar el check:', err.message));
        }),
      );
    }
  } catch (err) {
    console.error('[monitor] error en la ronda:', err.message);
  } finally {
    running = false;
  }
}

export function startMonitor() {
  const timer = setInterval(runChecks, INTERVAL_MS);
  timer.unref();
  setTimeout(runChecks, 3000).unref(); // primera ronda poco después del arranque
}
