// Jurdan Test (primer test del bloque NME): catálogo, propuesta automática de columnas con la segunda fila de encabezado (LEFT HAMS / RIGHT HAMS / ASYMMETRY), importación y asimetría en grados. Datos sintéticos.
import 'fake-indexeddb/auto';
import { webcrypto } from 'node:crypto';
if (!globalThis.crypto?.subtle) globalThis.crypto = webcrypto;
import * as D from './db.js';
import * as CI from './catalogo-inicial.js';
import { listCatalog } from './catalogo.js';
import * as I from './importacion.js';
import { createPlayer } from './jugadores.js';
import { asymmetrySeries } from './evolucion.js';
let failed = 0; const check = (n, c, x = '') => { console.log(`${c ? 'OK  ' : 'FAIL'} ${n} ${x}`); if (!c) failed++; };

const db = D.createDb('jurdan-1'); await D.initDb(db); await CI.seedInitialCatalog(db);
const cat = await listCatalog(db);
const t = cat.tests.find((x) => x.name === 'Jurdan Test');
const vars = cat.variables.filter((v) => v.testId === t.id);
const tt = cat.tests.find((x) => x.name === 'Toe-Touch Test');
const ttv = cat.variables.filter((v) => v.testId === tt.id);
check('Toe-Touch Test: otro sub-apartado de NME, una variable en cm de valor único, sin dirección', tt.blockKey === 'nme' && tt.manifestationId !== t.manifestationId && cat.manifestations.find((m) => m.id === tt.manifestationId)?.name === 'Toe-Touch Test' && ttv.length === 1 && ttv[0].unit === 'cm' && ttv[0].sides === 'single' && ttv[0].direction === null);
check('Jurdan Test en NME, con su sub-apartado y 4 variables sin dirección', t.blockKey === 'nme' && cat.manifestations.find((m) => m.id === t.manifestationId)?.blockKey === 'nme' && vars.length === 4 && vars.every((v) => v.direction === null && v.kind === 'raw'));
check('las 4 variables del Jurdan Test son ángulos (°) por lado', vars.filter((v) => v.unit === '°' && v.sides === 'LR').length === 4 && !vars.some((v) => /TOE/.test(v.name)));

