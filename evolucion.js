// evolucion.js — lógica de la fase 5a: serie por sesión, Personal Best, Personal Average y asimetría de un jugador (sin interfaz).
// Reglas: D12a (Personal Average ponderado por repeticiones), D12b (Personal Best según la dirección de la variable),
// D22 (empate en el mejor Average: la más reciente), D23 (rango objetivo: Personal Best «no definido»), D25 (signo de la asimetría).
// Una sesión guarda la media de sus repeticiones (D8): no hay repeticiones sueltas, por lo que no existe «Máxima repetición» en los datos.
// Las sesiones excluidas NO cuentan en ninguna estadística; se listan aparte y se pueden reincorporar.

import { nameMatchesPlayer } from './jugadores.js';
import { asymmetryPct } from './catalogo.js';
import { audit } from './db.js';
import { isIsoDay } from './fechas.js';

const SIDE_KEY = { L: 'L', R: 'R', S: 'S' };

export const repsOf = (session, side) => {
  const r = session.reps ?? {};
  const n = side === 'S' ? r.total : r[side];
  return Number.isFinite(n) && n > 0 ? n : null;
};

const valueOf = (session, variableId, side) => {
  const x = session.values?.[variableId]?.[SIDE_KEY[side]];
  return Number.isFinite(x) ? x : null;
};

// Puntos de un jugador para una variable y un lado, ordenados por fecha y hora. Filtra por test (ya implícito), protocolo y fechas.
export function buildSeries(sessions, variableId, side, { from = null, to = null, protocolId = undefined } = {}) {
  const valid = [], excluded = [];
  for (const s of sessions) {
    if (protocolId !== undefined && (s.protocolId ?? null) !== protocolId) continue;
    if (from && s.date < from) continue;
    if (to && s.date > to) continue;
    const value = valueOf(s, variableId, side);
    if (value === null) continue;
    const p = { sessionId: s.id, date: s.date, time: s.time || '', value, reps: repsOf(s, side), status: s.status, excludedReason: s.excludedReason ?? '', source: s.source ?? '', merged: Array.isArray(s.mergedRows) ? s.mergedRows.length : 0 };
    (s.status === 'excluded' ? excluded : valid).push(p);
  }
  const byTime = (a, b) => (a.date + a.time).localeCompare(b.date + b.time) || a.sessionId - b.sessionId;
  valid.sort(byTime); excluded.sort(byTime);
  return { valid, excluded };
}

// Personal Average (D12a): media de los Average de sesión ponderada por Reps. Si falta Reps en alguna sesión, esa pesa 1 y se avisa.
export function personalAverage(points) {
  if (!points.length) return { defined: false, reason: 'No hay sesiones válidas en el periodo.' };
  const missing = points.some((p) => p.reps === null);
  const w = (p) => p.reps ?? 1;
  const total = points.reduce((a, p) => a + w(p), 0);
  const value = points.reduce((a, p) => a + p.value * w(p), 0) / total;
  return { defined: true, value, sessions: points.length, reps: missing ? null : total, weightedByReps: !missing, from: points[0].date, to: points[points.length - 1].date };
}

// Personal Best (D12b, D22, D23).
export function personalBest(points, direction) {
  if (!points.length) return { defined: false, reason: 'No hay sesiones válidas en el periodo.' };
  if (direction !== 'higher' && direction !== 'lower') {
    return { defined: false, reason: direction === 'target' ? 'Variable con rango objetivo: el Personal Best no se define (D23).' : 'La variable no tiene dirección de interpretación (más alto o más bajo es mejor): defínela en el catálogo.' };
  }
  const better = (a, b) => (direction === 'higher' ? a > b : a < b);
  let best = points[0];
  for (const p of points) {
    if (better(p.value, best.value)) best = p;
    else if (p.value === best.value) best = p; // empate: la más reciente (D22); los puntos van ordenados por fecha y hora
  }
  const ties = points.filter((p) => p.value === best.value);
  const sameDayTie = ties.filter((p) => p.date === best.date).length > 1;
  return { defined: true, value: best.value, date: best.date, sessionId: best.sessionId, reps: best.reps, tied: ties.length > 1, sameDayTie };
}

export const currentResult = (points) => (points.length ? points[points.length - 1] : null);

// G5: asimetría por sesión (D25: (R − L) / máx × 100, positivo = domina la derecha). Solo sesiones con ambos lados.
// «diff»: variables en grados (ángulos): asimetría = derecha − izquierda en la propia unidad (como en el Excel del usuario); admite valores negativos. Si no, porcentaje (D25).
export function asymmetrySeries(sessions, variableId, { from = null, to = null, protocolId = undefined, diff = false } = {}) {
  const out = [];
  for (const s of sessions) {
    if (s.status === 'excluded') continue;
    if (protocolId !== undefined && (s.protocolId ?? null) !== protocolId) continue;
    if (from && s.date < from) continue;
    if (to && s.date > to) continue;
    const l = valueOf(s, variableId, 'L'), r = valueOf(s, variableId, 'R');
    if (l === null || r === null) continue;
    const pct = diff ? r - l : asymmetryPct(l, r);
    if (pct === null) continue;
    out.push({ sessionId: s.id, date: s.date, time: s.time || '', left: l, right: r, pct, repsL: repsOf(s, 'L'), repsR: repsOf(s, 'R') });
  }
  return out.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time) || a.sessionId - b.sessionId);
}

