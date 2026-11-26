// «Team-Wide Analysis» (26/11/2026): mapa de calor de percentiles, ranking de la plantilla y matriz de correlaciones. Lo que se vigila aquí es que
// estos tres cuadros NO sean un cálculo paralelo: el valor de cada jugador y su percentil tienen que ser los mismos que enseña su ficha.
import 'fake-indexeddb/auto';
import { createDb, initDb } from './db.js';
import { seedInitialCatalog } from './catalogo-inicial.js';
import { listCatalog } from './catalogo.js';
import { expandRelative } from './relativos.js';
import { withReferenceWeights } from './relaciones.js';
import { columnasNormativas } from './pages-normativo.js';
import { columnasDeTest, tablaPlantilla, rankingVariable, matrizCorrelaciones } from './teamwide.js';
import { valorDeJugador } from './asociaciones.js';

let failed = 0;
const check = (n, ok, d = '') => { console.log(`${ok ? 'OK  ' : 'FAIL'} ${n} ${ok ? '' : d}`); if (!ok) failed++; };
const close = (a, b, e = 1e-9) => a !== null && b !== null && Math.abs(a - b) < e;

const db = createDb('teamwide-' + Math.random());
await initDb(db); await seedInitialCatalog(db);
const cat = await listCatalog(db);
const test = cat.tests.find((t) => t.name === 'Run-Specific Knee Iso-Push');
const vars = cat.variables.filter((v) => v.testId === test.id);
const pf = vars.find((v) => v.name === 'Peak Force');
const now = new Date().toISOString();

// 14 jugadores con dos sesiones cada uno: así Latest, Personal Average y Personal Best son tres valores distintos.
const ids = [];
for (let i = 0; i < 14; i++) {
  const id = await db.players.add({ jerseyName: `J${i}`, fullName: `Jugador Número ${i}`, active: true, referenceWeight: { value: 75, unit: 'kg' }, createdAt: now, updatedAt: now });
  ids.push(id);
  await db.sessions.add({ playerId: id, testId: test.id, protocolId: null, date: '2026-10-01', time: '', values: { [pf.id]: { L: 300 + i * 10, R: 310 + i * 10 } }, reps: { L: 1, R: 1 }, status: 'valid', source: 'manual', createdAt: now });
  await db.sessions.add({ playerId: id, testId: test.id, protocolId: null, date: '2026-11-01', time: '', values: { [pf.id]: { L: 280 + i * 12, R: 330 + i * 8 } }, reps: { L: 1, R: 1 }, status: 'valid', source: 'manual', createdAt: now });
}
const players = await db.players.toArray();
const playersById = Object.fromEntries(players.map((p) => [p.id, p]));
const crudas = await db.sessions.toArray();
const anth = withReferenceWeights(await db.anthropometry.toArray(), players);
const { sessions } = expandRelative(cat.variables, test.id, crudas, anth, { tests: cat.tests, allSessions: crudas });
const comun = { sessions, players: playersById, histories: {}, minN: 10 };

const cols = columnasDeTest(cat, sessions, test.id);
check('las columnas de un test son sus variables con datos, una por pierna (incluidas las relativas)',
  cols.length === 4 && cols.filter((c) => c.variable.id === pf.id).map((c) => c.side).join() === 'L,R' && cols.some((c) => /relativo/i.test(c.variable.name)), JSON.stringify(cols.map((c) => c.label)));
const iPF = { L: cols.findIndex((c) => c.variable.id === pf.id && c.side === 'L'), R: cols.findIndex((c) => c.variable.id === pf.id && c.side === 'R') };
const colPF = cols[iPF.L];
check('no se ofrece la media de las dos piernas (la referencia junta los dos lados)', !cols.some((c) => c.side === 'M'));

