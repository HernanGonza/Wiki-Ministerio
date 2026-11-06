import { useEffect, useState, type RefObject } from 'react';
import { AlignLeft } from 'lucide-react';
import { cn } from '@/ui/cn';

interface Item { id: string; texto: string; nivel: number }

/** Índice lateral de la página (h2/h3) con resaltado de la sección que se está leyendo. */
export function Toc({ contenedor, dep }: { contenedor: RefObject<HTMLElement | null>; dep: unknown }) {
  const [items, setItems] = useState<Item[]>([]);
  const [activo, setActivo] = useState('');

  useEffect(() => {
    const root = contenedor.current;
    if (!root) return;
    const hs = Array.from(root.querySelectorAll<HTMLHeadingElement>('h2[id], h3[id]'));
    setItems(hs.map((h) => ({ id: h.id, texto: h.textContent ?? '', nivel: h.tagName === 'H2' ? 2 : 3 })));
    if (!hs.length) return;
    const obs = new IntersectionObserver(
      (es) => { const v = es.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]; if (v) setActivo(v.target.id); },
      { rootMargin: '-80px 0px -70% 0px' },
    );
    hs.forEach((h) => obs.observe(h));
    return () => obs.disconnect();
  }, [contenedor, dep]);

  if (items.length < 2) return null;
  return (
    <nav aria-label="En esta página" className="sticky top-24 hidden max-h-[calc(100dvh-8rem)] w-56 shrink-0 overflow-y-auto xl:block">
      <p className="mb-3 flex items-center gap-2 text-[0.7rem] font-bold uppercase tracking-wider text-muted-foreground"><AlignLeft className="size-3.5" />En esta página</p>
      <ul className="border-l">
        {items.map((i) => (
          <li key={i.id}>
            <a href={`#${i.id}`} onClick={(e) => { e.preventDefault(); document.getElementById(i.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); setActivo(i.id); }}
              className={cn('-ml-px block border-l-2 border-transparent py-1.5 pr-2 text-[0.82rem] leading-snug text-muted-foreground transition hover:text-foreground', i.nivel === 3 ? 'pl-6' : 'pl-3', activo === i.id && 'border-primary font-semibold text-primary')}>
              {i.texto}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
