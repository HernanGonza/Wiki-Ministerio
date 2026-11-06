import type { SectionNode } from '@/api/types';

export { Breadcrumbs, type Crumb } from '@/components/ui/page';

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
