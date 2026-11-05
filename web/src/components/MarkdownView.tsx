import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSanitize from 'rehype-sanitize';
import { Link, useLocation } from 'react-router-dom';

// Sanitización obligatoria: rehype-sanitize con el esquema por defecto (sin HTML crudo,
// sin javascript: en enlaces). react-markdown no interpreta HTML embebido salvo que se le pida.
const remarkPlugins = [remarkGfm];
const rehypePlugins = [rehypeSanitize];

const EXTERNAL = /^[a-z][a-z0-9+.-]*:/i; // http:, https:, mailto:, etc.

export function MarkdownView({ source }: { source: string }) {
  const { pathname } = useLocation();

  const components: Components = {
    a({ href, children }) {
      if (!href) return <span>{children}</span>;
      if (href.startsWith('#')) return <a href={href}>{children}</a>;
      if (EXTERNAL.test(href) || href.startsWith('//')) {
        return (
          <a href={href} target="_blank" rel="noopener noreferrer">
            {children}
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
    <div className="markdown">
      <ReactMarkdown remarkPlugins={remarkPlugins} rehypePlugins={rehypePlugins} components={components}>
        {source}
      </ReactMarkdown>
    </div>
  );
}
