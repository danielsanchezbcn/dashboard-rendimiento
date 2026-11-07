# Guía de proyecto: dashboard de datos de rendimiento para fútbol

> **Versión actualizada el 4 de noviembre de 2026.** Las reglas anteriores se conservan, salvo las que se indican como modificadas por decisiones del usuario. Lo añadido o modificado en esta versión:
>
> - **Valores de seguimiento cerrados (D12, 5 de noviembre de 2026):** *Average de sesión*, *Personal Average*, *Personal Best* y *Máxima repetición* (la repetición individual más alta, siempre separada de Personal Best). «Max» no se usa como nombre de ningún indicador. El perfil VALD «All Average» permite calcular el Personal Best y el Personal Average, pero no la Máxima repetición.
> - **Vista comparativa de un test (D10, D11, D13):** inicialmente el Average de la última sesión válida de cada jugador, con opciones para ver el Personal Best o el histórico completo; posición principal vigente en la fecha de cada sesión.
> - **Orden de fases aprobado:** la fase 5 se divide en 5a (perfil y evolución), 5b (vista de test y navegación entre jugador y test) y 5c (percentiles y referencias).
> - Nuevo apartado **«Gráficos y visualizaciones»** (ocho tipos, reglas comunes, datos necesarios y fase de cada uno), **«Referencias nombradas: La Liga y Premier League»** y presentación del color en casillas y marcadores. La especificación de estilo de los gráficos queda abierta hasta revisar los dos informes de ejemplo que aportará el usuario.
> - Reglas de posición en las comparaciones (D11) y orden configurable de posiciones (D9).
> - Decisiones pendientes D14 a D28 (ver el apartado final y `DECISIONES.md`).
Ver la nota en «Evolución individual».

## Objetivo

Construir una aplicación web de uso personal, adaptable a ordenador, tablet y móvil, para almacenar localmente valoraciones de fuerza, perímetros y NME de jugadores, revisarlas en cada jugador y relacionarlas entre sí para describir tendencias y asociaciones.

El dashboard debe seguir acumulando los datos que se importen a lo largo del tiempo. El usuario cargará sus propios Excel desde la aplicación. No se deben introducir datos reales de jugadores en Claude durante el desarrollo: Claude trabajará con datos ficticios generados para comprobar la interfaz y el flujo.

## Decisiones de base

1. Debe ser una aplicación web sin instalador que se abra desde un enlace estable en el navegador del portátil del usuario. El enlace carga la aplicación, pero los datos se guardan localmente en ese navegador; no se sincronizan con un servidor ni con otros dispositivos.
2. Usar una base de datos local del navegador adecuada para datos estructurados (por ejemplo, IndexedDB), no `localStorage` como base de datos principal. La aplicación debe funcionar con un origen/URL estable para no cambiar de almacén de datos. No añadir autenticación remota, base de datos en la nube, analítica, telemetría ni envío de datos a servicios externos. Si la interfaz se aloja estáticamente, el alojamiento solo sirve los archivos de la aplicación; los datos de jugadores permanecen en el portátil.
3. La aplicación será de uso individual en el perfil de navegador del portátil. La protección de acceso depende de la cuenta y seguridad del propio portátil. Explicar que borrar los datos del navegador, cambiar de perfil o de ordenador no traslada los datos; para eso se utilizarán copias de seguridad manuales descargables.
4. El almacenamiento local debe tener una estructura lógica relacional o equivalente, con relaciones claras entre jugadores, bloques de evaluación, pruebas/mediciones, sesiones, repeticiones, variables, referencias e importaciones.
5. El dato original importado es la fuente de verdad. Los valores relativos, percentiles y resúmenes se calculan a partir de él y de reglas configurables. No se deben sobrescribir los datos originales con resultados calculados.
6. Nombre en camiseta es el nombre visible en la aplicación y cada jugador tiene un identificador estable. VALD puede entregar el nombre completo y el Excel el nombre deportivo; cada importación debe incluir una revisión explícita para vincular cada nombre de origen con un jugador existente o crear un jugador nuevo. Guardar los nombres de origen confirmados como alias diferenciados por fuente (VALD, Excel u otra) para sugerir futuras coincidencias sin vincularlas en silencio.
7. La posición debe conservarse asociada a la fecha de valoración. El usuario debe poder definir qué posición principal se usa para cada clasificación por posición; no se deben reasignar automáticamente datos históricos al cambiar la posición actual del jugador.
8. Claude no debe inventar pruebas, variables, unidades, fórmulas de relativización, grupos de posición ni referencias bibliográficas. El sistema debe permitir configurarlos desde la aplicación.
9. El sistema debe preservar trazabilidad: fecha de prueba, procedencia del dato, fichero o lote de importación, cambios de configuración, exclusiones y eliminaciones solicitadas.
10. **Posición en las comparaciones (D11).** Cada sesión se compara según la posición principal registrada para el jugador en la fecha de esa sesión. Las posiciones secundarias no incluyen automáticamente al jugador en varios grupos; solo podrán usarse como filtro o grupo de comparación si el usuario lo define expresamente.
11. **Orden de las posiciones (D9).** El orden de las posiciones debe ser configurable por el usuario. No se fija ningún orden definitivo.

## Bloques de evaluación

La navegación principal tendrá por ahora tres bloques: **Manifestaciones de la fuerza**, **Perímetros** y **NME**. Son bloques de evaluación distintos; Perímetros y NME no se deben clasificar como manifestaciones de la fuerza. En el bloque de fuerza, el catálogo separará la manifestación, la zona anatómica (cuando aplique), el test, el protocolo y sus variables. Los tests de Fast Dynamic Strength y Reactive Strength son categorías globales y no se deben forzar a una única zona anatómica.

Una misma prueba/protocolo puede aportar variables asociadas a más de una manifestación. En esos casos, clasificar cada variable bajo la manifestación correspondiente y conservar una única sesión y sus repeticiones originales; no duplicar el test ni sus datos solo para que aparezca en dos categorías.

### Manifestaciones de la fuerza

- **Max Isometric Strength:** tests por bloque anatómico de Groin, Hip, Knee y Ankle.
- **Heavy Dynamic Strength:** tests por bloque anatómico de Groin, Hip, Knee y Ankle.
- **Fast Dynamic Strength:** CMJ, SL CMJ y Squat Jump.
- **Reactive Strength:** Double-Leg Hop Test, DL Drop Jump 30 cm y DL Drop Jump 45 cm.
- **Explosive Strength:** tests por bloque anatómico de Groin, Hip, Knee y Ankle.

### Otros bloques principales

- **Perímetros:** bloque independiente. El usuario todavía debe definir las zonas anatómicas, si se mide por lado, las unidades, el procedimiento, el número de mediciones y cómo se resume cada sesión. No inventar ni precargar medidas concretas.
- **NME:** bloque independiente con la etiqueta **NME** tal como la ha aportado el usuario. No expandir la sigla ni inventar tests, protocolos, variables o fórmulas hasta que el usuario los defina.

### Catálogo inicial aportado por el usuario

Esta lista es una primera estructura editable. No implica que los protocolos, variables, unidades ni fórmulas ya estén definidos. No completar los tests que no aparecen en la lista.

#### Hip

**Max Isometric Strength**

- Run-Specific Hip Iso-Push — Peak Force
- Supine Isometric 90°/90° Leg Curl Test
- Standing Isometric 90°/20° Hamstring Test

**Explosive Strength**

- Run-Specific Hip Iso-Push — 100 ms RFD

**Heavy Dynamic Strength**

- Hip Iso-Hold 20 s
- Nordic Hamstring Exercise
- Hamstring Bridge 30 cm 8RM
- Single-Leg Knee Flexion 8RM
- RDL Force–Velocity Profile
- Hip Thrust Force–Velocity Profile

#### Knee

**Max Isometric Strength**

- Run-Specific Knee Iso-Push — Peak Force
- Seated Isometric 90°/90° Knee Extension Test

**Explosive Strength**

- Run-Specific Knee Iso-Push — 100 ms RFD

**Heavy Dynamic Strength**

- Knee Iso-Hold 20 s
- Double-Leg Leg Press 45° 8RM
- Single-Leg Leg Press 45° 8RM
- RFESS 45° 8RM
- Back Squat Force–Velocity Profile
- Trap Bar Squat Force–Velocity Profile

#### Ankle

**Max Isometric Strength**

- Run-Specific Ankle Iso-Push — Peak Force
- Single-Leg Seated Calf Raise
- Supine Isometric Ankle Inversion
- Supine Isometric Ankle Eversion

**Explosive Strength**

- Run-Specific Ankle Iso-Push — 100 ms RFD

**Heavy Dynamic Strength**

- Ankle Iso-Hold 20 s
- Single-Leg Seated Calf Raise Iso-Hold 20 s
- Run-Specific Ankle Iso-Hold 20 s
- Single-Leg Standing Calf Raise 12RM
- Single-Leg Seated Calf Raise 6RM

#### Groin

**Max Isometric Strength**

- Hip Adduction 0° (Long Lever)
- Hip Abduction 0° (Long Lever)
- Hip Adduction 45° (Short Lever)

The Groin list currently includes only the tests supplied above. Leave its Heavy Dynamic Strength and Explosive Strength test lists empty until the user provides them.

#### Fast Dynamic Strength and Reactive Strength

The global tests listed in “Manifestaciones de la fuerza” form the initial catalog for these categories. The CMJ and Reactive Strength variables supplied by the user are listed below. Their remaining protocol details and the variables for SL CMJ and Squat Jump remain to be specified.

##### CMJ — variables aportadas por el usuario

Configurar las siguientes variables para **CMJ**. Conservar estos nombres como etiquetas de origen; no asignarles unidades, fórmulas relativas, dirección de interpretación ni reglas de asimetría hasta que el usuario las defina. No asumir que esta lista también se aplica a SL CMJ o Squat Jump.

| Variable |
|---|
| ECC DECEL PHASE DURATION |
| CONCENTRIC DURATION |
| CONTRACTION TIME |
| DEPTH |
| RSI MOD |
| COM STIFFNESS |
| ECC DECEL RFD |
| CON IMPULSE 100ms |
| CON PEAK POWER/BM |
| CON IMPULSE |
| JH (imp-mom) |
| FORCE AT 0 VELOCITY |
| ECC DECELERATION IMPULSE |
| ECC PEAK POWER/BM |
| ECC DECEL RFD ASYM |
| CON IMPULSE 100ms ASYM |
| CON IMPULSE ASYM |
| ECC DECEL IMPULSE ASYM |
| PEAK LANDING FORCE ASYM |

##### Reactive Strength — variables definitivas aportadas por el usuario

