// radar.js — fase 5d (D16, decidida el 8/11/2026 con la imagen aportada por el usuario): perfil radial G3, sin interfaz.
// Normalización: cada eje se dibuja como valor ÷ mediana (P50) de «La Liga» de esa variable, de modo que el polígono de La Liga es regular (100 %) y los otros
// dos (jugador y mediana de la Premier League) se leen como porcentaje de él. Los valores originales y sus unidades se muestran siempre en una tabla.
// Solo variables con «más alto es mejor» (el cociente no tiene sentido en las de «más bajo es mejor»). Un eje sin dato del jugador, sin P50 suficiente de La Liga
// o sin referencia se omite del radar y se lista aparte; la mediana de la Premier solo se dibuja si la tienen todos los ejes dibujados.
import { playerValue, buildReference, evaluate, quantile } from './percentiles.js';
import { mismoTest } from './nombres.js';
import { findPremier } from './premier.js';

// Perfil aportado por el usuario (8/11/2026): seis variables del CMJ. «EDRFD/BM» = ECC DECEL RFD (N/s/kg), que coincide con «Eccentric Deceleration RFD / BM (N/s/kg)» de la Premier.
export const RADAR_PROFILES = [{
  id: 'cmj-fast-dynamic', title: 'FAST DYNAMIC STRENGTH', center: 'CMJ', test: 'CMJ',
  axes: [
    { variable: 'JH (imp-mom)', label: 'JH (imp-mom)' },
    { variable: 'CON PEAK POWER/BM', label: 'Peak Power/BM' },
    { variable: 'CON IMPULSE 100ms', label: 'CON Impulse 100ms' },
    { variable: 'RSI MOD', label: 'RSI mod' },
    { variable: 'ECC DECEL RFD', label: 'EDRFD/BM' },
    { variable: 'ECC PEAK POWER/BM', label: 'ECC Peak Power/BM' },
  ],
}];

// Radares de salto reactivo pedidos por el usuario (12/11/2026): RSI, altura de salto y tiempo de contacto. El tiempo de contacto es «más bajo es mejor»,
// así que su eje se dibuja invertido (P50 ÷ valor) para que, como en el resto, hacia fuera siempre sea mejor.
RADAR_PROFILES.push(
  { id: 'hop-reactive', title: 'REACTIVE STRENGTH', center: 'Hop Test', test: 'Double-Leg Hop Test', axes: [
    { variable: 'MEAN RSI (FLIGHT TIME / CONTACT TIME)', label: 'RSI' },
    { variable: 'MEAN JUMP HEIGHT (Flight Time) (cm)', label: 'Jump Height' },
    { variable: 'MEAN CONTACT TIME', label: 'Contact Time' }] },
  ...[30, 45].map((cm) => ({ id: `dj${cm}-reactive`, title: 'REACTIVE STRENGTH', center: `Drop Jump ${cm} cm`, test: `DL Drop Jump ${cm} cm`, axes: [
    { variable: 'RSI (FLIGHT TIME / CONTACT TIME)', label: 'RSI' },
    { variable: 'JUMP HEIGHT (Flight Time - cm)', label: 'Jump Height' },
    { variable: 'CONTACT TIME', label: 'Contact Time' }] })),
);
// Perfil que corresponde a un test: el guardado por el usuario si es de ese test, y si no el de fábrica. Sin perfil, el test no muestra radar.
export const profileForTest = (testName, cfg) => {
  const saved = cfg && typeof cfg.test === 'string' && Array.isArray(cfg.variables) && cfg.variables.length >= RADAR_MIN_AXES ? makeProfile(cfg.test, cfg.variables) : null;
  if (saved && mismoTest(saved.test, testName)) return saved;
  return RADAR_PROFILES.find((p) => mismoTest(p.test, testName)) ?? null;
};
export const RADAR_TESTS = () => RADAR_PROFILES.map((p) => p.test);

