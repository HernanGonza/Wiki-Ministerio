import { useEffect, useState, type FormEvent } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { ExternalLink, FilePlus2, FileText, FolderPlus, FolderTree, History, Lock, Eye, Pencil, Plus, RotateCcw, Save, Trash2, X } from 'lucide-react';
import { api, ApiError } from '@/api/client';
import type { Acceso, EditablePage, PageVersion, SectionNode } from '@/api/types';
import { errMsg, fmtFecha, slugify, useAsync } from '@/lib';
import { cn } from '@/ui/cn';
import { confirmar, confirmarBorrado, toast } from '@/ui/feedback';
import { Cargando, ErrorMsg } from '@/components/Estados';
import { BlockEditor } from '@/blocks/BlockEditor';
import { BlockRenderer } from '@/blocks/BlockRenderer';
import { bloquesDe, limpiar } from '@/blocks/convert';
import type { ArchivosMap, Block } from '@/blocks/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/field';
import { Alert, Empty } from '@/components/ui/page';
import { Sheet } from '@/components/ui/sheet';
import { Table, TableWrap, TD, TH, THead, TR } from '@/components/ui/table';

interface FlatSection { node: SectionNode; depth: number }
const flatten = (nodes: SectionNode[], depth = 1): FlatSection[] =>
  nodes.flatMap((n) => [{ node: n, depth }, ...flatten(n.children, depth + 1)]);
const descendants = (n: SectionNode): string[] => n.children.flatMap((c) => [c.id, ...descendants(c)]);

// ───────── Formulario de sección (en cajón) ─────────
function SeccionForm({ espacio, flat, editando, padreInicial, onDone }: {
  espacio: string; flat: FlatSection[]; editando: SectionNode | null; padreInicial: string | null; onDone: () => void;
}) {
  const [titulo, setTitulo] = useState(editando?.titulo ?? '');
  const [slug, setSlug] = useState(editando?.slug ?? '');
  const [descripcion, setDescripcion] = useState(editando?.descripcion ?? '');
  const [icono, setIcono] = useState(editando?.icono ?? '');
  const [orden, setOrden] = useState(editando?.orden ?? 0);
  const [acceso, setAcceso] = useState<Acceso>(editando?.acceso ?? 'general');
  const [padre, setPadre] = useState<string>(editando ? editando.padre_id ?? '' : padreInicial ?? '');
  const [err, setErr] = useState<string | null>(null);

  const excluidos = new Set(editando ? [editando.id, ...descendants(editando)] : []);
  // El padre no puede estar en el nivel 3 (los hijos pasarían a nivel 4).
  const opciones = flat.filter((f) => !excluidos.has(f.node.id) && f.depth < 3);

  async function guardar(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    const body = { titulo, slug, descripcion: descripcion || null, icono: icono || null, orden, acceso, padre_id: padre || null };
    try {
      if (editando) await api.patch(`/admin/spaces/${espacio}/sections/${editando.id}`, body);
      else await api.post(`/admin/spaces/${espacio}/sections`, body);
      toast.ok(editando ? 'Sección actualizada' : 'Sección creada');
      onDone();
    } catch (x) { setErr(errMsg(x)); }
  }

  return (
    <form onSubmit={guardar} className="grid gap-4">
      <Field label="Título">{(id) => <Input id={id} value={titulo} onChange={(e) => { setTitulo(e.target.value); if (!editando) setSlug(slugify(e.target.value)); }} required autoFocus />}</Field>
      <Field label="Slug (URL)">{(id) => <Input id={id} value={slug} onChange={(e) => setSlug(e.target.value)} pattern="[a-z0-9]+(-[a-z0-9]+)*" required />}</Field>
      <Field label="Sección superior">{(id) => (
        <Select id={id} value={padre} onChange={(e) => setPadre(e.target.value)}>
          <option value="">(ninguna: nivel 1)</option>
          {opciones.map((f) => <option key={f.node.id} value={f.node.id}>{'— '.repeat(f.depth - 1)}{f.node.titulo}</option>)}
        </Select>
      )}</Field>
      <Field label="Descripción">{(id) => <Input id={id} value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />}</Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Ícono (emoji)">{(id) => <Input id={id} value={icono} maxLength={8} onChange={(e) => setIcono(e.target.value)} />}</Field>
        <Field label="Orden">{(id) => <Input id={id} type="number" value={orden} onChange={(e) => setOrden(Number(e.target.value))} />}</Field>
        <Field label="Acceso">{(id) => (
          <Select id={id} value={acceso} onChange={(e) => setAcceso(e.target.value as Acceso)}>
            <option value="general">General</option>
            <option value="restringido">Restringido</option>
          </Select>
        )}</Field>
      </div>
      {err && <Alert>{err}</Alert>}
      <Button type="submit" size="lg">{editando ? 'Guardar cambios' : 'Crear sección'}</Button>
    </form>
  );
}

