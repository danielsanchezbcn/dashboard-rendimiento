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
// Single-Leg Seated Calf Raise (SLSEICR): mismo formato ForceDecks, columnas Peak Vertical Force / Force at 100ms / RFD - 100ms, y una fila con un solo lado.
{
  const cab = ['Name', 'ExternalId', 'Test Type', 'Date', 'Time', 'BW [KG]', 'Reps (L)', 'Reps (R)', 'Tags', 'Peak Vertical Force [N] ', 'Peak Vertical Force [N] (L)', 'Peak Vertical Force [N] (R)', 'Peak Vertical Force [N] (Asym)(%)', 'Force at 100ms [N] ', 'Force at 100ms [N] (L)', 'Force at 100ms [N] (R)', 'Force at 100ms [N] (Asym)(%)', 'RFD - 100ms [N/s] ', 'RFD - 100ms [N/s] (L)', 'RFD - 100ms [N/s] (R)', 'RFD - 100ms [N/s] (Asym)(%)'];
  const fila = (nom, fecha, hora, bw, rl, rr, pf, pfl, pfr, pfa, f1, f1l, f1r, f1a, rf, rfl, rfr, rfa) => [nom, '', 'SLSEICR', fecha, hora, bw, rl, rr, '', pf, pfl, pfr, pfa, f1, f1l, f1r, f1a, rf, rfl, rfr, rfa];
  const gridC = [cab,
    fila('Jug. Sintetico A', '12/11/2026', '10:33 AM', '7.6', '2', '2', '1372', '1308', '1435', '8.9 R', '536', '499', '574', '13 R', '1104', '808', '1401', '42 R'),
    fila('Jug. Sintetico A', '08/07/2024', '10:25 AM', '13.99', '8', '', '656', '656', '', '', '322', '322', '', '', '445', '445', '', '')];
  const r = V.parseValdGrid(gridC, cat);
  const gr = r.groups?.[0];
  check('VALD: el seated calf raise iso-push se reconoce y va a su test', r.ok && r.codes[0] === 'SLSEICR' && gr.testName === 'Seated Calf Raise Iso-Push' && gr.rows.length === 2 && gr.rows.every((x) => x.ok), r.error ?? JSON.stringify(gr?.rows?.map((x) => x.issues)));
  const nom = (id) => cat.variables.find((v) => v.id === Number(id))?.name;
  const v1 = Object.fromEntries(Object.entries(gr.rows[0].values).map(([id, val]) => [nom(id), val]));
  check('VALD calf raise: Peak Force, Force at 100 ms y RFD at 100 ms por lado', v1['Peak Force'].L === 1308 && v1['Peak Force'].R === 1435 && v1['Force at 100 ms'].R === 574 && v1['RFD at 100 ms'].L === 808 && gr.rows[0].reps.L === 2);
  const v2 = Object.fromEntries(Object.entries(gr.rows[1].values).map(([id, val]) => [nom(id), val]));
  check('VALD calf raise: una fila con un solo lado entra solo con ese lado', v2['Peak Force'].L === 656 && v2['Peak Force'].R === undefined && gr.rows[1].reps.L === 8);
  check('VALD calf raise: la columna BW no se guarda como peso corporal (aquí es la carga del test)', !JSON.stringify(gr.rows.map((x) => x.body ?? null)).includes('13.99'));
}
check('fichero que no es de VALD rechazado', /No parece/.test(V.parseValdGrid([['a', 'b'], [1, 2]], cat).error));
const cat2 = { ...cat, variables: cat.variables.map((v) => (v.name === 'RFD at 100 ms' && v.testId === res.testId ? { ...v, unit: 'N' } : v)) };
check('unidad distinta en el catálogo rechazada', /unidad/.test(V.parseValdGrid(grid, cat2).error ?? ''));
// jugadores con alias VALD
const links = await M.proposeLinks(db, M.distinctNames(res.rows.filter((r) => r.ok)), V.VALD_SOURCE);
const L = Object.fromEntries(links.map((l) => [l.text, l]));
check('alias de VALD sugiere al jugador (única coincidencia exacta)', L['JUGADOR SINTÉTICO A, nombre completo VALD ficticio'].suggestedPlayerId !== null);
check('desconocido: nada sugerido (solo coincide una palabra genérica)', L['JUGADOR DESCONOCIDO FICTICIO'].suggestedPlayerId === null && L['JUGADOR DESCONOCIDO FICTICIO'].candidates.every((c) => c.level !== 'alta'));
const bySource = await M.proposeLinks(db, [{ text: 'JUGADOR SINTÉTICO A, nombre completo VALD ficticio', rows: 1, validRows: 1 }], 'Excel');
check('el nombre completo de VALD también se propone al importar como Excel (alta, sin vincular solo)', bySource[0].candidates[0]?.level === 'alta' && bySource[0].suggestedPlayerId !== null);
const resolutions = {};
for (const l of links) resolutions[l.text] = l.suggestedPlayerId ? { action: 'link', playerId: l.suggestedPlayerId } : { action: 'new', jerseyName: 'Jugador sintético nuevo V' };
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
check('informe VALD: el Resumen indica las filas omitidas por test sin perfil', /no importadas por test sin perfil \d+/.test(M.reportCsv(batch)));
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
// El mismo test escrito de otra forma en el catálogo del usuario: el nombre de fábrica es «Seated Calf Raise Iso-Push» y el usuario lo tenía
// como «Single-Leg Seated Calf Raise» (y lo renombró el 14/11/2026). Las dos formas tienen que reconocerse igual.
{
  const dbn = D.createDb('v-nombres'); await D.initDb(dbn); await I.seedInitialCatalog(dbn);
  const tc = (await dbn.tests.toArray()).find((x) => x.name === 'Seated Calf Raise Iso-Push');
  await dbn.tests.update(tc.id, { name: 'Single-Leg Seated Calf Raise' });
  const catn = await C.listCatalog(dbn);
  const cab2 = ['Name', 'ExternalId', 'Test Type', 'Date', 'Time', 'BW [KG]', 'Reps (L)', 'Reps (R)', 'Tags', 'Peak Vertical Force [N] ', 'Peak Vertical Force [N] (L)', 'Peak Vertical Force [N] (R)', 'Peak Vertical Force [N] (Asym)(%)'];
  const g2 = [cab2, ['Jug. Sintetico A', '', 'SLSEICR', '12/11/2026', '10:33 AM', '7.6', '2', '2', '', '1372', '1308', '1435', '8.9 R']];
  const rn = V.parseValdGrid(g2, catn);
  check('VALD: el nombre anterior «Single-Leg Seated Calf Raise» se reconoce igual', rn.ok && rn.groups[0].testId === tc.id && rn.groups[0].rows[0].ok && Object.keys(rn.groups[0].rows[0].values).length >= 1, rn.error ?? JSON.stringify({ g: rn.groups?.[0]?.testId, t: tc.id }));
  await dbn.tests.update(tc.id, { name: 'Single-Leg Seated Calf Raise', archived: true });
  const ra = V.parseValdGrid(g2, await C.listCatalog(dbn));
  check('VALD: si el test está archivado, el aviso lo dice', !ra.ok && /archivado/.test(ra.error ?? JSON.stringify(ra.problems ?? [])), ra.error ?? JSON.stringify(ra.problems ?? []));
  await dbn.tests.delete(tc.id);
  const rd = V.parseValdGrid(g2, await C.listCatalog(dbn));
  check('VALD: si el test no existe, el aviso dice qué hacer', !rd.ok && /no existe en el catálogo\. Créalo/.test(rd.error ?? JSON.stringify(rd.problems ?? [])), rd.error ?? JSON.stringify(rd.problems ?? []));
}

