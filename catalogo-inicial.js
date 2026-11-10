// catalogo-inicial.js — catálogo inicial: SOLO lo que aportó el usuario (guía, «Catálogo inicial aportado por el usuario»,
// «Variables y unidades», «Relativización» y los PDF de exportación de VALD que subió el 7 de noviembre de 2026).
// No se inventan tests, variables, unidades, direcciones de interpretación ni fórmulas. Todo lo demás queda sin definir
// y se completa desde la pantalla del catálogo. La unidad es la que muestra el PDF; si el PDF no trae unidad
// (índices RSI), queda sin definir.
//
// Decisión de modelado (D4 y regla de la guía «no duplicar el test»): Run-Specific Iso-Push aparece en la lista de
// dos manifestaciones (Peak Force en Max Isometric Strength y 100 ms RFD en Explosive Strength). Es UN test con dos
// variables, cada una bajo su manifestación.

import { audit } from './db.js';
import { SW_FACTOR_DEFAULT, testUsage } from './catalogo.js';
import { ISO_PAIRS, RM12_TESTS, RM_EST_FACTOR_DEFAULT, pairFactor } from './isohold.js';

export const CATALOG_SEED_VERSION = 11;

const BLOCKS = [
  { key: 'fuerza', name: 'Manifestaciones de la fuerza' },
  { key: 'perimetros', name: 'Perímetros' },
  { key: 'nme', name: 'NME' },
];

const MANIFESTATIONS = ['Max Isometric Strength', 'Heavy Dynamic Strength', 'Fast Dynamic Strength', 'Reactive Strength', 'Explosive Strength'];
const ZONES = ['Groin', 'Hip', 'Knee', 'Ankle'];

// Tests por zona y manifestación (lista del usuario). Los dos Run-Specific Iso-Push de cada zona se declaran una sola vez.
const TESTS = [
  ['Hip', 'Max Isometric Strength', ['Run-Specific Hip Iso-Push', 'Hip Iso-Hold 20 s', 'Supine Isometric 90°/90° Leg Curl Test', 'Standing Isometric 90°/20° Hamstring Test']],
  ['Hip', 'Heavy Dynamic Strength', ['Nordic Hamstring Exercise', 'Hamstring Bridge 30 cm 8RM', 'Single-Leg Knee Flexion 8RM', 'RDL Force–Velocity Profile', 'Hip Thrust Force–Velocity Profile']],
  ['Knee', 'Max Isometric Strength', ['Run-Specific Knee Iso-Push', 'Knee Iso-Hold 20 s', 'Seated Isometric 90°/90° Knee Extension Test']],
  ['Knee', 'Heavy Dynamic Strength', ['Double-Leg Leg Press 45° 8RM', 'Single-Leg Leg Press 45° 8RM', 'RFESS 45° 8RM', 'Back Squat Force–Velocity Profile', 'Trap Bar Squat Force–Velocity Profile']],
  ['Ankle', 'Max Isometric Strength', ['Run-Specific Ankle Iso-Push', 'Ankle Iso-Hold 20 s', 'Single-Leg Seated Calf Raise Iso-Hold 20 s', 'Single-Leg Seated Calf Raise', 'Supine Isometric Ankle Inversion', 'Supine Isometric Ankle Eversion']],
  ['Ankle', 'Heavy Dynamic Strength', ['Single-Leg Standing Calf Raise 12RM', 'Single-Leg Seated Calf Raise 6RM']],
  ['Groin', 'Max Isometric Strength', ['Hip Adduction 0° (Long Lever)', 'Hip Abduction 0° (Long Lever)', 'Hip Adduction 45° (Short Lever)']],
  [null, 'Fast Dynamic Strength', ['CMJ', 'SL CMJ', 'Squat Jump']],
  [null, 'Reactive Strength', ['Double-Leg Hop Test', 'DL Drop Jump 30 cm', 'DL Drop Jump 45 cm']],
];

// Variables por test (PDF de VALD del 7 de noviembre de 2026): nombre, unidad y tipo de valor. Sin direcciones ni fórmulas.
// «single» = un valor por repetición; «LR» = un valor por lado. Las asimetrías de VALD ([% L,R]) llevan unidad %.
const v = (name, unit = null, sides = 'single') => ({ name, unit, sides });
const asym = (name) => v(name, '%');

const CMJ_VARIABLES = [
  v('ECC DECEL PHASE DURATION', 's'), v('CONCENTRIC DURATION', 'ms'), v('CONTRACTION TIME', 'ms'), v('DEPTH', 'cm'), v('RSI MOD', 'm/s'),
  v('COM STIFFNESS', 'N/m'), v('ECC DECEL RFD', 'N/s/kg'), v('CON IMPULSE 100ms', 'N s'), v('CON PEAK POWER/BM', 'W/kg'), v('CON IMPULSE', 'N s'),
  v('JH (imp-mom)', 'cm'), v('FORCE AT 0 VELOCITY', 'N/kg'), v('ECC DECELERATION IMPULSE', 'N s'), v('ECC PEAK POWER/BM', 'W/kg'), v('ECC PEAK VELOCITY', 'm/s'),
  asym('ECC DECEL RFD ASYM'), asym('CON IMPULSE 100ms ASYM'), asym('CON IMPULSE ASYM'), asym('ECC DECEL IMPULSE ASYM'), asym('PEAK LANDING FORCE ASYM'),
];

