// Personal Best de la «mejor sesión» (RSI) en CMJ, SL CMJ, Hop Test y Drop Jump 30/45 cm. Datos sintéticos.
import 'fake-indexeddb/auto';
import { createDb, initDb } from './db.js';
import { seedInitialCatalog } from './catalogo-inicial.js';
import { listCatalog, pbCriterionOf } from './catalogo.js';
import { personalBestFor } from './evolucion.js';
import { playerValue } from './percentiles.js';
let fail = 0; const check = (n, ok, d = '') => { console.log((ok ? 'OK   ' : 'FAIL ') + n + (ok ? '' : ' ' + d)); if (!ok) fail = 1; };
const db = createDb('t-pbses-' + Math.random()); await initDb(db); await seedInitialCatalog(db);
const cat = await listCatalog(db);
const T = (n) => cat.tests.find((t) => t.name === n);
const V = (t, n) => cat.variables.find((v) => v.testId === t.id && v.name === n);
for (const n of ['CMJ', 'SL CMJ', 'Double-Leg Hop Test', 'DL Drop Jump 30 cm', 'DL Drop Jump 45 cm']) {
  const c = pbCriterionOf(T(n), cat.variables);
  check(`criterio de ${n}: un RSI`, !!c && /RSI/.test(c.name) && cat.variables.find((v) => v.id === c.id).pbCriterion?.id === c.id, JSON.stringify(c));
}
check('Squat Jump: criterio = JH (imp-mom); otros tests (p. ej. Iso-Push) sin criterio', V(T('Squat Jump'), 'JH (imp-mom)').pbCriterion?.name === 'JH (imp-mom)' && !cat.variables.some((v) => v.testId === T('Run-Specific Ankle Iso-Push').id && v.pbCriterion));
const cmj = T('CMJ'), rsi = V(cmj, 'RSI MOD'), jh = V(cmj, 'JH (imp-mom)'), ct = V(cmj, 'CONTRACTION TIME');
check('la variable lleva el criterio (JH → RSI MOD)', jh.pbCriterion.id === rsi.id);
const S = (id, date, rsiV, jhV, ctV, extra = {}) => ({ id, playerId: 1, testId: cmj.id, date, time: '', values: { [rsi.id]: { S: rsiV }, [jh.id]: { S: jhV }, ...(ctV == null ? {} : { [ct.id]: { S: ctV } }) }, reps: { total: 3 }, status: 'valid', ...extra });
// Sesión 2: mejor RSI (0,60) pero NO la mayor altura; sesión 3 tiene la mayor altura (40) con RSI peor
const ses = [S(1, '2026-01-10', 0.5, 36, 300), S(2, '2026-02-10', 0.6, 35, 280), S(3, '2026-03-10', 0.55, 40, 320), S(4, '2026-04-10', 0.9, 50, 250, { status: 'excluded' })];
const pbJh = personalBestFor(ses, jh, 'S'), pbRsi = personalBestFor(ses, rsi, 'S'), pbCt = personalBestFor(ses, ct, 'S');
check('JH: valor de la sesión de mejor RSI (35), no el máximo (40)', pbJh.defined && pbJh.value === 35 && pbJh.date === '2026-02-10' && pbJh.criterionValue === 0.6, JSON.stringify(pbJh));
check('RSI: su propio máximo; contacto: 280 de la misma sesión (no el mínimo de otra)', pbRsi.value === 0.6 && pbCt.value === 280 && pbCt.sessionId === 2);
check('la sesión excluida (RSI 0,9) no cuenta', personalBestFor(ses, jh, 'S').sessionId === 2);
check('filtro de fechas: elige entre las sesiones del periodo', personalBestFor(ses, jh, 'S', { from: '2026-03-01' }).value === 40);
const sinCt = [S(1, '2026-01-10', 0.5, 36, 300), S(2, '2026-02-10', 0.6, 35, null)];
const faltante = personalBestFor(sinCt, ct, 'S');
check('si la mejor sesión no tiene la variable: sin PB (no se sustituye)', !faltante.defined && /no tiene esta variable/.test(faltante.reason), JSON.stringify(faltante));
const empate = personalBestFor([S(1, '2026-01-10', 0.6, 30, 1), S(2, '2026-02-10', 0.6, 31, 2)], jh, 'S');
check('empate de RSI: la sesión más reciente (D22)', empate.value === 31 && empate.tied);
check('playerValue(pb) usa la misma regla', playerValue(ses, jh, 'S', { basis: 'pb', playerId: 1 }).value === 35);
// Squat Jump: PB de cada variable = su valor en la sesión con mejor Jump Height
const sj = T('Squat Jump'), sjh = V(sj, 'JH (imp-mom)'), sjr = V(sj, 'RSI MOD');
const sjs = [{ id: 1, playerId: 1, testId: sj.id, date: '2026-01-01', values: { [sjh.id]: { S: 30 }, [sjr.id]: { S: 0.9 } }, reps: { total: 3 }, status: 'valid' }, { id: 2, playerId: 1, testId: sj.id, date: '2026-01-02', values: { [sjh.id]: { S: 33 }, [sjr.id]: { S: 0.4 } }, reps: { total: 3 }, status: 'valid' }];
check('Squat Jump: PB de JH = 33 y RSI MOD de esa misma sesión (0,4), no su máximo (0,9)', personalBestFor(sjs, sjh, 'S').value === 33 && personalBestFor(sjs, sjr, 'S').value === 0.4);
// SL CMJ por lado
const sl = T('SL CMJ'), srsi = V(sl, 'RSI MOD'), sjh2 = V(sl, 'JH (imp-mom)');
const L = (id, date, rl, rr, jl, jr) => ({ id, playerId: 1, testId: sl.id, date, time: '', values: { [srsi.id]: { L: rl, R: rr }, [sjh2.id]: { L: jl, R: jr } }, reps: { L: 3, R: 3 }, status: 'valid' });
const sls = [L(1, '2026-01-01', 0.4, 0.5, 20, 22), L(2, '2026-02-01', 0.5, 0.4, 21, 19)];
check('SL CMJ: cada lado con su propia mejor sesión', personalBestFor(sls, sjh2, 'L').value === 21 && personalBestFor(sls, sjh2, 'R').value === 22);
console.log(fail ? 'HAY FALLOS' : 'Todo bien'); process.exit(fail);
