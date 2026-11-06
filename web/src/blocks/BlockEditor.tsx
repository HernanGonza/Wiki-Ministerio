import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { Reorder, useDragControls, AnimatePresence, motion } from 'motion/react';
import type { Editor } from '@tiptap/react';
import { ArrowDown, ArrowUp, Bold, Code, Copy, GripVertical, Italic, Link2, Link2Off, Loader2, MoreVertical, Plus, RefreshCw, Trash2, Upload } from 'lucide-react';
import { cn } from '@/ui/cn';
import { pedirTexto, toast } from '@/ui/feedback';
import { Button } from '@/components/ui/button';
import { Dropdown, DropdownContent, DropdownItem, DropdownLabel, DropdownSeparator, DropdownTrigger } from '@/components/ui/dropdown';
import type { ArchivoMeta, ArchivosMap, Block, BlockType, Run, Tono } from './types';
import { convertirBloque, normalizarHref, nuevoBloque, uid } from './convert';
import { CATALOGO, filtrarCatalogo, type Entrada } from './catalogo';
import { RichText } from './RichText';
import { OrgEditor } from './OrgEditor';
import { TarjetaArchivo, TONO_ETIQUETA, TONO_ICONO } from './BlockRenderer';
import { ACCEPT, ACCEPT_IMAGEN, esImagen, subirArchivo, urlArchivo, validarAntes } from './upload';

interface Props {
  espacio: string;
  /** Acceso con el que se guardan los archivos subidos (el de la página). */
  acceso: 'general' | 'restringido';
  value: Block[];
  onChange: (b: Block[]) => void;
  archivos: ArchivosMap;
  onArchivo: (id: string, meta: ArchivoMeta) => void;
}

const TEXTO = new Set<BlockType>(['paragraph', 'heading', 'callout', 'quote']);

// ───────── Menú "/" ─────────
function MenuSlash({ query, onPick, onClose }: { query: string; onPick: (e: Entrada) => void; onClose: () => void }) {
  const items = filtrarCatalogo(query);
  const [idx, setIdx] = useState(0);
  useEffect(() => setIdx(0), [query]);
  useEffect(() => {
    // En captura: se adelanta a Tiptap para que ↑ ↓ Enter manejen el menú y no el texto.
    const h = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); e.stopPropagation(); setIdx((i) => (items.length ? (i + 1) % items.length : 0)); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); e.stopPropagation(); setIdx((i) => (items.length ? (i - 1 + items.length) % items.length : 0)); }
      else if (e.key === 'Enter' && items.length) { e.preventDefault(); e.stopPropagation(); onPick(items[idx]); }
      else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onClose(); }
    };
    window.addEventListener('keydown', h, true);
    return () => window.removeEventListener('keydown', h, true);
  }, [items, idx, onPick, onClose]);

  return (
    <motion.div initial={{ opacity: 0, y: -4, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} className="absolute left-0 top-full z-30 mt-1 max-h-72 w-72 overflow-y-auto rounded-2xl border bg-popover p-1.5 shadow-xl" role="listbox">
      {items.length === 0 && <p className="px-3 py-4 text-center text-sm text-muted-foreground">Sin resultados</p>}
      {items.map((e, i) => (
        <button key={e.key} role="option" aria-selected={i === idx} onMouseEnter={() => setIdx(i)} onMouseDown={(ev) => { ev.preventDefault(); onPick(e); }}
          className={cn('flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition', i === idx && 'bg-secondary')}>
          <span className="grid size-9 shrink-0 place-items-center rounded-lg border bg-card text-muted-foreground"><e.icon className="size-4" /></span>
          <span className="min-w-0"><span className="block text-sm font-semibold">{e.label}</span><span className="block truncate text-xs text-muted-foreground">{e.desc}</span></span>
        </button>
      ))}
    </motion.div>
  );
}

