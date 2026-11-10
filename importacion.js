// importacion.js — importación de Excel propio (fase 3). Formato admitido: UNA FILA POR JUGADOR (y fecha) y UNA COLUMNA POR VARIABLE.
//
// Reglas (guía y decisiones):
//  · Nada se vincula en silencio: cada nombre distinto de cada lote se confirma (vincular / jugador nuevo / sin resolver).
//  · Una celda vacía es «no hay dato», nunca 0. No se importan valores relativos, asimetrías ni percentiles: se calculan después.
//  · Cada fila válida es una SESIÓN con el valor (media de la sesión) de cada lado y su número de repeticiones (D8).
//    Si no hay columna de repeticiones se guarda 1 y se marca «repsAssumed» (un único valor = una repetición).
//  · Una repetición exacta se omite de forma idempotente. Si coinciden jugador, test, fecha y hora pero los valores difieren,
//    NO se sobrescribe nada: el usuario elige omitir o guardar como sesión nueva.
//  · No se crean repeticiones sueltas a partir de resúmenes.

import { audit } from './db.js';
import { isIsoDay } from './fechas.js';
import { normalizeName, findCandidates, createPlayer, addAlias, updatePlayer, playerLabel } from './jugadores.js';
import { addAnthropometry, setReferenceWeight } from './antropometria.js';

export const ROLES = {
  ignorar: 'Ignorar esta columna',
  jugador: 'Jugador',
  fecha: 'Fecha',
  hora: 'Hora',
  reps: 'Repeticiones (total)',
  repsL: 'Repeticiones izquierda',
  repsR: 'Repeticiones derecha',
  peso: 'Peso de referencia del jugador (kg)',
  altura: 'Altura del jugador (cm)',
  pierna: 'Longitud de pierna / palanca (m)',
  valor: 'Valor de una variable',
};
export const SIDE_LABELS = { L: 'Izquierdo', R: 'Derecho', S: 'Único' };
export const IMPORT_SOURCE = 'Excel';
// Rangos de plausibilidad de peso y altura de jugadores adultos: fuera de ellos la fila no se importa (suele ser otra unidad: g, lb, m).
export const RANGO_PESO = [45, 130]; // kg
export const RANGO_ALTURA = [140, 215]; // cm
export const RANGO_PIERNA = [0.4, 1.4]; // m (longitud de extremidad inferior / palanca de las pruebas de cadera)

const blank = (v) => v === null || v === undefined || (typeof v === 'string' && v.trim() === '');
const txt = (v) => (blank(v) ? '' : v instanceof Date ? v.toISOString().slice(0, 10) : String(v).trim());

// ---------- Lectura de celdas ----------
export function parseNumber(v) {
  if (blank(v)) return { empty: true };
  if (typeof v === 'number') return Number.isFinite(v) ? { value: v } : { error: 'no es un número' };
  if (typeof v === 'boolean' || v instanceof Date) return { error: 'no es un número' };
  const s = String(v).trim();
  if (/^-?\d+([.,]\d+)?$/.test(s)) return { value: Number(s.replace(',', '.')) };
  if (/^-?\d{1,3}([.,]\d{3})+([.,]\d+)?$/.test(s)) return { error: `«${s}» tiene separador de miles: escríbelo sin él` };
  return { error: `«${s}» no es un número` };
}

