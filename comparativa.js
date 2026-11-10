// comparativa.js — fase 5b: vista de un test para toda la plantilla (RF-02, D10, D11, D13, D33). Lógica pura, sin interfaz.
// Modos: 'pa' Personal Average (por defecto, D33), 'pb' Personal Best, 'last' Average de la última sesión válida, 'hist' histórico completo.
// La posición de cada jugador es su PRINCIPAL (sin fechas: un cambio vale para todo el histórico); sin posición: grupo «Sin posición».
// D33a (provisional, a confirmar): un Personal Average que abarca varias posiciones se reparte en UNA FILA POR POSICIÓN OCUPADA (no mezcla posiciones).
// Las sesiones excluidas no aparecen. Tests por lado: izquierda y derecha en columnas separadas y asimetría D25 calculada con los dos valores mostrados.

import { asymmetryPct } from './catalogo.js';
import { positionOnDate } from './posiciones.js';
import { buildSeries, personalAverage, personalBestFor } from './evolucion.js';
import { playerLabel } from './jugadores.js';

export const MODES = [['pa', 'Personal Average'], ['pb', 'Personal Best'], ['last', 'Última sesión válida'], ['hist', 'Histórico completo']];
export const NONE_KEY = 'none';

const timeKey = (p) => p.date + (p.time || '');

export function compareTest({ sessions, variable, players, histories, positions, mode = 'pa', protocolId, from = null, to = null, sort = 'player' }) {
  const sides = variable.sides === 'LR' ? ['L', 'R'] : ['S'];
  const filters = { from, to, protocolId };
  const posKey = (playerId, date) => positionOnDate(histories[playerId] ?? [], date).principal?.positionId ?? NONE_KEY;
  const byPlayer = new Map();
  for (const s of sessions) { if (!byPlayer.has(s.playerId)) byPlayer.set(s.playerId, []); byPlayer.get(s.playerId).push(s); }
  const rows = [];
  let withData = 0;
  for (const [playerId, list] of byPlayer) {
    const player = players[playerId];
    if (!player) continue;
    const series = Object.fromEntries(sides.map((sd) => [sd, buildSeries(list, variable.id, sd, filters).valid]));
    if (!sides.some((sd) => series[sd].length)) continue;
    withData++;
    const mk = (cells, groupKey, date, extra = {}) => {
      const asym = sides.length === 2 && cells.L?.value != null && cells.R?.value != null ? asymmetryPct(cells.L.value, cells.R.value) : null;
      return { playerId, playerName: playerLabel(player), groupKey, date, cells, asym, ...extra };
    };
    if (mode === 'pa') {
      const keys = new Set(sides.flatMap((sd) => series[sd].map((p) => posKey(playerId, p.date))));
      for (const k of keys) {
        const cells = {}; let last = '';
        for (const sd of sides) {
          const pts = series[sd].filter((p) => posKey(playerId, p.date) === k);
          if (!pts.length) { cells[sd] = null; continue; }
          const pa = personalAverage(pts);
          cells[sd] = { value: pa.value, date: pa.to, from: pa.from, sessions: pa.sessions, reps: pa.reps };
          if (pa.to > last) last = pa.to;
        }
        rows.push(mk(cells, k, last, { multi: keys.size > 1 }));
      }
    } else if (mode === 'pb') {
      const cells = {}; let last = ''; let reason = null;
      for (const sd of sides) {
        const pb = personalBestFor(list, variable, sd, filters);
        if (!pb.defined) { cells[sd] = series[sd].length ? { value: null, reason: pb.reason } : null; reason = reason ?? pb.reason; continue; }
        cells[sd] = { value: pb.value, date: pb.date, reps: pb.reps, tied: pb.tied };
        if (pb.date > last) last = pb.date;
      }
      if (!last) last = sides.flatMap((sd) => series[sd]).sort((a, b) => timeKey(b).localeCompare(timeKey(a)))[0].date; // sin PB definido: ubicar por su última sesión
      rows.push(mk(cells, posKey(playerId, last), last, { undefinedReason: reason }));
    } else if (mode === 'last') {
      const all = sides.flatMap((sd) => series[sd]).sort((a, b) => timeKey(b).localeCompare(timeKey(a)) || b.sessionId - a.sessionId);
      const lastId = all[0].sessionId;
      const cells = {};
      for (const sd of sides) { const p = series[sd].find((x) => x.sessionId === lastId); cells[sd] = p ? { value: p.value, date: p.date, reps: p.reps } : null; }
      rows.push(mk(cells, posKey(playerId, all[0].date), all[0].date));
    } else { // hist
      const ids = [...new Set(sides.flatMap((sd) => series[sd].map((p) => p.sessionId)))];
      for (const id of ids) {
        const cells = {}; let date = '';
        for (const sd of sides) { const p = series[sd].find((x) => x.sessionId === id); cells[sd] = p ? { value: p.value, date: p.date, reps: p.reps } : null; if (p) date = p.date; }
        rows.push(mk(cells, posKey(playerId, date), date, { sessionId: id }));
      }
    }
  }
  // Orden dentro de cada grupo
  const primary = sides[0];
  const better = variable.direction === 'lower' ? 1 : -1; // mejor primero
  const cmp = {
    player: (a, b) => a.playerName.localeCompare(b.playerName, 'es') || b.date.localeCompare(a.date),
    date: (a, b) => b.date.localeCompare(a.date) || a.playerName.localeCompare(b.playerName, 'es'),
    value: (a, b) => {
      const x = a.cells[primary]?.value, y = b.cells[primary]?.value;
      if (x == null && y == null) return a.playerName.localeCompare(b.playerName, 'es');
      if (x == null) return 1; if (y == null) return -1;
      return (x - y) * better || a.playerName.localeCompare(b.playerName, 'es');
    },
  }[sort] ?? (() => 0);
  const order = [...positions.map((p) => p.id), NONE_KEY];
  const nameOf = (k) => (k === NONE_KEY ? 'Sin posición' : positions.find((p) => p.id === k)?.name ?? 'Posición eliminada');
  const groups = order.map((k) => ({ key: k, name: nameOf(k), rows: rows.filter((r) => r.groupKey === k).sort(cmp) })).filter((g) => g.rows.length);
  const orphan = rows.filter((r) => !order.includes(r.groupKey)); // posición borrada con historial: no se pierde ningún resultado
  if (orphan.length) groups.splice(groups.length - (groups.at(-1)?.key === NONE_KEY ? 1 : 0), 0, { key: 'orphan', name: 'Posición eliminada', rows: orphan.sort(cmp) });
  return { groups, players: withData, rows: rows.length, sides };
}
