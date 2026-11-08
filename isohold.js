// isohold.js — D5 (decidida el 6 y 8/11/2026): variables CALCULADAS del Iso-Hold (MVIC iso-push, %PIMA, %BW/%SW) y del 1RM estimado de 12RM.
// Lógica pura, calculada al vuelo y sin guardar. Pareja Iso-Hold → Iso-Push confirmada por el usuario (D34 y 8/11/2026).
// Masa: siempre la masa corporal medida más cercana (antes o después), o el peso de referencia del jugador (relaciones.js).
import { G, massNearest } from './relaciones.js';
import { SW_FACTOR_DEFAULT } from './catalogo.js';
import { repsOf } from './evolucion.js';
import { audit } from './db.js';
import { isIsoDay } from './fechas.js';

export const ISO_PAIRS = {
  'Hip Iso-Hold 20 s': 'Run-Specific Hip Iso-Push',
  'Knee Iso-Hold 20 s': 'Run-Specific Knee Iso-Push',
  'Ankle Iso-Hold 20 s': 'Run-Specific Ankle Iso-Push',
  'Single-Leg Seated Calf Raise Iso-Hold 20 s': 'Single-Leg Seated Calf Raise',
};
export const RM12_TESTS = ['Single-Leg Standing Calf Raise 12RM'];
export const RM_EST_FACTOR_DEFAULT = 1.4; // coincide con Epley a 12 repeticiones (1 + 12/30); es una inferencia, no una fuente aportada
export const ISO_OPS = ['ISO_MVIC', 'ISO_PIMA', 'ISO_LOAD_BW', 'ISO_LOAD_SW', 'RM_EST'];
export const isIsoDerived = (v) => v?.kind === 'derived' && ISO_OPS.includes(v.formula?.op) && v.formula.operands?.length === 1;
const lc = (s) => String(s ?? '').trim().toLowerCase();
const finite = (x) => typeof x === 'number' && Number.isFinite(x);

// Factor de «peso del sistema» del Iso-Push emparejado, tomado de SU variable relativa del catálogo (1 = BW; en SW el factor de la fórmula).
export function pairFactor(pairVars) {
  const rel = pairVars.find((x) => x.kind === 'derived' && ['REL_BW', 'REL_SW'].includes(x.formula?.op));
  if (!rel) return { factor: 1, unitName: 'BW' };
  return rel.formula.op === 'REL_SW' ? { factor: Number(rel.formula.params?.factor ?? SW_FACTOR_DEFAULT), unitName: 'SW' } : { factor: 1, unitName: 'BW' };
}

// MVIC iso-push (kg) de un jugador = media, ponderada por repeticiones y de ambos lados, de (fuerza − factor × masa de CADA sesión de Iso-Push × g) ÷ g.
// Usa todas las sesiones válidas (Personal Average de todo el periodo). Sin masa en una sesión: se omite y se cuenta.
export function mvicKg({ pushSessions, peakVarId, factor, anthropometry }) {
  let num = 0, den = 0, omitted = 0, used = 0;
  for (const s of pushSessions) {
    if (s.status === 'excluded') continue;
    const vals = s.values?.[peakVarId];
    if (!vals) continue;
    const m = massNearest(anthropometry, s.date);
    if (!m) { omitted++; continue; }
    for (const side of ['L', 'R']) {
      if (!finite(vals[side])) continue;
      const w = repsOf(s, side) ?? 1;
      num += w * (vals[side] / G - factor * m.kg);
      den += w;
    }
    used++;
  }
  return den > 0 ? { kg: num / den, sessions: used, omitted } : { kg: null, sessions: 0, omitted };
}

