import { Outlet } from 'react-router-dom';
import { ScrollProgress } from '@/components/ui/scroll-progress';
import { Header } from './Header';
import { Footer, FooterProvider } from './Footer';
import { PaletteProvider } from './CommandPalette';

export function Layout() {
  return (
    <PaletteProvider>
      <FooterProvider>
        {(ocultoGlobal) => (
          <div className="flex min-h-dvh flex-col">
            <ScrollProgress />
            <a href="#contenido" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[70] focus:rounded-full focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground">Saltar al contenido</a>
            <Header />
            <div id="contenido" className="flex flex-1 flex-col"><Outlet /></div>
            {!ocultoGlobal && <Footer />}
          </div>
        )}
      </FooterProvider>
    </PaletteProvider>
  );
}
