// pages-panorama.js — vista «de un vistazo» de un test en el perfil del jugador (CMJ y Perímetros): una columna por variable.
//  CMJ (un valor por variable): filas Valor · Percentil La Liga · Zona Premier League.
//  Perímetros (dos lados): filas Valor (L / R) · Asimetría · Percentil La Liga con el promedio de ambas piernas.
// Los valores salen de las mismas funciones que el gráfico longitudinal y el cuadro «Normative Benchmarking», así que coinciden con ellos.
import { html } from './libs.js';
import { orderVars, isViewable, hasData, isRelative } from './relativos.js';
import { isAsymVariable, asymmetryPct, asymText } from './catalogo.js';
import { buildSeries, personalAverage, personalBest, currentResult } from './evolucion.js';
import { refContext, Banda } from './pages-percentiles.js';
import { evaluate } from './percentiles.js';
import { placeAgainstPremier } from './premier.js';
import { fmtDay } from './fechas.js';

export const esPanorama = (test) => test?.name === 'CMJ' || test?.blockKey === 'perimetros';
const nf = (n, d = 2) => (n === null || n === undefined || !Number.isFinite(n) ? '—' : Number(n).toLocaleString('es-ES', { maximumFractionDigits: d }));
const BASES = [['pa', 'Personal Average'], ['pb', 'Personal Best'], ['last', 'Actual']];
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;

function celdaPercentil(ev, extra = '') {
  if (!ev) return html`<span class="muted">—</span>`;
  if (!ev.sufficient || ev.percentileStat === null) return html`<span class="muted" title=${ev.reason ?? ''}>${'n<' + ev.minN}</span>`;
  return ev.band !== null ? html`<${Banda} ev=${ev} />` : html`<span class="muted" title=${ev.reason ?? ''}>P${nf(ev.percentileStat, 0)}</span>`;
}

