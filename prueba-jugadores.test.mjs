import 'fake-indexeddb/auto';
import { webcrypto } from 'node:crypto';
if (!globalThis.crypto?.subtle) globalThis.crypto = webcrypto;
import { Dexie } from './libs.js';
import * as D from './db.js';
import * as B from './backup.js';
import * as F from './fechas.js';
import * as J from './jugadores.js';
import * as P from './posiciones.js';
import * as A from './antropometria.js';
import * as S from './sinteticos.js';
import * as I from './catalogo-inicial.js';

let failed = 0;
const check = (name, cond, extra = '') => { console.log(`${cond ? 'OK  ' : 'FAIL'} ${name} ${extra}`); if (!cond) failed++; };
const rejects = async (fn) => { try { await fn(); return null; } catch (e) { return e.message; } };
let n = 0;
const fresh = async () => { const db = D.createDb('t-' + ++n); await D.initDb(db); return db; };

// ---- Fechas
check('fechas: validación y suma de días', F.isIsoDay('2026-02-28') && !F.isIsoDay('2026-02-30') && !F.isIsoDay('28/02/2026') && F.addDays('2026-03-01', -1) === '2026-02-28' && F.addDays('2026-12-31', 1) === '2027-01-01' && F.daysBetween('2026-01-01', '2026-03-01') === 59 && F.fmtDay('2026-03-05') === '05/03/2026');

// ---- Normalización de nombres
check('normalizar: mayúsculas, espacios y acentos', J.normalizeName('  JUGADOR   Sintético ').key === 'jugador sintetico' && J.compareNames('Núñez', 'nunez').sameKey);
check('normalizar: ñ por n se detecta', J.compareNames('Muñoz', 'Munoz').changesEnye === true && J.compareNames('Muñoz', 'muñoz').changesEnye === false && J.compareNames('José', 'Jose').changesEnye === false);
check('normalizar: vacío no coincide con nada', J.compareNames('', '').sameKey === false);

// ---- Jugadores y alias
{
  const db = await fresh();
  check('esquema 3 con 16 tablas', db.verno === 3 && db.tables.length === 16);
  check('jugador: nombre obligatorio', (await rejects(() => J.createPlayer(db, { jerseyName: '  ' }))) === 'El nombre en camiseta es obligatorio.');
  const a = await J.createPlayer(db, { jerseyName: ' Jugador  Uno ' });
  check('jugador: nombre limpio y activo', (await db.players.get(a)).jerseyName === 'Jugador Uno' && (await db.players.get(a)).active === true);
  check('jugador: aviso de nombre equivalente', (await J.duplicateNameWarning(db, 'jugador uno'))?.includes('Jugador Uno') && (await J.duplicateNameWarning(db, 'Otro')) === null && (await J.duplicateNameWarning(db, 'jugador uno', a)) === null);
  await J.setPlayerActive(db, a, false);
  check('jugador: desactivar no borra', (await db.players.get(a)).active === false && (await db.players.count()) === 1);
  const b = await J.createPlayer(db, { jerseyName: 'Muñoz' });
  const c = await J.createPlayer(db, { jerseyName: 'Munoz' });
  const r1 = await J.addAlias(db, a, 'VALD', 'JUAN PÉREZ GARCÍA');
  check('alias: se guarda con el texto original y la clave normalizada', (await db.playerAliases.get(r1.id)).rawText === 'JUAN PÉREZ GARCÍA' && (await db.playerAliases.get(r1.id)).normalizedKey === 'juan perez garcia');
  check('alias: fuente inválida y duplicado exacto', (await rejects(() => J.addAlias(db, a, 'Otra cosa', 'x'))) !== null && (await rejects(() => J.addAlias(db, a, 'VALD', 'JUAN PÉREZ GARCÍA')))?.includes('ya existe'));
  check('alias: el mismo texto de otro jugador se rechaza', (await rejects(() => J.addAlias(db, b, 'VALD', 'JUAN PÉREZ GARCÍA')))?.includes('otro jugador'));
  const r2 = await J.addAlias(db, b, 'VALD', 'juan perez garcia');
  check('alias: equivalente en otro jugador se acepta con aviso', r2.warnings.length === 1 && r2.warnings[0].includes('confirmación manual'));
  const r3 = await J.addAlias(db, b, 'Excel', 'JUAN PÉREZ GARCÍA');
  check('alias: misma cadena en otra fuente sí es válida', r3.warnings.length === 0);
  // candidatos
  let r = await J.findCandidates(db, 'Jugador Uno');
  check('candidatos: coincidencia exacta única no vincula sola', r.candidates.length === 1 && r.requiresManual === false && r.autoLink === false);
  r = await J.findCandidates(db, 'jugador uno');
  check('candidatos: sin acento/mayúsculas exige confirmación', r.candidates.length === 1 && r.requiresManual && r.reasons.some((x) => x.includes('no es exacta')));
  r = await J.findCandidates(db, 'muñoz');
  check('candidatos: Muñoz/Munoz → dos candidatos y manual', r.candidates.length === 2 && r.requiresManual && r.reasons.some((x) => x.includes('Más de un jugador')));
  r = await J.findCandidates(db, 'Muñoz');
  check('candidatos: ñ por n exige manual aunque sea exacto con uno', r.candidates.length === 2 && r.reasons.some((x) => x.includes('ñ por n')));
  r = await J.findCandidates(db, 'Desconocido');
  check('candidatos: sin coincidencias', r.candidates.length === 0 && r.requiresManual);
  r = await J.findCandidates(db, 'juan perez garcia', { source: 'VALD' });
  check('candidatos: por fuente y varios jugadores', r.candidates.length === 2 && r.requiresManual);
  r = await J.findCandidates(db, 'JUAN PÉREZ GARCÍA', { source: 'Excel' });
  check('candidatos: alias exacto único de otra fuente', r.candidates.length === 1 && r.candidates[0].player.id === b && r.candidates[0].matches[0].exact);
  await J.removeAlias(db, r1.id);
  check('alias: eliminar', (await db.playerAliases.get(r1.id)) === undefined);
  const audits = (await db.auditLog.toArray()).map((x) => x.action);
  check('auditoría: acciones de jugadores y alias, sin nombres', ['jugador-creado', 'jugador-desactivado', 'alias-anadido', 'alias-eliminado'].every((x) => audits.includes(x)) && !JSON.stringify(await db.auditLog.toArray()).includes('Jugador Uno') && !JSON.stringify(await db.auditLog.toArray()).includes('PÉREZ'));
}

