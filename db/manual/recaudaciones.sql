-- Wiki MERNR · Sistemas · Recaudaciones (sistema central de pagos)
-- Genera la sección "Recaudaciones" dentro de Sistemas, en Ordenamiento Territorial, con sus subsecciones y páginas.
--
-- Se puede correr las veces que haga falta: NO pisa nada. Si una sección o página ya existe (mismo slug) la deja como está
-- y solo crea lo que falta. Todo en una transacción: si algo falla, no queda nada a medias.
--
-- Ejecutar en el server (desde la carpeta del compose):
--   docker compose exec -T db sh -c 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < db/manual/recaudaciones.sql
--
-- Contenido tomado de la documentación del repo botonera-pagos (README y docs/). Sin credenciales ni secretos.
BEGIN;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM spaces WHERE slug = 'ordenamiento-territorial') THEN
    RAISE EXCEPTION 'No existe el espacio ordenamiento-territorial';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM sections sec JOIN spaces s ON s.id = sec.space_id
                 WHERE s.slug = 'ordenamiento-territorial' AND sec.slug = 'sistemas') THEN
    RAISE EXCEPTION 'No existe la sección "sistemas" en ordenamiento-territorial';
  END IF;
END $$;

-- Sección principal: Sistemas > Recaudaciones
INSERT INTO sections (space_id, slug, titulo, descripcion, padre_id, orden, icono, acceso)
SELECT s.id, 'recaudaciones', 'Recaudaciones',
       'Sistema central de pagos del Ministerio: botonera pública, paneles de área y panel de Recaudaciones.',
       sis.id, 100, '💰', 'general'
FROM spaces s
JOIN sections sis ON sis.space_id = s.id AND sis.slug = 'sistemas'
WHERE s.slug = 'ordenamiento-territorial'
ON CONFLICT (space_id, slug) DO NOTHING;

-- Subsecciones
INSERT INTO sections (space_id, slug, titulo, descripcion, padre_id, orden, icono, acceso)
SELECT r.space_id, v.slug, v.titulo, v.descripcion, r.id, v.orden, v.icono, 'general'
FROM sections r
JOIN spaces s ON s.id = r.space_id AND s.slug = 'ordenamiento-territorial'
CROSS JOIN (VALUES
  ('arquitectura', 'Arquitectura', '🧱', 'Tecnología, estructura y decisiones de diseño', 10),
  ('tramites', 'Trámites y módulos', '📝', 'Fitosanitarios, consultores y reservas; circuito de solicitud', 20),
  ('pasarela', 'Pasarela de pagos', '💳', 'Click de Pago: flujo, seguridad y conciliación', 30),
  ('panel-recaudaciones', 'Panel de Recaudaciones', '📊', 'Pagos, estadísticas y tarifas', 40),
  ('accesos-y-roles', 'Accesos y roles', '🔑', 'Login de Ecodatos y permisos', 50),
  ('despliegue-operacion', 'Despliegue y operación', '🚀', 'Docker, cron y proxy', 60),
  ('pendientes', 'Estado y pendientes', '✅', 'Qué falta para cobrar y para cerrar', 70)
) AS v(slug, titulo, icono, descripcion, orden)
WHERE r.slug = 'recaudaciones'
ON CONFLICT (space_id, slug) DO NOTHING;

-- Crea la página solo si la sección todavía no tiene una con ese slug (y deja su versión 1).
CREATE FUNCTION pg_temp.crear_pagina(sec text, pag text, tit text, j jsonb, m text) RETURNS void
LANGUAGE plpgsql AS $f$
DECLARE sid uuid; pid uuid;
BEGIN
  SELECT sec_.id INTO sid FROM sections sec_ JOIN spaces s ON s.id = sec_.space_id
   WHERE s.slug = 'ordenamiento-territorial' AND sec_.slug = sec;
  IF sid IS NULL THEN RAISE EXCEPTION 'Falta la sección %', sec; END IF;
  INSERT INTO pages (section_id, slug, titulo, contenido_md, contenido_json, acceso, version)
  VALUES (sid, pag, tit, m, j, 'general', 1)
  ON CONFLICT (section_id, slug) DO NOTHING
  RETURNING id INTO pid;
  IF pid IS NOT NULL THEN
    INSERT INTO page_versions (page_id, version, titulo, contenido_md, contenido_json) VALUES (pid, 1, tit, m, j);
  END IF;
END $f$;

