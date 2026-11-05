import { Outlet } from 'react-router-dom';
import { Header } from './Header';

export function Layout() {
  return (
    <div className="app">
      <Header />
      <Outlet />
      <footer className="footer muted">Wiki MERNR · Ministerio de Ecología y Recursos Naturales Renovables de Misiones</footer>
    </div>
  );
}
