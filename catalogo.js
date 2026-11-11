// catalogo.js — catálogo configurable: bloques, manifestaciones, zonas, tests, protocolos y variables.
//
// Reglas (ver DECISIONES.md: D4, D5, D6, D8, D25, D27):
//  - La manifestación de la fuerza es atributo de cada variable (D4). El test guarda además la manifestación
//    «de listado», que es la que usa el catálogo inicial para ordenar los tests que aún no tienen variables;
//    cada variable puede tener la suya y, si no la indica, hereda la del test.
//  - El lado no se guarda aquí como atributo de la repetición (D6): la variable solo indica si sus valores se
//    registran por lado («LR») o como valor único («single»). El lado concreto es atributo de cada valor.
//  - No se infieren unidades, direcciones de interpretación ni fórmulas: lo que el usuario no ha definido queda en null.
//  - Un test o una variable con datos se archiva, nunca se borra. Hasta que existan las tablas de datos
//    (fases 3 y 4), solo se bloquea el borrado si algo del catálogo depende del elemento.
//  - Los cambios quedan en el registro de acciones (campo, valor anterior y nuevo). Es configuración, no datos de jugadores.

import { audit } from './db.js';

export const GRAVITY = 9.80665; // m/s², una sola constante en toda la aplicación (D5).
export const SW_FACTOR_DEFAULT = 0.29; // D27: SW = 29 % del peso corporal; configurable y versionado; sin fuente verificada.

export const BLOCK_KEYS = ['fuerza', 'perimetros', 'nme'];
export const SIDES = { LR: 'Valor izquierdo y derecho', single: 'Valor único' };
export const DIRECTIONS = { higher: 'Más alto es mejor', lower: 'Más bajo es mejor', target: 'Rango objetivo' };
export const KINDS = { raw: 'Dato de origen', derived: 'Calculada' };

// Operaciones cerradas con definición dada por el usuario. No hay intérprete de fórmulas libres.
export const OPERATIONS = {
  ASIMETRIA: { label: 'Asimetría (%)', unit: '%', operands: 1, definition: '(derecha − izquierda) ÷ máx(izquierda, derecha) × 100; positivo si domina la derecha (D25)', params: {} },
  REL_BW: { label: 'Relativo al peso corporal (BW)', unit: 'BW', operands: 1, definition: 'fuerza del lado (N) ÷ (masa corporal (kg) × 9,80665)', params: {} },
  // Operaciones de sistema (D5): las crea el catálogo inicial; no se ofrecen al crear variables a mano. El origen es la variable «carga» del mismo test.
  ISO_MVIC: { label: 'MVIC iso-push (kg)', unit: 'kg', operands: 1, system: true, definition: 'media, ponderada por repeticiones y de ambos lados, de (Peak Force del Iso-Push emparejado ÷ 9,80665 − factor × masa de cada sesión de Iso-Push), con todas las sesiones válidas; factor 1 en BW y el de la fórmula en SW', params: {} },
  ISO_PIMA: { label: '%PIMA', unit: '%', operands: 1, system: true, definition: 'carga externa ÷ MVIC iso-push (kg) × 100; la etiqueta se conserva como la escribe el usuario', params: {} },
  ISO_LOAD_BW: { label: '%BW', unit: '%', operands: 1, system: true, definition: 'carga externa ÷ masa corporal (kg) × 100; masa medida más cercana a hoy', params: {} },
  ISO_LOAD_SW: { label: '%SW', unit: '%', operands: 1, system: true, definition: 'carga externa ÷ (factor × masa corporal (kg)) × 100; masa medida más cercana a hoy', params: { factor: SW_FACTOR_DEFAULT } },
  RM_EST: { label: '1RM estimado (kg)', unit: 'kg', operands: 1, system: true, definition: '(carga movilizada + masa corporal) × factor; factor 1,4 para 12RM (coincide con Epley a 12 repeticiones; inferencia no verificada con fuente)', params: { factor: 1.4 } },
  REL_LEVER: { label: 'Relativo a palanca y masa (N·m/kg)', unit: 'N·m/kg', operands: 1, definition: 'fuerza (N) × longitud de pierna / palanca (m) ÷ masa corporal (kg); fórmula del Excel del usuario (9/11/2026)', params: {} },
  REL_SW: { label: 'Relativo al System Weight (SW)', unit: 'SW', operands: 1, definition: 'fuerza del lado (N) ÷ (factor × masa corporal (kg) × 9,80665); factor por defecto 0,29 (D27)', params: { factor: SW_FACTOR_DEFAULT } },
};

