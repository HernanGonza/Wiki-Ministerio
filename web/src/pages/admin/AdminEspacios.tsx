import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import type { AdminSpace } from '../../api/types';
import { errMsg, slugify, useAsync } from '../../lib';
import { Cargando, ErrorMsg } from '../../components/Estados';

export function AdminEspacios() {
  const { data, loading, error, reload } = useAsync(() => api.get<AdminSpace[]>('/admin/spaces'), []);
  const [nombre, setNombre] = useState('');
  const [slug, setSlug] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [err, setErr] = useState<string | null>(null);

  async function crear(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    try {
      await api.post('/admin/spaces', { nombre, slug: slug || slugify(nombre), descripcion: descripcion || null });
      setNombre(''); setSlug(''); setDescripcion('');
      reload();
    } catch (x) { setErr(errMsg(x)); }
  }
  async function alternar(s: AdminSpace) {
    setErr(null);
    try { await api.patch(`/admin/spaces/${s.slug}`, { activo: !s.activo }); reload(); } catch (x) { setErr(errMsg(x)); }
  }
  async function borrar(s: AdminSpace) {
    if (!window.confirm(`¿Borrar el espacio "${s.nombre}"? Solo es posible si está vacío.`)) return;
    setErr(null);
    try { await api.del(`/admin/spaces/${s.slug}`); reload(); } catch (x) { setErr(errMsg(x)); }
  }

  return (
    <main className="contenido ancho">
      <nav className="breadcrumbs"><Link to="/admin">Administración</Link> › <span>Espacios</span></nav>
      <h1>Espacios</h1>
      {loading ? <Cargando /> : <ErrorMsg msg={error} />}
      <ErrorMsg msg={err} />
      <div className="tabla-wrap">
        <table className="tabla">
          <thead><tr><th>Nombre</th><th>Slug</th><th>Estado</th><th></th></tr></thead>
          <tbody>
            {(data ?? []).map((s) => (
              <tr key={s.id}>
                <td>{s.nombre}</td><td><code>{s.slug}</code></td><td>{s.activo ? 'Activo' : 'Inactivo'}</td>
                <td className="acciones">
                  {s.slug !== 'ministerio' && <button className="btn" onClick={() => alternar(s)}>{s.activo ? 'Desactivar' : 'Activar'}</button>}
                  {s.slug !== 'ministerio' && <button className="btn btn-danger" onClick={() => borrar(s)}>Borrar</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <form className="card form" onSubmit={crear}>
        <h2>Nuevo espacio</h2>
        <label>Nombre<input value={nombre} onChange={(e) => { setNombre(e.target.value); setSlug(slugify(e.target.value)); }} required /></label>
        <label>Slug (URL)<input value={slug} onChange={(e) => setSlug(e.target.value)} pattern="[a-z0-9]+(-[a-z0-9]+)*" required /></label>
        <label>Descripción<input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} /></label>
        <button className="btn btn-primary">Crear espacio</button>
      </form>
    </main>
  );
}
