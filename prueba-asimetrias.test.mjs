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
console.log(fail ? 'HAY FALLOS' : 'Todo bien'); process.exit(fail);
