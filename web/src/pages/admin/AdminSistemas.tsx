import { useState, type FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../../api/client';
import type { AdminSystem } from '../../api/types';
import { errMsg, slugify, useAsync } from '../../lib';
import { Cargando, ErrorMsg } from '../../components/Estados';

const vacio = { nombre: '', slug: '', url: '', ip: '', puerto: '', vm: '', descripcion: '', orden: 0, activo: true };

export function AdminSistemas() {
  const { espacio = '' } = useParams();
  const base = `/admin/spaces/${espacio}/systems`;
  const { data, loading, error, reload } = useAsync(() => api.get<AdminSystem[]>(base), [espacio]);
  const [editId, setEditId] = useState<string | null>(null);
  const [f, setF] = useState(vacio);
  const [err, setErr] = useState<string | null>(null);
  const set = <K extends keyof typeof vacio>(k: K, v: (typeof vacio)[K]) => setF({ ...f, [k]: v });

  async function guardar(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    const body = {
      nombre: f.nombre, slug: f.slug, url: f.url || null, ip: f.ip || null,
      puerto: f.puerto ? Number(f.puerto) : null, vm: f.vm || null, descripcion: f.descripcion || null,
      orden: f.orden, activo: f.activo,
    };
    try {
      if (editId) await api.patch(`${base}/${editId}`, body);
      else await api.post(base, body);
      setEditId(null); setF(vacio); reload();
    } catch (x) { setErr(errMsg(x)); }
  }
  const run = async (fn: () => Promise<unknown>) => { setErr(null); try { await fn(); reload(); } catch (x) { setErr(errMsg(x)); } };

  return (
    <>
      <h2>Sistemas {espacio === 'ministerio' ? 'transversales' : ''}</h2>
      {loading ? <Cargando /> : <ErrorMsg msg={error} />}
      <ErrorMsg msg={err} />
      <div className="tabla-wrap">
        <table className="tabla">
          <thead><tr><th>Sistema</th><th>Destino del monitor</th><th>VM</th><th>Activo</th><th></th></tr></thead>
          <tbody>
            {(data ?? []).map((s) => (
              <tr key={s.id}>
                <td>{s.nombre}</td><td>{s.url ?? `${s.ip}:${s.puerto}`}</td><td>{s.vm ?? '—'}</td><td>{s.activo ? 'Sí' : 'No'}</td>
                <td className="acciones">
                  <button className="btn" onClick={() => { setEditId(s.id); setF({ nombre: s.nombre, slug: s.slug, url: s.url ?? '', ip: s.ip ?? '', puerto: s.puerto ? String(s.puerto) : '', vm: s.vm ?? '', descripcion: s.descripcion ?? '', orden: s.orden, activo: s.activo }); }}>Editar</button>
                  <button className="btn" onClick={() => run(() => api.patch(`${base}/${s.id}`, { activo: !s.activo }))}>{s.activo ? 'Desactivar' : 'Activar'}</button>
                  <button className="btn btn-danger" onClick={() => { if (window.confirm('¿Borrar el sistema y su historial de estado?')) void run(() => api.del(`${base}/${s.id}`)); }}>Borrar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <form className="card form" onSubmit={guardar}>
        <h3>{editId ? 'Editar sistema' : 'Nuevo sistema'}</h3>
        <div className="inline">
          <label>Nombre<input value={f.nombre} onChange={(e) => { setF({ ...f, nombre: e.target.value, slug: editId ? f.slug : slugify(e.target.value) }); }} required /></label>
          <label>Slug<input value={f.slug} onChange={(e) => set('slug', e.target.value)} pattern="[a-z0-9]+(-[a-z0-9]+)*" required /></label>
          <label>VM<input value={f.vm} onChange={(e) => set('vm', e.target.value)} /></label>
          <label>Orden<input type="number" value={f.orden} onChange={(e) => set('orden', Number(e.target.value))} /></label>
        </div>
        <label>URL (http/https; si se indica, el monitor la usa)<input type="url" value={f.url} onChange={(e) => set('url', e.target.value)} /></label>
        <div className="inline">
          <label>IP (si no hay URL)<input value={f.ip} onChange={(e) => set('ip', e.target.value)} /></label>
          <label>Puerto<input type="number" min={1} max={65535} value={f.puerto} onChange={(e) => set('puerto', e.target.value)} /></label>
        </div>
        <label>Descripción<input value={f.descripcion} onChange={(e) => set('descripcion', e.target.value)} /></label>
        <label className="check"><input type="checkbox" checked={f.activo} onChange={(e) => set('activo', e.target.checked)} /> Activo (se monitorea)</label>
        <div className="inline">
          <button className="btn btn-primary">{editId ? 'Guardar cambios' : 'Crear sistema'}</button>
          {editId && <button type="button" className="btn" onClick={() => { setEditId(null); setF(vacio); }}>Cancelar edición</button>}
        </div>
      </form>
    </>
  );
}
