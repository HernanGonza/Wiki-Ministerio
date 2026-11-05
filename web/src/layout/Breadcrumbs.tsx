import { Link } from 'react-router-dom';
import type { SectionNode } from '../api/types';

/** Camino desde la raíz hasta la sección con ese slug (o null). */
export function pathTo(tree: SectionNode[], slug: string, acc: SectionNode[] = []): SectionNode[] | null {
  for (const n of tree) {
    const here = [...acc, n];
    if (n.slug === slug) return here;
    const r = pathTo(n.children, slug, here);
    if (r) return r;
  }
  return null;
}

export interface Crumb { to?: string; label: string }

export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav className="breadcrumbs" aria-label="Ruta">
      {items.map((c, i) => (
        <span key={i}>
          {i > 0 && <span aria-hidden="true"> › </span>}
          {c.to ? <Link to={c.to}>{c.label}</Link> : <span aria-current="page">{c.label}</span>}
        </span>
      ))}
    </nav>
  );
}
