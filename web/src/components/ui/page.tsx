import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { AlertCircle, ChevronRight, Inbox } from 'lucide-react';
import { cn } from '@/ui/cn';

/** Envuelve una página: entra con un fundido + leve subida cada vez que se monta. */
export function PageEnter({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div className={className} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}>
      {children}
    </motion.div>
  );
}

export interface Crumb { to?: string; label: string }

export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Ruta" className="mb-3 flex flex-wrap items-center gap-1 text-[0.82rem] text-muted-foreground">
      {items.map((c, i) => (
        <span key={i} className="inline-flex items-center gap-1">
          {i > 0 && <ChevronRight className="size-3.5 opacity-60" aria-hidden="true" />}
          {c.to ? <Link to={c.to} className="rounded-md px-1 transition hover:text-primary">{c.label}</Link> : <span aria-current="page" className="px-1 font-medium text-foreground">{c.label}</span>}
        </span>
      ))}
    </nav>
  );
}

export function PageHeader({ title, description, actions, crumbs, icon }: { title: ReactNode; description?: ReactNode; actions?: ReactNode; crumbs?: Crumb[]; icon?: ReactNode }) {
  return (
    <header className="mb-6">
      {crumbs && <Breadcrumbs items={crumbs} />}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3.5">
          {icon && <span className="mt-1 grid size-11 shrink-0 place-items-center rounded-2xl bg-primary/12 text-primary [&_svg]:size-5">{icon}</span>}
          <div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
            {description && <p className="mt-1 max-w-2xl text-[0.95rem] text-muted-foreground">{description}</p>}
          </div>
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}

export function SectionTitle({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mb-4 mt-10 flex items-end justify-between gap-3">
      <h2 className="text-lg font-bold tracking-tight">{children}</h2>
      {aside}
    </div>
  );
}

export function Alert({ children, tone = 'error', className }: { children: ReactNode; tone?: 'error' | 'warn' | 'info'; className?: string }) {
  const tones = {
    error: 'border-destructive/30 bg-destructive/8 text-destructive',
    warn: 'border-warning/40 bg-warning/10 text-foreground',
    info: 'border-primary/25 bg-primary/8 text-foreground',
  } as const;
  return (
    <motion.div role={tone === 'error' ? 'alert' : 'status'} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
      className={cn('flex items-start gap-2.5 rounded-xl border px-4 py-3 text-sm', tones[tone], className)}>
      <AlertCircle className="mt-0.5 size-4 shrink-0" />
      <div className="min-w-0 flex-1">{children}</div>
    </motion.div>
  );
}

export function Empty({ children, icon }: { children: ReactNode; icon?: ReactNode }) {
  return (
    <div className="grid place-items-center gap-2 rounded-2xl border border-dashed px-6 py-12 text-center text-sm text-muted-foreground">
      <span className="grid size-12 place-items-center rounded-full bg-muted [&_svg]:size-5">{icon ?? <Inbox />}</span>
      {children}
    </div>
  );
}
