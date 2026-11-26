// «Standing Isometric 90°/20° Hamstring Test» (código SLHNTI de VALD, 25/11/2026). El test estaba en el catálogo desde el principio pero SIN NINGUNA
// variable, así que el fichero no se podía importar. Se le dan las mismas que al Supine 90°/90°, con el relativo al SW del 29 % (elección del usuario).
// Las cabeceras son las del fichero real del usuario; los jugadores y los números, sintéticos.
import 'fake-indexeddb/auto';
import { webcrypto } from 'node:crypto';
if (!globalThis.crypto?.subtle) globalThis.crypto = webcrypto;
import * as D from './db.js';
import * as I from './catalogo-inicial.js';
import * as C from './catalogo.js';
import * as V from './vald.js';

let failed = 0;
const check = (n, ok, d = '') => { console.log(`${ok ? 'OK  ' : 'FAIL'} ${n} ${ok ? '' : d}`); if (!ok) failed++; };

const TEST = 'Standing Isometric 90°/20° Hamstring Test';
const db = D.createDb('hams9020-' + Math.random());
await D.initDb(db); await I.seedInitialCatalog(db);
const cat = await C.listCatalog(db);
const t = cat.tests.find((x) => x.name === TEST);
const vars = cat.variables.filter((v) => v.testId === t.id);
const vp = (n) => vars.find((v) => v.name === n);

check('el test tiene variables (antes estaba vacío y el fichero no se podía importar)', vars.length === 5, vars.map((v) => v.name).join(' · '));
check('Peak Force por pierna', vp('Peak Force')?.sides === 'LR' && vp('Peak Force').unit === 'N');
check('relativo al SW, igual que el 90°/90°', vp('Peak Force relativo (SW)')?.formula.op === 'REL_SW' && vp('Peak Force relativo (SW)').formula.params.factor === 0.29);
check('asimetría calculada por el dashboard, no importada', vp('Peak Force asimetría (%)')?.formula.op === 'ASIMETRIA');
check('RFD y Force at 100 ms', vp('RFD at 100 ms')?.unit === 'N/s' && vp('Force at 100 ms')?.unit === 'N');
check('las variables de fuerza tienen dirección «más alto es mejor»', vp('Peak Force').direction === 'higher' && vp('Peak Force relativo (SW)').direction === 'higher');
// El mismo juego de variables que su test hermano: si uno cambia y el otro no, se leerían distinto.
const h = cat.tests.find((x) => x.name === 'Supine Isometric 90°/90° Leg Curl Test');
const nombres = (id) => cat.variables.filter((v) => v.testId === id).map((v) => v.name).sort().join('|');
check('mismo juego de variables que el Supine 90°/90°', nombres(t.id) === nombres(h.id), nombres(t.id));

// Importación: cabeceras EXACTAS del fichero del usuario, con las dos columnas que no se importan.
const cab = ['Name', 'ExternalId', 'Test Type', 'Date', 'Time', 'BW [KG]', 'Reps (L)', 'Reps (R)', 'Tags',
  'Peak Vertical Force [N] ', 'Peak Vertical Force [N] (L)', 'Peak Vertical Force [N] (R)', 'Peak Vertical Force [N] (Asym)(%)',
  'Peak Vertical Force / BM [N/kg] ', 'Peak Vertical Force / BM [N/kg] (L)', 'Peak Vertical Force / BM [N/kg] (R)', 'Peak Vertical Force / BM [N/kg] (Asym)(%)',
  'RFD - 100ms [N/s] ', 'RFD - 100ms [N/s] (L)', 'RFD - 100ms [N/s] (R)', 'RFD - 100ms [N/s] (Asym)(%)',
  'Force at 100ms [N] ', 'Force at 100ms [N] (L)', 'Force at 100ms [N] (R)', 'Force at 100ms [N] (Asym)(%)',
  'Start Time to 80% Net Peak Force [s] ', 'Start Time to 80% Net Peak Force [s] (L)', 'Start Time to 80% Net Peak Force [s] (R)', 'Start Time to 80% Net Peak Force [s] (Asym)(%)'];
