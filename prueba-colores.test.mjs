// Paleta de los informes del usuario e iconos incrustados.
import { PAL, colorLado } from './colores.js';
import * as I from './iconos.js';
let fails = 0; const check = (n, ok) => { console.log(`${ok ? 'OK  ' : 'FAIL'} ${n}`); if (!ok) fails++; };
check('paleta: hex de 6 cifras', ['fondo', 'texto', 'izq', 'der', 'laLiga', 'premier', 'target', 'jugador', 'lila'].every((k) => /^#[0-9A-F]{6}$/i.test(PAL[k])));
check('lados: azul a la izquierda, naranja a la derecha', colorLado('L') === '#31B3FE' && colorLado('R') === '#FC912F' && colorLado('S') === PAL.jugador);
for (const k of ['ICONO_LALIGA', 'ICONO_PREMIER', 'ICONO_TARGET']) {
  const b = Buffer.from(I[k].split(',')[1], 'base64');
  check(`${k}: PNG válido incrustado`, I[k].startsWith('data:image/png;base64,') && b.subarray(0, 8).toString('hex') === '89504e470d0a1a0a' && b.length > 500);
}
import { quantile, perfQuantile, median } from './percentiles.js';
check('cuantil: interpolación lineal y mediana coincidente', quantile([1, 2, 3, 4, 5], 0.75) === 4 && quantile([1, 2, 3, 4], 0.5) === median([1, 2, 3, 4]) && quantile([], 0.5) === null && quantile([7], 0.75) === 7);
check('P75 de rendimiento: con «más bajo es mejor» es el cuantil estadístico P25', perfQuantile([1, 2, 3, 4, 5], 0.75, 'lower') === 2 && perfQuantile([1, 2, 3, 4, 5], 0.75, 'higher') === 4);
import { orderVars } from './relativos.js';
const vs = [{ id: 1, kind: 'raw', name: 'Peak Force' }, { id: 2, kind: 'derived', formula: { op: 'REL_BW', operands: [1] }, name: 'Peak Force relativo (BW)' }, { id: 3, kind: 'raw', name: 'RFD at 100 ms' }];
check('isométricos: la medida relativa va antes que su valor absoluto (y es la de por defecto)', orderVars(vs).map((v) => v.id).join() === '2,1,3' && orderVars([vs[0], vs[2]]).map((v) => v.id).join() === '1,3');
const e = 2762 / (77 * 9.80665);
check('ejemplo del usuario: 77 kg y 2762 N = 3,66 BW', Math.round(e * 100) / 100 === 3.66);
import { estimateRelative, findPremier } from './premier.js';
const er = estimateRelative(findPremier({ name: 'Run-Specific Knee Iso-Push' }, { name: 'Peak Force' }), 1);
check('Premier relativa: mediana = 2667 N ÷ 81,8 kg ÷ g ≈ 3,32 BW, igual en ambos límites', Math.abs(er.cuts[2] - 2667 / (81.8 * 9.80665)) < 1e-4 && Math.abs(er.range.lo[2] - er.range.hi[2]) < 1e-9);
check('Premier relativa: cortes ascendentes y rango lo<=central<=hi', er.cuts.every((c, i) => i === 0 || c > er.cuts[i - 1]) && er.cuts.every((c, i) => er.range.lo[i] <= c + 1e-5 && c <= er.range.hi[i] + 1e-5));
check('Premier: enlace tolerante («Hop Test», mayúsculas y espacios en el nombre)', !!findPremier({ name: 'Hop Test' }, { name: 'mean rsi (flight time / contact time)' }) && !!findPremier({ name: 'drop jump 30 cm' }, { name: 'RSI (FLIGHT TIME / CONTACT TIME)' }) && !findPremier({ name: 'CMJ' }, { name: 'SL CMJ' }));
check('código de color: jugador blanco, Premier morado, La Liga amarillo, grises sin color', PAL.jugador === '#FFFFFF' && PAL.premier === '#B8A2C9' && PAL.laLiga === '#FEC900' && [PAL.gris1, PAL.gris2, PAL.gris3].every((h) => { const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)); return r === g && g === b; }));
import { defaultVar } from './relativos.js';
check('variable por defecto: la relativa si tiene valores; la absoluta si no hay masa', defaultVar([vs[1], vs[0]], [{ values: { 2: { L: 3 } } }])?.id === 2 && defaultVar([vs[1], vs[0]], [{ values: { 1: { L: 2762 } } }])?.id === 1);
if (fails) { console.log(`${fails} fallo(s)`); process.exit(1); }
console.log('Todas las pruebas de paleta e iconos pasan');
