import { Link, NavLink, Outlet, useParams } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';

export function AdminLayout() {
  const { espacio } = useParams();
  const { me } = useAuth();
  const nombre = espacio === 'ministerio' ? 'Ministerio (transversal)' : me?.spaces.find((s) => s.slug === espacio)?.nombre;
  return (
    <main className="contenido ancho">
      <nav className="breadcrumbs"><Link to="/admin">Administración</Link>{nombre && <> › <span>{nombre}</span></>}</nav>
      {espacio && (
        <ul className="tabs">
          {espacio !== 'ministerio' && <li><NavLink to={`/admin/${espacio}/contenido`}>Contenido</NavLink></li>}
          <li><NavLink to={`/admin/${espacio}/anuncios`}>Anuncios</NavLink></li>
          <li><NavLink to={`/admin/${espacio}/sistemas`}>Sistemas</NavLink></li>
          {espacio !== 'ministerio' && <li><NavLink to={`/admin/${espacio}/credenciales`}>Credenciales (referencias)</NavLink></li>}
        </ul>
      )}
      <Outlet />
    </main>
  );
}