export function Panorama({ player, test, catalog, sessions, refData, q, setQ, selectedId }) {
  if (!refData) return null;
  const perim = test.blockKey === 'perimetros';
  const from = q.from || null, to = q.to || null;
  const proto = q.p ?? 'all';
  const f = { from, to, protocolId: proto === 'all' ? undefined : proto === 'none' ? null : Number(proto) };
  const vars = orderVars(catalog.variables.filter((v) => v.testId === test.id && isViewable(v) && hasData(v, sessions) && !isAsymVariable(v)));
  if (!vars.length) return null;
  const bases = perim ? BASES.filter(([k]) => k !== 'pb') : BASES; // los perímetros no tienen dirección: no hay Personal Best
  const base = bases.some(([k]) => k === q.pn) ? q.pn : 'pa';
  const cols = vars.map((v) => {
    const sides = v.sides === 'LR' ? ['L', 'R'] : ['S'];
    const own = (sd) => {
      const val = buildSeries(sessions, v.id, sd, f).valid;
      if (!val.length) return null;
      if (base === 'last') { const c = currentResult(val); return c ? { value: c.value, date: c.date } : null; }
      if (base === 'pb') { const b = personalBest(val, v.direction); return b.defined ? { value: b.value, date: b.date } : null; }
      const a = personalAverage(val); return a.defined ? { value: a.value, date: a.to, from: a.from } : null;
    };
    const o = Object.fromEntries(sides.map((sd) => [sd, own(sd)]));
    const srcVar = isRelative(v) ? catalog.variables.find((x) => x.id === v.formula.operands[0]) ?? null : null;
    const ctx = refContext({ refData, test, variable: v, sides, filters: f, playerId: player.id, positionId: null, srcVar });
    const ent = ctx.entries(base, null);
    const minN = refData.minN;
    let ev = null, valor = null, asim = null, pl = null;
    if (sides.length === 1) {
      const x = o.S?.value ?? null;
      valor = x;
      ev = x != null ? evaluate(ent, { playerId: player.id, value: x, direction: v.direction, minN }) : null;
      pl = x != null && ctx.plRef ? placeAgainstPremier(ctx.plRef, x) : null;
    } else if (o.L && o.R) {
      valor = null;
      asim = asymmetryPct(o.L.value, o.R.value);
      // Un solo percentil con el promedio de ambas piernas, frente al promedio de las dos piernas de los demás jugadores (solo los que tienen ambos lados).
      const by = new Map(); for (const e of ent) { if (!by.has(e.playerId)) by.set(e.playerId, []); by.get(e.playerId).push(e.value); }
      const meanEnt = [...by].filter(([, a]) => a.length >= 2).map(([playerId, a]) => ({ playerId, value: mean(a) }));
      ev = evaluate(meanEnt, { playerId: player.id, value: mean([o.L.value, o.R.value]), direction: v.direction, minN });
    }
    const fechas = Object.values(o).filter(Boolean);
    return { v, sides, o, valor, ev, pl, asim, est: !!ctx.plRef?.estimated, hayPl: !!ctx.plRef, date: fechas.map((x) => x.date).sort().at(-1) ?? null, from: fechas.map((x) => x.from).filter(Boolean).sort()[0] ?? null };
  });
  const tieneLR = cols.some((c) => c.sides.length === 2), tienePl = cols.some((c) => c.hayPl), tieneS = cols.some((c) => c.sides.length === 1);
  const lastDate = cols.map((c) => c.date).filter(Boolean).sort().at(-1);
  const paFrom = cols.map((c) => c.from).filter(Boolean).sort()[0];
  const nombre = (v) => v.name + (v.unit && !v.name.includes(`(${v.unit})`) ? '' : '');
  const pick = (id) => { setQ({ v: id }); setTimeout(() => document.getElementById('detalle-variable')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 250); };
  const etq = (k, n) => (k === 'last' ? `Actual${lastDate ? ` (${fmtDay(lastDate)})` : ''}` : k === 'pa' ? `Personal Average${paFrom && lastDate ? (paFrom === lastDate ? ` (${fmtDay(lastDate)})` : ` (${fmtDay(paFrom)} – ${fmtDay(lastDate)})`) : ''}` : n);
  const tipVal = (c, sd) => { const x = c.o[sd]; return x ? `${sd === 'S' ? '' : sd === 'L' ? 'Left · ' : 'Right · '}${base === 'pa' ? `${fmtDay(x.from)} a ${fmtDay(x.date)}` : fmtDay(x.date)}` : ''; };
  return html`<section class="panorama" aria-label=${`${test.name}: todas las variables`}>
    <h4 class="sec-titulo">${test.name} · todas las variables</h4>
    <fieldset class="modes"><legend>Valor mostrado</legend>${bases.map(([k, n]) => html`<label class="check" key=${k}><input type="radio" name="pano-base" checked=${base === k} onChange=${() => setQ({ pn: k })} /> ${etq(k, n)}</label>`)}</fieldset>
    <div class="table-wrap pano-wrap"><table class="pano"><caption class="sr">${test.name}: valor y percentiles de cada variable del jugador (${etq(base, '')})</caption>
      <thead><tr><td class="pano-lab"></td>${cols.map((c) => html`<th key=${c.v.id} scope="col" class=${c.v.id === selectedId ? 'sel' : ''}><button type="button" class="pano-th" aria-pressed=${c.v.id === selectedId} title="Ver el gráfico longitudinal de esta variable" onClick=${() => pick(c.v.id)}><span class="pano-nm">${nombre(c.v)}</span>${c.v.unit ? html`<small>${c.v.unit}</small>` : null}</button></th>`)}</tr></thead>
      <tbody>
        <tr><th scope="row" class="pano-lab">Valor</th>${cols.map((c) => html`<td key=${c.v.id} class=${'num' + (c.v.id === selectedId ? ' sel' : '')}>${c.sides.length === 1 ? (c.valor != null ? html`<strong title=${tipVal(c, 'S')}>${nf(c.valor)}</strong>` : '—') : html`<span class="lr"><span class="l" title=${tipVal(c, 'L')}>L ${nf(c.o.L?.value)}</span><span class="r" title=${tipVal(c, 'R')}>R ${nf(c.o.R?.value)}</span></span>`}</td>`)}</tr>
        ${tieneLR ? html`<tr><th scope="row" class="pano-lab">Asimetría</th>${cols.map((c) => html`<td key=${c.v.id} class=${c.v.id === selectedId ? 'sel' : ''} title="|R − L| ÷ máx × 100, con la letra del lado más alto">${c.sides.length === 2 ? asymText(c.asim) : '—'}</td>`)}</tr>` : null}
        <tr><th scope="row" class="pano-lab" title=${tieneLR && !tieneS ? 'Percentil del promedio de ambas piernas frente al promedio de las dos piernas de los demás jugadores' : 'Percentil frente a La Liga (todas las posiciones), con la base elegida'}>${tieneLR && !tieneS ? 'Percentil La Liga (media de ambas piernas)' : 'Percentil La Liga'}</th>${cols.map((c) => html`<td key=${c.v.id} class=${c.v.id === selectedId ? 'sel' : ''}>${celdaPercentil(c.ev)}</td>`)}</tr>
        ${tienePl ? html`<tr><th scope="row" class="pano-lab" title="La Premier League publica cortes (P5, P25, P50, P75, P95): se indica la zona, sin interpolar. En medidas relativas es una estimación.">Premier League (zona)</th>${cols.map((c) => html`<td key=${c.v.id} class=${c.v.id === selectedId ? 'sel' : ''}>${!c.hayPl ? html`<span class="muted" title="Sin referencia de la Premier League">—</span>` : c.pl?.placed ? html`<span class=${`badge band-${c.pl.band}`} title=${c.est ? 'Zona estimada' : ''}>${c.pl.text}${c.est ? '*' : ''}</span>` : html`<span class="muted">—</span>`}</td>`)}</tr>` : null}
      </tbody></table></div>
    <p class="muted">Pulsa el nombre de una variable para ver su gráfico longitudinal y el resto de sus análisis más abajo. Percentil: ${perim ? 'sin color de «mejor/peor» (los perímetros no tienen dirección): el número es la posición en La Liga' : 'de rendimiento frente a La Liga, N mínimo ' + refData.minN}; «${'n<' + refData.minN}» = muestra insuficiente.${tienePl ? ' Premier League: zona entre los cortes publicados (* = estimada).' : ''}</p>
  </section>`;
}
