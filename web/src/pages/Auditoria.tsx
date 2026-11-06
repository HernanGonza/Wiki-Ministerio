import { useState } from 'react';
import { ChevronLeft, ChevronRight, History } from 'lucide-react';
import { api, q } from '@/api/client';
import type { AuditItem } from '@/api/types';
import { useAuth } from '@/auth/AuthContext';
import { fmtFecha, useAsync } from '@/lib';
import { Cargando, ErrorMsg } from '@/components/Estados';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/field';
import { Empty, PageEnter, PageHeader } from '@/components/ui/page';
import { Table, TableWrap, TD, TH, THead, TR } from '@/components/ui/table';

const PAGE = 50;

export function Auditoria() {
  const { me } = useAuth();
  const [space, setSpace] = useState('');
  const [accion, setAccion] = useState('');
  const [offset, setOffset] = useState(0);
  const { data, loading, error } = useAsync(
    () => api.get<{ items: AuditItem[]; hay_mas: boolean }>(`/audit${q({ space, accion, limit: PAGE, offset })}`),
    [space, accion, offset],
  );
  const espacios = (me?.spaces ?? []).filter((s) => s.rol !== 'general');

  return (
    <PageEnter className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
      <PageHeader icon={<History />} title="Auditoría" description="Registro de acciones sobre la plataforma." />
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:max-w-2xl">
        <Field label="Espacio">{(id) => (
          <Select id={id} value={space} onChange={(e) => { setSpace(e.target.value); setOffset(0); }}>
            <option value="">Todos los que se pueden ver</option>
            {espacios.map((s) => <option key={s.slug} value={s.slug}>{s.nombre}</option>)}
          </Select>
        )}</Field>
        <Field label="Acción">{(id) => <Input id={id} value={accion} placeholder="p. ej. login_fallido" onChange={(e) => { setAccion(e.target.value.trim()); setOffset(0); }} />}</Field>
      </div>
      {loading ? <Cargando variante="tabla" /> : <ErrorMsg msg={error} />}
      {!loading && !data?.items.length && <Empty icon={<History />}>No hay registros con esos filtros.</Empty>}
      {!!data?.items.length && (
        <TableWrap>
          <Table>
            <THead><tr><TH>Fecha</TH><TH>Usuario</TH><TH>Acción</TH><TH>Recurso</TH><TH>Espacio</TH><TH>IP</TH></tr></THead>
            <tbody>
              {data.items.map((a) => (
                <TR key={a.id}>
                  <TD className="whitespace-nowrap text-muted-foreground">{fmtFecha(a.created_at)}</TD>
                  <TD>{a.usuario_nombre ? <><span className="font-medium">{a.usuario_nombre}</span><span className="block text-xs text-muted-foreground">{a.usuario_email}</span></> : '—'}</TD>
                  <TD><Badge variant={a.accion.includes('fallido') ? 'danger' : 'primary'}>{a.accion}</Badge></TD>
                  <TD>{a.recurso}{a.recurso_id ? <span className="text-muted-foreground"> · {a.recurso_id.slice(0, 8)}</span> : ''}</TD>
                  <TD>{a.space_slug ?? '—'}</TD>
                  <TD className="font-mono text-xs">{a.ip ?? '—'}</TD>
                </TR>
              ))}
            </tbody>
          </Table>
        </TableWrap>
      )}
      <div className="mt-5 flex justify-center gap-2">
        <Button variant="outline" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE))}><ChevronLeft />Anteriores</Button>
        <Button variant="outline" disabled={!data?.hay_mas} onClick={() => setOffset(offset + PAGE)}>Siguientes<ChevronRight /></Button>
      </div>
    </PageEnter>
  );
}
