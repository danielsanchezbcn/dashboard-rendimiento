import 'fake-indexeddb/auto';
import { webcrypto } from 'node:crypto';
if (!globalThis.crypto?.subtle) globalThis.crypto = webcrypto;
import * as D from './db.js';
import * as B from './backup.js';
import * as C from './catalogo.js';
import * as I from './catalogo-inicial.js';

let failed = 0;
const check = (name, cond, extra = '') => { console.log(`${cond ? 'OK  ' : 'FAIL'} ${name} ${extra}`); if (!cond) failed++; };
const rejects = async (fn) => { try { await fn(); return null; } catch (e) { return e.message; } };
let n = 0;
const fresh = async (seed = true, extend) => {
  const db = D.createDb('c-' + ++n);
  extend?.(db);
  await D.initDb(db);
  if (seed) await I.seedInitialCatalog(db);
  return db;
};
const round = (x, d) => Math.round(x * 10 ** d) / 10 ** d;

// ---- Cálculo con los ejemplos de la guía («Relativización»)
check('gravedad 9,80665', C.GRAVITY === 9.80665);
check('peso corporal Knee: 77 kg = 755,1 N', round(C.bodyWeightN(77), 1) === 755.1);
check('Knee: relativos 3,66 y 3,94 BW', round(C.relativeBW(2762, 77), 2) === 3.66 && round(C.relativeBW(2974, 77), 2) === 3.94);
check('Knee: asimetría +7,1 %', round(C.asymmetryPct(2762, 2974), 1) === 7.1);
check('Hip: peso 764,9 N y SW 221,8 N', round(C.bodyWeightN(78), 1) === 764.9 && round(C.systemWeightN(78), 1) === 221.8);
check('Hip: relativos 1,89 y 1,79 SW', round(C.relativeSW(420, 78), 2) === 1.89 && round(C.relativeSW(396, 78), 2) === 1.79);
check('Hip: asimetría −5,7 % (domina la izquierda)', round(C.asymmetryPct(420, 396), 1) === -5.7);
check('simétrico = 0 y signo positivo si domina la derecha', C.asymmetryPct(100, 100) === 0 && C.asymmetryPct(80, 100) > 0 && C.asymmetryPct(100, 80) < 0);
check('datos que faltan o inválidos devuelven null, nunca 0', C.asymmetryPct(null, 5) === null && C.asymmetryPct(0, 0) === null && C.relativeBW(100, 0) === null && C.relativeBW(undefined, 80) === null && C.relativeSW(100, 80, 0) === null && C.asymmetryPct(NaN, 3) === null);

