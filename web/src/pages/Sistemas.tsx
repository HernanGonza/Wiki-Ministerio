import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { Activity, ChevronDown, ExternalLink, Gauge, RefreshCw, Server } from 'lucide-react';
import { api, q } from '@/api/client';
import type { SystemCheck, SystemStatus } from '@/api/types';
import { fmtFecha, useAsync } from '@/lib';
import { cn } from '@/ui/cn';
import { ESTADO_BG, ESTADO_LABEL, StatusDot } from '@/components/StatusDot';
import { Cargando, ErrorMsg } from '@/components/Estados';
import { Contador } from '@/components/Contador';
import { Badge } from '@/components/ui/badge';
import { Empty, PageEnter, PageHeader } from '@/components/ui/page';
import { Reveal } from '@/components/ui/reveal';
import { Skeleton } from '@/components/ui/skeleton';

function History({ id }: { id: string }) {
  const { data, loading, error } = useAsync(() => api.get<SystemCheck[]>(`/systems/${id}/history${q({ horas: 24 })}`), [id]);
  if (loading) return <Skeleton className="h-10" />;
  if (error) return <ErrorMsg msg={error} />;
  const checks = (data ?? []).slice(-120);
  if (!checks.length) return <p className="text-sm text-muted-foreground">Sin verificaciones en las últimas 24 horas.</p>;
  return (
    <div>
      <p className="mb-2 text-xs text-muted-foreground">Últimas {checks.length} verificaciones · la más reciente a la derecha</p>
      <div className="flex h-9 items-end gap-[3px]" role="img" aria-label="Historial de estado de las últimas 24 horas">
        {checks.map((c, i) => (
          <motion.span key={i} initial={{ scaleY: 0 }} animate={{ scaleY: 1 }} transition={{ delay: i * 0.004 }} style={{ originY: 1 }}
            className={cn('h-full min-w-[3px] flex-1 rounded-sm', ESTADO_BG[c.estado])}
            title={`${fmtFecha(c.checked_at)} · ${ESTADO_LABEL[c.estado]}${c.latencia_ms != null ? ` · ${c.latencia_ms} ms` : ''}`} />
        ))}
      </div>
    </div>
  );
}

const Tile = ({ icon, label, children, tone }: { icon: React.ReactNode; label: string; children: React.ReactNode; tone?: string }) => (
  <div className="flex items-center gap-4 rounded-2xl border bg-card p-4 shadow-sm">
    <span className={cn('grid size-11 place-items-center rounded-xl bg-muted [&_svg]:size-5', tone)}>{icon}</span>
    <div><div className="text-2xl font-bold leading-none tabular-nums">{children}</div><div className="mt-1 text-xs text-muted-foreground">{label}</div></div>
  </div>
);

export function Sistemas() {
  const { espacio = '' } = useParams();
  const [abierto, setAbierto] = useState<string | null>(null);
  // Refresco cada 30 s: el frontend solo consulta; los checks los hace la API.
  const { data, loading, error } = useAsync(() => api.get<SystemStatus[]>(`/systems/status${q({ space: espacio })}`), [espacio], 30_000);
  const lista = data ?? [];
  const ok = lista.filter((s) => s.estado === 'online').length;
  const lentos = lista.filter((s) => s.estado === 'lento').length;
  const caidos = lista.filter((s) => s.estado === 'offline').length;

  return (
    <PageEnter>
      <PageHeader icon={<Activity />} title="Estado de sistemas"
        description={<span className="inline-flex items-center gap-1.5"><RefreshCw className="size-3.5" />Se actualiza cada 30 segundos. El servidor verifica cada minuto.</span>} />
      {loading ? <Cargando variante="tarjetas" /> : <ErrorMsg msg={error} />}
      {!loading && !lista.length && <Empty icon={<Server />}>No hay sistemas registrados.</Empty>}

      {lista.length > 0 && (
        <div className="mb-6 grid gap-3 sm:grid-cols-3">
          <Tile icon={<Activity />} label="En línea" tone="bg-success/15 text-success"><Contador valor={ok} /><span className="text-base font-medium text-muted-foreground"> / {lista.length}</span></Tile>
          <Tile icon={<Gauge />} label="Lentos" tone="bg-warning/15 text-warning"><Contador valor={lentos} /></Tile>
          <Tile icon={<Server />} label="Sin conexión" tone="bg-destructive/12 text-destructive"><Contador valor={caidos} /></Tile>
        </div>
      )}

      <div className="grid gap-3">
        {lista.map((s, i) => {
          const uptime = s.checks_24h ? Math.round((s.online_24h / s.checks_24h) * 100) : null;
          const open = abierto === s.id;
          return (
            <Reveal key={s.id} delay={Math.min(i, 6) * 0.04}>
              <div className={cn('overflow-hidden rounded-2xl border bg-card shadow-sm transition', open && 'shadow-md ring-1 ring-primary/20')}>
                <button onClick={() => setAbierto(open ? null : s.id)} aria-expanded={open} className="flex w-full flex-wrap items-center gap-x-6 gap-y-2 p-4 text-left transition hover:bg-secondary/40 sm:px-5">
                  <StatusDot estado={s.estado} />
                  <div className="min-w-0 flex-1 basis-48">
                    <div className="flex items-center gap-2"><span className="truncate font-bold">{s.nombre}</span>{s.transversal && <Badge variant="primary">Ministerio</Badge>}</div>
                    <p className="truncate text-xs text-muted-foreground">{s.vm ?? '—'} · {ESTADO_LABEL[s.estado ?? 'sin-datos']}</p>
                  </div>
                  <div className="w-24 text-sm"><div className="font-semibold tabular-nums">{s.latencia_ms != null ? `${s.latencia_ms} ms` : '—'}</div><div className="text-xs text-muted-foreground">latencia</div></div>
                  <div className="w-36 text-sm">
                    <div className="flex items-center justify-between font-semibold tabular-nums"><span>{uptime != null ? `${uptime} %` : '—'}</span><span className="text-xs font-normal text-muted-foreground">24 h</span></div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted"><motion.div initial={{ width: 0 }} animate={{ width: `${uptime ?? 0}%` }} transition={{ duration: 0.8, delay: 0.2 }} className={cn('h-full rounded-full', uptime != null && uptime < 90 ? 'bg-warning' : 'bg-success')} /></div>
                  </div>
                  <ChevronDown className={cn('size-4 text-muted-foreground transition-transform', open && 'rotate-180')} />
                </button>
                <AnimatePresence initial={false}>
                  {open && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }} className="overflow-hidden">
                      <div className="grid gap-3 border-t bg-muted/30 p-5">
                        {s.descripcion && <p className="text-sm">{s.descripcion}</p>}
                        {s.url && <a href={s.url} target="_blank" rel="noopener noreferrer" className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-primary hover:underline"><ExternalLink className="size-3.5" />{s.url}</a>}
                        <p className="text-xs text-muted-foreground">Última verificación: {fmtFecha(s.checked_at)}</p>
                        <History id={s.id} />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </Reveal>
          );
        })}
      </div>
    </PageEnter>
  );
}
