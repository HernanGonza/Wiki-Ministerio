import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { ErrorMsg } from '../components/Estados';
import { errMsg } from '../lib';

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
      nav('/', { replace: true });
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login">
      <form className="card form" onSubmit={onSubmit}>
        <h2>Cambiar contraseña</h2>
        {me?.must_change_password && <p className="muted">Es necesario cambiar la contraseña antes de continuar.</p>}
        <label>
          Contraseña actual
          <input type="password" autoComplete="current-password" value={actual} onChange={(e) => setActual(e.target.value)} required />
        </label>
        <label>
          Contraseña nueva (mínimo {MIN} caracteres)
          <input type="password" autoComplete="new-password" minLength={MIN} value={nueva} onChange={(e) => setNueva(e.target.value)} required />
        </label>
        <label>
          Repetir contraseña nueva
          <input type="password" autoComplete="new-password" value={repetir} onChange={(e) => setRepetir(e.target.value)} required />
        </label>
        <ErrorMsg msg={error} />
        <button className="btn btn-primary" disabled={busy}>{busy ? 'Guardando…' : 'Cambiar contraseña'}</button>
      </form>
    </main>
  );
}
