-- Anuncio transversal de bienvenida (space_id NULL).
INSERT INTO announcements (space_id, titulo, cuerpo_md, prioridad, publicado_at, visible, autor_id)
VALUES (
  NULL,
  'Bienvenidos a la Wiki MERNR',
  E'La **Wiki MERNR** es la base de conocimiento del Ministerio de Ecología y Recursos Naturales Renovables de Misiones.\n\nCada área tiene su propio espacio con documentación, procedimientos y el estado de sus sistemas. Los anuncios del Ministerio aparecen en todos los espacios.',
  'media',
  now(),
  true,
  (SELECT id FROM users WHERE es_admin_global ORDER BY created_at LIMIT 1)
);
