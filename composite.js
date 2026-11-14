// composite.js — bloque «COMPOSITE PROFILE SCORE» (encargo del usuario, especificación v0.3 del 13/11/2026): lógica pura, sin DOM ni base de datos.
// Define las 7 cualidades, sus variables de puntuación (con peso) y sus interpretativas, las reglas de «No aplicable» y cómo se puntúa.
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

// Umbrales de las reglas, editables en Ajustes (3.10).
export const UMBRALES_DEFAULT = { p35: 35, p10: 10, p65: 65 };

const m = (test, variable, extra = {}) => ({ test, variable, ...extra });
const relCmj = (name) => ({ test: T.cmj, variable: name, rel: true });
const orzM = (variable) => ({ orz: true, variable });

// ---- Reglas. `ok` devuelve true cuando la cualidad SÍ es aplicable. Si falta el percentil de alguna de sus variables, la regla no se evalúa (3.2).
const reglaMenor = (clave, desc, etiqueta, umbralKey) => ({
  clave, descs: [desc], umbralKey,
  ok: (p, u) => p[0] >= u[umbralKey],
  texto: (p, u) => `${etiqueta} p${Math.round(p[0])} (< p${u[umbralKey]})`,
});
const REGLA_JH = reglaMenor('jh', m(T.cmj, V.jh), 'jump height', 'p35');
const REGLA_DEPTH = reglaMenor('depth', m(T.cmj, V.depth), 'depth', 'p10');
const REGLA_CT = reglaMenor('ct', m(T.cmj, V.ct), 'contraction time', 'p10');
// Propulsive y Explosive se deciden comparando PERCENTILES, nunca valores (3.2). Con percentiles iguales las dos salen «No aplicable».
const REGLA_PROP = {
  clave: 'prop', descs: [relCmj(V.conImp100), m(T.cmj, V.cpp)],
  ok: ([a, b]) => a < b,
  texto: ([a, b]) => `con impulse 100 ms p${Math.round(a)} no es menor que con peak power p${Math.round(b)}`,
};
const REGLA_EXPL = {
  clave: 'expl', descs: [relCmj(V.conImp100), m(T.cmj, V.cpp)],
  ok: ([a, b]) => a > b,
  texto: ([a, b]) => `con impulse 100 ms p${Math.round(a)} no es mayor que con peak power p${Math.round(b)}`,
};

// ---- Las 7 cualidades, en el orden pedido. `critico`: si esa variable no tiene dato, la cualidad entera sale «—» (3.8).
// `interp` dentro de un score son las interpretativas que van debajo de ese score en el desglose; las de la cualidad van al final.
export const CUALIDADES = [
  {
    id: 'isometric', nombre: 'Isometric Strength',
    scores: [{ ...m(T.knee, V.kneeRel), peso: 1, critico: true }],
    interp: [{ tipo: 'dsi' }, m(T.cmj, V.f0)],
    reglas: [],
  },
  {
    id: 'dynamic', nombre: 'Dynamic Strength',
    scores: [
      { ...m(T.cmj, V.jh), peso: 0.7, critico: true },
      { ...m(T.cmj, V.cpp), peso: 0.15 },
      { ...relCmj(V.conImp), peso: 0.15 },
    ],
    interp: [m(T.cmj, V.depth), { tipo: 'fv' }],
    reglas: [],
  },
  {
    id: 'shortgct', nombre: 'Short GCT Reactive Strength',
    scores: [
      { ...orzM(V.djRsi), peso: 0.5, interp: [orzM(V.djCt), orzM(V.djJh)] },
      { ...m(T.hop, V.hopRsi), peso: 0.5, interp: [m(T.hop, V.hopCt), m(T.hop, V.hopJh)] },
    ],
    interp: [],
    reglas: [],
  },
  {
    id: 'decel', nombre: 'Deceleration',
    scores: [
      { ...m(T.cmj, V.eccPp), peso: 1 / 3 },
      { ...relCmj(V.eccImp), peso: 1 / 3 },
      { ...m(T.cmj, V.eccRfd), peso: 1 / 3 },
    ],
    interp: [],
    reglas: [],
  },
  {
    id: 'reactivity', nombre: 'Reactivity',
    scores: [
      { ...m(T.cmj, V.rsiMod), peso: 0.8, critico: true },
      { ...m(T.cmj, V.stiff), peso: 0.2 },
    ],
    interp: [{ tipo: 'eur' }],
    reglas: [REGLA_JH, REGLA_DEPTH, REGLA_CT],
  },
  {
    id: 'propulsive', nombre: 'Propulsive',
    scores: [
      { ...m(T.cmj, V.cpp), peso: 0.8, critico: true },
      { ...relCmj(V.conImp), peso: 0.2 },
    ],
    interp: [{ tipo: 'cualidad', id: 'reactivity' }, m(T.cmj, V.ct), m(T.cmj, V.depth), { tipo: 'fv' }],
    reglas: [REGLA_PROP],
  },
  {
    id: 'explosive', nombre: 'Explosive / Snappy',
    scores: [
      { ...relCmj(V.conImp100), peso: 0.9, critico: true },
      { ...m(T.cmj, V.ct), peso: 0.1 },
    ],
    interp: [m(T.cmj, V.stiff)],
    reglas: [REGLA_EXPL, REGLA_JH, REGLA_DEPTH],
  },
];

// Clave de una medida: sirve para buscarla y para guardar los pesos en Ajustes.
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
  // Reglas: una regla sin todos sus percentiles no se evalúa y el desglose lo dice.
  const reglas = cual.reglas.map((rg) => {
    const pcts = rg.descs.map((d) => medida(d)).map((x) => (x && Number.isFinite(x.pct) ? x.pct : null));
    if (pcts.some((p) => p === null)) return { clave: rg.clave, evaluada: false, cumple: null, texto: 'sin dato para comprobar la regla', descs: rg.descs };
    const ok = rg.ok(pcts, u);
    return { clave: rg.clave, evaluada: true, cumple: ok, texto: rg.texto(pcts, u), descs: rg.descs };
  });
  const fallan = reglas.filter((rg) => rg.evaluada && !rg.cumple);
  // «—» (sin datos) y «No aplicable» (regla) son estados distintos (3.8). Sin puntuación manda «—»: no se puede afirmar nada de la cualidad.
  const estado = score === null ? 'sin-datos' : fallan.length ? 'na' : 'ok';
  return { id: cual.id, nombre: cual.nombre, estado, score: estado === 'ok' ? score : null, scoreBruto: score, scores, reglas, fallan, usadas: conDato.length, total: cual.scores.length, faltaCritica };
}

export function calcular({ cualidades = CUALIDADES, medida, umbrales = UMBRALES_DEFAULT, pesos = {} } = {}) {
  const hechas = [];
  // Propulsive usa la puntuación de Reactivity como interpretativa: se calculan en orden y se consulta lo ya calculado.
  const medidaCon = (d) => {
    if (d?.tipo === 'cualidad') { const q = hechas.find((x) => x.id === d.id); return q && q.scoreBruto !== null ? { pct: q.scoreBruto, texto: q.estado === 'na' ? 'No aplicable' : null } : null; }
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

// Regla del DSI (3.2): con el Knee Iso-Push por encima del umbral, la fila del DSI es «No aplicable»; la puntuación de Isometric Strength no cambia.
export const dsiNoAplicable = (kneePct, umbrales = UMBRALES_DEFAULT) => Number.isFinite(kneePct) && kneePct > (umbrales?.p65 ?? UMBRALES_DEFAULT.p65);

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
