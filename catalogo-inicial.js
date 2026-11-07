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

export const CATALOG_SEED_VERSION = 3;

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

const VARIABLES_BY_TEST = {
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
      for (const [test, vars] of Object.entries(VARIABLES_BY_TEST)) for (const x of vars) await addVar(testIds[test], x);
    }
    await db.meta.put({ key: 'catalogSeeded', value: { version: CATALOG_SEED_VERSION, at: ts, vacioAlSembrar: empty } });
    await audit(db, 'catalogo-inicial-cargado', { version: CATALOG_SEED_VERSION, ...counts });
  });
  return { sembrado: true, ...counts };
}

// Actualiza un catálogo ya cargado con una versión anterior de la semilla, sin pisar nada que el usuario haya editado:
// solo rellena unidades y tipos de valor que estén sin definir, añade las variables que falten, mueve los Iso-Hold a
// Max Isometric Strength si siguen en la manifestación antigua y elimina el duplicado «Run-Specific Ankle Iso-Hold 20 s»
// si no tiene variables, protocolos ni datos. Se ejecuta una sola vez (versión de la semilla en la tabla meta).
async function migrateCatalog(db, prev) {
  if ((prev.value?.version ?? 1) >= CATALOG_SEED_VERSION) return { migrado: false };
  const res = { migrado: true, variablesAnadidas: 0, unidadesRellenadas: 0, unidadesAlineadas: 0, isoHoldMovidos: 0, duplicadoEliminado: false, duplicadoConservado: false };
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
    await db.meta.put({ key: 'catalogSeeded', value: { ...(cur?.value ?? {}), version: CATALOG_SEED_VERSION, actualizadoEn: ts } });
    await audit(db, 'catalogo-inicial-actualizado', { version: CATALOG_SEED_VERSION, ...res });
  });
  return res;
}
