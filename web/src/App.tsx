import { Navigate, Route, Routes } from 'react-router-dom';
import { RequireAuth, RequireSpaceRole } from './auth/guards';
import { useAuth } from './auth/AuthContext';
import { Layout } from './layout/Layout';
import { SpaceLayout } from './layout/SpaceLayout';
import { NoEncontrado } from './components/Estados';
import { Login } from './pages/Login';
import { CambiarPassword } from './pages/CambiarPassword';
import { Portada } from './pages/Portada';
import { Espacio } from './pages/Espacio';
import { Seccion } from './pages/Seccion';
import { Sistemas } from './pages/Sistemas';
import { Anuncios } from './pages/Anuncios';
import { Auditoria } from './pages/Auditoria';
import { AdminLayout } from './pages/admin/AdminLayout';
import { AdminHome } from './pages/admin/AdminHome';
import { AdminEspacios } from './pages/admin/AdminEspacios';
import { AdminUsuarios } from './pages/admin/AdminUsuarios';
import { AdminContenido } from './pages/admin/AdminContenido';
import { AdminAnuncios } from './pages/admin/AdminAnuncios';
import { AdminSistemas } from './pages/admin/AdminSistemas';
import { AdminCredenciales } from './pages/admin/AdminCredenciales';

function SoloAdminGlobal({ children }: { children: JSX.Element }) {
  const { me } = useAuth();
  return me?.es_admin_global ? children : <NoEncontrado />;
}
function SoloAdmins({ children }: { children: JSX.Element }) {
  const { esAdminDeAlgo } = useAuth();
  return esAdminDeAlgo ? children : <NoEncontrado />;
}

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/login" element={<Login />} />
        <Route element={<RequireAuth />}>
          <Route path="/cambiar-password" element={<CambiarPassword />} />
          <Route path="/" element={<Portada />} />
          <Route path="/ministerio" element={<Navigate to="/" replace />} />
          <Route path="/auditoria" element={<SoloAdmins><Auditoria /></SoloAdmins>} />

          <Route path="/admin" element={<SoloAdmins><AdminHome /></SoloAdmins>} />
          <Route path="/admin/espacios" element={<SoloAdminGlobal><AdminEspacios /></SoloAdminGlobal>} />
          <Route path="/admin/usuarios" element={<SoloAdminGlobal><AdminUsuarios /></SoloAdminGlobal>} />
          <Route path="/admin/:espacio" element={<RequireSpaceRole min="admin_espacio" />}>
            <Route element={<AdminLayout />}>
              <Route index element={<Navigate to="contenido" replace />} />
              <Route path="contenido" element={<AdminContenido />} />
              <Route path="anuncios" element={<AdminAnuncios />} />
              <Route path="sistemas" element={<AdminSistemas />} />
              <Route path="credenciales" element={<AdminCredenciales />} />
            </Route>
          </Route>

          <Route path="/:espacio" element={<RequireSpaceRole min="general" />}>
            <Route element={<SpaceLayout />}>
              <Route index element={<Espacio />} />
              <Route path="s/:seccion/:pagina?" element={<Seccion />} />
              <Route path="sistemas" element={<Sistemas />} />
              <Route path="anuncios" element={<Anuncios />} />
            </Route>
          </Route>
        </Route>
        <Route path="*" element={<NoEncontrado />} />
      </Route>
    </Routes>
  );
}
