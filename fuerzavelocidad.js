// fuerzavelocidad.js — G6 (D17): perfil carga-velocidad. Lógica pura + altas en IndexedDB (tabla fvProfiles, esquema 6).
// Método (reproduce el Excel del usuario «PERFIL F V DS», comprobado con los datos de Ansu Fati): regresión lineal por mínimos cuadrados v = a·carga + b
// con ≥ 3 cargas distintas. Fo = −b/a (kg, carga a velocidad 0); Vo = b (m/s, intercepto); pendiente = −a × 1000; FDM = carga con la que v = velocidad FDM
// (0,33 m/s por defecto, la del Excel); fuerza relativa = Fo ÷ masa; potencia óptima = Fo × Vo ÷ 4.
// Diferencia con el Excel: su «Vo» es a + b (velocidad con 1 kg), no el intercepto; para Ansu: 1,3498 frente a 1,3588 m/s (0,7 %).
// Las clases de perfil (umbrales de la pendiente) y la línea «Balanced» son las del Excel del usuario; no se han contrastado con una fuente publicada.
import { audit } from './db.js';
import { isIsoDay } from './fechas.js';
import { evaluate, MIN_N_DEFAULT } from './percentiles.js';
import { massNearest } from './relaciones.js';

export const FDM_VELOCITY_DEFAULT = 0.33;
export const FV_MIN_POINTS = 3, FV_MAX_POINTS = 12;
// Umbrales de la pendiente (−a × 1000) del Excel del usuario; de mayor a menor.
export const FV_CLASSES = [
  { min: 13.1, label: 'Moderate VELOCITY profile' },
  { min: 11.1, label: 'Slight VELOCITY profile' },
  { min: 9, label: 'BALANCED profile' },
  { min: 7, label: 'Slight FORCE profile' },
  { min: 1, label: 'Moderate FORCE profile' },
];
export const FV_INVALID = 'INVALID data';
// Nombres alternativos que el usuario quiere ver junto a cada perfil (8/11/2026): «Force profile» = déficit de fuerza con cargas ligeras; «Velocity profile» = déficit de fuerza con cargas elevadas.
export const FV_ALIASES = { 'Moderate VELOCITY profile': 'déficit de fuerza con cargas elevadas', 'Slight VELOCITY profile': 'déficit de fuerza con cargas elevadas', 'Slight FORCE profile': 'déficit de fuerza con cargas ligeras', 'Moderate FORCE profile': 'déficit de fuerza con cargas ligeras' };
export const classText = (label) => (FV_ALIASES[label] ? `${label} (${FV_ALIASES[label]})` : label);
// Línea de referencia «Balanced» del Excel (8 cargas con su velocidad); editable en la aplicación.
export const FV_REFERENCE_DEFAULT = [[50, 1.1], [60, 1], [70, 0.9], [80, 0.8], [90, 0.7], [100, 0.6], [110, 0.5], [120, 0.4]].map(([load, velocity]) => ({ load, velocity }));

const finite = (x) => typeof x === 'number' && Number.isFinite(x);
export const toNum = (x) => (finite(x) ? x : typeof x === 'string' && /^\s*-?\d+([.,]\d+)?\s*$/.test(x) ? Number(x.trim().replace(',', '.')) : null);

// Puntos válidos: carga > 0 y velocidad > 0, ordenados por carga.
export const cleanPoints = (points) => (points ?? []).map((p) => ({ load: toNum(p?.load), velocity: toNum(p?.velocity) })).filter((p) => p.load !== null && p.velocity !== null && p.load > 0 && p.velocity > 0).sort((a, b) => a.load - b.load);

