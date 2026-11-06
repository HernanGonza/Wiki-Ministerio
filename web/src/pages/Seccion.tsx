import { useRef } from 'react';
import { Link, useOutletContext, useParams } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowRight, Clock, FolderOpen, Lock, Pencil, Hammer, User } from 'lucide-react';
import { api } from '@/api/client';
import type { PageData, SectionNode } from '@/api/types';
import { fmtFecha, useAsync } from '@/lib';
import { cn } from '@/ui/cn';
import { Breadcrumbs, pathTo, type Crumb } from '@/layout/Breadcrumbs';
import type { SpaceCtx } from '@/layout/SpaceLayout';
import { MarkdownView } from '@/components/MarkdownView';
import { BlockRenderer } from '@/blocks/BlockRenderer';
import { Toc } from '@/components/Toc';
import { Cargando, NoEncontrado } from '@/components/Estados';
import { Alert, Empty, PageEnter } from '@/components/ui/page';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SpotlightCard } from '@/components/ui/card';
import { Reveal } from '@/components/ui/reveal';

const PENDIENTE = /\[PLACEHOLDER\]/i;

function Contenido({ espacio, seccion, pagina }: { espacio: string; seccion: SectionNode; pagina: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const { data, loading, status } = useAsync(
    () => api.get<PageData>(`/spaces/${espacio}/sections/${seccion.slug}/pages/${pagina}`),
    [espacio, seccion.slug, pagina],
  );
  if (loading) return <Cargando />;
  if (!data) return status === 404 ? <NoEncontrado /> : <Alert>No se pudo cargar la página.</Alert>;
  const pendiente = data.contenido_json ? data.contenido_json.length === 0 : PENDIENTE.test(data.contenido_md);
  return (
    <div className="flex items-start gap-8">
      <article className="min-w-0 flex-1">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{data.titulo}</h1>
          {data.puede_editar && <Button asChild variant="outline" size="sm"><Link to={`/admin/${espacio}/contenido?pagina=${data.id}`}><Pencil />Editar</Link></Button>}
        </div>
        {data.acceso_efectivo === 'restringido' && <Alert tone="warn" className="mb-5"><Lock className="mr-1 inline size-3.5" />Página restringida: solo visible para administración.</Alert>}
        {pendiente ? (
          <div className="grid place-items-center gap-3 rounded-3xl border border-dashed bg-card/50 px-6 py-16 text-center">
            <span className="grid size-16 place-items-center rounded-2xl bg-warning/15 text-warning"><Hammer className="size-7" /></span>
            <h2 className="text-xl font-bold">Contenido en redacción</h2>
            <p className="max-w-sm text-sm text-muted-foreground">Esta página todavía no tiene contenido. Cuando el área lo cargue, va a aparecer acá.</p>
            {data.puede_editar && <Button asChild size="sm" className="mt-2"><Link to={`/admin/${espacio}/contenido?pagina=${data.id}`}><Pencil />Escribir contenido</Link></Button>}
          </div>
        ) : (
          <div ref={ref} className="rounded-3xl border bg-card p-6 shadow-sm sm:p-10">{data.contenido_json ? <BlockRenderer blocks={data.contenido_json} archivos={data.archivos ?? {}} /> : <MarkdownView source={data.contenido_md} />}</div>
        )}
        <footer className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-muted-foreground">
          <Badge variant="outline">Versión {data.version}</Badge>
          <span className="inline-flex items-center gap-1.5"><Clock className="size-3.5" />Actualizada {fmtFecha(data.updated_at)}</span>
          {data.updated_by_nombre && <span className="inline-flex items-center gap-1.5"><User className="size-3.5" />{data.updated_by_nombre}</span>}
        </footer>
      </article>
      {!pendiente && <Toc contenedor={ref} dep={data.id + data.version} />}
    </div>
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
    <PageEnter key={nodo.id}>
      <Breadcrumbs items={crumbs} />
      <header className="mb-6 flex items-start gap-4">
        <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-secondary text-3xl">{nodo.icono ?? <FolderOpen className="size-6 text-primary" />}</span>
        <div>
          <h2 className={cn('font-bold tracking-tight', slugPagina ? 'text-sm uppercase tracking-wider text-muted-foreground' : 'text-3xl')}>{nodo.titulo}</h2>
          {nodo.descripcion && <p className="mt-1 max-w-2xl text-muted-foreground">{nodo.descripcion}</p>}
        </div>
      </header>

      {nodo.children.length > 0 && (
        <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {nodo.children.map((c, i) => (
            <Reveal key={c.id} delay={i * 0.05}>
              <SpotlightCard asChild>
                <Link to={`/${espacio}/s/${c.slug}`} className="flex h-full items-center gap-3 p-4">
                  <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-secondary text-xl">{c.icono ?? '📂'}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{c.titulo}</span>
                    <span className="block truncate text-xs text-muted-foreground">{c.descripcion ?? (c.children.length ? `${c.children.length} subsecciones` : `${c.pages.length} páginas`)}</span>
                  </span>
                  <ArrowRight className="size-4 text-muted-foreground transition-all group-hover/spot:translate-x-1 group-hover/spot:text-primary" />
                </Link>
              </SpotlightCard>
            </Reveal>
          ))}
        </div>
      )}

      {nodo.pages.length > 1 && (
        <div className="mb-6 flex flex-wrap gap-1 rounded-full bg-muted p-1" role="tablist">
          {nodo.pages.map((p) => {
            const act = p.slug === slugPagina;
            return (
              <Link key={p.id} role="tab" aria-selected={act} to={`/${espacio}/s/${nodo.slug}/${p.slug}`} className={cn('relative rounded-full px-4 py-1.5 text-sm font-medium transition-colors', act ? 'text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}>
                {act && <motion.span layoutId="tab-pagina" className="absolute inset-0 -z-0 rounded-full bg-primary shadow" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}
                <span className="relative z-10">{p.titulo}</span>
              </Link>
            );
          })}
        </div>
      )}

      {slugPagina ? (
        <Contenido espacio={espacio} seccion={nodo} pagina={slugPagina} />
      ) : (
        !nodo.children.length && <Empty icon={<FolderOpen />}>Esta sección todavía no tiene páginas.</Empty>
      )}
    </PageEnter>
  );
}