// ---------- Cálculo puro (sin base de datos). Devuelve null si falta un dato o es inválido; nunca 0 inventado ----------
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

// Asimetría al estilo VALD (decidido el 8/11/2026): magnitud = |D − I| ÷ máx(I, D) × 100 y la letra del lado con el valor MÁS ALTO («11 % L»).
// Comprobado con 135 filas de SL CMJ exportadas por VALD (diferencias solo por el redondeo de los valores I/D del CSV). Internamente se guarda con signo
// (D → +, I → −) por compatibilidad; en pantalla y exportaciones solo se ve magnitud y letra.
export const isAsymVariable = (v) => v?.formula?.op === 'ASIMETRIA' || /asym|asimetr/i.test(v?.name ?? '');
export function asymText(pct, d = 1) {
  if (typeof pct !== 'number' || !Number.isFinite(pct)) return '—';
  const a = Math.abs(pct);
  if (a < 0.05) return '0 %';
  return `${a.toLocaleString('es-ES', { maximumFractionDigits: d })} % ${pct > 0 ? 'R' : 'L'}`;
}
export const asymSideLetter = (pct) => (typeof pct !== 'number' || !Number.isFinite(pct) || Math.abs(pct) < 0.05 ? '' : pct > 0 ? 'R' : 'L');

// Variables en grados (ángulos): su asimetría es R − L en °, como en el Excel del usuario; el resto usa el porcentaje D25. Un solo criterio para todas las pantallas.
export const esGrados = (v) => v?.unit === '°';
export const asimetriaLR = (v, left, right) => (esGrados(v) ? (Number.isFinite(left) && Number.isFinite(right) ? right - left : null) : asymmetryPct(left, right));

export function asymmetryPct(left, right) {
  const l = num(left);
  const r = num(right);
  if (l === null || r === null) return null;
  const m = Math.max(l, r);
  if (m <= 0) return null;
  return ((r - l) / m) * 100;
}

export function bodyWeightN(massKg) {
  const m = num(massKg);
  return m !== null && m > 0 ? m * GRAVITY : null;
}

export function relativeBW(forceN, massKg) {
  const f = num(forceN);
  const bw = bodyWeightN(massKg);
  return f === null || bw === null ? null : f / bw;
}

export function systemWeightN(massKg, factor = SW_FACTOR_DEFAULT) {
  const bw = bodyWeightN(massKg);
  const k = num(factor);
  return bw === null || k === null || k <= 0 ? null : k * bw;
}

export function relativeSW(forceN, massKg, factor = SW_FACTOR_DEFAULT) {
  const f = num(forceN);
  const sw = systemWeightN(massKg, factor);
  return f === null || sw === null ? null : f / sw;
}

// ---------- Utilidades ----------
const clean = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
const now = () => new Date().toISOString();
const nullable = (v) => {
  const s = clean(v);
  return s === '' ? null : s;
};
const oneOf = (v, obj, what) => {
  if (v === null || v === undefined || v === '') return null;
  if (!(v in obj)) throw new Error(`${what} no válido.`);
  return v;
};

