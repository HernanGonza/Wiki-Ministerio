export type Rol = 'general' | 'admin_espacio' | 'admin_global';
export type Acceso = 'general' | 'restringido';
export type Prioridad = 'alta' | 'media' | 'baja';
export type Estado = 'online' | 'lento' | 'offline';

export interface Me {
  id: string;
  email: string;
  nombre: string;
  es_admin_global: boolean;
  must_change_password: boolean;
  spaces: { slug: string; nombre: string; rol: Rol }[];
}

export interface Space {
  id: string;
  slug: string;
  nombre: string;
  subtitulo: string | null;
  descripcion: string | null;
  orden: number;
  rol: Rol;
}

export interface AdminSpace extends Omit<Space, 'rol'> {
  activo: boolean;
}

export interface SectionNode {
  id: string;
  slug: string;
  titulo: string;
  descripcion: string | null;
  icono: string | null;
  orden: number;
  acceso: Acceso;
  restringido: boolean;
  padre_id: string | null;
  pages: { id: string; slug: string; titulo: string; restringido: boolean }[];
  children: SectionNode[];
}

export interface PageData {
  id: string;
  slug: string;
  titulo: string;
  contenido_md: string;
  acceso: Acceso;
  acceso_efectivo: Acceso;
  version: number;
  updated_at: string;
  updated_by_nombre: string | null;
  section: { id: string; slug: string; titulo: string };
  puede_editar: boolean;
}

export interface EditablePage {
  id: string;
  section_id: string;
  slug: string;
  titulo: string;
  contenido_md: string;
  acceso: Acceso;
  version: number;
}

export interface Announcement {
  id: string;
  titulo: string;
  cuerpo_md: string;
  prioridad: Prioridad;
  publicado_at: string | null;
  transversal: boolean;
  autor: string | null;
}

export interface AdminAnnouncement {
  id: string;
  titulo: string;
  cuerpo_md: string;
  prioridad: Prioridad;
  publicado_at: string | null;
  visible: boolean;
  autor: string | null;
}

export interface SystemStatus {
  id: string;
  nombre: string;
  slug: string;
  url: string | null;
  ip: string | null;
  puerto: number | null;
  vm: string | null;
  descripcion: string | null;
  transversal: boolean;
  estado: Estado | null;
  latencia_ms: number | null;
  codigo_http: number | null;
  checked_at: string | null;
  checks_24h: number;
  online_24h: number;
}

export interface SystemCheck {
  checked_at: string;
  estado: Estado;
  latencia_ms: number | null;
  codigo_http: number | null;
}

export interface AdminSystem {
  id: string;
  nombre: string;
  slug: string;
  url: string | null;
  ip: string | null;
  puerto: number | null;
  vm: string | null;
  descripcion: string | null;
  orden: number;
  activo: boolean;
}

export interface CredentialRef {
  id: string;
  system_id: string | null;
  titulo: string;
  usuario_referencia: string | null;
  vault_item_name: string;
  vault_collection: string | null;
  notas: string | null;
  acceso: Acceso;
}

export interface AdminUser {
  id: string;
  email: string;
  nombre: string;
  activo: boolean;
  es_admin_global: boolean;
  must_change_password: boolean;
  last_login_at: string | null;
  roles: { slug: string; nombre: string; rol: 'general' | 'admin_espacio' }[];
}

export interface AuditItem {
  id: string;
  created_at: string;
  accion: string;
  recurso: string;
  recurso_id: string | null;
  ip: string | null;
  usuario_email: string | null;
  usuario_nombre: string | null;
  space_slug: string | null;
}

export interface PageVersion {
  version: number;
  titulo: string;
  created_at: string;
  autor: string | null;
}
