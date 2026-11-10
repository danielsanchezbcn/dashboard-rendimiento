// cargas-excel.js — importación de CARGAS (Iso-Hold y 12RM) desde un Excel con una columna de jugadores y una columna de carga (kg).
// Pensado para los libros del usuario (hojas HIP / ANKLE / KNEE con «ADDED EXTERNAL LOAD» / «EXTERNAL LOAD ADDED»). El Excel no trae fecha: se elige una para toda la importación.
// Cada carga se guarda con addManualLoad (una sesión manual, sin repeticiones); las variables calculadas se obtienen solas. No se leen fórmulas: solo los valores de la columna de carga.
import { addManualLoad, LOAD_VARIABLE_NAMES } from './isohold.js';
import { findCandidates, addAlias } from './jugadores.js';
import { audit } from './db.js';

const lc = (s) => String(s ?? '').trim().toLowerCase();
const LOAD_HEADER = /(added\s+external\s+load|external\s+load(\s+added)?|carga\s+(externa|a[ñn]adida|m[aá]xima))/i;
const cellText = (c) => (c === null || c === undefined ? '' : String(c).trim());

// Localiza la columna de carga (cabecera en las 8 primeras filas) y la de nombres (A por defecto; si no hay nombres ahí, la primera de las tres primeras con texto).
export function parseLoadSheet(rows) {
  const grid = Array.isArray(rows) ? rows : [];
  let headerRow = -1, loadCol = -1;
  for (let r = 0; r < Math.min(8, grid.length) && headerRow < 0; r++) {
    const c = (grid[r] ?? []).findIndex((x) => LOAD_HEADER.test(cellText(x)));
    if (c >= 0) { headerRow = r; loadCol = c; }
  }
  if (headerRow < 0) return { ok: false, reason: 'No se encuentra una columna de carga («ADDED EXTERNAL LOAD», «EXTERNAL LOAD ADDED» o «Carga externa») en las primeras filas.', rows: [] };
  const body = grid.slice(headerRow + 1);
  const textCount = (c) => body.filter((row) => cellText(row?.[c]) && Number.isNaN(Number(String(row[c]).replace(',', '.')))).length;
  const nameCol = [0, 1, 2].filter((c) => c !== loadCol).sort((a, b) => textCount(b) - textCount(a) || a - b)[0];
  const out = [];
  body.forEach((row, i) => {
    const name = cellText(row?.[nameCol]);
    if (!name) return;
    const raw = row?.[loadCol];
    if (raw === null || raw === undefined || cellText(raw) === '') { out.push({ name, load: null, rowNumber: headerRow + i + 2, empty: true }); return; }
    const x = typeof raw === 'number' ? raw : Number(cellText(raw).replace(',', '.'));
    if (!Number.isFinite(x) || x < 0 || x > 1000) out.push({ name, load: null, rowNumber: headerRow + i + 2, error: `Carga no válida («${cellText(raw)}»): debe ser un número entre 0 y 1000 kg.` });
    else out.push({ name, load: x, rowNumber: headerRow + i + 2 });
  });
  const title = grid.slice(0, headerRow + 1).flat().map(cellText).join(' ');
  return { ok: true, headerRow, loadCol, nameCol, rows: out, title };
}

// Tests con una variable de carga que se introduce a mano (los mismos que el alta manual).
export const loadTests = (catalog) => catalog.tests.filter((t) => !t.archived && catalog.variables.some((v) => v.testId === t.id && !v.archived && v.kind !== 'derived' && LOAD_VARIABLE_NAMES.some((n) => lc(n) === lc(v.name))));

// Propuesta de test a partir del nombre de la hoja y los títulos del libro (HIP / KNEE / ANKLE, o «seated calf», «12RM»). Devuelve null si no es concluyente.
export function guessLoadTest(sheetName, title, tests) {
  const txt = `${sheetName} ${title}`.toLowerCase();
  const kw = /seated/.test(txt) && /calf|gemelo|soleo/.test(txt) ? 'seated calf' : /12\s*rm/.test(txt) ? '12rm' : /\bhip\b|cadera/.test(txt) ? 'hip' : /\bknee\b|rodilla/.test(txt) ? 'knee' : /\bankle\b|tobillo|gastroc/.test(txt) ? 'ankle' : null;
  if (!kw) return null;
  let hits = tests.filter((t) => lc(t.name).includes(kw));
  if (hits.length > 1) hits = hits.filter((t) => /iso-hold/.test(lc(t.name)) && !(kw !== 'seated calf' && /seated/.test(lc(t.name)))); // las hojas HIP / KNEE / ANKLE de los libros son de Iso-Hold
  return hits.length === 1 ? hits[0] : null;
}

// Vincula cada nombre del Excel con un jugador: automático solo si hay un único candidato de coincidencia completa (misma regla que el resto de importaciones).
export async function proposeLinks(db, names) {
  const out = {};
  for (const n of [...new Set(names)]) {
    const f = await findCandidates(db, n, { source: 'Excel' });
    out[n] = { candidates: f.candidates.map((c) => ({ id: c.player.id, level: c.level })), autoId: !f.requiresManual ? f.candidates.find((c) => c.level === 'alta')?.player.id ?? null : null, reasons: f.reasons };
  }
  return out;
}

// Guarda las cargas elegidas. items: [{ name, playerId (o null = omitir), load, remember }]. Devuelve el recuento y las incidencias; las duplicadas (mismo jugador, test y fecha) se omiten sin error.
export async function commitLoads(db, { testId, date, items }) {
  const res = { creadas: 0, duplicadas: 0, omitidas: 0, alias: 0, incidencias: [] };
  const seen = new Set();
  for (const it of items) {
    if (!it.playerId || it.load == null) { res.omitidas++; continue; }
    if (seen.has(it.playerId)) { res.incidencias.push(`«${it.name}»: el jugador aparece dos veces en el Excel; solo se importa la primera fila.`); res.omitidas++; continue; }
    seen.add(it.playerId);
    try {
      await addManualLoad(db, { playerId: it.playerId, testId, date, load: it.load });
      res.creadas++;
      if (it.remember) { try { await addAlias(db, it.playerId, 'Excel', it.name); res.alias++; } catch { /* alias ya existente o en conflicto: no impide la importación */ } }
    } catch (e) {
      if (/Ya hay una sesión/.test(e.message)) res.duplicadas++; else { res.incidencias.push(`«${it.name}»: ${e.message}`); res.omitidas++; }
    }
  }
  await audit(db, 'importacion-cargas', { testId, date, creadas: res.creadas, duplicadas: res.duplicadas, omitidas: res.omitidas });
  return res;
}
