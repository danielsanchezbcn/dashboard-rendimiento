// pages-normativo.js — «Normative Benchmarking»: UN SOLO cuadro por test (sustituye a la antigua tabla «todas las variables» y al cuadro por variable). Una columna por variable
// (con dos piernas, L a la izquierda y R a la derecha, cada una con su propio percentil) y, para la base elegida (Personal Average · Personal Best · Actual), las filas:
//   Valor (% variación) · Valor (percentil La Liga) · Valor (percentil Premier League) · Valor (Natera, solo Iso-Push) · Asimetría · Asimetría (percentil La Liga).
// Todos los percentiles salen de `refContext(...).evalValor`, la misma función que usan la escala y los cursores de los gráficos: un valor y una base dan el mismo percentil en todas partes.
// Pulsar el nombre de una variable la selecciona: el gráfico longitudinal y el resto de análisis pasan a ser de esa variable.
import { html, useState, useEffect, useRef } from './libs.js';
import { orderVars, isViewable, hasData, isRelative } from './relativos.js';
import { isIsoDerived, LOAD_VARIABLE_NAMES } from './isohold.js';
import { isAsymVariable, asymmetryPct, asimetriaLR, asymText, asymSideLetter, esGrados, usaPanelColumnas } from './catalogo.js';
import { valorBase, valorPrevio, variacionPct, personalBestFor } from './evolucion.js';
import { refContext, Banda } from './pages-percentiles.js';
import { evaluate, buildReference } from './percentiles.js';
import { placeAgainstPremier, PREMIER_SEASON } from './premier.js';
import { findNatera, classifyNatera, NATERA_SOURCE } from './natera.js';
import { fmtDay } from './fechas.js';
import { AsimTexto, asimClase } from './asim-ui.js';
import { Desplegable } from './componentes.js';
import { dn } from './nombres.js';
import { BotonesImagen } from './copiar.js';
import { playerLabel } from './jugadores.js';

const nf = (n, d = 2) => (n === null || n === undefined || !Number.isFinite(n) ? '—' : Number(n).toLocaleString('es-ES', { maximumFractionDigits: d }));
const BASES = [['pa', 'Personal Average'], ['pb', 'Personal Best'], ['last', 'Latest']];

// «+3,1 %» / «−2,0 %» (el signo solo si el valor redondeado no es 0). null si no hay variación.
export function fmtVar(p) {
  if (p === null || p === undefined || !Number.isFinite(p)) return null;
  const r = Math.round(Math.abs(p) * 10) / 10;
  return `${r > 0 ? (p > 0 ? '+' : '−') : ''}${nf(r, 1)} %`;
}

// Reparte las columnas en bloques que caben en pantalla: cada bloque suma como máximo `presupuesto` subcolumnas (una variable con dos piernas ocupa 2, una de un solo valor ocupa 1).
// El orden se conserva (las variables siguen consecutivas); un bloque nunca queda vacío.
export function trocear(cols, presupuesto) {
  const out = []; let cur = [], suma = 0;
  for (const c of cols) {
    const w = c.span ?? 1;
    if (cur.length && suma + w > presupuesto) { out.push(cur); cur = []; suma = 0; }
    cur.push(c); suma += w;
  }
  if (cur.length) out.push(cur);
  return out;
}
// Subcolumnas que caben según el ancho de la ventana (menú lateral, márgenes y columna de rótulos descontados; ≥ 80 px por subcolumna).
export const presupuestoAncho = (anchoVentana) => Math.max(6, Math.min(14, Math.floor((anchoVentana - 460) / 80)));

function celdaPercentil(ev) {
  if (!ev) return html`<span class="muted">—</span>`;
  if (!ev.sufficient || ev.percentileStat === null) return html`<span class="muted" title=${`Insufficient sample: ${ev.n ?? 0} player(s), minimum ${ev.minN}.`}>${'n<' + ev.minN}</span>`;
  return ev.band !== null ? html`<${Banda} ev=${ev} />` : html`<span class="muted" title="Statistical percentile, without performance colour.">P${nf(ev.percentileStat, 0)}</span>`;
}