// ---- Posiciones: lista y orden configurable (D9)
{
  const db = await fresh();
  const p1 = await P.createPosition(db, { name: 'Alfa' });
  const p2 = await P.createPosition(db, { name: 'Beta' });
  const p3 = await P.createPosition(db, { name: 'Gamma' });
  check('posiciones: se añaden al final (orden de creación)', (await P.listPositions(db)).map((x) => x.name).join() === 'Alfa,Beta,Gamma');
  check('posiciones: nombre duplicado (normalizado) rechazado', (await rejects(() => P.createPosition(db, { name: ' alfa ' })))?.includes('Ya existe'));
  await P.movePosition(db, p3, 'up'); await P.movePosition(db, p3, 'up');
  check('posiciones: el orden es configurable (subir)', (await P.listPositions(db)).map((x) => x.name).join() === 'Gamma,Alfa,Beta');
  check('posiciones: los límites no hacen nada', (await P.movePosition(db, p3, 'up')) === false);
  await P.movePosition(db, p1, 'down');
  check('posiciones: bajar', (await P.listPositions(db)).map((x) => x.name).join() === 'Gamma,Beta,Alfa' && (await P.listPositions(db)).map((x) => x.order).join() === '1,2,3');
  await P.renamePosition(db, p2, 'Beta bis');
  check('posiciones: renombrar y archivar', (await db.positions.get(p2)).name === 'Beta bis' && (await P.setPositionActive(db, p2, false), (await db.positions.get(p2)).active === false));
  const pl = await J.createPlayer(db, { jerseyName: 'X' });
  await P.setMainPositionFrom(db, pl, p1, '2026-01-01');
  check('posiciones: no se elimina una usada, sí una libre', (await rejects(() => P.deletePosition(db, p1)))?.includes('Archívala') && (await P.deletePosition(db, p3), (await db.positions.get(p3)) === undefined));
}

