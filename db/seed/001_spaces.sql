-- Espacios iniciales. `ministerio` es la portada transversal (no se puede borrar).
INSERT INTO spaces (slug, nombre, subtitulo, descripcion, activo, orden) VALUES
  ('ministerio', 'Ministerio', 'Base de conocimiento del Ministerio',
   'Portada transversal de la Wiki MERNR.', true, 0),
  ('ordenamiento-territorial', 'Ordenamiento Territorial', NULL,
   'Subsecretaría de Ordenamiento Territorial.', true, 10);
