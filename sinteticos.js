// sinteticos.js — datos sintéticos de demostración, marcados con synthetic = 1 y fáciles de eliminar.
// Nada de lo que se genera aquí representa a jugadores, posiciones ni mediciones reales.
// El conjunto de jugadores A a F reproduce el conjunto de aceptación de REQUISITOS.md (posiciones con fechas).

import { audit } from './db.js';

// Orden de borrado: primero lo que depende de otras tablas.
export const SYNTHETIC_TABLES = ['sessions', 'playerPositions', 'anthropometry', 'playerAliases', 'players', 'positions'];

export const countSynthetic = async (db) => {
  const out = {};
  for (const t of SYNTHETIC_TABLES) out[t] = await db.table(t).where('synthetic').equals(1).count();
  return out;
};
export const totalOf = (counts) => Object.values(counts).reduce((a, b) => a + b, 0);

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FIXTURE = [
  // letra, historial [posición, desde, hasta]
  ['A', [[1, '2026-01-01', '2026-02-28'], [2, '2026-03-01', null]]],
  ['B', [[1, '2026-01-01', null]]],
  ['C', [[2, '2026-01-01', null]]],
  ['D', [[1, '2026-04-01', null]]], // sin posición hasta el 31/03/2026
  ['E', [[2, '2026-01-01', null]]],
  ['F', [[1, '2026-01-01', null]]],
];

export async function loadSyntheticDemo(db, { extraPlayers = 6, now = new Date() } = {}) {
  if (totalOf(await countSynthetic(db)) > 0) throw new Error('Ya hay datos sintéticos cargados: elimínalos antes de cargar otros.');
  const stamp = now.toISOString().replace(/[-:T]/g, '').slice(0, 14);
  const batch = `sintetico-${stamp}`;
  const mark = { synthetic: 1, syntheticBatch: batch };
  const rand = rng(7);
  const created = {};
  await db.transaction('rw', db.positions, db.players, db.playerAliases, db.playerPositions, db.anthropometry, db.auditLog, async () => {
    const existing = await db.positions.toArray();
    let order = existing.length ? Math.max(...existing.map((p) => p.order)) : 0;
    const pos = {};
    for (const n of [1, 2]) pos[n] = await db.positions.add({ name: `Posición sintética ${n}`, order: ++order, active: true, ...mark });
    const t0 = now.toISOString();
    const people = FIXTURE.map(([letter, hist]) => ({ name: `Jugador sintético ${letter}`, letter, hist }));
    for (let i = 0; i < extraPlayers; i++) {
      const num = String(7 + i).padStart(2, '0');
      let name = `Jugador sintético ${num}`;
      // Pareja con y sin ñ para ver la propuesta de candidatos con confirmación manual (fase 3).
      if (i === 0) name = 'Jugador sintético Muñoz';
      if (i === 1) name = 'Jugador sintético Munoz';
      const p1 = 1 + (i % 2);
      const hist = i % 2 === 0 ? [[p1, '2026-01-01', '2026-02-28'], [3 - p1, '2026-03-01', null]] : [[p1, '2026-01-01', null]];
      people.push({ name, letter: num, hist });
    }
    let counts = { players: 0, playerAliases: 0, playerPositions: 0, anthropometry: 0 };
    for (const person of people) {
      const pid = await db.players.add({ jerseyName: person.name, notes: 'Dato sintético', active: true, createdAt: t0, updatedAt: t0, ...mark });
      counts.players++;
      if (/^[A-F]$/.test(person.letter)) {
        const full = `JUGADOR SINTÉTICO ${person.letter}, nombre completo VALD ficticio`;
        const sport = `jug. sintetico ${person.letter}`;
        await db.playerAliases.add({ playerId: pid, source: 'VALD', rawText: full, normalizedKey: full.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim(), confirmedAt: t0, ...mark });
        await db.playerAliases.add({ playerId: pid, source: 'Excel', rawText: sport, normalizedKey: sport.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim(), confirmedAt: t0, ...mark });
        counts.playerAliases += 2;
      }
      for (const [p, from, to] of person.hist) {
        await db.playerPositions.add({ playerId: pid, positionId: pos[p], role: 'principal', validFrom: from, validTo: to, ...mark });
        counts.playerPositions++;
      }
      for (const date of ['2026-01-15', '2026-03-15', '2026-05-15']) {
        await db.anthropometry.add({
          playerId: pid, date, source: 'sintético', notes: '',
          bodyMass: { value: Math.round((70 + rand() * 20) * 10) / 10, unit: 'kg' },
          height: { value: Math.round(170 + rand() * 25), unit: 'cm' },
          legLength: { value: Math.round(85 + rand() * 15), unit: 'cm' },
          ...mark,
        });
        counts.anthropometry++;
      }
    }
    created.counts = { positions: 2, ...counts };
    await audit(db, 'datos-sinteticos-cargados', { lote: batch, recuentos: created.counts });
  });
  return { batch, counts: created.counts };
}

// Elimina TODOS los registros sintéticos y solo ellos. Se niega si algún dato real depende de uno sintético.
export async function deleteSynthetic(db) {
  const before = await countSynthetic(db);
  if (totalOf(before) === 0) throw new Error('No hay datos sintéticos que eliminar.');
  const synthPositions = new Set((await db.positions.where('synthetic').equals(1).primaryKeys()));
  const synthPlayers = new Set((await db.players.where('synthetic').equals(1).primaryKeys()));
  const realPositions = (await db.playerPositions.toArray()).filter((r) => !r.synthetic && (synthPositions.has(r.positionId) || synthPlayers.has(r.playerId))).length;
  const realAliases = (await db.playerAliases.toArray()).filter((r) => !r.synthetic && synthPlayers.has(r.playerId)).length;
  const realAnthro = (await db.anthropometry.toArray()).filter((r) => !r.synthetic && synthPlayers.has(r.playerId)).length;
  const realSessions = (await db.sessions.toArray()).filter((r) => !r.synthetic && synthPlayers.has(r.playerId)).length;
  if (realPositions + realAliases + realAnthro + realSessions > 0) {
    throw new Error(`No se puede eliminar: hay datos reales que dependen de datos sintéticos (${realPositions} registros de posición, ${realAliases} alias, ${realAnthro} mediciones, ${realSessions} sesiones). Reasígnalos o elimínalos antes.`);
  }
  await db.transaction('rw', SYNTHETIC_TABLES.map((t) => db.table(t)).concat(db.auditLog), async () => {
    for (const t of SYNTHETIC_TABLES) await db.table(t).where('synthetic').equals(1).delete();
    await audit(db, 'datos-sinteticos-eliminados', { recuentos: before });
  });
  return before;
}