// SL CMJ: un valor por lado (izquierdo y derecho), sin asimetrías. Takeoff Peak Force y Peak Landing Force van relativos a la masa (N/kg),
// como en las exportaciones CSV de VALD del 7/11/2026 (el PDF mostraba N): las exportaciones son el formato desde el que se cargan los datos.
const SL_CMJ_VARIABLES = [
  ['CONCENTRIC PEAK FORCE / BM', 'N/kg'], ['TAKEOFF PEAK FORCE / BM', 'N/kg'], ['ECC DECEL PHASE DURATION', 's'], ['CONCENTRIC DURATION', 'ms'], ['CONTRACTION TIME', 'ms'],
  ['DEPTH', 'cm'], ['JH (imp-mom)', 'cm'], ['RSI MOD', 'm/s'], ['COM STIFFNESS', 'N/m'], ['ECC DECEL RFD', 'N/s/kg'], ['CON IMPULSE 100ms', 'N s'],
  ['CON PEAK POWER/BM', 'W/kg'], ['FORCE AT 0 VELOCITY', 'N/kg'], ['ECC PEAK POWER/BM', 'W/kg'], ['ECC PEAK VELOCITY', 'm/s'], ['PEAK LANDING FORCE / BM', 'N/kg'],
].map(([n, u]) => v(n, u, 'LR'));

const SQUAT_JUMP_VARIABLES = [v('JH (imp-mom)', 'cm'), v('RSI MOD', 'm/s'), v('CON IMPULSE 100ms', 'N s'), v('CON RFD 100ms', 'N/s')];

const HOP_VARIABLES = [
  v('MEAN RSI (FLIGHT TIME / CONTACT TIME)'), v('MEAN JUMP HEIGHT (Flight Time) (cm)', 'cm'), v('MEAN CONTACT TIME', 'ms'),
  v('MEAN PEAK FORCE', 'N'), asym('MEAN PEAK FORCE ASYMMETRY'), v('MEAN IMPULSE', 'N s'), asym('MEAN IMPULSE ASYMMETRY'),
  v('MEAN ACTIVE STIFFNESS', 'N/m'), asym('MEAN ACTIVE STIFFNESS ASYMMETRY'), v('MEAN LANDING RFD', 'N/s'), asym('MEAN LANDING RFD ASYMMETRY'),
];

// Drop Jump: el PDF no indica la altura; se aplican las mismas variables a 30 y 45 cm (como en la lista anterior del usuario).
// Atención: el tiempo de contacto del Drop Jump está en segundos y el del Hop Test en milisegundos (así lo muestran los PDF).
const DROP_JUMP_VARIABLES = [
  v('RSI (FLIGHT TIME / CONTACT TIME)'), v('JUMP HEIGHT (Flight Time - cm)', 'cm'), v('CONTACT TIME', 's'),
  v('ECCENTRIC IMPULSE', 'N s'), asym('ECCENTRIC IMPULSE ASYMMETRY'), v('PEAK POWER / BM', 'W/kg'), v('CONCENTRIC IMPULSE', 'N s'), asym('CONCENTRIC IMPULSE ASYMMETRY'),
  v('ACTIVE STIFFNESS', 'N/m'), asym('ACTIVE STIFFNESS ASYMMETRY'), asym('DROP LANDING RFD ASYMMETRY'), asym('PEAK DROP LANDING FORCE ASYMMETRY'),
];

// D5 (6 a 8/11/2026). Nordic: nombres como la tabla Premier para que se enlacen las referencias; la asimetría se guarda CON SIGNO (todas las asimetrías llevan signo).
// RM e Iso-Hold: la carga la introduce el usuario (no viene de VALD). Las variables calculadas (MVIC, %PIMA, %BW/%SW, 1RM estimado) se crean en ensureDerived.
const HDS = 'Heavy Dynamic Strength';
const MAXISO = 'Max Isometric Strength';
const NORDIC_VARIABLES = [
  { name: 'Max Force', unit: 'N', sides: 'LR', manifestation: HDS },
  { name: 'Max Force Asymmetry', unit: '%', sides: 'single', manifestation: HDS, notes: 'Con signo. La referencia Premier del Nordic se compara en valor absoluto. La convención de signo no está verificada frente a la de la app de origen (D25).' },
  { name: 'Torque', unit: 'Nm', sides: 'LR', manifestation: HDS },
];
const RM_TESTS = ['Hamstring Bridge 30 cm 8RM', 'Single-Leg Knee Flexion 8RM', 'Double-Leg Leg Press 45° 8RM', 'Single-Leg Leg Press 45° 8RM', 'RFESS 45° 8RM', 'Single-Leg Standing Calf Raise 12RM', 'Single-Leg Seated Calf Raise 6RM'];
const LOAD_NOTE = 'Carga que introduces tú, no viene de VALD (D5).';
const MAX_LOAD = [{ name: 'Carga máxima (kg)', unit: 'kg', sides: 'single', manifestation: HDS, notes: LOAD_NOTE + ' Carga máxima movilizada hasta el momento; sin Personal Average (decidido el 8/11/2026).' }];
const HOLD_LOAD = [{ name: 'Carga externa (kg)', unit: 'kg', sides: 'single', manifestation: MAXISO, notes: LOAD_NOTE + ' Carga externa añadida con la que se han trabajado 3 series de 20 s; sin Personal Average.' }];
const VARIABLES_BY_TEST = {
  'Nordic Hamstring Exercise': NORDIC_VARIABLES,
  ...Object.fromEntries(RM_TESTS.map((n) => [n, MAX_LOAD])),
  ...Object.fromEntries(Object.keys(ISO_PAIRS).map((n) => [n, HOLD_LOAD])),
  CMJ: CMJ_VARIABLES,
  'SL CMJ': SL_CMJ_VARIABLES,
  'Squat Jump': SQUAT_JUMP_VARIABLES,
  'Double-Leg Hop Test': HOP_VARIABLES,
  'DL Drop Jump 30 cm': DROP_JUMP_VARIABLES,
  'DL Drop Jump 45 cm': DROP_JUMP_VARIABLES,
};

