// El paquete de librerías no debe crear Web Workers desde «blob:» (la política de seguridad de la página lo bloquea): con libros Excel grandes, fflate lo hacía y el importador no continuaba.
import fs from 'node:fs';
let failed = 0; const check = (n, c) => { console.log(`${c ? 'OK  ' : 'FAIL'} ${n}`); if (!c) failed++; };
const libs = fs.readFileSync(new URL('./libs.js', import.meta.url), 'utf8');
check('libs.js sin workers desde blob (fflate síncrono)', !/createObjectURL\(new Blob\(\[/.test(libs) && !/new Worker\(/.test(libs));
check('el alias síncrono está en el script de compilación', /--alias:fflate=\.\/fflate-sync\.js/.test(fs.readFileSync(new URL('./package.json', import.meta.url), 'utf8')));
console.log(failed ? `${failed} FALLOS` : 'TODO OK');
process.exit(failed ? 1 : 0);
