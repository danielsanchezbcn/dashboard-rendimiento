// posiciones.js — lista de posiciones definida por el usuario (orden configurable, D9) e historial de posiciones
// de cada jugador con fechas de vigencia. Regla D11: cada sesión se compara según la posición PRINCIPAL registrada
// para el jugador en la fecha de la sesión; las secundarias no incluyen al jugador en varios grupos.

import { audit } from './db.js';
import { normalizeName, syntheticFields } from './jugadores.js';
import { isIsoDay, addDays } from './fechas.js';

export const ROLES = ['principal', 'secundaria'];

// ---------- Lista de posiciones ----------

export async function listPositions(db) {
  const all = await db.positions.toArray();
  return all.sort((a, b) => a.order - b.order || a.id - b.id);
}

const cleanName = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();

async function assertNameFree(db, name, excludeId) {
  const { key } = normalizeName(name);
  const all = await db.positions.toArray();
  if (all.some((p) => p.id !== excludeId && normalizeName(p.name).key === key)) throw new Error('Ya existe una posición con ese nombre.');
}

// Las posiciones nuevas se añaden al final; el orden lo configura el usuario (no hay orden definitivo).
export async function createPosition(db, { name }, opts) {
  const n = cleanName(name);
  if (!n) throw new Error('El nombre de la posición es obligatorio.');
  await assertNameFree(db, n);
  const all = await db.positions.toArray();
  const order = all.length ? Math.max(...all.map((p) => p.order)) + 1 : 1;
  const id = await db.positions.add({ name: n, order, active: true, ...syntheticFields(opts) });
  await audit(db, 'posicion-creada', { posicionId: id });
  return id;
}

export async function renamePosition(db, id, name) {
  const n = cleanName(name);
  if (!n) throw new Error('El nombre de la posición es obligatorio.');
  if (!(await db.positions.get(id))) throw new Error('La posición no existe.');
  await assertNameFree(db, n, id);
  await db.positions.update(id, { name: n });
  await audit(db, 'posicion-renombrada', { posicionId: id });
}

export async function setPositionActive(db, id, active) {
  if (!(await db.positions.get(id))) throw new Error('La posición no existe.');
  await db.positions.update(id, { active: !!active });
  await audit(db, active ? 'posicion-activada' : 'posicion-archivada', { posicionId: id });
}

export async function movePosition(db, id, direction) {
  const list = await listPositions(db);
  const i = list.findIndex((p) => p.id === id);
  if (i < 0) throw new Error('La posición no existe.');
  const j = direction === 'up' ? i - 1 : i + 1;
  if (j < 0 || j >= list.length) return false;
  // Se renumera toda la lista (1..n) para que el orden sea siempre consistente.
  const reordered = [...list];
  [reordered[i], reordered[j]] = [reordered[j], reordered[i]];
  await db.transaction('rw', db.positions, async () => {
    for (let k = 0; k < reordered.length; k++) await db.positions.update(reordered[k].id, { order: k + 1 });
  });
  await audit(db, 'posicion-reordenada', { posicionId: id, direccion: direction });
  return true;
}

export async function positionUsage(db, id) {
  return db.playerPositions.where('positionId').equals(id).count();
}

export async function deletePosition(db, id) {
  const used = await positionUsage(db, id);
  if (used > 0) throw new Error(`No se puede eliminar: la usan ${used} registros del historial de posiciones. Archívala en su lugar.`);
  if (!(await db.positions.get(id))) throw new Error('La posición no existe.');
  await db.positions.delete(id);
  await audit(db, 'posicion-eliminada', { posicionId: id });
}

// ---------- Historial de posiciones de un jugador ----------

const overlaps = (a, b) => a.validFrom <= (b.validTo ?? '9999-12-31') && b.validFrom <= (a.validTo ?? '9999-12-31');

// Devuelve la lista de errores de un registro frente a los demás del mismo jugador.
export function validateHistoryRecord(rec, others) {
  const errors = [];
  if (!ROLES.includes(rec.role)) errors.push('El tipo de posición no es válido.');
  if (!isIsoDay(rec.validFrom)) errors.push('La fecha de inicio no es válida.');
  if (rec.validTo != null && !isIsoDay(rec.validTo)) errors.push('La fecha de fin no es válida.');
  if (isIsoDay(rec.validFrom) && rec.validTo != null && isIsoDay(rec.validTo) && rec.validTo < rec.validFrom) errors.push('La fecha de fin es anterior a la de inicio.');
  if (errors.length) return errors;
  for (const o of others) {
    if (o.id === rec.id || !overlaps(rec, o)) continue;
    if (rec.role === 'principal' && o.role === 'principal') errors.push('Se solapa con otro registro de posición principal del jugador.');
    if (rec.role === 'secundaria' && o.role === 'secundaria' && o.positionId === rec.positionId) errors.push('Esa posición secundaria ya está registrada en esas fechas.');
  }
  return errors;
}

