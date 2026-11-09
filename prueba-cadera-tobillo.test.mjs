// Cadera (aducción/abducción) y tobillo (inversión/eversión): variables, fórmula relativa y columna de longitud de pierna en la importación. Datos sintéticos.
import 'fake-indexeddb/auto';
import { webcrypto } from 'node:crypto';
if (!globalThis.crypto?.subtle) globalThis.crypto = webcrypto;
import * as D from './db.js';
import * as CI from './catalogo-inicial.js';
import { listCatalog } from './catalogo.js';
import * as I from './importacion.js';
import { createPlayer } from './jugadores.js';
import { expandRelative } from './relativos.js';
import { addAnthropometry } from './antropometria.js';
import { locate, relationsFor, ratioReferences } from './relaciones.js';
let failed = 0; const check = (n, c, x = '') => { console.log(`${c ? 'OK  ' : 'FAIL'} ${n} ${x}`); if (!c) failed++; };
const close = (a, b) => Math.abs(a - b) < 1e-9;

const db = D.createDb('cadera-1'); await D.initDb(db); await CI.seedInitialCatalog(db);
const cat = await listCatalog(db);
const t = cat.tests.find((x) => x.name === 'Hip Adduction 45° (Short Lever)');
const vars = cat.variables.filter((v) => v.testId === t.id);
check('cadera: solo Peak Force (N, valor único) y relativo (N·m/kg)', vars.length === 2 && vars[0].name === 'Peak Force' && vars[0].sides === 'single' && vars[1].formula.op === 'REL_LEVER' && vars[1].unit === 'N·m/kg', JSON.stringify(vars.map((v) => v.name)));
const ankle = cat.tests.find((x) => x.name === 'Supine Isometric Ankle Inversion');
const av = cat.variables.filter((v) => v.testId === ankle.id);
check('tobillo: Peak Force por lado y relativo BW', av.length === 2 && av[0].sides === 'LR' && av[1].formula.op === 'REL_BW' && av[1].unit === 'BW');

// Importación con columna de peso y de longitud de pierna (m), fecha única
const grid = [['PLAYER', 'LEVER LENGTH', 'BODYWEIGHT (KG)', 'SHORT LEVER'], ['Jugador Uno', 0.84, 78, 356], ['Jugador Dos', 96, 70, 300]];
const h = I.effectiveHeaders(grid, 0, false);
const m = I.suggestMapping(h, vars);
check('propone pierna y peso', m[1].role === 'pierna' && m[2].role === 'peso', JSON.stringify(m.map((x) => x.role)));
m[0].role = 'jugador'; m[3] = { role: 'valor', variableId: vars[0].id, side: 'S' };
const parsed = I.buildRows(grid, { headerRow: 0, cols: m, fixedDate: '2026-11-01' }, vars);
check('valida el mapeo', I.validateMapping({ cols: m, headerRow: 0, fixedDate: '2026-11-01' }, vars).length === 0);
check('96 m se rechaza (otra unidad), 0,84 m se acepta', parsed.rows[0].ok && parsed.rows[0].body.legLength === 0.84 && !parsed.rows[1].ok, JSON.stringify(parsed.rows.map((r) => r.ok)));
const id = await createPlayer(db, { jerseyName: 'Jugador Uno', fullName: '', synthetic: true });
const plan = await I.planImport(db, { rows: parsed.rows, testId: t.id, resolutions: { 'Jugador Uno': { action: 'link', playerId: id } } });
check('plan: longitud nueva', plan.counts.piernasNuevas === 1 && plan.counts.nuevas === 1, JSON.stringify(plan.counts));
const r = await I.commitImport(db, { file: { name: 'x.xlsx', hash: 'h', size: 1 }, sheetName: 'H', testId: t.id, mapping: {}, parsed, plan, rememberAlias: {} });
check('guarda sesión, peso y longitud', r.counts.sesionesCreadas === 1 && r.counts.pesosGuardados === 1 && r.counts.piernasGuardadas === 1, JSON.stringify(r.counts));
const an = await db.anthropometry.where('playerId').equals(id).toArray();
check('antropometría con legLength 0,84 m', an.length === 1 && an[0].legLength.value === 0.84 && an[0].legLength.unit === 'm');

