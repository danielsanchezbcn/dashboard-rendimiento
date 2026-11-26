// pages-asociaciones.js — fase 6c: vista exploratoria de relaciones entre variables. Criterio estadístico PROVISIONAL (pendiente de confirmar).
import { Copiable } from './copiar.js';
import { html } from './libs.js';
import { useApp } from './context.js';
import { Card, Desplegable, useLoad } from './componentes.js';
import { getSetting } from './db.js';
import { fmtDay } from './fechas.js';
import { listCatalog } from './catalogo.js';
import { listPositions } from './posiciones.js';
import { replaceQuery } from './rutas.js';
import { MIN_N_DEFAULT, BANDS } from './percentiles.js';
import { expandRelative } from './relativos.js';
import { withReferenceWeights } from './relaciones.js';
import { variableOptions, crossSectional, withinPlayer, BASES_TW } from './asociaciones.js';
import { columnasDeTest, tablaPlantilla, rankingVariable, matrizCorrelaciones } from './teamwide.js';
import { dn } from './nombres.js';

const nf = (n, d = 2) => (n === null || n === undefined ? '—' : Number(n).toLocaleString('es-ES', { maximumFractionDigits: d }));
const BANDAS = BANDS.map((b) => b.key); // las claves de color salen de percentiles.js: una sola definición
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
  // Qué observaciones llevan el alias escrito: todas en «entre jugadores»; en «dentro del jugador», la última de cada jugador.
  const etiquetado = new Set(res.mode === 'cross' ? res.obs.map((_, i) => i) : [...Map.groupBy(res.obs.map((o, i) => ({ o, i })), (r) => r.o.id).values()].map((g) => g.at(-1).i));
  const xl = `${dn(xo.test.name)} · ${dn(xo.variable.name)}${xo.unit ? ` (${xo.unit})` : ''}${xo.side !== 'S' ? ` · ${xo.side === 'L' ? 'Izq.' : xo.side === 'R' ? 'Der.' : 'Media'}` : ''}`;
  const yl = `${dn(yo.test.name)} · ${dn(yo.variable.name)}${yo.unit ? ` (${yo.unit})` : ''}${yo.side !== 'S' ? ` · ${yo.side === 'L' ? 'Izq.' : yo.side === 'R' ? 'Der.' : 'Media'}` : ''}`;
  return html`<${Copiable} nombre="dispersion"><svg class="scatter" viewBox=${`0 0 ${W} ${H}`} width="100%" role="img" aria-label=${`Dispersión: ${xl} (horizontal) frente a ${yl} (vertical), ${res.n} observaciones`}>
    ${xt.map((t) => html`<g key=${'x' + t}><line x1=${X(t)} x2=${X(t)} y1=${T} y2=${H - B} class="gridline" /><text x=${X(t)} y=${H - B + 16} text-anchor="middle">${nf(t, 1)}</text></g>`)}
    ${yt.map((t) => html`<g key=${'y' + t}><line x1=${L} x2=${W - R} y1=${Y(t)} y2=${Y(t)} class="gridline" /><text x=${L - 6} y=${Y(t) + 4} text-anchor="end">${nf(t, 1)}</text></g>`)}
    <line x1=${L} x2=${W - R} y1=${H - B} y2=${H - B} class="axis" /><line x1=${L} x2=${L} y1=${T} y2=${H - B} class="axis" />
    ${lines.map((g, i) => html`<polyline key=${i} points=${g.map((o) => `${X(o.x)},${Y(o.y)}`).join(' ')} fill="none" stroke="var(--muted)" stroke-width="1" opacity="0.6" />`)}
    ${/* 26/11/2026 (pedido del usuario): en lugar de un punto se escribe el ALIAS del jugador, para que la imagen se pueda copiar y leer directamente.
         En el análisis intra-jugador cada jugador aporta varios días unidos por una línea: ahí solo se rotula el último punto de cada línea, y los
         demás siguen siendo un punto pequeño, porque repetir el alias en cada día taparía el gráfico. */ ''}
    ${res.obs.map((o, i) => (etiquetado.has(i)
      ? html`<text key=${i} x=${X(o.x)} y=${Y(o.y) + 3} text-anchor="middle" class="scatter-alias">${o.alias}<title>${o.name}${o.date ? ` · ${fmtDay(o.date)}` : ''}: ${nf(o.x)} ; ${nf(o.y)}${o.synthetic ? ' (sintético)' : ''}</title></text>`
      : html`<circle key=${i} cx=${X(o.x)} cy=${Y(o.y)} r="2.5" class="scatter-pt"><title>${o.name}${o.date ? ` · ${fmtDay(o.date)}` : ''}: ${nf(o.x)} ; ${nf(o.y)}${o.synthetic ? ' (sintético)' : ''}</title></circle>`))}
    <text x=${(L + W - R) / 2} y=${H - 8} text-anchor="middle" class="axlabel">${xl}</text>
    <text transform=${`translate(14 ${(T + H - B) / 2}) rotate(-90)`} text-anchor="middle" class="axlabel">${yl}</text>
  </svg><//>`;
}


