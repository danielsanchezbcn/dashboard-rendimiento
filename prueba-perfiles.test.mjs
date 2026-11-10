// Reglas por propiedad (paquete A, 10/11/2026): criterio del Personal Best, tabla de columnas y exclusiones de Asimetrías ya no dependen del nombre exacto. Datos sintéticos.
import 'fake-indexeddb/auto';
import { createDb, initDb } from './db.js';
import { seedInitialCatalog, ensurePerfiles } from './catalogo-inicial.js';
import * as C from './catalogo.js';
let fail = 0; const check = (n, ok, d = '') => { console.log((ok ? 'OK   ' : 'FAIL ') + n + (ok ? '' : ' ' + d)); if (!ok) fail = 1; };
const mk = async () => { const db = createDb('t-perf-' + Math.random()); await initDb(db); const r = await seedInitialCatalog(db); return { db, r }; };
const { db, r } = await mk();
let cat = await C.listCatalog(db);
const T = (n) => cat.tests.find((t) => t.name === n); const V = (t, n) => cat.variables.find((v) => v.testId === t.id && v.name === n);
check('el arranque guarda los ajustes en los tests actuales', r.perfiles?.tests >= 6 && T('CMJ').pbCriterioVariableId === V(T('CMJ'), 'RSI MOD').id && T('CMJ').panelColumnas === true && T('Nordic Hamstring Exercise').excluirAsimetrias === true && T('Squat Jump').pbCriterioVariableId === V(T('Squat Jump'), 'JH (imp-mom)').id, JSON.stringify(r.perfiles));
check('los tests de perímetros también guardan panelColumnas', cat.tests.filter((t) => t.blockKey === 'perimetros').every((t) => t.panelColumnas === true));
check('Torque y Force/RFD at 100 ms quedan marcadas', cat.variables.filter((v) => /torque|at 100 ms/i.test(v.name)).every((v) => v.excluirAsimetrias === true) && cat.variables.some((v) => /torque/i.test(v.name)));
const r2 = await ensurePerfiles(db);
check('idempotente: la segunda vez no cambia nada', r2.tests === 0 && r2.variables === 0, JSON.stringify(r2));
// Una base ya existente (de antes de este cambio): los tests no tienen los campos nuevos
await db.tests.toCollection().modify((t) => { delete t.pbCriterioVariableId; delete t.panelColumnas; delete t.excluirAsimetrias; });
await db.variables.toCollection().modify((v) => { delete v.excluirAsimetrias; });
const antesDeSellar = await C.listCatalog(db);
check('sin los campos guardados, el comportamiento es el mismo (valores por defecto por nombre)', C.usaPanelColumnas(antesDeSellar.tests.find((t) => t.name === 'CMJ')) && !!C.pbCriterionOf(antesDeSellar.tests.find((t) => t.name === 'CMJ'), antesDeSellar.variables) && C.testExcluidoDeAsimetrias(antesDeSellar.tests.find((t) => t.name === 'Nordic Hamstring Exercise')));
const rr = await seedInitialCatalog(db);
check('al arrancar de nuevo se guardan en la base existente, sin tocar nada más', rr.sembrado === false && rr.perfiles.tests >= 6 && (await db.tests.count()) === antesDeSellar.tests.length && (await db.variables.count()) === antesDeSellar.variables.length, JSON.stringify(rr.perfiles));
cat = await C.listCatalog(db);
// Renombrar un test ya no rompe nada
const hop = T('Double-Leg Hop Test');
await C.updateTest(db, hop.id, { name: 'Hop test (doble pierna)' });
cat = await C.listCatalog(db);
const hop2 = cat.tests.find((t) => t.id === hop.id);
check('renombrar el Hop Test conserva su criterio de PB y su tabla de columnas', C.pbCriterionOf(hop2, cat.variables)?.name.includes('RSI') && C.usaPanelColumnas(hop2) && cat.variables.find((v) => v.testId === hop.id && /RSI/.test(v.name)).pbCriterion);
// Un test nuevo con el mismo nombre que uno por defecto (sin propiedades) usa los valores por defecto
const nuevo = { id: 9999, name: 'cmj', blockKey: 'fuerza' };
check('sin propiedades guardadas, vale el valor por defecto del nombre (compatibilidad)', C.usaPanelColumnas(nuevo) && !C.usaPanelColumnas({ id: 1, name: 'Otro test', blockKey: 'fuerza' }) && C.testExcluidoDeAsimetrias({ name: 'Nordic Hamstring Exercise' }) && C.variableExcluidaDeAsimetrias({ name: 'Torque' }) && !C.variableExcluidaDeAsimetrias({ name: 'Peak Force' }));
// Edición por el usuario
const cmj = T('CMJ');
await C.updateTest(db, cmj.id, { pbCriterioVariableId: null, panelColumnas: false });
cat = await C.listCatalog(db);
check('PB clásico elegido por el usuario (null): sin criterio y sin tabla', C.pbCriterionOf(cat.tests.find((t) => t.id === cmj.id), cat.variables) === null && !cat.variables.find((v) => v.id === V(cmj, 'RSI MOD').id).pbCriterion && !C.usaPanelColumnas(cat.tests.find((t) => t.id === cmj.id)));
await ensurePerfiles(db);
cat = await C.listCatalog(db);
check('lo que el usuario puso (null/false) no se pisa al volver a arrancar', cat.tests.find((t) => t.id === cmj.id).pbCriterioVariableId === null && cat.tests.find((t) => t.id === cmj.id).panelColumnas === false);
const jh = V(cmj, 'JH (imp-mom)');
await C.updateTest(db, cmj.id, { pbCriterioVariableId: jh.id });
cat = await C.listCatalog(db);
check('criterio cambiado a JH: lo llevan todas las variables del test', cat.variables.filter((v) => v.testId === cmj.id).every((v) => v.pbCriterion?.id === jh.id));
let e1 = ''; try { await C.updateTest(db, cmj.id, { pbCriterioVariableId: V(T('SL CMJ'), 'RSI MOD').id }); } catch (e) { e1 = e.message; }
check('el criterio debe ser una variable de ese test', /de este test/.test(e1), e1);
let e2 = ''; try { await C.updateTest(db, cmj.id, { panelColumnas: 'si' }); } catch (e) { e2 = e.message; }
check('opciones no booleanas se rechazan', /no válida/.test(e2), e2);
const der = cat.variables.find((v) => v.kind === 'derived' && v.testId === T('Run-Specific Hip Iso-Push').id);
let e3 = ''; try { await C.updateTest(db, T('Run-Specific Hip Iso-Push').id, { pbCriterioVariableId: der.id }); } catch (e) { e3 = e.message; }
check('una variable calculada no puede ser criterio', /origen/.test(e3), e3);
await C.updateVariable(db, V(T('Run-Specific Hip Iso-Push'), 'Peak Force').id, { excluirAsimetrias: true });
cat = await C.listCatalog(db);
check('una variable se puede excluir de Asimetrías', C.variableExcluidaDeAsimetrias(cat.variables.find((v) => v.testId === T('Run-Specific Hip Iso-Push').id && v.name === 'Peak Force')));
check('queda registrado en la auditoría', (await db.auditLog.toArray()).some((a) => a.action === 'catalogo-test-modificado') && (await db.auditLog.toArray()).some((a) => a.action === 'catalogo-perfiles-guardados'));
// Si el criterio guardado desaparece (variable archivada), se vuelve al valor por defecto, no a un error
const rsi = V(cmj, 'RSI MOD'); await C.updateTest(db, cmj.id, { pbCriterioVariableId: rsi.id }); await db.variables.update(rsi.id, { archived: true });
cat = await C.listCatalog(db);
check('criterio archivado: sin criterio y sin error', C.pbCriterionOf(cat.tests.find((t) => t.id === cmj.id), cat.variables) === null);
console.log(fail ? 'HAY FALLOS' : 'Todo bien'); process.exit(fail);
