# Dashboard de rendimiento — fase 4 (importadores de Excel y VALD)

Aplicación web de uso personal para guardar y revisar datos de rendimiento. Se abre desde un enlace en el navegador (sin instalar nada) y **los datos se guardan solo en ese navegador**.

**Esta entrega (fase 4, versión 4-0.1.0)** añade el **importador de VALD** al asistente «Importar» (elige el origen «Exportación CSV de VALD ForceDecks»):

- Reconoce cada fila por su código de test y un mismo fichero puede traer varios: **RSHIP/RSKIP/RSAIP** (Hip/Knee/Ankle Iso-Push), **SLHNNI** (Supine 90°/90°), **SLSEICR** (Seated Calf Raise), **SLJ** (SL CMJ), **CMJ**, **SJ** (Squat Jump), **HJ** (Hop Test) y **DJ** (Drop Jump, separado en 30 cm y 45 cm por su altura). Cada test se guarda en su propio lote. **No importa** el peso corporal (BW), las etiquetas (Tags), la media sin lado ni las asimetrías de los tests por lado (se recalcularán desde izquierda y derecha). **No se importan y se listan en el informe:** los códigos ABCMJ, LCMJ y LSJ, las filas con carga adicional > 0 y los Drop Jump de alturas distintas de 30 y 45 cm.
- **Asimetrías de Hop y Drop Jump (D43):** VALD las da como «11 L» o «3.8 R»; la letra es el lado con el valor más alto. Se guardan con signo interno (R → positivo, L → negativo; en pantalla se ven como en VALD, «11 % L»; «0» = 0). La magnitud viene redondeada por VALD, y al fusionar filas del mismo día la asimetría fusionada es una media ponderada aproximada.
- **Lista de atletas de VALD (origen «Lista de atletas…»):** da de alta los jugadores con el nombre completo y el alias de la fuente VALD, para que luego los tests se vinculen solos (siempre con tu confirmación). No guarda fecha de nacimiento, altura, peso, sexo, correo ni vald-id. Las posiciones (columnas Category/Group con «Position») se asignan solo si eliges la equivalencia y una fecha de inicio, y nunca pisan una posición ya registrada. Con tu fichero real: 88 atletas, 0 avisos, 6 posiciones de VALD (2 atletas sin posición).
- **Catálogo (semilla v4):** en SL CMJ las variables de fuerza de despegue y de aterrizaje pasan a «/ BM» en N/kg (así vienen en el CSV). Al actualizar, las unidades de variables del catálogo inicial escritas a mano que difieran de la definitiva se alinean y cada cambio queda en el registro de auditoría.
- **Filas del mismo jugador y día:** se fusionan en una sola sesión (media de cada lado ponderada por sus repeticiones), sin límite de horas entre ellas (por indicación tuya). Cada fusión aparece en la vista previa y en el informe. Los valores de VALD vienen redondeados, así que la media fusionada es aproximada.
- Los nombres de VALD se confirman con los **alias de la fuente VALD** (nada se vincula en silencio); duplicados, conflictos, informe e historial funcionan como en el Excel propio. Con `ejemplo_vald_sintetico.csv` (datos ficticios) puedes probarlo con los datos sintéticos.
- Esquema 4 sin cambios: las sesiones fusionadas guardan además las filas de origen (`mergedRows`).

**La fase 3 (importador de Excel propio), ya construida,** incluye:

- **Menú «Importar»:** asistente en 6 pasos (fichero → columnas → vista previa → jugadores → resumen → informe). Acepta `.xlsx` y `.csv` con **una fila por jugador (y fecha) y una columna por variable** (una columna por lado en las variables bilaterales). Cada fila es una sesión con la media por lado y sus repeticiones. El fichero no sale de tu equipo y no se guarda nada hasta pulsar «Guardar importación».
- **Nada se vincula en silencio:** cada nombre distinto del fichero se confirma en cada importación (vincular a un jugador, crear uno nuevo o dejarlo sin resolver); puedes guardar el nombre como alias de Excel. Coincidencias con ñ/n o no exactas exigen elegir.
- **Seguridad de los datos:** las celdas vacías son «sin dato» (nunca 0); una sesión idéntica ya guardada se omite; si coincide jugador, test, fecha y hora con valores distintos eliges entre omitir o guardar como nueva (nunca se sobrescribe); las filas contradictorias del fichero no se importan; avisa si importas el mismo fichero otra vez; las asimetrías y relativos no se importan, se calculan.
- **Mapeos guardados** por texto de encabezado, historial de importaciones e **informe descargable (CSV)** sin valores de datos.
- **Plantilla** (`plantilla_importacion_sesiones.xlsx`, versión 0.2) y **ejemplo con datos ficticios** (`ejemplo_importacion_sintetico.xlsx`) para probar el asistente con los datos sintéticos.
- La base pasa sola del esquema 3 al 4 (nuevas tablas `sessions`, `importBatches` e `importMappings`) y conserva lo que tuvieras. Los datos sintéticos incluyen ahora sus sesiones al eliminarlos.
- Aún sin gráficos ni importador de VALD (fases 4 y 5). No se puede corregir ni reemplazar una sesión ya guardada (aplazado).

**La fase 2 (catálogo de tests), ya entregada,** incluye:

- **Catálogo de tests** (menú «Catálogo de tests»): lista de tests con búsqueda y filtros; alta, edición y archivado de tests, manifestaciones y zonas; detalle de cada test con sus **protocolos** y sus **variables** (nombre, unidad, tipo de valores, dirección de interpretación, manifestación y, si es calculada, su fórmula con historial de versiones). **Archivar no borra nada**; un test o variable con datos no se podrá borrar.
- **Catálogo inicial cargado** con lo que aportaste: bloques (Manifestaciones de la fuerza, Perímetros y NME), 5 manifestaciones, 4 zonas, los 34 tests de tu lista, las variables y unidades de tus PDF de VALD (CMJ 20, SL CMJ 16, Squat Jump 4, Hop Test 11 y Drop Jump 12 en cada altura) y, en los tres Run-Specific Iso-Push, Peak Force (N), el relativo (SW en Hip, BW en Knee y Ankle), la asimetría, RFD at 100 ms (N/s) y Force at 100 ms (N). Total: 100 variables. Las mismas variables del Iso-Push se aplican también a «Supine Isometric 90°/90° Leg Curl Test» (relativo SW al 29 %) y a «Single-Leg Seated Calf Raise» (relativo SW al 5 %, variante que indicaste). **Lo que no definiste aparece como «No definido»**: no se infiere ninguna dirección de interpretación ni fórmula, y los índices RSI no tienen unidad porque el PDF no la indica. Si abres la versión nueva con una base ya cargada, el catálogo se actualiza una sola vez: rellena unidades vacías, añade las variables que faltan, mueve los Iso-Hold a Max Isometric Strength y elimina el duplicado de Ankle Iso-Hold (si no tiene datos); **no pisa lo que hayas editado**.
- **Operaciones de fórmula cerradas**, solo las que definiste: asimetría (D25), relativo a BW y relativo a SW (factor 0,29 configurable y con historial, D27). Comprobadas con los ejemplos numéricos de la guía.
- Los bloques «Manifestaciones de la fuerza», «Perímetros» y «NME» muestran lo configurado (sin sesiones todavía).
- La base de datos pasa sola del esquema 2 al 3 al abrir la nueva versión y conserva lo que tuvieras. Una copia de seguridad antigua (esquema 1 o 2) se puede restaurar y recibe el catálogo inicial.

