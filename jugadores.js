// jugadores.js — jugadores y alias por fuente. El nombre en camiseta es el nombre visible.
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

export async function createPlayer(db, { jerseyName, notes = '' }, opts) {
  const name = cleanName(jerseyName);
  if (!name) throw new Error('El nombre en camiseta es obligatorio.');
  const now = new Date().toISOString();
  const id = await db.players.add({ jerseyName: name, notes: String(notes ?? '').trim(), active: true, createdAt: now, updatedAt: now, ...syntheticFields(opts) });
  await audit(db, 'jugador-creado', { jugadorId: id });
  return id;
}

export async function updatePlayer(db, id, { jerseyName, notes }) {
  const player = await db.players.get(id);
  if (!player) throw new Error('El jugador no existe.');
  const patch = { updatedAt: new Date().toISOString() };
  if (jerseyName !== undefined) {
    const name = cleanName(jerseyName);
    if (!name) throw new Error('El nombre en camiseta es obligatorio.');
    patch.jerseyName = name;
  }
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
  const other = all.find((p) => p.id !== excludeId && normalizeName(p.jerseyName).key === key);
  return other ? `Ya hay un jugador con un nombre equivalente («${other.jerseyName}»). Comprueba que no es el mismo.` : null;
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
    throw new Error(`Ese alias de ${source} ya está vinculado a otro jugador («${owner?.jerseyName ?? '?'}»).`);
  }
  const { key } = normalizeName(text);
  const warnings = [];
  for (const a of sameSource) {
    if (a.playerId !== playerId && a.normalizedKey === key) {
      const owner = await db.players.get(a.playerId);
      warnings.push(`Hay un alias equivalente de ${source} («${a.rawText}») en otro jugador («${owner?.jerseyName ?? '?'}»): en una importación exigirá confirmación manual.`);
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

// Candidatos para un nombre de origen. NUNCA decide el vínculo: devuelve propuestas y si exigen confirmación manual.
export async function findCandidates(db, text, { source } = {}) {
  const target = normalizeName(text);
  if (!target.key) return { candidates: [], requiresManual: true, reasons: ['Nombre vacío.'] };
  const players = await db.players.toArray();
  const aliases = await db.playerAliases.toArray();
  const byPlayer = new Map();
  const add = (player, via, candidateText, alias) => {
    const cmp = compareNames(text, candidateText);
    if (!cmp.sameKey) return;
    const entry = byPlayer.get(player.id) ?? { player, matches: [] };
    entry.matches.push({ via, text: candidateText, alias: alias ?? null, exact: cmp.exact, changesEnye: cmp.changesEnye });
    byPlayer.set(player.id, entry);
  };
  for (const p of players) add(p, 'camiseta', p.jerseyName);
  for (const a of aliases) {
    if (source && a.source !== source) continue;
    const p = players.find((x) => x.id === a.playerId);
    if (p) add(p, `alias ${a.source}`, a.rawText, a);
  }
  const candidates = [...byPlayer.values()];
  const reasons = [];
  if (candidates.length > 1) reasons.push('Más de un jugador coincide.');
  if (candidates.some((c) => !c.matches.some((m) => m.exact))) reasons.push('La coincidencia no es exacta (mayúsculas, espacios o acentos).');
  if (candidates.some((c) => c.matches.some((m) => m.changesEnye))) reasons.push('La equivalencia cambia ñ por n.');
  if (candidates.length === 0) reasons.push('Ningún jugador coincide.');
  return { candidates, requiresManual: reasons.length > 0, reasons, autoLink: false };
}
