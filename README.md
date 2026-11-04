# Dashboard de rendimiento — fase 1c

Aplicación web de uso personal para guardar y revisar datos de rendimiento. Se abre desde un enlace en el navegador (sin instalar nada) y **los datos se guardan solo en ese navegador**.

**Esta entrega (fase 1c)** añade a la fase 1b (navegación con los tres bloques y copias de seguridad completas):

- **Jugadores:** lista con búsqueda (ignora mayúsculas y acentos), nombre en camiseta, notas, activo/inactivo (un jugador no se borra: conserva su historial).
- **Alias por fuente** (VALD, Excel u otra): el nombre con el que aparece cada jugador en cada fuente. Se usarán en las importaciones para **proponer** coincidencias; nunca vinculan sin tu confirmación.
- **Posiciones definidas por ti**, sin precarga, con **orden configurable** (las nuevas se añaden al final; no hay un orden definitivo).
- **Historial de posiciones con fechas de vigencia:** posición principal y posiciones secundarias. Cada sesión se comparará según la **posición principal que tenía el jugador en la fecha de esa sesión**; las secundarias no lo incluyen automáticamente en varios grupos. Hay una consulta «¿qué posición tenía en esta fecha?».
- **Antropometría fechada:** masa corporal, altura y longitud de extremidad inferior; cada medición es un registro; la unidad la indicas tú; ventana antropométrica configurable (sin valor por defecto).
- **Datos sintéticos de demostración**, marcados con la etiqueta SINTÉTICO y eliminables todos juntos con un botón.

Siguen sin existir tests, sesiones, importaciones ni gráficos (fases 2 en adelante). No contiene datos de jugadores reales. No hay analítica, telemetría ni conexiones a servicios externos: la página lleva una política de seguridad que bloquea cualquier conexión de red.

## Documentación del proyecto

- `guia_dashboard_performance_claude.md`: la guía del proyecto, actualizada el 2 de noviembre de 2026 con los requisitos de gráficos, las referencias «La Liga» y Premier League, y los valores de seguimiento. Es documentación; no hace falta subirla para que la aplicación funcione.
- `REQUISITOS.md`: requisitos funcionales obligatorios RF-01 a RF-03 (recorrido desde el jugador, recorrido desde el test y navegación entre ambos), con criterios de aceptación y un conjunto sintético para comprobarlos. Todavía no están implementados.
- `PLAN_DE_FASES.md`: orden actual y orden propuesto de fases (este último **no aprobado**), gráficos por fase y reglas de entrega.
- `DECISIONES.md`: decisiones tomadas y pendientes, incluido el conflicto sin resolver sobre la definición de Max (D12b).
- `DICCIONARIO_DE_DATOS.md`: tablas y formato de copia actuales.

## Estructura plana: todos los archivos en la raíz

Este repositorio no usa carpetas, para poder publicarlo con la subida web de GitHub, que sube los archivos sueltos. Todos los archivos están en la raíz y se importan entre sí con rutas del tipo `./db.js`.

**Archivos necesarios para ejecutar la aplicación (19):**

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
| `db.js` | Base de datos (esquema 2), ajustes, auditoría y estado local |
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
2. **Antes de actualizar una versión anterior, crea una copia de seguridad** desde la aplicación publicada («Copias de seguridad»). La base de datos pasa sola del esquema 1 al 2 al abrir la nueva versión y conserva lo que tuvieras, pero una copia previa es la red de seguridad.
3. Pulsa «Add file → Upload files» y selecciona o arrastra **todos los archivos a la vez**, sueltos, sin carpetas. Si un archivo ya existe con el mismo nombre, GitHub lo sustituye. Confirma con «Commit changes».
4. En «Settings → Pages», comprueba «Deploy from a branch», rama `main` y carpeta `/ (root)`. Tras uno o dos minutos la aplicación estará en `https://TU-USUARIO.github.io/dashboard-rendimiento/`.
5. Ábrela y pulsa Ctrl+F5 para evitar versiones guardadas en caché. En la parte superior debe verse la versión `v1c-0.1.0`. **Usa siempre exactamente esa dirección**: otra variante (otro dominio, `http` en lugar de `https`) es otro origen y mostraría la aplicación vacía.

Si la página se queda en «Cargando…», revisa que `libs.js` es el compilado y que están los 19 archivos necesarios. En Chrome, F12 → pestaña «Consola» muestra qué archivo no se encuentra.

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

## Comprobación de la fase 1c (unos 15 minutos)

1. Abre la aplicación y comprueba la versión `v1c-0.1.0` y que el menú y las copias siguen funcionando (guarda una copia).
2. «Configuración → Posiciones»: crea dos posiciones de prueba, cambia su orden con las flechas y comprueba que se conserva.
3. «Datos sintéticos» → cargar. En «Jugadores» deben verse 12 jugadores con la etiqueta SINTÉTICO. Busca «nombre completo vald» (encuentra por alias) y «sintetico a» (sin acento).
4. Abre «Jugador sintético A»: en «Posiciones» consulta el 10/02/2026 (Posición sintética 1) y el 10/03/2026 (Posición sintética 2). Abre «Jugador sintético D»: el 12/03/2026 debe figurar sin posición principal.
5. Crea un jugador propio de prueba con una posición inicial, cambia su posición principal desde una fecha y consulta fechas anteriores y posteriores. Añade una posición secundaria y comprueba que no cambia la principal.
6. Añade una medición antropométrica indicando la unidad; añade otra y comprueba que recuerda la unidad.
7. «Eliminar todos los datos sintéticos»: deben desaparecer solo los sintéticos y quedar tu jugador de prueba.
8. Guarda una copia, cierra todas las ventanas del navegador, reábrelo y comprueba que todo sigue ahí.
9. Opcional: en «Copias de seguridad», restaura la copia hecha en el paso 1 (sin jugadores): debe dejar vacías las tablas nuevas.

Envíame cualquier error; en «Configuración» hay un cuadro de diagnóstico.

## Qué se ha probado y qué no

Pruebas automáticas con datos sintéticos (`prueba-copias.test.mjs`, `prueba-jugadores.test.mjs`, `prueba-interfaz.test.mjs` y `prueba-jugadores-ui.test.mjs`; requieren Node: en una carpeta con todos los archivos, `npm ci` y después `npm test`, solo para quien quiera repetirlas): copias y restauración (con y sin gzip y cifrado, rechazo de copias alteradas, de esquema posterior o con tablas desconocidas), migración del esquema 1 al 2 conservando los datos, normalización de nombres y propuesta de candidatos, alias, lista y orden de posiciones, historial y posición en una fecha, antropometría y medición más próxima, datos sintéticos (carga, marcado, eliminación segura), un volumen de 55 jugadores con su historial y la interfaz completa de jugadores, perfil, configuración, copia y restauración, sobre un navegador y una IndexedDB simulados.

**No se ha probado todavía en Chrome real**: eso es lo que comprueba la lista anterior. Tampoco se ha probado en Edge.

## Limitaciones conocidas

- Solo hay una copia en un fichero: no existen copias automáticas, porque el navegador exige una acción tuya para escribir en disco.
- El registro de acciones de una copia no incluye la propia creación de esa copia (se anota después).
- Si dos mediciones antropométricas están a la misma distancia de una fecha, la selección es ambigua y habrá que elegir una; hoy solo está implementada la función que lo detecta.
- Sin tests, sesiones, importaciones ni gráficos todavía.
