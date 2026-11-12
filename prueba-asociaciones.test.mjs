import * as A from './asociaciones.js';
let failed = 0;
const check = (n, ok, d = '') => { console.log(`${ok ? 'OK  ' : 'FAIL'} ${n} ${ok ? '' : d}`); if (!ok) failed++; };
const catalog = { tests: [{ id: 1, name: 'T1' }, { id: 2, name: 'T2', archived: true }, { id: 3, name: 'T3' }], variables: [
  { id: 11, testId: 1, name: 'Fuerza', kind: 'raw', unit: 'N', sides: 'LR' }, { id: 12, testId: 1, name: 'Asim', kind: 'derived', unit: '%', sides: 'single', formula: { op: 'ASIMETRIA', operands: [11] } },
  { id: 31, testId: 3, name: 'Salto', kind: 'raw', unit: 'cm', sides: 'single' }] };
const S = (id, playerId, testId, date, values, status = 'valid') => ({ id, playerId, testId, date, time: '', values, reps: { total: 1, L: 1, R: 1 }, status });
let sid = 1; const sessions = []; const players = {};
for (let p = 1; p <= 12; p++) {
  players[p] = { id: p, jerseyName: 'P' + p };
  for (const [d, k] of [['2026-01-10', 0], ['2026-02-10', 1], ['2026-03-10', 2]]) { // dentro de cada jugador: más fuerza → más salto; entre jugadores: nivel opuesto
    sessions.push(S(sid++, p, 1, d, { 11: { L: 100 + p * 10 + k * 5, R: 90 + p * 10 + k * 5 } }));
    sessions.push(S(sid++, p, 3, d, { 31: { S: 60 - p + k * 2 } }));
  }
}
players[13] = { id: 13, jerseyName: 'Sintético', synthetic: 1 }; sessions.push(S(sid++, 13, 1, '2026-01-10', { 11: { L: 1, R: 1 } }), S(sid++, 13, 3, '2026-01-10', { 31: { S: 1 } }));
sessions.push(S(sid++, 1, 1, '2026-04-10', { 11: { L: 9999, R: 9999 } }, 'excluded'), S(sid++, 1, 3, '2026-04-10', { 31: { S: 9999 } }, 'excluded'));
const opts = A.variableOptions(catalog, sessions);
check('opciones: izquierda, derecha y media de las dos, sin asimetría derivada ni tests archivados', opts.map((o) => o.key).join() === '1.11.L,1.11.R,1.11.M,3.31.S', opts.map((o) => o.key).join());
check('parseKey', JSON.stringify(A.parseKey('1.11.L')) === '{"testId":1,"variableId":11,"side":"L"}' && A.parseKey('x') === null);
const [xL, , xM, yS] = opts;
const c = A.crossSectional({ sessions, players, histories: {}, x: xL, y: yS });
check('transversal: una observación por jugador real (12), sin sintético ni sesiones excluidas', c.n === 12 && c.sufficient && !c.hasSynthetic && c.obs.every((o) => o.x < 1000 && o.y < 100));
check('transversal: entre jugadores, más fuerza ↔ menos salto (ρ = −1)', Math.abs(c.spearman.r + 1) < 1e-9 && c.pearson.defined);
const w = A.withinPlayer({ sessions, players, histories: {}, x: xL, y: yS });
check('intra-jugador: 36 pares, 12 jugadores, relación positiva (la opuesta a la transversal)', w.n === 36 && w.players === 12 && w.rm.defined && w.rm.r > 0.99 && w.rm.df === 36 - 12 - 1, JSON.stringify(w.rm));
check('muestra mínima: con minN = 20 no se calcula en transversal', A.crossSectional({ sessions, players, histories: {}, x: xL, y: yS, minN: 20 }).spearman === null);
check('periodo: solo febrero → intra-jugador sin pares suficientes por jugador', A.withinPlayer({ sessions, players, histories: {}, x: xL, y: yS, from: '2026-02-01', to: '2026-02-28' }).n === 0);
check('posición: filtro y «sin posición»', A.crossSectional({ sessions, players, histories: { 1: [{ role: 'principal', positionId: 7 }] }, x: xL, y: yS, posQ: '7' }).n === 1 && A.crossSectional({ sessions, players, histories: { 1: [{ role: 'principal', positionId: 7 }] }, x: xL, y: yS, posQ: 'none' }).n === 11);
check('sintéticos solo si se piden, y se marcan', A.crossSectional({ sessions, players, histories: {}, x: xL, y: yS, includeSynthetic: true }).hasSynthetic === true);
// Lado «media de las dos piernas» (12/11/2026)
{
  check('opción «media»: etiqueta y clave propias', xM.side === 'M' && /Media de las dos piernas/.test(xM.label) && A.parseKey(xM.key).side === 'M');
  const cM = A.crossSectional({ sessions, players, histories: {}, x: xM, y: yS });
  const cL = A.crossSectional({ sessions, players, histories: {}, x: xL, y: yS });
  const cR = A.crossSectional({ sessions, players, histories: {}, x: opts[1], y: yS });
  check('media de las dos piernas: un valor por jugador, igual a la media de izquierda y derecha', cM.n === cL.n && cM.obs.every((o, i) => Math.abs(o.x - (cL.obs[i].x + cR.obs[i].x) / 2) < 1e-9));
  const soloIzq = sessions.map((s2) => ({ ...s2, values: Object.fromEntries(Object.entries(s2.values).map(([k, v]) => [k, v.R === undefined ? v : { L: v.L }])) }));
  check('sesiones con una sola pierna no entran en la media', A.crossSectional({ sessions: soloIzq, players, histories: {}, x: xM, y: yS }).n === 0);
}

process.exit(failed ? 1 : 0);
