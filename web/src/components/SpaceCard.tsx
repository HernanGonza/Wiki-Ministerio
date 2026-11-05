import { Link } from 'react-router-dom';
import type { Space } from '../api/types';

export function SpaceCard({ s }: { s: Space }) {
  return (
    <Link to={`/${s.slug}`} className="card space-card">
      <h3>{s.nombre}</h3>
      {s.descripcion && <p>{s.descripcion}</p>}
      <span className="muted">{s.rol === 'general' ? 'Lectura' : 'Administración'}</span>
    </Link>
  );
}
