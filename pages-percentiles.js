// pages-percentiles.js — fase 5c: percentiles frente a «La Liga», escala de referencia (G4 completo) y barras normativas (G2).
import './fuentes.js';
import { html, useRef, useEffect, Chart } from './libs.js';
import { useApp } from './context.js';
import { useLoad, agruparFiltros, SelectorVariable } from './componentes.js';
import { fmtDay } from './fechas.js';
import { getSetting } from './db.js';
import { expandRelative } from './relativos.js';
import { pairContext } from './isohold.js';
import { withReferenceWeights } from './relaciones.js';
import { findPremier, estimateRelative, placeAgainstPremier } from './premier.js';
import { findNatera } from './natera.js';
import { listPositions } from './posiciones.js';
import { asymmetryPct, asymText } from './catalogo.js';
import { asimClase } from './asim-ui.js';
import { BANDS, MIN_N_DEFAULT, buildReference, evaluate, playerValue, perfQuantile } from './percentiles.js';
import { PAL, colorLado } from './colores.js';
import { isRelative, relFactor } from './relativos.js';
import { Copiable } from './copiar.js';
import { ICONO_LALIGA, ICONO_PREMIER, ICONO_TARGET, ICONO_NATERA } from './iconos.js';
import { dn } from './nombres.js';

const nf = (n, d = 1) => (n === null || n === undefined ? '—' : Number(n).toLocaleString('es-ES', { maximumFractionDigits: d }));
const nfv = (n) => nf(n, 2);
const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const SIDE = { L: 'Left', R: 'Right', S: 'Value' };
const BASIS = { pa: 'Personal Average', last: 'Última sesión válida' };

export function Banda({ ev }) {
  if (!ev || ev.band === null) return null;
  const b = BANDS[ev.band];
  return html`<span class=${'band band-' + b.key} title=${`${b.name} (P${b.range})${ev.positional ? ' · color según la posición en La Liga: la variable no tiene dirección «mejor/peor»' : ''}`}>${nf(ev.percentilePerf, 0)}</span>`;
}

// Resultado de un percentil para una celda: número siempre visible (el color nunca es el único canal).
export function CeldaPercentil({ ev }) {
  if (!ev) return '—';
  if (!ev.sufficient || ev.percentileStat === null) return html`<span class="muted">${ev.reason}</span>`;
  return html`<span>${ev.band !== null ? html`<${Banda} ev=${ev} />` : html`<span class="muted" title=${ev.reason}>P${nf(ev.percentileStat, 0)} estadístico (sin color)</span>`}</span>`;
}

