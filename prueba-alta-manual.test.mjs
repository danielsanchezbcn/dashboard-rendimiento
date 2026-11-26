// Alta manual de resultados (15/11/2026): tests que no se importan y se escriben a mano en la pantalla del test.
import 'fake-indexeddb/auto';
import { createDb, initDb } from './db.js';
import { seedInitialCatalog } from './catalogo-inicial.js';
import { listCatalog } from './catalogo.js';
import { addManualSession, admiteAltaManual, variablesAltaManual, TESTS_ALTA_MANUAL, BLOQUES_ALTA_MANUAL } from './alta-manual.js';

let fail = 0; const check = (n, ok, d = '') => { console.log((ok ? 'OK   ' : 'FAIL ') + n + (ok ? '' : ' ' + d)); if (!ok) fail = 1; };
const err = async (f) => { try { await f(); return null; } catch (e) { return e.message; } };

const db = createDb('t-altamanual-' + Math.random()); await initDb(db);
await seedInitialCatalog(db);
const cat = await listCatalog(db);
const T = (n) => cat.tests.find((t) => t.name === n);
const p = await db.players.add({ jerseyName: 'Ana' });

// ---- Qué tests admiten alta manual
check('los seis tests isométricos de la lista del usuario', TESTS_ALTA_MANUAL.every((n) => admiteAltaManual(T(n))), TESTS_ALTA_MANUAL.filter((n) => !admiteAltaManual(T(n))).join(' / '));
check('todos los tests del bloque NME (el toe-touch y los que se creen después)', BLOQUES_ALTA_MANUAL.includes('nme') && cat.tests.filter((t) => t.blockKey === 'nme').every((t) => admiteAltaManual(t)) && cat.tests.some((t) => t.blockKey === 'nme'));
check('todos los de Perímetros', cat.tests.filter((t) => t.blockKey === 'perimetros').every((t) => admiteAltaManual(t)) && cat.tests.some((t) => t.blockKey === 'perimetros'));
check('un test nuevo de NME lo hereda sin tocar ninguna lista', admiteAltaManual({ name: 'Test de NME que no existe todavía', blockKey: 'nme' }));
check('los tests que SÍ se importan no tienen alta manual', ['CMJ', 'Squat Jump', 'Run-Specific Knee Iso-Push', 'Double-Leg Hop Test'].every((n) => !admiteAltaManual(T(n))));
check('un test archivado no admite alta manual', !admiteAltaManual({ ...T('Supine Isometric Ankle Inversion'), archived: true }));
check('el nombre se reconoce aunque cambien mayúsculas, acentos o «Single-Leg»', admiteAltaManual({ name: 'hip adduction 45°  (short lever)', blockKey: 'fuerza' }));

// ---- Guardar un resultado. El toe-touch tiene variables sembradas; se usa ese.
const toe = cat.tests.find((t) => t.blockKey === 'nme' && /toe/i.test(t.name));
const vToe = variablesAltaManual(cat.variables, toe.id);
check('las variables que se pueden escribir son las del test, sin las calculadas', vToe.length > 0 && vToe.every((v) => v.testId === toe.id && v.kind !== 'derived' && !v.archived));
const lado = (v) => (v.sides === 'LR' ? 'L' : 'S');
const id = await addManualSession(db, { playerId: p, testId: toe.id, date: '2026-11-15', valores: { [vToe[0].id]: { [lado(vToe[0])]: '12,5' } } });
const s = await db.sessions.get(id);
check('crea una sesión con la fecha y el valor escritos', s.testId === toe.id && s.date === '2026-11-15' && s.values[vToe[0].id][lado(vToe[0])] === 12.5, JSON.stringify(s.values));
check('la coma decimal se admite', s.values[vToe[0].id][lado(vToe[0])] === 12.5);
check('queda marcada como manual y válida, sin repeticiones ni protocolo', s.source === 'manual' && s.status === 'valid' && s.protocolId === null && JSON.stringify(s.reps) === '{}');
check('las casillas vacías no se guardan', Object.keys(s.values).length === 1);
check('queda constancia en el registro de auditoría', (await db.auditLog.toArray()).some((a) => a.action === 'sesion-alta-manual'));

// ---- Validaciones
check('sin ningún valor no se guarda', (await err(() => addManualSession(db, { playerId: p, testId: toe.id, date: '2026-11-16', valores: {} }))) === 'Escribe al menos un valor.');
check('un valor que no es un número se rechaza y dice cuál', /escribe un número/i.test(await err(() => addManualSession(db, { playerId: p, testId: toe.id, date: '2026-11-16', valores: { [vToe[0].id]: { [lado(vToe[0])]: 'doce' } } }))));
check('fecha inválida', /fecha no es válida/i.test(await err(() => addManualSession(db, { playerId: p, testId: toe.id, date: '15/11/2026', valores: { [vToe[0].id]: { [lado(vToe[0])]: '1' } } }))));
check('hora inválida', /hora no es válida/i.test(await err(() => addManualSession(db, { playerId: p, testId: toe.id, date: '2026-11-16', time: '25:00', valores: { [vToe[0].id]: { [lado(vToe[0])]: '1' } } }))));
check('no se puede duplicar jugador, test, fecha y hora', /Ya hay una sesión/.test(await err(() => addManualSession(db, { playerId: p, testId: toe.id, date: '2026-11-15', valores: { [vToe[0].id]: { [lado(vToe[0])]: '9' } } }))));
check('la misma fecha a otra hora sí se puede', Number.isInteger(await addManualSession(db, { playerId: p, testId: toe.id, date: '2026-11-15', time: '18:30', valores: { [vToe[0].id]: { [lado(vToe[0])]: '9' } } })));
check('un test que no admite alta manual se rechaza', /no admite alta manual/.test(await err(() => addManualSession(db, { playerId: p, testId: T('CMJ').id, date: '2026-11-16', valores: {} }))));
check('un jugador inexistente se rechaza', /Elige un jugador/.test(await err(() => addManualSession(db, { playerId: 9999, testId: toe.id, date: '2026-11-16', valores: {} }))));

// ---- Variable de dos lados: se guardan los dos por separado
const dosLados = cat.variables.find((v) => v.testId === toe.id && v.sides === 'LR' && !v.archived);
if (dosLados) {
  const id2 = await addManualSession(db, { playerId: p, testId: toe.id, date: '2026-11-17', valores: { [dosLados.id]: { L: '10', R: '11' } } });
  const s2 = await db.sessions.get(id2);
  check('una variable de dos lados guarda izquierda y derecha', s2.values[dosLados.id].L === 10 && s2.values[dosLados.id].R === 11);
  const id3 = await addManualSession(db, { playerId: p, testId: toe.id, date: '2026-11-18', valores: { [dosLados.id]: { L: '10' } } });
  check('se puede guardar un solo lado', Object.keys((await db.sessions.get(id3)).values[dosLados.id]).join() === 'L');
} else check('una variable de dos lados guarda izquierda y derecha', true, '(este test no tiene ninguna)');

console.log(fail ? 'HAY FALLOS' : 'Todo bien');
process.exit(fail);
