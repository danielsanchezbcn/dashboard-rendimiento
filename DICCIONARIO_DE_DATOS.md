# Diccionario de datos (fase 1c)

Base de datos local: `dashboard-rendimiento` (IndexedDB), **esquema versión 2**. Las tablas de catálogo, sesiones, repeticiones, importaciones, etc. se añadirán en fases posteriores como nuevas versiones del esquema; no se anticipan aquí. Las fechas de calendario se guardan como texto `AAAA-MM-DD` sin zona horaria.

## Tablas

| Tabla | Clave | Índices | Va en la copia | Contenido |
|---|---|---|---|---|
| `settings` | `key` | | Sí | Ajustes definidos por el usuario |
| `auditLog` | `id` (autonumérica) | `timestamp`, `action` | Sí | Registro de acciones, sin valores de datos |
| `meta` | `key` | | Sí | Metadatos de la base |
| `local` | `key` | | **No** | Estado propio de este navegador |
| `players` | `id` (autonumérica) | `jerseyName`, `synthetic` | Sí | Jugadores |
| `playerAliases` | `id` (autonumérica) | `playerId`, `source`, `normalizedKey`, `synthetic` | Sí | Alias de cada jugador por fuente |
| `positions` | `id` (autonumérica) | `name`, `order`, `synthetic` | Sí | Lista de posiciones definida por el usuario |
| `playerPositions` | `id` (autonumérica) | `playerId`, `positionId`, `validFrom`, `synthetic` | Sí | Historial de posiciones de cada jugador |
| `anthropometry` | `id` (autonumérica) | `playerId`, `date`, `synthetic` | Sí | Mediciones antropométricas fechadas |

`synthetic` vale `1` solo en los registros sintéticos de demostración; en los reales no existe el campo (los booleanos no se pueden indexar). `syntheticBatch` (sin índice) identifica el lote de carga.

### `players`

| Campo | Descripción |
|---|---|
| `id` | Identificador estable |
| `jerseyName` | Nombre en camiseta: el nombre visible en toda la aplicación (obligatorio) |
| `notes` | Notas libres |
| `active` | `true` o `false`. Un jugador no se borra: se desactiva y conserva su historial |
| `createdAt`, `updatedAt` | Fechas ISO |

### `playerAliases`

| Campo | Descripción |
|---|---|
| `playerId` | Jugador al que pertenece |
| `source` | `VALD`, `Excel` u `Otra` |
| `rawText` | Texto original tal como aparece en la fuente (no se modifica) |
| `normalizedKey` | Texto sin mayúsculas, espacios redundantes ni acentos. **Solo sirve para proponer candidatos; nunca vincula por sí solo** |
| `confirmedAt` | Fecha ISO de la confirmación |

Reglas: el mismo texto exacto de una fuente no puede estar en dos jugadores. Un texto equivalente (misma clave normalizada) en otro jugador se acepta con un aviso, y en una importación exigirá confirmación manual. Una equivalencia que cambie ñ por n, o una coincidencia con más de un jugador, exige siempre confirmación manual.

### `positions`

| Campo | Descripción |
|---|---|
| `name` | Nombre definido por el usuario (único, ignorando mayúsculas y acentos) |
| `order` | Orden configurable por el usuario (1, 2, 3…). Las posiciones nuevas se añaden al final; no hay un orden definitivo |
| `active` | `false` si está archivada |

No hay posiciones precargadas. Una posición usada en algún historial no se elimina: se archiva.

### `playerPositions`

| Campo | Descripción |
|---|---|
| `playerId`, `positionId` | Jugador y posición |
| `role` | `principal` o `secundaria` |
| `validFrom` | Primer día de vigencia (obligatorio) |
| `validTo` | Último día de vigencia; vacío si sigue vigente |

Reglas: las posiciones principales de un jugador no se solapan. «Cambiar la posición principal desde una fecha» cierra la vigente el día anterior y abre la nueva. Si no hay registro vigente en una fecha, el jugador figura **sin posición** en esa fecha. Las secundarias no se usan para agrupar ni comparar (D11); solo podrían usarse como filtro si se define expresamente. La **posición de una sesión es la principal vigente en la fecha de esa sesión**, no la actual.

### `anthropometry`

| Campo | Descripción |
|---|---|
| `playerId`, `date` | Jugador y fecha de la medición (no futura) |
| `bodyMass`, `height`, `legLength` | Cada una `{ value, unit }` o vacía. Al menos una. El valor es un número mayor que 0 y la unidad la indica el usuario (no hay unidades por defecto) |
| `source`, `notes` | Fuente y observaciones opcionales |

