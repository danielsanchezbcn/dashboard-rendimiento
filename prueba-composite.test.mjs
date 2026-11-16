// Bloque COMPOSITE PROFILE SCORE: comprobaciones de aceptación de la especificación v0.6 (15/11/2026), con datos 100 % sintéticos.
// Se prueba la lógica pura (composite.js): la media ponderada con los pesos del documento, los TEXTOS DE ORIENTACIÓN (que han sustituido al
// antiguo «No aplicable»: las 6 cualidades puntúan siempre que haya datos), la comparación propulsivo / explosivo, los datos que faltan,
// la altura del Drop Jump y los impulsos relativizados a la masa. Los percentiles en sí los calcula el dashboard y ya tienen sus propias pruebas.
import { strengthOrientation, ORIENT_ISO_MAX } from './relaciones.js';
import { CUALIDADES, UMBRALES_DEFAULT, T, V, claveDesc, calcular, puntuarCualidad, referenciaPosicional, pesosDe, expandirImpulsos, alturaDropJump, IMPULSOS_REL, orientacionDe, tendencia, DESC_IMP100, DESC_CPP } from './composite.js';

let fail = 0; const check = (n, ok, d = '') => { console.log((ok ? 'OK   ' : 'FAIL ') + n + (ok ? '' : ' ' + d)); if (!ok) fail = 1; };
const cual = (id) => CUALIDADES.find((c) => c.id === id);
const porId = (qs) => Object.fromEntries(qs.map((q) => [q.id, q]));
const desc = (id, donde, i) => cual(id)[donde][i];

// Percentiles sintéticos: una tabla clave → percentil. Lo que la pantalla construye de la base de datos, aquí se escribe a mano.
const TODO = {
  [claveDesc({ test: T.knee, variable: V.kneeRel })]: 60,
  [claveDesc({ test: T.cmj, variable: V.jh })]: 80,
  [claveDesc({ test: T.cmj, variable: V.cpp })]: 70,
  [claveDesc({ test: T.cmj, variable: V.conImp, rel: true })]: 50,
  [claveDesc({ test: T.cmj, variable: V.conImp100, rel: true })]: 40,
  [claveDesc({ test: T.cmj, variable: V.eccPp })]: 30,
  [claveDesc({ test: T.cmj, variable: V.eccImp, rel: true })]: 60,
  [claveDesc({ test: T.cmj, variable: V.eccRfd })]: 90,
  [claveDesc({ test: T.cmj, variable: V.rsiMod })]: 75,
  [claveDesc({ test: T.cmj, variable: V.stiff })]: 55,
  [claveDesc({ test: T.cmj, variable: V.ct })]: 45,
  [claveDesc({ test: T.cmj, variable: V.depth })]: 65,
  [claveDesc({ orz: true, variable: V.djRsi })]: 20,
  [claveDesc({ test: T.hop, variable: V.hopRsi })]: 40,
};
const medidaDe = (tabla) => (d) => { const p = tabla[claveDesc(d)]; return Number.isFinite(p) ? { pct: p, v: { unit: '' }, partes: [], n: 14 } : null; };
const sin = (tabla, ...claves) => { const t = { ...tabla }; for (const k of claves) delete t[k]; return t; };

