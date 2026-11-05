import type { Announcement } from '../api/types';
import { fmtDia } from '../lib';
import { MarkdownView } from './MarkdownView';

export function AnuncioCard({ a }: { a: Announcement }) {
  return (
    <article className={`card anuncio prioridad-${a.prioridad}`}>
      <header>
        <h3>{a.titulo}</h3>
        <div className="meta">
          {a.transversal && <span className="badge">Ministerio</span>}
          {a.prioridad === 'alta' && <span className="badge badge-alta">Prioridad alta</span>}
          <span className="muted">{fmtDia(a.publicado_at)}{a.autor ? ` · ${a.autor}` : ''}</span>
        </div>
      </header>
      <MarkdownView source={a.cuerpo_md} />
    </article>
  );
}