Los gráficos y el importador de VALD llegarán en las fases 4 y 5. No contiene datos de jugadores reales. No hay analítica, telemetría ni conexiones a servicios externos: la página lleva una política de seguridad que bloquea cualquier conexión de red.

**Qué no se ha precargado a propósito:** las variables de los demás tests que no están en la lista. Las de Iso-Hold, Nordic, RM y 1RM estimado se añadieron el 8/11 (ver la fase 7a). Sus reglas están decididas (D5), pero aún no has definido sus variables (hasta ahora los tests de tobillo tenían nombres duplicados; el 7 de noviembre confirmaste que «Ankle Iso-Hold 20 s» y «Run-Specific Ankle Iso-Hold 20 s» son el mismo test y queda solo el primero). Se configuran desde la pantalla del catálogo o se precargan cuando lo confirmes.

## Documentación del proyecto

- `guia_dashboard_performance_claude.md`: la guía del proyecto, actualizada el 5 de noviembre de 2026 con los requisitos de gráficos, las referencias «La Liga» y Premier League, los valores de seguimiento (Average de sesión, Personal Average, Personal Best y Máxima repetición) y el orden de fases aprobado. Es documentación; no hace falta subirla para que la aplicación funcione.
- `REQUISITOS.md`: requisitos funcionales obligatorios RF-01 a RF-03 (recorrido desde el jugador, recorrido desde el test y navegación entre ambos), con criterios de aceptación y un conjunto sintético para comprobarlos. Todavía no están implementados (fases 5a y 5b).
- `PLAN_DE_FASES.md`: orden de fases aprobado (la fase 5 se divide en 5a, 5b y 5c), requisitos previos de cada fase, gráficos por fase y reglas de entrega.
- `DECISIONES.md`: decisiones tomadas y pendientes, con las definiciones de los valores de seguimiento (D12).
- `DICCIONARIO_DE_DATOS.md`: tablas (esquema 4), formato de copia y plantilla de importación.
- `CATALOGO_TESTS.md`: especificación del catálogo (decidido, propuesto y pendiente).
- `CONTEXTO.md`: documento de traspaso para retomar el proyecto.

## Estructura plana: todos los archivos en la raíz

Este repositorio no usa carpetas, para poder publicarlo con la subida web de GitHub, que sube los archivos sueltos. Todos los archivos están en la raíz y se importan entre sí con rutas del tipo `./db.js`.

**Archivos necesarios para ejecutar la aplicación (47):**

| Archivo | Contenido |
|---|---|
| `index.html` | Página y política de seguridad; carga `main.js` |
| `style.css` | Estilos (claro/oscuro, adaptable a móvil, tableta y ordenador) |
| `main.js` | Arranque |
| `app.js` | Navegación y rutas |
| `pages.js` | Páginas: inicio, bloques, copias de seguridad, configuración |
| `pages-jugadores.js` | Lista de jugadores y perfil (alias, posiciones, antropometría) |
| `pages-evolucion.js` | Fase 5a: resultados del jugador por bloque, gráfico de evolución, asimetría y gestión de sesiones |
| `pages-percentiles.js` | Fase 5c: panel de percentiles, bandas de color, gráfico G2 y escala G4 completa |
| `percentiles.js` | Lógica de la fase 5c: referencia «La Liga», percentil exacto por rango medio, mediana y bandas |
| `pages-relaciones.js` | Fase 6: tarjeta «Relaciones: DSI, EUR y ORZ» en la ficha del jugador |
| `relaciones.js` | Lógica de la fase 6: DSI, EUR, ORZ y sus percentiles |
| `exportar.js` | Fase 6: construcción del CSV (UTF-8 con BOM, «;» y coma decimal, anti-inyección de fórmulas) |
| `relativos.js` | Fase 6b: valores relativos (BW/SW) calculados al vuelo con la masa corporal de cada sesión |
| `estadistica.js` | Fase 6c: Spearman, Pearson, correlación de medidas repetidas e intervalos de confianza |
| `asociaciones.js` | Fase 6c: observaciones para la vista de relaciones (transversal e intra-jugador) |
| `pages-asociaciones.js` | Fase 6c: pantalla «Relaciones entre variables» con dispersión y tabla |
| `isohold.js` | Fase 7a: MVIC, %PIMA, %BW/%SW del Iso-Hold y 1RM estimado de 12RM (D5) |
| `radar.js` | Fase 5d: datos del perfil radial (normalización, referencias, variables omitidas) |
| `pages-radar.js` | Fase 5d: tarjeta y dibujo SVG del perfil radial, descarga en PNG |
| `targets.js` | Fase 6g: targets individuales y por defecto de posición (D15) |
| `natera.js` | Fase 6e: clasificación bibliográfica de Natera para el Iso-Push relativo (Below Normal / Normal / Good / Excellent) |
| `premier.js` | Fase 6d: referencias de la Premier League 2025-26 (columna In Season), enlace con el catálogo y zona entre cortes |
| `pages-test.js` | Fase 5b: vista de un test para toda la plantilla, migas de pan y escala básica (G4) |
| `comparativa.js` | Lógica de la fase 5b: agrupación por posición vigente, modos de valor, asimetría por fila |
| `rutas.js` | Rutas por hash con parámetros (test, variable, protocolo, fechas, modo) |
| `evolucion.js` | Lógica de la fase 5a: serie por sesión, Personal Best, Personal Average, asimetría, exclusión y eliminación de sesiones |
| `pages-ajustes.js` | Configuración de posiciones, muestra mínima de percentiles y datos sintéticos |
| `componentes.js`, `context.js`, `util.js` | Piezas de interfaz, contexto compartido y funciones auxiliares |
| `pages-catalogo.js` | Pantallas del catálogo: lista de tests, manifestaciones, zonas y detalle de un test |
| `catalogo.js` | Lógica del catálogo: altas, ediciones, archivado, fórmulas cerradas y cálculos (asimetría, BW, SW) |
| `catalogo-inicial.js` | Catálogo inicial aportado por el usuario (se carga una sola vez) |
| `db.js` | Base de datos (esquema 4), ajustes, auditoría y estado local |
| `excel.js` | Lectura de ficheros `.xlsx` y `.csv` y huella SHA-256 |
| `importacion.js` | Lógica del importador: interpretación de filas, mapeos, plan y guardado de importaciones |
| `vald.js` | Perfil y lectura de exportaciones CSV de VALD (todos los tests) |
| `atletas.js` | Importación de la lista de atletas de VALD (altas, alias y posiciones con confirmación) |
| `pages-importar.js` | Asistente «Importar» (Excel propio y VALD) |
| `fechas.js` | Fechas de calendario sin zona horaria |
| `jugadores.js` | Jugadores, alias y propuesta de candidatos |
| `posiciones.js` | Lista de posiciones, historial y posición en una fecha |
| `antropometria.js` | Mediciones fechadas y medición más próxima a una fecha |
| `sinteticos.js` | Datos sintéticos de demostración |
| `backup.js`, `io.js` | Copia completa, validación, restauración y guardado en disco |
| `libs.js` | Librerías de terceros ya compiladas (ver `LIBRERIAS.md`) |

