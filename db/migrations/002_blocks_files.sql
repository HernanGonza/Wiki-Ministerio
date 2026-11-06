-- 002_blocks_files.sql — Contenido en bloques (JSONB) y archivos subidos.
-- `contenido_md` / `cuerpo_md` se conservan: son el contenido heredado y, para las páginas
-- nuevas, una copia derivada por el servidor (búsqueda y compatibilidad).

ALTER TABLE pages         ADD COLUMN contenido_json jsonb;
ALTER TABLE page_versions ADD COLUMN contenido_json jsonb;
ALTER TABLE announcements ADD COLUMN cuerpo_json    jsonb;

-- Archivos subidos (imágenes, PDF, documentos). El binario vive en el volumen de la API
-- (storage_key); acá solo los metadatos. El tipo (mime) lo decide el servidor, no el cliente.
CREATE TABLE files (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id    uuid NOT NULL REFERENCES spaces(id) ON DELETE RESTRICT,
  nombre      text NOT NULL,
  mime        text NOT NULL,
  bytes       integer NOT NULL CHECK (bytes > 0),
  sha256      text NOT NULL,
  storage_key text NOT NULL UNIQUE,
  acceso      acceso_t NOT NULL DEFAULT 'general',
  uploaded_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX files_space_idx ON files (space_id);