export function fitLoadVelocity(points, { fdmVelocity = FDM_VELOCITY_DEFAULT, mass = null } = {}) {
  const pts = cleanPoints(points);
  const n = pts.length; const distinct = new Set(pts.map((p) => p.load)).size;
  const bad = (reason) => ({ ok: false, reason, n, class: FV_INVALID });
  if (n < FV_MIN_POINTS || distinct < FV_MIN_POINTS) return bad(`Hacen falta al menos ${FV_MIN_POINTS} cargas distintas con su velocidad (hay ${distinct}).`);
  const mx = pts.reduce((s, p) => s + p.load, 0) / n; const my = pts.reduce((s, p) => s + p.velocity, 0) / n;
  const sxx = pts.reduce((s, p) => s + (p.load - mx) ** 2, 0); const sxy = pts.reduce((s, p) => s + (p.load - mx) * (p.velocity - my), 0); const syy = pts.reduce((s, p) => s + (p.velocity - my) ** 2, 0);
  const a = sxy / sxx; const b = my - a * mx;
  const r2 = syy === 0 ? 1 : (sxy * sxy) / (sxx * syy);
  const fo = -b / a; const vo = b; const slope = -a * 1000;
  const res = { n, a, b, r2, fo, vo, slope, fdm: (fdmVelocity - b) / a, fdmVelocity, pmax: (fo * vo) / 4, relativeForce: finite(mass) && mass > 0 ? fo / mass : null, mass: finite(mass) ? mass : null, points: pts };
  if (!(a < 0) || !(fo > 0) || !(vo > 0)) return { ...res, ok: false, reason: 'La velocidad no baja al subir la carga: la recta no da un perfil válido.', class: FV_INVALID };
  return { ...res, ok: true, class: (FV_CLASSES.find((c) => slope >= c.min) ?? { label: FV_INVALID }).label };
}

// Lee la hoja del Excel propio: busca filas «CARGA» y «VMP» (una debajo de la otra) y empareja las columnas con número en ambas. Devuelve un bloque por cada par encontrado.
export function parseFvGrid(rows) {
  const norm = (c) => String(c ?? '').trim().toUpperCase();
  const blocks = [];
  for (let i = 0; i < rows.length; i++) {
    const ci = (rows[i] ?? []).findIndex((c) => norm(c) === 'CARGA');
    if (ci < 0) continue;
    for (let j = i + 1; j <= Math.min(i + 2, rows.length - 1); j++) {
      const vi = (rows[j] ?? []).findIndex((c) => ['VMP', 'MPV', 'VELOCIDAD'].includes(norm(c)));
      if (vi < 0) continue;
      const points = [];
      for (let c = Math.max(ci, vi) + 1; c < Math.max(rows[i].length, rows[j].length); c++) {
        const load = toNum(rows[i][c]); const velocity = toNum(rows[j][c]);
        if (load !== null && velocity !== null) points.push({ load, velocity });
      }
      if (points.length) blocks.push({ row: i + 1, points });
      break;
    }
  }
  return blocks;
}

const parseRef = (ref) => cleanPoints(ref);
export const referenceFrom = (setting) => { const r = parseRef(setting); return r.length >= 2 ? r : FV_REFERENCE_DEFAULT; };

