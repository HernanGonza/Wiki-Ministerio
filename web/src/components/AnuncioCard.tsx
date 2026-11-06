import { AlertTriangle, Megaphone, Info } from 'lucide-react';
import type { Announcement } from '@/api/types';
import { fmtDia } from '@/lib';
import { cn } from '@/ui/cn';
import { Badge } from '@/components/ui/badge';
import { MarkdownView } from './MarkdownView';

const ESTILO = {
  alta: { icon: AlertTriangle, caja: 'bg-destructive/12 text-destructive', borde: 'before:bg-destructive' },
  media: { icon: Megaphone, caja: 'bg-primary/12 text-primary', borde: 'before:bg-primary' },
  baja: { icon: Info, caja: 'bg-muted text-muted-foreground', borde: 'before:bg-border' },
} as const;

export function AnuncioCard({ a }: { a: Announcement }) {
  const e = ESTILO[a.prioridad];
  const Icon = e.icon;
  return (
    <article className={cn('relative overflow-hidden rounded-2xl border bg-card p-5 pl-7 shadow-sm transition hover:shadow-md before:absolute before:inset-y-0 before:left-0 before:w-1.5', e.borde)}>
      <header className="mb-3 flex flex-wrap items-start gap-3">
        <span className={cn('grid size-10 shrink-0 place-items-center rounded-xl', e.caja)}><Icon className="size-5" /></span>
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-bold leading-snug">{a.titulo}</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">{fmtDia(a.publicado_at)}{a.autor ? ` · ${a.autor}` : ''}</p>
        </div>
        <div className="flex gap-1.5">
          {a.transversal && <Badge variant="primary">Ministerio</Badge>}
          {a.prioridad === 'alta' && <Badge variant="danger">Prioridad alta</Badge>}
        </div>
      </header>
      <MarkdownView source={a.cuerpo_md} className="prose-sm" />
    </article>
  );
}
