# Dashboard de rendimiento — fase 1b

Aplicación web de uso personal para guardar y revisar datos de rendimiento. Se abre desde un enlace en el navegador (sin instalar nada) y **los datos se guardan solo en ese navegador**. Esta entrega (fase 1b) contiene el esqueleto, la navegación con los tres bloques (Manifestaciones de la fuerza, Perímetros y NME, sin contenido hasta que lo definas) y las **copias de seguridad completas**. Jugadores, posiciones y antropometría llegan en la fase 1c; el catálogo de tests, en la fase 2.

No contiene datos de jugadores ni datos de ejemplo. No hay analítica, telemetría ni conexiones a servicios externos: la página lleva una política de seguridad que bloquea cualquier conexión de red.

## Estructura plana: todos los archivos en la raíz

Este repositorio no usa carpetas, para poder publicarlo con la subida web de GitHub, que sube los archivos sueltos. Todos los archivos están en la raíz y se importan entre sí con rutas del tipo `./db.js`.

**Archivos necesarios para ejecutar la aplicación (11):**

| Archivo | Contenido |
|---|---|
| `index.html` | Página y política de seguridad; carga `main.js` |
| `style.css` | Estilos (claro/oscuro, adaptable a móvil, tableta y ordenador) |
| `main.js` | Arranque |
| `app.js` | Navegación y estructura de la aplicación |
| `pages.js` | Páginas: inicio, bloques, copias de seguridad, configuración |
| `context.js`, `util.js` | Contexto compartido y funciones auxiliares |
| `db.js` | Base de datos, ajustes, auditoría y estado local |
| `backup.js` | Copia completa, validación y restauración |
| `io.js` | Guardado de copias en disco |
| `libs.js` | Librerías de terceros ya compiladas (ver `LIBRERIAS.md`) |

**Archivos opcionales** (la aplicación funciona sin ellos): `README.md`, `LEEME.md`, `DECISIONES.md`, `DICCIONARIO_DE_DATOS.md`, `LIBRERIAS.md`, y las herramientas de desarrollo `libs-fuente.js`, `package.json`, `package-lock.json`, `prueba-copias.test.mjs` y `prueba-interfaz.test.mjs`.

**Atención: `libs.js` y `libs-fuente.js` son archivos distintos.** `libs.js` (unos 113 KB, ilegible: está compilado) es el que necesita la aplicación. `libs-fuente.js` (unas 10 líneas) es solo el origen para recompilarlo. Si en el repositorio `libs.js` pesa unos 500 bytes, contiene el origen por error y la aplicación no arranca: sube de nuevo `libs.js`.

## Publicar la aplicación (GitHub Pages, subida web)

1. En tu cuenta de GitHub, crea un repositorio **público** llamado `dashboard-rendimiento` (con el plan gratuito, Pages exige repositorio público; el código será público, los datos nunca). Si ya existe con archivos de una entrega anterior, usa ese mismo.
2. Pulsa «Add file → Upload files» y selecciona o arrastra **todos los archivos a la vez**, sueltos, sin carpetas. Si un archivo ya existe con el mismo nombre, GitHub lo sustituye. Confirma con «Commit changes».
3. En «Settings → Pages», elige «Deploy from a branch», rama `main` y carpeta `/ (root)`. Tras uno o dos minutos la aplicación estará en `https://TU-USUARIO.github.io/dashboard-rendimiento/`.
4. Ábrela con Chrome o Edge y pulsa Ctrl+F5 para evitar versiones guardadas en caché. En la parte superior debe verse la versión `v1b-0.1.1`. Guarda la dirección en favoritos y **usa siempre exactamente esa dirección**: otra variante (otro dominio, `http` en lugar de `https`) es otro origen y mostraría la aplicación vacía.

Si la página se queda en «Cargando…», revisa que `libs.js` es el compilado y que están los 11 archivos necesarios. En Chrome, F12 → pestaña «Consola» muestra qué archivo no se encuentra.

### Origen compartido (decisión D3)

Los datos del navegador pertenecen al **origen** (`https://TU-USUARIO.github.io`), no a cada repositorio. Por eso, tal y como decidiste, **no publiques otros sitios en esta cuenta**: cualquier página servida desde el mismo origen podría leer la base de datos de la aplicación.

