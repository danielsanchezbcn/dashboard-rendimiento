// vald.js — importador de exportaciones CSV de VALD ForceDecks (fase 4). Perfiles: Iso-Push (Hip, Knee, Ankle), Supine 90°/90°,
// Seated Calf Raise, CMJ, SL CMJ, Squat Jump, Hop Test y Drop Jump (30 y 45 cm).
//
// Decisiones (D29 a D32 y D37, 7/11/2026):
//  · D29: las filas del mismo jugador, test y día se FUSIONAN en una sesión (media de cada lado ponderada por repeticiones). Solo si están a
//    el mismo día (sin tope horario, por decisión del usuario). Cada fusión queda en el informe.
//  · D30: la columna BW [KG] se ignora (los relativos propios usan las mediciones antropométricas). D31: las etiquetas (Tags) no se importan.
//  · D32/D37: código de VALD → test del catálogo y columna → variable según las tablas de abajo. En los tests con un valor por lado
//    (Iso-Push, SL CMJ…) las asimetrías y la media sin sufijo no se importan: la asimetría se calcula (D25).
//  · Las filas con un código o una altura sin perfil, y las que llevan carga adicional, NO se importan y se listan en el informe.
//    Hop, Drop Jump y CMJ traen asimetrías con texto («11 L»): NO se importan hasta que el usuario confirme el significado de la letra.
//  · NordBord (Nordic Hamstring, 9/11/2026): exportación con otro formato (columnas «Test», «Date UTC», «Time UTC», «L Max Force (N)»…). Se importan Max Force y Torque por lado;
//    la asimetría («Max Imbalance (%)» de VALD) se calcula con la regla D25, que coincide con la columna en las 62 filas del fichero aportado.
// Todo lo demás (jugadores, duplicados, conflictos, informe) lo hace importacion.js, igual que con el Excel propio.

import { normalizeName } from './jugadores.js';
import { parseDateCell, parseTimeCell, parseReps, parseNumber, planImport, commitImport, listBatches } from './importacion.js';

export const VALD_SOURCE = 'VALD';
export const MERGE_MAX_MIN = 24 * 60; // sin tope: todo lo del mismo jugador, test y día se fusiona (el usuario quitó la salvaguarda de 60 min)

// Especificaciones de columnas: h = encabezado del fichero (sin espacios finales), v = variable del catálogo, u = unidad esperada.
const s = (h, v, u) => ({ h, v, u });
const ISO = [s('Peak Vertical Force [N]', 'Peak Force', 'N'), s('Force at 100ms [N]', 'Force at 100 ms', 'N'), s('RFD - 100ms [N/s]', 'RFD at 100 ms', 'N/s')];
const CMJ_COLS = [
  s('Eccentric Deceleration Phase Duration [s]', 'ECC DECEL PHASE DURATION', 's'), s('Concentric Duration [ms]', 'CONCENTRIC DURATION', 'ms'),
  s('Contraction Time [ms]', 'CONTRACTION TIME', 'ms'), s('Countermovement Depth [cm]', 'DEPTH', 'cm'), s('RSI-modified (Imp-Mom) [m/s]', 'RSI MOD', 'm/s'),
  s('CMJ Stiffness [N/m]', 'COM STIFFNESS', 'N/m'), s('Eccentric Deceleration RFD / BM [N/s/kg]', 'ECC DECEL RFD', 'N/s/kg'),
  s('Concentric Impulse-100ms [N s]', 'CON IMPULSE 100ms', 'N s'), s('Peak Power / BM [W/kg]', 'CON PEAK POWER/BM', 'W/kg'),
  s('Force at Zero Velocity / BM [N/kg]', 'FORCE AT 0 VELOCITY', 'N/kg'), s('Eccentric Peak Power / BM [W/kg]', 'ECC PEAK POWER/BM', 'W/kg'),
  s('Eccentric Peak Velocity [m/s]', 'ECC PEAK VELOCITY', 'm/s'), s('Jump Height (Imp-Mom) [cm]', 'JH (imp-mom)', 'cm'),
];
const CMJ_ONLY = [s('Concentric Impulse [N s]', 'CON IMPULSE', 'N s'), s('Eccentric Deceleration Impulse [N s]', 'ECC DECELERATION IMPULSE', 'N s'),
  // Asimetrías del CMJ (VALD: «12 R» / «5.9 L»; parseAsym las guarda con signo, derecha positiva). Estaban en el catálogo pero no en el importador.
  s('Eccentric Deceleration RFD % (Asym) (%)', 'ECC DECEL RFD ASYM', '%'), s('Concentric Impulse-100ms % (Asym) (%)', 'CON IMPULSE 100ms ASYM', '%'),
  s('Concentric Impulse % (Asym) (%)', 'CON IMPULSE ASYM', '%'), s('Eccentric Deceleration Impulse % (Asym) (%)', 'ECC DECEL IMPULSE ASYM', '%'),
  s('Peak Landing Force % (Asym) (%)', 'PEAK LANDING FORCE ASYM', '%')];