const logChange = (db, action, entity, id, antes, despues, reason = '') => {
  const campos = {};
  for (const k of Object.keys(despues)) {
    if (JSON.stringify(antes?.[k] ?? null) !== JSON.stringify(despues[k] ?? null)) campos[k] = { antes: antes?.[k] ?? null, despues: despues[k] ?? null };
  }
  return audit(db, action, { entidad: entity, id, campos }, reason);
};

// ---------- Lectura ----------
// ---------- Comportamiento de un test en el perfil (propiedades, no nombres) ----------
// Tres ajustes por test que antes dependían de que el test se llamase de una forma exacta. Ahora se guardan en el propio test (campos opcionales; se editan en el catálogo):
//   pbCriterioVariableId: número = el Personal Best sale de la sesión con el mejor valor de esa variable; null = PB clásico (mejor valor de cada variable por separado).
//   panelColumnas: true = el perfil muestra la tabla «todas las variables» (una columna por variable).
//   excluirAsimetrias: true = el test no aparece en la pestaña Asimetrías del jugador.
// Si el campo no existe (tests antiguos o creados a mano), se usa el valor por defecto de abajo, que reproduce lo que ya hacía el dashboard; `ensurePerfiles` (catalogo-inicial.js) los
// guarda en los tests actuales para que un cambio de nombre no los pierda. Nunca se pisa un valor que el usuario haya puesto.
const lcn = (s) => String(s ?? '').trim().toLowerCase();
const RSI = /\bRSI\b/i;
export const PERFILES_POR_DEFECTO = {
  cmj: { pb: RSI, panel: true },
  'sl cmj': { pb: RSI },
  'double-leg hop test': { pb: RSI, panel: true },
  'dl drop jump 30 cm': { pb: RSI, panel: true },
  'dl drop jump 45 cm': { pb: RSI, panel: true },
  'squat jump': { pb: /^JH \(imp-mom\)$/i }, // Squat Jump: mejor Jump Height
  'nordic hamstring exercise': { sinAsimetrias: true },
};
const perfilDefecto = (test) => PERFILES_POR_DEFECTO[lcn(test?.name)] ?? null;
// Variables candidatas a criterio: de origen (no calculadas), activas y que no sean asimetrías.
export const candidatasCriterioPB = (test, variables) => variables.filter((v) => v.testId === test?.id && !v.archived && v.kind !== 'derived' && !/ASYM/i.test(v.name)).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
// Variable criterio del Personal Best de un test ({id, name}) o null si usa el PB clásico.
export function pbCriterionOf(test, variables) {
  if (!test || test.pbCriterioVariableId === null) return null;
  const cand = candidatasCriterioPB(test, variables);
  if (typeof test.pbCriterioVariableId === 'number') { const v = cand.find((x) => x.id === test.pbCriterioVariableId); if (v) return { id: v.id, name: v.name }; } // si ya no existe, vale el valor por defecto
  const d = perfilDefecto(test);
  const c = d?.pb ? cand.find((v) => d.pb.test(v.name)) : null;
  return c ? { id: c.id, name: c.name } : null;
}
// Normative Benchmarking (pages-normativo.js): por defecto muestra todas las variables del test en columnas; con `panelColumnas: false` (Catálogo) solo la variable seleccionada.
export const usaPanelColumnas = (test) => (typeof test?.panelColumnas === 'boolean' ? test.panelColumnas : !!test);
export const testExcluidoDeAsimetrias = (test) => (typeof test?.excluirAsimetrias === 'boolean' ? test.excluirAsimetrias : !!perfilDefecto(test)?.sinAsimetrias);
export const sinAsimetriaPorDefecto = (name) => /\btorque\b/i.test(name) || /^(force|rfd) at 100\s*ms$/i.test(String(name).trim());
export const variableExcluidaDeAsimetrias = (v) => (typeof v?.excluirAsimetrias === 'boolean' ? v.excluirAsimetrias : sinAsimetriaPorDefecto(v?.name ?? ''));

