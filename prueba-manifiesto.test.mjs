// `manifiesto.json` y `comprobar.html` (25/11/2026). Son la red de seguridad de la publicación: si el manifiesto no cubre un archivo que la
// aplicación necesita, `comprobar.html` da LUZ VERDE con ese archivo ausente o a medias, y el fallo aparece al usar la función (nos pasó: el
// 10i-0.6.0 arregló cinco archivos de la herramienta de ángulos que faltaban en la lista, y el 10i-0.11.0 los binarios grandes). Hasta ahora la
// lista se repasaba a mano. Estas comprobaciones la vigilan: que esté al día, que cubra todo lo que se referencia y que cuadre con la versión.
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { APP_VERSION } from './db.js';

let failed = 0;
const check = (n, ok, d = '') => { console.log(`${ok ? 'OK  ' : 'FAIL'} ${n} ${ok ? '' : d}`); if (!ok) failed++; };

const man = JSON.parse(readFileSync('./manifiesto.json', 'utf8'));
const archivos = Object.keys(man.archivos);
const grandes = (man.grandes ?? []).map((g) => g.a);
const cubiertos = new Set([...archivos, ...grandes]);

// Archivos que NO se publican: se generan al construir `libs.js` o solo existen para desarrollar.
const noSePublica = (f) => ['libs-fuente.js', 'fflate-sync.js', 'package.json', 'package-lock.json', 'manifiesto.json', 'generar-manifiesto.mjs'].includes(f)
  || /^prueba-|\.(md|cjs)$/.test(f) || /^(dump-stores|probe-)/.test(f);

// 1) El manifiesto está al día: cada archivo existe y su huella y su tamaño son los de ahora.
const desfase = [];
for (const [a, e] of Object.entries(man.archivos)) {
  if (!existsSync('./' + a)) { desfase.push(a + ' (no existe)'); continue; }
  const buf = readFileSync('./' + a);
  const sha = createHash('sha256').update(buf).digest('hex').slice(0, 16);
  if (sha !== e.sha || buf.length !== e.bytes) desfase.push(a);
}
check('el manifiesto está al día: huella y tamaño de los ' + archivos.length + ' archivos', desfase.length === 0, desfase.join(' '));
check('la versión del manifiesto es la de la aplicación', man.version === APP_VERSION, `${man.version} vs ${APP_VERSION}`);

// 2) Cobertura: todo archivo del directorio que se publique tiene que estar en el manifiesto.
const enDisco = readdirSync('.').filter((f) => statSync(f).isFile() && /\.(js|mjs|css|html|json|wasm|gz|task)$/.test(f));
const sinCubrir = enDisco.filter((f) => !cubiertos.has(f) && !noSePublica(f));
check('ningún archivo publicable se queda fuera del manifiesto', sinCubrir.length === 0, sinCubrir.join(' '));

// 3) Cobertura por referencias: lo que el código nombra (imports, rutas de los motores de IA y OCR) tiene que estar cubierto.
// Solo se exige para nombres que existen de verdad en el directorio o que están declarados como archivo grande: así un nombre citado en un
// comentario o dentro de una librería minificada no produce un falso positivo.
const refs = new Set();
for (const a of archivos.filter((f) => /\.(js|mjs|html|css)$/.test(f))) {
  const txt = readFileSync('./' + a, 'utf8');
  for (const m of txt.matchAll(/[\w-]+\.(?:js|mjs|css|wasm|gz|task|traineddata)(?:\.gz)?/g)) refs.add(m[0]);
}
const refsReales = [...refs].filter((f) => (existsSync('./' + f) || grandes.includes(f)) && !noSePublica(f));
const refsSinCubrir = refsReales.filter((f) => !cubiertos.has(f));
check('todo archivo que el código referencia está cubierto (' + refsReales.length + ' referencias reales)', refsSinCubrir.length === 0, refsSinCubrir.join(' '));

// 4) Los archivos grandes: declarados con su tamaño (salvo el modelo, que sube el usuario), referenciados y con el aviso de qué se pierde.
check('los cuatro archivos grandes están declarados', grandes.length === 4 && grandes.includes('eng.traineddata.gz') && grandes.includes('pose_landmarker_full.task'), grandes.join(' '));
for (const g of man.grandes ?? []) {
  const enDiscoG = existsSync('./' + g.a);
  check(`«${g.a}»: dice qué función se pierde si falta`, typeof g.para === 'string' && g.para.length > 10, g.para);
  check(`«${g.a}»: tamaño de referencia ${enDiscoG ? 'correcto' : 'ausente a propósito (lo sube el usuario)'}`,
    enDiscoG ? g.bytes === statSync('./' + g.a).size : g.bytes === null, `${g.bytes} vs ${enDiscoG ? statSync('./' + g.a).size : 'null'}`);
  check(`«${g.a}»: no está también en la lista de huellas (se comprobaría dos veces y descargándolo)`, !man.archivos[g.a]);
}

// 5) `comprobar.html` tiene que leer las dos listas; si alguien renombra una clave, esta prueba lo caza antes de publicar.
const comp = readFileSync('./comprobar.html', 'utf8');
check('comprobar.html usa man.archivos y man.grandes', comp.includes('man.archivos') && comp.includes('man.grandes'));
// El tamaño se pregunta con HEAD (no manda contenido) y, si llega comprimido, pidiendo UN byte con «Range»; nunca se lee el cuerpo.
const cuerpoRango = comp.slice(comp.indexOf('const porRango'), comp.indexOf('const tamanoSinDescargar'));
const cuerpoGrandes = comp.slice(comp.indexOf('async function comprobarGrandes')).split('\nasync function')[0];
check('comprobar.html pregunta el tamaño con HEAD y, si hace falta, por rango', comp.includes("method: 'HEAD'") && comp.includes("Range: 'bytes=0-0'") && comp.includes('content-range'));
check('la petición por rango cancela el cuerpo (si no, descargaría el archivo entero)', cuerpoRango.includes('body?.cancel'));
check('ningún camino de los archivos grandes lee el contenido', !cuerpoRango.includes('arrayBuffer') && !cuerpoGrandes.includes('arrayBuffer'));
check('con HEAD comprimido no se compara el tamaño comprimido', comp.includes("!r.headers.get('content-encoding')"));
check('un archivo grande ausente avisa en ámbar, no tiñe de rojo toda la comprobación',
  cuerpoGrandes.includes("'avi'") && !cuerpoGrandes.includes("'mal'") && !cuerpoGrandes.includes('faltan'));

process.exit(failed ? 1 : 0);
