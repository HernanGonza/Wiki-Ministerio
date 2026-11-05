# Vaultwarden: convención de nombres

Vaultwarden está desplegado aparte, en la misma VM. La Wiki **no** guarda secretos: en *Administración → Credenciales
(referencias)* solo se registra qué item buscar. Nada de lo que figure acá ni en la Wiki debe incluir contraseñas, claves
privadas, tokens ni códigos de recuperación.

## Colecciones

Una colección por espacio, con el prefijo `MERNR`:

| Espacio | Colección |
|---|---|
| Ordenamiento Territorial | `MERNR - OT` |
| Otros espacios | `MERNR - <SIGLA DEL ESPACIO>` |
| Accesos compartidos por todo el Ministerio | `MERNR - Ministerio` |

Los miembros de cada colección deberían coincidir con quienes tienen rol `admin_espacio` en ese espacio de la Wiki
(o con un subconjunto). El rol en la Wiki **no** otorga acceso a Vaultwarden: se gestiona allí.

## Nombre de los items

```
<ESPACIO> / <sistema o host> / <usuario o rol>
```

- `<ESPACIO>`: sigla en mayúsculas (`OT`).
- `<sistema o host>`: nombre del sistema o del servidor, en minúsculas y con guiones, igual al de la Wiki cuando exista (`srv-oracle01`, `ecodatos`).
- `<usuario o rol>`: cuenta a la que corresponde el item (`root`, `postgres`, `admin-web`).

Ejemplos: `OT / srv-oracle01 / root`, `OT / ecodatos / postgres`, `OT / pfsense / admin-web`.

## Cómo se cargan en la Wiki

| Campo de la Wiki | Qué poner | Ejemplo |
|---|---|---|
| Título | Descripción corta, legible | Acceso SSH al servidor Oracle Linux |
| Usuario de referencia | Cuenta, sin contraseña | `root@srv-oracle01` |
| Nombre del item en Vaultwarden | Exactamente el nombre del item (para buscarlo) | `OT / srv-oracle01 / root` |
| Colección | Colección donde está | `MERNR - OT` |
| Sistema | Sistema de la Wiki asociado, si corresponde | Ecodatos |
| Notas | Contexto operativo **sin secretos** | "Solo desde la red interna; rotar cada 90 días" |

## Buenas prácticas

- Un item por cuenta; no reutilizar el mismo item para varios servidores.
- Si cambia el nombre de un item en Vaultwarden, actualizar la referencia en la Wiki.
- Ante la duda sobre si un dato es un secreto: no va en la Wiki.
