# Contexto del proyecto (documento de traspaso)

**Para qué sirve este archivo:** que cualquier persona, o una sesión nueva de Claude, pueda retomar el proyecto sin haber seguido su historia. Hay que actualizarlo al final de cada fase. Última actualización: 6 de noviembre de 2026.

## 1. Qué es
Una aplicación personal de seguimiento del rendimiento físico de futbolistas. Se abre en el navegador desde un enlace (GitHub Pages), no necesita instalación, servidor ni cuenta, y **los datos se guardan solo en el navegador del usuario**. No hay conexión a servicios externos. Durante el desarrollo se usan únicamente datos sintéticos, siempre marcados como tales.

La aplicación no depende de Claude para funcionar. Claude se usa solo para construirla o modificarla.

## 2. Estado actual
- **Hecho:** fases 1a, 1b y 1c. Versión de la app: 1c-0.1.0 (jugadores, alias por fuente, posiciones con historial, antropometría fechada, datos sintéticos, copias de seguridad).
- **Pendiente de comprobar por el usuario:** la fase 1c en Chrome real (lista de comprobación en `README.md`).
- **Siguiente:** fase 2 (catálogo de tests), que no puede empezar hasta cerrar D4, D6 y D8 (y el 1RM estimado, ver `DECISIONES.md`, D5).
- **Todavía no existen:** tests, sesiones, importadores, gráficos. El orden de las fases y lo que necesita cada una está en `PLAN_DE_FASES.md`.

## 3. Dónde está cada cosa
| Archivo | Contenido |
|---|---|
| `guia_dashboard_performance_claude.md` | Especificación principal del proyecto |
| `DECISIONES.md` | Decisiones tomadas y pendientes (D1…D32) y su registro de cambios. **Manda sobre cualquier otro documento** |
| `PLAN_DE_FASES.md` | Orden de fases, requisitos previos y reglas de entrega |
| `REQUISITOS.md` | Requisitos RF-01 a RF-03 y criterios de aceptación |
| `CATALOGO_TESTS.md` | Borrador del catálogo de tests (fase 2), con lo decidido y lo pendiente |
| `DICCIONARIO_DE_DATOS.md` | Tablas actuales, formato de copia y formato de exportación de VALD observado |
| `LIBRERIAS.md` | Librerías usadas, versiones fijadas y comprobaciones |
| `README.md` / `LEEME.md` | Descripción de la entrega y lista de comprobación |

## 4. Reglas que se mantienen
- Archivos sueltos en la raíz del repositorio, sin carpetas; cada entrega se hace archivo a archivo e indica cuáles sustituir y cuáles añadir.
- Cada fase es una entrega pequeña y revisable; no se empieza si falta una decisión que cambie el modelo de datos.
- Nada se inventa: los datos que faltan se muestran como «No disponible», nunca como cero. Las referencias bibliográficas llevan fuente.
- Los valores de los informes PDF de ejemplo se usaron solo para el estilo, no como datos.
- Las decisiones se registran en `DECISIONES.md` antes de programar.

## 5. Decisiones clave ya tomadas (resumen; el detalle está en `DECISIONES.md`)
- Un punto por sesión en la evolución, igual al Average de esa sesión; Personal Average, Personal Best y Máxima repetición son valores distintos (D12).
- Asimetría = (derecha − izquierda) / mayor de los dos × 100 (D25).
- SW (System Weight) = 29 % del peso corporal, solo en Hip; Knee y Ankle usan el peso corporal; g = 9,80665 (D27).
- La referencia «La Liga» se calcula con los datos propios: un valor por jugador (D19, D28).
- Iso-Hold: el usuario introduce la carga máxima; las ratios se calculan frente al Personal Average del Iso-Push (D5).
- Gráficos: Chart.js más SVG propio (D20).

## 6. Pendiente (resumen)
- Antes de la fase 2: D4, D6, D8 y el 1RM estimado.
- Antes de la fase 4: D29 a D32 (importador de VALD).
- Antes de la fase 5c: D14, D16, D21, D24, D28 (dos puntos), tamaño mínimo de muestra y ventana antropométrica.
- Aplazadas: D15 (objetivos), D17 y D18 (fase 8).

## 7. Cómo retomar con Claude
Abre una sesión nueva, adjunta o pega este archivo junto con `DECISIONES.md` y `PLAN_DE_FASES.md`, y escribe qué quieres cambiar. Claude debe leer primero `DECISIONES.md` y avisar si lo pedido contradice una decisión ya tomada.

## 8. Copia de seguridad de los datos
Los datos viven solo en el navegador. Si se borran los datos del sitio y no hay copia, se pierden. Hay que exportar la copia de seguridad desde la aplicación con regularidad y guardarla fuera del navegador.

## 9. Lo que este documento no cubre
- No he verificado la aplicación en Chrome real (lo hace el usuario).
- Mantener o ampliar el código requiere conocimientos de programación o la ayuda de Claude.
