# Registro de decisiones

## Decisiones del usuario

| Id | Decisión | Estado | Fecha |
|---|---|---|---|
| D1 | Pila: JavaScript con módulos ES sin compilar el código propio; librerías con versión fija | Aprobada | 2026-10-31 |
| D2 | Navegador de uso: Chrome o Edge, con copia a carpeta elegida | Decidida | 2026-10-31 |
| D3 | Alojamiento: GitHub Pages en su cuenta actual, sin publicar otros sitios en ella | Decidida | 2026-11-01 |
| D4 | Manifestación de la fuerza a nivel de variable (un test, una sesión) | Pendiente, antes de la fase 2 | |
| D5 | Resultado de sesión en perfiles de carga, RM, Iso-Hold y Nordic | Pendiente, antes de la fase 2 | |
| D6 | El lado (izquierdo/derecho) como atributo de la repetición | Pendiente, antes de la fase 2 | |
| D7 | Cifrado de copias con contraseña | Opcional al crear la copia | 2026-10-31 |
| D8 | Forma de guardar las repeticiones (filas largas o una fila por repetición con objeto por identificador de variable) | Aplazada al inicio de la fase 2 | 2026-11-01 |
| D9 | Orden de las posiciones (y de los grupos) | **Decidida (2026-11-02): el orden es configurable por el usuario; no se fija ningún orden definitivo.** En la fase 1c cada posición tiene un orden editable (las nuevas se añaden al final) | 2026-11-02 |
| D10 | Contenido por defecto de la vista comparativa de un test | **Propuesta del usuario (2026-11-02), pendiente de aprobar:** inicialmente la última sesión válida de cada jugador, con opciones para ver el «Max histórico» (sesión con mayor average) o el histórico completo. El significado de «Max histórico» depende de D12 | |
| D11 | Posición para agrupar y comparar | **Decidida (orientación del usuario, 2026-11-02):** cada sesión se compara según la posición principal registrada para el jugador en la fecha de esa sesión. Las posiciones secundarias no lo incluyen automáticamente en varios grupos; solo podrán usarse como filtro o grupo de comparación si se define expresamente | 2026-11-02 |
| D12a | Average: «Average de una sesión» = media de las repeticiones válidas de esa sesión; «Average» = media de todos los resultados válidos de las repeticiones de las sesiones incluidas; solo se excluyen repeticiones o sesiones inválidas, eliminadas o excluidas; un único resultado importado cuenta como una repetición | **Aceptada (2026-11-02):** coincide con la guía (resultado estándar de sesión y media de todas las repeticiones válidas del periodo). En la guía, el «Average» global se denomina personal average | 2026-11-02 |
| D12b | Max: propuesta del usuario = average de la sesión con el average más alto entre las sesiones incluidas, con su fecha; coincide con el personal best; la serie longitudinal muestra siempre el average de cada sesión | **EN CONFLICTO con la guía y con lo acordado antes; sin resolver.** Ver la sección «Conflicto D12b» | |
| D13 | Modo inicial de los selectores | **Decidida (2026-11-02): el selector empieza en Average** | 2026-11-02 |
| D14 | Regla de color cuando el rango de percentil de la Premier League abarca varias bandas de color | Pendiente | |
| D15 | Umbrales de bibliografía y targets individualizados: formato de alta, alcance (jugador, test, variable, posición), fuente y limitaciones; reglas documentadas, si las hubiera, para convertirlos en percentil o color | Pendiente | |
| D16 | Normalización del perfil radial (por ejemplo, percentiles) y selección de variables | Pendiente | |
| D17 | Método de cálculo de F0, V0 y potencia óptima, y número mínimo de cargas y repeticiones | Pendiente (condiciona G6) | |
| D18 | Variables de cada eje y límites de zonas de los cuadrantes DSI/EUR (siglas sin expandir) | Pendiente (condiciona G8) | |
| D19 | Si «La Liga» incluye toda la base propia o un subconjunto definido | Pendiente | |
| D20 | Biblioteca de gráficos (propuesta a verificar: Chart.js; hay que comprobar versión, política de seguridad y accesibilidad) | Pendiente, antes de la primera fase con gráficos | |
| D21 | Estadístico de referencia que se muestra para «La Liga» y la Premier League en los gráficos comparativos (percentiles concretos, mediana, rango) | Pendiente |

## Requisitos funcionales obligatorios (registrados el 2026-11-02)

Dos recorridos complementarios y la navegación entre ambos, con criterios de aceptación en `REQUISITOS.md`:

