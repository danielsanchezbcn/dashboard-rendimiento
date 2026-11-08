# Requisitos funcionales: recorridos jugador ⇄ test

**Estado:** registrados el 2 de noviembre de 2026 y actualizados el 5 de noviembre de 2026 con las decisiones D9, D10, D11, D12 y D13. **Obligatorios** (criterio de entrega). No implementados todavía: se implementan en las fases 5a (RF-01) y 5b (RF-02 y RF-03).

Parten de la especificación de referencia (guía del proyecto) y de las peticiones del usuario. Los datos de ejemplo de este documento son sintéticos.

## 1. Definiciones

Solo cuentan las repeticiones y sesiones válidas; se excluyen las marcadas como inválidas, eliminadas o excluidas (la exclusión es reversible). Un único resultado importado cuenta como una repetición. Se conservan siempre las repeticiones originales. «Max» no es el nombre de ningún indicador.

| Término | Definición |
|---|---|
| Sesión | Valoración de un jugador en un test y protocolo en una fecha (y hora, si existe). Contiene sus repeticiones. |
| **Average de sesión** | Media de las repeticiones válidas de esa sesión, por variable (y por lado en tests unilaterales). Es el valor de cada punto del gráfico longitudinal. |
| **Personal Average** | Media de todas las repeticiones válidas del mismo jugador, test, protocolo y variable durante el periodo seleccionado (todo el historial si no se selecciona). Si el origen contiene resúmenes de sesión, cada Average de sesión se pondera por `Reps`. No es la media de las medias de sesión. |
| **Personal Best** | El resultado de la sesión cuyo Average sea el mejor según la dirección de interpretación de la variable: con más alto es mejor, el Average de sesión más alto; con más bajo es mejor, el más bajo. Muestra el valor y la fecha de esa sesión. Con rango objetivo no se define hasta que el criterio esté configurado (D23). **No es la repetición individual más alta.** |
| **Máxima repetición** | La repetición individual más alta de una sesión. Dato aparte, mostrable en el detalle de la sesión; nunca llamado «Max» ni confundido con el Personal Best. |
| **Resultado actual** | Average de la sesión válida más reciente dentro de los filtros activos. |
| Sesión solo resumen | Sesión importada sin repeticiones individuales (por ejemplo, el perfil de VALD «All Average»). Su Average de sesión es el valor importado. Permite calcular el Personal Best (comparando Average de sesión) y el Personal Average (ponderando por `Reps`), pero **no** la Máxima repetición, que figura «no disponible» y nunca se deriva del Average. |
| Posición vigente en la fecha de una sesión | La posición **principal** que tenía el jugador en la fecha de esa sesión, según su historial de posiciones con fechas de vigencia. **No** es la posición actual (D11). |

## 2. RF-01: recorrido desde el jugador

El usuario abre el perfil completo de un jugador, ve sus resultados organizados por bloques y, al entrar en un test, ve su evolución por sesiones.

- **RF-01.0 (D33, 7/11/2026)** En la tabla de un jugador con todos sus tests, el valor mostrado de cada test es su **Personal Average**; el filtro superior permite pasar a Personal Best. Pulsar un resultado abre el gráfico longitudinal de ese test (RF-01.3 y RF-01.4), con el resto de datos.
- **RF-01.1** El perfil muestra los datos básicos, la antropometría con historial y los tres bloques: Manifestaciones de la fuerza, Perímetros y NME. Solo aparecen los tests y medidas que estén configurados y tengan datos; un bloque sin contenido muestra un estado vacío que lo explica.
- **RF-01.2** En el bloque de fuerza los resultados se organizan por manifestación y zona anatómica (cuando aplique) hasta el test. Max Isometric Strength y Heavy Dynamic Strength abren una vista conjunta de Groin, Hip, Knee y Ankle (guía).
- **RF-01.3** Al entrar en un test (con su protocolo y variable seleccionables), se muestra la evolución **por sesiones** en orden cronológico, en tabla y gráfico, con la fecha y el número de repeticiones de cada sesión.
- **RF-01.4** En el gráfico hay **un punto por sesión, con el Average de esa sesión, en su fecha**. No se sustituye la serie histórica por un único valor global ni por una serie de máximos individuales, y no hay un selector que cambie la serie. El **Personal Best** y el **Personal Average** se señalan por separado. El resultado actual (último punto) se distingue del Personal Best aunque coincidan.
- **RF-01.5** Se muestra el **Personal Average** con su periodo, número de sesiones y número total de repeticiones. La **Máxima repetición** de cada sesión con repeticiones individuales figura en el detalle de la sesión.
- **RF-01.6** Las sesiones o repeticiones excluidas siguen visibles y marcadas, y no cuentan en ningún valor. El valor original se muestra siempre; el relativo, cuando exista una fórmula definida.
- **RF-01.7** Cada test ofrece una acción visible para abrir la vista comparativa de todos los jugadores (RF-03).

