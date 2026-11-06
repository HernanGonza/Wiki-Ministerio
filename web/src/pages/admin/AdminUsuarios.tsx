import { useState, type FormEvent } from 'react';
import { KeyRound, Plus, Power, Users, X } from 'lucide-react';
import { api } from '@/api/client';
import type { AdminSpace, AdminUser } from '@/api/types';
import { errMsg, fmtFecha, useAsync } from '@/lib';
import { confirmar, pedirTexto } from '@/ui/feedback';
import { useAccion } from '@/ui/useAccion';
import { Cargando, ErrorMsg } from '@/components/Estados';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Toggle } from '@/components/ui/field';
import { Alert, Breadcrumbs, PageEnter, PageHeader } from '@/components/ui/page';
import { Sheet } from '@/components/ui/sheet';
import { Table, TableWrap, TD, TH, THead, TR } from '@/components/ui/table';

const MIN = 12;

export function AdminUsuarios() {
  const users = useAsync(() => api.get<AdminUser[]>('/admin/users'), []);
  const spaces = useAsync(() => api.get<AdminSpace[]>('/admin/spaces'), []);
  const run = useAccion(users.reload);
  const [abierto, setAbierto] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [form, setForm] = useState({ email: '', nombre: '', password: '', es_admin_global: false });
  const [rolSel, setRolSel] = useState<Record<string, { slug: string; rol: string }>>({});
  const espacios = (spaces.data ?? []).filter((s) => s.slug !== 'ministerio');

  async function crear(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    try {
      await api.post('/admin/users', form);
      setForm({ email: '', nombre: '', password: '', es_admin_global: false });
      setAbierto(false);
      await run(async () => {}, 'Usuario creado');
    } catch (x) { setErr(errMsg(x)); }
  }

  return (
    <PageEnter className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <Breadcrumbs items={[{ to: '/admin', label: 'Administración' }, { label: 'Usuarios' }]} />
      <PageHeader icon={<Users />} title="Usuarios y roles" description="Altas, contraseñas temporales y roles por espacio."
        actions={<Button onClick={() => { setErr(null); setAbierto(true); }}><Plus />Nuevo usuario</Button>} />
      {users.loading ? <Cargando variante="tabla" /> : <ErrorMsg msg={users.error} />}
      <TableWrap>
        <Table>
          <THead><tr><TH>Usuario</TH><TH>Roles</TH><TH>Último ingreso</TH><TH className="text-right">Acciones</TH></tr></THead>
          <tbody>
            {(users.data ?? []).map((u) => {
              const sel = rolSel[u.id] ?? { slug: espacios[0]?.slug ?? '', rol: 'general' };
              return (
                <TR key={u.id} className={u.activo ? undefined : 'opacity-60'}>
                  <TD>
                    <div className="font-semibold">{u.nombre}</div>
                    <div className="text-xs text-muted-foreground">{u.email}</div>
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {u.es_admin_global && <Badge variant="rosa">Admin global</Badge>}
                      {!u.activo && <Badge>Inactivo</Badge>}
                      {u.must_change_password && <Badge variant="warn">Cambio pendiente</Badge>}
                    </div>
                  </TD>
                  <TD className="min-w-72">
                    <div className="mb-2 flex flex-wrap gap-1.5">
                      {u.roles.map((r) => (
                        <span key={r.slug} className="inline-flex items-center gap-1 rounded-full bg-secondary py-0.5 pl-2.5 pr-1 text-xs font-medium">
                          {r.nombre} · {r.rol === 'admin_espacio' ? 'administra' : 'lectura'}
                          <button aria-label={`Quitar rol en ${r.nombre}`} onClick={() => run(() => api.del(`/admin/users/${u.id}/roles/${r.slug}`), 'Rol quitado')} className="grid size-5 place-items-center rounded-full hover:bg-destructive/15 hover:text-destructive"><X className="size-3" /></button>
                        </span>
                      ))}
                    </div>
                    <div className="flex gap-1.5">
                      <Select aria-label="Espacio" value={sel.slug} className="!h-9 text-xs" onChange={(e) => setRolSel({ ...rolSel, [u.id]: { ...sel, slug: e.target.value } })}>
                        {espacios.map((s) => <option key={s.slug} value={s.slug}>{s.nombre}</option>)}
                      </Select>
                      <Select aria-label="Rol" value={sel.rol} className="!h-9 text-xs" onChange={(e) => setRolSel({ ...rolSel, [u.id]: { ...sel, rol: e.target.value } })}>
                        <option value="general">Lectura</option>
                        <option value="admin_espacio">Administra</option>
                      </Select>
                      <Button size="sm" variant="outline" disabled={!sel.slug} onClick={() => run(() => api.put(`/admin/users/${u.id}/roles/${sel.slug}`, { rol: sel.rol }), 'Rol asignado')}>Asignar</Button>
                    </div>
                  </TD>
                  <TD className="whitespace-nowrap text-muted-foreground">{fmtFecha(u.last_login_at)}</TD>
                  <TD>
                    <div className="flex justify-end gap-1.5">
                      <Button size="sm" variant="outline" onClick={async () => {
                        const pw = await pedirTexto({ titulo: 'Restablecer contraseña', texto: `Contraseña temporal para ${u.email}. Entregarla por un medio seguro.`, etiqueta: `Mínimo ${MIN} caracteres`, minimo: MIN, confirmar: 'Restablecer' });
                        if (pw) void run(() => api.patch(`/admin/users/${u.id}`, { password: pw }), 'Contraseña restablecida');
                      }}><KeyRound />Clave</Button>
                      <Button size="sm" variant={u.activo ? 'soft' : 'outline'} onClick={async () => {
                        if (u.activo && !(await confirmar({ titulo: `¿Desactivar a ${u.nombre}?`, texto: 'Ya no va a poder ingresar a la wiki.', confirmar: 'Sí, desactivar', peligro: true }))) return;
                        void run(() => api.patch(`/admin/users/${u.id}`, { activo: !u.activo }), u.activo ? 'Usuario desactivado' : 'Usuario activado');
                      }}><Power />{u.activo ? 'Desactivar' : 'Activar'}</Button>
                    </div>
                  </TD>
                </TR>
              );
            })}
          </tbody>
        </Table>
      </TableWrap>

      <Sheet open={abierto} onOpenChange={setAbierto} title="Nuevo usuario" description="Deberá cambiar la contraseña en el primer ingreso. Entregarla fuera de la Wiki.">
        <form onSubmit={crear} className="grid gap-4">
          <Field label="Correo electrónico">{(id) => <Input id={id} type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required autoFocus />}</Field>
          <Field label="Nombre">{(id) => <Input id={id} value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} required />}</Field>
          <Field label="Contraseña temporal" hint={`Mínimo ${MIN} caracteres.`}>{(id) => <Input id={id} type="text" autoComplete="off" minLength={MIN} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />}</Field>
          <Toggle checked={form.es_admin_global} onChange={(v) => setForm({ ...form, es_admin_global: v })} label="Administrador global" />
          {err && <Alert>{err}</Alert>}
          <Button type="submit" size="lg">Crear usuario</Button>
        </form>
      </Sheet>
    </PageEnter>
  );
}