// Fórmula: 356 N × 0,84 m ÷ 78 kg = 3,8338… (mismo número que el Excel del usuario)
const sess = await db.sessions.where('playerId').equals(id).toArray();
const anth = (await db.anthropometry.toArray()).concat([{ playerId: id, date: null, bodyMass: { value: 78, unit: 'kg' }, reference: true }]);
const ex = expandRelative(cat.variables, t.id, sess, anth);
check('relativo = N × m ÷ kg', close(ex.sessions[0].values[vars[1].id].S, (356 * 0.84) / 78), String(ex.sessions[0].values[vars[1].id]?.S));
// sin longitud: no hay valor y se cuenta
const ex2 = expandRelative(cat.variables, t.id, sess, anth.filter((a) => !a.legLength));
check('sin longitud de pierna no hay valor', ex2.sessions[0].values[vars[1].id] === undefined && ex2.omitted[vars[1].id] === 1);
// tobillo: N ÷ (kg × g)
const as = [{ id: 1, playerId: id, testId: ankle.id, date: '2026-11-01', time: '', values: { [av[0].id]: { L: 323, R: 300 } } }];
const ex3 = expandRelative(cat.variables, ankle.id, as, anth);
check('tobillo relativo BW', close(ex3.sessions[0].values[av[1].id].L, 323 / (78 * 9.80665)));

// Ratios del Excel (Personal Best ÷ Personal Best): cadera 297 ÷ 244 = 1,2172…; tobillo 323 ÷ 355 y 300 ÷ 345,2 (valores del Excel; jugadores sintéticos)
const loc = locate(cat.tests, cat.variables);
const T = (n) => cat.tests.find((x) => x.name === n);
const pf = (n) => cat.variables.find((v) => v.testId === T(n).id && v.name === 'Peak Force').id;
const mkS = (pid, testName, date, values) => ({ id: Math.random(), playerId: pid, testId: T(testName).id, protocolId: null, date, time: '', values: { [pf(testName)]: values }, reps: { total: 1 }, status: 'valid' });
const pids = []; for (let k = 0; k < 12; k++) pids.push(await createPlayer(db, { jerseyName: 'R' + k, fullName: '', synthetic: false }));
const ss = [];
pids.forEach((pid, k) => {
  ss.push(mkS(pid, 'Hip Adduction 0° (Long Lever)', '2026-10-01', { S: 297 + k * 10 }), mkS(pid, 'Hip Abduction 0° (Long Lever)', '2026-10-01', { S: 244 }));
  ss.push(mkS(pid, 'Supine Isometric Ankle Inversion', '2026-10-01', { L: 323 + k * 5, R: 300 }), mkS(pid, 'Supine Isometric Ankle Eversion', '2026-10-01', { L: 355, R: 345.2 }));
});
ss.push(mkS(pids[0], 'Hip Adduction 0° (Long Lever)', '2026-10-15', { S: 280 })); // peor que el PB: no cuenta
const rel = relationsFor({ loc, sessions: ss, anthropometry: [], playerId: pids[0] });
check('ratio cadera = 297 ÷ 244 (Personal Best)', close(rel.hip.value, 297 / 244), String(rel.hip.value));
check('ratio tobillo L y R', close(rel.ankle.L.value, 323 / 355) && close(rel.ankle.R.value, 300 / 345.2));
check('asimetría del ratio (D25)', close(rel.ankleAsym, ((300 / 345.2 - 323 / 355) / Math.max(323 / 355, 300 / 345.2)) * 100), String(rel.ankleAsym));
const pl = Object.fromEntries((await db.players.toArray()).map((p) => [p.id, p]));
const refs = ratioReferences({ loc, sessions: ss, anthropometry: [], players: pl, playerId: pids[0], minN: 10 });
check('percentil con color de posición', refs.hip?.sufficient && refs.hip.percentileStat !== null && refs.hip.band != null && refs.ankleL?.sufficient, JSON.stringify([refs.hip?.percentileStat, refs.hip?.band]));
const sinDen = relationsFor({ loc, sessions: ss.filter((x) => x.testId !== T('Hip Abduction 0° (Long Lever)').id), anthropometry: [], playerId: pids[0] });
check('sin abducción no hay ratio y se explica', sinDen.hip.defined === false && /denominador/.test(sinDen.hip.reason));
console.log(failed ? `${failed} FALLOS` : 'TODO OK');
process.exit(failed ? 1 : 0);