// ---- Mapa de calor de percentiles (26/11/2026): una fila por jugador, una columna por variable y lado. El color es la banda del percentil de La
// Liga y el número de dentro, el valor en sus unidades: el color nunca es el único canal de información.
function MapaCalor({ tabla, unidadDe }) {
  if (!tabla.filas.length) return html`<p class="muted">Ningún jugador de esta población tiene datos de este test.</p>`;
  return html`<${Copiable} nombre="mapa-calor"><div class="table-wrap"><table class="calor">
    <thead><tr><th scope="col">Jugador</th>${tabla.cols.map((c) => html`<th key=${c.key} scope="col"><span class="calor-var">${dn(c.variable.name)}</span>${c.side !== 'S' ? html`<small class=${c.side === 'L' ? 'asim-l' : 'asim-r'}>${c.side}</small>` : null}${unidadDe(c) ? html`<small>${unidadDe(c)}</small>` : null}</th>`)}<th scope="col" class="num">Percentil medio</th></tr></thead>
    <tbody>${tabla.filas.map((f) => html`<tr key=${f.id}><th scope="row" title=${f.name}>${f.alias}${f.synthetic ? html` <span class="muted">(sintético)</span>` : null}</th>
      ${f.celdas.map((x) => html`<td key=${x.key} class=${'calor-c' + (x.ev && x.ev.band !== null ? ' band-' + BANDAS[x.ev.band] : '')} title=${x.value === null ? (x.razon ?? 'Sin dato') : x.ev && !x.ev.sufficient ? `Muestra insuficiente: ${x.ev.n} de ${x.ev.minN}` : ''}>
        ${x.value === null ? html`<span class="muted">—</span>` : html`<span class="calor-v">${nf(x.value)}</span>${x.ev && x.ev.sufficient && x.ev.percentilePerf !== null ? html`<small class="calor-p">p${nf(x.ev.percentilePerf, 0)}</small>` : html`<small class="calor-p muted">n&lt;${x.ev?.minN ?? ''}</small>`}`}</td>`)}
      <td class="num">${f.medio === null ? html`<span class="muted">—</span>` : nf(f.medio, 0)}</td></tr>`)}</tbody></table></div><//>`;
}

