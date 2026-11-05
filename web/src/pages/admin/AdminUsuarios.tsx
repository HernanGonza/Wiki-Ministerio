import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import type { AdminSpace, AdminUser } from '../../api/types';
import { errMsg, fmtFecha, useAsync } from '../../lib';
import { Cargando, ErrorMsg } from '../../components/Estados';

const MIN = 12;

export function AdminUsuarios() {
  const users = useAsync(() => api.get<AdminUser[]>('/admin/users'), []);
  const spaces = useAsync(() => api.get<AdminSpace[]>('/admin/spaces'), []);
  const [err, setErr] = useState<string | null>(null);
  const [form, setForm] = useState({ email: '', nombre: '', password: '', es_admin_global: false });
  const [rolSel, setRolSel] = useState<Record<string, { slug: string; rol: string }>>({});

  const run = async (fn: () => Promise<unknown>) => {
    setErr(null);
    try { await fn(); users.reload(); } catch (x) { setErr(errMsg(x)); }
  };

  async function crear(e: FormEvent) {
    e.preventDefault();
    await run(async () => {
      await api.post('/admin/users', form);
      setForm({ email: '', nombre: '', password: '', es_admin_global: false });
    });
  }
  const espacios = (spaces.data ?? []).filter((s) => s.slug !== 'ministerio');

  return (
    <main className="contenido ancho">
      <nav className="breadcrumbs"><Link to="/admin">Administración</Link> › <span>Usuarios</span></nav>
      <h1>Usuarios y roles</h1>
      {users.loading ? <Cargando /> : <ErrorMsg msg={users.error} />}
      <ErrorMsg msg={err} />
      <div className="tabla-wrap">
        <table className="tabla">
          <thead><tr><th>Usuario</th><th>Roles</th><th>Último ingreso</th><th></th></tr></thead>
          <tbody>
            {(users.data ?? []).map((u) => {
              const sel = rolSel[u.id] ?? { slug: espacios[0]?.slug ?? '', rol: 'general' };
              return (
                <tr key={u.id} className={u.activo ? undefined : 'inactivo'}>
                  <td>
                    <strong>{u.nombre}</strong><br /><span className="muted">{u.email}</span>
                    {u.es_admin_global && <span className="badge">Admin global</span>}
                    {!u.activo && <span className="badge">Inactivo</span>}
                    {u.must_change_password && <span className="badge">Cambio pendiente</span>}
                  </td>
                  <td>
                    {u.roles.map((r) => (
                      <div key={r.slug}>
                        {r.nombre}: {r.rol === 'admin_espacio' ? 'administra' : 'lectura'}{' '}
                        <button className="btn-link-plain" onClick={() => run(() => api.del(`/admin/users/${u.id}/roles/${r.slug}`))}>quitar</button>
                      </div>
                    ))}
                    <div className="inline">
                      <select aria-label="Espacio" value={sel.slug} onChange={(e) => setRolSel({ ...rolSel, [u.id]: { ...sel, slug: e.target.value } })}>
                        {espacios.map((s) => <option key={s.slug} value={s.slug}>{s.nombre}</option>)}
                      </select>
                      <select aria-label="Rol" value={sel.rol} onChange={(e) => setRolSel({ ...rolSel, [u.id]: { ...sel, rol: e.target.value } })}>
                        <option value="general">Lectura (general)</option>
                        <option value="admin_espacio">Administra el espacio</option>
                      </select>
                      <button className="btn" disabled={!sel.slug} onClick={() => run(() => api.put(`/admin/users/${u.id}/roles/${sel.slug}`, { rol: sel.rol }))}>Asignar</button>
                    </div>
                  </td>
                  <td>{fmtFecha(u.last_login_at)}</td>
                  <td className="acciones">
                    <button className="btn" onClick={() => {
                      const pw = window.prompt(`Contraseña temporal para ${u.email} (mínimo ${MIN} caracteres). Entregarla por un medio seguro.`);
                      if (pw) void run(() => api.patch(`/admin/users/${u.id}`, { password: pw }));
                    }}>Restablecer clave</button>
                    <button className="btn" onClick={() => run(() => api.patch(`/admin/users/${u.id}`, { activo: !u.activo }))}>{u.activo ? 'Desactivar' : 'Activar'}</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <form className="card form" onSubmit={crear}>
        <h2>Nuevo usuario</h2>
        <label>Correo electrónico<input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></label>
        <label>Nombre<input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} required /></label>
        <label>Contraseña temporal (mínimo {MIN} caracteres)
          <input type="text" autoComplete="off" minLength={MIN} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
        </label>
        <label className="check"><input type="checkbox" checked={form.es_admin_global} onChange={(e) => setForm({ ...form, es_admin_global: e.target.checked })} /> Administrador global</label>
        <p className="muted">Deberá cambiar la contraseña en el primer ingreso. Entregarla fuera de la Wiki.</p>
        <button className="btn btn-primary">Crear usuario</button>
      </form>
    </main>
  );
}
