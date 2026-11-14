// composite.js — bloque «COMPOSITE PROFILE SCORE» (encargo del usuario, especificación v0.3 del 13/11/2026): lógica pura, sin DOM ni base de datos.
// Define las 7 cualidades, sus variables de puntuación (con peso), sus interpretativas, sus textos de orientación y cómo se puntúa.
// Todo se apoya en el PERCENTIL DE LA LIGA que ya calcula el dashboard (misma función que Normative Benchmarking y Déficits): aquí no se
// vuelve a decidir cómo se calcula un percentil, solo cómo se combinan. La capa de pantalla (pages-composite.js) resuelve cada descriptor
// en una medida {pct, value, unit, date, …} y esta la combina; así se puede probar con datos sintéticos sin navegador.
import { massNearest } from './relaciones.js';

// Nombres de los tests y variables tal como están en el catálogo.
export const T = { cmj: 'CMJ', knee: 'Run-Specific Knee Iso-Push', hop: 'Double-Leg Hop Test', dj30: 'DL Drop Jump 30 cm', dj45: 'DL Drop Jump 45 cm' };
export const V = {
  jh: 'JH (imp-mom)', cpp: 'CON PEAK POWER/BM', conImp: 'CON IMPULSE', conImp100: 'CON IMPULSE 100ms', eccImp: 'ECC DECELERATION IMPULSE',
  eccPp: 'ECC PEAK POWER/BM', eccRfd: 'ECC DECEL RFD', rsiMod: 'RSI MOD', stiff: 'COM STIFFNESS', ct: 'CONTRACTION TIME', depth: 'DEPTH',
  f0: 'FORCE AT 0 VELOCITY', kneeRel: 'Peak Force relativo (BW)',
  djRsi: 'RSI (FLIGHT TIME / CONTACT TIME)', djCt: 'CONTACT TIME', djJh: 'JUMP HEIGHT (Flight Time - cm)',
  hopRsi: 'MEAN RSI (FLIGHT TIME / CONTACT TIME)', hopCt: 'MEAN CONTACT TIME', hopJh: 'MEAN JUMP HEIGHT (Flight Time) (cm)',
};

// Impulsos relativizados a la masa corporal (3.3): VALD los da en N·s absolutos y aquí se usan en N·s/kg, también en la referencia de La Liga.
// Son variables VIRTUALES: se calculan al vuelo con un id negativo y no se guardan en el catálogo, así que no cambian ningún otro bloque.
export const IMPULSOS_REL = [
  { id: -101, src: V.conImp, name: 'CON IMPULSE/BM', unit: 'N s/kg' },
  { id: -102, src: V.conImp100, name: 'CON IMPULSE 100ms/BM', unit: 'N s/kg' },
  { id: -103, src: V.eccImp, name: 'ECC DECELERATION IMPULSE/BM', unit: 'N s/kg' },
];

// Umbrales de los textos de orientación, editables en Ajustes.
// 14/11/2026 (tarde): el usuario corrige los umbrales de DEPTH y de CONTRACTION TIME. DEPTH usa ahora la banda alta (90–100) y la baja (0–35),
// coherente con que DEPTH pase a «más alto es mejor»; CONTRACTION TIME usa 65–100 y 0–35. El antiguo p10 deja de usarse.
export const UMBRALES_DEFAULT = { p35: 35, p65: 65, p90: 90 };

const m = (test, variable, extra = {}) => ({ test, variable, ...extra });
const relCmj = (name) => ({ test: T.cmj, variable: name, rel: true });
const orzM = (variable) => ({ orz: true, variable });

