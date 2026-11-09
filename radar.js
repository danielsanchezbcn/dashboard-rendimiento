// radar.js — fase 5d (D16, decidida el 8/11/2026 con la imagen aportada por el usuario): perfil radial G3, sin interfaz.
// Normalización: cada eje se dibuja como valor ÷ mediana (P50) de «La Liga» de esa variable, de modo que el polígono de La Liga es regular (100 %) y los otros
// dos (jugador y mediana de la Premier League) se leen como porcentaje de él. Los valores originales y sus unidades se muestran siempre en una tabla.
// Solo variables con «más alto es mejor» (el cociente no tiene sentido en las de «más bajo es mejor»). Un eje sin dato del jugador, sin P50 suficiente de La Liga
// o sin referencia se omite del radar y se lista aparte; la mediana de la Premier solo se dibuja si la tienen todos los ejes dibujados.
import { playerValue, buildReference, evaluate } from './percentiles.js';
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

const lc = (s) => String(s ?? '').trim().toLowerCase();

export function buildRadar({ profile, test, variables, sessions, players, histories = {}, playerId, basis = 'pa', positionId = null, minN }) {
  const axes = []; const omitted = [];
  for (const a of profile.axes) {
    const variable = variables.find((v) => v.testId === test.id && !v.archived && lc(v.name) === lc(a.variable));
    if (!variable) { omitted.push({ label: a.label, reason: 'La variable no existe en el catálogo.' }); continue; }
    if (variable.sides === 'LR') { omitted.push({ label: a.label, reason: 'Variable por lado: el radar usa variables de un solo valor.' }); continue; }
    if (variable.direction !== 'higher') { omitted.push({ label: a.label, reason: 'Solo se dibujan variables con «más alto es mejor» (el cociente con La Liga no sirve en las demás).' }); continue; }
    const mine = playerValue(sessions.filter((s) => s.testId === test.id && s.playerId === playerId), variable, 'S', { basis, positionId: null, histories, playerId });
    if (!mine) { omitted.push({ label: a.label, reason: 'El jugador no tiene sesiones válidas de esta variable.' }); continue; }
    const entries = buildReference({ sessions, variable, side: 'S', players, histories, basis: basis === 'last' ? 'pa' : basis, positionId });
    const ev = evaluate(entries, { playerId, value: mine.value, direction: variable.direction, minN });
    if (!ev.sufficient || !(ev.p50 > 0)) { omitted.push({ label: a.label, reason: `Sin P50 de La Liga: muestra insuficiente (N = ${ev.n}, mínimo ${ev.minN}).` }); continue; }
    const pr = findPremier(test, variable);
    const premierP50 = pr && !pr.signed && Number.isFinite(pr.cuts[2]) ? pr.cuts[2] : null;
    axes.push({ variable, label: a.label, unit: variable.unit ?? '', mine, laLiga: { p50: ev.p50, n: ev.n }, premier: premierP50, ratioPlayer: mine.value / ev.p50, ratioPremier: premierP50 === null ? null : premierP50 / ev.p50 });
  }
  const premierComplete = axes.length > 0 && axes.every((a) => a.premier !== null);
  return { axes, omitted, premierComplete, drawable: axes.length >= 3 };
}
