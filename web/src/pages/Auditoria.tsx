import { useState } from 'react';
import { api, q } from '../api/client';
import type { AuditItem } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { fmtFecha, useAsync } from '../lib';
import { Cargando, ErrorMsg } from '../components/Estados';

const PAGE = 50;

export function Auditoria() {
  const { me } = useAuth();
  const [space, setSpace] = useState('');
  const [accion, setAccion] = useState('');
  const [offset, setOffset] = useState(0);
  const { data, loading, error } = useAsync(
    () => api.get<{ items: AuditItem[]; hay_mas: boolean }>(`/audit${q({ space, accion, limit: PAGE, offset })}`),
    [space, accion, offset],
  );
  const espacios = (me?.spaces ?? []).filter((s) => s.rol !== 'general');

  return (
    <main className="contenido ancho">
      <h1>Auditoría</h1>
      <div className="filtros">
        <label>Espacio
          <select value={space} onChange={(e) => { setSpace(e.target.value); setOffset(0); }}>
            <option value="">Todos los que se pueden ver</option>
            {espacios.map((s) => <option key={s.slug} value={s.slug}>{s.nombre}</option>)}
          </select>
        </label>
        <label>Acción
          <input value={accion} placeholder="p. ej. login_fallido" onChange={(e) => { setAccion(e.target.value.trim()); setOffset(0); }} />
        </label>
      </div>
      {loading ? <Cargando /> : <ErrorMsg msg={error} />}
      <div className="tabla-wrap">
        <table className="tabla">
          <thead><tr><th>Fecha</th><th>Usuario</th><th>Acción</th><th>Recurso</th><th>Espacio</th><th>IP</th></tr></thead>
          <tbody>
            {(data?.items ?? []).map((a) => (
              <tr key={a.id}>
                <td>{fmtFecha(a.created_at)}</td>
                <td>{a.usuario_nombre ? `${a.usuario_nombre} (${a.usuario_email})` : '—'}</td>
                <td>{a.accion}</td>
                <td>{a.recurso}{a.recurso_id ? ` · ${a.recurso_id.slice(0, 8)}` : ''}</td>
                <td>{a.space_slug ?? '—'}</td>
                <td>{a.ip ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="paginacion">
        <button className="btn" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE))}>Anteriores</button>
        <button className="btn" disabled={!data?.hay_mas} onClick={() => setOffset(offset + PAGE)}>Siguientes</button>
      </div>
    </main>
  );
}
