// relaciones.js — fase 6: ratios DSI y EUR y Optimal Reactive Zone (ORZ) del Drop Jump (D38, D39, D47).
// Lógica pura (sin IndexedDB): recibe los datos ya leídos. Ventana: TODA la historia siempre (el filtro de pantalla no cambia estos ratios).
// Los ratios son orientativos y no tienen unidad. No se inventa nada: sin datos suficientes devuelven «no definido» con el motivo.

import { buildSeries, personalAverage, personalBest } from './evolucion.js';
import { mismoTest } from './nombres.js';
import { evaluate, median, MIN_N_DEFAULT } from './percentiles.js';
import { asymmetryPct } from './catalogo.js';
import { daysBetween } from './fechas.js';

export const G = 9.80665;
const lc = (s) => String(s ?? '').trim().toLowerCase();

// Masa corporal en kg a partir de una medición ({value, unit}); solo unidades conocidas.
export function toKg(m) {
  if (!m || typeof m.value !== 'number' || !(m.value > 0)) return null;
  const u = lc(m.unit);
  if (u === 'kg') return m.value;
  if (u === 'g') return m.value / 1000;
  if (u === 'lb' || u === 'lbs') return m.value * 0.45359237;
  return null;
}

// Fuente de peso para TODOS los cálculos con masa (decidido el 8/11/2026): la masa corporal MEDIDA más cercana a la fecha, anterior o posterior.
// Sin ventana ni límite de días (se informa de la fecha usada y de la distancia en días). A igual distancia se toma la anterior (regla mía: era la vigente).
// Si el jugador no tiene ninguna medición, se usa su peso de referencia (registro {reference: true}, sin fecha); si tampoco, no se calcula.
export function massNearest(records, date) {
  let best = null;
  for (const r of records) {
    const kg = toKg(r.bodyMass);
    if (kg === null || r.reference || !r.date) continue;
    const d = Math.abs(daysBetween(r.date, date));
    if (!best || d < best.daysAway || (d === best.daysAway && (r.date < best.date || (r.date === best.date && (r.id ?? 0) > (best.id ?? 0))))) best = { kg, date: r.date, daysAway: d, reference: false, id: r.id };
  }
  if (best) return { kg: best.kg, date: best.date, daysAway: best.daysAway, reference: false };
  const ref = records.find((r) => r.reference && toKg(r.bodyMass) !== null);
  return ref ? { kg: toKg(ref.bodyMass), date: null, daysAway: null, reference: true } : null;
}
// Longitud de pierna / palanca en metros de una medición ({value, unit}); solo m, cm y mm.
export function toM(m) {
  if (!m || typeof m.value !== 'number' || !(m.value > 0)) return null;
  const u = lc(m.unit);
  return u === 'm' ? m.value : u === 'cm' ? m.value / 100 : u === 'mm' ? m.value / 1000 : null;
}
// Misma regla que la masa: la longitud medida más cercana a la fecha (anterior o posterior; a igual distancia, la anterior). Sin medición no hay valor.
export function legNearest(records, date) {
  let best = null;
  for (const r of records) {
    const m = toM(r.legLength);
    if (m === null || !r.date) continue;
    const d = Math.abs(daysBetween(r.date, date));
    if (!best || d < best.daysAway || (d === best.daysAway && r.date < best.date)) best = { m, date: r.date, daysAway: d };
  }
  return best;
}
// Añade a las mediciones el peso de referencia de cada jugador (campo referenceWeight del jugador) como registro sin fecha.
export function withReferenceWeights(anthropometry, players) {
  return anthropometry.concat(players.filter((p) => p.referenceWeight && toKg(p.referenceWeight) !== null).map((p) => ({ playerId: p.id, date: null, bodyMass: p.referenceWeight, reference: true })));
}

// Jugadores sin ninguna masa utilizable: ni medición de peso ni peso de referencia. Sus valores relativos al peso corporal (BW, SW, N·m/kg) no se pueden
// calcular, así que no aparecen en esos percentiles. Con `soloConDatos` se limitan a los que sí tienen sesiones del test que se esté mirando.
export function playersWithoutMass(players, anthropometry, soloConDatos = null) {
  const conMasa = new Set(withReferenceWeights(anthropometry ?? [], players ?? []).filter((r) => toKg(r.bodyMass) !== null).map((r) => r.playerId));
  const ids = soloConDatos === null ? null : new Set(soloConDatos);
  return (players ?? []).filter((p) => p.active !== false && !conMasa.has(p.id) && (ids === null || ids.has(p.id)));
}