Criterios de aceptación (con el conjunto sintético de la sección 5):

| Id | Criterio |
|---|---|
| CA-01.1 | El perfil de un jugador muestra los tres bloques; en uno sin tests configurados aparece el estado vacío, sin tests inventados. |
| CA-01.2 | Al entrar en un test aparece una fila por sesión, en orden cronológico, con fecha, nº de repeticiones y Average de sesión, y un gráfico con la misma serie. |
| CA-01.3 | Jugador A, variable X: los puntos del gráfico son 12 (10/02) y 13 (10/03). Jugador B: 21 (10/02) y 20 (10/03). Hay un punto por sesión; ningún control sustituye la serie por máximos individuales y ningún indicador se rotula «Max». |
| CA-01.4 | Exclusión reversible de la repetición 100 del jugador A (10/03): con ella excluida, Average de sesión 13, Personal Best (X) 13, Personal Average 12,4 y Máxima repetición 14; al revertir la exclusión, 42, 42, 27 y 100; al excluirla de nuevo, vuelven 13, 13, 12,4 y 14. |
| CA-01.5 | Una sesión con una sola repetición (jugador C) muestra Average 8, Personal Best 8 y Máxima repetición 8. |
| CA-01.6 | Sesión solo resumen (jugador B, 10/02): Average de sesión 21; Máxima repetición «no disponible» con indicación visible de que es un resumen, sin rellenarla a partir del Average. El Personal Best (X) de B es 21 (10/02), calculado comparando sus Average de sesión (21 frente a 20), y su Personal Average es 20,5, ponderando el resumen por `Reps` = 4. |
| CA-01.7 | Jugador A, variable X: el Personal Best (13, 10/03) y el Personal Average (12,4; 5 repeticiones, 2 sesiones) se señalan por separado, cada uno con su etiqueta. Variable Y (más bajo es mejor): el Personal Best es 12, en la sesión del 10/02. |
| CA-01.8 | Variable Z (rango objetivo sin criterio de Personal Best), jugador A: el Personal Best figura «no definido hasta configurar el criterio»; se muestran el Personal Average (12,4) y la distancia al rango objetivo. |
| CA-01.9 | El Personal Best es siempre el Average de una sesión, nunca una repetición. La Máxima repetición (A: 14 el 10/02 y 14 el 10/03; B: «no disponible» el 10/02 y 22 el 10/03) aparece solo en el detalle de la sesión, con su nombre y separada del Personal Best; ninguna pantalla usa «Max» como nombre de indicador. |
| CA-01.10 | Personal Average con todo el historial: jugador A 12,4 (5 repeticiones, 2 sesiones); jugador B 20,5 (8 repeticiones, ponderando el resumen de 10/02 por `Reps` = 4). Con el periodo limitado a 10/03: A 13 (2 repeticiones) y B 20 (4 repeticiones). |
| CA-01.11 | El resultado actual se distingue visualmente del Personal Best aunque coincidan en valor y fecha (jugador A, variable X: etiquetas distintas). |
| CA-01.12 | Una sesión excluida aparece marcada, con su motivo, y no contribuye a Average, Personal Best ni Personal Average. |
| CA-01.13 | En un test unilateral (jugador F, «Test sintético 2») el lado izquierdo ocupa siempre la parte izquierda y el derecho la derecha. Average de sesión: izquierdo 31, derecho 31. Máxima repetición, en el detalle de la sesión: izquierdo 32, derecho 34. Personal Best: izquierdo 31, derecho 31. El orden no cambia con el valor ni con la anchura de pantalla. |
| CA-01.14 | Antes y después de navegar, cambiar variables y excluir o revertir, los datos originales guardados no han cambiado (suma de verificación de las tablas). |
| CA-01.15 | La pantalla es utilizable a 375, 768 y 1280 píxeles de ancho, con foco visible y navegación por teclado. |

Cuando dos sesiones empatan en el mejor Average se muestra la más reciente (D22, cerrada el 6 de noviembre de 2026). Aún no hay criterio de aceptación numérico para los empates y el conjunto sintético no incluye empates: se añadirán en la fase 5a.

## 3. RF-02: recorrido desde el test

