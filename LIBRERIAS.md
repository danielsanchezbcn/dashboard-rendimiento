# Librerías de terceros

`libs.js` es un único fichero que agrupa las librerías de terceros. Se compiló una sola vez; el código propio de la aplicación (`src/`) no se compila.

| Librería | Versión | Licencia | Uso |
|---|---|---|---|
| Preact | 10.29.8 | MIT | Interfaz |
| htm | 3.1.1 | Apache-2.0 | Plantillas de la interfaz sin compilar |
| Dexie | 4.4.6 | Apache-2.0 | Acceso a IndexedDB (esquemas versionados, transacciones) |
| esbuild (solo para compilar) | 0.28.2 | MIT | Genera `libs.js` |

- **Criterio de versión:** la última versión estable publicada hace al menos 14 días en la fecha de la compilación (1 de noviembre de 2026). Existen versiones más nuevas (por ejemplo Preact 11.x y Dexie 4.4.7), publicadas hacía menos de ese plazo o de una línea mayor distinta que no se ha adoptado.
- **SHA-256 de `libs.js`:** `a279561737e306f5f9263223b993bdc3c561baf2a64bf549b7f09b58bef34a5e`.
- **Comprobaciones hechas:** el paquete no contiene `eval` ni `new Function` ni importaciones a direcciones externas, de modo que cumple la política de seguridad de la página (`script-src 'self'`).
- **Reproducir la compilación:** en `desarrollo/`, `npm ci` y `npm run build-vendor`. No hace falta para usar la aplicación.
- **Actualizar una librería:** cambiar la versión exacta en `desarrollo/package.json`, volver a compilar, ejecutar las pruebas (`npm test`) y actualizar esta tabla y el SHA-256.
