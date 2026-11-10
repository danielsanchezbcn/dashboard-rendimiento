// Pruebas de cambio.js con valores conocidos (tablas de la t de Student) y datos sintéticos.
import { tTwoSidedP, tCritical, sampleSd, consecutiveDiffs, changeTest } from './cambio.js';
let failed = 0;
const check = (n, c, e = '') => { console.log(`${c ? 'OK  ' : 'FAIL'} ${n} ${e}`); if (!c) failed++; };
const near = (a, b, tol) => Math.abs(a - b) <= tol;
check('t crítico df=10 ≈ 2,2281', near(tCritical(10), 2.228139, 1e-4), String(tCritical(10)));
check('t crítico df=9 ≈ 2,2622', near(tCritical(9), 2.262157, 1e-4));
check('t crítico df=30 ≈ 2,0423', near(tCritical(30), 2.042272, 1e-4));
check('t crítico df=1000 ≈ 1,9623', near(tCritical(1000), 1.962339, 1e-3));
check('p bilateral t=2,228 df=10 ≈ 0,05', near(tTwoSidedP(2.228139, 10), 0.05, 1e-4));
check('p bilateral t=0 es 1', near(tTwoSidedP(0, 7), 1, 1e-9));
check('p bilateral t=3,169 df=10 ≈ 0,01', near(tTwoSidedP(3.169273, 10), 0.01, 1e-4));
check('SD muestral', near(sampleSd([2, 4, 4, 4, 5, 5, 7, 9]), 2.13809, 1e-4));
check('diferencias consecutivas', JSON.stringify(consecutiveDiffs([[1, 3, 6], [10, 9]])) === JSON.stringify([2, 3, -1]));
// 20 diferencias con SD conocida
const diffs = Array.from({ length: 20 }, (_, i) => (i % 2 ? 1 : -1) * (1 + (i % 5) * 0.5));
const sd = sampleSd(diffs);
const r = changeTest({ a: { value: 100, date: '2026-01-01' }, b: { value: 100 + 3 * sd, date: '2026-02-01' }, diffs, between: Array.from({ length: 12 }, (_, i) => 90 + i * 2), direction: 'higher' });
check('cambio de 3 SD: significativo y mejora', r.defined && r.significant && r.improves === true && r.p < 0.01, JSON.stringify(r));
check('IC y cambio mínimo detectable coherentes', near(r.mdc95, tCritical(19) * sd, 1e-9) && near(r.ci[1] - r.ci[0], 2 * r.mdc95, 1e-9));
const r2 = changeTest({ a: { value: 100 }, b: { value: 100 + 0.5 * sd }, diffs, between: [], direction: 'higher' });
check('cambio de 0,5 SD: no significativo; sin SWC por falta de jugadores', r2.defined && !r2.significant && r2.swc === null && r2.exceedsSwc === null);
const r3 = changeTest({ a: { value: 50 }, b: { value: 45 }, diffs, between: Array.from({ length: 12 }, (_, i) => i * 5), direction: 'lower' });
check('dirección «más bajo es mejor»: bajar es mejora; SWC = 0,2 × SD entre jugadores', r3.improves === true && near(r3.swc, 0.2 * sampleSd(Array.from({ length: 12 }, (_, i) => i * 5)), 1e-9));
const r4 = changeTest({ a: { value: 1 }, b: { value: 2 }, diffs: [1, 2, 3], direction: null });
check('pocas diferencias: no se evalúa y se explica', !r4.defined && /al menos 10/.test(r4.reason) && r4.improves === null);
const r5 = changeTest({ a: { value: 0 }, b: { value: 2 }, diffs: Array(12).fill(1), direction: 'higher' });
check('diferencias constantes: no se evalúa; porcentaje con base 0 es null', !r5.defined && r5.pct === null);
console.log(failed ? `\n${failed} PRUEBA(S) FALLIDA(S)` : '\nTodas las pruebas de cambio pasan'); process.exit(failed ? 1 : 0);
