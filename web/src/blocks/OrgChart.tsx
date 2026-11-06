import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Maximize2, Minimize2, Minus, Network, Plus, ScanSearch } from 'lucide-react';
import { cn } from '@/ui/cn';
import { toast } from '@/ui/feedback';
import type { OrgNodo } from './types';

const ZOOMS = [0.25, 0.35, 0.5, 0.65, 0.8, 1, 1.25, 1.5, 2];

function Caja({ n }: { n: OrgNodo }) {
  const cls = cn('org-box', n.estilo === 'destacado' && 'org-box-destacado', n.href && 'org-box-link');
  if (!n.href) return <span className={cls}>{n.t}</span>;
  return n.href.startsWith('/') ? <Link to={n.href} className={cls}>{n.t}</Link> : <a href={n.href} target="_blank" rel="noopener noreferrer" className={cls}>{n.t}</a>;
}

function Rama({ nodos, vertical }: { nodos: OrgNodo[]; vertical?: boolean }) {
  if (!nodos.length) return null;
  return (
    <ul className={vertical ? 'v' : 'h'}>
      {nodos.map((n) => (
        <li key={n.id}>
          <Caja n={n} />
          <Rama nodos={n.hijos} vertical={n.vertical} />
        </li>
      ))}
    </ul>
  );
}

/** Organigrama nativo: cajas y conectores en HTML/CSS (se edita como un árbol), con zoom y pantalla completa. */
export function OrgChart({ nodos }: { nodos: OrgNodo[] }) {
  const caja = useRef<HTMLDivElement>(null);
  const vista = useRef<HTMLDivElement>(null);
  const lienzo = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [pantalla, setPantalla] = useState(false);
  const inicial = useRef(false);

  /** Centra la vista horizontalmente (la raíz del árbol queda en el medio). */
  const centrar = useCallback(() => {
    setTimeout(() => { const v = vista.current; if (v) v.scrollLeft = (v.scrollWidth - v.clientWidth) / 2; }, 60);
  }, []);

  // `minimo`: el ajuste automático nunca baja de ahí, para que el texto siga siendo legible.
  const ajustar = useCallback((minimo: number = ZOOMS[0]) => {
    const v = vista.current, l = lienzo.current;
    if (!v || !l) return;
    const prev = l.style.zoom;
    l.style.zoom = '1';
    const ancho = l.scrollWidth;
    l.style.zoom = prev;
    const z = (v.clientWidth - 24) / ancho;
    setZoom(Math.min(1, Math.max(minimo, Math.floor(z * 100) / 100)));
    centrar();
  }, [centrar]);

  // Al mostrarse: entra completo si se lee bien; si es muy ancho, abre al 50% centrado (se recorre arrastrando).
  useEffect(() => { if (!inicial.current) { inicial.current = true; ajustar(0.5); } }, [ajustar, nodos]);
  useEffect(() => {
    const h = () => { const fs = document.fullscreenElement === caja.current; setPantalla(fs); setTimeout(() => ajustar(0.5), 50); };
    document.addEventListener('fullscreenchange', h);
    return () => document.removeEventListener('fullscreenchange', h);
  }, [ajustar]);

  const cambiar = useCallback((d: 1 | -1) => setZoom((z) => {
    const i = ZOOMS.reduce((m, x, k) => (Math.abs(x - z) < Math.abs(ZOOMS[m] - z) ? k : m), 0);
    return ZOOMS[Math.min(ZOOMS.length - 1, Math.max(0, i + d))];
  }), []);

  useEffect(() => {
    const el = vista.current;
    if (!el) return;
    const h = (e: WheelEvent) => { if (e.ctrlKey) { e.preventDefault(); cambiar(e.deltaY < 0 ? 1 : -1); } };
    el.addEventListener('wheel', h, { passive: false });
    return () => el.removeEventListener('wheel', h);
  }, [cambiar]);

  async function alternarPantalla() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await caja.current?.requestFullscreen();
    } catch { toast.error('Tu navegador no permite la pantalla completa'); }
  }

  // Arrastrar con el mouse para moverse por el diagrama.
  const pan = useRef<{ x: number; y: number; sl: number; st: number } | null>(null);

  const btn = 'grid size-8 place-items-center rounded-lg text-muted-foreground transition hover:bg-secondary hover:text-foreground disabled:pointer-events-none disabled:opacity-35';
  return (
    <div ref={caja} className={cn('not-prose my-5 flex flex-col overflow-hidden border bg-card shadow-sm', pantalla ? 'h-dvh rounded-none' : 'rounded-2xl')}>
      <div className="flex items-center gap-1 border-b px-3 py-2 sm:px-4">
        <Network className="mr-1 size-4 shrink-0 text-primary" />
        <span className="flex-1 text-sm font-semibold">Organigrama</span>
        <button type="button" className={btn} onClick={() => cambiar(-1)} disabled={zoom <= ZOOMS[0]} title="Alejar" aria-label="Alejar"><Minus className="size-4" /></button>
        <button type="button" onClick={() => setZoom(1)} title="Tamaño real" aria-label={`Zoom ${Math.round(zoom * 100)}%, volver a tamaño real`} className="h-8 min-w-12 rounded-lg px-1.5 text-xs font-semibold tabular-nums text-foreground/80 transition hover:bg-secondary">{Math.round(zoom * 100)}%</button>
        <button type="button" className={btn} onClick={() => cambiar(1)} disabled={zoom >= ZOOMS[ZOOMS.length - 1]} title="Acercar" aria-label="Acercar"><Plus className="size-4" /></button>
        <button type="button" className={btn} onClick={() => ajustar()} title="Ver todo el organigrama" aria-label="Ver todo el organigrama"><ScanSearch className="size-4" /></button>
        <button type="button" className={btn} onClick={alternarPantalla} title={pantalla ? 'Salir de pantalla completa' : 'Pantalla completa'} aria-label={pantalla ? 'Salir de pantalla completa' : 'Pantalla completa'}>{pantalla ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}</button>
      </div>
      <div
        ref={vista}
        className={cn('org-vista cursor-grab overflow-auto p-3 active:cursor-grabbing', pantalla ? 'min-h-0 flex-1' : 'max-h-[75vh]')}
        onPointerDown={(e) => { if (e.button === 0 && !(e.target as HTMLElement).closest('a')) pan.current = { x: e.clientX, y: e.clientY, sl: e.currentTarget.scrollLeft, st: e.currentTarget.scrollTop }; }}
        onPointerMove={(e) => { const p = pan.current; if (p) { e.currentTarget.scrollLeft = p.sl - (e.clientX - p.x); e.currentTarget.scrollTop = p.st - (e.clientY - p.y); } }}
        onPointerUp={() => { pan.current = null; }}
        onPointerLeave={() => { pan.current = null; }}
      >
        <div ref={lienzo} className="org w-max min-w-full" style={{ zoom }}>
          <Rama nodos={nodos} />
        </div>
      </div>
    </div>
  );
}
