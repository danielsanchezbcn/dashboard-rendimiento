// Red de seguridad estructural (10/11/2026). No prueba una función concreta: vigila que el proyecto no se degrade sin que nadie se entere.
//  1. Todas las pruebas «prueba-*.test.mjs» están encadenadas en `npm test` (una prueba huérfana no protege nada).
//  2. Las políticas de seguridad (CSP) de las páginas no se relajan.
//  3. El código propio no usa eval, new Function, Worker, XMLHttpRequest, WebSocket ni sendBeacon, ni fetch a direcciones externas; innerHTML y createObjectURL solo donde ya existían.
//  4. Los módulos de cálculo no importan pantallas (pages-*.js), para que la lógica siga siendo comprobable sin interfaz.
import { readFileSync, readdirSync } from 'node:fs';
let fail = 0; const check = (n, ok, d = '') => { console.log((ok ? 'OK   ' : 'FAIL ') + n + (ok ? '' : ' ' + d)); if (!ok) fail = 1; };
const files = readdirSync('.');
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
// 1
const pruebas = files.filter((f) => /^prueba-.*\.test\.mjs$/.test(f));
const huerfanas = pruebas.filter((f) => !pkg.scripts.test.includes(f));
check(`las ${pruebas.length} pruebas están todas en «npm test»`, huerfanas.length === 0, huerfanas.join(', '));
const inexistentes = [...pkg.scripts.test.matchAll(/node (prueba-[\w.-]+\.mjs)/g)].map((m) => m[1]).filter((f) => !files.includes(f));
check('«npm test» no apunta a archivos que no existen', inexistentes.length === 0, inexistentes.join(', '));
// 2
const csp = (f) => /http-equiv="Content-Security-Policy" content="([^"]*)"/.exec(readFileSync(f, 'utf8'))?.[1];
check('index.html: CSP exacta (sin unsafe-inline ni unsafe-eval, connect-src none)', csp('index.html') === "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'none'; frame-src 'self'; base-uri 'none'; form-action 'none'", csp('index.html'));
check('angulos.html: CSP sin cambios (marco aparte, con modelo local y workers propios)', csp('angulos.html') === "default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self'; style-src-attr 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; worker-src 'self' blob:; base-uri 'none'; form-action 'none'", csp('angulos.html'));
check('angulos-pruebas.html: CSP sin cambios', csp('angulos-pruebas.html') === "default-src 'none'; script-src 'self'; style-src 'self'; base-uri 'none'", csp('angulos-pruebas.html'));
check('index.html no carga nada externo', !/(src|href)="https?:\/\//.test(readFileSync('index.html', 'utf8')));
// 3: código propio = todo menos librerías y motores de terceros
const TERCEROS = new Set(['libs.js', 'libs-fuente.js', 'fflate-sync.js', 'ocr-core.js', 'ocr-worker.js', 'ocr-tesseract.js', 'vision_wasm_internal.js', 'vision_wasm_nosimd_internal.js']);
const propios = files.filter((f) => f.endsWith('.js') && !TERCEROS.has(f));
const prohibidos = [['eval(', /\beval\s*\(/], ['new Function', /new\s+Function\s*\(/], ['new Worker', /new\s+Worker\s*\(/], ['XMLHttpRequest', /\bXMLHttpRequest\b/], ['WebSocket', /\bWebSocket\b/], ['sendBeacon', /sendBeacon/], ['fetch externo', /fetch\(\s*['"`]https?:/]];
const sinComentarios = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\\])\/\/.*$/gm, '$1');
const permitidoWorker = new Set(['angulos-detector.js', 'imagen-ocr.js']); // OCR y detector de pose: trabajadores locales (ya existían)
const hallazgos = [];
for (const f of propios) {
  const s = sinComentarios(readFileSync(f, 'utf8'));
  for (const [n, re] of prohibidos) if (re.test(s) && !(n === 'new Worker' && permitidoWorker.has(f))) hallazgos.push(`${f}: ${n}`);
}
check('código propio: sin eval, new Function, XMLHttpRequest, WebSocket, sendBeacon ni fetch externo', hallazgos.length === 0, hallazgos.join('; '));
const usos = (re) => propios.filter((f) => re.test(sinComentarios(readFileSync(f, 'utf8')))).sort().join(',');
check('innerHTML solo en el digitalizador de ángulos (marco aparte)', usos(/\.innerHTML\s*=/) === 'angulos-app.js', usos(/\.innerHTML\s*=/));
check('createObjectURL solo para descargas (io.js, angulos-exportar.js)', usos(/createObjectURL/) === 'angulos-exportar.js,io.js', usos(/createObjectURL/));
// 4
const CALCULO = propios.filter((f) => !f.startsWith('pages') && !['app.js', 'main.js', 'componentes.js', 'context.js', 'asim-ui.js', 'iconos.js', 'copiar.js'].includes(f) && !f.startsWith('angulos-'));
const importaPantallas = CALCULO.filter((f) => /from\s+'\.\/pages[\w-]*\.js'/.test(readFileSync(f, 'utf8')));
check('los módulos de cálculo no importan pantallas', importaPantallas.length === 0, importaPantallas.join(', '));
console.log(fail ? 'HAY FALLOS' : 'Todo bien'); process.exit(fail);
