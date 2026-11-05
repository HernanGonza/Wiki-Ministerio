import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client';
import type { Space } from '../api/types';
import { useAsync } from '../lib';

export function SpaceSwitcher() {
  const nav = useNavigate();
  const { espacio } = useParams();
  const { data } = useAsync(() => api.get<Space[]>('/spaces'), []);
  const espacios = (data ?? []).filter((s) => s.slug !== 'ministerio');
  if (!espacios.length) return null;
  return (
    <label className="switcher">
      <span className="sr-only">Espacio</span>
      <select value={espacio && espacios.some((s) => s.slug === espacio) ? espacio : ''} onChange={(e) => nav(e.target.value ? `/${e.target.value}` : '/')}>
        <option value="">Todos los espacios</option>
        {espacios.map((s) => (
          <option key={s.slug} value={s.slug}>{s.nombre}</option>
        ))}
      </select>
    </label>
  );
}