// Run-Specific Iso-Push: Peak Force (N), relativo (SW en Hip, BW en Knee y Ankle) y asimetría; RFD at 100 ms sin unidad ni fórmula.
const ISO_PUSH = {
  'Run-Specific Hip Iso-Push': { rel: 'REL_SW', relName: 'Peak Force relativo (SW)', relUnit: 'SW' },
  'Run-Specific Knee Iso-Push': { rel: 'REL_BW', relName: 'Peak Force relativo (BW)', relUnit: 'BW' },
  'Run-Specific Ankle Iso-Push': { rel: 'REL_BW', relName: 'Peak Force relativo (BW)', relUnit: 'BW' },
  // 7 de noviembre de 2026: las mismas variables se aplican a estos dos tests. Hip → SW (29 %); el calf raise sentado usa otra variante de SW (5 % del peso corporal).
  'Supine Isometric 90°/90° Leg Curl Test': { rel: 'REL_SW', relName: 'Peak Force relativo (SW)', relUnit: 'SW' },
  'Single-Leg Seated Calf Raise': { rel: 'REL_SW', relName: 'Peak Force relativo (SW)', relUnit: 'SW', factor: 0.05, relNotes: 'SW de este test = 5 % del peso corporal (variante indicada por el usuario el 7/11; sin fuente verificada).' },
};

// Variables explosivas del Run-Specific Iso-Push (PDF de VALD): RFD at 100 ms (N/s) y Force at 100 ms (N); ambas en Explosive Strength.
const ISO_EXPLOSIVE = [
  { name: 'RFD at 100 ms', unit: 'N/s', sides: 'LR', manifestation: 'Explosive Strength', notes: 'Fórmula relativa pendiente de definir por el usuario.' },
  { name: 'Force at 100 ms', unit: 'N', sides: 'LR', manifestation: 'Explosive Strength', notes: '' },
];
const OLD_RFD_NOTE = 'Unidad y fórmula relativa pendientes de definir por el usuario.';
const ISO_HOLD_TESTS = ['Hip Iso-Hold 20 s', 'Knee Iso-Hold 20 s', 'Ankle Iso-Hold 20 s', 'Single-Leg Seated Calf Raise Iso-Hold 20 s'];

export const CATALOG_TABLES = ['blocks', 'manifestations', 'zones', 'tests', 'protocols', 'variables', 'formulaHistory'];

export async function seedInitialCatalog(db) {
  const prev = await db.meta.get('catalogSeeded');
  if (prev) return { sembrado: false, ...(await migrateCatalog(db, prev)) };
  const counts = { tests: 0, variables: 0 };
  await db.transaction('rw', [...CATALOG_TABLES.map((n) => db.table(n)), db.meta, db.auditLog], async () => {
    if (await db.meta.get('catalogSeeded')) return;
    const ts = new Date().toISOString();
    const source = 'inicial';
    // Si ya hay algo (por ejemplo, el usuario creó elementos antes de que se sembrara), no se mezcla: solo se completan los bloques.
    const empty = (await db.manifestations.count()) + (await db.zones.count()) + (await db.tests.count()) === 0;
    for (const [i, b] of BLOCKS.entries()) if (!(await db.blocks.get(b.key))) await db.blocks.put({ key: b.key, name: b.name, order: i + 1, archived: false });
    if (empty) {
      const manId = {};
      for (const [i, name] of MANIFESTATIONS.entries()) manId[name] = await db.manifestations.add({ name, blockKey: 'fuerza', order: i + 1, archived: false, createdAt: ts, source });
      const zoneId = {};
      for (const [i, name] of ZONES.entries()) zoneId[name] = await db.zones.add({ name, order: i + 1, archived: false, createdAt: ts, source });
      let order = 0;
      const addVar = async (testId, v) => {
        const formula = v.formula ?? null;
        const id = await db.variables.add({
          testId, name: v.name, unit: v.unit ?? null, sides: v.sides ?? null, direction: null, manifestationId: v.manifestationId ?? null,
          kind: v.kind ?? 'raw', formula, formulaVersion: formula ? 1 : 0, notes: v.notes ?? '', archived: false, order: ++order, createdAt: ts, updatedAt: ts, source,
        });
        if (formula) await db.formulaHistory.add({ variableId: id, version: 1, formula, at: ts, reason: 'Catálogo inicial' });
        counts.variables++;
        return id;
      };
      const testIds = {};
      let torder = 0;
      for (const [zone, man, names] of TESTS) {
        for (const name of names) {
          const id = await db.tests.add({ name, blockKey: 'fuerza', manifestationId: manId[man], zoneId: zone ? zoneId[zone] : null, notes: '', archived: false, order: ++torder, createdAt: ts, updatedAt: ts, source });
          testIds[name] = id;
          counts.tests++;
        }
      }
      for (const [name, cfg] of Object.entries(ISO_PUSH)) {
        const t = testIds[name];
        const peak = await addVar(t, { name: 'Peak Force', unit: 'N', sides: 'LR', manifestationId: manId['Max Isometric Strength'] });
        const params = cfg.rel === 'REL_SW' ? { factor: cfg.factor ?? SW_FACTOR_DEFAULT } : {};
        await addVar(t, { name: cfg.relName, unit: cfg.relUnit, sides: 'LR', kind: 'derived', manifestationId: manId['Max Isometric Strength'], notes: cfg.relNotes ?? '', formula: { op: cfg.rel, operands: [peak], params, text: '' } });
        await addVar(t, { name: 'Peak Force asimetría (%)', unit: '%', sides: 'single', kind: 'derived', manifestationId: manId['Max Isometric Strength'], formula: { op: 'ASIMETRIA', operands: [peak], params: {}, text: '' } });
        for (const e of ISO_EXPLOSIVE) await addVar(t, { name: e.name, unit: e.unit, sides: e.sides, manifestationId: manId[e.manifestation], notes: e.notes });
      }
      for (const [test, vars] of Object.entries(VARIABLES_BY_TEST)) for (const x of vars) await addVar(testIds[test], { ...x, manifestationId: x.manifestation ? manId[x.manifestation] : x.manifestationId });
      await ensureDerived(db, ts, counts);
      await ensureGroinAnkle(db, ts, counts);
    }
    await ensurePerimeters(db, ts, counts);
    await ensureJurdan(db, ts, counts);
    await ensureToeTouch(db, ts, counts);
    await ensureNordicRelative(db, ts, counts);
    counts.direccionesAsignadas = await defaultDirections(db, ts);
    await db.meta.put({ key: 'catalogSeeded', value: { version: CATALOG_SEED_VERSION, at: ts, vacioAlSembrar: empty } });
    await audit(db, 'catalogo-inicial-cargado', { version: CATALOG_SEED_VERSION, ...counts });
  });
  return { sembrado: true, ...counts };
}


