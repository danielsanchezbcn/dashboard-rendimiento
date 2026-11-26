// DSI y EUR de todos los jugadores (16/11/2026). Lo que importa: que cada número sea EXACTAMENTE el mismo que ve ese jugador en su ficha
// (es decir, el de `ratioReferences`), porque aquí la referencia se construye una sola vez para todos en lugar de una por jugador.
import * as R from './relaciones.js';
import { dsiEurTodos, ORDENES, ordenar, valorOrden } from './dsieur.js';

let failed = 0;
const check = (n, ok, d = '') => { console.log(`${ok ? 'OK  ' : 'FAIL'} ${n} ${ok ? '' : d}`); if (!ok) failed++; };
const close = (a, b) => Math.abs(a - b) < 1e-9;
const S = (id, playerId, testId, date, values, extra = {}) => ({ id, playerId, testId, date, time: '', values, reps: { total: 1, L: 1, R: 1 }, status: 'valid', ...extra });

const tests = [{ id: 1, name: 'CMJ' }, { id: 2, name: 'Squat Jump' }, { id: 3, name: 'SL CMJ' }, { id: 4, name: 'Run-Specific Knee Iso-Push' }];
const variables = [{ id: 11, testId: 1, name: 'JH (imp-mom)' }, { id: 12, testId: 2, name: 'JH (imp-mom)' }, { id: 13, testId: 3, name: 'CONCENTRIC PEAK FORCE / BM' }, { id: 14, testId: 4, name: 'Peak Force' }];
const loc = R.locate(tests, variables);

const sessions = []; const players = {}; const anth = []; let sid = 1;
for (let p = 1; p <= 12; p++) {
  players[p] = { id: p, jerseyName: 'P' + (13 - p) }; // nombres al revés del id: así ordenar por jugador no coincide con el orden de los ids
  anth.push({ id: p, playerId: p, date: '2026-01-01', bodyMass: { value: 70, unit: 'kg' } });
  sessions.push(S(sid++, p, 3, '2026-02-01', { 13: { L: (1.5 + p / 20) * R.G, R: (1.4 + p / 20) * R.G } }));
  sessions.push(S(sid++, p, 4, '2026-02-01', { 14: { L: 70 * R.G * 3, R: 70 * R.G * (p <= 2 ? 1.2 : 3) } })); // dos jugadores con el knee flojo
  sessions.push(S(sid++, p, 1, '2026-02-01', { 11: { S: 30 + p } }));
  sessions.push(S(sid++, p, 2, '2026-02-01', { 12: { S: 30 } }));
}
// Un jugador sin ningún dato y un sintético: el primero sale en la tabla sin valores, el segundo no sale ni cuenta en la referencia.
players[20] = { id: 20, jerseyName: 'Sin datos' };
players[21] = { id: 21, jerseyName: 'Sintético', synthetic: 1 };
anth.push({ id: 98, playerId: 21, date: '2026-01-01', bodyMass: { value: 70, unit: 'kg' } });
sessions.push(S(sid++, 21, 3, '2026-02-01', { 13: { L: 100 * R.G, R: 100 * R.G } }), S(sid++, 21, 4, '2026-02-01', { 14: { L: 70 * R.G, R: 70 * R.G } }));

const t = dsiEurTodos({ loc, sessions, anthropometry: anth, players });
const fila = (id) => t.filas.find((f) => f.playerId === id);

check('una fila por jugador real; el sintético no aparece', t.filas.length === 13 && !t.filas.some((f) => f.playerId === 21), String(t.filas.length));
check('el jugador sin datos aparece, con sus casillas vacías y el motivo', fila(20).dsi.L.defined === false && fila(20).eur.defined === false && typeof fila(20).dsi.L.razon === 'string' && fila(20).dsi.L.razon.length > 0, JSON.stringify(fila(20).dsi.L.razon));

