# Medir ángulos (NME) — herramienta de medición por fotografía integrada en el dashboard

Origen: «Digitalizador de tests angulares — GFC S&C» (aplicación del usuario, 10/11/2026). Mide ángulos entre segmentos de cadera, rodilla y tobillo a partir de fotografías y, desde la integración, guarda los resultados en el jugador. **Las fotos no se guardan ni salen del navegador; solo se guardan los ángulos.**

## Equivalencia con la aplicación original (comprobada el 10/11/2026)
- **Byte a byte idénticos** a los archivos adjuntos: `angulos-utils.js`, `-registry.js`, `-engine.js`, `-exportar.js`, `-test-jurdan.js`, `-test-aket.js` y las pruebas (`-pruebas-runner.js`, `-pruebas-geometria.js`, `-pruebas.css`): toda la geometría, las asignaciones de piernas y la exportación son las tuyas.
- **Modificados solo en lo indicado abajo:** `angulos-detector.js` (dónde se busca MediaPipe), `angulos-app.js` (aviso al dashboard) y `angulos.css` (puntos de corte y ancho de la barra lateral).
- **Prueba de comportamiento:** la aplicación original y la integrada, con las mismas fotos y las mismas acciones (cargar dos fotos, arrastrar cuatro landmarks, reasignar una pierna con un clic, cambiar de lado, cambiar a AKET y volver, reiniciar) dan exactamente los mismos resultados, estados de detección, roles y coordenadas en los 10 pasos. Tus 55 pruebas de geometría dan 55 de 55 con los archivos renombrados.

## Cómo se usa
NME → «Abrir Medir ángulos» (`#nme-angulos`). Elegir jugador y fecha, cargar la Foto 1 y la Foto 2, revisar/arrastrar los puntos y pulsar «Guardar en el jugador». La herramienta queda lista para el siguiente jugador. Se guarda una sesión del test «Jurdan Test» con los ángulos a 1 decimal. JURDAN RESULTS se calcula como en el Excel: izquierda = Hams izq − Psoas der; derecha = Hams der − Psoas izq. No sobrescribe: si ya hay una sesión del mismo jugador, test, fecha y hora, avisa (indica otra hora).

## Archivos (repositorio plano; todos llevan el prefijo `angulos`)
| Archivo | Qué es |
|---|---|
| `angulos.html`, `angulos.css` | Página de la herramienta (se abre sola o dentro de un marco del dashboard) |
| `angulos-utils.js`, `-registry.js`, `-detector.js`, `-engine.js`, `-exportar.js`, `-app.js` | Motor y aplicación originales (carpetas `core`, `features` y `app.js` del original) |
| `angulos-test-jurdan.js`, `-test-aket.js`, `-test-pendientes.js` | Un archivo por test (Jurdan y AKET activos; SJTT, 90/90 y Nordic pendientes de protocolo) |
| `angulos-pruebas.html` (+ `-runner.js`, `-geometria.js`, `.css`) | Las 55 pruebas de geometría originales. Abrir `angulos-pruebas.html`: debe dar 55 de 55 |
| `angulos-mapa.js` | **Destino en el catálogo**: qué medida va a qué variable y lado |
| `pages-angulos.js` | Pantalla del dashboard (jugador, fecha, tabla de lo que se guardará, marco) |

## Cambios respecto a la aplicación original (nada de la geometría)
1. Rutas y nombres de archivo (repositorio plano) y puntos de corte del diseño responsive más bajos (820/560 px en vez de 1100/760) para mantener las tres columnas dentro del dashboard.
2. `angulos-app.js`: avisa al dashboard de los resultados vigentes (`postMessage` solo al mismo origen) y obedece a «reiniciar». Abierta sola no hace nada nuevo.
3. `angulos-detector.js`: MediaPipe se busca en la **misma carpeta** (antes, CDN de jsdelivr y storage.googleapis). El dashboard no permite conexiones a internet.
4. Política de seguridad propia de `angulos.html`: sin red (`connect-src 'self'`), atributos `style` en línea permitidos (los usa el panel de resultados) y `'wasm-unsafe-eval'` solo para el detector local. La política del dashboard solo añade `frame-src 'self'`.

## Detección automática de puntos (opcional; NO verificada)
**Actualización 10/11/2026:** los cinco archivos de ejecución oficiales de MediaPipe (`vision_bundle.mjs` y los cuatro `vision_wasm*`, paquete npm `@mediapipe/tasks-vision` 0.10.14) ya están junto a `angulos.html` y se cargan sin errores (comprobado en Chrome). **Falta únicamente el modelo `pose_landmarker_full.task`** (~9 MB; Google no permite descargarlo desde el entorno de trabajo): descárgalo en tu navegador desde https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task y súbelo al repositorio junto a `angulos.html`. Con él, la detección automática funciona como en tu aplicación original (AUTO / REVISAR y corrección manual); esa última parte no se ha podido probar aquí.

Sin el modelo la foto pasa a **MANUAL**: los puntos se colocan a mano (todo lo demás funciona; es lo que está probado). Para activar la detección hay que subir junto a `angulos.html`: `vision_bundle.mjs`, `vision_wasm_internal.js`, `vision_wasm_internal.wasm`, `vision_wasm_nosimd_internal.js`, `vision_wasm_nosimd_internal.wasm` (del paquete npm `@mediapipe/tasks-vision` 0.10.14, carpetas raíz y `wasm`) y `pose_landmarker_full.task` (el original usaba `heavy`, ~29 MB, que supera el límite de 25 MB de la subida por navegador de GitHub; `full` es algo menos preciso). No se ha podido descargar el modelo desde el entorno de trabajo, así que esta ruta **no se ha probado**; si fallase, vuelve sola a MANUAL.

## Añadir un nuevo test de ángulos
1. **Herramienta:** copiar `angulos-test-jurdan.js` (dos piernas con roles) o `angulos-test-aket.js` (una pierna) a `angulos-test-NUEVO.js`, definir `label`, `enabled: true` y los `angles` (respecto a la horizontal `{ pair, outPrefix }` o ángulo incluido `{ type: 'included', vertex, ray1, ray2, outPrefix }`), y añadir su `<script>` en `angulos.html` y en `angulos-pruebas.html` si se prueba. No se toca el motor.
2. **Catálogo:** crear el test y sus variables en el bloque NME (pantalla «Catálogo de tests»).
3. **Destino:** añadir una entrada en `ANGULOS_DESTINOS` de `angulos-mapa.js`: `salidas` (clave `prefijo-left/right` → nombre de la variable y lado) y, si hay variables calculadas, `derivadas`. Hasta entonces se puede medir pero no guardar (la pantalla lo avisa). AKET está en este caso: no tiene test ni variables en el catálogo.
4. Importación desde Excel: ya funciona con cualquier test de NME.


## Signo de la asimetría (10/11/2026)
Se aplica la misma regla que en el resto del dashboard: en grados, derecha − izquierda (positivo = valor mayor a la derecha, se muestra con la letra R/L). AKET se puede medir pero no se registra (decisión del usuario, 10/11/2026): no hay test de AKET en el catálogo.
