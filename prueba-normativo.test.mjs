// Normative Benchmarking unificado: funciones puras y guarda contra el error «68 vs 60/68».
import { variacionPct } from './evolucion.js';
import { fmtVar, trocear, presupuestoAncho } from './pages-normativo.js';
import { evaluate } from './percentiles.js';
let fails = 0; const check = (n, ok) => { console.log(`${ok ? 'OK  ' : 'FAIL'} ${n}`); if (!ok) fails++; };
check('variación %: (110−100)/100 = +10', variacionPct(110, 100) === 10);
check('variación %: referencia negativa usa |ref|', Math.abs(variacionPct(-8, -10) - 20) < 1e-9);
check('variación %: sin referencia o referencia 0 → null', variacionPct(5, 0) === null && variacionPct(5, null) === null && variacionPct(NaN, 3) === null);
check('formato: +3,1 % / −2,0 % / 0 % sin signo / null', fmtVar(3.14) === '+3,1 %' && fmtVar(-2) === '−2 %' && fmtVar(0.01) === '0 %' && fmtVar(null) === null);
const cols = [{ span: 2 }, { span: 2 }, { span: 1 }, { span: 2 }, { span: 2 }];
const bl = trocear(cols, 5);
check('trocear: conserva el orden, ningún bloque pasa del presupuesto y ninguno queda vacío', bl.flat().length === 5 && bl.every((b) => b.length && b.reduce((a, c) => a + c.span, 0) <= 5) && bl.flat().every((c, i) => c === cols[i]));
check('trocear: una columna más ancha que el presupuesto va sola', trocear([{ span: 9 }, { span: 1 }], 4).length === 2);
check('presupuesto de ancho: entre 6 y 14 subcolumnas', presupuestoAncho(300) === 6 && presupuestoAncho(5000) === 14 && presupuestoAncho(1440) >= 6);
// Guarda: el mismo valor evaluado contra la misma referencia da SIEMPRE el mismo percentil (única función de evaluación).
const refs = Array.from({ length: 12 }, (_, i) => ({ playerId: 100 + i, value: 10 * (i + 1) }));
const f = (v) => evaluate(refs, { playerId: 1, value: v, direction: 'higher', minN: 5 });
check('evaluate es determinista: misma entrada, mismo percentil', JSON.stringify(f(75)) === JSON.stringify(f(75)));
check('percentil por pierna: dos valores distintos contra la misma referencia dan percentiles distintos y ordenados', f(60).percentileStat < f(80).percentileStat);
check('el valor de la pierna no cambia con el jugador evaluado excluido de la referencia', evaluate([...refs, { playerId: 1, value: 999 }], { playerId: 1, value: 75, direction: 'higher', minN: 5 }).percentileStat === f(75).percentileStat);
process.exit(fails ? 1 : 0);