Configurar exactamente estas variables para cada test. No asignar unidades no indicadas, fórmulas adicionales, dirección de interpretación ni reglas de asimetría que el usuario no haya especificado.

| Test | Variable |
|---|---|
| DOUBLE LEG HOP TEST | MEAN RSI (FLIGHT TIME / CONTACT TIME) |
| DOUBLE LEG HOP TEST | MEAN JUMP HEIGHT (Flight Time) (cm) |
| DOUBLE LEG HOP TEST | MEAN CONTACT TIME |
| DL DROP JUMP (30cm) | RSI (FLIGHT TIME / CONTACT TIME) |
| DL DROP JUMP (30cm) | JUMP HEIGHT (Flight Time - cm) |
| DL DROP JUMP (30cm) | CONTACT TIME |
| DL DROP JUMP (45cm) | RSI (FLIGHT TIME / CONTACT TIME) |
| DL DROP JUMP (45cm) | JUMP HEIGHT (Flight Time - cm) |
| DL DROP JUMP (45cm) | CONTACT TIME |

Dentro de cada área se podrán añadir, modificar, archivar y configurar tests y variables sin tener que cambiar el código. El protocolo se asocia al test; cada variable tendrá su nombre, unidad, dirección de interpretación y fórmula relativa propios. En Run-Specific Iso-Push, Peak Force y RFD at 100 ms son los únicos resultados/variables ya identificados por el usuario. Peak Force tiene unidad absoluta N y normalización relativa regional definida en “Relativización”: SW para Hip y BW para Knee y Ankle. La unidad absoluta y la fórmula relativa de RFD at 100 ms siguen pendientes. No inventar variables adicionales para los demás tests.

## Modelo de información mínimo

### Jugadores

- Identificador interno estable.
- Nombre en camiseta, visible en toda la aplicación.
- Alias o nombres anteriores para emparejamiento de importaciones, indicando su fuente y conservando el texto original (por ejemplo, nombre completo VALD y nombre deportivo del Excel).
- Posición principal configurable y, si se desea, posiciones secundarias.
- Estado activo/inactivo, sin borrar el historial del jugador.

### Antropometría

Guardar cada medición como un registro fechado, no como un valor único que se sustituye:

- Altura.
- Peso corporal.
- Longitud de extremidad inferior.
- Fecha de medición.
- Unidad, fuente y observaciones opcionales.

Las métricas relativas deben utilizar el dato antropométrico más próximo a la fecha de la prueba dentro de una ventana temporal configurable. Si no existe una medición válida, mostrar la métrica relativa como no disponible y explicar por qué. No usar automáticamente el último peso o medida aunque sea antiguo.

### Perímetros

Guardar las mediciones de perímetros como registros fechados y separados de la antropometría básica y de los tests de fuerza. Cada registro deberá poder asociarse al jugador, zona/medida configurada, fecha, lado si corresponde, valor, unidad, procedimiento/protocolo y procedencia. Las zonas, unidades, técnica, repeticiones y regla para resumir una sesión quedan pendientes; no asumir que todas las medidas se expresan o calculan igual.

### Catálogo de tests y variables

Cada test debe guardar:

- Bloque de evaluación y, para los tests de fuerza, manifestación, zona anatómica opcional, nombre del test y protocolo. Fast Dynamic Strength y Reactive Strength no requieren una zona anatómica. Perímetros y NME conservan su bloque propio y no se convierten en manifestaciones de fuerza.
- Variables que se pueden importar y analizar.
- Unidad original y unidad normalizada.
- Si un valor alto, bajo o un rango objetivo representa el resultado más favorable.
- Regla estándar de resultado por sesión: media aritmética de las repeticiones válidas de esa sesión. Conservar los valores de cada repetición. El histórico individual podrá mostrar también el máximo de cada sesión, sin sustituir el resultado estándar.
- Fórmula relativa aplicable a cada variable, cuando corresponda.
- Requisitos de compatibilidad para compararlo con otros protocolos o referencias.

Las fórmulas relativas no deben asumirse globalmente. El usuario las definirá por variable. Mantener siempre el valor absoluto original junto al valor relativo y mostrar la fórmula y unidad usadas.

### Registros de pruebas

Guardar cada sesión o valoración por jugador con:

- Jugador, test, protocolo, fecha y, si existe, hora o identificador de sesión.
- Identificador interno estable de sesión y número/identificador de cada repetición. Si no existe una hora o ID de sesión en la importación, permitir que el usuario confirme qué filas pertenecen a una misma sesión.
- Posición asignada en esa fecha.
- Variables, cada repetición y sus valores originales. Si el fichero aporta un único resultado sin repeticiones identificables, tratarlo como una sesión con una sola repetición.
- Contexto de cada repetición cuando el protocolo lo requiera, por ejemplo carga externa, número de repeticiones, duración o distancia. En los perfiles fuerza-velocidad, conservar la carga de cada medición junto a sus variables de velocidad/fuerza. No asumir que el mismo conjunto de condiciones se aplica a todos los tests.
- Media de sesión derivada de las repeticiones válidas; no sobrescribir los valores originales.
- Valores relativos calculados, versión de la fórmula y antropometría usados.
- Procedencia: importación, fichero, hoja/columna o introducción manual.
- Estado del registro: válido, pendiente de revisar o excluido del análisis, con motivo cuando corresponda. La exclusión se aplica a la sesión o repetición seleccionada, es reversible y no elimina el dato original.
- Historial de acciones de exclusión y eliminación: fecha, alcance y número de registros afectados, sin guardar los valores eliminados.

### Referencias externas

Permitir añadir referencias aportadas por el usuario, por ejemplo artículos científicos o datos de VALD de Premier League. Guardar fuente, población, temporada/año, posición, protocolo, unidades, tamaño de muestra, variable y tipo de dato disponible.

Calcular percentiles externos solo si se dispone de datos de distribución suficientes o de percentiles explícitos. Si una publicación aporta únicamente media y desviación estándar, no convertirlos en percentiles exactos sin una hipótesis estadística claramente indicada. Mostrar la referencia y sus limitaciones junto al resultado.

### Referencias nombradas: «La Liga» y Premier League

- **«La Liga»** es el nombre de la base de datos propia que se usa como población de referencia. Junto a cada valor relativo se muestra el percentil que ocupa dentro de «La Liga», **cuando haya suficientes datos comparables** (mismo test, protocolo, variable, unidad y tipo de dato, con el tamaño mínimo de muestra que el usuario defina; ver «Percentiles propios»). Si no los hay, se indica «no disponible» y el motivo. «La Liga» usa las referencias que el sistema calcula a partir de la base propia, con los filtros pertinentes, y **excluye los datos sintéticos** (D19). **Cada jugador aporta un único valor por test, protocolo y variable: la media de todos sus tests válidos en todas las temporadas** (por ejemplo, 54 jugadores distintos dan 54 referencias), no un valor por temporada ni por sesión (D28). Un jugador con una sola sesión ya cuenta. En los tests unilaterales hay **dos referencias, una por extremidad**, y el percentil se calcula para cada extremidad por separado.
- **Premier League** (datos de VALD aportados por el usuario): para los tests que dispongan de rangos de referencia, se muestra el **rango de percentil** correspondiente al valor del jugador. Si la fuente solo proporciona rangos, se **conserva esa precisión**: se muestra el rango (por ejemplo, «entre P50 y P75») y nunca se inventa un percentil exacto. Datos necesarios de cada referencia: fuente, población, temporada o periodo, posición, protocolo, variable, unidad, tamaño de muestra, estadístico y la tabla de rangos de valores con su rango de percentil.
- **Grupo y posición pertinentes:** la comparación usa el grupo y la posición que correspondan al jugador (la posición vigente en la fecha de la sesión, regla D11) cuando la referencia disponga de ellos. Si la referencia no incluye esa posición o ese grupo, se indica «no disponible para esta posición» y no se sustituye en silencio por otra.
- **Siempre visibles junto al resultado:** población, posición, periodo, estadístico, fuente y tamaño de muestra de la referencia, y sus limitaciones. No se mezclan referencias incompatibles.
- **Umbrales y objetivos de la bibliografía:** se muestran como referencias diferenciadas, con su fuente (autores, año, población, protocolo y unidad), y **no se convierten en percentiles ni en colores** salvo que exista una regla documentada para hacerlo (D15). Los targets individualizados son opcionales y configurables por el usuario.

## Importación de Excel

La aplicación debe admitir dos flujos:

### Vinculación de jugadores en cada importación

En cada importación, agrupar las filas por cada nombre de jugador distinto en el fichero y pedir al usuario que confirme su identidad antes de guardar los datos. Mostrar el nombre exacto de origen, su fuente (VALD/Excel), los jugadores existentes sugeridos y sus nombres en camiseta/alias. Ofrecer **Vincular a un jugador existente**, **Crear jugador nuevo** o **Dejar sin resolver**. Aunque exista un alias guardado de una importación anterior, proponer esa vinculación y pedir confirmación en esta importación; después de confirmarla, permitir recordar o actualizar el alias de esa fuente.

La búsqueda de candidatos debe ignorar mayúsculas, espacios redundantes y acentos/diacríticos para que nombres con y sin acento puedan sugerir el mismo jugador. La normalización solo propone candidatos: nunca decide el vínculo por sí sola. Si hay más de un candidato, si cambia ñ por n o si el nombre no coincide exactamente, exigir confirmación manual y mostrar suficiente contexto para distinguir a los jugadores. No importar las filas de un jugador sin resolver; dejarlas pendientes o permitir excluirlas de este lote. La pantalla final debe resumir vínculos, jugadores nuevos y filas pendientes antes de confirmar la importación.

### Excel del usuario

Formato habitual: una fila por jugador y una columna por variable del test. El asistente de importación debe permitir seleccionar hoja, fila de encabezados y columnas, y relacionarlas con jugador, fecha, posición, test, protocolo, variable y unidad. Crear y descargar una plantilla de ejemplo vacía para cada test o protocolo. Admitir columnas de repeticiones o filas separadas por repetición. Si solo hay un valor final sin intentos separados, importarlo como una única repetición de esa sesión; no inferir repeticiones que no estén en el fichero.

### Excel exportado de VALD

Los formatos de exportación pueden variar. Crear un importador con vista previa que permita elegir hoja, identificar encabezados y mapear columnas de VALD a jugadores, tests, protocolos, variables, intentos, unidades y fechas. Guardar la configuración de mapeo para reutilizarla en futuras exportaciones similares.

#### Perfil inicial: ForceDecks CMJ CSV

