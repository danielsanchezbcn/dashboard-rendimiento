import 'fake-indexeddb/auto';
import { createDb, initDb } from './db.js';
import { classText, compareWithSquad, fitLoadVelocity, parseFvGrid, cleanPoints, addFvProfile, updateFvProfile, deleteFvProfile, referenceFrom, FV_REFERENCE_DEFAULT } from './fuerzavelocidad.js';
let fail = 0; const check = (n, ok, d = '') => { console.log((ok ? 'OK   ' : 'FAIL ') + n + (ok ? '' : ' ' + d)); if (!ok) fail = 1; };
const close = (a, b, e = 1e-9) => Math.abs(a - b) < e;
const rejects = async (fn) => { try { await fn(); return null; } catch (e) { return e.message; } };
// Datos reales de Ansu Fati del Excel del usuario (6 cargas; las dos últimas columnas vacías) — resultados de la hoja: a −0,0090286, b 1,35881, Fo 150,5011, FDM 113,9504, Q 9,0286, R² 0,99213
const ansu = [[50, .905], [60, .815], [70, .73], [80, .655], [90, .52], [100, .465]].map(([load, velocity]) => ({ load, velocity }));
const r = fitLoadVelocity(ansu, { mass: 69 });
check('pendiente, intercepto y R² como la hoja del usuario', close(r.a, -0.009028571428571427) && close(r.b, 1.3588095238095237) && close(r.r2, 0.9921277053768068));
check('Fo (kg), FDM (kg) y pendiente ×1000 como la hoja', close(r.fo, 150.5010548523207, 1e-6) && close(r.fdm, 113.95042194092827, 1e-6) && close(r.slope, 9.028571428571427));
check('Vo = intercepto (la hoja usa a + b = 1,3498)', close(r.vo, 1.3588095238095237) && Math.abs(r.vo - 1.3497809523809523) < 0.01);
check('potencia óptima = Fo·Vo/4 y fuerza relativa = Fo ÷ 69 kg', close(r.pmax, r.fo * r.vo / 4) && close(r.relativeForce, 150.5010548523207 / 69, 1e-6) && close(2.1811747080046477, r.relativeForce, 1e-6));
check('clasificación BALANCED (pendiente 9,03 ≥ 9)', r.ok && r.class === 'BALANCED profile');
const cls = (s) => fitLoadVelocity([[50, 1], [100, 1 - s * 0.05]].concat([[75, 1 - s * 0.025]]).map(([load, velocity]) => ({ load, velocity }))).class;
check('umbrales: 14 velocity, 12 slight velocity, 8 slight force, 3 moderate force', cls(14) === 'Moderate VELOCITY profile' && cls(12) === 'Slight VELOCITY profile' && cls(8) === 'Slight FORCE profile' && cls(3) === 'Moderate FORCE profile', [14, 12, 8, 3].map(cls).join('|'));
check('menos de 3 cargas distintas → INVALID con motivo', (() => { const x = fitLoadVelocity(ansu.slice(0, 2)); return !x.ok && x.class === 'INVALID data' && /al menos 3/.test(x.reason); })());
check('velocidad que sube con la carga → INVALID', fitLoadVelocity([[50, .5], [60, .6], [70, .7]].map(([load, velocity]) => ({ load, velocity }))).class === 'INVALID data');
check('puntos con vacíos o texto se ignoran; coma decimal admitida', cleanPoints([{ load: '50', velocity: '0,9' }, { load: 60, velocity: null }, { load: 'x', velocity: 1 }, { load: 0, velocity: 1 }]).length === 1);
check('sin masa: fuerza relativa nula', fitLoadVelocity(ansu).relativeForce === null);
const rows = [['PERFIL'], [null, 'Carga 1', 'Carga 2'], ['CARGA', 50, 60, 70, 80, 90, 100, 110, 130], ['VMP', .905, .815, .73, .655, .52, .465, null, null], ['EXTERNAL POWER', 1, 2], [], ['BW', 'CARGA', 50, 60], [88, 'VMP', 1.1, 1.0]];
const blocks = parseFvGrid(rows);
check('lectura del Excel: 6 puntos del primer bloque y el bloque de referencia', blocks.length === 2 && blocks[0].points.length === 6 && blocks[0].points[5].load === 100 && blocks[1].points.length === 2);
check('sin filas CARGA/VMP → ningún bloque', parseFvGrid([[1, 2], [3, 4]]).length === 0);
check('referencia por defecto: 8 puntos del Excel; ajuste inválido → por defecto', FV_REFERENCE_DEFAULT.length === 8 && referenceFrom(undefined) === FV_REFERENCE_DEFAULT && referenceFrom([{ load: 50, velocity: 1 }]) === FV_REFERENCE_DEFAULT && referenceFrom([{ load: 50, velocity: 1 }, { load: 60, velocity: .9 }]).length === 2);
const db = createDb('t-fv-' + Math.random()); await initDb(db);
const p = await db.players.add({ jerseyName: 'A' }); const s = await db.players.add({ jerseyName: 'S', synthetic: 1 });
const id = await addFvProfile(db, { playerId: p, date: '2026-11-07', exercise: 'Sentadilla', points: ansu });
let row = await db.fvProfiles.get(id);
check('alta: 6 puntos, FDM 0,33 por defecto, origen manual', row.points.length === 6 && row.fdmVelocity === 0.33 && row.source === 'manual' && row.exercise === 'Sentadilla' && !row.synthetic);
check('alta de jugador sintético → perfil sintético', (await db.fvProfiles.get(await addFvProfile(db, { playerId: s, date: '2026-11-07', points: ansu }))).synthetic === 1);
check('rechazos: fecha, <3 cargas, repetidas, rango, FDM, jugador', (await Promise.all([
  rejects(() => addFvProfile(db, { playerId: p, date: '07/11/2026', points: ansu })), rejects(() => addFvProfile(db, { playerId: p, date: '2026-11-07', points: ansu.slice(0, 2) })),
  rejects(() => addFvProfile(db, { playerId: p, date: '2026-11-07', points: ansu.concat([ansu[0]]) })), rejects(() => addFvProfile(db, { playerId: p, date: '2026-11-07', points: ansu.concat([{ load: 5000, velocity: .2 }]) })),
  rejects(() => addFvProfile(db, { playerId: p, date: '2026-11-07', points: ansu, fdmVelocity: 9 })), rejects(() => addFvProfile(db, { playerId: 999, date: '2026-11-07', points: ansu }))])).every(Boolean));
