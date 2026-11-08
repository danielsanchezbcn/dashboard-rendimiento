// targets.js — fase 6g (D15, decidida el 7/11/2026: «A + valor por defecto por posición»).
// Un target es un valor objetivo definido por el usuario para una variable: individual (jugador + variable) o por defecto de una posición
// (posición + variable). El individual manda sobre el de la posición (confirmado el 7/11). En variables izquierda/derecha el target es UN solo valor
// para los dos lados (confirmado el 7/11): se guarda igual en L y R. Valores {L,R,S} como las sesiones.
// Sin color: solo «alcanzado / distancia». La dirección es la de la variable (higher / lower); con otra dirección no se evalúa.
import { audit } from './db.js';

const SIDE_KEYS = ['L', 'R', 'S'];
const num = (x) => (x === '' || x === null || x === undefined ? null : Number(x));

export function cleanValues(values, sides) {
  const keys = sides === 'LR' ? ['L', 'R'] : ['S'];
  const out = {};
  for (const k of SIDE_KEYS) {
    const n = num(values?.[k]);
    if (n === null) continue;
    if (!keys.includes(k)) throw new Error('El target incluye un lado que esta variable no tiene.');
    if (!Number.isFinite(n)) throw new Error('El valor del target debe ser un número.');
    out[k] = n;
  }
  if (!Object.keys(out).length) throw new Error('Indica al menos un valor de target.');
  if (sides === 'LR') {
    if (out.L !== undefined && out.R !== undefined && out.L !== out.R) throw new Error('El target es el mismo para el lado izquierdo y el derecho.');
    const v = out.L ?? out.R; return { L: v, R: v };
  }
  return out;
}

export const listTargets = (db) => db.targets.toArray();

export async function setTarget(db, { scope, playerId = null, positionId = null, variableId, values, note = '', source = '' }) {
  if (scope !== 'player' && scope !== 'position') throw new Error('Ámbito de target no válido.');
  const variable = await db.variables.get(variableId);
  if (!variable) throw new Error('La variable no existe.');
  const owner = scope === 'player' ? await db.players.get(playerId) : await db.positions.get(positionId);
  if (!owner) throw new Error(scope === 'player' ? 'El jugador no existe.' : 'La posición no existe.');
  const clean = cleanValues(values, variable.sides);
  const all = await db.targets.where('variableId').equals(variableId).toArray();
  const prev = all.find((t) => t.scope === scope && (scope === 'player' ? t.playerId === playerId : t.positionId === positionId));
  const now = new Date().toISOString();
  const row = { scope, playerId: scope === 'player' ? playerId : null, positionId: scope === 'position' ? positionId : null, variableId, values: clean, note: String(note ?? '').trim(), source: String(source ?? '').trim(), updatedAt: now, ...(owner.synthetic ? { synthetic: 1 } : {}) };
  if (prev) { await db.targets.put({ ...prev, ...row, id: prev.id, definedAt: prev.definedAt ?? now }); await audit(db, 'target-modificado', { ambito: scope, variableId }); return prev.id; }
  const id = await db.targets.add({ ...row, definedAt: now });
  await audit(db, 'target-creado', { ambito: scope, variableId });
  return id;
}

export async function deleteTarget(db, id) {
  const t = await db.targets.get(id);
  if (!t) throw new Error('El target no existe.');
  await db.targets.delete(id);
  await audit(db, 'target-eliminado', { ambito: t.scope, variableId: t.variableId });
}

// Target aplicable a un jugador, variable y lado: el individual si tiene ese lado, si no el de su posición principal.
export function resolveTarget(targets, { playerId, positionId, variableId, side }) {
  const mine = targets.find((t) => t.scope === 'player' && t.playerId === playerId && t.variableId === variableId && t.values?.[side] !== undefined);
  if (mine) return { value: mine.values[side], origin: 'individual', note: mine.note, source: mine.source };
  const pos = positionId == null ? null : targets.find((t) => t.scope === 'position' && t.positionId === positionId && t.variableId === variableId && t.values?.[side] !== undefined);
  return pos ? { value: pos.values[side], origin: 'posición', note: pos.note, source: pos.source } : null;
}

// Distancia de un valor a su target. reached: higher → valor ≥ target; lower → valor ≤ target. diff = valor − target (en unidades).
export function distanceToTarget(value, target, direction) {
  if (!Number.isFinite(value) || !Number.isFinite(target)) return null;
  const diff = value - target;
  const pct = target !== 0 ? (diff / Math.abs(target)) * 100 : null;
  if (direction !== 'higher' && direction !== 'lower') return { diff, pct, reached: null };
  return { diff, pct, reached: direction === 'higher' ? value >= target : value <= target };
}
