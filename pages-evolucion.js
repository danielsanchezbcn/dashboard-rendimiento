// pages-evolucion.js — fase 5a: resultados del jugador por bloque, gráfico de evolución (G1), asimetría (G5) y gestión de sesiones.
import './fuentes.js';
import { html, useState, useEffect, useRef, Chart } from './libs.js';
import { useApp } from './context.js';
import { Card, Desplegable, Msg, useLoad, useRunner, agruparFiltros, SelectorVariable } from './componentes.js';
import { fmtDay, todayIso } from './fechas.js';
import { addManualLoad, LOAD_VARIABLE_NAMES } from './isohold.js';
import { listCatalog, SIDES } from './catalogo.js';
import { replaceQuery, buildHash } from './rutas.js';
import { Migas, KEEP, NotaRelativa } from './pages-test.js';
import { RelacionTest, OrzTest, RatioTest } from './pages-relaciones.js';
import { expandRelative, isViewable, hasData, orderVars, isRelative, defaultVar, prefiereRsi } from './relativos.js';
import { PercentilesPanel, useRefData, refContext } from './pages-percentiles.js';
import { positionOnDate } from './posiciones.js';
import { withReferenceWeights } from './relaciones.js';
import { isAsymVariable, asymText, esGrados } from './catalogo.js';
import { AsimTexto } from './asim-ui.js';
import { Deficits } from './pages-deficits.js';
import { PanelAsimetrias } from './pages-asimetrias.js';
import { setTarget, deleteTarget, resolveTarget, distanceToTarget } from './targets.js';
import { buildSeries, personalAverage, personalBestFor, currentResult, asymmetrySeries, asymmetryValueSeries, setSessionExcluded, deleteSessionPermanently, correctSession } from './evolucion.js';
import { playerLabel, nameMatchesPlayer } from './jugadores.js';
import { findNatera, NATERA_HEX } from './natera.js';
import { PAL, colorLado } from './colores.js';
import { buildReference } from './percentiles.js';
import { consecutiveDiffs, changeTest } from './cambio.js';
import { Copiable } from './copiar.js';
import { RadarPanel } from './pages-radar.js';
import { Angulos } from './pages-angulos.js';
import { NormativeBenchmarking } from './pages-normativo.js';
import { ICONO_TARGET } from './iconos.js';
import { dn } from './nombres.js';

// Bandera de Target (icono del usuario): se dibuja al final de la línea de target.
const flagImg = typeof Image === 'undefined' ? null : Object.assign(new Image(), { src: ICONO_TARGET });
const flagPlugin = { id: 'banderaTarget', afterDatasetsDraw(chart) {
  const i = chart.data.datasets.findIndex((d) => d.bandera); if (i < 0 || !flagImg?.complete || !flagImg.naturalWidth) return;
  const meta = chart.getDatasetMeta(i); const pt = meta.data[meta.data.length - 1]; if (!pt) return;
  const h = 26, w = h * (flagImg.naturalWidth / flagImg.naturalHeight);
  chart.ctx.drawImage(flagImg, pt.x - w * 0.75, pt.y - h - 2, w, h);
} };


const nf = (n, d = 2) => (n === null || n === undefined ? '—' : Number(n).toLocaleString('es-ES', { maximumFractionDigits: d }));
// Etiqueta de una variable en los selectores (el de arriba y los que hay bajo cada título): nombre, unidad si no viene ya en el nombre, y «I/D» si tiene dos lados.
const varLabel = (v) => `${dn(v.name)}${v.unit && !v.name.includes(`(${v.unit})`) ? ` (${v.unit})` : ''}${v.sides === 'LR' ? ' · I/D' : ''}`;
const dayNum = (iso) => Date.parse(iso + 'T00:00:00Z') / 86400000;
const dayFromNum = (n) => new Date(n * 86400000).toISOString().slice(0, 10);

// Colores del tema actual (variables CSS): el gráfico se vuelve a crear si cambia el tema del sistema.
const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
function useTheme() {
  const [n, setN] = useState(0);
  useEffect(() => {
    const m = window.matchMedia?.('(prefers-color-scheme: dark)');
    const f = () => setN((x) => x + 1);
    m?.addEventListener?.('change', f);
    return () => m?.removeEventListener?.('change', f);
  }, []);
  return n;
}

// Gráfico con Chart.js (solo líneas/puntos/barras, D20) con el aspecto de los informes del usuario (fondo oscuro, colores de colores.js).
// `build` recibe los colores y devuelve la configuración. Clic sobre el gráfico: copiar imagen.
function Grafico({ build, label, deps, nombre = 'grafico', alto, onPoint = null }) {
  const ref = useRef(null);
  const hit = useRef(null); // un clic sobre un punto selecciona la medida y no abre el menú de copiar
  useEffect(() => {
    if (!ref.current || !Chart) return undefined;
    const colors = { text: PAL.texto, muted: PAL.texto, line: PAL.rejilla, accent: PAL.jugador, ok: PAL.texto, fail: PAL.jugador, warn: PAL.texto };
    let chart;
    try {
      const cfg = build(colors);
      if (onPoint) {
        const punto = (els) => { const x = els.find((el) => cfg.data.datasets[el.datasetIndex].side && cfg.data.datasets[el.datasetIndex].data[el.index]?.p); return x ? { side: cfg.data.datasets[x.datasetIndex].side, p: cfg.data.datasets[x.datasetIndex].data[x.index].p } : null; };
        cfg.options.interaction = { mode: 'nearest', intersect: true };
        cfg.options.onClick = (e, els) => { const pt = punto(els); if (pt) onPoint(pt.side, pt.p); };
        hit.current = { punto, cfg };
        cfg.options.onHover = (e, els) => { if (e.native?.target) e.native.target.style.cursor = punto(els) ? 'pointer' : 'default'; };
      }
      chart = new Chart(ref.current, { plugins: [flagPlugin], ...cfg });
      if (hit.current) hit.current.chart = chart;
    } catch (e) { /* sin gráfico: la tabla de datos sigue disponible */ }
    return () => chart?.destroy();
  }, [...deps]);
  return html`<${Copiable} nombre=${nombre} omitir=${(e) => !!(onPoint && hit.current?.chart && hit.current.punto(hit.current.chart.getElementsAtEventForMode(e, 'nearest', { intersect: true }, false)))}><div class="chart-box doc" style=${alto ? `height:${alto}` : ''}><canvas ref=${ref} role="img" aria-label=${label}></canvas></div><//>`;
}

const baseOptions = (c, unit, yMin, yMax) => ({
  responsive: true, maintainAspectRatio: false, animation: false,
  plugins: { legend: { labels: { color: c.text, usePointStyle: false, boxWidth: 28 } }, tooltip: { callbacks: { title: (items) => fmtDay(dayFromNum(items[0].parsed.x)) } } },
  scales: {
    x: { type: 'linear', ticks: { color: c.muted, maxTicksLimit: 8, callback: (v) => fmtDay(dayFromNum(v)) }, grid: { color: c.line } },
    y: { min: yMin, max: yMax, title: { display: !!unit, text: unit ?? '', color: c.muted }, ticks: { color: c.muted }, grid: { color: c.line } },
  },
});

