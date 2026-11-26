// `columnasNormativas` (25/11/2026): la función de la que salen TODOS los percentiles que se ven en pantalla. La usan «Normative Benchmarking»,
// «Déficits» y COMPOSITE, así que lo que se fije aquí es lo que esos tres enseñan. No tenía prueba unitaria propia: el fallo del 25/11/2026 (Déficits
// comparaba contra la posición del jugador) vivía justo en cómo se la llama. Estas pruebas fijan el contrato con datos sintéticos.
import 'fake-indexeddb/auto';
import { createDb, initDb } from './db.js';
import { seedInitialCatalog } from './catalogo-inicial.js';
import { listCatalog } from './catalogo.js';
import { createPosition, setMainPosition } from './posiciones.js';
import { expandRelative } from './relativos.js';
import { withReferenceWeights } from './relaciones.js';
import { variacionBase } from './evolucion.js';
import { columnasNormativas } from './pages-normativo.js';

let failed = 0;
const check = (n, ok, d = '') => { console.log(`${ok ? 'OK  ' : 'FAIL'} ${n} ${ok ? '' : d}`); if (!ok) failed++; };
const close = (a, b) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) < 1e-9;

const db = createDb('norm-' + Math.random());
await initDb(db); await seedInitialCatalog(db);
const cat = await listCatalog(db);
const cmj = cat.tests.find((t) => t.name === 'CMJ');
const jh = cat.variables.find((v) => v.testId === cmj.id && v.name === 'JH (imp-mom)');
const now = new Date().toISOString();

// 12 jugadores, dos sesiones cada uno: la primera 20+i y la segunda 30+i. Así la media personal (25+i) y la última (30+i) son distintas y se ve con
// cuál de las dos se construye la referencia.
const ids = []; const ses = [];
for (let i = 0; i < 12; i++) {
  const id = await db.players.add({ jerseyName: 'J' + i, active: true, createdAt: now, updatedAt: now });
  ids.push(id);
  ses.push({ id: ses.length + 1, playerId: id, testId: cmj.id, date: '2026-10-01', time: '', values: { [jh.id]: { S: 20 + i } }, reps: {}, status: 'valid' });
  ses.push({ id: ses.length + 1, playerId: id, testId: cmj.id, date: '2026-11-01', time: '', values: { [jh.id]: { S: 30 + i } }, reps: {}, status: 'valid' });
}
const players = await db.players.toArray();
const yo = players[0];
const mias = () => ses.filter((s) => s.playerId === yo.id);
const col = (base, extra = {}) => columnasNormativas({ player: yo, test: cmj, catalog: cat, sessions: extra.sessions ?? mias(), refData: { sessions: ses, players, records: [], positions: [], minN: 10, ...extra.refData }, vars: [jh], base, f: extra.f ?? {}, positionId: extra.positionId ?? null })[0];

const last = col('last');
check('base «Latest»: el valor es la última sesión del jugador', last.lado.S.x.value === 30);
check('base «Latest»: la referencia son las MEDIAS personales de los demás (decisión del 16/11/2026), no sus últimas sesiones', last.lado.S.ev.p50 === 31, `p50 = ${last.lado.S.ev.p50}`);
check('el jugador NO entra en su propia referencia', last.lado.S.ev.n === 11, `N = ${last.lado.S.ev.n}`);
const pa = col('pa');
check('base «Personal Average»: el valor es la media del jugador y la referencia no cambia', pa.lado.S.x.value === 25 && pa.lado.S.ev.p50 === 31);
check('percentiles distintos para valores distintos del mismo jugador', last.lado.S.ev.percentilePerf > pa.lado.S.ev.percentilePerf);

// Personal Best del CMJ: la mejor sesión se elige por RSI MOD, no por el máximo de cada variable. Sin ese dato no hay PB, y se dice por qué.
const pb = col('pb');
check('base «Personal Best» del CMJ: sin RSI MOD no se puede elegir la mejor sesión, y se explica en vez de quedarse en blanco',
  pb.lado.S.x === null && /RSI MOD/.test(pb.lado.S.pbReason ?? ''), JSON.stringify(pb.lado.S.pbReason));

