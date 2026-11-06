import { NavLink, Outlet, useParams } from 'react-router-dom';
import { motion } from 'motion/react';
import { Shield } from 'lucide-react';
import { useAuth } from '@/auth/AuthContext';
import { cn } from '@/ui/cn';
import { Breadcrumbs, PageEnter, PageHeader } from '@/components/ui/page';

export function AdminLayout() {
  const { espacio } = useParams();
  const { me } = useAuth();
  const nombre = espacio === 'ministerio' ? 'Ministerio (transversal)' : me?.spaces.find((s) => s.slug === espacio)?.nombre;
  const tabs = [
    ...(espacio !== 'ministerio' ? [{ to: `/admin/${espacio}/contenido`, label: 'Contenido' }] : []),
    { to: `/admin/${espacio}/anuncios`, label: 'Anuncios' },
    { to: `/admin/${espacio}/sistemas`, label: 'Sistemas' },
    ...(espacio !== 'ministerio' ? [{ to: `/admin/${espacio}/credenciales`, label: 'Credenciales' }] : []),
  ];
  return (
    <PageEnter className="mx-auto w-full max-w-[96rem] px-4 py-8 sm:px-6">
      <Breadcrumbs items={[{ to: '/admin', label: 'Administración' }, ...(nombre ? [{ label: nombre }] : [])]} />
      <PageHeader icon={<Shield />} title={nombre ?? 'Administración'} />
      {espacio && (
        <div className="mb-7 inline-flex max-w-full flex-wrap gap-1 rounded-full bg-muted p-1" role="tablist">
          {tabs.map((t) => (
            <NavLink key={t.to} to={t.to} className={({ isActive }) => cn('relative rounded-full px-4 py-1.5 text-sm font-medium transition-colors', isActive ? 'text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}>
              {({ isActive }) => (<>{isActive && <motion.span layoutId="admin-tab" className="absolute inset-0 rounded-full bg-primary shadow" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}<span className="relative z-10">{t.label}</span></>)}
            </NavLink>
          ))}
        </div>
      )}
      <Outlet />
    </PageEnter>
  );
}
