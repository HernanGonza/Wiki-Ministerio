import { Link, useParams } from 'react-router-dom';
import { Check, ChevronDown, Layers } from 'lucide-react';
import { api } from '@/api/client';
import type { Space } from '@/api/types';
import { useAsync } from '@/lib';
import { Dropdown, DropdownContent, DropdownItem, DropdownSeparator, DropdownTrigger } from '@/components/ui/dropdown';
import { Button } from '@/components/ui/button';

export function SpaceSwitcher() {
  const { espacio } = useParams();
  const { data } = useAsync(() => api.get<Space[]>('/spaces'), []);
  const espacios = (data ?? []).filter((s) => s.slug !== 'ministerio');
  if (!espacios.length) return null;
  const actual = espacios.find((s) => s.slug === espacio);
  return (
    <Dropdown>
      <DropdownTrigger asChild>
        <Button variant="ghost" size="sm" className="max-w-48 gap-1.5">
          <Layers />
          <span className="truncate">{actual?.nombre ?? 'Espacios'}</span>
          <ChevronDown className="opacity-60" />
        </Button>
      </DropdownTrigger>
      <DropdownContent align="start">
        <DropdownItem asChild><Link to="/">Todos los espacios</Link></DropdownItem>
        <DropdownSeparator />
        {espacios.map((s) => (
          <DropdownItem key={s.slug} asChild>
            <Link to={`/${s.slug}`} className="justify-between">
              <span>{s.nombre}</span>
              {s.slug === espacio && <Check className="text-primary" />}
            </Link>
          </DropdownItem>
        ))}
      </DropdownContent>
    </Dropdown>
  );
}
