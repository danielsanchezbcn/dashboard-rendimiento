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
import { PAL, colorLado } from './colores.js';
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
  return html`<span class=${'band band-' + b.key} title=${`${b.name} (P${b.range})`}>${nf(ev.percentilePerf, 0)} · ${b.name}</span>`;
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
      chart = new Chart(ref.current, { type: 'bar', data: { labels, datasets }, options: { responsive: true, maintainAspectRatio: false, animation: false, plugins: { legend: { labels: { color: PAL.texto } } }, scales: { x: { ticks: { color: PAL.texto }, grid: { color: PAL.rejilla } }, y: { title: { display: !!unit, text: unit ?? '', color: PAL.texto }, ticks: { color: PAL.texto }, grid: { color: PAL.rejilla } } } } });
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
    ...rows.filter((r) => r.ev.p50 != null && r.ev.sufficient).map((r) => ({ key: 'll' + r.side, v: r.ev.p50, icon: ICONO_LALIGA, color: PAL.laLiga, p50: true, label: `La Liga, mediana (P50)${r.side === 'S' ? '' : ' ' + SIDE[r.side]}: ${nfv(r.ev.p50)} ${unit ?? ''}, N = ${r.ev.n}` })),
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
    ${rows.map((r, i) => html`<g key=${'p' + r.side}><title>${SIDE[r.side]}: ${nfv(r.value)} ${unit ?? ''}</title>
      <circle cx=${cx[i]} cy=${y0 + 28} r="11" fill=${colorLado(r.side)} />
      ${r.side === 'S' ? null : html`<text x=${cx[i]} y=${y0 + 32} text-anchor="middle" font-size="12" font-weight="700" fill=${PAL.fondo}>${r.side}</text>`}
      <text x=${cx[i] + (close ? (cx[i] === Math.min(...cx) ? 4 : -4) : 0)} y=${y0 + 56} text-anchor=${close ? (cx[i] === Math.min(...cx) ? 'end' : 'start') : 'middle'} font-size="12" fill=${T}>${nfv(r.value)}</text></g>`)}
    ${asym != null && rows.length === 2 ? html`<g><path d=${`M ${cx[0]} ${y0 + 72} v 6 H ${cx[1]} v -6`} fill="none" stroke=${T} stroke-opacity="0.6" /><text x=${Math.min(W - 90, Math.max(90, (cx[0] + cx[1]) / 2))} y=${y0 + 94} text-anchor="middle" font-size="12" fill=${T}>Asimetría ${asymText(asym)}</text></g>` : null}
    <text x=${L} y=${Hs - 6} text-anchor="start" font-size="11" fill=${T}>${nfv(min)} ${unit ?? ''}</text><text x=${W - R} y=${Hs - 6} text-anchor="end" font-size="11" fill=${T}>${nfv(max)} ${unit ?? ''}</text>
  </svg></div><//>${out ? html`<p class="muted">Algún valor queda fuera del rango de la referencia de La Liga: la escala se ha ampliado para mostrarlo.</p>` : null}`;
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

