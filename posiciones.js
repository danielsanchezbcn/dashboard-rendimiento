// posiciones.js — lista de posiciones definida por el usuario (orden configurable, D9) e historial de posiciones
// de cada jugador con fechas de vigencia. Regla D11: cada sesión se compara según la posición PRINCIPAL registrada
// para el jugador en la fecha de la sesión; las secundarias no incluyen al jugador en varios grupos.

import { audit } from './db.js';
import { normalizeName, syntheticFields } from './jugadores.js';

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
  const tg = await db.targets.where('positionId').equals(id).primaryKeys();
  if (tg.length) await db.targets.bulkDelete(tg);
  await db.positions.delete(id);
  await audit(db, 'posicion-eliminada', { posicionId: id });
}

// ---------- Posición de un jugador (sin fechas: decisión del 7/11/2026) ----------
// Cada jugador tiene UNA posición principal (opcional) y, si se quiere, posiciones secundarias. Cambiarla se aplica a todo
// el histórico. Los registros conservan los campos validFrom/validTo (siempre null) por compatibilidad con copias antiguas.

export const playerHistory = async (db, playerId) => (await db.playerPositions.where('playerId').equals(playerId).toArray()).sort((a, b) => a.id - b.id);

// Posición del jugador. El segundo parámetro (fecha) se ignora: se mantiene solo para no romper llamadas antiguas.
export function positionOnDate(records, _date) {
  const principals = records.filter((r) => r.role === 'principal');
  return { principal: principals[0] ?? null, secundarias: records.filter((r) => r.role === 'secundaria'), solapadas: principals.length > 1 };
}

async function assertPosition(db, positionId) {
  if (!(await db.positions.get(positionId))) throw new Error('La posición no existe.');
}

// Fija la posición principal. Si ya tenía una, la sustituye: el cambio vale para todo el histórico.
export async function setMainPosition(db, playerId, positionId, opts) {
  if (!(await db.players.get(playerId))) throw new Error('El jugador no existe.');
  await assertPosition(db, positionId);
  const main = (await playerHistory(db, playerId)).find((r) => r.role === 'principal');
  if (main && main.positionId === positionId) throw new Error('Esa ya es su posición principal.');
  let id;
  await db.transaction('rw', db.playerPositions, db.auditLog, async () => {
    if (main) { await db.playerPositions.update(main.id, { positionId }); id = main.id; }
    else id = await db.playerPositions.add({ playerId, positionId, role: 'principal', validFrom: null, validTo: null, ...syntheticFields(opts) });
    await audit(db, main ? 'posicion-jugador-modificada' : 'posicion-jugador-asignada', { jugadorId: playerId, registroId: id, rol: 'principal' });
  });
  return id;
}

// Deja al jugador «sin posición» (en todo el histórico).
export async function clearMainPosition(db, playerId) {
  const main = (await playerHistory(db, playerId)).find((r) => r.role === 'principal');
  if (!main) throw new Error('El jugador no tiene posición principal.');
  await db.playerPositions.delete(main.id);
  await audit(db, 'posicion-jugador-eliminada', { jugadorId: playerId, registroId: main.id, rol: 'principal' });
}

export async function addSecondaryPosition(db, playerId, positionId, opts) {
  if (!(await db.players.get(playerId))) throw new Error('El jugador no existe.');
  await assertPosition(db, positionId);
  if ((await playerHistory(db, playerId)).some((r) => r.role === 'secundaria' && r.positionId === positionId)) throw new Error('Esa posición secundaria ya está registrada.');
  const id = await db.playerPositions.add({ playerId, positionId, role: 'secundaria', validFrom: null, validTo: null, ...syntheticFields(opts) });
  await audit(db, 'posicion-jugador-asignada', { jugadorId: playerId, registroId: id, rol: 'secundaria' });
  return id;
}

export async function deleteHistoryRecord(db, id) {
  const rec = await db.playerPositions.get(id);
  if (!rec) throw new Error('El registro no existe.');
  await db.playerPositions.delete(id);
  await audit(db, 'posicion-jugador-eliminada', { jugadorId: rec.playerId, registroId: id });
}

// Migración idempotente del modelo con fechas al modelo sin fechas: por jugador se conserva UNA principal (la vigente, sin
// fecha de fin; si no hay, la de inicio más reciente), se quitan fechas y se eliminan duplicados. Solo audita recuentos.
export async function collapsePositions(db) {
  const all = await db.playerPositions.toArray();
  const byPlayer = new Map();
  for (const r of all) (byPlayer.get(r.playerId) ?? byPlayer.set(r.playerId, []).get(r.playerId)).push(r);
  const del = [], upd = [];
  for (const recs of byPlayer.values()) {
    const mains = recs.filter((r) => r.role === 'principal').sort((a, b) => ((a.validTo == null ? 1 : 0) - (b.validTo == null ? 1 : 0)) || String(a.validFrom ?? '').localeCompare(String(b.validFrom ?? '')) || a.id - b.id);
    const keep = mains.at(-1);
    for (const m of mains) if (m !== keep) del.push(m.id);
    const seen = new Set();
    for (const r of recs.filter((x) => x.role === 'secundaria').sort((a, b) => a.id - b.id)) { if (seen.has(r.positionId)) del.push(r.id); else seen.add(r.positionId); }
    for (const r of recs) if (!del.includes(r.id) && (r.validFrom != null || r.validTo != null)) upd.push(r.id);
  }
  if (!del.length && !upd.length) return { eliminados: 0, actualizados: 0 };
  await db.transaction('rw', db.playerPositions, db.auditLog, async () => {
    await db.playerPositions.bulkDelete(del);
    for (const id of upd) await db.playerPositions.update(id, { validFrom: null, validTo: null });
    await audit(db, 'posiciones-sin-fechas', { registrosEliminados: del.length, registrosActualizados: upd.length });
  });
  return { eliminados: del.length, actualizados: upd.length };
}
