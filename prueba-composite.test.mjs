// Bloque COMPOSITE PROFILE SCORE: comprobaciones de aceptación de la especificación v0.3 (§4), con datos 100 % sintéticos.
// Se prueba la lógica pura (composite.js): la media ponderada, las reglas de «No aplicable», los datos que faltan, la altura del Drop Jump
// y los impulsos relativizados a la masa. Los percentiles en sí los calcula el dashboard y ya tienen sus propias pruebas.
import { CUALIDADES, UMBRALES_DEFAULT, T, V, claveDesc, calcular, puntuarCualidad, referenciaPosicional, pesosDe, expandirImpulsos, alturaDropJump, dsiNoAplicable, IMPULSOS_REL } from './composite.js';

let fail = 0; const check = (n, ok, d = '') => { console.log((ok ? 'OK   ' : 'FAIL ') + n + (ok ? '' : ' ' + d)); if (!ok) fail = 1; };
const cual = (id) => CUALIDADES.find((c) => c.id === id);
const porId = (qs) => Object.fromEntries(qs.map((q) => [q.id, q]));

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

// ---- 1. Un jugador con todos los datos tiene 7 puntuaciones y cada una es la media ponderada calculada a mano.
const qs = calcular({ medida: medidaDe(TODO) });
check('siete cualidades, en el orden del documento', qs.length === 7 && qs.map((q) => q.id).join() === 'isometric,dynamic,shortgct,decel,reactivity,propulsive,explosive', qs.map((q) => q.id).join());
const q = porId(qs);
check('Isometric = el percentil del Knee Iso-Push (peso único)', q.isometric.score === 60, String(q.isometric.score));
check('Dynamic = 0,70×80 + 0,15×70 + 0,15×50 = 74', q.dynamic.score === 74, String(q.dynamic.score));
check('Short GCT = media de Drop Jump (20) y Hop (40) = 30', q.shortgct.score === 30, String(q.shortgct.score));
check('Deceleration = media de 30, 60 y 90 = 60', q.decel.score === 60, String(q.decel.score));
check('Reactivity = 0,80×75 + 0,20×55 = 71', q.reactivity.score === 71, String(q.reactivity.score));
check('Propulsive = 0,80×70 + 0,20×50 = 66 y es aplicable (40 < 70)', q.propulsive.score === 66 && q.propulsive.estado === 'ok', `${q.propulsive.score} ${q.propulsive.estado}`);
check('Explosive es «No aplicable» (con impulse 100 ms p40 no es mayor que con peak power p70)', q.explosive.estado === 'na' && q.explosive.score === null, JSON.stringify(q.explosive.fallan));
check('todas las puntuaciones son enteros de 0 a 100', qs.every((x) => x.score === null || (Number.isInteger(x.score) && x.score >= 0 && x.score <= 100)));

// ---- 2. JH p30 → Reactivity y Explosive «No aplicable»; Dynamic Strength sigue puntuando.
const bajoJh = porId(calcular({ medida: medidaDe({ ...TODO, [claveDesc({ test: T.cmj, variable: V.jh })]: 30, [claveDesc({ test: T.cmj, variable: V.conImp100, rel: true })]: 90 }) }));
check('JH p30: Reactivity «No aplicable»', bajoJh.reactivity.estado === 'na' && bajoJh.reactivity.fallan.some((f) => f.clave === 'jh'), JSON.stringify(bajoJh.reactivity.fallan));
check('JH p30: Explosive «No aplicable»', bajoJh.explosive.estado === 'na' && bajoJh.explosive.fallan.some((f) => f.clave === 'jh'));
check('JH p30: Dynamic Strength se calcula igual', bajoJh.dynamic.estado === 'ok' && bajoJh.dynamic.score === 0.7 * 30 + 0.15 * 70 + 0.15 * 50, String(bajoJh.dynamic.score));
check('JH p30: el texto de la regla nombra la variable y el umbral', bajoJh.reactivity.fallan[0].texto === 'jump height p30 (< p35)', bajoJh.reactivity.fallan[0].texto);
// depth y contraction time por debajo de p10 anulan Reactivity; depth también Explosive
const bajoDepth = porId(calcular({ medida: medidaDe({ ...TODO, [claveDesc({ test: T.cmj, variable: V.depth })]: 7, [claveDesc({ test: T.cmj, variable: V.conImp100, rel: true })]: 90 }) }));
check('depth p7: Reactivity y Explosive «No aplicable», Dynamic no', bajoDepth.reactivity.estado === 'na' && bajoDepth.explosive.estado === 'na' && bajoDepth.dynamic.estado === 'ok');
const bajoCt = porId(calcular({ medida: medidaDe({ ...TODO, [claveDesc({ test: T.cmj, variable: V.ct })]: 5, [claveDesc({ test: T.cmj, variable: V.conImp100, rel: true })]: 90 }) }));
check('contraction time p5: anula Reactivity pero no Explosive', bajoCt.reactivity.estado === 'na' && bajoCt.explosive.estado === 'ok', `${bajoCt.reactivity.estado} / ${bajoCt.explosive.estado}`);

