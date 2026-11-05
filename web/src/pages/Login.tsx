import { useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { ErrorMsg } from '../components/Estados';
import { errMsg } from '../lib';

export function Login() {
  const { me, login, loading } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const from = (loc.state as { from?: string } | null)?.from ?? '/';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!loading && me) return <Navigate to={me.must_change_password ? '/cambiar-password' : from} replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const u = await login(email, password);
      nav(u.must_change_password ? '/cambiar-password' : from, { replace: true });
    } catch (err) {
      setError(errMsg(err));
      setPassword('');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login">
      <div className="login-hero">
        <span className="brand-mark grande" aria-hidden="true">M</span>
        <h1>Wiki MERNR</h1>
        <p>Base de conocimiento del Ministerio</p>
      </div>
      <form className="card form" onSubmit={onSubmit}>
        <h2>Ingresar</h2>
        <label>
          Correo electrónico
          <input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
        </label>
        <label>
          Contraseña
          <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        <ErrorMsg msg={error} />
        <button className="btn btn-primary" disabled={busy}>{busy ? 'Ingresando…' : 'Ingresar'}</button>
      </form>
    </main>
  );
}
