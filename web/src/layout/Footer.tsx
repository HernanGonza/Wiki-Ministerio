import { createContext, useContext, useLayoutEffect, useState, type ReactNode } from 'react';
import { PatronFlores } from '@/ui/brand';
import { cn } from '@/ui/cn';

/** Pie de página con el patrón de flores del Key Visual. `dentro` = versión redondeada para la columna de contenido. */
export function Footer({ dentro = false }: { dentro?: boolean }) {
  return (
    <footer className={cn('relative overflow-hidden bg-verde-900 text-white/80', dentro ? 'mt-16 rounded-3xl' : 'mt-16 border-t')}>
      <PatronFlores className="absolute inset-y-0 right-0 w-2/3 text-white/10" />
      <div className={cn('relative px-6 py-8 text-sm', !dentro && 'mx-auto max-w-[90rem]')}>
        <strong className="font-semibold text-white">Wiki MERNR</strong>
        <span className="mx-2 opacity-50">·</span>
        Ministerio de Ecología y Recursos Naturales Renovables de Misiones
      </div>
    </footer>
  );
}

// Las vistas con sidebar sticky ponen el footer ADENTRO de su contenedor: si estuviera afuera,
// al terminar el contenedor el scroll arrastraría al sidebar hacia arriba.
const Ctx = createContext<(oculto: boolean) => void>(() => {});

export function FooterProvider({ children }: { children: (ocultoGlobal: boolean) => ReactNode }) {
  const [oculto, setOculto] = useState(false);
  return <Ctx.Provider value={setOculto}>{children(oculto)}</Ctx.Provider>;
}

/** Úsalo en una vista que renderiza su propio <Footer dentro />. */
export function useFooterPropio() {
  const set = useContext(Ctx);
  useLayoutEffect(() => {
    set(true);
    return () => set(false);
  }, [set]);
}