Usar el CSV de ejemplo aportado por el usuario como primer perfil de mapeo. Es un archivo delimitado por comas, con una fila por jugador, tipo de test, fecha y hora. La muestra contiene los valores de `Test Type` **CMJ**, **ABCMJ** y **LCMJ**; mapear automáticamente solo `CMJ` al test CMJ configurado. Dejar ABCMJ y LCMJ en revisión hasta que el usuario indique a qué tests corresponden; no asumir que son Squat Jump o SL CMJ.

La identidad de sesión se construye con el jugador ya resuelto, `Test Type`, `Date` y `Time`, además del protocolo/mapeo seleccionado. En esta muestra `ExternalId` está vacío, por lo que no sirve como identificador; usar `Name` para vincular con el jugador y conservar el texto de origen. Parsear las fechas como **DD/MM/YYYY** (la muestra incluye días superiores a 12) y las horas con formato de 12 horas AM/PM. Conservar `BW [KG]`, `Reps`, `Additional Load [kg]` y `Tags` como campos de contexto y procedencia, no como variables CMJ; un cero en carga adicional es un valor, no un dato ausente.

Mapear las 19 variables CMJ definidas a estos encabezados del CSV, conservando siempre etiqueta, unidad y valor originales:

| Variable del catálogo | Encabezado de VALD |
|---|---|
| ECC DECEL PHASE DURATION | `Eccentric Deceleration Phase Duration [s]` |
| CONCENTRIC DURATION | `Concentric Duration [ms]` |
| CONTRACTION TIME | `Contraction Time [ms]` |
| DEPTH | `Countermovement Depth [cm]` |
| RSI MOD | `RSI-modified (Imp-Mom) [m/s]` |
| COM STIFFNESS | `CMJ Stiffness [N/m]` |
| ECC DECEL RFD | `Eccentric Deceleration RFD / BM [N/s/kg]` |
| CON IMPULSE 100ms | `Concentric Impulse-100ms [N s]` |
| CON PEAK POWER/BM | `Peak Power / BM [W/kg]` |
| CON IMPULSE | `Concentric Impulse [N s]` |
| JH (imp-mom) | `Jump Height (Imp-Mom) [cm]` |
| FORCE AT 0 VELOCITY | `Force at Zero Velocity / BM [N/kg]` |
| ECC DECELERATION IMPULSE | `Eccentric Deceleration Impulse [N s]` |
| ECC PEAK POWER/BM | `Eccentric Peak Power / BM [W/kg]` |
| ECC DECEL RFD ASYM | `Eccentric Deceleration RFD % (Asym) (%)` |
| CON IMPULSE 100ms ASYM | `Concentric Impulse-100ms % (Asym) (%)` |
| CON IMPULSE ASYM | `Concentric Impulse % (Asym) (%)` |
| ECC DECEL IMPULSE ASYM | `Eccentric Deceleration Impulse % (Asym) (%)` |
| PEAK LANDING FORCE ASYM | `Peak Landing Force % (Asym) (%)` |

The CSV also contains `Eccentric Peak Velocity [m/s]`, which is not in the user's CMJ variable list. Show it as an unmapped column and let the user explicitly skip it or configure it later; do not add it to the catalog automatically. Trim stray spaces around CSV headers before applying the saved mapping, but keep the original header text in import provenance.

Several source columns already contain body-mass-normalized values (`/ BM`, such as N/kg, N/s/kg or W/kg). Preserve those units and do not normalize them by BW or SW again. CMJ asymmetry columns may contain text such as a percentage magnitude followed by `L` or `R`; preserve the raw cell and, where it can be parsed unambiguously, store numeric magnitude and side separately. Do not convert VALD asymmetry to a signed value or apply the Run-Specific Iso-Push asymmetry formula to it.

This export has one session-summary row per player/test/date/time, a `Reps` count, and no separate row or identifier for each repetition. The user confirmed that this specific export uses **All Average**. Configure this saved import profile as All Average and treat each mapped value as the session average across the contributing repetitions; retain `Reps` as the contributing-repetition count. Do not ask for the summary mode again when this profile matches, and do not copy a row value into multiple artificial repetitions. A weighted average across all repetitions can be computed as `SUM(session average × Reps) / SUM(Reps)` for the player, provided `Reps` is the number of repetitions contributing to the summary. The **Máxima repetición** (the highest individual repetition of a session) cannot be recovered from this summary export; it requires repetition-level source data. The **Personal Best** (the session Average that represents the best performance for the direction of the variable) can be computed from this export by comparing the session Averages, and the **Personal Average** by weighting each session Average by `Reps`. For any new or changed export profile whose aggregation mode is not confirmed, retain the source values as unverified summaries and exclude them from Average, Personal Best and Personal Average trends and percentiles until resolved.

If VALD can export the CMJ metrics for each repetition, prefer retaining those repetition-level rows as the primary source: the dashboard can then calculate the session Average, the Máxima repetición, the Personal Best and the Personal Average directly while preserving the original trials. If repetition-level export is unavailable, keep this All Average CSV for the standard session result, the Personal Best, the Personal Average and the two requested percentile views; use a separately identified summary of the highest repetition only if VALD can provide one. Never derive the Máxima repetición from All Average. If repetition-level data are later imported for sessions already present in this summary export, match them to the existing session by player, test type, date and time; enrich the session rather than adding a second independent session, preserve source provenance and resolve any value conflicts. Use either the raw repetitions or their summary in each analysis, never both.

### Reglas de calidad y duplicados

- Antes de importar, mostrar una vista previa con filas válidas, errores, jugadores no reconocidos, variables no mapeadas y posibles duplicados.
- No descartar filas sin explicarlo. Permitir resolver o descargar un informe de errores antes de confirmar.
- Detectar el mismo fichero por su contenido cuando sea posible y avisar de que ya se importó.
- Detectar duplicados de repeticiones con una clave normalizada que incluya jugador, sesión, test, protocolo, variable e identificador/valor de repetición. Una repetición exacta debe omitirse de forma idempotente y constar en el informe de importación.
- Si coincide jugador, fecha, test y protocolo, pero no hay un identificador que permita saber si se trata de la misma sesión, no fusionar las filas automáticamente. Pedir que se confirme si es una nueva sesión, una corrección o una continuación de la sesión existente. No sobrescribir ni borrar valores distintos sin confirmación.
- Normalizar espacios, mayúsculas/minúsculas, formatos de fecha y unidades solo mediante reglas explícitas. No emparejar nombres ambiguos en silencio.
- Guardar lote, fecha y resultado de cada importación para poder auditarla.
- Para emparejar nombres, ignorar mayúsculas/minúsculas, espacios redundantes y diacríticos al sugerir coincidencias; conservar siempre el nombre original. Una equivalencia que cambie ñ por n, o cualquier coincidencia con más de un jugador, debe requerir confirmación manual para evitar asignar datos al jugador equivocado.
- En cada lote, el usuario debe confirmar la identidad de todos los nombres de jugador distintos, incluso si se propone un alias guardado. Mantener los vínculos de alias asociados a su fuente para facilitar la siguiente revisión.

## Cálculos y análisis

### Relativización

Cada métrica tendrá una fórmula configurada y documentada en la interfaz. Conservar valor absoluto, valor relativo, unidad y datos antropométricos utilizados. No aplicar una fórmula genérica a todas las variables.

Para **Run-Specific Iso-Push — Peak Force**, primero calcular la media de las repeticiones válidas de cada lado de la sesión. Convertir la masa corporal medida para la fecha del test a peso corporal en Newtons:

- **Peso corporal (N) = masa corporal (kg) × 9.80665 m/s².**
- **Knee y Ankle:** Peak Force relativo (BW) = media de Peak Force del lado (N) ÷ peso corporal (N).
- **Hip:** SW (N) = 0.29 × peso corporal (N); Peak Force relativo (SW) = media de Peak Force del lado (N) ÷ SW (N). Esto equivale a 29% del peso corporal en N. Se interpreta la notación “0,29%” del mensaje a partir del ejemplo numérico: 0.29 × 764.9 N = 221.8 N; no usar 0.29% literal.

Usar la medición de masa corporal válida para la fecha del test, siguiendo la ventana temporal antropométrica definida. No restar el peso corporal al Peak Force: se divide la media de Peak Force por el denominador correspondiente (BW o SW). Conservar los valores absolutos en N y los relativos en BW o SW; mostrar los relativos a dos decimales y utilizar los valores sin redondear para cálculos posteriores.

Calcular la asimetría de Peak Force con la fórmula indicada por el usuario, usando las medias de sesión izquierda y derecha:

**Asimetría (%) = (Derecha − Izquierda) ÷ MAX(Izquierda, Derecha) × 100** *(cambio del 6 de noviembre de 2026, D25; la fórmula original era (Izquierda − Derecha) ÷ MAX × 100, con el signo contrario).*

En Excel, si I4 contiene Izquierda y J4 Derecha: `=(J4-I4)/MAX(I4:J4)*100`. Un valor positivo indica mayor Peak Force derecha; un valor negativo, mayor Peak Force izquierda. Aplicar la fórmula al Peak Force de la misma sesión; al usar la misma normalización a ambos lados, el porcentaje de asimetría también coincide con el calculado con los valores relativos.

Ejemplos aportados por el usuario:

| Test | Masa corporal | Peso corporal | Denominador | Peak Force izquierda | Peak Force derecha | Relativo izquierda | Relativo derecha | Asimetría |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Knee Iso-Push | 77.0 kg | 755.1 N | BW = 755.1 N | 2762 N | 2974 N | 3.66 BW | 3.94 BW | +7.1% |
| Hip Iso-Push | 78.0 kg | 764.9 N | SW = 221.8 N | 420 N | 396 N | 1.89 SW | 1.79 SW | −5.7% |

La fórmula relativa de **RFD at 100 ms** sigue pendiente y no debe suponerse a partir de la de Peak Force.

### Percentiles propios

Calcular percentiles por test, protocolo, variable, unidad y tipo de dato (absoluto o relativo) compatibles. Como vistas principales, mostrar dos percentiles distintos:

- **Percentil de la media de todas las repeticiones:** para cada jugador, calcular primero la media de todas sus repeticiones válidas del periodo seleccionado para ese test, protocolo y variable. Comparar después esos promedios entre jugadores, usando un único valor por jugador. Si no se selecciona periodo, usar todo el historial disponible. Mostrar el periodo y el número total de repeticiones que contribuyeron al promedio de cada jugador.
- **Percentil de la media de la última sesión:** para cada jugador, localizar su sesión válida más reciente dentro del periodo seleccionado, calcular la media de sus repeticiones válidas de esa sesión y comparar esos valores entre jugadores, usando un único valor por jugador. Mostrar la fecha y el número de repeticiones de la sesión usada.

