-- Estructura del espacio ordenamiento-territorial.
-- Los títulos de las subsecciones se derivaron de los slugs: revisar con el área.
-- Se inserta por niveles para poder resolver el padre por slug.

-- Nivel 1
INSERT INTO sections (space_id, slug, titulo, descripcion, padre_id, orden, icono, acceso)
SELECT s.id, v.slug, v.titulo, NULL, NULL, v.orden, v.icono, v.acceso::acceso_t
FROM spaces s,
(VALUES
  ('organizacion',    'Organización',   10, '🏢', 'general'),
  ('sistemas',        'Sistemas',       20, '💻', 'general'),
  ('bases-de-datos',  'Bases de Datos', 30, '🗄️', 'general'),
  ('infraestructura', 'Infraestructura',40, '🖧', 'general'),
  ('procedimientos',  'Procedimientos', 50, '📋', 'general'),
  ('proyectos',       'Proyectos',      60, '📁', 'general'),
  ('plantillas',      'Plantillas',     70, '📑', 'general'),
  ('referencias',     'Referencias',    80, '🔗', 'general'),
  ('accesos',         'Accesos',        90, '🔐', 'restringido')
) AS v(slug, titulo, orden, icono, acceso)
WHERE s.slug = 'ordenamiento-territorial';

-- Nivel 2
INSERT INTO sections (space_id, slug, titulo, padre_id, orden, acceso)
SELECT p.space_id, v.slug, v.titulo, p.id, v.orden, 'general'
FROM sections p
JOIN spaces s ON s.id = p.space_id AND s.slug = 'ordenamiento-territorial'
JOIN (VALUES
  ('organizacion',    'dg-sig',               'Dirección General de SIG',           10),
  ('organizacion',    'dg-planificacion',     'Dirección General de Planificación', 20),
  ('organizacion',    'dg-alerta',            'Dirección General de Alerta',        30),
  ('organizacion',    'asuntos-juridicos',    'Asuntos Jurídicos',                  40),
  ('organizacion',    'despacho',             'Despacho',                           50),
  ('organizacion',    'difusion-relaciones',  'Difusión y Relaciones',              60),
  ('infraestructura', 'oracle-linux-server',  'Oracle Linux Server',                10),
  ('infraestructura', 'haproxy-pfsense',      'HAProxy / pfSense',                  20)
) AS v(padre, slug, titulo, orden) ON v.padre = p.slug;

-- Nivel 3
INSERT INTO sections (space_id, slug, titulo, padre_id, orden, acceso)
SELECT p.space_id, v.slug, v.titulo, p.id, v.orden, 'general'
FROM sections p
JOIN spaces s ON s.id = p.space_id AND s.slug = 'ordenamiento-territorial'
JOIN (VALUES
  ('dg-planificacion', 'gestion-proyectos',        'Gestión de Proyectos',      10),
  ('dg-planificacion', 'servicios-ambientales',    'Servicios Ambientales',     20),
  ('dg-planificacion', 'planificacion-urbana',     'Planificación Urbana',      30),
  ('dg-planificacion', 'planificacion-rural',      'Planificación Rural',       40),
  ('dg-alerta', 'vigilancia-meteorologica', 'Vigilancia Meteorológica',  10),
  ('dg-alerta', 'sistemas-informacion',     'Sistemas de Información',   20),
  ('dg-alerta', 'difusion-comunicacion',    'Difusión y Comunicación',   30),
  ('dg-alerta', 'manejo-fuego',             'Manejo del Fuego',          40),
  ('dg-alerta', 'emergencia-fuego',         'Emergencia de Fuego',       50),
  ('dg-alerta', 'logistica',                'Logística',                 60)
) AS v(padre, slug, titulo, orden) ON v.padre = p.slug;
