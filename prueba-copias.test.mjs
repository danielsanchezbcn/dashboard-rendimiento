import 'fake-indexeddb/auto';
import { webcrypto } from 'node:crypto';
if (!globalThis.crypto?.subtle) globalThis.crypto = webcrypto;
import { Dexie } from './libs.js';
import * as D from './db.js';
import * as B from './backup.js';

let failed = 0;
const check = (name, cond, extra = '') => { console.log(`${cond ? 'OK  ' : 'FAIL'} ${name} ${extra}`); if (!cond) failed++; };

// 1. Base y esquema
const db = D.createDb('test-1b');
await D.initDb(db);
check('esquema 2 con 9 tablas', db.verno === 2 && db.tables.map((t) => t.name).sort().join() === 'anthropometry,auditLog,local,meta,playerAliases,playerPositions,players,positions,settings');
check('meta.createdAt y auditoría inicial', !!(await db.meta.get('createdAt')) && (await db.auditLog.count()) === 1);
check('la copia excluye la tabla local', B.backupTableNames(db).join() === 'anthropometry,auditLog,meta,playerAliases,playerPositions,players,positions,settings');

await D.setSetting(db, 'backupReminderDays', 14);
await D.setLocal(db, 'lastBackup', { at: 'x' });
const snap = await B.buildBackup(db, D.APP_VERSION);
check('copia: recuentos y checksum', snap.counts.settings === 1 && snap.counts.auditLog === 2 && !('local' in snap.tables) && snap.checksum.length === 64, JSON.stringify(snap.counts));

// 2. Codificación en los cuatro modos + validación
for (const [gzip, pw] of [[false, ''], [true, ''], [false, 'clave-segura-1'], [true, 'clave-segura-1']]) {
  const { blob } = await B.encodeBackup(snap, { gzip, password: pw });
  const { inner, encrypted, compression } = await B.decodeBackupObject(B.parseBackupText(await blob.text()), pw);
  const v = await B.validateBackup(db, inner);
  check(`codificar/decodificar gzip=${gzip} cifrada=${!!pw}`, v.ok && encrypted === !!pw && compression === (gzip ? 'gzip' : 'none'), `(${blob.size} bytes)`);
}
{
  const { blob } = await B.encodeBackup(snap, { gzip: true, password: 'clave-segura-1' });
  const obj = B.parseBackupText(await blob.text());
  let c1, c2;
  try { await B.decodeBackupObject(obj, ''); } catch (e) { c1 = e.code; }
  try { await B.decodeBackupObject(obj, 'otra'); } catch (e) { c2 = e.code; }
  check('contraseña ausente/errónea', c1 === 'PASSWORD_REQUIRED' && c2 === 'BAD_PASSWORD');
}

// 3. Rechazos de validación
{
  const t = structuredClone(snap); t.tables.settings[0].value = 99;
  check('alteración detectada', (await B.validateBackup(db, t)).errors.some((e) => e.includes('suma de verificación')));
  const n = structuredClone(snap); n.schemaVersion = 7;
  check('esquema posterior rechazado', (await B.validateBackup(db, n)).errors.some((e) => e.includes('posterior')));
  const u = structuredClone(snap); u.tables.extra = []; u.counts.extra = 0;
  check('tabla desconocida rechazada', (await B.validateBackup(db, u)).errors.some((e) => e.includes('desconocida')));
  const f = structuredClone(snap); f.formatId = 'otra-cosa';
  check('formato ajeno rechazado', !(await B.validateBackup(db, f)).ok);
  const m = structuredClone(snap); delete m.tables.meta; delete m.counts.meta;
  check('falta una tabla (misma versión) rechazada', (await B.validateBackup(db, m)).errors.some((e) => e.includes('Falta la tabla')));
  check('entrada no válida rechazada', !(await B.validateBackup(db, null)).ok && !(await B.validateBackup(db, { formatId: B.FORMAT_ID })).ok);
}

