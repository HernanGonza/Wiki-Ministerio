import { Fragment, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import * as Dialog from '@radix-ui/react-dialog';
import { AnimatePresence, motion } from 'motion/react';
import { AlertTriangle, Check, CheckCircle2, Copy, Download, FileArchive, FileSpreadsheet, FileText, Image as ImageIcon, Info, Lightbulb, Presentation, X } from 'lucide-react';
import { cn } from '@/ui/cn';
import { slugify } from '@/lib';
import type { ArchivosMap, Block, Run, Tono } from './types';
import { textoDeRuns } from './convert';
import { extension, tamano, urlArchivo } from './upload';
import { PdfVisor } from './PdfVisor';
import { OrgChart } from './OrgChart';

/** Texto con formato (negrita, cursiva, código, enlaces). Todo son elementos React: no hay HTML crudo. */
export function Runs({ runs }: { runs: Run[] }) {
  return (
    <>
      {runs.map((r, i) => {
        let el: React.ReactNode = r.t;
        if (r.c) el = <code>{el}</code>;
        if (r.b) el = <strong>{el}</strong>;
        if (r.i) el = <em>{el}</em>;
        if (r.u) {
          const u = r.u;
          el = u.startsWith('/') ? <Link to={u}>{el}</Link>
            : u.startsWith('#') ? <a href={u}>{el}</a>
            : <a href={u} target="_blank" rel="noopener noreferrer">{el}</a>;
        }
        return <Fragment key={i}>{el}</Fragment>;
      })}
    </>
  );
}

const TONOS: Record<Tono, { icon: typeof Info; caja: string; titulo: string }> = {
  info: { icon: Info, caja: 'border-primary/30 bg-primary/8', titulo: 'text-primary' },
  warn: { icon: AlertTriangle, caja: 'border-warning/40 bg-warning/10', titulo: 'text-warning' },
  ok: { icon: CheckCircle2, caja: 'border-success/35 bg-success/10', titulo: 'text-success' },
  danger: { icon: Lightbulb, caja: 'border-destructive/35 bg-destructive/8', titulo: 'text-destructive' },
};
export const TONO_ETIQUETA: Record<Tono, string> = { info: 'Nota', warn: 'Atención', ok: 'Listo', danger: 'Importante' };
export const TONO_ICONO = TONOS;

function iconoArchivo(nombre: string) {
  const e = extension(nombre);
  if (['xlsx', 'ods', 'csv'].includes(e)) return FileSpreadsheet;
  if (['pptx', 'odp'].includes(e)) return Presentation;
  if (['zip'].includes(e)) return FileArchive;
  if (['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(e)) return ImageIcon;
  return FileText;
}

export function TarjetaArchivo({ id, label, meta }: { id: string; label?: string; meta?: ArchivosMap[string] }) {
  const nombre = meta?.nombre ?? 'Archivo adjunto';
  const Icon = iconoArchivo(nombre);
  return (
    <a href={urlArchivo(id)} download={meta?.nombre} className="not-prose group flex min-w-0 max-w-full items-center gap-4 rounded-2xl border bg-card p-4 no-underline shadow-sm transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md">
      <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-primary/12 text-primary"><Icon className="size-6" /></span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold text-foreground">{label || nombre}</span>
        <span className="block truncate text-xs text-muted-foreground">{label && meta ? `${meta.nombre} · ` : ''}{meta ? `${extension(nombre).toUpperCase()} · ${tamano(meta.bytes)}` : 'Descargar'}</span>
      </span>
      <Download className="size-5 text-muted-foreground transition group-hover:text-primary" />
    </a>
  );
}

function Imagen({ id, alt, caption }: { id: string; alt: string; caption: string }) {
  const [abierta, setAbierta] = useState(false);
  const [rota, setRota] = useState(false);
  return (
    <figure className="not-prose my-6">
      {rota ? (
        <div className="grid h-40 place-items-center rounded-2xl border border-dashed text-sm text-muted-foreground">No se pudo cargar la imagen</div>
      ) : (
        <button type="button" onClick={() => setAbierta(true)} className="block w-full cursor-zoom-in overflow-hidden rounded-2xl border bg-muted/40 shadow-sm transition hover:shadow-md" aria-label={`Ampliar imagen${alt ? `: ${alt}` : ''}`}>
          <img src={urlArchivo(id)} alt={alt} loading="lazy" onError={() => setRota(true)} className="mx-auto max-h-[34rem] w-auto max-w-full" />
        </button>
      )}
      {caption && <figcaption className="mt-2 text-center text-sm text-muted-foreground">{caption}</figcaption>}
      <Dialog.Root open={abierta} onOpenChange={setAbierta}>
        <AnimatePresence>
          {abierta && (
            <Dialog.Portal forceMount>
              <Dialog.Overlay asChild forceMount><motion.div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} /></Dialog.Overlay>
              <Dialog.Content asChild forceMount aria-describedby={undefined}>
                <motion.div className="fixed inset-4 z-50 grid place-items-center outline-none" initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }} onClick={() => setAbierta(false)}>
                  <Dialog.Title className="sr-only">{alt || 'Imagen ampliada'}</Dialog.Title>
                  <img src={urlArchivo(id)} alt={alt} className="max-h-full max-w-full rounded-xl object-contain shadow-2xl" />
                  <Dialog.Close className="absolute right-2 top-2 grid size-10 place-items-center rounded-full bg-white/15 text-white backdrop-blur transition hover:bg-white/25" aria-label="Cerrar"><X className="size-5" /></Dialog.Close>
                </motion.div>
              </Dialog.Content>
            </Dialog.Portal>
          )}
        </AnimatePresence>
      </Dialog.Root>
    </figure>
  );
}

