import { useCallback, useEffect, useRef, useState } from 'react';

const TZ = 'America/Argentina/Buenos_Aires';

export const fmtFecha = (iso: string | null | undefined) =>
  iso ? new Intl.DateTimeFormat('es-AR', { dateStyle: 'medium', timeStyle: 'short', timeZone: TZ }).format(new Date(iso)) : '—';

export const fmtDia = (iso: string | null | undefined) =>
  iso ? new Intl.DateTimeFormat('es-AR', { dateStyle: 'long', timeZone: TZ }).format(new Date(iso)) : '—';

export const errMsg = (e: unknown) => (e instanceof Error ? e.message : 'Error inesperado');

export const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

interface AsyncState<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  status: number | null;
  reload: () => void;
}

/** Carga datos al montar / al cambiar deps, con refresco opcional cada `everyMs`. */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[], everyMs?: number): AsyncState<T> {
  const [state, setState] = useState<{ data: T | null; error: string | null; loading: boolean; status: number | null }>({
    data: null, error: null, loading: true, status: null,
  });
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const [tick, setTick] = useState(0);
  const reload = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;
    const run = (first: boolean) => {
      if (first) setState((s) => ({ ...s, loading: true }));
      fnRef
        .current()
        .then((data) => !cancelled && setState({ data, error: null, loading: false, status: null }))
        .catch((e: unknown) => {
          if (cancelled) return;
          const status = (e as { status?: number })?.status ?? null;
          setState((s) => ({ data: first ? null : s.data, error: errMsg(e), loading: false, status }));
        });
    };
    run(true);
    const timer = everyMs ? setInterval(() => run(false), everyMs) : undefined;
    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick, everyMs]);

  return { ...state, reload };
}