// ---- 1. Un jugador con todos los datos tiene 6 puntuaciones y cada una es la media ponderada calculada a mano (pesos del documento del 15/11/2026).
const qs = calcular({ medida: medidaDe(TODO) });
check('seis cualidades, en el orden del documento', qs.length === 6 && qs.map((q) => q.id).join() === 'isometric,propulsive,decel,reactivity,explosive,shortgct', qs.map((q) => q.id).join());
check('los nombres son los del documento', qs.map((q) => q.nombre).join(' · ') === 'Isometric Strength · Propulsive / Dynamic Strength · Eccentric Deceleration · Energy Storage / Reactivity · Explosive / Snappy · Short GCT Reactive Strength', qs.map((q) => q.nombre).join(' · '));
const q = porId(qs);
check('Isometric = el percentil del Knee Iso-Push (peso único)', q.isometric.score === 60, String(q.isometric.score));
check('Propulsive / Dynamic Strength = 0,55×80 + 0,35×70 + 0,10×50 = 74', q.propulsive.score === 74, String(q.propulsive.score));
check('Eccentric Deceleration = media de 30, 60 y 90 = 60', q.decel.score === 60, String(q.decel.score));
check('Energy Storage / Reactivity = 0,80×75 + 0,20×55 = 71', q.reactivity.score === 71, String(q.reactivity.score));
check('Explosive / Snappy = 0,80×40 + 0,20×45 = 41', q.explosive.score === 41, String(q.explosive.score));
check('Short GCT = media de Drop Jump (20) y Hop (40) = 30', q.shortgct.score === 30, String(q.shortgct.score));
check('todas las puntuaciones son enteros de 0 a 100', qs.every((x) => x.score === null || (Number.isInteger(x.score) && x.score >= 0 && x.score <= 100)));
check('ninguna cualidad se anula por regla: solo «ok» o «sin-datos»', qs.every((x) => ['ok', 'sin-datos'].includes(x.estado)), qs.map((x) => x.estado).join());
check('con todos los datos, las 6 puntúan', qs.every((x) => x.estado === 'ok'));
// Dynamic Strength y Propulsive quedan unificadas: ya no existe una cualidad «dynamic» aparte.
check('Dynamic Strength y Propulsive están unificadas en una sola cualidad', !CUALIDADES.some((c) => c.id === 'dynamic') && cual('propulsive').scores.length === 3);

// ---- 2. Textos de orientación de la CUALIDAD.
check('Propulsive / Dynamic Strength 74 (> p65) → «Prioritize Power»', q.propulsive.orientacion === 'Prioritize Power', String(q.propulsive.orientacion));
const dynBajo = porId(calcular({ medida: medidaDe({ ...TODO, [claveDesc({ test: T.cmj, variable: V.jh })]: 20, [claveDesc({ test: T.cmj, variable: V.cpp })]: 30, [claveDesc({ test: T.cmj, variable: V.conImp, rel: true })]: 30 }) }));
check('Propulsive / Dynamic Strength 25 (< p35) → «Prioritize Strength»', dynBajo.propulsive.score === 25 && dynBajo.propulsive.orientacion === 'Prioritize Strength', `${dynBajo.propulsive.score} ${dynBajo.propulsive.orientacion}`);
const dynMedio = porId(calcular({ medida: medidaDe({ ...TODO, [claveDesc({ test: T.cmj, variable: V.jh })]: 50, [claveDesc({ test: T.cmj, variable: V.cpp })]: 50, [claveDesc({ test: T.cmj, variable: V.conImp, rel: true })]: 50 }) }));
check('Propulsive / Dynamic Strength 50: ninguna orientación', dynMedio.propulsive.score === 50 && dynMedio.propulsive.orientacion === null, String(dynMedio.propulsive.orientacion));
check('las demás cualidades no tienen orientación de cualidad', ['isometric', 'shortgct', 'decel', 'reactivity', 'explosive'].every((k) => q[k].orientacion === null));
check('una cualidad sin datos no tiene orientación', porId(calcular({ medida: () => null })).propulsive.orientacion === null);

