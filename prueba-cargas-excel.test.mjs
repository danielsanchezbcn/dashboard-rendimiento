import 'fake-indexeddb/auto';
import { createDb, initDb } from './db.js';
import { seedInitialCatalog } from './catalogo-inicial.js';
import { listCatalog } from './catalogo.js';
import { createPlayer } from './jugadores.js';
import { parseLoadSheet, parseTwoWaySheet, guessLoadTest, guessTwoWayTests, loadTests, proposeLinks, commitLoads, commitTwoWay } from './cargas-excel.js';
import { expandRelative } from './relativos.js';
import { addManualLoad } from './isohold.js';
let fail = 0; const check = (n, ok, d = '') => { console.log((ok ? 'OK   ' : 'FAIL ') + n + (ok ? '' : ' ' + d)); if (!ok) fail = 1; };
const db = createDb('t-cargas-' + Math.random()); await initDb(db); await seedInitialCatalog(db);
const cat = await listCatalog(db);
// Hoja con la forma de los libros del usuario (datos sintéticos): fila 1 título, fila 2 cabeceras, cargas en la columna L
const hdr1 = ['HAMSTRING', null, 'BODYWEIGHT', null, null, 'F', null, null, null, null, 'MONITORIZACIÓN HIP ISO-HOLD 20 SEGUNDOS'];
const hdr2 = [null, null, 'KILOGRAMS', 'NEWTONS', 'SW', 'LEFT', 'RIGHT', 'L/SW', 'R/SW', 'ASYMMETRY', 'MVIC ISO-PUSH', 'ADDED EXTERNAL LOAD', '%PIMA', '%SW'];
const row = (n, k, load) => [n, k, 78, 765, 22, 420, 396, 1, 1, 5, 19, load, null, null];
const rows = [hdr1, hdr2, row('JUGADOR A', 1, 12.5), row('JUGADOR B', 2, 10), row('JUGADOR C', 3, null), row('JUGADOR D', 4, 0), row('JUGADOR E', 5, 'abc'), row('Jugador X', 6, '7,5')];
const p = parseLoadSheet(rows);
check('detecta cabecera (fila 2) y columna de carga (L)', p.ok && p.headerRow === 1 && p.loadCol === 11 && p.nameCol === 0, JSON.stringify(p));
check('lee 6 filas: 0 es carga válida; vacía y texto se marcan', p.rows.length === 6 && p.rows[3].load === 0 && p.rows[2].empty && p.rows[4].error && p.rows[5].load === 7.5);
check('otra forma: «EXTERNAL LOAD ADDED» en la columna K, nombres en A', parseLoadSheet([[null], ['x', 'y', 'z', 'w', 'v', 'u', 'a', 'b', 'c', 'd', 'EXTERNAL LOAD ADDED'], ['A', 1, 1, 1, 1, 1, 1, 1, 1, 1, 29]]).rows[0].load === 29);
check('hoja sin cabecera de carga: error claro', !parseLoadSheet([['a', 'b'], ['c', 1]]).ok);
const tests = loadTests(cat);
check('guessLoadTest: hoja HIP → Hip Iso-Hold; KNEE → Knee; sin pistas → null', guessLoadTest('HIP', '', tests)?.name === 'Hip Iso-Hold 20 s' && guessLoadTest('KNEE', '', tests)?.name === 'Knee Iso-Hold 20 s' && guessLoadTest('Hoja1', 'nada', tests) === null);
const hold = cat.tests.find((t) => t.name === 'Hip Iso-Hold 20 s');
const a = await createPlayer(db, { jerseyName: 'JUGADOR A' }); const b = await createPlayer(db, { jerseyName: 'JUGADOR B' }); const d = await createPlayer(db, { jerseyName: 'JUGADOR D' });
const links = await proposeLinks(db, p.rows.map((r) => r.name));
check('vinculación automática solo para coincidencias completas', links['JUGADOR A'].autoId === a && links['JUGADOR B'].autoId === b && links['Jugador X'].autoId === null);
const items = p.rows.map((r) => ({ name: r.name, load: r.load, playerId: links[r.name].autoId, remember: false }));
const res = await commitLoads(db, { testId: hold.id, date: '2026-11-10', items });
check('importa A (12,5), B (10) y D (0); el resto se omite', res.creadas === 3 && res.omitidas === 3, JSON.stringify(res));
const ses = await db.sessions.where('testId').equals(hold.id).toArray();
const v = cat.variables.find((x) => x.testId === hold.id && x.name === 'Carga externa (kg)');
check('sesiones manuales con la carga y la fecha elegida', ses.length === 3 && ses.every((s) => s.source === 'manual' && s.date === '2026-11-10') && ses.find((s) => s.playerId === a).values[v.id].S === 12.5 && ses.find((s) => s.playerId === d).values[v.id].S === 0);
const res2 = await commitLoads(db, { testId: hold.id, date: '2026-11-10', items });
check('repetir la importación no duplica (3 duplicadas, 0 creadas)', res2.creadas === 0 && res2.duplicadas === 3 && (await db.sessions.where('testId').equals(hold.id).count()) === 3, JSON.stringify(res2));
const res3 = await commitLoads(db, { testId: hold.id, date: '2026-11-11', items: [{ name: 'Jugador X', load: 7.5, playerId: a, remember: true }, { name: 'JUGADOR A', load: 3, playerId: a, remember: false }] });
check('el mismo jugador dos veces en el Excel: solo la primera fila; alias recordado', res3.creadas === 1 && res3.alias === 1 && res3.incidencias.length === 1 && (await db.playerAliases.toArray()).some((x) => x.playerId === a && x.rawText === 'Jugador X'), JSON.stringify(res3));
// ---- Libros con medida bilateral y por pierna en la misma hoja (23/11/2026, Leg Press 45° 8RM) ----
// Cabeceras tal cual vienen en el libro del usuario, errata «IZQIUERDA» incluida, y con las columnas de relativo y asimetría que NO se leen.
const lp1 = ['QUADRICEPS', 'BODYWEIGHT', 'LEG PRESS 45º (8 REPETICIONES) (Bajando a 90º de flexión de rodilla) (40bpm)'];
const lp2 = [null, 'KILOGRAMS', 'DOUBLE LEG', 'RELATIVO A PESO INDIVIDUAL', 'IZQIUERDA', 'DERECHA', 'ASYMMETRY', 'RELATIVO A PESO INDIVIDUAL'];
const lpRow = (n, peso, doble, izq, der) => [n, peso, doble, 9.9, izq, der, 9.9, 9.9]; // las dos últimas y la cuarta son relativo/asimetría: se ignoran
const lpRows = [lp1, lp2,
  lpRow('JUGADOR A', 78, 100, 25, 25),
  lpRow('JUGADOR B', 85, 140, 30, 32),
  lpRow('JUGADOR C', 79, null, null, null),
  lpRow('JUGADOR D', 70, null, 40, null),
  lpRow('JUGADOR E', 70, 'abc', 20, 20),
  lpRow('JUGADOR F', 70, 2000, 20, 20),
];
const lp = parseTwoWaySheet(lpRows);
check('dos medidas: cabecera en la fila 2, nombres en A, bilateral en C, piernas en E y F (con la errata «IZQIUERDA»)',
  lp.ok && lp.headerRow === 1 && lp.nameCol === 0 && lp.dobleCol === 2 && lp.izqCol === 4 && lp.derCol === 5, JSON.stringify({ ok: lp.ok, h: lp.headerRow, n: lp.nameCol, d: lp.dobleCol, i: lp.izqCol, r: lp.derCol }));
