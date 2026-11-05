import { api, q } from '../api/client';
import type { Announcement, Space } from '../api/types';
import { useAsync } from '../lib';
import { AnuncioCard } from '../components/AnuncioCard';
import { SpaceCard } from '../components/SpaceCard';
import { Cargando, ErrorMsg } from '../components/Estados';

/** Portada del Ministerio: espacios + anuncios transversales. */
export function Portada() {
  const espacios = useAsync(() => api.get<Space[]>('/spaces'), []);
  const anuncios = useAsync(() => api.get<Announcement[]>(`/announcements${q({ space: 'ministerio', limit: 10 })}`), []);
  const lista = (espacios.data ?? []).filter((s) => s.slug !== 'ministerio');

  return (
    <main className="contenido ancho">
      <section className="hero">
        <h1>Wiki MERNR</h1>
        <p>Base de conocimiento del Ministerio</p>
      </section>

      <section>
        <h2>Espacios</h2>
        {espacios.loading ? <Cargando /> : <ErrorMsg msg={espacios.error} />}
        {!espacios.loading && !lista.length && <p className="muted">Todavía no hay espacios asignados a este usuario.</p>}
        <div className="grid">
          {lista.map((s) => <SpaceCard key={s.id} s={s} />)}
        </div>
      </section>

      <section>
        <h2>Anuncios del Ministerio</h2>
        {anuncios.loading ? <Cargando /> : <ErrorMsg msg={anuncios.error} />}
        {!anuncios.loading && !anuncios.data?.length && <p className="muted">No hay anuncios.</p>}
        <div className="stack">
          {(anuncios.data ?? []).map((a) => <AnuncioCard key={a.id} a={a} />)}
        </div>
      </section>
    </main>
  );
}
