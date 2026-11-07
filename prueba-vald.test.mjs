import 'fake-indexeddb/auto';
import { webcrypto } from 'node:crypto';
import { readFileSync } from 'node:fs';
if (!globalThis.crypto?.subtle) globalThis.crypto = webcrypto;
import * as D from './db.js';
import * as I from './catalogo-inicial.js';
import * as C from './catalogo.js';
import * as S from './sinteticos.js';
import * as X from './excel.js';
import * as M from './importacion.js';
import * as V from './vald.js';

let failed = 0;
const check = (name, cond, extra = '') => { console.log(`${cond ? 'OK  ' : 'FAIL'} ${name} ${extra}`); if (!cond) failed++; };
const db = D.createDb('v-1'); await D.initDb(db); await I.seedInitialCatalog(db); await S.loadSyntheticDemo(db);
const cat = await C.listCatalog(db);
const buf = readFileSync(new URL('./ejemplo_vald_sintetico.csv', import.meta.url));
const mkFile = (name, data) => ({ name, size: data.length, arrayBuffer: async () => data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) });
const g = await X.readFileGrid(mkFile('vald.csv', buf));
const grid = g.sheets[0].rows;
check('CSV de VALD (BOM, comillas, coma) se lee con 21 columnas y 11 filas', grid[0].length === 21 && grid.length === 11, `${grid[0].length}x${grid.length}`);
check('se reconoce como VALD', V.looksLikeVald(grid) && !V.looksLikeVald([['a', 'b']]));
const res0 = V.parseValdGrid(grid, cat);
const res = { ...res0, ...(res0.groups?.[0] ?? {}), notes: [...(res0.notes ?? []), ...(res0.groups?.[0]?.notes ?? [])] };
check('perfil: RSHIP → Run-Specific Hip Iso-Push (un solo grupo)', res0.ok && res0.codes[0] === 'RSHIP' && res0.groups.length === 1 && res.testName === 'Run-Specific Hip Iso-Push', res0.error);
check('no se importan BW, Tags, asimetrías ni media sin lado', res0.ignored.some((h) => /BW/.test(h)) && res0.ignored.some((h) => h === 'Tags') && res0.ignored.some((h) => /Asym/.test(h)));
const vars = cat.variables.filter((v) => v.testId === res.testId);
const vPF = vars.find((v) => v.name === 'Peak Force'), vF = vars.find((v) => v.name === 'Force at 100 ms'), vR = vars.find((v) => v.name === 'RFD at 100 ms');
const byName = (n) => res.rows.filter((r) => r.playerText.includes(`SINTÉTICO ${n},`));
const C1 = byName('C');
check('D29: dos filas de C a 2 min se fusionan en una sesión', C1.length === 1 && C1[0].mergedRows.length === 2 && res0.mergedCount === 2);
check('fusión: izquierda ponderada (3×350+1×370)/4 = 355; derecha solo la de la primera fila (340)', C1[0].values[vPF.id].L === 355 && C1[0].values[vPF.id].R === 340, JSON.stringify(C1[0].values[vPF.id]));
check('fusión: repeticiones izq 4, der 3; hora de la primera', C1[0].reps.L === 4 && C1[0].reps.R === 3 && C1[0].time === '12:41');
check('fusión registrada en avisos y sin valores', res.notes.some((n) => /fusionadas/.test(n.text)) && !res.notes.some((n) => /355|340/.test(n.text)));
check('E: dos sesiones a 7 h también se fusionan (sin tope de 60 min)', byName('E').length === 1 && byName('E')[0].mergedRows.length === 2);
const Dd = byName('D')[0];
check('D: fila de un solo lado: solo valor derecho, reps izq vacías', Dd.values[vPF.id].L === undefined && Dd.values[vPF.id].R === 300 && Dd.reps.L === null && Dd.reps.R === 1 && Dd.ok);
const F = byName('F');
check('F: valor no numérico y fecha vacía → filas con error', F.length === 2 && F.every((r) => !r.ok) && F[0].issues[0].text.includes('abc'));
check('fecha y hora en formato VALD (dd/mm/aaaa, 12 h)', byName('A')[0].date === '2026-03-10' && byName('A')[0].time === '10:30' && byName('E')[0].time === '09:00');
// errores de perfil
check('código desconocido rechazado', !V.parseValdGrid(grid.map((r, i) => (i ? r.map((c, k) => (k === 2 ? 'XXXX' : c)) : r)), cat).ok);
{ const mix = V.parseValdGrid(grid.map((r, i) => (i === 2 ? r.map((c, k) => (k === 2 ? 'RSKIP' : c)) : r)), cat);
  check('fichero con dos tests: dos grupos, uno por test', mix.ok && mix.groups.length === 2 && mix.groups.map((g) => g.testName).sort().join() === 'Run-Specific Hip Iso-Push,Run-Specific Knee Iso-Push'); }
