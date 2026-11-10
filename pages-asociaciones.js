// pages-asociaciones.js — fase 6c: vista exploratoria de relaciones entre variables. Criterio estadístico PROVISIONAL (pendiente de confirmar).
import { Copiable } from './copiar.js';
import { html } from './libs.js';
import { useApp } from './context.js';
import { Card, useLoad } from './componentes.js';
import { getSetting } from './db.js';
import { fmtDay } from './fechas.js';
import { listCatalog } from './catalogo.js';
import { listPositions } from './posiciones.js';
import { replaceQuery } from './rutas.js';
import { MIN_N_DEFAULT } from './percentiles.js';
import { expandRelative } from './relativos.js';
import { withReferenceWeights } from './relaciones.js';
import { variableOptions, crossSectional, withinPlayer } from './asociaciones.js';
import { dn } from './nombres.js';

const nf = (n, d = 2) => (n === null || n === undefined ? '—' : Number(n).toLocaleString('es-ES', { maximumFractionDigits: d }));
const ci = (c) => (c ? `[${nf(c[0])} ; ${nf(c[1])}]` : 'no calculable (correlación perfecta o muy pocos datos)');

function niceTicks(min, max, n = 5) {
  const span = max - min || Math.abs(max) || 1, pad = span * 0.06;
  const lo = min - pad, hi = max + pad;
  return Array.from({ length: n }, (_, i) => lo + ((hi - lo) * i) / (n - 1));
}

function Dispersion({ res, xo, yo }) {
  const W = 640, H = 400, L = 64, R = 16, T = 12, B = 52;
  const xs = res.obs.map((o) => o.x), ys = res.obs.map((o) => o.y);
  const xt = niceTicks(Math.min(...xs), Math.max(...xs)), yt = niceTicks(Math.min(...ys), Math.max(...ys));
  const X = (v) => L + ((v - xt[0]) / (xt.at(-1) - xt[0])) * (W - L - R), Y = (v) => H - B - ((v - yt[0]) / (yt.at(-1) - yt[0])) * (H - B - T);
  const lines = res.mode === 'within' ? [...Map.groupBy(res.obs, (o) => o.id).values()].map((g) => g.sort((a, b) => a.x - b.x)) : [];
  const xl = `${dn(xo.test.name)} · ${dn(xo.variable.name)}${xo.unit ? ` (${xo.unit})` : ''}${xo.side !== 'S' ? ` · ${xo.side === 'L' ? 'Izq.' : 'Der.'}` : ''}`;
  const yl = `${dn(yo.test.name)} · ${dn(yo.variable.name)}${yo.unit ? ` (${yo.unit})` : ''}${yo.side !== 'S' ? ` · ${yo.side === 'L' ? 'Izq.' : 'Der.'}` : ''}`;
  return html`<${Copiable} nombre="dispersion"><svg class="scatter" viewBox=${`0 0 ${W} ${H}`} width="100%" role="img" aria-label=${`Dispersión: ${xl} (horizontal) frente a ${yl} (vertical), ${res.n} observaciones`}>
    ${xt.map((t) => html`<g key=${'x' + t}><line x1=${X(t)} x2=${X(t)} y1=${T} y2=${H - B} class="gridline" /><text x=${X(t)} y=${H - B + 16} text-anchor="middle">${nf(t, 1)}</text></g>`)}
    ${yt.map((t) => html`<g key=${'y' + t}><line x1=${L} x2=${W - R} y1=${Y(t)} y2=${Y(t)} class="gridline" /><text x=${L - 6} y=${Y(t) + 4} text-anchor="end">${nf(t, 1)}</text></g>`)}
    <line x1=${L} x2=${W - R} y1=${H - B} y2=${H - B} class="axis" /><line x1=${L} x2=${L} y1=${T} y2=${H - B} class="axis" />
    ${lines.map((g, i) => html`<polyline key=${i} points=${g.map((o) => `${X(o.x)},${Y(o.y)}`).join(' ')} fill="none" stroke="var(--muted)" stroke-width="1" opacity="0.6" />`)}
    ${res.obs.map((o, i) => html`<circle key=${i} cx=${X(o.x)} cy=${Y(o.y)} r="4.5" fill="var(--accent)" stroke="var(--surface)" stroke-width="1"><title>${o.name}${o.date ? ` · ${fmtDay(o.date)}` : ''}: ${nf(o.x)} ; ${nf(o.y)}${o.synthetic ? ' (sintético)' : ''}</title></circle>`)}
    <text x=${(L + W - R) / 2} y=${H - 8} text-anchor="middle" class="axlabel">${xl}</text>
    <text transform=${`translate(14 ${(T + H - B) / 2}) rotate(-90)`} text-anchor="middle" class="axlabel">${yl}</text>
  </svg><//>`;
}