// ---- 3. Textos de orientación de cada VARIABLE: la primera regla que se cumple, sobre su propio percentil. Las bandas INCLUYEN su extremo.
const dKnee = cual('isometric').scores[0], dF0 = cual('isometric').interp[1];
const dJhReact = cual('reactivity').interp[1], dDepth = cual('reactivity').interp[2], dCtReact = cual('reactivity').interp[3], dCtProp = cual('propulsive').interp[1];
check('Knee Iso-Push p30 (< p35) → «Prioritize max isometric strength»', orientacionDe(dKnee, 30) === 'Prioritize max isometric strength');
check('Knee Iso-Push p60: sin texto', orientacionDe(dKnee, 60) === null, String(orientacionDe(dKnee, 60)));
check('force at 0 velocity p35 (banda 0-35) → «Prioritize LML isometric strength»', orientacionDe(dF0, 35) === 'Prioritize LML isometric strength' && orientacionDe(dF0, 36) === null);
check('jump height p35 (banda 0-35) → «Prioritize foundational dynamic strength»', orientacionDe(dJhReact, 35) === 'Prioritize foundational dynamic strength');
check('jump height p80 (> p35) → «Acceptable output»', orientacionDe(dJhReact, 80) === 'Acceptable output');
check('depth p95 y p90 (banda 90-100) → «Prioritize increase functional depth»', orientacionDe(dDepth, 95) === 'Prioritize increase functional depth' && orientacionDe(dDepth, 90) === 'Prioritize increase functional depth', String(orientacionDe(dDepth, 95)));
check('depth p20 y p35 (banda 0-35) → «Propulsive strategy»', orientacionDe(dDepth, 20) === 'Propulsive strategy' && orientacionDe(dDepth, 35) === 'Propulsive strategy');
check('depth p70 (entre 35 y 90): sin texto', orientacionDe(dDepth, 70) === null, String(orientacionDe(dDepth, 70)));
check('contraction time p70 y p65 (banda 65-100) → «Snappy»', orientacionDe(dCtReact, 70) === 'Snappy' && orientacionDe(dCtReact, 65) === 'Snappy');
check('contraction time p50 (entre 35 y 65): sin texto', orientacionDe(dCtReact, 50) === null, String(orientacionDe(dCtReact, 50)));
// El texto de la banda baja del contraction time lleva «improve SSC utilization» SOLO donde lo pide el documento.
// 16/11/2026: el mismo texto en las TRES cualidades donde sale (antes Propulsive llevaba uno más corto).
check('contraction time 0-35 → «… , improve SSC utilization» en las tres cualidades', [dCtReact, cual('explosive').scores[1], dCtProp].every((d) => orientacionDe(d, 20) === 'Prioritize decrease contraction time, improve SSC utilization'), String(orientacionDe(dCtProp, 20)));
// Los mismos textos en TODOS los bloques donde aparece la variable.
const depthEn = ['propulsive', 'reactivity', 'explosive'].map((id) => [...cual(id).scores.flatMap((x) => x.interp ?? []), ...cual(id).interp].find((x) => x.variable === V.depth));
check('depth lleva los mismos textos en las tres cualidades donde aparece', depthEn.every((d) => d && orientacionDe(d, 95) === 'Prioritize increase functional depth' && orientacionDe(d, 10) === 'Propulsive strategy'), JSON.stringify(depthEn.map((d) => !!d)));
const jhEn = ['reactivity', 'explosive'].map((id) => cual(id).interp.find((x) => x.variable === V.jh));
check('jump height lleva los mismos textos en Energy Storage y en Explosive', jhEn.every((d) => d && orientacionDe(d, 10) === 'Prioritize foundational dynamic strength' && orientacionDe(d, 80) === 'Acceptable output'));
check('sin percentil no hay texto', orientacionDe(dDepth, null) === null && orientacionDe(dDepth, undefined) === null);
check('una variable sin reglas no tiene texto', orientacionDe(cual('decel').scores[0], 5) === null);
check('los umbrales se pueden configurar en Ajustes', orientacionDe(dJhReact, 30, { ...UMBRALES_DEFAULT, p35: 20 }) === 'Acceptable output' && orientacionDe(dDepth, 80, { ...UMBRALES_DEFAULT, p90: 75 }) === 'Prioritize increase functional depth');
// Interpretativas nuevas del documento, sin texto: solo muestran su percentil.
check('Eccentric Deceleration incluye ecc decel phase duration como interpretativa', cual('decel').interp.some((d) => d.variable === V.eccDur && !d.orient));
check('Energy Storage / Reactivity incluye ecc decel RFD como interpretativa', cual('reactivity').interp.some((d) => d.variable === V.eccRfd && !d.orient));
// Interpretativas que miran la puntuación de OTRA cualidad (se miran entre sí: hace falta calcular las dos antes de resolverlas).
const dCualProp = cual('reactivity').interp[4], dCualReact = cual('propulsive').interp[2];
// 16/11/2026: cada cualidad lee la puntuación de la otra en las dos bandas, no solo en una.
check('Energy Storage lee Propulsive: 0-35 → «Poor propulsive characteristics…»', dCualProp.id === 'propulsive' && orientacionDe(dCualProp, 35) === 'Poor propulsive characteristics. Prioritize Dynamic strength / concentric emphasis', String(orientacionDe(dCualProp, 35)));
check('Energy Storage lee Propulsive: 65-100 → «Good propulsive characteristics»', orientacionDe(dCualProp, 65) === 'Good propulsive characteristics' && orientacionDe(dCualProp, 50) === null);
check('Propulsive lee Energy Storage: 0-35 → «Poor reactive characteristics»', dCualReact.id === 'reactivity' && orientacionDe(dCualReact, 20) === 'Poor reactive characteristics');
check('Propulsive lee Energy Storage: 65-100 → «Good reactive characteristics»', orientacionDe(dCualReact, 71) === 'Good reactive characteristics' && orientacionDe(dCualReact, 50) === null);
const cruz = calcular({ medida: medidaDe(TODO) });
const resolver = (d) => { const x = cruz.find((c) => c.id === d.id); return x ? x.scoreBruto : null; };
check('las dos referencias cruzadas se resuelven, aunque se miren entre sí', resolver(dCualProp) === 74 && resolver(dCualReact) === 71, `${resolver(dCualProp)} / ${resolver(dCualReact)}`);

