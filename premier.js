// premier.js — fase 6d: referencias de la Premier League 2025-26, columna «In Season» (NO pre-season), aportadas por el usuario el 7/11/2026
// en 6 imágenes (PERCENTILES PREMIER LEAGUE 1 a 6). Transcritas a mano y comprobadas ampliando las imágenes. Cortes: P5, P25, mediana (P50), P75, P95.
// Regla del usuario: lo que no figura en las tablas NO tiene percentil de la Premier League. Solo se enlazan variables del catálogo con el MISMO nombre
// de métrica (sin equivalencias supuestas). Se convierte la unidad solo cuando ambas están indicadas (s → ms). Sin color (D14b abierta): solo la zona entre cortes.
// Los cortes se dan en el orden de la fuente (el orden en que los publica la tabla); no se inventan percentiles intermedios (no hay interpolación).
// Las asimetrías de ForceDecks son con signo y su convención de signo no está verificada frente a la de la app (D25): se muestran sin ubicar al jugador.

const DJ = ['DL Drop Jump 30 cm', 'DL Drop Jump 45 cm'];
// [tests, variable del catálogo, métrica de la tabla, factor de unidad (tabla → catálogo), cortes P5..P95, conSigno]
const R = (tests, variable, metric, scale, cuts, signed = false, abs = false) => ({ tests, variable, metric, scale, cuts, signed, abs });

