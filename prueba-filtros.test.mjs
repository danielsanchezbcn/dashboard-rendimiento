// Orden de los filtros de referencias en cuatro filas (jugador · La Liga · Premier League · Natera) y serie de las asimetrías que VALD
// ya trae calculadas. Pedido por el usuario el 13/11/2026. Datos 100 % sintéticos.
import { claveFiltro, agruparFiltros } from './componentes.js';
import { asymmetryValueSeries, asymmetrySeries } from './evolucion.js';

let fail = 0; const check = (n, ok, d = '') => { console.log((ok ? 'OK   ' : 'FAIL ') + n + (ok ? '' : ' ' + d)); if (!ok) fail = 1; };

// claves equivalentes: los dos lados de una misma medida y los nombres cortos de Natera
check('claveFiltro agrupa lados y alias', claveFiltro('paL') === 'pa' && claveFiltro('paR') === 'pa' && claveFiltro('natN') === 'natNormal' && claveFiltro('natE') === 'natExcellent' && claveFiltro('p75pos') === 'p75pos');
check('claveFiltro no confunde «natNormal» con un lado', claveFiltro('natNormal') === 'natNormal' && claveFiltro('last') === 'last');

// Orden pedido: Fila 1 Latest, PA, PB · Fila 2 p50, p50 pos., p75, p75 pos. · Fila 3 Premier · Fila 4 Natera.
const barajado = ['p75pos', 'natGood', 'premier75', 'pb', 'p50', 'natNormal', 'last', 'premier50', 'p75', 'pa', 'p50pos', 'natExcellent'];
const filas = agruparFiltros(barajado, (k) => k);
check('cuatro filas', filas.length === 4, JSON.stringify(filas));
check('fila 1: Latest, PA, PB', JSON.stringify(filas[0]) === JSON.stringify(['last', 'pa', 'pb']), JSON.stringify(filas[0]));
check('fila 2: p50, p50 posicional, p75, p75 posicional', JSON.stringify(filas[1]) === JSON.stringify(['p50', 'p50pos', 'p75', 'p75pos']), JSON.stringify(filas[1]));
check('fila 3: Premier League', JSON.stringify(filas[2]) === JSON.stringify(['premier50', 'premier75']), JSON.stringify(filas[2]));
check('fila 4: Natera Normal, Good, Excellent', JSON.stringify(filas[3]) === JSON.stringify(['natNormal', 'natGood', 'natExcellent']), JSON.stringify(filas[3]));

// Con dos lados, los dos checkboxes de una misma medida quedan juntos y en el orden en que llegan (izquierda antes que derecha).
const conLados = agruparFiltros(['p50', 'paR', 'paL', 'natN'], (k) => k);
check('los lados de una medida quedan juntos', JSON.stringify(conLados[0]) === JSON.stringify(['paR', 'paL']) && JSON.stringify(conLados[1]) === JSON.stringify(['p50']));
// El radar añade «primera medida» del jugador: va en la fila 1, al final.
check('«primera medida» cierra la fila del jugador', JSON.stringify(agruparFiltros(['first', 'pb', 'last', 'pa'], (k) => k)[0]) === JSON.stringify(['last', 'pa', 'pb', 'first']));
// Una clave nueva que nadie haya clasificado no puede desaparecer de la pantalla.
const conDesconocida = agruparFiltros(['p50', 'inventada'], (k) => k);
check('una clave desconocida sigue visible, en una fila aparte', conDesconocida.flat().includes('inventada'), JSON.stringify(conDesconocida));
// Objetos, no cadenas: es como lo usan las páginas.
check('acepta objetos con su propia clave', JSON.stringify(agruparFiltros([{ key: 'premier50' }, { key: 'pa' }]).map((f) => f.map((o) => o.key))) === JSON.stringify([['pa'], ['premier50']]));

// Asimetrías ya calculadas por VALD: un valor con signo por sesión (derecha positiva). Se dibujan tal cual, sin recalcular.
const ses = [
  { id: 1, date: '2026-03-10', time: '10:00', status: 'ok', values: { 9: { S: -5.9 } } },
  { id: 2, date: '2026-02-01', time: '09:00', status: 'ok', values: { 9: { S: 4.2 } } },
  { id: 3, date: '2026-04-01', time: '09:00', status: 'excluded', values: { 9: { S: 30 } } },
  { id: 4, date: '2026-03-20', time: '09:00', status: 'ok', values: { 9: {} } },
];
const serie = asymmetryValueSeries(ses, 9, {});
check('toma el valor con signo, ordena por fecha y salta excluidas y vacías', serie.length === 2 && serie[0].pct === 4.2 && serie[1].pct === -5.9, JSON.stringify(serie));
check('sin lados: left y right nulos (no hay L/D que combinar)', serie.every((p) => p.left === null && p.right === null));
check('filtro de fechas', asymmetryValueSeries(ses, 9, { from: '2026-03-01' }).length === 1 && asymmetryValueSeries(ses, 9, { to: '2026-01-01' }).length === 0);
check('misma forma que la serie calculada', Object.keys(serie[0]).sort().join() === Object.keys(asymmetrySeries([{ id: 1, date: '2026-01-01', time: '', status: 'ok', values: { 7: { L: 10, R: 12 } } }], 7, {})[0]).sort().join());

process.exit(fail);
