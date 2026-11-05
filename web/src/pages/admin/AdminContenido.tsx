import { useEffect, useState, type FormEvent } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { api, ApiError } from '../../api/client';
import type { Acceso, EditablePage, PageVersion, SectionNode } from '../../api/types';
import { errMsg, fmtFecha, slugify, useAsync } from '../../lib';
import { Cargando, ErrorMsg } from '../../components/Estados';
import { MarkdownView } from '../../components/MarkdownView';

interface FlatSection { node: SectionNode; depth: number }
const flatten = (nodes: SectionNode[], depth = 1): FlatSection[] =>
  nodes.flatMap((n) => [{ node: n, depth }, ...flatten(n.children, depth + 1)]);
const descendants = (n: SectionNode): string[] => n.children.flatMap((c) => [c.id, ...descendants(c)]);

// ───────── Formulario de sección ─────────
function SeccionForm({ espacio, flat, editando, padreInicial, onDone, onCancel }: {
  espacio: string; flat: FlatSection[]; editando: SectionNode | null; padreInicial: string | null;
  onDone: () => void; onCancel: () => void;
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
      onDone();
    } catch (x) { setErr(errMsg(x)); }
  }

  return (
    <form className="card form" onSubmit={guardar}>
      <h3>{editando ? 'Editar sección' : 'Nueva sección'}</h3>
      <label>Título<input value={titulo} onChange={(e) => { setTitulo(e.target.value); if (!editando) setSlug(slugify(e.target.value)); }} required /></label>
      <label>Slug (URL)<input value={slug} onChange={(e) => setSlug(e.target.value)} pattern="[a-z0-9]+(-[a-z0-9]+)*" required /></label>
      <label>Sección superior
        <select value={padre} onChange={(e) => setPadre(e.target.value)}>
          <option value="">(ninguna: nivel 1)</option>
          {opciones.map((f) => <option key={f.node.id} value={f.node.id}>{'— '.repeat(f.depth - 1)}{f.node.titulo}</option>)}
        </select>
      </label>
      <label>Descripción<input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} /></label>
      <div className="inline">
        <label>Ícono<input value={icono} maxLength={8} onChange={(e) => setIcono(e.target.value)} /></label>
        <label>Orden<input type="number" value={orden} onChange={(e) => setOrden(Number(e.target.value))} /></label>
        <label>Acceso
          <select value={acceso} onChange={(e) => setAcceso(e.target.value as Acceso)}>
            <option value="general">General</option>
            <option value="restringido">Restringido (solo administración)</option>
          </select>
        </label>
      </div>
      <ErrorMsg msg={err} />
      <div className="inline">
        <button className="btn btn-primary">Guardar</button>
        <button type="button" className="btn" onClick={onCancel}>Cancelar</button>
      </div>
    </form>
  );
}