**Archivos opcionales** (la aplicación funciona sin ellos): `README.md`, `LEEME.md`, `guia_dashboard_performance_claude.md`, `REQUISITOS.md`, `PLAN_DE_FASES.md`, `DECISIONES.md`, `DICCIONARIO_DE_DATOS.md`, `LIBRERIAS.md`, y las herramientas de desarrollo `libs-fuente.js`, `package.json`, `package-lock.json`, `prueba-copias.test.mjs`, `prueba-jugadores.test.mjs`, `prueba-interfaz.test.mjs` y `prueba-jugadores-ui.test.mjs`, `prueba-catalogo.test.mjs`, `prueba-catalogo-ui.test.mjs`, `prueba-importacion.test.mjs`, `prueba-importacion-ui.test.mjs`, `prueba-vald.test.mjs` y `prueba-vald-ui.test.mjs`; y las plantillas `plantilla_importacion_sesiones.xlsx`, `ejemplo_importacion_sintetico.xlsx` y `ejemplo_vald_sintetico.csv`.

**Atención: `libs.js` y `libs-fuente.js` son archivos distintos.** `libs.js` (unos 340 KB, ilegible: está compilado) es el que necesita la aplicación. `libs-fuente.js` (unas 10 líneas) es solo el origen para recompilarlo. Si en el repositorio `libs.js` pesa unos 500 bytes, contiene el origen por error y la aplicación no arranca: sube de nuevo `libs.js`.

## Publicar la aplicación (GitHub Pages, subida web)

1. En tu cuenta de GitHub usa el repositorio **público** `dashboard-rendimiento` (con el plan gratuito, Pages exige repositorio público; el código será público, los datos nunca).
2. **Antes de actualizar una versión anterior, crea una copia de seguridad** desde la aplicación publicada («Copias de seguridad»). La base de datos pasa sola del esquema 1, 2 o 3 al 4 al abrir la nueva versión y conserva lo que tuvieras, pero una copia previa es la red de seguridad.
3. Pulsa «Add file → Upload files» y selecciona o arrastra **todos los archivos a la vez**, sueltos, sin carpetas. Si un archivo ya existe con el mismo nombre, GitHub lo sustituye. Confirma con «Commit changes».
4. En «Settings → Pages», comprueba «Deploy from a branch», rama `main` y carpeta `/ (root)`. Tras uno o dos minutos la aplicación estará en `https://TU-USUARIO.github.io/dashboard-rendimiento/`.
5. Ábrela y pulsa Ctrl+F5 para evitar versiones guardadas en caché. En la parte superior debe verse la versión que figura en el título de la última fase de este documento. **Usa siempre exactamente esa dirección**: otra variante (otro dominio, `http` en lugar de `https`) es otro origen y mostraría la aplicación vacía.

Si la página se queda en «Cargando…», revisa que `libs.js` es el compilado y que están todos los archivos de la lista anterior. En Chrome, F12 → pestaña «Consola» muestra qué archivo no se encuentra.

### Origen compartido (decisión D3)

Los datos del navegador pertenecen al **origen** (`https://TU-USUARIO.github.io`), no a cada repositorio. Por eso, tal y como decidiste, **no publiques otros sitios en esta cuenta**: cualquier página servida desde el mismo origen podría leer la base de datos de la aplicación. Cuando compruebes que esta aplicación funciona, **elimina o despublica el repositorio de la prueba de viabilidad** (`prueba-viabilidad`), que está en el mismo origen.

## Dónde quedan los datos

En IndexedDB del navegador, en este equipo y en este perfil de usuario. No se envían a ningún servidor ni se sincronizan con otros dispositivos. La seguridad de acceso es la de tu cuenta del equipo.

**Si se borran los datos del sitio**, si usas otro perfil o navegador, o si pierdes el portátil antes de descargar una copia, **los datos se pierden**. Chrome ha respondido «no» a la solicitud de almacenamiento persistente, así que también podría borrarlos si se quedara sin espacio en disco. La protección real son las copias de seguridad.

## Copias de seguridad

En «Copias de seguridad»: crear una copia completa (con gzip y cifrado con contraseña opcionales, en la ubicación que elijas o en una carpeta recordada) y restaurar una copia (con validación, resumen, comparación de registros por tabla y confirmación; se hace en una sola operación y se verifica). La copia incluye ahora jugadores, alias, posiciones, historial de posiciones y antropometría. Una copia hecha con la fase 1b se puede restaurar en la 1c (las tablas nuevas quedan vacías). Restaurar una copia anterior recupera datos que hubieras eliminado después de crearla, incluidos los datos sintéticos.

## Datos sintéticos

En «Configuración → Datos sintéticos de demostración»:

- **Cargar datos sintéticos** crea 2 posiciones («Posición sintética 1» y «2»), 12 jugadores (los jugadores A a F del conjunto de aceptación de `REQUISITOS.md`, otros seis, y una pareja «Muñoz»/«Munoz» para probar la propuesta de candidatos con confirmación manual), alias de VALD y de Excel, historial de posiciones con cambios de posición y mediciones antropométricas. Todo con la etiqueta SINTÉTICO. Los nombres y valores no representan a nadie ni nada real; las unidades kg y cm son solo rótulos de demostración.
- **Eliminar todos los datos sintéticos** los borra todos juntos y solo ellos, tras confirmar. Si algún dato tuyo (real) depende de uno sintético (por ejemplo, una posición secundaria sintética en un jugador real), no se elimina nada hasta que lo reasignes.
- **Elimínalos antes de empezar a cargar datos reales.**

## Fase 5a: ficha del jugador y evolución (versión 5a-0.1.0)

En la ficha de un jugador, «Resultados por bloque» tiene ahora tres pestañas (fuerza, perímetros y NME; solo la de fuerza tiene datos). Para cada test con sesiones:
- **Gráfico de evolución:** un punto por sesión (su Average), con el **Personal Best** y el **Personal Average** como líneas separadas, el resultado actual, y las sesiones excluidas marcadas con una cruz. En tests por lado, izquierda a la izquierda y derecha a la derecha, con el mismo eje. Filtros por variable, protocolo y fechas.
- **Personal Average:** media de las sesiones ponderada por repeticiones (D12a). **Personal Best:** según la dirección de la variable (D12b). **Dirección por defecto (D50):** «más alto es mejor» para todas las variables sin dirección, salvo las asimetrías (%), que quedan sin dirección porque llevan signo. Al actualizar la base se asigna solo a las que no tenían dirección (75 en el catálogo inicial), sin tocar ninguna que ya hayas definido, y queda en el registro de auditoría. **Revísalas:** en tiempos de contacto, duraciones o profundidades un valor más bajo puede ser mejor; cámbialo en el catálogo. Con rango objetivo no se define (D23).
- **Asimetría (G5), como en VALD (8/11/2026):** en todos los tests por lado, |D − I| ÷ máx × 100 con la letra del lado que tiene el valor más alto (L/R), p. ej. «11 % L». Sin signo en pantalla ni en CSV (el CSV lleva la magnitud y el lado en dos columnas). La fórmula está comprobada con 135 filas de SL CMJ exportadas por VALD (las diferencias son solo el redondeo de los valores I/D del CSV). Internamente se sigue guardando con signo (R +, L −) por compatibilidad.
- **Tabla de sesiones:** «Excluir» (reversible, con motivo opcional; la sesión deja de contar en todo) y «Reincorporar». «Eliminar…» borra definitivamente UNA sesión y exige escribir el nombre del jugador y la fecha exactos. Las copias de seguridad antiguas pueden conservar la sesión eliminada.
- **No existe «Máxima repetición»:** los datos importados traen una media por sesión (D8), no repeticiones sueltas.