Cuando compruebes que esta aplicación funciona, **elimina o despublica el repositorio de la prueba de viabilidad** (`prueba-viabilidad`), que está en el mismo origen. Si quieres, antes pulsa en ella «Borrar datos de prueba».

## Dónde quedan los datos

En IndexedDB del navegador, en este equipo y en este perfil de usuario. No se envían a ningún servidor ni se sincronizan con otros dispositivos. La seguridad de acceso es la de tu cuenta del equipo.

**Si se borran los datos del sitio** (por ejemplo, «Borrar datos de navegación» incluyendo «Cookies y otros datos de sitios»), si usas otro perfil o navegador, o si pierdes el portátil antes de descargar una copia, **los datos se pierden**. Chrome ha respondido «no» a la solicitud de almacenamiento persistente, así que también podría borrarlos si se quedara sin espacio en disco. La protección real son las copias de seguridad.

## Copias de seguridad

En «Copias de seguridad»:

- **Crear copia completa:** un único fichero con todos los datos y la configuración. Opciones: comprimir (gzip) y cifrar con contraseña (mínimo 8 caracteres; si la pierdes, la copia no se puede recuperar). Guárdala donde elijas (USB, carpeta sincronizada) o recuerda una carpeta para guardar con un clic. Guarda copias en dos ubicaciones distintas. El navegador puede volver a pedir permiso para escribir en la carpeta recordada.
- **Restaurar copia:** elige el fichero, «Leer y validar», revisa el resumen y la comparación de registros por tabla, marca la confirmación y pulsa «Restaurar». Reemplaza todos los datos actuales en una sola operación y la verifica: si algo falla, no cambia nada. Restaurar una copia anterior recupera datos eliminados después de crearla.
- Para usar los datos en otro portátil, restaura allí una copia.

La aplicación avisa si nunca has creado una copia y, si lo configuras en «Configuración», cuando la última supere el plazo en días que definas.

## Comprobación de la fase 1b (unos 10 minutos)

1. Abre la aplicación y recorre el menú: deben verse los tres bloques sin tests, medidas ni contenido precargado.
2. «Copias de seguridad» → «Elegir carpeta» y «Guardar copia en la carpeta recordada».
3. «Configuración» → define un plazo de 14 días y guarda.
4. «Copias de seguridad» → «Restaurar» la copia que acabas de crear → «Leer y validar» → confirma → «Restaurar». Debe indicar que la restauración está verificada.
5. En «Configuración», el plazo debe volver a «Sin definir» (la copia es anterior a ese ajuste), y el registro debe mostrar la restauración.
6. Cierra todas las ventanas del navegador, reábrelo y comprueba que la aplicación se abre y conserva el estado de la base (la fecha de creación en «Inicio» no cambia).
7. Opcional: repite con una copia cifrada y comprimida. Opcional: prueba también en Edge.

Envíame cualquier mensaje de error que aparezca; en «Configuración» hay un cuadro de diagnóstico con la versión, el origen, el navegador y el espacio usado.

## Qué se ha probado y qué no

Pruebas automáticas con datos sintéticos (`prueba-copias.test.mjs` y `prueba-interfaz.test.mjs`; requieren Node: en una carpeta con todos los archivos, `npm ci` y después `npm test`, solo para quien quiera repetirlas): creación de la base, copias con y sin gzip y cifrado, validación y rechazo de copias alteradas, de esquema posterior o con tablas desconocidas, aceptación de una copia de un esquema anterior en una base de un esquema posterior, restauración atómica con verificación, 5.000 registros y la interfaz completa (navegación, bloques, creación y restauración de copias, copia inválida y cifrada) sobre un navegador y una IndexedDB simulados.

**No se ha probado todavía en Chrome real**: eso es lo que comprueba la lista anterior. Tampoco se ha probado en Edge ni con la política de seguridad aplicada por el navegador (la prueba de viabilidad sí demostró que Chrome la aplica).

## Limitaciones conocidas

- Solo hay una copia en un fichero: no existen copias automáticas, porque el navegador exige una acción tuya para escribir en disco.
- El registro de acciones de una copia no incluye la propia creación de esa copia (se anota después).
- No hay todavía jugadores, catálogo, importaciones ni análisis (fases 1c a 6).
