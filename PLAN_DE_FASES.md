# Plan de fases

**Actualizado el 6 de noviembre de 2026.** Incorpora los requisitos RF-01 a RF-03 (`REQUISITOS.md`), la especificación de gráficos (guía, apartado «Gráficos y visualizaciones») y el **orden de fases aprobado por el usuario el 4 de noviembre de 2026 y reconfirmado el 5 de noviembre**. Cada fase es una entrega pequeña y revisable. No se empieza una fase si falta una decisión que cambie el modelo de datos; las decisiones necesarias para cada fase figuran como requisitos previos.

## Reglas de entrega (estructura plana)

- Todos los archivos van **sueltos en la raíz** del repositorio, sin carpetas, porque la subida web de GitHub no conserva carpetas. Nunca habrá dos archivos con el mismo nombre.
- Cada entrega se hace **archivo a archivo, sin ZIP**, e indica qué archivos hay que **sustituir** y cuáles **añadir**. No hace falta mover nada dentro de GitHub.
- Los módulos nuevos tienen nombres propios y distintos entre sí (uno por tema) y se importan con rutas `./nombre.js`. Las pruebas van junto al código, con la extensión test.mjs.
- Antes de entregar se comprueban todas las rutas de importación, las pruebas con datos sintéticos y que los archivos que no deben cambiar no han cambiado.
- Cada entrega sube el número de versión visible. Los cambios de esquema de la base de datos son nuevas versiones del esquema, con prueba de que una copia antigua se sigue aceptando.
- Solo se usan datos sintéticos durante el desarrollo, siempre marcados como tales.

## Orden de fases aprobado

| Fase | Contenido | Requisitos previos | Estado |
|---|---|---|---|
| 1a | Prueba de viabilidad en Chrome real | D2, D3, D7 | Completada |
| 1b | Esqueleto, navegación con los tres bloques, base de datos y copias de seguridad completas | D1 | Superada por la 1c |
| 1c | Jugadores, alias por fuente, posiciones con historial y orden configurable, antropometría fechada, datos sintéticos marcados y eliminables; consulta de la posición principal en una fecha (D11). Versión 1c-0.1.0, esquema 2 | D9, D11 (decididas) | **Entregada para revisión; falta la comprobación del usuario en Chrome real.** No se ve afectada por D12 |
| 2a | Motor de catálogo configurable (bloques, zonas, tests, protocolos, variables, versiones de fórmula) | D4, D5, D6, D8 | Pendiente |
| 2b | Catálogo aportado, variables de CMJ y Reactive, Iso-Push, plantillas de Excel, diccionario de datos y generador del conjunto sintético de aceptación (`REQUISITOS.md`, sección 5) | D4, D5, D6, D8 | Pendiente |
| 3 | Importador de Excel propio (fuerza), resolución de jugadores en cada lote, deduplicación e informes | Fase 2 | Pendiente |
| 4 | Importador de VALD (perfil ForceDecks CMJ, All Average). El Personal Best y el Personal Average se calculan con los Average de sesión y `Reps`; la Máxima repetición no está disponible con este perfil | Fase 3; **D29, D30, D31 y D32** (filas del mismo día, peso corporal del fichero, etiquetas, perfil de RSAIP) | Pendiente |
| **5a** | **Perfil del jugador y evolución (RF-01):** bloques, gráfico longitudinal (un punto por sesión = Average de la sesión) con Personal Best y Personal Average señalados por separado, Máxima repetición en el detalle de la sesión, exclusión reversible y eliminación de sesión; G1 y G5; acción «Ver todos los jugadores en este test» | Fases 2 a 4; **D12 (cerrada)**; **D20 (cerrada: Chart.js 4.6.1 más SVG propio) y estilo cerrado**; **D22, D23 y D25 cerradas, D26 eliminada: sin decisiones pendientes**; al integrarla se comprueban rendimiento, Chrome real, tema claro y accesibilidad | Pendiente |
| **5b** | **Vista de test y navegación entre jugador y test (RF-02 y RF-03):** inicialmente el Average de la última sesión válida de cada jugador, con opciones de Personal Best e histórico completo; fecha de cada resultado; posición principal vigente en la fecha de cada sesión; forma básica de G4 | Fase 5a; **D9, D10, D11 y D13 (decididas)** | Pendiente |
| **5c** | **Percentiles y referencias:** los dos percentiles, colores, referencias «La Liga» y Premier League; G2, G3 y G4 completo | Fase 5b; **D14, D15, D16, D19, D21**; umbral mínimo de muestra; valor de la ventana antropométrica | Pendiente |
| 6 | Vista de test ampliada (filtros completos, valores absolutos y relativos, percentiles en la vista, exportación a CSV o Excel) y relaciones entre variables | Fase 5c; método estadístico de las relaciones | Pendiente |
| 7 | Revisión de seguridad, copias y recuperación | Todas las anteriores | Pendiente |
| 8 (condicionada) | G6 fuerza-velocidad, G7 curvas de señales y G8 cuadrantes, cada uno solo cuando existan sus datos y definiciones. **La agrupación en una fase 8 es una propuesta pendiente de confirmar** | D5, D17, D18 y los datos que lo permitan | Condicionada |

