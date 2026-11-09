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
import { ICONO_LALIGA, ICONO_PREMIER, ICONO_TARGET } from './iconos.js';

const nf = (n, d = 1) => (n === null || n === undefined ? '—' : Number(n).toLocaleString('es-ES', { maximumFractionDigits: d }));
const nfv = (n) => nf(n, 2);
const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const SIDE = { L: 'Izquierda', R: 'Derecha', S: 'Valor' };
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

function GraficoG2({ labels, datasets, unit, label, nombre }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!ref.current || !Chart) return undefined;
    let chart;
    try {
      chart = new Chart(ref.current, { type: 'bar', data: { labels, datasets }, options: { responsive: true, maintainAspectRatio: false, animation: false, plugins: { legend: { labels: { color: PAL.texto } }, tooltip: { callbacks: { afterLabel: (it) => it.dataset.info?.[it.dataIndex]?.split(' · ') ?? [] } } }, scales: { x: { ticks: { color: PAL.texto }, grid: { color: PAL.rejilla } }, y: { title: { display: !!unit, text: unit ?? '', color: PAL.texto }, ticks: { color: PAL.texto }, grid: { color: PAL.rejilla } } } } });
    } catch (e) { /* sin gráfico: la tabla de arriba tiene los mismos datos */ }
    return () => chart?.destroy();
  }, [JSON.stringify([labels, datasets])]);
  return html`<${Copiable} nombre=${nombre ?? 'percentiles-barras'}><div class="chart-box doc"><canvas ref=${ref} role="img" aria-label=${label}></canvas></div><//>`;
}