// 7 de noviembre de 2026 (D50): el usuario indica «Personal Best: más alto es mejor». Las variables SIN dirección pasan a «Más alto es mejor»,
// salvo las asimetrías (unidad %, con signo: un «mejor» no tiene sentido). Nunca se toca una dirección ya definida. Cada ejecución queda en el registro.
// Solo el TIEMPO de contacto (suelo) es «más bajo es mejor». El RSI también lleva «CONTACT TIME» en el nombre («FLIGHT TIME / CONTACT TIME») y es «más alto es mejor» (9/11/2026).
// Direcciones confirmadas por el usuario el 9/11/2026: «más bajo es mejor» en tiempo de contacto, duraciones, profundidad y velocidad excéntrica pico (valores negativos);
// «más alto es mejor» en COM STIFFNESS, FORCE AT 0 VELOCITY y las rigideces activas (Hop Test y Drop Jump), que son también el valor por defecto.
export const LOWER_IS_BETTER = /^((mean )?contact time|ecc decel phase duration|concentric duration|contraction time|depth|ecc peak velocity)$/i;
async function defaultDirections(db, ts) {
  const all = await db.variables.toArray();
  const perim = new Set((await db.tests.toArray()).filter((t) => ['perimetros', 'nme'].includes(t.blockKey)).map((t) => t.id)); // perímetros y NME: sin dirección definida por el usuario
  const todo = all.filter((v) => (v.direction ?? null) === null && v.unit !== '%' && !perim.has(v.testId));
  for (const v of todo) await db.variables.update(v.id, { direction: LOWER_IS_BETTER.test(v.name) ? 'lower' : 'higher', updatedAt: ts }); // tiempo de contacto: más bajo es mejor (D50)
  if (todo.length) await audit(db, 'catalogo-direccion-por-defecto', { cantidad: todo.length, direccion: 'higher', excepciones: 'contact time = lower', excluye: 'asimetrias (%)' });
  return todo.length;
}

// 9/11/2026: los 5 perímetros que indica el usuario, en el bloque Perímetros como UN test con 5 variables (nombres tal como los escribió el usuario).
// Confirmado por el usuario: se miden por lado (izquierdo y derecho), en cm y con una medición por sesión. Sin dirección («más alto es mejor» no está definido): percentil estadístico sin color.
export const PERIMETERS_TEST = 'Perímetros';
export const PERIMETERS = [
  'THIGHT PERIMETER (1 CM UNDER FOLD GLUTE)', 'MIDDLE THIGHT PERIMETER', '10 CM ABOVE PATELLA PERIMETER', '5 CM ABOVE PATELLA PERIMETER', 'MAXIMUM CALF PERIMETER',
];
async function ensurePerimeters(db, ts, counts) {
  const lc = (x) => String(x ?? '').trim().toLowerCase();
  let t = (await db.tests.toArray()).find((x) => lc(x.name) === lc(PERIMETERS_TEST) && x.blockKey === 'perimetros');
  if (!t) {
    const torder = (await db.tests.orderBy('order').last())?.order ?? 0;
    const id = await db.tests.add({ name: PERIMETERS_TEST, blockKey: 'perimetros', manifestationId: null, zoneId: null, notes: 'Perímetros por lado (cm), una medición por sesión.', archived: false, order: torder + 1, createdAt: ts, updatedAt: ts, source: 'inicial' });
    t = await db.tests.get(id);
    counts.tests = (counts.tests ?? 0) + 1;
  }
  const existing = await db.variables.where('testId').equals(t.id).toArray();
  let order = (await db.variables.orderBy('order').last())?.order ?? 0;
  for (const name of PERIMETERS) {
    if (existing.some((x) => lc(x.name) === lc(name))) continue;
    await db.variables.add({ testId: t.id, name, unit: 'cm', sides: 'LR', direction: null, manifestationId: null, kind: 'raw', formula: null, formulaVersion: 0, notes: '', archived: false, order: ++order, createdAt: ts, updatedAt: ts, source: 'inicial' });
    counts.variables = (counts.variables ?? 0) + 1; counts.perimetrosAnadidos = (counts.perimetrosAnadidos ?? 0) + 1;
  }
}

