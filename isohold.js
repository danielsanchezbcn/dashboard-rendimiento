// isohold.js — D5 (decidida el 6 y 8/11/2026): variables CALCULADAS del Iso-Hold (MVIC iso-push, %PIMA, %BW/%SW) y del 1RM estimado de 12RM.
// Lógica pura, calculada al vuelo y sin guardar. Pareja Iso-Hold → Iso-Push confirmada por el usuario (D34 y 8/11/2026).
// Masa: siempre la masa corporal medida más cercana (antes o después), o el peso de referencia del jugador (relaciones.js).
import { G, massNearest } from './relaciones.js';
import { normTestName, mismoTest } from './nombres.js';
import { SW_FACTOR_DEFAULT } from './catalogo.js';
import { repsOf } from './evolucion.js';
import { audit } from './db.js';
import { isIsoDay } from './fechas.js';

export const ISO_PAIRS = {
  'Hip Iso-Hold 20 s': 'Run-Specific Hip Iso-Push',
  'Knee Iso-Hold 20 s': 'Run-Specific Knee Iso-Push',
  'Ankle Iso-Hold 20 s': 'Run-Specific Ankle Iso-Push',
  'Seated Calf Raise Iso-Hold 20 s': 'Seated Calf Raise Iso-Push',
};
// Búsqueda de la pareja por nombre, tolerante a cómo esté escrito el test en el catálogo de cada base: no distingue mayúsculas, espacios sobrantes ni
// el prefijo «Run-Specific», que algunos Iso-Hold llevan delante («Run-Specific Hip Iso-Hold 20 s» es el mismo test que «Hip Iso-Hold 20 s»; la migración
// trata así el duplicado del Ankle). Estos nombres NO entran en ISO_PAIRS: esa lista también define qué tests crea el catálogo inicial, y un nombre sin
// test dejaría variables huérfanas. Sin esto, un Iso-Hold renombrado se quedaba sin MVIC iso-push ni %PIMA (aviso del 11/11/2026).
export const normIsoName = normTestName;
const PAIRS_LC = Object.fromEntries(Object.entries(ISO_PAIRS).map(([k, v]) => [normIsoName(k), v]));
export const pairNameOf = (name) => PAIRS_LC[normIsoName(name)] ?? null;
// Tests con 1RM estimado y sus parámetros: (carga + massFactor × masa corporal) × factor. `massFactor` es la parte de la masa corporal que mueve el
// ejercicio: 1 de pie (levantas todo el cuerpo) y 0,05 sentado, donde el peso del tronco descansa en el asiento (criterio del usuario, 25/11/2026).
// Los dos factores y el 0,05 los ha fijado el usuario; no proceden de una fuente aportada.
export const RM_EST_TESTS = [
  { test: 'Single-Leg Standing Calf Raise 12RM', factor: 1.4, massFactor: 1, nota: '(carga + masa corporal) × 1,4. Estimado, no medido. 1,4 coincide con Epley a 12 repeticiones (inferencia no verificada con fuente).' },
  { test: 'Single-Leg Seated Calf Raise 6RM', factor: 1.2, massFactor: 0.05, nota: '(carga + 5 % de la masa corporal) × 1,2. Estimado, no medido. Sentado, el tronco descansa en el asiento: solo una parte pequeña de la masa corporal participa (criterio del usuario del 25/11/2026).' },
];
export const RM_EST_FACTOR_DEFAULT = 1.4; // coincide con Epley a 12 repeticiones (1 + 12/30); es una inferencia, no una fuente aportada
// Tests en los que la carga de UNA pierna se aplica a las dos (25/11/2026, petición del usuario): se cargan igual en los dos lados, así que aportar un
// solo lado significa «lo mismo en el otro». Solo se copia cuando falta el otro lado; si se aportan los dos, se respetan tal cual.
export const RM_MISMA_CARGA = ['Single-Leg Standing Calf Raise 12RM', 'Single-Leg Seated Calf Raise 6RM'];
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
  const pairName = pairNameOf(test.name);
  const pairTest = ctx?.tests?.find((t) => mismoTest(t.name, pairName));
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
// 24/11/2026: la carga de los RM puede ir por pierna, así que el estimado sigue a la carga y se calcula para cada lado que tenga dato.
export function rmEstimate(v, session, anthropometry) {
  const src = session.values?.[v.formula.operands[0]] ?? {};
  const lados = ['L', 'R', 'S'].filter((k) => finite(src[k]));
  if (!lados.length) return undefined;
  const m = massNearest(anthropometry.filter((a) => a.playerId === session.playerId), session.date);
  const f = Number(v.formula.params?.factor ?? RM_EST_FACTOR_DEFAULT);
  const fm = Number(v.formula.params?.massFactor ?? 1); // parte de la masa corporal que participa: 1 de pie, 0,05 sentado
  if (!m || !(f > 0) || !(fm >= 0)) return null;
  return Object.fromEntries(lados.map((k) => [k, (src[k] + fm * m.kg) * f]));
}