No calcular estas distribuciones usando las repeticiones como observaciones independientes: cada jugador aporta un resumen por comparación, para evitar que quienes tienen más intentos o sesiones pesen más que el resto. Mostrar:

- Percentil de la base completa.
- Percentil por posición.
- Número de jugadores incluidos en cada comparación.
- Fechas, protocolo y criterio usados para formar el grupo de referencia.

Usar y documentar un percentil empírico por rango medio: percentil = 100 × (número de valores inferiores + 0,5 × número de valores empatados) / N. Mostrar siempre el tamaño de muestra; cuando sea pequeño, señalar la incertidumbre en vez de presentar el percentil como una clasificación precisa.

El tamaño mínimo de muestra para considerar un percentil suficientemente estable todavía debe definirse. No inventar un umbral: mostrar N, señalar la incertidumbre y dejar el umbral configurable; mientras no esté configurado, no presentar el color como una clasificación fiable.

La posición utilizada debe ser la de la fecha de evaluación o la clasificación que el usuario haya seleccionado. No mezclar grupos de posición sin indicarlo.

### Dirección de interpretación

Mantener separado el percentil estadístico del sentido de rendimiento. Para variables configuradas como “más alto es mejor”, el percentil orientado a rendimiento coincide con el estadístico; para “más bajo es mejor”, será 100 menos el percentil estadístico. Identificarlo siempre como percentil orientado a rendimiento. Para variables con rango objetivo, mostrar el percentil estadístico y la distancia al rango objetivo; no inventar un percentil favorable.

### Colores por percentil de rendimiento

En fichas, tablas y gráficos, colorear el percentil orientado a rendimiento con esta escala y mantener siempre visible el valor numérico:

| Percentil orientado a rendimiento | Color |
|---|---|
| 0–<10 | Rojo intenso |
| 10–<35 | Naranja |
| 35–<50 | Amarillo suave |
| 50–<65 | Amarillo intenso |
| 65–<90 | Verde suave |
| 90–100 | Verde intenso |

Los límites no se solapan: P10 pertenece a naranja, P35 a amarillo suave, P50 a amarillo intenso, P65 a verde suave y P90 a verde intenso; P100 se incluye en verde intenso. No colorear como favorable/desfavorable las variables con rango objetivo, percentiles inválidos, muestras insuficientes o comparaciones incompatibles. Usar colores legibles y no depender únicamente del color para transmitir el resultado.

#### Presentación del color en casillas y marcadores

- El valor se muestra en una casilla o marcador cuyo color corresponde al percentil de la **referencia seleccionada**, con la escala anterior (0–10 rojo intenso, 10–35 naranja, 35–50 amarillo suave, 50–65 amarillo intenso, 65–90 verde suave, 90–100 verde intenso, con los límites no solapados indicados arriba).
- La casilla identifica siempre, con texto, de qué referencia procede el color: «Percentil de La Liga» o «Rango de la Premier League», con su fuente. Si se seleccionan varias referencias, hay un marcador por referencia; nunca un único color ambiguo.
- **Sin referencia suficiente** (sin referencia, muestra por debajo del umbral, comparación incompatible o dato inválido): casilla neutra con el texto «No disponible» y el motivo. No se asigna color como si hubiera un percentil.
- **Premier League con rangos:** cuando el rango de percentil queda dentro de una sola banda de color, esa banda es el color. Cuando el rango abarca varias bandas, la regla de color está **pendiente (D14)**: no se resuelve por defecto.
- Variables con rango objetivo y umbrales o targets de bibliografía: sin color favorable/desfavorable (regla ya indicada arriba).

### Evolución individual

En la ficha de cada jugador, permitir seleccionar test, variable, protocolo y fechas para ver todos los registros en orden cronológico y su gráfico. El resultado estándar de cada sesión es la media aritmética de sus repeticiones válidas. Un único valor importado sin repeticiones identificables equivale a una sesión con una repetición.

En el gráfico longitudinal del test hay **un punto por sesión, que representa el Average de esa sesión**, en su fecha. No se sustituye la serie histórica por un único valor global ni por una serie de máximos individuales. El **Personal Best** y el **Personal Average** se señalan por separado. Las definiciones están en «Valores de seguimiento» (más abajo). Para variables con rango objetivo no se define un Personal Best salvo que el usuario configure el criterio (D23); hasta entonces se muestra la distancia al rango objetivo.

Ofrecer además:

- Cada valoración individual.
- Media de todas las repeticiones válidas del periodo seleccionado, siguiendo la definición del percentil de la media de todas las repeticiones.
- En el histórico, permitir excluir del análisis una sesión o repetición seleccionada, indicando el motivo. La exclusión es reversible y mantiene visible el registro marcado; no contribuye a medias, percentiles, Personal Best, comparaciones ni análisis de relaciones.

En el histórico de cada jugador, añadir **Eliminar datos de esta sesión** para borrar permanentemente las mediciones de ese jugador, test, protocolo y fecha/hora seleccionados. Antes de borrar, mostrar el alcance exacto (jugador, test, fecha, repeticiones y variables afectadas) y pedir confirmación; no eliminar otras sesiones, tests ni el perfil del jugador. Retirar también sus valores derivados de cálculos y vistas. Registrar la acción sin conservar los valores eliminados. Explicar que una copia de seguridad descargada antes del borrado todavía puede contenerlos y que restaurarla los recuperaría.

En el Personal Best mostrar la fecha y la media de sesión que lo originó para cada variable. Las sesiones excluidas se identifican en el histórico, pero se omiten de forma predeterminada de los análisis. Eliminar una sesión es permanente en la base activa; la exclusión es reversible.

### Valores de seguimiento

Cada valor tiene un nombre propio, distinto de los demás, que se usa tal cual en tablas y gráficos. Un valor se rotula siempre con su nombre completo: nunca «media» a secas cuando haya otro candidato, y «Max» no se usa como nombre de ningún indicador.

Definiciones (decisión D12 del usuario, cerrada el 5 de noviembre de 2026). Solo cuentan las repeticiones y sesiones válidas; se excluyen las marcadas como inválidas, eliminadas o excluidas. Un único resultado importado cuenta como una repetición. Se conservan siempre las repeticiones originales.

| Nombre | Definición | Qué muestra siempre |
|---|---|---|
| **Average de sesión** | Media de las repeticiones válidas de esa sesión. Es el valor de cada punto del gráfico longitudinal. | Fecha y número de repeticiones válidas. |
| **Resultado actual** | Average de la sesión válida más reciente dentro de los filtros activos. Se distingue visualmente del Personal Best aunque coincidan. | Su fecha. |
| **Personal Average** (Average global) | Media de **todas las repeticiones válidas** del mismo jugador, test, protocolo y variable durante el periodo seleccionado (todo el historial si no se selecciona). Es ponderada por el número de repeticiones cuando la fuente solo aporta resúmenes de sesión (se pondera por `Reps`). No es la media de las medias de sesión. | Periodo, número de sesiones y número total de repeticiones que contribuyen. |
| **Personal Best** | El resultado de la sesión cuyo Average sea el mejor según la dirección de interpretación de la variable: si un valor más alto es mejor, el Average de sesión más alto; si un valor más bajo es mejor, el más bajo. Con rango objetivo, no se define hasta que el criterio esté configurado (D23); sin dirección definida, tampoco. **No es la repetición individual más alta.** | Valor y fecha de la sesión que lo originó. |
| **Máxima repetición** | La repetición individual de mayor valor de una sesión. Se conserva junto con todas las repeticiones originales y, si se muestra, va en el detalle de la sesión, **separada del Personal Best**: no forma una serie en el gráfico longitudinal y no se rotula «Max». | Valor y sesión a la que pertenece. |

Disponibilidad con VALD «All Average»: permite calcular el Personal Best comparando los Average de las sesiones y el Personal Average ponderando cada Average de sesión por `Reps`; **no** permite recuperar la Máxima repetición (se muestra «no disponible»; nunca se deriva del Average).

**Empates:** cuando dos sesiones comparten el mejor Average (Personal Best), se muestra la más reciente (D22, cerrada el 6 de noviembre de 2026).

**Resultado de sesión según el tipo de test (D5, decidida el 6 de noviembre de 2026):** las definiciones de Average de sesión, Personal Average y Personal Best de esta tabla valen para los tests con repeticiones y valor medio. Para otros tests el resultado de la sesión es distinto:

- **Nordic:** la media de cada sesión, con total, derecha e izquierda.
- **RM e Iso-Hold:** únicamente la **carga máxima** movilizada hasta el momento, como referencia para prescribir. No hay Average de sesión ni Máxima repetición; el Personal Best sería la mayor carga y no se calcularía Personal Average (consecuencia de lo anterior, pendiente de confirmar).
- **Iso-Hold (fórmulas del Excel del usuario, 6 de noviembre de 2026):** la carga es la **carga externa añadida** máxima con la que se han trabajado 3 series de 20 segundos, en kg, y se introduce a mano (no viene de VALD). Se calculan:
  - **MVIC iso-push (kg)** = (media de la Peak Force de izquierda y derecha del Iso-Push − peso corporal en N) ÷ 9,80665. En Hip se resta el SW en N (0,29 × peso corporal en N) en lugar del peso corporal. **Aquí sí se resta el peso corporal;** la frase «no restar el peso corporal al Peak Force» de «Relativización» se refiere al Peak Force relativo (BW o SW), no a esta variable.
  - **%PIMA** = carga externa ÷ MVIC iso-push (kg). La etiqueta se conserva tal como la escribe el usuario; no se expande la sigla.
  - **%BW** = carga externa ÷ peso corporal (kg), en Knee y Ankle. En Hip el Excel calcula **%SW** = carga externa ÷ SW en kg.
  Confirmado el 6 de noviembre de 2026: SW solo en Hip; Knee y Ankle usan BW; la Peak Force del Iso-Push es el **average de todas las repeticiones realizadas** (de ambos lados), no la media simple de las dos medias de lado que usa el Excel (coinciden cuando hay las mismas repeticiones en ambos lados). La gravedad es siempre 9,80665 (el Excel usa 9,8 en %SW; en la aplicación no). El resultado de la sesión de Iso-Hold es la carga máxima y se usa solo como referencia para monitorizar la carga. El usuario introduce la carga externa y la aplicación calcula las variables en relación al average de Iso-Push, **sin depender de la fecha del Iso-Hold**. Confirmado (14:08): «average de Iso-Push» es el **Personal Average** del jugador (todas las repeticiones válidas, sin sesiones excluidas). Peso corporal: la MVIC usa el de cada sesión de Iso-Push (D27); %BW y %SW usan la medición más reciente dentro de la ventana contada hasta hoy y, si no hay, «no disponible». El Iso-Push e Iso-Hold de tobillo sentado funcionan igual (BW; MVIC, %PIMA y %BW) y tienen su propio Iso-Hold. Pendiente en D5: el 1RM estimado del Excel.

