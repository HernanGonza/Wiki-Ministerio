import { Link, useOutletContext, useParams } from 'react-router-dom';
import { Activity, ArrowRight, FileText, FolderTree, Megaphone } from 'lucide-react';
import { api, q } from '@/api/client';
import type { Announcement, SectionNode } from '@/api/types';
import { useAsync } from '@/lib';
import { PatronFlores } from '@/ui/brand';
import { AnuncioCard } from '@/components/AnuncioCard';
import { Cargando, ErrorMsg } from '@/components/Estados';
import { Empty, PageEnter, SectionTitle } from '@/components/ui/page';
import { Reveal } from '@/components/ui/reveal';
import { SpotlightCard } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { SpaceCtx } from '@/layout/SpaceLayout';

const contar = (nodes: SectionNode[]): { secciones: number; paginas: number } =>
  nodes.reduce((a, n) => { const h = contar(n.children); return { secciones: a.secciones + 1 + h.secciones, paginas: a.paginas + n.pages.length + h.paginas }; }, { secciones: 0, paginas: 0 });

/** Portada de un espacio: secciones de nivel 1 + anuncios del espacio (y transversales). */
export function Espacio() {
  const { space, tree } = useOutletContext<SpaceCtx>();
  const { espacio = '' } = useParams();
  const anuncios = useAsync(() => api.get<Announcement[]>(`/announcements${q({ space: espacio, limit: 5 })}`), [espacio]);
  const n = contar(tree);

  return (
    <PageEnter>
      <section className="relative isolate overflow-hidden rounded-3xl border bg-gradient-to-br from-verde-700 to-verde-900 p-7 text-white sm:p-10">
        <PatronFlores className="absolute inset-y-0 right-0 -z-10 w-3/4 text-white/15 [--flor-centro:#1f3329]" />
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{space.nombre}</h1>
        {space.descripcion && <p className="mt-2 max-w-2xl text-white/80">{space.descripcion}</p>}
        <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm">
          <span className="inline-flex items-center gap-2"><FolderTree className="size-4 text-verde-200" /><strong className="text-lg">{n.secciones}</strong> secciones</span>
          <span className="inline-flex items-center gap-2"><FileText className="size-4 text-verde-200" /><strong className="text-lg">{n.paginas}</strong> páginas</span>
          <span className="ml-auto flex gap-2">
            <Button asChild size="sm" className="bg-white/15 text-white shadow-none backdrop-blur hover:bg-white/25"><Link to={`/${espacio}/sistemas`}><Activity />Sistemas</Link></Button>
            <Button asChild size="sm" className="bg-white/15 text-white shadow-none backdrop-blur hover:bg-white/25"><Link to={`/${espacio}/anuncios`}><Megaphone />Anuncios</Link></Button>
          </span>
        </div>
      </section>

      <SectionTitle>Secciones</SectionTitle>
      {!tree.length && <Empty icon={<FolderTree />}>Este espacio todavía no tiene secciones.</Empty>}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {tree.map((s, i) => (
          <Reveal key={s.id} delay={i * 0.05}>
            <SpotlightCard asChild>
              <Link to={`/${espacio}/s/${s.slug}`} className="flex h-full flex-col gap-3 p-5">
                <div className="flex items-center gap-3">
                  <span className="grid size-12 place-items-center rounded-2xl bg-secondary text-2xl transition-transform duration-300 group-hover/spot:scale-110">{s.icono ?? '📄'}</span>
                  <h3 className="flex-1 text-base font-bold leading-tight">{s.titulo}</h3>
                  <ArrowRight className="size-4 text-muted-foreground transition-all group-hover/spot:translate-x-1 group-hover/spot:text-primary" />
                </div>
                {s.descripcion && <p className="line-clamp-2 text-sm text-muted-foreground">{s.descripcion}</p>}
                {s.children.length > 0 ? (
                  <div className="mt-auto flex flex-wrap gap-1.5">
                    {s.children.slice(0, 4).map((c) => <span key={c.id} className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">{c.titulo}</span>)}
                    {s.children.length > 4 && <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">+{s.children.length - 4}</span>}
                  </div>
                ) : (
                  <span className="mt-auto text-xs font-medium text-muted-foreground">{s.pages.length} {s.pages.length === 1 ? 'página' : 'páginas'}</span>
                )}
              </Link>
            </SpotlightCard>
          </Reveal>
        ))}
      </div>

      <SectionTitle aside={<Button asChild variant="link" size="sm"><Link to={`/${espacio}/anuncios`}>Ver todos <ArrowRight /></Link></Button>}>Anuncios</SectionTitle>
      {anuncios.loading ? <Cargando /> : <ErrorMsg msg={anuncios.error} />}
      {!anuncios.loading && !anuncios.data?.length && <Empty icon={<Megaphone />}>No hay anuncios.</Empty>}
      <div className="grid gap-4 xl:grid-cols-2">
        {(anuncios.data ?? []).map((a, i) => <Reveal key={a.id} delay={i * 0.06}><AnuncioCard a={a} /></Reveal>)}
      </div>
    </PageEnter>
  );
}
