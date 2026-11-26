// Bloque «Déficits» (25/11/2026). Nació de un fallo que llegó al usuario: un jugador con percentil 9 en %BW del Double-Leg Leg Press no aparecía en la
// lista. La causa era que Déficits recibía la posición principal del jugador y calculaba el percentil SOLO entre los de su posición; en un test que
// pocos jugadores han hecho, esa muestra no llega al mínimo y la variable desaparecía sin decir nada. La lista compara siempre contra toda La Liga.
import 'fake-indexeddb/auto';
import { createDb, initDb } from './db.js';
import { seedInitialCatalog } from './catalogo-inicial.js';
import { listCatalog } from './catalogo.js';
import { createPosition, setMainPosition } from './posiciones.js';
import { expandRelative } from './relativos.js';
import { withReferenceWeights } from './relaciones.js';
import { columnasNormativas } from './pages-normativo.js';
import { deficitsDeTest } from './pages-deficits.js';

let failed = 0;
const check = (n, ok, d = '') => { console.log(`${ok ? 'OK  ' : 'FAIL'} ${n} ${ok ? '' : d}`); if (!ok) failed++; };

const db = createDb('deficits-' + Math.random());
await initDb(db); await seedInitialCatalog(db);
const cat = await listCatalog(db);
const test = cat.tests.find((t) => t.name === 'Double-Leg Leg Press 45° 8RM');
const carga = cat.variables.find((v) => v.testId === test.id && v.name === 'Carga máxima (kg)');
const bw = cat.variables.find((v) => v.testId === test.id && v.name === '%BW');
for (const n of ['Central', 'Lateral', 'Medio', 'Delantero']) await createPosition(db, { name: n });
const positions = await db.positions.toArray();
const now = new Date().toISOString();
const ids = [];
for (let i = 0; i < 14; i++) {
  const id = await db.players.add({ jerseyName: 'J' + i, active: true, referenceWeight: { value: 75, unit: 'kg' }, createdAt: now, updatedAt: now });
  ids.push(id);
  await setMainPosition(db, id, positions[i % positions.length].id); // 3 o 4 jugadores por posición: la referencia posicional NO llega al mínimo de 10
  await db.sessions.add({ playerId: id, testId: test.id, protocolId: null, date: '2026-11-20', time: '', values: { [carga.id]: { S: i === 0 ? 40 : 110 + i * 3 } }, reps: {}, status: 'valid', source: 'manual', createdAt: now });
}
const players = await db.players.toArray();
const records = await db.playerPositions.toArray();
const allSessions = await db.sessions.toArray();
const anth = withReferenceWeights(await db.anthropometry.toArray(), players);
const { sessions } = expandRelative(cat.variables, test.id, allSessions, anth, { tests: cat.tests, allSessions });
const refData = { sessions, players, records, positions, minN: 10 };
const flojo = players[0];

const r = deficitsDeTest({ player: flojo, test, catalog: cat, refData, base: 'last', umbral: 35 });
check('un jugador con posición principal sale en Déficits: la lista compara con toda La Liga, no con su posición',
  r.filas.length === 1 && r.filas[0].variable.id === bw.id, JSON.stringify(r.filas.map((f) => f.variable.name)));
check('el jugador tiene posición principal de verdad (si no, la prueba no probaría nada)', records.filter((x) => x.playerId === flojo.id && x.role === 'principal').length === 1);

// El percentil tiene que ser EXACTAMENTE el de «Normative Benchmarking» de ese test: es lo que promete la propia tarjeta.
const cols = columnasNormativas({ player: flojo, test, catalog: cat, sessions: sessions.filter((s) => s.playerId === flojo.id), refData, vars: [bw], base: 'last', f: {}, positionId: null });
check('el percentil de la fila es el mismo que muestra Normative Benchmarking', r.filas[0].ev.percentilePerf === cols[0].lado.S.ev.percentilePerf, `${r.filas[0].ev.percentilePerf} vs ${cols[0].lado.S.ev.percentilePerf}`);
check('se lista la variable relativa (%BW) y no la carga en kilos: serían el mismo déficit dos veces', !r.filas.some((f) => f.variable.id === carga.id));

// Un jugador fuerte no es un déficit, y el umbral manda.
const medio = players[7];
const pctMedio = columnasNormativas({ player: medio, test, catalog: cat, sessions: sessions.filter((s) => s.playerId === medio.id), refData, vars: [bw], base: 'last', f: {}, positionId: null })[0].lado.S.ev.percentilePerf;
check('un jugador por encima del umbral no aparece', pctMedio > 35 && deficitsDeTest({ player: medio, test, catalog: cat, refData, base: 'last', umbral: 35 }).filas.length === 0, `percentil ${pctMedio}`);
check('subiendo el umbral por encima de su percentil sí aparece', deficitsDeTest({ player: medio, test, catalog: cat, refData, base: 'last', umbral: Math.ceil(pctMedio) }).filas.length === 1);

// Muestra insuficiente: no entra en la lista, pero se anota para poder decirlo en pantalla (antes desaparecía sin rastro).
const pocos = { ...refData, minN: 50 };
const r2 = deficitsDeTest({ player: flojo, test, catalog: cat, refData: pocos, base: 'last', umbral: 35 });
check('con muestra insuficiente no se lista, pero se anota qué variable y con qué N',
  r2.filas.length === 0 && r2.sinMuestra.length === 1 && r2.sinMuestra[0].variable.id === bw.id && r2.sinMuestra[0].minN === 50 && r2.sinMuestra[0].n === 13, JSON.stringify(r2.sinMuestra));

