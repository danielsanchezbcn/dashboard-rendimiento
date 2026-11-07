# Dashboard de rendimiento — fase 4 (importadores de Excel y VALD)

Aplicación web de uso personal para guardar y revisar datos de rendimiento. Se abre desde un enlace en el navegador (sin instalar nada) y **los datos se guardan solo en ese navegador**.

**Esta entrega (fase 4, versión 4-0.1.0)** añade el **importador de VALD** al asistente «Importar» (elige el origen «Exportación CSV de VALD ForceDecks»):

- Reconoce cada fila por su código de test y un mismo fichero puede traer varios: **RSHIP/RSKIP/RSAIP** (Hip/Knee/Ankle Iso-Push), **SLHNNI** (Supine 90°/90°), **SLSEICR** (Seated Calf Raise), **SLJ** (SL CMJ), **CMJ**, **SJ** (Squat Jump), **HJ** (Hop Test) y **DJ** (Drop Jump, separado en 30 cm y 45 cm por su altura). Cada test se guarda en su propio lote. **No importa** el peso corporal (BW), las etiquetas (Tags), la media sin lado ni las asimetrías de los tests por lado (se recalcularán desde izquierda y derecha). **No se importan y se listan en el informe:** los códigos ABCMJ, LCMJ y LSJ, las filas con carga adicional > 0 y los Drop Jump de alturas distintas de 30 y 45 cm.
- **Asimetrías de Hop y Drop Jump (D43):** VALD las da como «11 L» o «3.8 R»; la letra es el lado con el valor más alto. Se guardan con signo como D25 (R → positivo, L → negativo; «0» = 0). La magnitud viene redondeada por VALD, y al fusionar filas del mismo día la asimetría fusionada es una media ponderada aproximada.
- **Lista de atletas de VALD (origen «Lista de atletas…»):** da de alta los jugadores con el nombre completo y el alias de la fuente VALD, para que luego los tests se vinculen solos (siempre con tu confirmación). No guarda fecha de nacimiento, altura, peso, sexo, correo ni vald-id. Las posiciones (columnas Category/Group con «Position») se asignan solo si eliges la equivalencia y una fecha de inicio, y nunca pisan una posición ya registrada. Con tu fichero real: 88 atletas, 0 avisos, 6 posiciones de VALD (2 atletas sin posición).
- **Catálogo (semilla v3):** en SL CMJ las variables de fuerza de despegue y de aterrizaje pasan a «/ BM» en N/kg (así vienen en el CSV). Al actualizar, las unidades de variables del catálogo inicial escritas a mano que difieran de la definitiva se alinean y cada cambio queda en el registro de auditoría.
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

**Qué no se ha precargado a propósito:** las variables de Iso-Hold, Nordic, RM y 1RM estimado, y las del resto de tests. Sus reglas están decididas (D5), pero aún no has definido sus variables (hasta ahora los tests de tobillo tenían nombres duplicados; el 7 de noviembre confirmaste que «Ankle Iso-Hold 20 s» y «Run-Specific Ankle Iso-Hold 20 s» son el mismo test y queda solo el primero). Se configuran desde la pantalla del catálogo o se precargan cuando lo confirmes.

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

**Archivos necesarios para ejecutar la aplicación (27):**

| Archivo | Contenido |
|---|---|
| `index.html` | Página y política de seguridad; carga `main.js` |
| `style.css` | Estilos (claro/oscuro, adaptable a móvil, tableta y ordenador) |
| `main.js` | Arranque |
| `app.js` | Navegación y rutas |
| `pages.js` | Páginas: inicio, bloques, copias de seguridad, configuración |
| `pages-jugadores.js` | Lista de jugadores y perfil (alias, posiciones, antropometría) |
| `pages-ajustes.js` | Configuración de posiciones, ventana antropométrica y datos sintéticos |
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

**Atención: `libs.js` y `libs-fuente.js` son archivos distintos.** `libs.js` (unos 166 KB, ilegible: está compilado) es el que necesita la aplicación. `libs-fuente.js` (unas 10 líneas) es solo el origen para recompilarlo. Si en el repositorio `libs.js` pesa unos 500 bytes, contiene el origen por error y la aplicación no arranca: sube de nuevo `libs.js`.

## Publicar la aplicación (GitHub Pages, subida web)

1. En tu cuenta de GitHub usa el repositorio **público** `dashboard-rendimiento` (con el plan gratuito, Pages exige repositorio público; el código será público, los datos nunca).
2. **Antes de actualizar una versión anterior, crea una copia de seguridad** desde la aplicación publicada («Copias de seguridad»). La base de datos pasa sola del esquema 1, 2 o 3 al 4 al abrir la nueva versión y conserva lo que tuvieras, pero una copia previa es la red de seguridad.
3. Pulsa «Add file → Upload files» y selecciona o arrastra **todos los archivos a la vez**, sueltos, sin carpetas. Si un archivo ya existe con el mismo nombre, GitHub lo sustituye. Confirma con «Commit changes».
4. En «Settings → Pages», comprueba «Deploy from a branch», rama `main` y carpeta `/ (root)`. Tras uno o dos minutos la aplicación estará en `https://TU-USUARIO.github.io/dashboard-rendimiento/`.
5. Ábrela y pulsa Ctrl+F5 para evitar versiones guardadas en caché. En la parte superior debe verse la versión `v4-0.1.0`. **Usa siempre exactamente esa dirección**: otra variante (otro dominio, `http` en lugar de `https`) es otro origen y mostraría la aplicación vacía.

Si la página se queda en «Cargando…», revisa que `libs.js` es el compilado y que están los 27 archivos necesarios. En Chrome, F12 → pestaña «Consola» muestra qué archivo no se encuentra.

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

**No se ha probado todavía en Chrome real**: eso es lo que comprueba la lista anterior. Tampoco se ha probado en Edge.

## Limitaciones conocidas

- Solo hay una copia en un fichero: no existen copias automáticas, porque el navegador exige una acción tuya para escribir en disco.
- El registro de acciones de una copia no incluye la propia creación de esa copia (se anota después).
- Si dos mediciones antropométricas están a la misma distancia de una fecha, la selección es ambigua y habrá que elegir una; hoy solo está implementada la función que lo detecta.
- El importador de VALD conoce los códigos de la lista anterior; ABCMJ, LCMJ y LSJ no se importan hasta saber qué son y cómo guardarlos. Con muchos jugadores nuevos, confirmar cada nombre es largo: es deliberado (nada se vincula en silencio).
- No hay gráficos ni cálculos de relativos y asimetrías sobre las sesiones todavía (fases 4 y 5).
- No se puede corregir ni reemplazar una sesión ya guardada: si un valor estaba mal, hoy solo se puede guardar la versión nueva como otra sesión o eliminar los datos sintéticos; la corrección está aplazada.
- El importador de Excel no admite `.xls` antiguo (guárdalo como `.xlsx`) ni ficheros de más de 25 MB.
- El orden de manifestaciones y zonas es el de tu lista; todavía no hay flechas para reordenarlas ni para reordenar los tests.