### Comparaciones externas

El usuario podrá seleccionar como referencia la base propia global, la base propia por posición o una referencia externa disponible. Mostrar con claridad qué fuente se ha elegido y no mezclar referencias incompatibles en una misma comparación.

## Vistas del dashboard

### Ficha de jugador

- Datos básicos y antropometría con historial.
- Bloques de evaluación: manifestaciones de la fuerza, perímetros y NME. Mostrar solo las medidas y tests definidos y configurados.
- Evolución por test y variable.
- Valores absolutos, relativos, percentiles y referencias disponibles.
- Filtros por fechas, protocolo y registros incluidos.
- Promedio y Personal Best con la fecha correspondiente.

Al seleccionar **Max Isometric Strength** en la ficha del jugador, abrir una vista conjunta de los tests de esa cualidad en **Groin, Hip, Knee y Ankle**. Aplicar el mismo flujo a **Heavy Dynamic Strength**. Mostrar el área y el test de cada resultado y permitir abrir un test concreto.

Al seleccionar un test concreto, abrir ese test para todos los jugadores de la base, conservando el test y protocolo seleccionados. El resultado comparado por jugador y sesión es la media de sus repeticiones válidas de ese día y se muestra el número de repeticiones. Esta comparación no sustituye al histórico individual ni al Personal Best.

**Cambio del 7 de noviembre de 2026 (D33):** en la tabla de un test (todos los jugadores) y en la tabla de un jugador (todos sus tests), el valor por defecto es el **Personal Average**; un filtro superior permite pasar las tablas a **Personal Best**; pulsar un resultado o el nombre del jugador abre el gráfico longitudinal (G1) de ese test con toda su evolución individual. Falta decidir en qué grupo de posición aparece un Personal Average (D33a) y el destino del histórico completo y de la última sesión (D33b); lo que sigue sobre el «Average de la última sesión» como opción inicial queda **superado**.

**Vista comparativa de un test (D10, D11 y D13, decididas):** al abrir un test, la vista muestra inicialmente el **Average de la última sesión válida de cada jugador**, con su fecha, y ofrece consultar el **Personal Best** (para cada jugador, el Average de sesión que represente su mejor rendimiento según la dirección de la variable, con valor y fecha) o el **histórico completo** (el Average de cada sesión válida, con su fecha). Con rango objetivo sin criterio configurado, el Personal Best figura «no definido». El selector empieza en Average (última sesión válida). En todas las vistas históricas se muestra la fecha de cada resultado y cada resultado se agrupa según la posición principal vigente en la fecha de esa sesión (D11), no la actual. El orden de los grupos de posición es el que el usuario configure (D9).


### Presentación de lateralidad

Cuando se muestren resultados de los dos lados de un test unilateral o una medición lado a lado, el **lado izquierdo siempre ocupa la parte izquierda de la pantalla** y el **lado derecho la parte derecha**. Mantener esa correspondencia en fichas, tablas, gráficos, comparaciones y exportaciones; no reordenar los lados según el valor, el lado dominante ni cuál obtiene el mejor resultado. En pantallas estrechas, conservar ambos lados en columnas con desplazamiento horizontal si hace falta, sin invertir su orden. Etiquetar siempre cada lado de forma explícita.

La navegación, los nombres de las cualidades y los tests visibles deben depender del catálogo configurado; no asumir que existe un test para cada área.

### Vista de test para toda la plantilla

Permitir seleccionar un test y una variable y ver los resultados de todos los jugadores en una tabla y visualización. Esta vista también se abre al seleccionar un test desde la ficha del jugador. El resultado por jugador y sesión es la media de las repeticiones válidas de ese día; mostrar cuántas repeticiones sustentan cada media. Filtrar por posición, fecha, protocolo y registro válido. Mostrar resultados originales y relativos, no únicamente percentiles. Permitir ordenar por valor, jugador, fecha o posición y exportar la vista a CSV o Excel.

### Relaciones entre variables

Incluir una vista exploratoria para relacionar variables de distintos tests, tanto entre jugadores como a lo largo del tiempo. Debe:

- Exigir selección explícita de variables, unidad/normalización, periodo y población.
- Separar asociaciones entre jugadores de cambios dentro del mismo jugador.
- Usar por defecto una observación por jugador en el análisis transversal; no tratar todas las mediciones repetidas como independientes.
- Mostrar gráfico, método estadístico y número de observaciones.
- Describir asociaciones, no causalidad. No diagnosticar ni recomendar tratamientos o cargas automáticamente.
- Evitar conclusiones automáticas cuando haya datos insuficientes o comparaciones incompatibles.

## Gráficos y visualizaciones

Esta sección especifica los gráficos. Los dos informes de ejemplo mencionados por el usuario sirven como referencia de estilo y de tipos de visualización; **no son fuente de datos** ni un modelo que haya que copiar exactamente. Los gráficos no se programan hasta que el usuario revise esta especificación.

### Reglas comunes

1. **Dos familias separadas, no intercambiables:** (A) **evolución temporal**, que muestra una variable a lo largo de las sesiones, y (B) **comparación con referencias**, que sitúa un resultado frente a percentiles, rangos, umbrales u objetivos. Un gráfico de una familia no sustituye al de la otra.
2. **Un gráfico por variable o por conjunto de variables comparable.** No se comparten escalas entre unidades o tipos de dato incompatibles (por ejemplo, absoluto frente a relativo, o N frente a BW).
3. **El gráfico no sustituye a la tabla.** Todo gráfico muestra etiquetas, unidades, fechas, leyenda y valores consultables (tabla equivalente en la misma pantalla o desplegable).
4. **Tres tipos de información, siempre distinguibles** por texto, forma y leyenda (no solo por color): **datos observados** (repeticiones y medias de sesión), **valores calculados** (relativos, personal best, personal average, asimetría, percentiles, parámetros fuerza-velocidad) y **referencias** («La Liga», Premier League, bibliografía, targets).
5. **Filtros comunes**, cuando los datos existan: jugador, test, protocolo, variable, rango de fechas, lado, posición y grupo de referencia.
6. **Sesiones excluidas** (por lesión u otro motivo): se reflejan en el gráfico con un marcador propio y su motivo consultable, no contribuyen a ningún cálculo, y su estado se puede revisar y revertir. Puede ocultarse su visualización, no su existencia en la tabla.
7. **Datos ausentes:** no se rellenan ni se estiman. Se indica «no disponible» y el motivo (sin referencia, muestra insuficiente, comparación incompatible, fórmula no definida, datos insuficientes).
8. **Lateralidad:** en cualquier comparación visual de ambos lados, izquierda a la izquierda y derecha a la derecha, con etiqueta explícita (ver «Presentación de lateralidad»).
9. **Datos sintéticos:** cualquier gráfico que muestre datos sintéticos lo indica visiblemente.
10. **Accesibilidad:** contraste suficiente, foco visible, valores accesibles por teclado y tabla alternativa; el color nunca es el único portador de significado.
11. **Nada de datos ficticios como si fueran reales:** los ejemplos de documentación y pruebas usan datos sintéticos identificados como tales.

### Catálogo de gráficos

#### G1. Evolución longitudinal de un jugador (familia A)

- **Contenido:** para un mismo test, variable y protocolo (y lado), serie temporal con un punto por sesión, ordenadas por fecha. Cada punto es el **Average de esa sesión** y muestra valor, unidad, fecha y número de repeticiones. Se señalan por separado el **Personal Best** (con su fecha) y el **Personal Average** (con su periodo, nº de sesiones y nº de repeticiones), además del **resultado actual** (último punto) y las sesiones excluidas. La **Máxima repetición** de cada sesión, si se muestra, va en el detalle de la sesión, no como serie del gráfico.

- **Tests unilaterales:** paneles lado a lado, izquierda a la izquierda y derecha a la derecha, con el mismo eje.
- **Datos necesarios:** sesiones válidas y excluidas (fecha, hora si existe, estado y motivo), repeticiones válidas con su valor original, unidad original y normalizada, lado, dirección de interpretación (para el personal best) y, para valores relativos, la antropometría usada y la versión de la fórmula.
- **No disponible o limitado:** sin sesiones válidas no hay gráfico; personal best sin dirección de interpretación o con rango objetivo no se define; relativo sin antropometría válida se muestra como absoluto con aviso.

#### G2. Comparativo del perfil del jugador (familia B)

- **Contenido:** compara el **valor actual relativo** con las referencias **disponibles** para ese test y variable: personal best, personal average, «La Liga», Premier League y target. Cada referencia lleva una leyenda inequívoca con su valor, unidad y origen.
- **Reglas:** solo se dibujan las referencias disponibles; las ausentes se listan aparte con su motivo y no se sustituyen por datos ficticios. Escala común **solo** si las magnitudes son comparables (misma variable, unidad, tipo de dato y fórmula); si no, la referencia aparece en la tabla como «no comparable».
- **Datos necesarios:** valor actual relativo (con unidad, fórmula y antropometría), personal best y personal average (con fechas, periodo y n), distribución o percentiles de «La Liga» con su N, rangos de la Premier League con su metadato completo, y targets configurados con su fuente.

#### G3. Perfil radial de varias variables (familia B)

- **Contenido:** resume variables relacionadas (por ejemplo, de CMJ; el conjunto lo elige el usuario) comparando al jugador con referencias seleccionadas cuando existan.
- **Reglas:** se indican las variables y sus unidades. **No se mezclan unidades en una escala radial** sin documentar la normalización (por ejemplo, percentiles) y los valores originales quedan accesibles en una tabla. En variables donde un valor bajo es mejor se usa el percentil orientado a rendimiento. Una variable sin datos o sin referencia se omite del radar y se lista aparte.
- **Datos necesarios:** el conjunto de variables, valor y unidad de cada una, normalización elegida y documentada (D16), dirección de interpretación y referencias con su N.

#### G4. Comparación con referencias y umbrales (familia B)

- **Contenido:** gráficos de puntos o escalas que sitúan un resultado frente a percentiles, rangos u objetivos. Se identifican siempre población, posición (si aplica), periodo, estadístico y fuente.
- **Reglas:** referencias externas, umbrales bibliográficos y targets individualizados son **opcionales y configurables**. Si la referencia no está disponible o la muestra es insuficiente, se muestra «no disponible» o «muestra insuficiente» con el N.
- **Datos necesarios:** el resultado a comparar, el metadato completo de cada referencia y, para el color, las reglas de «Colores por percentil de rendimiento» y D14.

