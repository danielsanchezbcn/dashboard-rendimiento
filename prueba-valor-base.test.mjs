// Equivalencia (paquete A): `valorBase` sustituye a tres copias de la misma lógica. Se compara con la implementación anterior de `playerValue` (copiada aquí tal cual)
// sobre cientos de casos sintéticos aleatorios (semilla fija): todas las bases, con y sin criterio de mejor sesión, filtros de fechas y protocolo, sesiones excluidas y empates.
import { buildSeries, personalAverage, personalBestFor, valorBase } from './evolucion.js';
import { playerValue } from './percentiles.js';
let fail = 0; const check = (n, ok, d = '') => { console.log((ok ? 'OK   ' : 'FAIL ') + n + (ok ? '' : ' ' + d)); if (!ok) fail = 1; };
let seed = 20261110; const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
const canon = (o) => JSON.stringify(o, (k, v) => (v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort()) : v));
const timeKey = (p) => p.date + (p.time || '');
// --- implementación anterior de playerValue (sin el filtro de posición, que no cambia)
function antiguo(sessions, variable, side, { basis, from = null, to = null, protocolId } = {}) {
  const pts = buildSeries(sessions, variable.id, side, { from, to, protocolId }).valid;
  if (!pts.length) return null;
  if (basis === 'first') { const f = [...pts].sort((a, b) => timeKey(a).localeCompare(timeKey(b)) || a.sessionId - b.sessionId)[0]; return { value: f.value, date: f.date, reps: f.reps, sessions: 1 }; }
  if (basis === 'pb') { const pb = personalBestFor(sessions, variable, side, { from, to, protocolId }); return pb.defined ? { value: pb.value, date: pb.date, reps: pb.reps, sessions: pts.length } : null; }
  if (basis === 'last') { const l = [...pts].sort((a, b) => timeKey(a).localeCompare(timeKey(b)) || a.sessionId - b.sessionId).at(-1); return { value: l.value, date: l.date, reps: l.reps, sessions: 1 }; }
  const pa = personalAverage(pts);
  return { value: pa.value, date: pa.to, from: pa.from, reps: pa.reps, sessions: pa.sessions };
}
const var1 = { id: 1, direction: 'higher', pbCriterion: { id: 2, name: 'RSI' } }, var2 = { id: 2, direction: 'higher' }, var3 = { id: 3, direction: 'lower' }, var4 = { id: 4, direction: null };
let n = 0, distintos = 0, detalle = '';
const fechas = ['2026-01-05', '2026-01-05', '2026-02-10', '2026-03-01', '2026-03-01', '2026-04-20'];
for (let caso = 0; caso < 600; caso++) {
  const sessions = [];
  const k = 1 + Math.floor(rnd() * 7);
  for (let i = 0; i < k; i++) {
    const v = (x) => (rnd() < 0.1 ? undefined : Math.round(x * 4) / 4); // valores repetidos para provocar empates; a veces falta la variable
    const values = {}; for (const [id, base] of [[1, 20], [2, 0.5], [3, 300], [4, 7]]) { const x = v(base + rnd() * 10); if (x !== undefined) values[id] = { S: x, L: x, R: x + 1 }; }
    sessions.push({ id: i + 1, playerId: 1, testId: 1, date: fechas[Math.floor(rnd() * fechas.length)], time: rnd() < 0.5 ? '' : '1' + Math.floor(rnd() * 9) + ':00', protocolId: rnd() < 0.5 ? null : 7, values, reps: { S: 1 + Math.floor(rnd() * 5), L: 3, R: 3, total: 3 }, status: rnd() < 0.15 ? 'excluded' : 'valid' });
  }
  const filters = { from: rnd() < 0.3 ? '2026-02-01' : null, to: rnd() < 0.3 ? '2026-03-31' : null, protocolId: rnd() < 0.3 ? 7 : undefined };
  for (const variable of [var1, var2, var3, var4]) for (const side of ['S', 'L']) for (const basis of ['pa', 'pb', 'last', 'first']) {
    n++;
    const a = antiguo(sessions, variable, side, { basis, ...filters }), b = playerValue(sessions, variable, side, { basis, playerId: 1, ...filters }), c = valorBase(sessions, variable, side, basis, filters);
    const ok = canon(a) === canon(b) && (a === null ? c === null : c && c.value === a.value && c.date === a.date && c.sessions === a.sessions && c.reps === a.reps);
    if (!ok) { distintos++; if (!detalle) detalle = JSON.stringify({ basis, variable: variable.id, a, b, c }); }
  }
}
check(`valorBase y playerValue dan lo mismo que el código anterior en ${n} comparaciones`, distintos === 0, detalle);
// el filtro de posición sigue funcionando
const ses = [{ id: 1, playerId: 1, testId: 1, date: '2026-01-01', time: '', values: { 1: { S: 5 } }, reps: { total: 1 }, status: 'valid' }];
check('playerValue con otra posición: null; con la misma: valor', playerValue(ses, var2, 'S', { basis: 'pa', positionId: 3, histories: { 1: [] }, playerId: 1 }) === null && playerValue(ses, { id: 1, direction: 'higher' }, 'S', { basis: 'pa', positionId: null, playerId: 1 }).value === 5);
console.log(fail ? 'HAY FALLOS' : 'Todo bien'); process.exit(fail);