// ---- Textos de orientación (especificación del usuario del 14/11/2026). Cada uno se evalúa sobre el percentil de su propia medida, salvo los que
// comparan dos variables («tendencia») o miran la puntuación de otra cualidad. Sustituyen al antiguo «No aplicable»: ahora las 7 cualidades
// puntúan siempre que haya datos, y el texto dice qué hacer con ese número.
const o = (op, u, texto) => ({ op, u, texto });
// Los umbrales que el usuario da como BANDA («percentil 90-100», «0-35») incluyen el extremo: por eso llevan «>=» y «<=».
export const cumple = (op, valor, lim) => (op === '<' ? valor < lim : op === '<=' ? valor <= lim : op === '>=' ? valor >= lim : valor > lim);
const TEND_PROP = 'Propulsive tendency';
const TEND_EXPL = 'Explosive tendency';
// DEPTH (más alto es mejor: percentil alto = baja poco). 90-100 → hay que ganar profundidad; 0-35 (baja mucho) → estrategia propulsiva.
const DEPTH_ORI = [o('>=', 'p90', 'Prioritize increase depth'), o('<=', 'p35', 'Propulsive strategy')];
// CONTRACTION TIME (más bajo es mejor: percentil alto = tiempo corto). 65-100 → «Snappy»; 0-35 → hay que acortarlo.
const CT_ORI = [o('>=', 'p65', 'Snappy'), o('<=', 'p35', 'Prioritize decrease contraction time')];
const JH_ORI = [o('<', 'p35', 'Prioritize foundational dynamic strength'), o('>', 'p35', 'Acceptable output')];

// ---- Las 7 cualidades, en el orden pedido. `critico`: si esa variable no tiene dato, la cualidad entera sale «—» (3.8).
// `interp` dentro de un score son las interpretativas que van debajo de ese score en el desglose; las de la cualidad van al final.
export const CUALIDADES = [
  {
    id: 'isometric', nombre: 'Isometric Strength',
    scores: [{ ...m(T.knee, V.kneeRel), peso: 1, critico: true, orient: [o('<', 'p35', 'Prioritize max isometric strength')] }],
    interp: [{ tipo: 'dsi' }, { ...m(T.cmj, V.f0), orient: [o('<', 'p35', 'Prioritize LML isometric strength')] }],
    orientCualidad: [],
  },
  {
    id: 'dynamic', nombre: 'Dynamic Strength',
    scores: [
      { ...m(T.cmj, V.jh), peso: 0.6, critico: true },
      { ...m(T.cmj, V.cpp), peso: 0.2 },
      { ...relCmj(V.conImp), peso: 0.2 },
    ],
    interp: [{ ...m(T.cmj, V.depth), orient: DEPTH_ORI }, { tipo: 'fv' }],
    orientCualidad: [o('>', 'p65', 'Prioritize Power'), o('<', 'p35', 'Prioritize Strength')],
  },
  {
    id: 'shortgct', nombre: 'Short GCT Reactive Strength',
    scores: [
      { ...orzM(V.djRsi), peso: 0.5, interp: [orzM(V.djCt), orzM(V.djJh)] },
      { ...m(T.hop, V.hopRsi), peso: 0.5, interp: [m(T.hop, V.hopCt), m(T.hop, V.hopJh)] },
    ],
    interp: [],
    orientCualidad: [],
  },
  {
    id: 'decel', nombre: 'Deceleration',
    scores: [
      { ...m(T.cmj, V.eccPp), peso: 1 / 3 },
      { ...relCmj(V.eccImp), peso: 1 / 3 },
      { ...m(T.cmj, V.eccRfd), peso: 1 / 3 },
    ],
    interp: [],
    orientCualidad: [],
  },
  {
    id: 'reactivity', nombre: 'Reactivity',
    scores: [
      { ...m(T.cmj, V.rsiMod), peso: 0.8, critico: true },
      { ...m(T.cmj, V.stiff), peso: 0.2 },
    ],
    interp: [
      { tipo: 'eur' },
      { tipo: 'cualidad', id: 'dynamic', orient: [o('<', 'p35', 'Prioritize Dynamic strength / concentric emphasis')] },
      { ...m(T.cmj, V.jh), orient: JH_ORI },
      { ...m(T.cmj, V.depth), orient: DEPTH_ORI },
      { ...m(T.cmj, V.ct), orient: CT_ORI },
    ],
    orientCualidad: [],
  },
  {
    id: 'propulsive', nombre: 'Propulsive',
    scores: [
      { ...m(T.cmj, V.cpp), peso: 0.8, critico: true, tendencia: true },
      { ...relCmj(V.conImp), peso: 0.2 },
    ],
    interp: [
      { tipo: 'cualidad', id: 'reactivity', orient: [o('>', 'p65', 'Reactive strategy')] },
      { ...m(T.cmj, V.depth), orient: DEPTH_ORI },
      { ...m(T.cmj, V.ct), orient: CT_ORI },
      { tipo: 'fv' },
    ],
    orientCualidad: [],
  },
  {
    id: 'explosive', nombre: 'Explosive / Snappy',
    scores: [
      { ...relCmj(V.conImp100), peso: 0.8, critico: true, tendencia: true },
      { ...m(T.cmj, V.ct), peso: 0.2 },
    ],
    interp: [
      m(T.cmj, V.stiff),
      { ...m(T.cmj, V.jh), orient: JH_ORI },
      { ...m(T.cmj, V.depth), orient: DEPTH_ORI },
    ],
    orientCualidad: [],
  },
];