export function PercentilesPanel({ player, test, variable, mine, q, setQ, filters, targets = {} }) {
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
  const plRef = findPremier(test, variable);
  const refOk = (b, s) => calc[b][s]?.ev.sufficient && calc[b][s].ev.p50 != null;
  return html`<section class="refs"><h4>Percentiles frente a «La Liga» (base de datos propia)</h4>
    <div class="filters"><label>Referencia <select value=${rp} onChange=${(e) => setQ({ rp: e.target.value })}><option value="all">Todas las posiciones</option>${positions.map((p) => html`<option key=${p.id} value=${p.id}>${p.name}</option>`)}</select></label></div>
    <div class="table-wrap"><table><caption>Percentiles de ${variable.name}${unit ? ` (${unit})` : ''}: La Liga y Premier League${plRef ? ` (${PREMIER_SEASON})` : ''}</caption>
      <thead><tr><th rowspan="2">Lado</th><th rowspan="2">Base</th><th rowspan="2" class="num">Valor</th><th colspan="3" scope="colgroup">La Liga</th><th colspan="3" scope="colgroup">Premier League</th></tr>
        <tr><th scope="col">Percentil de rendimiento</th><th scope="col" class="num">N</th><th scope="col" class="num">P50</th><th scope="col" class="num">P50</th><th scope="col" class="num">P95</th><th scope="col">Ubicación</th></tr></thead>
      <tbody>${sides.flatMap((s) => ['pa', 'last'].map((b) => { const c = calc[b][s]; if (!c) return null; const pl = plRef ? placeAgainstPremier(plRef, c.mine.value) : null; return html`<tr key=${s + b}>
        <th scope="row">${SIDE[s]}</th><td>${BASIS[b]}</td><td class="num">${isAsymVariable(variable) ? asymText(c.mine.value, 2) : html`${nfv(c.mine.value)}${unit ? ` ${unit}` : ''}`}</td>
        <td><${CeldaPercentil} ev=${c.ev} /></td><td class="num">${c.ev.n}</td><td class="num">${c.ev.sufficient ? nfv(c.ev.p50) : '—'}</td>
        <td class="num">${plRef ? nf(plRef.cuts[2], 3) : '—'}</td><td class="num">${plRef ? nf(plRef.cuts[4], 3) : '—'}</td>
        <td>${pl?.placed ? html`<span class=${`badge band-${pl.band}`}>${pl.text}</span>` : plRef ? html`<span class="muted">sin ubicar</span>` : '—'}</td></tr>`; }))}</tbody></table></div>
    ${!plRef ? html`<p class="muted">Esta variable no figura en las tablas de la Premier League aportadas (${PREMIER_SEASON}): no tiene percentil de la Premier League.</p>`
      : html`<p class="muted">Premier League (${PREMIER_SEASON}, tabla «In Season»${plRef.unitConverted ? ', convertida a la unidad del catálogo' : ''}): se muestran la mediana (P50) y el P95; la zona se calcula con los cinco cortes publicados (P5–P95), sin interpolar percentiles. Color: cada una de las seis zonas lleva la banda de su orden (rojo = más allá del P5 … verde = P95 o más); los umbrales de la Premier no están validados como de rendimiento.${shown.some((r) => placeAgainstPremier(plRef, r.value)?.placed === false) ? ' ' + placeAgainstPremier(plRef, shown[0].value).reason : ''}</p>`}
    <p class="muted">Método: percentil exacto por rango medio (% de valores menores + la mitad de los iguales). Referencia: un valor por jugador (${basisShown === 'pa' ? 'su Personal Average' : 'el Average de su última sesión válida'}), ${posName}, sin sesiones excluidas, <strong>sin datos sintéticos y sin este jugador</strong>; mínimo ${minN} jugadores (cámbialo en Configuración). El percentil de rendimiento tiene en cuenta la dirección de la variable; el color sigue las seis bandas de la guía.</p>
    <${NateraBloque} test=${test} variable=${variable} shown=${shown} />
    <fieldset class="modes"><legend>Marcadores de la escala</legend>${['pa', 'last'].map((b) => html`<label class="check" key=${b}><input type="radio" name="rb" checked=${basisShown === b} onChange=${() => setQ({ rb: b })} /> ${BASIS[b]}</label>`)}</fieldset>
    ${shown.length ? html`<${EscalaG4} rows=${shown} unit=${unit} asym=${asym} premierP50=${plRef ? plRef.cuts[2] : null} target=${sides.map((sd) => targets[sd]).filter(Boolean).filter((t, i, a) => a.findIndex((u) => u.value === t.value) === i)} />` : null}
    ${shown.some((r) => r.ev.n && !r.ev.sufficient) ? html`<p class="status warn">Muestra insuficiente para clasificar: no se dibuja la mediana ni se colorea (N inferior a ${minN}).</p>` : null}
    ${g2.length ? html`<h4>Valor de la última sesión, Personal Average y referencia</h4><${GraficoG2} unit=${unit} label=${`Barras de ${variable.name}: última sesión, Personal Average y mediana de La Liga`} labels=${g2.map((s) => SIDE[s])}
      datasets=${[{ label: 'Última sesión válida', data: g2.map((s) => calc.last[s]?.mine.value ?? null), backgroundColor: PAL.jugador }, { label: 'Personal Average', data: g2.map((s) => calc.pa[s]?.mine.value ?? null), backgroundColor: PAL.lila }, ...(g2.some((s) => refOk('pa', s)) ? [{ label: 'La Liga (mediana de Personal Average)', data: g2.map((s) => (refOk('pa', s) ? calc.pa[s].ev.p50 : null)), backgroundColor: PAL.laLiga }] : []), ...(plRef ? [{ label: 'Premier League (P50)', data: g2.map(() => plRef.cuts[2]), backgroundColor: PAL.premier }] : [])]} />` : null}
  </section>`;
}