// ---- 4. Comparación propulsivo / explosivo: se decide con PERCENTILES. Texto CORTO en Propulsive y LARGO en Explosive (documento del 15/11/2026).
check('con impulse 100 ms p40 < con peak power p70 → «Propulsive tendency»', tendencia(medidaDe(TODO)) === 'Propulsive tendency', String(tendencia(medidaDe(TODO))));
check('con impulse 100 ms p90 > con peak power p70 → «Explosive tendency»', tendencia(medidaDe({ ...TODO, [claveDesc(DESC_IMP100)]: 90 })) === 'Explosive tendency');
check('el mismo texto en las dos cualidades: ya no hay variante larga', cual('propulsive').scores[1].tendencia === cual('explosive').scores[0].tendencia);
check('percentiles iguales → se dice que están igualados', tendencia(medidaDe({ ...TODO, [claveDesc(DESC_IMP100)]: 70 })) === 'Explosive = Propulsive tendency');
check('sin uno de los dos percentiles no hay tendencia', tendencia(medidaDe(sin(TODO, claveDesc(DESC_CPP)))) === null);
check('la tendencia no cambia ninguna puntuación', porId(calcular({ medida: medidaDe({ ...TODO, [claveDesc(DESC_IMP100)]: 70 }) })).propulsive.score === 74);
check('la comparación va en la fila de peak power (Propulsive) y en la del impulso a 100 ms (Explosive)', !!cual('propulsive').scores[1].tendencia && cual('propulsive').scores[1].variable === V.cpp && !!cual('explosive').scores[0].tendencia);
check('la comparación usa CON IMPULSE 100ms/BM y CON PEAK POWER/BM del CMJ', claveDesc(DESC_IMP100) === claveDesc({ test: T.cmj, variable: V.conImp100, rel: true }) && claveDesc(DESC_CPP) === claveDesc({ test: T.cmj, variable: V.cpp }));