// Exclusión reversible: no toca los valores. El motivo es opcional pero se guarda; el registro de auditoría no lleva valores.
export async function setSessionExcluded(db, sessionId, excluded, reason = '') {
  const s = await db.sessions.get(sessionId);
  if (!s) throw new Error('La sesión no existe.');
  await db.sessions.update(sessionId, { status: excluded ? 'excluded' : 'valid', excludedReason: excluded ? String(reason ?? '').trim() : '' });
  await audit(db, excluded ? 'sesion-excluida' : 'sesion-reincorporada', { sessionId, playerId: s.playerId, testId: s.testId, date: s.date });
}

// Eliminación definitiva de UNA sesión: exige escribir el nombre del jugador y la fecha exactamente (alcance visible). No toca otras sesiones.
export async function deleteSessionPermanently(db, sessionId, { playerName, date }) {
  const s = await db.sessions.get(sessionId);
  if (!s) throw new Error('La sesión no existe.');
  const p = await db.players.get(s.playerId);
  if (!p || !nameMatchesPlayer(p, playerName) || String(date ?? '').trim() !== s.date) throw new Error('La confirmación no coincide con el jugador y la fecha de la sesión.');
  await db.sessions.delete(sessionId);
  await audit(db, 'sesion-eliminada', { sessionId, playerId: s.playerId, testId: s.testId, date: s.date });
}

// Corrección de una sesión ya guardada (fecha, hora, valores de las variables indicadas y repeticiones). Sustituye lo anterior en esa misma fila:
// no crea otra sesión. Rechaza valores no numéricos, fechas inválidas y colisiones con otra sesión del mismo jugador, test, protocolo, fecha y hora.
// La auditoría guarda solo QUÉ campos cambian (fecha, hora, variable, repeticiones), nunca los valores.
export async function correctSession(db, sessionId, { date, time, values, reps } = {}) {
  const s = await db.sessions.get(sessionId);
  if (!s) throw new Error('La sesión no existe.');
  const patch = {}; const changed = [];
  const newDate = date === undefined ? s.date : String(date).trim();
  const newTime = time === undefined ? (s.time ?? '') : String(time ?? '').trim();
  if (!isIsoDay(newDate)) throw new Error('La fecha no es válida (AAAA-MM-DD).');
  if (newTime && !/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(newTime)) throw new Error('La hora no es válida (HH:MM).');
  if (newDate !== s.date) { patch.date = newDate; changed.push('fecha'); }
  if (newTime !== (s.time ?? '')) { patch.time = newTime; changed.push('hora'); }
  if (values) {
    const nv = { ...(s.values ?? {}) };
    for (const [vid, sides] of Object.entries(values)) {
      if (!s.values?.[vid]) throw new Error('Solo se corrigen variables que la sesión ya tiene.');
      const cur = { ...s.values[vid] };
      for (const [side, x] of Object.entries(sides ?? {})) {
        if (!['L', 'R', 'S'].includes(side) || !(side in cur)) throw new Error('Lado no válido para esa variable.');
        if (typeof x !== 'number' || !Number.isFinite(x)) throw new Error('Los valores deben ser números.');
        if (cur[side] !== x) { cur[side] = x; changed.push(`variable ${vid}`); }
      }
      nv[vid] = cur;
    }
    if (changed.some((c) => c.startsWith('variable'))) patch.values = nv;
  }
  if (reps) {
    const nr = { ...(s.reps ?? {}) };
    for (const [k, x] of Object.entries(reps)) {
      if (!['L', 'R', 'total'].includes(k)) throw new Error('Repeticiones: lado no válido.');
      if (x === null) { if (k in nr) { delete nr[k]; changed.push('repeticiones'); } continue; }
      if (!Number.isInteger(x) || x < 1) throw new Error('Las repeticiones deben ser un entero mayor que 0.');
      if (nr[k] !== x) { nr[k] = x; changed.push('repeticiones'); }
    }
    if (changed.includes('repeticiones')) patch.reps = nr;
  }
  if (!changed.length) throw new Error('No hay ningún cambio que guardar.');
  if (patch.date !== undefined || patch.time !== undefined) {
    const clash = (await db.sessions.where('playerId').equals(s.playerId).toArray()).find((o) => o.id !== s.id && o.testId === s.testId && o.date === newDate && (o.time ?? '') === newTime && (o.protocolId ?? null) === (s.protocolId ?? null));
    if (clash) throw new Error('Ya existe otra sesión de ese jugador, test y protocolo en esa fecha y hora. Elimina o corrige esa primero.');
  }
  await db.sessions.update(sessionId, { ...patch, correctedAt: new Date().toISOString() });
  await audit(db, 'sesion-corregida', { sessionId, playerId: s.playerId, testId: s.testId, campos: [...new Set(changed)].join(', ') });
}