// Gráfico único con los dos lados (azul = izquierda, naranja = derecha): sesiones, Personal Average (discontinua), Personal Best (punteada) y Target (verde con bandera).
function lineConfig(c, { sides, series, unit, yMin, yMax, tg, refLines = [], info, sel = [] }) {
  const lr = sides.length === 2;
  const sfx = (sd) => (lr ? ` (${sd})` : '');
  const all = sides.flatMap((sd) => series[sd].valid.map((p) => dayNum(p.date)));
  const x0 = all.length ? Math.min(...all) : 0, x1 = all.length ? Math.max(...all) : 1;
  const datasets = [];
  for (const sd of sides) {
    const col = colorLado(sd);
    datasets.push({ side: sd, label: `Session average${sfx(sd)}`, data: series[sd].valid.map((p) => ({ x: dayNum(p.date), y: p.value, p })), borderColor: col, backgroundColor: col, pointRadius: series[sd].valid.map((p) => (sel.includes(sd + ':' + p.sessionId) ? 9 : 4)), pointBorderColor: series[sd].valid.map((p) => (sel.includes(sd + ':' + p.sessionId) ? '#FFFFFF' : col)), pointBorderWidth: series[sd].valid.map((p) => (sel.includes(sd + ':' + p.sessionId) ? 3 : 1)), hitRadius: 12, tension: 0, borderWidth: 2 });
    if (series[sd].excluded.length) datasets.push({ label: `Excluded session${sfx(sd)}`, data: series[sd].excluded.map((p) => ({ x: dayNum(p.date), y: p.value })), showLine: false, borderColor: PAL.texto, backgroundColor: 'transparent', pointStyle: 'crossRot', pointRadius: 6, borderWidth: 2 });
    // el Personal Best no se dibuja como línea (es el punto más alto) y el Personal Average solo si se marca entre las líneas de referencia (10/11/2026)
  }
  refLines.forEach((r) => datasets.push({ label: r.label, data: [{ x: x0, y: r.value }, { x: x1 === x0 ? x0 + 1 : x1, y: r.value }], borderColor: r.color, borderDash: r.dash, pointRadius: 0, borderWidth: r.w }));
  const tgs = sides.map((sd) => tg[sd]).filter(Boolean).filter((t, i, a) => a.findIndex((u) => u.value === t.value) === i);
  tgs.forEach((t) => datasets.push({ label: `Target (${t.origin === 'posición' ? 'position' : 'individual'})`, data: [{ x: x0, y: t.value }, { x: x1 === x0 ? x0 + 1 : x1, y: t.value }], borderColor: PAL.target, borderDash: [10, 4], pointRadius: 0, borderWidth: 2, bandera: true }));
  const o = baseOptions(c, unit, yMin, yMax);
  o.plugins.tooltip.callbacks.label = (it) => {
    const p = it.raw?.p;
    return p ? `${it.dataset.label}: ${nf(p.value)} ${unit ?? ''} · ${p.reps ?? '?'} reps` : `${it.dataset.label}: ${nf(it.parsed.y)} ${unit ?? ''}`;
  };
  o.plugins.tooltip.callbacks.afterLabel = (it) => (it.raw?.p && info ? info(it.raw.p.value) : []); // percentil de La Liga y zona de la Premier League del punto
  return { type: 'line', data: { datasets }, options: o };
}

const numIn = (t) => { const x = String(t ?? '').trim(); return x === '' ? null : Number(x.replace(',', '.')); };

// Corrección de una sesión guardada: sustituye fecha, hora, valores de ESTA variable y repeticiones en la misma fila (no crea otra sesión).
function FormCorregir({ s, variable, done, cancel }) {
  const { db } = useApp();
  const { msg, busy, run } = useRunner();
  const sides = variable.sides === 'LR' ? ['L', 'R'] : ['S'];
  const [f, setF] = useState(() => ({
    date: s.date, time: s.time ?? '',
    ...Object.fromEntries(sides.map((sd) => ['v' + sd, String(s.values?.[variable.id]?.[sd] ?? '').replace('.', ',')])),
    ...Object.fromEntries(sides.map((sd) => ['r' + sd, String((sd === 'S' ? s.reps?.total : s.reps?.[sd]) ?? '')])),
  }));
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const name = { L: 'Left', R: 'Right', S: 'Valor' };
  const save = run(async () => {
    const values = { [variable.id]: Object.fromEntries(sides.filter((sd) => sd in (s.values?.[variable.id] ?? {})).map((sd) => [sd, numIn(f['v' + sd])])) };
    for (const sd of Object.keys(values[variable.id])) if (values[variable.id][sd] === null || Number.isNaN(values[variable.id][sd])) throw new Error('Escribe un número en cada valor.');
    const reps = {};
    for (const sd of sides) { const k = sd === 'S' ? 'total' : sd; const x = numIn(f['r' + sd]); if (Number.isNaN(x)) throw new Error('Las repeticiones deben ser un número entero.'); if (x !== null || k in (s.reps ?? {})) reps[k] = x; }
    await correctSession(db, s.id, { date: f.date, time: f.time, values, reps });
    done();
  });
  return html`<form class="inline-form" role="group" aria-label="Corregir sesión" onSubmit=${save}>
    <p><strong>Corregir esta sesión</strong>: sustituye los datos guardados (no se crea otra sesión). Queda anotado en el registro de auditoría qué campos cambian, sin los valores.</p>
    <label>Fecha <input type="date" value=${f.date} onInput=${set('date')} required /></label>
    <label>Hora (opcional) <input type="time" value=${f.time} onInput=${set('time')} /></label>
    ${sides.map((sd) => html`<label key=${'v' + sd}>${name[sd]} (${dn(variable.name)}${variable.unit ? `, ${variable.unit}` : ''}) <input inputmode="decimal" value=${f['v' + sd]} onInput=${set('v' + sd)} /></label>`)}
    ${sides.map((sd) => html`<label key=${'r' + sd}>Repeticiones${sides.length === 2 ? ' ' + name[sd].toLowerCase() : ''} <input inputmode="numeric" value=${f['r' + sd]} onInput=${set('r' + sd)} /></label>`)}
    <${Desplegable} titulo="Sobre las repeticiones"><p class="muted">Cambiar las repeticiones modifica el peso de la sesión en el Personal Average. Solo se corrige la variable que estás viendo; las demás variables de la sesión no cambian.</p><//>
    <button type="submit" disabled=${busy}>Guardar corrección</button> <button type="button" class="secondary" onClick=${cancel}>Cancelar</button><${Msg} msg=${msg} /></form>`;
}

function AccionesSesion({ s, player, test, reload, many, variable }) {
  const { db } = useApp();
  const [open, setOpen] = useState(null);
  const [reason, setReason] = useState('');
  const [cn, setCn] = useState(''); const [cd, setCd] = useState('');
  const { msg, busy, run } = useRunner();
  const done = () => { setOpen(null); reload(); };
  if (open === 'corregir') return html`<${FormCorregir} s=${s} variable=${variable} done=${done} cancel=${() => setOpen(null)} />`;
  if (open === 'excluir') return html`<div class="inline-form"><label>Motivo (opcional) <input value=${reason} onInput=${(e) => setReason(e.target.value)} /></label>
    <button type="button" disabled=${busy} onClick=${run(async () => { await setSessionExcluded(db, s.id, true, reason); done(); })}>Excluir (reversible)</button>
    <button type="button" class="secondary" onClick=${() => setOpen(null)}>Cancelar</button><${Msg} msg=${msg} /></div>`;
  if (open === 'eliminar') return html`<div class="inline-form" role="group" aria-label="Eliminación definitiva">
    <p><strong>Eliminar definitivamente</strong> la sesión de <em>${playerLabel(player)}</em> en <em>${dn(test.name)}</em> del <em>${fmtDay(s.date)}</em>${s.time ? ` (${s.time})` : ''}. No se borra ninguna otra sesión. Las copias de seguridad antiguas pueden conservarla.</p>
    <label>Escribe el nombre del jugador <input value=${cn} onInput=${(e) => setCn(e.target.value)} /></label>
    <label>Escribe la fecha (AAAA-MM-DD) <input value=${cd} onInput=${(e) => setCd(e.target.value)} placeholder=${s.date} /></label>
    <button type="button" class="danger" disabled=${busy || !nameMatchesPlayer(player, cn) || cd.trim() !== s.date} onClick=${run(async () => { await deleteSessionPermanently(db, s.id, { playerName: cn, date: cd }); done(); })}>Eliminar para siempre</button>
    <button type="button" class="secondary" onClick=${() => setOpen(null)}>Cancelar</button><${Msg} msg=${msg} /></div>`;
  return html`<span class="row-actions">
    ${s.status === 'excluded'
      ? html`<button type="button" class="secondary" disabled=${busy} onClick=${run(async () => { await setSessionExcluded(db, s.id, false); reload(); })}>Reincorporar</button>`
      : html`<button type="button" class="secondary" onClick=${() => setOpen('excluir')}>Excluir</button>`}
    ${variable && variable.kind !== 'derived' ? html`<button type="button" class="secondary" onClick=${() => setOpen('corregir')}>Corregir…</button>` : null}
    <button type="button" class="secondary" onClick=${() => setOpen('eliminar')}>Eliminar…</button></span>`;
}