// ---- La comprobación importante: mismos números que jugador a jugador
let iguales = 0, distintos = [];
for (const id of [1, 2, 6, 12]) {
  const ref = R.ratioReferences({ loc, sessions, anthropometry: anth, players, playerId: id });
  const f = fila(id);
  const mismo = close(f.dsi.L.value, ref.mine.dsi.L.value) && close(f.dsi.R.value, ref.mine.dsi.R.value) && close(f.eur.value, ref.mine.eur.value)
    && f.dsi.L.ev.n === ref.dsiL.n && close(f.dsi.L.ev.percentileStat, ref.dsiL.percentileStat) && close(f.dsi.R.ev.percentileStat, ref.dsiR.percentileStat)
    && close(f.eur.ev.percentileStat, ref.eur.percentileStat) && f.dsi.L.ev.band === ref.dsiL.band && f.eur.ev.n === ref.eur.n
    && f.dsi.L.orientacion.text === R.strengthOrientation('dsi', ref.dsiL, [{ label: 'izquierda', ev: ref.kneeL }]).text
    && f.dsi.R.orientacion.text === R.strengthOrientation('dsi', ref.dsiR, [{ label: 'derecha', ev: ref.kneeR }]).text
    && f.eur.orientacion.text === R.strengthOrientation('eur', ref.eur).text;
  if (mismo) iguales++; else distintos.push(id);
}
check('cada jugador tiene el MISMO valor, percentil, N, banda y orientación que en su ficha', iguales === 4, 'difieren: ' + distintos.join());
check('el percentil excluye al propio jugador y al sintético (22 valores: 11 jugadores × 2 piernas)', fila(6).dsi.L.ev.n === 22, String(fila(6).dsi.L.ev.n));
check('un solo P50 para las dos piernas', fila(6).dsi.L.ev.p50 === fila(6).dsi.R.ev.p50);
check('recuento de la referencia: 24 valores de DSI y 12 de EUR', t.n.dsi === 24 && t.n.eur === 12 && t.n.jugadores === 13, JSON.stringify(t.n));

// ---- La regla del Knee Iso-Push por debajo del percentil 35 llega también aquí
const flojos = [1, 2].map(fila);
check('con el knee en el percentil 0–35, la orientación del DSI es la isométrica máxima, sea cual sea el ratio',
  flojos.every((f) => f.dsi.R.orientacion.text === R.ORIENT_ISO_MAX && /percentil 0–35/.test(f.dsi.R.orientacion.kneeNote)), JSON.stringify(flojos.map((f) => f.dsi.R.orientacion.text)));
check('la pierna con el knee normal no se ve arrastrada por la otra', flojos.every((f) => f.dsi.L.orientacion.text !== R.ORIENT_ISO_MAX), JSON.stringify(flojos.map((f) => f.dsi.L.orientacion.text)));
check('el EUR no tiene la regla del knee', fila(1).eur.orientacion.kneeNote === null || fila(1).eur.orientacion.kneeNote === undefined);

// ---- Orden
const nombre = (f) => f.player.jerseyName;
check('las tres formas de ordenar, con el jugador por defecto', ORDENES.map(([k]) => k).join() === 'jugador,dsi,eur');
const porNombre = ordenar(t.filas, 'jugador', nombre).map(nombre);
check('por jugador: alfabético, con los números como números (P2 antes que P10)', porNombre[0] === 'P1' && porNombre.indexOf('P2') < porNombre.indexOf('P10') && porNombre.includes('Sin datos'), porNombre.join(' '));
const porDsi = ordenar(t.filas, 'dsi', nombre);
const vals = porDsi.map((f) => valorOrden(f, 'dsi'));
check('por DSI: de mayor a menor y los que no tienen dato al final', vals.filter((v) => v !== null).every((v, i, a) => i === 0 || a[i - 1] >= v) && vals[vals.length - 1] === null, JSON.stringify(vals.map((v) => (v === null ? null : Number(v.toFixed(3))))));
const porEur = ordenar(t.filas, 'eur', nombre).map((f) => valorOrden(f, 'eur'));
check('por EUR: de mayor a menor y los que no tienen dato al final', porEur.filter((v) => v !== null).every((v, i, a) => i === 0 || a[i - 1] >= v) && porEur[porEur.length - 1] === null);
check('ordenar no toca la lista original', t.filas[0].playerId === 1);

// ---- Muestra insuficiente: sin percentil y sin orientación, pero con su valor
const pocos = dsiEurTodos({ loc, sessions, anthropometry: anth, players, minN: 50 });
const f6 = pocos.filas.find((f) => f.playerId === 6);
check('con muestra insuficiente se sigue viendo el valor, sin percentil ni orientación', f6.dsi.L.defined && f6.dsi.L.ev.sufficient === false && f6.dsi.L.orientacion.text === null && f6.eur.orientacion.text === null, JSON.stringify(f6.dsi.L.ev.reason));

process.exit(failed ? 1 : 0);