El usuario abre un test y ve una vista comparativa de todos los jugadores que lo tienen, agrupados por posición, con la fecha de cada resultado.

- **RF-02.1** La vista se abre para un test (con su protocolo y variable seleccionables) y lista todos los jugadores con al menos una sesión válida de ese test. Los jugadores sin datos de ese test no aparecen.
- **RF-02.2 (REVISADO 2026-11-07: la posición no lleva fechas; cada jugador está en UNA posición para todo el histórico y los criterios CA-02.2 a CA-02.8 que mezclan posiciones por fecha dejan de aplicar; el jugador sin posición va a «Sin posición»)** Los resultados se **agrupan por posición**. La posición de cada resultado es la **posición principal vigente en la fecha de esa sesión** (D11), nunca la actual. Si el jugador no tiene posición vigente en esa fecha, el resultado aparece en un grupo «Sin posición en esa fecha» y no se reasigna en silencio a la actual. Las posiciones secundarias no incluyen al jugador en varios grupos; podrán usarse como filtro o grupo de comparación solo si se define expresamente. El orden de los grupos es el que el usuario configure (D9).
- **RF-02.0 (D33, 7/11/2026)** En la tabla de un test (todos los jugadores) el valor por defecto de cada jugador es su **Personal Average**. Un **filtro superior** permite pasar la tabla a **Personal Best**. Pulsar un resultado o el nombre del jugador abre el gráfico longitudinal (G1) de ese test con toda su evolución individual. **Pendiente de redactar:** grupo de posición de un Personal Average que abarca sesiones de varias posiciones (D33a) y destino del histórico completo y de la última sesión (D33b). Hasta cerrarlo, RF-02.2, RF-02.3, CA-02.2 y CA-02.11 describen la versión anterior y deben reescribirse.
- **RF-02.3** La vista tiene un selector con tres opciones (D10 y D13): **Average de la última sesión válida de cada jugador**, **Personal Best** (para cada jugador, el Average de sesión de mejor rendimiento según la dirección de la variable, con su fecha) e **histórico completo** (el Average de cada sesión válida). Con rango objetivo sin criterio configurado, el Personal Best figura «no definido».
- **RF-02.4** Cada resultado muestra su **fecha** y el número de repeticiones que lo sustentan. En las vistas históricas (Personal Best e histórico completo) cada resultado se agrupa según la posición principal vigente en la fecha de esa sesión.
- **RF-02.5** Cada jugador es un enlace que abre su perfil en ese test (RF-03).
- **RF-02.6** Se aplican las reglas de la guía para esta vista: valores originales y relativos, sesiones excluidas omitidas, ordenación por valor, jugador o fecha, filtros por posición, fecha, protocolo y registro válido, y exportación a CSV o Excel (estas ampliaciones llegan en la fase 6).

Criterios de aceptación (variable X de «Test sintético 1»):

| Id | Criterio |
|---|---|
| CA-02.1 | Aparecen los jugadores A, B, C y D, y no el jugador E, que solo tiene sesiones de otro test. |
| CA-02.2 | La opción inicial muestra el Average de la última sesión válida de cada jugador, con su fecha: «Posición 1»: B 20 (10/03/2026). «Posición 2»: A 13 (10/03/2026) y C 8 (12/03/2026). «Sin posición en esa fecha»: D 9 (12/03/2026). |
| CA-02.3 | Con Personal Best (variable X): «Posición 1»: B 21 (10/02/2026). «Posición 2»: A 13 (10/03/2026) y C 8 (12/03/2026). «Sin posición en esa fecha»: D 9 (12/03/2026). |
| CA-02.4 | Con el histórico completo: «Posición 1»: A 12 (10/02), B 21 (10/02) y B 20 (10/03). «Posición 2»: A 13 (10/03) y C 8 (12/03). «Sin posición en esa fecha»: D 9 (12/03). El jugador A figura en «Posición 1» con su sesión del 10/02 y en «Posición 2» con la del 10/03. |
| CA-02.5 | Con Personal Best en la variable Y (más bajo es mejor): A 12 (10/02/2026, «Posición 1»), B 20 (10/03/2026, «Posición 1»), C 8 (12/03/2026, «Posición 2») y D 9 (12/03/2026, «Sin posición en esa fecha»): se respeta la dirección y la posición de la fecha de la sesión elegida. |
| CA-02.6 | Con Personal Best en la variable Z (rango objetivo sin criterio): todos los jugadores figuran «no definido» y se indica el motivo; no se muestra ningún valor como Personal Best. |
| CA-02.7 | El resultado del jugador D (12/03) está en «Sin posición en esa fecha», aunque hoy tenga posición asignada. |
| CA-02.8 | Cambiar hoy la posición actual de cualquier jugador no mueve ningún resultado histórico de grupo. |
| CA-02.9 | Cada fila muestra su fecha y su nº de repeticiones (A 10/03: 2 válidas; B 10/02: 4, según `Reps` del resumen). |
| CA-02.10 | Los resultados de sesiones excluidas no aparecen por defecto. Excluir toda la sesión de A del 10/03: en la opción inicial A pasa a 12 (10/02, «Posición 1»); excluir la sesión de B del 10/02: su Personal Best (X) pasa a 20 (10/03). |
| CA-02.11 | La opción inicial del selector es el Average de la última sesión válida; cambiarla a Personal Best o a histórico completo no modifica ningún dato guardado. |
| CA-02.12 | Cambiar el orden de las posiciones en Configuración cambia el orden de los grupos; no existe un orden por defecto asumido. |
| CA-02.13 | En el test unilateral, izquierdo a la izquierda y derecho a la derecha, con etiqueta explícita en cada columna. |
| CA-02.14 | Se puede ordenar por valor, jugador y fecha, y exportar a CSV con los mismos valores y el mismo orden de lados que se ven (fase 6). |

