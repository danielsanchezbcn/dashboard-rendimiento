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
  check('esquema 6 con 21 tablas', db.verno === 6 && db.tables.length === 21);
  check('antes de sembrar no hay catálogo', (await db.tests.count()) === 0 && (await db.manifestations.count()) === 0);
  const r = await I.seedInitialCatalog(db);
  check('siembra: 37 tests y 150 variables (100 + 14 de carga/Nordic + 13 calculadas de Iso-Hold y 1RM + 5 perímetros + 10 de cadera y tobillo + 2 de la extensión de rodilla 90/90 + 4 del Jurdan Test + 1 del Toe-Touch + 1 Nordic relativo)', r.sembrado && r.tests === 37 && r.variables === 150, JSON.stringify(r));
  const again = await I.seedInitialCatalog(db);
  check('siembra idempotente', again.sembrado === false && (await db.tests.count()) === 37 && (await db.variables.count()) === 150);
  const cat = await C.listCatalog(db);
  check('tres bloques; Perímetros con su único test de 5 variables por lado en cm (sin dirección); NME: Jurdan Test (4 variables) y Toe-Touch Test (1, en cm), sin dirección', cat.blocks.map((b) => b.key).join() === 'fuerza,perimetros,nme' && cat.tests.filter((t) => t.blockKey !== 'fuerza').map((t) => t.blockKey + ':' + t.name).join() === 'perimetros:Perímetros,nme:Jurdan Test,nme:Toe-Touch Test'
    && cat.variables.filter((v) => v.testId === cat.tests.find((t) => t.blockKey === 'perimetros').id).length === 5 && cat.variables.filter((v) => v.testId === cat.tests.find((t) => t.blockKey === 'perimetros').id).every((v) => v.unit === 'cm' && v.sides === 'LR' && v.direction === null)
    && cat.variables.filter((v) => v.testId === cat.tests.find((t) => t.name === 'Jurdan Test').id).length === 4 && cat.variables.filter((v) => v.testId === cat.tests.find((t) => t.name === 'Toe-Touch Test').id).map((v) => v.unit + v.sides).join() === 'cmsingle' && cat.variables.filter((v) => cat.tests.find((t) => t.id === v.testId).blockKey === 'nme').every((v) => v.direction === null));
  check('NME conserva la etiqueta sin expandir', cat.blocks.find((b) => b.key === 'nme').name === 'NME');
  check('cinco manifestaciones y cuatro zonas', cat.manifestations.map((m) => m.name).join('|') === 'Max Isometric Strength|Heavy Dynamic Strength|Fast Dynamic Strength|Reactive Strength|Explosive Strength|Jurdan Test|Toe-Touch Test' && cat.zones.map((z) => z.name).join() === 'Groin,Hip,Knee,Ankle');
  const byName = (name) => cat.tests.filter((t) => t.name === name);
  check('nombres de test únicos (Iso-Push una sola vez por zona)', ['Run-Specific Hip Iso-Push', 'Run-Specific Knee Iso-Push', 'Run-Specific Ankle Iso-Push'].every((x) => byName(x).length === 1) && byName('RFESS 45° 8RM').length === 1);
  const zoneOf = (t) => cat.zones.find((z) => z.id === t.zoneId)?.name ?? null;
  check('Groin solo tiene los 3 tests aportados, todos Max Isometric', cat.tests.filter((t) => zoneOf(t) === 'Groin').length === 3 && cat.tests.filter((t) => zoneOf(t) === 'Groin').every((t) => cat.manifestations.find((m) => m.id === t.manifestationId).name === 'Max Isometric Strength'));
  check('Fast Dynamic y Reactive sin zona', cat.tests.filter((t) => ['CMJ', 'SL CMJ', 'Squat Jump', 'Double-Leg Hop Test', 'DL Drop Jump 30 cm', 'DL Drop Jump 45 cm'].includes(t.name)).every((t) => t.zoneId === null));
  const varsOf = (testName) => cat.variables.filter((v) => v.testId === byName(testName)[0].id);
  check('CMJ: 20 variables con unidad del PDF, dirección según las reglas confirmadas (D50 y 9/11) salvo asimetrías (%), sin fórmula', varsOf('CMJ').length === 20 && varsOf('CMJ').every((v) => v.unit !== null && v.direction === (v.unit === '%' ? null : I.LOWER_IS_BETTER.test(v.name) ? 'lower' : 'higher') && v.formula === null && v.sides === 'single') && varsOf('CMJ').filter((v) => v.name.endsWith('ASYM')).every((v) => v.unit === '%') && varsOf('CMJ').find((v) => v.name === 'ECC PEAK VELOCITY').unit === 'm/s' && varsOf('CMJ').find((v) => v.name === 'ECC DECEL RFD').unit === 'N/s/kg');
  check('SL CMJ: 16 variables por lado, sin asimetrías; Squat Jump: 4', varsOf('SL CMJ').length === 16 && varsOf('SL CMJ').every((v) => v.sides === 'LR' && v.unit && !v.name.includes('ASYM')) && varsOf('Squat Jump').map((v) => `${v.name}:${v.unit}`).join('|') === 'JH (imp-mom):cm|RSI MOD:m/s|CON IMPULSE 100ms:N s|CON RFD 100ms:N/s');
  check('Hop 11 y Drop Jump 12 variables; contacto en ms (Hop) y en s (Drop Jump); RSI sin unidad', varsOf('Double-Leg Hop Test').length === 11 && varsOf('DL Drop Jump 30 cm').length === 12 && varsOf('DL Drop Jump 45 cm').length === 12 && varsOf('Double-Leg Hop Test').find((v) => v.name === 'MEAN CONTACT TIME').unit === 'ms' && varsOf('DL Drop Jump 30 cm').find((v) => v.name === 'CONTACT TIME').unit === 's' && varsOf('Double-Leg Hop Test')[0].unit === null && varsOf('DL Drop Jump 45 cm')[0].unit === null);
  const hip = varsOf('Run-Specific Hip Iso-Push');
  const manName = (v) => cat.manifestations.find((m) => m.id === v.manifestationId)?.name;
  check('Hip Iso-Push: 5 variables; Peak Force (N) y las explosivas en manifestaciones distintas (D4)', hip.map((v) => v.name).join('|') === 'Peak Force|Peak Force relativo (SW)|Peak Force asimetría (%)|RFD at 100 ms|Force at 100 ms' && hip[0].unit === 'N' && manName(hip[0]) === 'Max Isometric Strength' && manName(hip[3]) === 'Explosive Strength' && manName(hip[4]) === 'Explosive Strength');
  const seat = varsOf('Single-Leg Seated Calf Raise');
  const leg = varsOf('Supine Isometric 90°/90° Leg Curl Test');
  check('Seated Calf Raise y Leg Curl 90/90 con las 5 variables del Iso-Push', [seat, leg].every((vs) => vs.map((v) => v.name).join('|') === 'Peak Force|Peak Force relativo (SW)|Peak Force asimetría (%)|RFD at 100 ms|Force at 100 ms' && vs[3].unit === 'N/s' && vs[4].unit === 'N' && vs[0].unit === 'N'));
  check('SW: Leg Curl 90/90 al 29 %; Seated Calf Raise al 5 %; Knee y Ankle BW', leg[1].formula.op === 'REL_SW' && leg[1].formula.params.factor === 0.29 && seat[1].formula.op === 'REL_SW' && seat[1].formula.params.factor === 0.05 && seat[1].unit === 'SW' && /5 %/.test(seat[1].notes));
  check('Seated Isometric 90/90 Knee Extension: Peak Force por lado y su relativa al peso (12/11/2026); el 90/20 sigue sin variables', varsOf('Seated Isometric 90°/90° Knee Extension Test').map((v) => `${v.name}|${v.sides}|${v.unit}`).join(' · ') === 'Peak Force|LR|N · Peak Force relativo (BW)|LR|BW' && varsOf('Standing Isometric 90°/20° Hamstring Test').length === 0);
  check('Hip: relativo con SW 0,29; Knee y Ankle con BW', hip[1].formula.op === 'REL_SW' && hip[1].formula.params.factor === 0.29 && ['Knee', 'Ankle'].every((z) => varsOf(`Run-Specific ${z} Iso-Push`)[1].formula.op === 'REL_BW'));
  check('asimetría con la operación del usuario y unidad %', hip[2].formula.op === 'ASIMETRIA' && hip[2].unit === '%' && hip[2].formula.operands[0] === hip[0].id);
  check('RFD at 100 ms (N/s) y Force at 100 ms (N) sin fórmula; Hop/Drop Jump/Iso-Hold según el PDF', hip[3].unit === 'N/s' && hip[3].formula === null && hip[4].unit === 'N' && hip[4].formula === null && ['Knee', 'Ankle'].every((z) => varsOf(`Run-Specific ${z} Iso-Push`).length === 5) && varsOf('Hip Iso-Hold 20 s').length === 4);
  check('la dirección por defecto es «más alto es mejor», «más bajo» en el tiempo de contacto, y las asimetrías (%) quedan sin dirección (D50)', cat.variables.filter((v) => v.source === 'inicial' && v.unit !== 'cm' && v.unit !== '°' && v.name !== 'TOE-TOUCH TEST' && v.formula?.op !== 'ISO_PIMA' && !/^ISO_|RM_EST/.test(v.formula?.op ?? '')).every((v) => v.direction === (v.unit === '%' ? null : I.LOWER_IS_BETTER.test(v.name) ? 'lower' : 'higher')) && cat.variables.some((v) => v.unit === '%') && cat.variables.some((v) => /^(mean )?contact time$/i.test(v.name) && v.direction === 'lower'));
  check('Nordic: Max Force (N, I/D), Max Force Asymmetry (%, valor único), Torque (Nm, I/D) y Max Force relativo (BW, I/D)', JSON.stringify(varsOf('Nordic Hamstring Exercise').map((v) => [v.name, v.unit, v.sides])) === JSON.stringify([['Max Force', 'N', 'LR'], ['Max Force Asymmetry', '%', 'single'], ['Torque', 'Nm', 'LR'], ['Max Force relativo (BW)', 'BW', 'LR']]));