export async function listCatalog(db) {
  const [blocks, manifestations, zones, tests, protocols, variables] = await Promise.all([
    db.blocks.orderBy('order').toArray(),
    db.manifestations.orderBy('order').toArray(),
    db.zones.orderBy('order').toArray(),
    db.tests.toArray(),
    db.protocols.toArray(),
    db.variables.toArray(),
  ]);
  const byOrder = (a, b) => (a.order ?? 0) - (b.order ?? 0) || a.id - b.id;
  const testsSorted = tests.sort(byOrder), variablesSorted = variables.sort(byOrder);
  // Personal Best de la mejor sesión (solo en memoria, no se guarda): ver pbCriterionOf arriba y personalBestFor en evolucion.js.
  for (const t of testsSorted) { const c = pbCriterionOf(t, variablesSorted); if (c) for (const v of variablesSorted) if (v.testId === t.id) v.pbCriterion = c; }
  return { blocks, manifestations, zones, tests: testsSorted, protocols: protocols.sort((a, b) => a.id - b.id), variables: variablesSorted };
}

export const variableManifestationId = (variable, test) => variable.manifestationId ?? test?.manifestationId ?? null;

// ---------- Uso (para decidir entre borrar y archivar) ----------
const DATA_TABLES = ['sessions', 'sessionValues']; // se crearán en las fases 3 y 4; si existen, cuentan como datos.

async function hasData(db, testId) {
  for (const name of DATA_TABLES) {
    if (db.tables.some((t) => t.name === name)) {
      if ((await db.table(name).where('testId').equals(testId).count()) > 0) return true;
    }
  }
  return false;
}

export async function testUsage(db, testId) {
  const variables = await db.variables.where('testId').equals(testId).count();
  const protocols = await db.protocols.where('testId').equals(testId).count();
  return { variables, protocols, datos: await hasData(db, testId) };
}

export async function variableUsage(db, variableId) {
  const v = await db.variables.get(variableId);
  const siblings = v ? await db.variables.where('testId').equals(v.testId).toArray() : [];
  const dependientes = siblings.filter((x) => x.id !== variableId && (x.formula?.operands ?? []).includes(variableId));
  return { dependientes: dependientes.map((x) => x.name), datos: v ? await hasData(db, v.testId) : false };
}

// ---------- Manifestaciones y zonas ----------
async function nextOrder(table) {
  const last = await table.orderBy('order').last();
  return (last?.order ?? 0) + 1;
}

export async function createManifestation(db, { name, blockKey = 'fuerza' }, extra = {}) {
  const n = clean(name);
  if (!n) throw new Error('El nombre es obligatorio.');
  if (!(await db.blocks.get(blockKey))) throw new Error('El bloque no existe.');
  const dup = (await db.manifestations.where('blockKey').equals(blockKey).toArray()).find((m) => clean(m.name).toLowerCase() === n.toLowerCase());
  if (dup) throw new Error(`Ya existe una manifestación llamada «${dup.name}».`);
  const id = await db.manifestations.add({ name: n, blockKey, order: await nextOrder(db.manifestations), archived: false, createdAt: now(), ...extra });
  await audit(db, 'catalogo-manifestacion-creada', { id });
  return id;
}

export async function createZone(db, { name }, extra = {}) {
  const n = clean(name);
  if (!n) throw new Error('El nombre es obligatorio.');
  if ((await db.zones.toArray()).some((z) => clean(z.name).toLowerCase() === n.toLowerCase())) throw new Error('Ya existe una zona con ese nombre.');
  const id = await db.zones.add({ name: n, order: await nextOrder(db.zones), archived: false, createdAt: now(), ...extra });
  await audit(db, 'catalogo-zona-creada', { id });
  return id;
}