check('dos medidas: lee las tres cargas y NO toca las columnas de relativo ni de asimetría',
  JSON.stringify(lp.rows[0]) === JSON.stringify({ name: 'JUGADOR A', doble: 100, izq: 25, der: 25, rowNumber: 3, empty: false }), JSON.stringify(lp.rows[0]));
check('dos medidas: fila con nombre y sin ninguna carga se marca vacía', lp.rows[2].empty === true && lp.rows[2].doble === null);
check('dos medidas: vale una sola pierna', lp.rows[3].izq === 40 && lp.rows[3].der === null && lp.rows[3].empty === false);
check('dos medidas: texto y valores fuera de rango dan incidencia, sin tumbar la fila', /no válida/.test(lp.rows[4].error ?? '') && /no válida/.test(lp.rows[5].error ?? '') && lp.rows[4].izq === 20 && lp.rows[5].doble === null);
check('dos medidas: hoja sin esas columnas, error claro', !parseTwoWaySheet([['a', 'b'], ['c', 1]]).ok);
const par = guessTwoWayTests('KNEE', lp1.join(' '), tests);
check('dos medidas: propone la pareja de Leg Press a partir del título', par.doble?.name === 'Double-Leg Leg Press 45° 8RM' && par.uni?.name === 'Single-Leg Leg Press 45° 8RM', JSON.stringify({ d: par.doble?.name, u: par.uni?.name }));
check('dos medidas: sin pistas de leg press no propone nada', guessTwoWayTests('Hoja1', 'nada', tests).doble === null);