check('RM: «Carga máxima (kg)»; Iso-Hold: «Carga externa (kg)» + MVIC, %PIMA y %BW/%SW (SW en Hip y talones sentado); 12RM: 1RM estimado', ['Hamstring Bridge 30 cm 8RM', 'Single-Leg Seated Calf Raise 6RM'].every((n) => varsOf(n).length === 1 && varsOf(n)[0].name === 'Carga máxima (kg)') && JSON.stringify(varsOf('Hip Iso-Hold 20 s').map((v) => v.name)) === JSON.stringify(['Carga externa (kg)', 'MVIC iso-push (kg)', '%PIMA', '%SW']) && varsOf('Knee Iso-Hold 20 s').at(-1).name === '%BW' && varsOf('Ankle Iso-Hold 20 s').at(-1).name === '%BW' && varsOf('Single-Leg Seated Calf Raise Iso-Hold 20 s').at(-1).formula.params.factor === 0.05 && varsOf('Single-Leg Standing Calf Raise 12RM').at(-1).name === '1RM estimado (kg)' && varsOf('Single-Leg Standing Calf Raise 12RM').at(-1).formula.params.factor === 1.4);
  { const nv = varsOf('Nordic Hamstring Exercise'); const rel = nv.find((v) => v.name === 'Max Force relativo (BW)'); check('Nordic relativo: REL_BW sobre Max Force, más alto es mejor', rel.kind === 'derived' && rel.formula.op === 'REL_BW' && rel.formula.operands[0] === nv.find((v) => v.name === 'Max Force').id && rel.direction === 'higher'); }
  check('historial de fórmulas: una versión por variable calculada', (await db.formulaHistory.count()) === 30 && cat.variables.filter((v) => v.formula).every((v) => v.formulaVersion === 1));
  check('registro de acciones: una sola entrada de carga inicial', (await db.auditLog.where('action').equals('catalogo-inicial-cargado').count()) === 1);
}