// ---- Historial de posiciones y posición en una fecha (D11)
{
  const db = await fresh();
  const p1 = await P.createPosition(db, { name: 'P1' }); const p2 = await P.createPosition(db, { name: 'P2' }); const p3 = await P.createPosition(db, { name: 'P3' });
  const j = await J.createPlayer(db, { jerseyName: 'J' });
  await P.setMainPositionFrom(db, j, p1, '2026-01-01');
  await P.setMainPositionFrom(db, j, p2, '2026-03-01');
  let h = await P.playerHistory(db, j);
  check('historial: el cambio cierra la anterior el día antes', h.length === 2 && h[0].validTo === '2026-02-28' && h[1].validFrom === '2026-03-01' && h[1].validTo === null);
  const on = (d) => P.positionOnDate(h, d).principal?.positionId ?? null;
  check('posición en fecha: antes, límites y después', on('2025-12-31') === null && on('2026-01-01') === p1 && on('2026-02-28') === p1 && on('2026-03-01') === p2 && on('2027-01-01') === p2);
  check('historial: misma posición y fecha anterior rechazadas', (await rejects(() => P.setMainPositionFrom(db, j, p2, '2026-04-01')))?.includes('ya es su posición') || (await rejects(() => P.setMainPositionFrom(db, j, p2, '2026-04-01')))?.includes('Esa ya es'));
  check('historial: cambio anterior a uno existente rechazado', (await rejects(() => P.setMainPositionFrom(db, j, p3, '2026-02-01')))?.includes('desde esa fecha o posterior'));
  await P.endMainPosition(db, j, '2026-06-01');
  h = await P.playerHistory(db, j);
  check('historial: terminar deja «sin posición»', on('2026-05-31') === p2 && on('2026-06-01') === null);
  await P.setMainPositionFrom(db, j, p3, '2026-09-01');
  h = await P.playerHistory(db, j);
  check('historial: hueco y nueva posición', on('2026-07-01') === null && on('2026-09-01') === p3 && h.filter((r) => r.role === 'principal').length === 3);
  // secundarias (D11): no cambian la principal ni agrupan
  const s = await P.addSecondaryPosition(db, j, p1, '2026-01-01', null);
  h = await P.playerHistory(db, j);
  const x = P.positionOnDate(h, '2026-03-15');
  check('secundarias: aparecen aparte y no alteran la principal', x.principal.positionId === p2 && x.secundarias.length === 1 && x.secundarias[0].positionId === p1);
  check('secundarias: duplicada solapada rechazada', (await rejects(() => P.addSecondaryPosition(db, j, p1, '2026-02-01', null)))?.includes('ya está registrada'));
  check('validación: solape de principales y fechas', P.validateHistoryRecord({ id: 99, role: 'principal', validFrom: '2026-01-15', validTo: null }, h).some((e) => e.includes('solapa')) && P.validateHistoryRecord({ role: 'principal', validFrom: '2026-02-01', validTo: '2026-01-01' }, []).some((e) => e.includes('anterior')) && P.validateHistoryRecord({ role: 'x', validFrom: 'mal' }, []).length >= 2);
  const first = h.find((r) => r.role === 'principal');
  await P.updateHistoryRecord(db, first.id, { validTo: '2026-02-27' });
  check('historial: editar un registro con validación', (await db.playerPositions.get(first.id)).validTo === '2026-02-27' && (await rejects(() => P.updateHistoryRecord(db, first.id, { validTo: '2026-03-15' })))?.includes('solapa'));
  await P.deleteHistoryRecord(db, s);
  check('historial: eliminar un registro', (await db.playerPositions.get(s)) === undefined);
  check('audit: sin nombres de jugador', !JSON.stringify(await db.auditLog.toArray()).includes('"J"'));
}