Comprobación sugerida (10 minutos): abre un jugador con sesiones importadas, mira un test (por ejemplo Run-Specific Knee Iso-Push) y comprueba que los puntos y las fechas coinciden con tu Excel o VALD; excluye una sesión y ve que cambia el Personal Average; reincorpórala; comprueba que el Personal Best aparece (más alto es mejor) y cambia la dirección de una variable en el catálogo para ver que se actualiza; prueba el tema oscuro y una ventana estrecha.

## Fase 5b: vista de un test para toda la plantilla (versión 5b-0.1.0)

Desde la ficha de un jugador, en un test, el botón **«Ver todos los jugadores en este test»** abre la vista comparativa (`#test-N`):
- **Valor mostrado (D33):** Personal Average por defecto; Personal Best, Última sesión válida e Histórico completo como opciones (D33b sigue pendiente, por eso no se ha quitado ninguna). Filtros por variable, protocolo y fechas, y orden por jugador, valor (el mejor primero según la dirección) o fecha.
- **Grupos por posición (D11, revisada 7/11/2026):** cada jugador va a su única posición principal, sin fechas; sin posición: «Sin posición». El orden de los grupos es el de Configuración (D9).
- **Cambio de posición:** al no llevar fechas, el cambio mueve todo el histórico del jugador a la nueva posición (ya no hay filas por posición ocupada).
- **Tests por lado:** columnas «Izquierda» y «Derecha» con su unidad y columna **Asimetría** al estilo VALD («11 % L») calculada con los dos valores de la fila.
- **Cada fila** muestra fechas (rango en el Personal Average), número de sesiones y repeticiones. Las sesiones excluidas no aparecen.
- **Escala básica (G4):** una línea MIN–MAX con un marcador por jugador (azul «L», naranja «R», blanco sin lado), sin referencias externas (fase 5c).
- **Navegación (RF-03):** el jugador y el test se enlazan en ambos sentidos conservando test, variable, protocolo, fechas y modo; el jugador de origen queda resaltado; hay migas de pan, y Atrás y recargar mantienen la vista (todo va en la dirección de la página).

Comprobación sugerida (10 minutos): abre un jugador con sesiones, entra en un test y pulsa «Ver todos los jugadores en este test»; cambia a Personal Best; abre otro jugador desde la tabla; pulsa Atrás y comprueba que sigues en Personal Best con el jugador de origen resaltado; recarga la página; cambia la posición actual de un jugador en su ficha y comprueba que sus resultados antiguos no cambian de grupo.

## Fase 5c: percentiles y referencias (versión 5c-0.1.0)

En la ficha del jugador, bajo el gráfico de evolución, aparece **«Percentiles frente a La Liga»**; en la vista de test (`#test-N`), en los modos Personal Average y Última sesión, hay una columna de percentil por lado.
- **Referencia «La Liga» (D19):** base de datos propia, **sin datos sintéticos**; un valor por jugador (su Personal Average o su última sesión válida, D28), sin sesiones excluidas y **sin el propio jugador** (D28a). Filtro de posición opcional (por la posición única del jugador).
- **Dos percentiles:** estadístico (el % de valores menores más la mitad de los iguales) y de rendimiento (si la variable es «más bajo es mejor» se invierte: 100 − p; con rango objetivo o sin dirección no hay percentil de rendimiento ni color).
- **Seis bandas (D14):** 0–<10 rojo intenso, 10–<35 naranja, 35–<50 amarillo suave, 50–<65 amarillo intenso, 65–<90 verde suave, 90–100 verde intenso. El número siempre acompaña al color.
- **Muestra mínima (D52):** 10 jugadores; cambiable en Configuración → «Muestra mínima para percentiles». Con menos: «Muestra insuficiente» con el N, sin color.
- **G2** (barras del valor frente al Personal Average y la mediana de la referencia) y **G4 completa** (mediana P50 sobre la línea, marcadores L/R y corchete de asimetría; si el valor queda fuera del rango la escala se amplía y se avisa: provisional, D24).
- **No hecho:** radar G3 (D16 abierta); percentiles de variables relativas o derivadas (solo variables medidas).

Comprobación sugerida (10 minutos): importa datos reales de al menos 11 jugadores en un test, abre uno y mira la tabla de percentiles; sube en Configuración la muestra mínima a un número mayor que tu N y comprueba que aparece «Muestra insuficiente».

## Cambio de posición (7/11/2026) y fase 6a (versión 6a-0.1.0)

**La posición ya no lleva fechas.** Cada jugador tiene una única posición principal (y secundarias informativas); cambiarla vale para todo su histórico. Al abrir la aplicación o restaurar una copia con posiciones fechadas se aplica una migración automática: se conserva la principal vigente (sin fecha de fin; si no hay, la de inicio más reciente), una secundaria por posición y se quitan las fechas. Solo se audita el número de registros afectados. Haz una copia antes de abrir esta versión con tus datos reales.

**Fase 6a** (ratios y exportación; los valores relativos de la vista de test y el resto de la fase 6 siguen pendientes):
- **Tarjeta «Relaciones: DSI, EUR y ORZ»** en la ficha del jugador, siempre con **toda la historia** y el Personal Average de cada término (sin sesiones excluidas):
  - **DSI por lado** (D38) = SL CMJ «CONCENTRIC PEAK FORCE / BM» (N/kg ÷ 9,80665) ÷ Knee Iso-Push Peak Force relativo al peso corporal (BW), sin unidad. El peso de cada sesión de Knee es la última masa corporal medida en o antes de esa fecha (**sin ventana antropométrica**: sigue abierta; las sesiones sin masa previa se omiten y se avisa).
  - **EUR** (D39) = CMJ JH (imp-mom) Personal Average ÷ Squat Jump JH (imp-mom) Personal Best. Lleva la advertencia metodológica de la decisión.
  - **ORZ** (D47): la altura (30 o 45 cm) con mayor RSI Personal Average; con una sola altura no se muestra nada; **con empate exacto no hay ORZ (propuesta mía, sin confirmar)**.
  - Percentil estadístico frente a La Liga (sin sintéticos, sin el propio jugador, mínimo de muestra de Configuración). Sin color: DSI y EUR no tienen dirección «mejor/peor» definida.
- **Exportar CSV** en la vista de test (`#test-N`): exporta la tabla que ves (modo, filtros y orden). Pensado para Excel en español: separador «;», coma decimal, UTF-8.

## Fase 6b y 6c (versión 6b-0.1.0)

**6b — vista de test ampliada:**
- **Filtro de posición** (la posición única del jugador, «Sin posición» incluida), además de variable, protocolo y fechas. Casilla para **mostrar las sesiones excluidas** como lista informativa (no entran en ninguna tabla ni percentil).
- **Valores relativos:** las variables «relativas» del catálogo (Peak Force relativo BW o SW) se ven en la vista de test, en la ficha del jugador y con sus percentiles. Se calculan al vuelo (no se guardan): fuerza ÷ (factor × masa × 9,80665), con la **última masa medida en o antes de cada sesión** (sin ventana: sigue abierta). Una sesión sin masa previa no tiene valor relativo y se avisa. El valor absoluto sigue disponible en su variable. Se muestra la fórmula y la unidad.