- **RF-01:** desde un jugador, perfil completo por bloques; al entrar en un test, evolución por sesiones con selector Average (media de las repeticiones válidas de la sesión) o Max (repetición individual máxima de la sesión).
- **RF-02:** desde un test, vista comparativa de todos los jugadores que lo tienen, agrupados por posición, con selector Average/Max y fecha de cada resultado. Se usa la posición vigente en la fecha del test, no la actual.
- **RF-03:** navegación en ambos sentidos entre el perfil del jugador y la vista del test, conservando el contexto.

El orden de las posiciones es configurable (D9) y el contenido por defecto de la vista comparativa es una propuesta pendiente de aprobar (D10). La definición de Max está en conflicto sin resolver (D12b): los criterios de aceptación que dependen de Max (`REQUISITOS.md`) quedan **sujetos a D12b**. Plan de fases actualizado en `PLAN_DE_FASES.md`; la reordenación de las fases 5a, 5b y 5c **no está aprobada**.

## Conflicto D12b: definición de Max (sin resolver)

El 2 de noviembre de 2026 se propuso que **Max** sea el average de la sesión con el average más alto (con la fecha de esa sesión), coincidente con el personal best. Contradice lo acordado antes. No se ha aplicado ni en la guía ni en los requisitos ni en el código; las dos definiciones se conservan hasta que el usuario decida.

| Aspecto | Definición vigente (guía, RF-01 y RF-02) | Propuesta del 2026-11-02 |
|---|---|---|
| Qué es Max | Repetición individual de mayor valor en cada sesión | Media de la sesión con la media más alta |
| Relación con el personal best | Distintos: el personal best se calcula entre medias de sesión, «no entre las repeticiones máximas» | Coinciden |
| Selector Average/Max en el histórico | Cambia la serie: media de cada sesión frente a repetición máxima de cada sesión | La serie siempre es el average de cada sesión; Max sería un único valor (la mejor sesión) y no una serie |
| Sesiones solo resumen (VALD «All Average») | Max no disponible; nunca se deriva del Average | Max disponible, porque se calcula entre medias de sesión |
| Variables donde un valor bajo es mejor o con rango objetivo | Max es el mayor valor; el personal best sigue la dirección configurada | «Average más alto» no coincide con el mejor resultado; el personal best sigue la dirección y dejaría de coincidir con Max |
| Dato de la repetición máxima de cada sesión | Se muestra | Dejaría de mostrarse, salvo que se conserve con otro nombre |

**Qué cambiaría si se adoptara la propuesta:** la definición de Max y del selector en la guía; los criterios de aceptación CA-01.3, CA-01.4, CA-01.5, CA-01.6, CA-02.5 y CA-02.8; RF-01.4 y RF-02.3; la regla de VALD «All Average»; G1; y el significado de «Max histórico» en D10.

**Contradicción adicional:** la especificación de gráficos recibida el mismo día define Max como «la repetición individual más alta de esa sesión» y el personal best como la mejor media de sesión, es decir, la definición vigente. Quedan dos instrucciones del mismo día incompatibles.

**Opciones** (el usuario decide):

| Opción | Descripción | Consecuencia |
|---|---|---|
| A | Mantener ambas, con nombres inequívocos: «Máxima repetición» (individual, por sesión) y «Mejor media de sesión» (= personal best). El selector del histórico pasaría a «Average / Máxima repetición» | No se pierde ningún dato ni significado acordado; Max deja de ser una etiqueta ambigua |
| B | Adoptar la propuesta tal cual: Max = mejor media de sesión; retirar la repetición máxima individual | Se simplifica, pero se pierde el dato de la repetición más alta y cambia lo acordado |
| C | Adoptar la propuesta para la vista comparativa y el personal best, y conservar la repetición máxima individual en el histórico con otro nombre | Intermedia; exige renombrar el máximo individual |

Recomendación no aplicada: la opción A, porque no elimina ningún significado ya acordado y evita que «Max» tenga dos sentidos. Ninguna fase actual depende de esta decisión (la fase 1c no tiene sesiones); debe resolverse antes de la fase 2b (datos sintéticos de aceptación) y, en cualquier caso, antes de la 5a.

## Evidencia de la prueba de viabilidad (Chrome 156, Windows, GitHub Pages)