// ---- 4 bis. DSI y EUR: normas definitivas del 15/11/2026.
const evP = (p) => ({ sufficient: true, percentileStat: p, percentilePerf: p, n: 14 });
const txt = (kind, p) => strengthOrientation(kind, evP(p), [{ label: 'izquierda', ev: evP(70) }]).text;
check('DSI 0-40 → «SSC training orientation»', txt('dsi', 20) === 'SSC training orientation', txt('dsi', 20));
check('DSI 40-60 → «Concurrent strength training»', txt('dsi', 50) === 'Concurrent strength training' && txt('dsi', 40) === 'Concurrent strength training' && txt('dsi', 60) === 'Concurrent strength training');
check('DSI 60-100 → «Max isometric strength training orientation»', txt('dsi', 80) === 'Max isometric strength training orientation', txt('dsi', 80));
check('EUR 0-40 → «SSC training orientation»', txt('eur', 20) === 'SSC training orientation');
check('EUR 40-60 → «Concurrent strength training»', txt('eur', 50) === 'Concurrent strength training');
check('EUR 60-100 → «Strength training orientation without SSC»', txt('eur', 80) === 'Strength training orientation without SSC', txt('eur', 80));
check('Knee Iso-Push en el percentil 0-35: el DSI dice «Iso maximal strength training orientation», sea cual sea el ratio', [10, 50, 90].every((dsi) => strengthOrientation('dsi', evP(dsi), [{ label: 'izquierda', ev: evP(30) }]).text === ORIENT_ISO_MAX) && ORIENT_ISO_MAX === 'Iso maximal strength training orientation');
check('el percentil 35 justo entra en la banda del Knee Iso-Push', strengthOrientation('dsi', evP(90), [{ label: 'izquierda', ev: evP(35) }]).text === ORIENT_ISO_MAX);
check('Knee p60: la orientación vuelve a salir del ratio del DSI', strengthOrientation('dsi', evP(10), [{ label: 'izquierda', ev: evP(60) }]).text !== ORIENT_ISO_MAX);
check('la regla solo afecta al DSI, no al EUR', strengthOrientation('eur', evP(90), [{ label: 'izquierda', ev: evP(10) }]).text === 'Strength training orientation without SSC');
check('ya no se avisa de «la orientación puede variar» por el percentil 40 del Knee Iso-Push', [strengthOrientation('dsi', evP(20), [{ label: 'izquierda', ev: evP(39) }]), strengthOrientation('eur', evP(90), [{ label: 'izquierda', ev: evP(39) }])].every((o) => o.kneeNote === null), JSON.stringify(strengthOrientation('eur', evP(90), [{ label: 'izquierda', ev: evP(39) }])));
const knee70 = porId(calcular({ medida: medidaDe({ ...TODO, [claveDesc({ test: T.knee, variable: V.kneeRel })]: 70 }) }));
check('Knee p70: Isometric Strength puntúa 70', knee70.isometric.score === 70 && knee70.isometric.estado === 'ok');

