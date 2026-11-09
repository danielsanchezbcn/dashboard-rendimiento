import 'fake-indexeddb/auto';
import { webcrypto } from 'node:crypto';
if (!globalThis.crypto?.subtle) globalThis.crypto = webcrypto;
import * as D from './db.js';
import * as I from './catalogo-inicial.js';
let failed = 0; const check = (n, c, x = '') => { console.log(`${c ? 'OK  ' : 'FAIL'} ${n} ${x}`); if (!c) failed++; };

// Un catálogo ya sembrado con la versión 5 (como el del usuario) recibe los perímetros sin tocar nada de lo editado.
const db = D.createDb('per-1'); await D.initDb(db); await I.seedInitialCatalog(db);
const t = (await db.tests.toArray()).find((x) => x.name === 'Perímetros');
for (const v of await db.variables.where('testId').equals(t.id).toArray()) await db.variables.delete(v.id);
await db.tests.delete(t.id);
const cmj = (await db.tests.toArray()).find((x) => x.name === 'CMJ');
await db.tests.update(cmj.id, { notes: 'nota del usuario' });
await db.meta.put({ key: 'catalogSeeded', value: { version: 5 } });
const r = await I.seedInitialCatalog(db);
const t2 = (await db.tests.toArray()).find((x) => x.name === 'Perímetros');
const vars = await db.variables.where('testId').equals(t2.id).toArray();
check('migración v5→v6 añade el test Perímetros con 5 variables', r.migrado && t2.blockKey === 'perimetros' && vars.length === 5, JSON.stringify(r));
check('nombres tal como los escribió el usuario, cm, por lado, sin dirección', I.PERIMETERS.every((n) => vars.some((v) => v.name === n && v.unit === 'cm' && v.sides === 'LR' && v.direction === null && v.kind === 'raw')));
check('lo editado por el usuario no se toca', (await db.tests.get(cmj.id)).notes === 'nota del usuario');
const again = await I.seedInitialCatalog(db);
check('no se repite', again.migrado === false && (await db.variables.where('testId').equals(t2.id).count()) === 5);
// RSI: «más alto es mejor» aunque lleve «CONTACT TIME» en el nombre; solo el tiempo de contacto es «más bajo» (9/11/2026).
const dirs = (await db.variables.toArray()).filter((v) => v.source === 'inicial');
check('RSI (flight/contact time) y Mean RSI: más alto es mejor', dirs.filter((v) => /\bRSI\b/i.test(v.name)).length >= 5 && dirs.filter((v) => /\bRSI\b/i.test(v.name)).every((v) => v.direction === 'higher'));
check('CONTACT TIME y MEAN CONTACT TIME: más bajo es mejor', dirs.filter((v) => /^(mean )?contact time$/i.test(v.name)).length >= 3 && dirs.filter((v) => /^(mean )?contact time$/i.test(v.name)).every((v) => v.direction === 'lower'));
// catálogo del usuario con el error heredado (RSI en «lower», versión 6): se corrige una vez, sin tocar el resto
for (const v of dirs.filter((x) => /\bRSI\b/i.test(x.name))) await db.variables.update(v.id, { direction: 'lower' });
await db.meta.put({ key: 'catalogSeeded', value: { version: 6 } });
const rr = await I.seedInitialCatalog(db);
const dirs2 = (await db.variables.toArray()).filter((v) => v.source === 'inicial');
check('migración v6→v7: RSI vuelven a «más alto», contact time sigue «más bajo»', rr.rsiCorregidos >= 5 && dirs2.filter((v) => /\bRSI\b/i.test(v.name)).every((v) => v.direction === 'higher') && dirs2.filter((v) => /^(mean )?contact time$/i.test(v.name)).every((v) => v.direction === 'lower'), JSON.stringify(rr));
// Direcciones confirmadas el 9/11: duraciones, profundidad y velocidad excéntrica pico «más bajo»; rigideces y fuerza a velocidad 0 «más alto».
const D2 = (await db.variables.toArray()).filter((v) => v.source === 'inicial');
const dirDe = (re) => D2.filter((v) => re.test(v.name) && v.kind === 'raw');
check('más bajo es mejor: ECC DECEL PHASE DURATION, CONCENTRIC DURATION, CONTRACTION TIME, DEPTH, ECC PEAK VELOCITY', ['ECC DECEL PHASE DURATION', 'CONCENTRIC DURATION', 'CONTRACTION TIME', 'DEPTH', 'ECC PEAK VELOCITY'].every((n) => dirDe(new RegExp('^' + n + '$', 'i')).length >= 2 && dirDe(new RegExp('^' + n + '$', 'i')).every((v) => v.direction === 'lower')));
check('más alto es mejor: COM STIFFNESS, FORCE AT 0 VELOCITY y rigideces activas', ['COM STIFFNESS', 'FORCE AT 0 VELOCITY', 'ACTIVE STIFFNESS', 'MEAN ACTIVE STIFFNESS'].every((n) => dirDe(new RegExp('^' + n + '$', 'i')).length >= 1 && dirDe(new RegExp('^' + n + '$', 'i')).every((v) => v.direction === 'higher')));
// catálogo del usuario con «higher» por defecto en esas variables (versión 7): se pasan a «lower» una vez
for (const v of dirDe(/^(depth|concentric duration|ecc peak velocity)$/i)) await db.variables.update(v.id, { direction: 'higher' });
await db.meta.put({ key: 'catalogSeeded', value: { version: 7 } });
const r8 = await I.seedInitialCatalog(db);
check('migración v7→v8 corrige las direcciones sembradas', r8.direccionesBajo >= 6 && (await db.variables.toArray()).filter((v) => /^(depth|concentric duration|ecc peak velocity)$/i.test(v.name)).every((v) => v.direction === 'lower'), JSON.stringify(r8));
if (failed) { console.log(`${failed} fallo(s)`); process.exit(1); }