// Dos filas del mismo jugador y día que hoy se fusionan en una sesión, pero que en su momento se guardaron por separado (ventana de 60 min de antes):
// el valor fusionado no coincide con ninguna de las dos y sale un conflicto. Debe explicarse: en qué cambia y que ese día ya hay 2 sesiones.
{
  const dbm = D.createDb('v-fusion'); await D.initDb(dbm); await I.seedInitialCatalog(dbm);
  const catm = await C.listCatalog(dbm);
  const cab = ['Name', 'ExternalId', 'Test Type', 'Date', 'Time', 'BW [KG]', 'Reps (L)', 'Reps (R)', 'Tags', 'Peak Vertical Force [N] ', 'Peak Vertical Force [N] (L)', 'Peak Vertical Force [N] (R)', 'Peak Vertical Force [N] (Asym)(%)', 'Force at 100ms [N] ', 'Force at 100ms [N] (L)', 'Force at 100ms [N] (R)', 'Force at 100ms [N] (Asym)(%)', 'RFD - 100ms [N/s] ', 'RFD - 100ms [N/s] (L)', 'RFD - 100ms [N/s] (R)', 'RFD - 100ms [N/s] (Asym)(%)'];
  const fila = (hora, pfl, pfr) => ['Jugador Fusion', '', 'SLSEICR', '07/01/2024', hora, '3', '2', '2', '', String(pfl + pfr), String(pfl), String(pfr), '5 R', '500', '490', '510', '4 R', '1000', '990', '1010', '2 R'];
  const fich = { name: 'f.csv', hash: 'hf', size: 1 };
  const meter = async (grid, resol) => { const v = V.parseValdGrid(grid, catm); const pp = await V.planValdImport(dbm, v, resol); await V.commitValdImport(dbm, { file: fich, vald: v, plans: pp.plans }); return pp.plan.counts; };
  await meter([cab, fila('12:42 PM', 1000, 1100)], { 'Jugador Fusion': { action: 'new', jerseyName: 'Jugador Fusion' } });
  const pidF = (await dbm.players.toArray())[0].id;
  const linkF = { 'Jugador Fusion': { action: 'link', playerId: pidF } };
  await meter([cab, fila('3:10 PM', 1200, 1300)], linkF);
  check('fusión: de partida hay dos sesiones guardadas ese día', (await dbm.sessions.count()) === 2);
  const vf = V.parseValdGrid([cab, fila('12:42 PM', 1000, 1100), fila('3:10 PM', 1200, 1300)], catm);
  const pf = await V.planValdImport(dbm, vf, linkF);
  const cf = pf.plan.sessions.find((x) => x.status === 'conflicto');
  check('fusión: el fichero completo da un conflicto, no una sesión nueva', pf.plan.counts.conflictos === 1 && pf.plan.counts.nuevas === 0, JSON.stringify(pf.plan.counts));
  check('fusión: el conflicto dice que ese día ya hay 2 sesiones y que el fichero trae 2 filas', cf.sesionesEseDia === 2 && cf.filasFichero === 2 && cf.dif.length >= 1 && cf.dif.every((d) => d.guardado !== d.fichero), JSON.stringify({ d: cf.sesionesEseDia, f: cf.filasFichero, dif: cf.dif }));
  const rr = await V.commitValdImport(dbm, { file: fich, vald: vf, plans: pf.plans, choices: { [`${vf.groups[0].testId}~${cf.key.split('~').slice(1).join('~')}`]: 'reemplazar' } });
  const ses = await dbm.sessions.toArray();
  check('fusión: «reemplazar» deja la sesión fusionada y no crea otra', rr.counts.conflictosReemplazados === 1 && ses.length === 2 && ses.some((x) => x.time === '12:42' && x.values[catm.variables.find((v) => v.name === 'Peak Force' && v.testId === ses[0].testId).id].L === 1100));
}

