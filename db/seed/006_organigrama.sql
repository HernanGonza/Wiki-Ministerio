-- Estructura del organigrama (Mayo 2024 v2). Niveles: Dirección General > Dirección > Departamentos (páginas).
-- Generado leyendo el PDF del organigrama: REVISAR con el área (títulos, acrónimos y a qué Dirección pertenece cada Departamento).
-- El espacio ordenamiento-territorial ya está en 002/003. `ministerio` es solo portada, por eso las áreas centrales van en `gabinete-ministerial`.

INSERT INTO spaces (slug, nombre, subtitulo, descripcion, activo, orden) VALUES
  ('gabinete-ministerial', 'Gabinete y Áreas Centrales', NULL, 'Gabinete, Auditoría, C.T.M. y áreas transversales del Ministerio.', true, 15);

INSERT INTO sections (space_id, slug, titulo, padre_id, orden, icono, acceso)
SELECT s.id, v.slug, v.titulo, p.id, v.orden, v.icono, 'general'
FROM spaces s
JOIN (VALUES
  ('organigrama', 'Organigrama', NULL, 10, '🏛️'),
  ('gabinete-y-nominados', 'Gabinete y nominados', NULL, 20, '👥'),
  ('c-t-m', 'C.T.M.', NULL, 30, '🛠️'),
  ('asuntos-juridicos', 'Asuntos Jurídicos', NULL, 40, '⚖️'),
  ('proc-i-s-y-computos', 'Proc. I.S. y Cómputos', NULL, 50, '📊'),
  ('comunicacion-y-relaciones-institucionales', 'Comunicación y Relaciones Institucionales', NULL, 60, '📣')
) AS v(slug, titulo, padre, orden, icono) ON true
LEFT JOIN sections p ON p.space_id = s.id AND p.slug = v.padre
WHERE s.slug = 'gabinete-ministerial';
INSERT INTO sections (space_id, slug, titulo, padre_id, orden, icono, acceso)
SELECT s.id, v.slug, v.titulo, p.id, v.orden, v.icono, 'general'
FROM spaces s
JOIN (VALUES
  ('unidad-tecnica', 'Unidad Técnica', 'gabinete-y-nominados', 10, NULL),
  ('gabinete', 'Gabinete', 'gabinete-y-nominados', 20, NULL),
  ('secretaria-privada', 'Secretaría Privada', 'gabinete-y-nominados', 30, NULL),
  ('auditoria', 'Auditoría', 'gabinete-y-nominados', 40, NULL),
  ('asuntos-juridicos-2', 'Asuntos Jurídicos', 'asuntos-juridicos', 10, NULL),
  ('computos', 'Cómputos', 'proc-i-s-y-computos', 10, NULL)
) AS v(slug, titulo, padre, orden, icono) ON true
LEFT JOIN sections p ON p.space_id = s.id AND p.slug = v.padre
WHERE s.slug = 'gabinete-ministerial';
WITH nuevas AS (
  INSERT INTO pages (section_id, slug, titulo, contenido_md, acceso, version)
  SELECT sec.id, v.slug, v.titulo, '# ' || v.titulo || E'\n\n[PLACEHOLDER] Contenido pendiente de redacción.', 'general', 1
  FROM sections sec
  JOIN spaces s ON s.id = sec.space_id AND s.slug = 'gabinete-ministerial'
  JOIN (VALUES
  ('organigrama', 'indice', 'Organigrama'),
  ('organigrama', 'organigrama-general', 'Organigrama general'),
  ('unidad-tecnica', 'indice', 'Unidad Técnica'),
  ('gabinete', 'indice', 'Gabinete'),
  ('secretaria-privada', 'indice', 'Secretaría Privada'),
  ('auditoria', 'indice', 'Auditoría'),
  ('c-t-m', 'indice', 'C.T.M.'),
  ('c-t-m', 'asistencia-tecnica', 'Asistencia Técnica'),
  ('c-t-m', 'formacion-y-capacitacion', 'Formación y Capacitación'),
  ('c-t-m', 'mantenimiento-general', 'Mantenimiento General'),
  ('c-t-m', 'secretaria-general', 'Secretaría General'),
  ('asuntos-juridicos-2', 'indice', 'Asuntos Jurídicos'),
  ('asuntos-juridicos-2', 'sumarios-ambientales', 'Sumarios Ambientales'),
  ('computos', 'indice', 'Cómputos'),
  ('computos', 'computos-y-estadisticas', 'Cómputos y Estadísticas'),
  ('comunicacion-y-relaciones-institucionales', 'indice', 'Comunicación y Relaciones Institucionales'),
  ('comunicacion-y-relaciones-institucionales', 'diseno-y-gestion-de-contenidos', 'Diseño y Gestión de Contenidos')
  ) AS v(sec, slug, titulo) ON v.sec = sec.slug
  RETURNING id, titulo, contenido_md
)
INSERT INTO page_versions (page_id, version, titulo, contenido_md)
SELECT id, 1, titulo, contenido_md FROM nuevas;

