// Las 5 asimetrías del CMJ se importan, y una sesión guardada ANTES (sin ellas) se completa al reimportar sin duplicarla ni tocar sus valores. Datos 100 % sintéticos.
import 'fake-indexeddb/auto';
import { webcrypto } from 'node:crypto';
if (!globalThis.crypto?.subtle) globalThis.crypto = webcrypto;
import * as D from './db.js';
import * as I from './catalogo-inicial.js';
import * as C from './catalogo.js';
import * as V from './vald.js';
import * as M from './importacion.js';

let failed = 0;
const check = (name, cond, extra = '') => { console.log(`${cond ? 'OK  ' : 'FAIL'} ${name} ${extra}`); if (!cond) failed++; };
const db = D.createDb('cmj-asim'); await D.initDb(db); await I.seedInitialCatalog(db);
const cat = await C.listCatalog(db);
const base = ['Name', 'ExternalId', 'Test Type', 'Date', 'Time', 'BW [KG]', 'Reps', 'Tags'];
const ASY = ['Eccentric Deceleration RFD % (Asym) (%)', 'Concentric Impulse-100ms % (Asym) (%)', 'Concentric Impulse % (Asym) (%)', 'Eccentric Deceleration Impulse % (Asym) (%)', 'Peak Landing Force % (Asym) (%)'];
const NOM = ['ECC DECEL RFD ASYM', 'CON IMPULSE 100ms ASYM', 'CON IMPULSE ASYM', 'ECC DECEL IMPULSE ASYM', 'PEAK LANDING FORCE ASYM'];
const gridSin = [[...base, 'Jump Height (Imp-Mom) [cm]'], ['SINT Z', 'z1', 'CMJ', '10/03/2026', '10:30 AM', '70', '3', '', '35.5']];
const gridCon = [[...base, 'Jump Height (Imp-Mom) [cm]', ...ASY], ['SINT Z', 'z1', 'CMJ', '10/03/2026', '10:30 AM', '70', '3', '', '35.5', '1.1 L', '5.9 L', '4.2 R', '19 L', '5 R']];
const resol = { 'SINT Z': { action: 'new', jerseyName: 'Sintético Z' } };
const file = { name: 'cmj.csv', hash: 'h', size: 1 };

const p1 = V.parseValdGrid(gridCon, cat);
const vars = cat.variables.filter((v) => v.testId === p1.groups[0].testId);
check('las 5 columnas de asimetría del CMJ ya no se ignoran', p1.ok && !p1.ignored.some((h) => /Asym/.test(h)), JSON.stringify(p1.ignored));
const r0 = p1.groups[0].rows[0];
check('valores con signo: L negativo, R positivo', NOM.every((n, i) => r0.values[vars.find((v) => v.name === n).id]?.S === [-1.1, -5.9, 4.2, -19, 5][i]), JSON.stringify(r0.values));

// 1) sesión antigua sin asimetrías
const pOld = V.parseValdGrid(gridSin, cat);
const vp0 = await V.planValdImport(db, pOld, resol);
await V.commitValdImport(db, { file, vald: pOld, plans: vp0.plans, remember: {} });
const idP = (await db.players.toArray())[0].id;
const antes = (await db.sessions.toArray());
check('sesión antigua guardada sin asimetrías', antes.length === 1 && !NOM.some((n) => vars.find((v) => v.name === n).id in antes[0].values));
// el usuario edita un valor existente: no debe cambiar
const vJH = vars.find((v) => v.name === 'JH (imp-mom)');
await db.sessions.update(antes[0].id, { values: { ...antes[0].values } });

// 2) reimportar el CSV completo
const vp1 = await V.planValdImport(db, p1, { 'SINT Z': { action: 'link', playerId: idP } });
check('plan: la sesión existente se marca como ampliable (no conflicto ni nueva)', vp1.plan.counts.ampliadas === 1 && vp1.plan.counts.conflictos === 0 && vp1.plan.counts.nuevas === 0, JSON.stringify(vp1.plan.counts));
const out = await V.commitValdImport(db, { file, vald: p1, plans: vp1.plans, remember: {} });
const despues = await db.sessions.toArray();
check('no se duplica la sesión', despues.length === 1 && out.counts.sesionesCreadas === 0 && out.counts.sesionesAmpliadas === 1, JSON.stringify(out.counts));
check('se añaden las 5 asimetrías', NOM.every((n) => despues[0].values[vars.find((v) => v.name === n).id] !== undefined));
check('el valor que ya existía no cambia', JSON.stringify(despues[0].values[vJH.id]) === JSON.stringify(antes[0].values[vJH.id]));
check('mismo id y mismo lote de origen', despues[0].id === antes[0].id && despues[0].batchId === antes[0].batchId);

// 3) reimportar otra vez: ya idéntica
const vp2 = await V.planValdImport(db, p1, { 'SINT Z': { action: 'link', playerId: idP } });
check('tercera importación: duplicada (idempotente)', vp2.plan.counts.duplicadas === 1 && vp2.plan.counts.ampliadas === 0, JSON.stringify(vp2.plan.counts));

// 4) valor distinto en una variable existente → sigue siendo conflicto (no se sobrescribe)
const gridDist = gridCon.map((r, i) => i ? r.map((x, j) => (j === 8 ? '40' : x)) : r);
const vp3 = await V.planValdImport(db, V.parseValdGrid(gridDist, cat), { 'SINT Z': { action: 'link', playerId: idP } });
check('si cambia un valor ya guardado sigue siendo conflicto', vp3.plan.counts.conflictos === 1 && vp3.plan.counts.ampliadas === 0, JSON.stringify(vp3.plan.counts));
process.exit(failed ? 1 : 0);