Cada medición es un registro; no se sustituye un valor único. Para valores relativos se usará la medición más próxima a la fecha del test **dentro de la ventana antropométrica**: si no hay ninguna dentro de la ventana, el valor relativo figura como no disponible y se explica por qué; nunca se usa «la última medición» sin límite. Si dos mediciones están a la misma distancia, la selección es ambigua.

### `settings`

| Campo | Descripción |
|---|---|
| `key` | Nombre del ajuste |
| `value` | Valor |
| `definedByUser` | Siempre `true`: un ajuste solo existe si el usuario lo ha definido |
| `updatedAt` | Fecha ISO de la última modificación |

Ajustes conocidos: `backupReminderDays` (entero de 1 a 365; plazo máximo en días desde la última copia antes de mostrar un aviso) y `anthropometryWindowDays` (entero de 0 a 3650; ventana antropométrica). Ninguno tiene valor por defecto.

### `auditLog`

| Campo | Descripción |
|---|---|
| `id`, `timestamp`, `action` | Identificador, fecha ISO y tipo de acción |
| `scope` | Objeto con identificadores y recuentos; **nunca nombres ni valores de datos eliminados** |
| `reason` | Motivo (opcional) |

Acciones: `base-creada`, `ajuste-modificado`, `ajuste-eliminado`, `copia-creada`, `copia-restaurada`, `carpeta-de-copias-elegida`, `jugador-creado`, `jugador-modificado`, `jugador-activado`, `jugador-desactivado`, `alias-anadido`, `alias-eliminado`, `posicion-creada`, `posicion-renombrada`, `posicion-activada`, `posicion-archivada`, `posicion-reordenada`, `posicion-eliminada`, `posicion-jugador-asignada`, `posicion-jugador-modificada`, `posicion-jugador-eliminada`, `antropometria-anadida`, `antropometria-modificada`, `antropometria-eliminada`, `datos-sinteticos-cargados`, `datos-sinteticos-eliminados`.

Tras restaurar una copia, el registro vuelve al estado de esa copia (se pierden las entradas posteriores a ella) y se añade `copia-restaurada`.

### `meta`

Claves: `createdAt` (fecha ISO de creación de la base).

### `local` (no va en la copia)

| Clave | Contenido |
|---|---|
| `lastBackup` | Fecha, nombre, tamaño, destino y opciones de la última copia creada en este navegador |
| `persistence` | Resultado de la última solicitud de almacenamiento persistente |
| `dirHandle` | Referencia a la carpeta de copias recordada |

Se excluye de la copia porque describe este navegador, no los datos.

## Formato de la copia completa

Fichero JSON, con compresión gzip y cifrado opcionales.

| Campo | Descripción |
|---|---|
| `formatId` | `dashboard-rendimiento-backup` |
| `formatVersion` | Versión del formato (actualmente 1) |
| `schemaVersion` | Versión del esquema de la base que la generó (1 o 2) |
| `appVersion` | Versión de la aplicación |
| `createdAt` | Fecha ISO de creación |
| `counts` | Registros por tabla |
| `checksum` | SHA-256 del contenido de las tablas en forma canónica (claves ordenadas) |
| `tables` | Contenido de cada tabla que va en la copia |

Si se comprime o se cifra, el fichero es un sobre (`dashboard-rendimiento-backup-envelope`) con `compression`, `encrypted` y `payload`; cuando está cifrado incluye `kdf` (PBKDF2-SHA-256, 600.000 iteraciones), `cipher` (AES-GCM de 256 bits), `salt` e `iv`.

Reglas de restauración: se rechaza una copia de un esquema posterior al de la aplicación, con tablas desconocidas, con recuentos que no coincidan o con suma de verificación distinta. **Una copia del esquema 1 se acepta en la versión actual con un aviso por cada tabla ausente, que quedará vacía.** La restauración sustituye todos los datos en una sola transacción y la verifica dentro de ella; si algo falla, se revierte.

## Formato observado: exportación de VALD ForceDecks, Run-Specific Ankle Iso-Push (RSAIP)

Descrito a partir de un fichero de ejemplo aportado el 6 de noviembre de 2026 (128 filas, 47 jugadores, del 23/02/2023 al 27/10/2026). Los nombres y valores del fichero **no se copian** a la documentación ni a los datos sintéticos. Todo lo que sigue se ha comprobado en ese único fichero; otros tests o versiones de VALD pueden diferir.

