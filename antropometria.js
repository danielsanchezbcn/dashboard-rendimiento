// antropometria.js — mediciones fechadas (cada medición es un registro; no se sustituye un valor único).
// Las unidades no se inventan: cada valor lleva la unidad que indique el usuario.
// Para métricas relativas se usa la medición más próxima a la fecha del test dentro de una ventana configurable;
// no hay valor por defecto de la ventana.

import { audit } from './db.js';
import { syntheticFields } from './jugadores.js';
import { isIsoDay, daysBetween, todayIso } from './fechas.js';

export const METRICS = [
  { key: 'bodyMass', label: 'Masa corporal' },
  { key: 'height', label: 'Altura' },
  { key: 'legLength', label: 'Longitud de extremidad inferior' },
];

// Devuelve la lista de errores de un registro.
export function validateAnthropometry(rec, today = todayIso()) {
  const errors = [];
  if (!isIsoDay(rec.date)) errors.push('La fecha de medición no es válida.');
  else if (rec.date > today) errors.push('La fecha de medición no puede ser futura.');
  let any = false;
  for (const m of METRICS) {
    const v = rec[m.key];
    if (v == null) continue;
    any = true;
    if (typeof v.value !== 'number' || !Number.isFinite(v.value) || v.value <= 0) errors.push(`${m.label}: el valor debe ser un número mayor que 0.`);
    if (!String(v.unit ?? '').trim()) errors.push(`${m.label}: indica la unidad.`);
  }
  if (!any) errors.push('Introduce al menos una medida (masa corporal, altura o longitud de extremidad inferior).');
  return errors;
}

function normalize(rec) {
  const out = { playerId: rec.playerId, date: rec.date, source: String(rec.source ?? '').trim(), notes: String(rec.notes ?? '').trim() };
  for (const m of METRICS) out[m.key] = rec[m.key] ? { value: rec[m.key].value, unit: String(rec[m.key].unit).trim() } : null;
  return out;
}

export async function addAnthropometry(db, rec, opts) {
  if (!(await db.players.get(rec.playerId))) throw new Error('El jugador no existe.');
  const errors = validateAnthropometry(rec);
  if (errors.length) throw new Error(errors.join(' '));
  const id = await db.anthropometry.add({ ...normalize(rec), ...syntheticFields(opts) });
  await audit(db, 'antropometria-anadida', { jugadorId: rec.playerId, registroId: id, fecha: rec.date });
  return id;
}

export async function updateAnthropometry(db, id, rec) {
  const old = await db.anthropometry.get(id);
  if (!old) throw new Error('El registro no existe.');
  const next = { ...old, ...normalize({ ...rec, playerId: old.playerId }) };
  const errors = validateAnthropometry(next);
  if (errors.length) throw new Error(errors.join(' '));
  await db.anthropometry.put(next);
  await audit(db, 'antropometria-modificada', { jugadorId: old.playerId, registroId: id });
}

export async function deleteAnthropometry(db, id) {
  const old = await db.anthropometry.get(id);
  if (!old) throw new Error('El registro no existe.');
  await db.anthropometry.delete(id);
  await audit(db, 'antropometria-eliminada', { jugadorId: old.playerId, registroId: id });
}

export const playerAnthropometry = async (db, playerId) => (await db.anthropometry.where('playerId').equals(playerId).toArray()).sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);

// Medición más próxima a una fecha para una métrica, dentro de una ventana en días.
// Nunca usa «la última medición aunque sea antigua»: fuera de la ventana devuelve «no disponible» con el motivo.
export function nearestAnthropometry(records, metric, date, windowDays) {
  if (!Number.isInteger(windowDays) || windowDays < 0) return { status: 'no-disponible', motivo: 'La ventana antropométrica no está definida.' };
  const candidates = records.filter((r) => r[metric] != null).map((r) => ({ record: r, days: Math.abs(daysBetween(r.date, date)) }));
  if (!candidates.length) return { status: 'no-disponible', motivo: 'No hay mediciones de esa métrica.' };
  const min = Math.min(...candidates.map((c) => c.days));
  const best = candidates.filter((c) => c.days === min);
  if (min > windowDays) return { status: 'no-disponible', motivo: `La medición más próxima está a ${min} días, fuera de la ventana de ${windowDays}.` };
  if (best.length > 1) return { status: 'ambiguo', motivo: 'Hay varias mediciones a la misma distancia: hace falta elegir una.', candidates: best.map((c) => c.record) };
  return { status: 'ok', record: best[0].record, dias: min };
}
