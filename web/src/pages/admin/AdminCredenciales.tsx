import { useState, type FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../../api/client';
import type { AdminSystem, CredentialRef } from '../../api/types';
import { errMsg, useAsync } from '../../lib';
import { Cargando, ErrorMsg } from '../../components/Estados';

const vacio = { titulo: '', system_id: '', usuario_referencia: '', vault_item_name: '', vault_collection: '', notas: '' };

export function AdminCredenciales() {
  const { espacio = '' } = useParams();
  const base = `/admin/spaces/${espacio}/credential-refs`;
  const { data, loading, error, reload } = useAsync(() => api.get<{ vault_url: string | null; items: CredentialRef[] }>(base), [espacio]);
  const sistemas = useAsync(() => api.get<AdminSystem[]>(`/admin/spaces/${espacio}/systems`), [espacio]);
  const [editId, setEditId] = useState<string | null>(null);
  const [f, setF] = useState(vacio);
  const [err, setErr] = useState<string | null>(null);
  const set = <K extends keyof typeof vacio>(k: K, v: string) => setF({ ...f, [k]: v });

  async function guardar(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    const body = {
      titulo: f.titulo, system_id: f.system_id || null, usuario_referencia: f.usuario_referencia || null,
      vault_item_name: f.vault_item_name, vault_collection: f.vault_collection || null, notas: f.notas || null,
    };
    try {
      if (editId) await api.patch(`${base}/${editId}`, body);
      else await api.post(base, body);
      setEditId(null); setF(vacio); reload();
    } catch (x) { setErr(errMsg(x)); }
  }

  return (
    <>
      <h2>Referencias a credenciales</h2>
      <p className="aviso">
        Esta lista guarda <strong>solo el nombre del item</strong> en Vaultwarden. Nunca cargar contraseñas, claves ni tokens, ni en las notas.
        {data?.vault_url && <> <a href={data.vault_url} target="_blank" rel="noopener noreferrer">Abrir Vaultwarden</a></>}
      </p>
      {loading ? <Cargando /> : <ErrorMsg msg={error} />}
      <ErrorMsg msg={err} />
      <div className="tabla-wrap">
        <table className="tabla">
          <thead><tr><th>Título</th><th>Usuario de referencia</th><th>Item en Vaultwarden</th><th>Colección</th><th></th></tr></thead>
          <tbody>
            {(data?.items ?? []).map((c) => (
              <tr key={c.id}>
                <td>{c.titulo}{c.notas && <><br /><span className="muted">{c.notas}</span></>}</td>
                <td>{c.usuario_referencia ?? '—'}</td><td><code>{c.vault_item_name}</code></td><td>{c.vault_collection ?? '—'}</td>
                <td className="acciones">
                  <button className="btn" onClick={() => { setEditId(c.id); setF({ titulo: c.titulo, system_id: c.system_id ?? '', usuario_referencia: c.usuario_referencia ?? '', vault_item_name: c.vault_item_name, vault_collection: c.vault_collection ?? '', notas: c.notas ?? '' }); }}>Editar</button>
                  <button className="btn btn-danger" onClick={async () => { if (!window.confirm('¿Borrar la referencia?')) return; try { await api.del(`${base}/${c.id}`); reload(); } catch (x) { setErr(errMsg(x)); } }}>Borrar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <form className="card form" onSubmit={guardar}>
        <h3>{editId ? 'Editar referencia' : 'Nueva referencia'}</h3>
        <label>Título<input value={f.titulo} onChange={(e) => set('titulo', e.target.value)} required /></label>
        <div className="inline">
          <label>Usuario de referencia (p. ej. root@srv-x)<input value={f.usuario_referencia} onChange={(e) => set('usuario_referencia', e.target.value)} /></label>
          <label>Sistema
            <select value={f.system_id} onChange={(e) => set('system_id', e.target.value)}>
              <option value="">(ninguno)</option>
              {(sistemas.data ?? []).map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
            </select>
          </label>
        </div>
        <div className="inline">
          <label>Nombre del item en Vaultwarden<input value={f.vault_item_name} onChange={(e) => set('vault_item_name', e.target.value)} required /></label>
          <label>Colección<input value={f.vault_collection} onChange={(e) => set('vault_collection', e.target.value)} /></label>
        </div>
        <label>Notas (sin secretos)<input value={f.notas} onChange={(e) => set('notas', e.target.value)} /></label>
        <div className="inline">
          <button className="btn btn-primary">{editId ? 'Guardar cambios' : 'Crear referencia'}</button>
          {editId && <button type="button" className="btn" onClick={() => { setEditId(null); setF(vacio); }}>Cancelar edición</button>}
        </div>
      </form>
    </>
  );
}
