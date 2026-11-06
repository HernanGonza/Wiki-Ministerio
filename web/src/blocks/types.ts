// Modelo de contenido en bloques. Es el mismo esquema que valida la API (api/src/services/blocks.js).
export interface Run { t: string; b?: true; i?: true; c?: true; u?: string }

export type Tono = 'info' | 'warn' | 'ok' | 'danger';

/** Cuadro de un organigrama. `vertical`: sus hijos se apilan en columna (útil para departamentos). */
export interface OrgNodo { id: string; t: string; estilo?: 'destacado'; vertical?: true; href?: string; hijos: OrgNodo[] }

export type Block =
  | { id: string; type: 'paragraph'; runs: Run[] }
  | { id: string; type: 'heading'; level: 2 | 3; runs: Run[] }
  | { id: string; type: 'list'; ordered: boolean; items: Run[][] }
  | { id: string; type: 'callout'; tone: Tono; runs: Run[] }
  | { id: string; type: 'quote'; runs: Run[] }
  | { id: string; type: 'code'; text: string }
  | { id: string; type: 'divider' }
  | { id: string; type: 'image'; fileId: string; alt: string; caption: string }
  | { id: string; type: 'file'; fileId: string; label: string; vista?: boolean }
  | { id: string; type: 'orgchart'; nodos: OrgNodo[] }
  | { id: string; type: 'table'; header: boolean; rows: string[][] };

export type BlockType = Block['type'];

export interface ArchivoMeta { nombre: string; mime: string; bytes: number }
export type ArchivosMap = Record<string, ArchivoMeta>;
