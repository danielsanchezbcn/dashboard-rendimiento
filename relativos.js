// relativos.js — fase 6b: valores relativos (BW o SW) de las variables «relativas» del catálogo, calculados al vuelo y SIN guardarlos.
// valor relativo = fuerza del lado (N) ÷ (factor × masa corporal (kg) × 9,80665); factor 1 en BW, el de la fórmula en SW (0,29; 0,05 en el calf raise).
// Masa (regla del 8/11/2026, común a todos los cálculos): la masa corporal MEDIDA más cercana a la fecha de la sesión, anterior o posterior, o el peso de
// referencia del jugador si no tiene ninguna medición. Sin masa ni peso de referencia no hay valor relativo (se cuenta y se avisa); el valor absoluto no se toca.
// También calcula, al vuelo, las variables del Iso-Hold y el 1RM estimado de 12RM (D5): ver isohold.js.
import { G, massNearest } from './relaciones.js';
import { isIsoDerived, isoHoldValues, rmEstimate } from './isohold.js';
import { todayIso } from './fechas.js';
import { SW_FACTOR_DEFAULT } from './catalogo.js';

export const REL_OPS = ['REL_BW', 'REL_SW'];
export const isRelative = (v) => v?.kind === 'derived' && REL_OPS.includes(v.formula?.op) && v.formula.operands?.length === 1;
export const isViewable = (v) => !v.archived && (v.kind === 'raw' || isRelative(v) || isIsoDerived(v));
// ¿Hay datos para mostrar la variable? Una relativa se ofrece si hay dato de origen, aunque falte la masa (entonces se explica por qué no hay valor).
export const hasData = (v, sessions) => sessions.some((s) => s.values?.[v.id] || ((isRelative(v) || isIsoDerived(v)) && s.values?.[v.formula.operands[0]]));
export const relFactor = (v) => (v.formula.op === 'REL_SW' ? Number(v.formula.params?.factor ?? SW_FACTOR_DEFAULT) : 1);

// Devuelve { sessions, omitted: { [variableRelativaId]: nº de sesiones sin masa previa } }. Añade values[relId] = {L,R,S} a copias de las sesiones.
export function expandRelative(variables, testId, sessions, anthropometry, ctx = null, today = todayIso()) {
  const rels = variables.filter((v) => v.testId === testId && isRelative(v));
  const test = ctx?.tests?.find((t) => t.id === testId);
  const iso = test ? isoHoldValues({ variables, test, sessions, ctx, anthropometry, today }) : null;
  const rm = variables.filter((v) => v.testId === testId && isIsoDerived(v) && v.formula.op === 'RM_EST');
  if (!rels.length && !iso && !rm.length) return { sessions, omitted: {} };
  const byPlayer = new Map();
  for (const a of anthropometry) (byPlayer.get(a.playerId) ?? byPlayer.set(a.playerId, []).get(a.playerId)).push(a);
  const omitted = { ...(iso?.omitted ?? {}), ...Object.fromEntries(rels.map((r) => [r.id, 0])), ...Object.fromEntries(rm.map((r) => [r.id, 0])) };
  const out = sessions.map((s) => {
    let values = null;
    const extra = iso?.values.get(s.id);
    if (extra) values = { ...s.values, ...extra };
    for (const r of rm) {
      const e = rmEstimate(r, s, anthropometry);
      if (e === undefined) continue;
      if (e === null) { omitted[r.id]++; continue; }
      values ??= { ...s.values };
      values[r.id] = e;
    }
    for (const r of rels) {
      const src = s.values?.[r.formula.operands[0]];
      if (!src) continue;
      const f = relFactor(r);
      if (!(f > 0)) continue;
      const m = massNearest(byPlayer.get(s.playerId) ?? [], s.date);
      if (!m) { omitted[r.id]++; continue; }
      const rel = {};
      for (const k of ['L', 'R', 'S']) if (Number.isFinite(src[k])) rel[k] = src[k] / (f * m.kg * G);
      values ??= { ...s.values };
      values[r.id] = rel;
    }
    return values ? { ...s, values } : s;
  });
  return { sessions: out, omitted };
}
