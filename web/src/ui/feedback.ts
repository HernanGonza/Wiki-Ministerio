// Todas las alertas, confirmaciones y avisos de la app pasan por acá (SweetAlert2 con la marca).
// Los estilos viven en styles/main.css (.wiki-swal / .wiki-toast) y leen las variables del tema,
// así que respetan el modo oscuro.
//
// Ojo: no abrir un confirm() desde adentro de un <Sheet>/<Modal> de Radix: su trampa de foco
// le saca el foco al SweetAlert. Los formularios de los cajones solo muestran errores en línea.
import Swal from 'sweetalert2';

const base = Swal.mixin({
  buttonsStyling: false,
  reverseButtons: true,
  focusCancel: false,
  customClass: { popup: 'wiki-swal', confirmButton: 'swal2-confirm', cancelButton: 'swal2-cancel' },
  showClass: { popup: 'swal2-show' },
});

const toastBase = Swal.mixin({
  toast: true,
  position: 'bottom',
  showConfirmButton: false,
  timer: 3200,
  timerProgressBar: true,
  customClass: { popup: 'wiki-toast' },
  didOpen: (el) => {
    el.addEventListener('mouseenter', Swal.stopTimer);
    el.addEventListener('mouseleave', Swal.resumeTimer);
  },
});

export interface ConfirmOpts {
  titulo: string;
  texto?: string;
  confirmar?: string;
  cancelar?: string;
  /** Acción destructiva: botón rojo e ícono de advertencia. */
  peligro?: boolean;
}

export async function confirmar({ titulo, texto, confirmar = 'Confirmar', cancelar = 'Cancelar', peligro = false }: ConfirmOpts): Promise<boolean> {
  const r = await base.fire({
    title: titulo,
    text: texto,
    icon: peligro ? 'warning' : 'question',
    iconColor: peligro ? 'var(--destructive)' : 'var(--primary)',
    showCancelButton: true,
    confirmButtonText: confirmar,
    cancelButtonText: cancelar,
    customClass: {
      popup: 'wiki-swal',
      confirmButton: peligro ? 'swal2-confirm swal-peligro' : 'swal2-confirm',
      cancelButton: 'swal2-cancel',
    },
  });
  return r.isConfirmed;
}

/** Atajo para borrados: "¿Borrar X?" con botón rojo. */
export const confirmarBorrado = (que: string, detalle?: string) =>
  confirmar({ titulo: `¿Borrar ${que}?`, texto: detalle ?? 'Esta acción no se puede deshacer.', confirmar: 'Sí, borrar', peligro: true });

export async function pedirTexto(opts: { titulo: string; texto?: string; etiqueta?: string; tipo?: 'text' | 'password'; minimo?: number; confirmar?: string }): Promise<string | null> {
  const r = await base.fire({
    title: opts.titulo,
    text: opts.texto,
    input: opts.tipo ?? 'text',
    inputLabel: opts.etiqueta,
    inputAttributes: { autocomplete: 'off', autocapitalize: 'off' },
    showCancelButton: true,
    confirmButtonText: opts.confirmar ?? 'Aceptar',
    cancelButtonText: 'Cancelar',
    inputValidator: (v: string) => (opts.minimo && v.length < opts.minimo ? `Mínimo ${opts.minimo} caracteres` : undefined),
  });
  return r.isConfirmed ? String(r.value) : null;
}

export const alerta = (titulo: string, texto?: string, icono: 'info' | 'error' | 'success' | 'warning' = 'info') =>
  base.fire({ title: titulo, text: texto, icon: icono, confirmButtonText: 'Entendido' });

export const toast = {
  ok: (t: string) => toastBase.fire({ icon: 'success', title: t }),
  error: (t: string) => toastBase.fire({ icon: 'error', title: t, timer: 5000 }),
  info: (t: string) => toastBase.fire({ icon: 'info', title: t }),
};
