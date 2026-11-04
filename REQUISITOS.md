# Requisitos funcionales: recorridos jugador ⇄ test

**Estado:** registrados el 2 de noviembre de 2026. **Obligatorios** (criterio de entrega). No implementados todavía.

**Actualización del mismo día:** se han aceptado D9, D11, D12a y D13 y se ha propuesto D10 (ver la sección 6). **La definición de Max está en conflicto sin resolver (D12b)**: todo lo que depende de Max en este documento se mantiene con la definición vigente y queda marcado «sujeto a D12b».

Parten de la especificación de referencia (guía del proyecto) y de la petición del usuario. Donde la guía ya define una regla, se cita; lo que la guía no define queda señalado como **decisión pendiente** (sección 6) y no se asume.

## 1. Definiciones

| Término | Definición |
|---|---|
| Sesión | Valoración de un jugador en un test y protocolo en una fecha (y hora, si existe). Contiene sus repeticiones. |
| Repetición válida | Repetición que no está excluida (la exclusión es reversible) y que pertenece a una sesión no excluida. |
| **Average** (de una sesión) | Media aritmética de las repeticiones válidas de ese test en esa sesión, por variable (y por lado en tests unilaterales). Es el resultado estándar de sesión de la guía (D12a). |
| **Personal average** (el «Average» global de D12a) | Media de todos los resultados válidos de las repeticiones de las sesiones incluidas (periodo seleccionado; todo el historial si no se selecciona). Ponderada por repeticiones. Un único resultado importado cuenta como una repetición. |
| **Max** (definición vigente, **sujeta a D12b**) | Mayor valor numérico entre las repeticiones válidas de ese test en esa sesión, por variable (y por lado). Es una repetición individual, no una media. La propuesta del 2 de noviembre de 2026 lo redefine como la media de la mejor sesión y está **sin resolver** (`DECISIONES.md`, «Conflicto D12b»). |
| Sesión solo resumen | Sesión importada sin repeticiones individuales (por ejemplo, el perfil de VALD «All Average»). Su Average es el valor importado; su Max **no está disponible** y nunca se deriva del Average. |
| Posición vigente en la fecha del test | La posición asignada a la sesión en su fecha, a partir del historial de posiciones del jugador con fechas de vigencia. **No** es la posición actual del jugador. |

Solo se excluyen las repeticiones o sesiones marcadas como inválidas, eliminadas o excluidas (D12a). Para variables donde un valor bajo es mejor, la definición de Max y su relación con el personal best forman parte del conflicto D12b.

## 2. RF-01: recorrido desde el jugador

El usuario abre el perfil completo de un jugador, ve sus resultados organizados por bloques y, al entrar en un test, ve su evolución por sesiones y elige Average o Max.

Requisitos:

- **RF-01.1** El perfil muestra los datos básicos, la antropometría con historial y los tres bloques: Manifestaciones de la fuerza, Perímetros y NME. Solo aparecen los tests y medidas que estén configurados y tengan datos; un bloque sin contenido muestra un estado vacío que lo explica.
- **RF-01.2** En el bloque de fuerza los resultados se organizan por manifestación y zona anatómica (cuando aplique) hasta el test. Max Isometric Strength y Heavy Dynamic Strength abren una vista conjunta de Groin, Hip, Knee y Ankle (guía).
- **RF-01.3** Al entrar en un test (con su protocolo y variable seleccionables), se muestra la evolución **por sesiones** en orden cronológico, en tabla y gráfico, con la fecha y el número de repeticiones de cada sesión.
- **RF-01.4** Un selector **Average / Max** cambia la serie y el gráfico. No cambia los datos originales. El selector empieza en Average (D13). La definición de Max está **sujeta a D12b**.
- **RF-01.5** Las sesiones o repeticiones excluidas siguen visibles y marcadas, y no cuentan en ningún valor. El valor original se muestra siempre; el relativo, cuando exista una fórmula definida.
- **RF-01.6** Cada test ofrece una acción visible para abrir la vista comparativa de todos los jugadores (RF-03).

