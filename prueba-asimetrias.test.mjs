// Bloque «Asimetrías» del jugador: exclusiones pedidas y variables de asimetría de CMJ. Datos sintéticos.
import 'fake-indexeddb/auto';
import { createDb, initDb } from './db.js';
import { seedInitialCatalog } from './catalogo-inicial.js';
import { listCatalog } from './catalogo.js';
import { filasAsimetria, asimSinDatos } from './pages-asimetrias.js';
import { variableExcluidaDeAsimetrias as VARIABLE_EXCLUIDA_V } from './catalogo.js';
const VARIABLE_EXCLUIDA = (name) => VARIABLE_EXCLUIDA_V({ name });
import { dn, up } from './nombres.js';
let fail = 0; const check = (n, ok, d = '') => { console.log((ok ? 'OK   ' : 'FAIL ') + n + (ok ? '' : ' ' + d)); if (!ok) fail = 1; };
const db = createDb('t-asim-' + Math.random()); await initDb(db); await seedInitialCatalog(db);
const cat = await listCatalog(db);
const T = (n) => cat.tests.find((t) => t.name === n);
const S = (test, values) => [{ id: 1, playerId: 1, testId: test.id, date: '2026-10-01', time: '', values, reps: { L: 3, R: 3, total: 3 }, status: 'valid' }];
// CMJ: las 5 asimetrías
const cmj = T('CMJ'); const asyms = cat.variables.filter((v) => v.testId === cmj.id && /ASYM$/.test(v.name));
check('CMJ tiene 5 variables de asimetría', asyms.length === 5);
const filas = filasAsimetria(cmj, cat, S(cmj, Object.fromEntries(asyms.map((v, i) => [v.id, { S: i % 2 ? -4 : 6 }]))), 'pa');
check('CMJ: salen las 5 asimetrías con su signo (R positivo, L negativo)', filas.length === 5 && filas[0].pct === 6 && filas[1].pct === -4, JSON.stringify(filas.map((f) => f.pct)));
const parcial = S(cmj, { [asyms[0].id]: { S: 5 } });
check('CMJ con solo 1 valor: lista las otras 4 como «sin datos»', asimSinDatos(cmj, cat, parcial).length === 4);
// Nordic completo fuera
const nordic = T('Nordic Hamstring Exercise'); const nv = cat.variables.filter((v) => v.testId === nordic.id);
const nvals = Object.fromEntries(nv.map((v) => [v.id, v.sides === 'LR' ? { L: 100, R: 120 } : { S: 5 }]));
check('Nordic Hamstring Exercise: sin filas ni avisos en Asimetrías', filasAsimetria(nordic, cat, S(nordic, nvals), 'pa').length === 0 && asimSinDatos(nordic, cat, S(nordic, nvals)).length === 0);
// Iso-Push: fuera Force/RFD at 100 ms, se mantiene Peak Force
const ip = T('Run-Specific Hip Iso-Push'); const iv = cat.variables.filter((v) => v.testId === ip.id && v.sides === 'LR');
const ivals = Object.fromEntries(iv.map((v) => [v.id, { L: 100, R: 110 }]));
const nombres = filasAsimetria(ip, cat, S(ip, ivals), 'pa').map((f) => f.v.name);
check('Iso-Push: se quitan «Force at 100 ms» y «RFD at 100 ms» y queda Peak Force', iv.some((v) => /100 ms/.test(v.name)) && !nombres.some((n) => /100 ms/.test(n)) && nombres.some((n) => /Peak Force/.test(n)), JSON.stringify(nombres));
check('VARIABLE_EXCLUIDA: Torque y 100 ms sí; CON IMPULSE 100ms ASYM y Peak Force no', VARIABLE_EXCLUIDA('Torque') && VARIABLE_EXCLUIDA('RFD at 100 ms') && VARIABLE_EXCLUIDA('Force at 100 ms') && !VARIABLE_EXCLUIDA('CON IMPULSE 100ms ASYM') && !VARIABLE_EXCLUIDA('Peak Force'));
check('nombres: variables y tests en minúscula, bloques en mayúscula', dn('RSI MOD') === 'rsi mod' && dn('Double-Leg Hop Test') === 'double-leg hop test' && up('Max Isometric Strength') === 'MAX ISOMETRIC STRENGTH' && up('Datos antropométricos') === 'DATOS ANTROPOMÉTRICOS');
// ---- Columna de comparación (14/11/2026): el % de la última sesión frente a la base mostrada, por lado.
{
  const kp = T('Run-Specific Knee Iso-Push');
  const pf = cat.variables.find((v) => v.testId === kp.id && v.sides === 'LR' && /^Peak Force$/i.test(v.name));
  // Dos sesiones: izquierda 100 → 120 (PA 110, PB 120) · derecha 100 → 90 (PA 95, PB 100).
  const dos = [
    { id: 1, playerId: 1, testId: kp.id, date: '2026-09-01', time: '', values: { [pf.id]: { L: 100, R: 100 } }, reps: { L: 1, R: 1, total: 1 }, status: 'valid' },
    { id: 2, playerId: 1, testId: kp.id, date: '2026-10-01', time: '', values: { [pf.id]: { L: 120, R: 90 } }, reps: { L: 1, R: 1, total: 1 }, status: 'valid' },
  ];
  const fila = (base) => filasAsimetria(kp, cat, dos, base).find((f) => f.v.id === pf.id);
  const r1 = Math.round(fila('pa').variL * 10) / 10, r2 = Math.round(fila('pa').variR * 10) / 10;
  check('comparación con Personal Average, por lado (+9,1 % izquierda, −5,3 % derecha)', r1 === 9.1 && r2 === -5.3, `${r1} / ${r2}`);
  check('comparación con Personal Best: la izquierda es su mejor valor (0 %), la derecha ha bajado un 10 %', fila('pb').variL === 0 && Math.round(fila('pb').variR * 10) / 10 === -10, `${fila('pb').variL} / ${fila('pb').variR}`);
  check('comparación con Actual: frente a la sesión anterior (+20 % y −10 %)', fila('last').variL === 20 && Math.round(fila('last').variR * 10) / 10 === -10, `${fila('last').variL} / ${fila('last').variR}`);
  check('con una sola sesión no hay nada con que comparar en Actual', filasAsimetria(kp, cat, [dos[0]], 'last').find((f) => f.v.id === pf.id).variL === null);
  // Variable «ASYM» de VALD: ya es un porcentaje, así que su cambio va en PUNTOS y mide la MAGNITUD de la asimetría (de −6 % a +4 % es menos asimetría).
  const asym = cat.variables.find((v) => v.testId === cmj.id && /ASYM$/.test(v.name));
  const dosA = [
    { id: 3, playerId: 1, testId: cmj.id, date: '2026-09-01', time: '', values: { [asym.id]: { S: -6 } }, reps: { S: 1, total: 1 }, status: 'valid' },
    { id: 4, playerId: 1, testId: cmj.id, date: '2026-10-01', time: '', values: { [asym.id]: { S: 4 } }, reps: { S: 1, total: 1 }, status: 'valid' },
  ];
  const fa = (base) => filasAsimetria(cmj, cat, dosA, base).find((f) => f.v.id === asym.id);
  check('variable ASYM de VALD: el cambio frente a la sesión anterior son −2 puntos porcentuales', fa('last').variPuntos === -2, String(fa('last').variPuntos));
  check('variable ASYM de VALD: no se le calcula un % de variación por lado', fa('last').variL === undefined && fa('last').vald === true);
}
console.log(fail ? 'HAY FALLOS' : 'Todo bien'); process.exit(fail);