#### G5. Asimetría (familia A y B)

- **Contenido:** el porcentaje de asimetría con la fórmula acordada **(derecha − izquierda) ÷ máx(izquierda, derecha) × 100**, **conservando el signo** (positivo: domina la derecha; negativo: domina la izquierda; «dominante» es el lado con el valor más alto). *Cambio del 6 de noviembre de 2026: la fórmula anterior era (izquierda − derecha) ÷ máx × 100, con el signo contrario (D25).* Junto al gráfico se muestran los valores de ambos lados (medias de sesión) y su unidad. Puede mostrarse como serie por sesión y como valor de la sesión actual.
- **Alcance:** solo para variables con la fórmula acordada (Run-Specific Iso-Push). Las columnas de asimetría que entrega VALD (magnitud con lado) se muestran tal cual, sin convertirlas a signo ni aplicarles esta fórmula.
- **Datos necesarios:** medias de sesión izquierda y derecha de la misma sesión, unidad y, si se desea, una referencia o umbral con su fuente.

#### G6. Perfil fuerza-velocidad (familia A y B; condicionado)

- **Contenido:** para los tests que lo permitan, carga y velocidad por repetición y los parámetros calculados F0, V0 y potencia óptima **solo cuando haya datos suficientes y la fórmula esté definida** (D17). Se documenta el método. Nunca se infieren estos parámetros de un único resultado.
- **Datos necesarios:** carga de cada medición junto a sus variables de velocidad o fuerza, número mínimo de cargas y repeticiones definido por el usuario, método de ajuste documentado y resultado de sesión definido para estos tests (D5).

#### G7. Curvas de fuerza/tiempo u otras señales (condicionado)

- **Contenido:** curva de una repetición. Se distingue de la evolución entre sesiones (G1) y no la sustituye.
- **Condición:** solo si el archivo importado contiene las señales necesarias. **No se asume que el formato «All Average» incluya señales detalladas.** Almacenar señales cambia el volumen y el modelo de datos y requiere una decisión previa.
- **Datos necesarios:** serie de valores con su eje de tiempo, frecuencia de muestreo, unidad y referencia a la repetición.

#### G8. Cuadrantes o mapas de indicadores (condicionado)

- **Contenido:** vistas como **DSI/EUR** (las siglas se conservan como las aportó el usuario).
- **Condición:** solo si se definen las variables de cada eje y los límites de las zonas (D18). No se asignan cuadrantes automáticamente sin esos umbrales.
- **Datos necesarios:** variables de cada eje con unidad, límites de las zonas con su fuente y población a la que se aplican.

### Estilo y biblioteca de gráficos (cerrado el 6 de noviembre de 2026)

Se han revisado los dos informes de ejemplo (19 páginas cada uno). Se usan **solo como referencia de estilo y de tipos de visualización**: ninguno de sus valores, jugadores, fotografías, escudos o referencias se trata como dato del dashboard, y el estilo no se copia exactamente.

**Qué muestran los informes y cómo se traduce a esta especificación**

| Visualización en los informes | Gráfico de la guía | Cómo se construye |
|---|---|---|
| Escala horizontal MIN–MAX por variable: marcadores de referencia por encima de la línea y marcadores del jugador por debajo (círculo azul con «L», círculo naranja con «R»; círculo blanco cuando no hay lado), valor junto a cada marcador y corchete con el porcentaje de asimetría | G4 (y la parte de referencias de G2) | SVG propio con Preact, sin biblioteca |
| Hexágono (seis variables) y triángulo (tres variables) con dos polígonos de referencia (mediana de la Premier League y de la base propia) y el polígono del jugador | G3 | Radar de la biblioteca de gráficos |
| Barras horizontales de asimetría a lo largo del tiempo, con el porcentaje en la barra | G5 | Barras de la biblioteca |
| «Normative benchmarking»: barras agrupadas con el valor de la sesión (izquierda y derecha), el Personal Average (el informe lo llama «personal healthy average»; en la aplicación no existe ese concepto: es el Personal Average sin las sesiones excluidas) y la referencia (izquierda y derecha) | G2 | Barras de la biblioteca |
| Dispersión carga–velocidad con recta de ajuste, ecuación, R², recta de «perfil equilibrado» y tabla con potencia óptima, F0 y V0 | G6 (fase 8) | Dispersión y línea de la biblioteca |
| Curvas fuerza/tiempo de un salto, varias series (captura de VALD Hub en uno de los informes) | G7 (fase 8) | Líneas de la biblioteca |
| Cuadrante DSI/EUR con solo las etiquetas «alto/bajo», **sin ejes numéricos ni límites de zona** | G8 (fase 8) | SVG propio; no se puede derivar nada de los informes (D18) |

**Lo que los informes no aportan:** ninguno contiene una serie temporal de varias sesiones, de modo que **G1 (la primera que se programa) no tiene modelo visual en los informes** y se diseña con las reglas de esta guía. Tampoco usan el código de color por percentiles: sus marcadores son medianas (P50), no percentiles del jugador; la casilla coloreada por percentil es un requisito nuevo de esta guía.

**Reglas de estilo adoptadas**

- **Aspecto:** tema oscuro por defecto, como en los informes, y **tema claro obligatorio** (los informes solo son oscuros; el modo claro es requisito de esta guía). Títulos en mayúsculas con tipografía condensada del sistema; no se incorporan ficheros de fuente (la política de seguridad no los permite sin cambiarla). Fechas `dd/mm/aaaa` y coma decimal.
- **Izquierda y derecha:** izquierda siempre azul y a la izquierda; derecha siempre naranja y a la derecha; el marcador lleva además la letra «L» o «R» (no depende solo del color).
- **Colores de las cuatro cualidades de fuerza** (isométrica máxima, dinámica pesada, dinámica rápida, reactiva; marco de James et al.): rojo salmón, verde, lila y azul claro en los informes. **Se usan solo en títulos y acentos, nunca en marcadores, series ni casillas de valor**, porque el rojo y el verde se confundirían con los colores de los percentiles.
- **Referencias neutras y distinguibles por forma, no por color:** mediana de la Premier League, mediana de «La Liga», umbral de bibliografía y target se dibujan con marcadores o trazos distintos (por ejemplo línea discontinua, línea continua, icono de documento, icono de bandera) y siempre con etiqueta de texto. **Se evita el amarillo y el verde en las referencias** porque pertenecen al código de color de percentiles. Esto se aparta de los informes (línea amarilla para la base propia, bandera verde para el target) y es deliberado.
- **Color de percentil:** solo en la casilla o marcador del valor del jugador, con el código de esta guía y la etiqueta de la referencia que lo origina. Sin referencia suficiente: casilla neutra con el texto «No disponible» (los informes usan «N/V»); un dato ausente **nunca se dibuja como cero**.
- **Escudos, logotipos y fotografías:** no se incorporan; las referencias se identifican con texto y con iconos propios.
- **Leyenda:** cada referencia indica estadístico, población, posición si aplica, periodo, tamaño de la muestra y fuente (los informes solo indican, por ejemplo, «mediana, 2023–2026»).
- **Valores consultables y tabla equivalente** junto a cada gráfico, sin excepción.

**Biblioteca de gráficos: Chart.js 4.6.1 (dependencia: @kurkle/color 0.3.x), solo los componentes necesarios, más SVG propio para las escalas de referencia (G4) y los cuadrantes (G8)**

Verificado el 6 de noviembre de 2026, empaquetando únicamente líneas, dispersión, barras y radar con esbuild 0.28.2:

| Comprobación | Chart.js 4.6.1 | uPlot 1.6.32 (alternativa evaluada) |
|---|---|---|
| Publicada hace al menos 14 días | Sí (22/10/2026, 15 días) | Sí (14/03/2025) |
| Licencia | MIT (@kurkle/color: MIT) | MIT |
| Tamaño del paquete minimizado | 180 KB (64 KB comprimido) | 51 KB (23 KB comprimido) |
| `eval` / `new Function` en el paquete | No | No |
| Con la política de seguridad del proyecto en Chromium 153 (Playwright), con `default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'none'` | Dispersión con recta, radar, barras horizontales y líneas pintados; 0 violaciones | Línea pintada; 0 violaciones (requiere su hoja de estilos como fichero propio) |
| Radar (G3), barras (G2, G5), dispersión con ajuste (G6) | Sí | No incluye radar; barras y dispersión con trabajo propio |

**Motivos:** cubre G1, G2, G3, G5, G6 y G7 con una sola biblioteca, cumple la política de seguridad sin cambios y su tamaño es asumible para un fichero único copiado al repositorio. uPlot es mucho más pequeño y más rápido con series largas, pero no tiene radar; se reserva como alternativa **solo para G7** si Chart.js resulta lento con señales. ECharts (60 MB de paquete, 6.1.0) se descarta por tamaño y por no aportar nada que falte. Las escalas de referencia y los cuadrantes se hacen en SVG propio porque ninguna biblioteca las trae y el SVG permite foco, etiquetas y texto accesibles.

**Lo que no está verificado y se comprobará al integrarla (fase 5a):** el rendimiento con el volumen real (no se midió); el comportamiento en Chrome real (la prueba fue en Chromium 153, no en Chrome 156); los colores en tema claro y oscuro (no se probaron); y la accesibilidad: los gráficos de lienzo (canvas) **no son legibles por lectores de pantalla**, por eso la tabla equivalente es obligatoria y no un complemento. Si alguna comprobación falla, la decisión D20 se reabre.


### Qué gráficos entran en cada fase

| Gráfico | Fase | Datos de los que depende |
|---|---|---|
| G1 Evolución longitudinal | 5a | Catálogo, sesiones y repeticiones (fases 2 a 4) |
| G5 Asimetría | 5a | Iso-Push con ambos lados (fase 2) |
| G4 Comparación con referencias | 5b (forma básica, sin referencias externas) y 5c (completa) | Referencias externas y percentiles |
| G2 Comparativo del perfil | 5c | Percentiles y referencias |
| G3 Radial | 5c | Percentiles y normalización (D16) |
| G6 Fuerza-velocidad | Sin fase asignada; se propone una fase 8 condicionada (pendiente de confirmar) | D5 y D17 definidos; datos de carga y velocidad |
| G7 Curvas de señales | Sin fase asignada; fase 8 condicionada propuesta | Archivos con señales y decisión de modelo de datos |
| G8 Cuadrantes | Sin fase asignada; fase 8 condicionada propuesta | D18 definido |