Criterios de aceptación (se comprueban con el conjunto sintético de la sección 5):

| Id | Criterio |
|---|---|
| CA-01.1 | El perfil de un jugador muestra los tres bloques; en uno sin tests configurados aparece el estado vacío, sin tests inventados. |
| CA-01.2 | Al entrar en un test aparece una fila por sesión, en orden cronológico, con fecha, nº de repeticiones y valor, y un gráfico con la misma serie. |
| CA-01.3 (sujeto a D12b) | Con el jugador A y «Test sintético 1»: en Average la serie es 12 y 12; en Max es 14 y 13. Cambiar el selector no modifica ningún dato guardado. |
| CA-01.4 (sujeto a D12b) | La repetición excluida (99) no cuenta: Average 12 y Max 13 en la sesión del 10/03. Al revertir la exclusión, Average 41 y Max 99; al volver a excluirla, 12 y 13. |
| CA-01.5 (sujeto a D12b) | Una sesión con una sola repetición (jugador C) muestra Average = Max = 8. |
| CA-01.6 (sujeto a D12b) | Una sesión solo resumen (jugador B, 10/02) muestra Average 21 y, en Max, «no disponible» con una indicación visible de que es un resumen; el valor no se rellena a partir del Average. |
| CA-01.7 | Una sesión excluida aparece marcada, con su motivo, y no contribuye a Average, Max ni al Personal Best. |
| CA-01.8 | En un test unilateral (jugador F, «Test sintético 2») el lado izquierdo ocupa siempre la parte izquierda y el derecho la derecha. Average: izquierdo 31, derecho 31. Max: izquierdo 32, derecho 34. El orden no cambia con el selector, el valor ni la anchura de pantalla. |
| CA-01.9 | El selector Average/Max conserva su valor al cambiar de variable, protocolo o rango de fechas dentro del mismo test. |
| CA-01.10 | El Personal Best sigue calculándose entre medias de sesión y no cambia al elegir Max (guía). |
| CA-01.11 | Antes y después de navegar y cambiar de modo, los datos originales guardados no han cambiado (comprobación por suma de verificación de las tablas). |
| CA-01.12 | La pantalla es utilizable a 375, 768 y 1280 píxeles de ancho, con foco visible y navegación por teclado. |

## 3. RF-02: recorrido desde el test

El usuario abre un test y ve una vista comparativa de todos los jugadores que lo tienen, agrupados por posición, con selector Average / Max y la fecha de cada resultado.

Requisitos:

- **RF-02.1** La vista se abre para un test (con su protocolo y variable seleccionables) y lista todos los jugadores con al menos una sesión válida de ese test. Los jugadores sin datos de ese test no aparecen.
- **RF-02.2** Los resultados se **agrupan por posición**. La posición de cada resultado es la **posición principal registrada para el jugador en la fecha de esa sesión** (D11), nunca la posición actual. Las posiciones secundarias no incluyen automáticamente al jugador en varios grupos; podrán usarse como filtro o grupo de comparación solo si se define expresamente. Si el jugador no tiene posición vigente en esa fecha, el resultado aparece en un grupo «Sin posición en esa fecha» y no se reasigna en silencio a la posición actual.
- **RF-02.3** Un selector **Average / Max** cambia el valor mostrado en toda la vista. Empieza en Average (D13). La definición de Max está **sujeta a D12b**.
- **RF-02.4** Cada resultado muestra su **fecha** y el número de repeticiones que lo sustentan.
- **RF-02.5** Cada jugador es un enlace que abre su perfil en ese test (RF-03).
- **RF-02.6** Se aplican las reglas de la guía para esta vista: valores originales y relativos, sesiones excluidas omitidas, ordenación por valor, jugador o fecha, filtros por posición, fecha, protocolo y registro válido, y exportación a CSV o Excel.

Criterios de aceptación:

| Id | Criterio |
|---|---|
| CA-02.1 | En «Test sintético 1» aparecen los jugadores A, B, C y D, y no el jugador E, que solo tiene sesiones de otro test. |
| CA-02.2 | Cada resultado está en el grupo de la posición vigente en su fecha. El jugador A (cambió de posición el 01/03) aparece con su resultado del 10/02 en «Posición 1» y con el del 10/03 en «Posición 2». |
| CA-02.3 | El resultado del jugador D (12/03) aparece en «Sin posición en esa fecha», aunque hoy tenga posición asignada. |
| CA-02.4 | Cambiar hoy la posición actual de cualquier jugador no mueve ningún resultado histórico de grupo. |
| CA-02.5 (sujeto a D12b) | Con Average: A 10/02 = 12, A 10/03 = 12, B 10/02 = 21, B 10/03 = 22, C = 8, D = 9. Con Max: A 10/02 = 14, A 10/03 = 13, B 10/02 «no disponible», B 10/03 = 24, C = 8, D = 9. |
| CA-02.6 | Cada fila muestra su fecha y su nº de repeticiones (A 10/03: 2 válidas; B 10/02: 4 según `Reps` del resumen). |
| CA-02.7 | Los resultados de sesiones excluidas no aparecen por defecto. |
| CA-02.8 (sujeto a D12b) | Un Max «no disponible» no se ordena como un valor numérico ni se sustituye por el Average. |
| CA-02.9 | En el test unilateral, izquierdo a la izquierda y derecho a la derecha, con etiqueta explícita en cada columna. |
| CA-02.10 | Se puede ordenar por valor, jugador y fecha, y exportar a CSV con los mismos valores y el mismo orden de lados que se ven. |
| CA-02.11 | El **orden de los grupos** y **qué sesión(es) de cada jugador se muestran por defecto** se verifican contra las decisiones D9 y D10 cuando estén definidas. Hasta entonces no hay criterio de aceptación que fije ni el orden ni el contenido por defecto, y la implementación no los asume. |

## 4. RF-03: navegación en ambos sentidos

El perfil del jugador y la vista del test deben poder recorrerse en los dos sentidos sin perder el contexto.

- **RF-03.1** Desde la evolución de un jugador en un test hay una acción visible («Ver todos los jugadores en este test») que abre la vista comparativa con el mismo test, protocolo, variable y modo Average/Max.
- **RF-03.2** Desde la vista comparativa, elegir un jugador abre su perfil directamente en la evolución de ese mismo test, con la misma variable y el mismo modo.
- **RF-03.3** Al ir y volver se conservan el test, el protocolo, la variable, el modo Average/Max y el rango de fechas; en la vista comparativa el jugador de origen queda señalado.
- **RF-03.4** El botón Atrás del navegador y unas migas de pan funcionan en ambos sentidos, y recargar la página mantiene la vista (rutas por hash, compatibles con el alojamiento estático).

| Id | Criterio |
|---|---|
| CA-03.1 | Desde A en «Test sintético 1» con Max seleccionado, la acción abre la vista comparativa del mismo test con Max seleccionado. |
| CA-03.2 | Desde esa vista, elegir al jugador B abre el perfil de B en la evolución de «Test sintético 1», con la misma variable y modo Max. |
| CA-03.3 | Recorrido ida y vuelta (jugador → test → mismo jugador): se conservan test, protocolo, variable, modo y fechas, y el jugador queda señalado en la vista comparativa. |
| CA-03.4 | Con el botón Atrás del navegador se vuelve a la pantalla anterior en cada paso, y al recargar se recupera la misma vista. |
| CA-03.5 | Desde la vista conjunta de Max Isometric Strength o Heavy Dynamic Strength del perfil, abrir un test lleva a su evolución y desde ahí a la vista comparativa. |
| CA-03.6 | Todo el recorrido es operable con teclado, con nombres accesibles y foco visible. |
| CA-03.7 | Ninguna navegación modifica datos guardados (CA-01.11). |

## 5. Conjunto sintético de aceptación

Datos ficticios, solo para comprobar los criterios; no se mezclan con datos reales y se identifican como sintéticos. Las posiciones son marcadores: **no** representan ni fijan ninguna posición ni orden reales. Las unidades no están definidas.