// ---- Esquema y catálogo inicial
{
  const db = await fresh(false);
  check('esquema 3 con 16 tablas', db.verno === 3 && db.tables.length === 16);
  check('antes de sembrar no hay catálogo', (await db.tests.count()) === 0 && (await db.manifestations.count()) === 0);
  const r = await I.seedInitialCatalog(db);
  check('siembra: 35 tests y 40 variables', r.sembrado && r.tests === 35 && r.variables === 40, JSON.stringify(r));
  const again = await I.seedInitialCatalog(db);
  check('siembra idempotente', again.sembrado === false && (await db.tests.count()) === 35 && (await db.variables.count()) === 40);
  const cat = await C.listCatalog(db);
  check('tres bloques; Perímetros y NME sin tests', cat.blocks.map((b) => b.key).join() === 'fuerza,perimetros,nme' && cat.tests.every((t) => t.blockKey === 'fuerza'));
  check('NME conserva la etiqueta sin expandir', cat.blocks.find((b) => b.key === 'nme').name === 'NME');
  check('cinco manifestaciones y cuatro zonas', cat.manifestations.map((m) => m.name).join('|') === 'Max Isometric Strength|Heavy Dynamic Strength|Fast Dynamic Strength|Reactive Strength|Explosive Strength' && cat.zones.map((z) => z.name).join() === 'Groin,Hip,Knee,Ankle');
  const byName = (name) => cat.tests.filter((t) => t.name === name);
  check('nombres de test únicos (Iso-Push una sola vez por zona)', ['Run-Specific Hip Iso-Push', 'Run-Specific Knee Iso-Push', 'Run-Specific Ankle Iso-Push'].every((x) => byName(x).length === 1) && byName('RFESS 45° 8RM').length === 1);
  const zoneOf = (t) => cat.zones.find((z) => z.id === t.zoneId)?.name ?? null;
  check('Groin solo tiene los 3 tests aportados, todos Max Isometric', cat.tests.filter((t) => zoneOf(t) === 'Groin').length === 3 && cat.tests.filter((t) => zoneOf(t) === 'Groin').every((t) => cat.manifestations.find((m) => m.id === t.manifestationId).name === 'Max Isometric Strength'));
  check('Fast Dynamic y Reactive sin zona', cat.tests.filter((t) => ['CMJ', 'SL CMJ', 'Squat Jump', 'Double-Leg Hop Test', 'DL Drop Jump 30 cm', 'DL Drop Jump 45 cm'].includes(t.name)).every((t) => t.zoneId === null));
  const varsOf = (testName) => cat.variables.filter((v) => v.testId === byName(testName)[0].id);
  check('CMJ: exactamente 19 variables, sin unidad ni dirección ni fórmula', varsOf('CMJ').length === 19 && varsOf('CMJ').every((v) => v.unit === null && v.direction === null && v.formula === null && v.sides === null));
  check('SL CMJ y Squat Jump sin variables (no se copia la lista de CMJ)', varsOf('SL CMJ').length === 0 && varsOf('Squat Jump').length === 0);
  check('Reactive: 3 variables por test con los nombres exactos', varsOf('Double-Leg Hop Test').map((v) => v.name).join('|') === 'MEAN RSI (FLIGHT TIME / CONTACT TIME)|MEAN JUMP HEIGHT (Flight Time) (cm)|MEAN CONTACT TIME' && varsOf('DL Drop Jump 30 cm').length === 3 && varsOf('DL Drop Jump 45 cm').length === 3);
  const hip = varsOf('Run-Specific Hip Iso-Push');
  const manName = (v) => cat.manifestations.find((m) => m.id === v.manifestationId)?.name;
  check('Hip Iso-Push: 4 variables; Peak Force (N) y RFD en manifestaciones distintas (D4)', hip.map((v) => v.name).join('|') === 'Peak Force|Peak Force relativo (SW)|Peak Force asimetría (%)|RFD at 100 ms' && hip[0].unit === 'N' && manName(hip[0]) === 'Max Isometric Strength' && manName(hip[3]) === 'Explosive Strength');
  check('Hip: relativo con SW 0,29; Knee y Ankle con BW', hip[1].formula.op === 'REL_SW' && hip[1].formula.params.factor === 0.29 && ['Knee', 'Ankle'].every((z) => varsOf(`Run-Specific ${z} Iso-Push`)[1].formula.op === 'REL_BW'));
  check('asimetría con la operación del usuario y unidad %', hip[2].formula.op === 'ASIMETRIA' && hip[2].unit === '%' && hip[2].formula.operands[0] === hip[0].id);
  check('RFD at 100 ms sin unidad ni fórmula (pendiente)', hip[3].unit === null && hip[3].formula === null);
  check('ninguna variable tiene dirección de interpretación inventada', cat.variables.every((v) => v.direction === null));
  check('Iso-Hold, Nordic, RM y demás: solo el test, sin variables', ['Hip Iso-Hold 20 s', 'Nordic Hamstring Exercise', 'Single-Leg Standing Calf Raise 12RM', 'Ankle Iso-Hold 20 s'].every((t) => varsOf(t).length === 0));
  check('historial de fórmulas: una versión por variable calculada', (await db.formulaHistory.count()) === 6 && cat.variables.filter((v) => v.formula).every((v) => v.formulaVersion === 1));
  check('registro de acciones: una sola entrada de carga inicial', (await db.auditLog.where('action').equals('catalogo-inicial-cargado').count()) === 1);
}

