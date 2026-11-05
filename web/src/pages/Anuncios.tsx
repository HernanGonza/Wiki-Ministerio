import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { api, q } from '../api/client';
import type { Announcement } from '../api/types';
import { useAsync } from '../lib';
import { AnuncioCard } from '../components/AnuncioCard';
import { Cargando, ErrorMsg } from '../components/Estados';

const PAGE = 20;

export function Anuncios() {
  const { espacio = '' } = useParams();
  const [offset, setOffset] = useState(0);
  const { data, loading, error } = useAsync(
    () => api.get<Announcement[]>(`/announcements${q({ space: espacio, limit: PAGE, offset })}`),
    [espacio, offset],
  );
  return (
    <>
      <h1>Anuncios</h1>
      {loading ? <Cargando /> : <ErrorMsg msg={error} />}
      {!loading && !data?.length && <p className="muted">No hay anuncios.</p>}
      <div className="stack">{(data ?? []).map((a) => <AnuncioCard key={a.id} a={a} />)}</div>
      <div className="paginacion">
        <button className="btn" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE))}>Anteriores</button>
        <button className="btn" disabled={(data?.length ?? 0) < PAGE} onClick={() => setOffset(offset + PAGE)}>Siguientes</button>
      </div>
    </>
  );
}
