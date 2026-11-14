import 'fake-indexeddb/auto';
import { createDb, initDb } from './db.js';
import { seedInitialCatalog } from './catalogo-inicial.js';
import { expandRelative, isViewable, hasData } from './relativos.js';
import { pairContext, pairNameOf } from './isohold.js';
import { withReferenceWeights, G } from './relaciones.js';
import { setReferenceWeight, clearReferenceWeight } from './antropometria.js';
let fail = 0; const check = (n, ok, d = '') => { console.log((ok ? 'OK   ' : 'FAIL ') + n + (ok ? '' : ' ' + d)); if (!ok) fail = 1; };
const close = (a, b, e = 1e-6) => Math.abs(a - b) < e;
const db = createDb('t-isohold-' + Math.random()); await initDb(db); await seedInitialCatalog(db);
const tests = await db.tests.toArray(), variables = await db.variables.toArray();
const T = (n) => tests.find((t) => t.name === n); const V = (t, n) => variables.find((v) => v.testId === T(t).id && v.name === n);
const p1 = await db.players.add({ jerseyName: 'A' });
const an = [{ id: 1, playerId: p1, date: '2026-01-01', bodyMass: { value: 80, unit: 'kg' } }, { id: 2, playerId: p1, date: '2026-03-01', bodyMass: { value: 90, unit: 'kg' } }];
const today = '2026-04-01';
const push = (testName, id, date, L, R, reps = { L: 3, R: 3, total: 6 }, status = 'valid') => ({ id, playerId: p1, testId: T(testName).id, date, values: { [V(testName, 'Peak Force').id]: { L, R } }, reps, status });
const hold = (testName, id, load, date = '2026-03-20') => ({ id, playerId: p1, testId: T(testName).id, date, values: { [V(testName, 'Carga externa (kg)').id]: { S: load } }, reps: {}, status: 'valid' });
async function run(holdName, pushName, pushes, holds, anthro = an) {
  const all = pushes.concat(holds); const ctx = { tests, allSessions: all };
  return expandRelative(variables, T(holdName).id, holds, anthro, ctx, today);
}
const val = (e, i, holdName, varName) => e.sessions[i].values[V(holdName, varName).id]?.S;
// Hip: SW 0,29; una sola sesión de Iso-Push con 80 kg (la medición más cercana al 10/2 es la del 1/1: 40 días frente a 19 al 1/3 → 1/3 = 90 kg)
let e = await run('Hip Iso-Hold 20 s', 'Run-Specific Hip Iso-Push', [push('Run-Specific Hip Iso-Push', 1, '2026-01-10', 1000, 1200)], [hold('Hip Iso-Hold 20 s', 10, 40)]);
const mvicHip = 1100 / G - 0.29 * 80;
check('Hip: MVIC = Peak Force media / g − 0,29 × masa de la sesión de Iso-Push (80 kg, medición más cercana al 10/1)', close(val(e, 0, 'Hip Iso-Hold 20 s', 'MVIC iso-push (kg)'), mvicHip));
check('Hip: %PIMA = carga ÷ MVIC × 100', close(val(e, 0, 'Hip Iso-Hold 20 s', '%PIMA'), (40 / mvicHip) * 100));
// Desde el 14/11/2026 todos los iso-hold usan %BW: la carga externa frente al PESO CORPORAL, para que los cuatro se lean y se comparen igual.
check('Hip: %BW = carga ÷ masa más cercana a hoy (90 kg) × 100', close(val(e, 0, 'Hip Iso-Hold 20 s', '%BW'), (40 / 90) * 100));
// Knee: BW, factor 1
e = await run('Knee Iso-Hold 20 s', 'Run-Specific Knee Iso-Push', [push('Run-Specific Knee Iso-Push', 1, '2026-01-10', 2000, 2400)], [hold('Knee Iso-Hold 20 s', 10, 60)]);
check('Knee: MVIC con factor 1 (BW) y %BW con la masa más cercana a hoy', close(val(e, 0, 'Knee Iso-Hold 20 s', 'MVIC iso-push (kg)'), 2200 / G - 80) && close(val(e, 0, 'Knee Iso-Hold 20 s', '%BW'), (60 / 90) * 100));
// Talones sentado: factor 0,05 tomado de la variable relativa del Iso-Push emparejado
e = await run('Seated Calf Raise Iso-Hold 20 s', 'Seated Calf Raise Iso-Push', [push('Seated Calf Raise Iso-Push', 1, '2026-01-10', 1000, 1200)], [hold('Seated Calf Raise Iso-Hold 20 s', 10, 20)]);
// El MVIC sigue descontando el peso del segmento con el factor 0,05 del Iso-Push emparejado; el %BW ya no usa ese factor.
check('Talones sentado: el MVIC conserva el factor 0,05 del Iso-Push y el %BW va con el peso corporal', close(val(e, 0, 'Seated Calf Raise Iso-Hold 20 s', 'MVIC iso-push (kg)'), 1100 / G - 0.05 * 80) && close(val(e, 0, 'Seated Calf Raise Iso-Hold 20 s', '%BW'), (20 / 90) * 100));
// Ponderación por repeticiones, masa de cada sesión y exclusión
e = await run('Knee Iso-Hold 20 s', 'Run-Specific Knee Iso-Push', [
  push('Run-Specific Knee Iso-Push', 1, '2026-01-10', 2000, 2000, { L: 5, R: 1, total: 6 }),
  push('Run-Specific Knee Iso-Push', 2, '2026-03-05', 2200, 2200, { L: 1, R: 1, total: 2 }),
  push('Run-Specific Knee Iso-Push', 3, '2026-03-06', 9999, 9999, { L: 1, R: 1, total: 2 }, 'excluded'),
], [hold('Knee Iso-Hold 20 s', 10, 60)]);
const num = 6 * (2000 / G - 80) + 2 * (2200 / G - 90), den = 8;
check('MVIC: ponderada por repeticiones de ambos lados, con la masa de CADA sesión de Iso-Push y sin las excluidas', close(val(e, 0, 'Knee Iso-Hold 20 s', 'MVIC iso-push (kg)'), num / den), String(val(e, 0, 'Knee Iso-Hold 20 s', 'MVIC iso-push (kg)')));
const e2 = await run('Knee Iso-Hold 20 s', 'Run-Specific Knee Iso-Push', [push('Run-Specific Knee Iso-Push', 1, '2026-01-10', 2000, 2000)], [hold('Knee Iso-Hold 20 s', 10, 60, '2026-02-01'), hold('Knee Iso-Hold 20 s', 11, 70, '2026-03-25')]);
check('MVIC igual en todas las sesiones de Iso-Hold; %PIMA cambia con la carga', close(val(e2, 0, 'Knee Iso-Hold 20 s', 'MVIC iso-push (kg)'), val(e2, 1, 'Knee Iso-Hold 20 s', 'MVIC iso-push (kg)')) && close(val(e2, 1, 'Knee Iso-Hold 20 s', '%PIMA') / val(e2, 0, 'Knee Iso-Hold 20 s', '%PIMA'), 70 / 60));
// Sin Iso-Push: MVIC y %PIMA no se calculan (contados), %BW sí
e = await run('Knee Iso-Hold 20 s', 'Run-Specific Knee Iso-Push', [], [hold('Knee Iso-Hold 20 s', 10, 60)]);
check('sin Iso-Push: MVIC y %PIMA omitidos y contados; %BW sí se calcula', val(e, 0, 'Knee Iso-Hold 20 s', 'MVIC iso-push (kg)') === undefined && val(e, 0, 'Knee Iso-Hold 20 s', '%PIMA') === undefined && e.omitted[V('Knee Iso-Hold 20 s', 'MVIC iso-push (kg)').id] === 1 && close(val(e, 0, 'Knee Iso-Hold 20 s', '%BW'), (60 / 90) * 100));
// Sin ninguna masa: nada que dependa de la masa; con peso de referencia, sí
e = await run('Knee Iso-Hold 20 s', 'Run-Specific Knee Iso-Push', [push('Run-Specific Knee Iso-Push', 1, '2026-01-10', 2000, 2000)], [hold('Knee Iso-Hold 20 s', 10, 60)], []);
check('sin masa ni peso de referencia: MVIC y %BW sin valor', val(e, 0, 'Knee Iso-Hold 20 s', 'MVIC iso-push (kg)') === undefined && val(e, 0, 'Knee Iso-Hold 20 s', '%BW') === undefined && e.omitted[V('Knee Iso-Hold 20 s', '%BW').id] === 1);
await setReferenceWeight(db, p1, '75,5', 'kg');
const players = await db.players.toArray();
e = await run('Knee Iso-Hold 20 s', 'Run-Specific Knee Iso-Push', [push('Run-Specific Knee Iso-Push', 1, '2026-01-10', 2000, 2000)], [hold('Knee Iso-Hold 20 s', 10, 60)], withReferenceWeights([], players));
check('con peso de referencia (75,5 kg) se calcula todo', close(val(e, 0, 'Knee Iso-Hold 20 s', '%BW'), (60 / 75.5) * 100) && close(val(e, 0, 'Knee Iso-Hold 20 s', 'MVIC iso-push (kg)'), 2000 / G - 75.5));
// 1RM estimado
const std = (load, date = '2026-03-10') => ({ id: 20, playerId: p1, testId: T('Single-Leg Standing Calf Raise 12RM').id, date, values: { [V('Single-Leg Standing Calf Raise 12RM', 'Carga máxima (kg)').id]: { S: load } }, reps: {}, status: 'valid' });
const rm = (anthro, s = std(50)) => expandRelative(variables, T('Single-Leg Standing Calf Raise 12RM').id, [s], anthro, { tests, allSessions: [] }, today);
check('1RM estimado = (carga + masa) × 1,4 con la masa medida más cercana a la fecha (90 kg el 10/3)', close(rm(an).sessions[0].values[V('Single-Leg Standing Calf Raise 12RM', '1RM estimado (kg)').id].S, (50 + 90) * 1.4));
check('1RM estimado: sin masa ni peso de referencia no se calcula y se cuenta; con peso de referencia sí', rm([]).sessions[0].values[V('Single-Leg Standing Calf Raise 12RM', '1RM estimado (kg)').id] === undefined && rm([]).omitted[V('Single-Leg Standing Calf Raise 12RM', '1RM estimado (kg)').id] === 1 && close(rm(withReferenceWeights([], players)).sessions[0].values[V('Single-Leg Standing Calf Raise 12RM', '1RM estimado (kg)').id].S, (50 + 75.5) * 1.4));
check('1RM solo en 12RM: el 6RM y el 8RM no tienen esa variable; sin Personal Average se aplica en pantalla (variable de carga única)', !V('Single-Leg Seated Calf Raise 6RM', '1RM estimado (kg)') && !V('Hamstring Bridge 30 cm 8RM', '1RM estimado (kg)'));
check('variables calculadas visibles y con dato: MVIC, %PIMA, %BW, 1RM', [['Hip Iso-Hold 20 s', 'MVIC iso-push (kg)'], ['Hip Iso-Hold 20 s', '%PIMA'], ['Hip Iso-Hold 20 s', '%BW'], ['Single-Leg Standing Calf Raise 12RM', '1RM estimado (kg)']].every(([t, n]) => isViewable(V(t, n))) && hasData(V('Hip Iso-Hold 20 s', '%PIMA'), [hold('Hip Iso-Hold 20 s', 1, 40)]));
check('pairContext: devuelve las sesiones del Iso-Push emparejado y nada en un test sin pareja', (await pairContext(db, tests, T('Knee Iso-Hold 20 s'))).allSessions.length === 0 && (await pairContext(db, tests, T('CMJ'))).allSessions.length === 0);
await clearReferenceWeight(db, p1);
check('peso de referencia: eliminar lo borra y se audita', (await db.players.get(p1)).referenceWeight === undefined && (await db.auditLog.toArray()).some((a) => a.action === 'peso-referencia-eliminado'));
let bad = 0; for (const x of ['', 'x', '-3']) { try { await setReferenceWeight(db, p1, x, 'kg'); bad++; } catch {} } try { await setReferenceWeight(db, p1, '70', 'stone'); bad++; } catch {}
check('peso de referencia: valor y unidad válidos obligatorios', bad === 0);
// Pareja Iso-Hold → Iso-Push: el nombre se busca sin distinguir mayúsculas ni espacios, y el nombre antiguo del Ankle Iso-Hold (el duplicado que la migración conserva) apunta a la misma pareja.
check('pareja: nombre exacto', pairNameOf('Knee Iso-Hold 20 s') === 'Run-Specific Knee Iso-Push');
check('pareja: mayúsculas y espacios no importan', pairNameOf('  hip iso-hold 20 S ') === 'Run-Specific Hip Iso-Push');
check('pareja: el prefijo «Run-Specific» del Iso-Hold no impide encontrarla (hip, knee y ankle)', ['Hip', 'Knee', 'Ankle'].every((z) => pairNameOf(`Run-Specific ${z} Iso-Hold 20 s`) === `Run-Specific ${z} Iso-Push` && pairNameOf(`${z} Iso-Hold 20 s`) === `Run-Specific ${z} Iso-Push`));
check('pareja: el talón sentado conserva la suya', pairNameOf('Seated Calf Raise Iso-Hold 20 s') === 'Seated Calf Raise Iso-Push');
// Nombres anteriores del mismo test: el usuario lo renombró el 14/11/2026 y las bases que aún lo tengan escrito como antes tienen que seguir emparejando.
check('pareja: el nombre anterior «Single-Leg Seated Calf Raise Iso-Hold 20 s» también encuentra la suya', pairNameOf('Single-Leg Seated Calf Raise Iso-Hold 20 s') === 'Seated Calf Raise Iso-Push');
check('pareja: «SL Seated Calf Raise Iso-Hold 20 s» (nombre abreviado anterior) encuentra la suya', pairNameOf('SL Seated Calf Raise Iso-Hold 20 s') === 'Seated Calf Raise Iso-Push');
check('pareja: un test que no es Iso-Hold no tiene pareja', pairNameOf('CMJ') === null && pairNameOf(null) === null);
process.exit(fail);
