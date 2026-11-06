import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import * as Dialog from '@radix-ui/react-dialog';
import { Command } from 'cmdk';
import { AnimatePresence, motion } from 'motion/react';
import { BookOpen, FileText, FolderTree, Home, LogOut, Megaphone, Moon, Search, Shield, Sun, Activity, History, Layers } from 'lucide-react';
import { api } from '@/api/client';
import type { SectionNode, Space } from '@/api/types';
import { useAuth } from '@/auth/AuthContext';
import { useTheme } from '@/ui/theme';

interface PaletteCtx { open: boolean; setOpen: (o: boolean) => void }
const Ctx = createContext<PaletteCtx | null>(null);
export const usePalette = () => {
  const v = useContext(Ctx);
  if (!v) throw new Error('usePalette fuera de PaletteProvider');
  return v;
};

interface Entrada { espacio: Space; arbol: SectionNode[] }
let cache: Entrada[] | null = null; // se recarga al iniciar sesión (ver `invalidar`)
export const invalidarBusqueda = () => { cache = null; };

async function cargar(): Promise<Entrada[]> {
  if (cache) return cache;
  const espacios = (await api.get<Space[]>('/spaces')).filter((s) => s.slug !== 'ministerio');
  const res = await Promise.all(espacios.map(async (s) => ({ espacio: s, arbol: await api.get<SectionNode[]>(`/spaces/${s.slug}/sections`).catch(() => [] as SectionNode[]) })));
  cache = res;
  return res;
}

// Búsqueda sin tildes ni mayúsculas ("ordenamiento" encuentra "Ordenamiento", "gestion" encuentra "gestión").
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const filtro = (value: string, search: string, keywords?: string[]) => {
  const hay = norm(`${value} ${(keywords ?? []).join(' ')}`);
  const palabras = norm(search).split(/\s+/).filter(Boolean);
  return palabras.every((p) => hay.includes(p)) ? 1 : 0;
};

export function PaletteProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const { me } = useAuth();

  useEffect(() => {
    if (!me) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [me]);

  const value = useMemo(() => ({ open, setOpen }), [open]);
  return (
    <Ctx.Provider value={value}>
      {children}
      {me && <Palette />}
    </Ctx.Provider>
  );
}

function aplanar(nodes: SectionNode[], camino: string[] = []): { s: SectionNode; camino: string[] }[] {
  return nodes.flatMap((n) => [{ s: n, camino }, ...aplanar(n.children, [...camino, n.titulo])]);
}