// 9/11/2026: primer sub-apartado de NME = «Jurdan Test» (Excel del usuario, hoja NME). Un test con las variables de su cabecera, tal como las escribió.
// Sin dirección (no la indicó). Los ángulos, en grados. El Toe-Touch es otro sub-apartado de NME (ensureToeTouch). Idempotente.
// Para añadir más tests de medida de ángulos basta con crearlos en el bloque NME (pantalla del catálogo); el importador y la ficha del jugador ya los admiten.
export const JURDAN_TEST = 'Jurdan Test';
export const JURDAN_VARIABLES = [
  { name: 'JURDAN HAMS (SHIN ANGLE = TIBIA vs HORIZONTAL)', unit: '°', sides: 'LR', notes: '' },
  { name: 'JURDAN PSOAS (THIGH ANGLE = FÉMUR vs HORIZONTAL)', unit: '°', sides: 'LR', notes: '' },
  { name: 'JURDAN RECTUS FEMORIS (FÉMUR vs TIBIA)', unit: '°', sides: 'LR', notes: '' },
  { name: 'JURDAN RESULTS', unit: '°', sides: 'LR', notes: 'Izquierda = Hams izquierdo − Psoas derecho («LEFT SHIN vs RIGHT THIGH»); Derecha = Hams derecho − Psoas izquierdo («RIGHT SHIN vs LEFT THIGH»). Se importa el valor calculado en el Excel.' },
];
async function ensureJurdan(db, ts, counts) {
  const lc = (x) => String(x ?? '').trim().toLowerCase();
  let man = (await db.manifestations.toArray()).find((m) => lc(m.name) === lc(JURDAN_TEST) && m.blockKey === 'nme');
  if (!man) {
    const morder = (await db.manifestations.orderBy('order').last())?.order ?? 0;
    const id = await db.manifestations.add({ name: JURDAN_TEST, blockKey: 'nme', order: morder + 1, archived: false, createdAt: ts, source: 'inicial' });
    man = await db.manifestations.get(id);
  }
  let t = (await db.tests.toArray()).find((x) => lc(x.name) === lc(JURDAN_TEST) && x.blockKey === 'nme');
  if (!t) {
    const torder = (await db.tests.orderBy('order').last())?.order ?? 0;
    const id = await db.tests.add({ name: JURDAN_TEST, blockKey: 'nme', manifestationId: man.id, zoneId: null, notes: 'Primer test del bloque NME (rango de movimiento).', archived: false, order: torder + 1, createdAt: ts, updatedAt: ts, source: 'inicial' });
    t = await db.tests.get(id);
    counts.tests = (counts.tests ?? 0) + 1;
  }
  const existing = await db.variables.where('testId').equals(t.id).toArray();
  let order = (await db.variables.orderBy('order').last())?.order ?? 0;
  for (const v of JURDAN_VARIABLES) {
    if (existing.some((x) => lc(x.name) === lc(v.name))) continue;
    await db.variables.add({ testId: t.id, name: v.name, unit: v.unit, sides: v.sides, direction: null, manifestationId: man.id, kind: 'raw', formula: null, formulaVersion: 0, notes: v.notes, archived: false, order: ++order, createdAt: ts, updatedAt: ts, source: 'inicial' });
    counts.variables = (counts.variables ?? 0) + 1; counts.jurdanAnadidas = (counts.jurdanAnadidas ?? 0) + 1;
  }
}

// 10/11/2026: Toe-Touch Test, otro sub-apartado de NME (distancia dedos-suelo, en cm: lo confirmó el usuario). Escala que anota en su Excel: mano plana −10, metacarpo −5, dedos 0.
// Sin dirección «mejor/peor» (no la indicó). Idempotente.
export const TOE_TOUCH_TEST = 'Toe-Touch Test';
async function ensureToeTouch(db, ts, counts) {
  const lc = (x) => String(x ?? '').trim().toLowerCase();
  let man = (await db.manifestations.toArray()).find((m) => lc(m.name) === lc(TOE_TOUCH_TEST) && m.blockKey === 'nme');
  if (!man) {
    const morder = (await db.manifestations.orderBy('order').last())?.order ?? 0;
    const id = await db.manifestations.add({ name: TOE_TOUCH_TEST, blockKey: 'nme', order: morder + 1, archived: false, createdAt: ts, source: 'inicial' });
    man = await db.manifestations.get(id);
  }
  let t = (await db.tests.toArray()).find((x) => lc(x.name) === lc(TOE_TOUCH_TEST) && x.blockKey === 'nme');
  if (!t) {
    const torder = (await db.tests.orderBy('order').last())?.order ?? 0;
    const id = await db.tests.add({ name: TOE_TOUCH_TEST, blockKey: 'nme', manifestationId: man.id, zoneId: null, notes: 'Distancia dedos-suelo (cm).', archived: false, order: torder + 1, createdAt: ts, updatedAt: ts, source: 'inicial' });
    t = await db.tests.get(id);
    counts.tests = (counts.tests ?? 0) + 1;
  }
  const existing = await db.variables.where('testId').equals(t.id).toArray();
  if (existing.some((x) => lc(x.name) === 'toe-touch test')) return;
  const order = (await db.variables.orderBy('order').last())?.order ?? 0;
  await db.variables.add({ testId: t.id, name: 'TOE-TOUCH TEST', unit: 'cm', sides: 'single', direction: null, manifestationId: man.id, kind: 'raw', formula: null, formulaVersion: 0, notes: 'Distancia dedos-suelo. Escala del usuario: mano plana −10, metacarpo −5, dedos 0.', archived: false, order: order + 1, createdAt: ts, updatedAt: ts, source: 'inicial' });
  counts.variables = (counts.variables ?? 0) + 1;
}

