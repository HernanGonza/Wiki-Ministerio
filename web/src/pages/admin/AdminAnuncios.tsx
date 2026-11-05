import { useState, type FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../../api/client';
import type { AdminAnnouncement, Prioridad } from '../../api/types';
import { errMsg, fmtFecha, useAsync } from '../../lib';
import { Cargando, ErrorMsg } from '../../components/Estados';
import { MarkdownView } from '../../components/MarkdownView';

export function AdminAnuncios() {
  const { espacio = '' } = useParams();
  const base = `/admin/spaces/${espacio}/announcements`;
  const { data, loading, error, reload } = useAsync(() => api.get<AdminAnnouncement[]>(base), [espacio]);
  const [editId, setEditId] = useState<string | null>(null);
  const [titulo, setTitulo] = useState('');
  const [cuerpo, setCuerpo] = useState('');
  const [prioridad, setPrioridad] = useState<Prioridad>('media');
  const [publicar, setPublicar] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const limpiar = () => { setEditId(null); setTitulo(''); setCuerpo(''); setPrioridad('media'); setPublicar(true); };

  async function guardar(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    try {
      const body = { titulo, cuerpo_md: cuerpo, prioridad, publicar };
      if (editId) await api.patch(`${base}/${editId}`, body);
      else await api.post(base, body);
      limpiar(); reload();
    } catch (x) { setErr(errMsg(x)); }
  }
  const run = async (fn: () => Promise<unknown>) => { setErr(null); try { await fn(); reload(); } catch (x) { setErr(errMsg(x)); } };

  return (
    <>
      <h2>Anuncios {espacio === 'ministerio' ? 'del Ministerio (visibles en todos los espacios)' : ''}</h2>
      {loading ? <Cargando /> : <ErrorMsg msg={error} />}
      <ErrorMsg msg={err} />
      <div className="tabla-wrap">
        <table className="tabla">
          <thead><tr><th>Título</th><th>Prioridad</th><th>Publicación</th><th>Visible</th><th></th></tr></thead>
          <tbody>
            {(data ?? []).map((a) => (
              <tr key={a.id}>
                <td>{a.titulo}</td><td>{a.prioridad}</td>
                <td>{a.publicado_at ? fmtFecha(a.publicado_at) : 'Borrador'}</td>
                <td>{a.visible ? 'Sí' : 'No'}</td>
                <td className="acciones">
                  <button className="btn" onClick={() => { setEditId(a.id); setTitulo(a.titulo); setCuerpo(a.cuerpo_md); setPrioridad(a.prioridad); setPublicar(Boolean(a.publicado_at)); }}>Editar</button>
                  <button className="btn" onClick={() => run(() => api.patch(`${base}/${a.id}`, { visible: !a.visible }))}>{a.visible ? 'Ocultar' : 'Mostrar'}</button>
                  <button className="btn btn-danger" onClick={() => { if (window.confirm('¿Borrar el anuncio?')) void run(() => api.del(`${base}/${a.id}`)); }}>Borrar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <form className="card form" onSubmit={guardar}>
        <h3>{editId ? 'Editar anuncio' : 'Nuevo anuncio'}</h3>
        <label>Título<input value={titulo} onChange={(e) => setTitulo(e.target.value)} required /></label>
        <div className="editor-split">
          <label>Cuerpo (Markdown)<textarea value={cuerpo} onChange={(e) => setCuerpo(e.target.value)} /></label>
          <div><span className="etiqueta">Vista previa</span><div className="preview"><MarkdownView source={cuerpo} /></div></div>
        </div>
        <div className="inline">
          <label>Prioridad
            <select value={prioridad} onChange={(e) => setPrioridad(e.target.value as Prioridad)}>
              <option value="alta">Alta</option><option value="media">Media</option><option value="baja">Baja</option>
            </select>
          </label>
          <label className="check"><input type="checkbox" checked={publicar} onChange={(e) => setPublicar(e.target.checked)} /> Publicar (si no, queda como borrador)</label>
        </div>
        <div className="inline">
          <button className="btn btn-primary">{editId ? 'Guardar cambios' : 'Crear anuncio'}</button>
          {editId && <button type="button" className="btn" onClick={limpiar}>Cancelar edición</button>}
        </div>
      </form>
    </>
  );
}
