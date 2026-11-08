// relaciones.js — fase 6: ratios DSI y EUR y Optimal Reactive Zone (ORZ) del Drop Jump (D38, D39, D47).
// Lógica pura (sin IndexedDB): recibe los datos ya leídos. Ventana: TODA la historia siempre (el filtro de pantalla no cambia estos ratios).
// Los ratios son orientativos y no tienen unidad. No se inventa nada: sin datos suficientes devuelven «no definido» con el motivo.

import { buildSeries, personalAverage, personalBest } from './evolucion.js';
import { evaluate, MIN_N_DEFAULT } from './percentiles.js';
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
// Añade a las mediciones el peso de referencia de cada jugador (campo referenceWeight del jugador) como registro sin fecha.
export function withReferenceWeights(anthropometry, players) {
  return anthropometry.concat(players.filter((p) => p.referenceWeight && toKg(p.referenceWeight) !== null).map((p) => ({ playerId: p.id, date: null, bodyMass: p.referenceWeight, reference: true })));
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
const T = { cmj: 'CMJ', sj: 'Squat Jump', sl: 'SL CMJ', knee: 'Run-Specific Knee Iso-Push', dj30: 'DL Drop Jump 30 cm', dj45: 'DL Drop Jump 45 cm' };
export function locate(tests, variables) {
  const find = (testName, varName) => {
    const t = tests.find((x) => lc(x.name) === lc(testName));
    const v = t ? variables.find((x) => x.testId === t.id && lc(x.name) === lc(varName) && !x.archived) : null;
    return t && v ? { test: t, variable: v } : null;
  };
  return {
    cmjJh: find(T.cmj, 'JH (imp-mom)'), sjJh: find(T.sj, 'JH (imp-mom)'), slForce: find(T.sl, 'CONCENTRIC PEAK FORCE / BM'), kneeForce: find(T.knee, 'Peak Force'),
    rsi30: find(T.dj30, 'RSI (FLIGHT TIME / CONTACT TIME)'), rsi45: find(T.dj45, 'RSI (FLIGHT TIME / CONTACT TIME)'),
  };
}

const pts = (loc, sessions, playerId, side) => (loc ? buildSeries(sessions.filter((s) => s.playerId === playerId && s.testId === loc.test.id), loc.variable.id, side).valid : []);

// Todos los ratios de un jugador (toda la historia).
export function relationsFor({ loc, sessions, anthropometry, playerId }) {
  const an = anthropometry.filter((a) => a.playerId === playerId);
  const dsi = {};
  for (const side of ['L', 'R']) dsi[side] = dsiSide({ slPoints: pts(loc.slForce, sessions, playerId, side), kneePoints: pts(loc.kneeForce, sessions, playerId, side), anthropometry: an });
  return {
    dsi,
    eur: eur({ cmjPoints: pts(loc.cmjJh, sessions, playerId, 'S'), sjPoints: pts(loc.sjJh, sessions, playerId, 'S') }),
    orz: orz({ rsi30: pts(loc.rsi30, sessions, playerId, 'S'), rsi45: pts(loc.rsi45, sessions, playerId, 'S') }),
  };
}

// Percentil estadístico frente a «La Liga» (sin sintéticos, sin el propio jugador, mínimo N). Sin dirección: sin color (uso orientativo).
export function ratioReferences({ loc, sessions, anthropometry, players, playerId, minN = MIN_N_DEFAULT, includeSynthetic = false }) {
  const ids = Object.keys(players).map(Number).filter((id) => includeSynthetic || !players[id].synthetic);
  const entries = { L: [], R: [], eur: [] };
  for (const id of ids) {
    if (id === playerId) continue;
    const r = relationsFor({ loc, sessions, anthropometry, playerId: id });
    if (r.dsi.L.defined) entries.L.push({ playerId: id, value: r.dsi.L.value });
    if (r.dsi.R.defined) entries.R.push({ playerId: id, value: r.dsi.R.value });
    if (r.eur.defined) entries.eur.push({ playerId: id, value: r.eur.value });
  }
  const mine = relationsFor({ loc, sessions, anthropometry, playerId });
  const ev = (e, v) => (v.defined ? evaluate(e, { playerId, value: v.value, direction: null, minN }) : null);
  return { mine, dsiL: ev(entries.L, mine.dsi.L), dsiR: ev(entries.R, mine.dsi.R), eur: ev(entries.eur, mine.eur) };
}
