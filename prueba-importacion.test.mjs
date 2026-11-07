import 'fake-indexeddb/auto';
import { webcrypto } from 'node:crypto';
if (!globalThis.crypto?.subtle) globalThis.crypto = webcrypto;
import * as D from './db.js';
import * as B from './backup.js';
import * as I from './catalogo-inicial.js';
import * as S from './sinteticos.js';
import * as X from './excel.js';
import * as M from './importacion.js';
import * as C from './catalogo.js';

let failed = 0;
const check = (name, cond, extra = '') => { console.log(`${cond ? 'OK  ' : 'FAIL'} ${name} ${extra}`); if (!cond) failed++; };
let n = 0;
const fresh = async () => { const db = D.createDb('i-' + ++n); await D.initDb(db); await I.seedInitialCatalog(db); await S.loadSyntheticDemo(db); return db; };

// ---- Lectura de celdas
check('número: coma decimal y punto', M.parseNumber('380,5').value === 380.5 && M.parseNumber(12.5).value === 12.5 && M.parseNumber('-3.2').value === -3.2);
check('número: vacío no es 0', M.parseNumber('').empty && M.parseNumber(null).empty && M.parseNumber('  ').empty);
check('número: texto y miles rechazados', !!M.parseNumber('abc').error && !!M.parseNumber('1.234,5').error && !!M.parseNumber(true).error);
check('fecha: Date, ISO y día/mes/año', M.parseDateCell(new Date(Date.UTC(2026, 2, 10))).value === '2026-03-10' && M.parseDateCell('2026-03-10').value === '2026-03-10' && M.parseDateCell('5/3/2026').value === '2026-03-05');
check('fecha: inválidas rechazadas', !!M.parseDateCell('31/02/2026').error && !!M.parseDateCell(46000).error && !!M.parseDateCell('ayer').error && M.parseDateCell('').empty);
check('hora: 24 h y 12 h', M.parseTimeCell('10:30').value === '10:30' && M.parseTimeCell('9:05 PM').value === '21:05' && M.parseTimeCell('12:00 AM').value === '00:00' && !!M.parseTimeCell('25:00').error);
check('reps: entero ≥ 1', M.parseReps(3).value === 3 && !!M.parseReps(0).error && !!M.parseReps(2.5).error && M.parseReps('').empty);

// ---- CSV
{
  const r = X.parseCsv('﻿Jugador;Fecha;Valor\r\n"A; B";10/03/2026;"1,5"\r\n\r\nC;;3\r\n');
  check('CSV: separador ; comillas y BOM', r.delimiter === ';' && r.rows[0][0] === 'Jugador' && r.rows[1][0] === 'A; B' && r.rows[1][2] === '1,5' && r.rows[3][1] === null, JSON.stringify(r.rows));
}

// ---- Fichero Excel real (fixture sintético)
// Libro Excel sintético (2 hojas) generado una vez y embebido para que la prueba no dependa de ficheros externos.
const b64 = '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';
const bytes = Buffer.from(b64, 'base64');
const mkFile = (name, data) => ({ name, size: data.length, arrayBuffer: async () => data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) });
const grid = await X.readFileGrid(mkFile('fixture.xlsx', bytes));
check('xlsx: 2 hojas y huella SHA-256', grid.kind === 'xlsx' && grid.sheets.length === 2 && /^[0-9a-f]{64}$/.test(grid.hash), grid.sheets.map((s) => s.name).join('|'));
const rows0 = grid.sheets[0].rows;
check('xlsx: fecha como Date y número como número', rows0[3][1] instanceof Date && typeof rows0[3][3] === 'number');
let msg = null; try { await X.readFileGrid(mkFile('viejo.xls', bytes)); } catch (e) { msg = e.message; }
check('.xls rechazado con mensaje claro', /xlsx/.test(msg ?? ''));
msg = null; try { await X.readFileGrid(mkFile('roto.xlsx', Buffer.from('no soy un excel'))); } catch (e) { msg = e.message; }
check('xlsx corrupto: error comprensible', /No se pudo leer/.test(msg ?? ''), msg);
msg = null; try { await X.readFileGrid({ name: 'g.xlsx', size: X.MAX_FILE_BYTES + 1, arrayBuffer: async () => new ArrayBuffer(1) }); } catch (e) { msg = e.message; }
check('fichero demasiado grande rechazado', /límite/.test(msg ?? ''));