const vDoble = cat.variables.find((x) => x.testId === par.doble.id && x.name === 'Carga máxima (kg)');
const vUni = cat.variables.find((x) => x.testId === par.uni.id && x.name === 'Carga máxima (kg)');
check('catálogo: la carga del bilateral es de valor único y la del unilateral va por pierna', vDoble.sides === 'single' && vUni.sides === 'LR', `${vDoble.sides}/${vUni.sides}`);
const bwDoble = cat.variables.find((x) => x.testId === par.doble.id && x.name === '%BW');
const bwUni = cat.variables.find((x) => x.testId === par.uni.id && x.name === '%BW');
check('catálogo: los dos tests tienen %BW calculado sobre su carga, más alto es mejor',
  bwDoble.kind === 'derived' && bwDoble.formula.op === 'LOAD_BW' && bwDoble.formula.operands[0] === vDoble.id && bwDoble.unit === '%' && bwDoble.direction === 'higher'
  && bwUni.formula.op === 'LOAD_BW' && bwUni.formula.operands[0] === vUni.id && bwUni.sides === 'LR', JSON.stringify({ d: bwDoble.formula.op, u: bwUni.sides }));

const lpItems = lp.rows.map((r) => ({ name: r.name, doble: r.doble, izq: r.izq, der: r.der, playerId: ({ 'JUGADOR A': a, 'JUGADOR B': b, 'JUGADOR D': d })[r.name] ?? null, remember: false }));
const lpRes = await commitTwoWay(db, { testDobleId: par.doble.id, testUniId: par.uni.id, date: '2026-11-20', items: lpItems });
check('dos medidas: crea 2 bilaterales (A y B) y 3 por pierna (A, B y D)', lpRes.creadasDoble === 2 && lpRes.creadasUni === 3, JSON.stringify(lpRes));
const sDoble = await db.sessions.where('testId').equals(par.doble.id).toArray();
const sUni = await db.sessions.where('testId').equals(par.uni.id).toArray();
check('dos medidas: el bilateral guarda un valor único y el unilateral guarda cada pierna',
  sDoble.find((s) => s.playerId === a).values[vDoble.id].S === 100
  && JSON.stringify(sUni.find((s) => s.playerId === b).values[vUni.id]) === JSON.stringify({ L: 30, R: 32 })
  && JSON.stringify(sUni.find((s) => s.playerId === d).values[vUni.id]) === JSON.stringify({ L: 40 }), JSON.stringify(sUni.map((s) => s.values[vUni.id])));
const lpRes2 = await commitTwoWay(db, { testDobleId: par.doble.id, testUniId: par.uni.id, date: '2026-11-20', items: lpItems });
check('dos medidas: repetir la importación no duplica', lpRes2.creadasDoble === 0 && lpRes2.creadasUni === 0 && lpRes2.duplicadas === 5, JSON.stringify(lpRes2));

// ---- %BW: carga ÷ masa de la fecha de la sesión × 100, también por pierna ----
await db.anthropometry.add({ playerId: a, date: '2026-11-18', bodyMass: { value: 80, unit: 'kg' } });
const todasVars = await db.variables.toArray();
const anth = await db.anthropometry.toArray();
const expD = expandRelative(todasVars, par.doble.id, sDoble, anth);
const expU = expandRelative(todasVars, par.uni.id, sUni, anth);
const relD = expD.sessions.find((s) => s.playerId === a).values[bwDoble.id];
const relU = expU.sessions.find((s) => s.playerId === a).values[bwUni.id];
check('%BW bilateral: 100 kg con 80 kg de masa = 125 %', Math.abs(relD.S - 125) < 1e-9, JSON.stringify(relD));
check('%BW por pierna: 25 kg con 80 kg de masa = 31,25 % en cada pierna', Math.abs(relU.L - 31.25) < 1e-9 && Math.abs(relU.R - 31.25) < 1e-9, JSON.stringify(relU));
check('%BW: sin masa ni peso de referencia no hay valor, y se cuenta', expD.omitted[bwDoble.id] >= 1, JSON.stringify(expD.omitted));