check('fichero que no es de VALD rechazado', /No parece/.test(V.parseValdGrid([['a', 'b'], [1, 2]], cat).error));
const cat2 = { ...cat, variables: cat.variables.map((v) => (v.name === 'RFD at 100 ms' && v.testId === res.testId ? { ...v, unit: 'N' } : v)) };
check('unidad distinta en el catálogo rechazada', /unidad/.test(V.parseValdGrid(grid, cat2).error ?? ''));
// jugadores con alias VALD
const links = await M.proposeLinks(db, M.distinctNames(res.rows.filter((r) => r.ok)), V.VALD_SOURCE);
const L = Object.fromEntries(links.map((l) => [l.text, l]));
check('alias de VALD sugiere al jugador (única coincidencia exacta)', L['JUGADOR SINTÉTICO A, nombre completo VALD ficticio'].suggestedPlayerId !== null);
check('desconocido sin candidatos', L['JUGADOR DESCONOCIDO FICTICIO'].candidates.length === 0);
const bySource = await M.proposeLinks(db, [{ text: 'JUGADOR SINTÉTICO A, nombre completo VALD ficticio', rows: 1, validRows: 1 }], 'Excel');
check('el alias de VALD no se propone al importar como Excel (fuente distinta)', bySource[0].candidates.length === 0);
const resolutions = {};
for (const l of links) resolutions[l.text] = l.candidates.length ? { action: 'link', playerId: l.candidates[0].playerId } : { action: 'new', jerseyName: 'Jugador sintético nuevo V' };
const vp = await V.planValdImport(db, res0, resolutions);
const plan = vp.plan;
check('plan: 6 nuevas (A, B, C y E fusionadas, D y el desconocido como jugador nuevo)', plan.counts.nuevas === 6 && plan.counts.filasConError === 2 && plan.counts.conflictosFichero === 0, JSON.stringify(plan.counts));
const file = { name: 'vald.csv', hash: g.hash, size: g.size };
const out = await V.commitValdImport(db, { file, vald: res0, plans: vp.plans, remember: {} });
check('importación VALD: 6 sesiones con origen VALD y 1 jugador nuevo', out.counts.sesionesCreadas === 6 && out.counts.jugadoresNuevos === 1 && (await db.sessions.filter((s) => s.source === 'VALD').count()) === 6, JSON.stringify(out.counts));
const idC = L['JUGADOR SINTÉTICO C, nombre completo VALD ficticio'].candidates[0].playerId;
const sC = (await db.sessions.where('playerId').equals(idC).toArray())[0];
check('sesión fusionada guarda valores, reps y filas de origen', sC.values[vPF.id].L === 355 && sC.reps.L === 4 && sC.mergedRows.length === 2);
check('el peso (BW) y las etiquetas no están en ninguna sesión', !(await db.sessions.toArray()).some((s) => 'bw' in s || 'tags' in s || JSON.stringify(s).includes('Fatigue')));
const batch = out.batches[0];
check('lote con fuente VALD y aviso de fusión en el informe', batch.source === 'VALD' && M.reportCsv(batch).includes('fusionadas'));
// reimportar: idempotente
const res2 = V.parseValdGrid(grid, cat);
const newId = (await db.players.toArray()).find((p) => p.jerseyName === 'Jugador sintético nuevo V').id;
const vp2 = await V.planValdImport(db, res2, { ...resolutions, 'JUGADOR DESCONOCIDO FICTICIO': { action: 'link', playerId: newId } });
const plan2 = vp2.plan;
check('reimportar el mismo fichero: todo duplicado, incluida la sesión fusionada', plan2.counts.nuevas === 0 && plan2.counts.duplicadas === 6, JSON.stringify(plan2.counts));

