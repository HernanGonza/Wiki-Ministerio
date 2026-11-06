import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// En desarrollo, /api se redirige al backend local (en producción lo hace nginx).
// VITE_BASE = ruta donde cuelga la app (ej. /wiki/). En la raíz del dominio queda '/'.
export default defineConfig({
  base: process.env.VITE_BASE || '/',
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  server: { proxy: { '/api': 'http://localhost:3000' } },
  build: { sourcemap: false },
});