// ---- 3. Percentiles iguales en los dos impulsos → Propulsive y Explosive «No aplicable» (consecuencia esperada del documento).
const iguales = porId(calcular({ medida: medidaDe({ ...TODO, [claveDesc({ test: T.cmj, variable: V.conImp100, rel: true })]: 70 }) }));
check('con impulse 100 ms = con peak power: las dos cualidades «No aplicable»', iguales.propulsive.estado === 'na' && iguales.explosive.estado === 'na');
check('siempre una de las dos sale «No aplicable»', [40, 70, 95].every((p) => { const x = porId(calcular({ medida: medidaDe({ ...TODO, [claveDesc({ test: T.cmj, variable: V.conImp100, rel: true })]: p }) })); return x.propulsive.estado === 'na' || x.explosive.estado === 'na'; }));
check('«No aplicable» no cambia las demás cualidades', iguales.dynamic.score === q.dynamic.score && iguales.reactivity.score === q.reactivity.score);

// ---- 4. Knee Iso-Push p70 → la fila del DSI es «No aplicable» y Isometric Strength muestra 70.
const knee70 = porId(calcular({ medida: medidaDe({ ...TODO, [claveDesc({ test: T.knee, variable: V.kneeRel })]: 70 }) }));
check('Knee p70: Isometric Strength puntúa 70', knee70.isometric.score === 70 && knee70.isometric.estado === 'ok');
check('Knee p70: la fila del DSI es «No aplicable»', dsiNoAplicable(70, UMBRALES_DEFAULT) === true && dsiNoAplicable(60, UMBRALES_DEFAULT) === false);
check('la regla del DSI usa el umbral de Ajustes', dsiNoAplicable(70, { p65: 80 }) === false);

// ---- 5. Datos que faltan (3.8): «—», nunca 0, y reparto del peso entre las que quedan.
const sinHop = porId(calcular({ medida: medidaDe(sin(TODO, claveDesc({ test: T.hop, variable: V.hopRsi }))) }));
check('sin Hop Test, Short GCT puntúa con el Drop Jump y marca 1 de 2', sinHop.shortgct.estado === 'ok' && sinHop.shortgct.score === 20 && sinHop.shortgct.usadas === 1 && sinHop.shortgct.total === 2, JSON.stringify([sinHop.shortgct.score, sinHop.shortgct.usadas]));
const sinCmj = porId(calcular({ medida: medidaDe(Object.fromEntries(Object.entries(TODO).filter(([k]) => !k.startsWith(T.cmj + '|')))) }));
check('sin CMJ: Dynamic, Deceleration, Reactivity, Propulsive y Explosive salen «—», nunca 0', ['dynamic', 'decel', 'reactivity', 'propulsive', 'explosive'].every((k) => sinCmj[k].estado === 'sin-datos' && sinCmj[k].score === null), JSON.stringify(['dynamic', 'decel', 'reactivity', 'propulsive', 'explosive'].map((k) => [k, sinCmj[k].estado, sinCmj[k].score])));
check('sin CMJ: Isometric y Short GCT siguen puntuando', sinCmj.isometric.score === 60 && sinCmj.shortgct.score === 30);
const sinCpp = porId(calcular({ medida: medidaDe(sin(TODO, claveDesc({ test: T.cmj, variable: V.cpp }))) }));
check('falta una variable que no es la principal: se reparte su peso', sinCpp.dynamic.estado === 'ok' && sinCpp.dynamic.score === Math.round((0.7 * 80 + 0.15 * 50) / 0.85) && sinCpp.dynamic.usadas === 2, String(sinCpp.dynamic.score));
check('falta la variable principal (CON PEAK POWER/BM en Propulsive): la cualidad sale «—»', sinCpp.propulsive.estado === 'sin-datos' && sinCpp.propulsive.faltaCritica === true);
const regla = puntuarCualidad(cual('reactivity'), medidaDe(sin(TODO, claveDesc({ test: T.cmj, variable: V.depth }))), UMBRALES_DEFAULT, {});
check('una regla sin dato no se evalúa y queda constancia', regla.reglas.find((r) => r.clave === 'depth').evaluada === false && regla.estado === 'ok');

// ---- 6. Pesos editables en Ajustes (3.10).
check('los pesos del documento son los de partida', pesosDe(cual('dynamic'), {}).join() === '0.7,0.15,0.15');
const otros = { dynamic: [0.5, 0.25, 0.25] };
check('un peso guardado cambia la puntuación', puntuarCualidad(cual('dynamic'), medidaDe(TODO), UMBRALES_DEFAULT, otros).score === Math.round(0.5 * 80 + 0.25 * 70 + 0.25 * 50));
check('un peso inválido no rompe nada: se usa el del documento', pesosDe(cual('dynamic'), { dynamic: ['x', -3, 0.15] }).join() === '0.7,0.15,0.15');
// Referencias posicionales del radar: mismos pesos que la cualidad
check('la referencia posicional usa los mismos pesos', referenciaPosicional(cual('dynamic'), (d) => ({ [claveDesc({ test: T.cmj, variable: V.jh })]: 60, [claveDesc({ test: T.cmj, variable: V.cpp })]: 40, [claveDesc({ test: T.cmj, variable: V.conImp, rel: true })]: 20 })[claveDesc(d)]) === Math.round(0.7 * 60 + 0.15 * 40 + 0.15 * 20));
check('sin referencia posicional en ninguna variable, el eje no tiene referencia', referenciaPosicional(cual('dynamic'), () => null) === null);

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