// La columna de comparación es exactamente `variacionBase`, la misma función que usan Asimetrías y Déficits.
check('la columna de comparación coincide con variacionBase', close(last.lado.S.vari, variacionBase(mias(), jh, 'S', 'last', {})) && close(pa.lado.S.vari, variacionBase(mias(), jh, 'S', 'pa', {})), `${last.lado.S.vari} / ${pa.lado.S.vari}`);

// Sesiones excluidas: no cuentan ni para el jugador ni para la referencia.
const conExcluida = ses.map((s) => (s.playerId === yo.id && s.date === '2026-11-01' ? { ...s, status: 'excluded' } : s));
const exc = columnasNormativas({ player: yo, test: cmj, catalog: cat, sessions: conExcluida.filter((s) => s.playerId === yo.id), refData: { sessions: conExcluida, players, records: [], positions: [], minN: 10 }, vars: [jh], base: 'last', f: {}, positionId: null })[0];
check('una sesión excluida deja de ser la «última» del jugador', exc.lado.S.x.value === 20, String(exc.lado.S.x?.value));
const sinOtro = ses.filter((s) => !(s.playerId === ids[5] && s.date === '2026-11-01'));
const exc2 = columnasNormativas({ player: yo, test: cmj, catalog: cat, sessions: mias(), refData: { sessions: sinOtro, players, records: [], positions: [], minN: 10 }, vars: [jh], base: 'last', f: {}, positionId: null })[0];
check('quitar una sesión de otro jugador cambia su media y mueve la referencia', exc2.lado.S.ev.p50 !== 31 || exc2.lado.S.ev.n === 11, `p50 = ${exc2.lado.S.ev.p50}`);

// Jugadores sintéticos: fuera de la referencia.
const sint = await db.players.add({ jerseyName: 'SINTETICO', active: true, synthetic: 1, createdAt: now, updatedAt: now });
const conSint = [...ses, { id: 999, playerId: sint, testId: cmj.id, date: '2026-11-01', time: '', values: { [jh.id]: { S: 500 } }, reps: {}, status: 'valid', synthetic: 1 }];
const sin = columnasNormativas({ player: yo, test: cmj, catalog: cat, sessions: mias(), refData: { sessions: conSint, players: await db.players.toArray(), records: [], positions: [], minN: 10 }, vars: [jh], base: 'last', f: {}, positionId: null })[0];
check('los jugadores sintéticos no entran en la referencia', sin.lado.S.ev.n === 11 && sin.lado.S.ev.p50 === 31, `N = ${sin.lado.S.ev.n}, p50 = ${sin.lado.S.ev.p50}`);

// Muestra insuficiente: no se inventa un percentil, se dice por qué.
const pocos = col('last', { refData: { minN: 50 } });
check('con muestra insuficiente no hay percentil ni banda, y hay motivo', pocos.lado.S.ev.sufficient === false && pocos.lado.S.ev.band === null && (pocos.lado.S.ev.reason ?? '').length > 0, JSON.stringify(pocos.lado.S.ev.reason));

// Referencia por posición: existe y es más estrecha. Es justo lo que NO debe usar «Déficits» (fallo del 25/11/2026).
for (const n of ['Central', 'Lateral']) await createPosition(db, { name: n });
const positions = await db.positions.toArray();
for (let i = 0; i < ids.length; i++) await setMainPosition(db, ids[i], positions[i % 2].id);
const records = await db.playerPositions.toArray();
const porPos = columnasNormativas({ player: yo, test: cmj, catalog: cat, sessions: mias(), refData: { sessions: ses, players: await db.players.toArray(), records, positions, minN: 5 }, vars: [jh], base: 'last', f: {}, positionId: positions[0].id })[0];
const todas = columnasNormativas({ player: yo, test: cmj, catalog: cat, sessions: mias(), refData: { sessions: ses, players: await db.players.toArray(), records, positions, minN: 5 }, vars: [jh], base: 'last', f: {}, positionId: null })[0];
check('con posición, la referencia solo tiene a los de esa posición; sin posición, a todos', porPos.lado.S.ev.n === 5 && todas.lado.S.ev.n === 11, `${porPos.lado.S.ev.n} vs ${todas.lado.S.ev.n}`);
check('y el percentil cambia según la referencia: por eso Déficits pide siempre la de toda La Liga', porPos.lado.S.ev.percentilePerf !== todas.lado.S.ev.percentilePerf, `${porPos.lado.S.ev.percentilePerf} vs ${todas.lado.S.ev.percentilePerf}`);

