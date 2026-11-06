import { motion } from 'motion/react';
import { Megaphone, Search } from 'lucide-react';
import { api, q } from '@/api/client';
import type { Announcement, Space } from '@/api/types';
import { useAsync } from '@/lib';
import { Flor, PatronFlores } from '@/ui/brand';
import { AnuncioCard } from '@/components/AnuncioCard';
import { SpaceCard } from '@/components/SpaceCard';
import { Cargando, ErrorMsg } from '@/components/Estados';
import { Empty, PageEnter, SectionTitle } from '@/components/ui/page';
import { Reveal } from '@/components/ui/reveal';
import { Button } from '@/components/ui/button';
import { usePalette } from '@/layout/CommandPalette';

/** Portada del Ministerio: espacios + anuncios transversales. */
export function Portada() {
  const espacios = useAsync(() => api.get<Space[]>('/spaces'), []);
  const anuncios = useAsync(() => api.get<Announcement[]>(`/announcements${q({ space: 'ministerio', limit: 10 })}`), []);
  const { setOpen } = usePalette();
  const lista = (espacios.data ?? []).filter((s) => s.slug !== 'ministerio');

  return (
    <PageEnter className="mx-auto w-full max-w-7xl px-4 pb-8 pt-6 sm:px-6">
      <section className="relative isolate overflow-hidden rounded-[2rem] bg-verde-700 px-7 py-12 text-white shadow-xl shadow-primary/20 sm:px-14 sm:py-16">
        <PatronFlores className="absolute inset-y-0 right-0 -z-10 w-[85%] text-white/22 [--flor-centro:#3e6c51]" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-verde-900/70 via-verde-700/10 to-transparent" />
        <motion.div initial={{ opacity: 0, scale: 0.6, rotate: -30 }} animate={{ opacity: 1, scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 120, damping: 14, delay: 0.15 }} className="absolute -right-6 -top-6 hidden sm:block">
          <Flor className="size-44 animate-float drop-shadow-2xl" />
        </motion.div>
        <p className="mb-3 text-sm font-semibold uppercase tracking-[0.28em] text-verde-200">Ministerio de Ecología y RNR · Misiones</p>
        <h1 className="max-w-2xl text-4xl font-bold leading-[1.05] tracking-tight sm:text-6xl">
          Base de <span className="text-rosa">conocimiento</span>
        </h1>
        <p className="mt-4 max-w-xl text-lg text-white/80">Procedimientos, sistemas e información de cada área, en un solo lugar y siempre a mano.</p>
        <Button size="lg" onClick={() => setOpen(true)} className="mt-8 bg-white text-verde-900 shadow-lg hover:bg-white/90 hover:shadow-xl">
          <Search />Buscar en la wiki
          <kbd className="ml-2 rounded-md bg-verde-900/10 px-1.5 py-0.5 text-[0.7rem]">Ctrl K</kbd>
        </Button>
      </section>

      <SectionTitle>Espacios</SectionTitle>
      {espacios.loading ? <Cargando variante="tarjetas" /> : <ErrorMsg msg={espacios.error} />}
      {!espacios.loading && !lista.length && <Empty>Todavía no hay espacios asignados a este usuario.</Empty>}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {lista.map((s, i) => <Reveal key={s.id} delay={i * 0.07}><SpaceCard s={s} /></Reveal>)}
      </div>

      <SectionTitle>Anuncios del Ministerio</SectionTitle>
      {anuncios.loading ? <Cargando /> : <ErrorMsg msg={anuncios.error} />}
      {!anuncios.loading && !anuncios.data?.length && <Empty icon={<Megaphone />}>No hay anuncios por ahora.</Empty>}
      <div className="grid gap-4 lg:grid-cols-2">
        {(anuncios.data ?? []).map((a, i) => <Reveal key={a.id} delay={i * 0.06}><AnuncioCard a={a} /></Reveal>)}
      </div>
    </PageEnter>
  );
}
