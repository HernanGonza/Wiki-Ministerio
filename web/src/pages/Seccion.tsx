import { Link, useOutletContext, useParams } from 'react-router-dom';
import { api } from '../api/client';
import type { PageData, SectionNode } from '../api/types';
import { useAsync } from '../lib';
import { Breadcrumbs, pathTo, type Crumb } from '../layout/Breadcrumbs';
import { MarkdownView } from '../components/MarkdownView';
import { Cargando, NoEncontrado } from '../components/Estados';
import type { SpaceCtx } from '../layout/SpaceLayout';
import { fmtFecha } from '../lib';

function Contenido({ espacio, seccion, pagina }: { espacio: string; seccion: SectionNode; pagina: string }) {
  const { data, loading, status } = useAsync(
    () => api.get<PageData>(`/spaces/${espacio}/sections/${seccion.slug}/pages/${pagina}`),
    [espacio, seccion.slug, pagina],
  );
  if (loading) return <Cargando />;
  if (!data) return status === 404 ? <NoEncontrado /> : <p className="error">No se pudo cargar la página.</p>;
  return (
    <article>
      <div className="pagina-cabecera">
        <h1>{data.titulo}</h1>
        {data.puede_editar && (
          <Link className="btn" to={`/admin/${espacio}/contenido?pagina=${data.id}`}>Editar</Link>
        )}
      </div>
      {data.acceso_efectivo === 'restringido' && <p className="aviso">🔒 Página restringida: solo visible para administración.</p>}
      <MarkdownView source={data.contenido_md} />
      <p className="muted pie-pagina">Versión {data.version} · actualizada {fmtFecha(data.updated_at)}{data.updated_by_nombre ? ` por ${data.updated_by_nombre}` : ''}</p>
    </article>
  );
}

/** /:espacio/s/:seccion/:pagina? */
export function Seccion() {
  const { tree, space } = useOutletContext<SpaceCtx>();
  const { espacio = '', seccion = '', pagina } = useParams();
  const camino = pathTo(tree, seccion);
  if (!camino) return <NoEncontrado />;
  const nodo = camino[camino.length - 1];

  const crumbs: Crumb[] = [
    { to: `/${espacio}`, label: space.nombre },
    ...camino.map((n, i) => ({ label: n.titulo, to: i < camino.length - 1 || pagina ? `/${espacio}/s/${n.slug}` : undefined })),
  ];

  // Página a mostrar: la pedida, `indice`, o la primera.
  const slugPagina = pagina ?? nodo.pages.find((p) => p.slug === 'indice')?.slug ?? nodo.pages[0]?.slug;

  return (
    <>
      <Breadcrumbs items={crumbs} />
      {!slugPagina && (
        <>
          <h1>{nodo.icono && <span aria-hidden="true">{nodo.icono} </span>}{nodo.titulo}</h1>
          {nodo.descripcion && <p className="lead">{nodo.descripcion}</p>}
        </>
      )}
      {nodo.children.length > 0 && (
        <div className="grid sub">
          {nodo.children.map((c) => (
            <Link key={c.id} to={`/${espacio}/s/${c.slug}`} className="card space-card">
              <h3>{c.titulo}</h3>
              {c.descripcion && <p>{c.descripcion}</p>}
            </Link>
          ))}
        </div>
      )}
      {nodo.pages.length > 1 && (
        <ul className="tabs">
          {nodo.pages.map((p) => (
            <li key={p.id}>
              <Link className={p.slug === slugPagina ? 'active' : undefined} to={`/${espacio}/s/${nodo.slug}/${p.slug}`}>{p.titulo}</Link>
            </li>
          ))}
        </ul>
      )}
      {slugPagina ? (
        <Contenido espacio={espacio} seccion={nodo} pagina={slugPagina} />
      ) : (
        !nodo.children.length && <p className="muted">Esta sección todavía no tiene páginas.</p>
      )}
    </>
  );
}