// Hoja con el mismo formato que el Excel: celdas combinadas (vacías) en la fila 1 y lados en la fila 2
const grid = [
  ['PLAYER', 'TOE-TOUCH TEST', 'JURDAN HAMS (SHIN ANGLE = TIBIA vs HORIZONTAL)', null, null, 'JURDAN PSOAS (THIGH ANGLE = FÉMUR vs HORIZONTAL)', null, null, 'JURDAN RECTUS FEMORIS (FÉMUR vs TIBIA)', null, null, 'JURDAN RESULTS', null, null],
  [null, '(fingers-floor distance)', 'LEFT HAMS', 'RIGHT HAMS', 'ASYMMETRY', 'LEFT PSOAS', 'RIGHT PSOAS', 'ASYMMETRY', 'LEFT RF', 'RIGHT RF', 'ASYMMETRY', 'LEFT SHIN vs RIGHT THIGH', 'RIGHT SHIN vs LEFT THIGH', 'ASYMMETRY'],
  ['Jugador Uno', 0, 47, 57.8, 10.8, -11, -14, -3, 68, 65, -3, 61, 68.8, 7.8],
  ['Jugador Dos', -10, 67.6, 58, -9.6, -13, -14, -1, 56.4, 60, 3.6, 81.6, 71, -10.6],
];
check('detecta la segunda fila como lados', I.detectSubHeader(grid, 0) === true);
const h = I.effectiveHeaders(grid, 0, true);
const m = I.suggestMapping(h, vars);
const want = [['jugador'], ['ignorar'], ['valor', 'L'], ['valor', 'R'], ['ignorar'], ['valor', 'L'], ['valor', 'R'], ['ignorar'], ['valor', 'L'], ['valor', 'R'], ['ignorar'], ['valor', 'L'], ['valor', 'R'], ['ignorar']];
check('propone las columnas del Jurdan Test (el Toe-Touch es otro test y las asimetrías en grados del Excel se ignoran)', want.every((w, i) => m[i].role === w[0] && (w[1] === undefined || m[i].side === w[1])), JSON.stringify(m.map((x) => x.role + (x.side ?? ''))));
check('cada ángulo va a su variable', m[2].variableId === vars[0].id && m[5].variableId === vars[1].id && m[8].variableId === vars[2].id && m[11].variableId === vars[3].id);
check('las columnas con texto numérico (datos) no se confunden con una segunda fila', I.detectSubHeader([['A', 'B'], ['Jugador', 5]], 0) === false);
const mapping = { headerRow: 0, subHeader: true, cols: m, fixedDate: '2026-11-05' };
check('mapeo válido', I.validateMapping(mapping, vars).length === 0);
const parsed = I.buildRows(grid, mapping, vars);
check('2 filas válidas con 8 valores', parsed.rows.length === 2 && parsed.rows.every((r) => r.ok), JSON.stringify(parsed.rows.map((r) => r.ok)));
const a = await createPlayer(db, { jerseyName: 'Jugador Uno', fullName: '', synthetic: true });
const b = await createPlayer(db, { jerseyName: 'Jugador Dos', fullName: '', synthetic: true });
const plan = await I.planImport(db, { rows: parsed.rows, testId: t.id, resolutions: { 'Jugador Uno': { action: 'link', playerId: a }, 'Jugador Dos': { action: 'link', playerId: b } } });
const r = await I.commitImport(db, { file: { name: 'j.xlsx', hash: 'hj', size: 1 }, sheetName: 'NME', testId: t.id, mapping: {}, parsed, plan, rememberAlias: {} });
check('guarda 2 sesiones', r.counts.sesionesCreadas === 2, JSON.stringify(r.counts));
const s1 = (await db.sessions.where('playerId').equals(a).toArray())[0];
check('valores en su variable y lado', s1.values[vars[1].id].L === -11 && s1.values[vars[1].id].R === -14 && s1.values[vars[3].id].R === 68.8);
// asimetría en grados (derecha − izquierda), también con ángulos negativos
const sess = await db.sessions.where('playerId').equals(a).toArray();
const as = asymmetrySeries(sess, vars[1].id, { diff: true });
check('asimetría en grados: psoas −14 − (−11) = −3 (gana la izquierda)', as.length === 1 && Math.abs(as[0].pct + 3) < 1e-9, JSON.stringify(as));
check('en % no existiría con ángulos negativos', asymmetrySeries(sess, vars[1].id, {}).length === 0);
// Toe-Touch: se importa con su propio test desde la misma hoja (el resto de columnas no son de ese test)
const ttm = I.suggestMapping(h, ttv);
check('Toe-Touch: propone solo su columna', ttm[1].role === 'valor' && ttm[1].variableId === ttv[0].id && ttm[1].side === 'S' && ttm.slice(2).every((x) => x.role === 'ignorar'), JSON.stringify(ttm.map((x) => x.role)));
const ttmap = { headerRow: 0, subHeader: true, cols: ttm, fixedDate: '2026-11-05' };
const ttp = I.buildRows(grid, ttmap, ttv);
const ttplan = await I.planImport(db, { rows: ttp.rows, testId: tt.id, resolutions: { 'Jugador Uno': { action: 'link', playerId: a }, 'Jugador Dos': { action: 'link', playerId: b } } });
await I.commitImport(db, { file: { name: 'j.xlsx', hash: 'hj2', size: 1 }, sheetName: 'NME', testId: tt.id, mapping: {}, parsed: ttp, plan: ttplan, rememberAlias: {} });
const ts1 = (await db.sessions.where('playerId').equals(b).toArray()).find((x) => x.testId === tt.id);
check('Toe-Touch guardado en cm (−10 = mano plana)', ts1.values[ttv[0].id].S === -10);
console.log(failed ? `${failed} FALLOS` : 'TODO OK');
process.exit(failed ? 1 : 0);
