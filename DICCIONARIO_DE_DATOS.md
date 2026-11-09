# Diccionario de datos (fase 3)

Base de datos local: `dashboard-rendimiento` (IndexedDB), **esquema versión 4** (fase 3: sesiones, lotes de importación y mapeos). Las tablas de las fases siguientes se añadirán como nuevas versiones del esquema; no se anticipan aquí. Las fechas de calendario se guardan como texto `AAAA-MM-DD` sin zona horaria.

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
| `targets` | `id` (autonumérica) | `variableId`, `playerId`, `positionId`, `synthetic` | Sí | Targets (D15): individual (jugador + variable) o por defecto de una posición (posición + variable); `values` = `{L,R,S}`, `note`, `source`, `definedAt`, `updatedAt` (esquema 5) |
| `fvProfiles` | `id` (autonumérica) | `playerId`, `date`, `synthetic` | Sí | Perfiles carga-velocidad (G6, esquema 6): `playerId`, `date`, `exercise` (texto libre), `fdmVelocity` (m/s, 0,33 por defecto), `points` [{`load` kg, `velocity` m/s}] (3 a 12, cargas distintas), `source` (`manual` o `Excel`), `createdAt`, `correctedAt`. Fo, Vo, pendiente, FDM y potencia se calculan al vuelo, no se guardan |
| `playerPositions` | `id` (autonumérica) | `playerId`, `positionId`, `validFrom`, `synthetic` | Sí | Historial de posiciones de cada jugador |
| `anthropometry` | `id` (autonumérica) | `playerId`, `date`, `synthetic` | Sí | Mediciones antropométricas fechadas |
| `blocks` | `key` | `order` | Sí | Bloques principales: `fuerza`, `perimetros`, `nme` |
| `manifestations` | `id` (autonumérica) | `blockKey`, `order` | Sí | Manifestaciones de la fuerza |
| `zones` | `id` (autonumérica) | `order` | Sí | Zonas anatómicas (Groin, Hip, Knee, Ankle) |
| `tests` | `id` (autonumérica) | `blockKey`, `manifestationId`, `zoneId`, `order` | Sí | Tests del catálogo |
| `protocols` | `id` (autonumérica) | `testId` | Sí | Protocolos de cada test |
| `variables` | `id` (autonumérica) | `testId`, `manifestationId`, `order` | Sí | Variables de cada test (de origen o calculadas) |
| `formulaHistory` | `id` (autonumérica) | `variableId` | Sí | Versiones de las fórmulas de las variables calculadas |
| `sessions` | `id` (autonumérica) | `playerId`, `testId`, `date`, `batchId`, `synthetic` | Sí | Sesiones importadas (una fila por jugador, test, fecha y hora) |
| `importBatches` | `id` (autonumérica) | `createdAt`, `fileHash` | Sí | Lotes de importación con su resumen e informe |
| `importMappings` | `id` (autonumérica) | `testId` | Sí | Mapeos de columnas guardados, por texto de encabezado |

`synthetic` vale `1` solo en los registros sintéticos de demostración; en los reales no existe el campo (los booleanos no se pueden indexar). `syntheticBatch` (sin índice) identifica el lote de carga.

### `players`

| Campo | Descripción |
|---|---|
| `id` | Identificador estable |
| `jerseyName` | **Alias** (nombre en camiseta, el que usan los Excel del usuario). Obligatorio; se muestra entre paréntesis detrás del nombre completo |
| `fullName` | Nombre completo (el de VALD). Opcional. Visible: «nombre completo (alias)»; si ambos son iguales solo se muestra uno. Los jugadores antiguos lo reciben de su alias de VALD al abrir la aplicación (una sola vez) |
| `notes` | Notas libres |
| `active` | `true` o `false`. Un jugador no se borra: se desactiva y conserva su historial |
| `createdAt`, `updatedAt` | Fechas ISO |

### `playerAliases`

