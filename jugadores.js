// jugadores.js — jugadores y alias por fuente. Nombre completo (VALD) y alias (camiseta, el de los Excel); el visible es «completo (alias)».
// La normalización solo sirve para PROPONER candidatos: nunca vincula por sí sola.

import { audit } from './db.js';

export const SOURCES = ['VALD', 'Excel', 'Otra'];

export const syntheticFields = (opts) => (opts?.synthetic ? { synthetic: 1, syntheticBatch: opts.batch ?? null } : {});

// Ignora mayúsculas, espacios redundantes y acentos/diacríticos. hasEnye avisa de que había una ñ,
// porque una equivalencia que cambie ñ por n exige confirmación manual.
export function normalizeName(text) {
  const raw = String(text ?? '');
  const hasEnye = /ñ/i.test(raw);
  const key = raw.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();
  return { key, hasEnye };
}

export function compareNames(a, b) {
  const x = normalizeName(a);
  const y = normalizeName(b);
  const sameKey = x.key === y.key && x.key !== '';
  return { exact: String(a).trim() === String(b).trim(), sameKey, changesEnye: sameKey && x.hasEnye !== y.hasEnye };
}

const cleanName = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();

// Nombre visible: nombre completo (el de VALD) y, si es distinto, el alias (el de los Excel / camiseta) entre paréntesis.
export const baseName = (p) => cleanName(p?.fullName) || cleanName(p?.jerseyName);
export function playerLabel(p) {
  const full = cleanName(p?.fullName), alias = cleanName(p?.jerseyName);
  if (full && alias && normalizeName(full).key !== normalizeName(alias).key) return `${full} (${alias})`;
  return full || alias;
}
export const aliasOf = (p) => { const f = cleanName(p?.fullName), a = cleanName(p?.jerseyName); return f && a && normalizeName(f).key !== normalizeName(a).key ? a : ''; };
export const nameMatchesPlayer = (p, text) => { const t = cleanName(text); return !!t && (t === cleanName(p?.jerseyName) || t === cleanName(p?.fullName) || t === playerLabel(p)); };

// ---------- Parecido entre nombres (solo propone; nunca vincula) ----------
const PARTICLES = new Set(['de', 'del', 'la', 'las', 'los', 'el', 'y', 'da', 'do', 'dos', 'das', 'di', 'van', 'von', 'der', 'den', 'bin', 'ben', 'al', 'le', 'jr', 'sr']);
export function nameTokens(text) {
  const key = normalizeName(text).key.replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  const all = key ? key.split(' ') : [];
  const kept = all.filter((t) => !PARTICLES.has(t));
  return kept.length ? kept : all;
}
function editDistance(a, b) {
  const m = a.length, n = b.length;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[n];
}
// Peso de la coincidencia de una palabra con otra: 1 igual · 0.85 errata leve · 0.8 una es el inicio de la otra · 0.6 inicial · 0 nada.
function tokenScore(a, b) {
  if (a === b) return 1;
  const [s, l] = a.length <= b.length ? [a, b] : [b, a];
  if (s.length === 1) return l.startsWith(s) ? 0.6 : 0;
  if (s.length >= 3 && l.startsWith(s)) return 0.8;
  const d = editDistance(a, b);
  if (s.length >= 5 && d <= (l.length >= 9 ? 2 : 1)) return 0.85;
  return 0;
}
// Compara dos nombres sin acentos, sin importar el orden ni las partículas. Cubre nombre y apellido.
export function similarity(a, b) {
  const A = nameTokens(a), B = nameTokens(b);
  if (!A.length || !B.length) return { level: null, score: 0, why: '' };
  const [short, long] = A.length <= B.length ? [A, B] : [B, A];
  const used = new Set();
  let sum = 0, matched = 0, initials = 0;
  for (const t of short) {
    let best = 0, bi = -1;
    long.forEach((u, i) => { if (used.has(i)) return; const sc = tokenScore(t, u); if (sc > best) { best = sc; bi = i; } });
    if (best > 0) { used.add(bi); sum += best; matched++; if (best === 0.6) initials++; }
  }
  const coverage = sum / short.length;
  const same = normalizeName(a).key.replace(/[^\p{L}\p{N}]+/gu, ' ').trim() === normalizeName(b).key.replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  let level = null;
  if (same) level = 'alta';
  else if (short.length >= 2 && matched === short.length) level = initials ? 'media' : 'alta'; // con inicial («A. Fati») nunca pasa de media // todas las palabras del nombre más corto aparecen en el otro
  else if (short.length === 1 && matched === 1) level = 'media'; // una sola palabra (apodo, apellido o nombre): nunca basta para dar por hecho
  else if (short.length >= 2 && matched >= 1 && coverage >= 0.5) level = 'baja'; // solo coincide una de las palabras
  const why = level === 'alta' ? (same ? 'mismo nombre (sin contar acentos)' : 'coinciden nombre y apellido') : level === 'media' ? 'coincide una palabra' : level === 'baja' ? 'solo coincide una de las palabras' : '';
  return { level, score: same ? 1 : coverage, why };
}
const RANK = { alta: 3, media: 2, baja: 1 };

