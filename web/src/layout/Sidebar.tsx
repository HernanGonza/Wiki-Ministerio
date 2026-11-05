import { useState } from 'react';
import { NavLink, useParams } from 'react-router-dom';
import type { SectionNode } from '../api/types';

function Node({ n, espacio, activa, nivel }: { n: SectionNode; espacio: string; activa: string | undefined; nivel: number }) {
  const contieneActiva = (x: SectionNode): boolean => x.slug === activa || x.children.some(contieneActiva);
  const [abierto, setAbierto] = useState(contieneActiva(n));
  const tieneHijos = n.children.length > 0;
  return (
    <li>
      <div className={`side-item nivel-${nivel}`}>
        {tieneHijos ? (
          <button className="side-toggle" onClick={() => setAbierto(!abierto)} aria-expanded={abierto} aria-label={abierto ? 'Contraer' : 'Expandir'}>
            {abierto ? '▾' : '▸'}
          </button>
        ) : (
          <span className="side-toggle" />
        )}
        <NavLink to={`/${espacio}/s/${n.slug}`} className={({ isActive }) => (isActive ? 'active' : undefined)}>
          {n.icono && <span aria-hidden="true">{n.icono} </span>}
          {n.titulo}
          {n.restringido && <span title="Restringido"> 🔒</span>}
        </NavLink>
      </div>
      {tieneHijos && abierto && (
        <ul>
          {n.children.map((c) => (
            <Node key={c.id} n={c} espacio={espacio} activa={activa} nivel={nivel + 1} />
          ))}
        </ul>
      )}
    </li>
  );
}

export function Sidebar({ tree }: { tree: SectionNode[] }) {
  const { espacio = '', seccion } = useParams();
  return (
    <nav className="sidebar" aria-label="Secciones">
      <ul>
        <li>
          <div className="side-item nivel-1">
            <span className="side-toggle" />
            <NavLink to={`/${espacio}`} end>Inicio del espacio</NavLink>
          </div>
        </li>
        {tree.map((n) => (
          <Node key={n.id} n={n} espacio={espacio} activa={seccion} nivel={1} />
        ))}
        <li>
          <div className="side-item nivel-1">
            <span className="side-toggle" />
            <NavLink to={`/${espacio}/sistemas`}>🟢 Estado de sistemas</NavLink>
          </div>
        </li>
        <li>
          <div className="side-item nivel-1">
            <span className="side-toggle" />
            <NavLink to={`/${espacio}/anuncios`}>📣 Anuncios</NavLink>
          </div>
        </li>
      </ul>
    </nav>
  );
}