const SL_ONLY = [s('Concentric Peak Force / BM [N/kg]', 'CONCENTRIC PEAK FORCE / BM', 'N/kg'), s('Takeoff Peak Force / BM [N/kg]', 'TAKEOFF PEAK FORCE / BM', 'N/kg'), s('Peak Landing Force / BM [N/kg]', 'PEAK LANDING FORCE / BM', 'N/kg')];
const HOP = [
  s('Mean RSI (Flight/Contact Time)', 'MEAN RSI (FLIGHT TIME / CONTACT TIME)', ''), s('Mean Jump Height (Flight Time) [cm]', 'MEAN JUMP HEIGHT (Flight Time) (cm)', 'cm'),
  s('Mean Contact Time [ms]', 'MEAN CONTACT TIME', 'ms'), s('Mean Peak Force [N]', 'MEAN PEAK FORCE', 'N'), s('Mean Peak Force % (Asym) (%)', 'MEAN PEAK FORCE ASYMMETRY', '%'),
  s('Mean Impulse [N s]', 'MEAN IMPULSE', 'N s'), s('Mean Impulse % (Asym) (%)', 'MEAN IMPULSE ASYMMETRY', '%'), s('Mean Active Stiffness [N/m]', 'MEAN ACTIVE STIFFNESS', 'N/m'),
  s('Mean Active Stiffness % (Asym) (%)', 'MEAN ACTIVE STIFFNESS ASYMMETRY', '%'), s('Mean Landing RFD [N/s]', 'MEAN LANDING RFD', 'N/s'), s('Mean Landing RFD % (Asym) (%)', 'MEAN LANDING RFD ASYMMETRY', '%'),
];
const DJ = [
  s('RSI (Flight Time/Contact Time)', 'RSI (FLIGHT TIME / CONTACT TIME)', ''), s('Jump Height (Flight Time) [cm]', 'JUMP HEIGHT (Flight Time - cm)', 'cm'), s('Contact Time [s]', 'CONTACT TIME', 's'),
  s('Eccentric Impulse [N s]', 'ECCENTRIC IMPULSE', 'N s'), s('Eccentric Impulse % (Asym) (%)', 'ECCENTRIC IMPULSE ASYMMETRY', '%'), s('Peak Power / BM [W/kg]', 'PEAK POWER / BM', 'W/kg'),
  s('Concentric Impulse [N s]', 'CONCENTRIC IMPULSE', 'N s'), s('Concentric Impulse % (Asym) (%)', 'CONCENTRIC IMPULSE ASYMMETRY', '%'), s('Active Stiffness [N/m]', 'ACTIVE STIFFNESS', 'N/m'),
  s('Active Stiffness % (Asym) (%)', 'ACTIVE STIFFNESS ASYMMETRY', '%'), s('Drop Landing RFD % (Asym) (%)', 'DROP LANDING RFD ASYMMETRY', '%'), s('Peak Drop Landing Force % (Asym) (%)', 'PEAK DROP LANDING FORCE ASYMMETRY', '%'),
];
const SJ = [s('Jump Height (Imp-Mom) [cm]', 'JH (imp-mom)', 'cm'), s('RSI-modified (Imp-Mom) [m/s]', 'RSI MOD', 'm/s'), s('Concentric Impulse-100ms [N s]', 'CON IMPULSE 100ms', 'N s'), s('Concentric RFD - 100ms [N/s]', 'CON RFD 100ms', 'N/s')];

