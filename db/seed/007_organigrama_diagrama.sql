-- Organigrama del Ministerio como bloque nativo (editable), a partir del PDF de mayo 2024.
-- REVISAR con el área: la ubicación de algunas áreas (p. ej. Bosques Nativos, Administración, Asuntos Jurídicos de la Subsecretaría de OT) se leyó de un dibujo con líneas cruzadas.
WITH pg AS (
  SELECT p.id FROM pages p
  JOIN sections sec ON sec.id = p.section_id AND sec.slug = 'organigrama'
  JOIN spaces s ON s.id = sec.space_id AND s.slug = 'gabinete-ministerial'
  WHERE p.slug = 'indice'
), act AS (
  UPDATE pages SET contenido_json = '[{"id": "intro", "type": "paragraph", "runs": [{"t": "Organigrama general del Ministerio de Ecología y Recursos Naturales Renovables (mayo 2024). Cada cuadro se puede editar desde el editor de la página."}]}, {"id": "org1", "type": "orgchart", "nodos": [{"id": "n1", "t": "Ministro de Ecología y R.N.R.", "estilo": "destacado", "hijos": [{"id": "n2", "t": "Unidad Técnica", "hijos": []}, {"id": "n3", "t": "Gabinete", "hijos": []}, {"id": "n4", "t": "Secretaría Privada", "hijos": []}, {"id": "n5", "t": "Auditoría", "hijos": []}, {"id": "n6", "t": "Subsecretaría de Ecología y Desarrollo Sustentable", "estilo": "destacado", "hijos": [{"id": "n7", "t": "Dirección General de Ecología y Calidad Ambiental", "hijos": [{"id": "n8", "t": "Recursos Vitales", "vertical": true, "hijos": [{"id": "n9", "t": "Flora", "hijos": []}, {"id": "n10", "t": "Fauna", "hijos": []}, {"id": "n11", "t": "Reg. y Uso Bio.", "hijos": []}]}, {"id": "n12", "t": "Biodiversidad", "hijos": []}, {"id": "n13", "t": "Impacto Ambiental", "vertical": true, "hijos": [{"id": "n14", "t": "Control Amb.", "hijos": []}, {"id": "n15", "t": "Protec. Amb.", "hijos": []}]}, {"id": "n16", "t": "A.N. Protegidas", "vertical": true, "hijos": [{"id": "n17", "t": "Planif. A.N.P.", "hijos": []}, {"id": "n18", "t": "Intend. A.N.P.", "hijos": []}, {"id": "n19", "t": "Educación Ambiental", "hijos": []}]}]}, {"id": "n20", "t": "Parque Ecológico", "hijos": [{"id": "n21", "t": "Investig. Des. Promoc. Educat.", "vertical": true, "hijos": [{"id": "n22", "t": "Acuicultura", "hijos": []}, {"id": "n23", "t": "R. y C.A.S.", "hijos": []}, {"id": "n24", "t": "Vivero", "hijos": []}]}]}]}, {"id": "n25", "t": "Unidad de Gestión Corredor Verde", "estilo": "destacado", "hijos": []}, {"id": "n26", "t": "Dirección General de Bosques Nativos", "hijos": [{"id": "n27", "t": "Control Forestal", "vertical": true, "hijos": [{"id": "n28", "t": "Control Fijo", "hijos": []}, {"id": "n29", "t": "Guías y Archivos", "hijos": []}]}, {"id": "n30", "t": "M.S. de Bosques Nativos", "vertical": true, "hijos": [{"id": "n31", "t": "M. Bosques Nat.", "hijos": []}, {"id": "n32", "t": "Promoción Bosque Nativo", "hijos": []}, {"id": "n33", "t": "Registro e Inscripción", "hijos": []}]}, {"id": "n34", "t": "Delegaciones", "hijos": []}]}, {"id": "n35", "t": "Dirección General de Administración", "hijos": [{"id": "n36", "t": "Despacho Gestión Administrativa", "vertical": true, "hijos": [{"id": "n37", "t": "U. Personal", "hijos": []}, {"id": "n38", "t": "Mesa de Entradas y Salidas", "hijos": []}, {"id": "n39", "t": "Gestión Administrativa", "hijos": []}]}, {"id": "n40", "t": "Patrimonio", "vertical": true, "hijos": [{"id": "n41", "t": "Compras e Insumos", "hijos": []}, {"id": "n42", "t": "Parque Automotor", "hijos": []}]}]}, {"id": "n43", "t": "Asuntos Jurídicos", "hijos": [{"id": "n44", "t": "A. Jurídicos", "vertical": true, "hijos": [{"id": "n45", "t": "Sumarios Ambientales", "hijos": []}]}]}, {"id": "n46", "t": "Proc. I.S. y Cómputos", "vertical": true, "hijos": [{"id": "n47", "t": "Cómputos y Estadísticas", "hijos": []}]}, {"id": "n48", "t": "Comunicación y Relaciones Institucionales", "vertical": true, "hijos": [{"id": "n49", "t": "Diseño y Gestión de Contenidos", "hijos": []}]}, {"id": "n50", "t": "Subsecretaría de Ordenamiento Territorial", "estilo": "destacado", "hijos": [{"id": "n51", "t": "Sistema de Información Geográfica", "hijos": [{"id": "n52", "t": "Gestión de Proyectos y Financiación", "hijos": []}]}, {"id": "n53", "t": "Planificación Territorial", "vertical": true, "hijos": [{"id": "n54", "t": "Servicios Ambientales", "hijos": []}, {"id": "n55", "t": "Planificación Urbana", "hijos": []}, {"id": "n56", "t": "Planificación Rural", "hijos": []}]}, {"id": "n57", "t": "Alerta Temprana", "hijos": [{"id": "n58", "t": "Vigilancia Meteorológica", "hijos": []}, {"id": "n59", "t": "Sistemas de Información y Redes", "hijos": []}, {"id": "n60", "t": "Difusión y Comunicación", "hijos": []}, {"id": "n61", "t": "Manejo del Fuego y Emerg. Amb.", "vertical": true, "hijos": [{"id": "n62", "t": "Emergencia y M. Fuego", "hijos": []}, {"id": "n63", "t": "Logística", "hijos": []}]}]}, {"id": "n64", "t": "Asuntos Jurídicos", "hijos": []}, {"id": "n65", "t": "Despacho", "hijos": []}, {"id": "n66", "t": "Difusión y Relaciones Institucionales", "hijos": []}]}, {"id": "n67", "t": "C.T.M.", "vertical": true, "hijos": [{"id": "n68", "t": "Asistencia Téc.", "hijos": []}, {"id": "n69", "t": "Form. y Cap.", "hijos": []}, {"id": "n70", "t": "Mant. Gral.", "hijos": []}, {"id": "n71", "t": "Sec. General", "hijos": []}]}]}]}]'::jsonb,
                   contenido_md = 'Organigrama general del Ministerio de Ecología y Recursos Naturales Renovables (mayo 2024). Cada cuadro se puede editar desde el editor de la página.

- Ministro de Ecología y R.N.R.
  - Unidad Técnica
  - Gabinete
  - Secretaría Privada
  - Auditoría
  - Subsecretaría de Ecología y Desarrollo Sustentable
    - Dirección General de Ecología y Calidad Ambiental
      - Recursos Vitales
        - Flora
        - Fauna
        - Reg. y Uso Bio.
      - Biodiversidad
      - Impacto Ambiental
        - Control Amb.
        - Protec. Amb.
      - A.N. Protegidas
        - Planif. A.N.P.
        - Intend. A.N.P.
        - Educación Ambiental
    - Parque Ecológico
      - Investig. Des. Promoc. Educat.
        - Acuicultura
        - R. y C.A.S.
        - Vivero
  - Unidad de Gestión Corredor Verde
  - Dirección General de Bosques Nativos
    - Control Forestal
      - Control Fijo
      - Guías y Archivos
    - M.S. de Bosques Nativos
      - M. Bosques Nat.
      - Promoción Bosque Nativo
      - Registro e Inscripción
    - Delegaciones
  - Dirección General de Administración
    - Despacho Gestión Administrativa
      - U. Personal
      - Mesa de Entradas y Salidas
      - Gestión Administrativa
    - Patrimonio
      - Compras e Insumos
      - Parque Automotor
  - Asuntos Jurídicos
    - A. Jurídicos
      - Sumarios Ambientales
  - Proc. I.S. y Cómputos
    - Cómputos y Estadísticas
  - Comunicación y Relaciones Institucionales
    - Diseño y Gestión de Contenidos
  - Subsecretaría de Ordenamiento Territorial
    - Sistema de Información Geográfica
      - Gestión de Proyectos y Financiación
    - Planificación Territorial
      - Servicios Ambientales
      - Planificación Urbana
      - Planificación Rural
    - Alerta Temprana
      - Vigilancia Meteorológica
      - Sistemas de Información y Redes
      - Difusión y Comunicación
      - Manejo del Fuego y Emerg. Amb.
        - Emergencia y M. Fuego
        - Logística
    - Asuntos Jurídicos
    - Despacho
    - Difusión y Relaciones Institucionales
  - C.T.M.
    - Asistencia Téc.
    - Form. y Cap.
    - Mant. Gral.
    - Sec. General', version = version + 1, updated_at = now()
  WHERE id IN (SELECT id FROM pg)
  RETURNING id, version, titulo, contenido_md, contenido_json
)
INSERT INTO page_versions (page_id, version, titulo, contenido_md, contenido_json)
SELECT id, version, titulo, contenido_md, contenido_json FROM act;

-- La página suelta con el mismo fin ya no hace falta.
DELETE FROM pages WHERE slug = 'organigrama-general' AND section_id IN (
  SELECT sec.id FROM sections sec JOIN spaces s ON s.id = sec.space_id AND s.slug = 'gabinete-ministerial' WHERE sec.slug = 'organigrama');