// ---- Antropometría fechada
{
  const db = await fresh();
  const j = await J.createPlayer(db, { jerseyName: 'J' });
  const ok = { playerId: j, date: '2026-03-01', bodyMass: { value: 78, unit: 'kg' }, source: 'manual' };
  check('antropometría: validaciones', A.validateAnthropometry({ date: '2026-03-01' }).length === 1 && A.validateAnthropometry({ ...ok, bodyMass: { value: 0, unit: 'kg' } }).length === 1 && A.validateAnthropometry({ ...ok, bodyMass: { value: 78, unit: '' } }).length === 1 && A.validateAnthropometry({ ...ok, date: '2999-01-01' }).some((e) => e.includes('futura')) && A.validateAnthropometry({ ...ok, date: '31/12/2025' }).length === 1 && A.validateAnthropometry(ok).length === 0);
  const id1 = await A.addAnthropometry(db, ok);
  const id2 = await A.addAnthropometry(db, { playerId: j, date: '2026-05-01', bodyMass: { value: 79, unit: 'kg' }, height: { value: 180, unit: 'cm' } });
  await A.addAnthropometry(db, { playerId: j, date: '2026-03-01', legLength: { value: 95, unit: 'cm' } });
  check('antropometría: cada medición es un registro (varios el mismo día)', (await db.anthropometry.count()) === 3 && (await A.playerAnthropometry(db, j))[0].date === '2026-05-01');
  const recs = await A.playerAnthropometry(db, j);
  check('más próxima: sin ventana definida no hay valor', A.nearestAnthropometry(recs, 'bodyMass', '2026-03-05', undefined).status === 'no-disponible' && A.nearestAnthropometry(recs, 'bodyMass', '2026-03-05', undefined).motivo.includes('no está definida'));
  const n1 = A.nearestAnthropometry(recs, 'bodyMass', '2026-03-05', 30);
  check('más próxima: dentro de ventana', n1.status === 'ok' && n1.record.id === id1 && n1.dias === 4);
  const n2 = A.nearestAnthropometry(recs, 'bodyMass', '2026-04-10', 10);
  check('más próxima: fuera de ventana NO usa la última medición', n2.status === 'no-disponible' && n2.motivo.includes('fuera de la ventana') && n2.motivo.includes('21 días'), n2.motivo);
  const tie = [{ id: 1, date: '2026-03-01', bodyMass: { value: 70, unit: 'kg' } }, { id: 2, date: '2026-03-05', bodyMass: { value: 72, unit: 'kg' } }];
  const nt = A.nearestAnthropometry(tie, 'bodyMass', '2026-03-03', 5);
  check('más próxima: empate a la misma distancia es ambiguo y no elige', nt.status === 'ambiguo' && nt.candidates.length === 2 && !('record' in nt));
  check('más próxima: dos mediciones el mismo día también son ambiguas', A.nearestAnthropometry([...tie, { id: 3, date: '2026-03-01', bodyMass: { value: 71, unit: 'kg' } }], 'bodyMass', '2026-03-01', 5).status === 'ambiguo');
  check('más próxima: solo cuenta registros con esa métrica', A.nearestAnthropometry(recs, 'height', '2026-03-01', 90).record.id === id2 && A.nearestAnthropometry(recs, 'legLength', '2026-03-01', 0).status === 'ok' && A.nearestAnthropometry([], 'bodyMass', '2026-03-01', 30).motivo.includes('No hay mediciones'));
  await A.updateAnthropometry(db, id1, { ...ok, bodyMass: { value: 77.5, unit: 'kg' } });
  check('antropometría: editar y eliminar', (await db.anthropometry.get(id1)).bodyMass.value === 77.5 && (await A.deleteAnthropometry(db, id2), (await db.anthropometry.get(id2)) === undefined));
}