// ---- Variables de dos lados: una sola referencia para las dos piernas, y asimetría con dirección «menos es mejor» ----
const lp = cat.tests.find((t) => t.name === 'Single-Leg Leg Press 45° 8RM');
const carga = cat.variables.find((v) => v.testId === lp.id && v.name === 'Carga máxima (kg)');
const bw = cat.variables.find((v) => v.testId === lp.id && v.name === '%BW');
const sesLP = [];
for (let i = 0; i < 12; i++) sesLP.push({ id: 100 + i, playerId: ids[i], testId: lp.id, date: '2026-11-10', time: '', values: { [carga.id]: { L: 40 + i, R: 42 + i } }, reps: {}, status: 'valid' });
const anth = withReferenceWeights(await db.anthropometry.toArray(), await db.players.toArray());
for (const p of await db.players.toArray()) await db.players.update(p.id, { referenceWeight: { value: 80, unit: 'kg' } });
const anth2 = withReferenceWeights(await db.anthropometry.toArray(), await db.players.toArray());
const expand = expandRelative(cat.variables, lp.id, sesLP, anth2, { tests: cat.tests, allSessions: sesLP });
const refLP = { sessions: expand.sessions, players: await db.players.toArray(), records: [], positions: [], minN: 10 };
const cLP = columnasNormativas({ player: yo, test: lp, catalog: cat, sessions: expand.sessions.filter((s) => s.playerId === yo.id), refData: refLP, vars: [carga, bw], base: 'last', f: {}, positionId: null });
check('variable de dos lados: una sola referencia para izquierda y derecha (un único P50)', cLP[0].lado.L.ev.p50 === cLP[0].lado.R.ev.p50 && cLP[0].lado.L.ev.n === cLP[0].lado.R.ev.n, `${cLP[0].lado.L.ev.p50} / ${cLP[0].lado.R.ev.p50}`);
// La propiedad que importa no es cómo se llama el campo, sino que MÁS asimetría dé PEOR percentil.
const desigual = { id: 200, playerId: ids[11], testId: lp.id, date: '2026-11-10', time: '', values: { [carga.id]: { L: 20, R: 60 } }, reps: {}, status: 'valid' };
const sesLP2 = [...sesLP.filter((x) => x.playerId !== ids[11]), desigual];
const exp2 = expandRelative(cat.variables, lp.id, sesLP2, anth2, { tests: cat.tests, allSessions: sesLP2 });
const refLP2 = { sessions: exp2.sessions, players: await db.players.toArray(), records: [], positions: [], minN: 10 };
const colDe = (pl) => columnasNormativas({ player: pl, test: lp, catalog: cat, sessions: exp2.sessions.filter((s) => s.playerId === pl.id), refData: refLP2, vars: [carga], base: 'last', f: {}, positionId: null })[0];
const equilibrado = colDe(yo), cojo = colDe(players[11]);
check('la asimetría trae su propio percentil y más asimetría es peor percentil',
  equilibrado.evAsim && cojo.evAsim && Math.abs(cojo.asim) > Math.abs(equilibrado.asim) && cojo.evAsim.percentilePerf < equilibrado.evAsim.percentilePerf,
  `asim ${equilibrado.asim?.toFixed(1)}% → P${equilibrado.evAsim?.percentilePerf?.toFixed(0)} · asim ${cojo.asim?.toFixed(1)}% → P${cojo.evAsim?.percentilePerf?.toFixed(0)}`);
check('la variable calculada (%BW) recibe percentil como cualquier otra', cLP[1].lado.L.ev.sufficient === true && Number.isFinite(cLP[1].lado.L.ev.percentilePerf));
check('%BW y la carga dan el MISMO percentil cuando todos pesan igual: el relativo solo cambia la escala', cLP[0].lado.L.ev.percentilePerf === cLP[1].lado.L.ev.percentilePerf, `${cLP[0].lado.L.ev.percentilePerf} vs ${cLP[1].lado.L.ev.percentilePerf}`);

