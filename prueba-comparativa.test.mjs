import * as C from './comparativa.js';

let failed = 0;
const check = (n, c, x = '') => { console.log(`${c ? 'OK  ' : 'FAIL'} ${n} ${x}`); if (!c) failed++; };
const V = { id: 5, sides: 'S', direction: 'higher' };
const S = (id, playerId, date, v, reps = 3, extra = {}) => ({ id, playerId, testId: 1, date, time: '', values: { 5: { S: v } }, reps: { total: reps }, status: 'valid', ...extra });
const players = { 1: { jerseyName: 'A' }, 2: { jerseyName: 'B' }, 3: { jerseyName: 'C' }, 4: { jerseyName: 'D' }, 5: { jerseyName: 'E' } };
const positions = [{ id: 10, name: 'Posición 1' }, { id: 20, name: 'Posición 2' }];
const H = (pid, positionId) => ({ playerId: pid, positionId, role: 'principal', validFrom: null, validTo: null });
// Posición sin fechas: A y C → Posición 2, B → Posición 1, D → sin posición. E: sin sesiones del test.
const histories = { 1: [H(1, 20)], 2: [H(2, 10)], 3: [H(3, 20)] };
const sessions = [S(1, 1, '2026-02-10', 12), S(2, 1, '2026-03-10', 13, 2), S(3, 2, '2026-02-10', 21, 4), S(4, 2, '2026-03-10', 20), S(5, 3, '2026-03-12', 8), S(6, 4, '2026-03-12', 9),
  { ...S(7, 5, '2026-03-12', 99), testId: 2 }].filter((s) => s.testId === 1); // E solo tiene sesiones de otro test
const base = { sessions, variable: V, players, histories, positions };
const tx = (r) => r.groups.map((g) => `${g.name}:` + g.rows.map((x) => `${x.playerName}${x.cells.S?.value == null ? '—' : x.cells.S.value}@${x.date}`).join('+')).join(' | ');

let r = C.compareTest({ ...base, mode: 'last' });
check('última sesión: posición única del jugador y E no aparece', tx(r) === 'Posición 1:B20@2026-03-10 | Posición 2:A13@2026-03-10+C8@2026-03-12 | Sin posición:D9@2026-03-12' && r.players === 4, tx(r));
r = C.compareTest({ ...base, mode: 'pb' });
check('Personal Best: B 21 en Posición 1 (10/02)', tx(r) === 'Posición 1:B21@2026-02-10 | Posición 2:A13@2026-03-10+C8@2026-03-12 | Sin posición:D9@2026-03-12', tx(r));
r = C.compareTest({ ...base, mode: 'hist', sort: 'date' });
check('histórico: A aparece solo en su posición (Posición 2), con sus dos sesiones', r.groups[1].rows.some((x) => x.playerName === 'A' && x.cells.S.value === 12) && r.groups[1].rows.some((x) => x.playerName === 'A' && x.cells.S.value === 13) && !r.groups[0].rows.some((x) => x.playerName === 'A') && r.rows === 6, tx(r));
r = C.compareTest({ ...base, mode: 'pb', variable: { ...V, direction: 'lower' } });
check('Personal Best con «más bajo es mejor»: B 20 (Posición 1), A 12 (Posición 2)', tx(r).startsWith('Posición 1:B20@2026-03-10 | Posición 2:A12@2026-02-10'), tx(r));
r = C.compareTest({ ...base, mode: 'pb', variable: { ...V, direction: 'target' } });
check('rango objetivo (CA-02.6): todos «no definido» con motivo', r.rows === 4 && r.groups.flatMap((g) => g.rows).every((x) => x.cells.S.value === null && /D23/.test(x.undefinedReason)));
r = C.compareTest({ ...base, mode: 'pa' });
check('Personal Average: una fila por jugador, ponderada por repeticiones', Math.abs(r.groups[1].rows.find((x) => x.playerName === 'A').cells.S.value - (12 * 3 + 13 * 2) / 5) < 1e-9 && Math.abs(r.groups[0].rows.find((x) => x.playerName === 'B').cells.S.value - (21 * 4 + 20 * 3) / 7) < 1e-9 && r.rows === 4, tx(r));
check('fila con reps y fechas', r.groups[1].rows.find((x) => x.playerName === 'A').cells.S.reps === 5 && r.groups[0].rows.find((x) => x.playerName === 'B').cells.S.sessions === 2);
check('D sin posición va a «Sin posición»', r.groups.at(-1).name === 'Sin posición' && r.groups.at(-1).rows[0].playerName === 'D');
const h2 = { ...histories, 3: [H(3, 10)] };
check('cambiar la posición de C mueve TODO su histórico a la nueva', C.compareTest({ ...base, histories: h2, mode: 'last' }).groups.find((g) => g.rows.some((x) => x.playerName === 'C')).name === 'Posición 1' && C.compareTest({ ...base, histories: h2, mode: 'hist' }).groups.filter((g) => g.rows.some((x) => x.playerName === 'C')).length === 1);
// excluidas
const ex = sessions.map((s) => (s.id === 2 ? { ...s, status: 'excluded' } : s));
check('sesión excluida (CA-02.10): A pasa a 12 (10/02) y B Personal Best no cambia', tx(C.compareTest({ ...base, sessions: ex, mode: 'last' })).includes('Posición 1:B20@2026-03-10 | Posición 2:A12@2026-02-10'));
// orden configurable
check('el orden de los grupos sigue el orden de posiciones configurado (CA-02.12)', C.compareTest({ ...base, positions: [positions[1], positions[0]], mode: 'last' }).groups[0].name === 'Posición 2');
// ordenar por valor
r = C.compareTest({ ...base, mode: 'last', sort: 'value' });
check('orden por valor: mejor primero según la dirección', r.groups[1].rows.map((x) => x.playerName).join() === 'A,C');
// por lado
const VL = { id: 5, sides: 'LR', direction: 'higher' };
const SL = [{ id: 1, playerId: 1, testId: 1, date: '2026-03-10', time: '', values: { 5: { L: 100, R: 110 } }, reps: { L: 3, R: 3 }, status: 'valid' }, { id: 2, playerId: 1, testId: 1, date: '2026-03-20', time: '', values: { 5: { L: 120, R: 100 } }, reps: { L: 3, R: 3 }, status: 'valid' }];
r = C.compareTest({ ...base, sessions: SL, variable: VL, mode: 'pb' });
const row = r.groups.flatMap((g) => g.rows)[0];
check('test por lado: Personal Best por lado y asimetría D25 con los valores mostrados', r.sides.join() === 'L,R' && row.cells.L.value === 120 && row.cells.R.value === 110 && Math.abs(row.asym - ((110 - 120) / 120) * 100) < 1e-9);
r = C.compareTest({ ...base, sessions: SL, variable: VL, mode: 'last' });
check('última sesión por lado: asimetría de esa sesión (izquierda domina → negativo)', r.groups.flatMap((g) => g.rows)[0].asym < 0 && r.groups.flatMap((g) => g.rows)[0].cells.L.value === 120);
check('filtro de fechas y protocolo', C.compareTest({ ...base, mode: 'last', from: '2026-03-01' }).rows === 4 && C.compareTest({ ...base, mode: 'last', from: '2026-03-11' }).players === 2 && C.compareTest({ ...base, mode: 'last', protocolId: 99 }).rows === 0);
process.exit(failed ? 1 : 0);