// ---- Datos sintéticos: marcados, fixture de REQUISITOS.md y eliminación segura
{
  const db = await fresh();
  const real = await J.createPlayer(db, { jerseyName: 'Jugador real de prueba' });
  const rp = await P.createPosition(db, { name: 'Posición real' });
  await P.setMainPositionFrom(db, real, rp, '2026-01-01');
  await A.addAnthropometry(db, { playerId: real, date: '2026-03-01', bodyMass: { value: 80, unit: 'kg' } });
  const before = { players: await db.players.count(), positions: await db.positions.count() };
  const r = await S.loadSyntheticDemo(db);
  const counts = await S.countSynthetic(db);
  check('sintéticos: marcados y contados', counts.players === 12 && counts.positions === 2 && counts.playerAliases === 12 && counts.anthropometry === 36 && r.batch.startsWith('sintetico-'));
  check('sintéticos: los reales no se marcan', !(await db.players.get(real)).synthetic && (await db.players.count()) === before.players + 12);
  check('sintéticos: orden de posiciones sintéticas al final, sin reordenar las reales', (await P.listPositions(db)).map((x) => x.name).join() === 'Posición real,Posición sintética 1,Posición sintética 2');
  check('sintéticos: no se cargan dos veces', (await rejects(() => S.loadSyntheticDemo(db)))?.includes('Ya hay datos sintéticos'));
  // Conjunto de aceptación (REQUISITOS.md, sección 5)
  const byName = async (l) => (await db.players.toArray()).find((p) => p.jerseyName === `Jugador sintético ${l}`);
  const posName = async (l, date) => { const pl = await byName(l); const x = P.positionOnDate(await P.playerHistory(db, pl.id), date).principal; return x ? (await db.positions.get(x.positionId)).name : null; };
  check('fixture: A cambia de posición el 01/03', (await posName('A', '2026-02-10')) === 'Posición sintética 1' && (await posName('A', '2026-03-10')) === 'Posición sintética 2');
  check('fixture: B, C y F', (await posName('B', '2026-03-10')) === 'Posición sintética 1' && (await posName('C', '2026-03-12')) === 'Posición sintética 2' && (await posName('F', '2026-03-12')) === 'Posición sintética 1');
  check('fixture: D sin posición el 12/03 y con posición desde abril', (await posName('D', '2026-03-12')) === null && (await posName('D', '2026-04-01')) === 'Posición sintética 1');
  const cand = await J.findCandidates(db, 'jugador sintetico munoz');
  check('fixture: Muñoz/Munoz generan candidatos con confirmación manual', cand.candidates.length === 2 && cand.requiresManual);
  const cand2 = await J.findCandidates(db, 'JUGADOR SINTÉTICO A, nombre completo VALD ficticio', { source: 'VALD' });
  check('fixture: alias de VALD y del Excel apuntan al mismo jugador', cand2.candidates.length === 1 && cand2.candidates[0].player.jerseyName === 'Jugador sintético A' && (await J.findCandidates(db, 'jug. sintetico A', { source: 'Excel' })).candidates[0].player.id === cand2.candidates[0].player.id);
  // Una copia con sintéticos y su eliminación
  const bk = await B.buildBackup(db, D.APP_VERSION);
  check('copia: incluye las tablas nuevas con sus recuentos', bk.counts.players === 13 && bk.counts.anthropometry === 37 && bk.counts.positions === 3 && !('local' in bk.tables));
  // Dato real que depende de uno sintético → no se elimina
  const synthPos = (await db.positions.where('synthetic').equals(1).first()).id;
  const dep = await P.addSecondaryPosition(db, real, synthPos, '2026-01-01', null);
  check('eliminar sintéticos: se niega si un dato real los usa', (await rejects(() => S.deleteSynthetic(db)))?.includes('datos reales que dependen') && (await db.players.where('synthetic').equals(1).count()) === 12);
  await P.deleteHistoryRecord(db, dep);
  const del = await S.deleteSynthetic(db);
  check('eliminar sintéticos: solo ellos, y quedan los reales intactos', del.players === 12 && totalZero(await S.countSynthetic(db)) && (await db.players.count()) === 1 && (await db.positions.count()) === 1 && (await db.playerPositions.count()) === 1 && (await db.anthropometry.count()) === 1);
  check('eliminar sintéticos: no queda ninguno y no se puede repetir', (await rejects(() => S.deleteSynthetic(db)))?.includes('No hay datos sintéticos'));
  const la = (await db.auditLog.toArray()).filter((x) => x.action === 'datos-sinteticos-eliminados')[0];
  check('auditoría: eliminación con recuentos y sin nombres', la.scope.recuentos.players === 12 && !JSON.stringify(la).includes('Jugador'));
  // Restaurar la copia anterior recupera los sintéticos (advertencia documentada)
  await B.restoreBackup(db, bk);
  check('restaurar copia anterior recupera los sintéticos', (await S.countSynthetic(db)).players === 12 && (await db.players.count()) === 13);
}
function totalZero(c) { return Object.values(c).every((v) => v === 0); }

