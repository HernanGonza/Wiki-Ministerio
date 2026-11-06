import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSanitize from 'rehype-sanitize';
import rehypeSlug from 'rehype-slug';
import { Link, useLocation } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';
import { cn } from '@/ui/cn';

// Sanitización obligatoria: rehype-sanitize con el esquema por defecto (sin HTML crudo,
// sin javascript: en enlaces). react-markdown no interpreta HTML embebido salvo que se le pida.
// rehype-slug va DESPUÉS de sanitize: así los ids de los títulos (para el índice lateral)
// no reciben el prefijo `user-content-` y siguen siendo seguros (generados, no del autor).
const remarkPlugins = [remarkGfm];
const rehypePlugins = [rehypeSanitize, rehypeSlug];

const EXTERNAL = /^[a-z][a-z0-9+.-]*:/i; // http:, https:, mailto:, etc.

export function MarkdownView({ source, className }: { source: string; className?: string }) {
  const { pathname } = useLocation();

  const components: Components = {
    a({ href, children }) {
      if (!href) return <span>{children}</span>;
      if (href.startsWith('#')) return <a href={href}>{children}</a>;
      if (EXTERNAL.test(href) || href.startsWith('//')) {
        return (
          <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1">
            {children}
            <ExternalLink className="size-3 opacity-60" aria-hidden="true" />
          </a>
        );
      }
      // Enlace interno: navega dentro de la SPA. Los relativos se resuelven contra la ruta actual.
      const base = pathname.endsWith('/') ? pathname : `${pathname}/`;
      const u = new URL(href, `http://x${base}`);
      const resolved = href.startsWith('/') ? href : u.pathname + u.search + u.hash;
      return <Link to={resolved}>{children}</Link>;
    },
  };

  return (
    <div className={cn('prose prose-wiki max-w-none dark:prose-invert', className)} data-markdown>
      <ReactMarkdown remarkPlugins={remarkPlugins} rehypePlugins={rehypePlugins} components={components}>
        {source}
      </ReactMarkdown>
    </div>
  );
}