export const RADAR_MIN_AXES = 3, RADAR_MAX_AXES = 8;
// Perfil a partir de la elección del usuario (test + variables, en el orden elegido). Con el CMJ y las seis variables de la imagen se conserva el título original.
export function makeProfile(testName, variableNames) {
  const def = RADAR_PROFILES[0];
  const names = [...new Set((variableNames ?? []).map((n) => String(n)))].slice(0, RADAR_MAX_AXES);
  const isDef = testName === def.test && names.length === def.axes.length && def.axes.every((a) => names.some((n) => lc(n) === lc(a.variable)));
  const axes = names.map((n) => (testName === def.test ? def.axes.find((a) => lc(a.variable) === lc(n)) : null) ?? { variable: n, label: n });
  return { id: 'custom', title: isDef ? def.title : `PERFIL ${String(testName).toUpperCase()}`, center: testName, test: testName, axes };
}
// Ajuste guardado → perfil. Cualquier valor inválido (test vacío, menos de 3 variables) devuelve el perfil por defecto.
export function profileFromSetting(cfg) {
  if (cfg && typeof cfg.test === 'string' && Array.isArray(cfg.variables) && cfg.variables.length >= RADAR_MIN_AXES) return makeProfile(cfg.test, cfg.variables);
  return RADAR_PROFILES[0];
}

// Referencias que se pueden mostrar en el radar (9/11/2026). Todas se dibujan como valor ÷ P50 de La Liga (todas las posiciones).
export const RADAR_REFS = [
  { key: 'p50', label: 'P50 La Liga', group: 'liga' },
  { key: 'p75', label: 'P75 La Liga', group: 'liga' },
  { key: 'p50pos', label: 'P50 La Liga by position', group: 'liga', needsPosition: true },
  { key: 'p75pos', label: 'P75 La Liga by position', group: 'liga', needsPosition: true },
  { key: 'premier50', label: 'P50 Premier League', group: 'premier' },
  { key: 'premier75', label: 'P75 Premier League', group: 'premier' },
  { key: 'first', label: 'Player first measurement', group: 'jugador' },
  { key: 'pa', label: 'Personal Average', group: 'jugador' },
  { key: 'pb', label: 'Personal Best', group: 'jugador' },
  { key: 'last', label: 'Player latest measurement', group: 'jugador' },
];
export const RADAR_REFS_DEFAULT = ['p50', 'premier50', 'pa'];
export const radarRefsFromSetting = (v) => (Array.isArray(v) ? v.filter((k) => RADAR_REFS.some((r) => r.key === k)) : RADAR_REFS_DEFAULT);

const lc = (s) => String(s ?? '').trim().toLowerCase();