function TablaSesiones({ sessions, vars, variable, player, test, reload }) {
  const lr = variable.sides === 'LR';
  const sorted = [...sessions].sort((a, b) => (b.date + (b.time || '')).localeCompare(a.date + (a.time || '')) || b.id - a.id);
  const cell = (s, side) => { const v = s.values?.[variable.id]?.[side]; return Number.isFinite(v) ? (isAsymVariable(variable) ? html`<${AsimTexto} pct=${v} />` : nf(v)) : '—'; };
  const reps = (s, side) => (side === 'S' ? s.reps?.total : s.reps?.[side]) ?? '—';
  return html`<div class="table-wrap"><table><caption>Sesiones de ${dn(test.name)} · ${dn(variable.name)}${variable.unit ? ` (${variable.unit})` : ''}</caption>
    <thead><tr><th>Fecha</th>${lr ? html`<th>Left</th><th>Right</th><th>Rep. L / R</th>` : html`<th>Valor</th><th>Rep.</th>`}<th>Estado</th><th>Origen</th><th>Acciones</th></tr></thead>
    <tbody>${sorted.map((s) => html`<tr key=${s.id} class=${s.status === 'excluded' ? 'excluded' : ''}>
      <td>${fmtDay(s.date)}${s.time ? ` ${s.time}` : ''}</td>
      ${lr ? html`<td>${cell(s, 'L')}</td><td>${cell(s, 'R')}</td><td>${reps(s, 'L')} / ${reps(s, 'R')}</td>` : html`<td>${cell(s, 'S')}</td><td>${reps(s, 'S')}</td>`}
      <td>${s.status === 'excluded' ? html`Excluida${s.excludedReason ? `: ${s.excludedReason}` : ''}` : 'Válida'}${Array.isArray(s.mergedRows) ? ` · fusión de ${s.mergedRows.length} filas` : ''}</td>
      <td>${s.source ?? '—'}${s.synthetic ? ' (sintético)' : ''}</td>
      <td><${AccionesSesion} s=${s} player=${player} test=${test} reload=${reload} variable=${variable} /></td></tr>`)}</tbody></table></div>`;
}

// Targets (D15): el individual manda sobre el de la posición; un solo valor para ambos lados. Sin color: «alcanzado» o distancia en unidades y en %.
// Alta rápida de Target individual (icono de bandera del usuario): un valor, mismo para ambos lados si la variable es por lado.
function TargetRapido({ player, variable, sides, own, reload }) {
  const { db } = useApp();
  const { msg, busy, run } = useRunner();
  const [val, setVal] = useState('');
  const u = variable.unit ? ` (${variable.unit})` : '';
  const save = run(async () => {
    const n = Number(String(val).replace(',', '.'));
    if (String(val).trim() === '' || !Number.isFinite(n)) throw new Error('Escribe un número para el target.');
    await setTarget(db, { scope: 'player', playerId: player.id, variableId: variable.id, values: Object.fromEntries(sides.map((sd) => [sd, n])), note: own?.note ?? '' });
    setVal(''); reload();
  }, 'Target guardado: aparece con la bandera en los gráficos.');
  return html`<div class="target-rapido" role="group" aria-label="Añadir target al momento">
    <img src=${ICONO_TARGET} alt="" />
    <label>Añadir target${u}${sides.length === 2 ? ' (ambos lados)' : ''} <input type="number" step="any" value=${val} onInput=${(e) => setVal(e.target.value)} /></label>
    <button type="button" disabled=${busy} onClick=${save}>Guardar target</button><${Msg} msg=${msg} /></div>`;
}

function TargetPanel({ player, variable, sides, targets, positions, positionId, stats, current, reload }) {
  const { db } = useApp();
  const { msg, busy, run } = useRunner();
  const own = targets.find((t) => t.scope === 'player' && t.playerId === player.id && t.variableId === variable.id);
  const pos = positionId == null ? null : targets.find((t) => t.scope === 'position' && t.positionId === positionId && t.variableId === variable.id);
  const posName = positions.find((p) => p.id === positionId)?.name;
  const [form, setForm] = useState({ own: { ...(own?.values ?? {}) }, ownNote: own?.note ?? '', pos: { ...(pos?.values ?? {}) }, posNote: pos?.note ?? '' });
  const sideName = { L: 'Left', R: 'Right', S: 'Value' };
  const u = variable.unit ? ` ${variable.unit}` : '';
  const rows = sides.map((sd) => { const t = resolveTarget(targets, { playerId: player.id, positionId, variableId: variable.id, side: sd }); return t ? { sd, t, cur: current[sd], pa: stats[sd].pa } : null; }).filter(Boolean);
  const fmt = (d) => (d ? `${d.diff > 0 ? '+' : ''}${nf(d.diff)}${u}${d.pct !== null ? ` (${d.pct > 0 ? '+' : ''}${nf(d.pct, 1)} %)` : ''}${d.reached === true ? ' · alcanzado' : d.reached === false ? ' · no alcanzado' : ''}` : '—');
  const both = sides.length === 2;
  const inputs = (key) => html`<label>${both ? 'Valor para ambos lados' : 'Valor'}${u ? ` (${variable.unit})` : ''} <input type="number" step="any" value=${form[key][sides[0]] ?? ''} onInput=${(e) => setForm({ ...form, [key]: Object.fromEntries(sides.map((sd) => [sd, e.target.value])) })} /></label>`;
  const save = (scope) => run(async () => {
    await setTarget(db, { scope, playerId: scope === 'player' ? player.id : null, positionId: scope === 'position' ? positionId : null, variableId: variable.id, values: scope === 'player' ? form.own : form.pos, note: scope === 'player' ? form.ownNote : form.posNote });
    reload();
  }, 'Target guardado.');
  const remove = (t) => run(async () => { await deleteTarget(db, t.id); setForm({ ...form, ...(t.scope === 'player' ? { own: {}, ownNote: '' } : { pos: {}, posNote: '' }) }); reload(); }, 'Target eliminado.');
  return html`<section class="targets"><h4>Target</h4>
    ${rows.length ? html`<div class="table-wrap"><table><caption>Target aplicable a ${playerLabel(player)} en ${dn(variable.name)}</caption><thead><tr><th>Lado</th><th class="num">Target</th><th>Origen</th><th>Resultado actual</th><th>Personal Average</th></tr></thead>
      <tbody>${rows.map((r) => html`<tr key=${r.sd}><th scope="row">${sideName[r.sd]}</th><td class="num">${nf(r.t.value)}${u}</td><td>${r.t.origin}${r.t.note ? html` <span class="muted">· ${r.t.note}</span>` : null}</td>
        <td>${r.cur ? html`<span title=${`${fmtDay(r.cur.date)} · frente al target: ${fmt(distanceToTarget(r.cur.value, r.t.value, variable.direction))}`} tabindex="0">${nf(r.cur.value)}${u}</span>` : '—'}</td><td>${r.pa.defined ? html`<span title=${`frente al target: ${fmt(distanceToTarget(r.pa.value, r.t.value, variable.direction))}`} tabindex="0">${nf(r.pa.value)}${u}</span>` : '—'}</td></tr>`)}</tbody></table></div>
      ${variable.direction !== 'higher' && variable.direction !== 'lower' ? html`<p class="muted">Esta variable no tiene dirección «más alto» ni «más bajo» en el catálogo: se muestra la distancia, pero no si el target está alcanzado.</p>` : null}`
      : html`<p class="muted">Sin target definido para esta variable.</p>`}
    <details><summary>Definir o cambiar targets</summary>
      <div class="inline-form" role="group" aria-label="Target individual"><p><strong>Individual de ${playerLabel(player)}</strong> (manda sobre el de la posición)</p>${inputs('own')}
        <label>Nota o fuente (opcional) <input value=${form.ownNote} onInput=${(e) => setForm({ ...form, ownNote: e.target.value })} /></label>
        <button type="button" disabled=${busy} onClick=${save('player')}>Guardar individual</button>${own ? html` <button type="button" class="secondary" disabled=${busy} onClick=${remove(own)}>Eliminar individual</button>` : null}</div>
      ${positionId == null ? html`<p class="muted">El jugador no tiene posición principal: no se puede definir un target por posición desde aquí.</p>` : html`
      <div class="inline-form" role="group" aria-label="Target por defecto de la posición"><p><strong>Por defecto para la posición ${posName ?? ''}</strong> (lo heredan todos sus jugadores sin target individual)</p>${inputs('pos')}
        <label>Nota o fuente (opcional) <input value=${form.posNote} onInput=${(e) => setForm({ ...form, posNote: e.target.value })} /></label>
        <button type="button" disabled=${busy} onClick=${save('position')}>Guardar por defecto</button>${pos ? html` <button type="button" class="secondary" disabled=${busy} onClick=${remove(pos)}>Eliminar por defecto</button>` : null}</div>`}
      <${Msg} msg=${msg} />
    </details>
    <details class="notas"><summary>Qué es un target</summary>
    <p class="muted">Un target es un valor objetivo que defines tú. No se colorea: solo se indica si está alcanzado y la distancia, usando la dirección de la variable en el catálogo.</p></details></section>`;
}

