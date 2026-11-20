-- 004_sso_jti.sql — Ingreso único RS256: jti de los pases de login ya usados (un solo uso).
-- La inserción atómica (ON CONFLICT DO NOTHING) decide si el jti era nuevo; el almacén es
-- compartido entre procesos/reinicios. `vence` = exp del pase + margen; las filas vencidas se purgan.
CREATE TABLE sso_jti_usados (
  jti   text PRIMARY KEY,
  vence timestamptz NOT NULL
);
CREATE INDEX sso_jti_usados_vence_idx ON sso_jti_usados (vence);
