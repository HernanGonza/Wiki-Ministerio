-- Sistemas transversales (space_id NULL): ninguno por ahora.
-- Sistemas del espacio ordenamiento-territorial.
INSERT INTO systems (space_id, nombre, slug, url, vm, orden, activo)
SELECT s.id, v.nombre, v.slug, v.url, v.vm, v.orden, true
FROM spaces s,
(VALUES
  ('Ecodatos',                'ecodatos',              'https://ecodatos.ecologia.misiones.gob.ar',                          '10.0.0.231', 10),
  ('IDE Misiones',            'ide-misiones',          'https://ide.ordenamientoterritorial.misiones.gob.ar',                '10.0.0.10',  20),
  ('Personal',                'personal',              'https://personal.ecologia.misiones.gob.ar',                          '10.0.0.243', 30),
  ('JNR',                     'jnr',                   'https://registrojnr.ecologia.misiones.gob.ar',                       '10.0.0.239', 40),
  ('Geolytic',                'geolytic',              'http://10.0.0.244',                                                  '10.0.0.244', 50),
  ('Licencias de Pesca',      'licencias-de-pesca',    'https://licenciadepesca.ecologia.misiones.gob.ar',                   '10.0.0.30',  60),
  ('Registro de Infractores', 'registro-de-infractores','https://infraccionesambientales.ecologia.misiones.gob.ar',          '10.0.0.30',  70),
  ('EcoRemitos',              'ecoremitos',            'https://tramites.ecologia.misiones.gob.ar/ecoremitos',               '10.0.0.243', 80)
) AS v(nombre, slug, url, vm, orden)
WHERE s.slug = 'ordenamiento-territorial';