// ---- Mapa de calor: el percentil de cada celda tiene que ser EL MISMO que el de la ficha del jugador.
for (const base of ['last', 'pa', 'pb']) {
  const t = tablaPlantilla({ ...comun, cols, basis: base });
  check(`mapa de calor · base ${base}: una fila por jugador con datos`, t.filas.length === 14, String(t.filas.length));
  const fila = t.filas.find((f) => f.id === ids[7]);
  const mias = sessions.filter((s) => s.playerId === ids[7]);
  const cN = columnasNormativas({ player: playersById[ids[7]], test, catalog: cat, sessions: mias, refData: { sessions, players, records: [], positions: [], minN: 10 }, vars: [pf], base, f: {}, positionId: null })[0];
  for (const sd of ['L', 'R']) {
    const celda = fila.celdas[iPF[sd]];
    check(`mapa de calor · base ${base} · ${sd}: el valor es el de la ficha del jugador`, close(celda.value, cN.lado[sd].x.value), `${celda.value} vs ${cN.lado[sd].x.value}`);
    check(`mapa de calor · base ${base} · ${sd}: el percentil es el de Normative Benchmarking`, close(celda.ev.percentilePerf, cN.lado[sd].ev.percentilePerf), `${celda.ev.percentilePerf} vs ${cN.lado[sd].ev.percentilePerf}`);
  }
}
// Las tres bases dan valores distintos: si no, las comprobaciones de arriba no probarían nada.
const vL = ['last', 'pa', 'pb'].map((b) => valorDeJugador(sessions, ids[7], colPF, null, null, b).value);
check('Latest, Personal Average y Personal Best son tres valores distintos en este jugador', new Set(vL.map((x) => Math.round(x * 100))).size === 3, JSON.stringify(vL));

const t0 = tablaPlantilla({ ...comun, cols, basis: 'last' });
check('los jugadores van del percentil medio más bajo al más alto (pantalla de cribado)',
  t0.filas.map((f) => f.medio).every((x, i, a) => i === 0 || x === null || a[i - 1] === null || x >= a[i - 1]), JSON.stringify(t0.filas.map((f) => f.medio)));
check('un jugador sin ninguna sesión del test no aparece', (await (async () => { const id = await db.players.add({ jerseyName: 'SIN', active: true, createdAt: now }); const ps = await db.players.toArray(); const t = tablaPlantilla({ ...comun, players: Object.fromEntries(ps.map((p) => [p.id, p])), cols, basis: 'last' }); return !t.filas.some((f) => f.id === id); })()));

// ---- Ranking: orden por la dirección de la variable y cuantiles de la MISMA referencia.
const rk = rankingVariable({ ...comun, col: colPF, basis: 'pa' });
check('ranking: el mejor arriba (Peak Force: más alto es mejor)', rk.filas.length === 14 && rk.filas[0].value >= rk.filas.at(-1).value && rk.direccion === 'higher', JSON.stringify(rk.filas.map((f) => f.value)));
check('ranking: el P50 y el P75 salen de la referencia y P75 ≥ P50', rk.p50 !== null && rk.p75 !== null && rk.p75 >= rk.p50, `${rk.p50} / ${rk.p75}`);
check('ranking: la referencia junta los dos lados (28 valores de 14 jugadores)', rk.nRef === 28, String(rk.nRef));
check('ranking: cada fila lleva el alias del jugador', rk.filas.every((f) => f.alias && f.alias.length > 0 && f.alias !== f.name), JSON.stringify(rk.filas.slice(0, 2).map((f) => [f.alias, f.name])));

// ---- Matriz: correlación entre las dos piernas de la misma variable (tiene que ser alta y positiva por construcción).
const dosPiernas = [cols[iPF.L], cols[iPF.R]];
const m = matrizCorrelaciones({ ...comun, filas: dosPiernas, columnas: dosPiernas, basis: 'pa' });
check('matriz: la diagonal se marca como la misma variable, sin número', m.celdas[0][0].misma && m.celdas[1][1].misma);
check('matriz: izquierda y derecha correlacionan alto y positivo', m.celdas[0][1].sufficient && m.celdas[0][1].r > 0.9, JSON.stringify(m.celdas[0][1]));
check('matriz: es simétrica', close(m.celdas[0][1].r, m.celdas[1][0].r));
check('matriz: cuenta los jugadores con las dos variables', m.celdas[0][1].n === 14, String(m.celdas[0][1].n));
const mPocos = matrizCorrelaciones({ ...comun, filas: dosPiernas, columnas: dosPiernas, basis: 'pa', minN: 50 });
check('matriz: con muestra insuficiente no se calcula y se dice cuántos hay', !mPocos.celdas[0][1].sufficient && mPocos.celdas[0][1].r === null && mPocos.celdas[0][1].n === 14);

// Los jugadores sintéticos quedan fuera salvo que se pidan (D19).
await db.players.add({ jerseyName: 'SINT', active: true, synthetic: 1, createdAt: now });
const ps2 = await db.players.toArray();
const conSint = { ...comun, players: Object.fromEntries(ps2.map((p) => [p.id, p])) };
check('los jugadores sintéticos no entran por defecto', !tablaPlantilla({ ...conSint, cols, basis: 'last' }).filas.some((f) => f.synthetic));

process.exit(failed ? 1 : 0);