export async function createPlayer(db, { jerseyName, fullName, notes = '' }, opts) {
  const full = cleanName(fullName);
  const name = cleanName(jerseyName) || full;
  if (!name) throw new Error('El alias (nombre en camiseta) es obligatorio.');
  const now = new Date().toISOString();
  const id = await db.players.add({ jerseyName: name, ...(full ? { fullName: full } : {}), notes: String(notes ?? '').trim(), active: true, createdAt: now, updatedAt: now, ...syntheticFields(opts) });
  await audit(db, 'jugador-creado', { jugadorId: id });
  return id;
}

export async function updatePlayer(db, id, { jerseyName, fullName, notes }) {
  const player = await db.players.get(id);
  if (!player) throw new Error('El jugador no existe.');
  const patch = { updatedAt: new Date().toISOString() };
  if (jerseyName !== undefined) {
    const name = cleanName(jerseyName);
    if (!name) throw new Error('El alias (nombre en camiseta) es obligatorio.');
    patch.jerseyName = name;
  }
  if (fullName !== undefined) patch.fullName = cleanName(fullName);
  if (notes !== undefined) patch.notes = String(notes).trim();
  await db.players.update(id, patch);
  await audit(db, 'jugador-modificado', { jugadorId: id });
}

export async function setPlayerActive(db, id, active) {
  if (!(await db.players.get(id))) throw new Error('El jugador no existe.');
  await db.players.update(id, { active: !!active, updatedAt: new Date().toISOString() });
  await audit(db, active ? 'jugador-activado' : 'jugador-desactivado', { jugadorId: id });
}

// Aviso (no bloqueo) si otro jugador tiene un nombre equivalente.
export async function duplicateNameWarning(db, name, excludeId) {
  const { key } = normalizeName(name);
  if (!key) return null;
  const all = await db.players.toArray();
  const other = all.find((p) => p.id !== excludeId && (normalizeName(p.jerseyName).key === key || normalizeName(p.fullName).key === key));
  return other ? `Ya hay un jugador con un nombre equivalente («${playerLabel(other)}»). Comprueba que no es el mismo.` : null;
}

export async function addAlias(db, playerId, source, rawText, opts) {
  if (!SOURCES.includes(source)) throw new Error('La fuente del alias no es válida.');
  const text = cleanName(rawText);
  if (!text) throw new Error('El texto del alias es obligatorio.');
  if (!(await db.players.get(playerId))) throw new Error('El jugador no existe.');
  const sameSource = await db.playerAliases.where('source').equals(source).toArray();
  const dup = sameSource.find((a) => a.rawText === text);
  if (dup) {
    if (dup.playerId === playerId) throw new Error('Ese alias ya existe para este jugador.');
    const owner = await db.players.get(dup.playerId);
    throw new Error(`Ese alias de ${source} ya está vinculado a otro jugador («${owner ? playerLabel(owner) : '?'}»).`);
  }
  const { key } = normalizeName(text);
  const warnings = [];
  for (const a of sameSource) {
    if (a.playerId !== playerId && a.normalizedKey === key) {
      const owner = await db.players.get(a.playerId);
      warnings.push(`Hay un alias equivalente de ${source} («${a.rawText}») en otro jugador («${owner ? playerLabel(owner) : '?'}»): en una importación exigirá confirmación manual.`);
    }
  }
  const id = await db.playerAliases.add({ playerId, source, rawText: text, normalizedKey: key, confirmedAt: new Date().toISOString(), ...syntheticFields(opts) });
  await audit(db, 'alias-anadido', { jugadorId: playerId, aliasId: id, fuente: source });
  return { id, warnings };
}

export async function removeAlias(db, id) {
  const alias = await db.playerAliases.get(id);
  if (!alias) throw new Error('El alias no existe.');
  await db.playerAliases.delete(id);
  await audit(db, 'alias-eliminado', { jugadorId: alias.playerId, aliasId: id, fuente: alias.source });
}