// ---- Migración del esquema 1 al 2 y copias del esquema 1
{
  const v1 = new Dexie('upg');
  v1.version(1).stores({ settings: 'key', auditLog: '++id, timestamp, action', meta: 'key', local: 'key' });
  await v1.open();
  await v1.settings.put({ key: 'backupReminderDays', value: 14, definedByUser: true });
  await v1.meta.put({ key: 'createdAt', value: '2026-11-01T00:00:00.000Z' });
  await v1.auditLog.add({ timestamp: 'x', action: 'base-creada', scope: {}, reason: '' });
  await v1.local.put({ key: 'lastBackup', value: { at: 'x' } });
  const oldCopy = await B.buildBackup(v1, '1b-0.1.1');
  v1.close();
  const db = D.createDb('upg');
  await D.initDb(db);
  check('migración 1→3: se conservan los datos y aparecen tablas vacías', db.verno === 3 && (await D.getSetting(db, 'backupReminderDays')) === 14 && (await db.auditLog.count()) === 1 && (await D.getLocal(db, 'lastBackup')).at === 'x' && (await db.players.count()) === 0);
  const v = await B.validateBackup(db, oldCopy);
  check('copia del esquema 1 en base del esquema 3: válida con un aviso por tabla nueva', v.ok && v.warnings.length === 12 && v.warnings.every((w) => w.includes('versión anterior')));
  const j = await J.createPlayer(db, { jerseyName: 'Se perderá al restaurar' });
  await B.restoreBackup(db, oldCopy);
  check('restaurar copia del esquema 1: tablas nuevas vacías y datos antiguos recuperados', (await db.players.count()) === 0 && (await D.getSetting(db, 'backupReminderDays')) === 14 && j > 0);
  const newCopy = await B.buildBackup(db, D.APP_VERSION);
  const v1again = D.createDb('upg-v1only');
  check('copia del esquema 3 contiene schemaVersion 3', newCopy.schemaVersion === 3 && v1again.verno === 3);
}

// ---- Volumen realista (4 temporadas: ~55 jugadores) y copia/restauración con todas las tablas
{
  const db = await fresh();
  const pos = []; for (let i = 0; i < 5; i++) pos.push(await P.createPosition(db, { name: 'Pos ' + i }));
  const t0 = performance.now();
  const ids = [];
  for (let i = 0; i < 55; i++) {
    const id = await J.createPlayer(db, { jerseyName: 'Jugador ' + i });
    ids.push(id);
    await J.addAlias(db, id, 'VALD', 'Nombre completo VALD ' + i);
    await J.addAlias(db, id, 'Excel', 'Nombre Excel ' + i);
    await P.setMainPositionFrom(db, id, pos[i % 5], '2023-07-01');
    await P.setMainPositionFrom(db, id, pos[(i + 1) % 5], '2025-07-01');
    for (const d of ['2023-09-01', '2024-09-01', '2025-09-01', '2026-02-01']) await A.addAnthropometry(db, { playerId: id, date: d, bodyMass: { value: 70 + (i % 20), unit: 'kg' }, height: { value: 170 + (i % 25), unit: 'cm' }, legLength: { value: 85 + (i % 15), unit: 'cm' } });
  }
  await I.seedInitialCatalog(db);
  const t1 = performance.now();
  const bk = await B.buildBackup(db, D.APP_VERSION);
  const { blob } = await B.encodeBackup(bk, { gzip: true, password: 'clave-segura-1' });
  const { inner } = await B.decodeBackupObject(B.parseBackupText(await blob.text()), 'clave-segura-1');
  const v = await B.validateBackup(db, inner);
  const t2 = performance.now();
  await B.restoreBackup(db, inner);
  const t3 = performance.now();
  console.log(`INFO 55 jugadores, ${bk.counts.playerPositions} registros de posición, ${bk.counts.anthropometry} mediciones: crear ${Math.round(t1 - t0)} ms · copia cifrada y validada ${Math.round(t2 - t1)} ms (${(blob.size / 1024).toFixed(0)} KB) · restaurar ${Math.round(t3 - t2)} ms (IndexedDB simulada, no es el navegador)`);
  const after = await B.readSnapshot(db);
  const same = Object.keys(inner.tables).filter((t) => t !== 'auditLog').every((t) => JSON.stringify(after[t]) === JSON.stringify(inner.tables[t]));
  check('volumen: copia válida y restauración idéntica en todas las tablas de datos', v.ok && same && bk.counts.players === 55 && bk.counts.anthropometry === 220);
}

console.log(failed ? `\n${failed} PRUEBA(S) FALLIDA(S)` : '\nTodas las pruebas de jugadores, posiciones, antropometría y sintéticos pasan');
process.exit(failed ? 1 : 0);
