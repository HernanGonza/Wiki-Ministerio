import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';

export function AdminHome() {
  const { me } = useAuth();
  if (!me) return null;
  const espacios = me.spaces.filter((s) => s.rol !== 'general');
  return (
    <main className="contenido ancho">
      <h1>Administración</h1>
      {me.es_admin_global && (
        <section>
          <h2>Plataforma</h2>
          <div className="grid">
            <Link className="card space-card" to="/admin/espacios"><h3>Espacios</h3><p>Crear, activar y desactivar espacios.</p></Link>
            <Link className="card space-card" to="/admin/usuarios"><h3>Usuarios y roles</h3><p>Altas, contraseñas temporales y roles por espacio.</p></Link>
            <Link className="card space-card" to="/admin/ministerio/anuncios"><h3>Anuncios del Ministerio</h3><p>Visibles en todos los espacios.</p></Link>
            <Link className="card space-card" to="/admin/ministerio/sistemas"><h3>Sistemas transversales</h3><p>Aparecen en el estado de todos los espacios.</p></Link>
          </div>
        </section>
      )}
      <section>
        <h2>Espacios</h2>
        {!espacios.length && <p className="muted">Sin espacios para administrar.</p>}
        <div className="grid">
          {espacios.map((s) => (
            <Link key={s.slug} className="card space-card" to={`/admin/${s.slug}/contenido`}>
              <h3>{s.nombre}</h3><p>Contenido, anuncios, sistemas y referencias de credenciales.</p>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
