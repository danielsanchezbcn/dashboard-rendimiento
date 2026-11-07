# Dashboard de rendimiento — fase 2 (catálogo de tests)

Aplicación web de uso personal para guardar y revisar datos de rendimiento. Se abre desde un enlace en el navegador (sin instalar nada) y **los datos se guardan solo en ese navegador**.

**Esta entrega (fase 2, versión 2-0.1.0)** añade a la fase 1c (jugadores, alias, posiciones con historial, antropometría fechada y datos sintéticos) el **catálogo configurable de tests**:

- **Catálogo de tests** (menú «Catálogo de tests»): lista de tests con búsqueda y filtros; alta, edición y archivado de tests, manifestaciones y zonas; detalle de cada test con sus **protocolos** y sus **variables** (nombre, unidad, tipo de valores, dirección de interpretación, manifestación y, si es calculada, su fórmula con historial de versiones). **Archivar no borra nada**; un test o variable con datos no se podrá borrar.
- **Catálogo inicial cargado** con lo que aportaste: bloques (Manifestaciones de la fuerza, Perímetros y NME), 5 manifestaciones, 4 zonas, los 35 tests de tu lista, las 19 variables de CMJ, las 9 de Reactive Strength y, en los tres Run-Specific Iso-Push, Peak Force (N), el relativo (SW en Hip, BW en Knee y Ankle) y la asimetría, y RFD at 100 ms. **Lo que no definiste aparece como «No definido»**: no se infiere ninguna unidad, dirección de interpretación ni fórmula.
- **Operaciones de fórmula cerradas**, solo las que definiste: asimetría (D25), relativo a BW y relativo a SW (factor 0,29 configurable y con historial, D27). Comprobadas con los ejemplos numéricos de la guía.
- Los bloques «Manifestaciones de la fuerza», «Perímetros» y «NME» muestran lo configurado (sin sesiones todavía).
- **Plantilla de Excel** (`plantilla_importacion_sesiones.xlsx`, versión 0.1 provisional) para el importador de la fase 3.
- La base de datos pasa sola del esquema 2 al 3 al abrir la nueva versión y conserva lo que tuvieras. Una copia de seguridad antigua (esquema 1 o 2) se puede restaurar y recibe el catálogo inicial.

Siguen sin existir sesiones, importaciones ni gráficos (fases 3 en adelante). No contiene datos de jugadores reales. No hay analítica, telemetría ni conexiones a servicios externos: la página lleva una política de seguridad que bloquea cualquier conexión de red.

**Qué no se ha precargado a propósito:** las variables de Iso-Hold, Nordic, RM y 1RM estimado, y las del resto de tests. Sus reglas están decididas (D5), pero los tests de tobillo tienen varias versiones (por ejemplo «Ankle Iso-Hold 20 s» y «Run-Specific Ankle Iso-Hold 20 s») y no he supuesto cuál corresponde a cuál. Se configuran desde la pantalla del catálogo o se precargan cuando lo confirmes.

## Documentación del proyecto

- `guia_dashboard_performance_claude.md`: la guía del proyecto, actualizada el 5 de noviembre de 2026 con los requisitos de gráficos, las referencias «La Liga» y Premier League, los valores de seguimiento (Average de sesión, Personal Average, Personal Best y Máxima repetición) y el orden de fases aprobado. Es documentación; no hace falta subirla para que la aplicación funcione.
- `REQUISITOS.md`: requisitos funcionales obligatorios RF-01 a RF-03 (recorrido desde el jugador, recorrido desde el test y navegación entre ambos), con criterios de aceptación y un conjunto sintético para comprobarlos. Todavía no están implementados (fases 5a y 5b).
- `PLAN_DE_FASES.md`: orden de fases aprobado (la fase 5 se divide en 5a, 5b y 5c), requisitos previos de cada fase, gráficos por fase y reglas de entrega.
- `DECISIONES.md`: decisiones tomadas y pendientes, con las definiciones de los valores de seguimiento (D12).
- `DICCIONARIO_DE_DATOS.md`: tablas (esquema 3), formato de copia y plantilla de importación.
- `CATALOGO_TESTS.md`: especificación del catálogo (decidido, propuesto y pendiente).
- `CONTEXTO.md`: documento de traspaso para retomar el proyecto.