// ---- perfiles de todos los tests (datos sintéticos) ----
const hdrBase = ['Name', 'ExternalId', 'Test Type', 'Date', 'Time', 'BW [KG]'];
const mk = (cols, rows) => [[...hdrBase, ...cols], ...rows];
const cmjGrid = mk(['Reps', 'Tags', 'Jump Height (Imp-Mom) [cm]', 'Jump Height (Imp-Mom) [cm] (Asym)(%)'], [
  ['SINT X', 'e1', 'CMJ', '10/03/2026', '10:30 AM', '70', '3', '', '35.5', '2 R'],
  ['SINT X', 'e1', 'ABCMJ', '10/03/2026', '10:40 AM', '70', '3', '', '30', ''],
  ['SINT X', 'e1', 'LCMJ', '10/03/2026', '10:50 AM', '70', '3', '', '30', '']]);
const rc = V.parseValdGrid(cmjGrid, cat);
check('CMJ: un grupo de un solo valor; ABCMJ y LCMJ omitidos y avisados', rc.ok && rc.groups.length === 1 && rc.groups[0].mode === 'S' && rc.stats.skipped === 2 && rc.groups[0].rows.length === 1, rc.error);
const djCols = ['Reps', 'Tags', 'Drop Height [cm]', 'Contact Time [s]', 'Active Stiffness % (Asym) (%)'];
const djGrid = mk(djCols, [30, 45, 40, 0].map((h, i) => ['SINT X', 'e1', 'DJ', '10/03/2026', `0${i + 1}:00 PM`, '70', '1', '', String(h), '0.2', '11 L']));
const rd = V.parseValdGrid(djGrid, cat);
check('DJ: se separa por altura 30/45 cm y se omiten 40 y 0', rd.ok && rd.groups.length === 2 && rd.stats.skipped === 2 && rd.groups.map((g) => g.testName).sort().join() === 'DL Drop Jump 30 cm,DL Drop Jump 45 cm', rd.error + JSON.stringify(rd.groups?.map((g) => g.testName)));
const vAs = (g) => cat.variables.find((v) => v.testId === g.testId && v.name === 'ACTIVE STIFFNESS ASYMMETRY');
check('DJ: asimetría «11 L» se guarda con signo (L → −11) y no da error', rd.ok && rd.groups.every((g) => g.rows.every((r) => r.ok)) && rd.groups[0].rows[0].values[vAs(rd.groups[0]).id].S === -11);
check('parseAsym: R positivo, L negativo, 0 sin letra = 0, coma decimal, sin letra ≠ 0 y texto basura = error, vacío = sin dato', V.parseAsym('3.8 R').value === 3.8 && V.parseAsym('11 L').value === -11 && V.parseAsym('0').value === 0 && V.parseAsym('0 L').value === 0 && V.parseAsym('2,5 r').value === 2.5 && !!V.parseAsym('5').error && !!V.parseAsym('abc').error && V.parseAsym('  ').empty === true);
const sjGrid = mk(['Reps', 'Tags', 'Additional Load [kg]', 'Jump Height (Imp-Mom) [cm]'], [
  ['SINT X', 'e1', 'SJ', '10/03/2026', '10:00 AM', '70', '3', '', '0', '30'],
  ['SINT X', 'e1', 'SJ', '10/03/2026', '11:00 AM', '70', '3', '', '27.5', '25'],
  ['SINT X', 'e1', 'LSJ', '10/03/2026', '12:00 PM', '70', '3', '', '0', '25']]);
const rs = V.parseValdGrid(sjGrid, cat);
check('SJ: carga adicional > 0 y LSJ omitidos', rs.ok && rs.groups[0].rows.length === 1 && rs.stats.skipped === 2, rs.error);
// migración de unidades escritas a mano
{
  const dbm = D.createDb('v-mig'); await D.initDb(dbm); await I.seedInitialCatalog(dbm);
  const again = await I.seedInitialCatalog(dbm);
  check('catálogo ya alineado: la migración no cambia nada (idempotente)', (again.unidadesAlineadas ?? 0) === 0);
}
process.exit(failed ? 1 : 0);
