# Wiki MERNR

Base de conocimiento del Ministerio de Ecología y Recursos Naturales Renovables de Misiones.
Plataforma **multi-espacio**: cada área del Ministerio tiene su espacio, con secciones, páginas,
anuncios, estado de sistemas y referencias a credenciales. El primer espacio es *Ordenamiento Territorial*.

- **Base de datos:** PostgreSQL 16 (contenedor propio, red `wiki_net`, volumen `wiki_db`). Sin Supabase.
- **API:** Node.js 20 + Express + `pg`, SQL explícito, migraciones numeradas.
- **Web:** React 18 + Vite + TypeScript, servida por nginx (que además hace proxy de `/api`).
- **Credenciales de sistemas:** viven en Vaultwarden. La Wiki guarda solo el *nombre del item*.

```
db/migrations   esquema (001, 002 bloques y archivos)         api/src   servidor, auth, rutas, monitor
db/seed         datos iniciales (una vez c/u)  web/src   interfaz
tests/          pruebas de integración (no van en la imagen)
vaultwarden/    convención de nombres de items
```

## Desarrollo local (sin Docker)

`npm run dev` en la raíz: instala dependencias, crea `.env` con valores de desarrollo (la clave inicial del admin
queda en `ADMIN_PASSWORD_INICIAL` y se cambia en el primer ingreso), levanta PostgreSQL 16 embebido (puerto 54329,
datos en `.dev/`), aplica migraciones y seeds, y arranca la API y la web (http://127.0.0.1:5173).
`npm run dev:reset` borra la base de desarrollo y los archivos subidos. `npm test` corre las pruebas de la API.

**Interfaz:** Tailwind v4 con tokens de la marca (Brandbook 2024), modo oscuro, Motion, cmdk (Ctrl+K), SweetAlert2
para alertas y confirmaciones, sidebar colapsable (Ctrl+B). Tipografía Oak Sans (licencia OFL, en `web/public/fonts`).

## Requisitos

- VM con Docker y Docker Compose v2.
- Puerto **8090** libre en la VM (verificar antes: `ss -ltn | grep ':8090'`). Los puertos 80, 3000, 3001, 3002,
  4001, 5432, 6543, 8000, 8443, 4222, 4443 y 8222 figuran como ocupados; la Wiki no publica ninguno de ellos
  (db y api no exponen puertos al host).

## Despliegue

```bash
cp .env.example .env
chmod 600 .env
# Completar .env (ver tabla). Generar secretos, por ejemplo:
#   openssl rand -base64 36        # POSTGRES_PASSWORD, APP_DB_PASSWORD
#   openssl rand -base64 48        # SESSION_SECRET (mínimo 32 caracteres)
docker compose up -d --build
docker compose ps                  # db, api y web deben quedar "healthy"
docker compose logs api | head     # migraciones y seeds aplicados
```

Después, abrir `http://10.0.0.231:8090`.

| Variable | Uso |
|---|---|
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | Superusuario del contenedor. Solo lo usan `migrate.js` y `seed.js`. |
| `APP_DB_USER` / `APP_DB_PASSWORD` | Usuario de la API, creado por `migrate.js` con permisos mínimos (sin superusuario; en `audit_log` solo `INSERT` y `SELECT`). Debe ser distinto de `POSTGRES_USER`. |
| `SESSION_SECRET` | Clave HMAC con la que se hashea el token de sesión (mínimo 32 caracteres). Cambiarla cierra todas las sesiones. |
| `COOKIE_SECURE` | `true` cuando se sirva por HTTPS. Con `http://IP:8090` debe ser `false`, o el navegador descarta la cookie. |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD_INICIAL` | Administrador global inicial (mínimo 12 caracteres). Se crea solo si no existe y debe cambiar la clave al primer ingreso. |
| `VAULTWARDEN_URL` | Opcional. Enlace que se muestra en las referencias de credenciales. |
| `PUBLIC_BASE_URL` | Referencia de la URL pública. |

El arranque de `api` ejecuta `migrate.js` → `seed.js` → `server.js`. Las migraciones y los seeds se registran
(`schema_migrations`, `seed_applied`) y se aplican **una sola vez**: reiniciar no duplica ni "resucita" contenido borrado.

### Primer ingreso

1. Entrar con `ADMIN_EMAIL` y `ADMIN_PASSWORD_INICIAL`.
2. La Wiki exige cambiar la contraseña (mínimo 12 caracteres).
3. Verificar que se ve el espacio *Ordenamiento Territorial*.

## Usuarios y roles por espacio

Desde **Administración → Usuarios y roles** (solo administrador global):

1. *Nuevo usuario*: correo, nombre y **contraseña temporal** (mínimo 12 caracteres). Entregarla por un medio
   seguro, fuera de la Wiki. El usuario debe cambiarla en el primer ingreso.
2. En la fila del usuario, elegir espacio y rol y pulsar *Asignar*:
   - `general`: lee el contenido general, los anuncios y el estado de sistemas del espacio.
   - `admin_espacio` (el "director" del espacio): además edita contenido, publica anuncios, gestiona sistemas y
     referencias de credenciales, y ve la auditoría de su espacio.
3. Un usuario puede tener roles distintos en espacios distintos. Sin rol en un espacio, la API responde **404**
   (no revela que exista).
4. *Desactivar* reemplaza al borrado: el usuario no puede ingresar y sus sesiones se cierran. *Restablecer clave*
   asigna otra temporal y obliga a cambiarla.

`es_admin_global` no es un rol de espacio: solo lo otorga otro administrador global (casilla al crear el usuario).

| Recurso | general | admin_espacio | admin global |
|---|---|---|---|
| Páginas/secciones `general` | leer | leer, editar | todo |
| Páginas/secciones `restringido` (y todo lo que cuelga de ellas) | — | leer, editar | todo |
| Anuncios del espacio | leer | crear, editar, publicar | todo |
| Anuncios del Ministerio y sistemas transversales | leer | leer | crear, editar, publicar |
| Sistemas del espacio | leer | crear, editar | todo |
| Referencias de credenciales | — | leer, editar | todo |
| Auditoría | — | solo su espacio | todo |
| Espacios y usuarios | — | — | todo |

Los anuncios del Ministerio (transversales) se muestran en la portada y en **todos** los espacios.

## Agregar un espacio (sin tocar código)

1. **Administración → Espacios → Nuevo espacio** (nombre y slug; el slug forma parte de la URL).
   Slugs reservados: `ministerio`, `login`, `admin`, `auditoria`, `cambiar-password`, `api`.
2. Asignar el rol `admin_espacio` al director del área (**Usuarios y roles**).
3. El director arma las secciones (hasta 3 niveles) y páginas en **Administración → *espacio* → Contenido**,
   y carga sus sistemas y anuncios.
4. Un espacio se puede desactivar; para borrarlo debe estar vacío. `ministerio` no se puede borrar ni desactivar.

## Contenido

El contenido se escribe con un **editor de bloques** (no hace falta saber Markdown). Cada página es una lista de
bloques: texto, título, subtítulo, lista, lista numerada, llamado (nota/atención/listo/importante), cita, imagen,
archivo, tabla, código, divisor y **organigrama**. Se insertan con `/` o "Agregar bloque", se reordenan arrastrando y
la vista previa se arma al lado mientras se escribe (pestañas Editar / Vista previa si no hay ancho).

- **Modelo:** el contenido canónico es `pages.contenido_json` (JSONB, lista de bloques). El servidor lo valida con un
  esquema estricto (`api/src/services/blocks.js`, zod) y deriva `contenido_md` (búsqueda/compatibilidad). El
  frontend lo dibuja con componentes React (`web/src/blocks/BlockRenderer.tsx`): no hay HTML crudo. Los enlaces solo
  pueden ser `http(s)`, `mailto:`, rutas internas o anclas. Las páginas viejas en Markdown se convierten a bloques
  al abrirlas para editar. Tiptap se usa solo por dentro, para el texto con formato de cada bloque.
- **Versiones y concurrencia:** cada guardado crea una versión (con su JSON); se puede ver y restaurar. Control
  optimista: si otra persona guardó antes, la API responde 409 y el editor lo informa sin pisar nada.
- **Restringido:** una página de una sección `restringido` es restringida aunque figure como `general`.
- **Archivos e imágenes:** se suben arrastrando, pegando o con el botón. Se guardan en el volumen del servidor
  (`FILES_DIR`, por defecto `/data/files`; en compose, volumen `wiki_files`; en desarrollo `.dev/files`), con tabla
  `files` (migración `002`). Permitidos: png, jpg, gif, webp, pdf, docx, xlsx, pptx, odt, ods, odp, txt, csv
  (**sin SVG**), validados por firma (magic bytes). Máximo 10 MB imágenes y 25 MB el resto (nginx: `client_max_body_size 26m`).
  Se sirven en `GET /api/files/:id` solo con sesión y permiso del espacio; los restringidos, solo administración.
  Siempre con `nosniff` y CSP `sandbox`; solo las imágenes se muestran inline. El acceso de un archivo se fija al
  subirlo, según el de la página. Los archivos huérfanos (subidos y luego no usados) no se limpian solos.
- **PDF en la página:** un bloque archivo PDF puede mostrarse incrustado (hojas dibujadas con pdf.js, cargado
  recién al verlo), con zoom (−/+, Ctrl+rueda), pantalla completa, abrir en pestaña y descargar.
- **Organigrama:** bloque de árbol editable (hasta 8 niveles y 500 cuadros). Se edita como esquema (Enter, Ctrl+Enter,
  Tab/Shift+Tab, menú ⋮ por cuadro: destacar, enlace, apilar hijos en columna, mover, eliminar) y se publica como
  diagrama HTML/CSS con zoom, pantalla completa y arrastre. El organigrama del PDF de mayo 2024 está cargado en
  *Gabinete y Áreas Centrales → Organigrama* (`db/seed/007_organigrama_diagrama.sql`).
- **Pendiente de este modelo:** los anuncios siguen en Markdown (la columna `announcements.cuerpo_json` ya existe,
  falta API y pantalla).

## Monitor de sistemas

La API verifica cada 60 s todos los sistemas activos (nunca el navegador):

- Con `url`: `HEAD` (si responde 405, `GET`), timeout 5 s, sin seguir redirecciones (un 3xx cuenta como `online`),
  **con verificación estricta de certificados**.
- Sin `url` pero con `ip` + `puerto`: conexión TCP, timeout 5 s.
- `< 2 s` → `online` · `2–5 s` → `lento` · error, timeout o 5xx → `offline` · 401/403 → `online`.
- Se conservan 30 días de verificaciones; un job diario borra las anteriores y las sesiones vencidas.

**Conectividad desde el contenedor `api`.** El contenedor está en la red bridge `wiki_net` (no se usa
`network_mode: host`). Para llegar a `10.0.0.x` normalmente alcanza con el enrutamiento del host, pero hay que
confirmarlo en la VM:

```bash
docker compose exec api node -e "fetch('http://10.0.0.244',{method:'HEAD'}).then(r=>console.log(r.status)).catch(e=>console.log('ERROR',e.cause?.code??e.message))"
docker compose exec api node -e "require('net').connect(80,'10.0.0.231').on('connect',()=>{console.log('TCP ok');process.exit()}).on('error',e=>{console.log('ERROR',e.code);process.exit()})"
```

Si un host no es alcanzable (reglas de firewall, o el propio `10.0.0.231` desde la bridge), figurará como `offline`
aunque funcione. Anotar acá los casos detectados:

- _(completar tras la primera verificación en la VM)_

Los dominios `*.misiones.gob.ar` deben resolverse por DNS desde el contenedor y presentar un certificado válido
para el contenedor; si usan una CA interna, el sistema figurará `offline` hasta montar esa CA en la imagen de `api`.

## Vaultwarden

Ver [`vaultwarden/README.md`](vaultwarden/README.md). Resumen: la Wiki guarda el nombre del item, la colección y un
usuario de referencia (p. ej. `root@srv-x`). **Nunca** contraseñas, claves ni tokens, ni en notas ni en páginas.

## Backup y restauración

```bash
# Respaldo (formato custom, comprimido). Guardarlo fuera de la VM.
docker compose exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > wiki_$(date +%F).dump

# Restauración sobre una base vacía (con los contenedores db y api detenidos si es una VM nueva: primero
# `docker compose up -d db`, restaurar, luego `docker compose up -d`)
docker compose exec -T db sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --no-owner' < wiki_2026-01-01.dump
```

El dump no incluye el rol `APP_DB_USER`: `migrate.js` lo vuelve a crear y a otorgar permisos en cada arranque de `api`.
Programar el respaldo (cron del host) y probar la restauración periódicamente. El `.env` se respalda aparte y por un
canal seguro.

## Pruebas

**En la máquina de desarrollo (sin Docker ni Postgres):**

```bash
cd api && npm test                 # clasificación del monitor, árbol de secciones
cd web && npm run build            # typecheck + build de Vite
```

**En la VM, con el stack levantado** (paso 7 del plan; usa solo la API pública, requiere Node ≥ 18 en la VM):

```bash
# ADMIN_NEW_PASSWORD: solo si el admin todavía no cambió la clave inicial.
# MONITOR_TEST_HOST: IP de la VM alcanzable desde el contenedor api; omitir para saltear el monitor.
BASE_URL=http://10.0.0.231:8090 \
ADMIN_EMAIL=... ADMIN_PASSWORD=... ADMIN_NEW_PASSWORD=... \
MONITOR_TEST_HOST=10.0.0.231 \
node tests/integration.mjs
```

Cubre: login correcto y fallido (respuesta genérica), rate limit (5 fallos / 15 min / IP), cambio de clave obligatorio,
usuario `general` de OT sin acceso a `accesos` ni a `credential_refs` por API directa (404/403), usuario sin rol
recibiendo 404, anuncio del director visible en su espacio, anuncio transversal visible en todos, versiones y conflicto
409, auditoría por espacio, y cambio de estado del monitor al apagar un servicio de prueba.

Efectos: crea tres usuarios de prueba (quedan **desactivados**), borra los anuncios/sistema/referencias que crea, y la
prueba de rate limit **deja bloqueada la IP de origen durante 15 minutos** (`docker compose restart api` lo libera).

## Seguridad (resumen)

- `helmet` en la API; CSP, `X-Frame-Options: DENY` y `nosniff` en nginx. Sin `unsafe-inline`: la interfaz no usa estilos ni scripts en línea.
- Contraseñas con argon2id. Sesiones con token opaco; en la base solo se guarda su HMAC-SHA256. Cookie `httpOnly`, `sameSite=lax`.
  Sesión inactiva por 12 h (se renueva con cada request). CSRF: `sameSite=lax` + `Content-Type: application/json` obligatorio al escribir.
- Rate limit de login por IP. nginx **pisa** `X-Forwarded-For`, y la API confía solo en ese salto.
- SQL siempre parametrizado; entradas validadas con `zod`; sin CORS (todo es same-origin).
- Los logs no incluyen cuerpos, cookies, tokens ni contraseñas.
- `audit_log` es de solo inserción (permisos del usuario de la app + trigger).
- La interfaz solo oculta opciones; todos los permisos se aplican en la API.

## Pendientes y supuestos a confirmar

- **Estructura del organigrama (`db/seed/006` y `007`)** leída de un PDF con líneas cruzadas: confirmar con el área qué
  Departamento va con cada Dirección, los acrónimos (C.T.M., Proc. I.S., R. y C.A.S., M.S. de Bosques Nativos) y de quién
  depende cada área (Bosques Nativos, Administración, Asuntos Jurídicos, Cómputos, Comunicación). `ministerio` es solo
  portada (no admite secciones): las áreas centrales están en el espacio `gabinete-ministerial`.
- **Sin verificar en Docker/producción:** subida y descarga de archivos tras nginx, el volumen `wiki_files`, el límite de 26 MB,
  la CSP con `'unsafe-inline'` en estilos (la necesitan SweetAlert y Motion) y el visor de PDF (worker de pdf.js).
- **Mejoras opcionales:** búsqueda de contenido en el servidor (tsvector), carga diferida de rutas (el bundle principal pesa ~870 kB),
  bloques en anuncios, limpieza de archivos huérfanos, fuentes Oak Sans en `.woff2` (hoy `.ttf`).

- **Logo y colores del Ministerio:** hoy hay una marca provisoria (`M`) y el acento verde está en `--acento` (`web/src/styles/main.css`).
- **Títulos de subsecciones de OT:** el pedido daba solo los slugs de `dg-*`, `asuntos-juridicos`, etc.; los títulos
  ("Dirección General de SIG", "Manejo del Fuego", …) se derivaron de ellos. Corregirlos en *Contenido* o en `db/seed/002_sections_ot.sql` antes del primer arranque.
- **ChartDB (testing)** se retiró del seed de sistemas, según la última versión de la especificación.
- **Validado solo parcialmente fuera de Docker:** el esquema, los seeds y la API se ejercitaron contra PGlite (Postgres en WASM) y
  el script de integración pasó completo; **no** se probaron Dockerfiles, `docker compose`, nginx, permisos del rol `APP_DB_USER`
  en un Postgres real, ni el módulo nativo de `argon2` sobre Alpine. Eso corresponde verificar en la VM.
- `ADMIN_EMAIL` y `ADMIN_PASSWORD_INICIAL` son obligatorias en el compose en cada arranque (el seed no hace nada si el admin ya existe).