await updateFvProfile(db, id, { date: '2026-11-08', exercise: 'Press', points: ansu.slice(0, 4), fdmVelocity: '0,3' });
row = await db.fvProfiles.get(id);
check('corrección: sustituye fecha, ejercicio, puntos y FDM en la misma fila', row.date === '2026-11-08' && row.points.length === 4 && row.fdmVelocity === 0.3 && !!row.correctedAt && (await db.fvProfiles.count()) === 2);
await deleteFvProfile(db, id);
check('baja', (await db.fvProfiles.get(id)) === undefined && /no existe/.test(await rejects(() => deleteFvProfile(db, id))));
const au = (await db.auditLog.toArray()).filter((a) => a.action.startsWith('perfil-fv'));
check('auditoría sin valores de carga ni velocidad', au.length === 4 && !/0\.905|0,905|"load"/.test(JSON.stringify(au.map((a) => a.scope))));
check('alias: Force → déficit de fuerza con cargas ligeras; Velocity → con cargas elevadas; Balanced sin alias', classText('Slight FORCE profile').includes('cargas ligeras') && classText('Moderate FORCE profile').includes('cargas ligeras') && classText('Slight VELOCITY profile').includes('cargas elevadas') && classText('Moderate VELOCITY profile').includes('cargas elevadas') && classText('BALANCED profile') === 'BALANCED profile');
// Comparación con La Liga: 12 jugadores con perfil, el evaluado es el 13.º; uno sintético y otro de otro ejercicio no cuentan
const sq = {}; const profs = []; const an = [];
for (let i = 1; i <= 13; i++) { sq[i] = { id: i, jerseyName: 'J' + i }; an.push({ playerId: i, date: '2026-01-01', bodyMass: { value: 70, unit: 'kg' } });
  profs.push({ id: i, playerId: i, date: '2026-10-01', exercise: 'Sentadilla', fdmVelocity: 0.33, points: [50, 70, 90].map((load) => ({ load, velocity: 1.2 + i * 0.01 - load * (0.009 + i * 0.0001) })) }); }
sq[14] = { id: 14, jerseyName: 'S', synthetic: 1 }; profs.push({ id: 20, playerId: 14, date: '2026-10-01', exercise: 'sentadilla', fdmVelocity: 0.33, points: ansu });
sq[15] = { id: 15, jerseyName: 'O' }; profs.push({ id: 21, playerId: 15, date: '2026-10-01', exercise: 'Press', fdmVelocity: 0.33, points: ansu });
profs.push({ id: 22, playerId: 1, date: '2026-01-01', exercise: 'Sentadilla', fdmVelocity: 0.33, points: ansu }); // más antiguo del jugador 1: no cuenta
const cur = profs.find((x) => x.playerId === 13);
const cmp = compareWithSquad({ profiles: profs, players: sq, anthropometry: an, playerId: 13, current: { ...cur, exercise: 'SENTADILLA ' }, minN: 10 });
check('comparación: N = 12 (sin él, sin sintético, sin otro ejercicio, un perfil por jugador)', cmp.every((r) => r.ev.n === 12), cmp.map((r) => r.ev.n).join());
check('Vo, Fo÷masa y potencia con banda de color; pendiente con color de posición (positional)', cmp.filter((r) => r.direction === 'higher').every((r) => r.ev.band !== null) && cmp.find((r) => r.key === 'slope').ev.band !== null && cmp.find((r) => r.key === 'slope').ev.positional === true && cmp.find((r) => r.key === 'slope').ev.percentileStat !== null);
const few = compareWithSquad({ profiles: profs.slice(0, 5), players: sq, anthropometry: an, playerId: 5, current: profs[4], minN: 10 });
check('muestra insuficiente: sin percentil y con el motivo', few[0].ev.percentileStat === null && /insuficiente/.test(few[0].ev.reason));
const noMass = compareWithSquad({ profiles: profs, players: sq, anthropometry: [], playerId: 13, current: cur, minN: 10 });
check('sin masa de nadie: Fo ÷ masa sin valor; Vo sí', noMass.find((r) => r.key === 'rel').value === null && noMass.find((r) => r.key === 'vo').value !== null);
process.exit(fail);
