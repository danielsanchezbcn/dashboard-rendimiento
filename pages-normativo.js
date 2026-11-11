// pages-normativo.js — «Normative Benchmarking»: UN SOLO cuadro por test (sustituye a la antigua tabla «todas las variables» y al cuadro por variable). Una columna por variable
// (con dos piernas, L a la izquierda y R a la derecha, cada una con su propio percentil) y, para la base elegida (Personal Average · Personal Best · Actual), las filas:
//   Valor (% variación) · Valor (percentil La Liga) · Valor (percentil Premier League) · Valor (Natera, solo Iso-Push) · Asimetría · Asimetría (percentil La Liga).
// Todos los percentiles salen de `refContext(...).evalValor`, la misma función que usan la escala y los cursores de los gráficos: un valor y una base dan el mismo percentil en todas partes.
// Pulsar el nombre de una variable la selecciona: el gráfico longitudinal y el resto de análisis pasan a ser de esa variable.
import { html, useState, useEffect, useRef } from './libs.js';
import { orderVars, isViewable, hasData, isRelative } from './relativos.js';
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
const BASES = [['pa', 'Personal Average'], ['pb', 'Personal Best'], ['last', 'Actual']];

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
  if (!ev.sufficient || ev.percentileStat === null) return html`<span class="muted" title=${ev.reason ?? ''}>${'n<' + ev.minN}</span>`;
  return ev.band !== null ? html`<${Banda} ev=${ev} />` : html`<span class="muted" title=${ev.reason ?? ''}>P${nf(ev.percentileStat, 0)}</span>`;
}

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
  const normales = visibles.filter((v) => !isAsymVariable(v));
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
    if (k !== base) return k === 'pb' && crit ? `Personal Best (sesión con mejor ${critCorto})` : n;
    if (k === 'last') return `Actual${lastDate ? ` (${fmtDay(lastDate)})` : ''}`;
    if (k === 'pb') return crit ? `Personal Best (sesión con mejor ${critCorto})` : 'Personal Best';
    return `Personal Average${paFrom && paTo ? (paFrom === paTo ? ` (${fmtDay(paTo)})` : ` (${fmtDay(paFrom)} – ${fmtDay(paTo)})`) : ''}`;
  };
  const pick = (id) => { setQ({ v: id }); setTimeout(() => document.getElementById('detalle-variable')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 250); };
  const tipVal = (c, sd) => { const x = c.lado[sd]?.x; return x ? `${sd === 'S' ? '' : sd === 'L' ? 'Left · ' : 'Right · '}${base === 'pa' ? `${fmtDay(x.from)} a ${fmtDay(x.date)}` : fmtDay(x.date)}${c.lado[sd].act && base !== 'last' ? ` · última sesión ${fmtDay(c.lado[sd].act.date)}: ${nf(c.lado[sd].act.value)}` : ''}` : ''; };
  const rotuloVar = { last: 'Valor (% variación vs sesión previa)', pa: 'Valor (% última sesión vs Personal Average)', pb: 'Valor (% última sesión vs Personal Best)' }[base];
  const tipVar = { last: 'Entre paréntesis: variación % del resultado de la última sesión respecto a la sesión válida inmediatamente anterior, en cada pierna.', pa: 'Se muestra el Personal Average. Entre paréntesis: variación % del resultado de la última sesión respecto a ese Personal Average, en cada pierna.', pb: 'Se muestra el Personal Best. Entre paréntesis: variación % del resultado de la última sesión respecto a ese Personal Best, en cada pierna.' }[base];
  const bloques = trocear(cols, presupuestoAncho(ancho));
  const celdasLado = (c, fn, cls = '') => c.sides.map((sd) => html`<td key=${c.v.id + sd} class=${cls + (c.v.id === selectedId ? ' sel' : '')}>${fn(c.lado[sd], sd)}</td>`);
  const celdaUnica = (c, contenido) => html`<td key=${c.v.id} colSpan=${c.span} class=${c.v.id === selectedId ? 'sel' : ''}>${contenido}</td>`;
  const valorTxt = (c, l) => (c.asy ? asymText(l.x.value, 2) : nf(l.x.value));
  const tabla = (blk, i) => html`<div class="table-wrap pano-wrap" key=${'b' + i}><table class="pano norm"><caption class="sr">${dn(test.name)}: valor y percentiles de cada variable y pierna del jugador (${etq(base, '')})</caption>
    <thead><tr><td class="pano-lab"></td>${blk.map((c) => html`<th key=${c.v.id} colSpan=${c.span} scope="colgroup" class=${c.v.id === selectedId ? 'sel' : ''}><button type="button" class="pano-th" aria-pressed=${c.v.id === selectedId} title="Ver el gráfico longitudinal y el resto de análisis de esta variable" onClick=${() => pick(c.v.id)}><span class="pano-nm">${dn(c.v.name)}</span>${c.v.unit ? html`<small>${c.v.unit}</small>` : null}</button></th>`)}</tr>
      ${blk.some((c) => c.sides.length === 2) ? html`<tr class="lados"><td class="pano-lab"></td>${blk.flatMap((c) => (c.sides.length === 2 ? [html`<th key=${c.v.id + 'L'} scope="col" class="l"><abbr title="Left (izquierda)">L</abbr></th>`, html`<th key=${c.v.id + 'R'} scope="col" class="r"><abbr title="Right (derecha)">R</abbr></th>`] : [html`<th key=${c.v.id + 'S'} scope="col" class="sr">Valor</th>`]))}</tr>` : null}</thead>
    <tbody>
      <tr><th scope="row" class="pano-lab" title=${tipVar}>${rotuloVar}</th>${blk.flatMap((c) => celdasLado(c, (l, sd) => (l.x ? html`<span class=${'val ' + (sd === 'L' ? 'l' : sd === 'R' ? 'r' : '') + (c.asy ? ' ' + asimClase(l.x.value) : '')} title=${tipVal(c, sd)}><strong>${valorTxt(c, l)}</strong>${fmtVar(l.vari) ? html` <small class="var">(${fmtVar(l.vari)})</small>` : null}</span>` : html`<span class="muted" title=${l.pbReason ?? ''}>—</span>`), 'num'))}</tr>
      <tr><th scope="row" class="pano-lab" title="Percentil de cada pierna frente a la referencia de La Liga (los valores de ambas piernas de todos los jugadores juntos), con la base elegida">Valor (percentil La Liga)</th>${blk.flatMap((c) => celdasLado(c, (l) => celdaPercentil(l.ev)))}</tr>
      ${tienePl ? html`<tr><th scope="row" class="pano-lab" title="La Premier League publica cortes (P5, P25, P50, P75, P95): se indica la zona, sin interpolar. En medidas relativas es una estimación (*).">Valor (percentil Premier League)</th>${blk.flatMap((c) => (!c.hayPl ? [celdaUnica(c, html`<span class="muted" title="Sin referencia de la Premier League">—</span>`)] : celdasLado(c, (l) => (l.pl?.placed ? html`<span class=${`badge band-${l.pl.band}`}>${l.pl.text}${c.est ? '*' : ''}</span>` : l.x ? html`<span class="muted">sin ubicar</span>` : html`<span class="muted">—</span>`))))}</tr>` : null}
      ${tieneNat ? html`<tr><th scope="row" class="pano-lab" title="Clasificación de Natera (solo Run-Specific Iso-Push, fuerza máxima relativa)">Valor (Natera)</th>${blk.flatMap((c) => (!c.nat ? [celdaUnica(c, html`<span class="muted">—</span>`)] : celdasLado(c, (l) => (l.nat ? html`<span class=${`badge band-${l.nat.band}`}>${l.nat.text}</span>` : html`<span class="muted">—</span>`))))}</tr>` : null}
      ${tieneLR ? html`<tr><th scope="row" class="pano-lab" title=${'Asimetría entre piernas: |R − L| ÷ máx × 100 con la letra del lado más alto (en variables en grados: R − L en grados). Calculada con los dos valores de la base elegida.'}>Asimetría</th>${blk.map((c) => celdaUnica(c, c.sides.length === 2 && Number.isFinite(c.asim) ? html`<${AsimTexto} pct=${c.asim} texto=${esGrados(c.v) ? `${nf(Math.abs(c.asim), 1)} °${asymSideLetter(c.asim) ? ' ' + asymSideLetter(c.asim) : ''}` : null} />` : '—'))}</tr>` : null}
      ${tieneEvAsim ? html`<tr><th scope="row" class="pano-lab" title="Percentil orientativo de la asimetría de esta medida frente a la misma medida de los demás jugadores, sin importar el lado. Mayor asimetría = peor: un percentil bajo indica una asimetría grande para La Liga. No se calcula en variables en grados.">Asimetría (percentil La Liga)</th>${blk.map((c) => celdaUnica(c, c.evAsim ? celdaPercentil(c.evAsim) : '—'))}</tr>` : null}
    </tbody></table></div>`;
  // Motivos por los que no hay Personal Best (se listan en las notas; en la tabla la celda lleva el motivo como ayuda).
  const sinPB = base === 'pb' ? cols.flatMap((c) => c.sides.map((sd) => (c.lado[sd].pbReason ? `${dn(c.v.name)}${c.sides.length === 2 ? ` (${sd})` : ''}: ${c.lado[sd].pbReason}` : null)).filter(Boolean)) : [];
  const selCol = cols.find((c) => c.v.id === selectedId) ?? cols[0];
  const plRef = selCol?.ctx.plRef ?? null, natSel = selCol?.nat ?? null, unitSel = selCol?.v.unit ?? '', uSel = unitSel ? ` ${unitSel}` : '';
  const posName = positionId === null ? 'todas las posiciones' : positions.find((p) => p.id === positionId)?.name ?? 'posición eliminada';
  return html`<section class="panorama" aria-label=${`${dn(test.name)}: Normative Benchmarking`}>
    <h4 class="sec-titulo">Normative Benchmarking</h4>
    <div class="filters">
      <fieldset class="modes"><legend>Valor mostrado</legend>${bases.map(([k, n]) => html`<label class="check" key=${k}><input type="radio" name="pano-base" checked=${base === k} onChange=${() => setQ({ pn: k })} /> ${etq(k, n)}</label>`)}</fieldset>
      <label>Referencia de La Liga <select value=${rp} onChange=${(e) => setQ({ rp: e.target.value })}><option value="all">Todas las posiciones</option>${positions.map((p) => html`<option key=${p.id} value=${p.id}>${p.name}</option>`)}</select></label>
    </div>
    <${BotonesImagen} obtener=${() => refTabla.current} nombre=${`normative-benchmarking_${dn(test.name)}_${base}`} titulo=${`${playerLabel(player)} · ${dn(test.name)} · Normative Benchmarking · ${etq(base, '')}`} />
    <div ref=${refTabla} class="pano-todas">${bloques.map(tabla)}</div>
    ${sinPB.length ? html`<p class="muted">${sinPB.join(' · ')}</p>` : null}
    <${Desplegable} titulo="Notas y método de los percentiles">
      <p class="muted"><strong>Qué es cada opción y con qué datos se compara.</strong></p>
      <ul class="plain muted">
        <li><strong>Personal Average:</strong> la media de todas las sesiones válidas del jugador en el periodo y protocolo elegidos (cada sesión ya es la media de sus repeticiones; se pondera por el nº de repeticiones, y pesa 1 si no se conoce). Se compara con el Personal Average de los demás jugadores de La Liga.</li>
        <li><strong>Personal Best:</strong> el mejor resultado del jugador. Si el test define un criterio (RSI en CMJ, SL CMJ, Hop Test y Drop Jump 30/45 cm; Jump Height en Squat Jump) es el valor de la sesión con mejor criterio, de modo que todas las variables vengan de la misma sesión; si no, el mejor valor según la dirección de la variable (más alto o más bajo es mejor). Se compara con los Personal Best de los demás jugadores.</li>
        <li><strong>Actual:</strong> el valor de la última sesión válida del jugador. Se compara con el Personal Average de los demás jugadores (no con sus últimas sesiones), para situar el resultado del día frente a lo habitual en La Liga.</li>
      </ul>
      <p class="muted"><strong>Variación entre paréntesis.</strong> Con «Actual»: respecto a la sesión válida anterior. Con «Personal Average» o «Personal Best»: el resultado de la última sesión respecto a ese valor. Es (nuevo − referencia) ÷ |referencia| × 100, calculada por pierna; no se muestra si no hay sesión previa o la referencia es 0.</p>
      <p class="muted"><strong>Percentiles.</strong> Percentil exacto por rango medio. Referencia de La Liga (${posName}): un valor por jugador y base, sin sesiones excluidas, <strong>sin datos sintéticos y sin este jugador</strong>; mínimo ${minN} jugadores (cámbialo en Configuración). Con dos piernas, la referencia junta los valores izquierdo y derecho de todos los jugadores (un único P50) y <strong>el percentil de cada pierna se calcula por separado</strong> frente a ella. El percentil de rendimiento tiene en cuenta la dirección de la variable (más bajo es mejor → se invierte); si no tiene dirección, el color indica la posición en La Liga. Seis bandas de color según la guía. «n&lt;${minN}» = muestra insuficiente. Pasa el cursor sobre un valor para ver sus fechas.</p>
      <p class="muted"><strong>Asimetría.</strong> |R − L| ÷ máx × 100 con la letra del lado más alto (en variables en grados, R − L en grados). Su percentil se calcula frente a las asimetrías de los demás jugadores en la misma base (mayor asimetría = peor) y es orientativo.</p>
      ${selCol ? html`<p class="muted"><strong>${dn(selCol.v.name)}</strong> (variable seleccionada):</p>` : null}
      ${natSel ? html`<p class="muted">Natera (${natSel.unit}): Normal desde ${nf(natSel.normal, 2)} · Good desde ${nf(natSel.good, 2)} · Excellent desde ${nf(natSel.excellent, 2)}. Fuente: ${NATERA_SOURCE}. Los límites se aplican como intervalos continuos (la fuente publica rangos con huecos de redondeo). Por debajo de «Normal» la fuente no da etiqueta: se muestra en rojo por decisión del usuario. No se ha verificado si los umbrales son por lado o por jugador; se aplican a cada lado.</p>` : null}
      ${abs ? html`<p class="muted">Medida relativa (${unitSel}): los percentiles de La Liga se calculan sobre esta medida relativa.${plRef?.estimated ? html` Premier League, ESTIMADA: la Premier publica fuerza (N) y masa corporal (P5 72,0 · P25 76,6 · P50 81,8 · P75 88,2 · P95 97,1 kg) por separado, no la relación entre ambas. Cortes estimados (${unitSel}) P5/P25/P50/P75/P95 = ${plRef.cuts.map((c) => nf(c, 2)).join(' · ')}; rango posible entre dispersión mínima y máxima: ${plRef.range.lo.map((a, i) => `${nf(a, 2)}–${nf(plRef.range.hi[i], 2)}`).join(' · ')} (la mediana es la misma en ambos extremos).` : ''}</p>` : null}
      ${!plRef ? html`<p class="muted">Esta variable no figura en las tablas de la Premier League aportadas (${PREMIER_SEASON}): no tiene percentil de la Premier League.</p>`
        : html`<p class="muted">Premier League (${PREMIER_SEASON}, tabla «In Season»${plRef.unitConverted ? ', convertida a la unidad del catálogo' : ''}): se indica la zona entre los cortes publicados (P5, P25, P50, P75, P95), sin interpolar percentiles. P50 = ${nf(plRef.cuts[2], 3)}${uSel}. Los umbrales de la Premier no están validados como de rendimiento. * = estimada.</p>`}
    <//>
  </section>`;
}