| Campo | Descripción |
|---|---|
| `playerId` | Jugador al que pertenece |
| `source` | `VALD`, `Excel`, `Otra` o `manual` (alta manual de carga) |
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

### Peso de referencia del jugador (8/11/2026)

Campo opcional `referenceWeight: {value, unit}` del registro del jugador (unidad kg, g o lb). Se usa en todos los cálculos con masa solo si el jugador no tiene ninguna medición de masa corporal. No es una medición: no tiene fecha y cualquier medición lo sustituye. Va en la copia con el resto de jugadores.

### Variables calculadas del Iso-Hold y del 1RM (D5)

Operaciones de sistema (no se ofrecen al crear variables a mano): `ISO_MVIC` (kg), `ISO_PIMA` (%), `ISO_LOAD_BW` (%), `ISO_LOAD_SW` (%, con `factor`) y `RM_EST` (kg, con `factor` 1,4). El origen es la variable de carga del mismo test («Carga externa (kg)» en Iso-Hold, «Carga máxima (kg)» en el 12RM). Se calculan al vuelo y no se guardan; el Iso-Push emparejado sale de una tabla fija (`isohold.js`). Las variables de carga (RM e Iso-Hold) y las del Nordic son datos de origen; la carga la introduce el usuario.

### `targets`

Valor objetivo definido por el usuario (D15). `scope` = `player` o `position`; `playerId` o `positionId` según el ámbito (el otro es null); `variableId`; `values` con los lados de la variable (`L`, `R` o `S`, al menos uno); `note` y `source` opcionales; `definedAt`, `updatedAt`; `synthetic` = 1 si el jugador o la posición son sintéticos. Un único target por ámbito + dueño + variable. En variables I/D se guarda el mismo valor en `L` y `R`. El individual manda sobre el de la posición. Al eliminar una posición se eliminan sus targets.

### `playerPositions`

| Campo | Descripción |
|---|---|
| `playerId`, `positionId` | Jugador y posición |
| `role` | `principal` o `secundaria` |
| `validFrom` | Primer día de vigencia (obligatorio) |
| `validTo` | Último día de vigencia; vacío si sigue vigente |

**Desde el 2026-11-07 no hay fechas:** `validFrom` y `validTo` valen siempre `null` (se conservan por compatibilidad con copias antiguas, que se normalizan al abrir y al restaurar). Un jugador tiene como máximo UNA posición principal y una secundaria por posición; cambiar la principal modifica el registro (vale para todo el histórico). Texto histórico a continuación (modelo con fechas, sustituido): las posiciones principales de un jugador no se solapan. «Cambiar la posición principal desde una fecha» cierra la vigente el día anterior y abre la nueva. Si no hay registro vigente en una fecha, el jugador figura **sin posición** en esa fecha. Las secundarias no se usan para agrupar ni comparar (D11); solo podrían usarse como filtro si se define expresamente. La **posición de una sesión es la principal vigente en la fecha de esa sesión**, no la actual.

### `anthropometry`

| Campo | Descripción |
|---|---|
| `playerId`, `date` | Jugador y fecha de la medición (no futura) |
| `bodyMass`, `height`, `legLength` | Cada una `{ value, unit }` o vacía. Al menos una. El valor es un número mayor que 0 y la unidad la indica el usuario (no hay unidades por defecto) |
| `source`, `notes` | Fuente y observaciones opcionales |

Cada medición es un registro; no se sustituye un valor único. Para valores relativos se usará la medición más próxima a la fecha del test **dentro de la ventana antropométrica**: si no hay ninguna dentro de la ventana, el valor relativo figura como no disponible y se explica por qué; nunca se usa «la última medición» sin límite. Si dos mediciones están a la misma distancia, la selección es ambigua.

### Catálogo (esquema 3, fase 2)

Es configuración, no datos de jugadores. El **estado `archived`** (`true`/`false`, sin índice) existe en manifestaciones, zonas, tests, protocolos y variables: archivar no borra nada. `source` vale `inicial` en lo que carga el catálogo inicial.