// ---- Edición del catálogo
{
  const db = await fresh();
  const cat = await C.listCatalog(db);
  const man = cat.manifestations[0].id;
  const zone = cat.zones.find((z) => z.name === 'Hip').id;
  check('test: nombre obligatorio', (await rejects(() => C.createTest(db, { name: '  ', manifestationId: man }))) === 'El nombre del test es obligatorio.');
  check('test: duplicado en misma manifestación y zona rechazado', (await rejects(() => C.createTest(db, { name: 'hip iso-hold 20 s', manifestationId: cat.manifestations[1].id, zoneId: zone })))?.startsWith('Ya existe un test'));
  const t = await C.createTest(db, { name: 'Test propio', manifestationId: man, zoneId: zone });
  check('test nuevo en catálogo', !!(await db.tests.get(t)) && (await db.tests.get(t)).archived === false);
  await C.updateTest(db, t, { name: 'Test propio 2', notes: 'nota' });
  const aud = await db.auditLog.where('action').equals('catalogo-test-modificado').last();
  check('cambio de test en el registro con valor anterior y nuevo', aud.scope.campos.name.antes === 'Test propio' && aud.scope.campos.name.despues === 'Test propio 2');
  const p = await C.createProtocol(db, { testId: t, name: 'Protocolo A', description: 'sentado' });
  check('protocolo: duplicado rechazado', (await rejects(() => C.createProtocol(db, { testId: t, name: 'protocolo a' }))) === 'Ya existe un protocolo con ese nombre en este test.');
  const v1 = await C.createVariable(db, { testId: t, name: 'Fuerza', unit: 'N', sides: 'LR' });
  check('variable: sin dirección ni fórmula por defecto', (await db.variables.get(v1)).direction === null && (await db.variables.get(v1)).formula === null && (await db.variables.get(v1)).formulaVersion === 0);
  check('variable: tipo de valor y dirección validados', (await rejects(() => C.createVariable(db, { testId: t, name: 'X', sides: 'abc' }))) === 'El tipo de valor no válido.' && (await rejects(() => C.createVariable(db, { testId: t, name: 'Y', direction: 'mejor' }))) === 'La dirección no válido.');
  check('variable: nombre duplicado en el test rechazado', (await rejects(() => C.createVariable(db, { testId: t, name: 'fuerza' }))) === 'Ya existe una variable con ese nombre en este test.');
  check('dato de origen no admite operación', (await rejects(() => C.createVariable(db, { testId: t, name: 'Z', formula: { op: 'ASIMETRIA', operands: [v1] } }))) === 'Un dato de origen no puede tener una operación; márcalo como calculada.');
  check('fórmula: operación desconocida y nº de operandos', (await rejects(() => C.createVariable(db, { testId: t, name: 'Z', kind: 'derived', formula: { op: 'RAIZ', operands: [v1] } }))) === 'Operación desconocida: «RAIZ».' && (await rejects(() => C.createVariable(db, { testId: t, name: 'Z', kind: 'derived', formula: { op: 'ASIMETRIA', operands: [] } })))?.includes('necesita 1 variable'));
  const otro = await C.createTest(db, { name: 'Otro test', manifestationId: man });
  const vo = await C.createVariable(db, { testId: otro, name: 'Fuerza' });
  check('fórmula: el origen debe ser del mismo test', (await rejects(() => C.createVariable(db, { testId: t, name: 'Z', kind: 'derived', formula: { op: 'ASIMETRIA', operands: [vo] } }))) === 'La variable de origen debe existir y pertenecer al mismo test.');
  const vd = await C.createVariable(db, { testId: t, name: 'Asim', unit: '%', kind: 'derived', formula: { op: 'ASIMETRIA', operands: [v1] } });
  check('fórmula: versión 1 e historial', (await db.variables.get(vd)).formulaVersion === 1 && (await db.formulaHistory.where('variableId').equals(vd).count()) === 1);
  check('fórmula: el origen no puede ser una variable calculada', (await rejects(() => C.createVariable(db, { testId: t, name: 'Z2', kind: 'derived', formula: { op: 'ASIMETRIA', operands: [vd] } }))) === 'La variable de origen debe ser un dato de origen, no otra calculada.');
  check('SW: el factor debe ser positivo', (await rejects(() => C.createVariable(db, { testId: t, name: 'SW', kind: 'derived', formula: { op: 'REL_SW', operands: [v1], params: { factor: -1 } } })))?.includes('número positivo'));
  const vsw = await C.createVariable(db, { testId: t, name: 'Rel SW', kind: 'derived', formula: { op: 'REL_SW', operands: [v1] } });
  check('SW: factor por defecto 0,29', (await db.variables.get(vsw)).formula.params.factor === 0.29);
  check('cambiar una fórmula exige motivo', (await rejects(() => C.updateVariable(db, vsw, { formula: { op: 'REL_SW', operands: [v1], params: { factor: 0.3 } } }))) === 'Para cambiar una fórmula hay que indicar el motivo: queda en el historial de versiones.');
  await C.updateVariable(db, vsw, { formula: { op: 'REL_SW', operands: [v1], params: { factor: 0.3 } } }, 'Prueba de factor');
  const hist = await db.formulaHistory.where('variableId').equals(vsw).toArray();
  check('cambio de fórmula: versión 2 y las dos versiones conservadas', (await db.variables.get(vsw)).formulaVersion === 2 && hist.length === 2 && hist[0].formula.params.factor === 0.29 && hist[1].formula.params.factor === 0.3 && hist[1].reason === 'Prueba de factor');
  await C.updateVariable(db, vsw, { unit: 'SW' });
  check('cambiar solo la unidad no crea versión de fórmula', (await db.variables.get(vsw)).formulaVersion === 2 && (await db.formulaHistory.where('variableId').equals(vsw).count()) === 2);
  check('no se borra una variable de la que dependen otras', (await rejects(() => C.deleteVariable(db, v1)))?.startsWith('Otras variables dependen de esta'));
  check('no se borra un test con variables', (await rejects(() => C.deleteTest(db, t))) === 'El test tiene variables o protocolos: elimínalos primero o archiva el test.');
  await C.setTestArchived(db, t, true);
  check('archivar un test no borra nada', (await db.tests.get(t)).archived === true && (await db.variables.where('testId').equals(t).count()) === 3);
  await C.setTestArchived(db, t, false);
  await C.deleteVariable(db, vd); await C.deleteVariable(db, vsw);
  check('se borra la variable calculada sin dependientes y su historial', !(await db.variables.get(vd)) && (await db.formulaHistory.where('variableId').equals(vd).count()) === 0);
  check('manifestación y zona nuevas: duplicados rechazados', (await rejects(() => C.createManifestation(db, { name: 'max isometric strength' })))?.startsWith('Ya existe una manifestación') && (await rejects(() => C.createZone(db, { name: 'HIP' }))) === 'Ya existe una zona con ese nombre.');
  const z = await C.createZone(db, { name: 'Zona nueva' });
  await C.renameZone(db, z, 'Zona renombrada');
  check('renombrar no cambia el identificador ni rompe los tests', (await db.zones.get(z)).name === 'Zona renombrada');
  const x = await C.createTest(db, { name: 'Sin nada', manifestationId: man });
  await C.deleteTest(db, x);
  check('un test sin variables ni protocolos ni datos se puede borrar', !(await db.tests.get(x)));
}