const fila = ['SINT 9020', '', 'SLHNTI', '18/11/2026', '11:20 AM', '9.6', '1', '1', '',
  '478', '440', '516', '15 R', '49.77', '45.75', '53.80', '15 R', '684', '258', '1111', '77 R', '201', '274', '128', '53 L', '2.876', '2.715', '3.038', '11 R'];
const p = V.parseValdGrid([cab, fila], cat);
check('el fichero se reconoce como VALD y el código SLHNTI encuentra su test', p.ok && p.groups.length === 1 && p.groups[0].testId === t.id, JSON.stringify(p.skipped ?? []));
const r = p.groups[0].rows[0];
check('Peak Force se guarda por pierna, sin la media sin sufijo', r.values[vp('Peak Force').id]?.L === 440 && r.values[vp('Peak Force').id]?.R === 516);
check('RFD y Force at 100 ms por pierna', r.values[vp('RFD at 100 ms').id]?.R === 1111 && r.values[vp('Force at 100 ms').id]?.L === 274);
check('las repeticiones por lado se leen', r.reps?.L === 1 && r.reps?.R === 1, JSON.stringify(r.reps));
// Lo que NO entra, y por qué.
const ign = (p.ignored ?? []).join(' | ');
check('«Peak Vertical Force / BM» no se importa: VALD la divide por un BW de 9,6 kg que no es la masa corporal (D30)', /BM/.test(ign) && !vars.some((v) => /N\/kg/.test(v.unit ?? '')), ign);
check('«Start Time to 80% Net Peak Force» no se importa (decisión del usuario del 25/11/2026)', /Start Time/.test(ign) && !vars.some((v) => /Start Time/i.test(v.name)), ign);
check('las columnas de asimetría de VALD no se importan: la asimetría la calcula el dashboard (D25)', !Object.keys(r.values).some((id) => /asimetría/i.test(vars.find((v) => v.id === Number(id))?.name ?? '')));
check('la columna BW [KG] no se importa (D30)', !vars.some((v) => lcN(v.name) === 'bw'));
function lcN(s) { return String(s ?? '').trim().toLowerCase(); }

// Una base ya sembrada con la versión anterior del catálogo: la migración tiene que crear las variables que faltaban, sin tocar nada más.
const db2 = D.createDb('hams9020-mig-' + Math.random());
await D.initDb(db2); await I.seedInitialCatalog(db2);
const t2 = (await db2.tests.toArray()).find((x) => x.name === TEST);
for (const v of await db2.variables.where('testId').equals(t2.id).toArray()) await db2.variables.delete(v.id); // así estaba la base del usuario
await db2.meta.put({ key: 'catalogSeeded', value: { version: 18, at: new Date().toISOString(), vacioAlSembrar: true } });
const antes = await db2.variables.count();
const res = await I.seedInitialCatalog(db2); // ya sembrada: dispara la migración del catálogo
const despues = await db2.variables.toArray();
const mias = despues.filter((v) => v.testId === t2.id);
check('la migración crea las 5 variables en una base ya existente', mias.length === 5, mias.map((v) => v.name).join(' · '));
check('y no toca el resto del catálogo', despues.length - mias.length === antes, `${despues.length - mias.length} vs ${antes}`);
check('la migración es idempotente: pasarla otra vez no duplica nada', await (async () => { await I.seedInitialCatalog(db2); return (await db2.variables.where('testId').equals(t2.id).toArray()).length === 5; })());
check('la migración no vuelve a sembrar desde cero', res.sembrado === false);
check('el informe de la migración cuenta las variables añadidas', (res.variablesAnadidas ?? 0) >= 5, JSON.stringify(res.variablesAnadidas));

process.exit(failed ? 1 : 0);