// Rellena el nombre completo de jugadores antiguos con su alias de VALD (idempotente; no toca a quien ya lo tiene).
export async function backfillFullNames(db) {
  const players = await db.players.filter((p) => !p.fullName).toArray();
  if (!players.length) return 0;
  const vald = await db.playerAliases.where('source').equals('VALD').toArray();
  let n = 0;
  for (const p of players) {
    const a = vald.filter((x) => x.playerId === p.id).sort((x, y) => String(x.confirmedAt).localeCompare(String(y.confirmedAt)))[0];
    if (a) { await db.players.update(p.id, { fullName: a.rawText }); n++; }
  }
  return n;
}

// Candidatos para un nombre de origen. NUNCA decide el vínculo: devuelve propuestas (con nivel alta/media/baja) y si exigen confirmación manual.
// Busca por parecido en nombre completo, alias (camiseta) y alias guardados, sin acentos y con nombre y apellido.
export async function findCandidates(db, text, { source } = {}) {
  const target = normalizeName(text);
  if (!target.key) return { candidates: [], requiresManual: true, reasons: ['Nombre vacío.'] };
  const players = await db.players.toArray();
  const aliases = await db.playerAliases.toArray();
  const byId = new Map(players.map((p) => [p.id, p]));
  const byPlayer = new Map();
  const add = (player, via, candidateText, alias) => {
    const cmp = compareNames(text, candidateText);
    const sim = cmp.sameKey ? { level: 'alta', score: 1, why: 'mismo nombre (sin contar acentos)' } : similarity(text, candidateText);
    if (!sim.level) return;
    const entry = byPlayer.get(player.id) ?? { player, matches: [], level: null, score: 0, why: '' };
    entry.matches.push({ via, text: candidateText, alias: alias ?? null, exact: cmp.exact, changesEnye: cmp.sameKey && cmp.changesEnye, level: sim.level, score: sim.score, why: sim.why });
    if (!entry.level || RANK[sim.level] > RANK[entry.level] || (sim.level === entry.level && sim.score > entry.score)) { entry.level = sim.level; entry.score = sim.score; entry.why = sim.why; }
    byPlayer.set(player.id, entry);
  };
  for (const p of players) {
    add(p, 'camiseta', p.jerseyName);
    if (p.fullName && p.fullName !== p.jerseyName) add(p, 'nombre completo', p.fullName);
  }
  for (const a of aliases) {
    if (source && a.source !== source && a.source !== 'VALD') continue; // los alias de otras fuentes no se miran; VALD sí (es el nombre completo)
    const p = byId.get(a.playerId);
    if (p) add(p, `alias ${a.source}`, a.rawText, a);
  }
  let candidates = [...byPlayer.values()].sort((x, y) => RANK[y.level] - RANK[x.level] || y.score - x.score);
  if (candidates.some((c) => c.level === 'alta')) candidates = candidates.filter((c) => c.level !== 'baja'); // un parecido parcial no compite con uno completo
  candidates = candidates.slice(0, 8);
  const altas = candidates.filter((c) => c.level === 'alta');
  const reasons = [];
  if (candidates.length === 0) reasons.push('Ningún jugador se parece a este nombre.');
  else {
    if (altas.length > 1) reasons.push('Más de un jugador encaja: elige con cuidado.');
    if (altas.length === 0) reasons.push('Solo hay parecidos parciales (coincide una palabra): comprueba que es el mismo jugador.');
    if (candidates.some((c) => c.matches.some((m) => m.changesEnye))) reasons.push('La equivalencia cambia ñ por n.');
  }
  const sure = altas.length === 1 && !altas[0].matches.some((m) => m.changesEnye);
  return { candidates, requiresManual: !sure, reasons, autoLink: false };
}

// ---------- Unificar y eliminar jugadores ----------
const PLAYER_TABLES = ['sessions', 'fvProfiles', 'anthropometry', 'targets', 'playerPositions', 'playerAliases'];

// Cuántos registros cuelgan de un jugador (para decidir si se puede eliminar y para avisar al unificar).
export async function playerDataCounts(db, id) {
  const out = {};
  for (const t of PLAYER_TABLES) out[t] = await db[t].where('playerId').equals(id).count();
  return out;
}

// Elimina un jugador SOLO si no tiene sesiones, perfiles carga-velocidad, antropometría ni targets. Sus alias y su historial de posiciones se borran con él.
export async function deleteEmptyPlayer(db, id) {
  return db.transaction('rw', [db.players, ...PLAYER_TABLES.map((t) => db[t]), db.auditLog], async () => {
    if (!(await db.players.get(id))) throw new Error('El jugador no existe.');
    const c = await playerDataCounts(db, id);
    const withData = c.sessions + c.fvProfiles + c.anthropometry + c.targets;
    if (withData > 0) throw new Error(`No se puede eliminar: tiene datos guardados (${c.sessions} sesiones, ${c.anthropometry} mediciones antropométricas, ${c.fvProfiles} perfiles carga-velocidad, ${c.targets} targets). Para conservarlo sin usarlo, desactívalo; si es un duplicado, unifícalo con el otro.`);
    await db.playerAliases.where('playerId').equals(id).delete();
    await db.playerPositions.where('playerId').equals(id).delete();
    await db.players.delete(id);
    await audit(db, 'jugador-eliminado', { jugadorId: id });
  });
}