**6c — «Relaciones entre variables»** (menú nuevo): eliges X e Y (test + variable + lado), población (posición) y periodo; no hay selección por defecto.
- **Entre jugadores:** una observación por jugador (su Personal Average en el periodo). Spearman ρ (principal) y Pearson r con IC 95 %.
- **Dentro del jugador:** pares del mismo jugador y el mismo día; correlación de medidas repetidas (Bakdash y Marusich, 2017). Puede dar signo opuesto a la relación entre jugadores.
- Dispersión (con tabla equivalente), población, periodo, método y n siempre visibles; muestra mínima la de Configuración (10); sin sintéticos salvo casilla; sin valores p; solo asociaciones, nada causal ni prescriptivo.
- **El criterio estadístico es provisional: lo has de confirmar.**

## Fase 6d/6e: Premier League y clasificación de Natera (versión 6f-0.1.0)

Con las 6 imágenes que subiste (columna **In Season 2025-26**, no pre-season) la ficha del jugador muestra, bajo la tabla de percentiles de La Liga, un bloque **«Premier League»** con los cortes P5, P25, mediana, P75 y P95 y la **zona** del valor (por ejemplo, «entre P25 y la mediana»).
- **Solo lo que está en las tablas:** una variable del catálogo se enlaza únicamente si el nombre de la métrica es el mismo. Lo que no figura (variables relativas, asimetrías no listadas, Iso-Hold, etc.) muestra «no tiene percentil de la Premier League». No hay equivalencias supuestas.
- **Enlazado hoy (55 variables-test, con tus equivalencias del 7/11):** Iso-Push Hip, Knee y Ankle (Peak Force); CMJ (11 variables de rendimiento + 5 asimetrías); Squat Jump (altura y RSI-Mod); SL CMJ (9; equivale al SLJ de la tabla, D37); Drop Jump, en 30 y 45 cm (4 + 2 asimetrías en cada altura); Hop Test (3 + 2 asimetrías). Equivalencias confirmadas por ti: «Peak Power / BM» = CON PEAK POWER/BM (CMJ y SL CMJ), «Eccentric Duration» = ECC DECEL PHASE DURATION (CMJ y SL CMJ), y las dos asimetrías de aterrizaje del Drop Jump.
- **Unidades:** la duración concéntrica del CMJ y del SL CMJ y el tiempo de contacto del Hop Test están en segundos en la tabla y en milisegundos en el catálogo: se convierten (× 1000). El resto coincide.
- **Color (D14b, opción A confirmada):** las seis zonas que delimitan P5/P25/P50/P75/P95 llevan las seis bandas en orden (rojo = más allá del P5 … verde = P95 o más); la dirección ya viene en el orden de la tabla. Los umbrales de la Premier (5/25/50/75/95) no son los de La Liga (10/35/50/65/90), y el color indica posición en la muestra de la Premier, no un umbral clínico ni de riesgo. No hay percentil intermedio (sin interpolar). El texto de la zona acompaña siempre al color.
- **Asimetrías con signo:** se muestran los cortes pero no se ubica ni se colorea al jugador, porque no está verificado que el signo de ForceDecks coincida con el de la app (D25).
- **Límites que debes conocer:** la tabla de Drop Jump no indica la altura de caída (se aplica a 30 y 45 cm); las referencias de Iso-Push y SL CMJ son por lado (confirmado por ti); en el resto de variables con lado no consta, y se avisa.
- **Nordic Hamstring Exercise:** tengo cargados los cortes in-season de NordBord (Max Force, Max Force Asymmetry en valor absoluto, Torque), pero el test aún no tiene variables en el catálogo; se aplicarán cuando crees variables llamadas exactamente «Max Force», «Max Force Asymmetry» y «Torque».
- No incluido: Iso Prone (no confirmado como equivalente de ningún test), ForceFrame (cadera, tobillo), Squat Assessment, IMTP y SLDJ (no están en el catálogo) y las métricas de la tabla sin variable equivalente.

**Clasificación de Natera (Iso-Push relativo).** En el panel de percentiles de «Peak Force relativo» aparece un bloque con la clase del valor: Ankle y Knee en BW (Normal 2,75 / 3,75; Good 3,0 / 4,2; Excellent 3,25 / 4,5) y Hip en SW (Normal 2,0; Good 2,2; Excellent 2,5). Por debajo de Normal la fuente no da etiqueta y se muestra en rojo (decisión tuya). Se aplican como intervalos continuos y a cada lado (no consta si los umbrales son por lado). La clase se escribe siempre con texto; el color (amarillo, verde claro, verde, como en tu imagen) es solo refuerzo.

## Fase 6g: targets (versión 6g-0.1.0, esquema 5)

En la ficha del jugador, bajo cada gráfico de evolución, aparece el bloque **Target** (decisión D15: «individual + valor por defecto por posición»).
- **Definir:** despliega «Definir o cambiar targets». Puedes fijar un target **individual** (jugador + variable; un solo valor para ambos lados si la variable es I/D) y un target **por defecto de la posición principal** del jugador. Cada uno admite una nota o fuente.
- **Cuál se aplica:** el individual manda sobre el de la posición (confirmado). En las variables izquierda/derecha el target es **un solo valor para los dos lados**.
- **Qué se ve:** una línea discontinua en el gráfico (la leyenda indica «individual» o «posición») y una tabla con la distancia del resultado actual y del Personal Average al target, en unidades y en %. Indica «alcanzado» o «no alcanzado» según la dirección de la variable en el catálogo (más alto / más bajo); con otra dirección solo muestra la distancia.
- **Sin color:** no hay regla de color para targets; no se inventa.
- **Copias:** los targets van en la copia de seguridad (tabla nueva, esquema 5). Una copia antigua se restaura con un aviso de que esa tabla quedará vacía. Al eliminar una posición se eliminan sus targets por defecto.
- **Aún no hay** valores por defecto cargados: los defines tú.

## Fase 5d: perfil radial (versión 7d-0.1.0)

En la ficha del jugador, tarjeta «Perfil radial: FAST DYNAMIC STRENGTH (CMJ)», con el aspecto del radar que aportaste:
- **Variables (las que indicaste, todas del CMJ):** JH (imp-mom), Peak Power/BM (= CON PEAK POWER/BM), CON Impulse 100ms, RSI mod, EDRFD/BM (= ECC DECEL RFD, N/s/kg) y ECC Peak Power/BM.
- **Líneas:** lila = el jugador (Personal Average, o la última medida si lo eliges en el desplegable); amarilla = mediana (P50) de La Liga; blanca punteada = mediana in-season de la Premier League.
- **Normalización (confirmada por ti el 8/11/2026):** cada eje es el valor dividido por el P50 de La Liga de esa variable, con La Liga = 100 %; por eso el hexágono amarillo es regular y los otros dos se leen como porcentaje de él. Si algún eje supera el 112 %, se reduce todo el dibujo para que quepa. Los valores originales con unidad, el N de La Liga y las fechas van en una tabla debajo.
- **Referencia La Liga:** tu base de datos (opcionalmente una posición), sin sintéticos ni el propio jugador, un valor por jugador con la misma base que el del jugador y mínimo de jugadores del ajuste de percentiles. Una variable sin dato del jugador, sin P50 suficiente o con «más bajo es mejor» se omite y se lista aparte; con menos de 3 variables no se dibuja. La línea de la Premier solo se dibuja si la tienen todos los ejes dibujados.
- **Imagen:** «Descargar imagen (PNG)» (2000 × 980 px). En el lugar de la foto del jugador aparece su nombre y la base del valor, y la leyenda incluye una línea lila para el jugador.
- **Variables elegibles desde la aplicación:** botón «Elegir variables del radar» (test y de 3 a 8 variables de un solo valor con «más alto es mejor»; el orden de los ejes es el de marcado). Se guarda en este navegador (`radarConfig`, va en las copias) y vale para todos los jugadores; «Volver al perfil por defecto» restaura las seis del CMJ. Con otra selección el título pasa a «PERFIL <TEST>».