// G4 completo (aspecto de los informes del usuario: fondo oscuro, azul = izquierda, naranja = derecha): escala MIN–MAX de la referencia de La Liga con las marcas
// de referencia elegidas (icono de La Liga o de la Premier y «P50»/«P75», también por posición), el target (bandera) y, por cada base elegida del jugador
// (Resultado actual, Personal Best, Personal Average), una fila de marcadores con su valor; en tests por lado, un corchete con la asimetría D25.
// Si algo cae fuera del rango se amplía la escala y se avisa (provisional, D24).
function EscalaG4({ filas, refs, unit, target }) {
  const rows0 = filas[0].rows;
  const vals = filas.flatMap((f) => f.rows.flatMap((r) => [r.ev.min, r.ev.max, r.value, r.ev.p50])).concat(refs.map((m) => m.v), (target ?? []).map((t) => t?.value)).filter((v) => v != null);
  const min = Math.min(...vals), max = Math.max(...vals), span = max - min || 1;
  const hayEtiq = filas.length > 1 || filas[0].base !== 'pa'; // etiquetas PA / PB / fecha a la izquierda, a la altura del valor
  const W = 640, L = hayEtiq ? 100 : 40, R = 40;
  const x = (v) => L + ((v - min) / span) * (W - L - R);
  const T = PAL.texto;
  const lo = L - 6, hi = W - R + 6;
  const dibujar = filas.map((f) => {
    const cx = f.rows.map((r) => x(r.value));
    if (f.rows.length === 2 && Math.abs(cx[0] - cx[1]) < 28) { const m = (cx[0] + cx[1]) / 2, d = cx[0] <= cx[1] ? 14 : -14; cx[0] = m - d; cx[1] = m + d; }
    const close = f.rows.length === 2 && Math.abs(cx[0] - cx[1]) < 40;
    for (let k = 0; k < cx.length; k++) cx[k] = Math.min(hi, Math.max(lo, cx[k]));
    return { ...f, cx, close };
  });
  const rangoLaLiga = rows0.map((r) => [r.ev.min, r.ev.max]).filter(([a]) => a != null);
  const out = filas.some((f) => f.rows.some((r) => r.ev.min != null && (r.value < r.ev.min || r.value > r.ev.max))) || (rangoLaLiga.length > 0 && refs.some((m) => m.premier && (m.v < Math.min(...rangoLaLiga.map((r) => r[0])) || m.v > Math.max(...rangoLaLiga.map((r) => r[1])))));
  // marcas por encima de la línea; si dos quedan a menos de 64 px, la segunda sube un nivel
  const marks = [...refs, ...(target ?? []).filter(Boolean).map((t, i) => ({ key: 'tg' + i, v: t.value, icon: ICONO_TARGET, color: PAL.target, txt: null, dash: true, label: `Target: ${nfv(t.value)} ${unit ?? ''}` }))].sort((a, b) => a.v - b.v);
  // Cada marca ocupa (icono + texto) un tramo horizontal. De derecha a izquierda, cada una sube por encima de las que se le solapan: así la línea de una marca nunca atraviesa el texto de otra.
  const tramo = (m) => [x(m.v) - 15, x(m.v) + 20 + (m.txt ? m.txt.length * 7.5 : 0)];
  [...marks].sort((a, b) => b.v - a.v).forEach((m, i, arr) => { const [l, r] = tramo(m); const lv = arr.slice(0, i).filter((o) => { const [ol, or] = tramo(o); return l < or && ol < r; }).map((o) => o.level + 1); m.level = lv.length ? Math.max(...lv) : 0; });
  const levels = Math.max(0, ...marks.map((m) => m.level));
  const y0 = 84 + levels * 36;
  const unaFila = dibujar.length === 1;
  const conEtiqueta = (f) => !unaFila || f.base !== 'pa';
  const alto = (f) => (f.asym != null && f.rows.length === 2 ? 100 : 62);
  let yy = y0; const pos = dibujar.map((f) => { const y = yy; yy += alto(f) + (unaFila ? 0 : 6); return y; });
  const Hs = yy + 34;
  const marker = (m) => html`<g key=${m.key}><title>${m.label}</title>
    <line x1=${x(m.v)} x2=${x(m.v)} y1=${y0 - 24 - m.level * 36} y2=${y0} stroke=${m.color} stroke-width="2" ${m.dash ? 'stroke-dasharray="4 3"' : ''} />
    <image href=${m.icon} x=${x(m.v) - 13} y=${y0 - 56 - m.level * 36} width="26" height="30" preserveAspectRatio="xMidYMid meet" />
    ${m.txt ? html`<text x=${x(m.v) + 16} y=${y0 - 36 - m.level * 36} font-size="12" font-weight="700" fill=${m.color}>${m.txt}</text>` : null}</g>`;
  return html`<${Copiable} nombre="percentiles-escala"><div class="doc-panel"><svg viewBox=${`0 0 ${W} ${Hs}`} width="100%" role="img" style="display:block" aria-label=${`Escala de ${nfv(min)} a ${nfv(max)} ${unit ?? ''}: referencias elegidas, target y valores del jugador`}>
    <rect width=${W} height=${Hs} fill=${PAL.fondo} />
    <line x1=${L} x2=${W - R} y1=${y0} y2=${y0} stroke=${T} stroke-opacity="0.5" stroke-width="3" />
    ${marks.map(marker)}
    ${dibujar.map((f, fi) => { const yb = pos[fi]; return html`<g key=${'f' + f.base}>
      ${conEtiqueta(f) ? html`<text x="8" y=${yb + 32} font-size="12" font-weight="700" fill=${T} fill-opacity="0.85">${f.etiqueta}</text>` : null}
      <g>${f.rows.map((r, i) => html`<g key=${'p' + r.side}><title>${f.etiqueta}, ${SIDE[r.side]}: ${nfv(r.value)} ${unit ?? ''}${r.info ? ` — ${r.info}` : ''}</title>
        <circle cx=${f.cx[i]} cy=${yb + 28} r="11" fill=${colorLado(r.side)} />
        ${r.side === 'S' ? null : html`<text x=${f.cx[i]} y=${yb + 32} text-anchor="middle" font-size="12" font-weight="700" fill=${PAL.fondo}>${r.side}</text>`}
        <text x=${f.cx[i] + (f.close ? (f.cx[i] === Math.min(...f.cx) ? 4 : -4) : 0)} y=${yb + 56} text-anchor=${f.close ? (f.cx[i] === Math.min(...f.cx) ? 'end' : 'start') : 'middle'} font-size="12" fill=${T}>${nfv(r.value)}</text></g>`)}
      ${f.asym != null && f.rows.length === 2 ? html`<g><path d=${`M ${f.cx[0]} ${yb + 72} v 6 H ${f.cx[1]} v -6`} fill="none" stroke=${T} stroke-opacity="0.6" /><text x=${Math.min(W - 90, Math.max(90, (f.cx[0] + f.cx[1]) / 2))} y=${yb + 94} text-anchor="middle" font-size="12" fill=${T}>Asymmetry <tspan class=${asimClase(f.asym) || null}>${asymText(f.asym)}</tspan></text></g>` : null}</g></g>`; })}
    <text x=${L} y=${Hs - 6} text-anchor="start" font-size="11" fill=${T}>${nfv(min)} ${unit ?? ''}</text><text x=${W - R} y=${Hs - 6} text-anchor="end" font-size="11" fill=${T}>${nfv(max)} ${unit ?? ''}</text>
  </svg></div><//>${out ? html`<p class="muted">Algún valor queda fuera del rango de la referencia de La Liga: la escala se ha ampliado para mostrarlo.</p>` : null}`;
}

