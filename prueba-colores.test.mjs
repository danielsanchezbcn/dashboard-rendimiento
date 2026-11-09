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
if (fails) { console.log(`${fails} fallo(s)`); process.exit(1); }
console.log('Todas las pruebas de paleta e iconos pasan');
