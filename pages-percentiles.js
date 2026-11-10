// pages-percentiles.js — fase 5c: percentiles frente a «La Liga», escala de referencia (G4 completo) y barras normativas (G2).
import './fuentes.js';
import { html, useRef, useEffect, Chart } from './libs.js';
import { useApp } from './context.js';
import { useLoad } from './componentes.js';
import { fmtDay } from './fechas.js';
import { getSetting } from './db.js';
import { expandRelative } from './relativos.js';
import { pairContext } from './isohold.js';
import { withReferenceWeights } from './relaciones.js';
import { PREMIER_SEASON, CUT_NAMES, findPremier, estimateRelative, placeAgainstPremier, isPerSide } from './premier.js';
import { findNatera, classifyNatera, NATERA_SOURCE } from './natera.js';
import { listPositions } from './posiciones.js';
import { asymmetryPct, asymText, isAsymVariable } from './catalogo.js';
import { BANDS, MIN_N_DEFAULT, buildReference, evaluate, playerValue, perfQuantile } from './percentiles.js';
import { PAL, colorLado } from './colores.js';
import { isRelative, relFactor } from './relativos.js';
import { Copiable } from './copiar.js';
import { ICONO_LALIGA, ICONO_PREMIER, ICONO_TARGET, ICONO_NATERA } from './iconos.js';

const nf = (n, d = 1) => (n === null || n === undefined ? '—' : Number(n).toLocaleString('es-ES', { maximumFractionDigits: d }));
const nfv = (n) => nf(n, 2);
const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const SIDE = { L: 'Left', R: 'Right', S: 'Valor' };
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
      ${f.asym != null && f.rows.length === 2 ? html`<g><path d=${`M ${f.cx[0]} ${yb + 72} v 6 H ${f.cx[1]} v -6`} fill="none" stroke=${T} stroke-opacity="0.6" /><text x=${Math.min(W - 90, Math.max(90, (f.cx[0] + f.cx[1]) / 2))} y=${yb + 94} text-anchor="middle" font-size="12" fill=${T}>Asimetría ${asymText(f.asym)}</text></g>` : null}</g></g>`; })}
    <text x=${L} y=${Hs - 6} text-anchor="start" font-size="11" fill=${T}>${nfv(min)} ${unit ?? ''}</text><text x=${W - R} y=${Hs - 6} text-anchor="end" font-size="11" fill=${T}>${nfv(max)} ${unit ?? ''}</text>
  </svg></div><//>${out ? html`<p class="muted">Algún valor queda fuera del rango de la referencia de La Liga: la escala se ha ampliado para mostrarlo.</p>` : null}`;
}