**`blocks`**: `key` (`fuerza`, `perimetros`, `nme`), `name` (la etiqueta NME se conserva sin expandir), `order`, `archived`.

**`manifestations`**: `name`, `blockKey`, `order`, `archived`, `createdAt`, `source`.

**`zones`**: `name`, `order`, `archived`, `createdAt`, `source`. Los tests globales (Fast Dynamic Strength y Reactive Strength) no tienen zona (`zoneId` nulo).

**`tests`**: `name`, `blockKey`, `manifestationId` (la manifestación del listado; ver nota), `zoneId`, `notes`, `archived`, `order`, `createdAt`, `updatedAt`, `source`.

**`protocols`**: `testId`, `name`, `description`, `archived`, `createdAt`. No se cargan protocolos que el usuario no haya definido.

**`variables`**:

| Campo | Descripción |
|---|---|
| `testId`, `name` | Test y nombre de la variable (único dentro del test; se conserva el nombre de origen) |
| `unit` | Unidad; **nulo si no está definida** (no se infiere) |
| `sides` | `LR` (valor izquierdo y derecho) o `single` (valor único); nulo si no está definido. El lado concreto es atributo de cada valor (D6) |
| `direction` | `higher`, `lower`, `target` o nulo (no definida). No se infiere |
| `manifestationId` | Manifestación de la variable (D4); nulo = la del test |
| `kind` | `raw` (dato de origen) o `derived` (calculada) |
| `formula` | `{ op, operands, params, text }` o nulo. `op` es una de las operaciones cerradas: `ASIMETRIA`, `REL_BW`, `REL_SW` (parámetro `factor`, 0,29 por defecto). `operands` son ids de variables de origen del mismo test |
| `formulaVersion` | 0 si no tiene fórmula; sube 1 con cada cambio de fórmula (exige motivo) |
| `notes`, `archived`, `order`, `createdAt`, `updatedAt`, `source` | |

**`formulaHistory`**: `variableId`, `version`, `formula`, `at`, `reason`. Se conservan todas las versiones.

**Nota sobre la manifestación:** la manifestación de la fuerza es atributo de cada variable (D4). El test guarda además la manifestación de su listado para poder clasificar los tests que aún no tienen variables. Un mismo test puede aportar variables a manifestaciones distintas: Run-Specific Iso-Push es **un** test con Peak Force en Max Isometric Strength y RFD at 100 ms en Explosive Strength, en lugar de dos tests duplicados.

**Carga única del catálogo inicial:** se hace una sola vez, al abrir la versión 2 o al restaurar una copia anterior al esquema 3, y se anota en `meta` (`catalogSeeded`). No se repite ni se mezcla con un catálogo ya existente.

### Sesiones e importaciones (esquema 4, fase 3)

**`sessions`** (decisión D8: una fila por sesión, nunca una fila por repetición ni creada a partir de resúmenes):

| Campo | Contenido |
|---|---|
| `playerId`, `testId`, `protocolId` | Jugador, test y protocolo (opcional) |
| `date`, `time` | Fecha `AAAA-MM-DD` y hora `HH:MM` (cadena vacía si no hay); `date` + `time` distinguen sesiones del mismo día |
| `values` | `{ [variableId]: { L, R, S } }`: media de la sesión por lado (`S` = valor único). Solo variables de origen; las celdas vacías no existen (no son 0) |
| `reps` | `{ total, L, R, assumed }`; `assumed: true` si el fichero no traía repeticiones y se guardó 1 |
| `status`, `excludedReason` | `valid` (la exclusión llega en la fase 5a) y motivo |
| `source`, `batchId`, `createdAt` | Origen (`Excel`), lote y momento de la importación |
| `mergedRows` | Solo en sesiones de VALD fusionadas (D29): números de fila del fichero de origen |
| `synthetic` | `1` solo si el jugador es sintético |