// ---- Alta manual por pierna ----
const manual = await addManualLoad(db, { playerId: a, testId: par.uni.id, date: '2026-12-01', loadL: '42,5', loadR: 44 });
const sesManual = await db.sessions.get(manual);
check('alta manual por pierna: acepta coma decimal y guarda las dos piernas', JSON.stringify(sesManual.values[vUni.id]) === JSON.stringify({ L: 42.5, R: 44 }), JSON.stringify(sesManual.values[vUni.id]));
const manual2 = await addManualLoad(db, { playerId: a, testId: par.uni.id, date: '2026-12-02', loadR: 50 });
check('alta manual por pierna: vale con una sola pierna', JSON.stringify((await db.sessions.get(manual2)).values[vUni.id]) === JSON.stringify({ R: 50 }));
let err = '';
try { await addManualLoad(db, { playerId: a, testId: par.uni.id, date: '2026-12-03' }); } catch (e) { err = e.message; }
check('alta manual por pierna: sin ninguna pierna, error claro', /al menos una pierna/.test(err), err);
let err2 = '';
try { await addManualLoad(db, { playerId: a, testId: par.uni.id, date: '2026-12-03', loadL: 1200 }); } catch (e) { err2 = e.message; }
check('alta manual por pierna: una carga fuera de rango no se guarda', /entre 0 y 1000/.test(err2), err2);
const manualD = await addManualLoad(db, { playerId: b, testId: par.doble.id, date: '2026-12-01', load: 150 });
check('alta manual bilateral: sigue guardando un valor único como siempre', JSON.stringify((await db.sessions.get(manualD)).values[vDoble.id]) === JSON.stringify({ S: 150 }));

// ---- Si el unilateral YA tiene cargas guardadas de valor único, la migración no puede adivinar de qué pierna eran: se deja como está y se avisa ----
{
  const db2 = createDb('t-lp-' + Math.random()); await initDb(db2); await seedInitialCatalog(db2);
  const t2 = (await db2.tests.toArray()).find((x) => x.name === 'Single-Leg Leg Press 45° 8RM');
  const c2 = (await db2.variables.where('testId').equals(t2.id).toArray()).find((x) => x.name === 'Carga máxima (kg)');
  const bw2 = (await db2.variables.where('testId').equals(t2.id).toArray()).find((x) => x.name === '%BW');
  await db2.variables.update(c2.id, { sides: 'single' });
  await db2.variables.delete(bw2.id); await db2.formulaHistory.where('variableId').equals(bw2.id).delete();
  const p2 = await createPlayer(db2, { jerseyName: 'ANTIGUO' });
  await db2.sessions.add({ playerId: p2, testId: t2.id, protocolId: null, date: '2026-10-01', time: '', values: { [c2.id]: { S: 37 } }, reps: {}, status: 'valid', source: 'manual', createdAt: new Date().toISOString() });
  const m2 = await db2.meta.get('catalogSeeded');
  await db2.meta.put({ key: 'catalogSeeded', value: { ...m2.value, version: 1 } });
  const r2 = await seedInitialCatalog(db2);
  const c2post = await db2.variables.get(c2.id);
  check('unilateral con datos antiguos: la carga se deja de valor único y se avisa en el recuento', c2post.sides === 'single' && r2.rmCargaConDatos === 1 && r2.rmPorPierna === undefined, JSON.stringify({ sides: c2post.sides, aviso: r2.rmCargaConDatos, cambiadas: r2.rmPorPierna }));
  const bw2post = (await db2.variables.where('testId').equals(t2.id).toArray()).find((x) => x.name === '%BW');
  check('unilateral con datos antiguos: el %BW se crea igualmente y la sesión antigua conserva su valor', bw2post.formula.op === 'LOAD_BW' && (await db2.sessions.where('testId').equals(t2.id).first()).values[c2.id].S === 37);
}

