import { profileForTest, buildRadar, RADAR_PROFILES } from './radar.js';
let fail = 0; const check = (n, ok, d = '') => { console.log((ok ? 'OK   ' : 'FAIL ') + n + (ok ? '' : ' ' + d)); if (!ok) fail = 1; };
const profile = RADAR_PROFILES[0];
check('perfil: seis variables del CMJ en el orden de la imagen', profile.center === 'CMJ' && profile.axes.map((a) => a.label).join('|') === 'JH (imp-mom)|Peak Power/BM|CON Impulse 100ms|RSI mod|EDRFD/BM|ECC Peak Power/BM');
const test = { id: 1, name: 'CMJ' };
const base = { 'JH (imp-mom)': 38, 'CON PEAK POWER/BM': 56, 'CON IMPULSE 100ms': 112, 'RSI MOD': 0.55, 'ECC DECEL RFD': 95, 'ECC PEAK POWER/BM': 22.6 };
const variables = Object.keys(base).map((name, i) => ({ id: 10 + i, testId: 1, name, unit: 'u', sides: 'single', direction: 'higher', archived: false }));
const players = Object.fromEntries(Array.from({ length: 13 }, (_, k) => [k + 1, { id: k + 1, jerseyName: 'P' + k }]));
const sessions = []; let sid = 1;
for (let p = 1; p <= 13; p++) for (let d = 0; d < 2; d++) sessions.push({ id: sid++, playerId: p, testId: 1, date: `2026-03-${10 + d}`, time: '', status: 'valid', values: Object.fromEntries(variables.map((v) => [v.id, { S: base[v.name] * (0.8 + p * 0.03 + d * 0.02) }])), reps: { total: 5 } });
const run = (o = {}) => buildRadar({ profile, test, variables, sessions, players, histories: {}, playerId: 4, basis: 'pa', positionId: null, minN: 10, ...o });
let r = run();
check('seis ejes dibujables con Premier completa', r.axes.length === 6 && r.drawable && r.premierComplete && r.omitted.length === 0);
const jh = r.axes[0];
check('normalización: jugador ÷ P50 de La Liga y Premier ÷ P50 de La Liga', Math.abs(jh.ratioPlayer - jh.mine.value / jh.laLiga.p50) < 1e-12 && jh.premier === 38.9 && Math.abs(jh.ratioPremier - 38.9 / jh.laLiga.p50) < 1e-12);
check('La Liga excluye al propio jugador (N = 12 de 13)', jh.laLiga.n === 12);
check('P50 de Premier = tercer corte in-season de cada variable', r.axes.map((a) => a.premier).join() === '38.9,56.2,112,0.55,95,22.6');
check('solo sesiones del jugador evaluado en su valor (Personal Average de 2 sesiones)', jh.mine.sessions === 2);
r = run({ basis: 'last' });
check('última medida: valor de la sesión más reciente', Math.abs(r.axes[0].mine.value - 38 * (0.8 + 4 * 0.03 + 0.02)) < 1e-9);
r = run({ minN: 13 });
check('muestra insuficiente → eje omitido con motivo; sin 3 ejes no se dibuja', r.axes.length === 0 && !r.drawable && /insuficiente/.test(r.omitted[0].reason));
// «Más bajo es mejor» (p. ej. el tiempo de contacto): el eje entra, pero invertido (P50 ÷ valor), para que hacia fuera siga siendo mejor.
const rInv = buildRadar({ profile, test, variables: variables.map((v, i) => (i === 3 ? { ...v, direction: 'lower' } : v)), sessions, players, histories: {}, playerId: 4, basis: 'pa', minN: 10, multi: true });
const rNorm = buildRadar({ profile, test, variables, sessions, players, histories: {}, playerId: 4, basis: 'pa', minN: 10, multi: true });
check('variable «más bajo es mejor»: entra en el radar marcada como invertida', rInv.axes.length === 6 && rInv.axes[3].invertido === true && rInv.axes.filter((a) => a.invertido).length === 1);
check('eje invertido: el cociente es P50 ÷ valor (al revés que el normal)', Math.abs(rInv.axes[3].ratioPlayer - 1 / rNorm.axes[3].ratioPlayer) < 1e-9 && Math.abs(rInv.axes[3].ratioPlayer * rNorm.axes[3].ratioPlayer - 1) < 1e-9);
// El Personal Best no se compara: en «más bajo es mejor» el mejor valor es el más bajo, así que es otra sesión (y eso es lo correcto).
check('eje invertido: también se invierten las referencias dibujadas', Math.abs(rInv.axes[3].ratios.p50 - 1) < 1e-9 && Object.entries(rInv.axes[3].ratios).every(([k, v]) => k === 'pb' || v === null || Math.abs(v - 1 / rNorm.axes[3].ratios[k]) < 1e-9));
check('eje invertido: el Personal Best es el valor más bajo, no el más alto', rInv.axes[3].refs.pb < rNorm.axes[3].refs.pb);
r = buildRadar({ profile, test, variables: variables.map((v, i) => (i === 3 ? { ...v, direction: null } : v)), sessions, players, histories: {}, playerId: 4, basis: 'pa', minN: 10 });
check('variable sin dirección: se omite, porque el cociente no se puede orientar', r.axes.length === 5 && /no dice si es mejor/.test(r.omitted[0].reason));
// Perfiles de fábrica por test (12/11/2026): Hop Test y Drop Jump 30/45 con RSI, altura y tiempo de contacto
check('perfil por test: Hop Test y Drop Jump traen RSI, Jump Height y Contact Time', ['Double-Leg Hop Test', 'DL Drop Jump 30 cm', 'DL Drop Jump 45 cm'].every((t) => { const pf = profileForTest(t); return pf && pf.axes.map((a) => a.label).join(',') === 'RSI,Jump Height,Contact Time'; }));
check('perfil por test: un test sin perfil no muestra radar', profileForTest('Supine Isometric Ankle Inversion') === null);
check('perfil por test: el guardado por el usuario manda en SU test y no en los demás', profileForTest('CMJ', { test: 'CMJ', variables: ['RSI MOD', 'JH (imp-mom)', 'DEPTH'] }).axes.length === 3 && profileForTest('DL Drop Jump 30 cm', { test: 'CMJ', variables: ['RSI MOD', 'JH (imp-mom)', 'DEPTH'] }).axes.length === 3);
r = run({ sessions: sessions.filter((s) => !(s.playerId === 4)) });
check('jugador sin sesiones: todo omitido', r.axes.length === 0 && r.omitted.length === 6);
r = buildRadar({ profile, test, variables: variables.slice(0, 4), sessions, players, histories: {}, playerId: 4, basis: 'pa', minN: 10 });
check('variable inexistente en el catálogo: se lista aparte y el resto se dibuja', r.axes.length === 4 && r.omitted.length === 2 && r.drawable);
// Referencias seleccionables (multi): P50/P75 La Liga, por posición, Premier, y medidas del jugador; todo ÷ P50 de La Liga (todas las posiciones)
const H = {}; for (let p = 1; p <= 13; p++) H[p] = [{ playerId: p, positionId: p <= 8 ? 10 : 20, role: 'principal' }]; // 7 jugadores en 10 (sin el 4) y 5 en 20
r = buildRadar({ profile, test, variables, sessions, players, histories: H, playerId: 4, basis: 'pa', positionId: 10, minN: 5, multi: true });
const a0 = r.axes[0];
const vals = (k) => sessions.filter((x) => x.testId === 1).filter((x) => x.playerId !== 4);
check('multi: ratios de P50 La Liga = 1 y P75 > 1', Math.abs(a0.ratios.p50 - 1) < 1e-12 && a0.ratios.p75 > 1 && a0.refs.p75 > a0.refs.p50);
check('multi: P50 por posición calculado con los jugadores de esa posición (sin el propio)', a0.refs.p50pos !== null && r.complete.p50pos && r.complete.p75pos && a0.refs.p75pos >= a0.refs.p50pos);
check('multi: P75 Premier = cuarto corte; ratios sobre el P50 de La Liga', a0.refs.premier75 > a0.refs.premier50 && Math.abs(a0.ratios.premier75 - a0.refs.premier75 / a0.refs.p50) < 1e-12 && r.complete.premier75);
const ses4 = sessions.filter((x) => x.playerId === 4).sort((a, b) => a.date.localeCompare(b.date));
check('multi: primera, última, PA y PB del jugador', Math.abs(a0.refs.first - ses4[0].values[10].S) < 1e-9 && Math.abs(a0.refs.last - ses4[1].values[10].S) < 1e-9 && Math.abs(a0.refs.pa - (ses4[0].values[10].S + ses4[1].values[10].S) / 2) < 1e-9 && Math.abs(a0.refs.pb - Math.max(ses4[0].values[10].S, ses4[1].values[10].S)) < 1e-9);
r = buildRadar({ profile, test, variables, sessions, players, histories: H, playerId: 4, basis: 'pa', positionId: null, minN: 5, multi: true });
check('multi: sin posición elegida, las referencias por posición no están disponibles', r.complete.p50pos === false && r.complete.p75pos === false && r.complete.p50 === true);
r = buildRadar({ profile, test, variables, sessions, players, histories: H, playerId: 4, basis: 'pa', positionId: 20, minN: 10, multi: true });
check('multi: posición con menos jugadores que el mínimo → no disponible', r.complete.p50pos === false);
process.exit(fail);
