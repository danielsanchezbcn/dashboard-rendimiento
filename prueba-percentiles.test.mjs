import * as P from './percentiles.js';

let failed = 0;
const check = (n, c, x = '') => { console.log(`${c ? 'OK  ' : 'FAIL'} ${n} ${x}`); if (!c) failed++; };
check('bandas: límites sin solapar (P10 naranja, P35, P50, P65, P90 verde intenso, P100 incluido)', [0, 9.99, 10, 34.9, 35, 49.9, 50, 64.9, 65, 89.9, 90, 100].map(P.bandFor).join() === '0,0,1,1,2,2,3,3,4,4,5,5');
check('rango medio: [1,2,2,3] y x=2 → (1 + 1)/4 = 50', P.midRankPercentile([1, 2, 2, 3], 2) === 50);
check('rango medio: extremos', P.midRankPercentile([1, 2, 3, 4], 0) === 0 && P.midRankPercentile([1, 2, 3, 4], 9) === 100);
check('mediana par e impar', P.median([3, 1, 2]) === 2 && P.median([1, 2, 3, 4]) === 2.5 && P.median([]) === null);
const V = { id: 5, sides: 'S', direction: 'higher' };
const S = (id, playerId, date, v, reps = 3, extra = {}) => ({ id, playerId, testId: 1, date, time: '', values: { 5: { S: v } }, reps: { total: reps }, status: 'valid', ...extra });
const players = {}; const sessions = [];
for (let i = 1; i <= 12; i++) { players[i] = { jerseyName: 'J' + i }; sessions.push(S(i, i, '2026-03-10', i * 10)); }
players[13] = { jerseyName: 'SINT', synthetic: 1 }; sessions.push(S(100, 13, '2026-03-10', 1000));
sessions.push(S(101, 5, '2026-03-20', 500, 3, { status: 'excluded' }));
const ref = P.buildReference({ sessions, variable: V, side: 'S', players });
check('referencia: un valor por jugador, sin sintéticos y sin sesiones excluidas (12 jugadores)', ref.length === 12 && !ref.some((e) => e.playerId === 13) && ref.find((e) => e.playerId === 5).value === 50);
check('referencia con includeSynthetic (solo pruebas): 13', P.buildReference({ sessions, variable: V, side: 'S', players, includeSynthetic: true }).length === 13);
let ev = P.evaluate(ref, { playerId: 12, value: 120, direction: 'higher' });
check('evaluado excluido de su referencia: N = 11; 120 supera a todos → P = 100 y verde intenso', ev.n === 11 && ev.sufficient && ev.percentileStat === 100 && ev.band === 5 && ev.p50 === 60, JSON.stringify(ev));
ev = P.evaluate(ref, { playerId: 1, value: 10, direction: 'lower' });
check('«más bajo es mejor»: el menor de todos → percentil estadístico 0 y de rendimiento 100', ev.percentileStat === 0 && ev.percentilePerf === 100 && ev.band === 5);
ev = P.evaluate(ref, { playerId: 6, value: 60, direction: 'higher' });
check('mediana: el jugador 6 (60) frente a 11 otros: 5 menores, 0 iguales → 5/11', Math.abs(ev.percentileStat - (5 / 11) * 100) < 1e-9 && ev.band === 2);
check('rango objetivo y sin dirección: el percentil lleva color de POSICIÓN (positional) igual que «más alto es mejor»', (() => { const a = P.evaluate(ref, { playerId: 6, value: 60, direction: 'target' }), b = P.evaluate(ref, { playerId: 6, value: 60, direction: null }), c = P.evaluate(ref, { playerId: 6, value: 60, direction: 'higher' }); return a.percentileStat !== null && a.percentilePerf === a.percentileStat && a.band === c.band && a.positional === true && b.positional === true && b.band === c.band && c.positional !== true; })());
ev = P.evaluate(ref.slice(0, 5), { playerId: 99, value: 30, direction: 'higher' });
check('muestra insuficiente (N = 5 < 10): sin percentil ni color y con el motivo', ev.n === 5 && !ev.sufficient && ev.percentileStat === null && ev.band === null && /insuficiente/.test(ev.reason));
check('N mínimo configurable', P.evaluate(ref.slice(0, 5), { playerId: 99, value: 30, direction: 'higher', minN: 5 }).sufficient);
check('sin otros jugadores: motivo claro', /No hay otros/.test(P.evaluate([{ playerId: 1, value: 1 }], { playerId: 1, value: 1, direction: 'higher' }).reason));
// Base «última sesión» y filtro de posición
const s2 = [S(1, 1, '2026-01-10', 10), S(2, 1, '2026-03-10', 50), S(3, 2, '2026-02-10', 20)];
const pl2 = { 1: { jerseyName: 'A' }, 2: { jerseyName: 'B' } };
check('base «última sesión» usa solo la última sesión válida de cada jugador', P.buildReference({ sessions: s2, variable: V, side: 'S', players: pl2, basis: 'last' }).find((e) => e.playerId === 1).value === 50 && P.buildReference({ sessions: s2, variable: V, side: 'S', players: pl2, basis: 'pa' }).find((e) => e.playerId === 1).value === 30);
const H = { 1: [{ positionId: 20, role: 'principal', validFrom: null, validTo: null }], 2: [{ positionId: 10, role: 'principal', validFrom: null, validTo: null }] };
const rp = P.buildReference({ sessions: s2, variable: V, side: 'S', players: pl2, histories: H, positionId: 10 });
check('filtro de posición: solo cuentan los jugadores de esa posición (A está en la 20, no entra en la 10)', rp.length === 1 && rp[0].playerId === 2);
const rl = { id: 5, sides: 'LR', direction: 'higher' };
const sl = [{ id: 1, playerId: 1, testId: 1, date: '2026-03-10', time: '', values: { 5: { L: 100, R: 120 } }, reps: { L: 3, R: 3 }, status: 'valid' }];
check('por lado: cada lado tiene su propia referencia', P.buildReference({ sessions: sl, variable: rl, side: 'L', players: { 1: {} } })[0].value === 100 && P.buildReference({ sessions: sl, variable: rl, side: 'R', players: { 1: {} } })[0].value === 120);
process.exit(failed ? 1 : 0);
