# Plan de fases

**Actualizado el 2 de noviembre de 2026.** Incorpora los requisitos RF-01 a RF-03 (`REQUISITOS.md`) y la especificación de gráficos (guía, apartado «Gráficos y visualizaciones»). Cada fase es una entrega pequeña y revisable. No se empieza una fase si falta una decisión que cambie el modelo de datos.

## Reglas de entrega (estructura plana)

- Todos los archivos van **sueltos en la raíz** del repositorio, sin carpetas, porque la subida web de GitHub no conserva carpetas. Nunca habrá dos archivos con el mismo nombre.
- Cada entrega se hace **archivo a archivo, sin ZIP**, e indica qué archivos hay que **sustituir** y cuáles **añadir**. No hace falta mover nada dentro de GitHub.
- Los módulos nuevos tienen nombres propios y distintos entre sí (uno por tema) y se importan con rutas `./nombre.js`. Las pruebas van junto al código, con la extensión test.mjs.
- Antes de entregar se comprueban todas las rutas de importación, las pruebas con datos sintéticos y que los archivos que no deben cambiar no han cambiado.
- Cada entrega sube el número de versión visible. Los cambios de esquema de la base de datos son nuevas versiones del esquema, con prueba de que una copia antigua se sigue aceptando.
- Solo se usan datos sintéticos durante el desarrollo, siempre marcados como tales.

## Orden actual y orden propuesto

**El orden propuesto NO está aprobado.** Mientras no lo apruebes, rige el orden actual.

| | Orden actual (guía) | Orden propuesto |
|---|---|---|
| Hasta la fase 4 | 1a, 1b, 1c, 2, 3, 4 | Igual, con la fase 2 dividida en 2a y 2b |
| Fase 5 | **5:** ficha del jugador, evolución, Average/Max, personal best, exclusión y eliminación, dos percentiles, colores, referencias externas y los gráficos G1 a G5 | **5a:** perfil del jugador y evolución (RF-01), G1 y G5<br>**5b:** vista de test por posición y navegación en ambos sentidos (RF-02 y RF-03)<br>**5c:** percentiles, colores, referencias, G2, G3 y G4 completo |
| Fase 6 | **6:** comparación de plantilla (tabla, filtros, exportación) y relaciones entre variables | **6:** ampliaciones de la vista de test (filtros completos, exportación, percentiles en la vista) y relaciones entre variables |
| Fase 7 | Revisión de seguridad, copias y recuperación | Igual |
| Gráficos G6, G7 y G8 | Sin fase asignada | **8** (condicionada a que existan sus datos y definiciones) |

**Motivo del cambio**

1. **RF-03 exige las dos pantallas.** La navegación entre el perfil del jugador y la vista del test solo puede comprobarse cuando ambas existen. En el orden actual la vista comparativa llega en la fase 6, tras la 5, y el recorrido en ambos sentidos no se podría aceptar al terminar la 5.
2. **La fase 5 actual es demasiado grande** para entregas pequeñas y revisables: reúne perfil, evolución, selectores, personal best, exclusiones, eliminación, dos percentiles, colores, referencias externas y cinco gráficos.
3. **Los gráficos dependen de datos distintos.** G1 y G5 solo necesitan sesiones y repeticiones; G2, G3 y G4 necesitan percentiles y referencias («La Liga», Premier League). Separarlos evita que el gráfico de evolución espere a las referencias.

Coste y reversibilidad: no afecta a las fases 1c a 4. Se puede revertir sin pérdida antes de empezar la fase 5.

## Fases

