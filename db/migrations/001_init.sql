-- 001_init.sql — Esquema inicial de la Wiki MERNR.
-- Lo ejecuta migrate.js con el superusuario de Postgres, dentro de una transacción.

-- ───────────────────────── Tipos ─────────────────────────
CREATE TYPE acceso_t    AS ENUM ('general', 'restringido');
CREATE TYPE rol_t       AS ENUM ('general', 'admin_espacio');
CREATE TYPE prioridad_t AS ENUM ('alta', 'media', 'baja');
CREATE TYPE estado_t    AS ENUM ('online', 'lento', 'offline');

-- ───────────────────────── Espacios ─────────────────────────
CREATE TABLE spaces (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        text NOT NULL UNIQUE
              CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
              CHECK (slug NOT IN ('login', 'admin', 'auditoria', 'cambiar-password', 'api')),
  nombre      text NOT NULL,
  subtitulo   text,
  descripcion text,
  activo      boolean NOT NULL DEFAULT true,
  orden       integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- El espacio `ministerio` es la portada transversal: no se puede borrar,
-- ni tener secciones, roles o referencias de credenciales.
CREATE FUNCTION spaces_protect_ministerio() RETURNS trigger AS $$
BEGIN
  IF OLD.slug = 'ministerio' THEN
    IF TG_OP = 'DELETE' THEN
      RAISE EXCEPTION 'El espacio ministerio no se puede borrar';
    END IF;
    IF NEW.slug <> 'ministerio' THEN
      RAISE EXCEPTION 'El slug del espacio ministerio no se puede cambiar';
    END IF;
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;

CREATE TRIGGER spaces_protect_ministerio
  BEFORE UPDATE OR DELETE ON spaces
  FOR EACH ROW EXECUTE FUNCTION spaces_protect_ministerio();

CREATE FUNCTION forbid_ministerio_space() RETURNS trigger AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM spaces WHERE id = NEW.space_id AND slug = 'ministerio') THEN
    RAISE EXCEPTION 'El espacio ministerio no admite este tipo de recurso';
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;

-- ───────────────────────── Usuarios ─────────────────────────
CREATE TABLE users (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email                text NOT NULL,
  nombre               text NOT NULL,
  password_hash        text NOT NULL,
  activo               boolean NOT NULL DEFAULT true,
  must_change_password boolean NOT NULL DEFAULT true,
  es_admin_global      boolean NOT NULL DEFAULT false,
  created_at           timestamptz NOT NULL DEFAULT now(),
  last_login_at        timestamptz
);
-- Email único sin distinguir mayúsculas.
CREATE UNIQUE INDEX users_email_key ON users (lower(email));

CREATE TABLE user_space_roles (
  user_id  uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  space_id uuid NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  rol      rol_t NOT NULL,
  PRIMARY KEY (user_id, space_id)
);
CREATE INDEX user_space_roles_space_idx ON user_space_roles (space_id);
CREATE TRIGGER user_space_roles_no_ministerio
  BEFORE INSERT OR UPDATE ON user_space_roles
  FOR EACH ROW EXECUTE FUNCTION forbid_ministerio_space();

-- `id` es el HMAC-SHA256 (hex) del token; el token nunca se guarda.
CREATE TABLE sessions (
  id           text PRIMARY KEY,
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at   timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  expires_at   timestamptz NOT NULL,
  ip           inet,
  user_agent   text
);
CREATE INDEX sessions_user_idx ON sessions (user_id);
CREATE INDEX sessions_expires_idx ON sessions (expires_at);

-- ───────────────────────── Contenido ─────────────────────────
CREATE TABLE sections (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id    uuid NOT NULL REFERENCES spaces(id) ON DELETE RESTRICT,
  slug        text NOT NULL CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  titulo      text NOT NULL,
  descripcion text,
  padre_id    uuid,
  orden       integer NOT NULL DEFAULT 0,
  icono       text,
  acceso      acceso_t NOT NULL DEFAULT 'general',
  UNIQUE (space_id, slug),
  UNIQUE (id, space_id),
  -- El padre debe pertenecer al mismo espacio.
  FOREIGN KEY (padre_id, space_id) REFERENCES sections (id, space_id) ON DELETE RESTRICT,
  CHECK (padre_id IS DISTINCT FROM id)
);
CREATE INDEX sections_padre_idx ON sections (padre_id);
CREATE TRIGGER sections_no_ministerio
  BEFORE INSERT OR UPDATE ON sections
  FOR EACH ROW EXECUTE FUNCTION forbid_ministerio_space();

