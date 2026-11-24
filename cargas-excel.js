// cargas-excel.js — importación de CARGAS (Iso-Hold y 12RM) desde un Excel con una columna de jugadores y una columna de carga (kg).
// Pensado para los libros del usuario (hojas HIP / ANKLE / KNEE con «ADDED EXTERNAL LOAD» / «EXTERNAL LOAD ADDED»). El Excel no trae fecha: se elige una para toda la importación.
// Cada carga se guarda con addManualLoad (una sesión manual, sin repeticiones); las variables calculadas se obtienen solas. No se leen fórmulas: solo los valores de la columna de carga.
import { addManualLoad, LOAD_VARIABLE_NAMES } from './isohold.js';
import { findCandidates, addAlias } from './jugadores.js';
import { audit } from './db.js';
import { mismoTest } from './nombres.js';
import { LEG_PRESS_BILATERAL, LEG_PRESS_UNILATERAL } from './catalogo-inicial.js';

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

// ---- Libros con medida BILATERAL y POR PIERNA en la misma hoja (23/11/2026, Leg Press 45° 8RM) ----
// Cabeceras reconocidas en las 8 primeras filas: bilateral «DOUBLE LEG» o «BILATERAL»; por pierna «IZQUIERDA» (también «IZQIUERDA», la errata del libro
// del usuario) o «LEFT», y «DERECHA» o «RIGHT». Las columnas «RELATIVO A PESO INDIVIDUAL» y «ASYMMETRY» se IGNORAN a propósito: el dashboard calcula el
// relativo y la asimetría, y en el libro del usuario varias de esas celdas vienen vacías aunque haya cargas. La columna de peso tampoco se lee: la masa
// sale de la antropometría más cercana a la fecha, o del peso de referencia (criterio del usuario del 23/11/2026).
const DOBLE_HEADER = /^(double[\s-]*leg|bilateral|doble)/i;
const IZQ_HEADER = /^(izq[a-zá]*|left|i)$/i;
const DER_HEADER = /^(der[a-zá]*|right|d)$/i;
const esCabeceraLado = (x) => IZQ_HEADER.test(cellText(x)) || DER_HEADER.test(cellText(x));

export function parseTwoWaySheet(rows) {
  const grid = Array.isArray(rows) ? rows : [];
  let headerRow = -1;
  for (let r = 0; r < Math.min(8, grid.length) && headerRow < 0; r++) {
    const fila = grid[r] ?? [];
    if (fila.some((x) => DOBLE_HEADER.test(cellText(x))) || fila.some(esCabeceraLado)) headerRow = r;
  }
  if (headerRow < 0) return { ok: false, reason: 'No se encuentran columnas de medida bilateral («DOUBLE LEG») ni por pierna («IZQUIERDA» / «DERECHA») en las primeras filas.', rows: [] };
  const cab = grid[headerRow] ?? [];
  const dobleCol = cab.findIndex((x) => DOBLE_HEADER.test(cellText(x)));
  const izqCol = cab.findIndex((x) => IZQ_HEADER.test(cellText(x)));
  const derCol = cab.findIndex((x) => DER_HEADER.test(cellText(x)));
  if (dobleCol < 0 && (izqCol < 0 || derCol < 0)) return { ok: false, reason: 'Falta alguna columna: hace falta la bilateral («DOUBLE LEG») o las dos por pierna («IZQUIERDA» y «DERECHA»).', rows: [] };
  const body = grid.slice(headerRow + 1);
  const usadas = new Set([dobleCol, izqCol, derCol].filter((c) => c >= 0));
  const textCount = (c) => body.filter((row) => cellText(row?.[c]) && Number.isNaN(Number(String(row[c]).replace(',', '.')))).length;
  const nameCol = [0, 1, 2].filter((c) => !usadas.has(c)).sort((a, b) => textCount(b) - textCount(a) || a - b)[0] ?? 0;
  const kilos = (raw, etiqueta, inc) => {
    if (raw === null || raw === undefined || cellText(raw) === '') return null;
    const x = typeof raw === 'number' ? raw : Number(cellText(raw).replace(',', '.'));
    if (!Number.isFinite(x) || x < 0 || x > 1000) { inc.push(`${etiqueta} no válida («${cellText(raw)}»): debe ser un número entre 0 y 1000 kg.`); return null; }
    return x;
  };
  const out = [];
  body.forEach((row, i) => {
    const name = cellText(row?.[nameCol]);
    if (!name) return;
    const inc = [];
    const doble = dobleCol >= 0 ? kilos(row?.[dobleCol], 'Carga bilateral', inc) : null;
    const izq = izqCol >= 0 ? kilos(row?.[izqCol], 'Carga izquierda', inc) : null;
    const der = derCol >= 0 ? kilos(row?.[derCol], 'Carga derecha', inc) : null;
    out.push({ name, doble, izq, der, rowNumber: headerRow + i + 2, empty: doble === null && izq === null && der === null, error: inc.join(' ') || undefined });
  });
  const title = grid.slice(0, headerRow + 1).flat().map(cellText).join(' ');
  return { ok: true, headerRow, nameCol, dobleCol, izqCol, derCol, rows: out, title };
}

