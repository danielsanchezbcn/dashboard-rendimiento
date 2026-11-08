import { buildCsv, csvText, csvNum } from './exportar.js';
let failed = 0;
const check = (n, ok, d = '') => { console.log(`${ok ? 'OK  ' : 'FAIL'} ${n} ${ok ? '' : d}`); if (!ok) failed++; };
check('BOM UTF-8, separador «;» y fin de línea CRLF', buildCsv(['A', 'B'], [['x', 1]]) === '﻿A;B\r\nx;1\r\n');
check('decimales con coma y redondeo a 4 decimales', csvNum(412.5) === '412,5' && csvNum(1 / 3) === '0,3333' && csvNum(NaN) === '' && csvNum(null) === '');
check('textos con ; comillas o saltos se entrecomillan', csvText('a;b') === '"a;b"' && csvText('di "hola"') === '"di ""hola"""' && csvText('l1\nl2') === '"l1\nl2"');
check('inyección de fórmulas neutralizada', csvText('=SUMA(A1)') === "'=SUMA(A1)" && csvText('+34 600') === "'+34 600" && csvText('-1') === "'-1" && csvText('@x') === "'@x" && csvText('Pérez') === 'Pérez');
check('vacíos y números 0', buildCsv(['A'], [[''], [0], [null]]) === '﻿A\r\n\r\n0\r\n\r\n');
process.exit(failed ? 1 : 0);
