// Unificar y eliminar jugadores. Datos sintéticos.
import 'fake-indexeddb/auto';
import { webcrypto } from 'node:crypto';
if (!globalThis.crypto?.subtle) globalThis.crypto = webcrypto;
import * as D from './db.js';
import * as CI from './catalogo-inicial.js';
import { createPlayer, addAlias, mergePlayers, deleteEmptyPlayer, deletePlayerWithData, playerDataCounts } from './jugadores.js';
let failed = 0; const check = (n, c, x = '') => { console.log(`${c ? 'OK  ' : 'FAIL'} ${n} ${x}`); if (!c) failed++; };
const db = D.createDb('unif-1'); await D.initDb(db); await CI.seedInitialCatalog(db);
const a = await createPlayer(db, { jerseyName: 'Bernardo', fullName: '' });
const b = await createPlayer(db, { jerseyName: 'BERNARDO ESPINOSA', fullName: 'Bernardo Espinosa' });
const z = await createPlayer(db, { jerseyName: 'ZZ Prueba', fullName: '' });
await addAlias(db, a, 'Excel', 'Bernardo'); await addAlias(db, b, 'VALD', 'Bernardo Espinosa');
const t = (await db.tests.toArray())[0];
const ses = (pid, date) => db.sessions.add({ playerId: pid, testId: t.id, protocolId: null, date, time: '', values: {}, reps: {}, status: 'valid', excludedReason: '', source: 'X', createdAt: 'x' });
await ses(a, '2026-01-01'); await ses(a, '2026-01-02'); await ses(b, '2026-01-02'); await ses(b, '2026-01-03');
await db.players.update(b, { referenceWeight: { value: 80, unit: 'kg' } });
// eliminar: con datos falla, vacío funciona
let err = ''; try { await deleteEmptyPlayer(db, a); } catch (e) { err = e.message; }
check('no elimina con datos', /No se puede eliminar/.test(err) && !!(await db.players.get(a)));
await deleteEmptyPlayer(db, z);
check('elimina ficha vacía', !(await db.players.get(z)));
// unificar: se conserva a (Excel), desaparece b
const r = await mergePlayers(db, a, b);
check('b desaparece, a conserva todo', !(await db.players.get(b)) && (await db.sessions.where('playerId').equals(a).count()) === 4 && (await db.sessions.where('playerId').equals(b).count()) === 0);
check('avisa de la sesión repetida (2026-01-02)', r.posiblesDuplicadas === 1, JSON.stringify(r));
const pa = await db.players.get(a);
check('hereda nombre completo y peso solo si faltaban', pa.fullName === 'Bernardo Espinosa' && pa.referenceWeight?.value === 80 && pa.jerseyName === 'Bernardo');
const al = await db.playerAliases.where('playerId').equals(a).toArray();
check('alias de VALD pasa a la ficha conservada', al.some((x) => x.source === 'VALD' && x.rawText === 'Bernardo Espinosa'), JSON.stringify(al.map((x) => x.source + ':' + x.rawText)));
check('auditoría sin valores', (await db.auditLog.toArray()).filter((x) => x.action === 'jugadores-unificados').length === 1);
let e2 = ''; try { await mergePlayers(db, a, a); } catch (e) { e2 = e.message; }
check('rechaza unir una ficha consigo misma', /distintos/.test(e2));
// eliminar con datos (10/11/2026): borra todo lo suyo y nada de los demás
const w = await createPlayer(db, { jerseyName: 'Con Datos', fullName: '' });
await addAlias(db, w, 'Excel', 'Con Datos'); await ses(w, '2026-02-01'); await ses(w, '2026-02-02');
await db.anthropometry.add({ playerId: w, date: '2026-02-01', synthetic: 1 });
const antes = await db.sessions.count();
const bor = await deletePlayerWithData(db, w);
check('elimina jugador con datos y todo lo suyo', !(await db.players.get(w)) && (await db.sessions.where('playerId').equals(w).count()) === 0 && (await db.anthropometry.where('playerId').equals(w).count()) === 0 && (await db.playerAliases.where('playerId').equals(w).count()) === 0 && bor.sessions === 2);
check('no toca las sesiones de los demás', (await db.sessions.count()) === antes - 2 && (await db.sessions.where('playerId').equals(a).count()) === 4);
check('auditoría solo con recuentos', (await db.auditLog.toArray()).some((x) => x.action === 'jugador-eliminado' && JSON.stringify(x).includes('borrados')));
console.log(failed ? `${failed} FALLOS` : 'TODO OK');
process.exit(failed ? 1 : 0);