## Gráficos por fase y datos necesarios

El detalle de cada gráfico está en la guía. La especificación de **estilo** y la biblioteca (D20) se cerraron el 6 de noviembre de 2026 tras revisar los dos informes de ejemplo; sus valores y referencias no se copian como datos de la aplicación.

| Gráfico | Fase | Depende de |
|---|---|---|
| G1 Evolución longitudinal | 5a | Catálogo, sesiones, repeticiones; D12 (resuelta), D22 y D23 (cerradas) |
| G5 Asimetría | 5a | Iso-Push con ambos lados |
| G4 Comparación con referencias | 5b (básica) y 5c (completa) | Referencias, percentiles, D14, D15, D21 |
| G2 Comparativo del perfil | 5c | Percentiles, referencias, D19 |
| G3 Radial | 5c | Percentiles, D16 |
| G6 Fuerza-velocidad | 8 (propuesta) | D5, D17 |
| G7 Curvas de señales | 8 (propuesta) | Archivos con señales y decisión de modelo de datos |
| G8 Cuadrantes | 8 (propuesta) | D18 |

## Correspondencia entre requisitos y fases

| Requisito | Fase | Criterios | Cómo se comprueban |
|---|---|---|---|
| RF-01 Perfil y evolución | 5a | CA-01.1 a CA-01.15 | Pruebas automáticas con el conjunto sintético; revisión manual en Chrome real a 375, 768 y 1280 píxeles |
| RF-02 Vista de test por posición vigente | 5b | CA-02.1 a CA-02.14 (CA-02.14 corresponde a la fase 6) | Ídem |
| RF-03 Navegación en ambos sentidos | 5b | CA-03.1 a CA-03.7 | Ídem, con recorrido ida y vuelta, botón Atrás y recarga |

## Decisiones por fase

| Antes de la fase | Decisiones | Estado |
|---|---|---|
| 2 | D4, D5, D6 y D8 | **Cerradas (7/11/2026)**; solo queda fijar el peso del 1RM estimado |
| 5a | D12 (definiciones de Average de sesión, Personal Average, Personal Best y Máxima repetición) | **Cerrada** |
| 5a | D20 (biblioteca de gráficos) | **Cerrada** |
| 5a | D22, D23 y D25 cerradas; D26 eliminada | **Sin pendientes** |
| 5b | D9 (orden configurable), D10 (vista inicial y opciones), D11 (posición por fecha), D13 (modo inicial) | **Decididas** |
| 5c | D14, D16, D21, D24, D28 (D19 cerrada; D15 aplazada); umbral mínimo de muestra; ventana antropométrica | Pendientes |
| 6 | Método estadístico de las relaciones | Pendiente |
| 8 | D5, D17, D18 | Pendientes |

Los detalles están en `DECISIONES.md`.