// ---- Un test con datos no se borra (las tablas de datos llegan en fases posteriores)
{
  const db = await fresh(true, (d) => d.version(4).stores({ sessions: '++id, testId', sessionValues: '++id, testId' }));
  const cat = await C.listCatalog(db);
  const t = cat.tests.find((x) => x.name === 'CMJ');
  const v = cat.variables.find((x) => x.testId === t.id);
  await db.sessions.add({ testId: t.id });
  check('con datos: no se borra el test', (await rejects(() => C.deleteTest(db, t.id))) === 'El test tiene datos: archívalo en vez de eliminarlo.');
  check('con datos: no se borra la variable', (await rejects(() => C.deleteVariable(db, v.id)))?.startsWith('El test de esta variable tiene datos'));
  await C.setVariableArchived(db, v.id, true);
  check('con datos: archivar sí funciona', (await db.variables.get(v.id)).archived === true);
}

// ---- Copias de seguridad y restauración
{
  const db = await fresh();
  const m = (await db.manifestations.toArray())[0].id;
  const t = await C.createTest(db, { name: 'Test del usuario', manifestationId: m });
  const backup = await B.buildBackup(db, D.APP_VERSION);
  check('la copia incluye las tablas del catálogo', ['blocks', 'manifestations', 'zones', 'tests', 'protocols', 'variables', 'formulaHistory'].every((k) => k in backup.tables) && backup.schemaVersion === 3);
  await db.tests.delete(t);
  await db.tests.add({ name: 'Basura', blockKey: 'fuerza', manifestationId: m, zoneId: null, archived: false, order: 999 });
  const val = await B.validateBackup(db, backup);
  check('copia del esquema 3 válida', val.ok === true, JSON.stringify(val.errors));
  const r = await B.restoreBackup(db, backup);
  const names = (await db.tests.toArray()).map((x) => x.name);
  check('restaurar conserva el catálogo del usuario sin duplicar el inicial', r.verificado && names.includes('Test del usuario') && !names.includes('Basura') && names.filter((x) => x === 'CMJ').length === 1 && !r.catalogoInicialAnadido && names.length === 36);

  // Copia del esquema 2 (sin tablas de catálogo): al restaurar se añade el catálogo inicial.
  const old = JSON.parse(JSON.stringify(backup));
  for (const k of ['blocks', 'manifestations', 'zones', 'tests', 'protocols', 'variables', 'formulaHistory']) delete old.tables[k];
  old.tables.meta = old.tables.meta.filter((x) => x.key !== 'catalogSeeded');
  old.schemaVersion = 2;
  old.counts = B.countTables(old.tables);
  old.checksum = await B.checksumTables(old.tables);
  const v2 = await B.validateBackup(db, old);
  check('copia del esquema 2: válida con aviso de tablas nuevas vacías', v2.ok === true && v2.warnings.length === 7, JSON.stringify(v2.errors));
  const r2 = await B.restoreBackup(db, old);
  check('copia del esquema 2: tras restaurar se añade el catálogo inicial una sola vez', r2.verificado && r2.catalogoInicialAnadido === true && (await db.tests.count()) === 35 && (await db.variables.count()) === 40);
  const r3 = await I.seedInitialCatalog(db);
  check('y no se vuelve a sembrar', r3.sembrado === false && (await db.tests.count()) === 35);
}

console.log(failed ? `\n${failed} prueba(s) fallan` : '\nTodas las pruebas del catálogo pasan');
process.exit(failed ? 1 : 0);