## Mejoras de la versión 7d

- **Corregir una sesión guardada:** en la tabla de sesiones de cada variable, botón «Corregir…» (no aparece en variables calculadas). Cambia fecha, hora, el valor (o los dos lados) de la variable que ves y las repeticiones, sobre la misma sesión; no crea otra. Se rechaza una fecha u hora inválida, un valor no numérico y una colisión con otra sesión del mismo jugador, test, protocolo, fecha y hora. Las demás variables de la sesión no cambian (si todo el fichero estaba mal, elimina la sesión y vuelve a importar). El registro de auditoría anota qué campos cambian, nunca los valores.
- **Ficheros sin encabezados (Excel propio):** en el paso de la hoja, casilla «Mi fichero no tiene fila de encabezados» e indicas la primera fila de datos; las columnas se llaman «Columna A, B, C…». La app avisa si la fila elegida como encabezado contiene números. Las celdas vacías no se leen como 0, y un 0 escrito sí es un valor (p. ej. 0 kg de carga añadida).
- **Alta manual de la carga (Iso-Hold y RM):** tarjeta «Alta manual de carga» en la ficha del jugador: test, fecha, hora opcional y carga en kg (admite coma). Crea una sesión con origen «manual», sin repeticiones; MVIC, %PIMA, %BW/%SW y 1RM estimado se calculan solos. Se rechaza un duplicado exacto (jugador, test, fecha y hora) y una carga negativa, vacía o mayor de 1000 kg (0 = sin carga añadida).
- **Variables del radar elegibles:** ver la sección del radar.

## Fase 8 (G6): perfil carga-velocidad (versión 7f-0.1.0, esquema 6)

Tarjeta «Perfil carga-velocidad (VBT)» en la ficha del jugador, con el aspecto del gráfico de tu Excel: fondo negro, jugador en verde (puntos, línea blanca, recta de regresión y ecuación con R²), línea «Balanced» amarilla, ejes «Load (kg)» y «Mean Propulsive Velocity (m/s)». Descarga en PNG.
- **Entrada:** a mano (fecha, ejercicio opcional, velocidad de la FDM —0,33 m/s por defecto—, de 3 a 12 cargas con su VMP) o desde tu Excel o un CSV: busca una fila «CARGA» con otra «VMP» debajo y empareja las columnas con número (si hay varios bloques, eliges cuál). Lo leído se muestra en el formulario para revisarlo; no se guarda hasta pulsar «Guardar perfil». Se puede corregir y eliminar.
- **Cálculos (comprobados con los datos de Ansu Fati de tu hoja):** recta por mínimos cuadrados v = a·carga + b con ≥ 3 cargas distintas; Fo = −b/a (kg); Vo = b (m/s); pendiente = −a × 1000; FDM = carga con la que v = velocidad de la FDM; potencia óptima = Fo × Vo ÷ 4; fuerza relativa = Fo ÷ masa (regla de masa: la medida más cercana a la fecha, o el peso de referencia). Con la velocidad que no baja al subir la carga o con menos de 3 cargas: «INVALID data» con el motivo.
- **Perfil (nombres):** «Force profile» se muestra también como «déficit de fuerza con cargas ligeras» y «Velocity profile» como «déficit de fuerza con cargas elevadas» (nombres elegidos por ti). Umbrales: pendiente ≥ 13,1 Moderate VELOCITY; ≥ 11,1 Slight VELOCITY; ≥ 9 BALANCED; ≥ 7 Slight FORCE; ≥ 1 Moderate FORCE (los de tu Excel; sin fuente publicada, no los he contrastado).
- **Frente a La Liga:** tabla con Vo, Fo ÷ masa y potencia óptima (percentil con color) y pendiente (solo percentil estadístico, sin «mejor» ni «peor»). Referencia: un valor por jugador, su perfil válido más reciente del mismo ejercicio (el texto del ejercicio debe coincidir, sin distinguir mayúsculas), sin sintéticos ni el propio jugador; mínimo de muestra el de tus ajustes de percentiles. La tarjeta indica también cuánto se extrapola Fo sobre la mayor carga probada.
- **Aviso metodológico:** la pendiente es V0 ÷ L0, así que depende del nivel de fuerza además de la orientación; por eso la clasificación de tu Excel se rotula «no validada». El método publicado (Jiménez-Reyes et al., 2017) usa el perfil en % del perfil óptimo de cada deportista, que requiere masa y distancia de empuje y se definió para saltos con carga.
- **Diferencias con tu Excel:** tu «Vo» es a + b (velocidad con 1 kg); aquí es el intercepto b (D17): para Ansu 1,3588 frente a 1,3498 m/s, y la potencia óptima sale 51,1 frente a 50,8. La línea «Balanced» es la tuya (8 puntos) y es fija para todos los jugadores; se edita en la tarjeta.
- **Copias:** tabla nueva `fvProfiles` (esquema 6); una copia antigua se restaura con el aviso habitual de tabla ausente.

## Perfil, percentiles y gráficos con el aspecto de tus informes (versión 7k-0.1.0)

- «Resultados por bloque» abre el perfil del jugador.
- Percentiles: una sola tabla con «La Liga» y «Premier League» (P50 y P95 y ubicación).
- Asimetría horizontal como VALD (azul izquierda, naranja derecha).
- Clic en un gráfico: «Copiar imagen» o «Descargar PNG» (la copia al portapapeles solo funciona en la página publicada con HTTPS).
- Escala de percentiles con los logos de La Liga y Premier (P50) y la bandera de Target; «Añadir target» al momento bajo los gráficos.

## Nombre completo + alias y vínculos sugeridos (versión 7j-0.1.0)

- Cada jugador tiene **nombre completo** (el de VALD) y **alias** (el nombre en camiseta de tus Excel). Se muestra como «Ansu Fati Vieira (Fati)». Se editan en la ficha del jugador.
- Al importar, para cada nombre del fichero se **sugieren** jugadores parecidos, sin acentos y mirando nombre **y** apellido (orden indiferente, partículas ignoradas, erratas leves toleradas). Solo se preselecciona un único parecido «alto»; siempre confirmas tú.
- Al confirmar un nombre de tu Excel sobre un jugador que solo tenía nombre completo, ese texto pasa a ser su alias.

## Fase 8 (G8): cuadrantes DSI × EUR (versión 7i-0.1.0)

Dentro de la tarjeta «Relaciones: DSI, EUR y ORZ» de la ficha del jugador. Eje horizontal EUR, vertical DSI, con un punto por lado (I y D) para el jugador y un punto gris por jugador y lado del resto de La Liga (sin sintéticos).
- **Cortes:** por defecto la mediana de La Liga (el DSI con los dos lados juntos; hace falta el mínimo de jugadores de tus ajustes de percentiles; si no, no hay corte automático). Puedes fijar un valor propio para cada eje («Guardar cortes», que valen aunque la muestra sea pequeña) o volver a la mediana.
- **Etiquetas:** solo «por encima» o «por debajo» de cada corte; sin prescripciones. **No hay zona neutra:** no se conoce el error de medida, así que un jugador cerca de un corte puede cambiar de cuadrante por ruido; el valor igual al corte cuenta como «por encima».
- **Sin valores de la literatura:** no son comparables con nuestras definiciones de DSI y EUR.

