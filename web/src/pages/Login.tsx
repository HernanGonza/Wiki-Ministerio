import { useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Eye, EyeOff, LogIn } from 'lucide-react';
import { useAuth } from '@/auth/AuthContext';
import { errMsg } from '@/lib';
import { Flor, Logo, PatronFlores } from '@/ui/brand';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { Alert } from '@/components/ui/page';
import { invalidarBusqueda } from '@/layout/CommandPalette';

export function Login() {
  const { me, login, loading } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const from = (loc.state as { from?: string } | null)?.from ?? '/';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [ver, setVer] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sacudir, setSacudir] = useState(0);

  if (!loading && me) return <Navigate to={me.must_change_password ? '/cambiar-password' : from} replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      invalidarBusqueda();
      const u = await login(email, password);
      nav(u.must_change_password ? '/cambiar-password' : from, { replace: true });
    } catch (err) {
      setError(errMsg(err));
      setPassword('');
      setSacudir((n) => n + 1);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="grid flex-1 lg:grid-cols-[1.1fr_1fr]">
      <section className="relative isolate hidden overflow-hidden bg-verde-700 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <PatronFlores className="absolute inset-0 -z-10 text-white/20 [--flor-centro:#3e6c51]" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-verde-900/85 via-verde-900/20 to-transparent" />
        <motion.div initial={{ opacity: 0, scale: 0.5, rotate: -40 }} animate={{ opacity: 1, scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 90, damping: 12 }}>
          <Flor className="size-28 animate-float drop-shadow-2xl" />
        </motion.div>
        <div>
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.28em] text-verde-200">Ecología Misiones</p>
          <h1 className="max-w-md text-5xl font-bold leading-[1.05] tracking-tight">Todo el conocimiento del <span className="text-rosa">Ministerio</span>, a un clic.</h1>
          <p className="mt-4 max-w-md text-white/75">Wiki interna de procedimientos, sistemas e información de cada área.</p>
        </div>
      </section>

      <section className="grid place-items-center px-5 py-12">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }} className="w-full max-w-sm">
          <Logo className="mb-8 lg:hidden" />
          <h2 className="text-3xl font-bold tracking-tight">Ingresar</h2>
          <p className="mb-7 mt-1 text-sm text-muted-foreground">Con tu cuenta del Ministerio.</p>
          <motion.form key={sacudir} animate={sacudir ? { x: [0, -10, 10, -6, 6, 0] } : {}} transition={{ duration: 0.4 }} onSubmit={onSubmit} className="grid gap-4">
            <Field label="Correo electrónico">{(id) => <Input id={id} type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus placeholder="nombre@misiones.gob.ar" />}</Field>
            <Field label="Contraseña">
              {(id) => (
                <div className="relative">
                  <Input id={id} type={ver ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required className="pr-11" />
                  <button type="button" onClick={() => setVer(!ver)} aria-label={ver ? 'Ocultar contraseña' : 'Mostrar contraseña'} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition hover:text-foreground">
                    {ver ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              )}
            </Field>
            {error && <Alert>{error}</Alert>}
            <Button type="submit" size="lg" loading={busy} className="mt-1 w-full"><LogIn />Ingresar</Button>
          </motion.form>
        </motion.div>
      </section>
    </main>
  );
}
