import type { Estado } from '@/api/types';
import { cn } from '@/ui/cn';

export const ESTADO_LABEL: Record<Estado | 'sin-datos', string> = {
  online: 'En línea',
  lento: 'Lento',
  offline: 'Sin conexión',
  'sin-datos': 'Sin datos',
};

export const ESTADO_BG: Record<Estado | 'sin-datos', string> = {
  online: 'bg-success',
  lento: 'bg-warning',
  offline: 'bg-destructive',
  'sin-datos': 'bg-muted-foreground/40',
};
const ESTADO_TEXT: Record<Estado | 'sin-datos', string> = {
  online: 'text-success',
  lento: 'text-warning',
  offline: 'text-destructive',
  'sin-datos': 'text-muted-foreground',
};

export function StatusDot({ estado, conTexto = false }: { estado: Estado | null; conTexto?: boolean }) {
  const key = estado ?? 'sin-datos';
  return (
    <span className={cn('inline-flex items-center gap-2 text-sm font-semibold', ESTADO_TEXT[key])} title={ESTADO_LABEL[key]}>
      <span aria-hidden="true" className={cn('size-2.5 rounded-full', ESTADO_BG[key], key !== 'sin-datos' && 'animate-pulse-ring')} />
      {conTexto ? <span>{ESTADO_LABEL[key]}</span> : <span className="sr-only">{ESTADO_LABEL[key]}</span>}
    </span>
  );
}