// Cuadro «Resultados y percentiles» dibujado como imagen (mismo aspecto que los gráficos: fondo oscuro, tipografía y colores del informe), así que se puede copiar o descargar en PNG.
// Es la misma información que la tabla accesible (oculta) que lleva debajo.
const BAND_HEX = [['#C53030', '#FFFFFF'], ['#ED8936', '#1A202C'], ['#FAF089', '#1A202C'], ['#ECC94B', '#1A202C'], ['#9AE6B4', '#1A202C'], ['#2F855A', '#FFFFFF']];
const bandHex = (key) => BAND_HEX[Math.max(0, BANDS.findIndex((b) => b.key === key))];
function TablaSvg({ titulo, sides, filas, nat, SD }) {
  const T = PAL.texto;
  const cw = { v: 84, l: 82, p: 116, n: nat ? 128 : 0 };
  const sw = cw.v + cw.l + cw.p + cw.n, X0 = 24, LAB = 128;
  const W = X0 + LAB + sides.length * sw + 24, rowH = 46, y1 = 64, y2 = 90, yRows = 104, H = yRows + filas.length * rowH + 14;
  const sx = (i) => X0 + LAB + i * sw;
  const badge = (cx, cy, txt, key, w) => { const [bg, fg] = bandHex(key); return html`<g><rect x=${cx - w / 2} y=${cy - 11} width=${w} height="22" rx="11" fill=${bg} /><text x=${cx} y=${cy + 4.5} text-anchor="middle" font-size="12.5" font-weight="700" fill=${fg}>${txt}</text></g>`; };
  const ancho = (t) => Math.max(34, t.length * 6.4 + 18);
  return html`<${Copiable} nombre="resultados-y-percentiles"><div class="doc-panel"><svg viewBox=${`0 0 ${W} ${H}`} width="100%" role="img" style="display:block" aria-label=${`Resultados y percentiles de ${titulo}`}>
    <rect width=${W} height=${H} fill=${PAL.fondo} />
    <text x=${X0} y="28" font-size="15" font-weight="700" fill=${T}>${titulo}</text>
    ${sides.map((sd, i) => html`<g key=${'h' + sd}><rect x=${sx(i) + 4} y=${y1 - 18} width=${sw - 12} height="24" rx="6" fill=${colorLado(sd)} fill-opacity="0.9" /><text x=${sx(i) + sw / 2 - 2} y=${y1 - 1} text-anchor="middle" font-size="14" font-weight="700" fill=${PAL.fondo}>${SD[sd].toUpperCase()}</text>
      ${[['Valor', cw.v / 2, 0], ['La Liga', cw.v + cw.l / 2, 0], ['Premier League', cw.v + cw.l + cw.p / 2, 0], ...(nat ? [['Natera', cw.v + cw.l + cw.p + cw.n / 2, 0]] : [])].map(([t, dx]) => html`<text key=${t} x=${sx(i) + dx} y=${y2} text-anchor="middle" font-size="12" font-weight="700" fill=${T} fill-opacity="0.75">${t.toUpperCase()}</text>`)}</g>`)}
    <line x1=${X0} x2=${W - 24} y1=${y2 + 8} y2=${y2 + 8} stroke=${T} stroke-opacity="0.35" />
    ${filas.map((f, r) => { const cy = yRows + r * rowH + rowH / 2 + 4; return html`<g key=${'r' + r}>
      ${r > 0 ? html`<line x1=${X0} x2=${W - 24} y1=${yRows + r * rowH - 4} y2=${yRows + r * rowH - 4} stroke=${T} stroke-opacity="0.15" />` : null}
      <text x=${X0} y=${cy + 4} font-size="14" font-weight="700" fill=${T}>${f.nombre}</text>
      ${sides.map((sd, i) => { const c = f.cells[sd]; const x0 = sx(i);
        if (!c) return html`<g key=${sd}><text x=${x0 + cw.v / 2} y=${cy + 4} text-anchor="middle" font-size="14" fill=${T} fill-opacity="0.5">—</text></g>`;
        return html`<g key=${sd}><title>${c.tip}</title>
          <text x=${x0 + cw.v / 2} y=${cy + 4} text-anchor="middle" font-size="14" fill=${T}>${c.valor}</text>
          ${c.ll.badge ? html`<g><circle cx=${x0 + cw.v + cw.l / 2} cy=${cy} r="14" fill=${bandHex(c.ll.key)[0]} /><text x=${x0 + cw.v + cw.l / 2} y=${cy + 4.5} text-anchor="middle" font-size="13" font-weight="700" fill=${bandHex(c.ll.key)[1]}>${c.ll.txt}</text></g>` : html`<text x=${x0 + cw.v + cw.l / 2} y=${cy + 4} text-anchor="middle" font-size="11" fill=${T} fill-opacity="0.6">${c.ll.txt}</text>`}
          ${c.pl ? badge(x0 + cw.v + cw.l + cw.p / 2, cy, c.pl.txt, c.pl.key, ancho(c.pl.txt)) : html`<text x=${x0 + cw.v + cw.l + cw.p / 2} y=${cy + 4} text-anchor="middle" font-size="11" fill=${T} fill-opacity="0.6">${c.plVacio}</text>`}
          ${nat ? (c.nat ? badge(x0 + cw.v + cw.l + cw.p + cw.n / 2, cy, c.nat.txt, c.nat.key, Math.min(cw.n - 8, ancho(c.nat.txt))) : html`<text x=${x0 + cw.v + cw.l + cw.p + cw.n / 2} y=${cy + 4} text-anchor="middle" font-size="12" fill=${T} fill-opacity="0.5">—</text>`) : null}</g>`; })}</g>`; })}
  </svg></div><//>`;
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
  const info = (value, basis = 'last') => {
    if (!Number.isFinite(value)) return [];
    const ev = evaluate(ent(basis, null), { playerId, value, direction: variable.direction, minN });
    const ll = !ev.sufficient ? ev.reason : ev.percentilePerf != null ? `${nf(ev.percentilePerf, 0)}` : `P${nf(ev.percentileStat, 0)} estadístico (sin color)`;
    const pl = plRef ? placeAgainstPremier(plRef, value) : null;
    return [`Percentil La Liga: ${ll}`, `Premier League: ${plRef ? (pl?.placed ? pl.text + (plRef.estimated ? ' (estimado)' : '') : 'sin ubicar') : 'sin referencia'}`];
  };
  return { entries: ent, plRef, lines, info, minN, histories, playersById };
}