// Puntos de un test relativizados al peso propio (múltiplos de BW): fuerza (N) ÷ (masa × g).
export function relativeBWPoints(points, anthropometry) {
  const out = [], omitted = [];
  for (const p of points) {
    const m = massNearest(anthropometry, p.date);
    if (!m) { omitted.push(p.date); continue; }
    out.push({ ...p, value: p.value / (m.kg * G) });
  }
  return { points: out, omitted: omitted.length };
}

// DSI por lado = (SL CMJ «CONCENTRIC PEAK FORCE / BM», N/kg, Personal Average ÷ g) ÷ (Knee Iso-Push Peak Force en BW, Personal Average).
export function dsiSide({ slPoints, kneePoints, anthropometry }) {
  if (!slPoints.length) return { defined: false, reason: 'Faltan sesiones válidas de SL CMJ (CONCENTRIC PEAK FORCE / BM) en ese lado.' };
  if (!kneePoints.length) return { defined: false, reason: 'Faltan sesiones válidas de Knee Iso-Push (Peak Force) en ese lado.' };
  const rel = relativeBWPoints(kneePoints, anthropometry);
  if (!rel.points.length) return { defined: false, reason: 'No hay masa corporal medida ni peso de referencia para las sesiones de Knee Iso-Push.' };
  const sl = personalAverage(slPoints), kn = personalAverage(rel.points);
  const slBW = sl.value / G;
  if (!(kn.value > 0)) return { defined: false, reason: 'El Knee Iso-Push relativo es 0: el cociente no existe.' };
  return { defined: true, value: slBW / kn.value, slBW, kneeBW: kn.value, slSessions: sl.sessions, kneeSessions: kn.sessions, omittedKnee: rel.omitted };
}

// EUR = Personal Average del Jump Height del CMJ ÷ Personal Best del Jump Height del Squat Jump (JH imp-mom en ambos; más alto es mejor).
export function eur({ cmjPoints, sjPoints }) {
  if (!cmjPoints.length) return { defined: false, reason: 'Faltan sesiones válidas de CMJ (JH imp-mom).' };
  if (!sjPoints.length) return { defined: false, reason: 'Faltan sesiones válidas de Squat Jump (JH imp-mom).' };
  const a = personalAverage(cmjPoints), b = personalBest(sjPoints, 'higher');
  if (!b.defined || !(b.value > 0)) return { defined: false, reason: 'El Personal Best del Squat Jump es 0 o no existe.' };
  return { defined: true, value: a.value / b.value, cmjPA: a.value, sjPB: b.value, sjPBDate: b.date };
}

// ORZ (D47): la altura (30 o 45 cm) cuyo RSI Personal Average es mayor. Con una sola altura: no se muestra nada. Empate exacto: sin ORZ.
export function orz({ rsi30, rsi45 }) {
  if (!rsi30.length || !rsi45.length) return { defined: false, hidden: true, reason: 'Solo hay una altura de Drop Jump testada (o ninguna): no se muestra la ORZ.' };
  const a = personalAverage(rsi30).value, b = personalAverage(rsi45).value;
  if (a === b) return { defined: false, hidden: false, pa30: a, pa45: b, reason: 'Empate exacto entre 30 y 45 cm: no hay ORZ.' };
  return { defined: true, height: a > b ? 30 : 45, pa30: a, pa45: b };
}