// ---- Mapeo y filas
const db = await fresh();
const test = (await db.tests.toArray()).find((t) => t.name === 'Run-Specific Hip Iso-Push');
const vars = await db.variables.where('testId').equals(test.id).toArray();
const vPF = vars.find((v) => v.name === 'Peak Force'), vRFD = vars.find((v) => v.name === 'RFD at 100 ms');
check('el test y sus variables existen', !!test && !!vPF && !!vRFD && vPF.kind === 'raw');
const headerRow = M.detectHeaderRow(rows0);
check('encabezado detectado en la fila 3', headerRow === 2, String(headerRow));
const headers = rows0[headerRow];
const sug = M.suggestMapping(headers, vars);
check('propuesta: roles y variables con lado', sug[0].role === 'jugador' && sug[1].role === 'fecha' && sug[2].role === 'reps' && sug[3].variableId === vPF.id && sug[3].side === 'L' && sug[4].side === 'R' && sug[5].variableId === vRFD.id, JSON.stringify(sug));
const mapping = { headerRow, cols: sug };
check('mapeo válido', M.validateMapping(mapping, vars).length === 0);
check('mapeo sin jugador o sin valores falla', M.validateMapping({ cols: [{ role: 'fecha' }] }, vars).length >= 2);
check('mapeo con variable repetida falla', M.validateMapping({ cols: [{ role: 'jugador' }, { role: 'fecha' }, { role: 'valor', variableId: vPF.id, side: 'L' }, { role: 'valor', variableId: vPF.id, side: 'L' }] }, vars).some((e) => /ya está asignada/.test(e)));
const calc = (await db.variables.toArray()).find((v) => v.kind !== 'raw');
check('variable calculada no se puede importar', M.validateMapping({ cols: [{ role: 'jugador' }, { role: 'fecha' }, { role: 'valor', variableId: calc.id, side: 'S' }] }, [calc]).some((e) => /calculada/.test(e)));
check('fecha única fija sustituye a la columna', M.validateMapping({ fixedDate: '2026-03-10', cols: [{ role: 'jugador' }, { role: 'valor', variableId: vPF.id, side: 'L' }] }, vars).length === 0);

const parsed = M.buildRows(rows0, mapping, vars);
const R = parsed.rows;
check('filas: 10 leídas y 1 vacía', parsed.stats.read === 10 && parsed.stats.empty === 1, JSON.stringify(parsed.stats));
check('coma decimal 380,5 y reps 4', R[1].values[vPF.id].L === 380.5 && R[1].reps.total === 4 && !R[1].reps.assumed);
check('celda vacía no se guarda como 0', !('RFD' in R[1]) && R[1].values[vRFD.id] === undefined);
check('fila sin fecha → error', !R[3].ok && R[3].issues.some((i) => /fecha/i.test(i.text)));
check('valor no numérico → error con encabezado', !R[4].ok && R[4].issues.some((i) => /abc/.test(i.text) && /Peak Force Izq/.test(i.text)), JSON.stringify(R[4].issues));
check('fila sin ningún valor → error', !R[5].ok && R[5].issues.some((i) => /ningún valor/.test(i.text)));
// sin columna de reps → 1 supuesta
{
  const noReps = { headerRow, cols: sug.map((c) => (c.role === 'reps' ? { role: 'ignorar' } : c)) };
  const p = M.buildRows(rows0, noReps, vars);
  check('sin columna de reps: 1 repetición marcada como supuesta', p.rows[0].reps.total === 1 && p.rows[0].reps.assumed === true);
}

// ---- Jugadores
const names = M.distinctNames(R);
const links = await M.proposeLinks(db, names);
const byText = Object.fromEntries(links.map((l) => [l.text, l]));
check('alias exacto del Excel sugiere al jugador A (única coincidencia)', byText['jug. sintetico A'].candidates.length === 1 && byText['jug. sintetico A'].suggestedPlayerId !== null);
check('desconocido: sin candidatos', byText['Jugador desconocido'].candidates.length === 0 && byText['Jugador desconocido'].suggestedPlayerId === null);
check('Muñoz exacto → 1 candidato sugerido; con ñ/n → 2 candidatos y manual',
  byText['Jugador sintético Muñoz'].candidates.length >= 1 && (await M.proposeLinks(db, [{ text: 'Jugador sintetico Munoz', rows: 1, validRows: 1 }]))[0].requiresManual === true);
