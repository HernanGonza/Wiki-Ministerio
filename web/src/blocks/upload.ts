// Subida de archivos con progreso. El servidor decide el tipo real por el contenido;
// acá solo se valida antes de subir para dar un mensaje claro y no gastar ancho de banda.
import { API_URL } from '../lib';
const MB = 1024 * 1024;
const IMAGENES = ['png', 'jpg', 'jpeg', 'gif', 'webp'];
const DOCS = ['pdf', 'docx', 'xlsx', 'pptx', 'odt', 'ods', 'odp', 'txt', 'csv'];
export const ACCEPT = [...IMAGENES, ...DOCS].map((e) => `.${e}`).join(',');
export const ACCEPT_IMAGEN = IMAGENES.map((e) => `.${e}`).join(',');

export const extension = (nombre: string) => nombre.split('.').pop()?.toLowerCase() ?? '';
export const esImagen = (nombre: string) => IMAGENES.includes(extension(nombre));

export interface ArchivoSubido { id: string; nombre: string; mime: string; bytes: number; acceso: 'general' | 'restringido' }

export function validarAntes(file: File): string | null {
  const ext = extension(file.name);
  if (![...IMAGENES, ...DOCS].includes(ext)) return `"${file.name}": tipo no permitido. Se admiten imágenes (${IMAGENES.join(', ')}) y documentos (${DOCS.join(', ')}).`;
  const max = IMAGENES.includes(ext) ? 10 : 25;
  if (file.size > max * MB) return `"${file.name}" supera el máximo de ${max} MB.`;
  if (file.size === 0) return `"${file.name}" está vacío.`;
  return null;
}

export const urlArchivo = (id: string) => `${API_URL}/files/${id}`;

export function subirArchivo(espacio: string, file: File, acceso: 'general' | 'restringido', onProgreso?: (pct: number) => void): Promise<ArchivoSubido> {
  const error = validarAntes(file);
  if (error) return Promise.reject(new Error(error));
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_URL}/admin/spaces/${encodeURIComponent(espacio)}/files`);
    xhr.setRequestHeader('Content-Type', 'application/octet-stream');
    xhr.setRequestHeader('X-Wiki-Upload', '1');
    xhr.setRequestHeader('X-File-Name', encodeURIComponent(file.name));
    xhr.setRequestHeader('X-File-Access', acceso);
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgreso?.(Math.round((e.loaded / e.total) * 100)); };
    xhr.onerror = () => reject(new Error('No se pudo subir el archivo: error de conexión.'));
    xhr.onload = () => {
      let data: { message?: string } & Partial<ArchivoSubido> = {};
      try { data = JSON.parse(xhr.responseText); } catch { /* sin JSON */ }
      if (xhr.status >= 200 && xhr.status < 300) resolve(data as ArchivoSubido);
      else if (xhr.status === 413) reject(new Error('El archivo es demasiado grande.'));
      else reject(new Error(data.message ?? `Error al subir (${xhr.status})`));
    };
    xhr.send(file);
  });
}

export const tamano = (bytes: number) => (bytes >= MB ? `${(bytes / MB).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);