export function Relaciones({ query = {} }) {
  const { db, version } = useApp();
  const { data } = useLoad(async () => {
    const catalog = await listCatalog(db);
    const [raw, anthropometry, players, records, positions, mn] = await Promise.all([db.sessions.toArray(), db.anthropometry.toArray(), db.players.toArray(), db.playerPositions.toArray(), listPositions(db), getSetting(db, 'percentileMinN')]);
    let sessions = [];
    const anthro = withReferenceWeights(anthropometry, players);
    for (const t of catalog.tests) sessions = sessions.concat(expandRelative(catalog.variables, t.id, raw.filter((s) => s.testId === t.id), anthro, { tests: catalog.tests, allSessions: raw }).sessions);
    return { catalog, sessions: sessions.filter((s) => s.status !== 'excluded'), players, records, positions, minN: Number.isInteger(mn) && mn >= 1 ? mn : MIN_N_DEFAULT };
  }, [db, version]);
  if (!data) return html`<p>Cargando…</p>`;
  const set = (patch) => replaceQuery('relaciones', { ...query, ...patch });
  const opts = variableOptions(data.catalog, data.sessions);
  const xo = opts.find((o) => o.key === query.x), yo = opts.find((o) => o.key === query.y);
  const mode = query.m === 'within' ? 'within' : 'cross';
  const posQ = query.pos ?? 'all', syn = query.syn === '1';
  const playersById = Object.fromEntries(data.players.map((p) => [p.id, p]));
  const histories = {}; for (const r of data.records) (histories[r.playerId] ??= []).push(r);
  let res = null, problem = null;
  if (xo && yo) {
    if (xo.key === yo.key) problem = 'Elige dos variables distintas.';
    else {
      const args = { sessions: data.sessions, players: playersById, histories, x: xo, y: yo, from: query.from, to: query.to, posQ, includeSynthetic: syn, minN: data.minN };
      res = mode === 'cross' ? crossSectional(args) : withinPlayer(args);
    }
  }
  const select = (name, val) => html`<select value=${val ?? ''} onChange=${(e) => set({ [name]: e.target.value })}><option value="">— Elige una variable —</option>${opts.map((o) => html`<option key=${o.key} value=${o.key}>${o.label}</option>`)}</select>`;
  return html`<h2 class="page-title">Relaciones entre variables</h2>
    <${Card} titulo="Selección">
      <details class="notas"><summary>Aviso metodológico</summary><p class="muted"><strong>Exploratorio y descriptivo:</strong> muestra asociaciones, no causas, y no sugiere decisiones de entrenamiento ni médicas. Elige explícitamente las dos variables, el periodo y la población. Las sesiones excluidas no cuentan. Las variables en distintas unidades no se normalizan: cada eje lleva su unidad.</p></details>
      <div class="filters">
        <label>Variable horizontal (X) ${select('x', query.x)}</label>
        <label>Variable vertical (Y) ${select('y', query.y)}</label>
        <label>Posición <select value=${posQ} onChange=${(e) => set({ pos: e.target.value })}><option value="all">Todas</option><option value="none">Sin posición</option>${data.positions.map((p) => html`<option key=${p.id} value=${p.id}>${p.name}</option>`)}</select></label>
        <label>Desde <input type="date" value=${query.from ?? ''} onInput=${(e) => set({ from: e.target.value })} /></label>
        <label>Hasta <input type="date" value=${query.to ?? ''} onInput=${(e) => set({ to: e.target.value })} /></label>
      </div>
      <fieldset class="modes"><legend>Tipo de análisis</legend>
        <label class="check"><input type="radio" name="am" checked=${mode === 'cross'} onChange=${() => set({ m: 'cross' })} /> Entre jugadores (una observación por jugador: su Personal Average en el periodo)</label>
        <label class="check"><input type="radio" name="am" checked=${mode === 'within'} onChange=${() => set({ m: 'within' })} /> Dentro del jugador (pares del mismo jugador y el mismo día; correlación de medidas repetidas)</label>
      </fieldset>
      <label class="check"><input type="checkbox" checked=${syn} onChange=${(e) => set({ syn: e.target.checked ? '1' : undefined })} /> Incluir datos sintéticos (solo para probar)</label>
    <//>
    ${!opts.length ? html`<p class="muted">Aún no hay variables con datos.</p>` : !xo || !yo ? html`<p class="muted">Elige las dos variables para ver la relación. No hay selección por defecto.</p>` : problem ? html`<p class="status warn">${problem}</p>` : html`
    <${Card} titulo=${mode === 'cross' ? 'Entre jugadores' : 'Dentro del jugador'}>
      ${res.hasSynthetic ? html`<p class="status warn">Este gráfico incluye datos sintéticos de demostración.</p>` : null}
      <p><strong>Población y periodo:</strong> ${posQ === 'all' ? 'todos los jugadores' : posQ === 'none' ? 'jugadores sin posición' : `posición ${data.positions.find((p) => String(p.id) === posQ)?.name ?? '—'}`}${syn ? '' : ' (sin datos sintéticos)'}; ${query.from || query.to ? `${query.from ? fmtDay(query.from) : 'inicio'} a ${query.to ? fmtDay(query.to) : 'hoy'}` : 'toda la historia'}. <strong>Observaciones:</strong> ${res.n}${res.mode === 'within' ? ` pares de ${res.players} jugadores` : ' jugadores'}.</p>
      ${!res.sufficient ? html`<p class="status warn">Muestra insuficiente: hay ${res.n} observaciones y el mínimo configurado es ${res.minN} (Configuración → «Muestra mínima»). No se calcula ningún coeficiente.${mode === 'within' ? ' En el análisis intra-jugador solo cuentan los jugadores con al menos 2 días en los que ambas variables se midieron.' : ''}</p>` : null}
      ${res.n >= 2 ? html`<${Dispersion} res=${res} xo=${xo} yo=${yo} />` : null}
      ${res.sufficient && mode === 'cross' ? html`<div class="table-wrap"><table><thead><tr><th>Método</th><th class="num">Coeficiente</th><th>IC 95 %</th><th class="num">n</th></tr></thead><tbody>
        <tr><th scope="row">Spearman ρ (principal)</th><td class="num">${res.spearman.defined ? nf(res.spearman.r) : '—'}</td><td>${res.spearman.defined ? ci(res.spearman.ci) : res.spearman.reason}</td><td class="num">${res.n}</td></tr>
        <tr><th scope="row">Pearson r (complementario)</th><td class="num">${res.pearson.defined ? nf(res.pearson.r) : '—'}</td><td>${res.pearson.defined ? ci(res.pearson.ci) : res.pearson.reason}</td><td class="num">${res.n}</td></tr></tbody></table></div>
        ${res.spearman.defined && !res.spearman.ciReliable ? html`<p class="status warn">|ρ| ≥ 0,95: el intervalo de confianza no es fiable.</p>` : null}
        <details class="notas"><summary>Cómo se interpreta</summary><p class="muted">Spearman (rangos) es robusta a valores extremos y a relaciones monótonas no lineales; Pearson mide solo la parte lineal. IC por transformación de Fisher (Spearman con el error típico de Bonett y Wright, 2000). No se calculan valores p: interpreta el tamaño y la amplitud del intervalo. Con pocos jugadores el intervalo es muy ancho.</p></details>` : null}
      ${res.sufficient && mode === 'within' ? html`${res.rm.defined ? html`<div class="table-wrap"><table><thead><tr><th>Método</th><th class="num">r intra-jugador</th><th>IC 95 %</th><th class="num">Pares</th><th class="num">Jugadores</th><th class="num">gl</th></tr></thead><tbody>
        <tr><th scope="row">Correlación de medidas repetidas</th><td class="num">${nf(res.rm.r)}</td><td>${ci(res.rm.ci)}</td><td class="num">${res.rm.N}</td><td class="num">${res.rm.k}</td><td class="num">${res.rm.df}</td></tr></tbody></table></div>
        <details class="notas"><summary>Cómo se calcula</summary><p class="muted">Correlación de medidas repetidas (Bakdash y Marusich, 2017): cada jugador tiene su propio nivel y comparte una pendiente común; mide si, cuando una variable sube en un jugador, la otra tiende a subir o bajar <em>en ese mismo jugador</em>. Las líneas del gráfico unen los días de cada jugador. Es distinta de la relación entre jugadores y puede tener signo opuesto.</p></details>` : html`<p class="status warn">${res.rm.reason}</p>`}` : null}
      ${res.n ? html`<details><summary>Tabla de observaciones (${res.n})</summary><div class="table-wrap"><table><thead><tr><th>Jugador</th>${mode === 'within' ? html`<th>Fecha</th>` : html`<th>Periodo</th>`}<th class="num">${dn(xo.variable.name)}${xo.unit ? ` (${xo.unit})` : ''}</th><th class="num">${dn(yo.variable.name)}${yo.unit ? ` (${yo.unit})` : ''}</th></tr></thead>
        <tbody>${res.obs.map((o, i) => html`<tr key=${i}><th scope="row">${o.name}${o.synthetic ? ' (sintético)' : ''}</th><td>${mode === 'within' ? fmtDay(o.date) : `${fmtDay(o.from)} a ${fmtDay(o.to)}`}</td><td class="num">${nf(o.x)}</td><td class="num">${nf(o.y)}</td></tr>`)}</tbody></table></div></details>` : null}
      <p class="muted">Criterio estadístico <strong>provisional</strong>: pendiente de tu confirmación. Descripción de asociaciones; no implica causalidad.</p>
    <//>`}`;
}