// ───────── Editor de página ─────────
function PaginaEditor({ espacio, pageId, tree, onChanged, onClose }: {
  espacio: string; pageId: string | 'nueva'; tree: SectionNode[]; onChanged: () => void; onClose: () => void;
}) {
  const base = `/admin/spaces/${espacio}`;
  const flat = flatten(tree);
  const [params] = useSearchParams();
  const nueva = pageId === 'nueva';
  const [cargada, setCargada] = useState<EditablePage | null>(null);
  const [titulo, setTitulo] = useState('');
  const [slug, setSlug] = useState('');
  const [acceso, setAcceso] = useState<Acceso>('general');
  const [sectionId, setSectionId] = useState(params.get('seccion') ?? flat[0]?.node.id ?? '');
  const [bloques, setBloques] = useState<Block[]>([]);
  const [archivos, setArchivos] = useState<ArchivosMap>({});
  const [vista, setVista] = useState<'editar' | 'previa'>('editar');
  const [err, setErr] = useState<string | null>(null);
  const [conflicto, setConflicto] = useState<EditablePage | null>(null);
  const [verHist, setVerHist] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const aplicar = (p: EditablePage) => {
    setCargada(p); setTitulo(p.titulo); setSlug(p.slug); setAcceso(p.acceso); setSectionId(p.section_id);
    setBloques(bloquesDe(p.contenido_json, p.contenido_md)); setArchivos(p.archivos ?? {});
  };

  const carga = useAsync(async () => {
    if (nueva) return null;
    const p = await api.get<EditablePage>(`${base}/pages/${pageId}`);
    aplicar(p);
    return p;
  }, [pageId, espacio]);

  const hist = useAsync(
    () => (nueva || !verHist ? Promise.resolve([] as PageVersion[]) : api.get<PageVersion[]>(`${base}/pages/${pageId}/versions`)),
    [pageId, verHist, cargada?.version],
  );

  const snapshot = cargada ? JSON.stringify(limpiar(bloquesDe(cargada.contenido_json, cargada.contenido_md))) : '';
  const sinCambios = !nueva && cargada && cargada.titulo === titulo && cargada.slug === slug && cargada.acceso === acceso && cargada.section_id === sectionId && snapshot === JSON.stringify(limpiar(bloques));

  async function guardar(e: FormEvent) {
    e.preventDefault();
    setErr(null); setConflicto(null); setGuardando(true);
    try {
      if (nueva) {
        const p = await api.post<EditablePage>(`${base}/pages`, { section_id: sectionId, slug, titulo, contenido_json: limpiar(bloques), acceso });
        onChanged(); aplicar(p); toast.ok('Página creada');
      } else if (cargada) {
        const p = await api.put<EditablePage>(`${base}/pages/${cargada.id}`, { version: cargada.version, slug, titulo, contenido_json: limpiar(bloques), acceso, section_id: sectionId });
        aplicar(p); onChanged(); toast.ok(`Guardado · versión ${p.version}`);
      }
    } catch (x) {
      if (x instanceof ApiError && x.status === 409 && x.body.actual) setConflicto(x.body.actual as EditablePage);
      else setErr(errMsg(x));
    } finally { setGuardando(false); }
  }

  async function restaurar(version: number) {
    if (!cargada) return;
    if (!(await confirmar({ titulo: `¿Restaurar la versión ${version}?`, texto: 'Se guardará como una versión nueva; no se pierde el historial.', confirmar: 'Restaurar' }))) return;
    setErr(null);
    try {
      const p = await api.post<EditablePage>(`${base}/pages/${cargada.id}/restore`, { version, version_base: cargada.version });
      aplicar(p); onChanged(); toast.ok(`Versión ${version} restaurada como versión ${p.version}`);
    } catch (x) {
      if (x instanceof ApiError && x.status === 409 && x.body.actual) setConflicto(x.body.actual as EditablePage);
      else setErr(errMsg(x));
    }
  }

  async function borrar() {
    if (!cargada) return;
    if (!(await confirmarBorrado('esta página', 'Se borra también todo su historial de versiones.'))) return;
    try { await api.del(`${base}/pages/${cargada.id}`); onChanged(); toast.ok('Página borrada'); onClose(); } catch (x) { setErr(errMsg(x)); }
  }

  if (carga.loading && !nueva) return <Cargando />;
  if (carga.error && !nueva) return <ErrorMsg msg={carga.error} />;

  return (
    <form onSubmit={guardar} className="@container grid gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-bold tracking-tight">{nueva ? 'Nueva página' : 'Editar página'}</h2>
          {cargada && <Badge variant="outline">Versión {cargada.version}</Badge>}
        </div>
        <div className="flex flex-wrap gap-2">
          {!nueva && <Button type="button" variant="outline" size="sm" onClick={() => setVerHist(!verHist)}><History />{verHist ? 'Ocultar historial' : 'Historial'}</Button>}
          {!nueva && <Button type="button" variant="soft" size="sm" onClick={borrar}><Trash2 />Borrar</Button>}
          <Button type="button" variant="ghost" size="sm" onClick={onClose}><X />Cerrar</Button>
        </div>
      </div>

      <div className="grid gap-4 rounded-2xl border bg-card p-5 shadow-sm sm:grid-cols-2 xl:grid-cols-4">
        <Field label="Título" className="xl:col-span-2">{(id) => <Input id={id} value={titulo} onChange={(e) => { setTitulo(e.target.value); if (nueva) setSlug(slugify(e.target.value)); }} required />}</Field>
        <Field label="Slug">{(id) => <Input id={id} value={slug} onChange={(e) => setSlug(e.target.value)} pattern="[a-z0-9]+(-[a-z0-9]+)*" required />}</Field>
        <Field label="Acceso">{(id) => (
          <Select id={id} value={acceso} onChange={(e) => setAcceso(e.target.value as Acceso)}><option value="general">General</option><option value="restringido">Restringido</option></Select>
        )}</Field>
        <Field label="Sección" className="sm:col-span-2 xl:col-span-4">{(id) => (
          <Select id={id} value={sectionId} onChange={(e) => setSectionId(e.target.value)} required>
            {flat.map((f) => <option key={f.node.id} value={f.node.id}>{'— '.repeat(f.depth - 1)}{f.node.titulo}</option>)}
          </Select>
        )}</Field>
      </div>

      <AnimatePresence>
        {conflicto && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <Alert tone="warn">
              <p className="font-semibold">La página fue modificada por otra persona (ahora está en la versión {conflicto.version}).</p>
              <p className="mt-0.5">Tus cambios no se guardaron.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button type="button" size="sm" variant="outline" onClick={() => { aplicar(conflicto); setConflicto(null); }}>Cargar la versión actual (se pierde lo escrito)</Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => setConflicto(null)}>Seguir editando</Button>
              </div>
            </Alert>
          </motion.div>
        )}
      </AnimatePresence>
      {err && <Alert>{err}</Alert>}

      <div className="flex gap-1 rounded-full border bg-card p-1 @4xl:hidden" role="tablist">
        {(['editar', 'previa'] as const).map((v) => (
          <button key={v} type="button" role="tab" aria-selected={vista === v} onClick={() => setVista(v)}
            className={cn('flex-1 rounded-full py-1.5 text-sm font-semibold transition', vista === v ? 'bg-primary text-primary-foreground' : 'text-muted-foreground')}>
            {v === 'editar' ? 'Editar' : 'Vista previa'}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-1 items-start gap-5 @4xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className={cn('min-w-0', vista === 'previa' && 'hidden @4xl:block')}>
          <BlockEditor espacio={espacio} acceso={acceso} value={bloques} onChange={setBloques} archivos={archivos}
            onArchivo={(id, meta) => setArchivos((a) => ({ ...a, [id]: meta }))} />
        </div>
        <div className={cn('grid min-w-0 content-start gap-1.5 @4xl:sticky @4xl:top-20', vista === 'editar' && 'hidden @4xl:grid')}>
          <span className="flex items-center gap-1.5 text-[0.82rem] font-semibold text-foreground/80"><Eye className="size-3.5" />Así se va a ver</span>
          <div className="min-h-[30rem] overflow-auto rounded-2xl border bg-card p-6 shadow-sm @4xl:max-h-[calc(100dvh-8rem)]">
            <h1 className="mb-4 text-3xl font-bold tracking-tight">{titulo || 'Sin título'}</h1>
            {limpiar(bloques).length ? <BlockRenderer blocks={limpiar(bloques)} archivos={archivos} /> : <p className="text-sm text-muted-foreground">La vista previa se va armando mientras escribís.</p>}
          </div>
        </div>
      </div>

      <div className="sticky bottom-4 z-10 flex flex-wrap items-center gap-3 rounded-full border bg-card/90 px-3 py-2.5 shadow-lg backdrop-blur">
        <Button type="submit" loading={guardando} disabled={Boolean(sinCambios)}><Save />{nueva ? 'Crear página' : 'Guardar'}</Button>
        <span className={cn('text-xs', sinCambios ? 'text-muted-foreground' : 'font-medium text-warning')}>
          {nueva ? 'Página sin crear' : sinCambios ? 'Sin cambios' : 'Cambios sin guardar'}
        </span>
      </div>

      <AnimatePresence initial={false}>
        {verHist && !nueva && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <h3 className="mb-3 flex items-center gap-2 font-bold"><History className="size-4" />Historial de versiones</h3>
            {hist.loading ? <Cargando variante="tabla" /> : (
              <TableWrap>
                <Table>
                  <THead><tr><TH>Versión</TH><TH>Título</TH><TH>Fecha</TH><TH>Autor</TH><TH className="text-right">Acciones</TH></tr></THead>
                  <tbody>
                    {(hist.data ?? []).map((v) => (
                      <TR key={v.version}>
                        <TD className="font-semibold">{v.version}{cargada?.version === v.version && <Badge variant="primary" className="ml-2">actual</Badge>}</TD>
                        <TD>{v.titulo}</TD>
                        <TD className="whitespace-nowrap text-muted-foreground">{fmtFecha(v.created_at)}</TD>
                        <TD>{v.autor ?? '—'}</TD>
                        <TD>
                          <div className="flex justify-end gap-1.5">
                            <Button type="button" size="sm" variant="outline" onClick={async () => { try { const d = await api.get<{ contenido_md: string; contenido_json: Block[] | null; archivos?: ArchivosMap }>(`${base}/pages/${cargada!.id}/versions/${v.version}`); setBloques(bloquesDe(d.contenido_json, d.contenido_md)); setArchivos((a) => ({ ...a, ...(d.archivos ?? {}) })); toast.info(`Versión ${v.version} cargada en el editor`); } catch (x) { setErr(errMsg(x)); } }}>Ver en el editor</Button>
                            {cargada?.version !== v.version && <Button type="button" size="sm" variant="outline" onClick={() => restaurar(v.version)}><RotateCcw />Restaurar</Button>}
                          </div>
                        </TD>
                      </TR>
                    ))}
                  </tbody>
                </Table>
              </TableWrap>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </form>
  );
}

// ───────── Pantalla ─────────
export function AdminContenido() {
  const { espacio = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const tree = useAsync(() => api.get<SectionNode[]>(`/spaces/${espacio}/sections`), [espacio]);
  const [formSec, setFormSec] = useState<{ editando: SectionNode | null; padre: string | null } | null>(null);
  const paginaSel = params.get('pagina');

  useEffect(() => setFormSec(null), [espacio]);

  const abrirPagina = (id: string, seccion?: string) => setParams(id === 'nueva' ? { pagina: 'nueva', ...(seccion ? { seccion } : {}) } : { pagina: id });
  const cerrar = () => setParams({});

  async function borrarSeccion(n: SectionNode) {
    if (!(await confirmarBorrado(`la sección "${n.titulo}"`, `Se borran también sus ${n.pages.length} páginas.`))) return;
    try { await api.del(`/admin/spaces/${espacio}/sections/${n.id}`); toast.ok('Sección borrada'); tree.reload(); } catch (x) { toast.error(errMsg(x)); }
  }

  if (tree.loading && !tree.data) return <Cargando />;
  const nodes = tree.data ?? [];
  const flat = flatten(nodes);

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[20rem_1fr]">
      <aside className="rounded-2xl border bg-card p-3 shadow-sm lg:sticky lg:top-20 lg:max-h-[calc(100dvh-7rem)] lg:overflow-y-auto">
        <div className="mb-3 flex gap-2">
          <Button size="sm" className="flex-1" onClick={() => setFormSec({ editando: null, padre: null })}><FolderPlus />Sección</Button>
          <Button size="sm" variant="outline" className="flex-1" onClick={() => abrirPagina('nueva')} disabled={!flat.length}><FilePlus2 />Página</Button>
        </div>
        <ErrorMsg msg={tree.error} />
        {!flat.length && <Empty icon={<FolderTree />}>Creá la primera sección.</Empty>}
        <ul className="grid gap-1">
          {flat.map(({ node: n, depth }) => (
            <li key={n.id} style={{ paddingLeft: (depth - 1) * 14 }}>
              <div className="group flex items-center gap-1 rounded-xl px-2 py-1.5 hover:bg-secondary/60">
                <span className="text-base leading-none">{n.icono ?? '📁'}</span>
                <span className="min-w-0 flex-1 truncate text-sm font-semibold">{n.titulo}</span>
                {n.restringido && <Lock className="size-3.5 text-muted-foreground" />}
                <span className="flex opacity-0 transition group-focus-within:opacity-100 group-hover:opacity-100">
                  <button title="Nueva página aquí" aria-label="Nueva página en esta sección" onClick={() => abrirPagina('nueva', n.id)} className="grid size-7 place-items-center rounded-lg hover:bg-background"><FilePlus2 className="size-3.5" /></button>
                  {depth < 3 && <button title="Nueva subsección" aria-label="Nueva subsección" onClick={() => setFormSec({ editando: null, padre: n.id })} className="grid size-7 place-items-center rounded-lg hover:bg-background"><Plus className="size-3.5" /></button>}
                  <button title="Editar sección" aria-label="Editar sección" onClick={() => setFormSec({ editando: n, padre: null })} className="grid size-7 place-items-center rounded-lg hover:bg-background"><Pencil className="size-3.5" /></button>
                  <button title="Borrar sección" aria-label="Borrar sección" onClick={() => borrarSeccion(n)} className="grid size-7 place-items-center rounded-lg text-destructive hover:bg-destructive/10"><Trash2 className="size-3.5" /></button>
                </span>
              </div>
              {n.pages.map((p) => (
                <button key={p.id} onClick={() => abrirPagina(p.id)}
                  className={cn('ml-5 flex w-[calc(100%-1.25rem)] items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[0.82rem] transition', paginaSel === p.id ? 'bg-primary/12 font-semibold text-primary' : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground')}>
                  <FileText className="size-3.5 shrink-0" /><span className="truncate">{p.titulo}</span>{p.restringido && <Lock className="ml-auto size-3 shrink-0" />}
                </button>
              ))}
            </li>
          ))}
        </ul>
        <Button asChild variant="ghost" size="sm" className="mt-3 w-full"><Link to={`/${espacio}`}><ExternalLink />Ver el espacio publicado</Link></Button>
      </aside>

      <section className="min-w-0">
        {paginaSel ? (
          <PaginaEditor key={paginaSel} espacio={espacio} pageId={paginaSel} tree={nodes} onChanged={tree.reload} onClose={cerrar} />
        ) : (
          <Empty icon={<FileText />}>Elegí una página del árbol para editarla, o creá una sección o página nueva.</Empty>
        )}
      </section>

      <Sheet open={formSec !== null} onOpenChange={(o) => { if (!o) setFormSec(null); }} title={formSec?.editando ? 'Editar sección' : 'Nueva sección'} description="Las secciones organizan las páginas y arman el menú lateral.">
        {formSec && (
          <SeccionForm key={formSec.editando?.id ?? `n-${formSec.padre}`} espacio={espacio} flat={flat} editando={formSec.editando} padreInicial={formSec.padre}
            onDone={() => { setFormSec(null); tree.reload(); }} />
        )}
      </Sheet>
    </div>
  );
}
