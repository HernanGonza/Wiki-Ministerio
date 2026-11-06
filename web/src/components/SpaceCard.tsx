import { Link } from 'react-router-dom';
import { ArrowUpRight, Layers, Shield } from 'lucide-react';
import type { Space } from '@/api/types';
import { SpotlightCard } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export function SpaceCard({ s }: { s: Space }) {
  return (
    <SpotlightCard asChild>
      <Link to={`/${s.slug}`} className="flex h-full flex-col gap-4 p-6">
        <div className="flex items-start justify-between">
          <span className="grid size-12 place-items-center rounded-2xl bg-gradient-to-br from-verde-700 to-oliva text-white shadow-md shadow-primary/25 transition-transform duration-300 group-hover/spot:scale-110 group-hover/spot:-rotate-6"><Layers className="size-6" /></span>
          <ArrowUpRight className="size-5 text-muted-foreground transition-all duration-300 group-hover/spot:-translate-y-0.5 group-hover/spot:translate-x-0.5 group-hover/spot:text-primary" />
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-bold leading-tight">{s.nombre}</h3>
          {s.subtitulo && <p className="text-sm font-medium text-primary">{s.subtitulo}</p>}
          {s.descripcion && <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{s.descripcion}</p>}
        </div>
        <Badge variant={s.rol === 'general' ? 'default' : 'rosa'} className="w-fit">{s.rol === 'general' ? 'Lectura' : <><Shield className="size-3" />Administración</>}</Badge>
      </Link>
    </SpotlightCard>
  );
}