// Iso-Hold y RM: orden de columnas pedido por el usuario (11/11/2026) — MVIC iso-push, carga externa, %PIMA y %SW/%BW. En el resto de tests no cambia nada.
const ORDEN_ISO = (v) => {
  const op = isIsoDerived(v) ? v.formula.op : null;
  if (op === 'ISO_MVIC') return 0;
  if (!op && LOAD_VARIABLE_NAMES.some((n) => n.toLowerCase() === String(v.name ?? '').trim().toLowerCase())) return 1;
  if (op === 'ISO_PIMA') return 2;
  if (op === 'ISO_LOAD_SW' || op === 'ISO_LOAD_BW') return 3;
  return op === 'RM_EST' ? 4 : 5;
};
export const ordenIsoHold = (vars) => (vars.some(isIsoDerived) ? vars.map((v, i) => [v, i]).sort((a, b) => ORDEN_ISO(a[0]) - ORDEN_ISO(b[0]) || a[1] - b[1]).map(([v]) => v) : vars);

export function NormativeBenchmarking({ player, test, catalog, sessions, refData, q, setQ, selectedId, abs = null }) {
  const refTabla = useRef(null);
  const [ancho, setAncho] = useState(typeof window === 'undefined' ? 1440 : window.innerWidth);
  useEffect(() => { const h = () => setAncho(window.innerWidth); window.addEventListener('resize', h); return () => window.removeEventListener('resize', h); }, []);
  if (!refData) return null;
  const { positions, minN } = refData;
  const from = q.from || null, to = q.to || null;
  const proto = q.p ?? 'all';
  const f = { from, to, protocolId: proto === 'all' ? undefined : proto === 'none' ? null : Number(proto) };
  const rp = q.rp ?? 'all';
  const positionId = rp === 'all' ? null : Number(rp);
  const visibles = orderVars(catalog.variables.filter((v) => v.testId === test.id && isViewable(v) && hasData(v, sessions)));
  const normales = ordenIsoHold(visibles.filter((v) => !isAsymVariable(v)));
  const sel = visibles.find((v) => v.id === selectedId) ?? null;
  // Todas las variables en columnas (por defecto) o, si el test lo tiene desactivado en el Catálogo, solo la variable seleccionada. Una variable de asimetría de VALD solo aparece si es la seleccionada.
  const vars = usaPanelColumnas(test) ? [...normales, ...(sel && isAsymVariable(sel) ? [sel] : [])] : [sel ?? normales[0]].filter(Boolean);
  if (!vars.length) return null;
  const puedePB = (v) => !!v.pbCriterion || v.direction === 'higher' || v.direction === 'lower';
  const bases = vars.some(puedePB) ? BASES : BASES.filter(([k]) => k !== 'pb'); // sin criterio ni dirección en ninguna variable no hay «mejor»: sin Personal Best
  const base = bases.some(([k]) => k === q.pn) ? q.pn : 'pa';
  const playersById = Object.fromEntries(refData.players.map((p) => [p.id, p]));
  const histories = {}; for (const r of refData.records) (histories[r.playerId] ??= []).push(r);
  // Asimetría absoluta de cada jugador con ambos lados (misma base): cada medida se compara solo consigo misma.
  const asymEntries = (v) => {
    const side = (sd) => new Map(buildReference({ sessions: refData.sessions, variable: v, side: sd, players: playersById, histories, basis: base === 'last' ? 'pa' : base, positionId, from, to, protocolId: f.protocolId }).map((e) => [e.playerId, e.value]));
    const L = side('L'), R = side('R');
    return [...L].filter(([id]) => R.has(id)).map(([playerId, l]) => ({ playerId, value: Math.abs(asymmetryPct(l, R.get(playerId))) })).filter((e) => Number.isFinite(e.value));
  };
  const cols = vars.map((v) => {
    const sides = v.sides === 'LR' ? ['L', 'R'] : ['S'];
    const srcVar = isRelative(v) ? catalog.variables.find((x) => x.id === v.formula.operands[0]) ?? null : null;
    const ctx = refContext({ refData, test, variable: v, sides, filters: f, playerId: player.id, positionId, srcVar });
    const nat = findNatera(test, v);
    const lado = {};
    for (const sd of sides) {
      const x = valorBase(sessions, v, sd, base, f);
      const act = valorBase(sessions, v, sd, 'last', f);
      const prev = valorPrevio(sessions, v, sd, f);
      // «Actual» se compara con la sesión previa; con Personal Average / Personal Best, el resultado de la última sesión se compara con ese valor.
      const vari = act ? variacionPct(act.value, base === 'last' ? prev?.value : x?.value) : null;
      const pbReason = base === 'pb' && !x && act ? personalBestFor(sessions, v, sd, f).reason ?? null : null;
      lado[sd] = { x, act, prev, vari, pbReason, ev: x ? ctx.evalValor(x.value, base, positionId) : null, pl: x && ctx.plRef ? placeAgainstPremier(ctx.plRef, x.value) : null, nat: nat && x ? classifyNatera(nat, x.value) : null };
    }
    const L = lado.L?.x, R = lado.R?.x;
    const asim = L && R ? asimetriaLR(v, L.value, R.value) : null;
    const evAsim = Number.isFinite(asim) && !esGrados(v) ? evaluate(asymEntries(v), { playerId: player.id, value: Math.abs(asim), direction: 'lower', minN }) : null;
    return { v, sides, span: sides.length, lado, asim, evAsim, ctx, nat, hayPl: !!ctx.plRef, est: !!ctx.plRef?.estimated, asy: isAsymVariable(v) };
  });
  const tienePl = cols.some((c) => c.hayPl), tieneNat = cols.some((c) => c.nat), tieneLR = cols.some((c) => c.sides.length === 2);
  const tieneEvAsim = cols.some((c) => c.evAsim);
  const fechas = (k) => cols.flatMap((c) => Object.values(c.lado).map((l) => l.x?.[k]).filter(Boolean));
  const lastDate = cols.flatMap((c) => Object.values(c.lado).map((l) => l.act?.date).filter(Boolean)).sort().at(-1) ?? null;
  const paFrom = fechas('from').sort()[0] ?? null, paTo = fechas('date').sort().at(-1) ?? null;
  const crit = vars.find((v) => v.pbCriterion)?.pbCriterion ?? null;
  const critCorto = crit ? (/\bRSI\b/i.test(crit.name) ? 'RSI' : crit.name) : '';
  const etq = (k, n) => {
    if (k !== base) return k === 'pb' && crit ? `Personal Best (best ${critCorto} session)` : n;
    if (k === 'last') return `Latest${lastDate ? ` (${fmtDay(lastDate)})` : ''}`;
    if (k === 'pb') return crit ? `Personal Best (best ${critCorto} session)` : 'Personal Best';
    return `Personal Average${paFrom && paTo ? (paFrom === paTo ? ` (${fmtDay(paTo)})` : ` (${fmtDay(paFrom)} – ${fmtDay(paTo)})`) : ''}`;
  };
  const pick = (id) => { setQ({ v: id }); setTimeout(() => document.getElementById('detalle-variable')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 250); };
  const tipVal = (c, sd) => { const x = c.lado[sd]?.x; return x ? `${sd === 'S' ? '' : sd === 'L' ? 'Left · ' : 'Right · '}${base === 'pa' ? `${fmtDay(x.from)} to ${fmtDay(x.date)}` : fmtDay(x.date)}${c.lado[sd].act && base !== 'last' ? ` · latest session ${fmtDay(c.lado[sd].act.date)}: ${nf(c.lado[sd].act.value)}` : ''}` : ''; };
  const rotuloVar = { last: 'Value (% change vs previous session)', pa: 'Value (% latest session vs Personal Average)', pb: 'Value (% latest session vs Personal Best)' }[base];
  const tipVar = { last: 'In brackets: % change of the latest session against the previous valid session, for each leg.', pa: 'The Personal Average is shown. In brackets: % change of the latest session against that Personal Average, for each leg.', pb: 'The Personal Best is shown. In brackets: % change of the latest session against that Personal Best, for each leg.' }[base];
  const bloques = trocear(cols, presupuestoAncho(ancho));
  const celdasLado = (c, fn, cls = '') => c.sides.map((sd) => html`<td key=${c.v.id + sd} class=${cls + (c.v.id === selectedId ? ' sel' : '')}>${fn(c.lado[sd], sd)}</td>`);
  const celdaUnica = (c, contenido) => html`<td key=${c.v.id} colSpan=${c.span} class=${c.v.id === selectedId ? 'sel' : ''}>${contenido}</td>`;
  const valorTxt = (c, l) => (c.asy ? asymText(l.x.value, 2) : nf(l.x.value));
  const tabla = (blk, i) => html`<div class="table-wrap pano-wrap" key=${'b' + i}><table class="pano norm"><caption class="sr">${dn(test.name)}: value and percentiles for each variable and leg (${etq(base, '')})</caption>
    <thead><tr><td class="pano-lab"></td>${blk.map((c) => html`<th key=${c.v.id} colSpan=${c.span} scope="colgroup" class=${c.v.id === selectedId ? 'sel' : ''}><button type="button" class="pano-th" aria-pressed=${c.v.id === selectedId} title="Show the longitudinal chart and the rest of the analysis for this variable" onClick=${() => pick(c.v.id)}><span class="pano-nm">${dn(c.v.name)}</span>${c.v.unit ? html`<small>${c.v.unit}</small>` : null}</button></th>`)}</tr>
      ${blk.some((c) => c.sides.length === 2) ? html`<tr class="lados"><td class="pano-lab"></td>${blk.flatMap((c) => (c.sides.length === 2 ? [html`<th key=${c.v.id + 'L'} scope="col" class="l"><abbr title="Left">L</abbr></th>`, html`<th key=${c.v.id + 'R'} scope="col" class="r"><abbr title="Right">R</abbr></th>`] : [html`<th key=${c.v.id + 'S'} scope="col" class="sr">Value</th>`]))}</tr>` : null}</thead>
    <tbody>
      <tr><th scope="row" class="pano-lab" title=${tipVar}>${rotuloVar}</th>${blk.flatMap((c) => celdasLado(c, (l, sd) => (l.x ? html`<span class=${'val ' + (sd === 'L' ? 'l' : sd === 'R' ? 'r' : '') + (c.asy ? ' ' + asimClase(l.x.value) : '')} title=${tipVal(c, sd)}><strong>${valorTxt(c, l)}</strong>${fmtVar(l.vari) ? html` <small class="var">(${fmtVar(l.vari)})</small>` : null}</span>` : html`<span class="muted" title=${l.pbReason ?? ''}>—</span>`), 'num'))}</tr>
      <tr><th scope="row" class="pano-lab" title="Percentile of each leg against the La Liga reference (both legs of every player pooled), for the selected basis">Value (La Liga percentile)</th>${blk.flatMap((c) => celdasLado(c, (l) => celdaPercentil(l.ev)))}</tr>
      ${tienePl ? html`<tr><th scope="row" class="pano-lab" title="The Premier League publishes cut-offs (P5, P25, P50, P75, P95): the zone is shown, without interpolation. For relative measures it is an estimate (*).">Value (Premier League percentile)</th>${blk.flatMap((c) => (!c.hayPl ? [celdaUnica(c, html`<span class="muted" title="No Premier League reference">—</span>`)] : celdasLado(c, (l) => (l.pl?.placed ? html`<span class=${`badge band-${l.pl.band}`}>${l.pl.text}${c.est ? '*' : ''}</span>` : l.x ? html`<span class="muted">sin ubicar</span>` : html`<span class="muted">—</span>`))))}</tr>` : null}
      ${tieneNat ? html`<tr><th scope="row" class="pano-lab" title="Natera classification (Run-Specific Iso-Push only, relative maximal strength)">Value (Natera)</th>${blk.flatMap((c) => (!c.nat ? [celdaUnica(c, html`<span class="muted">—</span>`)] : celdasLado(c, (l) => (l.nat ? html`<span class=${`badge band-${l.nat.band}`}>${l.nat.text}</span>` : html`<span class="muted">—</span>`))))}</tr>` : null}
      ${tieneLR ? html`<tr><th scope="row" class="pano-lab" title=${'Interlimb asymmetry: |R − L| ÷ max × 100 with the letter of the higher side (for variables in degrees: R − L, in degrees). Computed from both values of the selected basis.'}>Asymmetry</th>${blk.map((c) => celdaUnica(c, c.sides.length === 2 && Number.isFinite(c.asim) ? html`<${AsimTexto} pct=${c.asim} texto=${esGrados(c.v) ? `${nf(Math.abs(c.asim), 1)} °${asymSideLetter(c.asim) ? ' ' + asymSideLetter(c.asim) : ''}` : null} />` : '—'))}</tr>` : null}
      ${tieneEvAsim ? html`<tr><th scope="row" class="pano-lab" title="Indicative percentile of this asymmetry against the same measure in the other players, regardless of side. More asymmetry = worse: a low percentile means a large asymmetry for La Liga. Not computed for variables in degrees.">Asymmetry (La Liga percentile)</th>${blk.map((c) => celdaUnica(c, c.evAsim ? celdaPercentil(c.evAsim) : '—'))}</tr>` : null}
    </tbody></table></div>`;
  // Motivos por los que no hay Personal Best (se listan en las notas; en la tabla la celda lleva el motivo como ayuda).
  const sinPB = base === 'pb' ? cols.flatMap((c) => c.sides.map((sd) => (c.lado[sd].pbReason ? `${dn(c.v.name)}${c.sides.length === 2 ? ` (${sd})` : ''}: ${c.lado[sd].pbReason}` : null)).filter(Boolean)) : [];
  const selCol = cols.find((c) => c.v.id === selectedId) ?? cols[0];
  const plRef = selCol?.ctx.plRef ?? null, natSel = selCol?.nat ?? null, unitSel = selCol?.v.unit ?? '', uSel = unitSel ? ` ${unitSel}` : '';
  const posName = positionId === null ? 'all positions' : positions.find((p) => p.id === positionId)?.name ?? 'deleted position';
  return html`<section class="panorama" aria-label=${`${dn(test.name)}: Normative Benchmarking`}>
    <h4 class="sec-titulo">Normative Benchmarking</h4>
    <div class="filters">
      <fieldset class="modes"><legend>Value shown</legend>${bases.map(([k, n]) => html`<label class="check" key=${k}><input type="radio" name="pano-base" checked=${base === k} onChange=${() => setQ({ pn: k })} /> ${etq(k, n)}</label>`)}</fieldset>
      <label>La Liga reference <select value=${rp} onChange=${(e) => setQ({ rp: e.target.value })}><option value="all">All positions</option>${positions.map((p) => html`<option key=${p.id} value=${p.id}>${p.name}</option>`)}</select></label>
    </div>
    <${BotonesImagen} obtener=${() => refTabla.current} nombre=${`normative-benchmarking_${dn(test.name)}_${base}`} titulo=${`${playerLabel(player)} · ${dn(test.name)} · Normative Benchmarking · ${etq(base, '')}`} />
    <div ref=${refTabla} class="pano-todas">${bloques.map(tabla)}</div>
    ${sinPB.length ? html`<p class="muted">${sinPB.join(' · ')}</p>` : null}
    <${Desplegable} titulo="Notes and percentile method">
      <p class="muted"><strong>What each option means and what it is compared with.</strong></p>
      <ul class="plain muted">
        <li><strong>Personal Average:</strong> the mean of every valid session of this player within the selected period and protocol (each session is already the mean of its repetitions; sessions are weighted by the number of repetitions, and weigh 1 when it is unknown). Compared with the Personal Average of the other La Liga players.</li>
        <li><strong>Personal Best:</strong> the player's best result. If the test defines a criterion (RSI in CMJ, SL CMJ, Hop Test and Drop Jump 30/45 cm; Jump Height in Squat Jump) it is the value of the session with the best criterion, so that every variable comes from the same session; otherwise, the best value according to the direction of the variable (higher or lower is better). Compared with the Personal Best of the other players.</li>
        <li><strong>Latest:</strong> the value of the player's last valid session. Compared with the Personal Average of the other players (not with their latest sessions), so that today's result is placed against what is usual in La Liga.</li>
      </ul>
      <p class="muted"><strong>Change in brackets.</strong> With «Latest»: against the previous valid session. With «Personal Average» or «Personal Best»: the latest session against that value. It is (new − reference) ÷ |reference| × 100, computed per leg; it is not shown when there is no previous session or the reference is 0.</p>
      <p class="muted"><strong>Percentiles.</strong> Exact percentile by mid-rank. La Liga reference (${posName}): one value per player and basis, excluded sessions left out, <strong>no synthetic data and without this player</strong>; minimum ${minN} players (change it in Settings). With two legs, the reference pools the left and right values of every player (a single P50) and <strong>each leg is ranked separately</strong> against it. The performance percentile takes the direction of the variable into account (lower is better → it is inverted); without a direction, the colour shows the position within La Liga. Six colour bands, as in the guide. «n&lt;${minN}» = insufficient sample. Hover over a value to see its dates.</p>
      <p class="muted"><strong>Asymmetry.</strong> |R − L| ÷ max × 100 with the letter of the higher side (for variables in degrees, R − L in degrees). Its percentile is computed against the asymmetries of the other players on the same basis (more asymmetry = worse) and is indicative only.</p>
      ${selCol ? html`<p class="muted"><strong>${dn(selCol.v.name)}</strong> (selected variable):</p>` : null}
      ${natSel ? html`<p class="muted">Natera (${natSel.unit}): Normal from ${nf(natSel.normal, 2)} · Good from ${nf(natSel.good, 2)} · Excellent from ${nf(natSel.excellent, 2)}. Source: ${NATERA_SOURCE}. The limits are applied as continuous intervals (the source publishes ranges with rounding gaps). Below «Normal» the source gives no label: it is shown in red, as decided by the user. Whether the thresholds are per leg or per player has not been verified; they are applied to each leg.</p>` : null}
      ${abs ? html`<p class="muted">Relative measure (${unitSel}): the La Liga percentiles are computed on this relative measure.${plRef?.estimated ? html` Premier League, ESTIMATED: the Premier League publishes force (N) and body mass (P5 72.0 · P25 76.6 · P50 81.8 · P75 88.2 · P95 97.1 kg) separately, not the ratio between them. Estimated cut-offs (${unitSel}) P5/P25/P50/P75/P95 = ${plRef.cuts.map((c) => nf(c, 2)).join(' · ')}; possible range between minimum and maximum dispersion: ${plRef.range.lo.map((a, i) => `${nf(a, 2)}–${nf(plRef.range.hi[i], 2)}`).join(' · ')} (the median is the same at both ends).` : ''}</p>` : null}
      ${!plRef ? html`<p class="muted">This variable is not in the Premier League tables provided (${PREMIER_SEASON}): it has no Premier League percentile.</p>`
        : html`<p class="muted">Premier League (${PREMIER_SEASON}, «In Season» table${plRef.unitConverted ? ', converted to the unit of the catalogue' : ''}): the zone between the published cut-offs (P5, P25, P50, P75, P95) is shown, without interpolating percentiles. P50 = ${nf(plRef.cuts[2], 3)}${uSel}. The Premier League thresholds are not validated as performance thresholds. * = estimated.</p>`}
    <//>
  </section>`;
}