INSERT INTO spaces (slug, nombre, subtitulo, descripcion, activo, orden) VALUES ('ecologia-desarrollo-sustentable', 'Ecología y Desarrollo Sustentable', NULL, 'Subsecretaría de Ecología y Desarrollo Sustentable.', true, 20);
INSERT INTO sections (space_id, slug, titulo, padre_id, orden, icono, acceso)
SELECT s.id, v.slug, v.titulo, p.id, v.orden, v.icono, 'general'
FROM spaces s
JOIN (VALUES
  ('ecologia-y-calidad-ambiental', 'Ecología y Calidad Ambiental', NULL, 10, '🌿'),
  ('parque-ecologico', 'Parque Ecológico', NULL, 20, '🦜'),
  ('bosques-nativos', 'Bosques Nativos', NULL, 30, '🌳'),
  ('administracion', 'Administración', NULL, 40, '🗂️')
) AS v(slug, titulo, padre, orden, icono) ON true
LEFT JOIN sections p ON p.space_id = s.id AND p.slug = v.padre
WHERE s.slug = 'ecologia-desarrollo-sustentable';
INSERT INTO sections (space_id, slug, titulo, padre_id, orden, icono, acceso)
SELECT s.id, v.slug, v.titulo, p.id, v.orden, v.icono, 'general'
FROM spaces s
JOIN (VALUES
  ('recursos-vitales', 'Recursos Vitales', 'ecologia-y-calidad-ambiental', 10, NULL),
  ('biodiversidad', 'Biodiversidad', 'ecologia-y-calidad-ambiental', 20, NULL),
  ('impacto-ambiental', 'Impacto Ambiental', 'ecologia-y-calidad-ambiental', 30, NULL),
  ('areas-naturales-protegidas', 'Áreas Naturales Protegidas', 'ecologia-y-calidad-ambiental', 40, NULL),
  ('investigacion-desarrollo-y-promocion-educativa', 'Investigación, Desarrollo y Promoción Educativa', 'parque-ecologico', 10, NULL),
  ('control-forestal', 'Control Forestal', 'bosques-nativos', 10, NULL),
  ('m-s-de-bosques-nativos', 'M.S. de Bosques Nativos', 'bosques-nativos', 20, NULL),
  ('delegaciones', 'Delegaciones', 'bosques-nativos', 30, NULL),
  ('despacho-y-gestion-administrativa', 'Despacho y Gestión Administrativa', 'administracion', 10, NULL),
  ('patrimonio', 'Patrimonio', 'administracion', 20, NULL)
) AS v(slug, titulo, padre, orden, icono) ON true
LEFT JOIN sections p ON p.space_id = s.id AND p.slug = v.padre
WHERE s.slug = 'ecologia-desarrollo-sustentable';
WITH nuevas AS (
  INSERT INTO pages (section_id, slug, titulo, contenido_md, acceso, version)
  SELECT sec.id, v.slug, v.titulo, '# ' || v.titulo || E'\n\n[PLACEHOLDER] Contenido pendiente de redacción.', 'general', 1
  FROM sections sec
  JOIN spaces s ON s.id = sec.space_id AND s.slug = 'ecologia-desarrollo-sustentable'
  JOIN (VALUES
  ('recursos-vitales', 'indice', 'Recursos Vitales'),
  ('recursos-vitales', 'flora', 'Flora'),
  ('recursos-vitales', 'fauna', 'Fauna'),
  ('recursos-vitales', 'registro-y-uso-de-biodiversidad', 'Registro y Uso de Biodiversidad'),
  ('biodiversidad', 'indice', 'Biodiversidad'),
  ('impacto-ambiental', 'indice', 'Impacto Ambiental'),
  ('impacto-ambiental', 'control-ambiental', 'Control Ambiental'),
  ('impacto-ambiental', 'proteccion-ambiental', 'Protección Ambiental'),
  ('areas-naturales-protegidas', 'indice', 'Áreas Naturales Protegidas'),
  ('areas-naturales-protegidas', 'planificacion-a-n-p', 'Planificación A.N.P.'),
  ('areas-naturales-protegidas', 'intendencias-a-n-p', 'Intendencias A.N.P.'),
  ('areas-naturales-protegidas', 'educacion-ambiental', 'Educación Ambiental'),
  ('investigacion-desarrollo-y-promocion-educativa', 'indice', 'Investigación, Desarrollo y Promoción Educativa'),
  ('investigacion-desarrollo-y-promocion-educativa', 'acuicultura', 'Acuicultura'),
  ('investigacion-desarrollo-y-promocion-educativa', 'r-y-c-a-s', 'R. y C.A.S.'),
  ('investigacion-desarrollo-y-promocion-educativa', 'vivero', 'Vivero'),
  ('control-forestal', 'indice', 'Control Forestal'),
  ('control-forestal', 'control-fijo', 'Control Fijo'),
  ('control-forestal', 'guias-y-archivos', 'Guías y Archivos'),
  ('m-s-de-bosques-nativos', 'indice', 'M.S. de Bosques Nativos'),
  ('m-s-de-bosques-nativos', 'manejo-de-bosques-nativos', 'Manejo de Bosques Nativos'),
  ('m-s-de-bosques-nativos', 'promocion-del-bosque-nativo', 'Promoción del Bosque Nativo'),
  ('m-s-de-bosques-nativos', 'registro-e-inscripcion', 'Registro e Inscripción'),
  ('delegaciones', 'indice', 'Delegaciones'),
  ('despacho-y-gestion-administrativa', 'indice', 'Despacho y Gestión Administrativa'),
  ('despacho-y-gestion-administrativa', 'personal', 'Personal'),
  ('despacho-y-gestion-administrativa', 'mesa-de-entradas-y-salidas', 'Mesa de Entradas y Salidas'),
  ('despacho-y-gestion-administrativa', 'gestion-administrativa', 'Gestión Administrativa'),
  ('patrimonio', 'indice', 'Patrimonio'),
  ('patrimonio', 'compras-e-insumos', 'Compras e Insumos'),
  ('patrimonio', 'parque-automotor', 'Parque Automotor')
  ) AS v(sec, slug, titulo) ON v.sec = sec.slug
  RETURNING id, titulo, contenido_md
)
INSERT INTO page_versions (page_id, version, titulo, contenido_md)
SELECT id, 1, titulo, contenido_md FROM nuevas;