// Datos de la referencia (todos los jugadores del test), cargados una vez por test y compartidos por el gráfico y el cuadro.
export function useRefData(test) {
  const { db, version } = useApp();
  const { data } = useLoad(async () => {
    const [raw, players, records, positions, minN, variables, anthropometry] = await Promise.all([db.sessions.where('testId').equals(test.id).toArray(), db.players.toArray(), db.playerPositions.toArray(), listPositions(db), getSetting(db, 'percentileMinN'), db.variables.toArray(), db.anthropometry.toArray()]);
    const sessions = expandRelative(variables, test.id, raw, withReferenceWeights(anthropometry, players), await pairContext(db, await db.tests.toArray(), test)).sessions;
    return { sessions, players, records, positions, minN: Number.isInteger(minN) && minN >= 1 ? minN : MIN_N_DEFAULT };
  }, [db, test.id, version]);
  return data;
}

// Contexto de percentiles de un jugador y una variable: referencia agrupada (ambos lados juntos), líneas P50/P75 de La Liga (todas las posiciones y por posición),
// P50 de la Premier y texto de percentil/zona para cualquier valor (se usa en los cursores de los gráficos).
export function refContext({ refData, test, variable, sides, filters, playerId, positionId, srcVar = null }) {
  const { sessions, players, records, minN } = refData;
  const playersById = Object.fromEntries(players.map((p) => [p.id, p]));
  const histories = {}; for (const r of records) (histories[r.playerId] ??= []).push(r);
  // El resultado actual se compara con el Personal Average de los demás jugadores (9/11/2026); el Personal Best con sus Personal Best. Ambas piernas juntas.
  const entries = (basis, posId = null) => sides.flatMap((sd) => buildReference({ sessions, variable, side: sd, players: playersById, histories, basis: basis === 'last' ? 'pa' : basis, positionId: posId, from: filters.from, to: filters.to, protocolId: filters.protocolId }));
  const plRef = isRelative(variable) ? (srcVar ? estimateRelative(findPremier(test, srcVar), relFactor(variable)) : null) : findPremier(test, variable);
  const cache = {};
  const ent = (basis, posId) => (cache[basis + ':' + posId] ??= entries(basis, posId));
  const vals = (basis, posId) => ent(basis, posId).filter((e) => e.playerId !== playerId).map((e) => e.value);
  const line = (p, posId) => { const v = vals('pa', posId); return v.length >= minN ? perfQuantile(v, p, variable.direction) : null; };
  const lines = { p50: line(0.5, null), p75: line(0.75, null), p50pos: positionId != null ? line(0.5, positionId) : null, p75pos: positionId != null ? line(0.75, positionId) : null, premier50: plRef ? plRef.cuts[2] : null, premier75: plRef && !plRef.signed ? plRef.cuts[3] : null };
  // ÚNICA evaluación de un valor frente a La Liga (referencia con ambos lados juntos): la usan la tabla Normative Benchmarking, las marcas de la escala y los cursores de los gráficos,
  // así que un mismo valor y base dan siempre el mismo percentil en todas partes.
  const evalValor = (value, basis = 'last', posId = null) => evaluate(ent(basis, posId), { playerId, value, direction: variable.direction, minN });
  const info = (value, basis = 'last') => {
    if (!Number.isFinite(value)) return [];
    const ev = evalValor(value, basis, null);
    const ll = !ev.sufficient ? `insufficient sample (N = ${ev.n}, min ${ev.minN})` : ev.percentilePerf != null ? `${nf(ev.percentilePerf, 0)}` : `P${nf(ev.percentileStat, 0)} (statistical, no colour)`;
    const pl = plRef ? placeAgainstPremier(plRef, value) : null;
    return [`La Liga percentile: ${ll}`, `Premier League: ${plRef ? (pl?.placed ? pl.text + (plRef.estimated ? ' (estimated)' : '') : 'not placed') : 'no reference'}`];
  };
  return { entries: ent, plRef, lines, info, evalValor, minN, histories, playersById };
}