// ---- 5. Datos que faltan (3.8): «—», nunca 0, y reparto del peso entre las que quedan.
const sinHop = porId(calcular({ medida: medidaDe(sin(TODO, claveDesc({ test: T.hop, variable: V.hopRsi }))) }));
check('sin Hop Test, Short GCT puntúa con el Drop Jump y marca 1 de 2', sinHop.shortgct.estado === 'ok' && sinHop.shortgct.score === 20 && sinHop.shortgct.usadas === 1 && sinHop.shortgct.total === 2, JSON.stringify([sinHop.shortgct.score, sinHop.shortgct.usadas]));
const sinCmj = porId(calcular({ medida: medidaDe(Object.fromEntries(Object.entries(TODO).filter(([k]) => !k.startsWith(T.cmj + '|')))) }));
check('sin CMJ: Propulsive, Eccentric Deceleration, Energy Storage y Explosive salen «—», nunca 0', ['propulsive', 'decel', 'reactivity', 'explosive'].every((k) => sinCmj[k].estado === 'sin-datos' && sinCmj[k].score === null), JSON.stringify(['propulsive', 'decel', 'reactivity', 'explosive'].map((k) => [k, sinCmj[k].estado, sinCmj[k].score])));
check('sin CMJ: Isometric y Short GCT siguen puntuando', sinCmj.isometric.score === 60 && sinCmj.shortgct.score === 30);
const sinCpp = porId(calcular({ medida: medidaDe(sin(TODO, claveDesc({ test: T.cmj, variable: V.cpp }))) }));
check('falta una variable que no es la principal: se reparte su peso', sinCpp.propulsive.estado === 'ok' && sinCpp.propulsive.score === Math.round((0.55 * 80 + 0.1 * 50) / 0.65) && sinCpp.propulsive.usadas === 2, String(sinCpp.propulsive.score));
const sinJh = porId(calcular({ medida: medidaDe(sin(TODO, claveDesc({ test: T.cmj, variable: V.jh }))) }));
check('falta la variable principal (jump height, 55 %): la cualidad sale «—»', sinJh.propulsive.estado === 'sin-datos' && sinJh.propulsive.faltaCritica === true);
const sinDepth = puntuarCualidad(cual('reactivity'), medidaDe(sin(TODO, claveDesc({ test: T.cmj, variable: V.depth }))), UMBRALES_DEFAULT, {});
check('una interpretativa sin dato no cambia la puntuación', sinDepth.estado === 'ok' && sinDepth.score === 71, `${sinDepth.estado} ${sinDepth.score}`);

// ---- 6. Pesos editables en Ajustes (3.10).
check('los pesos del documento son los de partida', pesosDe(cual('propulsive'), {}).join() === '0.55,0.35,0.1', pesosDe(cual('propulsive'), {}).join());
check('Energy Storage 80 / 20 y Explosive 80 / 20, como el documento', pesosDe(cual('reactivity'), {}).join() === '0.8,0.2' && pesosDe(cual('explosive'), {}).join() === '0.8,0.2');
check('Eccentric Deceleration reparte en tres tercios', pesosDe(cual('decel'), {}).every((x) => Math.abs(x - 1 / 3) < 1e-9));
const otros = { propulsive: [0.5, 0.25, 0.25] };
check('un peso guardado cambia la puntuación', puntuarCualidad(cual('propulsive'), medidaDe(TODO), UMBRALES_DEFAULT, otros).score === Math.round(0.5 * 80 + 0.25 * 70 + 0.25 * 50));
check('un peso inválido no rompe nada: se usa el del documento', pesosDe(cual('propulsive'), { propulsive: ['x', -3, 0.1] }).join() === '0.55,0.35,0.1');
// Referencias posicionales del radar: mismos pesos que la cualidad
check('la referencia posicional usa los mismos pesos', referenciaPosicional(cual('propulsive'), (d) => ({ [claveDesc({ test: T.cmj, variable: V.jh })]: 60, [claveDesc({ test: T.cmj, variable: V.cpp })]: 40, [claveDesc({ test: T.cmj, variable: V.conImp, rel: true })]: 20 })[claveDesc(d)]) === Math.round(0.55 * 60 + 0.35 * 40 + 0.1 * 20));
check('sin referencia posicional en ninguna variable, el eje no tiene referencia', referenciaPosicional(cual('propulsive'), () => null) === null);