INSERT INTO spaces (slug, nombre, subtitulo, descripcion, activo, orden) VALUES ('corredor-verde', 'Unidad de Gestión Corredor Verde', NULL, 'Unidad de Gestión Corredor Verde.', true, 30);
INSERT INTO sections (space_id, slug, titulo, padre_id, orden, icono, acceso)
SELECT s.id, v.slug, v.titulo, p.id, v.orden, v.icono, 'general'
FROM spaces s
JOIN (VALUES
  ('corredor-verde', 'Corredor Verde', NULL, 10, '🌱')
) AS v(slug, titulo, padre, orden, icono) ON true
LEFT JOIN sections p ON p.space_id = s.id AND p.slug = v.padre
WHERE s.slug = 'corredor-verde';
WITH nuevas AS (
  INSERT INTO pages (section_id, slug, titulo, contenido_md, acceso, version)
  SELECT sec.id, v.slug, v.titulo, '# ' || v.titulo || E'\n\n[PLACEHOLDER] Contenido pendiente de redacción.', 'general', 1
  FROM sections sec
  JOIN spaces s ON s.id = sec.space_id AND s.slug = 'corredor-verde'
  JOIN (VALUES
  ('corredor-verde', 'indice', 'Corredor Verde')
  ) AS v(sec, slug, titulo) ON v.sec = sec.slug
  RETURNING id, titulo, contenido_md
)
INSERT INTO page_versions (page_id, version, titulo, contenido_md)
SELECT id, 1, titulo, contenido_md FROM nuevas;