## Fase 7: seguridad, acceso y copias (versión 7-0.1.0)

**Qué se ha revisado y cómo (con datos sintéticos, en Chromium sin interfaz):**
- **Ningún dato sale del equipo.** Revisión del código: no hay `fetch`, `XMLHttpRequest`, WebSocket, `sendBeacon` ni direcciones externas, ni `innerHTML`, `eval` o `localStorage`. La política de seguridad del navegador (`index.html`) bloquea además cualquier conexión (`connect-src 'none'`) y los scripts externos. En una sesión completa de uso (220 peticiones) todas fueron a la propia página; ninguna a otro origen.
- **Qué recibe el hosting:** GitHub Pages solo sirve los archivos de la aplicación. El repositorio contiene únicamente código, documentación y ejemplos sintéticos; los datos de jugadores viven en el navegador. Es **público**: contiene también las tablas de la Premier y los umbrales de Natera que aportaste (no datos de jugadores).
- **Ciclo crear copia → borrar → restaurar, en navegador:** copia sin cifrar y copia cifrada (AES-256-GCM, clave derivada con PBKDF2 de 600 000 iteraciones); se borra la base entera; se restaura. Las 19 tablas de datos quedan idénticas (sesiones, valores, exclusiones, targets…); solo cambia el registro de auditoría, que anota la restauración. Una contraseña errónea y un fichero alterado se rechazan sin tocar los datos. La copia cifrada no contiene ningún nombre en claro.
- **Exclusión reversible y eliminación:** excluir no toca los valores y se puede revertir; eliminar exige escribir el nombre del jugador y la fecha, borra solo esa sesión y avisa de que las copias antiguas pueden conservarla (pruebas automáticas).
- **Defectos corregidos en esta fase:** (1) el informe CSV de importación incluía nombres y ficheros procedentes del Excel sin neutralizar fórmulas (`=`, `+`, `-`, `@`); ahora se neutralizan como ya hacía la exportación de tablas. (2) Textos de la documentación desactualizados (versión y recuento de archivos).
- **Texto malicioso en nombres:** un nombre de jugador con HTML (`<img onerror=…>`) se muestra como texto y no se ejecuta.

**Límites que debes conocer:**
- La suma de verificación de una copia **sin cifrar** detecta daños y modificaciones accidentales, pero no impide que alguien modifique el fichero y recalcule la suma. La copia cifrada sí es autenticada. Si la copia va a salir del equipo, cífrala.
- No hay inicio de sesión: el acceso es el de tu cuenta del equipo y el de tu perfil de Chrome. Quien abra ese perfil puede ver los datos. No hay recuperación de la contraseña de una copia cifrada.
- Si se borran los datos del sitio, se cambia de perfil o navegador, o se pierde el equipo sin copia, los datos se pierden. Las copias son la única garantía.
- Todas las pruebas son con datos sintéticos y Chromium sin interfaz. **No se ha probado en Chrome real, con tu volumen de datos real ni con lectores de pantalla.**

**Primeros pasos (para ti):**
1. Abre `https://danielsanchezbcn.github.io/dashboard-rendimiento/` y pulsa Ctrl+F5.
2. «Importar»: sube el primer Excel o CSV de VALD, confirma los nombres de jugador y revisa el informe.
3. «Copias de seguridad» → «Crear copia completa» (activa «Cifrar con contraseña» si la guardas fuera del equipo) y guárdala en un USB o una carpeta sincronizada.
4. Para comprobar que funciona: restaura esa copia en «Restaurar copia» (leer y validar, marcar la confirmación, restaurar). Haz este ensayo la primera vez con pocos datos.
5. Crea una copia después de cada sesión de importación; la aplicación te recuerda cuándo toca.

## Fase 7a: D5 (Nordic, RM, Iso-Hold) y regla de masa corporal (versión 7a-0.1.0)

**Regla de masa corporal (decidida el 8/11/2026), para todos los tests y cálculos** (relativos BW/SW, DSI, Iso-Hold, 1RM estimado): se usa la masa corporal **medida más cercana a la fecha**, antes o después, sin ventana. A igual distancia se toma la anterior (elección mía, a confirmar). Si el jugador no tiene ninguna medición, se usa su **peso de referencia**, que se define en la ficha del jugador, en «Antropometría con historial» (kg, g o lb); cualquier medición lo sustituye. Si tampoco hay peso de referencia, el valor no se calcula y se cuenta. La ventana antropométrica queda cerrada: ya no existe.

**Variables nuevas en el catálogo** (versión 5 de la semilla; se añaden solas al abrir la aplicación y no tocan lo que hayas editado):
- **Nordic Hamstring Exercise:** Max Force (N, izquierda/derecha), Max Force Asymmetry (%, **con signo**) y Torque (Nm, izquierda/derecha). Con esos nombres exactos se aplican ya las referencias Premier del Nordic (la asimetría se compara en valor absoluto, porque la tabla Premier no tiene signo).
- **RM** (Hamstring Bridge 8RM, Single-Leg Knee Flexion 8RM, Leg Press 8RM doble y a una pierna, RFESS 8RM, Calf Raise de pie 12RM y sentado 6RM): «Carga máxima (kg)», que introduces tú. Sin Personal Average: se muestra la carga máxima y el Personal Best (la mayor carga, con su fecha).
- **Iso-Hold** (Hip, Knee, Ankle y Seated Calf Raise): «Carga externa (kg)», que introduces tú, y las calculadas MVIC iso-push (kg), %PIMA y %BW (Knee y Ankle) o %SW (Hip y Seated Calf Raise, con el factor de su Iso-Push). Parejas: Hip, Knee y Ankle con su Run-Specific Iso-Push, y Seated Calf Raise Iso-Hold con «Single-Leg Seated Calf Raise». MVIC = media, ponderada por repeticiones y de ambos lados, de (Peak Force ÷ 9,80665 − factor × masa de cada sesión de Iso-Push) con todas las sesiones válidas; %PIMA = carga ÷ MVIC × 100; %BW y %SW usan la masa más cercana a hoy. No dependen de la fecha del Iso-Hold.
- **1RM estimado (kg)** en el 12RM de talones: (carga + masa) × 1,4. 1,4 coincide con la ecuación de Epley a 12 repeticiones (1 + 12/30); es una inferencia mía, no una fuente que hayas dado, y estas ecuaciones suelen perder precisión con muchas repeticiones (no verificado aquí). Es una estimación, no una medición.
- **Todas las asimetrías llevan signo** (la app ya lo hacía: positivo si domina la derecha, D25).
- La carga de los RM y de los Iso-Hold no viene de VALD: se carga con el Excel de importación (una columna por variable) como cualquier otro dato.
- **Calf Raise sentado:** su variable relativa del catálogo usa SW con factor 0,05 (variante que indicaste el 7/11), así que su Iso-Hold usa %SW con 0,05, no %BW.

## Comprobación de las fases 3 y 4 (unos 30 minutos)

