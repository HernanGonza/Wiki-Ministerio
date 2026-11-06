import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { KeyRound } from 'lucide-react';
import { api } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { errMsg } from '@/lib';
import { toast } from '@/ui/feedback';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { Alert, PageEnter } from '@/components/ui/page';

const MIN = 12;

export function CambiarPassword() {
  const { me, refresh } = useAuth();
  const nav = useNavigate();
  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [repetir, setRepetir] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (nueva.length < MIN) return setError(`La contraseña nueva debe tener al menos ${MIN} caracteres`);
    if (nueva !== repetir) return setError('Las contraseñas nuevas no coinciden');
    setBusy(true);
    try {
      await api.post('/auth/change-password', { actual, nueva });
      await refresh();
      toast.ok('Contraseña actualizada');
      nav('/', { replace: true });
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <PageEnter className="mx-auto grid w-full max-w-md flex-1 place-items-center px-4 py-12">
      <form onSubmit={onSubmit} className="grid w-full gap-4 rounded-3xl border bg-card p-7 shadow-lg">
        <span className="grid size-12 place-items-center rounded-2xl bg-primary/12 text-primary"><KeyRound className="size-6" /></span>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Cambiar contraseña</h1>
          {me?.must_change_password && <p className="mt-1 text-sm text-muted-foreground">Es necesario cambiar la contraseña antes de continuar.</p>}
        </div>
        <Field label="Contraseña actual">{(id) => <Input id={id} type="password" autoComplete="current-password" value={actual} onChange={(e) => setActual(e.target.value)} required />}</Field>
        <Field label="Contraseña nueva" hint={`Mínimo ${MIN} caracteres.`}>{(id) => <Input id={id} type="password" autoComplete="new-password" minLength={MIN} value={nueva} onChange={(e) => setNueva(e.target.value)} required />}</Field>
        <Field label="Repetir contraseña nueva">{(id) => <Input id={id} type="password" autoComplete="new-password" value={repetir} onChange={(e) => setRepetir(e.target.value)} required />}</Field>
        {error && <Alert>{error}</Alert>}
        <Button type="submit" size="lg" loading={busy}>Cambiar contraseña</Button>
      </form>
    </PageEnter>
  );
}