async function renameIn(db, tableName, entity, id, name) {
  const t = db.table(tableName);
  const cur = await t.get(id);
  if (!cur) throw new Error('El elemento no existe.');
  const n = clean(name);
  if (!n) throw new Error('El nombre es obligatorio.');
  await t.update(id, { name: n });
  await logChange(db, `catalogo-${entity}-modificada`, entity, id, cur, { name: n });
}
export const renameManifestation = (db, id, name) => renameIn(db, 'manifestations', 'manifestacion', id, name);
export const renameZone = (db, id, name) => renameIn(db, 'zones', 'zona', id, name);

async function archiveIn(db, tableName, entity, id, archived) {
  const t = db.table(tableName);
  if (!(await t.get(id))) throw new Error('El elemento no existe.');
  await t.update(id, { archived: !!archived });
  await audit(db, `catalogo-${entity}-${archived ? 'archivada' : 'activada'}`, { id });
}
export const setManifestationArchived = (db, id, a) => archiveIn(db, 'manifestations', 'manifestacion', id, a);
export const setZoneArchived = (db, id, a) => archiveIn(db, 'zones', 'zona', id, a);

// ---------- Tests ----------
export async function createTest(db, { name, blockKey = 'fuerza', manifestationId = null, zoneId = null, notes = '' }, extra = {}) {
  const n = clean(name);
  if (!n) throw new Error('El nombre del test es obligatorio.');
  if (!(await db.blocks.get(blockKey))) throw new Error('El bloque no existe.');
  if (manifestationId !== null && !(await db.manifestations.get(manifestationId))) throw new Error('La manifestación no existe.');
  if (zoneId !== null && !(await db.zones.get(zoneId))) throw new Error('La zona no existe.');
  const dup = (await db.tests.where('blockKey').equals(blockKey).toArray()).find(
    (t) => clean(t.name).toLowerCase() === n.toLowerCase() && (t.zoneId ?? null) === zoneId && (t.manifestationId ?? null) === manifestationId,
  );
  if (dup) throw new Error(`Ya existe un test «${dup.name}» en esa manifestación y zona.`);
  const id = await db.tests.add({ name: n, blockKey, manifestationId, zoneId, notes: clean(notes), archived: false, order: await nextOrder(db.tests), createdAt: now(), updatedAt: now(), ...extra });
  await audit(db, 'catalogo-test-creado', { id });
  return id;
}

export async function updateTest(db, id, patch, reason = '') {
  const cur = await db.tests.get(id);
  if (!cur) throw new Error('El test no existe.');
  const next = {};
  if (patch.name !== undefined) {
    next.name = clean(patch.name);
    if (!next.name) throw new Error('El nombre del test es obligatorio.');
  }
  if (patch.notes !== undefined) next.notes = clean(patch.notes);
  if (patch.manifestationId !== undefined) {
    if (patch.manifestationId !== null && !(await db.manifestations.get(patch.manifestationId))) throw new Error('La manifestación no existe.');
    next.manifestationId = patch.manifestationId;
  }
  if (patch.zoneId !== undefined) {
    if (patch.zoneId !== null && !(await db.zones.get(patch.zoneId))) throw new Error('La zona no existe.');
    next.zoneId = patch.zoneId;
  }
  if (patch.pbCriterioVariableId !== undefined) {
    if (patch.pbCriterioVariableId !== null) {
      const v = await db.variables.get(patch.pbCriterioVariableId);
      if (!v || v.testId !== id || v.archived || v.kind === 'derived') throw new Error('La variable criterio debe ser una variable de origen y activa de este test.');
    }
    next.pbCriterioVariableId = patch.pbCriterioVariableId;
  }
  for (const k of ['panelColumnas', 'excluirAsimetrias']) if (patch[k] !== undefined) { if (typeof patch[k] !== 'boolean') throw new Error('Opción no válida.'); next[k] = patch[k]; }
  await db.tests.update(id, { ...next, updatedAt: now() });
  await logChange(db, 'catalogo-test-modificado', 'test', id, cur, next, reason);
}

export const setTestArchived = (db, id, a) => archiveIn(db, 'tests', 'test', id, a);

