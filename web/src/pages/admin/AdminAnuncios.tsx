import { useState, type FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import { Eye, EyeOff, Megaphone, Pencil, Plus, Trash2 } from 'lucide-react';
import { api } from '@/api/client';
import type { AdminAnnouncement, Prioridad } from '@/api/types';
import { errMsg, fmtFecha, useAsync } from '@/lib';
import { confirmarBorrado } from '@/ui/feedback';
import { useAccion } from '@/ui/useAccion';
import { Cargando, ErrorMsg } from '@/components/Estados';
import { MarkdownView } from '@/components/MarkdownView';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Textarea, Toggle } from '@/components/ui/field';
import { Alert, Empty } from '@/components/ui/page';
import { Sheet } from '@/components/ui/sheet';
import { Table, TableWrap, TD, TH, THead, TR } from '@/components/ui/table';

const PRIO = { alta: 'danger', media: 'primary', baja: 'default' } as const;

export function AdminAnuncios() {
  const { espacio = '' } = useParams();
  const base = `/admin/spaces/${espacio}/announcements`;
  const { data, loading, error, reload } = useAsync(() => api.get<AdminAnnouncement[]>(base), [espacio]);
  const run = useAccion(reload);
  const [abierto, setAbierto] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [titulo, setTitulo] = useState('');
  const [cuerpo, setCuerpo] = useState('');
  const [prioridad, setPrioridad] = useState<Prioridad>('media');
  const [publicar, setPublicar] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const abrir = (a?: AdminAnnouncement) => {
    setErr(null);
    setEditId(a?.id ?? null); setTitulo(a?.titulo ?? ''); setCuerpo(a?.cuerpo_md ?? ''); setPrioridad(a?.prioridad ?? 'media'); setPublicar(a ? Boolean(a.publicado_at) : true);
    setAbierto(true);
  };

  async function guardar(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    try {
      const body = { titulo, cuerpo_md: cuerpo, prioridad, publicar };
      if (editId) await api.patch(`${base}/${editId}`, body);
      else await api.post(base, body);
      setAbierto(false);
      await run(async () => {}, editId ? 'Anuncio actualizado' : 'Anuncio creado');
    } catch (x) { setErr(errMsg(x)); }
  }

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold">Anuncios {espacio === 'ministerio' ? <span className="text-sm font-normal text-muted-foreground">· visibles en todos los espacios</span> : null}</h2>
        <Button onClick={() => abrir()}><Plus />Nuevo anuncio</Button>
      </div>
      {loading ? <Cargando variante="tabla" /> : <ErrorMsg msg={error} />}
      {!loading && !data?.length && <Empty icon={<Megaphone />}>Todavía no hay anuncios.</Empty>}
      {!!data?.length && (
        <TableWrap>
          <Table>
            <THead><tr><TH>Título</TH><TH>Prioridad</TH><TH>Publicación</TH><TH>Visible</TH><TH className="text-right">Acciones</TH></tr></THead>
            <tbody>
              {data.map((a) => (
                <TR key={a.id}>
                  <TD className="font-semibold">{a.titulo}</TD>
                  <TD><Badge variant={PRIO[a.prioridad]}>{a.prioridad}</Badge></TD>
                  <TD className="whitespace-nowrap text-muted-foreground">{a.publicado_at ? fmtFecha(a.publicado_at) : <Badge variant="warn">Borrador</Badge>}</TD>
                  <TD>{a.visible ? <Badge variant="ok">Sí</Badge> : <Badge>No</Badge>}</TD>
                  <TD>
                    <div className="flex justify-end gap-1.5">
                      <Button size="sm" variant="outline" onClick={() => abrir(a)}><Pencil />Editar</Button>
                      <Button size="sm" variant="outline" onClick={() => run(() => api.patch(`${base}/${a.id}`, { visible: !a.visible }), a.visible ? 'Anuncio oculto' : 'Anuncio visible')}>{a.visible ? <EyeOff /> : <Eye />}{a.visible ? 'Ocultar' : 'Mostrar'}</Button>
                      <Button size="sm" variant="soft" onClick={async () => { if (await confirmarBorrado('el anuncio')) void run(() => api.del(`${base}/${a.id}`), 'Anuncio borrado'); }}><Trash2 /></Button>
                    </div>
                  </TD>
                </TR>
              ))}
            </tbody>
          </Table>
        </TableWrap>
      )}

      <Sheet open={abierto} onOpenChange={setAbierto} title={editId ? 'Editar anuncio' : 'Nuevo anuncio'} description="El cuerpo admite Markdown." className="sm:w-[44rem]">
        <form onSubmit={guardar} className="grid gap-4">
          <Field label="Título">{(id) => <Input id={id} value={titulo} onChange={(e) => setTitulo(e.target.value)} required autoFocus />}</Field>
          <Field label="Cuerpo (Markdown)">{(id) => <Textarea id={id} value={cuerpo} onChange={(e) => setCuerpo(e.target.value)} className="min-h-40 font-mono text-[0.85rem]" />}</Field>
          {cuerpo && <div className="rounded-xl border bg-muted/40 p-4"><p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Vista previa</p><MarkdownView source={cuerpo} className="prose-sm" /></div>}
          <Field label="Prioridad">{(id) => (
            <Select id={id} value={prioridad} onChange={(e) => setPrioridad(e.target.value as Prioridad)}><option value="alta">Alta</option><option value="media">Media</option><option value="baja">Baja</option></Select>
          )}</Field>
          <Toggle checked={publicar} onChange={setPublicar} label="Publicar (si no, queda como borrador)" />
          {err && <Alert>{err}</Alert>}
          <Button type="submit" size="lg">{editId ? 'Guardar cambios' : 'Crear anuncio'}</Button>
        </form>
      </Sheet>
    </section>
  );
}