CREATE TABLE pages (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id   uuid NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  slug         text NOT NULL CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  titulo       text NOT NULL,
  contenido_md text NOT NULL DEFAULT '',
  acceso       acceso_t NOT NULL DEFAULT 'general',
  -- Versión actual: base del control de edición concurrente.
  version      integer NOT NULL DEFAULT 1,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  updated_by   uuid REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE (section_id, slug)
);

CREATE TABLE page_versions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id      uuid NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  version      integer NOT NULL,
  titulo       text NOT NULL,
  contenido_md text NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  created_by   uuid REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE (page_id, version)
);

-- ───────────────────────── Anuncios ─────────────────────────
CREATE TABLE announcements (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id     uuid REFERENCES spaces(id) ON DELETE RESTRICT, -- NULL = Ministerio (transversal)
  titulo       text NOT NULL,
  cuerpo_md    text NOT NULL DEFAULT '',
  prioridad    prioridad_t NOT NULL DEFAULT 'media',
  publicado_at timestamptz,
  visible      boolean NOT NULL DEFAULT true,
  autor_id     uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX announcements_space_idx ON announcements (space_id, publicado_at DESC);

-- ───────────────────────── Sistemas ─────────────────────────
CREATE TABLE systems (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id    uuid REFERENCES spaces(id) ON DELETE RESTRICT, -- NULL = transversal
  nombre      text NOT NULL,
  slug        text NOT NULL CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  url         text,
  ip          inet,
  puerto      integer CHECK (puerto BETWEEN 1 AND 65535),
  vm          text,
  descripcion text,
  orden       integer NOT NULL DEFAULT 0,
  activo      boolean NOT NULL DEFAULT true,
  -- El monitor necesita una URL o un par ip + puerto.
  CHECK (url IS NOT NULL OR (ip IS NOT NULL AND puerto IS NOT NULL))
);
CREATE UNIQUE INDEX systems_slug_space_key  ON systems (space_id, slug) WHERE space_id IS NOT NULL;
CREATE UNIQUE INDEX systems_slug_global_key ON systems (slug) WHERE space_id IS NULL;

CREATE TABLE system_checks (
  id          bigserial PRIMARY KEY,
  system_id   uuid NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
  checked_at  timestamptz NOT NULL DEFAULT now(),
  estado      estado_t NOT NULL,
  latencia_ms integer,
  codigo_http integer
);
CREATE INDEX system_checks_system_time_idx ON system_checks (system_id, checked_at DESC);
CREATE INDEX system_checks_time_idx ON system_checks (checked_at);

-- ───────────────────────── Referencias a credenciales ─────────────────────────
-- Solo referencias a items de Vaultwarden. NUNCA contraseñas ni secretos.
CREATE TABLE credential_refs (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id           uuid NOT NULL REFERENCES spaces(id) ON DELETE RESTRICT,
  system_id          uuid REFERENCES systems(id) ON DELETE SET NULL,
  titulo             text NOT NULL,
  usuario_referencia text,
  vault_item_name    text NOT NULL,
  vault_collection   text,
  notas              text,
  acceso             acceso_t NOT NULL DEFAULT 'restringido',
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX credential_refs_space_idx ON credential_refs (space_id);
CREATE TRIGGER credential_refs_no_ministerio
  BEFORE INSERT OR UPDATE ON credential_refs
  FOR EACH ROW EXECUTE FUNCTION forbid_ministerio_space();

-- ───────────────────────── Auditoría (solo INSERT) ─────────────────────────
CREATE TABLE audit_log (
  id         bigserial PRIMARY KEY,
  user_id    uuid REFERENCES users(id),
  accion     text NOT NULL,
  recurso    text NOT NULL,
  recurso_id text,
  space_id   uuid REFERENCES spaces(id),
  ip         inet,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_log_created_idx ON audit_log (created_at DESC);
CREATE INDEX audit_log_user_idx    ON audit_log (user_id);
CREATE INDEX audit_log_space_idx   ON audit_log (space_id);

CREATE FUNCTION audit_log_immutable() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_log es de solo inserción';
END $$ LANGUAGE plpgsql;

CREATE TRIGGER audit_log_no_update_delete
  BEFORE UPDATE OR DELETE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION audit_log_immutable();