// ---- Localización de tests y variables en el catálogo
// Ratios del Excel del usuario (9/11/2026): Personal Best ÷ Personal Best (el Excel usa el valor máximo). Cadera: aducción 0° ÷ abducción 0° (palanca larga, fuerza absoluta en N,
// valor único). Tobillo: inversión ÷ eversión, por lado. La asimetría del ratio es la de siempre (D25) entre el ratio izquierdo y el derecho.
export function ratioPB(numPoints, denPoints) {
  if (!numPoints.length) return { defined: false, reason: 'Faltan sesiones válidas del test del numerador.' };
  if (!denPoints.length) return { defined: false, reason: 'Faltan sesiones válidas del test del denominador.' };
  const a = personalBest(numPoints, 'higher'), b = personalBest(denPoints, 'higher');
  if (!a.defined || !b.defined || !(b.value > 0)) return { defined: false, reason: 'El Personal Best del denominador es 0 o no existe.' };
  return { defined: true, value: a.value / b.value, num: a.value, den: b.value };
}
const T = { hipAdd: 'Hip Adduction 0° (Long Lever)', hipAbd: 'Hip Abduction 0° (Long Lever)', ankInv: 'Supine Isometric Ankle Inversion', ankEv: 'Supine Isometric Ankle Eversion', cmj: 'CMJ', sj: 'Squat Jump', sl: 'SL CMJ', knee: 'Run-Specific Knee Iso-Push', dj30: 'DL Drop Jump 30 cm', dj45: 'DL Drop Jump 45 cm' };
// Tests en los que aparece cada cuadro de esta familia (el DSI, el EUR, los ratios de tobillo y cadera y la ORZ). Están aquí, junto a la lógica,
// para que la pantalla y el inventario de `usos.js` miren la MISMA lista. Se comparan siempre con `mismoTest`, nunca letra a letra.
export const DSI_TESTS = ['Run-Specific Knee Iso-Push', 'SL CMJ'];
export const EUR_TESTS = ['CMJ', 'Squat Jump'];
export const ANKLE_TESTS = ['supine isometric ankle inversion', 'supine isometric ankle eversion'];
export const HIP_TESTS = ['hip adduction 0° (long lever)', 'hip abduction 0° (long lever)'];
export const DJ_TESTS = ['dl drop jump 30 cm', 'dl drop jump 45 cm'];
// Tests y variables que necesita `locate()`: el inventario de nombres los lee de aquí para comprobarlos contra el catálogo del usuario.
export const TESTS_RELACIONES = [
  [T.cmj, 'JH (imp-mom)'], [T.sj, 'JH (imp-mom)'], [T.sl, 'CONCENTRIC PEAK FORCE / BM'], [T.knee, 'Peak Force'],
  [T.hipAdd, 'Peak Force'], [T.hipAbd, 'Peak Force'], [T.ankInv, 'Peak Force'], [T.ankEv, 'Peak Force'],
  [T.dj30, 'RSI (FLIGHT TIME / CONTACT TIME)'], [T.dj45, 'RSI (FLIGHT TIME / CONTACT TIME)'],
];

export function locate(tests, variables) {
  const find = (testName, varName) => {
    const t = tests.find((x) => mismoTest(x.name, testName));
    const v = t ? variables.find((x) => x.testId === t.id && lc(x.name) === lc(varName) && !x.archived) : null;
    return t && v ? { test: t, variable: v } : null;
  };
  return {
    cmjJh: find(T.cmj, 'JH (imp-mom)'), sjJh: find(T.sj, 'JH (imp-mom)'), slForce: find(T.sl, 'CONCENTRIC PEAK FORCE / BM'), kneeForce: find(T.knee, 'Peak Force'),
    hipAdd: find(T.hipAdd, 'Peak Force'), hipAbd: find(T.hipAbd, 'Peak Force'), ankInv: find(T.ankInv, 'Peak Force'), ankEv: find(T.ankEv, 'Peak Force'),
    rsi30: find(T.dj30, 'RSI (FLIGHT TIME / CONTACT TIME)'), rsi45: find(T.dj45, 'RSI (FLIGHT TIME / CONTACT TIME)'),
  };
}

const pts = (loc, sessions, playerId, side) => (loc ? buildSeries(sessions.filter((s) => s.playerId === playerId && s.testId === loc.test.id), loc.variable.id, side).valid : []);

// Todos los ratios de un jugador (toda la historia).
export function relationsFor({ loc, sessions, anthropometry, playerId }) {
  const an = anthropometry.filter((a) => a.playerId === playerId);
  const dsi = {};
  for (const side of ['L', 'R']) dsi[side] = dsiSide({ slPoints: pts(loc.slForce, sessions, playerId, side), kneePoints: pts(loc.kneeForce, sessions, playerId, side), anthropometry: an });
  // Knee Iso-Push Peak Force relativo (BW), Personal Average por lado: sirve para matizar la orientación de fuerza (percentil de fuerza máxima).
  const knee = {};
  for (const side of ['L', 'R']) {
    const kp = pts(loc.kneeForce, sessions, playerId, side);
    const rel = kp.length ? relativeBWPoints(kp, an) : { points: [] };
    knee[side] = rel.points.length ? { defined: true, value: personalAverage(rel.points).value } : { defined: false };
  }
  const ankle = {};
  for (const side of ['L', 'R']) ankle[side] = ratioPB(pts(loc.ankInv, sessions, playerId, side), pts(loc.ankEv, sessions, playerId, side));
  const ankleAsym = ankle.L.defined && ankle.R.defined ? asymmetryPct(ankle.L.value, ankle.R.value) : null;
  return {
    dsi, knee, ankle, ankleAsym, hip: ratioPB(pts(loc.hipAdd, sessions, playerId, 'S'), pts(loc.hipAbd, sessions, playerId, 'S')),
    eur: eur({ cmjPoints: pts(loc.cmjJh, sessions, playerId, 'S'), sjPoints: pts(loc.sjJh, sessions, playerId, 'S') }),
    orz: orz({ rsi30: pts(loc.rsi30, sessions, playerId, 'S'), rsi45: pts(loc.rsi45, sessions, playerId, 'S') }),
  };
}