// ---- Ranking de la plantilla en una variable: una barra por jugador, mejor arriba, con el P50 y el P75 de la referencia marcados.
function Ranking({ res, etiqueta }) {
  if (!res.filas.length) return html`<p class="muted">Ningún jugador de esta población tiene datos de esta variable.</p>`;
  const vals = res.filas.map((f) => f.value).concat([res.p50, res.p75].filter((x) => x !== null));
  const min = Math.min(0, ...vals), max = Math.max(...vals) * 1.02 || 1;
  const W = 640, filaH = 22, T = 30, B = 28, L = 86, R = 58;
  const H = T + res.filas.length * filaH + B;
  const X = (v) => L + ((v - min) / (max - min || 1)) * (W - L - R);
  return html`<${Copiable} nombre="ranking"><svg class="scatter ranking" viewBox=${`0 0 ${W} ${H}`} width="100%" role="img" aria-label=${`Ranking de la plantilla en ${etiqueta}: ${res.n} jugadores`}>
    ${/* Las dos referencias pueden caer casi encima: la del P75 se escribe una línea más abajo para que no se solapen. */ ''}
    ${[['p50', res.p50, 'P50', T - 15], ['p75', res.p75, 'P75', T - 4]].filter(([, v]) => v !== null).map(([k, v, t, yt]) => html`<g key=${k}>
      <line x1=${X(v)} x2=${X(v)} y1=${T - 1} y2=${H - B} class="gridline ranking-ref" /><text x=${X(v)} y=${yt} text-anchor="middle" class="ranking-reft">${t} ${nf(v, 2)}</text></g>`)}
    ${res.filas.map((f, i) => { const y = T + i * filaH; const banda = f.ev && f.ev.band !== null ? BANDAS[f.ev.band] : null; return html`<g key=${f.id}>
      <text x=${L - 6} y=${y + 13} text-anchor="end" class="ranking-nm">${f.alias}</text>
      <rect x=${L} y=${y + 4} width=${Math.max(1, X(f.value) - L)} height=${filaH - 9} class=${'ranking-b' + (banda ? ' band-' + banda : '')}><title>${f.name}: ${nf(f.value)}${f.ev && f.ev.sufficient ? ` · percentil ${nf(f.ev.percentilePerf, 0)}` : ''}</title></rect>
      <text x=${X(f.value) + 5} y=${y + 13} class="ranking-v">${nf(f.value)}${f.ev && f.ev.sufficient && f.ev.percentilePerf !== null ? ` · p${nf(f.ev.percentilePerf, 0)}` : ''}</text></g>`; })}
    <line x1=${L} x2=${L} y1=${T - 4} y2=${H - B + 2} class="axis" />
    <text x=${(L + W - R) / 2} y=${H - 8} text-anchor="middle" class="axlabel">${etiqueta}</text>
  </svg><//>`;
}

