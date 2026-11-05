import type { Estado } from '../api/types';

const LABEL: Record<Estado | 'sin-datos', string> = {
  online: 'En línea',
  lento: 'Lento',
  offline: 'Sin conexión',
  'sin-datos': 'Sin datos',
};

export function StatusDot({ estado, conTexto = false }: { estado: Estado | null; conTexto?: boolean }) {
  const key = estado ?? 'sin-datos';
  return (
    <span className="status" title={LABEL[key]}>
      <span className={`dot dot-${key}`} aria-hidden="true" />
      {conTexto ? <span>{LABEL[key]}</span> : <span className="sr-only">{LABEL[key]}</span>}
    </span>
  );
}