// ---- La columna de kilos junto al %BW en «ver todos los jugadores en este test» (24/11/2026) ----
// La pareja carga ↔ %BW se encuentra por la fórmula, no por una lista de tests: un RM nuevo la tendrá sin tocar nada.
{
  const { parejaDeCarga } = await import('./pages-test.js');
  const vars = await db.variables.toArray();
  const todosRM = (await db.tests.toArray()).filter((t) => ['Hamstring Bridge 30 cm 8RM', 'Single-Leg Knee Flexion 8RM', 'Double-Leg Leg Press 45° 8RM', 'Single-Leg Leg Press 45° 8RM', 'RFESS 45° 8RM', 'Single-Leg Standing Calf Raise 12RM', 'Single-Leg Seated Calf Raise 6RM'].includes(t.name));
  check('los siete tests de RM están en el catálogo', todosRM.length === 7, String(todosRM.length));
  const estructura = todosRM.map((t) => {
    const vs = vars.filter((v) => v.testId === t.id && !v.archived);
    const carga = vs.find((v) => v.name === 'Carga máxima (kg)');
    const bw = vs.find((v) => v.name === '%BW');
    return { nombre: t.name, carga: carga?.sides, bw: bw?.sides, pareja: parejaDeCarga(vars, bw)?.id === carga?.id && parejaDeCarga(vars, carga)?.id === bw?.id };
  });
  check('todos los RM tienen carga y %BW con los mismos lados, y se encuentran el uno al otro', estructura.every((e) => e.carga && e.carga === e.bw && e.pareja), JSON.stringify(estructura));
  check('la carga va por pierna en todos menos en el Double-Leg Leg Press (criterio del usuario del 24/11/2026)',
    estructura.every((e) => (e.nombre === 'Double-Leg Leg Press 45° 8RM' ? e.carga === 'single' : e.carga === 'LR')), JSON.stringify(estructura.map((e) => `${e.nombre}: ${e.carga}`)));
  check('en el 12RM, el 1RM estimado sigue a la carga y también va por pierna',
    vars.find((v) => v.formula?.op === 'RM_EST')?.sides === 'LR', String(vars.find((v) => v.formula?.op === 'RM_EST')?.sides));
  const cmjVar = vars.find((v) => v.name === 'JH (imp-mom)');
  check('una variable sin pareja de carga no inventa ninguna', parejaDeCarga(vars, cmjVar) === null && parejaDeCarga(vars, null) === null);
}

// ---- Una sola pierna se aplica a las dos en los dos calf raise (25/11/2026, petición del usuario) ----
{
  const tCalf = (await db.tests.toArray()).find((x) => x.name === 'Single-Leg Standing Calf Raise 12RM');
  const tSeat = (await db.tests.toArray()).find((x) => x.name === 'Single-Leg Seated Calf Raise 6RM');
  const tLeg = (await db.tests.toArray()).find((x) => x.name === 'Single-Leg Leg Press 45° 8RM');
  const vDe = async (t) => (await db.variables.where('testId').equals(t.id).toArray()).find((x) => x.name === 'Carga máxima (kg)');
  const vCalf = await vDe(tCalf), vSeat2 = await vDe(tSeat), vLeg = await vDe(tLeg);
  const pz = await createPlayer(db, { jerseyName: 'ESPEJO' });
  const soloIzq = await addManualLoad(db, { playerId: pz, testId: tCalf.id, date: '2026-11-21', loadL: 30 });
  check('calf raise de pie: con solo la izquierda, la derecha toma el mismo valor', JSON.stringify((await db.sessions.get(soloIzq)).values[vCalf.id]) === JSON.stringify({ L: 30, R: 30 }), JSON.stringify((await db.sessions.get(soloIzq)).values[vCalf.id]));
  const soloDer = await addManualLoad(db, { playerId: pz, testId: tSeat.id, date: '2026-11-21', loadR: 25 });
  check('calf raise sentado: con solo la derecha, la izquierda toma el mismo valor', JSON.stringify((await db.sessions.get(soloDer)).values[vSeat2.id]) === JSON.stringify({ L: 25, R: 25 }));
  const lasDos = await addManualLoad(db, { playerId: pz, testId: tCalf.id, date: '2026-11-22', loadL: 30, loadR: 34 });
  check('calf raise: si se aportan las dos piernas, se respetan tal cual', JSON.stringify((await db.sessions.get(lasDos)).values[vCalf.id]) === JSON.stringify({ L: 30, R: 34 }));
  const legSolo = await addManualLoad(db, { playerId: pz, testId: tLeg.id, date: '2026-11-21', loadL: 50 });
  check('la copia NO se aplica a los demás tests: el Leg Press con una pierna guarda solo esa', JSON.stringify((await db.sessions.get(legSolo)).values[vLeg.id]) === JSON.stringify({ L: 50 }));
  // Y lo mismo por la vía de la importación, que es como lo usará de verdad
  const impr = await commitTwoWay(db, { testDobleId: null, testUniId: tCalf.id, date: '2026-11-23', items: [{ name: 'ESPEJO', playerId: pz, doble: null, izq: 28, der: null, remember: false }] });
  const ses = (await db.sessions.where('testId').equals(tCalf.id).toArray()).find((x) => x.date === '2026-11-23');
  check('importando solo la columna izquierda, el calf raise queda con las dos piernas', impr.creadasUni === 1 && JSON.stringify(ses.values[vCalf.id]) === JSON.stringify({ L: 28, R: 28 }), JSON.stringify(ses.values[vCalf.id]));
}

process.exit(fail);