1. **Antes de subir los archivos, guarda una copia de seguridad** desde la aplicación publicada (versión 2).
2. Sube los archivos, abre la aplicación con Ctrl+F5 y comprueba la versión `v4-0.1.0`. Tus jugadores, posiciones, mediciones y catálogo deben seguir ahí.
3. Menú «Catálogo de tests»: deben verse 34 tests. Busca «iso-hold» (4 resultados) y filtra por bloque.
4. Abre «Run-Specific Hip Iso-Push»: 5 variables (Peak Force en N, relativo SW con factor 0.29, asimetría %, RFD at 100 ms en N/s y Force at 100 ms en N). La dirección de interpretación de todas aparece como «No definido».
5. Abre «Run-Specific Knee Iso-Push»: el relativo es BW. Abre «Single-Leg Seated Calf Raise»: 5 variables, con el relativo SW al 5 % (en el detalle de la fórmula verás factor 0.05). Abre «CMJ»: 20 variables con su unidad; «SL CMJ» (16) y «Squat Jump» (4) ya tienen variables. En «DL Drop Jump 30 cm» el tiempo de contacto está en s y en «Double-Leg Hop Test» en ms (así lo muestran los PDF).
6. Crea un test de prueba, añádele una variable y un protocolo, edítalos, archívalos y comprueba que no se borra nada.
7. En una variable calculada cambia el factor SW: la aplicación debe pedir un motivo y conservar las dos versiones.
8. Menús «Manifestaciones de la fuerza», «Perímetros» y «NME»: el primero lista lo configurado; Perímetros y NME no tienen nada precargado.
9. Guarda una copia, cierra el navegador, reábrelo y comprueba que el catálogo sigue ahí. Opcional: restaura la copia hecha en el paso 1 (esquema anterior): debe recuperar tus datos y añadir el catálogo inicial.
10. **Importador:** en «Configuración» carga los datos sintéticos; en «Importar» elige `ejemplo_importacion_sintetico.xlsx`, continúa, elige el test «Run-Specific Hip Iso-Push» (las columnas deben proponerse solas), pasa a la vista previa (debe indicar 7 filas, 5 válidas y 2 con error: una con un valor no numérico y una sin ningún valor) y confirma cada jugador. Los nombres «Jugador sintético Muñoz» y «Munoz» te obligan a elegir. Guarda, descarga el informe y comprueba que aparece en «Importaciones anteriores». Vuelve a elegir el mismo fichero: debe avisar de que ya se importó y, tras confirmar, omitir todas las sesiones idénticas.
11. En Configuración elimina los datos sintéticos: sus sesiones desaparecen con ellos. Después guarda una copia y restáurala: las sesiones y el historial de importaciones deben volver.
12. **Importador de VALD:** vuelve a cargar los datos sintéticos y, en «Importar», elige el origen VALD y `ejemplo_vald_sintetico.csv`: debe reconocer RSHIP, avisar de dos fusiones (los jugadores C y E), mostrar 2 filas con error y, tras confirmar jugadores (los alias de VALD se proponen solos), guardar 6 sesiones. Después, con tus ficheros reales de VALD **y los datos sintéticos eliminados**: importa uno (por ejemplo Hip) y confirma los jugadores uno a uno; antes de guardar revisa el resumen. Haz una copia de seguridad antes.
13. Prueba la pantalla en el móvil o reduciendo la ventana: no debe haber desplazamiento horizontal de la página.

Envíame cualquier error; en «Configuración» hay un cuadro de diagnóstico.

## Qué se ha probado y qué no

Pruebas automáticas con datos sintéticos (`prueba-copias.test.mjs`, `prueba-jugadores.test.mjs`, `prueba-interfaz.test.mjs`, `prueba-jugadores-ui.test.mjs`, `prueba-catalogo.test.mjs`, `prueba-catalogo-ui.test.mjs`, `prueba-importacion.test.mjs`, `prueba-importacion-ui.test.mjs`, `prueba-vald.test.mjs` y `prueba-vald-ui.test.mjs`; requieren Node: en una carpeta con todos los archivos, `npm ci` y después `npm test`, solo para quien quiera repetirlas): copias y restauración (con y sin gzip y cifrado, rechazo de copias alteradas, de esquema posterior o con tablas desconocidas), migración de los esquemas 1 y 2 al 3 conservando los datos, normalización de nombres y propuesta de candidatos, alias, lista y orden de posiciones, historial y posición en una fecha, antropometría y medición más próxima, datos sintéticos (carga, marcado, eliminación segura), un volumen de 55 jugadores con su historial la interfaz completa de jugadores, perfil, configuración, copia y restauración, y el catálogo (carga inicial única, altas, ediciones, archivado, fórmulas con versiones y motivo, cálculos de asimetría, BW y SW contra los ejemplos de la guía, restauración de copias antiguas), sobre un navegador y una IndexedDB simulados.

Además, con un Chromium sin interfaz: la actualización real de una base creada con la versión 1c a la 4 (19 tablas, 34 tests visibles), la importación completa de un `.xlsx` real y de un CSV de VALD con el asistente (sesiones guardadas en IndexedDB, una de ellas fusionada); lectura de tus 4 ficheros reales de VALD sin errores, cero infracciones de la política de seguridad y sin desplazamiento horizontal de la página a 375, 768 y 1280 píxeles.

**Fase 5b:** probada con datos sintéticos en Chromium sin interfaz: ida y vuelta jugador ↔ test, modo y jugador de origen conservados con Atrás y recargar, tema claro y oscuro, anchos 375, 768 y 1280 sin desborde, sin mensajes de seguridad. **Sin probar:** Chrome real, volumen real y lectores de pantalla.

**Fase 5a:** probada con datos sintéticos en Chromium sin interfaz (gráficos pintados en tema claro y oscuro, anchos 375, 768 y 1280 sin desborde horizontal, excluir/reincorporar, eliminación bloqueada sin confirmación, sin violaciones de la política de seguridad). **Sin probar:** Chrome real, rendimiento con volumen real y lectores de pantalla (los gráficos llevan texto alternativo y todos los datos están en la tabla).

**No se ha probado todavía en Chrome real**: eso es lo que comprueba la lista anterior. Tampoco se ha probado en Edge.

## Limitaciones conocidas

- Solo hay una copia en un fichero: no existen copias automáticas, porque el navegador exige una acción tuya para escribir en disco.
- El registro de acciones de una copia no incluye la propia creación de esa copia (se anota después).
- Si dos mediciones antropométricas están a la misma distancia de una fecha, la selección es ambigua y habrá que elegir una; hoy solo está implementada la función que lo detecta.
- El importador de VALD conoce los códigos de la lista anterior. Con tus 13 CSV reales (8/11/2026) se leen todos sin error; no se importan 8 filas ABCMJ, 1 LCMJ y 1 LSJ (código sin perfil: hasta que me digas qué son y cómo guardarlos) ni 5 filas de Drop Jump con altura de caída 0 cm (4) o 40 cm (1) (el catálogo solo tiene 30 y 45 cm). Cada fila omitida se avisa en pantalla. Con muchos jugadores nuevos, confirmar cada nombre es largo: es deliberado (nada se vincula en silencio).
- No se puede corregir ni reemplazar una sesión ya guardada: si un valor estaba mal, hoy solo se puede guardar la versión nueva como otra sesión o eliminar los datos sintéticos; la corrección está aplazada.
- El importador de Excel no admite `.xls` antiguo (guárdalo como `.xlsx`) ni ficheros de más de 25 MB.
- El orden de manifestaciones y zonas es el de tu lista; todavía no hay flechas para reordenarlas ni para reordenar los tests.