export async function deleteTest(db, id) {
  const u = await testUsage(db, id);
  if (u.datos) throw new Error('El test tiene datos: archívalo en vez de eliminarlo.');
  if (u.variables || u.protocols) throw new Error('El test tiene variables o protocolos: elimínalos primero o archiva el test.');
  await db.tests.delete(id);
  await audit(db, 'catalogo-test-eliminado', { id });
}

// ---------- Protocolos ----------
export async function createProtocol(db, { testId, name, description = '' }) {
  if (!(await db.tests.get(testId))) throw new Error('El test no existe.');
  const n = clean(name);
  if (!n) throw new Error('El nombre del protocolo es obligatorio.');
  const dup = (await db.protocols.where('testId').equals(testId).toArray()).find((p) => clean(p.name).toLowerCase() === n.toLowerCase());
  if (dup) throw new Error('Ya existe un protocolo con ese nombre en este test.');
  const id = await db.protocols.add({ testId, name: n, description: clean(description), archived: false, createdAt: now() });
  await audit(db, 'catalogo-protocolo-creado', { id, testId });
  return id;
}

export async function updateProtocol(db, id, { name, description }) {
  const cur = await db.protocols.get(id);
  if (!cur) throw new Error('El protocolo no existe.');
  const next = {};
  if (name !== undefined) {
    next.name = clean(name);
    if (!next.name) throw new Error('El nombre del protocolo es obligatorio.');
  }
  if (description !== undefined) next.description = clean(description);
  await db.protocols.update(id, next);
  await logChange(db, 'catalogo-protocolo-modificado', 'protocolo', id, cur, next);
}

export const setProtocolArchived = (db, id, a) => archiveIn(db, 'protocols', 'protocolo', id, a);

// ---------- Variables ----------
export async function validateFormula(db, testId, formula, selfId = null) {
  if (formula === null || formula === undefined) return null;
  const op = formula.op ?? null;
  const text = clean(formula.text);
  if (op === null) return text ? { op: null, operands: [], params: {}, text } : null;
  const def = OPERATIONS[op];
  if (!def) throw new Error(`Operación desconocida: «${op}».`);
  const operands = (formula.operands ?? []).map(Number);
  if (operands.length !== def.operands) throw new Error(`«${def.label}» necesita ${def.operands} variable de origen.`);
  for (const o of operands) {
    if (o === selfId) throw new Error('Una variable no puede depender de sí misma.');
    const v = await db.variables.get(o);
    if (!v || v.testId !== testId) throw new Error('La variable de origen debe existir y pertenecer al mismo test.');
    if (v.kind === 'derived') throw new Error('La variable de origen debe ser un dato de origen, no otra calculada.');
  }
  const params = {};
  for (const [k, dflt] of Object.entries(def.params)) {
    const val = formula.params?.[k] ?? dflt;
    if (typeof val !== 'number' || !Number.isFinite(val) || val <= 0) throw new Error(`El parámetro «${k}» debe ser un número positivo.`);
    params[k] = val;
  }
  return { op, operands, params, text };
}

export async function createVariable(db, { testId, name, unit = null, sides = null, direction = null, manifestationId = null, kind = 'raw', formula = null, notes = '' }, extra = {}) {
  const test = await db.tests.get(testId);
  if (!test) throw new Error('El test no existe.');
  const n = clean(name);
  if (!n) throw new Error('El nombre de la variable es obligatorio.');
  if ((await db.variables.where('testId').equals(testId).toArray()).some((v) => clean(v.name).toLowerCase() === n.toLowerCase())) throw new Error('Ya existe una variable con ese nombre en este test.');
  if (manifestationId !== null && !(await db.manifestations.get(manifestationId))) throw new Error('La manifestación no existe.');
  if (!(kind in KINDS)) throw new Error('Tipo de variable no válido.');
  const f = await validateFormula(db, testId, formula);
  if (kind === 'raw' && f?.op) throw new Error('Un dato de origen no puede tener una operación; márcalo como calculada.');
  const row = {
    testId, name: n, unit: f?.op ? OPERATIONS[f.op].unit : nullable(unit), sides: oneOf(sides, SIDES, 'El tipo de valor'), direction: oneOf(direction, DIRECTIONS, 'La dirección'),
    manifestationId, kind, formula: f, formulaVersion: f ? 1 : 0, notes: clean(notes), archived: false, order: await nextOrder(db.variables), createdAt: now(), updatedAt: now(), ...extra,
  };
  const id = await db.variables.add(row);
  if (f) await db.formulaHistory.add({ variableId: id, version: 1, formula: f, at: now(), reason: 'Definición inicial' });
  await audit(db, 'catalogo-variable-creada', { id, testId });
  return id;
}