- Datos conservados al reabrir (más de 19 horas entre creación y apertura); la carpeta recordada se conserva entre sesiones (el permiso puede volver a pedirse).
- Ciclo copia → borrar → restaurar → verificar correcto con y sin gzip + cifrado; restauración desde fichero real correcta.
- La política de seguridad de la página bloquea cualquier conexión.
- Persistencia solicitada cuatro veces: denegada. Se trata el almacenamiento como no persistente.
- D8: a 142.500 valores, filas largas 20,2 s y filas anchas 1,6–2,4 s de escritura; a 13.500 valores, 1,4 s frente a 0,4–0,5 s. Recomendación pendiente de decisión: una fila por repetición con objeto por identificador de variable.

## Decisiones técnicas de la fase 1c

- El historial de posiciones guarda intervalos `[validFrom, validTo]`; la principal no se solapa. Sin registro vigente en una fecha, el jugador figura sin posición (no se reasigna a la actual).
- Las posiciones secundarias se guardan y se muestran aparte; no agrupan (D11).
- El orden de las posiciones es un número editable por el usuario; las nuevas se añaden al final. No se precarga ninguna posición ni orden (D9).
- La ventana antropométrica es un ajuste del usuario sin valor por defecto; sin ella, o fuera de ella, los relativos no están disponibles. Dos mediciones equidistantes se marcan como ambiguas, no se elige una.
- Las unidades de antropometría las indica el usuario en cada valor (no hay unidades por defecto); la interfaz recuerda las últimas usadas. Las unidades de los datos sintéticos son rótulos de demostración.
- Los datos sintéticos se marcan con `synthetic = 1`; su eliminación se niega si un dato real depende de uno sintético.
- Los jugadores no se borran (solo se desactivan); los registros de alias, historial y antropometría sí se pueden eliminar, con confirmación y constancia en el registro de acciones.
- El esquema pasa a la versión 2 con migración automática desde la 1; las copias del esquema 1 se aceptan con un aviso por cada tabla nueva.

## Decisiones técnicas de la fase 1b

- La interfaz usa Preact con htm; la base de datos, Dexie sobre IndexedDB (ver `LIBRERIAS.md`).
- La lista de tablas de la copia se obtiene del esquema: las tablas futuras entran automáticamente salvo `local`.
- La restauración reemplaza (no fusiona), es atómica y se verifica dentro de la transacción.
- No hay copias automáticas silenciosas: guardar en disco exige una acción del usuario. Existe un recordatorio configurable (sin valor por defecto) y un aviso cuando nunca se ha creado una copia.
- Los ajustes solo existen si el usuario los define.
- La auditoría guarda acción y alcance, nunca valores de datos.
- Rutas de la aplicación por hash (`#copias`), compatibles con alojamiento estático.
- Estructura plana: todos los archivos en la raíz del repositorio, sin carpetas, porque la subida web de GitHub del usuario sube los archivos sueltos. Los módulos se importan con rutas `./nombre.js`. El origen de las librerías se llama `libs-fuente.js` para que no colisione con el compilado `libs.js`.
- No hay inicio de sesión: la protección de acceso es la del perfil de usuario del equipo.

## Cambios

- 2026-11-02 (3): fase 1c entregada para revisión (versión 1c-0.1.0, esquema 2): jugadores, alias por fuente, posiciones con orden configurable (D9) y historial con fechas de vigencia, regla D11 de posición principal por fecha, antropometría fechada con ventana configurable sin valor por defecto, datos sintéticos marcados y eliminables. No usa D12b (no hay sesiones en esta fase). Ninguna decisión de significado de datos se resolvió por cuenta propia.
- 2026-11-02 (2): guía actualizada con los requisitos de gráficos (`guia_dashboard_performance_claude.md`); decisiones D9, D11, D12a y D13 aceptadas y D10 como propuesta; D12b registrada como conflicto sin resolver; nuevas decisiones pendientes D14 a D21. Solo documentación en esta parte.
- 2026-11-02: solo documentación (sin cambios de código; la versión de la aplicación sigue en 1b-0.1.1): requisitos funcionales RF-01 a RF-03 y criterios de aceptación (`REQUISITOS.md`), plan de fases actualizado (`PLAN_DE_FASES.md`), decisiones pendientes D9 a D13 y nota de datos previstos en el diccionario.
- 2026-11-02: estructura plana para publicar con la subida web de GitHub. Versión de aplicación 1b-0.1.1 (solo cambian las rutas de importación, el punto de entrada y el número de versión; lógica, esquema 1, política de seguridad y copias, sin cambios).
- 2026-11-01: fase 1b (esqueleto, navegación, copias de seguridad). Versión de aplicación 1b-0.1.0, esquema 1.
