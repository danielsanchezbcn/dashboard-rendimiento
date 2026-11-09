// Importación VALD NordBord (Nordic Hamstring). Datos sintéticos con el formato real de la exportación.
import 'fake-indexeddb/auto';
import { webcrypto } from 'node:crypto';
if (!globalThis.crypto?.subtle) globalThis.crypto = webcrypto;
import * as D from './db.js';
import * as CI from './catalogo-inicial.js';
import { listCatalog } from './catalogo.js';
import * as V from './vald.js';
import { createPlayer } from './jugadores.js';
let failed = 0; const check = (n, c, x = '') => { console.log(`${c ? 'OK  ' : 'FAIL'} ${n} ${x}`); if (!c) failed++; };

const head = ['Name', 'ExternalId', 'Date UTC', 'Time UTC', 'Device', 'Test', 'L Reps', 'R Reps', 'L Max Force (N)', 'R Max Force (N)', 'Max Imbalance (%)', 'L Max Torque (Nm)', 'R Max Torque (Nm)', 'L Avg Force (N)'];
const row = (name, d, t, lr, L, R, im, tl, tr) => [name, '', d, t, 'NordBord-1', 'Nordic', lr, lr, L, R, im, tl, tr, '300'];
const grid = [head,
  row('Jugador Uno', '29/09/2026', '11:20 AM', '3', '361.5', '253.25', '-29.94', '131.7', '92.3'),
  row('Jugador Dos', '26/09/2026', '9:57 AM', '3', '432.75', '493', '12.22', '161.6', '184.1'),
  row('Jugador Dos', '26/09/2026', '4:25 PM', '3', '440', '480', '8.3', '165', '180'),
  row('Jugador Tres', '30/07/2026', '7:03 AM', '3', '316.25', '267.25', '-15.49', '126.6', '107.0'),
];
const db = D.createDb('nb-1'); await D.initDb(db); await CI.seedInitialCatalog(db);
const cat = await listCatalog(db);
check('reconoce el formato NordBord', V.looksLikeVald(grid));
const r = V.parseValdGrid(grid, cat);
check('ok y test Nordic', r.ok && r.testNames[0] === 'Nordic Hamstring Exercise', r.error);
const g = r.groups[0];
const vars = cat.variables.filter((v) => v.testId === g.testId);
const f = vars.find((v) => v.name === 'Max Force').id, a = vars.find((v) => v.name === 'Max Force Asymmetry').id, tq = vars.find((v) => v.name === 'Torque').id;
const u = g.rows.find((x) => x.playerText === 'Jugador Uno');
check('fecha dd/mm y hora AM/PM', u.date === '2026-09-29' && u.time === '11:20');
check('Max Force y Torque por lado', u.values[f].L === 361.5 && u.values[f].R === 253.25 && u.values[tq].L === 131.7 && u.reps.L === 3 && u.reps.R === 3);
check('asimetría D25 = Max Imbalance de VALD', u.values[a].S === -29.94 && g.rows.find((x) => x.playerText === 'Jugador Dos' && x.values[a]).values[a].S > 0);
// mismo jugador y día: se fusiona y la asimetría se recalcula con los valores fusionados
const dos = g.rows.filter((x) => x.playerText === 'Jugador Dos');
check('mismo día: una sola sesión fusionada', dos.length === 1 && dos[0].reps.L === 6, JSON.stringify(dos.map((x) => x.reps)));
const L = dos[0].values[f].L, R = dos[0].values[f].R;
check('asimetría recalculada tras fusionar', Math.abs(dos[0].values[a].S - Math.round(((R - L) / Math.max(L, R)) * 10000) / 100) < 0.011, `${L} ${R} ${dos[0].values[a].S}`);
// guardado
const res = {}; for (const n of ['Jugador Uno', 'Jugador Dos', 'Jugador Tres']) res[n] = { action: 'link', playerId: await createPlayer(db, { jerseyName: n, fullName: '', synthetic: true }) };
const { plans } = await V.planValdImport(db, r, res);
const out = await V.commitValdImport(db, { file: { name: 'nb.csv', hash: 'h', size: 1 }, vald: r, plans, choices: {}, remember: {} });
check('guarda 3 sesiones', out.counts.sesionesCreadas === 3, JSON.stringify(out.counts));
check('la sesión guarda origen VALD', (await db.sessions.toArray()).every((s) => s.source === 'VALD'));
// un fichero ForceDecks sigue funcionando
check('formato desconocido se rechaza', V.parseValdGrid([['A', 'B'], ['1', '2']], cat).ok === false);
console.log(failed ? `${failed} FALLOS` : 'TODO OK');
process.exit(failed ? 1 : 0);