// Variables calculadas del Iso-Hold y del 1RM estimado (D5). Idempotente: crea solo las que falten, por nombre, a partir de la variable de carga del test.
// El factor del «peso del sistema» sale de la variable relativa del Iso-Push emparejado (Hip 0,29 SW; Knee y Ankle BW; talones sentado SW con su factor).
async function ensureDerived(db, ts, counts) {
  const lc = (x) => String(x ?? '').trim().toLowerCase();
  const tests = await db.tests.toArray();
  const mans = await db.manifestations.toArray();
  const tByName = (n) => tests.find((t) => lc(t.name) === lc(n));
  const manId = (n) => mans.find((m) => lc(m.name) === lc(n))?.id ?? null;
  let order = (await db.variables.orderBy('order').last())?.order ?? 0;
  const make = async (test, loadName, name, op, manifestation, params = {}, notes = '') => {
    const vars = await db.variables.where('testId').equals(test.id).toArray();
    const load = vars.find((x) => lc(x.name) === lc(loadName));
    if (!load || vars.some((x) => lc(x.name) === lc(name))) return;
    const formula = { op, operands: [load.id], params, text: '' };
    const unit = op === 'RM_EST' || op === 'ISO_MVIC' ? 'kg' : '%';
    const id = await db.variables.add({ testId: test.id, name, unit, sides: 'single', direction: 'higher', manifestationId: manId(manifestation), kind: 'derived', formula, formulaVersion: 1, notes, archived: false, order: ++order, createdAt: ts, updatedAt: ts, source: 'inicial' });
    await db.formulaHistory.add({ variableId: id, version: 1, formula, at: ts, reason: 'Catálogo inicial (D5)' });
    counts.variablesAnadidas = (counts.variablesAnadidas ?? 0) + 1;
    counts.variables = (counts.variables ?? 0) + (counts.tests !== undefined ? 1 : 0);
    return id;
  };
  for (const [holdName, pushName] of Object.entries(ISO_PAIRS)) {
    const hold = tByName(holdName), push = tByName(pushName);
    if (!hold) continue;
    const pairVars = push ? await db.variables.where('testId').equals(push.id).toArray() : [];
    const { factor, unitName } = pairFactor(pairVars);
    await make(hold, 'Carga externa (kg)', 'MVIC iso-push (kg)', 'ISO_MVIC', MAXISO, {}, `Calculada con el Personal Average de «${pushName}» y la masa de cada sesión de Iso-Push (D5).`);
    await make(hold, 'Carga externa (kg)', '%PIMA', 'ISO_PIMA', MAXISO, {}, 'Carga externa ÷ MVIC iso-push (kg). La sigla se conserva como la escribe el usuario.');
    if (unitName === 'SW') await make(hold, 'Carga externa (kg)', '%SW', 'ISO_LOAD_SW', MAXISO, { factor }, `Carga externa ÷ (${factor} × masa corporal); masa medida más cercana a hoy.`);
    else await make(hold, 'Carga externa (kg)', '%BW', 'ISO_LOAD_BW', MAXISO, {}, 'Carga externa ÷ masa corporal; masa medida más cercana a hoy.');
  }
  for (const n of RM12_TESTS) { const t = tByName(n); if (t) await make(t, 'Carga máxima (kg)', '1RM estimado (kg)', 'RM_EST', HDS, { factor: RM_EST_FACTOR_DEFAULT }, '(carga + masa corporal) × 1,4, solo en 12RM. Estimado, no medido. 1,4 coincide con Epley a 12 repeticiones (inferencia no verificada con fuente).'); }
}


// 9/11/2026: pruebas de cadera (aducción 0° y 45°, abducción 0°; valor único, el sistema asigna un lado) y de tobillo (inversión y eversión supina; por lado).
// Solo dos variables por test, como pidió el usuario: Peak Force (N) y Peak Force relativo. Cadera: N × longitud de pierna/palanca (m) ÷ masa (kg) = N·m/kg (fórmula de su Excel);
// tobillo: relativo al peso corporal (BW). Idempotente: crea solo lo que falte, por nombre.
export const GROIN_TESTS = ['Hip Adduction 0° (Long Lever)', 'Hip Abduction 0° (Long Lever)', 'Hip Adduction 45° (Short Lever)'];
export const ANKLE_TESTS = ['Supine Isometric Ankle Inversion', 'Supine Isometric Ankle Eversion'];
async function ensureGroinAnkle(db, ts, counts) {
  const lc = (x) => String(x ?? '').trim().toLowerCase();
  const tests = await db.tests.toArray();
  const man = (await db.manifestations.toArray()).find((m) => lc(m.name) === lc(MAXISO))?.id ?? null;
  let order = (await db.variables.orderBy('order').last())?.order ?? 0;
  const bump = () => { counts.variablesAnadidas = (counts.variablesAnadidas ?? 0) + 1; counts.variables = (counts.variables ?? 0) + (counts.tests !== undefined ? 1 : 0); };
  for (const [names, single] of [[GROIN_TESTS, true], [ANKLE_TESTS, false]]) {
    for (const name of names) {
      const t = tests.find((x) => lc(x.name) === lc(name));
      if (!t) continue;
      const vars = await db.variables.where('testId').equals(t.id).toArray();
      let peak = vars.find((x) => lc(x.name) === 'peak force');
      const sides = single ? 'single' : 'LR';
      if (!peak) {
        const id = await db.variables.add({ testId: t.id, name: 'Peak Force', unit: 'N', sides, direction: 'higher', manifestationId: man, kind: 'raw', formula: null, formulaVersion: 0, notes: '', archived: false, order: ++order, createdAt: ts, updatedAt: ts, source: 'inicial' });
        peak = { id }; bump();
      }
      const relName = single ? 'Peak Force relativo (N·m/kg)' : 'Peak Force relativo (BW)';
      if (!vars.some((x) => lc(x.name) === lc(relName))) {
        const formula = { op: single ? 'REL_LEVER' : 'REL_BW', operands: [peak.id], params: {}, text: '' };
        const id = await db.variables.add({ testId: t.id, name: relName, unit: single ? 'N·m/kg' : 'BW', sides, direction: 'higher', manifestationId: man, kind: 'derived', formula, formulaVersion: 1, notes: single ? 'Peak Force (N) × longitud de pierna / palanca (m) ÷ masa corporal (kg).' : '', archived: false, order: ++order, createdAt: ts, updatedAt: ts, source: 'inicial' });
        await db.formulaHistory.add({ variableId: id, version: 1, formula, at: ts, reason: 'Catálogo inicial (9/11/2026)' });
        bump();
      }
    }
  }
}

