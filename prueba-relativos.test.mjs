import { expandRelative, isRelative, isViewable, relFactor } from './relativos.js';
import { buildHash } from './rutas.js';
let failed = 0;
const check = (n, ok, d = '') => { console.log(`${ok ? 'OK  ' : 'FAIL'} ${n} ${ok ? '' : d}`); if (!ok) failed++; };
const G = 9.80665; const close = (a, b) => Math.abs(a - b) < 1e-9;
const vars = [
  { id: 1, testId: 1, name: 'Peak Force', kind: 'raw', sides: 'LR', unit: 'N' },
  { id: 2, testId: 1, name: 'Peak Force relativo (BW)', kind: 'derived', sides: 'LR', unit: 'BW', formula: { op: 'REL_BW', operands: [1], params: {} } },
  { id: 3, testId: 1, name: 'Peak Force relativo (SW)', kind: 'derived', sides: 'LR', unit: 'SW', formula: { op: 'REL_SW', operands: [1], params: { factor: 0.29 } } },
  { id: 4, testId: 1, name: 'Asimetría', kind: 'derived', sides: 'single', unit: '%', formula: { op: 'ASIMETRIA', operands: [1], params: {} } },
  { id: 5, testId: 2, name: 'Otra', kind: 'derived', sides: 'LR', unit: 'BW', formula: { op: 'REL_BW', operands: [9], params: {} } },
];
check('isRelative / isViewable', isRelative(vars[1]) && isRelative(vars[2]) && !isRelative(vars[3]) && isViewable(vars[0]) && isViewable(vars[1]) && !isViewable(vars[3]) && !isViewable({ ...vars[0], archived: true }));
check('factor: BW = 1, SW = el de la fórmula (0,29; 0,05)', relFactor(vars[1]) === 1 && relFactor(vars[2]) === 0.29 && relFactor({ ...vars[2], formula: { op: 'REL_SW', operands: [1], params: { factor: 0.05 } } }) === 0.05);
const an = [{ id: 1, playerId: 1, date: '2026-01-01', bodyMass: { value: 80, unit: 'kg' } }, { id: 2, playerId: 1, date: '2026-03-01', bodyMass: { value: 90, unit: 'kg' } }];
const S = (id, playerId, date, L, R) => ({ id, playerId, testId: 1, date, values: { 1: { L, R } }, reps: {}, status: 'valid' });
const raw = [S(1, 1, '2026-01-20', 80 * G * 3, 80 * G * 2), S(2, 1, '2026-03-05', 90 * G * 2, 90 * G * 2), S(3, 2, '2026-02-01', 500, 500), S(4, 1, '2025-12-01', 500, 500)];
const e = expandRelative(vars, 1, raw, an);
check('BW con la masa medida más cercana (80 kg el 20/1, 90 el 5/3)', close(e.sessions[0].values[2].L, 3) && close(e.sessions[0].values[2].R, 2) && close(e.sessions[1].values[2].L, 2));
check('SW = fuerza ÷ (0,29 × masa × g), sin redondear', close(e.sessions[0].values[3].L, 3 / 0.29));
check('sin ninguna medición ni peso de referencia: sin valor y contado (jugador 2); una sesión anterior a la primera medida usa la más cercana (posterior)', e.sessions[2].values[2] === undefined && e.omitted[2] === 1 && e.omitted[3] === 1 && close(e.sessions[3].values[2].L, 500 / (80 * G)));
const eRef = expandRelative(vars, 1, raw, an.concat([{ playerId: 2, date: null, reference: true, bodyMass: { value: 100, unit: 'kg' } }]));
check('con peso de referencia el jugador 2 sí tiene valor relativo', close(eRef.sessions[2].values[2].L, 500 / (100 * G)) && eRef.omitted[2] === 0);
check('el absoluto no se toca y las sesiones originales no se modifican', e.sessions[0].values[1].L === 80 * G * 3 && raw[0].values[2] === undefined);
check('variable relativa sin dato de origen no genera nada; test sin relativas devuelve lo mismo', expandRelative(vars, 2, [{ id: 9, playerId: 1, testId: 2, date: '2026-02-01', values: {}, status: 'valid' }], an).sessions[0].values[5] === undefined && expandRelative(vars, 3, raw, an).sessions === raw);
check('ruta: un parámetro undefined no aparece (filtro de excluidas desactivado)', !buildHash('test-1', { pos: 'none', ex: undefined }).includes('ex'));
process.exit(failed ? 1 : 0);