// Devuelve, por sesión, los valores calculados {[variableId]: {S}} y los avisos.
export function isoHoldValues({ variables, test, sessions, ctx, anthropometry, today }) {
  const ops = variables.filter((v) => v.testId === test.id && isIsoDerived(v) && v.formula.op !== 'RM_EST');
  if (!ops.length) return null;
  const pairName = ISO_PAIRS[test.name];
  const pairTest = ctx?.tests?.find((t) => lc(t.name) === lc(pairName));
  const pairVars = pairTest ? variables.filter((v) => v.testId === pairTest.id) : [];
  const peak = pairVars.find((v) => v.kind === 'raw' && lc(v.name) === 'peak force');
  const { factor } = pairFactor(pairVars);
  const byPlayer = {};
  const out = { values: new Map(), omitted: Object.fromEntries(ops.map((v) => [v.id, 0])), noPair: !pairTest || !peak };
  for (const s of sessions) {
    const loadId = ops[0].formula.operands[0];
    const load = s.values?.[loadId]?.S;
    if (!finite(load)) continue;
    const an = anthropometry.filter((a) => a.playerId === s.playerId);
    byPlayer[s.playerId] ??= out.noPair ? { kg: null } : mvicKg({ pushSessions: (ctx.allSessions ?? []).filter((x) => x.playerId === s.playerId && x.testId === pairTest.id), peakVarId: peak.id, factor, anthropometry: an });
    const mvic = byPlayer[s.playerId].kg;
    const nowMass = massNearest(an, today);
    const vals = {};
    for (const v of ops) {
      let x = null;
      if (v.formula.op === 'ISO_MVIC') x = mvic;
      else if (v.formula.op === 'ISO_PIMA') x = mvic > 0 ? (load / mvic) * 100 : null;
      else if (v.formula.op === 'ISO_LOAD_BW') x = nowMass ? (load / nowMass.kg) * 100 : null;
      else if (v.formula.op === 'ISO_LOAD_SW') { const f = Number(v.formula.params?.factor ?? factor); x = nowMass && f > 0 ? (load / (f * nowMass.kg)) * 100 : null; }
      if (finite(x)) vals[v.id] = { S: x }; else out.omitted[v.id]++;
    }
    out.values.set(s.id, vals);
  }
  return out;
}

// 1RM estimado (kg) = (carga + masa) × factor, solo en 12RM. Masa: la medida más cercana a la fecha de la sesión (o el peso de referencia).
export function rmEstimate(v, session, anthropometry) {
  const load = session.values?.[v.formula.operands[0]]?.S;
  if (!finite(load)) return undefined;
  const m = massNearest(anthropometry.filter((a) => a.playerId === session.playerId), session.date);
  const f = Number(v.formula.params?.factor ?? RM_EST_FACTOR_DEFAULT);
  return m && f > 0 ? { S: (load + m.kg) * f } : null;
}

// Contexto para calcular las variables del Iso-Hold de un test: los tests del catálogo y las sesiones del Iso-Push emparejado (si el test es un Iso-Hold).
export async function pairContext(db, tests, test) {
  const pairName = ISO_PAIRS[test.name];
  const pair = pairName ? tests.find((t) => lc(t.name) === lc(pairName)) : null;
  return { tests, allSessions: pair ? await db.sessions.where('testId').equals(pair.id).toArray() : [] };
}

// Alta manual de la carga (D5, mejora del 8/11/2026): crea UNA sesión con la variable de carga del test (Carga externa o Carga máxima).
// Sin repeticiones ni protocolo; origen «manual». Rechaza duplicados exactos de jugador, test, fecha y hora.
export const LOAD_VARIABLE_NAMES = ['Carga externa (kg)', 'Carga máxima (kg)'];
export async function addManualLoad(db, { playerId, testId, date, time = '', load }) {
  const player = await db.players.get(playerId);
  if (!player) throw new Error('Elige un jugador.');
  const test = await db.tests.get(testId);
  if (!test) throw new Error('Elige un test.');
  const vars = await db.variables.where('testId').equals(testId).toArray();
  const v = vars.find((x) => !x.archived && x.kind !== 'derived' && LOAD_VARIABLE_NAMES.some((n) => lc(n) === lc(x.name)));
  if (!v) throw new Error('Este test no tiene una variable de carga que se introduzca a mano.');
  const d = String(date ?? '').trim(); const t = String(time ?? '').trim();
  if (!isIsoDay(d)) throw new Error('La fecha no es válida (AAAA-MM-DD).');
  if (t && !/^([01]\d|2[0-3]):[0-5]\d$/.test(t)) throw new Error('La hora no es válida (HH:MM).');
  const x = typeof load === 'number' ? load : Number(String(load ?? '').trim().replace(',', '.'));
  if (!Number.isFinite(x) || x <= 0 || x > 1000) throw new Error('La carga debe ser un número entre 0 y 1000 kg.');
  const clash = (await db.sessions.where('playerId').equals(playerId).toArray()).find((s) => s.testId === testId && s.date === d && (s.time ?? '') === t);
  if (clash) throw new Error('Ya hay una sesión de ese jugador y test en esa fecha y hora. Corrígela desde su tabla de sesiones.');
  const id = await db.sessions.add({ playerId, testId, protocolId: null, date: d, time: t, values: { [v.id]: { S: x } }, reps: {}, status: 'valid', excludedReason: '', source: 'manual', createdAt: new Date().toISOString(), ...(player.synthetic ? { synthetic: 1 } : {}) });
  await audit(db, 'sesion-alta-manual', { sessionId: id, playerId, testId, date: d });
  return id;
}
