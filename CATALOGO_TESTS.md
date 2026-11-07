# Especificación del catálogo de tests editable — borrador v0.2

Proyecto: DASHBOARD DE RENDIMIENTO · Fase 2 · Estado: **borrador vivo** (no implementado), actualizado el 6 de noviembre de 2026. Esta copia, la del repositorio, es la vigente.
Fuentes: libros «BASE DE DATOS» y «ELABORACION GRAFICOS» (solo estructura y fórmulas; ningún dato de jugador), ejemplo de exportación VALD RSAIP y las decisiones del usuario.

**Regla de este documento:** la fuente de verdad de las decisiones es `DECISIONES.md`. Aquí se numeran con sus identificadores reales (D4, D5, D25…). La numeración propia de la v0.1 (D25–D30) se ha eliminado porque colisionaba con ella.

Etiquetas: **[Decidido]** confirmado por el usuario · **[Propuesta]** idea de este borrador, sin confirmar · **[Pendiente]** requiere decisión (con su D).

---

## 1. Principios

1. **[Propuesta]** Solo se guardan datos brutos (valores de VALD o entrada manual, más antropometría fechada). Los valores derivados se calculan al momento con la definición vigente del catálogo.
2. **[Propuesta]** Corrección ≠ cambio de protocolo. Una *corrección* (fórmula errónea, unidad mal puesta) recalcula el histórico, mostrando antes qué cambia. Un *cambio de protocolo* (posición, ángulo, dispositivo, carga, criterio de validez) crea una **variante** enlazada, que no se mezcla con la anterior en el gráfico longitudinal, el Personal Best ni los percentiles.
3. **[Propuesta]** Identificadores internos fijos; el nombre visible es editable. Un test o variable con datos se archiva, nunca se borra.
4. **[Propuesta]** Cada cambio del catálogo queda registrado (§8) y el catálogo forma parte de la copia de seguridad.
5. **[Propuesta]** Fórmulas solo con un conjunto cerrado de operaciones (§5), sin intérprete de fórmulas libres.
6. **[Decidido]** Una sola constante de gravedad en toda la app: **g = 9,80665 m/s²** (el Excel usaba 9,80665, 9,81 y 9,8).

---

## 2. Entidades

### 2.1 Test
| Campo | Notas |
|---|---|
| id | fijo, generado |
| nombre | editable. Equivalencias confirmadas: «RSAIP» = «Single Leg Ankle Iso-Push» = Run-Specific Ankle Iso-Push. Falta confirmar lo análogo para Hip y Knee (D32) |
| región | cadera, rodilla, tobillo, isquios, etc. (lista editable) |
| fuente | ForceDecks, ForceFrame, NordBord, DynaMo, VBT, manual… |
| modo | bilateral (L/R), unilateral (una referencia por extremidad, D28), valor único |
| protocolo | posición, ángulos, palanca, carga, criterio de validez |
| variante_de, vigente_desde | ver principio 2 |
| parámetros | p. ej. `factor_sw = 0,29` (solo Hip; configurable y versionado, D27) |
| estado | activo / archivado |

### 2.2 Variable bruta
id, test, nombre, unidad, lado (L/R/total/ninguno), decimales, rango plausible (aviso, no rechazo), **dirección** (más es mejor · menos es mejor · rango objetivo).
- **[Decidido D4, 7/11]** la *manifestación de la fuerza* es atributo de cada variable.
- **[Decidido D6, 7/11]** el lado es atributo de cada **valor**.
- **[Decidido D8, 7/11]** una fila por sesión; por variable, el valor de cada lado (media de la sesión) y su número de repeticiones. Las repeticiones sueltas podrán añadirse más adelante; nunca se crean a partir de resúmenes.
- El export de VALD (RSAIP) trae solo el **resumen de sesión** (media ponderada por `Reps`), sin repeticiones individuales: la Máxima repetición no está disponible para esa fuente.

### 2.3 Variable derivada
Como la bruta, más `operación` (§5) y `operandos`.

### 2.4 Antropometría
**[Decidido, D27]** Mediciones **fechadas** por jugador: altura (cm), peso (kg) y longitud de la extremidad inferior (cm). Cada sesión usa la medición **más próxima a su fecha dentro de la ventana antropométrica**; sin medición en la ventana, la variable derivada **no se calcula** y se muestra el motivo (nunca 0).
- **[Pendiente]** valor de la ventana.
- **[Pendiente D30]** si la columna BW [KG] de VALD se usa como medición fechada de origen VALD.
- Para %BW y %SW sobre cargas de Iso-Hold (sin fecha propia): medición más reciente dentro de la ventana contada hacia atrás desde hoy; si no hay, «no disponible» **[Decidido, D5]**.