function Codigo({ text }: { text: string }) {
  const [ok, setOk] = useState(false);
  return (
    <div className="not-prose group relative my-5">
      <pre className="overflow-x-auto rounded-2xl border bg-muted p-4 pr-14 font-mono text-[0.85rem] leading-relaxed"><code>{text}</code></pre>
      <button type="button" aria-label="Copiar" onClick={async () => { try { await navigator.clipboard.writeText(text); setOk(true); setTimeout(() => setOk(false), 1500); } catch { /* sin permiso */ } }}
        className="absolute right-3 top-3 grid size-8 place-items-center rounded-lg border bg-card text-muted-foreground opacity-0 transition hover:text-foreground focus:opacity-100 group-hover:opacity-100">
        {ok ? <Check className="size-4 text-success" /> : <Copy className="size-4" />}
      </button>
    </div>
  );
}

/** Ids únicos para los títulos (alimentan el índice lateral). */
function idsDeTitulos(blocks: Block[]): Map<string, string> {
  const usados = new Map<string, number>();
  const out = new Map<string, string>();
  for (const b of blocks) {
    if (b.type !== 'heading') continue;
    const base = slugify(textoDeRuns(b.runs)) || 'seccion';
    const n = usados.get(base) ?? 0;
    usados.set(base, n + 1);
    out.set(b.id, n ? `${base}-${n + 1}` : base);
  }
  return out;
}

export function BlockRenderer({ blocks, archivos, className }: { blocks: Block[]; archivos: ArchivosMap; className?: string }) {
  const ids = useMemo(() => idsDeTitulos(blocks), [blocks]);
  return (
    <div className={cn('prose prose-wiki max-w-none dark:prose-invert', className)} data-markdown>
      {blocks.map((b) => {
        switch (b.type) {
          case 'paragraph': return b.runs.length ? <p key={b.id}><Runs runs={b.runs} /></p> : <p key={b.id} aria-hidden="true">&nbsp;</p>;
          case 'heading': return b.level === 2 ? <h2 key={b.id} id={ids.get(b.id)}><Runs runs={b.runs} /></h2> : <h3 key={b.id} id={ids.get(b.id)}><Runs runs={b.runs} /></h3>;
          case 'list': {
            const L = b.ordered ? 'ol' : 'ul';
            return <L key={b.id}>{b.items.map((it, i) => <li key={i}><Runs runs={it} /></li>)}</L>;
          }
          case 'callout': {
            const t = TONOS[b.tone];
            const Icon = t.icon;
            return (
              <div key={b.id} className={cn('not-prose my-5 flex gap-3.5 rounded-2xl border p-4', t.caja)} role="note">
                <Icon className={cn('mt-0.5 size-5 shrink-0', t.titulo)} />
                <div className="min-w-0 flex-1 text-[0.95rem] leading-relaxed"><span className={cn('mb-0.5 block text-xs font-bold uppercase tracking-wider', t.titulo)}>{TONO_ETIQUETA[b.tone]}</span><Runs runs={b.runs} /></div>
              </div>
            );
          }
          case 'quote': return <blockquote key={b.id}><p><Runs runs={b.runs} /></p></blockquote>;
          case 'code': return <Codigo key={b.id} text={b.text} />;
          case 'divider': return <hr key={b.id} />;
          case 'image': return b.fileId ? <Imagen key={b.id} id={b.fileId} alt={b.alt} caption={b.caption} /> : null;
          case 'file': return b.fileId ? <div key={b.id} className="my-4">{b.vista && extension(archivos[b.fileId]?.nombre ?? '') === 'pdf' ? <PdfVisor id={b.fileId} nombre={b.label || archivos[b.fileId]?.nombre} /> : <TarjetaArchivo id={b.fileId} label={b.label} meta={archivos[b.fileId]} />}</div> : null;
          case 'orgchart': return b.nodos.length ? <OrgChart key={b.id} nodos={b.nodos} /> : null;
          case 'table': {
            const head = b.header ? b.rows[0] : undefined;
            const body = b.header ? b.rows.slice(1) : b.rows;
            return (
              <table key={b.id}>
                {head && <thead><tr>{head.map((c, i) => <th key={i}>{c}</th>)}</tr></thead>}
                <tbody>{body.map((r, ri) => <tr key={ri}>{r.map((c, ci) => <td key={ci}>{c}</td>)}</tr>)}</tbody>
              </table>
            );
          }
        }
      })}
    </div>
  );
}
