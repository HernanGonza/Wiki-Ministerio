import { Link } from 'react-router-dom';
import { Flor } from '@/ui/brand';
import { Alert } from '@/components/ui/page';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';

export function NoEncontrado() {
  return (
    <div className="mx-auto grid max-w-md place-items-center gap-4 px-4 py-24 text-center">
      <Flor className="size-20 animate-float opacity-90" />
      <h1 className="text-2xl font-bold">No encontrado</h1>
      <p className="text-muted-foreground">La página que se busca no existe o no hay acceso a ella.</p>
      <Button asChild><Link to="/">Volver al inicio</Link></Button>
    </div>
  );
}

/** Esqueleto de carga. `variante` ajusta la forma. */
export function Cargando({ variante = 'texto' }: { variante?: 'texto' | 'tarjetas' | 'tabla' }) {
  if (variante === 'tarjetas')
    return (
      <div role="status" aria-label="Cargando" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => <Skeleton key={i} className="h-36" />)}
      </div>
    );
  if (variante === 'tabla')
    return (
      <div role="status" aria-label="Cargando" className="grid gap-2">
        <Skeleton className="h-10" />
        {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-14" />)}
      </div>
    );
  return (
    <div role="status" aria-label="Cargando" className="grid gap-3">
      <Skeleton className="h-8 w-2/5" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-11/12" />
      <Skeleton className="h-4 w-3/4" />
    </div>
  );
}

export function ErrorMsg({ msg }: { msg: string | null }) {
  return msg ? <Alert>{msg}</Alert> : null;
}