// ---- 7. Drop Jump: ORZ, una sola altura o empate (3.4).
check('con ORZ se usa esa altura', alturaDropJump({ orz: { defined: true, height: 45 }, hay30: true, hay45: true }).alturas.join() === '45');
check('solo 30 cm testado: se usa 30', alturaDropJump({ orz: { defined: false, hidden: true }, hay30: true, hay45: false }).alturas.join() === '30');
check('solo 45 cm testado: se usa 45', alturaDropJump({ orz: { defined: false, hidden: true }, hay30: false, hay45: true }).alturas.join() === '45');
check('empate exacto: las dos alturas', alturaDropJump({ orz: { defined: false, hidden: false }, hay30: true, hay45: true }).alturas.join() === '30,45');
check('sin Drop Jump: ninguna altura', alturaDropJump({ orz: { defined: false, hidden: true }, hay30: false, hay45: false }).alturas.length === 0);

// ---- 8. Impulsos relativizados a la masa (3.3): mismo impulso y distinta masa → distinto valor, y el más ligero sale mejor.
const vars = [
  { id: 1, testId: 7, name: V.conImp, unit: 'N s', sides: 'S', direction: 'higher' },
  { id: 2, testId: 7, name: V.conImp100, unit: 'N s', sides: 'S', direction: 'higher' },
  { id: 3, testId: 7, name: V.eccImp, unit: 'N s', sides: 'S', direction: 'higher' },
];
const ses = [
  { id: 1, playerId: 1, testId: 7, date: '2026-03-01', status: 'ok', values: { 1: { S: 180 }, 2: { S: 60 }, 3: { S: 90 } } },
  { id: 2, playerId: 2, testId: 7, date: '2026-03-01', status: 'ok', values: { 1: { S: 180 }, 2: { S: 60 }, 3: { S: 90 } } },
  { id: 3, playerId: 3, testId: 7, date: '2026-03-01', status: 'ok', values: { 1: { S: 180 } } },
];
const anth = [{ playerId: 1, date: '2026-02-01', bodyMass: { value: 70, unit: 'kg' } }, { playerId: 2, date: '2026-02-01', bodyMass: { value: 90, unit: 'kg' } }];
const exp = expandirImpulsos({ variables: vars, testId: 7, sessions: ses, anthropometry: anth });
const val = (sid, vid) => exp.sessions.find((s) => s.id === sid).values[vid]?.S;
check('se crean las tres variables virtuales, con id negativo y en N·s/kg', exp.variables.length === 3 && exp.variables.every((v) => v.id < 0 && v.unit === 'N s/kg'), JSON.stringify(exp.variables.map((v) => [v.id, v.name, v.unit])));
check('180 N·s con 70 kg = 2,571 N·s/kg', Math.abs(val(1, -101) - 180 / 70) < 1e-9, String(val(1, -101)));
check('el mismo impulso con 90 kg da menos N·s/kg: el de 70 kg sale mejor', val(1, -101) > val(2, -101) && Math.abs(val(2, -101) - 2) < 1e-9, `${val(1, -101)} vs ${val(2, -101)}`);
check('los tres impulsos se relativizan', Math.abs(val(1, -102) - 60 / 70) < 1e-9 && Math.abs(val(1, -103) - 90 / 70) < 1e-9);
check('sin masa no hay impulso relativo y se cuenta', val(3, -101) === undefined && exp.sinMasa === 1, String(exp.sinMasa));
check('no se toca el valor absoluto', exp.sessions.find((s) => s.id === 1).values[1].S === 180);
check('las variables virtuales no se guardan en el catálogo', vars.length === 3 && exp.variables.every((v) => v.virtual === true));
const nombres = IMPULSOS_REL.map((r) => r.name).join();
check('los nombres dicen que son por kilo', nombres === 'CON IMPULSE/BM,CON IMPULSE 100ms/BM,ECC DECELERATION IMPULSE/BM', nombres);

// ---- 9. Las interpretativas nunca puntúan.
const soloInterp = puntuarCualidad(cual('isometric'), (d) => (d.tipo ? { pct: 99 } : medidaDe(TODO)(d)), UMBRALES_DEFAULT, {});
check('una interpretativa no entra en la media', soloInterp.score === 60);

process.exit(fail);
