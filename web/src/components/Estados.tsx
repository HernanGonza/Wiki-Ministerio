import { Link } from 'react-router-dom';

export function NoEncontrado() {
  return (
    <div className="estado-vacio">
      <h1>No encontrado</h1>
      <p>La página que se busca no existe o no hay acceso a ella.</p>
      <Link to="/">Volver al inicio</Link>
    </div>
  );
}

export function Cargando({ texto = 'Cargando…' }: { texto?: string }) {
  return <p className="muted" role="status">{texto}</p>;
}

export function ErrorMsg({ msg }: { msg: string | null }) {
  return msg ? <p className="error" role="alert">{msg}</p> : null;
}