| Fase | Contenido | Decisiones previas | Estado |
|---|---|---|---|
| 1a | Prueba de viabilidad en Chrome real | D2, D3, D7 | Completada |
| 1b | Esqueleto, navegación con los tres bloques, base de datos y copias de seguridad completas (versión 1b-0.1.1) | D1 | Entregada; superada por la 1c (pendiente la comprobación del usuario en Chrome real) |
| **1c** | **Jugadores, alias por fuente, posiciones con historial y orden configurable, antropometría fechada, datos sintéticos marcados y fáciles de eliminar.** Consulta «posición principal de un jugador en una fecha» (D11), con pruebas. Esquema 2 con migración desde el 1 (versión 1c-0.1.0) | D9 y D11 (decididas) | **Entregada para revisión; falta la comprobación del usuario en Chrome real** |
| 2a | Motor de catálogo configurable | D4 a D8 | Pendiente |
| 2b | Catálogo aportado, variables de CMJ y Reactive, Iso-Push, plantillas de Excel, diccionario de datos y generador del conjunto sintético de aceptación | D4 a D8 y **D12b** | Pendiente |
| 3 | Importador de Excel propio (fuerza), resolución de jugadores en cada lote, deduplicación e informes | Fase 2 | Pendiente |
| 4 | Importador de VALD (perfil ForceDecks CMJ, All Average) | Fase 3 | Pendiente |
| 5 (o 5a) | Perfil, evolución, selectores, personal best, exclusión y eliminación; en el orden actual incluye también percentiles, colores, referencias y G1 a G5 | **D12b**, D20 | Pendiente |
| 5b (solo orden propuesto) | Vista de test por posición y navegación bidireccional | D10 (propuesta), **D12b** | Pendiente |
| 5c (solo orden propuesto) | Percentiles, colores, referencias, G2, G3 y G4 | D14, D15, D16, D19, D21, umbral mínimo de muestra | Pendiente |
| 6 | Comparación de plantilla ampliada y relaciones entre variables | Método estadístico de las relaciones | Pendiente |
| 7 | Revisión de seguridad, copias y recuperación | Todas las anteriores | Pendiente |
| 8 (solo orden propuesto) | G6 fuerza-velocidad, G7 curvas de señales, G8 cuadrantes | D5, D17, D18 y datos que lo permitan | Condicionada |

## Gráficos por fase y datos necesarios

El detalle de cada gráfico está en la guía. Resumen de qué fase lo incluye y de qué depende:

| Gráfico | Orden actual | Orden propuesto | Depende de |
|---|---|---|---|
| G1 Evolución longitudinal | 5 | 5a | Catálogo, sesiones, repeticiones; D12b |
| G5 Asimetría | 5 | 5a | Iso-Push con ambos lados |
| G4 Comparación con referencias | 5 (forma básica en 6) | 5b (básica) y 5c (completa) | Referencias, percentiles, D14, D15, D21 |
| G2 Comparativo del perfil | 5 | 5c | Percentiles, referencias, D19 |
| G3 Radial | 5 | 5c | Percentiles, D16 |
| G6 Fuerza-velocidad | Sin fase | 8 | D5, D17 |
| G7 Curvas de señales | Sin fase | 8 | Archivos con señales y decisión de modelo de datos |
| G8 Cuadrantes | Sin fase | 8 | D18 |

## Correspondencia entre requisitos y fases

| Requisito | Fase (orden propuesto) | Criterios | Cómo se comprueban |
|---|---|---|---|
| RF-01 Perfil y evolución con Average/Max | 5a | CA-01.1 a CA-01.12 (los marcados, sujetos a D12b) | Pruebas automáticas con el conjunto sintético; revisión manual en Chrome real a 375, 768 y 1280 píxeles |
| RF-02 Vista de test por posición vigente | 5b | CA-02.1 a CA-02.11 (los marcados, sujetos a D12b) | Ídem; el contenido por defecto, tras aprobar D10 |
| RF-03 Navegación en ambos sentidos | 5b | CA-03.1 a CA-03.7 | Ídem, con recorrido ida y vuelta, botón Atrás y recarga |

## Decisiones pendientes que condicionan fases

| Antes de la fase | Decisiones |
|---|---|
| 2 | D4 (manifestación por variable), D5 (resultado de sesión en perfiles de carga), D6 (lado), D8 (forma de guardar las repeticiones); y **D12b** antes de la 2b |
| 5 (o 5a) | **D12b** (definición de Max), D20 (biblioteca de gráficos) |
| 5b | D10 (propuesta del usuario, pendiente de aprobar) |
| 5c | D14, D15, D16, D19, D21; umbral mínimo de muestra; definición de posiciones; ventana antropométrica |
| 6 | Método estadístico de las relaciones |
| 8 | D5, D17, D18 |

Los detalles están en `DECISIONES.md`.
