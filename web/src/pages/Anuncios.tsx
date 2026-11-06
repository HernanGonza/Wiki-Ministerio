import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Megaphone } from 'lucide-react';
import { api, q } from '@/api/client';
import type { Announcement } from '@/api/types';
import { useAsync } from '@/lib';
import { AnuncioCard } from '@/components/AnuncioCard';
import { Cargando, ErrorMsg } from '@/components/Estados';
import { Empty, PageEnter, PageHeader } from '@/components/ui/page';
import { Reveal } from '@/components/ui/reveal';
import { Button } from '@/components/ui/button';

const PAGE = 20;

export function Anuncios() {
  const { espacio = '' } = useParams();
  const [offset, setOffset] = useState(0);
  const { data, loading, error } = useAsync(
    () => api.get<Announcement[]>(`/announcements${q({ space: espacio, limit: PAGE, offset })}`),
    [espacio, offset],
  );
  return (
    <PageEnter>
      <PageHeader icon={<Megaphone />} title="Anuncios" description="Novedades del espacio y del Ministerio." />
      {loading ? <Cargando variante="tarjetas" /> : <ErrorMsg msg={error} />}
      {!loading && !data?.length && <Empty icon={<Megaphone />}>No hay anuncios.</Empty>}
      <div className="grid gap-4 xl:grid-cols-2">{(data ?? []).map((a, i) => <Reveal key={a.id} delay={(i % 4) * 0.05}><AnuncioCard a={a} /></Reveal>)}</div>
      {(offset > 0 || (data?.length ?? 0) >= PAGE) && (
        <div className="mt-6 flex justify-center gap-2">
          <Button variant="outline" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE))}><ChevronLeft />Anteriores</Button>
          <Button variant="outline" disabled={(data?.length ?? 0) < PAGE} onClick={() => setOffset(offset + PAGE)}>Siguientes<ChevronRight /></Button>
        </div>
      )}
    </PageEnter>
  );
}