// mode: 'LR' = un valor por lado (columnas «(L)» y «(R)», repeticiones por lado); 'S' = un único valor (columna «Reps»)
export const VALD_PROFILES = {
  'Run-Specific Hip Iso-Push': { mode: 'LR', cols: ISO },
  'Run-Specific Knee Iso-Push': { mode: 'LR', cols: ISO },
  'Run-Specific Ankle Iso-Push': { mode: 'LR', cols: ISO },
  'Supine Isometric 90°/90° Leg Curl Test': { mode: 'LR', cols: ISO },
  'Single-Leg Seated Calf Raise': { mode: 'LR', cols: ISO },
  'CMJ': { mode: 'S', cols: [...CMJ_COLS, ...CMJ_ONLY] },
  'SL CMJ': { mode: 'LR', cols: [...CMJ_COLS, ...SL_ONLY] },
  'Squat Jump': { mode: 'S', cols: SJ },
  'Double-Leg Hop Test': { mode: 'S', cols: HOP },
  'DL Drop Jump 30 cm': { mode: 'S', cols: DJ },
  'DL Drop Jump 45 cm': { mode: 'S', cols: DJ },
  // NordBord: columnas con nombre propio por lado; la asimetría (valor único, con signo) se calcula con D25 a partir del Max Force de la sesión (también tras fusionar).
  'Nordic Hamstring Exercise': { mode: 'LR', format: 'nordbord', reps: { L: 'L Reps', R: 'R Reps' }, asym: 'Max Force Asymmetry', asymFrom: 'Max Force',
    cols: [{ h: 'Max Force', v: 'Max Force', u: 'N', names: { L: 'L Max Force (N)', R: 'R Max Force (N)' } }, { h: 'Torque', v: 'Torque', u: 'Nm', names: { L: 'L Max Torque (Nm)', R: 'R Max Torque (Nm)' } }] },
};
const FORMATS = {
  forcedecks: { fixed: ['Name', 'Test Type', 'Date', 'Time'], name: 'Name', code: 'Test Type', date: 'Date', time: 'Time' },
  nordbord: { fixed: ['Name', 'Test', 'Date UTC', 'Time UTC', 'L Max Force (N)', 'R Max Force (N)'], name: 'Name', code: 'Test', date: 'Date UTC', time: 'Time UTC' },
};
const formatOf = (header) => (FORMATS.forcedecks.fixed.every((c) => header.includes(c)) ? 'forcedecks' : FORMATS.nordbord.fixed.every((c) => header.includes(c)) ? 'nordbord' : null);
// Códigos de «Test Type» de VALD. Una función decide el test según la fila (altura de caída, carga) o devuelve el motivo de omisión.
const fixed = (name) => () => ({ test: name });
// Asimetría de VALD en tests de un solo valor: «11 L» / «3.8 R» (la letra es el lado con el valor MÁS ALTO; confirmado por el usuario,
// coincide con D25 = (derecha − izquierda) / máx × 100, positivo = derecha mayor). Se guarda con signo: R → +, L → −. «0» sin letra = 0.
// La magnitud viene redondeada por VALD. Una cifra distinta de 0 sin letra no se acepta (no se puede saber el signo).
export function parseAsym(v) {
  const s = String(v ?? '').trim();
  if (!s) return { empty: true };
  const m = s.match(/^(\d+(?:[.,]\d+)?)\s*([LRlr])?$/);
  if (!m) return { error: `«${s}» no es una asimetría válida (se espera, por ejemplo, «11 L» o «3.8 R»)` };
  const n = Number(m[1].replace(',', '.'));
  if (n === 0) return { value: 0 };
  if (!m[2]) return { error: `«${s}» no indica el lado (falta L o R)` };
  return { value: m[2].toUpperCase() === 'R' ? n : -n };
}