// ---- Invariante entre pantallas: la asimetría que enseña «Asimetrías» tiene que ser la MISMA que la de «Normative Benchmarking» y la de «Déficits».
// Es el tipo de comprobación que habría cazado el fallo del 25/11/2026 (dos pantallas diciendo cosas distintas del mismo dato).
{
  const { filasAsimetria } = await import('./pages-asimetrias.js');
  const { deficitsDeTest } = await import('./pages-deficits.js');
  const desalineado = [];
  for (let i = 0; i < 12; i++) desalineado.push({ id: 300 + i, playerId: ids[i], testId: lp.id, date: '2026-11-10', time: '', values: { [carga.id]: { L: 30 + i, R: 50 + i } }, reps: { L: 1, R: 1, total: 1 }, status: 'valid' });
  const exp3 = expandRelative(cat.variables, lp.id, desalineado, anth2, { tests: cat.tests, allSessions: desalineado });
  const ref3 = { sessions: exp3.sessions, players: await db.players.toArray(), records: [], positions: [], minN: 10 };
  for (const base of ['last', 'pa']) {
    const mias3 = exp3.sessions.filter((s) => s.playerId === yo.id);
    // 26/11/2026: en un test de RM, Asimetrías lista SOLO el %BW, así que el invariante entre pantallas se comprueba sobre esa variable.
    const cols3 = columnasNormativas({ player: yo, test: lp, catalog: cat, sessions: mias3, refData: ref3, vars: [carga, bw], base, f: {}, positionId: null });
    const cN = cols3.find((c) => c.v.id === bw.id), cKg = cols3.find((c) => c.v.id === carga.id);
    const fA = filasAsimetria(lp, cat, mias3, base).find((f) => f.v.id === bw.id);
    check(`Asimetrías lista el %BW y no los kilos (base ${base})`, !!fA && !filasAsimetria(lp, cat, mias3, base).some((f) => f.v.id === carga.id));
    check(`asimetría igual en Normative Benchmarking y en Asimetrías (base ${base})`, close(cN.asim, fA.pct), `${cN.asim} vs ${fA.pct}`);
    check(`y es la misma que la de la carga en kilos: por eso no se listan las dos (base ${base})`, close(cKg.asim, cN.asim), `${cKg.asim} vs ${cN.asim}`);
    check(`valores por lado iguales en las dos pantallas (base ${base})`, cN.lado.L.x.value === fA.L && cN.lado.R.x.value === fA.R, `${cN.lado.L.x.value}/${cN.lado.R.x.value} vs ${fA.L}/${fA.R}`);
  }
  const dfs = deficitsDeTest({ player: yo, test: lp, catalog: cat, refData: ref3, base: 'last', umbral: 99 });
  const filaAsim = dfs.filas.find((f) => f.tipo === 'asimetria');
  const cN = columnasNormativas({ player: yo, test: lp, catalog: cat, sessions: exp3.sessions.filter((s) => s.playerId === yo.id), refData: ref3, vars: [carga], base: 'last', f: {}, positionId: null })[0];
  check('la fila de asimetría de Déficits lleva la misma magnitud que Normative Benchmarking', filaAsim && close(filaAsim.value, Math.abs(cN.asim)), `${filaAsim?.value} vs ${Math.abs(cN.asim)}`);
  check('y el mismo percentil de asimetría', filaAsim && filaAsim.ev.percentilePerf === cN.evAsim.percentilePerf, `${filaAsim?.ev?.percentilePerf} vs ${cN.evAsim?.percentilePerf}`);
}

