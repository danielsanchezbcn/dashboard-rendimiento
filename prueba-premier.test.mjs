import 'fake-indexeddb/auto';
import { webcrypto } from 'node:crypto';
if (!globalThis.crypto?.subtle) globalThis.crypto = webcrypto;
import * as D from './db.js';
import * as C from './catalogo.js';
import * as I from './catalogo-inicial.js';
import * as P from './premier.js';
let failed = 0;
const check = (n, ok, d = '') => { console.log(`${ok ? 'OK  ' : 'FAIL'} ${n} ${ok ? '' : d}`); if (!ok) failed++; };
check('todas las referencias tienen 5 cortes monótonos (ascendentes o descendentes)', P.PREMIER_REFERENCES.every((r) => r.cuts.length === 5 && (r.cuts.every((c, i, a) => i === 0 || c > a[i - 1]) || r.cuts.every((c, i, a) => i === 0 || c < a[i - 1]))), P.PREMIER_REFERENCES.filter((r) => !(r.cuts.every((c, i, a) => i === 0 || c > a[i - 1]) || r.cuts.every((c, i, a) => i === 0 || c < a[i - 1]))).map((r) => r.metric).join());
check('sin duplicados (test + variable)', new Set(P.PREMIER_REFERENCES.flatMap((r) => r.tests.map((t) => t + '|' + r.variable))).size === P.PREMIER_REFERENCES.reduce((a, r) => a + r.tests.length, 0));
const t = (name) => ({ name }), v = (name) => ({ name });
const k = P.findPremier(t('Run-Specific Knee Iso-Push'), v('Peak Force'));
check('Knee Iso-Push in-season (no pre-season): 1779 / 2299 / 2667 / 3002 / 3530', k.cuts.join() === '1779,2299,2667,3002,3530');
check('sin coincidencia → null (p. ej. variable relativa, SW, test sin tabla)', P.findPremier(t('Run-Specific Knee Iso-Push'), v('Peak Force relativo (BW)')) === null && P.findPremier(t('Hip Iso-Hold 20 s'), v('Peak Force')) === null && P.findPremier(t('CMJ'), v('CON RFD 100ms')) === null);
check('coincidencia sin distinguir mayúsculas', P.findPremier(t('cmj'), v('jh (imp-mom)')).cuts[2] === 38.9);
check('conversión s → ms solo donde procede (CMJ Concentric Duration)', P.findPremier(t('CMJ'), v('CONCENTRIC DURATION')).cuts.join() === '310,280,250,220,190' && P.findPremier(t('Double-Leg Hop Test'), v('MEAN CONTACT TIME')).cuts.join() === '200,180,170,160,140' && P.findPremier(t('DL Drop Jump 30 cm'), v('CONTACT TIME')).cuts.join() === '0.24,0.2,0.19,0.17,0.15');
check('el Drop Jump de 30 y 45 cm comparten referencia', P.findPremier(t('DL Drop Jump 45 cm'), v('RSI (FLIGHT TIME / CONTACT TIME)')).cuts[2] === 2.93);
check('zonas con cortes ascendentes', [100, 316, 350, 450, 520, 600, 696, 800].map((x) => P.zoneOf([316, 400, 492, 571, 696], x)).join() === '0,1,1,2,3,4,5,5');
check('zonas con cortes descendentes (menor es el lado alto: tiempo de contacto)', [0.30, 0.24, 0.22, 0.195, 0.18, 0.16, 0.15, 0.10].map((x) => P.zoneOf([0.24, 0.20, 0.19, 0.17, 0.15], x)).join() === '0,1,1,2,3,4,5,5');
check('Eccentric Peak Velocity negativa (descendente): -1,5 está entre P50 y P75', P.placeAgainstPremier(P.findPremier(t('CMJ'), v('ECC PEAK VELOCITY')), -1.5).zone === 3);
check('asimetrías con signo: no se ubica al jugador y se explica', P.placeAgainstPremier(P.findPremier(t('CMJ'), v('CON IMPULSE ASYM')), 3).placed === false && /signo/.test(P.placeAgainstPremier(P.findPremier(t('CMJ'), v('CON IMPULSE ASYM')), 3).reason));
check('valor no numérico → null', P.placeAgainstPremier(k, NaN) === null && P.placeAgainstPremier(null, 5) === null);
// Integración con el catálogo real: cada referencia enlaza con una variable existente, con la unidad esperada y sin enlazar nada más
const db = D.createDb('premier-1'); await D.initDb(db); await I.seedInitialCatalog(db);
const cat = await C.listCatalog(db);
const linked = []; const orphan = [];
const nordic = P.PREMIER_REFERENCES.filter((r) => r.tests.includes('Nordic Hamstring Exercise')).map((r) => r.variable);
for (const r of P.PREMIER_REFERENCES) for (const tn of r.tests) {
  const test = cat.tests.find((x) => x.name.toLowerCase() === tn.toLowerCase());
  const variable = test && cat.variables.find((x) => x.testId === test.id && x.name.toLowerCase() === r.variable.toLowerCase());
  (variable ? linked : orphan).push(`${tn}|${r.variable}`);
  if (variable) {
    const exp = r.scale === 1000 ? 'ms' : null;
    if (exp) check(`unidad del catálogo en ms para ${r.variable} (${tn})`, variable.unit === 'ms', variable.unit);
    check(`findPremier enlaza ${tn} · ${r.variable}`, P.findPremier(test, variable) !== null);
  }
}
check('todas las referencias existen en el catálogo (nombres exactos), incluidas las tres del Nordic', orphan.length === 0 && nordic.length === 3, orphan.join(' ; '));
check('Nordic: referencias enlazadas con las variables del catálogo; la asimetría (con signo) se compara en valor absoluto', P.findPremier({ name: 'Nordic Hamstring Exercise' }, { name: 'Max Force' }).cuts[2] === 464 && P.placeAgainstPremier(P.findPremier({ name: 'Nordic Hamstring Exercise' }, { name: 'Max Force Asymmetry' }), -5).zone === P.placeAgainstPremier(P.findPremier({ name: 'Nordic Hamstring Exercise' }, { name: 'Max Force Asymmetry' }), 5).zone && P.placeAgainstPremier(P.findPremier({ name: 'Nordic Hamstring Exercise' }, { name: 'Max Force Asymmetry' }), 5).zone === 3);
check('equivalencias confirmadas por el usuario enlazadas', P.findPremier({ name: 'CMJ' }, { name: 'CON PEAK POWER/BM' }).cuts[2] === 56.2 && P.findPremier({ name: 'SL CMJ' }, { name: 'CON PEAK POWER/BM' }).cuts[2] === 35.4 && P.findPremier({ name: 'CMJ' }, { name: 'ECC DECEL PHASE DURATION' }).cuts[4] === 0.36 && P.findPremier({ name: 'DL Drop Jump 45 cm' }, { name: 'DROP LANDING RFD ASYMMETRY' }).signed && P.findPremier({ name: 'DL Drop Jump 30 cm' }, { name: 'PEAK DROP LANDING FORCE ASYMMETRY' }).cuts[4] === 27);
const pj = (name, tn = 'CMJ') => P.findPremier({ name: tn }, { name });
check('color: seis zonas → seis bandas en orden rojo…verde', P.ZONE_BANDS.join() === 'rojo,naranja,amarillo-suave,amarillo,verde-suave,verde');
const jh = pj('JH (imp-mom)'); // [29.0,35.3,38.9,42.4,47.3]
check('color: valor creciente (mayor es mejor)', [20, 30, 37, 40, 45, 50].map((x) => P.placeAgainstPremier(jh, x).band).join() === 'rojo,naranja,amarillo-suave,amarillo,verde-suave,verde');
const ct = pj('CONTACT TIME', 'DL Drop Jump 30 cm'); // [0.24,0.20,0.19,0.17,0.15] menor es mejor
check('color: cortes decrecientes (menor es mejor) → mejor valor = verde', P.placeAgainstPremier(ct, 0.30).band === 'rojo' && P.placeAgainstPremier(ct, 0.10).band === 'verde' && P.placeAgainstPremier(ct, 0.195).band === 'amarillo-suave' && P.placeAgainstPremier(ct, 0.185).band === 'amarillo');
check('color: las asimetrías con signo no se colorean; la del Nordic (valor absoluto) sí', P.placeAgainstPremier(pj('CON IMPULSE ASYM'), 3).band === undefined && P.placeAgainstPremier(P.findPremier({ name: 'Nordic Hamstring Exercise' }, { name: 'Max Force Asymmetry' }), 0.5).band === 'verde');
check('por lado confirmado: Iso-Push y SL CMJ sí; CMJ no', P.isPerSide(pj('Peak Force', 'Run-Specific Knee Iso-Push')) && P.isPerSide(pj('RSI MOD', 'SL CMJ')) && !P.isPerSide(jh));
process.exit(failed ? 1 : 0);