Las fases 5a, 5b y 5c fueron aprobadas por el usuario el 4 de noviembre de 2026 (ver «Proceso de construcción por fases»). La **biblioteca de gráficos** se decide antes de la primera fase con gráficos (D20).

## Seguridad, acceso y mantenimiento

- Los datos de jugadores y mediciones deben permanecer localmente en el navegador del portátil; no enviar contenido de Excel, mediciones ni datos personales a servicios externos. No incluir analítica o telemetría.
- Si la interfaz se sirve desde una URL, usar conexión HTTPS y mantener un origen estable para que la base local siga asociada a la aplicación. La URL no contiene ni expone los datos.
- No usar datos reales en ejemplos, capturas, prompts o repositorios durante la programación.
- Incluir botones visibles **Crear copia de seguridad** y **Restaurar copia**. La copia completa descargable debe incluir jugadores, posiciones, antropometría, perímetros, configuración de los bloques de fuerza/perímetros/NME, catálogo, protocolos, sesiones, repeticiones originales, importaciones/mapeos y configuración necesaria para recalcular resúmenes. Incluir fecha y versión del formato.
- Antes de restaurar, validar la copia y mostrar un resumen; no sobrescribir los datos actuales hasta que el usuario confirme. Probar y documentar el proceso de recuperación.
- Distinguir la copia completa de las exportaciones parciales a CSV/Excel. Mostrar cuándo se creó la última copia y facilitar descargarla en una ubicación elegida por el usuario.
- Explicar que los datos locales no se sincronizan: para usarlos en otro portátil hay que restaurar una copia. Si se limpia el almacenamiento del navegador o se pierde el portátil antes de descargar una copia, los datos pueden perderse.

### Alternativa futura: SharePoint y acceso desde varios dispositivos

La decisión actual sigue siendo almacenamiento local para uso individual; mencionar SharePoint no cambia esa arquitectura. Guardar el HTML o la aplicación en SharePoint no sincroniza por sí solo la base IndexedDB del navegador. Para que varios dispositivos vean los mismos datos, la fuente de datos tendría que estar compartida en SharePoint, con inicio de sesión de Microsoft en cada dispositivo y permisos explícitos para la aplicación. Para datos estructurados como jugadores, sesiones, repeticiones y variables, evaluar listas de SharePoint como almacenamiento antes que tratar un único Excel como base de datos.

