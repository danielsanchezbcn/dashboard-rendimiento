import { asymmetryPct, asymText, asymSideLetter, isAsymVariable } from './catalogo.js';
import { buildCsv } from './exportar.js';
let fail = 0; const check = (n, ok, d = '') => { console.log((ok ? 'OK   ' : 'FAIL ') + n + (ok ? '' : ' ' + d)); if (!ok) fail = 1; };
// Casos reales del CSV de VALD (SL CMJ, Peak Landing Force / BM; valores I/D redondeados por VALD) y la asimetría que VALD muestra.
const vald = [[41, 28, 31, 'L'], [33, 27, 18, 'L'], [40, 45, 11, 'R'], [48, 40, 17, 'L'], [31, 38, 17, 'R']];
check('magnitud como VALD (|D−I|÷máx×100, tolerancia del redondeo de entradas) y letra del lado más alto', vald.every(([l, r, mag, side]) => { const p = asymmetryPct(l, r); return Math.abs(Math.abs(p) - mag) <= 1.5 && asymSideLetter(p) === side; }));
check('exacto: I 100, D 80 → 20 % L; I 80, D 100 → 20 % R', asymText(asymmetryPct(100, 80)) === '20 % L' && asymText(asymmetryPct(80, 100)) === '20 % R');
check('sin signo en pantalla; coma decimal; cero sin letra; no numérico', asymText(-11.04) === '11 % L' && asymText(9.1) === '9,1 % R' && asymText(0) === '0 %' && asymText(0.04) === '0 %' && asymText(null) === '—' && asymText(NaN) === '—' && !/[+−-]/.test(asymText(-5)));
check('el valor interno sigue con signo (D +, I −)', asymmetryPct(80, 100) > 0 && asymmetryPct(100, 80) < 0);
check('variables de asimetría reconocidas', isAsymVariable({ name: 'Peak Force asimetría (%)' }) && isAsymVariable({ name: 'DROP LANDING RFD ASYMMETRY' }) && isAsymVariable({ name: 'x', formula: { op: 'ASIMETRIA' } }) && !isAsymVariable({ name: 'Peak Force' }));
const csv = buildCsv(['Asimetría (%)', 'Lado con el valor más alto'], [[Math.abs(asymmetryPct(100, 80)), asymSideLetter(asymmetryPct(100, 80))]]);
check('CSV: magnitud numérica y lado en columnas separadas', csv.includes('20;L'));
process.exit(fail);