// ---- Migración de un catálogo ya cargado con la semilla anterior (versión 1)
{
  const db = await fresh(false);
  await I.seedInitialCatalog(db);
  const mans = await db.manifestations.toArray();
  const heavy = mans.find((m) => m.name === 'Heavy Dynamic Strength').id;
  const named = async (n) => (await db.tests.toArray()).find((t) => t.name === n);
  // Se degrada la base al estado de la semilla 1: sin unidades, sin variables nuevas, Iso-Hold en Heavy y duplicado archivado
  for (const n of ['Hip Iso-Hold 20 s', 'Knee Iso-Hold 20 s', 'Ankle Iso-Hold 20 s', 'Single-Leg Seated Calf Raise Iso-Hold 20 s']) await db.tests.update((await named(n)).id, { manifestationId: heavy });
  const cmj = await named('CMJ');
  for (const x of await db.variables.where('testId').equals(cmj.id).toArray()) {
    if (x.name === 'ECC PEAK VELOCITY') await db.variables.delete(x.id);
    else await db.variables.update(x.id, { unit: null, sides: null });
  }
  const hipPush = await named('Run-Specific Hip Iso-Push');
  const rfd = (await db.variables.where('testId').equals(hipPush.id).toArray()).find((x) => x.name === 'RFD at 100 ms');
  await db.variables.update(rfd.id, { unit: null, notes: 'Unidad y fórmula relativa pendientes de definir por el usuario.' });
  const forceVar = (await db.variables.where('testId').equals(hipPush.id).toArray()).find((x) => x.name === 'Force at 100 ms');
  await db.variables.delete(forceVar.id);
  for (const n of ['Single-Leg Seated Calf Raise', 'Supine Isometric 90°/90° Leg Curl Test']) {
    const tt = await named(n);
    for (const x of await db.variables.where('testId').equals(tt.id).toArray()) { await db.variables.delete(x.id); await db.formulaHistory.where('variableId').equals(x.id).delete(); }
  }
  const man = mans.find((m) => m.name === 'Max Isometric Strength').id;
  const ankle = await named('Ankle Iso-Hold 20 s');
  await db.tests.update(ankle.id, { archived: true });
  await db.tests.add({ name: 'Run-Specific Ankle Iso-Hold 20 s', blockKey: 'fuerza', manifestationId: heavy, zoneId: ankle.zoneId, notes: '', archived: false, order: 99, source: 'inicial' });
  // Una unidad de la semilla escrita a mano que difiere de la definitiva se alinea (petición del usuario de actualizar unidades) y queda auditada
  const dj = await named('DL Drop Jump 30 cm');
  const contact = (await db.variables.where('testId').equals(dj.id).toArray()).find((x) => x.name === 'CONTACT TIME');
  await db.variables.update(contact.id, { unit: 'ms' });
  const meta = await db.meta.get('catalogSeeded');
  await db.meta.put({ key: 'catalogSeeded', value: { ...meta.value, version: 1 } });
  const r = await I.seedInitialCatalog(db);
  check('migración: se ejecuta, no vuelve a sembrar y cuenta lo añadido', r.sembrado === false && r.migrado === true && r.variablesAnadidas === 12 && r.unidadesRellenadas === 20 && r.isoHoldMovidos === 4 && r.duplicadoEliminado === true, JSON.stringify(r));
  const after = await C.listCatalog(db);
  check('migración: 37 tests y 150 variables otra vez', after.tests.length === 37 && after.variables.length === 150, `${after.tests.length}/${after.variables.length}`);
  check('migración: Iso-Hold en Max Isometric, Ankle Iso-Hold visible y sin duplicado', ['Hip Iso-Hold 20 s', 'Knee Iso-Hold 20 s', 'Ankle Iso-Hold 20 s', 'Single-Leg Seated Calf Raise Iso-Hold 20 s'].every((n) => after.tests.find((t) => t.name === n)?.manifestationId === man) && after.tests.find((t) => t.name === 'Ankle Iso-Hold 20 s').archived === false && !after.tests.some((t) => t.name.startsWith('Run-Specific Ankle Iso-Hold')));
  const cmjVars = after.variables.filter((x) => x.testId === cmj.id);
  check('migración: unidades rellenadas, variable nueva y tipo de valor', cmjVars.length === 20 && cmjVars.every((x) => x.unit && x.sides === 'single'));
  const hipVars = after.variables.filter((x) => x.testId === hipPush.id);
  check('migración: RFD at 100 ms pasa a N/s con su nota nueva y se añade Force at 100 ms', hipVars.find((x) => x.name === 'RFD at 100 ms').unit === 'N/s' && !hipVars.find((x) => x.name === 'RFD at 100 ms').notes.includes('Unidad') && hipVars.find((x) => x.name === 'Force at 100 ms').unit === 'N');
  const alin = (await db.auditLog.toArray()).filter((a) => a.action === 'catalogo-unidad-alineada');
check('migración: alinea la unidad escrita a mano con la definitiva y lo deja en el registro', after.variables.find((x) => x.id === contact.id).unit === 's' && r.unidadesAlineadas === 1 && alin.length === 1 && alin[0].scope.antes === 'ms' && alin[0].scope.despues === 's', JSON.stringify(r));
  const again = await I.seedInitialCatalog(db);
  const seatV = after.variables.filter((x) => x.testId === (after.tests.find((t) => t.name === 'Single-Leg Seated Calf Raise')).id);
  check('migración: Seated Calf Raise recibe 5 variables, SW al 5 % y fórmulas versionadas', seatV.length === 5 && seatV[1].formula.params.factor === 0.05 && seatV[2].formula.operands[0] === seatV[0].id && (await db.formulaHistory.where('variableId').equals(seatV[1].id).count()) === 1);
  check('migración: no se repite', again.sembrado === false && again.migrado === false && (await db.variables.count()) === 150);
  check('migración: queda en el registro de acciones', (await db.auditLog.toArray()).filter((a) => a.action === 'catalogo-inicial-actualizado').length === 1);
}


