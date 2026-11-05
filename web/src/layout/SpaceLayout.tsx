import { Outlet, useParams } from 'react-router-dom';
import { api } from '../api/client';
import type { SectionNode, Space } from '../api/types';
import { useAsync } from '../lib';
import { Cargando } from '../components/Estados';
import { NoEncontrado } from '../components/Estados';
import { Sidebar } from './Sidebar';

export interface SpaceCtx {
  space: Space;
  tree: SectionNode[];
  reloadTree: () => void;
}

/** Marco de un espacio: barra lateral con el árbol de secciones + contenido. */
export function SpaceLayout() {
  const { espacio = '' } = useParams();
  const sp = useAsync(() => api.get<Space>(`/spaces/${espacio}`), [espacio]);
  const tree = useAsync(() => api.get<SectionNode[]>(`/spaces/${espacio}/sections`), [espacio]);

  if (sp.loading || tree.loading) return <main className="contenido"><Cargando /></main>;
  if (!sp.data || !tree.data) return <main className="contenido"><NoEncontrado /></main>;

  const ctx: SpaceCtx = { space: sp.data, tree: tree.data, reloadTree: tree.reload };
  return (
    <div className="space-layout">
      <Sidebar tree={tree.data} />
      <main className="contenido">
        <Outlet context={ctx} />
      </main>
    </div>
  );
}