// Percentil estadístico frente a «La Liga» (sin sintéticos, sin el propio jugador, mínimo N). El color solo indica la posición en la distribución, no «mejor/peor».
export function ratioReferences({ loc, sessions, anthropometry, players, playerId, minN = MIN_N_DEFAULT, includeSynthetic = false }) {
  const ids = Object.keys(players).map(Number).filter((id) => includeSynthetic || !players[id].synthetic);
  const entries = { dsi: [], knee: [], eur: [], hip: [], ankle: [] }; // DSI y Knee: un único conjunto con ambos lados (un P50 para las dos piernas; cada pierna se compara con el total)
  for (const id of ids) {
    if (id === playerId) continue;
    const r = relationsFor({ loc, sessions, anthropometry, playerId: id });
    for (const k of ['L', 'R']) {
      if (r.dsi[k].defined) entries.dsi.push({ playerId: id, value: r.dsi[k].value });
      if (r.knee[k].defined) entries.knee.push({ playerId: id, value: r.knee[k].value });
    }
    if (r.eur.defined) entries.eur.push({ playerId: id, value: r.eur.value });
    if (r.hip.defined) entries.hip.push({ playerId: id, value: r.hip.value });
    for (const k of ['L', 'R']) if (r.ankle[k].defined) entries.ankle.push({ playerId: id, value: r.ankle[k].value });
  }
  const mine = relationsFor({ loc, sessions, anthropometry, playerId });
  // direction 'higher': solo para colocar el percentil en las seis bandas de color (posición en la distribución). DSI y EUR no tienen sentido «mejor/peor».
  const ev = (e, v) => (v.defined ? evaluate(e, { playerId, value: v.value, direction: 'higher', minN }) : null);
  return { mine, dsiL: ev(entries.dsi, mine.dsi.L), dsiR: ev(entries.dsi, mine.dsi.R), eur: ev(entries.eur, mine.eur), kneeL: ev(entries.knee, mine.knee.L), kneeR: ev(entries.knee, mine.knee.R),
    // ratios de cadera y tobillo: sin dirección de rendimiento → color de posición (no «mejor/peor»); tobillo con las dos piernas juntas
    hip: mine.hip.defined ? evaluate(entries.hip, { playerId, value: mine.hip.value, direction: null, minN }) : null,
    ankleL: mine.ankle.L.defined ? evaluate(entries.ankle, { playerId, value: mine.ankle.L.value, direction: null, minN }) : null,
    ankleR: mine.ankle.R.defined ? evaluate(entries.ankle, { playerId, value: mine.ankle.R.value, direction: null, minN }) : null };
}

// ---- Cuadrantes (9/11/2026): uno para el DSI y otro para el EUR, cada uno con sus dos componentes como ejes.
//  DSI: x = Knee Iso-Push Peak Force (BW), y = SL CMJ Peak Force (BW), un punto por lado.
//  EUR: x = Squat Jump (JH imp-mom, Personal Best, cm), y = CMJ (JH imp-mom, Personal Average, cm), un punto por jugador.
// Cortes = mediana de La Liga de cada eje (sin sintéticos ni el propio jugador; DSI con las dos piernas juntas; mínimo N). Sin zona neutra.
const finiteN = (x) => typeof x === 'number' && Number.isFinite(x);
export function componentQuadrants({ loc, sessions, anthropometry, players, playerId, minN = MIN_N_DEFAULT, includeSynthetic = false }) {
  const ids = Object.keys(players).map(Number).filter((id) => includeSynthetic || !players[id].synthetic);
  const pointsOf = (id) => {
    const r = relationsFor({ loc, sessions, anthropometry, playerId: id });
    return {
      dsi: ['L', 'R'].filter((k) => r.dsi[k].defined).map((k) => ({ side: k, x: r.dsi[k].kneeBW, y: r.dsi[k].slBW })),
      eur: r.eur.defined ? { x: r.eur.sjPB, y: r.eur.cmjPA } : null,
    };
  };
  const mine = pointsOf(playerId);
  const others = ids.filter((id) => id !== playerId).map(pointsOf);
  const dsiBg = others.flatMap((o) => o.dsi), eurBg = others.map((o) => o.eur).filter(Boolean);
  const cut = (pts, axis, n) => (n >= minN ? median(pts.map((p) => p[axis])) : null);
  const nDsi = others.filter((o) => o.dsi.length).length;
  return {
    mine, minN,
    dsi: { bg: dsiBg, n: nDsi, cutX: cut(dsiBg, 'x', nDsi), cutY: cut(dsiBg, 'y', nDsi) },
    eur: { bg: eurBg, n: eurBg.length, cutX: cut(eurBg, 'x', eurBg.length), cutY: cut(eurBg, 'y', eurBg.length) },
  };
}
// Posición respecto a los cortes (igual al corte cuenta como «por encima»; no hay zona neutra).
export function quadrantSide(point, cutX, cutY) {
  if (!point || !finiteN(point.x) || !finiteN(point.y) || !finiteN(cutX) || !finiteN(cutY)) return null;
  return { xHigh: point.x >= cutX, yHigh: point.y >= cutY };
}

