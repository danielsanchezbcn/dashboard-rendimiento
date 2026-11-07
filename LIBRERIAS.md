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
- **SHA-256 de `libs.js`:** `514db575fbf86a6d209196fcebbf634f85ecc541904dbb7bc50a1d03b74c22e1` (166.408 bytes; recompilada el 7/11/2026 al incorporar read-excel-file`.
- **Comprobaciones hechas:** el paquete no contiene `eval` ni `new Function` ni importaciones a direcciones externas, de modo que cumple la política de seguridad de la página (`script-src 'self'`). El paquete contiene una vía de código de fflate que crearía un `Worker` desde un `blob:`; el importador usa la entrada «universal» (lectura síncrona) y se ha comprobado en Chromium real con un `.xlsx` sin ninguna infracción de la política. read-excel-file 9.3.14 existía pero tenía menos de 14 días: se fijó la 9.3.12.
- **Reproducir la compilación:** en una carpeta con `libs-fuente.js`, `package.json` y `package-lock.json`, `npm ci` y `npm run build-vendor` (genera `libs.js`). No hace falta para usar la aplicación.
- **Actualizar una librería:** cambiar la versión exacta en `package.json`, volver a compilar, ejecutar las pruebas (`npm test`) y actualizar esta tabla y el SHA-256.

## Prevista (todavía no incorporada)

| Librería | Versión | Licencia | Uso | Cuándo |
|---|---|---|---|---|
| Chart.js (con @kurkle/color 0.3.x) | 4.6.1, publicada el 22/10/2026 | MIT | Líneas, dispersión, barras y radar; solo esos componentes. Unos 180 KB minimizada en la prueba | Fase 5a, dentro de `libs.js` (decisión D20, 6/11/2026) |

Pendiente de comprobar al integrarla: rendimiento con el volumen real, Chrome real, tema claro y accesibilidad. En ese momento se actualizará el SHA-256 de `libs.js`; el SHA-256 vigente será el de ese momento.