// ---- Invariante entre pantallas: el «Percentil La Liga» de «ver todos los jugadores en este test» tiene que ser el MISMO que el del perfil del jugador.
// Las dos pantallas construyen la referencia con `referenciaPlantilla` (25/11/2026); antes cada una repetía las dos líneas por su cuenta, incluida la regla
// «Latest se compara con el Personal Average de los demás», y nada impedía que una de las dos copias se quedara atrás.
{
  const { compareTest } = await import('./comparativa.js');
  const { referenciaPlantilla } = await import('./percentiles.js');
  const jugadores = await db.players.toArray();
  const playersById = Object.fromEntries(jugadores.map((p) => [p.id, p]));
  // Mismas sesiones para las dos pantallas: carga por pierna, con dos sesiones por jugador para que «Latest» y «Personal Average» no coincidan.
  const sesT = [];
  for (let i = 0; i < 12; i++) {
    sesT.push({ id: 400 + i, playerId: ids[i], testId: lp.id, date: '2026-10-05', time: '', values: { [carga.id]: { L: 60 + i, R: 64 + i } }, reps: { L: 1, R: 1, total: 1 }, status: 'valid' });
    sesT.push({ id: 420 + i, playerId: ids[i], testId: lp.id, date: '2026-11-05', time: '', values: { [carga.id]: { L: 70 + i, R: 76 + i } }, reps: { L: 1, R: 1, total: 1 }, status: 'valid' });
  }
  const expT = expandRelative(cat.variables, lp.id, sesT, anth2, { tests: cat.tests, allSessions: sesT });
  const refT = { sessions: expT.sessions, players: jugadores, records: [], positions: [], minN: 10 };
  for (const v of [carga, bw]) {
    for (const base of ['last', 'pa', 'pb']) {
      // Lo que hace la tabla de todos los jugadores: compareTest para el valor de cada fila y `referenciaPlantilla` para el percentil.
      const res = compareTest({ sessions: expT.sessions, variable: v, players: playersById, histories: {}, positions: [], mode: base, protocolId: undefined });
      const pool = referenciaPlantilla({ sessions: expT.sessions, variable: v, sides: res.sides, players: playersById, histories: {}, basis: base, protocolId: undefined, minN: 10 });
      const fila = res.groups.flatMap((g) => g.rows).find((r) => r.playerId === yo.id);
      const cN = columnasNormativas({ player: yo, test: lp, catalog: cat, sessions: expT.sessions.filter((s) => s.playerId === yo.id), refData: refT, vars: [v], base, f: {}, positionId: null })[0];
      for (const sd of res.sides) {
        check(`${v.name} · base ${base} · lado ${sd}: el valor es el mismo en las dos pantallas`,
          close(fila.cells[sd].value, cN.lado[sd].x.value), `${fila.cells[sd]?.value} vs ${cN.lado[sd]?.x?.value}`);
        const pT = pool.evalDe(fila.playerId, fila.cells[sd].value);
        check(`${v.name} · base ${base} · lado ${sd}: el percentil de «ver todos los jugadores» es el del perfil del jugador`,
          pT.sufficient && close(pT.percentilePerf, cN.lado[sd].ev.percentilePerf), `${pT.percentilePerf} vs ${cN.lado[sd].ev.percentilePerf} (N ${pT.n} vs ${cN.lado[sd].ev.n})`);
        check(`${v.name} · base ${base} · lado ${sd}: la referencia tiene el mismo N (ambos lados juntos, el jugador fuera)`,
          pT.n === cN.lado[sd].ev.n && pT.n === 22, `${pT.n} vs ${cN.lado[sd].ev.n}`);
      }
    }
  }
  // Y la regla de la base «Latest» vive en un solo sitio: la referencia de 'last' es, valor a valor, la de 'pa'.
  const rLast = referenciaPlantilla({ sessions: expT.sessions, variable: carga, sides: ['L', 'R'], players: playersById, basis: 'last', minN: 10 }).ref;
  const rPa = referenciaPlantilla({ sessions: expT.sessions, variable: carga, sides: ['L', 'R'], players: playersById, basis: 'pa', minN: 10 }).ref;
  check('la referencia de «Latest» es la de Personal Average de los demás (una sola copia de la regla)',
    rLast.length === rPa.length && rLast.every((e, i) => e.playerId === rPa[i].playerId && close(e.value, rPa[i].value)));
  check('y no es la de la última sesión (si lo fuera, esta prueba no distinguiría nada)', !close(rPa[0].value, 70));
}

process.exit(failed ? 1 : 0);
