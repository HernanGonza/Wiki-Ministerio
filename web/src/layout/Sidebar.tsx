import { useState } from 'react';
import { NavLink, useParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { Activity, ChevronRight, Folder, Home, Lock, Megaphone } from 'lucide-react';
import type { SectionNode } from '@/api/types';
import { cn } from '@/ui/cn';

const linkBase = 'relative flex min-w-0 flex-1 items-center gap-2 rounded-xl px-3 py-2 text-[0.88rem] font-medium text-foreground/80 transition-colors hover:bg-secondary hover:text-foreground';

function Activo() {
  return <motion.span layoutId="side-activo" className="absolute inset-0 -z-10 rounded-xl bg-primary/12 ring-1 ring-primary/25" transition={{ type: 'spring', stiffness: 500, damping: 40 }} />;
}

function Node({ n, espacio, activa, nivel, onNavigate }: { n: SectionNode; espacio: string; activa: string | undefined; nivel: number; onNavigate?: () => void }) {
  const contieneActiva = (x: SectionNode): boolean => x.slug === activa || x.children.some(contieneActiva);
  const [abierto, setAbierto] = useState(contieneActiva(n));
  const tieneHijos = n.children.length > 0;
  return (
    <li>
      <div className="flex items-center gap-0.5" style={{ paddingLeft: (nivel - 1) * 14 }}>
        {tieneHijos ? (
          <button onClick={() => setAbierto(!abierto)} aria-expanded={abierto} aria-label={abierto ? 'Contraer' : 'Expandir'} className="grid size-7 shrink-0 place-items-center rounded-lg text-muted-foreground transition hover:bg-secondary">
            <ChevronRight className={cn('size-4 transition-transform duration-200', abierto && 'rotate-90')} />
          </button>
        ) : <span className="size-7 shrink-0" />}
        <NavLink to={`/${espacio}/s/${n.slug}`} onClick={onNavigate} className={({ isActive }) => cn(linkBase, isActive && 'text-primary')}>
          {({ isActive }) => (
            <>
              {isActive && <Activo />}
              {n.icono && <span aria-hidden="true" className="text-base leading-none">{n.icono}</span>}
              <span className="truncate">{n.titulo}</span>
              {n.restringido && <Lock className="ml-auto size-3.5 shrink-0 text-muted-foreground" aria-label="Restringido" />}
            </>
          )}
        </NavLink>
      </div>
      <AnimatePresence initial={false}>
        {tieneHijos && abierto && (
          <motion.ul initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22, ease: 'easeOut' }} className="overflow-hidden">
            {n.children.map((c) => <Node key={c.id} n={c} espacio={espacio} activa={activa} nivel={nivel + 1} onNavigate={onNavigate} />)}
          </motion.ul>
        )}
      </AnimatePresence>
    </li>
  );
}

function Fijo({ to, icon, children, end, onNavigate }: { to: string; icon: React.ReactNode; children: React.ReactNode; end?: boolean; onNavigate?: () => void }) {
  return (
    <li className="pl-[1.85rem]">
      <NavLink to={to} end={end} onClick={onNavigate} className={({ isActive }) => cn(linkBase, '[&_svg]:size-4', isActive && 'text-primary')}>
        {({ isActive }) => (<>{isActive && <Activo />}{icon}<span className="truncate">{children}</span></>)}
      </NavLink>
    </li>
  );
}

/** Modo compacto (barra colapsada): solo íconos, con el nombre como tooltip. */
function IconoLink({ to, label, end, children }: { to: string; label: string; end?: boolean; children: React.ReactNode }) {
  return (
    <li>
      <NavLink to={to} end={end} title={label} aria-label={label}
        className={({ isActive }) => cn('relative mx-auto grid size-10 place-items-center rounded-xl text-foreground/75 transition hover:bg-secondary hover:text-foreground [&_svg]:size-[1.15rem]', isActive && 'text-primary')}>
        {({ isActive }) => (<>{isActive && <Activo />}{children}</>)}
      </NavLink>
    </li>
  );
}

export function Sidebar({ tree, nombre, onNavigate, compacto = false }: { tree: SectionNode[]; nombre: string; onNavigate?: () => void; compacto?: boolean }) {
  const { espacio = '', seccion: activa } = useParams();

  if (compacto) {
    return (
      <nav aria-label="Secciones" className="flex flex-col items-center gap-1">
        <ul className="flex flex-col gap-1">
          <IconoLink to={`/${espacio}`} end label="Inicio del espacio"><Home /></IconoLink>
          {tree.map((n) => (
            <IconoLink key={n.id} to={`/${espacio}/s/${n.slug}`} label={n.titulo}>
              {n.icono ? <span className="text-lg leading-none">{n.icono}</span> : <Folder />}
            </IconoLink>
          ))}
        </ul>
        <div className="my-2 h-px w-8 bg-border" />
        <ul className="flex flex-col gap-1">
          <IconoLink to={`/${espacio}/sistemas`} label="Estado de sistemas"><Activity /></IconoLink>
          <IconoLink to={`/${espacio}/anuncios`} label="Anuncios"><Megaphone /></IconoLink>
        </ul>
      </nav>
    );
  }

  return (
    <nav aria-label="Secciones" className="flex flex-col gap-1">
      <p className="mb-2 truncate px-3 text-[0.7rem] font-bold uppercase tracking-wider text-muted-foreground">{nombre}</p>
      <ul className="flex flex-col gap-0.5">
        <Fijo to={`/${espacio}`} end icon={<Home />} onNavigate={onNavigate}>Inicio del espacio</Fijo>
        {tree.map((n) => <Node key={n.id} n={n} espacio={espacio} activa={activa} nivel={1} onNavigate={onNavigate} />)}
      </ul>
      <div className="my-3 h-px bg-border" />
      <ul className="flex flex-col gap-0.5">
        <Fijo to={`/${espacio}/sistemas`} icon={<Activity />} onNavigate={onNavigate}>Estado de sistemas</Fijo>
        <Fijo to={`/${espacio}/anuncios`} icon={<Megaphone />} onNavigate={onNavigate}>Anuncios</Fijo>
      </ul>
    </nav>
  );
}