**`importBatches`:** fichero (nombre, tamaño, huella SHA-256), hoja, test, mapeo usado, filas leídas y vacías, recuentos (sesiones creadas, duplicadas omitidas, conflictos omitidos o guardados como nuevas, conflictos dentro del fichero, jugadores nuevos, alias guardados, filas sin resolver y con error) e `report` (filas con problema, nombres sin resolver y notas). **No contiene valores de datos.**

**`importMappings`:** nombre, `testId`, `protocolId` y `cols` (encabezado, rol, `variableId`, lado). Se aplica por el **texto del encabezado**, no por posición.

Reglas del importador: nada se vincula en silencio (cada nombre distinto se confirma en cada lote); una sesión idéntica ya guardada se omite; con mismo jugador, test, fecha, hora y valores distintos el usuario elige omitir o guardar como nueva (nunca se sobrescribe); filas contradictorias dentro del fichero no se importan; las asimetrías, relativos y percentiles no se importan.

### `settings`

| Campo | Descripción |
|---|---|
| `key` | Nombre del ajuste |
| `value` | Valor |
| `definedByUser` | Siempre `true`: un ajuste solo existe si el usuario lo ha definido |
| `updatedAt` | Fecha ISO de la última modificación |

Ajustes conocidos: `percentileMinN` (entero de 1 a 1000; muestra mínima de jugadores para clasificar un percentil; por defecto 10, D52), `backupReminderDays` (entero de 1 a 365; plazo máximo en días desde la última copia antes de mostrar un aviso) y `anthropometryWindowDays` (entero de 0 a 3650; ventana antropométrica). Ninguno tiene valor por defecto.

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
| `schemaVersion` | Versión del esquema de la base que la generó (1 a 4) |
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

## Perfil de importación de VALD para todos los tests (fase 4, D41 a D46)

Códigos: SLSEICR = Single-Leg Seated Calf Raise; SLJ = SL CMJ (por lado); CMJ = CMJ (valor único); SJ = Squat Jump (único); HJ = Double-Leg Hop Test (único); DJ = DL Drop Jump 30 cm o 45 cm según `Drop Height [cm]` (único). Sin perfil, y por tanto omitidos e informados: ABCMJ, LCMJ, LSJ, carga adicional > 0 y alturas de DJ distintas de 30/45. Las columnas de asimetría (`(Asym)(%)`) de Hop y DJ se importan con signo (R → +, L → −, D25). Las tablas columna a columna están en `vald.js` (`VALD_PROFILES`); la unidad del CSV debe coincidir con la del catálogo (se compara sin distinguir mayúsculas; si no, error).

## Perfil de importación de VALD (fase 4, D29 a D32)

| Código de test | Test del catálogo |
|---|---|
| RSHIP / RSKIP / RSAIP | Run-Specific Hip / Knee / Ankle Iso-Push |
| SLHNNI | Supine Isometric 90°/90° Leg Curl Test |

| Columna de VALD | Variable | Uso |
|---|---|---|
| `Peak Vertical Force [N] (L)` y `(R)` | Peak Force (N) | Se importa por lado |
| `Force at 100ms [N] (L)` y `(R)` | Force at 100 ms (N) | Se importa por lado |
| `RFD - 100ms [N/s] (L)` y `(R)` | RFD at 100 ms (N/s) | Se importa por lado |
| `Reps (L)`, `Reps (R)` | Repeticiones por lado | Se importan |
| `Name`, `Date`, `Time` | Jugador (alias de la fuente VALD), fecha y hora | Se importan |
| `BW [KG]`, `Tags`, `ExternalId`, columnas `(Asym)(%)` y la columna de la variable sin lado | | **No se importan** (D30, D31, D25) |

La importación comprueba que la unidad del catálogo coincide con la del encabezado. Filas del mismo jugador y día (sin tope horario) se fusionan con media ponderada por repeticiones.