// 10/11/2026: Nordic Hamstring Exercise — «Max Force relativo (BW)»: fuerza máxima de cada pierna (N) ÷ (masa corporal × 9,80665), igual que el Peak Force relativo de los Iso-Push.
// La variable absoluta (N) se conserva (las referencias de la Premier y los umbrales publicados son absolutos). Se muestra primero la relativa. Idempotente, por nombre.
async function ensureNordicRelative(db, ts, counts) {
  const lc = (x) => String(x ?? '').trim().toLowerCase();
  const t = (await db.tests.toArray()).find((x) => lc(x.name) === lc('Nordic Hamstring Exercise'));
  if (!t) return;
  const vars = await db.variables.where('testId').equals(t.id).toArray();
  const mf = vars.find((x) => lc(x.name) === 'max force' && x.kind === 'raw');
  if (!mf || vars.some((x) => lc(x.name) === 'max force relativo (bw)')) return;
  let order = (await db.variables.orderBy('order').last())?.order ?? 0;
  const formula = { op: 'REL_BW', operands: [mf.id], params: {}, text: '' };
  const id = await db.variables.add({ testId: t.id, name: 'Max Force relativo (BW)', unit: 'BW', sides: 'LR', direction: 'higher', manifestationId: mf.manifestationId ?? null, kind: 'derived', formula, formulaVersion: 1, notes: 'Max Force (N) ÷ (masa corporal × 9,80665), por pierna. Añadida el 10/11/2026 a petición del usuario.', archived: false, order: ++order, createdAt: ts, updatedAt: ts, source: 'inicial' });
  await db.formulaHistory.add({ variableId: id, version: 1, formula, at: ts, reason: 'Catálogo inicial (10/11/2026)' });
  counts.variablesAnadidas = (counts.variablesAnadidas ?? 0) + 1; counts.variables = (counts.variables ?? 0) + (counts.tests !== undefined ? 1 : 0);
}