Posiciones (historial con fechas de vigencia): A, «Posición 1» hasta el 28/02/2026 y «Posición 2» desde el 01/03/2026; B, «Posición 1» desde el 01/01/2026; C, «Posición 2» desde el 01/01/2026; D, sin registro hasta el 31/03/2026 y «Posición 1» desde el 01/04/2026; F, «Posición 1».

«Test sintético 1» (bilateral, una variable):

| Jugador | Fecha | Repeticiones válidas | Average | Max | Posición vigente |
|---|---|---|---|---|---|
| A | 10/02/2026 | 10, 12, 14 | 12 | 14 | Posición 1 |
| A | 10/03/2026 | 11, 13 (y una 99 excluida) | 12 | 13 | Posición 2 |
| B | 10/02/2026 | resumen All Average = 21 (`Reps` = 4) | 21 | no disponible | Posición 1 |
| B | 10/03/2026 | 20, 22, 24, 22 | 22 | 24 | Posición 1 |
| C | 12/03/2026 | 8 (una repetición) | 8 | 8 | Posición 2 |
| D | 12/03/2026 | 9, 9, 9 | 9 | 9 | sin posición en esa fecha |

«Test sintético 2» (unilateral): jugador F, 12/03/2026; izquierdo 30 y 32, derecho 28 y 34; Average izquierdo 31 y derecho 31; Max izquierdo 32 y derecho 34.

Jugador E: sesiones solo de otro test.

Si se revierte la exclusión de la repetición 99 del jugador A (10/03): Average 41 y Max 99.

## 6. Estado de las decisiones

| Id | Decisión | Estado |
|---|---|---|
| D9 | Orden de las posiciones | **Decidida:** configurable por el usuario; no se fija ningún orden definitivo. |
| D10 | Contenido por defecto de la vista comparativa | **Propuesta del usuario, pendiente de aprobar:** última sesión válida de cada jugador al abrir, con opciones de «Max histórico» (sesión con mayor average) y de histórico completo. Depende de D12b por el significado de «Max histórico». |
| D11 | Posición para agrupar | **Decidida:** posición principal en la fecha de cada sesión; las secundarias no incluyen al jugador automáticamente en varios grupos. |
| D12a | Average, Average de sesión y exclusiones | **Aceptada:** coincide con la guía. |
| D12b | Definición de Max | **En conflicto, sin resolver.** Ver `DECISIONES.md`. |
| D13 | Modo inicial del selector | **Decidida:** Average. |

Consecuencia que conviene tener presente con D10: con el histórico completo, un mismo jugador puede aparecer en grupos distintos según la fecha de cada sesión, porque se usa la posición vigente en esa fecha.

Las decisiones sobre gráficos, referencias y colores (D14 a D21) están en `DECISIONES.md`.

## 7. Dependencias

- **Historial de posiciones con fechas de vigencia** y una consulta «posición de un jugador en una fecha»: se incluye en la fase 1c.
- **Catálogo, sesiones y repeticiones** (decisiones D4 a D8 y fases 2 a 4): necesarios para ver resultados reales.
- **RF-01 y su recorrido**: fase 5a. **RF-02 y RF-03**: fase 5b. Ver `PLAN_DE_FASES.md`.
- Las reglas de exclusión, eliminación de sesiones, lateralidad y valores originales y relativos son las de la guía y no se repiten aquí.

## 8. Relación con el diseño anterior

El documento de diseño de la fase 0 (versión 0.1) describe la ficha y la vista de test en su mapa de pantallas. Estos requisitos concretan y completan ese diseño; ante cualquier diferencia, prevalece este documento.

## 9. Fuera del alcance de estos requisitos

Los gráficos (G1 a G8), los percentiles y colores, las referencias («La Liga» y Premier League), las relaciones entre variables y las pantallas de perímetros y NME más allá del estado vacío: se especifican en la guía actualizada (apartado «Gráficos y visualizaciones») y se tratan en sus propias fases.