// ───────── Bloques no textuales ─────────
function ZonaSubida({ tipo, subiendo, onArchivo }: { tipo: 'image' | 'file'; subiendo: number | null; onArchivo: (f: File) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [encima, setEncima] = useState(false);
  const imagen = tipo === 'image';
  return (
    <div
      onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setEncima(true); }}
      onDragLeave={() => setEncima(false)}
      onDrop={(e) => { e.preventDefault(); e.stopPropagation(); setEncima(false); const f = e.dataTransfer.files[0]; if (f) onArchivo(f); }}
      className={cn('grid place-items-center gap-2 rounded-2xl border-2 border-dashed px-4 py-9 text-center transition', encima ? 'border-primary bg-primary/8' : 'bg-muted/30 hover:border-primary/50 hover:bg-muted/60')}
    >
      <input ref={input} type="file" hidden accept={imagen ? ACCEPT_IMAGEN : ACCEPT} onChange={(e) => { const f = e.target.files?.[0]; if (f) onArchivo(f); e.target.value = ''; }} />
      {subiendo !== null ? (
        <div className="grid w-56 gap-2">
          <p className="flex items-center justify-center gap-2 text-sm font-medium"><Loader2 className="size-4 animate-spin" />Subiendo… {subiendo}%</p>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${subiendo}%` }} /></div>
        </div>
      ) : (
        <>
          <span className="grid size-11 place-items-center rounded-full bg-primary/12 text-primary"><Upload className="size-5" /></span>
          <p className="text-sm font-medium">{imagen ? 'Arrastrá una imagen acá' : 'Arrastrá un archivo acá'}</p>
          <p className="text-xs text-muted-foreground">{imagen ? 'PNG, JPG, GIF o WebP · hasta 10 MB' : 'PDF, Word, Excel, PowerPoint, TXT o CSV · hasta 25 MB'}</p>
          <Button type="button" size="sm" variant="outline" onClick={() => input.current?.click()}>Elegir {imagen ? 'imagen' : 'archivo'}</Button>
        </>
      )}
    </div>
  );
}

function CampoChico({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className="grid min-w-0 gap-1 text-[0.75rem] font-semibold text-muted-foreground">
      {label}
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="h-9 w-full min-w-0 rounded-lg border border-input bg-card px-3 text-sm font-normal text-foreground focus:border-ring focus:outline-none focus:ring-4 focus:ring-ring/15" />
    </label>
  );
}

function TablaEditor({ b, onChange }: { b: Extract<Block, { type: 'table' }>; onChange: (p: Partial<Extract<Block, { type: 'table' }>>) => void }) {
  const cols = b.rows[0]?.length ?? 0;
  const setCell = (r: number, c: number, v: string) => onChange({ rows: b.rows.map((row, ri) => (ri === r ? row.map((x, ci) => (ci === c ? v : x)) : row)) });
  const btn = 'rounded-lg border bg-card px-2.5 py-1 text-xs font-medium transition hover:border-primary/50 disabled:opacity-40';
  return (
    <div className="grid gap-2">
      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full border-collapse text-sm">
          <tbody>
            {b.rows.map((row, r) => (
              <tr key={r} className={cn(b.header && r === 0 && 'bg-muted/60')}>
                {row.map((cell, c) => (
                  <td key={c} className="border-b border-r p-0 last:border-r-0">
                    <input value={cell} onChange={(e) => setCell(r, c, e.target.value)} aria-label={`Fila ${r + 1}, columna ${c + 1}`}
                      className={cn('h-10 w-full min-w-28 bg-transparent px-3 outline-none focus:bg-primary/5', b.header && r === 0 && 'font-semibold')} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <button type="button" className={btn} onClick={() => onChange({ rows: [...b.rows, Array(cols).fill('')] })}>+ Fila</button>
        <button type="button" className={btn} onClick={() => onChange({ rows: b.rows.map((r) => [...r, '']) })}>+ Columna</button>
        <button type="button" className={btn} disabled={b.rows.length <= 1} onClick={() => onChange({ rows: b.rows.slice(0, -1) })}>− Fila</button>
        <button type="button" className={btn} disabled={cols <= 1} onClick={() => onChange({ rows: b.rows.map((r) => r.slice(0, -1)) })}>− Columna</button>
        <label className="ml-auto flex items-center gap-2 text-xs"><input type="checkbox" checked={b.header} onChange={(e) => onChange({ header: e.target.checked })} />Primera fila como encabezado</label>
      </div>
    </div>
  );
}

// ───────── Editor ─────────
export function BlockEditor({ espacio, acceso, value, onChange, archivos, onArchivo }: Props) {
  const registro = useRef(new Map<string, Editor>());
  const valueRef = useRef(value);
  valueRef.current = value;
  const [sync, setSync] = useState<Record<string, number>>({});
  const [focusId, setFocusId] = useState<{ id: string; donde: true | 'inicio' } | null>(null);
  const [active, setActive] = useState<Editor | null>(null);
  const [, force] = useReducer((x: number) => x + 1, 0);
  const [slash, setSlash] = useState<{ id: string; query: string } | null>(null);
  const [subiendoBloque, setSubiendoBloque] = useState<Record<string, number>>({});
  const [subidas, setSubidas] = useState<{ id: string; nombre: string; pct: number }[]>([]);
  const [arrastrando, setArrastrando] = useState(false);
  const ultimo = useRef<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Siempre hay al menos un bloque para escribir.
  useEffect(() => { if (value.length === 0) onChange([nuevoBloque('paragraph')]); }, [value.length, onChange]);

  useEffect(() => {
    if (!active) return;
    const f = () => force();
    active.on('transaction', f);
    return () => { active.off('transaction', f); };
  }, [active]);

  useEffect(() => {
    if (!focusId) return;
    const t = setTimeout(() => setFocusId(null), 80);
    return () => clearTimeout(t);
  }, [focusId]);

  const bump = (id: string) => setSync((s) => ({ ...s, [id]: (s[id] ?? 0) + 1 }));
  const idx = (id: string) => valueRef.current.findIndex((b) => b.id === id);
  const patch = (id: string, p: Partial<Block>) => onChange(valueRef.current.map((b) => (b.id === id ? ({ ...b, ...p } as Block) : b)));

  const insertarDespues = (id: string | null, b: Block, enfocar: true | 'inicio' | false = true) => {
    const arr = [...valueRef.current];
    const i = id === null ? arr.length - 1 : idx(id);
    arr.splice(i + 1, 0, b);
    onChange(arr);
    if (enfocar) setFocusId({ id: b.id, donde: enfocar });
  };

  const quitar = (id: string) => {
    const i = idx(id);
    const arr = valueRef.current.filter((b) => b.id !== id);
    onChange(arr.length ? arr : [nuevoBloque('paragraph')]);
    const prev = arr[Math.max(0, i - 1)];
    if (prev) setTimeout(() => registro.current.get(prev.id)?.commands.focus('end'), 30);
  };

  const mover = (id: string, d: -1 | 1) => {
    const arr = [...valueRef.current];
    const i = idx(id);
    const j = i + d;
    if (j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    onChange(arr);
  };

  const duplicar = (id: string) => {
    const b = valueRef.current[idx(id)];
    if (b) insertarDespues(id, { ...structuredClone(b), id: uid() }, false);
  };

  const convertir = (id: string, e: Entrada) => {
    const b = valueRef.current[idx(id)];
    if (!b) return;
    const nb = convertirBloque(b, e.type, e.extra);
    onChange(valueRef.current.map((x) => (x.id === id ? nb : x)));
    bump(id);
    setFocusId({ id, donde: true });
  };

  const elegirEnSlash = (id: string, e: Entrada) => {
    setSlash(null);
    onChange(valueRef.current.map((x) => (x.id === id ? { ...nuevoBloque(e.type, e.extra), id } : x)));
    bump(id);
    setFocusId({ id, donde: true });
  };

  const navegar = (id: string, dir: 'arriba' | 'abajo') => {
    const paso = dir === 'arriba' ? -1 : 1;
    for (let j = idx(id) + paso; j >= 0 && j < valueRef.current.length; j += paso) {
      const ed = registro.current.get(valueRef.current[j].id);
      if (ed) { ed.commands.focus(dir === 'arriba' ? 'end' : 'start'); return; }
    }
  };

  const dividir = (id: string, antes: Run[], despues: Run[]) => {
    const nuevo: Block = { id: uid(), type: 'paragraph', runs: despues };
    const arr = valueRef.current.flatMap((b) => (b.id === id && 'runs' in b ? [{ ...b, runs: antes } as Block, nuevo] : [b]));
    onChange(arr);
    bump(id);
    setFocusId({ id: nuevo.id, donde: 'inicio' });
  };

  const salirDeLista = (id: string, items: Run[][]) => {
    const nuevo = nuevoBloque('paragraph');
    onChange(valueRef.current.flatMap((b) => (b.id === id && b.type === 'list' ? [{ ...b, items: items.length ? items : [[]] } as Block, nuevo] : [b])));
    bump(id);
    setFocusId({ id: nuevo.id, donde: true });
  };

  // ───── Archivos ─────
  async function subirParaBloque(id: string, file: File) {
    const err = validarAntes(file);
    if (err) return void toast.error(err);
    setSubiendoBloque((s) => ({ ...s, [id]: 0 }));
    try {
      const f = await subirArchivo(espacio, file, acceso, (pct) => setSubiendoBloque((s) => ({ ...s, [id]: pct })));
      onArchivo(f.id, { nombre: f.nombre, mime: f.mime, bytes: f.bytes });
      const b = valueRef.current[idx(id)];
      if (b?.type === 'image') patch(id, { fileId: f.id });
      else if (b?.type === 'file') patch(id, { fileId: f.id, label: b.label || '', vista: /\.pdf$/i.test(f.nombre) });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo subir el archivo');
    } finally {
      setSubiendoBloque((s) => { const { [id]: _omit, ...rest } = s; return rest; });
    }
  }

  /** Arrastrar, pegar o elegir varios archivos: cada uno se sube y se inserta como bloque. */
  const agregarArchivos = useCallback(async (files: File[]) => {
    for (const file of files) {
      const err = validarAntes(file);
      if (err) { toast.error(err); continue; }
      const sid = uid();
      setSubidas((s) => [...s, { id: sid, nombre: file.name, pct: 0 }]);
      try {
        const f = await subirArchivo(espacio, file, acceso, (pct) => setSubidas((s) => s.map((x) => (x.id === sid ? { ...x, pct } : x))));
        onArchivo(f.id, { nombre: f.nombre, mime: f.mime, bytes: f.bytes });
        const b: Block = esImagen(file.name)
          ? { id: uid(), type: 'image', fileId: f.id, alt: '', caption: '' }
          : { id: uid(), type: 'file', fileId: f.id, label: '', vista: /\.pdf$/i.test(f.nombre) };
        // Se inserta después del bloque donde estaba el cursor (o al final); si ese bloque es un párrafo vacío, lo reemplaza.
        const actual = valueRef.current;
        const anclaIdx = ultimo.current ? actual.findIndex((x) => x.id === ultimo.current) : actual.length - 1;
        const arr = [...actual];
        const ancla = arr[anclaIdx];
        if (ancla?.type === 'paragraph' && !ancla.runs.some((r) => r.t.trim())) arr.splice(anclaIdx, 1, b);
        else arr.splice(anclaIdx + 1, 0, b);
        onChange(arr);
        ultimo.current = b.id;
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'No se pudo subir el archivo');
      } finally {
        setSubidas((s) => s.filter((x) => x.id !== sid));
      }
    }
  }, [espacio, acceso, onArchivo, onChange]);

  // ───── Barra de formato ─────
  const ed = active && !active.isDestroyed ? active : null;
  async function enlace() {
    if (!ed) return;
    if (ed.isActive('link')) { ed.chain().focus().unsetLink().run(); return; }
    if (ed.state.selection.empty) { toast.info('Seleccioná primero el texto que querés convertir en enlace'); return; }
    const raw = await pedirTexto({ titulo: 'Agregar enlace', etiqueta: 'Dirección (por ejemplo https://misiones.gob.ar)', confirmar: 'Aplicar' });
    if (raw === null) return;
    const href = normalizarHref(raw);
    if (!href) { toast.error('Esa dirección no es válida'); return; }
    ed.chain().focus().extendMarkRange('link').setLink({ href }).run();
  }

  const Fmt = ({ activo, label, onClick, children }: { activo?: boolean; label: string; onClick: () => void; children: React.ReactNode }) => (
    <button type="button" disabled={!ed} aria-label={label} title={label} aria-pressed={activo}
      onMouseDown={(e) => e.preventDefault()} onClick={onClick}
      className={cn('grid size-9 place-items-center rounded-lg text-foreground/75 transition hover:bg-secondary hover:text-foreground disabled:pointer-events-none disabled:opacity-35', activo && 'bg-primary/15 text-primary')}>
      {children}
    </button>
  );

  const insertarEntrada = (e: Entrada, tras: string | null) => {
    insertarDespues(tras ?? ultimo.current ?? valueRef.current[valueRef.current.length - 1]?.id ?? null, nuevoBloque(e.type, e.extra));
  };

  return (
    <div
      className="relative grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3"
      onDragOver={(e) => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); setArrastrando(true); } }}
      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setArrastrando(false); }}
      onDrop={(e) => { setArrastrando(false); const fs = [...e.dataTransfer.files]; if (fs.length) { e.preventDefault(); void agregarArchivos(fs); } }}
      onPaste={(e) => { const fs = [...e.clipboardData.files]; if (fs.length) { e.preventDefault(); void agregarArchivos(fs); } }}
    >
      {/* Barra */}
      <div className="sticky top-[4.25rem] z-20 flex flex-wrap items-center gap-0.5 rounded-2xl border bg-card/95 p-1.5 shadow-sm backdrop-blur">
        <Fmt label="Negrita (Ctrl+B)" activo={ed?.isActive('bold')} onClick={() => ed?.chain().focus().toggleBold().run()}><Bold className="size-4" /></Fmt>
        <Fmt label="Cursiva (Ctrl+I)" activo={ed?.isActive('italic')} onClick={() => ed?.chain().focus().toggleItalic().run()}><Italic className="size-4" /></Fmt>
        <Fmt label="Código en línea" activo={ed?.isActive('code')} onClick={() => ed?.chain().focus().toggleCode().run()}><Code className="size-4" /></Fmt>
        <Fmt label={ed?.isActive('link') ? 'Quitar enlace' : 'Enlace'} activo={ed?.isActive('link')} onClick={enlace}>{ed?.isActive('link') ? <Link2Off className="size-4" /> : <Link2 className="size-4" />}</Fmt>
        <span className="mx-1 h-6 w-px bg-border" />
        <Dropdown>
          <DropdownTrigger asChild><Button type="button" size="sm" variant="secondary"><Plus />Agregar bloque</Button></DropdownTrigger>
          <DropdownContent align="start" className="max-h-96 w-72 overflow-y-auto">
            {CATALOGO.map((e) => (
              <DropdownItem key={e.key} onSelect={() => insertarEntrada(e, null)}>
                <e.icon /><span><span className="block font-medium">{e.label}</span><span className="block text-xs text-muted-foreground">{e.desc}</span></span>
              </DropdownItem>
            ))}
          </DropdownContent>
        </Dropdown>
        <input ref={inputRef} type="file" hidden multiple accept={ACCEPT} onChange={(e) => { const fs = [...(e.target.files ?? [])]; e.target.value = ''; if (fs.length) void agregarArchivos(fs); }} />
        <Button type="button" size="sm" variant="ghost" onClick={() => inputRef.current?.click()}><Upload />Subir archivos</Button>
        <span className="ml-auto hidden pr-2 text-xs text-muted-foreground md:block">Escribí <kbd className="rounded border bg-muted px-1.5 font-semibold">/</kbd> para ver los bloques</span>
      </div>

      <AnimatePresence>
        {subidas.length > 0 && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="grid gap-1.5 overflow-hidden">
            {subidas.map((s) => (
              <div key={s.id} className="flex items-center gap-3 rounded-xl border bg-card px-3 py-2 text-sm">
                <Loader2 className="size-4 shrink-0 animate-spin text-primary" />
                <span className="min-w-0 flex-1 truncate">{s.nombre}</span>
                <div className="h-1.5 w-28 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary transition-all" style={{ width: `${s.pct}%` }} /></div>
                <span className="w-9 text-right text-xs tabular-nums text-muted-foreground">{s.pct}%</span>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bloques */}
      <Reorder.Group axis="y" values={value} onReorder={onChange} as="div" className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-0.5 rounded-2xl border bg-card p-3 pl-2 shadow-sm sm:p-5 sm:pl-3">
        {value.map((b) => (
          <Fila
            key={b.id}
            b={b}
            sync={sync[b.id] ?? 0}
            autoFocus={focusId?.id === b.id ? focusId.donde : false}
            registro={registro}
            archivos={archivos}
            subiendo={subiendoBloque[b.id] ?? null}
            slash={slash?.id === b.id ? slash.query : null}
            onFocus={(e) => { setActive(e); ultimo.current = b.id; }}
            onFocusBloque={() => { ultimo.current = b.id; }}
            onPatch={(p) => patch(b.id, p)}
            onDividir={(a, d) => dividir(b.id, a, d)}
            onSalirDeLista={(items) => salirDeLista(b.id, items)}
            onVacioBackspace={() => { if (valueRef.current.length > 1 || b.type !== 'paragraph') quitar(b.id); }}
            onNavegar={(dir) => navegar(b.id, dir)}
            onTexto={(t) => {
              if (b.type === 'paragraph' && t.startsWith('/') && !t.includes('\n')) setSlash({ id: b.id, query: t.slice(1) });
              else setSlash((s) => (s?.id === b.id ? null : s));
            }}
            onSlashPick={(e) => elegirEnSlash(b.id, e)}
            onSlashClose={() => setSlash(null)}
            onConvertir={(e) => convertir(b.id, e)}
            onMover={(d) => mover(b.id, d)}
            onDuplicar={() => duplicar(b.id)}
            onQuitar={() => quitar(b.id)}
            onInsertar={(e) => insertarEntrada(e, b.id)}
            onSubir={(f) => void subirParaBloque(b.id, f)}
          />
        ))}
      </Reorder.Group>

      <button type="button" onClick={() => insertarDespues(null, nuevoBloque('paragraph'))}
        className="rounded-xl border border-dashed py-3 text-sm font-medium text-muted-foreground transition hover:border-primary/50 hover:bg-secondary/50 hover:text-foreground">
        + Agregar texto al final
      </button>

      <AnimatePresence>
        {arrastrando && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="pointer-events-none absolute inset-0 z-30 grid place-items-center rounded-2xl border-2 border-dashed border-primary bg-primary/10 backdrop-blur-[2px]">
            <p className="flex items-center gap-2 rounded-full bg-card px-5 py-2.5 font-semibold text-primary shadow-lg"><Upload className="size-5" />Soltá para subir</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ───────── Fila (un bloque) ─────────
interface FilaProps {
  b: Block;
  sync: number;
  autoFocus: boolean | 'inicio';
  registro: React.MutableRefObject<Map<string, Editor>>;
  archivos: ArchivosMap;
  subiendo: number | null;
  slash: string | null;
  onFocus: (e: Editor) => void;
  onFocusBloque: () => void;
  onPatch: (p: Partial<Block>) => void;
  onDividir: (a: Run[], d: Run[]) => void;
  onSalirDeLista: (items: Run[][]) => void;
  onVacioBackspace: () => void;
  onNavegar: (d: 'arriba' | 'abajo') => void;
  onTexto: (t: string) => void;
  onSlashPick: (e: Entrada) => void;
  onSlashClose: () => void;
  onConvertir: (e: Entrada) => void;
  onMover: (d: -1 | 1) => void;
  onDuplicar: () => void;
  onQuitar: () => void;
  onInsertar: (e: Entrada) => void;
  onSubir: (f: File) => void;
}

const ESTILO_TEXTO: Record<string, string> = {
  paragraph: 'text-[1.02rem] leading-relaxed',
  quote: 'border-l-4 border-rosa bg-accent/60 py-1.5 pl-4 pr-3 rounded-r-xl text-[1rem] leading-relaxed',
};

function Fila(p: FilaProps) {
  const { b } = p;
  const controles = useDragControls();
  const esTexto = TEXTO.has(b.type);

  const rich = (extra: Partial<React.ComponentProps<typeof RichText>>) => (
    <RichText
      blockId={b.id}
      modo="linea"
      runs={'runs' in b ? b.runs : []}
      syncKey={p.sync}
      placeholder={b.type === 'heading' ? 'Título' : b.type === 'paragraph' ? "Escribí algo, o '/' para insertar un bloque" : b.type === 'callout' ? 'Escribí el aviso…' : 'Escribí la cita…'}
      autoFocus={p.autoFocus}
      registro={p.registro}
      onRuns={(runs) => p.onPatch({ runs } as Partial<Block>)}
      onFocus={p.onFocus}
      onTexto={p.onTexto}
      onDividir={p.onDividir}
      onVacioBackspace={p.onVacioBackspace}
      onNavegar={p.onNavegar}
      {...extra}
    />
  );

  let contenido: React.ReactNode = null;
  switch (b.type) {
    case 'paragraph':
    case 'quote':
      contenido = <div className={ESTILO_TEXTO[b.type]}>{rich({})}</div>;
      break;
    case 'heading':
      contenido = <div className={cn('font-bold tracking-tight', b.level === 2 ? 'mt-3 text-2xl' : 'mt-2 text-xl')}>{rich({})}</div>;
      break;
    case 'callout': {
      const t = TONO_ICONO[b.tone];
      contenido = (
        <div className={cn('flex gap-3.5 rounded-2xl border p-4', t.caja)}>
          <t.icon className={cn('mt-0.5 size-5 shrink-0', t.titulo)} />
          <div className="min-w-0 flex-1 text-[0.95rem] leading-relaxed">
            <div className="mb-1 flex items-center gap-1">
              {(Object.keys(TONO_ICONO) as Tono[]).map((k) => (
                <button key={k} type="button" onClick={() => p.onPatch({ tone: k } as Partial<Block>)} title={TONO_ETIQUETA[k]} aria-label={`Tipo: ${TONO_ETIQUETA[k]}`} aria-pressed={b.tone === k}
                  className={cn('rounded-full px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wider transition', b.tone === k ? cn('bg-card shadow-sm', TONO_ICONO[k].titulo) : 'text-muted-foreground hover:text-foreground')}>
                  {TONO_ETIQUETA[k]}
                </button>
              ))}
            </div>
            {rich({})}
          </div>
        </div>
      );
      break;
    }
    case 'list':
      contenido = (
        <div className="prose prose-wiki max-w-none dark:prose-invert text-[1.02rem]">
          <RichText
            blockId={b.id} modo="lista" items={b.items} ordered={b.ordered} syncKey={p.sync} placeholder="Elemento de la lista" autoFocus={p.autoFocus} registro={p.registro}
            onItems={(items) => p.onPatch({ items } as Partial<Block>)} onFocus={p.onFocus} onVacioBackspace={p.onVacioBackspace} onNavegar={p.onNavegar} onSalirDeLista={p.onSalirDeLista}
          />
        </div>
      );
      break;
    case 'code':
      contenido = (
        <textarea value={b.text} onChange={(e) => p.onPatch({ text: e.target.value } as Partial<Block>)} onFocus={p.onFocusBloque} placeholder="Pegá o escribí el comando o código…" spellCheck={false} aria-label="Código"
          rows={Math.max(3, b.text.split('\n').length)} className="w-full resize-y rounded-2xl border bg-muted p-4 font-mono text-[0.85rem] leading-relaxed outline-none focus:border-ring focus:ring-4 focus:ring-ring/15" />
      );
      break;
    case 'divider':
      contenido = <hr className="my-5 border-border" tabIndex={0} onFocus={p.onFocusBloque} aria-label="Divisor" />;
      break;
    case 'image':
      contenido = b.fileId ? (
        <figure className="grid gap-3" onFocus={p.onFocusBloque}>
          <div className="relative overflow-hidden rounded-2xl border bg-muted/40">
            <img src={urlArchivo(b.fileId)} alt={b.alt} className="mx-auto max-h-80 w-auto max-w-full" />
            {p.subiendo !== null && <div className="absolute inset-0 grid place-items-center bg-background/70 text-sm font-medium"><Loader2 className="mr-2 size-4 animate-spin" />{p.subiendo}%</div>}
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <CampoChico label="Pie de foto" value={b.caption} onChange={(v) => p.onPatch({ caption: v } as Partial<Block>)} placeholder="Opcional" />
            <CampoChico label="Descripción para lectores de pantalla" value={b.alt} onChange={(v) => p.onPatch({ alt: v } as Partial<Block>)} placeholder="Qué muestra la imagen" />
          </div>
          <label className="inline-flex w-fit cursor-pointer items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground">
            <RefreshCw className="size-3.5" />Reemplazar imagen
            <input type="file" hidden accept={ACCEPT_IMAGEN} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) p.onSubir(f); }} />
          </label>
        </figure>
      ) : <ZonaSubida tipo="image" subiendo={p.subiendo} onArchivo={p.onSubir} />;
      break;
    case 'file':
      contenido = b.fileId ? (
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-2" onFocus={p.onFocusBloque}>
          <TarjetaArchivo id={b.fileId} label={b.label} meta={p.archivos[b.fileId]} />
          {/\.pdf$/i.test(p.archivos[b.fileId]?.nombre ?? '') && (
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(b.vista)} onChange={(e) => p.onPatch({ vista: e.target.checked } as Partial<Block>)} />Mostrar el PDF dentro de la página (como imágenes)</label>
          )}
          <CampoChico label="Texto del enlace (opcional)" value={b.label} onChange={(v) => p.onPatch({ label: v } as Partial<Block>)} placeholder={p.archivos[b.fileId]?.nombre ?? 'Nombre visible'} />
        </div>
      ) : <ZonaSubida tipo="file" subiendo={p.subiendo} onArchivo={p.onSubir} />;
      break;
    case 'orgchart':
      contenido = <OrgEditor nodos={b.nodos} onChange={(nodos) => p.onPatch({ nodos } as Partial<Block>)} onFocus={p.onFocusBloque} />;
      break;
    case 'table':
      contenido = <div onFocus={p.onFocusBloque}><TablaEditor b={b} onChange={(pp) => p.onPatch(pp as Partial<Block>)} /></div>;
      break;
  }

  return (
    <Reorder.Item value={b} id={b.id} as="div" dragListener={false} dragControls={controles} className="group/fila relative flex items-start gap-1 rounded-xl py-1 focus-within:bg-secondary/30" whileDrag={{ scale: 1.01, boxShadow: '0 12px 40px -12px rgb(0 0 0 / 0.3)', zIndex: 10, background: 'var(--card)' }}>
      <div className="flex w-14 shrink-0 items-center justify-end pt-1 opacity-100 transition sm:opacity-0 sm:group-focus-within/fila:opacity-100 sm:group-hover/fila:opacity-100">
        <Dropdown>
          <DropdownTrigger asChild><button type="button" aria-label="Insertar bloque debajo" title="Insertar debajo" className="grid size-7 place-items-center rounded-lg text-muted-foreground transition hover:bg-secondary hover:text-foreground"><Plus className="size-4" /></button></DropdownTrigger>
          <DropdownContent align="start" className="max-h-96 w-72 overflow-y-auto">
            <DropdownLabel>Insertar debajo</DropdownLabel>
            {CATALOGO.map((e) => <DropdownItem key={e.key} onSelect={() => p.onInsertar(e)}><e.icon />{e.label}</DropdownItem>)}
          </DropdownContent>
        </Dropdown>
        <button type="button" aria-label="Arrastrar para mover" title="Arrastrar para mover" onPointerDown={(e) => controles.start(e)} className="grid size-7 cursor-grab touch-none place-items-center rounded-lg text-muted-foreground transition hover:bg-secondary hover:text-foreground active:cursor-grabbing"><GripVertical className="size-4" /></button>
      </div>

      <div className="relative min-w-0 flex-1" onFocus={p.onFocusBloque}>
        {contenido}
        {p.slash !== null && b.type === 'paragraph' && <MenuSlash query={p.slash} onPick={p.onSlashPick} onClose={p.onSlashClose} />}
      </div>

      <div className="opacity-100 transition sm:opacity-0 sm:group-focus-within/fila:opacity-100 sm:group-hover/fila:opacity-100">
        <Dropdown>
          <DropdownTrigger asChild><button type="button" aria-label="Opciones del bloque" className="grid size-7 place-items-center rounded-lg text-muted-foreground transition hover:bg-secondary hover:text-foreground"><MoreVertical className="size-4" /></button></DropdownTrigger>
          <DropdownContent className="w-56">
            {(esTexto || b.type === 'list') && (
              <>
                <DropdownLabel>Convertir en</DropdownLabel>
                {CATALOGO.filter((e) => ['p', 'h2', 'h3', 'ul', 'ol', 'callout', 'quote'].includes(e.key)).map((e) => <DropdownItem key={e.key} onSelect={() => p.onConvertir(e)}><e.icon />{e.label}</DropdownItem>)}
                <DropdownSeparator />
              </>
            )}
            <DropdownItem onSelect={() => p.onMover(-1)}><ArrowUp />Subir</DropdownItem>
            <DropdownItem onSelect={() => p.onMover(1)}><ArrowDown />Bajar</DropdownItem>
            <DropdownItem onSelect={p.onDuplicar}><Copy />Duplicar</DropdownItem>
            <DropdownSeparator />
            <DropdownItem onSelect={p.onQuitar} className="text-destructive data-[highlighted]:bg-destructive/10 [&_svg]:text-destructive"><Trash2 />Eliminar</DropdownItem>
          </DropdownContent>
        </Dropdown>
      </div>
    </Reorder.Item>
  );
}
