# Diccionario de datos (fase 1b)

Base de datos local: `dashboard-rendimiento` (IndexedDB), esquema versión 1. Las tablas de jugadores, catálogo, sesiones, repeticiones, importaciones, etc. se añadirán en fases posteriores como nuevas versiones del esquema; no se anticipan aquí.

## Tablas

| Tabla | Clave | Va en la copia | Contenido |
|---|---|---|---|
| `settings` | `key` | Sí | Ajustes definidos por el usuario |
| `auditLog` | `id` (autonumérica); índices `timestamp`, `action` | Sí | Registro de acciones, sin valores de datos |
| `meta` | `key` | Sí | Metadatos de la base |
| `local` | `key` | **No** | Estado propio de este navegador |

### `settings`

| Campo | Descripción |
|---|---|
| `key` | Nombre del ajuste |
| `value` | Valor |
| `definedByUser` | Siempre `true`: un ajuste solo existe si el usuario lo ha definido |
| `updatedAt` | Fecha ISO de la última modificación |

Ajustes conocidos: `backupReminderDays` (entero 1–365; plazo máximo en días desde la última copia antes de mostrar un aviso; sin valor por defecto).

### `auditLog`

| Campo | Descripción |
|---|---|
| `id` | Identificador autonumérico |
| `timestamp` | Fecha ISO de la acción |
| `action` | Tipo de acción |
| `scope` | Objeto con el alcance y recuentos; nunca valores eliminados |
| `reason` | Motivo (opcional) |

Acciones registradas en esta fase: `base-creada`, `ajuste-modificado`, `ajuste-eliminado`, `copia-creada`, `copia-restaurada`, `carpeta-de-copias-elegida`.

Tras restaurar una copia, el registro vuelve al estado de esa copia (se pierden las entradas posteriores a ella) y se añade `copia-restaurada`.

### `meta`

Claves: `createdAt` (fecha ISO de creación de la base).

### `local` (no va en la copia)

| Clave | Contenido |
|---|---|
| `lastBackup` | Fecha, nombre, tamaño, destino y opciones de la última copia creada en este navegador |
| `persistence` | Resultado de la última solicitud de almacenamiento persistente |
| `dirHandle` | Referencia a la carpeta de copias recordada |

Se excluye de la copia porque describe este navegador, no los datos: restaurar una copia no debe alterar cuándo se hizo la última copia ni qué carpeta se recuerda.

## Formato de la copia completa

Fichero JSON, con compresión gzip y cifrado opcionales.

| Campo | Descripción |
|---|---|
| `formatId` | `dashboard-rendimiento-backup` |
| `formatVersion` | Versión del formato (actualmente 1) |
| `schemaVersion` | Versión del esquema de la base que la generó |
| `appVersion` | Versión de la aplicación |
| `createdAt` | Fecha ISO de creación |
| `counts` | Registros por tabla |
| `checksum` | SHA-256 del contenido de las tablas en forma canónica (claves ordenadas) |
| `tables` | Contenido de cada tabla que va en la copia |

Si se comprime o se cifra, el fichero es un sobre (`dashboard-rendimiento-backup-envelope`) con `compression`, `encrypted` y `payload`; cuando está cifrado incluye `kdf` (PBKDF2-SHA-256, 600.000 iteraciones), `cipher` (AES-GCM de 256 bits), `salt` e `iv`.

Reglas de restauración: se rechaza una copia de un esquema posterior al de la aplicación, con tablas desconocidas, con recuentos que no coincidan o con suma de verificación distinta. Una copia de un esquema anterior se acepta con un aviso por cada tabla ausente, que quedará vacía. La restauración sustituye todos los datos en una sola transacción y la verifica dentro de ella; si algo falla, se revierte.

## Pendiente de definir por el usuario

Catálogo de tests, variables, unidades y fórmulas relativas; posiciones y grupos; zonas y técnicas de perímetros; contenido de NME; ventana antropométrica; umbral mínimo de muestra.