// Un jugador sin sesiones de ese test no aporta ni filas ni avisos.
const nuevo = await db.players.add({ jerseyName: 'SIN DATOS', active: true, createdAt: now, updatedAt: now });
const r3 = deficitsDeTest({ player: await db.players.get(nuevo), test, catalog: cat, refData, base: 'last', umbral: 35 });
check('un jugador sin sesiones de ese test no genera nada', r3.filas.length === 0 && r3.sinMuestra.length === 0);

// ---- Tests de carga: solo %BW (25/11/2026, petición del usuario). En los iso-hold y en todos los RM, los kilos no se pueden comparar entre jugadores
// y el MVIC iso-push, el %PIMA y el 1RM estimado salen de esa misma carga: listarlos sería el mismo déficit con tres nombres distintos.
const calf = cat.tests.find((t) => t.name === 'Single-Leg Standing Calf Raise 12RM');
const vCalf = cat.variables.filter((v) => v.testId === calf.id);
const cargaCalf = vCalf.find((v) => v.name === 'Carga máxima (kg)');
for (let i = 0; i < 14; i++) {
  await db.sessions.add({ playerId: ids[i], testId: calf.id, protocolId: null, date: '2026-11-21', time: '', values: { [cargaCalf.id]: { L: i === 0 ? 5 : 40 + i * 2, R: i === 0 ? 5 : 42 + i * 2 } }, reps: {}, status: 'valid', source: 'manual', createdAt: now });
}
const sesCalf = (await db.sessions.toArray()).filter((s) => s.testId === calf.id);
const expCalf = expandRelative(cat.variables, calf.id, sesCalf, anth, { tests: cat.tests, allSessions: await db.sessions.toArray() });
const refCalf = { sessions: expCalf.sessions, players: await db.players.toArray(), records, positions, minN: 10 };
const rc = deficitsDeTest({ player: flojo, test: calf, catalog: cat, refData: refCalf, base: 'last', umbral: 35 });
const nombres = [...new Set(rc.filas.map((f) => f.variable.name))];
check('en un test de RM solo se lista el %BW', rc.filas.length > 0 && nombres.length === 1 && nombres[0] === '%BW', nombres.join(' · '));
check('no se listan ni los kilos ni el 1RM estimado, que salen de esa misma carga', !nombres.some((n) => /Carga|1RM/i.test(n)), nombres.join(' · '));
check('el test de verdad tiene más variables con dirección (si no, la prueba no probaría nada)',
  vCalf.filter((v) => v.direction && !v.archived).length >= 3, vCalf.map((v) => v.name).join(' · '));

// Un iso-hold: igual. Aquí el %BW y el %PIMA son los dos relativos, y aun así solo sale el %BW.
const hold = cat.tests.find((t) => t.name === 'Knee Iso-Hold 20 s');
const cargaHold = cat.variables.find((v) => v.testId === hold.id && v.name === 'Carga externa (kg)');
for (let i = 0; i < 14; i++) {
  await db.sessions.add({ playerId: ids[i], testId: hold.id, protocolId: null, date: '2026-11-21', time: '', values: { [cargaHold.id]: { S: i === 0 ? 4 : 20 + i } }, reps: {}, status: 'valid', source: 'manual', createdAt: now });
}
const todas = await db.sessions.toArray();
const expHold = expandRelative(cat.variables, hold.id, todas.filter((s) => s.testId === hold.id), anth, { tests: cat.tests, allSessions: todas });
const rh = deficitsDeTest({ player: flojo, test: hold, catalog: cat, refData: { ...refCalf, sessions: expHold.sessions }, base: 'last', umbral: 35 });
const nh = [...new Set(rh.filas.map((f) => f.variable.name))];
check('en un iso-hold solo se lista el %BW', rh.filas.length > 0 && nh.length === 1 && nh[0] === '%BW', nh.join(' · '));

// La regla es por estructura, no por una lista de nombres: un test que NO es de carga sigue listando todas sus variables.
const nordic = cat.tests.find((t) => t.name === 'Nordic Hamstring Exercise');
const mf = cat.variables.find((v) => v.testId === nordic.id && v.name === 'Max Force');
for (let i = 0; i < 14; i++) {
  await db.sessions.add({ playerId: ids[i], testId: nordic.id, protocolId: null, date: '2026-11-21', time: '', values: { [mf.id]: { L: i === 0 ? 150 : 300 + i * 5, R: i === 0 ? 155 : 310 + i * 5 } }, reps: { L: 3, R: 3 }, status: 'valid', source: 'manual', createdAt: now });
}
const todas2 = await db.sessions.toArray();
const expNor = expandRelative(cat.variables, nordic.id, todas2.filter((s) => s.testId === nordic.id), anth, { tests: cat.tests, allSessions: todas2 });
const rn = deficitsDeTest({ player: flojo, test: nordic, catalog: cat, refData: { ...refCalf, sessions: expNor.sessions }, base: 'last', umbral: 35 });
check('un test que no es de carga no se ve afectado por la regla', rn.filas.length > 0 && rn.filas.every((f) => !/%BW/.test(f.variable.name)), [...new Set(rn.filas.map((f) => f.variable.name))].join(' · '));

process.exit(failed ? 1 : 0);
