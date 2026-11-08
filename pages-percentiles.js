// pages-percentiles.js — fase 5c: percentiles frente a «La Liga», escala de referencia (G4 completo) y barras normativas (G2).
import { html, useRef, useEffect, Chart } from './libs.js';
import { useApp } from './context.js';
import { useLoad } from './componentes.js';
import { fmtDay } from './fechas.js';
import { getSetting } from './db.js';
import { expandRelative } from './relativos.js';
import { pairContext } from './isohold.js';
import { withReferenceWeights } from './relaciones.js';
import { PREMIER_SEASON, CUT_NAMES, findPremier, placeAgainstPremier, isPerSide } from './premier.js';
import { findNatera, classifyNatera, NATERA_SOURCE } from './natera.js';
import { listPositions } from './posiciones.js';
import { asymmetryPct, asymText, isAsymVariable } from './catalogo.js';
import { BANDS, MIN_N_DEFAULT, buildReference, evaluate, playerValue } from './percentiles.js';

const nf = (n, d = 1) => (n === null || n === undefined ? '—' : Number(n).toLocaleString('es-ES', { maximumFractionDigits: d }));
const nfv = (n) => nf(n, 2);
const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const SIDE = { L: 'Izquierda', R: 'Derecha', S: 'Valor' };
const BASIS = { pa: 'Personal Average', last: 'Última sesión válida' };

export function Banda({ ev }) {
  if (!ev || ev.band === null) return null;
  const b = BANDS[ev.band];
  return html`<span class=${'band band-' + b.key} title=${`${b.name} (P${b.range})`}>${nf(ev.percentilePerf, 0)} · ${b.name}</span>`;
}

// Resultado de un percentil para una celda: número siempre visible (el color nunca es el único canal).
export function CeldaPercentil({ ev }) {
  if (!ev) return '—';
  if (!ev.sufficient || ev.percentileStat === null) return html`<span class="muted">${ev.reason}</span>`;
  return html`<span>${ev.band !== null ? html`<${Banda} ev=${ev} />` : html`<span class="muted" title=${ev.reason}>P${nf(ev.percentileStat, 0)} estadístico (sin color)</span>`}</span>`;
}

function GraficoG2({ labels, datasets, unit, label }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!ref.current || !Chart) return undefined;
    const c = { text: css('--text'), muted: css('--muted'), line: css('--line') };
    let chart;
    try {
      chart = new Chart(ref.current, { type: 'bar', data: { labels, datasets }, options: { responsive: true, maintainAspectRatio: false, animation: false, plugins: { legend: { labels: { color: c.text } } }, scales: { x: { ticks: { color: c.muted }, grid: { color: c.line } }, y: { title: { display: !!unit, text: unit ?? '', color: c.muted }, ticks: { color: c.muted }, grid: { color: c.line } } } } });
    } catch (e) { /* sin gráfico: la tabla de arriba tiene los mismos datos */ }
    return () => chart?.destroy();
  }, [JSON.stringify([labels, datasets, document.documentElement.className])]);
  return html`<div class="chart-box"><canvas ref=${ref} role="img" aria-label=${label}></canvas></div>`;
}

