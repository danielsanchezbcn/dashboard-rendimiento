// teamwide.js — cálculos de «Team-Wide Analysis» (26/11/2026, pedido del usuario): mapa de calor de percentiles, ranking de la plantilla en una
// variable y matriz de correlaciones. Lógica pura, sin IndexedDB y sin pintar nada.
//
// Reglas que comparte con el resto del dashboard, para que un mismo valor dé siempre el mismo percentil:
//   · El valor de cada jugador sale de `valorDeJugador` (Latest, Personal Average o Personal Best, con las funciones de evolucion.js).
//   · El percentil sale de `referenciaPlantilla` + `evaluate` (percentiles.js): los dos lados en la misma distribución, el jugador fuera de su
//     propia referencia y los jugadores sintéticos fuera salvo que se pidan.
//   · No se usa el lado «media de las dos piernas»: la referencia junta izquierda y derecha, así que el percentil de una media no sería comparable
//     con el que enseña el resto del dashboard. En las variables por lado hay una columna para cada pierna.
import { referenciaPlantilla, evaluate, MIN_N_DEFAULT } from './percentiles.js';
import { spearmanResult } from './estadistica.js';
import { isViewable, hasData, orderVars } from './relativos.js';
import { isAsymVariable } from './catalogo.js';
import { positionOnDate } from './posiciones.js';
import { playerLabel, aliasOf } from './jugadores.js';
import { valorDeJugador, SIDE_LABEL } from './asociaciones.js';

export const colKey = (v, side) => `${v.testId}.${v.id}.${side}`;

// Columnas de un test: sus variables visibles y con datos, una por lado (sin «media de las dos piernas»).
export function columnasDeTest(catalog, sessions, testId) {
  const test = catalog.tests.find((t) => t.id === Number(testId));
  if (!test) return [];
  const ss = sessions.filter((s) => s.testId === test.id);
  const vars = orderVars(catalog.variables.filter((v) => v.testId === test.id && isViewable(v) && hasData(v, ss) && !isAsymVariable(v)));
  return vars.flatMap((v) => (v.sides === 'LR' ? ['L', 'R'] : ['S']).map((side) => ({
    key: colKey(v, side), test, variable: v, side, unit: v.unit ?? '',
    label: `${v.name}${SIDE_LABEL[side] ? ` · ${side}` : ''}`,
  })));
}

const poblacion = ({ players, histories, posQ, includeSynthetic }) => {
  const posOf = (id) => positionOnDate(histories[id] ?? []).principal?.positionId ?? null;
  return Object.values(players).filter((p) => (includeSynthetic || !p.synthetic) && (posQ === 'all' || (posQ === 'none' ? posOf(p.id) === null : posOf(p.id) === Number(posQ))));
};

// Una fila por jugador y una celda por columna, con el valor y su percentil de La Liga. La referencia se construye UNA vez por columna.
export function tablaPlantilla({ sessions, players, histories, cols, basis = 'pa', posQ = 'all', includeSynthetic = false, minN = MIN_N_DEFAULT, from = null, to = null }) {
  const gente = poblacion({ players, histories, posQ, includeSynthetic });
  const todos = Object.values(players);
  const refs = {};
  for (const c of cols) {
    refs[c.key] = referenciaPlantilla({
      sessions, variable: c.variable, sides: c.variable.sides === 'LR' ? ['L', 'R'] : ['S'],
      players: Object.fromEntries(todos.map((p) => [p.id, p])), basis, from, to, minN,
    });
  }
  const filas = gente.map((p) => {
    const celdas = cols.map((c) => {
      const v = valorDeJugador(sessions, p.id, c, from, to, basis);
      if (!v.defined) return { key: c.key, value: null, ev: null, razon: v.reason ?? null };
      return { key: c.key, value: v.value, ev: refs[c.key].evalDe(p.id, v.value), razon: null };
    });
    const pcts = celdas.map((x) => x.ev).filter((e) => e && e.sufficient && e.percentilePerf !== null).map((e) => e.percentilePerf);
    return { id: p.id, name: playerLabel(p), alias: aliasOf(p) || playerLabel(p), synthetic: !!p.synthetic, celdas,
      medio: pcts.length ? pcts.reduce((a, b) => a + b, 0) / pcts.length : null, conDato: celdas.filter((x) => x.value !== null).length };
  }).filter((f) => f.conDato > 0);
  // Los peores arriba: es una pantalla de cribado. Los que no tienen ningún percentil calculable van al final.
  filas.sort((a, b) => (a.medio === null) - (b.medio === null) || (a.medio ?? 0) - (b.medio ?? 0) || a.alias.localeCompare(b.alias, 'es'));
  return { cols, filas, n: filas.length };
}

// Ranking de la plantilla en UNA columna: mejor arriba según la dirección de la variable, con el P50 y el P75 de la referencia.
export function rankingVariable(args) {
  const { cols, filas } = tablaPlantilla({ ...args, cols: [args.col] });
  const dir = args.col.variable.direction;
  const datos = filas.map((f) => ({ ...f, value: f.celdas[0].value, ev: f.celdas[0].ev })).filter((f) => f.value !== null);
  datos.sort((a, b) => (dir === 'lower' ? a.value - b.value : b.value - a.value));
  // P50 y P75 de la referencia: los mismos valores con los que se calculan los percentiles de la columna.
  const ref = referenciaPlantilla({
    sessions: args.sessions, variable: args.col.variable, sides: args.col.variable.sides === 'LR' ? ['L', 'R'] : ['S'],
    players: args.players, basis: args.basis ?? 'pa', from: args.from ?? null, to: args.to ?? null, minN: args.minN ?? MIN_N_DEFAULT,
  }).ref.map((e) => e.value).sort((a, b) => a - b);
  const cuantil = (q) => (ref.length ? ref[Math.min(ref.length - 1, Math.floor(q * (ref.length - 1)))] : null);
  return { col: cols[0], filas: datos, n: datos.length, nRef: ref.length, p50: cuantil(0.5), p75: cuantil(0.75), direccion: dir ?? null };
}

// Matriz de correlaciones de Spearman entre las columnas de A (filas) y las de B (columnas), con una observación por jugador.
export function matrizCorrelaciones({ sessions, players, histories, filas: colsA, columnas: colsB, basis = 'pa', posQ = 'all', includeSynthetic = false, minN = MIN_N_DEFAULT, from = null, to = null }) {
  const gente = poblacion({ players, histories, posQ, includeSynthetic });
  const valor = {};
  for (const c of [...colsA, ...colsB]) {
    if (valor[c.key]) continue;
    valor[c.key] = new Map(gente.map((p) => { const v = valorDeJugador(sessions, p.id, c, from, to, basis); return [p.id, v.defined ? v.value : null]; }));
  }
  const celdas = colsA.map((a) => colsB.map((b) => {
    if (a.key === b.key) return { a: a.key, b: b.key, misma: true, n: 0, r: null, sufficient: false };
    const pares = gente.map((p) => [valor[a.key].get(p.id), valor[b.key].get(p.id)]).filter(([x, y]) => x !== null && y !== null);
    const n = pares.length;
    if (n < minN) return { a: a.key, b: b.key, misma: false, n, r: null, sufficient: false, minN };
    const r = spearmanResult(pares.map((x) => x[0]), pares.map((x) => x[1]));
    return { a: a.key, b: b.key, misma: false, n, r: r.defined ? r.r : null, ci: r.defined ? r.ci : null, sufficient: true, razon: r.defined ? null : r.reason };
  }));
  return { filas: colsA, columnas: colsB, celdas, n: gente.length, minN };
}
