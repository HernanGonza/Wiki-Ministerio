import { Fragment, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api, q } from '../api/client';
import type { SystemCheck, SystemStatus } from '../api/types';
import { fmtFecha, useAsync } from '../lib';
import { StatusDot } from '../components/StatusDot';
import { Cargando, ErrorMsg } from '../components/Estados';

function History({ id }: { id: string }) {
  const { data, loading, error } = useAsync(() => api.get<SystemCheck[]>(`/systems/${id}/history${q({ horas: 24 })}`), [id]);
  if (loading) return <Cargando />;
  if (error) return <ErrorMsg msg={error} />;
  const checks = (data ?? []).slice(-120);
  if (!checks.length) return <p className="muted">Sin verificaciones en las últimas 24 horas.</p>;
  return (
    <div>
      <p className="muted">Últimas {checks.length} verificaciones (la más reciente a la derecha)</p>
      <div className="strip" role="img" aria-label="Historial de estado de las últimas 24 horas">
        {checks.map((c, i) => (
          <span key={i} className={`cell dot-${c.estado}`} title={`${fmtFecha(c.checked_at)} · ${c.estado}${c.latencia_ms != null ? ` · ${c.latencia_ms} ms` : ''}`} />
        ))}
      </div>
    </div>
  );
}

export function Sistemas() {
  const { espacio = '' } = useParams();
  const [abierto, setAbierto] = useState<string | null>(null);
  // Refresco cada 30 s: el frontend solo consulta; los checks los hace la API.
  const { data, loading, error } = useAsync(() => api.get<SystemStatus[]>(`/systems/status${q({ space: espacio })}`), [espacio], 30_000);

  return (
    <>
      <h1>Estado de sistemas</h1>
      <p className="muted">Se actualiza automáticamente cada 30 segundos. Las verificaciones las realiza el servidor cada minuto.</p>
      {loading ? <Cargando /> : <ErrorMsg msg={error} />}
      {!loading && !data?.length && <p className="muted">No hay sistemas registrados.</p>}
      <div className="tabla-wrap">
        <table className="tabla">
          <thead>
            <tr><th>Estado</th><th>Sistema</th><th>VM</th><th>Latencia</th><th>Disponib. 24 h</th><th>Última verificación</th></tr>
          </thead>
          <tbody>
            {(data ?? []).map((s) => (
              <Fragment key={s.id}>
                <tr className="fila-click" onClick={() => setAbierto(abierto === s.id ? null : s.id)}>
                  <td><StatusDot estado={s.estado} conTexto /></td>
                  <td>
                    <button className="btn-link-plain" aria-expanded={abierto === s.id}>{s.nombre}</button>
                    {s.transversal && <span className="badge">Ministerio</span>}
                  </td>
                  <td>{s.vm ?? '—'}</td>
                  <td>{s.latencia_ms != null ? `${s.latencia_ms} ms` : '—'}</td>
                  <td>{s.checks_24h ? `${Math.round((s.online_24h / s.checks_24h) * 100)} %` : '—'}</td>
                  <td>{fmtFecha(s.checked_at)}</td>
                </tr>
                {abierto === s.id && (
                  <tr>
                    <td colSpan={6}>
                      {s.url && <p><a href={s.url} target="_blank" rel="noopener noreferrer">{s.url}</a></p>}
                      {s.descripcion && <p>{s.descripcion}</p>}
                      <History id={s.id} />
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
