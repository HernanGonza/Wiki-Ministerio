import { Link, useOutletContext, useParams } from 'react-router-dom';
import { api, q } from '../api/client';
import type { Announcement } from '../api/types';
import { useAsync } from '../lib';
import { AnuncioCard } from '../components/AnuncioCard';
import { Cargando, ErrorMsg } from '../components/Estados';
import type { SpaceCtx } from '../layout/SpaceLayout';

/** Portada de un espacio: secciones de nivel 1 + anuncios del espacio (y transversales). */
export function Espacio() {
  const { space, tree } = useOutletContext<SpaceCtx>();
  const { espacio = '' } = useParams();
  const anuncios = useAsync(() => api.get<Announcement[]>(`/announcements${q({ space: espacio, limit: 5 })}`), [espacio]);

  return (
    <>
      <h1>{space.nombre}</h1>
      {space.descripcion && <p className="lead">{space.descripcion}</p>}

      <section>
        <h2>Secciones</h2>
        {!tree.length && <p className="muted">Este espacio todavía no tiene secciones.</p>}
        <div className="grid">
          {tree.map((s) => (
            <Link key={s.id} to={`/${espacio}/s/${s.slug}`} className="card space-card">
              <h3>{s.icono && <span aria-hidden="true">{s.icono} </span>}{s.titulo}</h3>
              {s.descripcion && <p>{s.descripcion}</p>}
              <span className="muted">{s.children.length ? `${s.children.length} subsecciones` : `${s.pages.length} páginas`}</span>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <h2>Anuncios</h2>
        {anuncios.loading ? <Cargando /> : <ErrorMsg msg={anuncios.error} />}
        {!anuncios.loading && !anuncios.data?.length && <p className="muted">No hay anuncios.</p>}
        <div className="stack">
          {(anuncios.data ?? []).map((a) => <AnuncioCard key={a.id} a={a} />)}
        </div>
        <p><Link to={`/${espacio}/anuncios`}>Ver todos los anuncios</Link></p>
      </section>
    </>
  );
}
