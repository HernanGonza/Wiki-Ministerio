import { AlertCircle, Code2, FileUp, Heading2, Heading3, Image as ImageIcon, List, ListOrdered, Minus, Network, Quote, Table2, Type, type LucideIcon } from 'lucide-react';
import type { BlockType } from './types';

export interface Entrada {
  key: string;
  type: BlockType;
  extra?: { level?: 2 | 3; ordered?: boolean };
  label: string;
  desc: string;
  icon: LucideIcon;
  claves: string;
}

/** Todo lo que se puede insertar. Alimenta el menú "/", el botón "Agregar bloque" y "Convertir en". */
export const CATALOGO: Entrada[] = [
  { key: 'p', type: 'paragraph', label: 'Texto', desc: 'Un párrafo normal', icon: Type, claves: 'texto parrafo normal' },
  { key: 'h2', type: 'heading', extra: { level: 2 }, label: 'Título', desc: 'Título de una sección', icon: Heading2, claves: 'titulo encabezado grande h2' },
  { key: 'h3', type: 'heading', extra: { level: 3 }, label: 'Subtítulo', desc: 'Título más chico', icon: Heading3, claves: 'subtitulo encabezado h3' },
  { key: 'ul', type: 'list', extra: { ordered: false }, label: 'Lista', desc: 'Lista con viñetas', icon: List, claves: 'lista viñetas puntos' },
  { key: 'ol', type: 'list', extra: { ordered: true }, label: 'Lista numerada', desc: 'Pasos en orden: 1, 2, 3…', icon: ListOrdered, claves: 'lista numerada pasos numeros' },
  { key: 'callout', type: 'callout', label: 'Llamado', desc: 'Resalta una nota o un aviso', icon: AlertCircle, claves: 'llamado aviso nota alerta destacado' },
  { key: 'quote', type: 'quote', label: 'Cita', desc: 'Texto citado', icon: Quote, claves: 'cita quote' },
  { key: 'image', type: 'image', label: 'Imagen', desc: 'Subir una foto o captura', icon: ImageIcon, claves: 'imagen foto captura picture' },
  { key: 'file', type: 'file', label: 'Archivo', desc: 'PDF, Word, Excel… para descargar', icon: FileUp, claves: 'archivo adjunto pdf word excel documento' },
  { key: 'table', type: 'table', label: 'Tabla', desc: 'Filas y columnas', icon: Table2, claves: 'tabla filas columnas' },
  { key: 'orgchart', type: 'orgchart', label: 'Organigrama', desc: 'Cuadro jerárquico editable', icon: Network, claves: 'organigrama diagrama jerarquia estructura arbol' },
  { key: 'code', type: 'code', label: 'Código', desc: 'Comandos o texto técnico', icon: Code2, claves: 'codigo comando consola terminal' },
  { key: 'divider', type: 'divider', label: 'Divisor', desc: 'Línea separadora', icon: Minus, claves: 'divisor linea separador' },
];

export const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
export const filtrarCatalogo = (q: string) => {
  const p = norm(q).split(/\s+/).filter(Boolean);
  return CATALOGO.filter((e) => p.every((w) => norm(`${e.label} ${e.claves}`).includes(w)));
};