// ---- Edición del catálogo
{
  const db = await fresh();
  const cat = await C.listCatalog(db);
  const man = cat.manifestations[0].id;
  const zone = cat.zones.find((z) => z.name === 'Hip').id;
  check('test: nombre obligatorio', (await rejects(() => C.createTest(db, { name: '  ', manifestationId: man }))) === 'El nombre del test es obligatorio.');
  check('test: duplicado en misma manifestación y zona rechazado', (await rejects(() => C.createTest(db, { name: 'hip iso-hold 20 s', manifestationId: cat.manifestations[0].id, zoneId: zone })))?.startsWith('Ya existe un test'));
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
  check('unidad de variable calculada la fija la operación (REL_SW → SW)', (await db.variables.get(vsw)).unit === 'SW');
  await C.updateVariable(db, vsw, { unit: 'BW' });
  check('intentar poner otra unidad a una variable con operación no la cambia', (await db.variables.get(vsw)).unit === 'SW');
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
  const db = await fresh(true);
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
  check('la copia incluye las tablas del catálogo', ['blocks', 'manifestations', 'zones', 'tests', 'protocols', 'variables', 'formulaHistory'].every((k) => k in backup.tables) && backup.schemaVersion === 6);
  await db.tests.delete(t);
  await db.tests.add({ name: 'Basura', blockKey: 'fuerza', manifestationId: m, zoneId: null, archived: false, order: 999 });
  const val = await B.validateBackup(db, backup);
  check('copia del esquema 3 válida', val.ok === true, JSON.stringify(val.errors));
  const r = await B.restoreBackup(db, backup);
  const names = (await db.tests.toArray()).map((x) => x.name);
  check('restaurar conserva el catálogo del usuario sin duplicar el inicial', r.verificado && names.includes('Test del usuario') && !names.includes('Basura') && names.filter((x) => x === 'CMJ').length === 1 && !r.catalogoInicialAnadido && names.length === 38);

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
  check('copia del esquema 2: tras restaurar se añade el catálogo inicial una sola vez', r2.verificado && r2.catalogoInicialAnadido === true && (await db.tests.count()) === 37 && (await db.variables.count()) === 150);
  const r3 = await I.seedInitialCatalog(db);
  check('y no se vuelve a sembrar', r3.sembrado === false && (await db.tests.count()) === 37);
}

console.log(failed ? `\n${failed} prueba(s) fallan` : '\nTodas las pruebas del catálogo pasan');
// Exclusiones del bloque Déficits (12/11/2026): por defecto Torque y Force/RFD at 100 ms; se puede forzar a mano por variable.
check('Déficits: Torque y Force/RFD at 100 ms quedan fuera por defecto; el resto entra', C.variableExcluidaDeDeficits({ name: 'Torque' }) && C.variableExcluidaDeDeficits({ name: 'Force at 100 ms' }) && C.variableExcluidaDeDeficits({ name: 'RFD at 100 ms' }) && !C.variableExcluidaDeDeficits({ name: 'Peak Force' }) && !C.variableExcluidaDeDeficits({ name: 'Peak Force relativo (BW)' }));
check('Déficits: la marca del catálogo manda sobre el valor por defecto', C.variableExcluidaDeDeficits({ name: 'Torque', excluirDeficits: false }) === false && C.variableExcluidaDeDeficits({ name: 'Peak Force', excluirDeficits: true }) === true);

process.exit(failed ? 1 : 0);