const pid = (txt) => byText[txt].candidates[0].playerId;
const A = pid('jug. sintetico A'), Bp = pid('jug. sintetico B'), Dp = pid('jug. sintetico D'), Fp = pid('jug. sintetico F');
const resolutions = {
  'jug. sintetico A': { action: 'link', playerId: A },
  'Jugador sintético Muñoz': { action: 'link', playerId: pid('Jugador sintético Muñoz') },
  'Jugador desconocido': { action: 'new', jerseyName: 'Jugador sintético nuevo Z' },
  'jug. sintetico B': { action: 'link', playerId: Bp },
  'jug. sintetico C': { action: 'skip' },
  'jug. sintetico D': { action: 'link', playerId: Dp },
  'jug. sintetico F': { action: 'link', playerId: Fp },
};
let plan = await M.planImport(db, { rows: R, testId: test.id, resolutions });
check('plan: 4 nuevas, duplicada dentro del fichero fusionada, 1 conflicto del fichero',
  plan.counts.nuevas === 4 && plan.counts.conflictosFichero === 1 && plan.counts.filasConError === 3 && plan.counts.pendientes === 0 && plan.counts.duplicadas === 0, JSON.stringify(plan.counts));
// C tiene fila sin ningún valor → ya cuenta como error, no como pendiente
const file = { name: 'fixture.xlsx', hash: grid.hash, size: grid.size };
const before = { sessions: await db.sessions.count(), players: await db.players.count() };
const res = await M.commitImport(db, { file, sheetName: grid.sheets[0].name, testId: test.id, mapping, parsed, plan, rememberAlias: { 'Jugador desconocido': true } });
const c = res.counts;
check('importación: 4 sesiones, 1 jugador nuevo, 1 conflicto del fichero', c.sesionesCreadas === 4 && c.jugadoresNuevos === 1 && c.conflictosFichero === 1, JSON.stringify(c));
check('se añadieron 4 sesiones y 1 jugador', (await db.sessions.count()) === before.sessions + 4 && (await db.players.count()) === before.players + 1);
const sA = (await db.sessions.where('playerId').equals(A).toArray())[0];
check('sesión de A: valores por lado, reps 3 y fecha', sA.values[vPF.id].L === 410 && sA.values[vPF.id].R === 398.5 && sA.reps.total === 3 && sA.date === '2026-03-10' && sA.batchId === res.batchId && sA.synthetic === 1);
const newP = (await db.players.toArray()).find((p) => p.jerseyName === 'Jugador sintético nuevo Z');
const al = newP ? await db.playerAliases.where('playerId').equals(newP.id).toArray() : [];
check('jugador nuevo no sintético con alias Excel confirmado', !!newP && !newP.synthetic && al.length === 1 && al[0].source === 'Excel' && al[0].rawText === 'Jugador desconocido' && c.aliasGuardados === 1);
check('F (conflicto del fichero) sin sesiones', (await db.sessions.where('playerId').equals(Fp).count()) === 0);
check('lote registrado con huella', (await M.findBatchByHash(db, grid.hash))?.id === res.batchId && (await M.listBatches(db)).length === 1);
const csv = M.reportCsv(await db.importBatches.get(res.batchId));
check('informe CSV sin valores de datos', !/410|398\.5|380[.,]5/.test(csv) && /Resumen/.test(csv));

// ---- Idempotencia y conflictos
{
  const p2 = M.buildRows(rows0, mapping, vars);
  const plan2 = await M.planImport(db, { rows: p2.rows, testId: test.id, resolutions: { ...resolutions, 'Jugador desconocido': { action: 'link', playerId: newP.id } } });
  check('reimportar: todo duplicado, nada nuevo', plan2.counts.nuevas === 0 && plan2.counts.duplicadas === 4, JSON.stringify(plan2.counts));
  const r2 = await M.commitImport(db, { file, sheetName: 'x', testId: test.id, mapping, parsed: p2, plan: plan2 });
  check('reimportar no crea sesiones', r2.counts.sesionesCreadas === 0 && (await db.sessions.count()) === before.sessions + 4);
  // conflicto: mismo jugador, fecha y hora, valores distintos
  const alt = rows0.map((r) => r.slice());
  alt[3][3] = 999;
  const p3 = M.buildRows(alt, mapping, vars);
  const plan3 = await M.planImport(db, { rows: p3.rows, testId: test.id, resolutions: { 'jug. sintetico A': { action: 'link', playerId: A } } });
  check('conflicto detectado y no sobrescribe', plan3.counts.conflictos === 1);
  const rO = await M.commitImport(db, { file, sheetName: 'x', testId: test.id, mapping, parsed: p3, plan: plan3 });
  check('conflicto por defecto: omitir', rO.counts.conflictosOmitidos === 1 && (await db.sessions.where('playerId').equals(A).count()) === 1);
  const key = plan3.sessions.find((s) => s.status === 'conflicto').key;
  const rN = await M.commitImport(db, { file, sheetName: 'x', testId: test.id, mapping, parsed: p3, plan: plan3, conflictChoices: { [key]: 'nueva' } });
  const sa = await db.sessions.where('playerId').equals(A).toArray();
  check('conflicto «guardar como nueva» conserva la original', rN.counts.conflictosGuardadosComoNuevas === 1 && sa.length === 2 && sa.some((s) => s.values[vPF.id].L === 410));
}