// Asimetría horizontal como en VALD: eje central en 0, azul (izquierda) hacia la izquierda y naranja (derecha) hacia la derecha, con la fecha en el eje vertical.
function asymConfig(c, asym, variable, deg = false) {
  const fmtA = (v, d = 1) => (deg ? `${nf(Math.abs(v), d)} °${Math.abs(v) < 0.05 ? '' : v > 0 ? ' R' : ' L'}` : asymText(v, d));
  const m = Math.max(1, ...asym.map((a) => Math.abs(a.pct))); const lim = Math.ceil(m * 1.35);
  const etiquetas = { id: 'etiquetasAsim', afterDatasetsDraw(ch) {
    const meta = ch.getDatasetMeta(0); const g = ch.ctx; g.save(); g.font = 'bold 12px sans-serif'; g.fillStyle = PAL.texto; g.textBaseline = 'middle';
    meta.data.forEach((bar, i) => { const v = asym[i].pct; g.textAlign = v >= 0 ? 'left' : 'right'; g.fillText(deg ? `${nf(Math.abs(v), 1)} °` : `${nf(Math.abs(v), 1)} %`, bar.x + (v >= 0 ? 6 : -6), bar.y); });
    g.restore(); } };
  return { type: 'bar', plugins: [etiquetas], data: { labels: asym.map((a) => fmtDay(a.date)), datasets: [{ label: deg ? 'Asymmetry (°)' : 'Asymmetry (%)', data: asym.map((a) => a.pct), backgroundColor: asym.map((a) => (a.pct >= 0 ? PAL.der : PAL.izq)), barPercentage: 0.7 }] },
    options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, animation: false, layout: { padding: { right: 36, left: 4 } },
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: (it) => { const a = asym[it.dataIndex]; return `${fmtA(it.parsed.x)}${a.left === null || a.right === null ? '' : ` · L ${nf(a.left)} / R ${nf(a.right)} ${variable.unit ?? ''}`}`; } } } },
      scales: { x: { min: -lim, max: lim, title: { display: true, text: deg ? 'Interlimb asymmetry (°, right − left) · left ◄  ► right' : 'Interlimb asymmetry (%) · left ◄  ► right', color: PAL.texto }, ticks: { color: PAL.texto, callback: (v) => `${Math.abs(v)}` }, grid: { color: (ctx) => (ctx.tick.value === 0 ? PAL.texto : PAL.rejilla) } },
        y: { ticks: { color: PAL.texto }, grid: { display: false } } } } };
}

