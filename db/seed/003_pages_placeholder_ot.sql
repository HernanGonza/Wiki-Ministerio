-- Una página placeholder (slug `indice`) por cada sección hoja de OT.
WITH hojas AS (
  SELECT sec.id, sec.titulo
  FROM sections sec
  JOIN spaces sp ON sp.id = sec.space_id AND sp.slug = 'ordenamiento-territorial'
  WHERE NOT EXISTS (SELECT 1 FROM sections h WHERE h.padre_id = sec.id)
),
nuevas AS (
  INSERT INTO pages (section_id, slug, titulo, contenido_md, acceso, version)
  SELECT id, 'indice', titulo,
         '# ' || titulo || E'\n\n[PLACEHOLDER] Contenido pendiente de redacción.',
         'general', 1
  FROM hojas
  RETURNING id, titulo, contenido_md
)
INSERT INTO page_versions (page_id, version, titulo, contenido_md)
SELECT id, 1, titulo, contenido_md FROM nuevas;