export const playerHistory = async (db, playerId) => (await db.playerPositions.where('playerId').equals(playerId).toArray()).sort((a, b) => a.validFrom.localeCompare(b.validFrom) || a.id - b.id);

// Posición vigente en una fecha: la principal (única) y las secundarias, que NO se usan para agrupar (D11).
export function positionOnDate(records, date) {
  const live = records.filter((r) => r.validFrom <= date && (r.validTo == null || date <= r.validTo));
  const principals = live.filter((r) => r.role === 'principal');
  return { principal: principals[0] ?? null, secundarias: live.filter((r) => r.role === 'secundaria'), solapadas: principals.length > 1 };
}

async function assertPosition(db, positionId) {
  if (!(await db.positions.get(positionId))) throw new Error('La posición no existe.');
}

async function writeRecord(db, rec, others, opts) {
  const errors = validateHistoryRecord(rec, others);
  if (errors.length) throw new Error(errors.join(' '));
  return db.playerPositions.add({ ...rec, ...syntheticFields(opts) });
}

// «Cambiar la posición principal desde una fecha»: cierra la vigente el día anterior y abre la nueva.
export async function setMainPositionFrom(db, playerId, positionId, fromDate, opts) {
  if (!isIsoDay(fromDate)) throw new Error('La fecha no es válida.');
  if (!(await db.players.get(playerId))) throw new Error('El jugador no existe.');
  await assertPosition(db, positionId);
  const history = await playerHistory(db, playerId);
  const mains = history.filter((r) => r.role === 'principal');
  if (mains.some((r) => r.validFrom >= fromDate)) throw new Error('Ya hay un registro de posición principal desde esa fecha o posterior: edítalo o elimínalo primero.');
  const covering = mains.find((r) => r.validFrom < fromDate && (r.validTo == null || r.validTo >= fromDate));
  if (covering && covering.positionId === positionId) throw new Error('Esa ya es su posición principal en esa fecha.');
  let id;
  await db.transaction('rw', db.playerPositions, db.auditLog, async () => {
    if (covering) await db.playerPositions.update(covering.id, { validTo: addDays(fromDate, -1) });
    id = await db.playerPositions.add({ playerId, positionId, role: 'principal', validFrom: fromDate, validTo: null, ...syntheticFields(opts) });
    await audit(db, 'posicion-jugador-asignada', { jugadorId: playerId, registroId: id, rol: 'principal', desde: fromDate });
  });
  return id;
}

// Termina la posición principal vigente en una fecha, dejando al jugador «sin posición» desde esa fecha.
export async function endMainPosition(db, playerId, fromDate) {
  if (!isIsoDay(fromDate)) throw new Error('La fecha no es válida.');
  const mains = (await playerHistory(db, playerId)).filter((r) => r.role === 'principal');
  const covering = mains.find((r) => r.validFrom < fromDate && (r.validTo == null || r.validTo >= fromDate));
  if (!covering) throw new Error('No hay una posición principal vigente en esa fecha que terminar (o empieza ese mismo día).');
  await db.playerPositions.update(covering.id, { validTo: addDays(fromDate, -1) });
  await audit(db, 'posicion-jugador-modificada', { jugadorId: playerId, registroId: covering.id, fin: addDays(fromDate, -1) });
}

export async function addSecondaryPosition(db, playerId, positionId, validFrom, validTo = null, opts) {
  if (!(await db.players.get(playerId))) throw new Error('El jugador no existe.');
  await assertPosition(db, positionId);
  const others = await playerHistory(db, playerId);
  const id = await writeRecord(db, { playerId, positionId, role: 'secundaria', validFrom, validTo }, others, opts);
  await audit(db, 'posicion-jugador-asignada', { jugadorId: playerId, registroId: id, rol: 'secundaria', desde: validFrom });
  return id;
}

export async function updateHistoryRecord(db, id, patch) {
  const rec = await db.playerPositions.get(id);
  if (!rec) throw new Error('El registro no existe.');
  const next = { ...rec, ...patch };
  if (patch.positionId !== undefined) await assertPosition(db, patch.positionId);
  const others = await playerHistory(db, rec.playerId);
  const errors = validateHistoryRecord(next, others);
  if (errors.length) throw new Error(errors.join(' '));
  await db.playerPositions.put(next);
  await audit(db, 'posicion-jugador-modificada', { jugadorId: rec.playerId, registroId: id });
}

export async function deleteHistoryRecord(db, id) {
  const rec = await db.playerPositions.get(id);
  if (!rec) throw new Error('El registro no existe.');
  await db.playerPositions.delete(id);
  await audit(db, 'posicion-jugador-eliminada', { jugadorId: rec.playerId, registroId: id });
}