// Comparar dos medidas de un jugador (clic en dos puntos del gráfico o elección aquí): ¿el cambio supera el error de medida? Método y límites: cambio.js.
const nfp = (p) => (p < 0.001 ? '< 0,001' : p.toLocaleString('es-ES', { minimumFractionDigits: 3, maximumFractionDigits: 3 }));
function CompararPanel({ variable, sides, series, cmp, setCmp, refData, protocolId }) {
  const side = sides.includes(cmp.side) ? cmp.side : sides[0];
  const pts = series[side].valid;
  const pa = pts.find((p) => p.sessionId === cmp.a), pb = pts.find((p) => p.sessionId === cmp.b);
  const u = variable.unit ? ` ${variable.unit}` : '';
  const lbl = (p) => `${fmtDay(p.date)}${p.time ? ' ' + p.time : ''} · ${nf(p.value)}${u}`;
  const sideName = { L: 'Left', R: 'Right', S: 'Value' };
  let res = null, ant = null, pos = null;
  if (pa && pb && pa.sessionId !== pb.sessionId && refData) {
    [ant, pos] = (pa.date + pa.time) <= (pb.date + pb.time) ? [pa, pb] : [pb, pa];
    const playersById = Object.fromEntries(refData.players.map((x) => [x.id, x]));
    const by = new Map(); for (const s of refData.sessions) { if (playersById[s.playerId]?.synthetic) continue; (by.get(s.playerId) ?? by.set(s.playerId, []).get(s.playerId)).push(s); }
    const diffs = consecutiveDiffs([...by.values()].map((list) => buildSeries(list, variable.id, side, { protocolId }).valid.map((p) => p.value)));
    const between = buildReference({ sessions: refData.sessions, variable, side, players: playersById, histories: {}, basis: 'pa', protocolId }).map((e) => e.value);
    res = changeTest({ a: ant, b: pos, diffs, between, direction: variable.direction, minDiffs: refData.minN });
  }
  const word = res?.improves === true ? 'mejora' : res?.improves === false ? 'empeoramiento' : 'cambio';
  const sgn = (x) => (x > 0 ? '+' : x < 0 ? '−' : '') + nf(Math.abs(x));
  return html`<section class="comparar"><h4 class="sec-titulo">Comparar dos medidas</h4>
    <${Desplegable} titulo="Cómo comparar dos puntos"><p class="muted">Pulsa dos puntos del gráfico (del mismo lado) o elígelos aquí, para ver si el cambio es mayor que el error de medida.</p><//>
    <div class="filters">
      ${sides.length === 2 ? html`<label>Lado <select value=${side} onChange=${(e) => setCmp({ side: e.target.value, a: null, b: null })}>${sides.map((sd) => html`<option key=${sd} value=${sd}>${sideName[sd]}</option>`)}</select></label>` : null}
      <label>Medida A <select value=${cmp.a ?? ''} onChange=${(e) => setCmp({ side, a: e.target.value ? Number(e.target.value) : null, b: cmp.b })}><option value="">Elige…</option>${pts.map((p) => html`<option key=${p.sessionId} value=${p.sessionId}>${lbl(p)}</option>`)}</select></label>
      <label>Medida B <select value=${cmp.b ?? ''} onChange=${(e) => setCmp({ side, a: cmp.a, b: e.target.value ? Number(e.target.value) : null })}><option value="">Elige…</option>${pts.map((p) => html`<option key=${p.sessionId} value=${p.sessionId}>${lbl(p)}</option>`)}</select></label>
      ${cmp.a != null || cmp.b != null ? html`<button type="button" class="secondary" onClick=${() => setCmp({ side, a: null, b: null })}>Quitar selección</button>` : null}
    </div>
    ${pa && pb && pa.sessionId === pb.sessionId ? html`<p class="status warn">Elige dos medidas distintas.</p>` : null}
    ${res ? html`
      <div class="table-wrap"><table><caption>${dn(variable.name)}${sides.length === 2 ? ` · ${sideName[side]}` : ''}: ${fmtDay(ant.date)} → ${fmtDay(pos.date)}</caption><tbody>
        <tr><th scope="row">Medida anterior</th><td>${fmtDay(ant.date)}${ant.time ? ' ' + ant.time : ''}</td><td class="num">${nf(ant.value)}${u}</td></tr>
        <tr><th scope="row">Medida posterior</th><td>${fmtDay(pos.date)}${pos.time ? ' ' + pos.time : ''}</td><td class="num">${nf(pos.value)}${u}</td></tr>
        <tr><th scope="row">Diferencia</th><td></td><td class="num">${sgn(res.diff)}${u}${res.pct !== null ? ` (${res.pct > 0 ? '+' : res.pct < 0 ? '−' : ''}${nf(Math.abs(res.pct), 1)} %)` : ''}</td></tr>
        ${res.defined ? html`
          <tr><th scope="row">Valor de p (bilateral)</th><td>t = ${nf(res.t)} · gl = ${res.df}</td><td class="num">${nfp(res.p)}</td></tr>
          <tr><th scope="row">IC 95 % de la diferencia</th><td></td><td class="num">${sgn(res.ci[0])} a ${sgn(res.ci[1])}${u}</td></tr>
          <tr><th scope="row">Cambio mínimo detectable (95 %)</th><td>error típico = ${nf(res.te)}${u}</td><td class="num">±${nf(res.mdc95)}${u}</td></tr>` : null}
        ${res.swc !== null ? html`<tr><th scope="row">Cambio mínimo importante (SWC)</th><td>0,2 × SD entre jugadores</td><td class="num">${nf(res.swc)}${u}</td></tr>` : null}
      </tbody></table></div>
      ${res.defined
        ? html`<p class=${'status ' + (res.significant ? 'ok' : 'warn')} role="status">${res.significant
          ? `${word[0].toUpperCase() + word.slice(1)} estadísticamente significativ${word === 'mejora' ? 'a' : 'o'} (p = ${nfp(res.p)}): la diferencia supera el cambio mínimo detectable (±${nf(res.mdc95)}${u}).`
          : `La diferencia (${sgn(res.diff)}${u}) no se distingue del error de medida (p = ${nfp(res.p)}): no se puede afirmar que haya ${res.improves === false ? 'empeoramiento' : res.improves === true ? 'mejora' : 'cambio'}.`}
          ${res.exceedsSwc === null ? '' : res.exceedsSwc ? ' Además supera el cambio mínimo importante (SWC).' : ' No llega al cambio mínimo importante (SWC).'}</p>`
        : html`<p class="status warn" role="status">${res.reason}</p>`}` : null}
    <details class="notas"><summary>Cómo se calcula y límites</summary>
      <p class="muted">Cada sesión guarda solo la media de sus repeticiones, así que no hay varianza dentro de la sesión y no se puede hacer un contraste t entre dos sesiones. El error de medida se estima con la propia plantilla (sin datos sintéticos): se toman las diferencias entre sesiones consecutivas de cada jugador (mismo test, lado y protocolo). Para dos medidas sueltas, el error típico de su diferencia es la desviación típica de esas diferencias; t = diferencia ÷ esa desviación, con n − 1 grados de libertad; el cambio mínimo detectable es t crítico × esa desviación (Hopkins 2000, <em>Sports Medicine</em> 30:1-15; Weir 2005, <em>J Strength Cond Res</em> 19:231-240; Jacobson y Truax 1991). El cambio mínimo importante (SWC) es 0,2 × la desviación típica entre jugadores de su Personal Average (Hopkins y cols. 2009, <em>Med Sci Sports Exerc</em> 41:3-13).</p>
      <p class="muted">Límites: las diferencias entre sesiones incluyen también cambios reales (entrenamiento, lesión), así que el error estimado tiende a ser mayor que el real y el criterio es conservador; se aplica a este jugador el error medio de la plantilla; un valor de p pequeño no dice que el cambio sea relevante para el rendimiento, por eso se indica también el SWC; criterio provisional, pendiente de tu confirmación.</p></details>
  </section>`;
}