## Estructura plana: todos los archivos en la raíz

Este repositorio no usa carpetas, para poder publicarlo con la subida web de GitHub, que sube los archivos sueltos. Todos los archivos están en la raíz y se importan entre sí con rutas del tipo `./db.js`.

**Archivos necesarios para ejecutar la aplicación (22):**

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
| `db.js` | Base de datos (esquema 3), ajustes, auditoría y estado local |
| `fechas.js` | Fechas de calendario sin zona horaria |
| `jugadores.js` | Jugadores, alias y propuesta de candidatos |
| `posiciones.js` | Lista de posiciones, historial y posición en una fecha |
| `antropometria.js` | Mediciones fechadas y medición más próxima a una fecha |
| `sinteticos.js` | Datos sintéticos de demostración |
| `backup.js`, `io.js` | Copia completa, validación, restauración y guardado en disco |
| `libs.js` | Librerías de terceros ya compiladas (ver `LIBRERIAS.md`) |

**Archivos opcionales** (la aplicación funciona sin ellos): `README.md`, `LEEME.md`, `guia_dashboard_performance_claude.md`, `REQUISITOS.md`, `PLAN_DE_FASES.md`, `DECISIONES.md`, `DICCIONARIO_DE_DATOS.md`, `LIBRERIAS.md`, y las herramientas de desarrollo `libs-fuente.js`, `package.json`, `package-lock.json`, `prueba-copias.test.mjs`, `prueba-jugadores.test.mjs`, `prueba-interfaz.test.mjs` y `prueba-jugadores-ui.test.mjs`.

**Atención: `libs.js` y `libs-fuente.js` son archivos distintos.** `libs.js` (unos 113 KB, ilegible: está compilado) es el que necesita la aplicación. `libs-fuente.js` (unas 10 líneas) es solo el origen para recompilarlo. Si en el repositorio `libs.js` pesa unos 500 bytes, contiene el origen por error y la aplicación no arranca: sube de nuevo `libs.js`.

## Publicar la aplicación (GitHub Pages, subida web)

1. En tu cuenta de GitHub usa el repositorio **público** `dashboard-rendimiento` (con el plan gratuito, Pages exige repositorio público; el código será público, los datos nunca).
2. **Antes de actualizar una versión anterior, crea una copia de seguridad** desde la aplicación publicada («Copias de seguridad»). La base de datos pasa sola del esquema 1 o 2 al 3 al abrir la nueva versión y conserva lo que tuvieras, pero una copia previa es la red de seguridad.
3. Pulsa «Add file → Upload files» y selecciona o arrastra **todos los archivos a la vez**, sueltos, sin carpetas. Si un archivo ya existe con el mismo nombre, GitHub lo sustituye. Confirma con «Commit changes».
4. En «Settings → Pages», comprueba «Deploy from a branch», rama `main` y carpeta `/ (root)`. Tras uno o dos minutos la aplicación estará en `https://TU-USUARIO.github.io/dashboard-rendimiento/`.
5. Ábrela y pulsa Ctrl+F5 para evitar versiones guardadas en caché. En la parte superior debe verse la versión `v2-0.1.0`. **Usa siempre exactamente esa dirección**: otra variante (otro dominio, `http` en lugar de `https`) es otro origen y mostraría la aplicación vacía.

Si la página se queda en «Cargando…», revisa que `libs.js` es el compilado y que están los 22 archivos necesarios. En Chrome, F12 → pestaña «Consola» muestra qué archivo no se encuentra.

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

## Comprobación de la fase 2 (unos 15 minutos)