// Descriptores de la comparación propulsivo / explosivo: se decide con PERCENTILES, nunca con valores.
export const DESC_IMP100 = relCmj(V.conImp100);
export const DESC_CPP = m(T.cmj, V.cpp);

// Texto de orientación de una medida: la primera regla que se cumple, sobre su propio percentil.
export function orientacionDe(desc, pct, umbrales = UMBRALES_DEFAULT) {
  if (!desc?.orient?.length || !Number.isFinite(pct)) return null;
  const u = { ...UMBRALES_DEFAULT, ...(umbrales ?? {}) };
  for (const r of desc.orient) { if (cumple(r.op, pct, u[r.u])) return r.texto; }
  return null;
}

// Comparación propulsivo / explosivo, con los percentiles de los dos impulsos.
export function tendencia(medida) {
  const a = medida(DESC_IMP100)?.pct, b = medida(DESC_CPP)?.pct;
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return a > b ? TEND_EXPL : a < b ? TEND_PROP : 'Explosive = Propulsive tendency';
}

export const claveDesc = (d) => (d.tipo ? `@${d.tipo}${d.id ? ':' + d.id : ''}` : `${d.orz ? '@orz' : d.test}|${d.variable}${d.rel ? '/BM' : ''}`);

// Pesos guardados por el usuario (3.10): { [cualidad]: [pesos en el orden de los scores] }. Un peso inválido o negativo se ignora.
export function pesosDe(cual, pesos) {
  const g = pesos?.[cual.id];
  return cual.scores.map((s, i) => {
    const p = Array.isArray(g) ? Number(g[i]) : NaN;
    return Number.isFinite(p) && p >= 0 ? p : s.peso;
  });
}

// ---- Puntuación de una cualidad (3.1, 3.2, 3.8).
// `medida(desc)` devuelve { pct, ... } o null si no hay dato (o no llega al mínimo de jugadores, que cuenta como dato que falta).
export function puntuarCualidad(cual, medida, umbrales = UMBRALES_DEFAULT, pesos = {}) {
  const u = { ...UMBRALES_DEFAULT, ...(umbrales ?? {}) };
  const ps = pesosDe(cual, pesos);
  const scores = cual.scores.map((s, i) => ({ desc: s, peso: ps[i], med: medida(s) ?? null }));
  const conDato = scores.filter((s) => s.med && Number.isFinite(s.med.pct) && s.peso > 0);
  const faltaCritica = scores.some((s) => s.desc.critico && !(s.med && Number.isFinite(s.med.pct)));
  const sumaPesos = conDato.reduce((a, s) => a + s.peso, 0);
  let score = null;
  if (!faltaCritica && conDato.length && sumaPesos > 0) score = Math.round(conDato.reduce((a, s) => a + s.peso * s.med.pct, 0) / sumaPesos);
  // Las 7 cualidades puntúan siempre que haya datos (14/11/2026): ya no hay reglas que anulen una cualidad, solo textos de orientación.
  const estado = score === null ? 'sin-datos' : 'ok';
  const orientacion = estado === 'ok' ? (cual.orientCualidad ?? []).map((r) => (cumple(r.op, score, u[r.u]) ? r.texto : null)).find(Boolean) ?? null : null;
  return { id: cual.id, nombre: cual.nombre, estado, score, scoreBruto: score, orientacion, scores, usadas: conDato.length, total: cual.scores.length, faltaCritica };
}