## Datos previstos (no implementados)

Se definirán al implementar las fases correspondientes y no forman parte del esquema actual:

- **Posición asignada a cada sesión en su fecha** (fases 2 y 3), tomada del historial de posiciones. Corregir el historial no reasigna sesiones existentes sin una acción explícita (guía).
- **Sesiones y repeticiones** con su estado (válida, pendiente o excluida), para calcular Average y los demás valores (fases 2 a 4). La forma de guardar las repeticiones está pendiente (D8). El Average de sesión, el Personal Average y el Personal Best serán **valores calculados** a partir de las repeticiones o de los resúmenes de sesión, no datos guardados (definiciones en `DECISIONES.md`, D12); la Máxima repetición se obtiene de las repeticiones individuales y no existe para sesiones solo resumen.

## Plantilla de importación de sesiones (versión 0.2, formato ancho)

Archivo `plantilla_importacion_sesiones.xlsx`. Hojas: «Instrucciones», «Sesiones» (vacía, con las columnas de ejemplo de Run-Specific Hip Iso-Push) y «Catálogo» (nombres exactos del catálogo inicial). **Una fila por jugador (y fecha) y una columna por variable y lado** (decisión del usuario, 7/11/2026). El valor es la media de la sesión. En el asistente se indica qué es cada columna, así que los encabezados no tienen que coincidir con el catálogo; la propuesta inicial solo usa coincidencias exactas.

| Columna (ejemplo) | Obligatoria | Contenido |
|---|---|---|
| `Jugador` | Sí | Nombre tal como aparece en tu Excel (se confirma en cada importación) |
| `Fecha` | Sí (o una fecha única para todo el fichero) | Fecha de Excel, `DD/MM/AAAA` o `AAAA-MM-DD` |
| `Hora` | No | `HH:MM`; distingue dos sesiones del mismo día |
| `Reps` | No | Entero ≥ 1; sin la columna se guarda 1 repetición supuesta |
| `Peak Force Izq`, `Peak Force Der`, … | Al menos una columna de valor | Número en la unidad definida de la variable; coma o punto decimal, sin separador de miles |

Una celda vacía es «sin dato», nunca 0. Los relativos, asimetrías y percentiles no se importan: se calculan. Un fichero por test. Formatos: `.xlsx` y `.csv` (separador `;`, tabulador o coma); `.xls` no se admite; máximo 25 MB. `ejemplo_importacion_sintetico.xlsx` es un ejemplo con datos ficticios para probar el asistente.

## Pendiente de definir por el usuario

Variables, unidades y fórmulas de los tests que no son Iso-Push, CMJ, SL CMJ, Squat Jump, Hop Test ni Drop Jump (incluidos Iso-Hold, Nordic, RM y el 1RM estimado: sus reglas están en D5 pero no se han precargado); fórmulas relativas de RFD at 100 ms y Force at 100 ms; grupos de posiciones (si se desea agrupar); zonas y técnicas de perímetros; contenido de NME; umbral mínimo de muestra; referencias, umbrales y targets (ver `DECISIONES.md`, D14 a D21).


**Añadidos de la versión 7d (sin cambio de esquema):** las sesiones corregidas llevan `correctedAt` (fecha ISO de la última corrección); las sesiones de alta manual llevan `source: 'manual'`, `reps: {}` y `protocolId: null`; el ajuste `radarConfig` (tabla `settings`) guarda `{ test, variables: [nombres en orden] }`.

**Versión 7e (esquema 6):** tabla `fvProfiles` (arriba) y ajuste `fvReference` en `settings` (puntos de la línea Balanced: [{`load`, `velocity`}]; sin ajuste se usa la del Excel del usuario).

**Versión 7g (sin cambio de esquema):** ajuste `quadrantCuts` en `settings` = { `dsi`, `eur` } (valores fijos de los cortes de los cuadrantes; vacío o ausente = mediana de La Liga).
