import { useState, type FormEvent } from 'react';
import { Layers, Plus, Trash2 } from 'lucide-react';
import { api } from '@/api/client';
import type { AdminSpace } from '@/api/types';
import { errMsg, slugify, useAsync } from '@/lib';
import { confirmarBorrado } from '@/ui/feedback';
import { useAccion } from '@/ui/useAccion';
import { Cargando, ErrorMsg } from '@/components/Estados';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { Alert, Breadcrumbs, PageEnter, PageHeader } from '@/components/ui/page';
import { Sheet } from '@/components/ui/sheet';
import { Table, TableWrap, TD, TH, THead, TR } from '@/components/ui/table';

export function AdminEspacios() {
  const { data, loading, error, reload } = useAsync(() => api.get<AdminSpace[]>('/admin/spaces'), []);
  const run = useAccion(reload);
  const [abierto, setAbierto] = useState(false);
  const [nombre, setNombre] = useState('');
  const [slug, setSlug] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [err, setErr] = useState<string | null>(null);

  async function crear(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    try {
      await api.post('/admin/spaces', { nombre, slug: slug || slugify(nombre), descripcion: descripcion || null });
      setNombre(''); setSlug(''); setDescripcion('');
      setAbierto(false);
      await run(async () => {}, 'Espacio creado');
    } catch (x) { setErr(errMsg(x)); }
  }

  return (
    <PageEnter className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
      <Breadcrumbs items={[{ to: '/admin', label: 'Administración' }, { label: 'Espacios' }]} />
      <PageHeader icon={<Layers />} title="Espacios" description="Cada área del Ministerio tiene su espacio."
        actions={<Button onClick={() => { setErr(null); setAbierto(true); }}><Plus />Nuevo espacio</Button>} />
      {loading ? <Cargando variante="tabla" /> : <ErrorMsg msg={error} />}
      <TableWrap>
        <Table>
          <THead><tr><TH>Nombre</TH><TH>Slug</TH><TH>Estado</TH><TH className="text-right">Acciones</TH></tr></THead>
          <tbody>
            {(data ?? []).map((s) => (
              <TR key={s.id}>
                <TD className="font-semibold">{s.nombre}</TD>
                <TD><code className="rounded bg-muted px-1.5 py-0.5 text-xs">{s.slug}</code></TD>
                <TD><Badge variant={s.activo ? 'ok' : 'default'}>{s.activo ? 'Activo' : 'Inactivo'}</Badge></TD>
                <TD>
                  <div className="flex justify-end gap-1.5">
                    {s.slug !== 'ministerio' && <Button size="sm" variant="outline" onClick={() => run(() => api.patch(`/admin/spaces/${s.slug}`, { activo: !s.activo }), s.activo ? 'Espacio desactivado' : 'Espacio activado')}>{s.activo ? 'Desactivar' : 'Activar'}</Button>}
                    {s.slug !== 'ministerio' && (
                      <Button size="sm" variant="soft" onClick={async () => { if (await confirmarBorrado(`el espacio "${s.nombre}"`, 'Solo es posible si está vacío.')) void run(() => api.del(`/admin/spaces/${s.slug}`), 'Espacio borrado'); }}><Trash2 />Borrar</Button>
                    )}
                  </div>
                </TD>
              </TR>
            ))}
          </tbody>
        </Table>
      </TableWrap>

      <Sheet open={abierto} onOpenChange={setAbierto} title="Nuevo espacio" description="Un espacio agrupa las secciones, anuncios y sistemas de un área.">
        <form onSubmit={crear} className="grid gap-4">
          <Field label="Nombre">{(id) => <Input id={id} value={nombre} onChange={(e) => { setNombre(e.target.value); setSlug(slugify(e.target.value)); }} required autoFocus />}</Field>
          <Field label="Slug (URL)" hint="Solo minúsculas, números y guiones.">{(id) => <Input id={id} value={slug} onChange={(e) => setSlug(e.target.value)} pattern="[a-z0-9]+(-[a-z0-9]+)*" required />}</Field>
          <Field label="Descripción">{(id) => <Input id={id} value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />}</Field>
          {err && <Alert>{err}</Alert>}
          <Button type="submit" size="lg">Crear espacio</Button>
        </form>
      </Sheet>
    </PageEnter>
  );
}