// Propuesta de pareja de tests (bilateral y unilateral) a partir del nombre de la hoja y los títulos. Devuelve { doble, uni } con los tests o null.
export function guessTwoWayTests(sheetName, title, tests) {
  const txt = `${sheetName} ${title}`.toLowerCase();
  if (!/leg\s*press|prensa/.test(txt)) return { doble: null, uni: null };
  const busca = (n) => tests.find((t) => mismoTest(t.name, n)) ?? null;
  return { doble: busca(LEG_PRESS_BILATERAL), uni: busca(LEG_PRESS_UNILATERAL) };
}

// Guarda las dos medidas. items: [{ name, playerId, doble, izq, der, remember }]. Crea una sesión en el test bilateral y otra en el unilateral, solo
// donde haya dato. Las duplicadas (mismo jugador, test y fecha) se omiten sin error, igual que en el resto de importaciones.
export async function commitTwoWay(db, { testDobleId, testUniId, date, items }) {
  const res = { creadasDoble: 0, creadasUni: 0, duplicadas: 0, omitidas: 0, alias: 0, incidencias: [] };
  const vistos = new Set();
  for (const it of items) {
    if (!it.playerId) { res.omitidas++; continue; }
    if (vistos.has(it.playerId)) { res.incidencias.push(`«${it.name}»: el jugador aparece dos veces en el Excel; solo se importa la primera fila.`); res.omitidas++; continue; }
    vistos.add(it.playerId);
    const guarda = async (testId, datos, cual) => {
      if (!testId) return;
      try { await addManualLoad(db, { playerId: it.playerId, testId, date, ...datos }); res[cual]++; }
      catch (e) {
        if (/Ya hay una sesión/.test(e.message)) res.duplicadas++;
        else { res.incidencias.push(`«${it.name}» (${cual === 'creadasDoble' ? 'bilateral' : 'por pierna'}): ${e.message}`); res.omitidas++; }
      }
    };
    if (it.doble != null) await guarda(testDobleId, { load: it.doble }, 'creadasDoble');
    if (it.izq != null || it.der != null) await guarda(testUniId, { loadL: it.izq, loadR: it.der }, 'creadasUni');
    if (it.doble == null && it.izq == null && it.der == null) { res.omitidas++; continue; }
    if (it.remember) { try { await addAlias(db, it.playerId, 'Excel', it.name); res.alias++; } catch { /* alias ya existente o en conflicto: no impide la importación */ } }
  }
  await audit(db, 'importacion-cargas-dos-medidas', { testDobleId, testUniId, date, creadasDoble: res.creadasDoble, creadasUni: res.creadasUni, duplicadas: res.duplicadas, omitidas: res.omitidas });
  return res;
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