function Palette() {
  const { open, setOpen } = usePalette();
  const nav = useNavigate();
  const { me, logout, esAdminDeAlgo } = useAuth();
  const { oscuro, alternar } = useTheme();
  const [datos, setDatos] = useState<Entrada[] | null>(null);
  const [busqueda, setBusqueda] = useState('');

  useEffect(() => {
    if (!open) { setBusqueda(''); return; }
    let vivo = true;
    cargar().then((d) => vivo && setDatos(d)).catch(() => vivo && setDatos([]));
    return () => { vivo = false; };
  }, [open]);

  const ir = useCallback((to: string) => { setOpen(false); nav(to); }, [nav, setOpen]);

  const items = useMemo(() => {
    const secciones: { id: string; titulo: string; ruta: string; sub: string; icono: string | null }[] = [];
    const paginas: { id: string; titulo: string; ruta: string; sub: string }[] = [];
    for (const { espacio, arbol } of datos ?? []) {
      for (const { s, camino } of aplanar(arbol)) {
        const sub = [espacio.nombre, ...camino].join(' › ');
        secciones.push({ id: s.id, titulo: s.titulo, ruta: `/${espacio.slug}/s/${s.slug}`, sub, icono: s.icono });
        for (const p of s.pages) paginas.push({ id: p.id, titulo: p.titulo, ruta: `/${espacio.slug}/s/${s.slug}/${p.slug}`, sub: `${sub} › ${s.titulo}` });
      }
    }
    return { secciones, paginas };
  }, [datos]);

  const itemCls = 'group flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm outline-none transition data-[selected=true]:bg-secondary [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-muted-foreground data-[selected=true]:[&_svg]:text-primary';
  const grupoCls = '[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:text-[0.7rem] [&_[cmdk-group-heading]]:font-bold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-muted-foreground';

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild forceMount>
              <motion.div className="fixed inset-0 z-50 bg-verde-900/45 backdrop-blur-[3px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
            </Dialog.Overlay>
            <div className="pointer-events-none fixed inset-0 z-50 flex items-start justify-center px-4 pt-[12vh]">
              <Dialog.Content asChild forceMount aria-describedby={undefined}>
                <motion.div
                  className="pointer-events-auto w-full max-w-xl overflow-hidden rounded-3xl border bg-popover text-popover-foreground shadow-2xl outline-none"
                  initial={{ opacity: 0, scale: 0.95, y: -12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97, y: -6 }}
                  transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                >
                  <Dialog.Title className="sr-only">Buscar en la wiki</Dialog.Title>
                  <Command label="Buscar en la wiki" filter={filtro} loop>
                    <div className="flex items-center gap-3 border-b px-4">
                      <Search className="size-4 text-muted-foreground" />
                      <Command.Input value={busqueda} onValueChange={setBusqueda} autoFocus placeholder="Buscar páginas, secciones o acciones…"
                        className="h-14 flex-1 bg-transparent text-[0.95rem] outline-none placeholder:text-muted-foreground" />
                      <kbd className="rounded-md border bg-muted px-1.5 py-0.5 text-[0.65rem] font-semibold text-muted-foreground">ESC</kbd>
                    </div>
                    <Command.List className="max-h-[52vh] overflow-y-auto p-2">
                      <Command.Empty className="px-4 py-10 text-center text-sm text-muted-foreground">
                        {datos === null ? 'Cargando…' : 'No se encontró nada con ese texto.'}
                      </Command.Empty>

                      {items.paginas.length > 0 && (
                        <Command.Group heading="Páginas" className={grupoCls}>
                          {items.paginas.map((p) => (
                            <Command.Item key={p.id} value={`${p.titulo} ${p.id}`} keywords={[p.sub]} onSelect={() => ir(p.ruta)} className={itemCls}>
                              <FileText />
                              <span className="min-w-0"><span className="block truncate font-medium">{p.titulo}</span><span className="block truncate text-xs text-muted-foreground">{p.sub}</span></span>
                            </Command.Item>
                          ))}
                        </Command.Group>
                      )}
                      {items.secciones.length > 0 && (
                        <Command.Group heading="Secciones" className={grupoCls}>
                          {items.secciones.map((s) => (
                            <Command.Item key={s.id} value={`${s.titulo} ${s.id}`} keywords={[s.sub]} onSelect={() => ir(s.ruta)} className={itemCls}>
                              {s.icono ? <span className="text-base leading-none">{s.icono}</span> : <FolderTree />}
                              <span className="min-w-0"><span className="block truncate font-medium">{s.titulo}</span><span className="block truncate text-xs text-muted-foreground">{s.sub}</span></span>
                            </Command.Item>
                          ))}
                        </Command.Group>
                      )}
                      <Command.Group heading="Espacios" className={grupoCls}>
                        <Command.Item value="inicio portada ministerio" onSelect={() => ir('/')} className={itemCls}><Home />Inicio</Command.Item>
                        {(datos ?? []).map(({ espacio }) => (
                          <Command.Item key={espacio.slug} value={`espacio ${espacio.nombre}`} onSelect={() => ir(`/${espacio.slug}`)} className={itemCls}>
                            <Layers />{espacio.nombre}
                          </Command.Item>
                        ))}
                      </Command.Group>
                      <Command.Group heading="Acciones" className={grupoCls}>
                        {(datos ?? []).map(({ espacio }) => (
                          <Command.Item key={`s-${espacio.slug}`} value={`estado de sistemas ${espacio.nombre}`} onSelect={() => ir(`/${espacio.slug}/sistemas`)} className={itemCls}>
                            <Activity />Estado de sistemas · {espacio.nombre}
                          </Command.Item>
                        ))}
                        {(datos ?? []).map(({ espacio }) => (
                          <Command.Item key={`a-${espacio.slug}`} value={`anuncios ${espacio.nombre}`} onSelect={() => ir(`/${espacio.slug}/anuncios`)} className={itemCls}>
                            <Megaphone />Anuncios · {espacio.nombre}
                          </Command.Item>
                        ))}
                        {esAdminDeAlgo && <Command.Item value="administracion admin" onSelect={() => ir('/admin')} className={itemCls}><Shield />Administración</Command.Item>}
                        {esAdminDeAlgo && <Command.Item value="auditoria registro" onSelect={() => ir('/auditoria')} className={itemCls}><History />Auditoría</Command.Item>}
                        <Command.Item value="cambiar tema modo oscuro claro" onSelect={() => { alternar(); setOpen(false); }} className={itemCls}>
                          {oscuro ? <Sun /> : <Moon />}{oscuro ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
                        </Command.Item>
                        <Command.Item value="cambiar contrasena clave" onSelect={() => ir('/cambiar-password')} className={itemCls}><BookOpen />Cambiar contraseña</Command.Item>
                        <Command.Item value="salir cerrar sesion" onSelect={async () => { setOpen(false); invalidarBusqueda(); await logout(); nav('/login'); }} className={itemCls}>
                          <LogOut />Cerrar sesión{me ? ` (${me.nombre})` : ''}
                        </Command.Item>
                      </Command.Group>
                    </Command.List>
                    <footer className="flex items-center gap-4 border-t bg-muted/40 px-4 py-2 text-[0.7rem] text-muted-foreground">
                      <span><kbd className="font-semibold">↑↓</kbd> moverse</span>
                      <span><kbd className="font-semibold">↵</kbd> abrir</span>
                      <span className="ml-auto"><kbd className="font-semibold">Ctrl</kbd> + <kbd className="font-semibold">K</kbd></span>
                    </footer>
                  </Command>
                </motion.div>
              </Dialog.Content>
            </div>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}
