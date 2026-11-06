import { useCallback, useEffect, useRef, useState } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { Download, ExternalLink, FileText, Loader2, Maximize2, Minimize2, Minus, Plus } from 'lucide-react';
import { cn } from '@/ui/cn';
import { toast } from '@/ui/feedback';
import { urlArchivo } from './upload';

const MAX_PAGINAS = 40;
const ZOOMS = [0.5, 0.75, 1, 1.25, 1.5, 2, 3];

/** Muestra un PDF como imágenes (una por hoja) dentro de la página, con zoom. pdf.js se carga recién cuando el bloque entra en pantalla. */
export function PdfVisor({ id, nombre }: { id: string; nombre?: string }) {
  const caja = useRef<HTMLDivElement>(null);
  const scroll = useRef<HTMLDivElement>(null);
  const hojas = useRef<HTMLDivElement>(null);
  const doc = useRef<PDFDocumentProxy | null>(null);
  const [visible, setVisible] = useState(false);
  const [estado, setEstado] = useState<'cargando' | 'listo' | 'error'>('cargando');
  const [total, setTotal] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [pantalla, setPantalla] = useState(false);
  const [listo, setListo] = useState(0); // cambia cuando el documento termina de abrirse

  useEffect(() => {
    const el = caja.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVisible(true); io.disconnect(); } }, { rootMargin: '300px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Abre el documento una sola vez.
  useEffect(() => {
    if (!visible) return;
    let cancelado = false;
    (async () => {
      try {
        const pdfjs = await import('pdfjs-dist');
        pdfjs.GlobalWorkerOptions.workerSrc = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
        const d = await pdfjs.getDocument({ url: urlArchivo(id), withCredentials: true, isEvalSupported: false }).promise;
        if (cancelado) return void d.destroy();
        doc.current = d;
        setTotal(d.numPages);
        setListo((n) => n + 1);
      } catch {
        if (!cancelado) setEstado('error');
      }
    })();
    return () => { cancelado = true; void doc.current?.destroy(); doc.current = null; };
  }, [visible, id]);

  // Dibuja las hojas al abrir y cada vez que cambia el zoom.
  useEffect(() => {
    const d = doc.current;
    const cont = hojas.current;
    const vista = scroll.current;
    if (!d || !cont || !vista) return;
    let cancelado = false;
    (async () => {
      const base = Math.max(vista.clientWidth - 24, 200);
      const ancho = base * zoom;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const n = Math.min(d.numPages, MAX_PAGINAS);
      const nuevas: HTMLCanvasElement[] = [];
      for (let i = 1; i <= n; i++) {
        const pagina = await d.getPage(i);
        if (cancelado) return;
        const natural = pagina.getViewport({ scale: 1 });
        const vp = pagina.getViewport({ scale: (ancho / natural.width) * dpr });
        const canvas = document.createElement('canvas');
        canvas.width = Math.floor(vp.width);
        canvas.height = Math.floor(vp.height);
        canvas.style.cssText = `width:${ancho}px;height:auto;display:block;background:#fff;border-radius:8px;box-shadow:0 1px 8px rgb(0 0 0 / .18)`;
        canvas.setAttribute('role', 'img');
        canvas.setAttribute('aria-label', `Página ${i} de ${d.numPages}`);
        await pagina.render({ canvasContext: canvas.getContext('2d')!, viewport: vp }).promise;
        if (cancelado) return;
        nuevas.push(canvas);
        // Se reemplaza el contenido al terminar la primera hoja; las demás se van sumando sin parpadeo.
        if (i === 1) { cont.replaceChildren(canvas); setEstado('listo'); } else cont.appendChild(canvas);
      }
    })().catch(() => { if (!cancelado) setEstado('error'); });
    return () => { cancelado = true; };
  }, [listo, zoom, pantalla]);

  useEffect(() => {
    const h = () => setPantalla(document.fullscreenElement === caja.current);
    document.addEventListener('fullscreenchange', h);
    return () => document.removeEventListener('fullscreenchange', h);
  }, []);

  async function alternarPantalla() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await caja.current?.requestFullscreen();
    } catch {
      toast.error('Tu navegador no permite la pantalla completa');
    }
  }

  const cambiar = useCallback((d: 1 | -1) => setZoom((z) => {
    const i = ZOOMS.findIndex((x) => x >= z - 1e-6);
    return ZOOMS[Math.min(ZOOMS.length - 1, Math.max(0, i + d))];
  }), []);

  // Ctrl + rueda sobre el visor = zoom (sin zoomear la página entera).
  useEffect(() => {
    const el = scroll.current;
    if (!el) return;
    const h = (e: WheelEvent) => { if (e.ctrlKey) { e.preventDefault(); cambiar(e.deltaY < 0 ? 1 : -1); } };
    el.addEventListener('wheel', h, { passive: false });
    return () => el.removeEventListener('wheel', h);
  }, [cambiar]);

  /** El servidor entrega los archivos como descarga; para verlo en otra pestaña se abre una copia local (blob). */
  async function abrirEnPestana() {
    const w = window.open('', '_blank');
    try {
      const r = await fetch(urlArchivo(id), { credentials: 'same-origin' });
      if (!r.ok) throw new Error();
      const blob = new Blob([await r.arrayBuffer()], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      if (w) w.location.href = url; else window.location.href = url;
      setTimeout(() => URL.revokeObjectURL(url), 5 * 60_000);
    } catch {
      w?.close();
      toast.error('No se pudo abrir el documento');
    }
  }

  const btn = 'grid size-8 place-items-center rounded-lg text-muted-foreground transition hover:bg-secondary hover:text-foreground disabled:pointer-events-none disabled:opacity-35';
  return (
    <div ref={caja} className={cn('not-prose flex flex-col overflow-hidden border bg-muted/40 shadow-sm', pantalla ? 'h-dvh rounded-none bg-background' : 'rounded-2xl')}>
      <div className="flex items-center gap-1 border-b bg-card px-3 py-2 sm:px-4">
        <FileText className="mr-1 size-4 shrink-0 text-primary" />
        <span className="min-w-0 flex-1 truncate text-sm font-semibold">{nombre ?? 'Documento PDF'}</span>
        {total > 0 && <span className="mr-2 hidden text-xs text-muted-foreground md:inline">{total} {total === 1 ? 'página' : 'páginas'}</span>}
        <button type="button" className={btn} onClick={() => cambiar(-1)} disabled={zoom <= ZOOMS[0]} title="Alejar" aria-label="Alejar"><Minus className="size-4" /></button>
        <button type="button" onClick={() => setZoom(1)} title="Restablecer zoom" aria-label={`Zoom ${Math.round(zoom * 100)}%, restablecer`} className="h-8 min-w-12 rounded-lg px-1.5 text-xs font-semibold tabular-nums text-foreground/80 transition hover:bg-secondary">{Math.round(zoom * 100)}%</button>
        <button type="button" className={btn} onClick={() => cambiar(1)} disabled={zoom >= ZOOMS[ZOOMS.length - 1]} title="Acercar" aria-label="Acercar"><Plus className="size-4" /></button>
        <button type="button" className={btn} onClick={alternarPantalla} title={pantalla ? 'Salir de pantalla completa' : 'Pantalla completa'} aria-label={pantalla ? 'Salir de pantalla completa' : 'Pantalla completa'}>{pantalla ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}</button>
        <span className="mx-1 h-5 w-px bg-border" />
        <button type="button" className={btn} onClick={abrirEnPestana} title="Abrir en otra pestaña" aria-label="Abrir en otra pestaña"><ExternalLink className="size-4" /></button>
        <a href={urlArchivo(id)} download={nombre} title="Descargar" aria-label="Descargar" className={btn}><Download className="size-4" /></a>
      </div>
      <div ref={scroll} className={cn('overflow-auto p-3', pantalla ? 'min-h-0 flex-1' : 'max-h-[75vh]')}>
        {estado === 'cargando' && <p className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" />Cargando documento…</p>}
        {estado === 'error' && <p className="py-12 text-center text-sm text-muted-foreground">No se pudo mostrar el documento. Usá el botón de descarga.</p>}
        <div ref={hojas} className="grid w-max min-w-full justify-items-center gap-3" />
        {total > MAX_PAGINAS && <p className="mt-3 text-center text-xs text-muted-foreground">Se muestran las primeras {MAX_PAGINAS} páginas. Descargá el archivo para verlo completo.</p>}
      </div>
    </div>
  );
}