Una aplicación web que lea o escriba esas listas necesitará autenticación y llamadas autorizadas a Microsoft Graph o a las API de SharePoint; no basta con enlazar un HTML a un archivo. La documentación de Microsoft muestra que las solicitudes a listas usan autorización y permisos de Graph, y que una solución de SharePoint Framework requiere empaquetado/despliegue y aprobación de permisos por el administrador del tenant. Por tanto, consultar con TI si la organización permite la aplicación y si su licencia de Microsoft 365/SharePoint cubre el uso; no prometer que la opción sea gratuita ni que esté disponible sin configuración. Fuentes oficiales: [List items en Microsoft Graph](https://learn.microsoft.com/en-us/graph/api/listitem-list?view=graph-rest-1.0), [usar Microsoft Graph en SharePoint Framework](https://learn.microsoft.com/en-us/sharepoint/dev/spfx/web-parts/get-started/using-microsoft-graph-apis) y [autenticar una aplicación JavaScript](https://learn.microsoft.com/en-us/entra/identity-platform/tutorial-single-page-app-javascript-configure-authentication).

Si en el futuro se aprueba SharePoint, conservar las copias completas descargables y probar recuperación, permisos, concurrencia y acceso desde cada dispositivo. Evaluar ese cambio como una fase de arquitectura separada; no convertir la aplicación a nube automáticamente.

## Forma de trabajo para Claude gratuito

Trabajar en entregas pequeñas y secuenciales. No generar toda la aplicación en una sola respuesta.

- Mantener un archivo de decisiones del proyecto, diccionario de datos y README actualizados.
- Antes de modificar un proyecto existente, inspeccionar sus archivos y explicar brevemente qué va a cambiar.
- En cada entrega, tocar únicamente los archivos necesarios, indicar la ruta de cada archivo y explicar cómo integrarlo.
- No sustituir todo el proyecto por una versión nueva ni eliminar funciones existentes sin pedirlo.
- Usar exclusivamente datos ficticios en ejemplos.
- Si una respuesta puede quedar demasiado larga, dividir la fase y pedir continuar desde el último archivo; no omitir archivos en silencio.
- No empezar una fase si falta una decisión que cambie el modelo de datos. En ese caso, indicar la decisión pendiente y proponer opciones concretas.
- Comprobar que los datos persisten al cerrar y volver a abrir el mismo navegador y que una copia descargada se puede restaurar. Confirmar que los datos no aparecen en otro navegador/dispositivo salvo que se restaure manualmente una copia.
- Si se necesita alojamiento estático, verificar sus límites, coste y estabilidad de la URL. Confirmar que no recibe datos de jugadores.

# Proceso de construcción por fases

Pega primero el **Mensaje maestro** en Claude. Después envía solo el prompt de la fase que quieras trabajar. Guarda la respuesta y los archivos de cada fase antes de avanzar.

## Mensaje maestro para Claude

Estoy creando un dashboard de rendimiento para uso personal. La especificación completa está en el documento “Guía de proyecto: dashboard de datos de rendimiento para fútbol”; úsala como requisito de producto.

No tengo intención de introducir datos reales de jugadores en Claude. Usa exclusivamente datos sintéticos. La aplicación sí tendrá que permitir que yo importe mis Excel cuando esté desplegada.

El requisito central es una aplicación web sin instalador, que se abra desde un enlace estable en el navegador de mi portátil. Los datos deben guardarse localmente en ese navegador, no en un servidor ni en una base de datos en la nube. No necesito sincronización ni acceso desde otros dispositivos. La aplicación debe ofrecer copias completas descargables y restaurables. Usa exclusivamente datos sintéticos durante el desarrollo y no añadas analítica ni servicios que envíen datos fuera del portátil.

En cada importación, pídeme confirmar la identidad de cada nombre de jugador distinto: vincularlo con un jugador existente (por ejemplo, nombre completo de VALD con nombre deportivo del Excel), crear un jugador nuevo o dejarlo pendiente. Sugiere coincidencias ignorando acentos, pero nunca vincules sin confirmación. Permite excluir sesiones de los análisis o eliminarlas permanentemente con confirmación y alcance visible. SharePoint es solo una alternativa futura que se puede describir; no la implementes ni cambies el almacenamiento local sin una decisión explícita.

La navegación del dashboard tendrá tres bloques principales: manifestaciones de la fuerza, perímetros y NME. No inventes la expansión de NME ni su contenido. En cualquier presentación simultánea de ambos lados de un test unilateral, conserva el lado izquierdo a la izquierda de la pantalla y el derecho a la derecha, incluso en diseños estrechos.

No inventes pruebas, variables, unidades, fórmulas relativas, posiciones ni referencias. Diseña el catálogo para que yo pueda configurarlos. Conserva el dato original y su trazabilidad. No borres ni sobrescribas duplicados o conflictos sin informar y pedir resolución.

Trabaja por las fases de este documento, una por una. No desarrolles todo el sistema en una respuesta. Mantén un registro de decisiones y cambios. Si falta una decisión estructural, detente en esa fase, explícala y dame alternativas concretas. Antes de publicar o elegir servicios, verifica la documentación oficial actual, los requisitos de privacidad y los costes previsibles.

## Fase 0 — Diseño antes de programar

Antes de escribir código, devuelve:

1. Arquitectura local propuesta: interfaz web, base de datos en el navegador, formato de copia/restauración y, si se necesita, alojamiento estático de los archivos de la aplicación. Confirma que no se enviará información de jugadores a ese alojamiento.
2. Diagrama sencillo del modelo de datos y explicación de sus relaciones, incluidos los tres bloques principales: fuerza, perímetros y NME.
3. Mapa de pantallas y navegación.
4. Flujo de importación para Excel propio y para VALD, incluida la confirmación manual del jugador para cada nombre de origen en cada lote.
5. Reglas exactas de deduplicación, percentiles, medidas relativas, medias, Personal Best, exclusión reversible y eliminación definitiva de sesiones.
6. Lista de decisiones que todavía debe aportar el usuario, especialmente catálogo de tests, variables, unidades, fórmulas relativas y posiciones, zonas/técnicas/unidades de perímetros y definición de tests/variables de NME. No expandas la sigla NME por inferencia.
7. Riesgos prácticos, costes previsibles del alojamiento estático si se usa, límites del almacenamiento local del navegador y medidas para reducir pérdidas mediante copias manuales. Explica por separado la alternativa SharePoint, sus requisitos de autenticación, permisos y posible aprobación de TI; no des por hecho que sea gratuita. Distingue que en la opción actual la página puede servirse desde un enlace, pero los datos siguen en el navegador local.
8. Especificación de dos percentiles: media de todas las repeticiones válidas del periodo, y media de la última sesión válida de cada jugador dentro del periodo. Explica cómo se construye cada grupo de referencia y muestra N, fechas y número de repeticiones.

No programes todavía. Propón una arquitectura local concreta y mantenible que permita añadir tests sin reescribir la aplicación. Explica cómo el navegador almacenará los datos de forma persistente y cómo crear y restaurar copias completas. Mantén SharePoint como alternativa comparativa separada: no propongas ni implementes base de datos remota, autenticación remota ni sincronización para la arquitectura actual, porque el uso definido es individual en un portátil.

## Fase 1 — Base de la aplicación y datos de jugador

Con el diseño aprobado, construye únicamente el esqueleto responsive, la persistencia local en el navegador, las funciones de copia/restauración, la navegación para fuerza/perímetros/NME y las pantallas de gestión de jugadores, posiciones y antropometría fechada. No inventes medidas de perímetros ni contenido de NME.

Incluye datos sintéticos claramente identificados. No introduzcas tests deportivos todavía. Documenta cómo abrir la aplicación en el portátil sin instalar una app, dónde quedan los datos, cómo exportar/restaurar una copia completa y qué ocurre si se borra el almacenamiento del navegador. No publiques datos reales ni los envíes a servicios externos.

Al terminar, enumera archivos creados/modificados, decisiones tomadas, pasos exactos para continuar y limitaciones pendientes.

## Fase 2 — Catálogo configurable de tests

Preconfigura el catálogo con la lista de manifestaciones, zonas y tests de “Catálogo inicial aportado por el usuario”. Implementa la estructura para añadir/editar tests y protocolos. Para Run-Specific Iso-Push, configura Peak Force en N, la normalización en BW para Knee/Ankle, la normalización en SW para Hip y la asimetría según las fórmulas de “Relativización”; deja pendiente la normalización de RFD at 100 ms. Deja sin definir las variables, unidades y fórmulas de los demás tests hasta que las aporte el usuario. El resultado de sesión depende del tipo de test (D5): media de las repeticiones válidas en los tests con repeticiones y en Iso-Push; media de sesión con total, derecho e izquierdo en Nordic; carga máxima en RM e Iso-Hold. Guarda **una fila por sesión** con, por variable, el valor de cada lado (media de la sesión) y su número de repeticiones (D8); el lado es atributo del valor (D6) y la manifestación de la fuerza, atributo de cada variable (D4). Las repeticiones sueltas podrán añadirse más adelante (son necesarias para la Máxima repetición); nunca se crean a partir de resúmenes. El Personal Average se calcula ponderando por el número de repeticiones.

Mantén **Perímetros** y **NME** como bloques principales configurables aparte de la fuerza. No precargues perímetros, unidades, técnicas, tests ni variables para ellos hasta que el usuario los especifique; conserva la sigla NME sin expandirla.

Configura para CMJ y Reactive Strength exactamente las variables enumeradas en “CMJ — variables aportadas por el usuario” y “Reactive Strength — variables definitivas aportadas por el usuario”. No inventes variables adicionales ni copies las listas de CMJ a SL CMJ o Squat Jump. No infieras unidades no indicadas, significado direccional ni cálculos de asimetrías. Mantén separados el dato absoluto y el relativo y muestra la fórmula aplicada cuando el usuario la haya definido.

Entrega además una plantilla vacía de Excel y un diccionario de datos que expliquen los campos obligatorios y opcionales.

## Fase 3 — Importación de Excel y deduplicación

Implementa el asistente para Excel propio con selección de hoja, vista previa, mapeo de columnas y un paso obligatorio que pida confirmar, para cada nombre de jugador distinto en cada importación, si corresponde a un jugador existente, un jugador nuevo o queda sin resolver. Permite asociar nombres deportivos con los nombres en camiseta y los identificadores estables, bloque de evaluación configurado (fuerza, perímetros o NME), fechas, posiciones, test/medida, protocolo, variables y unidades. Guarda alias por fuente después de confirmarlos, pero vuelve a pedir confirmación en cada lote. No inventes esquemas para perímetros o NME antes de que el usuario los defina.

Añade detección de fichero ya importado, deduplicación exacta de registros, reporte de errores y conflictos, y confirmación antes de guardar. Los registros coincidentes con valores distintos no deben sobrescribirse. Incluye un resumen descargable de la importación y conserva la procedencia de cada dato. No guardes filas de jugadores sin resolver hasta que el usuario las vincule, cree un jugador o las deje pendientes.

Usa un Excel sintético. No uses nombres de jugadores reales.

## Fase 4 — Importador de exportaciones VALD

Añade un segundo flujo de importación que pueda mapear distintos formatos de exportación de VALD mediante una vista previa. Implementa primero el perfil ForceDecks CMJ CSV descrito en esta guía, fijado en All Average para este archivo; permite guardar y reutilizar mapeos, revisar encabezados no reconocidos, unidades, fechas, tests, protocolos, atletas e intentos. Para cada nombre de atleta distinto en cada lote, solicita confirmación de si ya existe y permite vincular el nombre completo VALD a su jugador/nombre deportivo; sugiere alias guardados, pero no los aplica sin confirmación. Solicita confirmación del modo de resumen en perfiles nuevos o modificados cuando no esté confirmado.

No supongas que todos los productos o exportaciones de VALD tienen idéntica estructura. No conviertas filas resumen en repeticiones artificiales, no calcules la Máxima repetición a partir de Average (el Personal Best y el Personal Average sí se calculan con los Average de sesión y `Reps`) y no mapees ABCMJ/LCMJ automáticamente a CMJ, SL CMJ o Squat Jump. No des por importada una fila si su significado es ambiguo. Mantén la misma deduplicación y trazabilidad que en la fase anterior.

## Fase 5a — Perfil del jugador y evolución

Implementa la ficha del jugador con apartados para los tres bloques: fuerza, perímetros y NME. Añade el gráfico longitudinal por test, variable y protocolo (cada punto es el Average de una sesión), con Personal Best y Personal Average señalados por separado, filtros por fechas y protocolo, vista de registros individuales con la Máxima repetición en el detalle de cada sesión que tenga repeticiones, y controles para excluir sesiones o repeticiones de forma reversible o eliminar permanentemente los datos de una sesión concreta con confirmación del alcance. Las sesiones excluidas no cuentan para medias, percentiles, Personal Best, Personal Average ni análisis. Mantén siempre izquierda a la izquierda y derecha a la derecha en las vistas con ambos lados.

En la ficha, al seleccionar Max Isometric Strength o Heavy Dynamic Strength, mostrar los tests configurados de Groin, Hip, Knee y Ankle. Cada test ofrece la acción «Ver todos los jugadores en este test» (fase 5b).

**Gráficos de esta fase:** G1 y G5. **Requisitos previos:** decisión D12 (resuelta), D20 (biblioteca de gráficos, cerrada), D22 (empates, cerrada) y D23 (Personal Best con rango objetivo: no se define, cerrada).

## Fase 5b — Vista de test y navegación entre jugador y test

Implementa la vista comparativa de un test para toda la plantilla (D10): inicialmente la última sesión válida de cada jugador, con opciones de Personal Best e histórico completo; la fecha de cada resultado y el número de repeticiones; y el agrupamiento por la posición principal vigente en la fecha de cada sesión (D11), con los grupos en el orden que el usuario configure (D9). Implementa la navegación en ambos sentidos entre el perfil del jugador y la vista del test conservando el contexto (RF-03), y la forma básica de G4 sin referencias externas.

**Requisitos previos:** D9, D10, D11 y D13 (decididas); fases 2 a 5a.

## Fase 5c — Percentiles y referencias

Añade los dos percentiles definidos en esta guía: uno basado en la media de todas las repeticiones válidas por jugador durante el periodo (Personal Average) y otro basado en el Average de la última sesión válida de cada jugador. Mostrar método, grupo de referencia, N, fechas y número de repeticiones. Separa percentil estadístico de percentil orientado a rendimiento y aplica los colores establecidos en esta guía. Añade referencias externas («La Liga» y Premier League) solo cuando existan datos y metadatos suficientes; muestra fuente y limitaciones.

No generes conclusiones de rendimiento basadas en datos incompletos o incompatibles. No sustituyas el dato absoluto con el relativo.

**Gráficos de esta fase:** G2, G3 y G4 completo. **Requisitos previos:** D14, D15, D16, D19 y D21, y el umbral mínimo de muestra para mostrar percentiles.

## Fase 6 — Comparación de plantilla ampliada y análisis de relaciones

Amplía la vista de test de la fase 5b con filtros por posición, fecha, protocolo y registro válido, valores absolutos y relativos, percentiles disponibles, y permite exportar a CSV o Excel.

Añade una vista exploratoria de relaciones entre variables con gráfico, población, periodo, método y tamaño de muestra. Distingue relaciones entre jugadores de cambios dentro del jugador y evita tratar medidas repetidas como observaciones independientes. Limita las conclusiones a asociaciones descriptivas; no uses lenguaje causal ni generes prescripciones médicas o de entrenamiento.

**Gráficos de esta fase:** el gráfico de relaciones entre variables. **Requisito previo:** el criterio estadístico de la vista de relaciones.

## Fase 7 — Revisión de seguridad, acceso y copias

Antes de entregar, revisa que ningún dato se envía fuera del portátil, la persistencia local, exportación, copias de seguridad y recuperación. Verifica que la copia completa incluye fuerza, perímetros, NME y todas sus configuraciones, y demuestra el ciclo crear copia → cerrar → restaurar. Confirma que excluir una sesión es reversible y no altera el dato de origen, y que eliminarla requiere confirmación de jugador/test/fecha y no borra otras sesiones; advierte que las copias antiguas pueden conservar los datos eliminados.

Si se usa una URL estática para abrir la interfaz, confirma que el hosting solo sirve los archivos de la aplicación y no recibe datos de jugadores. Entrega instrucciones claras para abrir la herramienta, importar el primer Excel, crear una copia y restaurarla.

# Información que habrá que definir antes de calcular resultados reales

La aplicación puede construirse antes de tener todos estos datos, siempre que el catálogo sea configurable. Para que el análisis sea válido, antes de cargar o interpretar datos reales habrá que completar, por cada test:

- Nombre exacto y protocolo.
- Nombre de cada variable, unidad y equivalencias entre exportaciones.
- Confirmación de que los Excel con varios intentos incluyen cada repetición o permiten mapearlas; un único valor se tratará como una repetición.
- Dirección de interpretación: más alto, más bajo o rango objetivo.
- Fórmula relativa y antropometría que necesita, salvo Run-Specific Iso-Push Peak Force, cuyas fórmulas en BW/SW ya están especificadas en esta guía. La fórmula relativa de RFD at 100 ms sigue pendiente.
- Posiciones y criterio para clasificar jugadores.
- Zonas anatómicas, unidades, técnica de medición y regla de repetición/resumen para cada perímetro.
- Tests, variables, unidades y protocolos incluidos en el bloque NME; conservar la sigla sin expandir hasta confirmación.
- Fuente, población, protocolo y datos disponibles para cada referencia externa.
- Criterios que justifican excluir una sesión o repetición del análisis. La eliminación definitiva es una acción manual independiente con alcance visible y confirmación; no debe confundirse con la exclusión reversible.
- Umbral mínimo de muestra para mostrar percentiles como clasificación fiable y criterio estadístico para la vista de relaciones entre variables. No fijarlos sin confirmación del usuario.
- Regla de color cuando el rango de percentil de la Premier League abarca varias bandas (D14).
- Formato y alcance de los umbrales bibliográficos y de los targets individualizados; fuente y limitaciones de cada uno (D15).
- Normalización del perfil radial y selección de variables (D16).
- Método de cálculo de F0, V0 y potencia óptima, y número mínimo de cargas y repeticiones (D17).
- Variables de cada eje y límites de zonas de los cuadrantes DSI/EUR (D18).
- Si «La Liga» incluye toda la base propia o un subconjunto definido (D19).
- Biblioteca de gráficos (D20) y estadístico de referencia mostrado para «La Liga» y la Premier League en los gráficos comparativos (D21).
- Sin pendientes para G1 y G5: D22 (empates) y D23 (rango objetivo: Personal Best no definido) están cerradas.
- El orden de las posiciones lo configura el usuario (D9, decidida).

No usar percentiles de literatura o de una liga como si fueran directamente comparables si cambian población, protocolo, unidad o definición de la variable.
