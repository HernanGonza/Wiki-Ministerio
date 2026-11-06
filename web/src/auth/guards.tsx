import { Navigate, Outlet, useLocation, useParams } from 'react-router-dom';
import { useAuth, esAdmin } from './AuthContext';
import { NoEncontrado, Cargando } from '@/components/Estados';

/** Exige sesión. Si debe cambiar la contraseña, lo lleva a /cambiar-password. */
export function RequireAuth() {
  const { me, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <div className="mx-auto w-full max-w-5xl px-6 py-10"><Cargando /></div>;
  if (!me) return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  if (me.must_change_password && loc.pathname !== '/cambiar-password') {
    return <Navigate to="/cambiar-password" replace />;
  }
  return <Outlet />;
}

/**
 * Oculta la ruta según el rol en el espacio de la URL. Es solo comodidad de UI:
 * quien decide es la API. Sin rol → "no encontrado", igual que la API.
 */
export function RequireSpaceRole({ min }: { min: 'general' | 'admin_espacio' }) {
  const { rolEn } = useAuth();
  const { espacio = '' } = useParams();
  const rol = rolEn(espacio);
  if (!rol) return <NoEncontrado />;
  if (min === 'admin_espacio' && !esAdmin(rol)) return <NoEncontrado />;
  return <Outlet />;
}