### 2.5 Perfil de importación
Jugador (alias de la fase 1c), fecha, lado, repetición o «fila = sesión», mapa de columnas con conversión de unidad, filas a ignorar; vista previa antes de guardar y lista de columnas sin mapear.
Hechos observados en el RSAIP (ver `DICCIONARIO_DE_DATOS.md`): BOM UTF-8, 21 columnas, horas en 12 h, la columna sin sufijo es la media de la sesión ponderada por `Reps`, la asimetría de VALD («7.8 R») indica el lado mayor.
Pendientes antes de la fase 4: D29 (filas del mismo jugador y día), D30, D31 (etiquetas), D32 (resto del mapeo, «Force at 100ms»).

### 2.6 Configuración de visualización (por variable)
Gráficos donde aparece, escala MIN/MAX **[Decidido en esencia, D24]**: mínimo y máximo de la base propia o de las referencias aportadas; pendiente el tratamiento de valores extremos y de valores fuera de rango. Colores **[Parcial, D14]**.

---

## 3. Resultado de sesión según el tipo de test **[Decidido, D5]**

| Tipo | Resultado de sesión |
|---|---|
| Tests con repeticiones y media | Average de sesión = media de las repeticiones válidas (o la media de VALD ponderada por `Reps`) |
| **Iso-Push** (incluido el de tobillo sentado) | Average de **todas** las repeticiones realizadas, de ambos lados |
| **Nordic** | Media de la sesión, con total, derecho e izquierdo |
| **RM e Iso-Hold** | Solo la **carga máxima** movilizada; sin Average ni Máxima repetición; se usa como referencia de monitorización de la carga |

El **usuario introduce la carga externa del Iso-Hold** (máxima carga trabajada en 3 series de 20 s). La app calcula las variables **frente al Personal Average del Iso-Push** del jugador, sin depender de la fecha del Iso-Hold.

---

## 4. Constantes y cálculos del sistema

- **Average de sesión, Personal Average** (todas las repeticiones válidas del periodo; ponderado por `Reps` en resúmenes), **Personal Best** (mejor Average según la dirección; **no definido** con rango objetivo, D23; **empate → la sesión más reciente**, D22), **Máxima repetición** (dato aparte, solo si hay repeticiones) **[Decidido, D12/D12b/D22/D23]**.
- **SW (System Weight)** = 29 % del **último peso corporal medido anterior o igual a la fecha de la sesión** (100 kg → 29 kg). **Solo Hip** (Iso-Push e Iso-Hold). Knee y Ankle usan BW **[Decidido, D27]**. El 29 % no se ha verificado con fuente.
- **Referencia «La Liga»** **[Decidido, D19/D28]**: se calcula desde la base propia, con **un valor por jugador** (media de todos sus tests válidos de todas las temporadas, sin sesiones excluidas), por test, protocolo y variable; los datos sintéticos se excluyen. Tests unilaterales: dos referencias, una por extremidad, y percentil por extremidad. Con una sola sesión el jugador ya cuenta. Pendiente: si el jugador evaluado se incluye en su propia referencia (se recomienda excluirlo), el caso de cambio de posición y el mínimo de jugadores.
- **Premier League** (rangos de percentil por test, a aportar por el usuario) y **SCIENCE** (valor bibliográfico con cita) son referencias introducidas a mano, con fuente y población **[Decidido, D14/D21; rangos pendientes]**.

---

## 5. Conjunto cerrado de operaciones