1. **Antes de subir los archivos, guarda una copia de seguridad** desde la aplicación publicada (versión 1c).
2. Sube los archivos, abre la aplicación con Ctrl+F5 y comprueba la versión `v2-0.1.0`. Tus jugadores, posiciones y mediciones deben seguir ahí.
3. Menú «Catálogo de tests»: deben verse 35 tests. Busca «iso-hold» (5 resultados) y filtra por bloque.
4. Abre «Run-Specific Hip Iso-Push»: 4 variables (Peak Force en N, relativo SW con factor 0.29, asimetría %, RFD at 100 ms). La unidad de RFD at 100 ms y la dirección de interpretación de todas aparecen como «No definido».
5. Abre «Run-Specific Knee Iso-Push»: el relativo es BW. Abre «CMJ»: 19 variables con los nombres de tu lista, sin unidades; «SL CMJ» y «Squat Jump» no tienen variables.
6. Crea un test de prueba, añádele una variable y un protocolo, edítalos, archívalos y comprueba que no se borra nada.
7. En una variable calculada cambia el factor SW: la aplicación debe pedir un motivo y conservar las dos versiones.
8. Menús «Manifestaciones de la fuerza», «Perímetros» y «NME»: el primero lista lo configurado; Perímetros y NME no tienen nada precargado.
9. Guarda una copia, cierra el navegador, reábrelo y comprueba que el catálogo sigue ahí. Opcional: restaura la copia hecha en el paso 1 (esquema anterior): debe recuperar tus datos y añadir el catálogo inicial.
10. Prueba la pantalla en el móvil o reduciendo la ventana: no debe haber desplazamiento horizontal de la página.

Envíame cualquier error; en «Configuración» hay un cuadro de diagnóstico.

## Qué se ha probado y qué no

Pruebas automáticas con datos sintéticos (`prueba-copias.test.mjs`, `prueba-jugadores.test.mjs`, `prueba-interfaz.test.mjs`, `prueba-jugadores-ui.test.mjs`, `prueba-catalogo.test.mjs` y `prueba-catalogo-ui.test.mjs`; requieren Node: en una carpeta con todos los archivos, `npm ci` y después `npm test`, solo para quien quiera repetirlas): copias y restauración (con y sin gzip y cifrado, rechazo de copias alteradas, de esquema posterior o con tablas desconocidas), migración de los esquemas 1 y 2 al 3 conservando los datos, normalización de nombres y propuesta de candidatos, alias, lista y orden de posiciones, historial y posición en una fecha, antropometría y medición más próxima, datos sintéticos (carga, marcado, eliminación segura), un volumen de 55 jugadores con su historial la interfaz completa de jugadores, perfil, configuración, copia y restauración, y el catálogo (carga inicial única, altas, ediciones, archivado, fórmulas con versiones y motivo, cálculos de asimetría, BW y SW contra los ejemplos de la guía, restauración de copias antiguas), sobre un navegador y una IndexedDB simulados.

Además, con un Chromium sin interfaz: la actualización real de una base creada con la versión 1c a la 3 (16 tablas, 35 tests visibles), cero infracciones de la política de seguridad y sin desplazamiento horizontal de la página a 375, 768 y 1280 píxeles.

**No se ha probado todavía en Chrome real**: eso es lo que comprueba la lista anterior. Tampoco se ha probado en Edge.

## Limitaciones conocidas

- Solo hay una copia en un fichero: no existen copias automáticas, porque el navegador exige una acción tuya para escribir en disco.
- El registro de acciones de una copia no incluye la propia creación de esa copia (se anota después).
- Si dos mediciones antropométricas están a la misma distancia de una fecha, la selección es ambigua y habrá que elegir una; hoy solo está implementada la función que lo detecta.
- Sin sesiones, importaciones ni gráficos todavía: el catálogo define las variables y las fórmulas, pero aún no calcula nada sobre datos reales.
- La plantilla de Excel es provisional: puede cambiar al construir el importador (fase 3).
- El orden de manifestaciones y zonas es el de tu lista; todavía no hay flechas para reordenarlas ni para reordenar los tests.