**Codificación y forma:** UTF-8 con marca BOM, todas las celdas entrecomilladas, 21 columnas, una fila por sesión y orden de la más reciente a la más antigua. Fechas `dd/mm/aaaa`, horas en formato de 12 horas con AM/PM, decimales con punto. Tres cabeceras llevan un espacio final («Peak Vertical Force [N] », «Force at 100ms [N] », «RFD - 100ms [N/s] »): el importador debe recortar las cabeceras. `ExternalId` está vacío en todas las filas (el jugador se identifica solo por el nombre, con la resolución de la fase 1c).

**Columnas:** `Name`, `ExternalId`, `Test Type` (código «RSAIP»), `Date`, `Time`, `BW [KG]` (peso corporal, una cifra por test), `Reps (L)`, `Reps (R)`, `Tags` y, para cada una de las tres variables (Peak Vertical Force [N], Force at 100ms [N], RFD - 100ms [N/s]), cuatro columnas: valor de la sesión, izquierda `(L)`, derecha `(R)` y asimetría `(Asym)(%)`.

**Lo comprobado sobre los valores** (375 valores de sesión con ambos lados):

- La columna de la variable sin sufijo es la **media de todas las repeticiones de la sesión, ponderada por `Reps` de cada lado** (coincide en los 375 casos dentro del redondeo; en las 6 filas con repeticiones distintas por lado, la media simple no coincide en 17 de los 18 valores y la ponderada sí). Es exactamente la ponderación de D12a.
- Los valores vienen redondeados a enteros (y en cifras grandes, a decenas), de modo que **no hay repeticiones individuales**: la Máxima repetición no está disponible con este formato.
- La asimetría de VALD es un texto con magnitud y letra, por ejemplo «7.8 R»: la magnitud es |izquierda − derecha| ÷ máx(izquierda, derecha) × 100, redondeada a 2 cifras significativas según lo observado, y la letra es **el lado con el valor más alto** (0 discrepancias de letra en los casos sin empate). Con empate exacto la letra no es informativa («0 R», «0 L»). Coincide con la definición de dominante y con el signo decididos en D25. Como la magnitud está redondeada, se recalcula con los valores de cada lado y se conserva el texto original.

**Casos especiales observados:**

- **Un solo lado:** 3 filas con `Reps` vacío en un lado; en ellas faltan los valores y la asimetría del otro lado y la columna de la variable es la del lado presente. Esa cifra no es bilateral y no debe tratarse como tal.
- **Repeticiones distintas por lado:** 6 filas (3 contra 2 o 2 contra 3). Por eso la ponderación por `Reps` de cada lado importa.
- **Mismo jugador y día en dos filas:** 2 casos, cada uno con una segunda fila de un solo lado a los pocos minutos (D29).
- **Etiquetas:** 80 filas sin etiqueta y 48 con 15 combinaciones distintas, unidas con guion (palabras sueltas o combinaciones de dos; no se interpreta su significado). Se importan tal cual (D31).
- **Peso corporal:** presente en todas las filas, con hasta 2 decimales (D30).

**Correspondencias propuestas (por confirmar en D32):** «RSAIP» = Run-Specific Ankle Iso-Push; «Peak Vertical Force [N]» = Peak Force (N); «RFD - 100ms [N/s]» = RFD a 100 ms. «Force at 100ms [N]» no está en el catálogo de la guía; no se crea hasta que lo decidas.

## Datos previstos (no implementados)

Se definirán al implementar las fases correspondientes y no forman parte del esquema actual:

- **Posición asignada a cada sesión en su fecha** (fases 2 y 3), tomada del historial de posiciones. Corregir el historial no reasigna sesiones existentes sin una acción explícita (guía).
- **Sesiones y repeticiones** con su estado (válida, pendiente o excluida), para calcular Average y los demás valores (fases 2 a 4). La forma de guardar las repeticiones está pendiente (D8). El Average de sesión, el Personal Average y el Personal Best serán **valores calculados** a partir de las repeticiones o de los resúmenes de sesión, no datos guardados (definiciones en `DECISIONES.md`, D12); la Máxima repetición se obtiene de las repeticiones individuales y no existe para sesiones solo resumen.

## Pendiente de definir por el usuario

Catálogo de tests, variables, unidades y fórmulas relativas; grupos de posiciones (si se desea agrupar); zonas y técnicas de perímetros; contenido de NME; umbral mínimo de muestra; referencias, umbrales y targets (ver `DECISIONES.md`, D14 a D21).