// G4 completo: escala MIN–MAX de la referencia; mediana (P50) por encima de la línea; marcadores del jugador por debajo (L azul, R naranja, blanco sin lado) con su valor
// y, en tests por lado, un corchete con la asimetría D25. Si el valor cae fuera del rango se amplía la escala y se avisa (provisional, D24).
function EscalaG4({ rows, unit, asym }) {
  const vals = rows.flatMap((r) => [r.ev.min, r.ev.max, r.value, r.ev.p50].filter((v) => v != null));
  const min = Math.min(...vals), max = Math.max(...vals), span = max - min || 1;
  const W = 640, L = 24, R = 24, y0 = 62;
  const x = (v) => L + ((v - min) / span) * (W - L - R);
  // posición de los marcadores: si L y R quedan a menos de 28 px se separan (solo visual; el valor escrito es el real)
  const cx = rows.map((r) => x(r.value));
  if (rows.length === 2 && Math.abs(cx[0] - cx[1]) < 28) { const m = (cx[0] + cx[1]) / 2, d = cx[0] <= cx[1] ? 14 : -14; cx[0] = m - d; cx[1] = m + d; }
  const close = rows.length === 2 && Math.abs(cx[0] - cx[1]) < 40;
  const lo = L - 6, hi = W - R + 6; for (let k = 0; k < cx.length; k++) cx[k] = Math.min(hi, Math.max(lo, cx[k]));
  const out = rows.some((r) => r.ev.min != null && (r.value < r.ev.min || r.value > r.ev.max));
  return html`<div><svg class="scale" viewBox=${`0 0 ${W} 172`} width="100%" role="img" aria-label=${`Escala de ${nfv(min)} a ${nfv(max)} ${unit ?? ''}: mediana de La Liga y valores del jugador`}>
    <line x1=${L} x2=${W - R} y1=${y0} y2=${y0} class="axis" stroke-width="3" />
    ${rows.map((r, i) => (r.ev.p50 == null || !r.ev.sufficient ? null : html`<g key=${'m' + r.side}><title>La Liga, mediana (P50): ${nfv(r.ev.p50)} ${unit ?? ''}, N = ${r.ev.n}</title>
      <line x1=${x(r.ev.p50)} x2=${x(r.ev.p50)} y1=${y0 - 22} y2=${y0} stroke="var(--text)" stroke-width="2" />
      <text x=${x(r.ev.p50)} y=${y0 - 28 - i * 15} text-anchor="middle">P50 ${r.side === 'S' ? '' : SIDE[r.side].charAt(0)} ${nfv(r.ev.p50)}</text></g>`))}
    ${rows.map((r, i) => html`<g key=${'p' + r.side}><title>${SIDE[r.side]}: ${nfv(r.value)} ${unit ?? ''}</title>
      <circle cx=${cx[i]} cy=${y0 + 24} r="10" fill=${r.side === 'L' ? 'var(--side-l)' : r.side === 'R' ? 'var(--side-r)' : 'var(--surface)'} stroke=${r.side === 'S' ? 'var(--text)' : 'none'} stroke-width="1.5" />
      ${r.side === 'S' ? null : html`<text x=${cx[i]} y=${y0 + 28} text-anchor="middle" style="fill:var(--side-text);font-size:11px;font-weight:700">${r.side}</text>`}
      <text x=${cx[i] + (close ? (cx[i] === Math.min(...cx) ? 4 : -4) : 0)} y=${y0 + 50} text-anchor=${close ? (cx[i] === Math.min(...cx) ? "end" : "start") : "middle"}>${nfv(r.value)}</text></g>`)}
    ${asym != null && rows.length === 2 ? html`<g><path d=${`M ${cx[0]} ${y0 + 66} v 6 H ${cx[1]} v -6`} fill="none" stroke="var(--muted)" /><text x=${Math.min(W - 90, Math.max(90, (cx[0] + cx[1]) / 2))} y=${y0 + 86} text-anchor="middle">Asimetría ${asymText(asym)}</text></g>` : null}
    <text x=${L} y="168" text-anchor="start">${nfv(min)} ${unit ?? ''}</text><text x=${W - R} y="168" text-anchor="end">${nfv(max)} ${unit ?? ''}</text>
  </svg>${out ? html`<p class="muted">El valor del jugador queda fuera del rango de la referencia: la escala se ha ampliado para mostrarlo.</p>` : null}</div>`;
}

// Clasificación bibliográfica de Natera para el Iso-Push relativo: etiqueta siempre en texto + número; color de banda solo como refuerzo.
function NateraBloque({ test, variable, shown }) {
  const ref = findNatera(test, variable);
  if (!ref) return null;
  return html`<h4>Clasificación de Natera (Iso-Push, ${ref.unit})</h4>
    <div class="table-wrap"><table><caption>Umbrales: Normal desde ${nf(ref.normal, 2)} ${ref.unit} · Good desde ${nf(ref.good, 2)} · Excellent desde ${nf(ref.excellent, 2)}</caption>
      <thead><tr><th>Lado</th><th class="num">Valor (${ref.unit})</th><th>Clase</th></tr></thead>
      <tbody>${shown.map((r) => { const c = classifyNatera(ref, r.value); return html`<tr key=${r.side}><th scope="row">${SIDE[r.side]}</th><td class="num">${nf(r.value, 2)}</td><td><span class=${c.band ? `badge band-${c.band}` : 'badge'}>${c.text}</span></td></tr>`; })}</tbody></table></div>
    <p class="muted">Fuente: ${NATERA_SOURCE}. Los límites se aplican como intervalos continuos (la fuente publica rangos con huecos de redondeo). Por debajo de «Normal» la fuente no da etiqueta: se muestra en rojo por decisión del usuario. No se ha verificado si los umbrales son por lado o por jugador; se aplican a cada lado. Los demás colores replican los de la fuente (amarillo, verde claro, verde).</p>`;
}