export const PREMIER_SEASON = 'In Season 2025-26';
export const PREMIER_REFERENCES = [
  // Run-Specific Isometrics (ForceDecks)
  R(['Run-Specific Hip Iso-Push'], 'Peak Force', 'Hip Iso-Push Max Force (N)', 1, [316, 400, 492, 571, 696]),
  R(['Run-Specific Knee Iso-Push'], 'Peak Force', 'Knee Iso-Push Max Force (N)', 1, [1779, 2299, 2667, 3002, 3530]),
  R(['Run-Specific Ankle Iso-Push'], 'Peak Force', 'Ankle Iso-Push Max Force (N)', 1, [1396, 1761, 2007, 2354, 2781]),
  // CMJ
  R(['CMJ'], 'JH (imp-mom)', 'Jump Height (Imp-Mom) cm', 1, [29.0, 35.3, 38.9, 42.4, 47.3]),
  R(['CMJ'], 'RSI MOD', 'RSI-Mod (Imp-Mom)', 1, [0.36, 0.47, 0.55, 0.62, 0.74]),
  R(['CMJ'], 'ECC PEAK VELOCITY', 'Eccentric Peak Velocity (m/s)', 1, [-1.02, -1.29, -1.45, -1.61, -1.80]),
  R(['CMJ'], 'ECC DECELERATION IMPULSE', 'Eccentric Deceleration Impulse (Ns)', 1, [73, 98, 116, 134, 158]),
  R(['CMJ'], 'ECC DECEL RFD', 'Eccentric Deceleration RFD / BM (N/s/kg)', 1, [43, 72, 95, 123, 172]),
  R(['CMJ'], 'ECC PEAK POWER/BM', 'Eccentric Peak Power / BM (W/kg)', 1, [11.9, 18.5, 22.6, 26.9, 33.6]),
  R(['CMJ'], 'DEPTH', 'Countermovement Depth (cm)', 1, [-21.4, -28.2, -32.8, -37.6, -44.3]),
  R(['CMJ'], 'CON IMPULSE 100ms', 'Concentric Impulse 100ms (Ns)', 1, [65, 94, 112, 131, 162]),
  R(['CMJ'], 'CON IMPULSE', 'Concentric Impulse (Ns)', 1, [172, 203, 221, 244, 274]),
  R(['CMJ'], 'FORCE AT 0 VELOCITY', 'Force at Zero Velocity / BM (N/kg)', 1, [19.2, 22.5, 24.7, 27.0, 30.5]),
  R(['CMJ'], 'CONCENTRIC DURATION', 'Concentric Duration (s)', 1000, [0.31, 0.28, 0.25, 0.22, 0.19]),
  R(['CMJ'], 'ECC DECEL RFD ASYM', 'Eccentric Deceleration RFD Asymmetry (%)', 1, [-33, -13, -1, 12, 30], true),
  R(['CMJ'], 'CON IMPULSE 100ms ASYM', 'Concentric Impulse 100ms Asymmetry (%)', 1, [-14, -5, 1, 8, 16], true),
  R(['CMJ'], 'CON IMPULSE ASYM', 'Concentric Impulse Asymmetry (%)', 1, [-11, -4, 1, 6, 13], true),
  R(['CMJ'], 'ECC DECEL IMPULSE ASYM', 'Eccentric Deceleration Impulse Asymmetry (%)', 1, [-20, -7, 3, 12, 24], true),
  R(['CMJ'], 'PEAK LANDING FORCE ASYM', 'Peak Landing Force Asymmetry (%)', 1, [-23, -7, 3, 14, 29], true),
  R(['CMJ'], 'CON PEAK POWER/BM', 'Peak Power / BM (W/kg)', 1, [44.0, 51.7, 56.2, 60.4, 66.6]), // equivalencia confirmada por el usuario (7/11)
  R(['CMJ'], 'ECC DECEL PHASE DURATION', 'Eccentric Duration (s)', 1, [0.58, 0.50, 0.46, 0.42, 0.36]), // ídem
  // Squat Jump
  R(['Squat Jump'], 'JH (imp-mom)', 'Jump Height (Imp-Mom) cm', 1, [26.4, 32.2, 35.6, 39.2, 44.2]),
  R(['Squat Jump'], 'RSI MOD', 'RSI-Mod (Imp-Mom)', 1, [0.45, 0.73, 0.94, 1.16, 1.36]),
  // SLJ de la tabla = SL CMJ del catálogo (D37)
  R(['SL CMJ'], 'JH (imp-mom)', 'Jump Height (Imp-Mom) cm', 1, [14.3, 18.4, 20.7, 23.2, 26.5]),
  R(['SL CMJ'], 'RSI MOD', 'RSI-Mod (Imp-Mom)', 1, [0.16, 0.22, 0.26, 0.31, 0.37]),
  R(['SL CMJ'], 'ECC PEAK VELOCITY', 'Eccentric Peak Velocity (m/s)', 1, [-0.49, -0.78, -0.95, -1.09, -1.31]),
  R(['SL CMJ'], 'ECC DECEL RFD', 'Eccentric Deceleration RFD / BM (N/s/kg)', 1, [13.5, 28.2, 40.4, 57.2, 82.7]),
  R(['SL CMJ'], 'ECC PEAK POWER/BM', 'Eccentric Peak Power / BM (W/kg)', 1, [4.9, 8.9, 11.5, 14.2, 18.2]),
  R(['SL CMJ'], 'DEPTH', 'Countermovement Depth (cm)', 1, [-13.7, -19.7, -23.3, -26.6, -32.6]),
  R(['SL CMJ'], 'CON IMPULSE 100ms', 'Concentric Impulse 100ms (Ns)', 1, [31, 51, 66, 82, 104]),
  R(['SL CMJ'], 'FORCE AT 0 VELOCITY', 'Force at Zero Velocity / BM (N/kg)', 1, [13.2, 15.9, 17.6, 19.4, 21.9]),
  R(['SL CMJ'], 'CONCENTRIC DURATION', 'Concentric Duration (s)', 1000, [0.40, 0.34, 0.30, 0.26, 0.22]),
  R(['SL CMJ'], 'CON PEAK POWER/BM', 'Peak Power / BM (W/kg)', 1, [28.0, 32.6, 35.4, 38.4, 43.0]),
  R(['SL CMJ'], 'ECC DECEL PHASE DURATION', 'Eccentric Duration (s)', 1, [0.70, 0.57, 0.49, 0.44, 0.37]),
  // Drop Jump (la tabla no indica la altura de caída: se aplica a 30 y 45 cm)
  R(DJ, 'RSI (FLIGHT TIME / CONTACT TIME)', 'RSI (Flight Time)', 1, [2.12, 2.60, 2.93, 3.22, 3.68]),
  R(DJ, 'JUMP HEIGHT (Flight Time - cm)', 'Jump Height (Flight Time) cm', 1, [27.7, 33.5, 36.9, 40.5, 45.1]),
  R(DJ, 'CONTACT TIME', 'Contact Time (s)', 1, [0.24, 0.20, 0.19, 0.17, 0.15]),
  R(DJ, 'PEAK POWER / BM', 'Peak Power / BM (W/kg)', 1, [135, 159, 173, 188, 211]),
  R(DJ, 'ECCENTRIC IMPULSE ASYMMETRY', 'Eccentric Impulse Asymmetry (%)', 1, [-21, -6, 3, 13, 29], true),
  R(DJ, 'CONCENTRIC IMPULSE ASYMMETRY', 'Concentric Impulse Asymmetry (%)', 1, [-14, -5, 1, 7, 16], true),
  R(DJ, 'DROP LANDING RFD ASYMMETRY', 'Landing RFD Asymmetry (%)', 1, [-27, -9, 6, 20, 40], true), // equivalencia confirmada por el usuario (7/11)
  R(DJ, 'PEAK DROP LANDING FORCE ASYMMETRY', 'Peak Landing Force Asymmetry (%)', 1, [-19, -6, 4, 13, 27], true), // ídem
  // Nordic Hamstring Exercise (NordBord; confirmado por el usuario el 7/11). Las variables del catálogo (D5, 8/11) tienen exactamente estos nombres.
  // La asimetría se guarda CON SIGNO (todas las asimetrías llevan signo); la tabla Premier es un valor absoluto, así que se compara con |valor|.
  R(['Nordic Hamstring Exercise'], 'Max Force', 'Nordic Max Force (N)', 1, [328, 417, 464, 517, 593]),
  R(['Nordic Hamstring Exercise'], 'Max Force Asymmetry', 'Nordic Max Force Asymmetry (%)', 1, [19, 11, 7, 3, 1], false, true),
  R(['Nordic Hamstring Exercise'], 'Torque', 'Nordic Torque (Nm)', 1, [129, 171, 197, 225, 261]),
  // Hop Test
  R(['Double-Leg Hop Test'], 'MEAN RSI (FLIGHT TIME / CONTACT TIME)', 'Mean RSI (Flight Time)', 1, [1.94, 2.37, 2.65, 2.96, 3.43]),
  R(['Double-Leg Hop Test'], 'MEAN JUMP HEIGHT (Flight Time) (cm)', 'Mean Jump Height (Flight Time) cm', 1, [15.0, 20.7, 25.3, 30.1, 36.4]),
  R(['Double-Leg Hop Test'], 'MEAN CONTACT TIME', 'Mean Contact Time (s)', 1000, [0.20, 0.18, 0.17, 0.16, 0.14]),
  R(['Double-Leg Hop Test'], 'MEAN PEAK FORCE ASYMMETRY', 'Mean Peak Force Asymmetry (%)', 1, [-16, -6, 1, 8, 18], true),
  R(['Double-Leg Hop Test'], 'MEAN LANDING RFD ASYMMETRY', 'Mean Landing RFD Asymmetry (%)', 1, [-16, -6, 1, 8, 19], true),
];