const BASES = [['last', 'Resultado actual'], ['pb', 'Personal Best'], ['pa', 'Personal Average']];

// Un único cuadro por variable: filas Resultado actual / Personal Best / Personal Average; por lado (izquierda, derecha) el valor, el percentil de La Liga y la zona de la Premier League.
// Con dos lados, la referencia de La Liga es UNA sola (los valores de ambos lados de todos los jugadores juntos), así que hay un único P50.
export function PercentilesPanel({ player, test, variable, mine, q, setQ, filters, targets = {}, stats, current, refData, abs = null, parte = 'todo', posJugador = null }) {
  if (!refData) return null;
  const { sessions: _s, positions, minN } = refData;
  const rp = q.rp ?? 'all';
  const positionId = rp === 'all' ? null : Number(rp);
  const sides = variable.sides === 'LR' ? ['L', 'R'] : ['S'];
  const ctx = refContext({ refData, test, variable, sides, filters, playerId: player.id, positionId: null, srcVar: abs?.variable ?? null });
  const plRef = ctx.plRef; // en medida relativa es una estimación (estimateRelative)
  const unit = variable.unit;
  const u = unit ? ` ${unit}` : '';
  const asy = isAsymVariable(variable);
  const txt = (x) => (asy ? asymText(x, 2) : `${nfv(x)}${u}`);
  // valor propio por fila y lado (mismos valores que el gráfico) y detalle para el cursor
  const own = (basis, sd) => {
    if (basis === 'last') { const c = current?.[sd]; return c ? { value: c.value, tip: fmtDay(c.date) } : null; }
    if (basis === 'pb') { const b = stats?.[sd]?.pb; return b?.defined ? { value: b.value, tip: `${fmtDay(b.date)}${b.tied ? (b.sameDayTie ? ', empate el mismo día' : ', empate: se muestra la más reciente') : ''}` } : { value: null, tip: b?.reason ?? '' }; }
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
  const posName = positionId === null ? 'todas las posiciones' : positions.find((p) => p.id === positionId)?.name ?? 'posición eliminada';
  const SD = { L: 'Left', R: 'Right', S: 'Valor' };
  // Escala: bases del jugador (Resultado actual, Personal Best, Personal Average) y marcas de referencia, todas opcionales. Por defecto: Personal Average, P50 La Liga y P50 Premier League.
  const nat = findNatera(test, variable); // referencias de Natera (solo Iso-Push): tres marcas opcionales y una columna en el cuadro
  const diasActual = [...new Set(sides.map((sd) => current?.[sd]?.date).filter(Boolean))];
  const etiquetaActual = diasActual.length ? diasActual.map(fmtDay).join(' / ') : 'Resultado actual'; // la fecha del test, como en el cuadro
  const baseRows = (b) => sides.map((sd) => (cell[b + sd].value != null ? { side: sd, value: cell[b + sd].value, ev: cell[b + sd].ev, info: ctx.info(cell[b + sd].value, b).join(' · ') } : null)).filter(Boolean);
  const ctxPos = posJugador != null ? refContext({ refData, test, variable, sides, filters, playerId: player.id, positionId: posJugador, srcVar: abs?.variable ?? null }) : null;
  const posNom = positions.find((p) => p.id === posJugador)?.name ?? 'posición';
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
  const pbMissing = sides.map((sd) => stats?.[sd]?.pb).find((b) => b && !b.defined && b.reason);
  const nCols = nat ? 4 : 3;
  const filasTabla = [BASES[1], BASES[2], BASES[0]].map(([b, name]) => ({ nombre: b === 'last' ? etiquetaActual : name, cells: Object.fromEntries(sides.map((sd) => { const c = cell[b + sd]; if (c.value == null) return [sd, null];
    const llb = c.ev.sufficient && c.ev.percentileStat !== null; const bandKey = c.ev.band !== null && c.ev.band !== undefined ? BANDS[c.ev.band].key : null;
    const ll = llb && bandKey ? { badge: true, txt: nf(c.ev.percentilePerf, 0), key: bandKey } : llb ? { badge: false, txt: `P${nf(c.ev.percentileStat, 0)}` } : { badge: false, txt: 'sin muestra' };
    const k = nat ? classifyNatera(nat, c.value) : null;
    return [sd, { valor: txt(c.value), tip: `${SD[sd]} · ${name}${c.tip ? ' · ' + c.tip : ''}${c.ev.sufficient ? ` · P50 de La Liga: ${nfv(c.ev.p50)}${u} · N = ${c.ev.n}` : ''}`, ll,
      pl: c.pl?.placed ? { txt: c.pl.text, key: c.pl.band } : null, plVacio: plRef ? 'sin ubicar' : '—', nat: k ? { txt: k.text, key: k.band } : null }]; })) }));
  const tipSpan = (t, tip) => (tip ? html`<span title=${tip} aria-label=${`${t}. ${tip}`} tabindex="0">${t}</span>` : html`${t}`);
  const escala = html`<section class="refs"><fieldset class="modes"><legend class="sec-titulo">Benchmark-Contextualized Positioning</legend>
      ${[BASES[2], BASES[1], BASES[0]].map(([b, n]) => html`<label class="check" key=${b} title=${baseOff(b) ? 'Sin sesiones válidas en el periodo.' : ''}><input type="checkbox" disabled=${baseOff(b)} checked=${!baseOff(b) && chosenSm.includes(b)} onChange=${(e) => toggleSm(b, e.target.checked)} /> ${b === 'last' ? etiquetaActual : n}</label>`)}
      ${REFS.map(([k, n]) => html`<label class="check" key=${k} title=${refOff(k) ? (k.startsWith('premier') ? 'Esta variable no figura en las tablas de la Premier League.' : k.endsWith('pos') && posJugador == null ? 'El jugador no tiene posición principal.' : `Sin muestra suficiente (mínimo ${minN} jugadores).`) : ''}><input type="checkbox" disabled=${refOff(k)} checked=${!refOff(k) && chosenSm.includes(k)} onChange=${(e) => toggleSm(k, e.target.checked)} /> ${n}</label>`)}</fieldset>
    ${filas.length ? html`<${EscalaG4} filas=${filas} refs=${refsSel} unit=${unit} target=${sides.map((sd) => targets[sd]).filter(Boolean).filter((t, i, a) => a.findIndex((v) => v.value === t.value) === i)} />` : html`<p class="muted">Marca al menos un marcador del jugador (Resultado actual, Personal Best o Personal Average) para ver la escala.</p>`}
    ${insuf ? html`<p class="status warn">Muestra insuficiente para clasificar: no se dibuja la mediana ni se colorea (N inferior a ${minN}).</p>` : null}</section>`;
  if (parte === 'escala') return escala;
  const tabla = html`<section class="refs"><h4 class="sec-titulo">Normative Benchmarking</h4>
    <div class="filters"><label>Referencia de La Liga <select value=${rp} onChange=${(e) => setQ({ rp: e.target.value })}><option value="all">Todas las posiciones</option>${positions.map((p) => html`<option key=${p.id} value=${p.id}>${p.name}</option>`)}</select></label></div>
    <${TablaSvg} titulo=${`${variable.name}${unit && !variable.name.includes(`(${unit})`) ? ` (${unit})` : ""}`} sides=${sides} filas=${filasTabla} nat=${nat} SD=${SD} />
    <div class="sr"><div class="table-wrap"><table><caption>${variable.name}${unit && !variable.name.includes(`(${unit})`) ? ` (${unit})` : ''}</caption>
      <thead><tr><th rowspan="2" scope="col">Medida</th>${sides.map((sd) => html`<th key=${sd} colspan=${nCols} scope="colgroup">${SD[sd]}</th>`)}</tr>
        <tr>${sides.flatMap((sd) => [html`<th key=${sd + 'v'} scope="col" class="num">Valor</th>`, html`<th key=${sd + 'l'} scope="col">La Liga</th>`, html`<th key=${sd + 'p'} scope="col">Premier League</th>`, ...(nat ? [html`<th key=${sd + 'n'} scope="col" title=${`Natera: Normal desde ${nf(nat.normal, 2)} ${nat.unit} · Good desde ${nf(nat.good, 2)} · Excellent desde ${nf(nat.excellent, 2)}`}>Natera (${nat.unit})</th>`] : [])])}</tr></thead>
      <tbody>${[BASES[1], BASES[2], BASES[0]].map(([b, name]) => html`<tr key=${b}><th scope="row">${b === 'last' ? (() => { const days = [...new Set(sides.map((sd) => current?.[sd]?.date).filter(Boolean))]; return days.length ? days.map(fmtDay).join(' / ') : name; })() : name}</th>${sides.flatMap((sd) => { const c = cell[b + sd]; if (c.value == null) return [html`<td key=${sd + 'v'} class="num"><span class="muted" title=${c.tip ?? ''}>—</span></td>`, html`<td key=${sd + 'l'}>—</td>`, html`<td key=${sd + 'p'}>—</td>`, ...(nat ? [html`<td key=${sd + 'n'}>—</td>`] : [])];
        return [html`<td key=${sd + 'v'} class="num">${tipSpan(txt(c.value), c.tip)}</td>`,
          html`<td key=${sd + 'l'} title=${c.ev.sufficient ? `P50 de La Liga: ${nfv(c.ev.p50)}${u} · N = ${c.ev.n}` : ''}><${CeldaPercentil} ev=${c.ev} /></td>`,
          html`<td key=${sd + 'p'}>${c.pl?.placed ? html`<span class=${`badge band-${c.pl.band}`}>${c.pl.text}</span>` : plRef ? html`<span class="muted">sin ubicar</span>` : '—'}</td>`, ...(nat ? [html`<td key=${sd + 'n'}>${(() => { const k = classifyNatera(nat, c.value); return k ? html`<span class=${`badge band-${k.band}`}>${k.text}</span>` : '—'; })()}</td>`] : [])]; })}</tr>`)}</tbody></table></div></div>
    ${pbMissing ? html`<p class="muted">${pbMissing.reason}${/catálogo/.test(pbMissing.reason) ? html` <a href=${'#catalogo-test-' + variable.testId}>Abrir el test en el catálogo</a>.` : null}</p>` : null}
    <details class="notas"><summary>Notas y método de los percentiles</summary>
    ${nat ? html`<p class="muted">Natera (${nat.unit}): Normal desde ${nf(nat.normal, 2)} · Good desde ${nf(nat.good, 2)} · Excellent desde ${nf(nat.excellent, 2)}. Fuente: ${NATERA_SOURCE}. Los límites se aplican como intervalos continuos (la fuente publica rangos con huecos de redondeo). Por debajo de «Normal» la fuente no da etiqueta: se muestra en rojo por decisión del usuario. No se ha verificado si los umbrales son por lado o por jugador; se aplican a cada lado.</p>` : null}
    ${abs ? html`<p class="muted">Medida relativa (${unit}): los percentiles de La Liga se calculan sobre esta medida relativa.${plRef?.estimated ? html` Premier League, ESTIMADA: la Premier publica fuerza (N) y masa corporal (P5 72,0 · P25 76,6 · P50 81,8 · P75 88,2 · P95 97,1 kg) por separado, no la relación entre ambas. Cortes estimados (${unit}) P5/P25/P50/P75/P95 = ${plRef.cuts.map((c) => nf(c, 2)).join(' · ')}; rango posible entre dispersión mínima y máxima: ${plRef.range.lo.map((a, i) => `${nf(a, 2)}–${nf(plRef.range.hi[i], 2)}`).join(' · ')} (la mediana es la misma en ambos extremos).` : ''}</p>` : null}
    ${!plRef ? html`<p class="muted">Esta variable no figura en las tablas de la Premier League aportadas (${PREMIER_SEASON}): no tiene percentil de la Premier League.</p>`
      : html`<p class="muted">Premier League (${PREMIER_SEASON}, tabla «In Season»${plRef.unitConverted ? ', convertida a la unidad del catálogo' : ''}): se indica la zona entre los cortes publicados (P5, P25, P50, P75, P95), sin interpolar percentiles. P50 = ${nf(plRef.cuts[2], 3)}${u}. Los umbrales de la Premier no están validados como de rendimiento.</p>`}
    <p class="muted">Pasa el cursor sobre un valor o un percentil para ver su fecha, periodo, N y el P50 de La Liga. Método: percentil exacto por rango medio. El resultado actual y el Personal Average se comparan con el Personal Average de los demás jugadores (mismo valor, mismo percentil); el Personal Best con sus Personal Best. Referencia de La Liga: un valor por jugador y base (${posName}), sin sesiones excluidas, <strong>sin datos sintéticos y sin este jugador</strong>; mínimo ${minN} jugadores (cámbialo en Configuración).${sides.length === 2 ? ' Con dos lados, la referencia junta los valores izquierdo y derecho de todos los jugadores: hay un único P50 para ambas piernas.' : ''} El percentil de rendimiento tiene en cuenta la dirección de la variable; el color sigue las seis bandas de la guía.</p>
    </details>
  </section>`;
  return parte === 'tabla' ? tabla : html`${escala}${tabla}`;
}