// Referencia de la Premier League (in-season 2025-26): cortes P5–P95 y zona del valor. Sin color (D14b abierta); sin interpolar percentiles.
function PremierBloque({ test, variable, shown, unit }) {
  const ref = findPremier(test, variable);
  if (!ref) return html`<h4>Premier League</h4><p class="muted">Esta variable no figura en las tablas de la Premier League aportadas (${PREMIER_SEASON}): no tiene percentil de la Premier League.</p>`;
  return html`<h4>Premier League (${PREMIER_SEASON})</h4>
    <div class="table-wrap"><table><caption>Cortes de la Premier para ${variable.name}${unit ? ` (${unit})` : ''}: ${ref.metric}${ref.unitConverted ? ' · convertido a la unidad del catálogo' : ''}</caption>
      <thead><tr><th>Lado</th><th class="num">Valor</th>${CUT_NAMES.map((c) => html`<th key=${c} class="num">${c}</th>`)}<th>Ubicación</th></tr></thead>
      <tbody>${shown.map((r) => { const pl = placeAgainstPremier(ref, r.value); return html`<tr key=${r.side}><th scope="row">${SIDE[r.side]}</th><td class="num">${isAsymVariable(variable) ? asymText(r.value, 2) : nfv(r.value)}</td>${ref.cuts.map((c, i) => html`<td key=${i} class="num">${nf(c, 3)}</td>`)}<td>${pl?.placed ? html`<span class=${`badge band-${pl.band}`}>${pl.text}</span>` : html`<span class="muted">sin ubicar</span>`}</td></tr>`; })}</tbody></table></div>
    ${shown.some((r) => placeAgainstPremier(ref, r.value)?.placed === false) ? html`<p class="status warn">${placeAgainstPremier(ref, shown[0].value).reason}</p>` : null}
    <p class="muted">Cortes de la tabla «In Season» (no pre-season), en el orden en que los publica la fuente. Solo se indica la zona entre cortes: no se calcula un percentil intermedio. Color: cada una de las seis zonas lleva la banda de su orden (rojo = más allá del P5 … verde = P95 o más); los umbrales de la Premier (5/25/50/75/95) no son los de La Liga (10/35/50/65/90), y el color indica posición en la muestra de la Premier, no un umbral clínico ni de riesgo.${ref.tests.length > 1 ? ' La tabla no indica la altura de caída: se aplica a 30 y 45 cm.' : ''}${variable.sides === 'LR' ? (isPerSide(ref) ? ' Referencia por lado (confirmado por el usuario).' : ' No se ha verificado si la referencia es por lado o por jugador.') : ''}</p>`;
}