// ───────── Editor de página ─────────
function PaginaEditor({ espacio, pageId, tree, onChanged, onClose }: {
  espacio: string | null | undefined; pageId: string | 'nueva'; tree: SectionNode[];
  onChanged: () => void; onClose: () => void;
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
  const [contenido, setContenido] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [conflicto, setConflicto] = useState<EditablePage | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [verHist, setVerHist] = useState(false);

  const aplicar = (p: EditablePage) => {
    setCargada(p); setTitulo(p.titulo); setSlug(p.slug); setAcceso(p.acceso); setSectionId(p.section_id); setContenido(p.contenido_md);
  };

  const carga = useAsync(async () => {
    if (nueva) return null;
    const p = await api.get<EditablePage>(`${base}/pages/${pageId}`);
    aplicar(p);
    return p;
  }, [pageId, espacio]);

  const hist = useAsync(() => (nueva || !verHist ? Promise.resolve([] as PageVersion[]) : api.get<PageVersion[]>(`${base}/pages/${pageId}/versions`)), [pageId, verHist, cargada?.version]);

  async function guardar(e: FormEvent) {
    e.preventDefault();
    setErr(null); setOk(null); setConflicto(null);
    try {
      if (nueva) {
        const p = await api.post<EditablePage>(`${base}/pages`, { section_id: sectionId, slug, titulo, contenido_md: contenido, acceso });
        onChanged();
        aplicar(p);
        setOk('Página creada.');
      } else if (cargada) {
        const p = await api.put<EditablePage>(`${base}/pages/${cargada.id}`, { version: cargada.version, slug, titulo, contenido_md: contenido, acceso, section_id: sectionId });
        aplicar(p); onChanged(); setOk(`Guardado (versión ${p.version}).`);
      }
    } catch (x) {
      if (x instanceof ApiError && x.status === 409 && x.body.actual) setConflicto(x.body.actual as EditablePage);
      else setErr(errMsg(x));
    }
  }

  async function restaurar(version: number) {
    if (!cargada || !window.confirm(`¿Restaurar la versión ${version}? Se guardará como una versión nueva.`)) return;
    setErr(null); setOk(null);
    try {
      const p = await api.post<EditablePage>(`${base}/pages/${cargada.id}/restore`, { version, version_base: cargada.version });
      aplicar(p); onChanged(); setOk(`Versión ${version} restaurada como versión ${p.version}.`);
    } catch (x) {
      if (x instanceof ApiError && x.status === 409 && x.body.actual) setConflicto(x.body.actual as EditablePage);
      else setErr(errMsg(x));
    }
  }

  async function borrar() {
    if (!cargada || !window.confirm('¿Borrar esta página y todo su historial?')) return;
    try { await api.del(`${base}/pages/${cargada.id}`); onChanged(); onClose(); } catch (x) { setErr(errMsg(x)); }
  }

  if (carga.loading && !nueva) return <Cargando />;

  return (
    <form className="editor" onSubmit={guardar}>
      <div className="inline">
        <label>Título<input value={titulo} onChange={(e) => { setTitulo(e.target.value); if (nueva) setSlug(slugify(e.target.value)); }} required /></label>
        <label>Slug<input value={slug} onChange={(e) => setSlug(e.target.value)} pattern="[a-z0-9]+(-[a-z0-9]+)*" required /></label>
        <label>Sección
          <select value={sectionId} onChange={(e) => setSectionId(e.target.value)} required>
            {flat.map((f) => <option key={f.node.id} value={f.node.id}>{'— '.repeat(f.depth - 1)}{f.node.titulo}</option>)}
          </select>
        </label>
        <label>Acceso
          <select value={acceso} onChange={(e) => setAcceso(e.target.value as Acceso)}>
            <option value="general">General</option><option value="restringido">Restringido</option>
          </select>
        </label>
      </div>

      {conflicto && (
        <div className="aviso" role="alert">
          La página fue modificada por otra persona (ahora está en la versión {conflicto.version}). Los cambios no se guardaron.
          <div className="inline">
            <button type="button" className="btn" onClick={() => { aplicar(conflicto); setConflicto(null); }}>Cargar la versión actual (se pierde lo escrito)</button>
            <button type="button" className="btn" onClick={() => setConflicto(null)}>Seguir editando</button>
          </div>
        </div>
      )}
      <ErrorMsg msg={err} />
      {ok && <p className="ok" role="status">{ok}</p>}

      <div className="editor-split">
        <label>Contenido (Markdown)
          <textarea value={contenido} onChange={(e) => setContenido(e.target.value)} spellCheck />
        </label>
        <div>
          <span className="etiqueta">Vista previa</span>
          <div className="preview"><MarkdownView source={contenido} /></div>
        </div>
      </div>

      <div className="inline">
        <button className="btn btn-primary">{nueva ? 'Crear página' : 'Guardar'}</button>
        {!nueva && <button type="button" className="btn" onClick={() => setVerHist(!verHist)}>{verHist ? 'Ocultar historial' : 'Historial de versiones'}</button>}
        {!nueva && <button type="button" className="btn btn-danger" onClick={borrar}>Borrar página</button>}
        <button type="button" className="btn" onClick={onClose}>Cerrar</button>
      </div>

      {verHist && !nueva && (
        <div className="card">
          <h3>Historial</h3>
          {hist.loading ? <Cargando /> : (
            <table className="tabla">
              <thead><tr><th>Versión</th><th>Título</th><th>Fecha</th><th>Autor</th><th></th></tr></thead>
              <tbody>
                {(hist.data ?? []).map((v) => (
                  <tr key={v.version}>
                    <td>{v.version}{cargada?.version === v.version ? ' (actual)' : ''}</td><td>{v.titulo}</td><td>{fmtFecha(v.created_at)}</td><td>{v.autor ?? '—'}</td>
                    <td className="acciones">
                      <button type="button" className="btn" onClick={async () => { try { const d = await api.get<{ contenido_md: string }>(`${base}/pages/${cargada!.id}/versions/${v.version}`); setContenido(d.contenido_md); } catch (x) { setErr(errMsg(x)); } }}>Ver en el editor</button>
                      {cargada?.version !== v.version && <button type="button" className="btn" onClick={() => restaurar(v.version)}>Restaurar</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </form>
  );
}

// ───────── Pantalla ─────────
export function AdminContenido() {
  const { espacio = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const tree = useAsync(() => api.get<SectionNode[]>(`/spaces/${espacio}/sections`), [espacio]);
  const [formSec, setFormSec] = useState<{ editando: SectionNode | null; padre: string | null } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const paginaSel = params.get('pagina');

  useEffect(() => setFormSec(null), [espacio]);

  const abrirPagina = (id: string, seccion?: string) => setParams(id === 'nueva' ? { pagina: 'nueva', ...(seccion ? { seccion } : {}) } : { pagina: id });
  const cerrar = () => setParams({});

  async function borrarSeccion(n: SectionNode) {
    if (!window.confirm(`¿Borrar la sección "${n.titulo}" y sus ${n.pages.length} páginas?`)) return;
    setErr(null);
    try { await api.del(`/admin/spaces/${espacio}/sections/${n.id}`); tree.reload(); } catch (x) { setErr(errMsg(x)); }
  }

  if (tree.loading && !tree.data) return <Cargando />;
  const nodes = tree.data ?? [];
  const flat = flatten(nodes);

  return (
    <div className="admin-contenido">
      <aside>
        <div className="inline">
          <button className="btn btn-primary" onClick={() => setFormSec({ editando: null, padre: null })}>＋ Sección</button>
          <button className="btn" onClick={() => abrirPagina('nueva')} disabled={!flat.length}>＋ Página</button>
        </div>
        <ErrorMsg msg={tree.error ?? err} />
        <ul className="arbol">
          {flat.map(({ node: n, depth }) => (
            <li key={n.id} className={`nivel-${depth}`}>
              <div className="arbol-seccion">
                <strong>{n.icono} {n.titulo}{n.restringido ? ' 🔒' : ''}</strong>
                <span className="acciones">
                  <button className="btn-link-plain" onClick={() => abrirPagina('nueva', n.id)}>＋página</button>
                  {depth < 3 && <button className="btn-link-plain" onClick={() => setFormSec({ editando: null, padre: n.id })}>＋sub</button>}
                  <button className="btn-link-plain" onClick={() => setFormSec({ editando: n, padre: null })}>editar</button>
                  <button className="btn-link-plain" onClick={() => borrarSeccion(n)}>borrar</button>
                </span>
              </div>
              <ul>
                {n.pages.map((p) => (
                  <li key={p.id}>
                    <button className={`btn-link-plain ${paginaSel === p.id ? 'active' : ''}`} onClick={() => abrirPagina(p.id)}>{p.titulo}{p.restringido ? ' 🔒' : ''}</button>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </aside>
      <section>
        {formSec && (
          <SeccionForm
            key={formSec.editando?.id ?? `n-${formSec.padre}`}
            espacio={espacio} flat={flat} editando={formSec.editando} padreInicial={formSec.padre}
            onDone={() => { setFormSec(null); tree.reload(); }} onCancel={() => setFormSec(null)}
          />
        )}
        {paginaSel ? (
          <PaginaEditor key={paginaSel} espacio={espacio} pageId={paginaSel} tree={nodes} onChanged={tree.reload} onClose={cerrar} />
        ) : (
          !formSec && <p className="muted">Elegir una página del árbol para editarla, o crear una sección o página nueva.</p>
        )}
      </section>
    </div>
  );
}
