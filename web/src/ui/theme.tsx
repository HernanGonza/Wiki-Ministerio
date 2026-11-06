import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export type Tema = 'claro' | 'oscuro' | 'sistema';
const KEY = 'wiki-tema';

function leer(): Tema {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'claro' || v === 'oscuro' ? v : 'sistema';
  } catch {
    return 'sistema';
  }
}
const prefiereOscuro = () => window.matchMedia('(prefers-color-scheme: dark)').matches;
const aplicar = (t: Tema) => document.documentElement.classList.toggle('dark', t === 'oscuro' || (t === 'sistema' && prefiereOscuro()));

// Se aplica antes de montar React para evitar el destello de tema equivocado.
aplicar(leer());

interface Ctx { tema: Tema; oscuro: boolean; setTema: (t: Tema) => void; alternar: () => void }
const ThemeCtx = createContext<Ctx | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [tema, setTemaState] = useState<Tema>(leer);
  const [oscuro, setOscuro] = useState(() => document.documentElement.classList.contains('dark'));

  const setTema = useCallback((t: Tema) => {
    setTemaState(t);
    try { localStorage.setItem(KEY, t); } catch { /* modo privado */ }
    aplicar(t);
    setOscuro(document.documentElement.classList.contains('dark'));
  }, []);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const on = () => { if (tema === 'sistema') { aplicar('sistema'); setOscuro(mq.matches); } };
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [tema]);

  const value = useMemo<Ctx>(() => ({ tema, oscuro, setTema, alternar: () => setTema(oscuro ? 'claro' : 'oscuro') }), [tema, oscuro, setTema]);
  return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>;
}

export function useTheme() {
  const v = useContext(ThemeCtx);
  if (!v) throw new Error('useTheme fuera de ThemeProvider');
  return v;
}
