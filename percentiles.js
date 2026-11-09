// percentiles.js — fase 5c: referencia «La Liga» (base de datos propia) y percentiles. Lógica pura, sin interfaz.
// Reglas cerradas: D19 (solo datos propios; los sintéticos NO entran), D28 (un valor por jugador, siguiendo el Personal Average, sin sesiones excluidas;
// el jugador evaluado se excluye de su propia referencia, D28a), D21 (marcador = mediana P50; percentil exacto por rango medio), D14 (seis bandas de la guía),
// D52 (N mínimo configurable, 10 por defecto: con menos, «muestra insuficiente» sin color).
// Hay DOS percentiles (guía): sobre el Personal Average y sobre el Average de la última sesión válida de cada jugador.
// «Percentil estadístico» = posición en la distribución; «percentil orientado a rendimiento» = tiene en cuenta la dirección de la variable
// (más bajo es mejor → 100 − percentil estadístico). Con rango objetivo o sin dirección no hay percentil de rendimiento ni color.
// No se cubren variables derivadas (relativas): las sesiones solo guardan valores originales.

import { buildSeries, personalAverage, personalBest } from './evolucion.js';
import { positionOnDate } from './posiciones.js';

export const MIN_N_DEFAULT = 10;

// Seis bandas de la guía (los límites no se solapan: P10 → naranja, P35 → amarillo suave, P50 → amarillo intenso, P65 → verde suave, P90 → verde intenso).
export const BANDS = [
  { key: 'rojo', name: 'Rojo intenso', range: '0–<10' },
  { key: 'naranja', name: 'Naranja', range: '10–<35' },
  { key: 'amarillo-suave', name: 'Amarillo suave', range: '35–<50' },
  { key: 'amarillo', name: 'Amarillo intenso', range: '50–<65' },
  { key: 'verde-suave', name: 'Verde suave', range: '65–<90' },
  { key: 'verde', name: 'Verde intenso', range: '90–100' },
];
export const bandFor = (p) => (p < 10 ? 0 : p < 35 ? 1 : p < 50 ? 2 : p < 65 ? 3 : p < 90 ? 4 : 5);

// Percentil exacto por rango medio: (nº de valores menores + la mitad de los iguales) ÷ N × 100.
export function midRankPercentile(values, x) {
  if (!values.length) return null;
  let lt = 0, eq = 0;
  for (const v of values) { if (v < x) lt++; else if (v === x) eq++; }
  return ((lt + eq / 2) / values.length) * 100;
}

export function median(values) {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b), m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

// Cuantil con interpolación lineal (q entre 0 y 1); con q = 0,5 coincide con la mediana.
export function quantile(values, q) {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b), h = (s.length - 1) * q, i = Math.floor(h);
  return i + 1 < s.length ? s[i] + (h - i) * (s[i + 1] - s[i]) : s[i];
}
// Valor de la referencia que deja al percentil de RENDIMIENTO p (0–1): con «más bajo es mejor» es el cuantil estadístico 1 − p.
export const perfQuantile = (values, p, direction) => quantile(values, direction === 'lower' ? 1 - p : p);

const timeKey = (p) => p.date + (p.time || '');
const posOf = (histories, playerId) => positionOnDate(histories[playerId] ?? []).principal?.positionId ?? null; // posición única, sin fechas

// Valor de un jugador para la base elegida: 'pa' = Personal Average; 'first' = Average de su primera sesión válida; 'last' = Average de su última sesión válida; 'pb' = Personal Best (solo con dirección más alto/más bajo).
export function playerValue(sessions, variable, side, { basis, positionId = null, histories = {}, playerId, from = null, to = null, protocolId } = {}) {
  let pts = buildSeries(sessions, variable.id, side, { from, to, protocolId }).valid;
  if (positionId !== null && posOf(histories, playerId) !== positionId) pts = [];
  if (!pts.length) return null;
  if (basis === 'first') { const f = [...pts].sort((a, b) => timeKey(a).localeCompare(timeKey(b)) || a.sessionId - b.sessionId)[0]; return { value: f.value, date: f.date, reps: f.reps, sessions: 1 }; }
  if (basis === 'pb') { const pb = personalBest(pts, variable.direction); return pb.defined ? { value: pb.value, date: pb.date, reps: pb.reps, sessions: pts.length } : null; }
  if (basis === 'last') { const l = [...pts].sort((a, b) => timeKey(a).localeCompare(timeKey(b)) || a.sessionId - b.sessionId).at(-1); return { value: l.value, date: l.date, reps: l.reps, sessions: 1 }; }
  const pa = personalAverage(pts);
  return { value: pa.value, date: pa.to, from: pa.from, reps: pa.reps, sessions: pa.sessions };
}

// Referencia: una entrada por jugador { playerId, value }. Excluye jugadores sintéticos (salvo includeSynthetic, solo para pruebas internas) y sesiones excluidas.
export function buildReference({ sessions, variable, side, players, histories = {}, basis = 'pa', positionId = null, from = null, to = null, protocolId, includeSynthetic = false }) {
  const by = new Map();
  for (const s of sessions) { if (!by.has(s.playerId)) by.set(s.playerId, []); by.get(s.playerId).push(s); }
  const entries = [];
  for (const [playerId, list] of by) {
    const pl = players[playerId];
    if (!pl || (pl.synthetic && !includeSynthetic)) continue;
    const v = playerValue(list, variable, side, { basis, positionId, histories, playerId, from, to, protocolId });
    if (v) entries.push({ playerId, value: v.value });
  }
  return entries;
}

// Evalúa un valor frente a la referencia SIN el jugador evaluado (D28a).
export function evaluate(entries, { playerId, value, direction, minN = MIN_N_DEFAULT }) {
  const ref = entries.filter((e) => e.playerId !== playerId).map((e) => e.value);
  const n = ref.length;
  const out = { n, minN, sufficient: n >= minN, value, min: n ? Math.min(...ref) : null, max: n ? Math.max(...ref) : null, p50: median(ref), percentileStat: null, percentilePerf: null, band: null, reason: null };
  if (!n) { out.reason = 'No hay otros jugadores con datos comparables.'; return out; }
  if (!out.sufficient) { out.reason = `Muestra insuficiente (N = ${n}, mínimo ${minN}).`; return out; }
  out.percentileStat = midRankPercentile(ref, value);
  if (direction === 'higher') out.percentilePerf = out.percentileStat;
  else if (direction === 'lower') out.percentilePerf = 100 - out.percentileStat;
  else { out.percentilePerf = out.percentileStat; out.positional = true; } // sin dirección (o con rango objetivo): el color indica la POSICIÓN en La Liga, no «mejor/peor» (9/11/2026: todo percentil lleva color)
  out.band = bandFor(out.percentilePerf);
  return out;
}
