import { useState, type FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import { Pencil, Plus, Server, Trash2 } from 'lucide-react';
import { api } from '@/api/client';
import type { AdminSystem } from '@/api/types';
import { errMsg, slugify, useAsync } from '@/lib';
import { confirmarBorrado } from '@/ui/feedback';
import { useAccion } from '@/ui/useAccion';
import { Cargando, ErrorMsg } from '@/components/Estados';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Field, Input, Toggle } from '@/components/ui/field';
import { Alert, Empty } from '@/components/ui/page';
import { Sheet } from '@/components/ui/sheet';
import { Table, TableWrap, TD, TH, THead, TR } from '@/components/ui/table';

const vacio = { nombre: '', slug: '', url: '', ip: '', puerto: '', vm: '', descripcion: '', orden: 0, activo: true };

export function AdminSistemas() {
  const { espacio = '' } = useParams();
  const base = `/admin/spaces/${espacio}/systems`;
  const { data, loading, error, reload } = useAsync(() => api.get<AdminSystem[]>(base), [espacio]);
  const run = useAccion(reload);
  const [abierto, setAbierto] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [f, setF] = useState(vacio);
  const [err, setErr] = useState<string | null>(null);
  const set = <K extends keyof typeof vacio>(k: K, v: (typeof vacio)[K]) => setF((p) => ({ ...p, [k]: v }));

  const abrir = (s?: AdminSystem) => {
    setErr(null);
    setEditId(s?.id ?? null);
    setF(s ? { nombre: s.nombre, slug: s.slug, url: s.url ?? '', ip: s.ip ?? '', puerto: s.puerto ? String(s.puerto) : '', vm: s.vm ?? '', descripcion: s.descripcion ?? '', orden: s.orden, activo: s.activo } : vacio);
    setAbierto(true);
  };

  async function guardar(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    const body = { nombre: f.nombre, slug: f.slug, url: f.url || null, ip: f.ip || null, puerto: f.puerto ? Number(f.puerto) : null, vm: f.vm || null, descripcion: f.descripcion || null, orden: f.orden, activo: f.activo };
    try {
      if (editId) await api.patch(`${base}/${editId}`, body);
      else await api.post(base, body);
      setAbierto(false);
      await run(async () => {}, editId ? 'Sistema actualizado' : 'Sistema creado');
    } catch (x) { setErr(errMsg(x)); }
  }

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold">Sistemas {espacio === 'ministerio' ? <span className="text-sm font-normal text-muted-foreground">· transversales</span> : null}</h2>
        <Button onClick={() => abrir()}><Plus />Nuevo sistema</Button>
      </div>
      {loading ? <Cargando variante="tabla" /> : <ErrorMsg msg={error} />}
      {!loading && !data?.length && <Empty icon={<Server />}>Todavía no hay sistemas.</Empty>}
      {!!data?.length && (
        <TableWrap>
          <Table>
            <THead><tr><TH>Sistema</TH><TH>Destino del monitor</TH><TH>VM</TH><TH>Activo</TH><TH className="text-right">Acciones</TH></tr></THead>
            <tbody>
              {data.map((s) => (
                <TR key={s.id}>
                  <TD className="font-semibold">{s.nombre}</TD>
                  <TD className="font-mono text-xs">{s.url ?? `${s.ip}:${s.puerto}`}</TD>
                  <TD>{s.vm ?? '—'}</TD>
                  <TD>{s.activo ? <Badge variant="ok">Sí</Badge> : <Badge>No</Badge>}</TD>
                  <TD>
                    <div className="flex justify-end gap-1.5">
                      <Button size="sm" variant="outline" onClick={() => abrir(s)}><Pencil />Editar</Button>
                      <Button size="sm" variant="outline" onClick={() => run(() => api.patch(`${base}/${s.id}`, { activo: !s.activo }), s.activo ? 'Sistema desactivado' : 'Sistema activado')}>{s.activo ? 'Desactivar' : 'Activar'}</Button>
                      <Button size="sm" variant="soft" onClick={async () => { if (await confirmarBorrado('el sistema', 'Se borra también su historial de estado.')) void run(() => api.del(`${base}/${s.id}`), 'Sistema borrado'); }}><Trash2 /></Button>
                    </div>
                  </TD>
                </TR>
              ))}
            </tbody>
          </Table>
        </TableWrap>
      )}

      <Sheet open={abierto} onOpenChange={setAbierto} title={editId ? 'Editar sistema' : 'Nuevo sistema'} description="El monitor del servidor verifica el sistema cada minuto.">
        <form onSubmit={guardar} className="grid gap-4">
          <Field label="Nombre">{(id) => <Input id={id} value={f.nombre} onChange={(e) => setF((p) => ({ ...p, nombre: e.target.value, slug: editId ? p.slug : slugify(e.target.value) }))} required autoFocus />}</Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Slug">{(id) => <Input id={id} value={f.slug} onChange={(e) => set('slug', e.target.value)} pattern="[a-z0-9]+(-[a-z0-9]+)*" required />}</Field>
            <Field label="VM">{(id) => <Input id={id} value={f.vm} onChange={(e) => set('vm', e.target.value)} />}</Field>
          </div>
          <Field label="URL" hint="http/https. Si se indica, el monitor usa la URL.">{(id) => <Input id={id} type="url" value={f.url} onChange={(e) => set('url', e.target.value)} />}</Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="IP (si no hay URL)">{(id) => <Input id={id} value={f.ip} onChange={(e) => set('ip', e.target.value)} />}</Field>
            <Field label="Puerto">{(id) => <Input id={id} type="number" min={1} max={65535} value={f.puerto} onChange={(e) => set('puerto', e.target.value)} />}</Field>
          </div>
          <Field label="Descripción">{(id) => <Input id={id} value={f.descripcion} onChange={(e) => set('descripcion', e.target.value)} />}</Field>
          <Field label="Orden">{(id) => <Input id={id} type="number" value={f.orden} onChange={(e) => set('orden', Number(e.target.value))} />}</Field>
          <Toggle checked={f.activo} onChange={(v) => set('activo', v)} label="Activo (se monitorea)" />
          {err && <Alert>{err}</Alert>}
          <Button type="submit" size="lg">{editId ? 'Guardar cambios' : 'Crear sistema'}</Button>
        </form>
      </Sheet>
    </section>
  );
}