export const VALD_CODES = {
  RSHIP: fixed('Run-Specific Hip Iso-Push'), RSKIP: fixed('Run-Specific Knee Iso-Push'), RSAIP: fixed('Run-Specific Ankle Iso-Push'),
  SLHNNI: fixed('Supine Isometric 90°/90° Leg Curl Test'), SLSEICR: fixed('Single-Leg Seated Calf Raise'),
  Nordic: fixed('Nordic Hamstring Exercise'), SLJ: fixed('SL CMJ'), CMJ: fixed('CMJ'), SJ: fixed('Squat Jump'), HJ: fixed('Double-Leg Hop Test'),
  DJ: (r) => (r.dropHeight === 30 ? { test: 'DL Drop Jump 30 cm' } : r.dropHeight === 45 ? { test: 'DL Drop Jump 45 cm' } : { skip: `altura de caída ${r.dropHeight === null ? 'sin dato' : r.dropHeight + ' cm'} (el catálogo solo tiene 30 y 45 cm)` }),
};

const FIXED_COLS = ['Name', 'Test Type', 'Date', 'Time'];
const norm = (x) => String(x ?? '').replace(/\s+/g, ' ').trim();
const cell = (v) => (v === null || v === undefined ? '' : v instanceof Date ? v.toISOString().slice(0, 10) : String(v).trim());
const toMin = (t) => { const m = /^(\d{2}):(\d{2})$/.exec(t); return m ? Number(m[1]) * 60 + Number(m[2]) : null; };
const r2 = (x) => Math.round(x * 100) / 100;
const nu = (u) => String(u ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
const lc = (x) => String(x ?? '').trim().toLowerCase();

export function looksLikeVald(grid) {
  return formatOf((grid[0] ?? []).map(norm)) !== null;
}

const repsOf = (row, side) => (side === 'S' ? row.reps.total : row.reps[side]);

// Fusiona un grupo de filas válidas (ordenadas por hora) en una sola.
function mergeRows(group, vars, sides) {
  const first = group[0];
  const out = { ...first, values: {}, reps: { total: null, L: null, R: null, assumed: false }, issues: [], mergedRows: group.map((g) => g.rowNumber) };
  for (const side of sides) {
    const n = group.reduce((a, g) => (repsOf(g, side) ? (a ?? 0) + repsOf(g, side) : a), null);
    if (side === 'S') out.reps.total = n; else out.reps[side] = n;
  }
  for (const v of vars) {
    for (const side of sides) {
      const parts = group.filter((g) => g.values[v.id]?.[side] !== undefined);
      if (!parts.length) continue;
      if (parts.length === 1) { (out.values[v.id] ??= {})[side] = parts[0].values[v.id][side]; continue; }
      if (parts.some((p) => !repsOf(p, side))) { out.issues.push({ level: 'error', text: `No se pueden fusionar las filas ${out.mergedRows.join(' y ')}: falta el número de repeticiones para ponderar.` }); continue; }
      const n = parts.reduce((a, p) => a + repsOf(p, side), 0);
      (out.values[v.id] ??= {})[side] = r2(parts.reduce((a, p) => a + p.values[v.id][side] * repsOf(p, side), 0) / n);
    }
  }
  out.ok = out.issues.length === 0;
  return out;
}

// Interpreta una exportación de VALD. catalog = { tests, variables } (de listCatalog). Devuelve uno o varios grupos (un test cada uno).
export function parseValdGrid(grid, catalog) {
  const fail = (error) => ({ ok: false, error });
  if (!grid.length) return fail('El fichero está vacío.');
  const header = (grid[0] ?? []).map(norm);
  const fmtKey = formatOf(header);
  if (!fmtKey) return fail(`No parece una exportación de VALD (ForceDecks o NordBord): faltan las columnas ${FORMATS.forcedecks.fixed.filter((c) => !header.includes(c)).map((m) => `«${m}»`).join(', ')}.`);
  const FMT = FORMATS[fmtKey];
  const col = (name) => header.indexOf(name);
  const body = grid.slice(1).map((r, i) => ({ r, n: i + 2 })).filter(({ r }) => r.some((c) => cell(c) !== ''));
  const stats = { read: body.length, empty: grid.length - 1 - body.length, skipped: 0 };
  if (!body.length) return fail('El fichero no tiene filas con datos.');
  const cCode = col(FMT.code), cLoad = col('Additional Load [kg]'), cDrop = col('Drop Height [cm]');
  const codes = [...new Set(body.map(({ r }) => cell(r[cCode])).filter(Boolean))];
  if (!codes.some((c) => VALD_CODES[c])) return fail(`Ningún código de test del fichero (${codes.join(', ') || 'ninguno'}) está en el perfil de importación (conocidos: ${Object.keys(VALD_CODES).join(', ')}).`);

  // 1) asignar cada fila a un test, o anotar por qué se omite
  const byTest = new Map(); // nombre de test → [{r, n}]
  const skipped = new Map(); // motivo → [filas]
  const skip = (reason, n) => { (skipped.get(reason) ?? skipped.set(reason, []).get(reason)).push(n); stats.skipped++; };
  for (const item of body) {
    const code = cell(item.r[cCode]);
    const rule = VALD_CODES[code];
    if (!rule) { skip(`código «${code || 'vacío'}» sin perfil de importación`, item.n); continue; }
    const load = cLoad >= 0 ? parseNumber(item.r[cLoad]) : { empty: true };
    if (!load.empty && !load.error && load.value > 0) { skip(`con carga adicional (${code})`, item.n); continue; }
    const drop = cDrop >= 0 ? parseNumber(item.r[cDrop]) : { empty: true };
    const res = rule({ dropHeight: drop.empty || drop.error ? null : drop.value });
    if (res.skip) { skip(res.skip, item.n); continue; }
    (byTest.get(res.test) ?? byTest.set(res.test, []).get(res.test)).push(item);
  }

  const notes = [];
  for (const [reason, rows] of skipped) notes.push({ rows, level: 'aviso', text: `${rows.length} fila(s) no importadas: ${reason}.` });
  const usedHeaders = new Set(FMT.fixed);
  const groups = [];
  const problems = [];
  for (const [testName, items] of byTest) {
    const prof = VALD_PROFILES[testName];
    if ((prof.format ?? 'forcedecks') !== fmtKey) { problems.push(`${testName}: el perfil no corresponde a este formato de fichero.`); continue; }
    const test = catalog.tests.find((t) => t.name === testName && !t.archived);
    if (!test) { problems.push(`El test «${testName}» no existe en el catálogo (o está archivado).`); continue; }
    const vars = catalog.variables.filter((v) => v.testId === test.id && v.kind === 'raw' && !v.archived);
    const sides = prof.mode === 'LR' ? ['L', 'R'] : ['S'];
    const repCols = prof.reps ? { L: col(prof.reps.L), R: col(prof.reps.R) } : prof.mode === 'LR' ? { L: col('Reps (L)'), R: col('Reps (R)') } : { S: col('Reps') };
    if (Object.values(repCols).some((c) => c < 0)) { problems.push(`${testName}: faltan las columnas de repeticiones («${prof.reps ? `${prof.reps.L}» y «${prof.reps.R}` : prof.mode === 'LR' ? 'Reps (L)» y «Reps (R)' : 'Reps'}»).`); continue; }
    Object.values(repCols).forEach((c) => usedHeaders.add(header[c]));
    const spec = [], absent = [];
    let bad = null;
    for (const sp of prof.cols) {
      const cols = sp.names ? { L: col(sp.names.L), R: col(sp.names.R) } : prof.mode === 'LR' ? { L: col(`${sp.h} (L)`), R: col(`${sp.h} (R)`) } : { S: col(sp.h) };
      if (Object.values(cols).some((c) => c < 0)) { absent.push(sp.v); continue; }
      const v = vars.find((x) => lc(x.name) === lc(sp.v));
      if (!v) { bad = `${testName}: falta la variable «${sp.v}» en el catálogo (actualiza la base: se añade sola al abrir la aplicación nueva).`; break; }
      if (nu(v.unit) !== nu(sp.u)) { bad = `${testName}: la unidad de «${v.name}» en el catálogo (${v.unit || 'sin unidad'}) no coincide con la del fichero (${sp.u || 'sin unidad'}). Corrígela en el catálogo.`; break; }
      if ((prof.mode === 'LR' ? 'LR' : 'single') !== v.sides) { bad = `${testName}: «${v.name}» debería ser ${prof.mode === 'LR' ? 'un valor por lado (LR)' : 'un único valor (single)'} y en el catálogo es «${v.sides || 'sin definir'}».`; break; }
      spec.push({ v, cols, asym: sp.u === '%' });
      Object.values(cols).forEach((c) => usedHeaders.add(header[c]));
    }
    if (bad) { problems.push(bad); continue; }
    if (!spec.length) { problems.push(`${testName}: el fichero no trae ninguna de las columnas esperadas.`); continue; }
    const gNotes = [];
    if (absent.length) gNotes.push({ rows: [], level: 'info', text: `${testName}: el fichero no trae ${absent.length} variable(s) que el catálogo sí define (${absent.join(', ')}); quedarán sin dato.` });

    // 2) interpretar las filas del test
    const rows = items.map(({ r, n }) => {
      const row = { rowNumber: n, playerText: norm(r[col(FMT.name)]), date: null, time: '', reps: { total: null, L: null, R: null, assumed: false }, values: {}, issues: [] };
      const err = (t) => row.issues.push({ level: 'error', text: t });
      if (!row.playerText) err('Falta el nombre del jugador.');
      const d = parseDateCell(r[col(FMT.date)]);
      if (d.empty) err('Falta la fecha.'); else if (d.error) err(`Fecha: ${d.error}.`); else row.date = d.value;
      const t = parseTimeCell(r[col(FMT.time)]);
      if (t.error) err(`Hora: ${t.error}.`); else if (t.value) row.time = t.value;
      for (const side of sides) {
        const p = parseReps(r[repCols[side]]);
        if (p.error) err(`Repeticiones${side === 'S' ? '' : ` (${side})`}: ${p.error}.`);
        else if (p.value) { if (side === 'S') row.reps.total = p.value; else row.reps[side] = p.value; }
      }
      for (const { v, cols, asym } of spec) {
        for (const side of sides) {
          const p = asym ? parseAsym(r[cols[side]]) : parseNumber(r[cols[side]]);
          if (p.empty) continue;
          if (p.error) { err(`${header[cols[side]]}: ${p.error}.`); continue; }
          (row.values[v.id] ??= {})[side] = p.value;
          if (!repsOf(row, side) && !row.issues.length) err(`Hay valor${side === 'S' ? '' : side === 'L' ? ' izquierdo' : ' derecho'} sin repeticiones.`);
        }
      }
      if (!row.issues.length && Object.keys(row.values).length === 0) err('La fila no tiene ningún valor.');
      row.ok = row.issues.length === 0;
      return row;
    });

    // 3) D29: fusionar filas del mismo jugador y día (a ≤ MERGE_MAX_MIN minutos entre sí)
    const vOnly = spec.map((x) => x.v);
    const gmap = new Map();
    for (const row of rows) {
      if (!row.ok || !row.time) continue;
      const k = `${normalizeName(row.playerText).key}|${row.date}`;
      (gmap.get(k) ?? gmap.set(k, []).get(k)).push(row);
    }
    const drop = new Set(), replace = new Map();
    for (const list of gmap.values()) {
      if (list.length < 2) continue;
      list.sort((a, b) => toMin(a.time) - toMin(b.time));
      let cluster = [list[0]];
      const flush = () => {
        if (cluster.length > 1) {
          const m = mergeRows(cluster, vOnly, sides);
          cluster.forEach((c) => drop.add(c));
          replace.set(cluster[0], m);
          const gap = toMin(cluster[cluster.length - 1].time) - toMin(cluster[0].time);
          const repTxt = sides.map((sd) => `${sd === 'S' ? 'total' : sd === 'L' ? 'izquierda' : 'derecha'} ${m.reps[sd === 'S' ? 'total' : sd] ?? '—'}`).join(', ');
          gNotes.push({ rows: m.mergedRows, level: 'aviso', text: m.ok ? `${testName}: mismo jugador y día, separadas por ${gap} min: ${cluster.length} filas fusionadas en una sola sesión (media ponderada por repeticiones; repeticiones ${repTxt}). Los valores de VALD vienen redondeados, así que el resultado es aproximado.` : m.issues[0].text });
        }
        cluster = [];
      };
      for (let i = 1; i < list.length; i++) {
        if (toMin(list[i].time) - toMin(cluster[cluster.length - 1].time) <= MERGE_MAX_MIN) cluster.push(list[i]);
        else {
          if (cluster.length === 1) gNotes.push({ rows: [cluster[0].rowNumber, list[i].rowNumber], level: 'aviso', text: `${testName}: mismo jugador y día con más de ${MERGE_MAX_MIN} min de diferencia: se mantienen como sesiones separadas (revisa si son la misma).` });
          flush(); cluster = [list[i]];
        }
      }
      flush();
    }
    const finalRows = [];
    for (const row of rows) { if (replace.has(row)) finalRows.push(replace.get(row)); else if (!drop.has(row)) finalRows.push(row); }
    if (prof.asym) {
      const av = vars.find((x) => lc(x.name) === lc(prof.asym)), fv = vars.find((x) => lc(x.name) === lc(prof.asymFrom));
      if (!av || av.sides !== 'single' || !fv) { problems.push(`${testName}: falta la variable «${prof.asym}» (valor único) o «${prof.asymFrom}» en el catálogo.`); continue; }
      for (const row of finalRows) {
        const f = row.values[fv.id];
        if (row.ok && Number.isFinite(f?.L) && Number.isFinite(f?.R) && Math.max(f.L, f.R) > 0) row.values[av.id] = { S: r2(((f.R - f.L) / Math.max(f.L, f.R)) * 100) };
      }
      gNotes.push({ rows: [], level: 'info', text: `${testName}: «${prof.asym}» se calcula como (derecha − izquierda) ÷ máx × 100 (D25), igual que «Max Imbalance (%)» de VALD; positivo = domina la derecha.` });
    }
    groups.push({ testId: test.id, testName, mode: prof.mode, rows: finalRows, notes: gNotes, readRows: items.length, mergedCount: replace.size });
  }
  if (!groups.length) return fail(problems.join(' ') || 'No hay filas importables.');
  for (const p of problems) notes.push({ rows: [], level: 'error', text: p });
  const ignored = header.filter((h) => h && !usedHeaders.has(h) && !h.startsWith('Unnamed'));
  return { ok: true, codes, groups, notes, stats, ignored, mergedCount: groups.reduce((a, g) => a + g.mergedCount, 0), testNames: groups.map((g) => g.testName) };
}

// ---- Plan y guardado por grupos (un lote por test; las claves de conflicto llevan el test delante para no chocar)
export async function planValdImport(db, vald, resolutions) {
  const plans = [];
  const plan = { sessions: [], pending: [], rowErrors: [], counts: { nuevas: 0, duplicadas: 0, ampliadas: 0, repetidas: 0, conflictos: 0, conflictosFichero: 0, pendientes: 0, filasConError: 0 } };
  for (const g of vald.groups) {
    const gp = await planImport(db, { rows: g.rows, testId: g.testId, resolutions });
    plans.push({ group: g, plan: gp });
    plan.sessions.push(...gp.sessions.map((x) => ({ ...x, key: `${g.testId}~${x.key}`, testId: g.testId })));
    plan.pending.push(...gp.pending); plan.rowErrors.push(...gp.rowErrors);
    for (const [k, v] of Object.entries(gp.counts)) plan.counts[k] = (plan.counts[k] ?? 0) + v;
  }
  return { plan, plans };
}

export async function commitValdImport(db, { file, vald, plans, choices = {}, repeats = {}, remember = {} }) {
  const total = {}; const batchIds = [];
  for (let i = 0; i < plans.length; i++) {
    const { group: g, plan } = plans[i];
    const own = {}, ownR = {};
    for (const x of plan.sessions) { const c = choices[`${g.testId}~${x.key}`]; if (c) own[x.key] = c; const cr = repeats[`${g.testId}~${x.key}`]; if (cr) ownR[x.key] = cr; }
    const parsed = { stats: { read: g.readRows, empty: 0, skipped: vald.stats?.skipped ?? 0 }, notes: [...g.notes, ...(i === 0 ? vald.notes : [])] };
    const r = await commitImport(db, { file, sheetName: 'CSV', mappingName: `Perfil VALD (${g.testName})`, testId: g.testId, mapping: { perfil: vald.codes.join(',') }, parsed, plan, conflictChoices: own, repeatChoices: ownR, rememberAlias: remember, source: VALD_SOURCE });
    batchIds.push(r.batchId);
    for (const [k, v] of Object.entries(r.counts)) total[k] = (total[k] ?? 0) + v;
  }
  const all = await listBatches(db);
  return { counts: total, batchId: batchIds[0], batchIds, batches: batchIds.map((id) => all.find((b) => b.id === id)) };
}