// ---- Mapeos guardados por encabezado
{
  const id = await M.saveMapping(db, { name: 'Hip demo', testId: test.id, headers, cols: sug });
  const saved = (await M.listMappings(db, test.id))[0];
  const shuffled = [headers[3], headers[0], headers[2], headers[1], headers[4], headers[5], headers[6]];
  const ap = M.applyMapping(saved, shuffled);
  check('mapeo guardado se aplica por texto del encabezado aunque cambie el orden', ap.cols[0].variableId === vPF.id && ap.cols[0].side === 'L' && ap.cols[1].role === 'jugador' && ap.missing.length === 0);
  const ap2 = M.applyMapping(saved, headers.slice(0, 4));
  check('encabezados que faltan se avisan', ap2.missing.length === 3);
  await M.saveMapping(db, { name: 'hip DEMO', testId: test.id, headers, cols: sug });
  check('guardar con el mismo nombre actualiza, no duplica', (await M.listMappings(db, test.id)).length === 1);
  await M.deleteMapping(db, id);
  check('mapeo eliminado', (await M.listMappings(db, test.id)).length === 0);
}

// ---- Copias, sintéticos y bloqueos
{
  const snap = await B.buildBackup(db, D.APP_VERSION);
  check('la copia incluye sesiones y lotes', snap.tables.sessions.length === (await db.sessions.count()) && snap.tables.importBatches.length >= 1);
  const u = await C.testUsage(db, test.id);
  check('un test con sesiones no se puede borrar (datos = true)', u.datos === true);
  const msgDel = await (async () => { try { await C.deleteTest(db, test.id); return null; } catch (e) { return e.message; } })();
  check('borrar test con sesiones rechazado', !!msgDel, msgDel);
  // sintéticos: la sesión del jugador nuevo no es sintética y depende de un jugador real → se borran solo las sintéticas
  const real = await db.sessions.filter((s) => !s.synthetic).count();
  await S.deleteSynthetic(db);
  check('eliminar sintéticos quita sus sesiones y conserva las reales', (await db.sessions.filter((s) => s.synthetic === 1).count()) === 0 && (await db.sessions.count()) === real && real >= 1);
}

// ---- Fichero CSV de extremo a extremo
{
  const db2 = await fresh();
  const t = (await db2.tests.toArray()).find((x) => x.name === 'Run-Specific Hip Iso-Push');
  const vs = await db2.variables.where('testId').equals(t.id).toArray();
  const text = 'Jugador;Fecha;Hora;Reps;Peak Force Izq;Peak Force Der\njug. sintetico A;10/03/2026;10:30;3;410;398,5\njug. sintetico A;10/03/2026;11:30;3;400;390\n';
  const g = await X.readFileGrid(mkFile('d.csv', Buffer.from(text)));
  const mp = { headerRow: 0, cols: M.suggestMapping(g.sheets[0].rows[0], vs) };
  check('CSV: mapeo propuesto con hora', mp.cols[2].role === 'hora' && M.validateMapping(mp, vs).length === 0);
  const pr = M.buildRows(g.sheets[0].rows, mp, vs);
  const lk = await M.proposeLinks(db2, M.distinctNames(pr.rows));
  const pl = await M.planImport(db2, { rows: pr.rows, testId: t.id, resolutions: { 'jug. sintetico A': { action: 'link', playerId: lk[0].candidates[0].playerId } } });
  check('misma fecha con horas distintas = dos sesiones', pl.counts.nuevas === 2 && pl.counts.conflictosFichero === 0);
}

process.exit(failed ? 1 : 0);
