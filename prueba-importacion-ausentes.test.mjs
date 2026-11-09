// Sesiones ausentes del fichero: se ofrecen para eliminar, nunca se borran sin marcar. Datos sintéticos.
import 'fake-indexeddb/auto';
import { webcrypto } from 'node:crypto';
if (!globalThis.crypto?.subtle) globalThis.crypto = webcrypto;
import * as D from './db.js';
import * as CI from './catalogo-inicial.js';
import { listCatalog } from './catalogo.js';
import * as I from './importacion.js';
import { createPlayer } from './jugadores.js';
let failed = 0; const check = (n, c, x = '') => { console.log(`${c ? 'OK  ' : 'FAIL'} ${n} ${x}`); if (!c) failed++; };

const db = D.createDb('ausentes-1'); await D.initDb(db); await CI.seedInitialCatalog(db);
const cat = await listCatalog(db);
const t = cat.tests.find((x) => x.name === 'Perímetros');
const vars = cat.variables.filter((v) => v.testId === t.id);
const v0 = vars.find((v) => v.name === 'MAXIMUM CALF PERIMETER');
const a = await createPlayer(db, { jerseyName: 'Uno', fullName: '', synthetic: true });
const b = await createPlayer(db, { jerseyName: 'Dos', fullName: '', synthetic: true });
const res = { Uno: { action: 'link', playerId: a }, Dos: { action: 'link', playerId: b } };
const cols = [{ role: 'jugador' }, { role: 'fecha' }, { role: 'valor', variableId: v0.id, side: 'L' }];
const mk = (rows) => I.buildRows([['Jugador', 'Fecha', 'Valor'], ...rows], { headerRow: 0, cols }, vars);
const file = { name: 'x.xlsx', hash: 'h', size: 1 };
const importar = async (rows, name) => {
  const parsed = mk(rows);
  const plan = await I.planImport(db, { rows: parsed.rows, testId: t.id, resolutions: res });
  const r = await I.commitImport(db, { file: { ...file, name }, sheetName: 'H', testId: t.id, mapping: {}, parsed, plan, rememberAlias: {} });
  return { plan, r };
};
await importar([['Uno', '2026-07-01', 30], ['Uno', '2026-07-10', 31], ['Dos', '2026-07-05', 32], ['Dos', '2026-07-20', 33], ['Uno', '2026-07-20', 34]], 'a.xlsx');
// sesión manual (otro origen) en el rango: no debe ofrecerse
await db.sessions.add({ playerId: a, testId: t.id, protocolId: null, date: '2026-07-12', time: '', values: { [v0.id]: { L: 1 } }, reps: {}, status: 'valid', excludedReason: '', source: 'Manual', createdAt: 'x' });
// segundo fichero: rango 01-07..20-07; faltan Uno 10-07 y Dos 05-07; hay uno nuevo
const parsed2 = mk([['Uno', '2026-07-01', 30], ['Dos', '2026-07-20', 33], ['Uno', '2026-07-20', 34], ['Dos', '2026-07-15', 35]]);
const plan2 = await I.planImport(db, { rows: parsed2.rows, testId: t.id, resolutions: res });
const miss = await I.findMissingSessions(db, { source: 'Excel', groups: [{ testId: t.id, protocolId: null, sessions: plan2.sessions }] });
check('detecta las 2 ausentes', miss.length === 2 && JSON.stringify(miss.map((m) => m.date).sort()) === '["2026-07-05","2026-07-10"]', JSON.stringify(miss.map((m) => [m.playerName, m.date])));
check('no ofrece la manual', !miss.some((m) => m.date === '2026-07-12'));
// rango: un fichero más corto no ofrece lo que queda fuera de sus fechas
const planC = await I.planImport(db, { rows: mk([['Uno', '2026-07-01', 30]]).rows, testId: t.id, resolutions: res });
const missC = await I.findMissingSessions(db, { source: 'Excel', groups: [{ testId: t.id, protocolId: null, sessions: planC.sessions }] });
check('fichero de un solo día: nada fuera de rango', missC.length === 0, JSON.stringify(missC));
// no se borra nada al importar sin marcar
const r2 = await I.commitImport(db, { file: { ...file, name: 'b.xlsx', hash: 'h2' }, sheetName: 'H', testId: t.id, mapping: {}, parsed: parsed2, plan: plan2, rememberAlias: {} });
check('importar sin marcar no borra', (await db.sessions.toArray()).length === 5 + 1 + 1, String((await db.sessions.toArray()).length));
// eliminar solo una marcada (y un id ajeno de origen Manual se ignora)
const manual = (await db.sessions.toArray()).find((s) => s.source === 'Manual');
const uno10 = miss.find((m) => m.date === '2026-07-10');
const out = await I.applyMissingDeletion(db, { ids: [uno10.id, manual.id], source: 'Excel', batchByTest: { [t.id]: r2.batchId } });
check('elimina 1 y omite la manual', out.eliminadas === 1 && out.omitidas === 1, JSON.stringify(out));
check('la manual sigue', !!(await db.sessions.get(manual.id)) && !(await db.sessions.get(uno10.id)));
const batch = (await I.listBatches(db)).find((x) => x.id === r2.batchId);
check('lote guarda copia e informe', batch.sesionesEliminadas === 1 && batch.deletedSessions.length === 1 && I.reportCsv(batch).includes('eliminada'));
const aud = (await db.auditLog.toArray()).filter((x) => x.action === 'sesiones-ausentes-eliminadas');
check('auditoría sin valores', aud.length === 1 && !JSON.stringify(aud[0]).includes('"values"'));
console.log(failed ? `${failed} FALLOS` : 'TODO OK');
process.exit(failed ? 1 : 0);