function PanelTest({ player, test, catalog, sessions, omitted = {}, reload, q, setQ, targets = [], positions = [], positionId = null }) {
  const refData = useRefData(test);
  const [cmp, setCmp] = useState({ varId: null, side: null, a: null, b: null });
  const protocols = catalog.protocols.filter((p) => p.testId === test.id);
  const vars = orderVars(catalog.variables.filter((v) => v.testId === test.id && isViewable(v) && hasData(v, sessions)));
  const proto = q.p ?? 'all';
  const from = q.from ?? '', to = q.to ?? '';
  const variable = vars.find((v) => String(v.id) === String(q.v)) ?? defaultVar(vars, sessions, prefiereRsi(test, catalog));
  if (!variable) return html`<p class="muted">Este test no tiene variables con datos.</p>`;
  const varOpts = vars.map((v) => ({ id: v.id, label: varLabel(v) }));
  const protocolId = proto === 'all' ? undefined : proto === 'none' ? null : Number(proto);
  const f = { from: from || null, to: to || null, protocolId };
  const sides = variable.sides === 'LR' ? ['L', 'R'] : ['S'];
  const series = Object.fromEntries(sides.map((sd) => [sd, buildSeries(sessions, variable.id, sd, f)]));
  const stats = Object.fromEntries(sides.map((sd) => [sd, { pa: personalAverage(series[sd].valid), pb: personalBestFor(sessions, variable, sd, f) }]));
  const tg = Object.fromEntries(sides.map((sd) => [sd, resolveTarget(targets, { playerId: player.id, positionId, variableId: variable.id, side: sd })]));
  // Variable relativa (BW/SW): la Premier League solo publica valores absolutos (N), así que su zona se calcula con el valor absoluto equivalente del jugador.
  const srcVar = isRelative(variable) ? catalog.variables.find((x) => x.id === variable.formula.operands[0]) : null;
  const abs = srcVar ? (() => { const ser = Object.fromEntries(sides.map((sd) => [sd, buildSeries(sessions, srcVar.id, sd, f)])); return { variable: srcVar, stats: Object.fromEntries(sides.map((sd) => [sd, { pa: personalAverage(ser[sd].valid), pb: personalBestFor(sessions, srcVar, sd, f) }])), current: Object.fromEntries(sides.map((sd) => [sd, currentResult(ser[sd].valid)])) }; })() : null;
  const ctx = refData ? refContext({ refData, test, variable, sides, filters: f, playerId: player.id, positionId, srcVar }) : null;
  const posNombre = positions.find((p) => p.id === positionId)?.name;
  // Referencias de Natera (solo Peak Force relativo de los Run-Specific Iso-Push): tres marcas opcionales, con los colores de sus bandas.
  const nat = findNatera(test, variable);
  const NAT_OPTS = nat ? [['natNormal', 'Natera Normal', [4, 4], 2, NATERA_HEX.normal, nat.normal], ['natGood', 'Natera Good', [4, 4], 2, NATERA_HEX.good, nat.good], ['natExcellent', 'Natera Excellent', [4, 4], 2, NATERA_HEX.excellent, nat.excellent]] : [];
  const REF_OPTS = [['p50', 'P50 La Liga', 'p50', [], 2], ['p50pos', `P50 La Liga (${posNombre ?? 'position'})`, 'p50pos', [8, 4], 2], ['p75', 'P75 La Liga', 'p75', [2, 3], 2], ['p75pos', `P75 La Liga (${posNombre ?? 'position'})`, 'p75pos', [10, 3, 2, 3], 2], ['premier50', 'P50 Premier League', 'premier50', [], 1.5], ['premier75', 'P75 Premier League', 'premier75', [8, 3], 1.5]];
  // Por defecto: P50 La Liga y P50 Premier League. «none» = ninguna marcada.
  const chosen = q.rl === undefined ? ['p50', 'premier50'] : String(q.rl).split(',').filter((x) => x && x !== 'none');
  const paOpts = sides.map((sd) => ['pa' + sd, variable.sides === 'LR' ? `Personal Average (${sd})` : 'Personal Average', [6, 4], 2, variable.sides === 'LR' ? colorLado(sd) : PAL.texto, stats[sd].pa.defined ? stats[sd].pa.value : null]);
  const opts = [...REF_OPTS.map(([k, label, , dash, w]) => [k, label, dash, w, k.startsWith('premier') ? PAL.premier : PAL.laLiga, ctx?.lines[k] ?? null]), ...NAT_OPTS, ...paOpts];
  const refLines = opts.filter(([k, , , , , v]) => chosen.includes(k) && v != null).map(([k, label, dash, w, color, v]) => ({ k, label, value: v, dash, w, color }));
  const all = sides.flatMap((sd) => [...series[sd].valid, ...series[sd].excluded].map((p) => p.value).concat(tg[sd] ? [tg[sd].value] : [])).concat(refLines.map((r) => r.value));
  const pad = all.length ? (Math.max(...all) - Math.min(...all)) * 0.1 || Math.abs(Math.max(...all)) * 0.1 || 1 : 1;
  const yMin = all.length ? Math.min(...all) - pad : undefined, yMax = all.length ? Math.max(...all) + pad : undefined; // mismo eje para ambos lados
  // Asimetrías del test (13/11/2026, pedido por el usuario): entran tanto las variables por lados (asimetría calculada) como las variables de asimetría
  // que VALD ya trae calculadas (CMJ, Hop, Drop Jump: un valor con signo). Se eligen con un selector propio, independiente de la variable de la página.
  const asimVars = orderVars(catalog.variables.filter((v) => v.testId === test.id && isViewable(v) && hasData(v, sessions) && (v.sides === 'LR' || isAsymVariable(v))));
  const asimSerie = (v) => (v.sides === 'LR' ? asymmetrySeries(sessions, v.id, { ...f, diff: esGrados(v) }) : asymmetryValueSeries(sessions, v.id, f));
  const asimCon = asimVars.map((v) => ({ v, serie: asimSerie(v) })).filter((x) => x.serie.length);
  // Por defecto, la asimetría de la variable seleccionada arriba (si la tiene); si no, la primera del test. Una vez elegida una en el selector, manda ella.
  const asimSel = asimCon.find((x) => String(x.v.id) === String(q.va)) ?? asimCon.find((x) => x.v.id === variable.id) ?? asimCon[0] ?? null;
  const asym = asimSel?.serie ?? null;
  const asimVar = asimSel?.v ?? null;
  const sideName = { L: 'Left', R: 'Right', S: 'Value' };
  const cmpV = cmp.varId === variable.id ? cmp : { varId: variable.id, side: null, a: null, b: null };
  const setCmpV = (c) => setCmp({ ...c, varId: variable.id });
  const onPoint = (side, p) => setCmp(() => { const c = cmpV; if (c.side !== side) return { varId: variable.id, side, a: p.sessionId, b: null }; if (c.a === p.sessionId) return { ...c, a: c.b, b: null }; if (c.b === p.sessionId) return { ...c, b: null }; if (c.a == null) return { ...c, a: p.sessionId }; if (c.b == null) return { ...c, b: p.sessionId }; return { varId: variable.id, side, a: p.sessionId, b: null }; });
  const selSide = sides.includes(cmpV.side) ? cmpV.side : sides[0];
  const selIds = [cmpV.a, cmpV.b].filter((x) => x != null).map((id) => selSide + ':' + id);
  const key = [player.id, test.id, variable.id, proto, from, to, sessions.map((s) => s.id + s.status).join(), sides.map((sd) => (tg[sd] ? tg[sd].origin + tg[sd].value : '-')).join()].join('|');
  const cmj = test.name === 'CMJ', relArriba = ['squat jump', 'sl cmj'].includes(String(test.name ?? '').trim().toLowerCase()); // Squat Jump (EUR) y SL CMJ (DSI): su cuadrante va arriba del todo // CMJ y Perímetros: cuadro con todas las variables arriba del todo; en CMJ, justo debajo el radar y el cuadrante EUR
  const radarEl = html`<${RadarPanel} key=${'radar' + test.id + player.id} player=${player} testName=${test.name} />`;
  const relEl = html`<${RelacionTest} key=${'rel' + test.id + player.id} player=${player} test=${test} />`;
  return html`<div class="evo">
    <${OrzTest} key=${'orz' + test.id + player.id} player=${player} test=${test} />
    ${relArriba ? relEl : null}
    <${NormativeBenchmarking} key=${'nb' + test.id + player.id} player=${player} test=${test} catalog=${catalog} sessions=${sessions} refData=${refData} q=${q} setQ=${setQ} selectedId=${variable.id} abs=${abs} />
    ${cmj ? html`${radarEl}${relEl}` : null}
    <div id="detalle-variable" class="filters">
      <label>Variable <select value=${variable.id} onChange=${(e) => setQ({ v: e.target.value })}>${vars.map((v) => html`<option key=${v.id} value=${v.id}>${varLabel(v)}</option>`)}</select></label>
      ${protocols.length ? html`<label>Protocolo <select value=${proto} onChange=${(e) => setQ({ p: e.target.value })}><option value="all">Todos</option><option value="none">Sin protocolo</option>${protocols.map((p) => html`<option key=${p.id} value=${p.id}>${p.name}</option>`)}</select></label>` : null}
      <label>Desde <input type="date" value=${from} onInput=${(e) => setQ({ from: e.target.value })} /></label>
      <label>Hasta <input type="date" value=${to} onInput=${(e) => setQ({ to: e.target.value })} /></label>
    </div>
    <${NotaRelativa} variable=${variable} omitted=${omitted} catalog=${catalog} />
    <${PercentilesPanel} key=${variable.id} player=${player} test=${test} variable=${variable} vars=${varOpts} mine=${sessions} q=${q} setQ=${setQ} filters=${f} targets=${tg} refData=${refData} abs=${abs} stats=${stats} current=${Object.fromEntries(sides.map((sd) => [sd, currentResult(series[sd].valid)]))} parte="escala" posJugador=${positionId} />
    <fieldset class="modes filas"><legend class="sec-titulo">Longitudinal Performance Relative to Benchmarks</legend>
      ${varOpts.length > 1 ? html`<${SelectorVariable} vars=${varOpts} value=${variable.id} onChange=${(v) => setQ({ v })} />` : null}
      ${agruparFiltros(opts, (o) => o[0]).map((fila, i) => html`<div class="ref-fila" key=${'f' + i}>${fila.map(([k, label, , , , v]) => { const off = v == null; return html`<label class="check" key=${k} title=${off ? (k.startsWith('pa') ? 'Sin sesiones válidas en el periodo.' : k.endsWith('pos') && positionId == null ? 'El jugador no tiene posición principal.' : k.startsWith('premier') ? 'Esta variable no figura en las tablas de la Premier League.' : `Sin muestra suficiente (mínimo ${ctx?.minN ?? 10} jugadores).`) : ''}><input type="checkbox" disabled=${off} checked=${!off && chosen.includes(k)} onChange=${(e) => setQ({ rl: (e.target.checked ? [...chosen, k] : chosen.filter((x) => x !== k)).join(',') || 'none' })} /> ${label}</label>`; })}</div>`)}</fieldset>
    ${sides.some((sd) => series[sd].valid.length)
      ? html`<${Grafico} onPoint=${onPoint} deps=${[key, 'lineas', refLines.map((r) => r.k + r.value).join(), !!ctx, selIds.join()]} nombre=${`evolucion-${variable.name}`} label=${`Evolución de ${dn(variable.name)}: ${sides.map((sd) => `${sideName[sd]} ${series[sd].valid.length} sesiones`).join(', ')}`} build=${(c) => lineConfig(c, { sides, series, unit: variable.unit, yMin, yMax, tg, refLines, info: ctx ? (v) => ctx.info(v, 'last') : null, sel: selIds })} />`
      : html`<p class="muted">Sin sesiones válidas en el periodo.</p>`}
    ${sides.some((sd) => series[sd].valid.length >= 2) ? html`<${CompararPanel} key=${'cmp' + variable.id} variable=${variable} sides=${sides} series=${series} cmp=${cmpV} setCmp=${setCmpV} refData=${refData} protocolId=${protocolId} />` : null}
    <${TargetRapido} key=${'tr' + variable.id + player.id} player=${player} variable=${variable} sides=${sides} own=${targets.find((t) => t.scope === 'player' && t.playerId === player.id && t.variableId === variable.id)} reload=${reload} />
    <${TargetPanel} key=${'t' + variable.id} player=${player} variable=${variable} sides=${sides} targets=${targets} positions=${positions} positionId=${positionId} stats=${stats} current=${Object.fromEntries(sides.map((sd) => [sd, currentResult(series[sd].valid)]))} reload=${reload} />
    ${asym && asym.length ? html`<section><h4 class="sec-titulo">Interlimb Asymmetry Over Time</h4>
      ${asimCon.length > 1 ? html`<${SelectorVariable} vars=${asimCon.map(({ v }) => ({ id: v.id, label: varLabel(v) + (isAsymVariable(v) ? ' · ya calculada (VALD)' : '') }))} value=${asimVar.id} onChange=${(va) => setQ({ va })} etiqueta="Asimetría de" />` : null}
      <p class="leyenda" aria-label="Leyenda"><span class="leyenda-chip" style=${`background:${PAL.izq}`}>LEFT</span> <span class="leyenda-chip" style=${`background:${PAL.der}`}>RIGHT</span></p>
      <details class="notas"><summary>Cómo se calcula la asimetría</summary>
      ${isAsymVariable(asimVar)
        ? html`<p class="muted">Esta variable es una asimetría que ya viene calculada en el fichero de VALD («12 R», «5,9 L»): se guarda como un solo valor con signo (derecha positiva) y se dibuja tal cual, sin recalcularla. Barra azul hacia la izquierda si domina el lado left, naranja hacia la derecha si domina el right.</p>`
        : html`<p class="muted">${esGrados(asimVar) ? 'Variables en grados: right − left, en grados (como en tu Excel); positivo = valor mayor en el lado right. ' : null}|D − I| ÷ máx × 100 (en variables que no son grados) y la letra del lado con el valor más alto (L left, R right). Como en VALD: barra azul hacia la izquierda del eje si el lado left es mayor, naranja hacia la derecha si lo es el right.</p>`}
      </details>
      <${Grafico} key=${'asim' + asimVar.id} deps=${[key, 'asim', asimVar.id, asym.map((a) => a.date + a.pct).join()]} nombre=${`asimetria-${asimVar.name}`} alto=${`${Math.max(9, 3.2 + asym.length * 2.2)}rem`} label=${`Asimetría de ${dn(asimVar.name)}: ${asym.length} sesiones`} build=${(c) => asymConfig(c, asym, asimVar, esGrados(asimVar))} /></section>` : null}
    ${cmj || relArriba ? null : relEl}
    <${RatioTest} key=${'rat' + test.id + player.id} player=${player} test=${test} />
    ${cmj ? null : radarEl}
    <${TablaSesiones} sessions=${sessions.filter((s) => s.values?.[variable.id] && (protocolId === undefined || (s.protocolId ?? null) === protocolId) && (!f.from || s.date >= f.from) && (!f.to || s.date <= f.to))} variable=${variable} player=${player} test=${test} reload=${reload} />
    <details class="notas"><summary>Notas sobre los datos del gráfico y la tabla</summary>
    <p class="muted">Cada punto es el Average de una sesión (media de sus repeticiones). Las sesiones excluidas no cuentan en el Personal Best, el Personal Average ni en ningún análisis. La Máxima repetición no está disponible: los datos importados traen una media por sesión.</p>
    </details>
  </div>`;
}