// Actualiza un catálogo ya cargado con una versión anterior de la semilla, sin pisar nada que el usuario haya editado:
// solo rellena unidades y tipos de valor que estén sin definir, añade las variables que falten, mueve los Iso-Hold a
// Max Isometric Strength si siguen en la manifestación antigua y elimina el duplicado «Run-Specific Ankle Iso-Hold 20 s»
// si no tiene variables, protocolos ni datos. Se ejecuta una sola vez (versión de la semilla en la tabla meta).
async function migrateCatalog(db, prev) {
  if ((prev.value?.version ?? 1) >= CATALOG_SEED_VERSION) return { migrado: false };
  const res = { migrado: true, variablesAnadidas: 0, unidadesRellenadas: 0, unidadesAlineadas: 0, direccionesAsignadas: 0, isoHoldMovidos: 0, duplicadoEliminado: false, duplicadoConservado: false };
  const dataTables = db.tables.filter((t) => ['sessions'].includes(t.name)); // testUsage consulta las sesiones
  await db.transaction('rw', [...CATALOG_TABLES.map((n) => db.table(n)), db.meta, db.auditLog, ...dataTables], async () => {
    const cur = await db.meta.get('catalogSeeded');
    if ((cur?.value?.version ?? 1) >= CATALOG_SEED_VERSION) { res.migrado = false; return; }
    const ts = new Date().toISOString();
    const lc = (x) => String(x ?? '').trim().toLowerCase();
    const mans = await db.manifestations.toArray();
    const manByName = (n) => mans.find((m) => lc(m.name) === lc(n));
    let tests = await db.tests.toArray();
    const testByName = (n) => tests.find((t) => lc(t.name) === lc(n));

    // 1) Iso-Hold → Max Isometric Strength (solo si siguen en la manifestación antigua)
    const heavy = manByName('Heavy Dynamic Strength');
    const maxIso = manByName('Max Isometric Strength');
    if (heavy && maxIso) {
      for (const n of ISO_HOLD_TESTS) {
        const t = testByName(n);
        if (t && t.manifestationId === heavy.id) { await db.tests.update(t.id, { manifestationId: maxIso.id, updatedAt: ts }); res.isoHoldMovidos++; }
      }
    }
    // 2) Duplicado de Ankle Iso-Hold
    const dup = testByName('Run-Specific Ankle Iso-Hold 20 s');
    if (dup) {
      const keep = testByName('Ankle Iso-Hold 20 s');
      const u = await testUsage(db, dup.id);
      if (u.variables || u.protocols || u.datos) res.duplicadoConservado = true;
      else if (keep) { await db.tests.delete(dup.id); if (keep.archived) await db.tests.update(keep.id, { archived: false, updatedAt: ts }); res.duplicadoEliminado = true; }
      else { await db.tests.update(dup.id, { name: 'Ankle Iso-Hold 20 s', archived: false, updatedAt: ts }); res.duplicadoEliminado = true; }
      tests = await db.tests.toArray();
    }
    // 3) Variables y unidades
    let order = (await db.variables.orderBy('order').last())?.order ?? 0;
    const apply = async (testName, specs) => {
      const t = testByName(testName);
      if (!t) return;
      const existing = await db.variables.where('testId').equals(t.id).toArray();
      for (const sp of specs) {
        const found = existing.find((x) => lc(x.name) === lc(sp.name));
        if (found) {
          const patch = {};
          if ((found.unit ?? null) === null && sp.unit) { patch.unit = sp.unit; res.unidadesRellenadas++; }
          // Seguimiento de la petición del usuario («actualiza también las unidades» según los PDF de VALD): una variable de la semilla
          // cuya unidad escribió el usuario a mano y difiere de la definitiva se alinea, y cada cambio queda en el registro de auditoría.
          else if (found.source === 'inicial' && found.kind === 'raw' && sp.unit && found.unit !== sp.unit) {
            patch.unit = sp.unit; res.unidadesAlineadas++;
            await audit(db, 'catalogo-unidad-alineada', { variableId: found.id, test: testName, variable: found.name, antes: found.unit, despues: sp.unit });
          }
          if ((found.sides ?? null) === null && sp.sides) patch.sides = sp.sides;
          if (sp.notes !== undefined && found.notes === OLD_RFD_NOTE) patch.notes = sp.notes;
          if (Object.keys(patch).length) await db.variables.update(found.id, { ...patch, updatedAt: ts });
        } else {
          const man = sp.manifestation ? manByName(sp.manifestation) : null;
          await db.variables.add({ testId: t.id, name: sp.name, unit: sp.unit ?? null, sides: sp.sides ?? null, direction: null, manifestationId: man?.id ?? null, kind: 'raw', formula: null, formulaVersion: 0, notes: sp.notes ?? '', archived: false, order: ++order, createdAt: ts, updatedAt: ts, source: 'inicial' });
          res.variablesAnadidas++;
        }
      }
    };
    for (const [name, specs] of Object.entries(VARIABLES_BY_TEST)) await apply(name, specs);
    const maxIsoId = maxIso?.id ?? null;
    for (const [name, cfg] of Object.entries(ISO_PUSH)) {
      const t = testByName(name);
      if (t && (await db.variables.where('testId').equals(t.id).count()) === 0) {
        const mk = async (x) => {
          const formula = x.formula ?? null;
          const id = await db.variables.add({ testId: t.id, name: x.name, unit: x.unit ?? null, sides: x.sides ?? null, direction: null, manifestationId: x.manifestationId ?? null, kind: x.kind ?? 'raw', formula, formulaVersion: formula ? 1 : 0, notes: x.notes ?? '', archived: false, order: ++order, createdAt: ts, updatedAt: ts, source: 'inicial' });
          if (formula) await db.formulaHistory.add({ variableId: id, version: 1, formula, at: ts, reason: 'Catálogo inicial' });
          res.variablesAnadidas++;
          return id;
        };
        const peak = await mk({ name: 'Peak Force', unit: 'N', sides: 'LR', manifestationId: maxIsoId });
        await mk({ name: cfg.relName, unit: cfg.relUnit, sides: 'LR', kind: 'derived', manifestationId: maxIsoId, notes: cfg.relNotes ?? '', formula: { op: cfg.rel, operands: [peak], params: cfg.rel === 'REL_SW' ? { factor: cfg.factor ?? SW_FACTOR_DEFAULT } : {}, text: '' } });
        await mk({ name: 'Peak Force asimetría (%)', unit: '%', sides: 'single', kind: 'derived', manifestationId: maxIsoId, formula: { op: 'ASIMETRIA', operands: [peak], params: {}, text: '' } });
        for (const e of ISO_EXPLOSIVE) await mk({ name: e.name, unit: e.unit, sides: e.sides, manifestationId: manByName(e.manifestation)?.id ?? null, notes: e.notes });
      } else await apply(name, ISO_EXPLOSIVE);
    }
    // 9/11/2026: direcciones que el usuario confirma como «más bajo es mejor» (duraciones, profundidad, velocidad excéntrica pico) en lo ya sembrado.
    const aBajo = (await db.variables.toArray()).filter((v) => v.source === 'inicial' && v.kind === 'raw' && LOWER_IS_BETTER.test(v.name) && v.direction !== 'lower');
    for (const v of aBajo) await db.variables.update(v.id, { direction: 'lower', updatedAt: ts });
    if (aBajo.length) await audit(db, 'catalogo-direcciones-confirmadas', { cantidad: aBajo.length, a: 'lower', variables: [...new Set(aBajo.map((v) => v.name))] });
    res.direccionesBajo = aBajo.length;
    // 9/11/2026: corrección de un error mío (D50): los RSI heredaron «más bajo es mejor» por llevar «CONTACT TIME» en el nombre. Se pasan a «más alto» (lo pidió el usuario).
    const rsiMal = (await db.variables.toArray()).filter((v) => v.source === 'inicial' && v.direction === 'lower' && /\bRSI\b/i.test(v.name));
    for (const v of rsiMal) await db.variables.update(v.id, { direction: 'higher', updatedAt: ts });
    if (rsiMal.length) await audit(db, 'catalogo-direccion-rsi-corregida', { cantidad: rsiMal.length, de: 'lower', a: 'higher' });
    res.rsiCorregidos = rsiMal.length;
    await ensureDerived(db, ts, res);
    await ensureGroinAnkle(db, ts, res);
    await ensurePerimeters(db, ts, res);
    await ensureJurdan(db, ts, res);
    await ensureToeTouch(db, ts, res);
    await ensureNordicRelative(db, ts, res);
    res.direccionesAsignadas = await defaultDirections(db, ts);
    await db.meta.put({ key: 'catalogSeeded', value: { ...(cur?.value ?? {}), version: CATALOG_SEED_VERSION, actualizadoEn: ts } });
    await audit(db, 'catalogo-inicial-actualizado', { version: CATALOG_SEED_VERSION, ...res });
  });
  return res;
}