## 4. RF-03: navegación en ambos sentidos

El perfil del jugador y la vista del test deben poder recorrerse en los dos sentidos sin perder el contexto.

- **RF-03.1** Desde la evolución de un jugador en un test hay una acción visible («Ver todos los jugadores en este test») que abre la vista comparativa con el mismo test, protocolo y variable, en su opción inicial.
- **RF-03.2** Desde la vista comparativa, elegir un jugador abre su perfil directamente en la evolución de ese mismo test, con la misma variable.
- **RF-03.3** Al ir y volver se conservan el test, el protocolo, la variable, el rango de fechas y la opción elegida en la vista comparativa; en ella el jugador de origen queda señalado.
- **RF-03.4** El botón Atrás del navegador y unas migas de pan funcionan en ambos sentidos, y recargar la página mantiene la vista (rutas por hash, compatibles con el alojamiento estático).

| Id | Criterio |
|---|---|
| CA-03.1 | Desde A en «Test sintético 1», variable X, la acción abre la vista comparativa del mismo test y variable en su opción inicial. |
| CA-03.2 | Desde esa vista, elegir al jugador B abre el perfil de B en la evolución de «Test sintético 1», con la misma variable. |
| CA-03.3 | Recorrido ida y vuelta (jugador → test → mismo jugador): se conservan test, protocolo, variable y fechas; si en la vista comparativa se eligió Personal Best, sigue elegido al volver, y el jugador queda señalado. |
| CA-03.4 | Con el botón Atrás del navegador se vuelve a la pantalla anterior en cada paso, y al recargar se recupera la misma vista. |
| CA-03.5 | Desde la vista conjunta de Max Isometric Strength o Heavy Dynamic Strength del perfil, abrir un test lleva a su evolución y desde ahí a la vista comparativa. |
| CA-03.6 | Todo el recorrido es operable con teclado, con nombres accesibles y foco visible. |
| CA-03.7 | Ninguna navegación modifica datos guardados (CA-01.14). |

## 5. Conjunto sintético de aceptación

Datos ficticios, solo para comprobar los criterios; se identifican como sintéticos y no se mezclan con datos reales. Las posiciones son marcadores: **no** representan ni fijan ninguna posición ni orden reales. Las unidades no están definidas.

Posiciones (historial con fechas de vigencia): A, «Posición 1» hasta el 28/02/2026 y «Posición 2» desde el 01/03/2026; B, «Posición 1» desde el 01/01/2026; C, «Posición 2» desde el 01/01/2026; D, sin registro hasta el 31/03/2026 y «Posición 1» desde el 01/04/2026; F, «Posición 1».

«Test sintético 1» (bilateral). Tiene tres variables con **los mismos valores** y distinta dirección de interpretación: **X** (más alto es mejor), **Y** (más bajo es mejor) y **Z** (rango objetivo, sin criterio de Personal Best configurado).

