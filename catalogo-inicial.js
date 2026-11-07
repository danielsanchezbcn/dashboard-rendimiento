// catalogo-inicial.js — catálogo inicial: SOLO lo que aportó el usuario (guía, «Catálogo inicial aportado por el usuario»,
// «CMJ — variables aportadas», «Reactive Strength — variables definitivas» y «Relativización»).
// No se inventan tests, variables, unidades, direcciones de interpretación ni fórmulas. Todo lo demás queda sin definir
// y se completa desde la pantalla del catálogo.
//
// Decisión de modelado (D4 y regla de la guía «no duplicar el test»): Run-Specific Iso-Push aparece en la lista de
// dos manifestaciones (Peak Force en Max Isometric Strength y 100 ms RFD en Explosive Strength). Es UN test con dos
// variables, cada una bajo su manifestación.

import { audit } from './db.js';
import { SW_FACTOR_DEFAULT } from './catalogo.js';

export const CATALOG_SEED_VERSION = 1;

const BLOCKS = [
  { key: 'fuerza', name: 'Manifestaciones de la fuerza' },
  { key: 'perimetros', name: 'Perímetros' },
  { key: 'nme', name: 'NME' },
];

const MANIFESTATIONS = ['Max Isometric Strength', 'Heavy Dynamic Strength', 'Fast Dynamic Strength', 'Reactive Strength', 'Explosive Strength'];
const ZONES = ['Groin', 'Hip', 'Knee', 'Ankle'];

// Tests por zona y manifestación (lista del usuario). Los dos Run-Specific Iso-Push de cada zona se declaran una sola vez.
const TESTS = [
  ['Hip', 'Max Isometric Strength', ['Run-Specific Hip Iso-Push', 'Supine Isometric 90°/90° Leg Curl Test', 'Standing Isometric 90°/20° Hamstring Test']],
  ['Hip', 'Heavy Dynamic Strength', ['Hip Iso-Hold 20 s', 'Nordic Hamstring Exercise', 'Hamstring Bridge 30 cm 8RM', 'Single-Leg Knee Flexion 8RM', 'RDL Force–Velocity Profile', 'Hip Thrust Force–Velocity Profile']],
  ['Knee', 'Max Isometric Strength', ['Run-Specific Knee Iso-Push', 'Seated Isometric 90°/90° Knee Extension Test']],
  ['Knee', 'Heavy Dynamic Strength', ['Knee Iso-Hold 20 s', 'Double-Leg Leg Press 45° 8RM', 'Single-Leg Leg Press 45° 8RM', 'RFESS 45° 8RM', 'Back Squat Force–Velocity Profile', 'Trap Bar Squat Force–Velocity Profile']],
  ['Ankle', 'Max Isometric Strength', ['Run-Specific Ankle Iso-Push', 'Single-Leg Seated Calf Raise', 'Supine Isometric Ankle Inversion', 'Supine Isometric Ankle Eversion']],
  ['Ankle', 'Heavy Dynamic Strength', ['Ankle Iso-Hold 20 s', 'Single-Leg Seated Calf Raise Iso-Hold 20 s', 'Run-Specific Ankle Iso-Hold 20 s', 'Single-Leg Standing Calf Raise 12RM', 'Single-Leg Seated Calf Raise 6RM']],
  ['Groin', 'Max Isometric Strength', ['Hip Adduction 0° (Long Lever)', 'Hip Abduction 0° (Long Lever)', 'Hip Adduction 45° (Short Lever)']],
  [null, 'Fast Dynamic Strength', ['CMJ', 'SL CMJ', 'Squat Jump']],
  [null, 'Reactive Strength', ['Double-Leg Hop Test', 'DL Drop Jump 30 cm', 'DL Drop Jump 45 cm']],
];

// Variables de CMJ: solo los nombres de origen; sin unidades, direcciones ni fórmulas.
const CMJ_VARIABLES = [
  'ECC DECEL PHASE DURATION', 'CONCENTRIC DURATION', 'CONTRACTION TIME', 'DEPTH', 'RSI MOD', 'COM STIFFNESS', 'ECC DECEL RFD',
  'CON IMPULSE 100ms', 'CON PEAK POWER/BM', 'CON IMPULSE', 'JH (imp-mom)', 'FORCE AT 0 VELOCITY', 'ECC DECELERATION IMPULSE',
  'ECC PEAK POWER/BM', 'ECC DECEL RFD ASYM', 'CON IMPULSE 100ms ASYM', 'CON IMPULSE ASYM', 'ECC DECEL IMPULSE ASYM', 'PEAK LANDING FORCE ASYM',
];

const REACTIVE_VARIABLES = {
  'Double-Leg Hop Test': ['MEAN RSI (FLIGHT TIME / CONTACT TIME)', 'MEAN JUMP HEIGHT (Flight Time) (cm)', 'MEAN CONTACT TIME'],
  'DL Drop Jump 30 cm': ['RSI (FLIGHT TIME / CONTACT TIME)', 'JUMP HEIGHT (Flight Time - cm)', 'CONTACT TIME'],
  'DL Drop Jump 45 cm': ['RSI (FLIGHT TIME / CONTACT TIME)', 'JUMP HEIGHT (Flight Time - cm)', 'CONTACT TIME'],
};

// Run-Specific Iso-Push: Peak Force (N), relativo (SW en Hip, BW en Knee y Ankle) y asimetría; RFD at 100 ms sin unidad ni fórmula.
const ISO_PUSH = {
  'Run-Specific Hip Iso-Push': { rel: 'REL_SW', relName: 'Peak Force relativo (SW)', relUnit: 'SW' },
  'Run-Specific Knee Iso-Push': { rel: 'REL_BW', relName: 'Peak Force relativo (BW)', relUnit: 'BW' },
  'Run-Specific Ankle Iso-Push': { rel: 'REL_BW', relName: 'Peak Force relativo (BW)', relUnit: 'BW' },
};

export const CATALOG_TABLES = ['blocks', 'manifestations', 'zones', 'tests', 'protocols', 'variables', 'formulaHistory'];

export async function seedInitialCatalog(db) {
  if (await db.meta.get('catalogSeeded')) return { sembrado: false };
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
        const params = cfg.rel === 'REL_SW' ? { factor: SW_FACTOR_DEFAULT } : {};
        await addVar(t, { name: cfg.relName, unit: cfg.relUnit, sides: 'LR', kind: 'derived', manifestationId: manId['Max Isometric Strength'], formula: { op: cfg.rel, operands: [peak], params, text: '' } });
        await addVar(t, { name: 'Peak Force asimetría (%)', unit: '%', sides: 'single', kind: 'derived', manifestationId: manId['Max Isometric Strength'], formula: { op: 'ASIMETRIA', operands: [peak], params: {}, text: '' } });
        await addVar(t, { name: 'RFD at 100 ms', unit: null, sides: 'LR', manifestationId: manId['Explosive Strength'], notes: 'Unidad y fórmula relativa pendientes de definir por el usuario.' });
      }
      for (const name of CMJ_VARIABLES) await addVar(testIds.CMJ, { name });
      for (const [test, vars] of Object.entries(REACTIVE_VARIABLES)) for (const name of vars) await addVar(testIds[test], { name });
    }
    await db.meta.put({ key: 'catalogSeeded', value: { version: CATALOG_SEED_VERSION, at: ts, vacioAlSembrar: empty } });
    await audit(db, 'catalogo-inicial-cargado', { version: CATALOG_SEED_VERSION, ...counts });
  });
  return { sembrado: true, ...counts };
}
