import 'fake-indexeddb/auto';
import * as D from './db.js';
import * as E from './evolucion.js';
import * as I from './catalogo-inicial.js';

let failed = 0;
const check = (n, c, x = '') => { console.log(`${c ? 'OK  ' : 'FAIL'} ${n} ${x}`); if (!c) failed++; };
const S = (id, date, L, R, repsL = 3, repsR = 3, extra = {}) => ({ id, playerId: 1, testId: 1, date, time: '', values: { 9: { L, R } }, reps: { L: repsL, R: repsR }, status: 'valid', ...extra });
const sessions = [S(1, '2026-01-10', 100, 110), S(2, '2026-02-10', 120, 100, 5, 5), S(3, '2026-03-10', 90, 95, 3, 3, { status: 'excluded', excludedReason: 'lesión' }), S(4, '2026-04-10', 120, 105, 2, 2)];
const L = E.buildSeries(sessions, 9, 'L');
check('serie: 3 válidas ordenadas y 1 excluida aparte', L.valid.map((p) => p.sessionId).join() === '1,2,4' && L.excluded.length === 1 && L.excluded[0].excludedReason === 'lesión');
check('serie: filtro por fechas', E.buildSeries(sessions, 9, 'L', { from: '2026-02-01', to: '2026-03-31' }).valid.length === 1);
const pa = E.personalAverage(L.valid);
check('Personal Average ponderado por Reps (100·3+120·5+120·2)/10 = 114', pa.defined && Math.abs(pa.value - 114) < 1e-9 && pa.sessions === 3 && pa.reps === 10 && pa.weightedByReps);
check('Personal Average sin Reps: pesa 1 y se avisa', E.personalAverage([{ value: 10, reps: null }, { value: 20, reps: 2 }]).weightedByReps === false);
const pbH = E.personalBest(L.valid, 'higher');
check('Personal Best (más alto): empate 120 → la más reciente (D22)', pbH.defined && pbH.value === 120 && pbH.date === '2026-04-10' && pbH.tied && !pbH.sameDayTie);
check('Personal Best (más bajo)', E.personalBest(L.valid, 'lower').value === 100);
check('Personal Best sin dirección o con rango objetivo: no definido', !E.personalBest(L.valid, null).defined && /catálogo/.test(E.personalBest(L.valid, null).reason) && !E.personalBest(L.valid, 'target').defined && /D23/.test(E.personalBest(L.valid, 'target').reason));
check('las excluidas no cuentan en el Personal Best', E.personalBest(E.buildSeries([S(5, '2026-05-01', 500, 500, 3, 3, { status: 'excluded' }), ...sessions], 9, 'L').valid, 'higher').value === 120);
check('sin sesiones: no definido', !E.personalAverage([]).defined && !E.personalBest([], 'higher').defined);
const as = E.asymmetrySeries(sessions, 9);
check('asimetría D25: (R−L)/máx×100; excluida fuera', as.length === 3 && Math.abs(as[0].pct - (10 / 110) * 100) < 1e-9 && as[1].pct < 0 && as[2].pct < 0);
check('actual = último punto válido', E.currentResult(L.valid).sessionId === 4);
const single = [{ id: 1, date: '2026-01-01', values: { 7: { S: 5 } }, reps: { total: 3 }, status: 'valid' }];
check('valor único (S) con sus repeticiones', E.buildSeries(single, 7, 'S').valid[0].reps === 3);
// acciones con base de datos
const db = D.createDb('ev-1'); await D.initDb(db);
const pid = await db.players.add({ jerseyName: 'Jugador X', active: true });
const a = await db.sessions.add({ playerId: pid, testId: 1, date: '2026-01-10', values: {}, reps: {}, status: 'valid', excludedReason: '' });
const b = await db.sessions.add({ playerId: pid, testId: 1, date: '2026-01-11', values: {}, reps: {}, status: 'valid', excludedReason: '' });
await E.setSessionExcluded(db, a, true, 'prueba fallida');
check('excluir es reversible y guarda el motivo', (await db.sessions.get(a)).status === 'excluded' && (await db.sessions.get(a)).excludedReason === 'prueba fallida');
await E.setSessionExcluded(db, a, false);
check('reincorporar limpia estado y motivo', (await db.sessions.get(a)).status === 'valid' && (await db.sessions.get(a)).excludedReason === '');
let err = ''; try { await E.deleteSessionPermanently(db, a, { playerName: 'otro', date: '2026-01-10' }); } catch (e) { err = e.message; }
check('eliminar exige jugador y fecha exactos', /no coincide/.test(err) && (await db.sessions.count()) === 2);
await E.deleteSessionPermanently(db, a, { playerName: 'Jugador X', date: '2026-01-10' });
check('eliminar borra solo esa sesión', !(await db.sessions.get(a)) && !!(await db.sessions.get(b)));
// Borrado masivo de las sesiones de un test (todos los jugadores), para volver a importar desde cero
{
  const dbx = D.createDb('ev-borrado'); await D.initDb(dbx);
  const t1 = await dbx.tests.add({ name: 'Supine Isometric Ankle Inversion', blockKey: 'fuerza' });
  const t2 = await dbx.tests.add({ name: 'Supine Isometric Ankle Eversion', blockKey: 'fuerza' });
  const p1 = await dbx.players.add({ jerseyName: 'A', active: true }), p2 = await dbx.players.add({ jerseyName: 'B', active: true });
  const ses = [];
  for (const pid of [p1, p2]) for (const [tid, fecha] of [[t1, '2026-11-05'], [t1, '2026-11-12'], [t2, '2026-11-05']]) ses.push({ playerId: pid, testId: tid, date: fecha, time: '', values: { 1: { L: 10, R: 11 } }, reps: {}, status: 'valid', source: 'Excel' });
  await dbx.sessions.bulkAdd(ses);
  const res = await E.testSessionsSummary(dbx, t1);
  check('resumen por fecha: dos fechas, dos jugadores cada una', res.total === 4 && res.jugadores === 2 && res.fechas.map((f) => `${f.date}:${f.sesiones}:${f.jugadores}`).join('|') === '2026-11-05:2:2|2026-11-12:2:2' && res.fechas[0].origenes === 'Excel');
  let e1 = ''; try { await E.deleteTestSessions(dbx, t1, { confirmText: 'ankle inversion' }); } catch (e) { e1 = e.message; }
  check('borrado masivo: exige el nombre exacto del test', /nombre del test/.test(e1) && (await dbx.sessions.count()) === 6);
  const r1 = await E.deleteTestSessions(dbx, t1, { confirmText: '  supine isometric ANKLE inversion ', date: '2026-11-12' });
  check('borrado de una sola fecha: solo esas sesiones', r1.eliminadas === 2 && r1.jugadores === 2 && (await dbx.sessions.count()) === 4 && !(await dbx.sessions.toArray()).some((x) => x.date === '2026-11-12'));
  const r2 = await E.deleteTestSessions(dbx, t1, { confirmText: 'Supine Isometric Ankle Inversion' });
  check('borrado de todas las fechas: no toca el otro test', r2.eliminadas === 2 && (await dbx.sessions.toArray()).every((x) => x.testId === t2));
  let e2 = ''; try { await E.deleteTestSessions(dbx, t1, { confirmText: 'Supine Isometric Ankle Inversion' }); } catch (e) { e2 = e.message; }
  check('borrado sin sesiones: avisa y no rompe', /No hay sesiones/.test(e2));
  const lg = await dbx.auditLog.toArray();
  check('auditoría del borrado masivo: cantidad y fechas, sin valores', lg.filter((l) => l.action === 'sesiones-test-eliminadas').length === 2 && !JSON.stringify(lg).includes('"L":10'));
}
const log = await db.auditLog.toArray();
check('auditoría sin valores', ['sesion-excluida', 'sesion-reincorporada', 'sesion-eliminada'].every((x) => log.some((l) => l.action === x)) && !JSON.stringify(log).includes('prueba fallida'));
// D50: migración de un catálogo anterior (seed v3, sin direcciones)
{
  const dbm = D.createDb('ev-mig'); await D.initDb(dbm); await I.seedInitialCatalog(dbm);
  const vs = await dbm.variables.toArray();
  const keep = vs.find((v) => v.unit !== '%'); // el usuario ya había puesto «más bajo es mejor» en una
  for (const v of vs) await dbm.variables.update(v.id, { direction: v.id === keep.id ? 'lower' : null });
  await dbm.meta.put({ key: 'catalogSeeded', value: { version: 3 } });
  const r = await I.seedInitialCatalog(dbm);
  const after = await dbm.variables.toArray();
  check('migración v3→v4: asigna «más alto» a las que no tenían, respeta la ya definida y deja las asimetrías (%) sin dirección', r.direccionesAsignadas > 0 && after.find((v) => v.id === keep.id).direction === 'lower' && after.filter((v) => v.unit === '%').every((v) => v.direction === null) && after.filter((v) => v.unit !== '%' && v.unit !== 'cm' && v.unit !== '°' && v.name !== 'TOE-TOUCH TEST' && v.name !== 'DROP LANDING' && v.id !== keep.id).every((v) => v.direction === (I.LOWER_IS_BETTER.test(v.name) ? 'lower' : 'higher')), JSON.stringify(r));
  check('queda en el registro', (await dbm.auditLog.toArray()).some((l) => l.action === 'catalogo-direccion-por-defecto'));
}
process.exit(failed ? 1 : 0);