export async function updateVariable(db, id, patch, reason = '') {
  const cur = await db.variables.get(id);
  if (!cur) throw new Error('La variable no existe.');
  const next = {};
  if (patch.name !== undefined) {
    next.name = clean(patch.name);
    if (!next.name) throw new Error('El nombre de la variable es obligatorio.');
    const dup = (await db.variables.where('testId').equals(cur.testId).toArray()).find((v) => v.id !== id && clean(v.name).toLowerCase() === next.name.toLowerCase());
    if (dup) throw new Error('Ya existe una variable con ese nombre en este test.');
  }
  if (patch.unit !== undefined) next.unit = nullable(patch.unit);
  if (patch.sides !== undefined) next.sides = oneOf(patch.sides, SIDES, 'El tipo de valor');
  if (patch.direction !== undefined) next.direction = oneOf(patch.direction, DIRECTIONS, 'La dirección');
  if (patch.notes !== undefined) next.notes = clean(patch.notes);
  if (patch.manifestationId !== undefined) {
    if (patch.manifestationId !== null && !(await db.manifestations.get(patch.manifestationId))) throw new Error('La manifestación no existe.');
    next.manifestationId = patch.manifestationId;
  }
  if (patch.formula !== undefined) {
    const f = await validateFormula(db, cur.testId, patch.formula, id);
    if (cur.kind === 'raw' && f?.op) throw new Error('Un dato de origen no puede tener una operación.');
    if (JSON.stringify(f) !== JSON.stringify(cur.formula ?? null)) {
      if (!clean(reason)) throw new Error('Para cambiar una fórmula hay que indicar el motivo: queda en el historial de versiones.');
      next.formula = f;
      next.formulaVersion = (cur.formulaVersion ?? 0) + 1;
      await db.formulaHistory.add({ variableId: id, version: next.formulaVersion, formula: f, at: now(), reason: clean(reason) });
    }
  }
  // La unidad de una variable con operación la fija la operación (evita etiqueta, fórmula y unidad incoherentes).
  const effective = next.formula !== undefined ? next.formula : cur.formula;
  if (effective?.op) next.unit = OPERATIONS[effective.op].unit;
  if (patch.excluirAsimetrias !== undefined) { if (typeof patch.excluirAsimetrias !== 'boolean') throw new Error('Opción no válida.'); next.excluirAsimetrias = patch.excluirAsimetrias; }
  await db.variables.update(id, { ...next, updatedAt: now() });
  await logChange(db, 'catalogo-variable-modificada', 'variable', id, cur, next, reason);
}

export const setVariableArchived = (db, id, a) => archiveIn(db, 'variables', 'variable', id, a);

export async function deleteVariable(db, id) {
  const u = await variableUsage(db, id);
  if (u.datos) throw new Error('El test de esta variable tiene datos: archiva la variable en vez de eliminarla.');
  if (u.dependientes.length) throw new Error(`Otras variables dependen de esta: ${u.dependientes.join(', ')}.`);
  await db.variables.delete(id);
  await db.formulaHistory.where('variableId').equals(id).delete();
  await audit(db, 'catalogo-variable-eliminada', { id });
}
