// generar-manifiesto.mjs — regenera `manifiesto.json`, la lista con la que `comprobar.html` verifica lo publicado.
// Uso:  node generar-manifiesto.mjs            (toma la versión de db.js)
//       node generar-manifiesto.mjs 10i-0.12.0 (fuerza una versión)
// Dos listas:
//   · "archivos": huella SHA-256 (16 primeros caracteres) y tamaño. Todo el código publicable.
//   · "grandes":  solo tamaño, porque medir su huella obligaría a descargar ~19 MB cada vez que se abre `comprobar.html`.
//                 `bytes: null` = no hay tamaño de referencia (el modelo de IA lo sube el usuario a mano).
// `prueba-manifiesto.test.mjs` comprueba que el resultado está al día y que no se queda ningún archivo fuera.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync, statSync, readdirSync } from 'node:fs';
import { APP_VERSION } from './db.js';

const version = process.argv[2] || APP_VERSION;

const GRANDES = [
  { a: 'pose_landmarker_full.task', para: 'la detección automática de puntos en las fotos (Jurdan y AKET)' },
  { a: 'vision_wasm_internal.wasm', para: 'la detección automática de puntos' },
  { a: 'vision_wasm_nosimd_internal.wasm', para: 'la detección automática en navegadores sin SIMD' },
  { a: 'eng.traineddata.gz', para: 'el OCR de las fotos de antropometría' },
];

// No se publican: se generan al construir `libs.js`, o solo sirven para desarrollar.
const noSePublica = (f) => ['libs-fuente.js', 'fflate-sync.js', 'package.json', 'package-lock.json', 'manifiesto.json', 'generar-manifiesto.mjs'].includes(f)
  || /^prueba-|\.(md|cjs)$/.test(f) || /^(dump-stores|probe-)/.test(f);

const grandesSet = new Set(GRANDES.map((g) => g.a));
const nombres = readdirSync('.')
  .filter((f) => statSync(f).isFile() && /\.(js|mjs|css|html|json|wasm|gz|task)$/.test(f) && !noSePublica(f) && !grandesSet.has(f))
  .sort();

const archivos = {};
for (const n of nombres) {
  const buf = readFileSync('./' + n);
  archivos[n] = { bytes: buf.length, sha: createHash('sha256').update(buf).digest('hex').slice(0, 16) };
}
const grandes = GRANDES.map((g) => ({ a: g.a, bytes: existsSync('./' + g.a) ? statSync('./' + g.a).size : null, para: g.para }));

const txt = '{\n"version": ' + JSON.stringify(version) + ',\n"archivos": {\n'
  + nombres.map((n) => JSON.stringify(n) + ': {\n"bytes": ' + archivos[n].bytes + ',\n"sha": "' + archivos[n].sha + '"\n}').join(',\n')
  + '\n},\n"grandes": [\n' + grandes.map((g) => JSON.stringify(g)).join(',\n') + '\n]\n}\n';

const antes = existsSync('./manifiesto.json') ? JSON.parse(readFileSync('./manifiesto.json', 'utf8')) : { archivos: {} };
writeFileSync('./manifiesto.json', txt);
const nuevos = nombres.filter((n) => !antes.archivos[n]);
const cambiados = nombres.filter((n) => antes.archivos[n] && antes.archivos[n].sha !== archivos[n].sha);
console.log(`manifiesto.json · versión ${version} · ${nombres.length} archivos con huella · ${grandes.length} grandes`);
console.log('nuevos:', nuevos.join(' ') || '(ninguno)');
console.log('cambiados:', cambiados.join(' ') || '(ninguno)');
console.log('grandes:', grandes.map((g) => g.a + ' = ' + (g.bytes ?? 'sin referencia')).join(' · '));