const BASES = [['last', 'Resultado actual'], ['pb', 'Personal Best'], ['pa', 'Personal Average']];

// Escala «Benchmark-Contextualized Positioning» de la variable seleccionada. (El cuadro de percentiles es ahora «Normative Benchmarking», en pages-normativo.js.)
// Con dos lados, la referencia de La Liga es UNA sola (los valores de ambos lados de todos los jugadores juntos), así que hay un único P50.
export function PercentilesPanel({ player, test, variable, mine, q, setQ, filters, targets = {}, stats, current, refData, abs = null, posJugador = null, vars = [] }) {
  if (!refData) return null;
  const { sessions: _s, positions, minN } = refData;
  const rp = q.rp ?? 'all';
  const positionId = rp === 'all' ? null : Number(rp);
  const sides = variable.sides === 'LR' ? ['L', 'R'] : ['S'];
  const ctx = refContext({ refData, test, variable, sides, filters, playerId: player.id, positionId: null, srcVar: abs?.variable ?? null });
  const plRef = ctx.plRef; // en medida relativa es una estimación (estimateRelative)
  const unit = variable.unit;
  const u = unit ? ` ${unit}` : '';
  // valor propio por fila y lado (mismos valores que el gráfico) y detalle para el cursor
  const own = (basis, sd) => {
    if (basis === 'last') { const c = current?.[sd]; return c ? { value: c.value, tip: fmtDay(c.date) } : null; }
    if (basis === 'pb') { const b = stats?.[sd]?.pb; return b?.defined ? { value: b.value, tip: `${b.viaCriterion ? `Sesión con mejor ${b.criterionName} · ` : ''}${fmtDay(b.date)}${b.tied ? (b.sameDayTie ? ', empate el mismo día' : ', empate: se muestra la más reciente') : ''}` } : { value: null, tip: b?.reason ?? '' }; }
    const a = stats?.[sd]?.pa; return a?.defined ? { value: a.value, tip: `${fmtDay(a.from)} a ${fmtDay(a.to)}, ${a.sessions} sesión(es)${a.reps !== null ? `, ${a.reps} rep.` : ', sin repeticiones en alguna sesión: pesa 1'}` } : null;
  };
  // referencia agrupada por base (ambos lados juntos) y evaluación
  const pooled = {};
  for (const [b] of BASES) pooled[b] = ctx.entries(b, positionId);
  const cell = {};
  for (const [b] of BASES) for (const sd of sides) {
    const o = own(b, sd);
    cell[b + sd] = o && o.value != null ? { ...o, ev: evaluate(pooled[b], { playerId: player.id, value: o.value, direction: variable.direction, minN }), pl: plRef ? placeAgainstPremier(plRef, o.value) : null } : { ...(o ?? {}), value: null };
  }
  if (!BASES.some(([b]) => sides.some((sd) => cell[b + sd].value != null))) return html`<p class="muted">Sin sesiones válidas para calcular percentiles en este periodo.</p>`;
  // Escala: bases del jugador (Resultado actual, Personal Best, Personal Average) y marcas de referencia, todas opcionales. Por defecto: Personal Average, P50 La Liga y P50 Premier League.
  const nat = findNatera(test, variable); // referencias de Natera (solo Iso-Push): tres marcas opcionales y una columna en el cuadro
  const diasActual = [...new Set(sides.map((sd) => current?.[sd]?.date).filter(Boolean))];
  const etiquetaActual = diasActual.length ? diasActual.map(fmtDay).join(' / ') : 'Latest result'; // la fecha del test, como en el cuadro
  const baseRows = (b) => sides.map((sd) => (cell[b + sd].value != null ? { side: sd, value: cell[b + sd].value, ev: cell[b + sd].ev, info: ctx.info(cell[b + sd].value, b).join(' · ') } : null)).filter(Boolean);
  const ctxPos = posJugador != null ? refContext({ refData, test, variable, sides, filters, playerId: player.id, positionId: posJugador, srcVar: abs?.variable ?? null }) : null;
  const posNom = positions.find((p) => p.id === posJugador)?.name ?? 'position';
  const REFS = [['p50', 'P50 La Liga', ctx.lines.p50, PAL.laLiga, ICONO_LALIGA, 'P50', false], ['p75', 'P75 La Liga', ctx.lines.p75, PAL.laLiga, ICONO_LALIGA, 'P75', false],
    ['p50pos', `P50 La Liga (${posNom})`, ctxPos?.lines.p50pos ?? null, PAL.laLiga, ICONO_LALIGA, 'P50 pos.', false], ['p75pos', `P75 La Liga (${posNom})`, ctxPos?.lines.p75pos ?? null, PAL.laLiga, ICONO_LALIGA, 'P75 pos.', false],
    ['premier50', 'P50 Premier League', ctx.lines.premier50, PAL.premier, ICONO_PREMIER, 'P50', true], ['premier75', 'P75 Premier League', ctx.lines.premier75, PAL.premier, ICONO_PREMIER, 'P75', true],
    ...(nat ? [['natN', 'Natera · Normal', nat.normal, '#ECC94B', ICONO_NATERA, 'Normal', false], ['natG', 'Natera · Good', nat.good, '#9AE6B4', ICONO_NATERA, 'Good', false], ['natE', 'Natera · Excellent', nat.excellent, '#48BB78', ICONO_NATERA, 'Excellent', false]] : [])];
  const chosenSm = q.sm === undefined ? ['pa', 'p50', 'premier50'] : String(q.sm).split(',').filter((k) => k && k !== 'none');
  const baseOff = (b) => baseRows(b).length === 0;
  const refOff = (k) => REFS.find((r) => r[0] === k)[2] == null;
  const toggleSm = (k, on) => setQ({ sm: (on ? [...chosenSm, k] : chosenSm.filter((x) => x !== k)).join(',') || 'none' });
  const filas = [BASES[2], BASES[1], BASES[0]].filter(([b]) => chosenSm.includes(b) && !baseOff(b)).map(([b, n]) => { const rows = baseRows(b); return { base: b, etiqueta: b === 'pa' ? 'PA' : b === 'pb' ? 'PB' : etiquetaActual, base: b, rows, asym: sides.length === 2 && rows.length === 2 ? asymmetryPct(rows[0].value, rows[1].value) : null }; });
  const refsSel = REFS.filter(([k]) => chosenSm.includes(k) && !refOff(k)).map(([k, n, v, color, icon, txt, premier]) => ({ key: k, v, icon, color, txt, premier, dash: false, label: `${n}: ${nfv(v)} ${unit ?? ''}` }));
  const insuf = filas.some((f) => f.rows.some((r) => r.ev.n && !r.ev.sufficient));
  // Filtros en cuatro filas (13/11/2026): medidas del jugador, La Liga, Premier League y Natera. El orden y el reparto los decide `agruparFiltros`, compartido con el radar y el gráfico longitudinal.
  const filtros = [
    ...BASES.map(([b, n]) => ({ key: b, label: b === 'last' ? etiquetaActual : n, off: baseOff(b), why: baseOff(b) ? 'Sin sesiones válidas en el periodo.' : '' })),
    ...REFS.map(([k, n]) => ({ key: k, label: n, off: refOff(k), why: refOff(k) ? (k.startsWith('premier') ? 'Esta variable no figura en las tablas de la Premier League.' : k.endsWith('pos') && posJugador == null ? 'El jugador no tiene posición principal.' : `Sin muestra suficiente (mínimo ${minN} jugadores).`) : '' })),
  ];
  const escala = html`<section class="refs"><fieldset class="modes filas"><legend class="sec-titulo">Benchmark-Contextualized Positioning</legend>
      ${vars.length > 1 ? html`<${SelectorVariable} vars=${vars} value=${variable.id} onChange=${(v) => setQ({ v })} />` : null}
      ${agruparFiltros(filtros).map((fila, i) => html`<div class="ref-fila" key=${'f' + i}>${fila.map((o) => html`<label class="check" key=${o.key} title=${o.why}><input type="checkbox" disabled=${o.off} checked=${!o.off && chosenSm.includes(o.key)} onChange=${(e) => toggleSm(o.key, e.target.checked)} /> ${o.label}</label>`)}</div>`)}</fieldset>
    ${filas.length ? html`<${EscalaG4} filas=${filas} refs=${refsSel} unit=${unit} target=${sides.map((sd) => targets[sd]).filter(Boolean).filter((t, i, a) => a.findIndex((v) => v.value === t.value) === i)} />` : html`<p class="muted">Marca al menos un marcador del jugador (Resultado actual, Personal Best o Personal Average) para ver la escala.</p>`}
    ${insuf ? html`<p class="status warn">Muestra insuficiente para clasificar: no se dibuja la mediana ni se colorea (N inferior a ${minN}).</p>` : null}</section>`;
  return escala;
}