export function parseDateCell(v) {
  if (blank(v)) return { empty: true };
  if (v instanceof Date) {
    if (Number.isNaN(v.getTime())) return { error: 'fecha no válida' };
    return { value: v.toISOString().slice(0, 10) };
  }
  if (typeof v === 'number') return { error: 'la celda tiene un número, no una fecha (dale formato de fecha en Excel)' };
  const s = String(v).trim();
  let iso = null;
  let m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (m) iso = s;
  m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(s);
  if (m) iso = `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  if (iso && isIsoDay(iso)) return { value: iso };
  return { error: `«${s}» no es una fecha válida (usa día/mes/año o AAAA-MM-DD)` };
}

export function parseTimeCell(v) {
  if (blank(v)) return { empty: true };
  if (v instanceof Date) return { value: v.toISOString().slice(11, 16) };
  const s = String(v).trim();
  let m = /^(\d{1,2}):(\d{2})(?::\d{2})?\s*([AaPp][Mm])?$/.exec(s);
  if (!m) return { error: `«${s}» no es una hora válida (HH:MM)` };
  let h = Number(m[1]);
  const min = Number(m[2]);
  if (m[3]) {
    const pm = /p/i.test(m[3]);
    if (h < 1 || h > 12) return { error: `«${s}» no es una hora válida` };
    h = (h % 12) + (pm ? 12 : 0);
  }
  if (h > 23 || min > 59) return { error: `«${s}» no es una hora válida` };
  return { value: `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}` };
}

export function parseReps(v) {
  const n = parseNumber(v);
  if (n.empty || n.error) return n.empty ? n : { error: n.error };
  if (!Number.isInteger(n.value) || n.value < 1) return { error: 'las repeticiones deben ser un entero de 1 o más' };
  return { value: n.value };
}

// ---------- Encabezados y propuesta de mapeo ----------
// Letras de columna (A, B, … Z, AA…) para ficheros sin encabezados.
export const colLetter = (i) => { let n = i + 1, s = ''; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; };
// Encabezados genéricos «Columna A…» para un fichero sin fila de encabezados (ancho = la fila más larga de las filas de datos).
export function genericHeaders(rows, firstDataRow = 0) {
  let w = 0;
  for (let r = firstDataRow; r < Math.min(rows.length, firstDataRow + 500); r++) { const line = rows[r] ?? []; for (let i = line.length - 1; i >= w; i--) if (!blank(line[i])) { w = i + 1; break; } }
  return Array.from({ length: Math.min(w, 60) }, (_, i) => `Columna ${colLetter(i)}`);
}
// ¿La fila elegida como encabezado parece una fila de datos (tiene números)? Solo sirve para avisar; nunca decide.
export const looksLikeData = (row) => (row ?? []).some((c) => typeof c === 'number');

export function detectHeaderRow(rows) {
  const i = rows.findIndex((r) => r.filter((c) => !blank(c)).length >= 2);
  return i < 0 ? 0 : i;
}

// Segunda fila de encabezado: la fila siguiente indica el lado (LEFT / RIGHT / ASYMMETRY) y el nombre de la variable solo aparece
// en la primera columna del grupo. Se propone si la fila siguiente tiene ≥ 2 celdas de texto y casi todas son palabras de lado/asimetría.
const SUB_WORDS = ['izq', 'izquierda', 'izquierdo', 'left', 'der', 'derecha', 'derecho', 'right', 'asimetria', 'asymmetry', 'asim', 'diff', 'diferencia'];
// Segunda fila de encabezado: celdas que son solo un lado («LEFT») o que empiezan por una palabra de lado/asimetría («LEFT HAMS», «RIGHT SHIN vs LEFT THIGH», «ASYMMETRY»).
const SIDE_FIRST = ['left', 'right', 'izquierda', 'izquierdo', 'derecha', 'derecho', 'asymmetry', 'asimetria'];
const sideFirst = (c) => { const w = normalizeName(String(c)).key.split(' ')[0]; return SIDE_FIRST.includes(w) ? w : null; };
export function detectSubHeader(grid, headerRow) {
  const row = grid[headerRow + 1] ?? [];
  const cells = row.filter((c) => !blank(c));
  if (cells.length < 2 || cells.some((c) => typeof c === 'number' || c instanceof Date)) return false;
  const hits = cells.filter((c) => SUB_WORDS.includes(normalizeName(String(c)).key) || sideFirst(c)).length;
  return hits >= 2 && hits / cells.length >= 0.6;
}
// Encabezados efectivos: con segunda fila, «nombre» (repetido hacia la derecha en las celdas vacías) + «lado».
// Si la celda de la segunda fila empieza por el lado («LEFT HAMS»), solo se toma esa palabra: el nombre de la variable es el de la fila superior.
// Si no es un lado (p. ej. «(fingers-floor distance)») y la superior tiene texto, manda la superior.
export function effectiveHeaders(grid, headerRow, subHeader) {
  const top = grid[headerRow] ?? [];
  if (!subHeader) return top.map(txt);
  const sub = grid[headerRow + 1] ?? [];
  const n = Math.max(top.length, sub.length);
  const out = [];
  let last = '';
  for (let i = 0; i < n; i++) {
    const t = txt(top[i]), u = txt(sub[i]);
    if (t) last = t;
    if (!u) { out.push(t); continue; }
    const w = sideFirst(u);
    if (w) { out.push(`${t || last} ${u.split(/\s+/)[0]}`.trim()); continue; }
    if (t && !SUB_WORDS.includes(normalizeName(u).key)) { out.push(t); continue; }
    out.push(`${t || last} ${u}`.trim());
  }
  return out;
}
export const dataStartRow = (mapping) => mapping.headerRow + 1 + (mapping.subHeader ? 1 : 0);

const SIDE_WORDS = { L: ['izq', 'izquierda', 'izquierdo', 'left', 'l'], R: ['der', 'derecha', 'derecho', 'right', 'r'] };
const ROLE_WORDS = {
  jugador: ['jugador', 'nombre', 'player', 'atleta', 'athlete', 'name'],
  fecha: ['fecha', 'date'],
  hora: ['hora', 'time'],
  reps: ['reps', 'repeticiones', 'repeticiones totales', 'n reps'],
  peso: ['peso', 'peso corporal', 'bodyweight', 'bodyweight kg', 'bodyweight (kg)', 'body weight', 'peso kg', 'peso (kg)', 'weight', 'weight kg', 'weight (kg)', 'body mass', 'peso referencia', 'peso de referencia', 'reference weight', 'bw', 'masa', 'masa corporal'],
  pierna: ['palanca', 'lever', 'lever length', 'lever lenght', 'longitud de palanca', 'longitud pierna', 'longitud de pierna', 'leg length', 'longitud extremidad inferior'],
  altura: ['altura', 'altura cm', 'altura (cm)', 'height', 'height cm', 'height (cm)', 'estatura', 'talla'],
};

// Propuesta (nunca decide): solo coincidencias exactas del encabezado con roles habituales o con el nombre de una variable,
// con el lado si el encabezado lo indica con una palabra clara. El usuario revisa y corrige todo en pantalla.
export function suggestMapping(headers, variables) {
  const raw = variables.filter((v) => v.kind === 'raw' && !v.archived);
  const used = new Set();
  return headers.map((h) => {
    const key = normalizeName(h).key;
    if (!key) return { role: 'ignorar' };
    for (const [role, words] of Object.entries(ROLE_WORDS)) {
      if (words.includes(key) && !used.has(role)) { used.add(role); return { role }; }
    }
    let side = null;
    let base = key;
    for (const [s, words] of Object.entries(SIDE_WORDS)) {
      for (const w of words) {
        const re = new RegExp(`(^|[\\s_()\\-/])${w}($|[\\s_()\\-/])`);
        if (re.test(key)) { side = s; base = key.replace(re, ' ').replace(/[()]/g, ' ').replace(/\s+/g, ' ').trim(); break; }
      }
      if (side) break;
    }
    const flat = (x) => normalizeName(x).key.replace(/[()]/g, ' ').replace(/\s+/g, ' ').trim();
    const matches = raw.filter((v) => normalizeName(v.name).key === base || normalizeName(v.name).key === key || flat(v.name) === base);
    if (matches.length === 1) {
      const v = matches[0];
      const sd = v.sides === 'single' ? 'S' : v.sides === 'LR' ? side : side ?? 'S';
      if (sd) return { role: 'valor', variableId: v.id, side: sd };
    }
    return { role: 'ignorar' };
  });
}

// ---------- Validación del mapeo ----------
export function validateMapping(mapping, variables) {
  const errors = [];
  const cols = mapping.cols ?? [];
  const count = (role) => cols.filter((c) => c.role === role).length;
  if (count('jugador') !== 1) errors.push('Elige exactamente una columna de «Jugador».');
  if (count('fecha') > 1) errors.push('Solo puede haber una columna de «Fecha».');
  if (count('fecha') === 0 && !isIsoDay(mapping.fixedDate ?? '')) errors.push('Elige una columna de «Fecha» o indica una fecha única para todo el fichero.');
  for (const r of ['hora', 'reps', 'repsL', 'repsR', 'peso', 'altura', 'pierna']) if (count(r) > 1) errors.push(`Solo puede haber una columna de «${ROLES[r]}».`);
  const byId = new Map(variables.map((v) => [v.id, v]));
  const seen = new Set();
  const sidesByVar = new Map();
  let nValues = 0;
  cols.forEach((c, i) => {
    if (c.role !== 'valor') return;
    nValues++;
    const label = `Columna ${i + 1}`;
    const v = byId.get(Number(c.variableId));
    if (!v) { errors.push(`${label}: elige la variable.`); return; }
    if (v.kind !== 'raw') errors.push(`${label}: «${v.name}» es una variable calculada; la aplicación la calcula sola, no se importa.`);
    if (!['L', 'R', 'S'].includes(c.side)) { errors.push(`${label}: elige el lado (izquierdo, derecho o único).`); return; }
    if (v.sides === 'LR' && c.side === 'S') errors.push(`${label}: «${v.name}» tiene un valor por lado; elige izquierdo o derecho.`);
    if (v.sides === 'single' && c.side !== 'S') errors.push(`${label}: «${v.name}» tiene un valor único; elige «Único».`);
    const k = `${v.id}|${c.side}`;
    if (seen.has(k)) errors.push(`${label}: «${v.name}» (${SIDE_LABELS[c.side]}) ya está asignada a otra columna.`);
    seen.add(k);
    const set = sidesByVar.get(v.id) ?? new Set();
    set.add(c.side);
    sidesByVar.set(v.id, set);
  });
  for (const [id, set] of sidesByVar) if (set.has('S') && (set.has('L') || set.has('R'))) errors.push(`«${byId.get(id).name}»: no se puede mezclar un valor único con valores por lado.`);
  if (nValues === 0 && count('peso') + count('altura') + count('pierna') === 0) errors.push('Asigna al menos una columna a una variable del test (o una de peso / altura / pierna).');
  return errors;
}

// ---------- Interpretación de las filas ----------
// Devuelve { rows, stats }. Cada fila: { rowNumber, playerText, date, time, reps, values, issues[], ok }.
export function buildRows(grid, mapping, variables) {
  const byId = new Map(variables.map((v) => [v.id, v]));
  const cols = mapping.cols ?? [];
  const header = mapping.noHeader ? [] : effectiveHeaders(grid, mapping.headerRow, mapping.subHeader);
  const colName = (i) => (txt(header[i]) ? `«${txt(header[i])}»` : `columna ${i + 1}`);
  const idx = (role) => cols.findIndex((c) => c.role === role);
  const iPlayer = idx('jugador'), iDate = idx('fecha'), iTime = idx('hora'), iReps = idx('reps'), iRepsL = idx('repsL'), iRepsR = idx('repsR'), iPeso = idx('peso'), iAltura = idx('altura'), iPierna = idx('pierna');
  const rows = [];
  const stats = { read: 0, empty: 0 };
  for (let r = dataStartRow(mapping); r < grid.length; r++) {
    const line = grid[r] ?? [];
    if (line.every(blank)) { stats.empty++; continue; }
    stats.read++;
    const row = { rowNumber: r + 1, playerText: '', date: null, time: '', reps: null, values: {}, issues: [] };
    const err = (text) => row.issues.push({ level: 'error', text });
    row.playerText = txt(line[iPlayer]).replace(/\s+/g, ' ');
    if (!row.playerText) err('Falta el nombre del jugador.');
    if (iDate >= 0) {
      const d = parseDateCell(line[iDate]);
      if (d.empty) err('Falta la fecha.'); else if (d.error) err(`Fecha: ${d.error}.`); else row.date = d.value;
    } else row.date = mapping.fixedDate;
    if (iTime >= 0) {
      const t = parseTimeCell(line[iTime]);
      if (t.error) err(`Hora: ${t.error}.`); else if (t.value) row.time = t.value;
    }
    const reps = { total: null, L: null, R: null };
    for (const [key, i] of [['total', iReps], ['L', iRepsL], ['R', iRepsR]]) {
      if (i < 0) continue;
      const p = parseReps(line[i]);
      if (p.error) err(`${colName(i)}: ${p.error}.`); else if (p.value) reps[key] = p.value;
    }
    row.reps = reps.total === null && reps.L === null && reps.R === null ? { total: 1, L: null, R: null, assumed: true } : { ...reps, assumed: false };
    cols.forEach((c, i) => {
      if (c.role !== 'valor') return;
      const n = parseNumber(line[i]);
      if (n.empty) return;
      if (n.error) { err(`${colName(i)} (${byId.get(Number(c.variableId))?.name ?? '?'}): ${n.error}.`); return; }
      const vid = Number(c.variableId);
      row.values[vid] = { ...(row.values[vid] ?? {}), [c.side]: n.value };
    });
    row.body = {};
    for (const [key, i, rango, nombre, unidad] of [['weight', iPeso, RANGO_PESO, 'Peso', 'kg'], ['height', iAltura, RANGO_ALTURA, 'Altura', 'cm'], ['legLength', iPierna, RANGO_PIERNA, 'Longitud de pierna', 'm']]) {
      if (i < 0) continue;
      const n = parseNumber(line[i]);
      if (n.empty) continue;
      if (n.error) { err(`${colName(i)}: ${n.error}.`); continue; }
      if (n.value < rango[0] || n.value > rango[1]) { err(`${colName(i)}: ${nombre} ${n.value} ${unidad} fuera del rango admitido (${rango[0]}–${rango[1]} ${unidad}); revisa la unidad.`); continue; }
      row.body[key] = n.value;
    }
    if (!row.issues.length && Object.keys(row.values).length === 0 && Object.keys(row.body).length === 0) err('La fila no tiene ningún valor (las celdas vacías no se interpretan como 0).');
    row.ok = row.issues.every((x) => x.level !== 'error');
    rows.push(row);
  }
  return { rows, stats };
}

// ---------- Mapeos guardados (por texto de encabezado, no por posición) ----------
export async function saveMapping(db, { name, testId, protocolId = null, headers, cols }) {
  const n = String(name ?? '').trim();
  if (!n) throw new Error('Escribe un nombre para el mapeo.');
  const clean = cols.map((c, i) => ({ header: txt(headers[i]), role: c.role, variableId: c.role === 'valor' ? Number(c.variableId) : null, side: c.role === 'valor' ? c.side : null }));
  const existing = (await db.importMappings.where('testId').equals(testId).toArray()).find((m) => m.name.toLowerCase() === n.toLowerCase());
  const row = { name: n, testId, protocolId, cols: clean.filter((c) => c.role !== 'ignorar'), updatedAt: new Date().toISOString() };
  const id = existing ? existing.id : await db.importMappings.add({ ...row, createdAt: row.updatedAt });
  if (existing) await db.importMappings.update(existing.id, row);
  await audit(db, existing ? 'mapeo-actualizado' : 'mapeo-guardado', { mapeoId: id, testId });
  return id;
}

export const listMappings = (db, testId) => db.importMappings.where('testId').equals(testId).toArray();

export async function deleteMapping(db, id) {
  await db.importMappings.delete(id);
  await audit(db, 'mapeo-eliminado', { mapeoId: id });
}

// Aplica un mapeo guardado a los encabezados del fichero. Devuelve { cols, missing }: los encabezados guardados que no están en el fichero.
export function applyMapping(saved, headers) {
  const taken = new Set();
  const cols = headers.map(() => ({ role: 'ignorar' }));
  const missing = [];
  for (const sc of saved.cols) {
    const i = headers.findIndex((h, k) => !taken.has(k) && txt(h) === sc.header);
    if (i < 0) { missing.push(sc.header); continue; }
    taken.add(i);
    cols[i] = { role: sc.role, variableId: sc.variableId ?? undefined, side: sc.side ?? undefined };
  }
  return { cols, missing };
}

// ---------- Jugadores del lote ----------
export function distinctNames(rows) {
  const map = new Map();
  for (const r of rows) {
    if (!r.playerText) continue;
    const e = map.get(r.playerText) ?? { text: r.playerText, rows: 0, validRows: 0 };
    e.rows++;
    if (r.ok) e.validRows++;
    map.set(r.playerText, e);
  }
  return [...map.values()];
}

// Propuesta para cada nombre distinto (nunca decide). Se preselecciona solo si hay un único parecido «alto» (nombre y apellido, sin acentos) y sin avisos; siempre hay que confirmarlo.
export async function proposeLinks(db, names, source = IMPORT_SOURCE) {
  const out = [];
  for (const n of names) {
    const found = await findCandidates(db, n.text, { source });
    const only = !found.requiresManual ? (found.candidates.find((c) => c.level === 'alta')?.player.id ?? null) : null;
    out.push({ ...n, candidates: found.candidates.map((c) => ({ playerId: c.player.id, name: playerLabel(c.player), level: c.level, why: c.why, via: c.matches.map((m) => m.via).join(', '), exact: c.matches.some((m) => m.exact), enye: c.matches.some((m) => m.changesEnye) })), reasons: found.reasons, requiresManual: found.requiresManual, suggestedPlayerId: only });
  }
  return out;
}

// ---------- Plan de importación ----------
const sameNum = (a, b) => a === b;
export function sameValues(a, b) {
  const ka = Object.keys(a), kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  return ka.every((k) => {
    if (!(k in b)) return false;
    const sa = Object.keys(a[k]), sb = Object.keys(b[k]);
    return sa.length === sb.length && sa.every((s) => s in b[k] && sameNum(a[k][s], b[k][s]));
  });
}

// ¿La sesión guardada «a» es un subconjunto exacto de la del fichero «b»? (mismas variables y lados con los mismos números, y «b» trae variables nuevas).
// Sirve para completar una sesión con columnas que antes no se importaban, sin tocar ningún valor ya guardado.
export function esAmpliacion(a, b) {
  const ka = Object.keys(a), kb = Object.keys(b);
  if (kb.length <= ka.length) return false;
  return ka.every((k) => k in b && Object.keys(a[k]).length === Object.keys(b[k]).length && Object.keys(a[k]).every((sd) => sd in b[k] && sameNum(a[k][sd], b[k][sd])));
}

// resolutions: { [playerText]: { action: 'link', playerId } | { action: 'new', jerseyName } | { action: 'skip' } }
export async function planImport(db, { rows, testId, protocolId = null, resolutions }) {
  const plan = { sessions: [], pending: [], rowErrors: [], body: [], counts: { nuevas: 0, duplicadas: 0, ampliadas: 0, conflictos: 0, conflictosFichero: 0, pendientes: 0, filasConError: 0, pesosNuevos: 0, pesosCambiados: 0, pesosIguales: 0, alturasNuevas: 0, alturasIguales: 0, piernasNuevas: 0, piernasIguales: 0 } };
  const groups = new Map();
  const bodyByRef = new Map(); // ref → { weight (la de la fecha más reciente), heights: Map(fecha|valor) }
  for (const r of rows) {
    if (!r.ok) { plan.counts.filasConError++; for (const i of r.issues) plan.rowErrors.push({ row: r.rowNumber, level: i.level, text: i.text }); continue; }
    const res = resolutions[r.playerText];
    if (!res || res.action === 'skip') { plan.counts.pendientes++; plan.pending.push({ row: r.rowNumber, name: r.playerText }); continue; }
    const ref = res.action === 'link' ? `p${res.playerId}` : `n${r.playerText}`;
    if (r.body && Object.keys(r.body).length) {
      const b = bodyByRef.get(ref) ?? { ref, resolution: res, playerText: r.playerText, rowNumbers: [], weight: null, weightDate: '', heights: new Map(), legs: new Map() };
      b.rowNumbers.push(r.rowNumber);
      if (r.body.weight != null && (r.date >= b.weightDate)) { b.weight = r.body.weight; b.weightDate = r.date; }
      if (r.body.height != null) b.heights.set(`${r.date}|${r.body.height}`, { date: r.date, value: r.body.height });
      if (r.body.legLength != null) b.legs.set(`${r.date}|${r.body.legLength}`, { date: r.date, value: r.body.legLength });
      bodyByRef.set(ref, b);
    }
    if (Object.keys(r.values).length === 0) continue; // fila solo de peso / altura: no crea sesión
    const key = `${ref}|${r.date}|${r.time}`;
    const g = groups.get(key) ?? { key, ref, res, playerText: r.playerText, date: r.date, time: r.time, rows: [] };
    g.rows.push(r);
    groups.set(key, g);
  }
  for (const g of groups.values()) {
    const first = g.rows[0];
    const base = { key: g.key, ref: g.ref, resolution: g.res, playerText: g.playerText, date: g.date, time: g.time, rowNumbers: g.rows.map((x) => x.rowNumber), values: first.values, reps: first.reps, merged: first.mergedRows ?? null };
    const distinct = g.rows.filter((x) => !sameValues(x.values, first.values) || JSON.stringify(x.reps) !== JSON.stringify(first.reps));
    if (distinct.length) {
      plan.counts.conflictosFichero++;
      plan.sessions.push({ ...base, status: 'conflicto-fichero', note: 'Hay varias filas del mismo jugador, fecha y hora con valores distintos. Añade una columna de hora o corrige el fichero.' });
      continue;
    }
    const dupRows = g.rows.length - 1;
    if (g.res.action === 'link') {
      const existing = (await db.sessions.where('playerId').equals(g.res.playerId).toArray()).filter((s) => s.testId === testId && s.date === g.date && (s.time ?? '') === g.time && (s.protocolId ?? null) === (protocolId ?? null));
      const same = existing.find((s) => sameValues(s.values, first.values));
      if (same) { plan.counts.duplicadas++; plan.sessions.push({ ...base, status: 'duplicada', existingId: same.id, dupRows }); continue; }
      const ampl = existing.length === 1 && esAmpliacion(existing[0].values, first.values) ? existing[0] : null;
      if (ampl) { plan.counts.ampliadas++; plan.sessions.push({ ...base, status: 'ampliable', existingId: ampl.id, dupRows }); continue; }
      if (existing.length) { plan.counts.conflictos++; plan.sessions.push({ ...base, status: 'conflicto', existingId: existing[0].id, dupRows }); continue; }
    }
    plan.counts.nuevas++;
    plan.sessions.push({ ...base, status: 'nueva', dupRows });
  }
  for (const b of bodyByRef.values()) {
    const item = { ref: b.ref, resolution: b.resolution, playerText: b.playerText, rowNumbers: b.rowNumbers, weight: b.weight, heights: [...b.heights.values()], legs: [...b.legs.values()], weightStatus: null, heightStatus: [] };
    const existing = b.resolution.action === 'link' ? await db.players.get(b.resolution.playerId) : null;
    const anth = b.resolution.action === 'link' ? await db.anthropometry.where('playerId').equals(b.resolution.playerId).toArray() : [];
    if (b.weight != null) {
      const rw = existing?.referenceWeight;
      if (!rw) { item.weightStatus = 'nuevo'; plan.counts.pesosNuevos++; }
      else if (rw.unit === 'kg' && rw.value === b.weight) { item.weightStatus = 'igual'; plan.counts.pesosIguales++; }
      else { item.weightStatus = 'cambia'; item.previousWeight = `${rw.value} ${rw.unit}`; plan.counts.pesosCambiados++; }
    }
    for (const h of item.heights) {
      const ya = anth.some((r) => r.date === h.date && r.height?.value === h.value && r.height?.unit === 'cm');
      h.status = ya ? 'igual' : 'nueva';
      if (ya) plan.counts.alturasIguales++; else plan.counts.alturasNuevas++;
    }
    for (const h of item.legs) {
      const ya = anth.some((r) => r.date === h.date && r.legLength?.value === h.value && r.legLength?.unit === 'm');
      h.status = ya ? 'igual' : 'nueva';
      if (ya) plan.counts.piernasIguales++; else plan.counts.piernasNuevas++;
    }
    plan.body.push(item);
  }
  return plan;
}

// conflictChoices: { [session.key]: 'omitir' | 'nueva' } (por defecto «omitir»)
export async function commitImport(db, { file, sheetName, mappingName = '', testId, protocolId = null, mapping, parsed, plan, conflictChoices = {}, rememberAlias = {}, source = IMPORT_SOURCE }) {
  const tables = [db.players, db.playerAliases, db.sessions, db.importBatches, db.auditLog, db.anthropometry];
  return db.transaction('rw', tables, async () => {
    const now = new Date().toISOString();
    const report = { rowIssues: plan.rowErrors, pendingNames: [...new Set(plan.pending.map((p) => p.name))].map((name) => ({ name, rows: plan.pending.filter((p) => p.name === name).map((p) => p.row) })), sessionNotes: [...(parsed.notes ?? [])] };
    const batchId = await db.importBatches.add({ createdAt: now, source, fileName: file.name, fileHash: file.hash, fileSize: file.size, sheet: sheetName, testId, protocolId, mappingName, rowsRead: parsed.stats.read, rowsEmpty: parsed.stats.empty, status: 'en curso' });
    const playerIds = new Map(); // ref → id
    const counts = { sesionesCreadas: 0, sesionesAmpliadas: 0, duplicadasOmitidas: 0, conflictosOmitidos: 0, conflictosGuardadosComoNuevas: 0, conflictosFichero: 0, jugadoresNuevos: 0, aliasGuardados: 0, aliasFijados: 0, filasNoImportadasFichero: parsed.stats?.skipped ?? 0, filasSinResolver: plan.counts.pendientes, filasConError: plan.counts.filasConError, pesosGuardados: 0, pesosCambiados: 0, alturasGuardadas: 0, alturasOmitidas: 0, piernasGuardadas: 0, piernasOmitidas: 0 };
    const ensurePlayer = async (s) => {
      if (playerIds.has(s.ref)) return playerIds.get(s.ref);
      let id;
      if (s.resolution.action === 'link') id = s.resolution.playerId;
      else {
        const isVald = source === 'VALD';
        id = await createPlayer(db, { jerseyName: s.resolution.jerseyName || s.playerText, ...(isVald ? { fullName: s.playerText } : {}) });
        counts.jugadoresNuevos++;
      }
      playerIds.set(s.ref, id);
      {
        // El nombre de VALD es el nombre completo; el de los Excel pasa a ser el alias (nombre en camiseta) si aún no había uno distinto.
        const p0 = await db.players.get(id);
        if (p0 && source === 'VALD' && !p0.fullName) await updatePlayer(db, id, { fullName: s.playerText });
        else if (p0 && source !== 'VALD' && s.resolution.action === 'link' && p0.fullName && p0.jerseyName === p0.fullName && s.playerText !== p0.fullName) {
          await updatePlayer(db, id, { jerseyName: s.playerText });
          counts.aliasFijados = (counts.aliasFijados ?? 0) + 1;
          report.sessionNotes.push({ rows: s.rowNumbers, text: `«${s.playerText}» queda como alias de ${p0.fullName}.` });
        }
      }
      if (rememberAlias[s.playerText]) {
        const p = await db.players.get(id);
        if (p && p.jerseyName !== s.playerText) {
          try { await addAlias(db, id, source, s.playerText); counts.aliasGuardados++; } catch (e) { report.sessionNotes.push({ rows: s.rowNumbers, text: `Alias no guardado: ${e.message}` }); }
        }
      }
      return id;
    };
    for (const s of plan.sessions) {
      if (s.status === 'conflicto-fichero') { counts.conflictosFichero++; report.sessionNotes.push({ rows: s.rowNumbers, text: s.note }); continue; }
      if (s.status === 'duplicada') { counts.duplicadasOmitidas++; continue; }
      if (s.status === 'ampliable') {
        const ex = await db.sessions.get(s.existingId);
        if (!ex) { counts.conflictosOmitidos++; continue; }
        const values = { ...s.values, ...ex.values }; // lo ya guardado manda; solo se añaden las variables que faltaban
        const reps = ex.reps && typeof ex.reps === 'object' ? { ...(s.reps && typeof s.reps === 'object' ? s.reps : {}), ...ex.reps } : ex.reps;
        await db.sessions.update(ex.id, { values, ...(reps !== undefined ? { reps } : {}) });
        counts.sesionesAmpliadas = (counts.sesionesAmpliadas ?? 0) + 1;
        report.sessionNotes.push({ rows: s.rowNumbers, text: `Sesión ya guardada completada con ${Object.keys(s.values).length - Object.keys(ex.values).length} variable(s) que faltaban; no se ha cambiado ningún valor existente.` });
        continue;
      }
      if (s.status === 'conflicto') {
        const choice = conflictChoices[s.key] ?? 'omitir';
        if (choice !== 'nueva') { counts.conflictosOmitidos++; report.sessionNotes.push({ rows: s.rowNumbers, text: 'Ya existía una sesión de ese jugador, test, fecha y hora con valores distintos: no se ha sobrescrito ni guardado.' }); continue; }
        counts.conflictosGuardadosComoNuevas++;
        report.sessionNotes.push({ rows: s.rowNumbers, text: 'Ya existía una sesión con valores distintos; se ha guardado como sesión nueva por decisión del usuario.' });
      }
      const playerId = await ensurePlayer(s);
      const player = await db.players.get(playerId);
      await db.sessions.add({
        playerId, testId, protocolId, date: s.date, time: s.time, values: s.values, reps: s.reps, status: 'valid', excludedReason: '',
        source, batchId, createdAt: now, ...(s.merged ? { mergedRows: s.merged } : {}), ...(player?.synthetic ? { synthetic: 1 } : {}),
      });
      counts.sesionesCreadas++;
    }
    // Peso de referencia y altura (columnas de peso / altura del fichero). El peso sustituye al de referencia anterior (el resumen lo ha mostrado); la altura es una medición fechada.
    for (const b of plan.body ?? []) {
      const id = await ensurePlayer(b);
      if (b.weight != null && b.weightStatus !== 'igual') {
        await setReferenceWeight(db, id, b.weight, 'kg');
        counts.pesosGuardados++;
        if (b.weightStatus === 'cambia') { counts.pesosCambiados++; report.sessionNotes.push({ rows: b.rowNumbers, text: `Peso de referencia de «${b.playerText}»: ${b.previousWeight} → ${b.weight} kg.` }); }
      }
      for (const h of b.legs ?? []) {
        if (h.status === 'igual') { counts.piernasOmitidas++; continue; }
        try { await addAnthropometry(db, { playerId: id, date: h.date, source: 'Excel', legLength: { value: h.value, unit: 'm' } }); counts.piernasGuardadas++; }
        catch (e) { report.sessionNotes.push({ rows: b.rowNumbers, text: `Longitud de pierna de «${b.playerText}» (${h.date}) no guardada: ${e.message}` }); }
      }
      for (const h of b.heights) {
        if (h.status === 'igual') { counts.alturasOmitidas++; continue; }
        try { await addAnthropometry(db, { playerId: id, date: h.date, source: 'Excel', height: { value: h.value, unit: 'cm' } }); counts.alturasGuardadas++; }
        catch (e) { report.sessionNotes.push({ rows: b.rowNumbers, text: `Altura de «${b.playerText}» (${h.date}) no guardada: ${e.message}` }); }
      }
    }
    // Los nombres vinculados o nuevos sin ninguna sesión nueva también pueden guardar alias confirmado.
    await db.importBatches.update(batchId, { ...counts, status: 'completada', report });
    await audit(db, 'importacion-confirmada', { lote: batchId, testId, ...counts, filasLeidas: parsed.stats.read });
    return { batchId, counts, report };
  });
}

// Sesiones ausentes del fichero. Al importar periódicamente «todos los tests», las que ya no aparecen (p. ej. pruebas de readaptación borradas en VALD)
// se ofrecen para eliminar. Alcance: mismo origen (VALD/Excel), mismo test y protocolo, y fechas dentro del rango del fichero.
// Nunca se elimina nada sin que el usuario lo marque. groups: [{ testId, protocolId, sessions: plan.sessions }]
export async function findMissingSessions(db, { source, groups }) {
  const out = [];
  for (const g of groups) {
    const inFile = g.sessions ?? [];
    const dates = inFile.map((s) => s.date).filter(Boolean).sort();
    if (!dates.length) continue;
    const [from, to] = [dates[0], dates[dates.length - 1]];
    const matchedIds = new Set(inFile.map((s) => s.existingId).filter((x) => x != null));
    const matchedKeys = new Set(inFile.filter((s) => s.resolution?.action === 'link').map((s) => `${s.resolution.playerId}|${s.date}|${s.time ?? ''}`));
    const proto = g.protocolId ?? null;
    const rows = await db.sessions.where('testId').equals(g.testId).toArray();
    for (const s of rows) {
      if (s.source !== source || (s.protocolId ?? null) !== proto || s.date < from || s.date > to) continue;
      if (matchedIds.has(s.id) || matchedKeys.has(`${s.playerId}|${s.date}|${s.time ?? ''}`)) continue;
      const p = await db.players.get(s.playerId);
      out.push({ id: s.id, testId: s.testId, playerId: s.playerId, playerName: p ? playerLabel(p) : `jugador ${s.playerId}`, date: s.date, time: s.time ?? '', from, to });
    }
  }
  return out.sort((a, b) => a.playerName.localeCompare(b.playerName) || a.date.localeCompare(b.date));
}

// Elimina (de forma permanente) solo las sesiones indicadas, comprobando que siguen existiendo y son del origen indicado.
// Guarda una copia de cada sesión eliminada en el lote (deletedSessions) y una nota en el informe; la auditoría guarda solo ids y fechas.
export async function applyMissingDeletion(db, { ids, source, batchByTest = {} }) {
  const tables = [db.sessions, db.importBatches, db.auditLog];
  return db.transaction('rw', tables, async () => {
    const done = [];
    for (const id of ids) {
      const s = await db.sessions.get(id);
      if (!s || s.source !== source) continue;
      await db.sessions.delete(id);
      done.push(s);
    }
    const byBatch = new Map();
    for (const s of done) { const b = batchByTest[s.testId] ?? Object.values(batchByTest)[0]; if (b != null) byBatch.set(b, [...(byBatch.get(b) ?? []), s]); }
    for (const [bid, list] of byBatch) {
      const b = await db.importBatches.get(bid);
      if (!b) continue;
      const report = { ...(b.report ?? {}), sessionNotes: [...(b.report?.sessionNotes ?? []), ...list.map((s) => ({ rows: [], text: `Sesión eliminada por no aparecer en este fichero (decisión del usuario): jugador ${s.playerId}, ${s.date} ${s.time ?? ''}.` }))] };
      await db.importBatches.update(bid, { report, sesionesEliminadas: (b.sesionesEliminadas ?? 0) + list.length, deletedSessions: [...(b.deletedSessions ?? []), ...list] });
    }
    if (done.length) await audit(db, 'sesiones-ausentes-eliminadas', { cantidad: done.length, sesiones: done.map((s) => ({ id: s.id, playerId: s.playerId, testId: s.testId, date: s.date })) });
    return { eliminadas: done.length, omitidas: ids.length - done.length };
  });
}

export const listBatches = async (db) => (await db.importBatches.toArray()).sort((a, b) => b.id - a.id);

export async function findBatchByHash(db, hash) {
  return (await db.importBatches.where('fileHash').equals(hash).toArray()).sort((a, b) => b.id - a.id)[0] ?? null;
}

// Informe descargable (CSV). No contiene valores de datos; sí números de fila y mensajes.
export function reportCsv(batch) {
  // Neutraliza fórmulas (= + - @): el informe incluye nombres y ficheros que vienen del Excel importado y se abrirá en Excel.
  const q = (s) => { let x = String(s ?? ''); if (/^[=+\-@\t\r]/.test(x)) x = "'" + x; return `"${x.replace(/"/g, '""')}"`; };
  const lines = [['Apartado', 'Fila(s)', 'Detalle'].map(q).join(',')];
  const add = (a, r, d) => lines.push([a, r, d].map(q).join(','));
  add('Fichero', '', `${batch.fileName} · hoja ${batch.sheet} · importación del ${batch.createdAt}`);
  add('Resumen', '', `Filas leídas ${batch.rowsRead}; vacías ${batch.rowsEmpty}; sesiones creadas ${batch.sesionesCreadas}; duplicadas omitidas ${batch.duplicadasOmitidas}; sesiones completadas ${batch.sesionesAmpliadas ?? 0}; conflictos omitidos ${batch.conflictosOmitidos}; conflictos guardados como nuevas ${batch.conflictosGuardadosComoNuevas}; conflictos dentro del fichero ${batch.conflictosFichero}; jugadores nuevos ${batch.jugadoresNuevos}; alias guardados ${batch.aliasGuardados}; filas sin resolver ${batch.filasSinResolver}; filas con error ${batch.filasConError}${batch.pesosGuardados || batch.alturasGuardadas ? `; pesos de referencia guardados ${batch.pesosGuardados ?? 0} (cambiados ${batch.pesosCambiados ?? 0}); alturas guardadas ${batch.alturasGuardadas ?? 0}` : ''}${batch.source === 'VALD' ? `; filas del fichero no importadas por test sin perfil ${batch.filasNoImportadasFichero ?? 0}` : ''}`);
  for (const i of batch.report?.rowIssues ?? []) add('Error de fila', i.row, i.text);
  for (const p of batch.report?.pendingNames ?? []) add('Jugador sin resolver', p.rows.join(' '), p.name);
  for (const n of batch.report?.sessionNotes ?? []) add('Aviso', (n.rows ?? []).join(' '), n.text);
  return lines.join('\r\n');
}