// G4 completo (aspecto de los informes del usuario: fondo oscuro, azul = izquierda, naranja = derecha): escala MIN–MAX de la referencia de La Liga con su
// mediana (icono de La Liga + «P50»), la mediana de la Premier League (icono + «P50») si existe, el target (bandera) y los marcadores del jugador con su valor;
// en tests por lado, un corchete con la asimetría D25. Si algo cae fuera del rango se amplía la escala y se avisa (provisional, D24).
function EscalaG4({ rows, unit, asym, premierP50, target, plRef }) {
  const vals = rows.flatMap((r) => [r.ev.min, r.ev.max, r.value, r.ev.p50].filter((v) => v != null)).concat([premierP50, ...(target ?? []).map((t) => t?.value)].filter((v) => v != null));
  const min = Math.min(...vals), max = Math.max(...vals), span = max - min || 1;
  const W = 640, L = 40, R = 40;
  const x = (v) => L + ((v - min) / span) * (W - L - R);
  const cx = rows.map((r) => x(r.value));
  if (rows.length === 2 && Math.abs(cx[0] - cx[1]) < 28) { const m = (cx[0] + cx[1]) / 2, d = cx[0] <= cx[1] ? 14 : -14; cx[0] = m - d; cx[1] = m + d; }
  const close = rows.length === 2 && Math.abs(cx[0] - cx[1]) < 40;
  const lo = L - 6, hi = W - R + 6; for (let k = 0; k < cx.length; k++) cx[k] = Math.min(hi, Math.max(lo, cx[k]));
  const out = rows.some((r) => r.ev.min != null && (r.value < r.ev.min || r.value > r.ev.max)) || (premierP50 != null && (premierP50 < Math.min(...rows.map((r) => r.ev.min ?? Infinity)) || premierP50 > Math.max(...rows.map((r) => r.ev.max ?? -Infinity))));
  const T = PAL.texto;
  // marcadores de mediana/target por encima de la línea; si dos quedan a menos de 64 px, el segundo sube un nivel
  const marks = [
    ...rows.filter((r) => r.ev.p50 != null && r.ev.sufficient).slice(0, 1).map((r) => ({ key: 'll', v: r.ev.p50, icon: ICONO_LALIGA, color: PAL.laLiga, p50: true, label: `La Liga, mediana (P50)${rows.length === 2 ? ' de ambas piernas' : ''}: ${nfv(r.ev.p50)} ${unit ?? ''}, N = ${r.ev.n}` })),
    ...(premierP50 != null ? [{ key: 'pl', v: premierP50, icon: ICONO_PREMIER, color: PAL.premier, p50: true, label: `Premier League, mediana (P50): ${nfv(premierP50)} ${unit ?? ''}` }] : []),
    ...(target ?? []).filter(Boolean).map((t, i) => ({ key: 'tg' + i, v: t.value, icon: ICONO_TARGET, color: PAL.target, p50: false, label: `Target: ${nfv(t.value)} ${unit ?? ''}` })),
  ].sort((a, b) => a.v - b.v);
  marks.forEach((m, i) => { const near = marks.slice(0, i).filter((o) => Math.abs(x(o.v) - x(m.v)) < 64).map((o) => o.level); let lv = 0; while (near.includes(lv)) lv++; m.level = lv; });
  const levels = Math.max(0, ...marks.map((m) => m.level));
  const y0 = 84 + levels * 36, Hs = y0 + 128;
  const marker = (m) => html`<g key=${m.key}><title>${m.label}</title>
    <line x1=${x(m.v)} x2=${x(m.v)} y1=${y0 - 24 - m.level * 36} y2=${y0} stroke=${m.color} stroke-width="2" ${m.p50 ? '' : 'stroke-dasharray="4 3"'} />
    <image href=${m.icon} x=${x(m.v) - 13} y=${y0 - 56 - m.level * 36} width="26" height="30" preserveAspectRatio="xMidYMid meet" />
    ${m.p50 ? html`<text x=${x(m.v) + 16} y=${y0 - 36 - m.level * 36} font-size="12" font-weight="700" fill=${m.color}>P50</text>` : null}</g>`;
  return html`<${Copiable} nombre="percentiles-escala"><div class="doc-panel"><svg viewBox=${`0 0 ${W} ${Hs}`} width="100%" role="img" style="display:block" aria-label=${`Escala de ${nfv(min)} a ${nfv(max)} ${unit ?? ''}: mediana de La Liga, mediana de la Premier League, target y valores del jugador`}>
    <rect width=${W} height=${Hs} fill=${PAL.fondo} />
    <line x1=${L} x2=${W - R} y1=${y0} y2=${y0} stroke=${T} stroke-opacity="0.5" stroke-width="3" />
    ${marks.map(marker)}
    ${rows.map((r, i) => html`<g key=${'p' + r.side}><title>${SIDE[r.side]}: ${nfv(r.value)} ${unit ?? ''}${r.info ? ` — ${r.info}` : ''}</title>
      <circle cx=${cx[i]} cy=${y0 + 28} r="11" fill=${colorLado(r.side)} />
      ${r.side === 'S' ? null : html`<text x=${cx[i]} y=${y0 + 32} text-anchor="middle" font-size="12" font-weight="700" fill=${PAL.fondo}>${r.side}</text>`}
      <text x=${cx[i] + (close ? (cx[i] === Math.min(...cx) ? 4 : -4) : 0)} y=${y0 + 56} text-anchor=${close ? (cx[i] === Math.min(...cx) ? 'end' : 'start') : 'middle'} font-size="12" fill=${T}>${nfv(r.value)}</text></g>`)}
    ${asym != null && rows.length === 2 ? html`<g><path d=${`M ${cx[0]} ${y0 + 72} v 6 H ${cx[1]} v -6`} fill="none" stroke=${T} stroke-opacity="0.6" /><text x=${Math.min(W - 90, Math.max(90, (cx[0] + cx[1]) / 2))} y=${y0 + 94} text-anchor="middle" font-size="12" fill=${T}>Asimetría ${asymText(asym)}</text></g>` : null}
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
export function PercentilesPanel({ player, test, variable, mine, q, setQ, filters, targets = {}, stats, current, refData, abs = null }) {
  if (!refData) return null;
  const { sessions: _s, positions, minN } = refData;
  const rp = q.rp ?? 'all';
  const positionId = rp === 'all' ? null : Number(rp);
  const sides = variable.sides === 'LR' ? ['L', 'R'] : ['S'];
  const ctx = refContext({ refData, test, variable, sides, filters, playerId: player.id, positionId: null, srcVar: abs?.variable ?? null });
  const basisShown = ['pa', 'last', 'pb'].includes(q.rb) ? q.rb : 'pa';
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
  const SD = { L: 'Izquierda', R: 'Derecha', S: 'Valor' };
  const shown = sides.map((sd) => (cell[basisShown + sd].value != null ? { side: sd, value: cell[basisShown + sd].value, ev: cell[basisShown + sd].ev, info: ctx.info(cell[basisShown + sd].value, basisShown).join(' · ') } : null)).filter(Boolean);
  const asym = sides.length === 2 && shown.length === 2 ? asymmetryPct(shown[0].value, shown[1].value) : null;
  const g2 = sides.filter((sd) => cell['last' + sd].value != null || cell['pa' + sd].value != null);
  const refOk = (b, sd) => cell[b + sd].ev?.sufficient && cell[b + sd].ev.p50 != null;
  const pbMissing = sides.map((sd) => stats?.[sd]?.pb).find((b) => b && !b.defined && b.reason);
  const nat = findNatera(test, variable); // referencia de Natera: tercera columna por lado en el mismo cuadro
  const nCols = nat ? 4 : 3;
  const tipSpan = (t, tip) => (tip ? html`<span title=${tip} aria-label=${`${t}. ${tip}`} tabindex="0">${t}</span>` : html`${t}`);
  return html`<section class="refs"><h4>Resultados y percentiles: La Liga y Premier League</h4>
    <div class="filters"><label>Referencia de La Liga <select value=${rp} onChange=${(e) => setQ({ rp: e.target.value })}><option value="all">Todas las posiciones</option>${positions.map((p) => html`<option key=${p.id} value=${p.id}>${p.name}</option>`)}</select></label></div>
    <div class="table-wrap"><table><caption>${variable.name}${unit ? ` (${unit})` : ''}${plRef ? ` · Premier League ${PREMIER_SEASON}` : ''}</caption>
      <thead><tr><th rowspan="2" scope="col">Medida</th>${sides.map((sd) => html`<th key=${sd} colspan=${nCols} scope="colgroup">${SD[sd]}</th>`)}</tr>
        <tr>${sides.flatMap((sd) => [html`<th key=${sd + 'v'} scope="col" class="num">Valor</th>`, html`<th key=${sd + 'l'} scope="col">Percentil La Liga</th>`, html`<th key=${sd + 'p'} scope="col">Premier League</th>`, ...(nat ? [html`<th key=${sd + 'n'} scope="col" title=${`Natera: Normal desde ${nf(nat.normal, 2)} ${nat.unit} · Good desde ${nf(nat.good, 2)} · Excellent desde ${nf(nat.excellent, 2)}`}>Natera (${nat.unit})</th>`] : [])])}</tr></thead>
      <tbody>${BASES.map(([b, name]) => html`<tr key=${b}><th scope="row">${name}</th>${sides.flatMap((sd) => { const c = cell[b + sd]; if (c.value == null) return [html`<td key=${sd + 'v'} class="num"><span class="muted" title=${c.tip ?? ''}>—</span></td>`, html`<td key=${sd + 'l'}>—</td>`, html`<td key=${sd + 'p'}>—</td>`, ...(nat ? [html`<td key=${sd + 'n'}>—</td>`] : [])];
        return [html`<td key=${sd + 'v'} class="num">${tipSpan(txt(c.value), c.tip)}</td>`,
          html`<td key=${sd + 'l'} title=${c.ev.sufficient ? `P50 de La Liga: ${nfv(c.ev.p50)}${u} · N = ${c.ev.n}` : ''}><${CeldaPercentil} ev=${c.ev} /></td>`,
          html`<td key=${sd + 'p'}>${c.pl?.placed ? html`<span class=${`badge band-${c.pl.band}`}>${c.pl.text}</span>` : plRef ? html`<span class="muted">sin ubicar</span>` : '—'}</td>`, ...(nat ? [html`<td key=${sd + 'n'}>${(() => { const k = classifyNatera(nat, c.value); return k ? html`<span class=${`badge band-${k.band}`}>${k.text}</span>` : '—'; })()}</td>`] : [])]; })}</tr>`)}</tbody></table></div>
    ${pbMissing ? html`<p class="muted">${pbMissing.reason}${/catálogo/.test(pbMissing.reason) ? html` <a href=${'#catalogo-test-' + variable.testId}>Abrir el test en el catálogo</a>.` : null}</p>` : null}
    <details class="notas"><summary>Notas y método de los percentiles</summary>
    ${nat ? html`<p class="muted">Natera (${nat.unit}): Normal desde ${nf(nat.normal, 2)} · Good desde ${nf(nat.good, 2)} · Excellent desde ${nf(nat.excellent, 2)}. Fuente: ${NATERA_SOURCE}. Los límites se aplican como intervalos continuos (la fuente publica rangos con huecos de redondeo). Por debajo de «Normal» la fuente no da etiqueta: se muestra en rojo por decisión del usuario. No se ha verificado si los umbrales son por lado o por jugador; se aplican a cada lado.</p>` : null}
    ${abs ? html`<p class="muted">Medida relativa (${unit}): los percentiles de La Liga se calculan sobre esta medida relativa.${plRef?.estimated ? html` Premier League, ESTIMADA: la Premier publica fuerza (N) y masa corporal (P5 72,0 · P25 76,6 · P50 81,8 · P75 88,2 · P95 97,1 kg) por separado, no la relación entre ambas. Cortes estimados (${unit}) P5/P25/P50/P75/P95 = ${plRef.cuts.map((c) => nf(c, 2)).join(' · ')}; rango posible entre dispersión mínima y máxima: ${plRef.range.lo.map((a, i) => `${nf(a, 2)}–${nf(plRef.range.hi[i], 2)}`).join(' · ')} (la mediana es la misma en ambos extremos).` : ''}</p>` : null}
    ${!plRef ? html`<p class="muted">Esta variable no figura en las tablas de la Premier League aportadas (${PREMIER_SEASON}): no tiene percentil de la Premier League.</p>`
      : html`<p class="muted">Premier League (${PREMIER_SEASON}, tabla «In Season»${plRef.unitConverted ? ', convertida a la unidad del catálogo' : ''}): se indica la zona entre los cortes publicados (P5, P25, P50, P75, P95), sin interpolar percentiles. P50 = ${nf(plRef.cuts[2], 3)}${u}. Los umbrales de la Premier no están validados como de rendimiento.</p>`}
    <p class="muted">Pasa el cursor sobre un valor o un percentil para ver su fecha, periodo, N y el P50 de La Liga. Método: percentil exacto por rango medio. El resultado actual y el Personal Average se comparan con el Personal Average de los demás jugadores (mismo valor, mismo percentil); el Personal Best con sus Personal Best. Referencia de La Liga: un valor por jugador y base (${posName}), sin sesiones excluidas, <strong>sin datos sintéticos y sin este jugador</strong>; mínimo ${minN} jugadores (cámbialo en Configuración).${sides.length === 2 ? ' Con dos lados, la referencia junta los valores izquierdo y derecho de todos los jugadores: hay un único P50 para ambas piernas.' : ''} El percentil de rendimiento tiene en cuenta la dirección de la variable; el color sigue las seis bandas de la guía.</p>
    </details>
    <fieldset class="modes"><legend>Marcadores de la escala</legend>${BASES.slice().reverse().map(([b, n]) => html`<label class="check" key=${b}><input type="radio" name="rb" checked=${basisShown === b} onChange=${() => setQ({ rb: b })} /> ${n}</label>`)}</fieldset>
    ${shown.length ? html`<${EscalaG4} rows=${shown} unit=${unit} asym=${asym} premierP50=${plRef ? plRef.cuts[2] : null} target=${sides.map((sd) => targets[sd]).filter(Boolean).filter((t, i, a) => a.findIndex((v) => v.value === t.value) === i)} />` : null}
    ${shown.some((r) => r.ev.n && !r.ev.sufficient) ? html`<p class="status warn">Muestra insuficiente para clasificar: no se dibuja la mediana ni se colorea (N inferior a ${minN}).</p>` : null}
    ${g2.length ? html`<h4>Resultado actual, Personal Average y referencias</h4><${GraficoG2} unit=${unit} label=${`Barras de ${variable.name}: resultado actual, Personal Average y medianas de La Liga y la Premier League`} labels=${g2.map((sd) => SD[sd])}
      datasets=${[{ label: 'Resultado actual', data: g2.map((sd) => cell['last' + sd].value), backgroundColor: PAL.gris1, info: g2.map((sd) => ctx.info(cell['last' + sd].value, 'last').join(' · ')) }, { label: 'Personal Average', data: g2.map((sd) => cell['pa' + sd].value), backgroundColor: PAL.gris3, info: g2.map((sd) => ctx.info(cell['pa' + sd].value, 'pa').join(' · ')) }, ...(g2.some((sd) => refOk('pa', sd)) ? [{ label: 'La Liga (mediana de Personal Average)', data: g2.map((sd) => (refOk('pa', sd) ? cell['pa' + sd].ev.p50 : null)), backgroundColor: PAL.laLiga }] : []), ...(plRef ? [{ label: 'Premier League (P50)', data: g2.map(() => plRef.cuts[2]), backgroundColor: PAL.premier }] : [])]} />` : null}
  </section>`;
}