// ---------- SL Hop Test y SL Drop Jump 30 cm (ficheros del usuario del 14/11/2026): vienen por pierna, con columnas (L) y (R) ----------
// Cabeceras idénticas a las de sus ficheros —incluidos los dobles espacios del RSI, que no llevan unidad—, con jugadores sintéticos.
// La asimetría NO se importa: la calcula el dashboard a partir de los dos lados.
const JUG = (n) => `JUGADOR SINTÉTICO ${n}, nombre completo VALD ficticio`;
const colsSL = (base) => [`${base} `, `${base} (L)`, `${base} (R)`, `${base} (Asym)(%)`];
const gridHop = [
  ['Name', 'ExternalId', 'Test Type', 'Date', 'Time', 'BW [KG]', 'Reps (L)', 'Reps (R)', 'Tags',
    ...colsSL('Mean RSI (Flight/Contact Time) '), ...colsSL('Mean Jump Height (Flight Time) [cm]'), ...colsSL('Mean Contact Time [ms]'),
    ...colsSL('Mean Peak Power [W]'), ...colsSL('Mean Peak Force [N]'), ...colsSL('Mean Active Stiffness [N/m]'), ...colsSL('Mean Landing RFD [N/s]')],
  [JUG('A'), 'SYN- ', 'SLHJ', '10/03/2026', '10:30 AM', '80.0', '1', '2', '', '1.19', '1.17', '1.20', '2.7 R', '8.3', '7.4', '8.8', '15 R', '219', '211', '223', '5.2 R',
    '3105.0', '2963.0', '3177.0', '6.7 R', '3107', '3415', '2953', '14 L', '40810.0', '52970.0', '34730.0', '34 L', '38840', '49790', '33370', '33 L'],
  [JUG('B'), 'SYN- ', 'SLHJ', '10/03/2026', '10:35 AM', '80.0', '2', '2', '', '1.21', '1.21', '1.21', '0.7 R', '12.1', '13.5', '10.7', '21 L', '259', '276', '243', '12 L',
    '3771.0', '3507.0', '4035.0', '13 R', '2869', '2893', '2844', '1.7 L', '29270.0', '24760.0', '33790.0', '27 R', '33600', '31930', '35260', '9.4 R'],
];
const hop = V.parseValdGrid(gridHop, await C.listCatalog(db));
const hopG = hop.groups?.[0] ?? {};
check('SL Hop Test: el código SLHJ lo reconoce', hop.ok && hop.codes[0] === 'SLHJ' && hopG.testName === 'SL Hop Test', hop.error ?? hopG.testName);
check('SL Hop Test: las siete variables, por lado', Object.keys(hopG.rows?.[0]?.values ?? {}).length === 7 && hopG.rows[0].reps?.L === 1 && hopG.rows[0].reps?.R === 2 && Object.values(hopG.rows[0].values).every((v) => 'L' in v && 'R' in v), JSON.stringify(hopG.rows?.[0]?.values));
check('SL Hop Test: no se importan las columnas de asimetría ni la media sin lado', hop.ignored.some((h) => /Asym/.test(h)) && hop.ignored.some((h) => h === 'Mean RSI (Flight/Contact Time)'), JSON.stringify(hop.ignored).slice(0, 200));
{
  const cat = await C.listCatalog(db);
  const vRsi = cat.variables.find((v) => v.name === 'MEAN RSI (FLIGHT TIME / CONTACT TIME)' && cat.tests.find((t) => t.id === v.testId)?.name === 'SL Hop Test');
  const vRfd = cat.variables.find((v) => v.name === 'MEAN LANDING RFD' && cat.tests.find((t) => t.id === v.testId)?.name === 'SL Hop Test');
  const r = hopG.rows?.[0];
  check('SL Hop Test: izquierda y derecha se guardan por separado, también la última columna', Math.abs(r.values[vRsi.id].L - 1.17) < 1e-9 && Math.abs(r.values[vRsi.id].R - 1.20) < 1e-9 && r.values[vRfd.id].L === 49790 && r.values[vRfd.id].R === 33370, JSON.stringify([r.values[vRsi.id], r.values[vRfd.id]]));
}
const gridDj = [
  ['Name', 'ExternalId', 'Test Type', 'Date', 'Time', 'BW [KG]', 'Reps (L)', 'Reps (R)', 'Tags', 'Drop Height [cm]',
    ...colsSL('RSI (Flight Time/Contact Time) '), ...colsSL('Jump Height (Flight Time) [cm]'), ...colsSL('Contact Time [s]'),
    ...colsSL('Eccentric Impulse [N s]'), ...colsSL('Concentric Impulse [N s]'), ...colsSL('Active Stiffness [N/m]'), ...colsSL('Drop Landing [s]')],
  [JUG('A'), 'SYN- ', 'SLDJ', '10/03/2026', '11:30 AM', '80.0', '3', '3', '', '30', '1.21', '0.99', '1.44', '31 R', '12.9', '9.9', '15.9', '38 R', '0.269', '0.286', '0.252', '12 L',
    '170.5', '170.3', '170.6', '0.2 R', '47.7', '26.9', '68.5', '61 R', '8765.00', '6998.00', '10530.00', '34 R', '215.700', '220.400', '211.000', '4.3 L'],
];
const dj = V.parseValdGrid(gridDj, await C.listCatalog(db));
check('SL Drop Jump: SLDJ con 30 cm de caída va al test de 30 cm y trae sus siete variables', dj.ok && dj.groups?.[0]?.testName === 'SL Drop Jump 30 cm' && Object.keys(dj.groups[0].rows[0].values).length === 7, dj.error ?? JSON.stringify(dj.groups?.[0]?.testName));
const dj45 = V.parseValdGrid(gridDj.map((r, i) => (i ? r.map((c, k) => (k === 9 ? '45' : c)) : r)), await C.listCatalog(db));
check('SL Drop Jump: una caída de 45 cm se descarta con su motivo', !dj45.groups?.length || dj45.skipped?.some((s) => /45 cm/.test(s.reason ?? s)), JSON.stringify(dj45.skipped ?? dj45.error).slice(0, 160));

process.exit(failed ? 1 : 0);
