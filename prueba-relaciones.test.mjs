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
check('locate: encuentra las 6 variables por nombre', ['cmjJh', 'sjJh', 'slForce', 'kneeForce', 'rsi30', 'rsi45'].every((k) => loc[k]));
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
// Un único conjunto con ambos lados (22 valores de 11 jugadores reales, sin el propio ni el sintético); percentil por rango medio de cada lado frente al total; color solo de posición.
const pool = []; for (const id of Object.keys(players).map(Number)) { if (id === 6 || players[id].synthetic) continue; const r = R.relationsFor({ loc, sessions, anthropometry: anth, playerId: id }); for (const k of ['L', 'R']) if (r.dsi[k].defined) pool.push(r.dsi[k].value); }
const mid = (x) => ((pool.filter((v) => v < x).length + pool.filter((v) => v === x).length / 2) / pool.length) * 100;
check('percentil DSI pooled L+R (22 valores) con color de posición', ref.dsiL.n === 22 && pool.length === 22 && ref.dsiL.sufficient && ref.dsiL.band !== null && Math.abs(ref.dsiL.percentileStat - mid(ref.mine.dsi.L.value)) < 1e-9 && Math.abs(ref.dsiR.percentileStat - mid(ref.mine.dsi.R.value)) < 1e-9, JSON.stringify(ref.dsiL));
check('un solo P50 para ambas piernas', ref.dsiL.p50 === ref.dsiR.p50);
check('ORZ sin Drop Jump de ningún jugador: oculta', ref.mine.orz.hidden === true);
check('muestra mínima respetada', R.ratioReferences({ loc, sessions, anthropometry: anth, players, playerId: 6, minN: 30 }).dsiL.sufficient === false);
// Orientación de fuerza (cortes 40/60; aviso de Knee Iso-Push < 40 solo en DSI bajo y EUR alto)
const E = (p, ok = true) => ({ sufficient: ok, percentileStat: ok ? p : null });
check('DSI 20 → Ballistic; 40 y 60 → Concurrent; 61 → Maximal', R.strengthOrientation('dsi', E(20), []).text === 'Ballistic strength training orientation' && R.strengthOrientation('dsi', E(40), []).text === 'Concurrent strength training' && R.strengthOrientation('dsi', E(60), []).text === 'Concurrent strength training' && R.strengthOrientation('dsi', E(61), []).text === 'Maximal strength training orientation');
check('EUR 20 → Plyometric; 50 → Concurrent; 90 → Maximal', R.strengthOrientation('eur', E(20), []).text === 'Plyometric strength training orientation' && R.strengthOrientation('eur', E(50), []).text === 'Concurrent strength training' && R.strengthOrientation('eur', E(90), [{ label: 'izquierda', ev: E(70) }]).text === 'Maximal strength training orientation');
// Desde el 14/11/2026, con el Knee Iso-Push por debajo del percentil 35 la orientación del DSI se fuerza, sea cual sea el ratio.
check('DSI con Knee < 35: la orientación es fuerza isométrica máxima y se explica por qué', R.strengthOrientation('dsi', E(10), [{ label: 'izquierda', ev: E(30) }]).text === R.ORIENT_ISO_MAX && /por debajo del percentil 35/.test(R.strengthOrientation('dsi', E(10), [{ label: 'izquierda', ev: E(30) }]).kneeNote));
check('DSI con Knee entre 35 y 40: la orientación sale del ratio, pero avisa', R.strengthOrientation('dsi', E(10), [{ label: 'izquierda', ev: E(37) }]).text === 'Ballistic strength training orientation' && /por debajo de 40 \(izquierda 37\)/.test(R.strengthOrientation('dsi', E(10), [{ label: 'izquierda', ev: E(37) }]).kneeNote));
check('DSI bajo con Knee ≥ 40: sin aviso; sin dato de Knee: aviso de no comprobado', R.strengthOrientation('dsi', E(10), [{ label: 'izquierda', ev: E(55) }]).kneeNote === null && /No se ha podido comprobar/.test(R.strengthOrientation('dsi', E(10), [{ label: 'izquierda', ev: null }]).kneeNote));
check('DSI medio/alto con Knee flojo: también se fuerza la orientación', R.strengthOrientation('dsi', E(50), [{ label: 'izquierda', ev: E(10) }]).text === R.ORIENT_ISO_MAX);
check('DSI medio/alto con Knee bien: sin aviso de Knee', R.strengthOrientation('dsi', E(50), [{ label: 'izquierda', ev: E(70) }]).kneeNote === null);
check('EUR alto con Knee < 40 en una pierna: aviso de esa pierna', /derecha 20/.test(R.strengthOrientation('eur', E(90), [{ label: 'izquierda', ev: E(70) }, { label: 'derecha', ev: E(20) }]).kneeNote));
check('muestra insuficiente: sin orientación', R.strengthOrientation('dsi', E(0, false), []).text === null);
check('Knee relativo por lado definido', ref.mine.knee.L.defined === true);
// Cuadrantes de componentes: DSI (Knee BW × SL BW, un punto por lado) y EUR (SJ PB × CMJ PA); cortes = mediana de La Liga de cada eje
const cq = R.componentQuadrants({ loc, sessions, anthropometry: anth, players, playerId: 6 });
check('cuadrante DSI: 2 puntos propios (I y D) con x = Knee BW e y = SL BW', cq.mine.dsi.length === 2 && close(cq.mine.dsi[0].x, ref.mine.dsi.L.kneeBW) && close(cq.mine.dsi[0].y, ref.mine.dsi.L.slBW));
check('cuadrante DSI: fondo de 22 puntos (11 jugadores × 2 lados, sin sintético) y cortes = medianas', cq.dsi.bg.length === 22 && cq.dsi.n === 11 && cq.dsi.cutX !== null && close(cq.dsi.cutX, [...cq.dsi.bg.map((p) => p.x)].sort((a, b) => a - b).slice(10, 12).reduce((a, b) => a + b, 0) / 2));
check('cuadrante EUR: punto propio x = SJ PB, y = CMJ PA; 11 de fondo', close(cq.mine.eur.x, ref.mine.eur.sjPB) && close(cq.mine.eur.y, ref.mine.eur.cmjPA) && cq.eur.bg.length === 11 && cq.eur.cutY !== null);
const cq2 = R.componentQuadrants({ loc, sessions, anthropometry: anth, players, playerId: 6, minN: 30 });
check('muestra insuficiente: sin cortes', cq2.dsi.cutX === null && cq2.eur.cutY === null);
check('posición: igual al corte cuenta como por encima; sin corte → null', R.quadrantSide({ x: 1, y: 2 }, 1, 3).xHigh === true && R.quadrantSide({ x: 1, y: 2 }, 1, 3).yHigh === false && R.quadrantSide({ x: 1, y: 2 }, null, 3) === null);
// Jugadores sin masa utilizable (12/11/2026): ni medición de peso ni peso de referencia
{
  const pls = [{ id: 1, active: true, jerseyName: 'Con peso' }, { id: 2, active: true, jerseyName: 'Con referencia', referenceWeight: { value: 77, unit: 'kg' } }, { id: 3, active: true, jerseyName: 'Sin nada' }, { id: 4, active: false, jerseyName: 'Inactivo' }, { id: 5, active: true, jerseyName: 'Unidad rara', referenceWeight: { value: 77, unit: 'piedras' } }];
  const ant = [{ id: 1, playerId: 1, date: '2026-01-10', bodyMass: { value: 70, unit: 'kg' } }];
  const faltan = R.playersWithoutMass(pls, ant);
  check('sin masa: ni medición ni peso de referencia, solo jugadores activos', faltan.map((p) => p.id).join(',') === '3,5', faltan.map((p) => p.id).join(','));
  check('sin masa: se puede limitar a los que tienen datos del test', R.playersWithoutMass(pls, ant, [1, 3]).map((p) => p.id).join(',') === '3');
  check('sin masa: con todos los pesos puestos, la lista queda vacía', R.playersWithoutMass([pls[0], pls[1]], ant).length === 0);
}

process.exit(failed ? 1 : 0);