// 4. Restauración: revierte cambios, conserva lo local y deja constancia
{
  await D.setSetting(db, 'backupReminderDays', 30);
  await D.setSetting(db, 'otroAjuste', true);
  check('antes de restaurar hay 2 ajustes', (await db.settings.count()) === 2);
  const v = await B.validateBackup(db, snap);
  const r = await B.restoreBackup(db, snap);
  check('tras restaurar: 1 ajuste con el valor de la copia', (await db.settings.count()) === 1 && (await D.getSetting(db, 'backupReminderDays')) === 14, JSON.stringify(r.before));
  check('lo local no se toca', (await D.getLocal(db, 'lastBackup')).at === 'x');
  const last = (await db.auditLog.orderBy('id').last());
  check('auditoría registra la restauración', last.action === 'copia-restaurada' && last.scope.fechaCopia === snap.createdAt && v.ok);
  const again = await B.buildBackup(db, D.APP_VERSION);
  const sameTables = (await B.checksumTables({ meta: snap.tables.meta, settings: snap.tables.settings })) === (await B.checksumTables({ meta: again.tables.meta, settings: again.tables.settings }));
  check('ajustes y meta idénticos a la copia', sameTables);
}

// 5. Atomicidad
{
  const before = await B.checksumTables(await B.readSnapshot(db));
  const bad = structuredClone(snap);
  bad.tables.settings.push({ sinClave: true }); // sin keyPath → error
  bad.counts.settings += 1;
  let threw = false;
  try { await B.restoreBackup(db, bad); } catch { threw = true; }
  const after = await B.checksumTables(await B.readSnapshot(db));
  check('restauración inválida lanza error y deja los datos intactos', threw && before === after);
}

// 6. Copia de versión anterior en una base de esquema posterior (migración aditiva) y copia posterior rechazada
{
  const old = new Dexie('test-1b-old');
  old.version(1).stores({ settings: 'key', auditLog: '++id, timestamp, action', meta: 'key', local: 'key' });
  await old.open();
  await old.settings.put({ key: 'backupReminderDays', value: 14, definedByUser: true });
  const oldSnap = await B.buildBackup(old, '1b-0.1.1');
  check('copia del esquema 1 no incluye las tablas nuevas', oldSnap.schemaVersion === 1 && B.backupTableNames(old).join() === 'auditLog,meta,settings');
  const v = await B.validateBackup(db, oldSnap);
  check('copia v1 válida en base v2 con un aviso por tabla ausente', v.ok && v.warnings.length === 5 && v.warnings.some((w) => w.includes('players')), `${v.warnings.length} avisos`);
  await D.setSetting(db, 'otroAjuste', true);
  await B.restoreBackup(db, oldSnap);
  check('restaurar copia v1 en v2: recupera lo antiguo y deja vacías las nuevas', (await db.settings.count()) === 1 && (await D.getSetting(db, 'backupReminderDays')) === 14 && (await db.players.count()) === 0);
  const db3 = new Dexie('test-1b-v3');
  db3.version(1).stores({ settings: 'key', auditLog: '++id, timestamp, action', meta: 'key', local: 'key' });
  db3.version(2).stores({ players: '++id, jerseyName, synthetic', playerAliases: '++id, playerId, source, normalizedKey, synthetic', positions: '++id, name, order, synthetic', playerPositions: '++id, playerId, positionId, validFrom, synthetic', anthropometry: '++id, playerId, date, synthetic' });
  db3.version(3).stores({ extra: '++id' });
  await db3.open();
  const snap3 = await B.buildBackup(db3, 'futura');
  check('copia de un esquema posterior (3) rechazada por la base actual (2)', (await B.validateBackup(db, snap3)).errors.some((e) => e.includes('posterior')));
  old.close(); db3.close();
}

// 7. Volumen
{
  const rows = Array.from({ length: 5000 }, (_, i) => ({ timestamp: new Date(2026, 0, 1, 0, 0, i).toISOString(), action: 'prueba', scope: { n: i }, reason: '' }));
  await db.auditLog.bulkAdd(rows);
  const big = await B.buildBackup(db, D.APP_VERSION);
  const { blob } = await B.encodeBackup(big, { gzip: true, password: 'clave-segura-1' });
  const { inner } = await B.decodeBackupObject(B.parseBackupText(await blob.text()), 'clave-segura-1');
  check('5.000 filas: ida y vuelta válida', (await B.validateBackup(db, inner)).ok && inner.counts.auditLog === big.counts.auditLog);
}

console.log(failed ? `\n${failed} PRUEBA(S) FALLIDA(S)` : '\nTodas las pruebas pasan');
process.exit(failed ? 1 : 0);
