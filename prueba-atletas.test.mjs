import 'fake-indexeddb/auto';
import * as D from './db.js';
import * as I from './catalogo-inicial.js';
import * as P from './posiciones.js';
import * as J from './jugadores.js';
import * as A from './atletas.js';

let failed = 0;
const check = (n, c, x = '') => { console.log(`${c ? 'OK  ' : 'FAIL'} ${n} ${x}`); if (!c) failed++; };
const db = D.createDb('at-1'); await D.initDb(db); await I.seedInitialCatalog(db);
const H = ['vald-id', 'given-name', 'middle-name', 'family-name', 'email', 'weight', 'Category 1', 'Group 1', 'Category 2', 'Group 2'];
const grid = [H,
  ['id1', 'Ana', '', 'Sintética Uno', '', '0', 'Position', 'Central Midfielder', 'Season', 'Actual'],
  ['id2', 'Beto', '', 'Sintético Dos', '', '0', 'Season', 'Previous', 'Position', 'Goalkeeper'],
  ['id3', 'Ñoño', '', 'Sintético Tres', '', '0', 'Season', 'Actual', '', ''],
  ['id4', 'Dup', '', 'Igual', '', '0', '', '', '', ''],
  ['id5', 'dup', '', 'igual', '', '0', '', '', '', ''],
  ['id1', 'Rep', '', 'Id', '', '0', '', '', '', '']];
const r = A.parseAthletes(grid);
check('se reconoce y se lee', A.looksLikeAthletes(grid) && r.ok);
check('posición por Category=Position, sea cual sea el orden', r.rows.find((x) => x.name === 'Ana Sintética Uno').position === 'Central Midfielder' && r.rows.find((x) => x.name === 'Beto Sintético Dos').position === 'Goalkeeper');
check('sin posición cuando no hay Category Position', r.rows.find((x) => x.name.startsWith('Ñoño')).position === '' && r.withoutPosition === 1);
check('nombres repetidos y vald-id repetido: no se importan y se avisa', r.rows.length === 3 && r.notes.filter((n) => n.level === 'error').length === 2);
check('peso y correo no se importan (se listan como ignorados)', r.ignored.includes('email') && r.ignored.includes('weight'));
check('fichero que no es la lista de atletas rechazado', !A.parseAthletes([['a']]).ok);
// plan con un jugador ya existente
const existing = await J.createPlayer(db, { jerseyName: 'Ana Sintética Uno' });
const plan = await A.planAthletes(db, r.rows);
const pa = plan.find((x) => x.name === 'Ana Sintética Uno');
check('plan: coincidencia propuesta (link) y resto nuevos', pa.suggested?.action === 'link' && pa.suggested.playerId === existing && plan.filter((x) => x.suggested?.action === 'new').length === 2);
const decisions = Object.fromEntries(plan.map((x) => [x.name, x.suggested]));
const pos = await P.createPosition(db, { name: 'Portero sintético' });
const out = await A.commitAthletes(db, { rows: r.rows, decisions, positionMap: { 'Central Midfielder': { create: true }, Goalkeeper: { positionId: pos } } });
check('commit: 2 nuevos, 1 vinculado, 3 alias, 1 posición creada y 2 asignadas', out.counts.jugadoresNuevos === 2 && out.counts.vinculados === 1 && out.counts.aliasAnadidos === 3 && out.counts.posicionesCreadas === 1 && out.counts.posicionesAsignadas === 2, JSON.stringify(out.counts));
const al = await db.playerAliases.where('source').equals('VALD').toArray();
check('alias de la fuente VALD con el nombre exacto del CSV', al.some((a) => a.rawText === 'Ñoño Sintético Tres'));
// reimportar: idempotente y no pisa posiciones
const plan2 = await A.planAthletes(db, r.rows);
const out2 = await A.commitAthletes(db, { rows: r.rows, decisions: Object.fromEntries(plan2.map((x) => [x.name, x.suggested])), positionMap: { Goalkeeper: { positionId: pos } } });
check('reimportar: sin jugadores nuevos, alias ya existentes y posiciones no pisadas', out2.counts.jugadoresNuevos === 0 && out2.counts.aliasYaExistian === 3 && out2.counts.posicionesAsignadas === 0 && out2.counts.posicionesYaTenian >= 1, JSON.stringify(out2.counts));
check('sin jugadores duplicados tras reimportar', (await db.players.count()) === 3);
process.exit(failed ? 1 : 0);
