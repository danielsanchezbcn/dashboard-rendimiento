// pages-panorama.js — vista «de un vistazo» de un test en el perfil del jugador (CMJ, Reactive Strength —Hop Test y Drop Jump 30/45 cm— y Perímetros): una columna por variable.
//  CMJ (un valor por variable): filas Valor · Percentil La Liga · Zona Premier League.
//  Perímetros (dos lados): filas Valor (L / R) · Asimetría · Percentil La Liga con el promedio de ambas piernas.
// Los valores salen de las mismas funciones que el gráfico longitudinal y el cuadro «Normative Benchmarking», así que coinciden con ellos.
import { html } from './libs.js';
import { orderVars, isViewable, hasData, isRelative } from './relativos.js';
import { isAsymVariable, asymmetryPct, asymText } from './catalogo.js';
import { buildSeries, personalAverage, personalBestFor, currentResult } from './evolucion.js';
import { refContext, Banda } from './pages-percentiles.js';
import { evaluate, buildReference } from './percentiles.js';
import { placeAgainstPremier } from './premier.js';
import { fmtDay } from './fechas.js';
import { AsimTexto } from './asim-ui.js';

export const PANORAMA_TESTS = ['CMJ', 'Double-Leg Hop Test', 'DL Drop Jump 30 cm', 'DL Drop Jump 45 cm']; // CMJ y Reactive Strength
export const esPanorama = (test) => PANORAMA_TESTS.includes(test?.name) || test?.blockKey === 'perimetros';
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
  const playersById = Object.fromEntries(refData.players.map((p) => [p.id, p]));
  const histories = {}; for (const r of refData.records) (histories[r.playerId] ??= []).push(r);
  // Asimetría absoluta (|R − L| ÷ máx × 100) de cada jugador con ambos lados, para la misma base: cada medida se compara solo consigo misma.
  const asymEntries = (v) => {
    const side = (sd) => new Map(buildReference({ sessions: refData.sessions, variable: v, side: sd, players: playersById, histories, basis: base === 'last' ? 'pa' : base, positionId: null, from, to, protocolId: f.protocolId }).map((e) => [e.playerId, e.value]));
    const L = side('L'), R = side('R');
    return [...L].filter(([id]) => R.has(id)).map(([playerId, l]) => ({ playerId, value: Math.abs(asymmetryPct(l, R.get(playerId))) })).filter((e) => Number.isFinite(e.value));
  };
  const cols = vars.map((v) => {
    const sides = v.sides === 'LR' ? ['L', 'R'] : ['S'];
    const own = (sd) => {
      const val = buildSeries(sessions, v.id, sd, f).valid;
      if (!val.length) return null;
      if (base === 'last') { const c = currentResult(val); return c ? { value: c.value, date: c.date } : null; }
      if (base === 'pb') { const b = personalBestFor(sessions, v, sd, f); return b.defined ? { value: b.value, date: b.date, rsi: b.criterionValue ?? null } : null; }
      const a = personalAverage(val); return a.defined ? { value: a.value, date: a.to, from: a.from } : null;
    };
    const o = Object.fromEntries(sides.map((sd) => [sd, own(sd)]));
    const srcVar = isRelative(v) ? catalog.variables.find((x) => x.id === v.formula.operands[0]) ?? null : null;
    const ctx = refContext({ refData, test, variable: v, sides, filters: f, playerId: player.id, positionId: null, srcVar });
    const ent = ctx.entries(base, null);
    const minN = refData.minN;
    let ev = null, valor = null, asim = null, pl = null, evAsim = null;
    if (sides.length === 1) {
      const x = o.S?.value ?? null;
      valor = x;
      ev = x != null ? evaluate(ent, { playerId: player.id, value: x, direction: v.direction, minN }) : null;
      pl = x != null && ctx.plRef ? placeAgainstPremier(ctx.plRef, x) : null;
    } else if (o.L && o.R) {
      valor = null;
      asim = asymmetryPct(o.L.value, o.R.value);
      // Percentil ORIENTATIVO de la asimetría (sin importar el lado): mayor asimetría = peor, así que el percentil de rendimiento es el inverso del estadístico (como «más bajo es mejor»).
      if (Number.isFinite(asim)) evAsim = evaluate(asymEntries(v), { playerId: player.id, value: Math.abs(asim), direction: 'lower', minN });
      // Un solo percentil con el promedio de ambas piernas, frente al promedio de las dos piernas de los demás jugadores (solo los que tienen ambos lados).
      const by = new Map(); for (const e of ent) { if (!by.has(e.playerId)) by.set(e.playerId, []); by.get(e.playerId).push(e.value); }
      const meanEnt = [...by].filter(([, a]) => a.length >= 2).map(([playerId, a]) => ({ playerId, value: mean(a) }));
      ev = evaluate(meanEnt, { playerId: player.id, value: mean([o.L.value, o.R.value]), direction: v.direction, minN });
    }
    const fechas = Object.values(o).filter(Boolean);
    return { v, sides, o, valor, ev, evAsim, pl, asim, est: !!ctx.plRef?.estimated, hayPl: !!ctx.plRef, date: fechas.map((x) => x.date).sort().at(-1) ?? null, from: fechas.map((x) => x.from).filter(Boolean).sort()[0] ?? null };
  });
  const tieneLR = cols.some((c) => c.sides.length === 2), tienePl = cols.some((c) => c.hayPl), tieneS = cols.some((c) => c.sides.length === 1);
  const lastDate = cols.map((c) => c.date).filter(Boolean).sort().at(-1);
  const paFrom = cols.map((c) => c.from).filter(Boolean).sort()[0];
  const nombre = (v) => v.name + (v.unit && !v.name.includes(`(${v.unit})`) ? '' : '');
  const pick = (id) => { setQ({ v: id }); setTimeout(() => document.getElementById('detalle-variable')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 250); };
  const crit = vars.find((v) => v.pbCriterion)?.pbCriterion ?? null;
  const critCorto = crit ? (/\bRSI\b/i.test(crit.name) ? 'RSI' : crit.name) : '';
  // La fecha solo se rotula en la opción elegida (las fechas son las de esa base).
  const etq = (k, n) => {
    if (k !== base) return k === 'pb' && crit ? `Personal Best (sesión con mejor ${critCorto})` : n;
    if (k === 'last') return `Actual${lastDate ? ` (${fmtDay(lastDate)})` : ''}`;
    if (k === 'pb') return crit ? `Personal Best (sesión con mejor ${critCorto}${lastDate ? `, ${fmtDay(lastDate)}` : ''})` : `Personal Best${lastDate ? ` (${fmtDay(lastDate)})` : ''}`;
    return `Personal Average${paFrom && lastDate ? (paFrom === lastDate ? ` (${fmtDay(lastDate)})` : ` (${fmtDay(paFrom)} – ${fmtDay(lastDate)})`) : ''}`;
  };
  const tipVal = (c, sd) => { const x = c.o[sd]; return x ? `${sd === 'S' ? '' : sd === 'L' ? 'Left · ' : 'Right · '}${base === 'pa' ? `${fmtDay(x.from)} a ${fmtDay(x.date)}` : fmtDay(x.date)}` : ''; };
  return html`<section class="panorama" aria-label=${`${test.name}: todas las variables`}>
    <h4 class="sec-titulo">${test.name} · todas las variables</h4>
    <fieldset class="modes"><legend>Valor mostrado</legend>${bases.map(([k, n]) => html`<label class="check" key=${k}><input type="radio" name="pano-base" checked=${base === k} onChange=${() => setQ({ pn: k })} /> ${etq(k, n)}</label>`)}</fieldset>
    <div class="table-wrap pano-wrap"><table class="pano"><caption class="sr">${test.name}: valor y percentiles de cada variable del jugador (${etq(base, '')})</caption>
      <thead><tr><td class="pano-lab"></td>${cols.map((c) => html`<th key=${c.v.id} scope="col" class=${c.v.id === selectedId ? 'sel' : ''}><button type="button" class="pano-th" aria-pressed=${c.v.id === selectedId} title="Ver el gráfico longitudinal de esta variable" onClick=${() => pick(c.v.id)}><span class="pano-nm">${nombre(c.v)}</span>${c.v.unit ? html`<small>${c.v.unit}</small>` : null}</button></th>`)}</tr></thead>
      <tbody>
        <tr><th scope="row" class="pano-lab">Valor</th>${cols.map((c) => html`<td key=${c.v.id} class=${'num' + (c.v.id === selectedId ? ' sel' : '')}>${c.sides.length === 1 ? (c.valor != null ? html`<strong title=${tipVal(c, 'S')}>${nf(c.valor)}</strong>` : '—') : html`<span class="lr"><span class="l" title=${tipVal(c, 'L')}>L ${nf(c.o.L?.value)}</span><span class="r" title=${tipVal(c, 'R')}>R ${nf(c.o.R?.value)}</span></span>`}</td>`)}</tr>
        <tr><th scope="row" class="pano-lab" title=${tieneLR && !tieneS ? 'Percentil del promedio de ambas piernas frente al promedio de las dos piernas de los demás jugadores' : 'Percentil frente a La Liga (todas las posiciones), con la base elegida'}>${tieneLR && !tieneS ? 'Percentil La Liga (media de ambas piernas)' : 'Percentil La Liga'}</th>${cols.map((c) => html`<td key=${c.v.id} class=${c.v.id === selectedId ? 'sel' : ''}>${celdaPercentil(c.ev)}</td>`)}</tr>
        ${tienePl ? html`<tr><th scope="row" class="pano-lab" title="La Premier League publica cortes (P5, P25, P50, P75, P95): se indica la zona, sin interpolar. En medidas relativas es una estimación.">Premier League (zona)</th>${cols.map((c) => html`<td key=${c.v.id} class=${c.v.id === selectedId ? 'sel' : ''}>${!c.hayPl ? html`<span class="muted" title="Sin referencia de la Premier League">—</span>` : c.pl?.placed ? html`<span class=${`badge band-${c.pl.band}`} title=${c.est ? 'Zona estimada' : ''}>${c.pl.text}${c.est ? '*' : ''}</span>` : html`<span class="muted">—</span>`}</td>`)}</tr>` : null}
        ${tieneLR ? html`<tr><th scope="row" class="pano-lab">Asimetría</th>${cols.map((c) => html`<td key=${c.v.id} class=${c.v.id === selectedId ? 'sel' : ''} title="|R − L| ÷ máx × 100, con la letra del lado más alto">${c.sides.length === 2 ? html`<${AsimTexto} pct=${c.asim} />` : '—'}</td>`)}</tr>` : null}
        ${tieneLR ? html`<tr><th scope="row" class="pano-lab" title="Percentil orientativo de la asimetría de esta medida frente a la misma medida de los demás jugadores, sin importar el lado. Mayor asimetría = peor: un percentil bajo indica una asimetría grande para La Liga.">Percentil asimetría</th>${cols.map((c) => html`<td key=${c.v.id} class=${c.v.id === selectedId ? 'sel' : ''}>${c.sides.length === 2 ? celdaPercentil(c.evAsim) : '—'}</td>`)}</tr>` : null}
      </tbody></table></div>
    <p class="muted">Pulsa el nombre de una variable para ver su gráfico longitudinal y el resto de sus análisis más abajo. Percentil: ${perim ? 'el de La Liga es posicional (los perímetros no tienen dirección de «mejor/peor»); el de asimetría sí es de rendimiento: mayor asimetría, peor, así que un percentil bajo señala una asimetría grande y orientativa' : 'de rendimiento frente a La Liga, N mínimo ' + refData.minN}; «${'n<' + refData.minN}» = muestra insuficiente.${crit && base === 'pb' ? ` Personal Best = todas las variables de la sesión con mejor ${critCorto} (una misma ejecución); si la sesión no tiene alguna variable, queda en «—».` : ''}${tienePl ? ' Premier League: zona entre los cortes publicados (* = estimada).' : ''}</p>
  </section>`;
}