| Jugador | Fecha | Repeticiones válidas | Average de sesión | Máxima repetición | Posición vigente |
|---|---|---|---|---|---|
| A | 10/02/2026 | 10, 12, 14 | 12 | 14 | Posición 1 |
| A | 10/03/2026 | 12, 14 (y una de 100 excluida) | 13 | 14 | Posición 2 |
| B | 10/02/2026 | resumen All Average = 21 (`Reps` = 4) | 21 | no disponible | Posición 1 |
| B | 10/03/2026 | 18, 20, 22, 20 | 20 | 22 | Posición 1 |
| C | 12/03/2026 | 8 (una repetición) | 8 | 8 | Posición 2 |
| D | 12/03/2026 | 9, 9, 9 | 9 | 9 | sin posición en esa fecha |

Valores derivados con todo el historial (X: más alto es mejor; Y: más bajo es mejor):

| Jugador | Personal Average | Personal Best (X) | Personal Best (Y) | Resultado actual |
|---|---|---|---|---|
| A | 12,4 (5 repeticiones) | 13 (10/03) | 12 (10/02) | 13 (10/03) |
| B | 20,5 (8 repeticiones) | 21 (10/02) | 20 (10/03) | 20 (10/03) |
| C | 8 | 8 (12/03) | 8 (12/03) | 8 |
| D | 9 | 9 (12/03) | 9 (12/03) | 9 |

Para la variable Z (rango objetivo sin criterio) el Personal Best no está definido; el Personal Average es el mismo que el de X. Si se revierte la exclusión de la repetición de 100 del jugador A (10/03): Average de sesión 42, Personal Best (X) 42, Personal Average 27 y Máxima repetición 100.

«Test sintético 2» (unilateral): jugador F, 12/03/2026; izquierdo 30 y 32, derecho 28 y 34. Average de sesión: izquierdo 31 y derecho 31. Máxima repetición: izquierdo 32 y derecho 34. Personal Best: izquierdo 31 y derecho 31 (una sola sesión).

Jugador E: sesiones solo de otro test.

## 6. Estado de las decisiones

| Id | Decisión | Estado |
|---|---|---|
| D9 | Orden de las posiciones | **Decidida:** configurable por el usuario; no se fija ningún orden definitivo. |
| D10 | Contenido por defecto de la vista comparativa | **Aprobada:** inicialmente el Average de la última sesión válida de cada jugador, con opciones de Personal Best e histórico completo; fecha visible y posición principal vigente en la fecha de cada sesión. |
| D11 | Posición para agrupar | **Decidida:** posición principal en la fecha de cada sesión; las secundarias no agrupan. |
| D12 | Average de sesión, Personal Average, Personal Best y Máxima repetición | **Cerrada (5 de noviembre).** Ver sección 1 y `DECISIONES.md`. |
| D13 | Modo inicial del selector | **Decidida:** Average (en la vista comparativa, el de la última sesión válida). |
| D22 | Empates en el Personal Best | Cerrada (6/11/2026): se muestra la sesión más reciente. |
| D23 | Criterio de Personal Best con rango objetivo | Cerrada (6/11/2026): no se define; se mantienen CA-01.8 y CA-02.6. |

Consecuencia que conviene tener presente: con el histórico completo, un mismo jugador puede aparecer en grupos distintos según la fecha de cada sesión, porque se usa la posición vigente en esa fecha.

Las decisiones sobre gráficos, referencias y colores (D14 a D21) están en `DECISIONES.md`.

## 7. Dependencias

- **Historial de posiciones con fechas de vigencia** y la consulta «posición de un jugador en una fecha»: implementados en la fase 1c.
- **Catálogo, sesiones y repeticiones** (decisiones D4 a D8 y fases 2 a 4): necesarios para ver resultados reales.
- **RF-01:** fase 5a. **RF-02 y RF-03:** fase 5b. Ver `PLAN_DE_FASES.md`.
- Las reglas de exclusión, eliminación de sesiones, lateralidad y valores originales y relativos son las de la guía y no se repiten aquí.

## 8. Relación con el diseño anterior

El documento de diseño de la fase 0 (versión 0.1) describe la ficha y la vista de test en su mapa de pantallas. Estos requisitos concretan y completan ese diseño; ante cualquier diferencia, prevalece este documento.

## 9. Fuera del alcance de estos requisitos

Los gráficos (G1 a G8), los percentiles y colores, las referencias («La Liga» y Premier League), las relaciones entre variables y las pantallas de perímetros y NME más allá del estado vacío: se especifican en la guía actualizada (apartado «Gráficos y visualizaciones») y se tratan en sus propias fases. El estilo de los gráficos y la biblioteca (D20) se cerraron el 6 de noviembre de 2026 tras revisar los dos informes de ejemplo del usuario; las decisiones de gráficos aún pendientes figuran en `DECISIONES.md`.