// ---- Matriz de correlaciones: Spearman entre cada variable de A y cada una de B, con una observación por jugador.
function Matriz({ res }) {
  const col = (r) => (r === null ? '' : Math.abs(r) >= 0.7 ? ' m-alta' : Math.abs(r) >= 0.4 ? ' m-media' : ' m-baja');
  return html`<${Copiable} nombre="matriz"><div class="table-wrap"><table class="matriz">
    <thead><tr><th></th>${res.columnas.map((c) => html`<th key=${c.key} scope="col"><span class="calor-var">${dn(c.variable.name)}</span>${c.side !== 'S' ? html`<small class=${c.side === 'L' ? 'asim-l' : 'asim-r'}>${c.side}</small>` : null}</th>`)}</tr></thead>
    <tbody>${res.filas.map((a, i) => html`<tr key=${a.key}><th scope="row">${dn(a.variable.name)}${a.side !== 'S' ? html` <small class=${a.side === 'L' ? 'asim-l' : 'asim-r'}>${a.side}</small>` : null}</th>
      ${res.celdas[i].map((x, j) => html`<td key=${j} class=${'matriz-c' + (x.misma ? ' m-misma' : x.r === null ? '' : col(x.r))} title=${x.misma ? 'La misma variable' : x.sufficient ? `${x.n} jugadores${x.ci ? ` · IC 95 % ${nf(x.ci[0])} a ${nf(x.ci[1])}` : ''}` : `Muestra insuficiente: ${x.n} de ${x.minN}`}>
        ${x.misma ? html`<span class="muted">—</span>` : x.r === null ? html`<span class="muted">${x.sufficient ? 'n/d' : `n=${x.n}`}</span>` : nf(x.r)}</td>`)}</tr>`)}</tbody></table></div><//>`;
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
  // Base de toda la sección (26/11/2026): con qué valor de cada jugador se trabaja. En «dentro del jugador» no se aplica: ahí cada observación es
  // un día concreto, no un resumen del jugador.
  const basis = BASES_TW.some(([k]) => k === query.tb) ? query.tb : 'pa';
  const playersById = Object.fromEntries(data.players.map((p) => [p.id, p]));
  const histories = {}; for (const r of data.records) (histories[r.playerId] ??= []).push(r);
  let res = null, problem = null;
  if (xo && yo) {
    if (xo.key === yo.key) problem = 'Elige dos variables distintas.';
    else {
      const args = { sessions: data.sessions, players: playersById, histories, x: xo, y: yo, from: query.from, to: query.to, posQ, includeSynthetic: syn, minN: data.minN, basis };
      res = mode === 'cross' ? crossSectional(args) : withinPlayer(args);
    }
  }
  // Cuadros nuevos (26/11/2026): comparten base, población, periodo y datos sintéticos con la selección de arriba.
  const comun = { sessions: data.sessions, players: playersById, histories, basis, posQ, includeSynthetic: syn, minN: data.minN, from: query.from || null, to: query.to || null };
  const testsConDatos = data.catalog.tests.filter((t) => !t.archived && data.sessions.some((s) => s.testId === t.id));
  const selTest = (name, val) => html`<select value=${val ?? ''} onChange=${(e) => set({ [name]: e.target.value })}><option value="">— Elige un test —</option>${testsConDatos.map((t) => html`<option key=${t.id} value=${t.id}>${dn(t.name)}</option>`)}</select>`;
  const testCalor = query.tc ?? '';
  const colsCalor = testCalor ? columnasDeTest(data.catalog, data.sessions, testCalor) : [];
  const tablaCalor = colsCalor.length ? tablaPlantilla({ ...comun, cols: colsCalor }) : null;
  const optsRank = testsConDatos.flatMap((t) => columnasDeTest(data.catalog, data.sessions, t.id).map((c) => ({ ...c, label: `${dn(t.name)} · ${dn(c.variable.name)}${c.unit ? ` (${c.unit})` : ''}${c.side !== 'S' ? ` · ${c.side}` : ''}` })));
  const colRank = optsRank.find((o) => o.key === query.rk) ?? null;
  const resRank = colRank ? rankingVariable({ ...comun, col: colRank }) : null;
  const testA = query.ma ?? '', testB = query.mb ?? '';
  const colsA = testA ? columnasDeTest(data.catalog, data.sessions, testA) : [];
  const colsB = testB ? columnasDeTest(data.catalog, data.sessions, testB) : [];
  const resMatriz = colsA.length && colsB.length ? matrizCorrelaciones({ ...comun, filas: colsA, columnas: colsB }) : null;
  const select = (name, val) => html`<select value=${val ?? ''} onChange=${(e) => set({ [name]: e.target.value })}><option value="">— Elige una variable —</option>${opts.map((o) => html`<option key=${o.key} value=${o.key}>${o.label}</option>`)}</select>`;
  return html`<h2 class="page-title">Team-Wide Analysis</h2>
    <${Card} titulo="Selección">
      <details class="notas"><summary>Aviso metodológico</summary><p class="muted"><strong>Exploratorio y descriptivo:</strong> muestra asociaciones, no causas, y no sugiere decisiones de entrenamiento ni médicas. Elige explícitamente las dos variables, el periodo y la población. Las sesiones excluidas no cuentan. Las variables en distintas unidades no se normalizan: cada eje lleva su unidad.</p></details>
      <div class="filters">
        <label>Variable horizontal (X) ${select('x', query.x)}</label>
        <label>Variable vertical (Y) ${select('y', query.y)}</label>
        <label>Posición <select value=${posQ} onChange=${(e) => set({ pos: e.target.value })}><option value="all">Todas</option><option value="none">Sin posición</option>${data.positions.map((p) => html`<option key=${p.id} value=${p.id}>${p.name}</option>`)}</select></label>
        <label>Desde <input type="date" value=${query.from ?? ''} onInput=${(e) => set({ from: e.target.value })} /></label>
        <label>Hasta <input type="date" value=${query.to ?? ''} onInput=${(e) => set({ to: e.target.value })} /></label>
      </div>
      <fieldset class="modes" disabled=${mode === 'within'} title=${mode === 'within' ? 'En el análisis dentro del jugador cada observación es un día, no un resumen del jugador.' : ''}><legend>Valor de cada jugador</legend>
        ${BASES_TW.map(([k, n]) => html`<label class="check" key=${k}><input type="radio" name="tw-base" disabled=${mode === 'within'} checked=${basis === k} onChange=${() => set({ tb: k })} /> ${n}</label>`)}</fieldset>
      <fieldset class="modes"><legend>Tipo de análisis</legend>
        <label class="check"><input type="radio" name="am" checked=${mode === 'cross'} onChange=${() => set({ m: 'cross' })} /> Entre jugadores (una observación por jugador, con el valor elegido arriba)</label>
        <label class="check"><input type="radio" name="am" checked=${mode === 'within'} onChange=${() => set({ m: 'within' })} /> Dentro del jugador (pares del mismo jugador y el mismo día; correlación de medidas repetidas)</label>
      </fieldset>
      <label class="check"><input type="checkbox" checked=${syn} onChange=${(e) => set({ syn: e.target.checked ? '1' : undefined })} /> Incluir datos sintéticos (solo para probar)</label>
    <//>
    ${!opts.length ? html`<p class="muted">Aún no hay variables con datos.</p>` : !xo || !yo ? html`<p class="muted">Elige las dos variables para ver la relación. No hay selección por defecto.</p>` : problem ? html`<p class="status warn">${problem}</p>` : html`
    <${Card} titulo=${mode === 'cross' ? 'Entre jugadores' : 'Dentro del jugador'}>
      ${res.hasSynthetic ? html`<p class="status warn">Este gráfico incluye datos sintéticos de demostración.</p>` : null}
      <p><strong>Población y periodo:</strong> ${posQ === 'all' ? 'todos los jugadores' : posQ === 'none' ? 'jugadores sin posición' : `posición ${data.positions.find((p) => String(p.id) === posQ)?.name ?? '—'}`}${syn ? '' : ' (sin datos sintéticos)'}; ${query.from || query.to ? `${query.from ? fmtDay(query.from) : 'inicio'} a ${query.to ? fmtDay(query.to) : 'hoy'}` : 'toda la historia'}. <strong>Observaciones:</strong> ${res.n}${res.mode === 'within' ? ` pares de ${res.players} jugadores` : ` jugadores`}.${res.mode === 'cross' ? html` <strong>Valor de cada jugador:</strong> ${BASES_TW.find(([k]) => k === basis)[1]}.` : ''}</p>
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
      <${Desplegable} titulo="Criterio estadístico (provisional)"><p class="muted">Criterio estadístico <strong>provisional</strong>: pendiente de tu confirmación. Descripción de asociaciones; no implica causalidad.</p><//>
    <//>`}

    ${/* 26/11/2026: tres cuadros que abarcan toda la base de datos, con la misma base (Latest / PA / PB), población y periodo de arriba. */ ''}
    <${Card} titulo="Mapa de calor de percentiles">
      <p class="muted">Una fila por jugador y una columna por variable y pierna: el número es el valor en sus unidades y el color, la banda del percentil de La Liga. Los jugadores van del percentil medio más bajo al más alto, para ver primero dónde hay que mirar. No se usa la media de las dos piernas: la referencia junta izquierda y derecha, así que cada pierna lleva su columna.</p>
      <div class="filters"><label>Test ${selTest('tc', testCalor)}</label></div>
      ${!colsCalor.length ? html`<p class="muted">Elige un test con datos.</p>` : html`<${MapaCalor} tabla=${tablaCalor} unidadDe=${(c) => c.unit} />`}
    <//>

    <${Card} titulo="Ranking de la plantilla">
      <p class="muted">Una barra por jugador en una variable, con el mejor arriba según la dirección de la variable, el valor y su percentil escritos, y las líneas del P50 y el P75 de la referencia de La Liga.</p>
      <div class="filters"><label>Variable ${html`<select value=${query.rk ?? ''} onChange=${(e) => set({ rk: e.target.value })}><option value="">— Elige una variable —</option>${optsRank.map((o) => html`<option key=${o.key} value=${o.key}>${o.label}</option>`)}</select>`}</label></div>
      ${!colRank ? html`<p class="muted">Elige una variable.</p>` : html`<${Ranking} res=${resRank} etiqueta=${`${dn(colRank.test.name)} · ${dn(colRank.variable.name)}${colRank.unit ? ` (${colRank.unit})` : ''}${colRank.side !== 'S' ? ` · ${colRank.side}` : ''}`} />`}
      ${colRank && resRank.direccion === null ? html`<p class="status warn">Esta variable no tiene dirección «mejor/peor» en el catálogo: el orden es de mayor a menor y el color del percentil solo indica su posición en La Liga.</p>` : null}
    <//>

    <${Card} titulo="Matriz de correlaciones">
      <p class="muted">Spearman ρ entre cada variable del primer test y cada una del segundo, con una observación por jugador (el valor elegido arriba). Si eliges el mismo test en los dos, sale la matriz del test consigo mismo. Las celdas con menos jugadores que la muestra mínima no se calculan.</p>
      <div class="filters"><label>Test (filas) ${selTest('ma', testA)}</label><label>Test (columnas) ${selTest('mb', testB)}</label></div>
      ${!colsA.length || !colsB.length ? html`<p class="muted">Elige dos tests con datos.</p>` : html`<${Matriz} res=${resMatriz} />`}
    <//>`;
}