// ---- Orientación del entrenamiento de fuerza (9/11/2026), según el percentil del DSI o del EUR frente a La Liga.
// Cortes de percentil elegidos por el usuario (0–40 / 40–60 / 60–100); no son umbrales de la bibliografía.
// Si el percentil de fuerza máxima (Knee Iso-Push Peak Force, BW) está por debajo de 40, se avisa en los casos señalados por el usuario
// (DSI en la banda baja y EUR en la banda alta), porque la orientación puede variar; no se decide aquí cuál sería.
export const ORIENTATION_CUTS = [40, 60];
const ORIENT = {
  dsi: ['Ballistic strength training orientation', 'Concurrent strength training', 'Maximal strength training orientation'],
  eur: ['Plyometric strength training orientation', 'Concurrent strength training', 'Maximal strength training orientation'],
};
// Umbral del Knee Iso-Push por debajo del cual la orientación del DSI deja de depender del ratio (14/11/2026, decisión del usuario).
export const KNEE_ISO_CUT = 35;
export const ORIENT_ISO_MAX = 'Iso max strength training orientation';

export function strengthOrientation(kind, ev, kneeEvs = [], cut = KNEE_ISO_CUT) {
  if (!ev) return null;
  // Con el Knee Iso-Push por debajo del percentil 35 de La Liga, la orientación del DSI es SIEMPRE entrenar fuerza isométrica máxima, sea cual sea
  // el ratio: el usuario la considera una cualidad de base previa al trabajo de ciclo estiramiento-acortamiento. Vale en todos los sitios donde
  // aparece el DSI, porque la decisión está aquí y no en cada pantalla.
  if (kind === 'dsi') {
    const pct = (k) => (k?.ev?.sufficient ? k.ev.percentilePerf ?? k.ev.percentileStat ?? null : null);
    const conocidos = kneeEvs.filter((k) => pct(k) !== null);
    if (conocidos.length && conocidos.every((k) => pct(k) < cut)) {
      return { text: ORIENT_ISO_MAX, band: null, forzadaPorKnee: true, kneeNote: `Knee Iso-Push por debajo del percentil ${cut} de La Liga (${conocidos.map((k) => `${k.label} ${Math.round(pct(k))}`).join(', ')}): fuerza isométrica máxima primero, sea cual sea el DSI.` };
    }
  }
  if (!ev.sufficient || ev.percentileStat === null) return { text: null, reason: 'Sin orientación: muestra insuficiente en La Liga.' };
  const p = ev.percentileStat;
  const band = p < ORIENTATION_CUTS[0] ? 0 : p <= ORIENTATION_CUTS[1] ? 1 : 2;
  const out = { text: ORIENT[kind][band], band, kneeNote: null };
  const sensitive = (kind === 'dsi' && band === 0) || (kind === 'eur' && band === 2);
  if (sensitive) {
    const known = kneeEvs.filter((k) => k.ev && k.ev.sufficient && k.ev.percentileStat !== null);
    const low = known.filter((k) => k.ev.percentileStat < 40);
    if (low.length) out.kneeNote = `Percentil de Knee Iso-Push Peak Force (BW) por debajo de 40 (${low.map((k) => `${k.label} ${Math.round(k.ev.percentileStat)}`).join(', ')}): la orientación puede variar.`;
    else if (!known.length) out.kneeNote = 'No se ha podido comprobar el percentil de Knee Iso-Push Peak Force (BW): si está por debajo de 40, la orientación puede variar.';
  }
  return out;
}