export function buildRadar({ profile, test, variables, sessions, players, histories = {}, playerId, basis = 'pa', positionId = null, minN, multi = false }) {
  const axes = []; const omitted = [];
  for (const a of profile.axes) {
    const variable = variables.find((v) => v.testId === test.id && !v.archived && lc(v.name) === lc(a.variable));
    if (!variable) { omitted.push({ label: a.label, reason: 'La variable no existe en el catálogo.' }); continue; }
    if (variable.sides === 'LR') { omitted.push({ label: a.label, reason: 'Variable por lado: el radar usa variables de un solo valor.' }); continue; }
    if (variable.direction !== 'higher' && variable.direction !== 'lower') { omitted.push({ label: a.label, reason: 'La variable no dice si es mejor más alto o más bajo: sin eso el cociente con La Liga no se puede orientar.' }); continue; }
    const inv = variable.direction === 'lower'; // «más bajo es mejor»: el eje se invierte (P50 ÷ valor) para que hacia fuera siga siendo mejor
    const mine = playerValue(sessions.filter((s) => s.testId === test.id && s.playerId === playerId), variable, 'S', { basis, positionId: null, histories, playerId });
    if (!mine) { omitted.push({ label: a.label, reason: 'El jugador no tiene sesiones válidas de esta variable.' }); continue; }
    const entries = buildReference({ sessions, variable, side: 'S', players, histories, basis: basis === 'last' || basis === 'first' ? 'pa' : basis, positionId: multi ? null : positionId });
    const ev = evaluate(entries, { playerId, value: mine.value, direction: variable.direction, minN });
    if (!ev.sufficient || !(ev.p50 > 0)) { omitted.push({ label: a.label, reason: `Sin P50 de La Liga: muestra insuficiente (N = ${ev.n}, mínimo ${ev.minN}).` }); continue; }
    const pr = findPremier(test, variable);
    const premierP50 = pr && !pr.signed && Number.isFinite(pr.cuts[2]) ? pr.cuts[2] : null;
    const coc = (v) => (v === null || v === undefined || !Number.isFinite(v) ? null : inv ? (v > 0 ? ev.p50 / v : null) : v / ev.p50);
    const axis = { variable, label: a.label, unit: variable.unit ?? '', invertido: inv, mine, laLiga: { p50: ev.p50, n: ev.n }, premier: premierP50, ratioPlayer: coc(mine.value), ratioPremier: coc(premierP50) };
    if (multi) {
      // Valores absolutos de cada referencia (null = no disponible) y sus cocientes sobre el P50 de La Liga.
      const others = entries.filter((e) => e.playerId !== playerId).map((e) => e.value);
      const q = (vals, p) => (vals.length >= (minN ?? 1) ? quantile(vals, p) : null);
      const posVals = positionId === null ? [] : buildReference({ sessions, variable, side: 'S', players, histories, basis: 'pa', positionId }).filter((e) => e.playerId !== playerId).map((e) => e.value);
      const ownDate = (b) => playerValue(sessions.filter((s) => s.testId === test.id && s.playerId === playerId), variable, 'S', { basis: b, positionId: null, histories, playerId })?.date ?? null;
      const own = (b) => playerValue(sessions.filter((s) => s.testId === test.id && s.playerId === playerId), variable, 'S', { basis: b, positionId: null, histories, playerId })?.value ?? null;
      // En un eje invertido («más bajo es mejor») el percentil 75 del rendimiento es el cuantil 0,25 de los valores: así «P75 La Liga» significa
      // siempre «mejor que el 75 % de los jugadores», en todos los ejes (13/11/2026).
      const q75 = inv ? 0.25 : 0.75;
      const refs = { p50: ev.p50, p75: q(others, q75), p50pos: q(posVals, 0.5), p75pos: q(posVals, q75), premier50: premierP50, premier75: pr && !pr.signed && Number.isFinite(pr.cuts[inv ? 1 : 3]) ? pr.cuts[inv ? 1 : 3] : null, first: own('first'), pa: own('pa'), pb: own('pb'), last: own('last') };
      axis.refs = refs;
      axis.dates = { first: ownDate('first'), last: ownDate('last') };
      axis.ratios = Object.fromEntries(Object.entries(refs).map(([k, v]) => [k, coc(v)]));
    }
    axes.push(axis);
  }
  const premierComplete = axes.length > 0 && axes.every((a) => a.premier !== null);
  // Referencia dibujable solo si todos los ejes dibujados la tienen.
  const complete = Object.fromEntries(RADAR_REFS.map((r) => [r.key, axes.length > 0 && axes.every((a) => a.ratios?.[r.key] != null)]));
  // Fechas de la primera y la última medida (una por eje: pueden diferir entre variables): se muestran en lugar de «primera/última medida».
  const dates = Object.fromEntries(['first', 'last'].map((k) => { const d = [...new Set(axes.map((a) => a.dates?.[k]).filter(Boolean))].sort(); return [k, d.length ? [d[0], d[d.length - 1]] : null]; }));
  return { axes, omitted, premierComplete, drawable: axes.length >= 3, complete, dates };
}
