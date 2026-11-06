import { Link, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { History, KeyRound, LogOut, Moon, Search, Shield, Sun } from 'lucide-react';
import { useAuth } from '@/auth/AuthContext';
import { Logo } from '@/ui/brand';
import { useTheme } from '@/ui/theme';
import { Button } from '@/components/ui/button';
import { Dropdown, DropdownContent, DropdownItem, DropdownLabel, DropdownSeparator, DropdownTrigger } from '@/components/ui/dropdown';
import { SpaceSwitcher } from './SpaceSwitcher';
import { invalidarBusqueda, usePalette } from './CommandPalette';

export function ThemeToggle() {
  const { oscuro, alternar } = useTheme();
  return (
    <Button variant="ghost" size="icon" onClick={alternar} aria-label={oscuro ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}>
      <AnimatePresence mode="wait" initial={false}>
        <motion.span key={oscuro ? 'o' : 'c'} initial={{ rotate: -90, opacity: 0, scale: 0.6 }} animate={{ rotate: 0, opacity: 1, scale: 1 }} exit={{ rotate: 90, opacity: 0, scale: 0.6 }} transition={{ duration: 0.18 }}>
          {oscuro ? <Sun /> : <Moon />}
        </motion.span>
      </AnimatePresence>
    </Button>
  );
}

const iniciales = (n: string) => n.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join('');

export function Header() {
  const { me, logout, esAdminDeAlgo } = useAuth();
  const { setOpen } = usePalette();
  const nav = useNavigate();
  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-[90rem] items-center gap-2 px-4 sm:gap-3 sm:px-6">
        <Link to="/" aria-label="Wiki Ecología Misiones, inicio" className="mr-1 rounded-xl transition hover:opacity-85">
          <Logo compacto />
        </Link>
        {me && <div className="hidden md:block"><SpaceSwitcher /></div>}
        <div className="ml-auto flex items-center gap-1.5">
          {me && (
            <button
              onClick={() => setOpen(true)}
              className="group flex h-10 items-center gap-2.5 rounded-full border bg-card/70 pl-4 pr-2 text-sm text-muted-foreground shadow-xs transition hover:border-primary/50 hover:text-foreground sm:w-64"
              aria-label="Buscar (Ctrl+K)"
            >
              <Search className="size-4" />
              <span className="hidden flex-1 text-left sm:block">Buscar en la wiki…</span>
              <kbd className="hidden rounded-md border bg-muted px-1.5 py-0.5 text-[0.65rem] font-semibold sm:block">Ctrl K</kbd>
              <span className="sm:hidden size-6" />
            </button>
          )}
          {me && esAdminDeAlgo && (
            <Button asChild variant="ghost" size="sm" className="hidden lg:inline-flex"><Link to="/admin"><Shield />Administración</Link></Button>
          )}
          <ThemeToggle />
          {me && (
            <Dropdown>
              <DropdownTrigger asChild>
                <button aria-label="Cuenta" className="grid size-9 place-items-center rounded-full bg-gradient-to-br from-verde-700 to-oliva text-xs font-bold text-white shadow-sm ring-2 ring-background transition hover:scale-105">
                  {iniciales(me.nombre) || '?'}
                </button>
              </DropdownTrigger>
              <DropdownContent>
                <DropdownLabel>{me.nombre}<span className="block font-normal">{me.email}</span></DropdownLabel>
                <DropdownSeparator />
                {esAdminDeAlgo && <DropdownItem onSelect={() => nav('/admin')}><Shield />Administración</DropdownItem>}
                {esAdminDeAlgo && <DropdownItem onSelect={() => nav('/auditoria')}><History />Auditoría</DropdownItem>}
                <DropdownItem onSelect={() => nav('/cambiar-password')}><KeyRound />Cambiar contraseña</DropdownItem>
                <DropdownSeparator />
                <DropdownItem onSelect={async () => { invalidarBusqueda(); await logout(); nav('/login'); }}><LogOut />Cerrar sesión</DropdownItem>
              </DropdownContent>
            </Dropdown>
          )}
        </div>
      </div>
    </header>
  );
}