const lc = (s) => String(s ?? '').trim().toLowerCase();
export const CUT_NAMES = ['P5', 'P25', 'P50 (mediana)', 'P75', 'P95'];

// Referencia de la Premier para (test, variable) del catálogo, con los cortes ya en la unidad del catálogo. null = no figura en las tablas.
export function findPremier(test, variable) {
  const ref = PREMIER_REFERENCES.find((r) => r.tests.some((t) => lc(t) === lc(test?.name)) && lc(r.variable) === lc(variable?.name));
  if (!ref) return null;
  return { ...ref, cuts: ref.cuts.map((c) => Math.round(c * ref.scale * 1e6) / 1e6), unitConverted: ref.scale !== 1 };
}

// Zona del valor respecto a los cortes, en el orden de la fuente: 0 = más allá del P5 · 1 = P5–P25 · 2 = P25–P50 · 3 = P50–P75 · 4 = P75–P95 · 5 = más allá del P95.
export function zoneOf(cuts, value) {
  const asc = cuts[4] >= cuts[0];
  const c = asc ? cuts : cuts.map((x) => -x), v = asc ? value : -value;
  if (v < c[0]) return 0;
  let z = 1;
  for (let i = 1; i < 5; i++) if (v >= c[i]) z = i + 1;
  return z; // v >= c[4] → 5 (el valor justo en el P95 o más allá)
}
// Regla de color de la Premier (D14b, opción A confirmada el 7/11): la zona i de las seis delimitadas por P5/P25/P50/P75/P95 lleva la banda i de la paleta de La Liga.
// Los umbrales de la Premier (5/25/50/75/95) NO coinciden con los de La Liga (10/35/50/65/90). Es posición en la población de la tabla, no un umbral clínico.
export const ZONE_BANDS = ['rojo', 'naranja', 'amarillo-suave', 'amarillo', 'verde-suave', 'verde'];
// Referencias que el usuario confirmó por lado (7/11): Iso-Push (Hip, Knee, Ankle) y SL CMJ.
export const isPerSide = (ref) => !!ref && ref.tests.every((t) => /Iso-Push$/.test(t) || t === 'SL CMJ');
export const ZONE_TEXT = ['más allá del P5 (extremo bajo de la tabla)', 'entre P5 y P25', 'entre P25 y la mediana', 'entre la mediana y P75', 'entre P75 y P95', 'en el P95 o más allá (extremo alto de la tabla)'];

export function placeAgainstPremier(ref, value) {
  if (!ref || !Number.isFinite(value)) return null;
  if (ref.signed) return { placed: false, reason: 'Referencia con signo: la convención de signo de ForceDecks no está verificada frente a la de la app (D25); se muestran los cortes sin ubicar ni colorear al jugador.' };
  const z = zoneOf(ref.cuts, ref.abs ? Math.abs(value) : value);
  return { placed: true, zone: z, band: ZONE_BANDS[z], text: ZONE_TEXT[z], aboveMedian: ref.cuts[4] >= ref.cuts[0] ? value > ref.cuts[2] : value < ref.cuts[2] };
}
