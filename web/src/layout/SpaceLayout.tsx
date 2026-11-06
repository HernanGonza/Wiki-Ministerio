import { useCallback, useEffect, useState } from 'react';
import { Outlet, useParams } from 'react-router-dom';
import { motion } from 'motion/react';
import { Menu, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { api } from '@/api/client';
import type { SectionNode, Space } from '@/api/types';
import { useAsync } from '@/lib';
import { Cargando, NoEncontrado } from '@/components/Estados';
import { Sheet } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Sidebar } from './Sidebar';
import { Footer, useFooterPropio } from './Footer';

export interface SpaceCtx {
  space: Space;
  tree: SectionNode[];
  reloadTree: () => void;
}

const KEY = 'wiki-sidebar-colapsado';
const leer = () => { try { return localStorage.getItem(KEY) === '1'; } catch { return false; } };

/** Marco de un espacio: barra lateral colapsable (Ctrl+B) con el árbol de secciones + contenido. */
export function SpaceLayout() {
  const { espacio = '' } = useParams();
  const sp = useAsync(() => api.get<Space>(`/spaces/${espacio}`), [espacio]);
  const tree = useAsync(() => api.get<SectionNode[]>(`/spaces/${espacio}/sections`), [espacio]);
  useFooterPropio();
  const [menu, setMenu] = useState(false);
  const [colapsado, setColapsado] = useState(leer);

  const alternar = useCallback(() => {
    setColapsado((c) => {
      try { localStorage.setItem(KEY, c ? '0' : '1'); } catch { /* modo privado */ }
      return !c;
    });
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') { e.preventDefault(); alternar(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [alternar]);

  if (sp.loading || tree.loading) return <main className="mx-auto w-full max-w-5xl px-6 py-10"><Cargando /></main>;
  if (!sp.data || !tree.data) return <><NoEncontrado /><Footer /></>;

  const ctx: SpaceCtx = { space: sp.data, tree: tree.data, reloadTree: tree.reload };
  return (
    <div className="mx-auto flex w-full max-w-[90rem] flex-1 items-start gap-2 px-4 sm:px-6">
      <motion.aside
        initial={false}
        animate={{ width: colapsado ? 64 : 288 }}
        transition={{ type: 'spring', stiffness: 420, damping: 40 }}
        className="sticky top-16 hidden h-[calc(100dvh-4rem)] shrink-0 flex-col overflow-hidden py-4 lg:flex"
      >
        <div className={colapsado ? 'mb-2 flex justify-center' : 'mb-1 flex justify-end pr-1'}>
          <Button variant="ghost" size="icon" onClick={alternar} aria-label={colapsado ? 'Expandir menú (Ctrl+B)' : 'Contraer menú (Ctrl+B)'} title={colapsado ? 'Expandir menú (Ctrl+B)' : 'Contraer menú (Ctrl+B)'}>
            {colapsado ? <PanelLeftOpen /> : <PanelLeftClose />}
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden pr-1">
          <Sidebar tree={tree.data} nombre={sp.data.nombre} compacto={colapsado} />
        </div>
      </motion.aside>
      <Sheet open={menu} onOpenChange={setMenu} side="left" title={sp.data.nombre} description="Navegación del espacio">
        <Sidebar tree={tree.data} nombre="Secciones" onNavigate={() => setMenu(false)} />
      </Sheet>
      <div className="flex min-h-[calc(100dvh-4rem)] min-w-0 flex-1 flex-col pt-6 lg:pl-4">
        <main className="flex-1">
          <Button variant="outline" size="sm" className="mb-4 lg:hidden" onClick={() => setMenu(true)}><Menu />Secciones</Button>
          <Outlet context={ctx} />
        </main>
        <Footer dentro />
      </div>
    </div>
  );
}