// Elimina un jugador Y todo lo suyo (sesiones, perfiles carga-velocidad, antropometría, targets individuales, alias y posiciones). Permanente.
// La auditoría guarda solo identificadores y recuentos, nunca valores.
export async function deletePlayerWithData(db, id) {
  return db.transaction('rw', [db.players, ...PLAYER_TABLES.map((t) => db[t]), db.auditLog], async () => {
    if (!(await db.players.get(id))) throw new Error('El jugador no existe.');
    const borrados = {};
    for (const t of PLAYER_TABLES) borrados[t] = await db[t].where('playerId').equals(id).delete();
    await db.players.delete(id);
    await audit(db, 'jugador-eliminado', { jugadorId: id, borrados });
    return borrados;
  });
}

// Unifica dos fichas del mismo jugador: todo lo de «dropId» pasa a «keepId» y «dropId» desaparece. Nada se sobrescribe: si ambos tienen peso de referencia o nombre completo, gana el de keepId.
// Los nombres de la ficha eliminada quedan como alias de la que se conserva (para que futuras importaciones la encuentren). Las sesiones no se fusionan: si hay dos del mismo test, protocolo, fecha y hora
// se conservan ambas y se devuelven en «posiblesDuplicadas» para que las revises.
export async function mergePlayers(db, keepId, dropId) {
  if (keepId === dropId) throw new Error('Elige dos jugadores distintos.');
  return db.transaction('rw', [db.players, ...PLAYER_TABLES.map((t) => db[t]), db.auditLog], async () => {
    const keep = await db.players.get(keepId), drop = await db.players.get(dropId);
    if (!keep || !drop) throw new Error('Alguno de los jugadores no existe.');
    const moved = {};
    for (const t of PLAYER_TABLES.filter((x) => x !== 'playerAliases')) moved[t] = await db[t].where('playerId').equals(dropId).modify({ playerId: keepId });
    // alias: se mueven; si ya hay uno igual (misma fuente y texto) se descarta el repetido
    const mine = await db.playerAliases.where('playerId').equals(keepId).toArray();
    const theirs = await db.playerAliases.where('playerId').equals(dropId).toArray();
    moved.playerAliases = 0;
    for (const a of theirs) {
      if (mine.some((m) => m.source === a.source && m.rawText === a.rawText)) await db.playerAliases.delete(a.id);
      else { await db.playerAliases.update(a.id, { playerId: keepId }); moved.playerAliases++; }
    }
    // los nombres de la ficha eliminada, como alias (fuente «Otra») si todavía no los tiene ninguna ficha
    const all = await db.playerAliases.toArray();
    for (const text of [cleanName(drop.jerseyName), cleanName(drop.fullName)].filter(Boolean)) {
      if (text === cleanName(keep.jerseyName) || text === cleanName(keep.fullName)) continue;
      if (all.some((a) => a.rawText === text && a.playerId === keepId)) continue;
      if (all.some((a) => a.source === 'Otra' && a.rawText === text)) continue;
      await db.playerAliases.add({ playerId: keepId, source: 'Otra', rawText: text, normalizedKey: normalizeName(text).key, confirmedAt: new Date().toISOString(), ...(keep.synthetic ? { synthetic: 1 } : {}) });
      moved.playerAliases++;
    }
    const patch = { updatedAt: new Date().toISOString() };
    if (!cleanName(keep.fullName) && cleanName(drop.fullName)) patch.fullName = cleanName(drop.fullName);
    if (!keep.referenceWeight && drop.referenceWeight) patch.referenceWeight = drop.referenceWeight;
    if (!keep.active && drop.active) patch.active = true;
    if (!String(keep.notes ?? '').trim() && String(drop.notes ?? '').trim()) patch.notes = drop.notes;
    await db.players.update(keepId, patch);
    await db.players.delete(dropId);
    const sess = await db.sessions.where('playerId').equals(keepId).toArray();
    const seen = new Map(); let posiblesDuplicadas = 0;
    for (const s of sess) { const k = `${s.testId}|${s.protocolId ?? ''}|${s.date}|${s.time ?? ''}`; if (seen.has(k)) posiblesDuplicadas++; else seen.set(k, 1); }
    await audit(db, 'jugadores-unificados', { conservado: keepId, eliminado: dropId, movidos: moved, posiblesDuplicadas });
    return { moved, posiblesDuplicadas };
  });
}
