import { Link } from 'react-router-dom';
import { ArrowUpRight, Building2, Layers, Megaphone, Server, Users } from 'lucide-react';
import { useAuth } from '@/auth/AuthContext';
import { PageEnter, PageHeader, SectionTitle } from '@/components/ui/page';
import { Reveal } from '@/components/ui/reveal';
import { SpotlightCard } from '@/components/ui/card';

function Tarjeta({ to, icon, titulo, texto }: { to: string; icon: React.ReactNode; titulo: string; texto: string }) {
  return (
    <SpotlightCard asChild>
      <Link to={to} className="flex h-full flex-col gap-3 p-5">
        <div className="flex items-start justify-between">
          <span className="grid size-11 place-items-center rounded-xl bg-primary/12 text-primary transition-transform duration-300 group-hover/spot:scale-110 [&_svg]:size-5">{icon}</span>
          <ArrowUpRight className="size-4 text-muted-foreground transition group-hover/spot:text-primary" />
        </div>
        <div><h3 className="font-bold">{titulo}</h3><p className="mt-1 text-sm text-muted-foreground">{texto}</p></div>
      </Link>
    </SpotlightCard>
  );
}

export function AdminHome() {
  const { me } = useAuth();
  if (!me) return null;
  const espacios = me.spaces.filter((s) => s.rol !== 'general');
  return (
    <PageEnter className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
      <PageHeader title="Administración" description="Contenido, usuarios y configuración de la plataforma." />
      {me.es_admin_global && (
        <>
          <SectionTitle>Plataforma</SectionTitle>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { to: '/admin/espacios', icon: <Layers />, titulo: 'Espacios', texto: 'Crear, activar y desactivar espacios.' },
              { to: '/admin/usuarios', icon: <Users />, titulo: 'Usuarios y roles', texto: 'Altas, contraseñas temporales y roles por espacio.' },
              { to: '/admin/ministerio/anuncios', icon: <Megaphone />, titulo: 'Anuncios del Ministerio', texto: 'Visibles en todos los espacios.' },
              { to: '/admin/ministerio/sistemas', icon: <Server />, titulo: 'Sistemas transversales', texto: 'Aparecen en el estado de todos los espacios.' },
            ].map((t, i) => <Reveal key={t.to} delay={i * 0.06}><Tarjeta {...t} /></Reveal>)}
          </div>
        </>
      )}
      <SectionTitle>Mis espacios</SectionTitle>
      {!espacios.length && <p className="text-sm text-muted-foreground">Sin espacios para administrar.</p>}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {espacios.map((s, i) => <Reveal key={s.slug} delay={i * 0.06}><Tarjeta to={`/admin/${s.slug}/contenido`} icon={<Building2 />} titulo={s.nombre} texto="Contenido, anuncios, sistemas y referencias de credenciales." /></Reveal>)}
      </div>
    </PageEnter>
  );
}