// ---- Altas, correcciones y bajas (auditoría sin valores) ----
function validate({ date, exercise, points, fdmVelocity }) {
  const d = String(date ?? '').trim();
  if (!isIsoDay(d)) throw new Error('La fecha no es válida (AAAA-MM-DD).');
  const pts = cleanPoints(points);
  if (pts.length < FV_MIN_POINTS || new Set(pts.map((p) => p.load)).size < FV_MIN_POINTS) throw new Error(`Hacen falta al menos ${FV_MIN_POINTS} cargas distintas, cada una con su velocidad (> 0).`);
  if (pts.length > FV_MAX_POINTS) throw new Error(`Máximo ${FV_MAX_POINTS} cargas.`);
  if (pts.length !== new Set(pts.map((p) => p.load)).size) throw new Error('Hay cargas repetidas: usa una sola velocidad por carga.');
  if (pts.some((p) => p.load > 1000 || p.velocity > 10)) throw new Error('Valores fuera de rango (carga hasta 1000 kg, velocidad hasta 10 m/s).');
  const fv = fdmVelocity === undefined || fdmVelocity === null || fdmVelocity === '' ? FDM_VELOCITY_DEFAULT : toNum(fdmVelocity);
  if (fv === null || fv <= 0 || fv > 3) throw new Error('La velocidad de la FDM debe estar entre 0 y 3 m/s.');
  return { date: d, exercise: String(exercise ?? '').trim().slice(0, 80), points: pts, fdmVelocity: fv };
}
// Test de perfil F–V al que pertenece el perfil. Los perfiles guardados antes de 9n no lo tienen (null = sin asignar) y se muestran en todos los tests de perfil F–V hasta que el usuario los asigne.
export const fvTestId = (x) => (Number.isInteger(Number(x)) && Number(x) > 0 ? Number(x) : null);
export async function asignarFvProfile(db, id, testId) {
  const cur = await db.fvProfiles.get(id);
  if (!cur) throw new Error('El perfil no existe.');
  const t = fvTestId(testId);
  if (t === null) throw new Error('Elige un test.');
  await db.fvProfiles.update(id, { testId: t });
  await audit(db, 'perfil-fv-asignado', { id, playerId: cur.playerId, testId: t });
}
export async function addFvProfile(db, input) {
  const player = await db.players.get(input.playerId);
  if (!player) throw new Error('Elige un jugador.');
  const v = validate(input);
  const id = await db.fvProfiles.add({ playerId: input.playerId, ...v, testId: fvTestId(input.testId), source: input.source ?? 'manual', createdAt: new Date().toISOString(), ...(player.synthetic ? { synthetic: 1 } : {}) });
  await audit(db, 'perfil-fv-alta', { id, playerId: input.playerId, date: v.date, puntos: v.points.length });
  return id;
}
export async function updateFvProfile(db, id, input) {
  const cur = await db.fvProfiles.get(id);
  if (!cur) throw new Error('El perfil no existe.');
  const v = validate(input);
  await db.fvProfiles.update(id, { ...v, ...(input.testId === undefined ? {} : { testId: fvTestId(input.testId) }), correctedAt: new Date().toISOString() });
  await audit(db, 'perfil-fv-corregido', { id, playerId: cur.playerId, date: v.date });
}
export async function deleteFvProfile(db, id) {
  const cur = await db.fvProfiles.get(id);
  if (!cur) throw new Error('El perfil no existe.');
  await db.fvProfiles.delete(id);
  await audit(db, 'perfil-fv-eliminado', { id, playerId: cur.playerId, date: cur.date });
}

// Comparación con La Liga (tu base): un valor por jugador = su perfil válido MÁS RECIENTE del mismo ejercicio (texto sin distinguir mayúsculas), sin sintéticos
// y sin el propio jugador. Vo, Fo ÷ masa y potencia óptima: «más alto es mejor» (percentil con color); la pendiente no tiene dirección (solo percentil estadístico).
// Fo ÷ masa usa la regla de masa de cada jugador en la fecha de su perfil; sin masa, ese jugador no entra en esa métrica.
export const FV_METRICS = [
  { key: 'vo', label: 'Vo', unit: 'm/s', direction: 'higher', get: (f) => f.vo },
  { key: 'rel', label: 'Fo ÷ masa', unit: 'kg/kg', direction: 'higher', get: (f) => f.relativeForce },
  { key: 'pmax', label: 'Potencia óptima', unit: 'kg·m/s', direction: 'higher', get: (f) => f.pmax },
  { key: 'slope', label: 'Pendiente (−a × 1000)', unit: '', direction: null, get: (f) => f.slope },
];
const ex = (e) => String(e ?? '').trim().toLowerCase();
export function compareWithSquad({ profiles, players, anthropometry, playerId, current, minN = MIN_N_DEFAULT }) {
  const latest = new Map();
  for (const p of profiles) {
    const pl = players[p.playerId];
    if (!pl || pl.synthetic || ex(p.exercise) !== ex(current.exercise)) continue;
    const c = latest.get(p.playerId);
    if (!c || p.date > c.date || (p.date === c.date && p.id > c.id)) latest.set(p.playerId, p);
  }
  const fits = [...latest.values()].map((p) => ({ playerId: p.playerId, fit: fitLoadVelocity(p.points, { fdmVelocity: p.fdmVelocity, mass: massNearest(anthropometry.filter((a) => a.playerId === p.playerId), p.date)?.kg ?? null }) })).filter((x) => x.fit.ok);
  const mine = fitLoadVelocity(current.points, { fdmVelocity: current.fdmVelocity, mass: massNearest(anthropometry.filter((a) => a.playerId === playerId), current.date)?.kg ?? null });
  return FV_METRICS.map((m) => {
    const value = m.get(mine);
    const entries = fits.map((x) => ({ playerId: x.playerId, value: m.get(x.fit) })).filter((e) => finite(e.value));
    return { ...m, value: finite(value) ? value : null, ev: finite(value) ? evaluate(entries, { playerId, value, direction: m.direction, minN }) : null };
  });
}
