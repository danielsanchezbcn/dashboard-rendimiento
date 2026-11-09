// Importación con segunda fila de encabezado (LEFT/RIGHT/ASYMMETRY) y columnas de peso y altura. Datos sintéticos.
import 'fake-indexeddb/auto';
import { webcrypto } from 'node:crypto';
if (!globalThis.crypto?.subtle) globalThis.crypto = webcrypto;
import * as D from './db.js';
import * as CI from './catalogo-inicial.js';
import { listCatalog } from './catalogo.js';
import * as I from './importacion.js';
import { createPlayer } from './jugadores.js';
let failed = 0; const check = (n, c, x = '') => { console.log(`${c ? 'OK  ' : 'FAIL'} ${n} ${x}`); if (!c) failed++; };

const grid = [
  ['PLAYER', 'DATE', 'WEIGHT', 'HEIGHT', 'MAXIMUM CALF PERIMETER', '', ''],
  ['', '', '', '', 'LEFT', 'RIGHT', 'ASYMMETRY'],
  ['Jugador Uno', '2026-07-17', 77.5, 181, 38.1, 38.4, 0.8],
  ['Jugador Dos', '2026-07-17', 82, 188, 40, 39.5, 1.2],
];
const db = D.createDb('lado-1'); await D.initDb(db); await CI.seedInitialCatalog(db);
const cat = await listCatalog(db);
const t = cat.tests.find((x) => x.name === 'Perímetros');
const vars = cat.variables.filter((v) => v.testId === t.id);

check('detecta segunda fila', I.detectSubHeader(grid, 0) === true);
check('no la detecta sin lados', I.detectSubHeader([['A', 'B'], ['x', 'y']], 0) === false);
const h = I.effectiveHeaders(grid, 0, true);
check('encabezados compuestos', h[4] === 'MAXIMUM CALF PERIMETER LEFT' && h[5] === 'MAXIMUM CALF PERIMETER RIGHT' && h[2] === 'WEIGHT', JSON.stringify(h));
const m = I.suggestMapping(h, vars);
check('roles propuestos', m[0].role === 'jugador' && m[1].role === 'fecha' && m[2].role === 'peso' && m[3].role === 'altura', JSON.stringify(m.map((x) => x.role)));
check('lados propuestos', m[4].role === 'valor' && m[4].side === 'L' && m[5].role === 'valor' && m[5].side === 'R' && m[6].role === 'ignorar', JSON.stringify(m));
check('mapeo válido', I.validateMapping({ cols: m, headerRow: 0, subHeader: true }, vars).length === 0);
const parsed = I.buildRows(grid, { headerRow: 0, subHeader: true, cols: m }, vars);
check('2 filas válidas', parsed.rows.length === 2 && parsed.rows.every((r) => r.ok));
const vid = vars.find((v) => v.name === 'MAXIMUM CALF PERIMETER').id;
check('valores por lado y cuerpo', JSON.stringify(parsed.rows[0].values[vid]) === '{"L":38.1,"R":38.4}' && JSON.stringify(parsed.rows[0].body) === '{"weight":77.5,"height":181}');

// rangos y mapeo solo peso/altura
const g2 = [['Jugador', 'Fecha', 'Peso', 'Altura'], ['A', '2026-07-17', 7700, 181], ['B', '2026-07-17', 80, 1.85], ['C', '2026-07-17', 80, 185]];
const cols2 = [{ role: 'jugador' }, { role: 'fecha' }, { role: 'peso' }, { role: 'altura' }];
check('solo peso/altura es válido', I.validateMapping({ cols: cols2, headerRow: 0 }, vars).length === 0);
check('fuera de rango bloquea', JSON.stringify(I.buildRows(g2, { headerRow: 0, cols: cols2 }, vars).rows.map((r) => r.ok)) === '[false,false,true]');

// importación
const id = await createPlayer(db, { jerseyName: 'Jugador Uno', fullName: '', synthetic: true });
const res = { 'Jugador Uno': { action: 'link', playerId: id }, 'Jugador Dos': { action: 'new', jerseyName: 'Dos' } };
const plan = await I.planImport(db, { rows: parsed.rows, testId: t.id, resolutions: res });
check('plan: pesos y alturas nuevos', plan.counts.pesosNuevos === 2 && plan.counts.alturasNuevas === 2 && plan.counts.nuevas === 2);
const r = await I.commitImport(db, { file: { name: 'x.xlsx', hash: 'h', size: 1 }, sheetName: 'H', testId: t.id, mapping: {}, parsed, plan, rememberAlias: {} });
check('commit: sesiones, pesos, alturas', r.counts.sesionesCreadas === 2 && r.counts.pesosGuardados === 2 && r.counts.alturasGuardadas === 2, JSON.stringify(r.counts));
const p = await db.players.get(id);
check('peso de referencia guardado', p.referenceWeight?.value === 77.5 && p.referenceWeight?.unit === 'kg');
const an = await db.anthropometry.where('playerId').equals(id).toArray();
check('altura fechada', an.length === 1 && an[0].height.value === 181 && an[0].height.unit === 'cm' && an[0].date === '2026-07-17');
const plan2 = await I.planImport(db, { rows: parsed.rows, testId: t.id, resolutions: res });
check('repetir: peso y altura iguales', plan2.counts.pesosIguales === 1 && plan2.counts.alturasIguales === 1 && plan2.counts.duplicadas === 1, JSON.stringify(plan2.counts));
// solo peso/altura: no crea sesiones
const pb = I.buildRows(g2.slice(0, 1).concat([['C', '2026-07-18', 80, 185]]), { headerRow: 0, cols: cols2 }, vars);
const planB = await I.planImport(db, { rows: pb.rows, testId: t.id, resolutions: { C: { action: 'link', playerId: id } } });
check('fila solo peso/altura no crea sesión', planB.sessions.length === 0 && planB.body.length === 1 && planB.counts.pesosCambiados === 1);
// los 5 perímetros (el nombre con paréntesis incluido) con la segunda fila LEFT/RIGHT/ASYMMETRY
const nombres = vars.map((v) => v.name);
const top = ['PLAYER', 'DATE', 'WEIGHT', 'HEIGHT']; const sub = ['', '', '', ''];
for (const n of nombres) { top.push(n, '', ''); sub.push('LEFT', 'RIGHT', 'ASYMMETRY'); }
const mm = I.suggestMapping(I.effectiveHeaders([top, sub], 0, true), vars);
const asign = mm.filter((x) => x.role === 'valor');
check('5 perímetros × I/D reconocidos', nombres.length === 5 && asign.length === 10 && I.validateMapping({ cols: mm, headerRow: 0, subHeader: true }, vars).length === 0, nombres.join(' | ') + ' ' + asign.length);
console.log(failed ? `${failed} FALLOS` : 'TODO OK');
process.exit(failed ? 1 : 0);