| Operación | Definición | Estado |
|---|---|---|
| `COCIENTE(a, b)` | a / b (ratios ADD:ABD, IR:ER, EUR…) | [Propuesta] |
| `PORCENTAJE(a, b)` | a / b · 100 | [Propuesta] |
| `RELATIVO_BW(x)` | fuerza (N) ÷ (peso · g) | [Decidido] Knee y Ankle |
| `RELATIVO_SW(x)` | fuerza (N) ÷ (0,29 · peso · g) | [Decidido] solo Hip |
| `TORQUE_REL(F)` | F · palanca / peso (N·m/kg) | [Propuesta] |
| `MVIC_KG` | ((Peak Force L + Peak Force R)/2 − BW en N) / 9,80665; **en Hip se resta SW en vez de BW** | [Decidido, D5] según Excel |
| `PIMA_PC` | %PIMA = carga externa / MVIC | [Decidido, D5]; la etiqueta se mantiene, sin expandir |
| `BW_PC` | %BW = carga externa / BW (Knee, Ankle) | [Decidido, D5] |
| `SW_PC` | %SW = carga externa / SW en kg (Hip) | [Decidido, D5]; el Excel usaba 9,8 y aquí es 9,80665 |
| `ASIMETRÍA(L, R)` | **(R − L) / max(L, R) · 100**; positivo si domina la derecha, negativo si la izquierda; dominante = lado con valor más alto | [Decidido, D25] |
| `DIF_ABS(L, R)` | R − L en la unidad original (ángulos) | [Pendiente] |
| `DIFERENCIA(a, b)` | a − b (Jurdan, Ely…) | [Propuesta] |
| `EVOLUCIÓN` | (actual − previo) / \|previo\| · 100 (el Excel usaba max(previo, actual)) | [Pendiente] |
| `REGRESIÓN_FV` | pendiente, intercepto, F0, V0, Pmax | [Pendiente D17] (método y mínimos de cargas) |

Los valores de asimetría que VALD ya exporta («7.8 R») se muestran tal cual, sin recalcular su signo.

**Radar:** normalización y selección de variables **[Pendiente D16]**. La regla de la v0.1 (ratio frente a la mediana, inversión de las variables de «menos es mejor», hueco si falta el dato) queda como **[Propuesta]**. La parte de «hueco, nunca 0» sí es [Decidido] (regla de «No disponible»).

---

**Tablas (D33):** el valor por defecto en la tabla de un test y en la de un jugador es el Personal Average; un filtro superior pasa a Personal Best; pulsar el dato o el jugador abre el longitudinal. Pendiente: grupo de posición (D33a) y destino del histórico completo y la última sesión (D33b).

## 6. Validación al guardar un cambio del catálogo **[Propuesta]**
1. Tipos y unidades de los operandos.
2. Aviso de dependencias (gráficos, referencias, perfiles de importación, otras derivadas).
3. Vista previa de valores antes y después.
4. Elegir tipo de cambio (corrección o variante) y motivo obligatorio.

## 7. Variables adicionales por decidir
- **1RM estimado** **[Decidido D5, 7/11]**: se deja como en el Excel, (kg movilizados + peso) × 1,4, en la elevación de talones de pie de 12 repeticiones, como variable calculada. El 1,4 corresponde al test de 12 repeticiones (12RM), según el usuario. Factor empírico sin fuente verificada; falta fijar qué peso usa (propuesta: la regla general de D27).
- **Seguimiento del Iso-Hold de tobillo sentado:** tabla del Excel con columnas «%MVIC achieved» y «load tolerance (xBW)». Se acordó que funciona igual que los demás Iso-Push/Iso-Hold (BW; MVIC, %PIMA, %BW); esas dos columnas no se incorporan salvo que las pidas.
- **Perfil F-V (VBT):** decidir si entra en la primera versión de la fase 2 (D17 lo condiciona).

## 8. Registro de cambios **[Propuesta]**
Entradas solo de adición: fecha y hora, entidad, campo, valor anterior, valor nuevo, tipo (corrección, variante, presentación) y motivo.

## 9. Errores del Excel que el catálogo evita
- Referencia cruzada entre filas (`CMP!M4 = CMP!M18`).
- Tres convenciones de signo en asimetría y dos unidades (fracción y %).
- `MAX(L:R)` con valores negativos (ángulos).
- Datos que faltan dibujados como 0 en el radar; tiempos sin invertir.
- Etiquetas que no coinciden con la fórmula (L/BW frente a L/SW).
- Constante de gravedad distinta según la hoja (9,80665, 9,81, 9,8).
- Valores de referencia copiados a mano que no coinciden entre hojas.

## 10. Para cerrar la v1.0
- ~~D4, D6, D8 y 1RM~~ (cerrados el 7/11).
- Un ejemplo de exportación de VALD por cada tipo de test (D32), con nombres de jugador cambiados.
- Valor de la ventana antropométrica.
- D16, D17 (si el perfil F-V entra en la fase 2) y `DIF_ABS`/`EVOLUCIÓN`.