SELECT pg_temp.crear_pagina('recaudaciones', 'indice', 'Recaudaciones', $j$[{"id":"b1","type":"paragraph","runs":[{"t":"Sistema con el que el público paga desde la web del Ministerio todo lo que el Ministerio cobra, y con el que Recaudaciones controla, concilia y reporta esos pagos. Reemplaza los cobros manuales por un circuito único: la persona inicia el trámite, el área técnica lo revisa, se cobra por la pasarela del banco y se emite el comprobante o certificado."}]},{"id":"b2","type":"callout","tone":"info","runs":[{"t":"Esta sección documenta el sistema "},{"t":"central de pagos","b":true},{"t":". Cada trámite (fitosanitarios, consultores, reservas privadas) es un módulo que se enchufa en él. La licencia de pesca queda fuera: se maneja en un sistema aparte."}]},{"id":"b3","type":"heading","level":2,"runs":[{"t":"Quién lo usa"}]},{"id":"b4","type":"table","header":true,"rows":[["Perfil","Qué hace","Dónde entra"],["Contribuyente (público)","Pide un trámite y paga. Sin cuenta ni contraseña: se identifica con su mail (código de 6 dígitos) o con su CUIT/CUIL.","Botonera pública"],["Técnico de área","Revisa solicitudes: las toma, aprueba, observa o rechaza.","Paneles de área"],["Recaudaciones / Contaduría","Ve pagos y órdenes, estadísticas, tarifas, auditoría y concilia.","Panel de Recaudaciones"],["Administrador del sistema","Enciende y apaga módulos, avisos de mantenimiento, estado y accesos.","Administración del sistema"]]},{"id":"b5","type":"heading","level":2,"runs":[{"t":"Partes del sistema"}]},{"id":"b6","type":"table","header":true,"rows":[["Parte","Ruta en producción","Descripción"],["Botonera pública","`/pagos/publico/`","Home con los trámites y pantalla de cada uno."],["Paneles de área","`/pagos/tecnicos/`","Revisión de solicitudes por los técnicos."],["Recaudaciones","`/pagos/recaudaciones/`","Panel financiero."],["Administración","`/pagos/administracion/`","Módulos, mantenimiento, estado, auditoría y accesos."],["Bandeja de mails","`/pagos/mail/`","Mails que el sistema no envía (modo prueba)."],["API","`/pagos/api/…`","Backend único. Todo pasa por ella."]]},{"id":"b7","type":"paragraph","runs":[{"t":"Todo cuelga de "},{"t":"https://ecodatos.ecologia.misiones.gob.ar","c":true},{"t":", detrás del nginx de Ecodatos, igual que la Wiki ("},{"t":"/wiki/","c":true},{"t":") y Vaultwarden ("},{"t":"/claves/","c":true},{"t":")."}]},{"id":"b8","type":"heading","level":2,"runs":[{"t":"Estado resumido (16/11/2026)"}]},{"id":"b9","type":"list","ordered":false,"items":[[{"t":"Circuito completo probado en entorno de prueba: solicitud → revisión → pago simulado → certificado → mail."}],[{"t":"Formulario de pago verificado de punta a punta contra el sandbox del banco."}],[{"t":"No se puede cobrar en producción todavía:","b":true},{"t":" falta que el banco habilite la consulta de transacciones y dar de alta las URL de aviso. Ver Pendientes."}]]}]$j$::jsonb, $m$Sistema con el que el público paga desde la web del Ministerio todo lo que el Ministerio cobra, y con el que Recaudaciones controla, concilia y reporta esos pagos. Reemplaza los cobros manuales por un circuito único: la persona inicia el trámite, el área técnica lo revisa, se cobra por la pasarela del banco y se emite el comprobante o certificado.

> **Nota:** Esta sección documenta el sistema **central de pagos**. Cada trámite (fitosanitarios, consultores, reservas privadas) es un módulo que se enchufa en él. La licencia de pesca queda fuera: se maneja en un sistema aparte.

## Quién lo usa

| Perfil | Qué hace | Dónde entra |
| --- | --- | --- |
| Contribuyente (público) | Pide un trámite y paga. Sin cuenta ni contraseña: se identifica con su mail (código de 6 dígitos) o con su CUIT/CUIL. | Botonera pública |
| Técnico de área | Revisa solicitudes: las toma, aprueba, observa o rechaza. | Paneles de área |
| Recaudaciones / Contaduría | Ve pagos y órdenes, estadísticas, tarifas, auditoría y concilia. | Panel de Recaudaciones |
| Administrador del sistema | Enciende y apaga módulos, avisos de mantenimiento, estado y accesos. | Administración del sistema |

## Partes del sistema

| Parte | Ruta en producción | Descripción |
| --- | --- | --- |
| Botonera pública | `/pagos/publico/` | Home con los trámites y pantalla de cada uno. |
| Paneles de área | `/pagos/tecnicos/` | Revisión de solicitudes por los técnicos. |
| Recaudaciones | `/pagos/recaudaciones/` | Panel financiero. |
| Administración | `/pagos/administracion/` | Módulos, mantenimiento, estado, auditoría y accesos. |
| Bandeja de mails | `/pagos/mail/` | Mails que el sistema no envía (modo prueba). |
| API | `/pagos/api/…` | Backend único. Todo pasa por ella. |

Todo cuelga de `https://ecodatos.ecologia.misiones.gob.ar`, detrás del nginx de Ecodatos, igual que la Wiki (`/wiki/`) y Vaultwarden (`/claves/`).

## Estado resumido (16/11/2026)

- Circuito completo probado en entorno de prueba: solicitud → revisión → pago simulado → certificado → mail.
- Formulario de pago verificado de punta a punta contra el sandbox del banco.
- **No se puede cobrar en producción todavía:** falta que el banco habilite la consulta de transacciones y dar de alta las URL de aviso. Ver Pendientes.$m$);
SELECT pg_temp.crear_pagina('arquitectura', 'indice', 'Arquitectura', $j$[{"id":"b10","type":"paragraph","runs":[{"t":"Un solo front público y una sola API; cada trámite es un "},{"t":"módulo","b":true},{"t":" que se enchufa en ellos. No hay un repo ni un build por módulo."}]},{"id":"b11","type":"heading","level":2,"runs":[{"t":"Tecnología"}]},{"id":"b12","type":"table","header":true,"rows":[["Capa","Tecnología"],["Monorepo","npm workspaces, TypeScript en todo el repo"],["Front público y paneles","React 19, Vite, React Router, Tailwind v4, shadcn + Watermelon UI"],["Panel de Recaudaciones","Igual, con gráficos (recharts)"],["API","Node.js, Express 5, `pg` (conexión directa a Postgres)"],["Base de datos","PostgreSQL en el Supabase self-hosted de Ecodatos, esquema propio `pagos`"],["Migraciones","Archivos SQL en `db/migrations/` (las corre el dueño del proyecto)"],["Pagos","Click de Pago / MacroClick, detrás de una interfaz de proveedor (hay un `mock` para pruebas)"],["Marca","Brandbook 2024 (Oak Sans, verde `#3E6C51`), compartido en `packages/marca`"]]},{"id":"b13","type":"heading","level":2,"runs":[{"t":"Estructura del repositorio"}]},{"id":"b14","type":"code","text":"botonera-pagos/\n├─ apps/\n│  ├─ web/            botonera pública: home + /pagar/<slug>\n│  ├─ admin/          panel de Recaudaciones\n│  ├─ paneles/        paneles de área (técnicos)\n│  ├─ sistema/        administración del sistema\n│  ├─ api/            Node + Express + TypeScript\n│  └─ relevamiento/   herramienta local de relevamiento\n├─ packages/\n│  ├─ shared/         tipos compartidos front/back\n│  ├─ marca/          fuentes, paleta y logos\n│  └─ sesion/         sesión única de los paneles\n└─ db/migrations/     SQL del esquema \"pagos\""},{"id":"b15","type":"heading","level":2,"runs":[{"t":"Tipos de módulo"}]},{"id":"b16","type":"table","header":true,"rows":[["Tipo","Cómo se define","Ejemplo"],["Simple","Solo configuración en la base: campos, monto fijo o fórmula.","Tasa de trámite con monto fijo"],["Con consulta","Configuración más un resolver en el back que valida al contribuyente en un registro o busca la deuda.","Certificado de un registro, multa por acta"],["Complejo","Componente React y rutas propias en el back.","Fitosanitarios"]]},{"id":"b17","type":"callout","tone":"warn","runs":[{"t":"Hoy todos los módulos son del tipo complejo (migración + API + componente propios). Los módulos simples generados desde configuración todavía no existen."}]},{"id":"b18","type":"heading","level":2,"runs":[{"t":"Esquema "},{"t":"pagos","c":true},{"t":" (núcleo)"}]},{"id":"b19","type":"list","ordered":false,"items":[[{"t":"modulos","c":true},{"t":": slug, nombre, ícono, categoría, orden, activo, tipo y configuración."}],[{"t":"ordenes_pago","c":true},{"t":": la intención de pago (módulo, CUIT/CUIL, monto, estado, cuenta, referencia externa)."}],[{"t":"pagos","c":true},{"t":": intentos y confirmaciones del proveedor."}],[{"t":"tarifas","c":true},{"t":": valores de cada trámite con vigencia (versionadas); la orden guarda la versión usada."}],[{"t":"comprobantes","c":true},{"t":", "},{"t":"conciliaciones","c":true},{"t":", "},{"t":"auditoria","c":true},{"t":", "},{"t":"sistema_config","c":true},{"t":"."}],[{"t":"Cada módulo suma tablas con prefijo propio ("},{"t":"fito_*","c":true},{"t":", "},{"t":"cons_*","c":true},{"t":", "},{"t":"res_*","c":true},{"t":")."}]]},{"id":"b20","type":"heading","level":2,"runs":[{"t":"Decisiones fijadas"}]},{"id":"b21","type":"list","ordered":true,"items":[[{"t":"El front nunca habla con la base: todo pasa por la API. El esquema no se expone en PostgREST y tiene RLS activado por prevención."}],[{"t":"El proveedor de pago es una interfaz; ningún módulo conoce al banco."}],[{"t":"Sin login para el público: se identifica con mail verificado o con CUIT/CUIL validado contra un registro."}],[{"t":"Montos y estados se calculan y validan solo en el back.","b":true},{"t":" El front nunca manda un monto."}],[{"t":"Webhooks idempotentes y conciliación diaria, porque es plata pública."}],[{"t":"Cada módulo es autónomo: sin imports cruzados; solo lo transversal va en lo general."}],[{"t":"Apagar un módulo no borra nada: desaparece de la web pública y su API responde 404; los paneles y el QR de certificados ya emitidos siguen andando."}],[{"t":"El esquema "},{"t":"public","c":true},{"t":" es Ecodatos: sus migraciones las corre el dueño y no se reescriben. El esquema "},{"t":"pagos","c":true},{"t":" sí puede cambiar."}]]}]$j$::jsonb, $m$Un solo front público y una sola API; cada trámite es un **módulo** que se enchufa en ellos. No hay un repo ni un build por módulo.

## Tecnología

| Capa | Tecnología |
| --- | --- |
| Monorepo | npm workspaces, TypeScript en todo el repo |
| Front público y paneles | React 19, Vite, React Router, Tailwind v4, shadcn + Watermelon UI |
| Panel de Recaudaciones | Igual, con gráficos (recharts) |
| API | Node.js, Express 5, `pg` (conexión directa a Postgres) |
| Base de datos | PostgreSQL en el Supabase self-hosted de Ecodatos, esquema propio `pagos` |
| Migraciones | Archivos SQL en `db/migrations/` (las corre el dueño del proyecto) |
| Pagos | Click de Pago / MacroClick, detrás de una interfaz de proveedor (hay un `mock` para pruebas) |
| Marca | Brandbook 2024 (Oak Sans, verde `#3E6C51`), compartido en `packages/marca` |

## Estructura del repositorio

```
botonera-pagos/
├─ apps/
│  ├─ web/            botonera pública: home + /pagar/<slug>
│  ├─ admin/          panel de Recaudaciones
│  ├─ paneles/        paneles de área (técnicos)
│  ├─ sistema/        administración del sistema
│  ├─ api/            Node + Express + TypeScript
│  └─ relevamiento/   herramienta local de relevamiento
├─ packages/
│  ├─ shared/         tipos compartidos front/back
│  ├─ marca/          fuentes, paleta y logos
│  └─ sesion/         sesión única de los paneles
└─ db/migrations/     SQL del esquema "pagos"
```

## Tipos de módulo

| Tipo | Cómo se define | Ejemplo |
| --- | --- | --- |
| Simple | Solo configuración en la base: campos, monto fijo o fórmula. | Tasa de trámite con monto fijo |
| Con consulta | Configuración más un resolver en el back que valida al contribuyente en un registro o busca la deuda. | Certificado de un registro, multa por acta |
| Complejo | Componente React y rutas propias en el back. | Fitosanitarios |

> **Atención:** Hoy todos los módulos son del tipo complejo (migración + API + componente propios). Los módulos simples generados desde configuración todavía no existen.

## Esquema `pagos` (núcleo)

- `modulos`: slug, nombre, ícono, categoría, orden, activo, tipo y configuración.
- `ordenes_pago`: la intención de pago (módulo, CUIT/CUIL, monto, estado, cuenta, referencia externa).
- `pagos`: intentos y confirmaciones del proveedor.
- `tarifas`: valores de cada trámite con vigencia (versionadas); la orden guarda la versión usada.
- `comprobantes`, `conciliaciones`, `auditoria`, `sistema_config`.
- Cada módulo suma tablas con prefijo propio (`fito_*`, `cons_*`, `res_*`).

## Decisiones fijadas

1. El front nunca habla con la base: todo pasa por la API. El esquema no se expone en PostgREST y tiene RLS activado por prevención.
2. El proveedor de pago es una interfaz; ningún módulo conoce al banco.
3. Sin login para el público: se identifica con mail verificado o con CUIT/CUIL validado contra un registro.
4. **Montos y estados se calculan y validan solo en el back.** El front nunca manda un monto.
5. Webhooks idempotentes y conciliación diaria, porque es plata pública.
6. Cada módulo es autónomo: sin imports cruzados; solo lo transversal va en lo general.
7. Apagar un módulo no borra nada: desaparece de la web pública y su API responde 404; los paneles y el QR de certificados ya emitidos siguen andando.
8. El esquema `public` es Ecodatos: sus migraciones las corre el dueño y no se reescriben. El esquema `pagos` sí puede cambiar.$m$);
SELECT pg_temp.crear_pagina('tramites', 'indice', 'Trámites y módulos', $j$[{"id":"b22","type":"paragraph","runs":[{"t":"Los trámites disponibles son módulos independientes. Los tres comparten el mismo circuito de solicitud con revisión técnica y de pago."}]},{"id":"b23","type":"table","header":true,"rows":[["Módulo","Ruta pública","Estado"],["Registro de fitosanitarios y domisanitarios","`/pagar/fitosanitarios`","Completo. Tipos, requisitos y tasas a confirmar con el área."],["Registro de consultores","`/pagar/consultores`","Clon de fitosanitarios. Requisitos, tipos y tasas provisorios."],["Reservas privadas","`/pagar/reservas`","Clon de consultores. El proceso real será distinto: pendiente."]]},{"id":"b24","type":"heading","level":2,"runs":[{"t":"Circuito de una solicitud"}]},{"id":"b25","type":"list","ordered":true,"items":[[{"t":"La persona elige el tipo de trámite, ingresa su mail y confirma un código de 6 dígitos (vale 15 minutos, 5 intentos)."}],[{"t":"Se crea la solicitud y se abre una sesión (30 min de inactividad, 4 h máximo). Para volver le llega un enlace de un solo uso por mail."}],[{"t":"Carga datos y documentos (PDF, JPG o PNG, hasta 10 MB; el tipo se comprueba por contenido). No puede enviar hasta cumplir todos los requisitos."}],[{"t":"El técnico la "},{"t":"toma","b":true},{"t":", y la "},{"t":"aprueba","b":true},{"t":", "},{"t":"observa","b":true},{"t":" o "},{"t":"rechaza","b":true},{"t":" (con motivo). Cada acción avisa por mail y queda en el historial y la auditoría."}],[{"t":"Si está observada, la persona corrige y reenvía. Una vez aprobada tiene 30 días para pagar; si no, vence."}],[{"t":"Paga las solicitudes aprobadas en "},{"t":"una sola orden","b":true},{"t":" (total = suma de las tasas, sin descuentos)."}],[{"t":"Con el pago confirmado se emite el certificado y llega un mail. Se verifica públicamente con un QR."}]]},{"id":"b26","type":"heading","level":2,"runs":[{"t":"Estados de la solicitud"}]},{"id":"b27","type":"code","text":"borrador → enviada → en_revision → observada / aprobada / rechazada\naprobada → pagada → emitida          (o vencida)"},{"id":"b28","type":"heading","level":2,"runs":[{"t":"Seguridad del circuito"}]},{"id":"b29","type":"list","ordered":false,"items":[[{"t":"Sin contraseñas que robar: sesión en cookie "},{"t":"HttpOnly","c":true},{"t":" y enlaces de un solo uso."}],[{"t":"Los datos de un titular no se ven con solo conocer su CUIT."}],[{"t":"Topes por mail y por IP para los códigos y las consultas."}],[{"t":"Fitosanitarios todavía "},{"t":"no tiene CAPTCHA","b":true},{"t":": acordarlo antes de exponer la búsqueda pública."}]]},{"id":"b30","type":"heading","level":2,"runs":[{"t":"Avisos y tareas diarias"}]},{"id":"b31","type":"paragraph","runs":[{"t":"Cada módulo tiene una tarea diaria (avisos de vencimiento y limpieza): "},{"t":"fitosanitarios:tareas","c":true},{"t":", "},{"t":"consultores:tareas","c":true},{"t":" y "},{"t":"reservas:tareas","c":true},{"t":". Los mails salen por Gmail o Microsoft Graph; en prueba ("},{"t":"MAIL_PROVIDER=consola","c":true},{"t":") quedan en la bandeja "},{"t":"/pagos/mail/","c":true},{"t":"."}]}]$j$::jsonb, $m$Los trámites disponibles son módulos independientes. Los tres comparten el mismo circuito de solicitud con revisión técnica y de pago.

| Módulo | Ruta pública | Estado |
| --- | --- | --- |
| Registro de fitosanitarios y domisanitarios | `/pagar/fitosanitarios` | Completo. Tipos, requisitos y tasas a confirmar con el área. |
| Registro de consultores | `/pagar/consultores` | Clon de fitosanitarios. Requisitos, tipos y tasas provisorios. |
| Reservas privadas | `/pagar/reservas` | Clon de consultores. El proceso real será distinto: pendiente. |

## Circuito de una solicitud

1. La persona elige el tipo de trámite, ingresa su mail y confirma un código de 6 dígitos (vale 15 minutos, 5 intentos).
2. Se crea la solicitud y se abre una sesión (30 min de inactividad, 4 h máximo). Para volver le llega un enlace de un solo uso por mail.
3. Carga datos y documentos (PDF, JPG o PNG, hasta 10 MB; el tipo se comprueba por contenido). No puede enviar hasta cumplir todos los requisitos.
4. El técnico la **toma**, y la **aprueba**, **observa** o **rechaza** (con motivo). Cada acción avisa por mail y queda en el historial y la auditoría.
5. Si está observada, la persona corrige y reenvía. Una vez aprobada tiene 30 días para pagar; si no, vence.
6. Paga las solicitudes aprobadas en **una sola orden** (total = suma de las tasas, sin descuentos).
7. Con el pago confirmado se emite el certificado y llega un mail. Se verifica públicamente con un QR.

## Estados de la solicitud

```
borrador → enviada → en_revision → observada / aprobada / rechazada
aprobada → pagada → emitida          (o vencida)
```

## Seguridad del circuito

- Sin contraseñas que robar: sesión en cookie `HttpOnly` y enlaces de un solo uso.
- Los datos de un titular no se ven con solo conocer su CUIT.
- Topes por mail y por IP para los códigos y las consultas.
- Fitosanitarios todavía **no tiene CAPTCHA**: acordarlo antes de exponer la búsqueda pública.

## Avisos y tareas diarias

Cada módulo tiene una tarea diaria (avisos de vencimiento y limpieza): `fitosanitarios:tareas`, `consultores:tareas` y `reservas:tareas`. Los mails salen por Gmail o Microsoft Graph; en prueba (`MAIL_PROVIDER=consola`) quedan en la bandeja `/pagos/mail/`.$m$);
SELECT pg_temp.crear_pagina('pasarela', 'indice', 'Pasarela de pagos', $j$[{"id":"b32","type":"paragraph","runs":[{"t":"Los cobros se hacen con "},{"t":"Click de Pago (MacroClick)","b":true},{"t":". El driver está aislado en un solo archivo y se instancia "},{"t":"por cuenta","b":true},{"t":" (hoy FITOSANITARIO y FORESTAL); cada módulo declara qué cuenta usa."}]},{"id":"b33","type":"callout","tone":"danger","runs":[{"t":"Estado real: el formulario de pago funciona, pero el banco todavía devuelve 403 en la consulta de transacciones. Sin esa consulta el sistema no puede confirmar pagos y los deja pendientes a propósito. "},{"t":"No se cobra en producción hasta que el banco la habilite.","b":true}]},{"id":"b34","type":"heading","level":2,"runs":[{"t":"Cómo se paga"}]},{"id":"b35","type":"list","ordered":true,"items":[[{"t":"Con la solicitud aprobada, el servidor calcula el importe y crea una orden "},{"t":"pendiente","b":true},{"t":" con una referencia al azar "},{"t":"BOT-XXXXXXXXXXXX","c":true},{"t":"."}],[{"t":"La API devuelve un formulario firmado; el navegador lo envía por POST a la página de pago del banco (redirección completa)."}],[{"t":"La persona paga en el banco y vuelve a "},{"t":"/pagar/retorno?ref=…","c":true},{"t":". Esa página "},{"t":"solo muestra","b":true},{"t":" el estado guardado: nunca confirma nada."}],[{"t":"El banco avisa por separado a la URL de notificación. El sistema no cree en el aviso: consulta al banco y exige estado REALIZADA y monto exacto."}],[{"t":"Confirmado el pago, el módulo pasa la solicitud a pagada y emite el certificado en la misma transacción."}]]},{"id":"b36","type":"heading","level":2,"runs":[{"t":"Seguridad del formulario"}]},{"id":"b37","type":"list","ordered":false,"items":[[{"t":"Campos sensibles cifrados con AES-256-CBC (IV aleatorio) y "},{"t":"Hash","c":true},{"t":" SHA-256 que incluye la IP del contribuyente: por eso "},{"t":"TRUST_PROXY","c":true},{"t":" debe estar bien configurado."}],[{"t":"El contribuyente no puede cambiar el monto: lo fija el servidor."}],[{"t":"Nunca se registran en logs el GUID, la frase ni la clave secreta."}]]},{"id":"b38","type":"heading","level":2,"runs":[{"t":"Seguridad del aviso del banco"}]},{"id":"b39","type":"paragraph","runs":[{"t":"El aviso no trae firma, hash ni autenticación: cualquiera podría mandar “REALIZADA”. Por eso:"}]},{"id":"b40","type":"list","ordered":false,"items":[[{"t":"Nunca se cree el cuerpo.","b":true},{"t":" Solo se toma la referencia y se confirma consultando al banco."}],[{"t":"Si la consulta falla, la orden queda pendiente (falla cerrado)."}],[{"t":"Token por cuenta en la URL del aviso, comparado en tiempo constante; respuesta siempre 200 con el mismo cuerpo; tope de 120 pedidos por minuto por IP."}],[{"t":"Transiciones idempotentes: avisos repetidos o simultáneos confirman una sola vez."}],[{"t":"Si el módulo falla al confirmar, el cobro no se pierde: la orden queda pagada con "},{"t":"requiere_revision","c":true},{"t":" para resolverla a mano."}]]},{"id":"b41","type":"heading","level":2,"runs":[{"t":"Estados del banco"}]},{"id":"b42","type":"table","header":true,"rows":[["Id","Estado"],["1","CREADA"],["2","EN_PAGO"],["3","REALIZADA"],["4","RECHAZADA"],["5 / 6","ERROR_HASH"],["7","EXPIRADA"],["8","CANCELADA"],["9","DEVUELTA"],["10","PENDIENTE"],["11","VENCIDA"]]},{"id":"b43","type":"heading","level":2,"runs":[{"t":"Pago de varias solicitudes en una orden"}]},{"id":"b44","type":"paragraph","runs":[{"t":"Las solicitudes aprobadas de una persona se pagan juntas con una sola orden (entre 1 y 50). Si alguna no es válida no se crea ninguna orden. Al confirmar, cada solicitud se procesa en su propio savepoint y sale "},{"t":"un solo mail","b":true},{"t":" con todos los certificados."}]},{"id":"b45","type":"heading","level":2,"runs":[{"t":"Conciliación diaria"}]},{"id":"b46","type":"paragraph","runs":[{"t":"npm run pagos:conciliar","c":true},{"t":", una vez por día desde el cron del servidor. Recorre las órdenes sin resolver y le pregunta al banco:"}]},{"id":"b47","type":"list","ordered":false,"items":[[{"t":"REALIZADA con monto exacto → se confirma (rescata avisos perdidos)."}],[{"t":"RECHAZADA, EXPIRADA, CANCELADA o VENCIDA → orden rechazada. En curso → no se toca."}],[{"t":"Desconocida por el banco y con más de 7 días → vencida. Las de menos de 15 minutos ni se consultan."}],[{"t":"Los pagos que llegan tarde se detectan: las órdenes cerradas de los últimos 30 días se vuelven a mirar."}],[{"t":"Si el banco no responde no cambia nada y sale con código 1 para que el cron avise."}]]},{"id":"b48","type":"callout","tone":"info","runs":[{"t":"Las credenciales de cada cuenta viven en el "},{"t":".env","c":true},{"t":" del servidor ("},{"t":"PAGOS_<CUENTA>_*","c":true},{"t":"). Nunca van a esta Wiki: solo se referencia el nombre del item en Vaultwarden."}]}]$j$::jsonb, $m$Los cobros se hacen con **Click de Pago (MacroClick)**. El driver está aislado en un solo archivo y se instancia **por cuenta** (hoy FITOSANITARIO y FORESTAL); cada módulo declara qué cuenta usa.

> **Importante:** Estado real: el formulario de pago funciona, pero el banco todavía devuelve 403 en la consulta de transacciones. Sin esa consulta el sistema no puede confirmar pagos y los deja pendientes a propósito. **No se cobra en producción hasta que el banco la habilite.**

## Cómo se paga

1. Con la solicitud aprobada, el servidor calcula el importe y crea una orden **pendiente** con una referencia al azar `BOT-XXXXXXXXXXXX`.
2. La API devuelve un formulario firmado; el navegador lo envía por POST a la página de pago del banco (redirección completa).
3. La persona paga en el banco y vuelve a `/pagar/retorno?ref=…`. Esa página **solo muestra** el estado guardado: nunca confirma nada.
4. El banco avisa por separado a la URL de notificación. El sistema no cree en el aviso: consulta al banco y exige estado REALIZADA y monto exacto.
5. Confirmado el pago, el módulo pasa la solicitud a pagada y emite el certificado en la misma transacción.

## Seguridad del formulario

- Campos sensibles cifrados con AES-256-CBC (IV aleatorio) y `Hash` SHA-256 que incluye la IP del contribuyente: por eso `TRUST_PROXY` debe estar bien configurado.
- El contribuyente no puede cambiar el monto: lo fija el servidor.
- Nunca se registran en logs el GUID, la frase ni la clave secreta.

## Seguridad del aviso del banco

El aviso no trae firma, hash ni autenticación: cualquiera podría mandar “REALIZADA”. Por eso:

- **Nunca se cree el cuerpo.** Solo se toma la referencia y se confirma consultando al banco.
- Si la consulta falla, la orden queda pendiente (falla cerrado).
- Token por cuenta en la URL del aviso, comparado en tiempo constante; respuesta siempre 200 con el mismo cuerpo; tope de 120 pedidos por minuto por IP.
- Transiciones idempotentes: avisos repetidos o simultáneos confirman una sola vez.
- Si el módulo falla al confirmar, el cobro no se pierde: la orden queda pagada con `requiere_revision` para resolverla a mano.

## Estados del banco

| Id | Estado |
| --- | --- |
| 1 | CREADA |
| 2 | EN_PAGO |
| 3 | REALIZADA |
| 4 | RECHAZADA |
| 5 / 6 | ERROR_HASH |
| 7 | EXPIRADA |
| 8 | CANCELADA |
| 9 | DEVUELTA |
| 10 | PENDIENTE |
| 11 | VENCIDA |

## Pago de varias solicitudes en una orden

Las solicitudes aprobadas de una persona se pagan juntas con una sola orden (entre 1 y 50). Si alguna no es válida no se crea ninguna orden. Al confirmar, cada solicitud se procesa en su propio savepoint y sale **un solo mail** con todos los certificados.

## Conciliación diaria

`npm run pagos:conciliar`, una vez por día desde el cron del servidor. Recorre las órdenes sin resolver y le pregunta al banco:

- REALIZADA con monto exacto → se confirma (rescata avisos perdidos).
- RECHAZADA, EXPIRADA, CANCELADA o VENCIDA → orden rechazada. En curso → no se toca.
- Desconocida por el banco y con más de 7 días → vencida. Las de menos de 15 minutos ni se consultan.
- Los pagos que llegan tarde se detectan: las órdenes cerradas de los últimos 30 días se vuelven a mirar.
- Si el banco no responde no cambia nada y sale con código 1 para que el cron avise.

> **Nota:** Las credenciales de cada cuenta viven en el `.env` del servidor (`PAGOS_<CUENTA>_*`). Nunca van a esta Wiki: solo se referencia el nombre del item en Vaultwarden.$m$);
SELECT pg_temp.crear_pagina('panel-recaudaciones', 'indice', 'Panel de Recaudaciones', $j$[{"id":"b49","type":"paragraph","runs":[{"t":"Es la herramienta de Contaduría y Recaudaciones. Entra con el usuario de Ecodatos. Hoy es de "},{"t":"consulta y de tarifas","b":true},{"t":": la conciliación y los reportes siguen por definir."}]},{"id":"b50","type":"heading","level":2,"runs":[{"t":"Pantallas"}]},{"id":"b51","type":"table","header":true,"rows":[["Pantalla","Qué muestra"],["Resumen","Indicadores, recaudación por día y por mes, por trámite y últimos pagos. Períodos: hoy, 7 días, 30 días, año."],["Pagos y órdenes","Filtros, búsqueda, paginado y exportación a CSV. Los lotes figuran como “Lote de N”."],["Trámites y tarifas","Valor vigente de cada trámite y cambio de valor con fecha de vigencia."],["Auditoría","Quién cambió qué y cuándo."]]},{"id":"b52","type":"heading","level":2,"runs":[{"t":"Tarifas"}]},{"id":"b53","type":"list","ordered":false,"items":[[{"t":"Cada cambio de monto tiene fecha de inicio; los valores anteriores se conservan."}],[{"t":"La orden de pago guarda el monto y la versión de tarifa con que se creó: un cambio no altera órdenes ya generadas."}],[{"t":"Todo cambio queda auditado con el mail de quien lo hizo; si ya hay una tarifa para esa fecha, la API responde 409."}],[{"t":"Lo que "},{"t":"no","b":true},{"t":" se edita desde el panel: el tipo de requisito y los resolvers (son código y cambian con una migración)."}]]},{"id":"b54","type":"heading","level":2,"runs":[{"t":"Estadísticas dentro de Ecodatos"}]},{"id":"b55","type":"paragraph","runs":[{"t":"La función "},{"t":"public.recaudacion_estadisticas(p_desde, p_hasta)","c":true},{"t":" (migración 0016) devuelve totales, por trámite y por día, solo en agregados y solo para administradores y el área Recaudaciones. La pantalla en Ecodatos que la use queda para después."}]},{"id":"b56","type":"heading","level":2,"runs":[{"t":"Pendiente de definir con Recaudaciones"}]},{"id":"b57","type":"list","ordered":false,"items":[[{"t":"Formato de los reportes (Excel/CSV y PDF, por ejemplo el diario para Tesorería)."}],[{"t":"Cómo concilian hoy y qué indicadores quieren ver primero."}],[{"t":"Si hace falta aprobación de un segundo usuario para cambiar un monto."}]]}]$j$::jsonb, $m$Es la herramienta de Contaduría y Recaudaciones. Entra con el usuario de Ecodatos. Hoy es de **consulta y de tarifas**: la conciliación y los reportes siguen por definir.

## Pantallas

| Pantalla | Qué muestra |
| --- | --- |
| Resumen | Indicadores, recaudación por día y por mes, por trámite y últimos pagos. Períodos: hoy, 7 días, 30 días, año. |
| Pagos y órdenes | Filtros, búsqueda, paginado y exportación a CSV. Los lotes figuran como “Lote de N”. |
| Trámites y tarifas | Valor vigente de cada trámite y cambio de valor con fecha de vigencia. |
| Auditoría | Quién cambió qué y cuándo. |

## Tarifas

- Cada cambio de monto tiene fecha de inicio; los valores anteriores se conservan.
- La orden de pago guarda el monto y la versión de tarifa con que se creó: un cambio no altera órdenes ya generadas.
- Todo cambio queda auditado con el mail de quien lo hizo; si ya hay una tarifa para esa fecha, la API responde 409.
- Lo que **no** se edita desde el panel: el tipo de requisito y los resolvers (son código y cambian con una migración).

## Estadísticas dentro de Ecodatos

La función `public.recaudacion_estadisticas(p_desde, p_hasta)` (migración 0016) devuelve totales, por trámite y por día, solo en agregados y solo para administradores y el área Recaudaciones. La pantalla en Ecodatos que la use queda para después.

## Pendiente de definir con Recaudaciones

- Formato de los reportes (Excel/CSV y PDF, por ejemplo el diario para Tesorería).
- Cómo concilian hoy y qué indicadores quieren ver primero.
- Si hace falta aprobación de un segundo usuario para cambiar un monto.$m$);
SELECT pg_temp.crear_pagina('accesos-y-roles', 'indice', 'Accesos y roles', $j$[{"id":"b58","type":"paragraph","runs":[{"t":"Todos los paneles usan "},{"t":"el login de Ecodatos","b":true},{"t":" (Supabase Auth). La API valida cada token contra Supabase y arma los permisos con las tablas de Ecodatos. Los contribuyentes no pasan por acá."}]},{"id":"b59","type":"heading","level":2,"runs":[{"t":"Quién entra a qué"}]},{"id":"b60","type":"table","header":true,"rows":[["Panel","Entran"],["Paneles de área","Técnicos con permiso sobre el formulario del trámite en Ecodatos (hoy 6 personas en fitosanitarios)."],["Recaudaciones","Admin y superadmin de Ecodatos, y quienes pertenecen al área `recaudaciones`."],["Administración del sistema","Solo admin y superadmin de Ecodatos."]]},{"id":"b61","type":"heading","level":2,"runs":[{"t":"Roles previstos en Recaudaciones"}]},{"id":"b62","type":"table","header":true,"rows":[["Rol","Puede"],["Administrador","Todo, incluida la gestión de usuarios."],["Recaudaciones (editor)","Ver todo, reportar y editar tarifas."],["Responsable de área","Ver y editar los trámites de su área."],["Consulta","Solo lectura y reportes."]]},{"id":"b63","type":"callout","tone":"ok","runs":[{"t":"El área "},{"t":"recaudaciones","c":true},{"t":" con "},{"t":"es_editor = false","c":true},{"t":" ve todo pero "},{"t":"no puede cambiar tarifas","b":true},{"t":" (la API responde 403 y la pantalla oculta “Cambiar valor”). Así el ministro y los altos mandos entran sin ser administradores de todo Ecodatos."}]},{"id":"b64","type":"heading","level":2,"runs":[{"t":"Una sola sesión"}]},{"id":"b65","type":"paragraph","runs":[{"t":"Los tres paneles comparten una única sesión (paquete "},{"t":"@botonera/sesion","c":true},{"t":"): se entra una vez para todos."}]},{"id":"b66","type":"heading","level":2,"runs":[{"t":"Login central (futuro)"}]},{"id":"b67","type":"paragraph","runs":[{"t":"La visión es un dominio "},{"t":"sistema.ecologia.misiones.gob.ar","c":true},{"t":" con un solo login para todos los empleados, validado contra Personal, que emita un JWT firmado. El sistema ya está preparado: solo cambian dos puntos, "},{"t":"packages/sesion/src/index.ts","c":true},{"t":" (front) y "},{"t":"apps/api/src/core/auth-ecodatos.ts","c":true},{"t":" (API)."}]},{"id":"b68","type":"paragraph","runs":[{"t":"Decisiones abiertas: cómo se verifica la contraseña contra Personal, segundo factor para administradores y Recaudaciones, dónde viven los permisos por sistema, y qué identificador de persona se usa."}]}]$j$::jsonb, $m$Todos los paneles usan **el login de Ecodatos** (Supabase Auth). La API valida cada token contra Supabase y arma los permisos con las tablas de Ecodatos. Los contribuyentes no pasan por acá.

## Quién entra a qué

| Panel | Entran |
| --- | --- |
| Paneles de área | Técnicos con permiso sobre el formulario del trámite en Ecodatos (hoy 6 personas en fitosanitarios). |
| Recaudaciones | Admin y superadmin de Ecodatos, y quienes pertenecen al área `recaudaciones`. |
| Administración del sistema | Solo admin y superadmin de Ecodatos. |

## Roles previstos en Recaudaciones

| Rol | Puede |
| --- | --- |
| Administrador | Todo, incluida la gestión de usuarios. |
| Recaudaciones (editor) | Ver todo, reportar y editar tarifas. |
| Responsable de área | Ver y editar los trámites de su área. |
| Consulta | Solo lectura y reportes. |

> **Listo:** El área `recaudaciones` con `es_editor = false` ve todo pero **no puede cambiar tarifas** (la API responde 403 y la pantalla oculta “Cambiar valor”). Así el ministro y los altos mandos entran sin ser administradores de todo Ecodatos.

## Una sola sesión

Los tres paneles comparten una única sesión (paquete `@botonera/sesion`): se entra una vez para todos.

## Login central (futuro)

La visión es un dominio `sistema.ecologia.misiones.gob.ar` con un solo login para todos los empleados, validado contra Personal, que emita un JWT firmado. El sistema ya está preparado: solo cambian dos puntos, `packages/sesion/src/index.ts` (front) y `apps/api/src/core/auth-ecodatos.ts` (API).

Decisiones abiertas: cómo se verifica la contraseña contra Personal, segundo factor para administradores y Recaudaciones, dónde viven los permisos por sistema, y qué identificador de persona se usa.$m$);
SELECT pg_temp.crear_pagina('despliegue-operacion', 'indice', 'Despliegue y operación', $j$[{"id":"b69","type":"heading","level":2,"runs":[{"t":"Despliegue"}]},{"id":"b70","type":"paragraph","runs":[{"t":"Docker, en la VM de Ecodatos. Dos contenedores ("},{"t":"api","c":true},{"t":" y "},{"t":"web","c":true},{"t":", este último con nginx y los cuatro fronts) que "},{"t":"no publican puertos","b":true},{"t":": el nginx de Ecodatos los alcanza por la red "},{"t":"supabase","c":true},{"t":"."}]},{"id":"b71","type":"list","ordered":true,"items":[[{"t":"Clonar el repo y crear "},{"t":".env","c":true},{"t":" a partir de "},{"t":".env.ecodatos.example","c":true},{"t":"."}],[{"t":"Verificar migraciones: "},{"t":"select count(*) from pagos._migraciones;","c":true},{"t":" debe dar 18 (sin las 18 la API no arranca)."}],[{"t":"docker compose up -d --build","c":true},{"t":"."}],[{"t":"Pegar "},{"t":"docker/ecodatos-nginx-pagos.conf","c":true},{"t":" en el nginx de Ecodatos (junto a wiki y claves) y recargar."}],[{"t":"Verificar "},{"t":"/pagos/api/health","c":true},{"t":", "},{"t":"/pagos/publico/","c":true},{"t":" y entrar a cada panel con usuarios reales."}]]},{"id":"b72","type":"heading","level":2,"runs":[{"t":"Cron diario"}]},{"id":"b73","type":"code","text":"docker compose exec -T api npm run fitosanitarios:tareas\ndocker compose exec -T api npm run consultores:tareas\ndocker compose exec -T api npm run reservas:tareas\ndocker compose exec -T api npm run pagos:conciliar   # con la pasarela real"},{"id":"b74","type":"heading","level":2,"runs":[{"t":"Para cobrar de verdad"}]},{"id":"b75","type":"list","ordered":true,"items":[[{"t":"Que el banco habilite la consulta de transacciones."}],[{"t":"En el "},{"t":".env","c":true},{"t":": "},{"t":"PAYMENT_PROVIDER=macroclick","c":true},{"t":", los datos de cada cuenta, un "},{"t":"WEBHOOK_TOKEN","c":true},{"t":" distinto por cuenta y la cuenta de cada módulo."}],[{"t":"Cargar en el panel del banco la URL de aviso de cada cuenta."}],[{"t":"Poner la conciliación en el cron."}],[{"t":"Migración 0018 aplicada."}]]},{"id":"b76","type":"callout","tone":"info","runs":[{"t":"En producción con macroclick la API "},{"t":"no arranca","b":true},{"t":" si a un módulo le falta algún dato de su cuenta de pago."}]},{"id":"b77","type":"heading","level":2,"runs":[{"t":"TRUST_PROXY"}]},{"id":"b78","type":"paragraph","runs":[{"t":"La cadena es HAProxy → nginx de Ecodatos → nginx de pagos → API. Medido el 16/11/2026: el gateway (10.0.0.20) no pasa la IP real del cliente, así que quedó en "},{"t":"TRUST_PROXY=2","c":true},{"t":" (no falsificable, aunque todos figuran con la IP del gateway). Cuando el gateway agregue "},{"t":"X-Forwarded-For","c":true},{"t":" (HAProxy: "},{"t":"option forwardfor","c":true},{"t":"), subir a "},{"t":"3","c":true},{"t":" y volver a medir en "},{"t":"Estado del sistema","b":true},{"t":"."}]},{"id":"b79","type":"paragraph","runs":[{"t":"Importa porque la IP entra en el hash del pago y en los topes por IP."}]},{"id":"b80","type":"heading","level":2,"runs":[{"t":"Modo prueba"}]},{"id":"b81","type":"paragraph","runs":[{"t":"docker-compose.prueba.yml","c":true},{"t":" activa pasarela simulada, emisión simulada, mails a la bandeja y botón de pago simulado. "},{"t":"Limpiar los datos de prueba antes de pasar a producción.","b":true}]},{"id":"b82","type":"heading","level":2,"runs":[{"t":"Estado del sistema"}]},{"id":"b83","type":"paragraph","runs":[{"t":"La pantalla Estado (Administración) muestra migraciones aplicadas, "},{"t":"TRUST_PROXY","c":true},{"t":", y alertas: conciliación que no corrió en 36 horas, última conciliación sin poder consultar al banco y cobros con "},{"t":"requiere_revision","c":true},{"t":" para resolver a mano."}]}]$j$::jsonb, $m$## Despliegue

Docker, en la VM de Ecodatos. Dos contenedores (`api` y `web`, este último con nginx y los cuatro fronts) que **no publican puertos**: el nginx de Ecodatos los alcanza por la red `supabase`.

1. Clonar el repo y crear `.env` a partir de `.env.ecodatos.example`.
2. Verificar migraciones: `select count(*) from pagos._migraciones;` debe dar 18 (sin las 18 la API no arranca).
3. `docker compose up -d --build`.
4. Pegar `docker/ecodatos-nginx-pagos.conf` en el nginx de Ecodatos (junto a wiki y claves) y recargar.
5. Verificar `/pagos/api/health`, `/pagos/publico/` y entrar a cada panel con usuarios reales.

## Cron diario

```
docker compose exec -T api npm run fitosanitarios:tareas
docker compose exec -T api npm run consultores:tareas
docker compose exec -T api npm run reservas:tareas
docker compose exec -T api npm run pagos:conciliar   # con la pasarela real
```

## Para cobrar de verdad

1. Que el banco habilite la consulta de transacciones.
2. En el `.env`: `PAYMENT_PROVIDER=macroclick`, los datos de cada cuenta, un `WEBHOOK_TOKEN` distinto por cuenta y la cuenta de cada módulo.
3. Cargar en el panel del banco la URL de aviso de cada cuenta.
4. Poner la conciliación en el cron.
5. Migración 0018 aplicada.

> **Nota:** En producción con macroclick la API **no arranca** si a un módulo le falta algún dato de su cuenta de pago.

## TRUST_PROXY

La cadena es HAProxy → nginx de Ecodatos → nginx de pagos → API. Medido el 16/11/2026: el gateway (10.0.0.20) no pasa la IP real del cliente, así que quedó en `TRUST_PROXY=2` (no falsificable, aunque todos figuran con la IP del gateway). Cuando el gateway agregue `X-Forwarded-For` (HAProxy: `option forwardfor`), subir a `3` y volver a medir en **Estado del sistema**.

Importa porque la IP entra en el hash del pago y en los topes por IP.

## Modo prueba

`docker-compose.prueba.yml` activa pasarela simulada, emisión simulada, mails a la bandeja y botón de pago simulado. **Limpiar los datos de prueba antes de pasar a producción.**

## Estado del sistema

La pantalla Estado (Administración) muestra migraciones aplicadas, `TRUST_PROXY`, y alertas: conciliación que no corrió en 36 horas, última conciliación sin poder consultar al banco y cobros con `requiere_revision` para resolver a mano.$m$);
SELECT pg_temp.crear_pagina('pendientes', 'indice', 'Estado y pendientes', $j$[{"id":"b84","type":"paragraph","runs":[{"t":"Estado al 16/11/2026. Foco actual: solo el sistema central; consultores y reservas, aparte."}]},{"id":"b85","type":"heading","level":2,"runs":[{"t":"Bloquea el cobro real"}]},{"id":"b86","type":"list","ordered":true,"items":[[{"t":"Respuesta del banco:","b":true},{"t":" habilitar la consulta de transacciones (hoy 403) en las cuentas, confirmar “Botón integrado”, lista blanca de IP y autenticación de avisos. Pedido enviado el 14/11 por la mesa de ayuda."}],[{"t":"Dar de alta la URL de notificación de cada cuenta y generar los tokens en el servidor."}],[{"t":"Dominio definitivo, cron, URLs de aviso y Docker para el despliegue final."}]]},{"id":"b87","type":"heading","level":2,"runs":[{"t":"Operación"}]},{"id":"b88","type":"list","ordered":false,"items":[[{"t":"Gateway 10.0.0.20: que agregue "},{"t":"X-Forwarded-For","c":true},{"t":", luego "},{"t":"TRUST_PROXY=3","c":true},{"t":" y volver a medir."}],[{"t":"Asignar cuenta de pago a consultores y reservas, y probar su recorrido con el sandbox."}],[{"t":"Probar todas las pantallas en el navegador con el login real de Ecodatos."}],[{"t":"Filtro por IP de origen del aviso (opcional; dos de las diez IP del manual parecen mal escritas)."}]]},{"id":"b89","type":"heading","level":2,"runs":[{"t":"Con las áreas"}]},{"id":"b90","type":"list","ordered":false,"items":[[{"t":"Confirmar tipos de certificado, requisitos, tasas y plazos (hoy provisorios)."}],[{"t":"Proceso real de Reservas privadas."}],[{"t":"Formato de reportes y conciliación con Recaudaciones."}],[{"t":"Acordar CAPTCHA y límites antes de exponer la búsqueda pública."}]]},{"id":"b91","type":"heading","level":2,"runs":[{"t":"Ideas sin hacer"}]},{"id":"b92","type":"list","ordered":false,"items":[[{"t":"Pantalla de estadísticas dentro de Ecodatos."}],[{"t":"Sesiones y enlaces activos, y reintento de avisos fallidos."}],[{"t":"Vista de la configuración de cada trámite."}],[{"t":"Módulos simples generados desde configuración."}]]}]$j$::jsonb, $m$Estado al 16/11/2026. Foco actual: solo el sistema central; consultores y reservas, aparte.

## Bloquea el cobro real

1. **Respuesta del banco:** habilitar la consulta de transacciones (hoy 403) en las cuentas, confirmar “Botón integrado”, lista blanca de IP y autenticación de avisos. Pedido enviado el 14/11 por la mesa de ayuda.
2. Dar de alta la URL de notificación de cada cuenta y generar los tokens en el servidor.
3. Dominio definitivo, cron, URLs de aviso y Docker para el despliegue final.

## Operación

- Gateway 10.0.0.20: que agregue `X-Forwarded-For`, luego `TRUST_PROXY=3` y volver a medir.
- Asignar cuenta de pago a consultores y reservas, y probar su recorrido con el sandbox.
- Probar todas las pantallas en el navegador con el login real de Ecodatos.
- Filtro por IP de origen del aviso (opcional; dos de las diez IP del manual parecen mal escritas).

## Con las áreas

- Confirmar tipos de certificado, requisitos, tasas y plazos (hoy provisorios).
- Proceso real de Reservas privadas.
- Formato de reportes y conciliación con Recaudaciones.
- Acordar CAPTCHA y límites antes de exponer la búsqueda pública.

## Ideas sin hacer

- Pantalla de estadísticas dentro de Ecodatos.
- Sesiones y enlaces activos, y reintento de avisos fallidos.
- Vista de la configuración de cada trámite.
- Módulos simples generados desde configuración.$m$);

COMMIT;

-- Verificación:
SELECT sec.slug, sec.titulo, (SELECT count(*) FROM pages p WHERE p.section_id = sec.id) AS paginas
FROM sections sec JOIN spaces s ON s.id = sec.space_id AND s.slug = 'ordenamiento-territorial'
WHERE sec.slug = 'recaudaciones' OR sec.padre_id = (SELECT id FROM sections WHERE slug = 'recaudaciones' AND space_id = s.id)
ORDER BY sec.padre_id NULLS FIRST, sec.orden;