// Alta manual (opción A, 8/11/2026): la carga de Iso-Hold y RM no viene de VALD; se escribe aquí y crea una sesión con la variable de carga del test.
function AltaManualCarga({ player, catalog, reload, fixedTest = null }) {
  const { db } = useApp();
  const { msg, busy, run } = useRunner();
  const tests = catalog.tests.filter((t) => (!fixedTest || t.id === fixedTest.id) && !t.archived && catalog.variables.some((v) => v.testId === t.id && !v.archived && v.kind !== 'derived' && LOAD_VARIABLE_NAMES.includes(v.name)));
  const [f, setF] = useState({ testId: fixedTest ? String(fixedTest.id) : '', date: todayIso(), time: '', load: '' });
  if (!tests.length) return null;
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const save = run(async () => {
    await addManualLoad(db, { playerId: player.id, testId: Number(f.testId), date: f.date, time: f.time, load: f.load });
    setF({ ...f, load: '' }); reload();
  }, 'Sesión guardada.');
  return html`<${Card} titulo="Alta manual de carga (Iso-Hold y RM)" id="alta-manual">
    <${Desplegable} titulo="Sobre la carga externa"><p class="muted">La carga de estos tests no viene de VALD: escríbela aquí. Se guarda una sesión con la carga (kg); las variables calculadas (MVIC, %PIMA, %BW/%SW, 1RM estimado) se obtienen solas. Si te equivocas, corrígela desde la tabla de sesiones del test.</p><//>
    <${Desplegable} titulo="Variables calculadas de carga"><p class="muted">Las variables calculadas (MVIC iso-push, %PIMA, %BW/%SW) <strong>aparecen en el selector de variables solo después de guardar la primera carga</strong> y requieren, además, una sesión del Iso-Push emparejado y la masa corporal (o el peso de referencia) del jugador.</p><//>
    <form class="filters" onSubmit=${save} aria-label="Alta manual de carga">
      ${fixedTest ? html`<p><strong>${fixedTest.name}</strong></p>` : html`<label>Test <select value=${f.testId} onChange=${set('testId')} required><option value="">Elige…</option>${tests.map((t) => html`<option key=${t.id} value=${t.id}>${dn(t.name)}</option>`)}</select></label>`}
      <label>Fecha <input type="date" value=${f.date} onInput=${set('date')} required /></label>
      <label>Hora (opcional) <input type="time" value=${f.time} onInput=${set('time')} /></label>
      <label>Carga (kg) <input inputmode="decimal" value=${f.load} onInput=${set('load')} required /></label>
      <button type="submit" disabled=${busy || !f.testId}>Guardar carga</button>
    </form><${Msg} msg=${msg} /><//>`;
}

const BLOQUES = [['edicion', 'Edición'], ['fuerza', 'Manifestaciones de la fuerza'], ['perimetros', 'Datos antropométricos'], ['nme', 'NME'], ['asimetrias', 'Asimetrías'], ['deficits', 'Déficits']];

