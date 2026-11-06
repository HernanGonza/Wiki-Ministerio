import { useState, type FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import { ExternalLink, KeyRound, Pencil, Plus, ShieldAlert, Trash2 } from 'lucide-react';
import { api } from '@/api/client';
import type { AdminSystem, CredentialRef } from '@/api/types';
import { errMsg, useAsync } from '@/lib';
import { confirmarBorrado } from '@/ui/feedback';
import { useAccion } from '@/ui/useAccion';
import { Cargando, ErrorMsg } from '@/components/Estados';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/field';
import { Alert, Empty } from '@/components/ui/page';
import { Sheet } from '@/components/ui/sheet';
import { Table, TableWrap, TD, TH, THead, TR } from '@/components/ui/table';

const vacio = { titulo: '', system_id: '', usuario_referencia: '', vault_item_name: '', vault_collection: '', notas: '' };

export function AdminCredenciales() {
  const { espacio = '' } = useParams();
  const base = `/admin/spaces/${espacio}/credential-refs`;
  const { data, loading, error, reload } = useAsync(() => api.get<{ vault_url: string | null; items: CredentialRef[] }>(base), [espacio]);
  const sistemas = useAsync(() => api.get<AdminSystem[]>(`/admin/spaces/${espacio}/systems`), [espacio]);
  const run = useAccion(reload);
  const [abierto, setAbierto] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [f, setF] = useState(vacio);
  const [err, setErr] = useState<string | null>(null);
  const set = <K extends keyof typeof vacio>(k: K, v: string) => setF((p) => ({ ...p, [k]: v }));

  const abrir = (c?: CredentialRef) => {
    setErr(null);
    setEditId(c?.id ?? null);
    setF(c ? { titulo: c.titulo, system_id: c.system_id ?? '', usuario_referencia: c.usuario_referencia ?? '', vault_item_name: c.vault_item_name, vault_collection: c.vault_collection ?? '', notas: c.notas ?? '' } : vacio);
    setAbierto(true);
  };

  async function guardar(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    const body = { titulo: f.titulo, system_id: f.system_id || null, usuario_referencia: f.usuario_referencia || null, vault_item_name: f.vault_item_name, vault_collection: f.vault_collection || null, notas: f.notas || null };
    try {
      if (editId) await api.patch(`${base}/${editId}`, body);
      else await api.post(base, body);
      setAbierto(false);
      await run(async () => {}, editId ? 'Referencia actualizada' : 'Referencia creada');
    } catch (x) { setErr(errMsg(x)); }
  }

  return (
    <section>
      <Alert tone="warn" className="mb-5">
        <div className="flex flex-wrap items-center gap-x-2">
          <ShieldAlert className="inline size-4" />
          <span>Esta lista guarda <strong>solo el nombre del item</strong> en Vaultwarden. Nunca cargar contraseñas, claves ni tokens, ni en las notas.</span>
          {data?.vault_url && <a href={data.vault_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold text-primary hover:underline"><ExternalLink className="size-3.5" />Abrir Vaultwarden</a>}
        </div>
      </Alert>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold">Referencias a credenciales</h2>
        <Button onClick={() => abrir()}><Plus />Nueva referencia</Button>
      </div>
      {loading ? <Cargando variante="tabla" /> : <ErrorMsg msg={error} />}
      {!loading && !data?.items.length && <Empty icon={<KeyRound />}>Todavía no hay referencias.</Empty>}
      {!!data?.items.length && (
        <TableWrap>
          <Table>
            <THead><tr><TH>Título</TH><TH>Usuario de referencia</TH><TH>Item en Vaultwarden</TH><TH>Colección</TH><TH className="text-right">Acciones</TH></tr></THead>
            <tbody>
              {data.items.map((c) => (
                <TR key={c.id}>
                  <TD><span className="font-semibold">{c.titulo}</span>{c.notas && <span className="block text-xs text-muted-foreground">{c.notas}</span>}</TD>
                  <TD>{c.usuario_referencia ?? '—'}</TD>
                  <TD><code className="rounded bg-muted px-1.5 py-0.5 text-xs">{c.vault_item_name}</code></TD>
                  <TD>{c.vault_collection ?? '—'}</TD>
                  <TD>
                    <div className="flex justify-end gap-1.5">
                      <Button size="sm" variant="outline" onClick={() => abrir(c)}><Pencil />Editar</Button>
                      <Button size="sm" variant="soft" onClick={async () => { if (await confirmarBorrado('la referencia')) void run(() => api.del(`${base}/${c.id}`), 'Referencia borrada'); }}><Trash2 /></Button>
                    </div>
                  </TD>
                </TR>
              ))}
            </tbody>
          </Table>
        </TableWrap>
      )}

      <Sheet open={abierto} onOpenChange={setAbierto} title={editId ? 'Editar referencia' : 'Nueva referencia'} description="Solo el nombre del item de Vaultwarden, nunca el secreto.">
        <form onSubmit={guardar} className="grid gap-4">
          <Field label="Título">{(id) => <Input id={id} value={f.titulo} onChange={(e) => set('titulo', e.target.value)} required autoFocus />}</Field>
          <Field label="Usuario de referencia" hint="p. ej. root@srv-x">{(id) => <Input id={id} value={f.usuario_referencia} onChange={(e) => set('usuario_referencia', e.target.value)} />}</Field>
          <Field label="Sistema">{(id) => (
            <Select id={id} value={f.system_id} onChange={(e) => set('system_id', e.target.value)}>
              <option value="">(ninguno)</option>
              {(sistemas.data ?? []).map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
            </Select>
          )}</Field>
          <Field label="Nombre del item en Vaultwarden">{(id) => <Input id={id} value={f.vault_item_name} onChange={(e) => set('vault_item_name', e.target.value)} required />}</Field>
          <Field label="Colección">{(id) => <Input id={id} value={f.vault_collection} onChange={(e) => set('vault_collection', e.target.value)} />}</Field>
          <Field label="Notas (sin secretos)">{(id) => <Input id={id} value={f.notas} onChange={(e) => set('notas', e.target.value)} />}</Field>
          {err && <Alert>{err}</Alert>}
          <Button type="submit" size="lg">{editId ? 'Guardar cambios' : 'Crear referencia'}</Button>
        </form>
      </Sheet>
    </section>
  );
}