// Contexto para calcular las variables del Iso-Hold de un test: los tests del catálogo y las sesiones del Iso-Push emparejado (si el test es un Iso-Hold).
export async function pairContext(db, tests, test) {
  const pairName = pairNameOf(test.name);
  const pair = pairName ? tests.find((t) => mismoTest(t.name, pairName)) : null;
  return { tests, allSessions: pair ? await db.sessions.where('testId').equals(pair.id).toArray() : [] };
}

// Carga 0 = sin carga añadida (solo el peso corporal): es un dato válido, igual que en los Excel del usuario.
// Alta manual de la carga (D5, mejora del 8/11/2026): crea UNA sesión con la variable de carga del test (Carga externa o Carga máxima).
// Sin repeticiones ni protocolo; origen «manual». Rechaza duplicados exactos de jugador, test, fecha y hora.
export const LOAD_VARIABLE_NAMES = ['Carga externa (kg)', 'Carga máxima (kg)'];
// Tests cuya medida es una CARGA EXTERNA que introduce el usuario: los iso-hold y todos los RM. Se reconocen por su estructura —tienen una variable de
// carga medida—, no por una lista de nombres, así que cualquier test de carga que se añada en el futuro entra solo. En «Déficits» de estos tests solo se
// lista el %BW (petición del usuario, 25/11/2026): los kilos no se pueden comparar entre jugadores de distinto tamaño, y el MVIC iso-push, el %PIMA y el
// 1RM estimado salen de esa misma carga, de modo que repetirían el mismo déficit con otro nombre.
export const LOAD_BW_OPS = ['LOAD_BW', 'ISO_LOAD_BW'];
export const esPorcentajeBW = (v) => v?.kind === 'derived' && LOAD_BW_OPS.includes(v?.formula?.op);
export const esTestDeCarga = (testId, variables) => variables.some((v) => v.testId === testId && !v.archived && v.kind !== 'derived' && LOAD_VARIABLE_NAMES.includes(v.name));
// 23/11/2026: hay tests cuya carga se registra POR PIERNA (Single-Leg Leg Press 45° 8RM). Si la variable de carga del test es de dos lados, se guardan
// `loadL` y `loadR` (basta con uno); si es de valor único, se sigue guardando `load` como siempre. Así la asimetría sale sola, sin pedirla aparte.
export async function addManualLoad(db, { playerId, testId, date, time = '', load, loadL, loadR }) {
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
  const kilos = (raw) => {
    const txt = String(raw ?? '').trim();
    if (txt === '') return null;
    const n = typeof raw === 'number' ? raw : Number(txt.replace(',', '.'));
    if (!Number.isFinite(n) || n < 0 || n > 1000) throw new Error('La carga debe ser un número entre 0 y 1000 kg (0 = sin carga añadida).');
    return n;
  };
  const porPierna = v.sides === 'LR';
  let valores;
  if (porPierna) {
    const l = kilos(loadL), r = kilos(loadR);
    if (l === null && r === null) throw new Error('Escribe la carga de al menos una pierna (izquierda o derecha).');
    valores = { ...(l === null ? {} : { L: l }), ...(r === null ? {} : { R: r }) };
    // En los tests que se cargan igual en las dos piernas, aportar un solo lado significa «lo mismo en el otro» (25/11/2026).
    if (RM_MISMA_CARGA.some((n) => mismoTest(n, test.name)) && (l === null || r === null)) { const u = l === null ? r : l; valores = { L: u, R: u }; }
  } else {
    const x = kilos(load);
    if (x === null) throw new Error('La carga debe ser un número entre 0 y 1000 kg (0 = sin carga añadida).');
    valores = { S: x };
  }
  const clash = (await db.sessions.where('playerId').equals(playerId).toArray()).find((s) => s.testId === testId && s.date === d && (s.time ?? '') === t);
  if (clash) throw new Error('Ya hay una sesión de ese jugador y test en esa fecha y hora. Corrígela desde su tabla de sesiones.');
  const id = await db.sessions.add({ playerId, testId, protocolId: null, date: d, time: t, values: { [v.id]: valores }, reps: {}, status: 'valid', excludedReason: '', source: 'manual', createdAt: new Date().toISOString(), ...(player.synthetic ? { synthetic: 1 } : {}) });
  await audit(db, 'sesion-alta-manual', { sessionId: id, playerId, testId, date: d });
  return id;
}