// Edición y Datos antropométricos llegan ya hechos desde la ficha (`edicion`, `antrop`); el perfil carga-velocidad (`fv`) solo se muestra en los tests de perfil F–V.
export function ResultadosJugador({ player, query = {}, edicion = null, antrop = null, fv = null }) {
  const { db, version } = useApp();
  const [tick, setTick] = useState(0);
  const reload = () => setTick((t) => t + 1);
  const { data, error } = useLoad(async () => {
    const catalog = await listCatalog(db);
    const raw = await db.sessions.where('playerId').equals(player.id).toArray();
    const anthropometry = withReferenceWeights(await db.anthropometry.where('playerId').equals(player.id).toArray(), [await db.players.get(player.id)]);
    let sessions = []; const omitted = {};
    for (const t of catalog.tests) { const e = expandRelative(catalog.variables, t.id, raw.filter((s) => s.testId === t.id), anthropometry, { tests: catalog.tests, allSessions: raw }); sessions = sessions.concat(e.sessions); Object.assign(omitted, e.omitted); }
    const [targets, positions, hist, fvProfiles] = await Promise.all([db.targets.toArray(), db.positions.toArray(), db.playerPositions.where('playerId').equals(player.id).toArray(), db.fvProfiles.where('playerId').equals(player.id).toArray()]);
    return { catalog, sessions, omitted, targets, positions, fvProfiles, positionId: positionOnDate(hist).principal?.positionId ?? null };
  }, [db, player.id, version, tick]);
  const block = BLOQUES.some(([k]) => k === query.b) ? query.b : 'fuerza';
  const testId = query.t ? Number(query.t) : null;
  const setQ = (patch) => replaceQuery(`jugador-${player.id}`, { ...query, ...patch });
  if (error) return html`<p class="status fail">${error}</p>`;
  if (!data) return html`<p>Cargando…</p>`;
  const { catalog, sessions, omitted, targets, positions, fvProfiles, positionId } = data;
  const hasSessions = (t) => sessions.some((s) => s.testId === t.id);
  // Los perfiles carga-velocidad no se guardan como sesiones: el test tiene datos si hay un perfil SUYO (uno sin test asignado no cuenta: no se sabe de qué test es).
  const hasFv = (t) => vbtTest(t) && fvProfiles.some((p) => (p.testId ?? null) === t.id);
  const sinAsignar = (t) => vbtTest(t) && !fvProfiles.some((p) => (p.testId ?? null) === t.id) && fvProfiles.some((p) => (p.testId ?? null) === null);
  const loadTest = (t) => catalog.variables.some((v) => v.testId === t.id && !v.archived && v.kind !== 'derived' && LOAD_VARIABLE_NAMES.includes(v.name)); // Iso-Hold y RM: la carga se escribe a mano
  const vbtTest = (t) => /velocity profile/i.test(t.name); // perfiles fuerza–velocidad: el perfil carga-velocidad se introduce aquí
  const angTest = (t) => t.name === 'Jurdan Test'; // test de ángulos: se mide a partir de fotografías (herramienta integrada)
  const conDatos = (t) => hasSessions(t) || hasFv(t);
  const selectable = (t) => hasSessions(t) || loadTest(t) || vbtTest(t) || angTest(t);
  const allOf = (b) => catalog.tests.filter((t) => (t.blockKey ?? 'fuerza') === b && !t.archived);
  const tests = allOf(block);
  const test = tests.find((t) => t.id === testId && selectable(t)) ?? tests.find(hasSessions) ?? null;
  const mName = (t) => catalog.manifestations.find((m) => m.id === t.manifestationId)?.name ?? 'Sin manifestación';
  const zName = (t) => catalog.zones.find((z) => z.id === t.zoneId)?.name ?? null;
  const groups = [...new Set(tests.map(mName))];
  const rank = (t) => { const z = (zName(t) ?? '').toLowerCase(); return z.startsWith('ankle') ? 0 : z.startsWith('knee') ? 1 : z.startsWith('hip') ? 2 : z.startsWith('groin') ? 3 : 4; }; // Ankle, Knee, Hip, Groin; sin zona al final
  const ordered = (g) => tests.filter((t) => mName(t) === g).map((t, i) => [t, i]).sort((a, b) => rank(a[0]) - rank(b[0]) || a[1] - b[1]).map(([t]) => t);
  const cuerpoTest = () => !test ? html`<p class="muted">Elige un test de la lista.</p>` : html`
      <div class="test-sticky"><span class="muted">${playerLabel(player)} ·</span> <h3>${dn(test.name)}</h3>${hasSessions(test) ? html`<a class="button sticky-link" href=${buildHash(`test-${test.id}`, { ...KEEP(query), m: query.m ?? 'pa', j: player.id })}>Ver todos los jugadores en este test</a>` : null}</div>
      ${hasSessions(test) ? html`<${PanelTest} key=${test.id} player=${player} test=${test} catalog=${catalog} sessions=${sessions.filter((s) => s.testId === test.id)} omitted=${omitted} reload=${reload} q=${query} setQ=${setQ} targets=${targets} positions=${positions} positionId=${positionId} />` : vbtTest(test) ? null : html`<p class="muted">Este jugador aún no tiene sesiones de este test.</p>`}
      ${loadTest(test) ? html`<${AltaManualCarga} key=${'am' + test.id} player=${player} catalog=${catalog} reload=${reload} fixedTest=${test} />` : null}
      ${vbtTest(test) ? (typeof fv === 'function' ? fv(test) : fv) : null}
      ${angTest(test) ? html`<${Card} titulo="Medir ángulos con fotografías"><p class="muted">Carga las dos fotos, revisa los puntos y guarda: las medidas se añaden a este jugador.</p><${Angulos} key=${'ang' + player.id} jugadorId=${player.id} /><//>` : null}`;
  const listaTests = () => !tests.length ? html`<p class="muted">Bloque sin tests definidos.</p>` : html`
      <div class=${`test-list cols-${Math.min(5, groups.length)}`}>${groups.map((g) => html`<div key=${g}>${g === 'Sin manifestación' ? null : html`<h3>${g}</h3>`}<div class="test-items">${ordered(g).map((t) => { const ok = selectable(t); return html`<button type="button" key=${t.id} disabled=${!ok} title=${!ok ? 'Sin sesiones de este test' : sinAsignar(t) ? 'Tiene un perfil sin test asignado: ábrelo y asígnalo' : conDatos(t) ? t.name : 'Aún sin datos: pulsa para añadirlos'} class=${(test && t.id === test.id ? 'test-item on' : 'test-item') + (!conDatos(t) && ok ? ' vacio' : '')} aria-pressed=${!!test && t.id === test.id} onClick=${() => setQ({ t: t.id, v: undefined, va: undefined })}>${zName(t) ? zName(t) + ' · ' : ''}${dn(t.name)}${!conDatos(t) && ok ? html` <span class="sin-datos">· sin datos aún</span>` : null}</button>`; })}</div></div>`)}</div>
      ${cuerpoTest()}`;
  return html`<${Card} titulo="Resultados por bloque">
    ${test ? html`<${Migas} items=${[{ label: 'Jugadores', href: '#jugadores' }, { label: playerLabel(player) }, { label: dn(test.name) }]} />` : null}
    <div role="tablist" aria-label="Bloques" class="tabs">${BLOQUES.map(([k, n]) => html`<button type="button" role="tab" key=${k} aria-selected=${block === k} class=${block === k ? 'tab on' : 'tab'} onClick=${() => setQ({ b: k, t: undefined, v: undefined, va: undefined })}>${n}${k === 'edicion' || k === 'asimetrias' ? '' : html` <span class="muted">(${allOf(k).filter(hasSessions).length})</span>`}</button>`)}</div>
    ${block === 'edicion' ? edicion : block === 'deficits' ? html`<${Deficits} player=${player} positionId=${positionId} />` : block === 'asimetrias' ? html`<${PanelAsimetrias} catalog=${catalog} sessions=${sessions} q=${query} setQ=${setQ} />` : block === 'perimetros' ? html`${listaTests()}${antrop}` : listaTests()}
  <//>`;
}
