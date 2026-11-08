// atletas.js — importación de la lista de atletas de VALD (nombre y alias; posiciones solo con confirmación).
// Se usa ANTES de importar tests: deja los jugadores dados de alta con su alias de la fuente VALD.
// No se importan fecha de nacimiento, altura, peso (viene a 0 casi siempre), sexo, correo ni vald-id (el esquema no tiene dónde guardarlos).
// Nada se vincula en silencio: cada nombre que ya coincide con un jugador existente se propone, no se aplica sin confirmar.

import { normalizeName, findCandidates, createPlayer, addAlias } from './jugadores.js';
import { listPositions, createPosition, setMainPosition, playerHistory } from './posiciones.js';
import { audit } from './db.js';

export const ATLETAS_SOURCE = 'VALD';
const clean = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
const norm = (h) => String(h ?? '').trim().toLowerCase();

export function looksLikeAthletes(grid) {
  const h = (grid?.[0] ?? []).map(norm);
  return h.includes('vald-id') && h.includes('given-name') && h.includes('family-name');
}

// Devuelve { ok, rows:[{rowNumber, name, valdId, position}], positions:[{name, count}], notes, ignored }
export function parseAthletes(grid) {
  if (!looksLikeAthletes(grid)) return { ok: false, error: 'No parece la lista de atletas de VALD (faltan las columnas vald-id, given-name y family-name).' };
  const header = grid[0].map(norm);
  const col = (n) => header.indexOf(n);
  const [iId, iG, iM, iF] = ['vald-id', 'given-name', 'middle-name', 'family-name'].map(col);
  const catIdx = header.map((h, i) => (/^category \d+$/.test(h) ? i : -1)).filter((i) => i >= 0);
  const rows = [], notes = [], seenId = new Set(), seenName = new Map();
  grid.slice(1).forEach((r, k) => {
    const rowNumber = k + 2;
    if (!r || r.every((c) => c === null || c === undefined || String(c).trim() === '')) return;
    const name = clean([r[iG], iM >= 0 ? r[iM] : '', r[iF]].join(' '));
    if (!name) { notes.push({ rows: [rowNumber], level: 'error', text: 'Fila sin nombre: no se importa.' }); return; }
    const valdId = clean(r[iId]);
    if (valdId && seenId.has(valdId)) { notes.push({ rows: [rowNumber], level: 'error', text: 'vald-id repetido en el fichero: fila no importada.' }); return; }
    seenId.add(valdId);
    const key = normalizeName(name).key;
    if (seenName.has(key)) {
      notes.push({ rows: [seenName.get(key), rowNumber], level: 'error', text: 'Dos atletas con el mismo nombre: ninguno de los dos se importa (no se distinguen por nombre).' });
      const i = rows.findIndex((x) => normalizeName(x.name).key === key); if (i >= 0) rows.splice(i, 1);
      return;
    }
    seenName.set(key, rowNumber);
    // La posición es el «Group» cuya «Category» vale «Position» (el orden de las parejas varía por atleta).
    let position = '';
    for (const ci of catIdx) if (norm(r[ci]) === 'position') position = clean(r[ci + 1]);
    rows.push({ rowNumber, name, valdId, position });
  });
  const ok = rows;
  const pc = new Map(); for (const r of ok) if (r.position) pc.set(r.position, (pc.get(r.position) ?? 0) + 1);
  const used = new Set(['vald-id', 'given-name', 'middle-name', 'family-name', ...catIdx.flatMap((i) => [header[i], header[i + 1]])]);
  return { ok: true, rows: ok, positions: [...pc].map(([name, count]) => ({ name, count })), withoutPosition: ok.filter((r) => !r.position).length, notes, ignored: grid[0].filter((h) => h && !used.has(norm(h))) };
}

// Para cada atleta: acción propuesta (link / new / manual) y candidatos. No escribe nada.
export async function planAthletes(db, rows) {
  const out = [];
  for (const r of rows) {
    const f = await findCandidates(db, r.name, { source: ATLETAS_SOURCE });
    const one = f.candidates.length === 1 && !f.requiresManual;
    out.push({ ...r, candidates: f.candidates.map((c) => ({ playerId: c.player.id, jerseyName: c.player.jerseyName })), suggested: one ? { action: 'link', playerId: f.candidates[0].player.id } : f.candidates.length ? null : { action: 'new' }, reasons: f.reasons ?? [] });
  }
  return out;
}

// decisions[nombre] = { action:'link', playerId } | { action:'new' } | { action:'skip' }
// positionMap[posiciónVALD] = { positionId } | { create:true } | null (la posición no lleva fecha)
export async function commitAthletes(db, { rows, decisions, positionMap = {} }) {
  const counts = { jugadoresNuevos: 0, vinculados: 0, aliasAnadidos: 0, aliasYaExistian: 0, omitidos: 0, posicionesAsignadas: 0, posicionesYaTenian: 0, posicionesCreadas: 0, errores: 0 };
  const created = new Map();
  const posIds = new Map();
  for (const [vp, m] of Object.entries(positionMap)) {
    if (!m) continue;
    if (m.create) {
      const existing = (await listPositions(db)).find((p) => normalizeName(p.name).key === normalizeName(vp).key);
      if (existing) posIds.set(vp, existing.id); else { posIds.set(vp, await createPosition(db, { name: vp })); counts.posicionesCreadas++; }
    } else posIds.set(vp, m.positionId);
  }
  for (const r of rows) {
    const d = decisions[r.name];
    if (!d || d.action === 'skip') { counts.omitidos++; continue; }
    try {
      let playerId;
      if (d.action === 'new') { playerId = await createPlayer(db, { jerseyName: r.name }); counts.jugadoresNuevos++; }
      else { playerId = d.playerId; counts.vinculados++; }
      try { await addAlias(db, playerId, ATLETAS_SOURCE, r.name); counts.aliasAnadidos++; }
      catch (e) { if (/ya existe para este jugador/.test(e.message)) counts.aliasYaExistian++; else throw e; }
      if (r.position && posIds.has(r.position)) {
        const hist = (await playerHistory(db, playerId)).filter((h) => h.role === 'principal');
        if (hist.length) counts.posicionesYaTenian++; // nunca se pisa una posición ya registrada
        else { await setMainPosition(db, playerId, posIds.get(r.position)); counts.posicionesAsignadas++; }
      }
    } catch (e) { counts.errores++; }
  }
  await audit(db, 'atletas-vald-importados', counts);
  return { counts };
}
