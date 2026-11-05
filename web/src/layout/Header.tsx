import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { SpaceSwitcher } from './SpaceSwitcher';

export function Header() {
  const { me, logout, esAdminDeAlgo } = useAuth();
  const nav = useNavigate();
  return (
    <header className="header">
      <Link to="/" className="brand" aria-label="Wiki MERNR, inicio">
        {/* Marca provisoria hasta contar con el logo del Ministerio */}
        <span className="brand-mark" aria-hidden="true">M</span>
        <span>
          <strong>Wiki MERNR</strong>
          <small>Base de conocimiento del Ministerio</small>
        </span>
      </Link>
      {me && (
        <nav className="header-nav" aria-label="Principal">
          <SpaceSwitcher />
          {esAdminDeAlgo && <Link to="/admin">Administración</Link>}
          {esAdminDeAlgo && <Link to="/auditoria">Auditoría</Link>}
          <span className="muted user">{me.nombre}</span>
          <button
            className="btn btn-link"
            onClick={async () => {
              await logout();
              nav('/login');
            }}
          >
            Salir
          </button>
        </nav>
      )}
    </header>
  );
}
