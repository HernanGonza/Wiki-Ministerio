-- 003_sso.sql — Ingreso único (JWT del portal del Ministerio).
-- Las sesiones iniciadas por el portal no exigen cambiar la contraseña local:
-- esa contraseña queda solo como respaldo.
ALTER TABLE sessions ADD COLUMN via_sso boolean NOT NULL DEFAULT false;
