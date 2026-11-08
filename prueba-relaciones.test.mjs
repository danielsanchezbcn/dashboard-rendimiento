import * as R from './relaciones.js';
let failed = 0;
const check = (n, ok, d = '') => { console.log(`${ok ? 'OK  ' : 'FAIL'} ${n} ${ok ? '' : d}`); if (!ok) failed++; };
const close = (a, b) => Math.abs(a - b) < 1e-9;
const P = (date, value, reps = 1) => ({ date, value, reps, sessionId: 1 });

check('toKg: kg, g, lb; unidad desconocida → null', R.toKg({ value: 80, unit: 'kg' }) === 80 && R.toKg({ value: 80000, unit: 'g' }) === 80 && close(R.toKg({ value: 100, unit: 'lb' }), 45.359237) && R.toKg({ value: 80, unit: 'st' }) === null && R.toKg({ value: -1, unit: 'kg' }) === null);
const an = [{ id: 1, date: '2026-01-10', bodyMass: { value: 70, unit: 'kg' } }, { id: 2, date: '2026-03-10', bodyMass: { value: 80, unit: 'kg' } }];
const nm = R.massNearest;
check('peso: la medición más cercana, antes o después de la fecha', nm(an, '2026-01-20').kg === 70 && nm(an, '2026-03-01').kg === 80 && nm(an, '2025-12-01').kg === 70 && nm(an, '2030-01-01').kg === 80 && nm(an, '2026-03-01').daysAway === 9);
check('peso: a igual distancia se toma la anterior; la fecha usada y la distancia se devuelven', nm([{ id: 1, date: '2026-01-01', bodyMass: { value: 70, unit: 'kg' } }, { id: 2, date: '2026-01-11', bodyMass: { value: 75, unit: 'kg' } }], '2026-01-06').kg === 70 && nm(an, '2026-01-10').date === '2026-01-10');
const refw = R.withReferenceWeights([], [{ id: 5, referenceWeight: { value: 77, unit: 'kg' } }, { id: 6 }]);
check('peso de referencia: solo se usa si no hay ninguna medición; se añade solo a quien lo tiene', refw.length === 1 && nm(refw, '2026-03-10').reference === true && nm(refw, '2026-03-10').kg === 77 && nm([...an, ...refw], '2026-03-10').reference === false && nm([], '2026-03-10') === null);
const rel = R.relativeBWPoints([P('2026-02-01', 70 * R.G * 2), P('2025-01-01', 500)], an);
check('Knee relativo: 2 BW con 70 kg; una sesión anterior a la primera medida usa la más cercana', close(rel.points[0].value, 2) && rel.points.length === 2 && close(rel.points[1].value, 500 / (70 * R.G)) && R.relativeBWPoints([P('2026-02-01', 1)], []).omitted === 1);
// DSI: SL 19.6133 N/kg = 2 BW; Knee 4 BW → 0.5 (ponderado por repeticiones)
const d = R.dsiSide({ slPoints: [P('2026-02-01', 2 * R.G, 3)], kneePoints: [P('2026-02-01', 70 * R.G * 4, 5)], anthropometry: an });
check('DSI = (SL N/kg ÷ g) ÷ Knee BW, sin unidad', d.defined && close(d.value, 0.5) && close(d.slBW, 2) && close(d.kneeBW, 4), JSON.stringify(d));
const d2 = R.dsiSide({ slPoints: [P('2026-02-01', 2 * R.G, 1), P('2026-02-08', 4 * R.G, 3)], kneePoints: [P('2026-02-01', 70 * R.G * 2, 1), P('2026-03-20', 80 * R.G * 4, 1)], anthropometry: an });
check('DSI usa el Personal Average de cada término con el peso de cada sesión', close(d2.slBW, (2 + 12) / 4) && close(d2.kneeBW, 3) && close(d2.value, 3.5 / 3), JSON.stringify(d2));
check('DSI: motivos claros sin SL, sin Knee y sin peso', !R.dsiSide({ slPoints: [], kneePoints: [P('2026-02-01', 1)], anthropometry: an }).defined && /SL CMJ/.test(R.dsiSide({ slPoints: [], kneePoints: [], anthropometry: an }).reason) && /Knee/.test(R.dsiSide({ slPoints: [P('2026-02-01', 1)], kneePoints: [], anthropometry: an }).reason) && /masa corporal/.test(R.dsiSide({ slPoints: [P('2026-02-01', 1)], kneePoints: [P('2026-02-01', 1)], anthropometry: [] }).reason));
// EUR
const e = R.eur({ cmjPoints: [P('2026-01-01', 30, 2), P('2026-02-01', 36, 2)], sjPoints: [P('2026-01-01', 30), P('2026-02-01', 33), P('2026-03-01', 31)] });
check('EUR = CMJ Personal Average ÷ Squat Jump Personal Best (más alto es mejor), toda la historia', e.defined && close(e.value, 33 / 33) && e.sjPB === 33 && e.cmjPA === 33, JSON.stringify(e));
check('EUR: sin CMJ o sin SJ no se define y dice por qué', /CMJ/.test(R.eur({ cmjPoints: [], sjPoints: [P('2026-01-01', 1)] }).reason) && /Squat/.test(R.eur({ cmjPoints: [P('2026-01-01', 1)], sjPoints: [] }).reason));
// ORZ
check('ORZ: gana la altura con mayor RSI Personal Average', R.orz({ rsi30: [P('a', 1.5)], rsi45: [P('b', 1.2)] }).height === 30 && R.orz({ rsi30: [P('a', 1.0)], rsi45: [P('b', 1.2)] }).height === 45);
check('ORZ: una sola altura → no se muestra nada', R.orz({ rsi30: [P('a', 1.5)], rsi45: [] }).hidden === true && R.orz({ rsi30: [], rsi45: [] }).hidden === true);
check('ORZ: empate exacto → sin ORZ (provisional)', R.orz({ rsi30: [P('a', 1.2)], rsi45: [P('b', 1.2)] }).defined === false && R.orz({ rsi30: [P('a', 1.2)], rsi45: [P('b', 1.2)] }).hidden === false);
// Integración con catálogo y sesiones sintéticas de prueba
const tests = [{ id: 1, name: 'CMJ' }, { id: 2, name: 'Squat Jump' }, { id: 3, name: 'SL CMJ' }, { id: 4, name: 'Run-Specific Knee Iso-Push' }, { id: 5, name: 'DL Drop Jump 30 cm' }, { id: 6, name: 'DL Drop Jump 45 cm' }];
const variables = [{ id: 11, testId: 1, name: 'JH (imp-mom)' }, { id: 12, testId: 2, name: 'JH (imp-mom)' }, { id: 13, testId: 3, name: 'CONCENTRIC PEAK FORCE / BM' }, { id: 14, testId: 4, name: 'Peak Force' }, { id: 15, testId: 5, name: 'RSI (FLIGHT TIME / CONTACT TIME)' }, { id: 16, testId: 6, name: 'RSI (FLIGHT TIME / CONTACT TIME)' }];
const loc = R.locate(tests, variables);
check('locate: encuentra las 6 variables por nombre', Object.values(loc).every(Boolean));
const S = (id, playerId, testId, date, values, extra = {}) => ({ id, playerId, testId, date, time: '', values, reps: { total: 1, L: 1, R: 1 }, status: 'valid', ...extra });
const sessions = []; const players = {}; const anth = [];
let sid = 1;
for (let p = 1; p <= 12; p++) {
  players[p] = { jerseyName: 'P' + p }; anth.push({ id: p, playerId: p, date: '2026-01-01', bodyMass: { value: 70, unit: 'kg' } });
  sessions.push(S(sid++, p, 3, '2026-02-01', { 13: { L: (1.5 + p / 20) * R.G, R: (1.4 + p / 20) * R.G } }));
  sessions.push(S(sid++, p, 4, '2026-02-01', { 14: { L: 70 * R.G * 3, R: 70 * R.G * 3 } }));
  sessions.push(S(sid++, p, 1, '2026-02-01', { 11: { S: 30 + p } })); sessions.push(S(sid++, p, 2, '2026-02-01', { 12: { S: 30 } }));
}
sessions.push(S(sid++, 12, 4, '2026-03-01', { 14: { L: 1e9, R: 1e9 } }, { status: 'excluded' })); // excluida: no cuenta
players[13] = { jerseyName: 'Sintético', synthetic: 1 }; anth.push({ id: 99, playerId: 13, date: '2026-01-01', bodyMass: { value: 70, unit: 'kg' } });
sessions.push(S(sid++, 13, 3, '2026-02-01', { 13: { L: 100 * R.G, R: 100 * R.G } }), S(sid++, 13, 4, '2026-02-01', { 14: { L: 70 * R.G, R: 70 * R.G } }));
const ref = R.ratioReferences({ loc, sessions, anthropometry: anth, players, playerId: 6 });
check('jugador 6: DSI izquierdo = (1,5+6/20) ÷ 3 y EUR = 36/30', close(ref.mine.dsi.L.value, (1.5 + 6 / 20) / 3) && close(ref.mine.eur.value, 36 / 30), JSON.stringify(ref.mine.dsi.L));
check('percentil DSI sobre 11 jugadores reales (sin el propio ni el sintético), sin color por no tener dirección', ref.dsiL.n === 11 && ref.dsiL.sufficient && ref.dsiL.band === null && Math.abs(ref.dsiL.percentileStat - (5 / 11) * 100) < 1e-9, JSON.stringify(ref.dsiL));
check('ORZ sin Drop Jump de ningún jugador: oculta', ref.mine.orz.hidden === true);
check('muestra mínima respetada', R.ratioReferences({ loc, sessions, anthropometry: anth, players, playerId: 6, minN: 20 }).dsiL.sufficient === false);
process.exit(failed ? 1 : 0);
