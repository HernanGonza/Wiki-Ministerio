import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, ApiError, setAuthFailureHandler } from '../api/client';
import type { Me, Rol } from '../api/types';

interface AuthValue {
  me: Me | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<Me>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  /** Rol del usuario en un espacio (el ministerio es siempre `general`). */
  rolEn: (slug: string) => Rol | null;
  esAdminDeAlgo: boolean;
}

const Ctx = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      setMe(await api.get<Me>('/auth/me'));
    } catch (e) {
      if (!(e instanceof ApiError) || e.status !== 401) console.error('No se pudo cargar la sesión');
      setMe(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setAuthFailureHandler((code) => {
      if (code === 'unauthenticated') setMe(null);
      else void refresh(); // must_change_password: /me refleja el flag y la ruta redirige
    });
    void refresh();
  }, [refresh]);

  const login = useCallback(async (email: string, password: string) => {
    const user = await api.post<Me>('/auth/login', { email, password });
    setMe(user);
    return user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      setMe(null);
    }
  }, []);

  const value = useMemo<AuthValue>(() => {
    const rolEn = (slug: string): Rol | null => {
      if (!me) return null;
      if (slug === 'ministerio') return me.es_admin_global ? 'admin_global' : 'general';
      if (me.es_admin_global) return 'admin_global';
      return me.spaces.find((s) => s.slug === slug)?.rol ?? null;
    };
    const esAdminDeAlgo = Boolean(me && (me.es_admin_global || me.spaces.some((s) => s.rol === 'admin_espacio')));
    return { me, loading, login, logout, refresh, rolEn, esAdminDeAlgo };
  }, [me, loading, login, logout, refresh]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth fuera de AuthProvider');
  return v;
}

export const esAdmin = (rol: Rol | null) => rol === 'admin_espacio' || rol === 'admin_global';
