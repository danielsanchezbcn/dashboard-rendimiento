# Librerías de terceros

`libs.js` es un único fichero que agrupa las librerías de terceros. Se compiló una sola vez a partir de `libs-fuente.js`; el código propio de la aplicación no se compila. No confundas ambos ficheros: `libs.js` (unos 166 KB) es el que carga la aplicación; `libs-fuente.js` (unas 10 líneas) solo sirve para recompilarlo.

| Librería | Versión | Licencia | Uso |
|---|---|---|---|
| Preact | 10.29.8 | MIT | Interfaz |
| htm | 3.1.1 | Apache-2.0 | Plantillas de la interfaz sin compilar |
| Dexie | 4.4.6 | Apache-2.0 | Acceso a IndexedDB (esquemas versionados, transacciones) |
| read-excel-file | 9.3.12 | MIT | Lectura de ficheros .xlsx en el importador (con sus dependencias fflate 0.8.3, saxen 11.2.0, unzipper-esm 0.13.3 y worker-f 0.1.21) |
| esbuild (solo para compilar) | 0.28.2 | MIT | Genera `libs.js` |

- **Criterio de versión:** la última versión estable publicada hace al menos 14 días en la fecha de la compilación (1 de noviembre de 2026). Existen versiones más nuevas (por ejemplo Preact 11.x y Dexie 4.4.7), publicadas hacía menos de ese plazo o de una línea mayor distinta que no se ha adoptado.
- **9/11/2026 (8j): `libs.js` recompilado con `--alias:fflate=./fflate-sync.js`** (fichero `fflate-sync.js`, solo para compilar). Motivo: con libros Excel grandes (hoja de más de ~0,5 MB sin comprimir, p. ej. la hoja GROIN del Excel de cadera) fflate descomprimía en un Web Worker creado desde un `blob:`, que la política `script-src 'self'` bloquea, y el importador no pasaba del paso 1. Ahora descomprime de forma síncrona (`unzipSync`), sin workers y sin tocar la política de seguridad. Nuevo SHA-256 `e948e39bc873b057a2075aa5c7cf755247b49467239cf19099c57ab65f5dfee6` (337.915 bytes); la compilación sin el alias reproduce exactamente el hash anterior.
- **SHA-256 anterior de `libs.js` (hasta 8i):** `029e9c517352ba9e91c88f1ef39a611643fb439a1108631ae7701ecc89400bc8` (340.139 bytes; recompilada el 7/11/2026 al incorporar Chart.js 4.6.1 en la fase 5a; antes `514db575…`, 166.408 bytes).
- **Comprobaciones hechas:** el paquete no contiene `eval` ni `new Function` ni importaciones a direcciones externas, de modo que cumple la política de seguridad de la página (`script-src 'self'`). El paquete contiene una vía de código de fflate que crearía un `Worker` desde un `blob:`; el importador usa la entrada «universal» (lectura síncrona) y se ha comprobado en Chromium real con un `.xlsx` sin ninguna infracción de la política. read-excel-file 9.3.14 existía pero tenía menos de 14 días: se fijó la 9.3.12.
- **Reproducir la compilación:** en una carpeta con `libs-fuente.js`, `package.json` y `package-lock.json`, `npm ci` y `npm run build-vendor` (genera `libs.js`). No hace falta para usar la aplicación.
- **Actualizar una librería:** cambiar la versión exacta en `package.json`, volver a compilar, ejecutar las pruebas (`npm test`) y actualizar esta tabla y el SHA-256.

## Prevista (todavía no incorporada)

| Librería | Versión | Licencia | Uso | Cuándo |
|---|---|---|---|---|
| Chart.js (con @kurkle/color 0.3.x) | 4.6.1, publicada el 22/10/2026 | MIT | Líneas, dispersión, barras y radar; solo esos componentes. Unos 180 KB minimizada en la prueba | Fase 5a, dentro de `libs.js` (decisión D20, 6/11/2026) |

**Integrada el 7/11/2026 (fase 5a):** solo se registran líneas, puntos y barras (el paquete crece 174 KB). Comprobado en Chromium sin interfaz: tema claro y oscuro, sin violaciones de la política de seguridad. **Sin comprobar:** rendimiento con el volumen real, Chrome real y lectores de pantalla.

## Lectura de imágenes (OCR) — fase 7v
- **Tesseract.js 5.1.1** (Apache-2.0) → `ocr-tesseract.js` (módulo ES) y `ocr-worker.js`; **tesseract.js-core 5.1.1** (Apache-2.0) → `ocr-core.js` (núcleo wasm con SIMD); **@tesseract.js-data/eng 1.0.0** (Apache-2.0, `4.0.0_best_int`) → `eng.traineddata.gz`.
- Se cargan desde el mismo origen (sin red externa); `cacheMethod: 'none'`. Solo se usan al importar una imagen de antropometría.

## MediaPipe Tasks Vision 0.10.14 (ángulos, 10/11/2026)
Archivos copiados sin modificar del paquete npm oficial `@mediapipe/tasks-vision@0.10.14` (licencia Apache-2.0). SHA-256: vision_bundle.mjs e77f281f…7669 · vision_wasm_internal.js 9440cf0c…ab9c · vision_wasm_internal.wasm f82a8e6c…17dc · vision_wasm_nosimd_internal.js abe9b6fb…e054 · vision_wasm_nosimd_internal.wasm 38b61fea…8b97. Pendiente: el modelo pose_landmarker_heavy.task, que sube el usuario.