export function PercentilesPanel({ player, test, variable, mine, q, setQ, filters }) {
  const { db, version } = useApp();
  const { data } = useLoad(async () => {
    const [raw, players, records, positions, minN, variables, anthropometry] = await Promise.all([db.sessions.where('testId').equals(test.id).toArray(), db.players.toArray(), db.playerPositions.toArray(), listPositions(db), getSetting(db, 'percentileMinN'), db.variables.toArray(), db.anthropometry.toArray()]);
    const sessions = expandRelative(variables, test.id, raw, withReferenceWeights(anthropometry, players), await pairContext(db, await db.tests.toArray(), test)).sessions;
    return { sessions, players, records, positions, minN: Number.isInteger(minN) && minN >= 1 ? minN : MIN_N_DEFAULT };
  }, [db, test.id, version]);
  if (!data) return null;
  const { sessions, positions, minN } = data;
  const playersById = Object.fromEntries(data.players.map((p) => [p.id, p]));
  const histories = {}; for (const r of data.records) (histories[r.playerId] ??= []).push(r);
  const rp = q.rp ?? 'all';
  const positionId = rp === 'all' ? null : Number(rp);
  const sides = variable.sides === 'LR' ? ['L', 'R'] : ['S'];
  const basisShown = q.rb === 'last' ? 'last' : 'pa';
  const calc = {}; // calc[basis][side] = { mine, ev }
  for (const basis of ['pa', 'last']) {
    calc[basis] = {};
    for (const side of sides) {
      const v = playerValue(mine, variable, side, { basis, positionId, histories, playerId: player.id, from: filters.from, to: filters.to, protocolId: filters.protocolId });
      if (!v) { calc[basis][side] = null; continue; }
      const entries = buildReference({ sessions, variable, side, players: playersById, histories, basis, positionId, from: filters.from, to: filters.to, protocolId: filters.protocolId });
      calc[basis][side] = { mine: v, ev: evaluate(entries, { playerId: player.id, value: v.value, direction: variable.direction, minN }) };
    }
  }
  const any = ['pa', 'last'].some((b) => sides.some((s) => calc[b][s]));
  if (!any) return html`<p class="muted">Sin sesiones válidas para calcular percentiles en este periodo.</p>`;
  const posName = positionId === null ? 'todas las posiciones' : positions.find((p) => p.id === positionId)?.name ?? 'posición eliminada';
  const unit = variable.unit;
  const shown = sides.map((s) => (calc[basisShown][s] ? { side: s, value: calc[basisShown][s].mine.value, ev: calc[basisShown][s].ev } : null)).filter(Boolean);
  const asym = sides.length === 2 && shown.length === 2 ? asymmetryPct(shown[0].value, shown[1].value) : null;
  const g2 = sides.filter((s) => calc.last[s] || calc.pa[s]);
  const refOk = (b, s) => calc[b][s]?.ev.sufficient && calc[b][s].ev.p50 != null;
  return html`<section class="refs"><h4>Percentiles frente a «La Liga» (base de datos propia)</h4>
    <div class="filters"><label>Referencia <select value=${rp} onChange=${(e) => setQ({ rp: e.target.value })}><option value="all">Todas las posiciones</option>${positions.map((p) => html`<option key=${p.id} value=${p.id}>${p.name}</option>`)}</select></label></div>
    <div class="table-wrap"><table><caption>Percentiles de ${variable.name}${unit ? ` (${unit})` : ''}</caption>
      <thead><tr><th>Lado</th><th>Base</th><th class="num">Valor</th><th>Percentil de rendimiento</th><th class="num">Percentil estadístico</th><th class="num">N</th><th class="num">P50 de La Liga</th><th>Periodo del valor</th></tr></thead>
      <tbody>${sides.flatMap((s) => ['pa', 'last'].map((b) => { const c = calc[b][s]; if (!c) return null; return html`<tr key=${s + b}>
        <th scope="row">${SIDE[s]}</th><td>${BASIS[b]}</td><td class="num">${isAsymVariable(variable) ? asymText(c.mine.value, 2) : html`${nfv(c.mine.value)}${unit ? ` ${unit}` : ''}`}</td>
        <td><${CeldaPercentil} ev=${c.ev} /></td><td class="num">${c.ev.percentileStat === null ? '—' : nf(c.ev.percentileStat, 1)}</td><td class="num">${c.ev.n}</td><td class="num">${c.ev.sufficient ? nfv(c.ev.p50) : '—'}</td>
        <td>${b === 'last' ? fmtDay(c.mine.date) : `${fmtDay(c.mine.from)} a ${fmtDay(c.mine.date)} · ${c.mine.sessions} ses.${c.mine.reps != null ? `, ${c.mine.reps} rep.` : ''}`}</td></tr>`; }))}</tbody></table></div>
    <p class="muted">Método: percentil exacto por rango medio (% de valores menores + la mitad de los iguales). Referencia: un valor por jugador (${basisShown === 'pa' ? 'su Personal Average' : 'el Average de su última sesión válida'}), ${posName}, sin sesiones excluidas, <strong>sin datos sintéticos y sin este jugador</strong>; mínimo ${minN} jugadores (cámbialo en Configuración). El percentil de rendimiento tiene en cuenta la dirección de la variable; el color sigue las seis bandas de la guía.</p>
    <${NateraBloque} test=${test} variable=${variable} shown=${shown} />
    <${PremierBloque} test=${test} variable=${variable} shown=${shown} unit=${unit} />
    <fieldset class="modes"><legend>Marcadores de la escala</legend>${['pa', 'last'].map((b) => html`<label class="check" key=${b}><input type="radio" name="rb" checked=${basisShown === b} onChange=${() => setQ({ rb: b })} /> ${BASIS[b]}</label>`)}</fieldset>
    ${shown.length ? html`<${EscalaG4} rows=${shown} unit=${unit} asym=${asym} />` : null}
    ${shown.some((r) => r.ev.n && !r.ev.sufficient) ? html`<p class="status warn">Muestra insuficiente para clasificar: no se dibuja la mediana ni se colorea (N inferior a ${minN}).</p>` : null}
    ${g2.length ? html`<h4>Valor de la última sesión, Personal Average y referencia</h4><${GraficoG2} unit=${unit} label=${`Barras de ${variable.name}: última sesión, Personal Average y mediana de La Liga`} labels=${g2.map((s) => SIDE[s])}
      datasets=${[{ label: 'Última sesión válida', data: g2.map((s) => calc.last[s]?.mine.value ?? null), backgroundColor: css('--accent') || '#2b6cb0' }, { label: 'Personal Average', data: g2.map((s) => calc.pa[s]?.mine.value ?? null), backgroundColor: css('--warn') || '#b7791f' }, ...(g2.some((s) => refOk('pa', s)) ? [{ label: 'La Liga (mediana de Personal Average)', data: g2.map((s) => (refOk('pa', s) ? calc.pa[s].ev.p50 : null)), backgroundColor: css('--muted') || '#718096' }] : [])]} />` : null}
  </section>`;
}