export function calcular({ cualidades = CUALIDADES, medida, umbrales = UMBRALES_DEFAULT, pesos = {} } = {}) {
  const hechas = [];
  // Propulsive usa la puntuación de Reactivity como interpretativa: se calculan en orden y se consulta lo ya calculado.
  const medidaCon = (d) => {
    if (d?.tipo === 'cualidad') { const q = hechas.find((x) => x.id === d.id); return q && q.scoreBruto !== null ? { pct: q.scoreBruto } : null; }
    return medida(d);
  };
  for (const c of cualidades) hechas.push(puntuarCualidad(c, medidaCon, umbrales, pesos));
  return hechas;
}

// Referencias del radar (3.9): mismos pesos de la cualidad sobre el percentil de La Liga del P50 (o P75) de la posición del jugador.
export function referenciaPosicional(cual, pctDe, pesos = {}) {
  const ps = pesosDe(cual, pesos);
  const con = cual.scores.map((s, i) => ({ peso: ps[i], pct: pctDe(s) })).filter((x) => Number.isFinite(x.pct) && x.peso > 0);
  const suma = con.reduce((a, x) => a + x.peso, 0);
  return suma > 0 ? Math.round(con.reduce((a, x) => a + x.peso * x.pct, 0) / suma) : null;
}

// Altura del Drop Jump que se usa (3.4): la de la ORZ; con una sola altura testada, esa; con empate exacto de RSI, las dos (media de sus percentiles).
export function alturaDropJump({ orz, hay30, hay45 }) {
  if (orz?.defined) return { alturas: [orz.height], motivo: 'orz' };
  if (orz && orz.hidden !== true && orz.defined === false) return { alturas: hay30 && hay45 ? [30, 45] : hay30 ? [30] : hay45 ? [45] : [], motivo: hay30 && hay45 ? 'empate' : 'unica' };
  if (hay30 && !hay45) return { alturas: [30], motivo: 'unica' };
  if (hay45 && !hay30) return { alturas: [45], motivo: 'unica' };
  return { alturas: [], motivo: 'sin-datos' };
}


// ---- Impulsos relativizados: añade a las sesiones los valores N·s/kg de los tres impulsos, como variables virtuales de id negativo.
// Masa: la del jugador más cercana a la fecha de la sesión (`massNearest`, la MISMA regla que el resto del dashboard, incluido el peso de
// referencia cuando no hay medición). Sin masa utilizable no hay valor relativo: esa sesión cuenta como dato que falta (3.3).
export function expandirImpulsos({ variables, testId, sessions, anthropometry }) {
  const src = IMPULSOS_REL.map((r) => ({ ...r, srcVar: variables.find((v) => v.testId === testId && v.name === r.src && !v.archived) ?? null })).filter((r) => r.srcVar);
  if (!src.length) return { variables: [], sessions, sinMasa: 0 };
  const porJugador = new Map();
  for (const a of anthropometry) (porJugador.get(a.playerId) ?? porJugador.set(a.playerId, []).get(a.playerId)).push(a);
  let sinMasa = 0;
  const out = sessions.map((s) => {
    let values = null;
    for (const r of src) {
      const v = s.values?.[r.srcVar.id];
      if (!v) continue;
      const masa = massNearest(porJugador.get(s.playerId) ?? [], s.date);
      if (!masa || !(masa.kg > 0)) { sinMasa++; continue; }
      const rel = {};
      for (const k of ['L', 'R', 'S']) if (Number.isFinite(v[k])) rel[k] = v[k] / masa.kg;
      values ??= { ...s.values };
      values[r.id] = rel;
    }
    return values ? { ...s, values } : s;
  });
  const nuevas = src.map((r) => ({
    id: r.id, testId, name: r.name, unit: r.unit, sides: r.srcVar.sides, direction: r.srcVar.direction ?? 'higher',
    kind: 'raw', archived: false, virtual: true, order: 9000, notes: `${r.src} ÷ masa corporal (kg). Variable virtual del bloque COMPOSITE PROFILE SCORE: no se guarda en el catálogo.`,
  }));
  return { variables: nuevas, sessions: out, sinMasa };
}
