// asociaciones.js — fase 6c: observaciones para la vista de relaciones entre variables (lógica pura, sin IndexedDB).
// Selección explícita de dos variables (test + variable + lado), periodo y población. Transversal: UNA observación por jugador
// (su Personal Average en el periodo; las medidas repetidas no se tratan como independientes). Intra-jugador: pares del mismo jugador
// y el mismo día, con correlación de medidas repetidas. Solo sesiones válidas; las excluidas no cuentan. Nada se rellena ni se estima.
import { buildSeries, personalAverage } from './evolucion.js';
import { isViewable, hasData } from './relativos.js';
import { positionOnDate } from './posiciones.js';
import { pearsonResult, spearmanResult, rmcorr } from './estadistica.js';
import { playerLabel } from './jugadores.js';

export const SIDE_LABEL = { L: 'Izquierda', R: 'Derecha', M: 'Media de las dos piernas', S: '' };
export const keyOf = (v, side) => `${v.testId}.${v.id}.${side}`;
export function parseKey(key) {
  const m = /^(\d+)\.(\d+)\.([LRMS])$/.exec(String(key ?? ''));
  return m ? { testId: Number(m[1]), variableId: Number(m[2]), side: m[3] } : null;
}

// Variables seleccionables: las que se pueden ver (origen o relativas) y tienen datos; una opción por lado en las variables por lado.
export function variableOptions(catalog, sessions) {
  const out = [];
  for (const t of catalog.tests.filter((x) => !x.archived)) {
    const ss = sessions.filter((s) => s.testId === t.id);
    for (const v of catalog.variables.filter((x) => x.testId === t.id && isViewable(x) && hasData(x, ss))) {
      const sides = v.sides === 'LR' ? ['L', 'R', 'M'] : ['S'];
      for (const side of sides) out.push({ key: keyOf(v, side), test: t, variable: v, side, unit: v.unit ?? '', label: `${t.name} · ${v.name}${v.unit ? ` (${v.unit})` : ''}${SIDE_LABEL[side] ? ` · ${SIDE_LABEL[side]}` : ''}` });
    }
  }
  return out;
}

function population({ players, histories, posQ, includeSynthetic }) {
  const posOf = (id) => positionOnDate(histories[id] ?? []).principal?.positionId ?? null;
  return Object.values(players).filter((p) => (includeSynthetic || !p.synthetic) && (posQ === 'all' || (posQ === 'none' ? posOf(p.id) === null : posOf(p.id) === Number(posQ))));
}

// Lado «M» (media de las dos piernas, 12/11/2026): media de izquierda y derecha DE LA MISMA SESIÓN. Si una sesión solo tiene un lado, no se usa:
// la media de una sola pierna no es la media de las dos.
const pointsOf = (sessions, playerId, o, from, to) => {
  const ss = sessions.filter((s) => s.playerId === playerId && s.testId === o.test.id), f = { from: from || null, to: to || null };
  if (o.side !== 'M') return buildSeries(ss, o.variable.id, o.side, f).valid;
  const izq = buildSeries(ss, o.variable.id, 'L', f).valid, der = new Map(buildSeries(ss, o.variable.id, 'R', f).valid.map((p) => [p.sessionId, p]));
  return izq.map((p) => { const r = der.get(p.sessionId); return r ? { ...p, value: (p.value + r.value) / 2, reps: Math.min(p.reps ?? 1, r.reps ?? 1) } : null; }).filter(Boolean);
};

export function crossSectional({ sessions, players, histories, x, y, from, to, posQ = 'all', includeSynthetic = false, minN = 10 }) {
  const obs = [];
  for (const p of population({ players, histories, posQ, includeSynthetic })) {
    const a = personalAverage(pointsOf(sessions, p.id, x, from, to)), b = personalAverage(pointsOf(sessions, p.id, y, from, to));
    if (a.defined && b.defined) obs.push({ id: p.id, name: playerLabel(p), x: a.value, y: b.value, from: a.from < b.from ? a.from : b.from, to: a.to > b.to ? a.to : b.to, synthetic: !!p.synthetic });
  }
  const xs = obs.map((o) => o.x), ys = obs.map((o) => o.y);
  const sufficient = obs.length >= minN;
  return { mode: 'cross', obs, n: obs.length, minN, sufficient, spearman: sufficient ? spearmanResult(xs, ys) : null, pearson: sufficient ? pearsonResult(xs, ys) : null, hasSynthetic: obs.some((o) => o.synthetic) };
}

export function withinPlayer({ sessions, players, histories, x, y, from, to, posQ = 'all', includeSynthetic = false, minN = 10 }) {
  const obs = [];
  for (const p of population({ players, histories, posQ, includeSynthetic })) {
    const byDate = (o) => { const m = new Map(); for (const pt of pointsOf(sessions, p.id, o, from, to)) (m.get(pt.date) ?? m.set(pt.date, []).get(pt.date)).push(pt); return new Map([...m].map(([d, g]) => [d, personalAverage(g).value])); };
    const bx = byDate(x), by = byDate(y);
    const pairs = [...bx.keys()].filter((d) => by.has(d)).sort().map((d) => ({ id: p.id, name: playerLabel(p), date: d, x: bx.get(d), y: by.get(d), synthetic: !!p.synthetic }));
    if (pairs.length >= 2) obs.push(...pairs); // un único par no aporta nada al análisis intra-jugador
  }
  const sufficient = obs.length >= minN;
  return { mode: 'within', obs, n: obs.length, players: new Set(obs.map((o) => o.id)).size, minN, sufficient, rm: sufficient ? rmcorr(obs) : null, hasSynthetic: obs.some((o) => o.synthetic) };
}
