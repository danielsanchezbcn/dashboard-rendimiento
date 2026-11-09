// pages-evolucion.js — fase 5a: resultados del jugador por bloque, gráfico de evolución (G1), asimetría (G5) y gestión de sesiones.
import './fuentes.js';
import { html, useState, useEffect, useRef, Chart } from './libs.js';
import { useApp } from './context.js';
import { Card, Msg, useLoad, useRunner } from './componentes.js';
import { fmtDay, todayIso } from './fechas.js';
import { addManualLoad, LOAD_VARIABLE_NAMES } from './isohold.js';
import { listCatalog, SIDES } from './catalogo.js';
import { replaceQuery, buildHash } from './rutas.js';
import { Migas, KEEP, NotaRelativa } from './pages-test.js';
import { expandRelative, isViewable, hasData, orderVars, isRelative, defaultVar } from './relativos.js';
import { PercentilesPanel, useRefData, refContext } from './pages-percentiles.js';
import { positionOnDate } from './posiciones.js';
import { withReferenceWeights } from './relaciones.js';
import { isAsymVariable, asymText } from './catalogo.js';
import { setTarget, deleteTarget, resolveTarget, distanceToTarget } from './targets.js';
import { buildSeries, personalAverage, personalBest, currentResult, asymmetrySeries, setSessionExcluded, deleteSessionPermanently, correctSession } from './evolucion.js';
import { playerLabel, nameMatchesPlayer } from './jugadores.js';
import { PAL, colorLado } from './colores.js';
import { Copiable } from './copiar.js';
import { RadarPanel } from './pages-radar.js';
import { ICONO_TARGET } from './iconos.js';

// Bandera de Target (icono del usuario): se dibuja al final de la línea de target.
const flagImg = typeof Image === 'undefined' ? null : Object.assign(new Image(), { src: ICONO_TARGET });
const flagPlugin = { id: 'banderaTarget', afterDatasetsDraw(chart) {
  const i = chart.data.datasets.findIndex((d) => d.bandera); if (i < 0 || !flagImg?.complete || !flagImg.naturalWidth) return;
  const meta = chart.getDatasetMeta(i); const pt = meta.data[meta.data.length - 1]; if (!pt) return;
  const h = 26, w = h * (flagImg.naturalWidth / flagImg.naturalHeight);
  chart.ctx.drawImage(flagImg, pt.x - w * 0.75, pt.y - h - 2, w, h);
} };


const nf = (n, d = 2) => (n === null || n === undefined ? '—' : Number(n).toLocaleString('es-ES', { maximumFractionDigits: d }));
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
function Grafico({ build, label, deps, nombre = 'grafico', alto }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!ref.current || !Chart) return undefined;
    const colors = { text: PAL.texto, muted: PAL.texto, line: PAL.rejilla, accent: PAL.jugador, ok: PAL.texto, fail: PAL.jugador, warn: PAL.texto };
    let chart;
    try { chart = new Chart(ref.current, { plugins: [flagPlugin], ...build(colors) }); } catch (e) { /* sin gráfico: la tabla de datos sigue disponible */ }
    return () => chart?.destroy();
  }, [...deps]);
  return html`<${Copiable} nombre=${nombre}><div class="chart-box doc" style=${alto ? `height:${alto}` : ''}><canvas ref=${ref} role="img" aria-label=${label}></canvas></div><//>`;
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
function lineConfig(c, { sides, series, stats, unit, yMin, yMax, tg, refLines = [], info }) {
  const lr = sides.length === 2;
  const sfx = (sd) => (lr ? ` (${sd === 'L' ? 'I' : 'D'})` : '');
  const all = sides.flatMap((sd) => series[sd].valid.map((p) => dayNum(p.date)));
  const x0 = all.length ? Math.min(...all) : 0, x1 = all.length ? Math.max(...all) : 1;
  const datasets = [];
  for (const sd of sides) {
    const col = colorLado(sd);
    datasets.push({ side: sd, label: `Average de sesión${sfx(sd)}`, data: series[sd].valid.map((p) => ({ x: dayNum(p.date), y: p.value, p })), borderColor: col, backgroundColor: col, pointRadius: 4, tension: 0, borderWidth: 2 });
    if (series[sd].excluded.length) datasets.push({ label: `Sesión excluida${sfx(sd)}`, data: series[sd].excluded.map((p) => ({ x: dayNum(p.date), y: p.value })), showLine: false, borderColor: PAL.texto, backgroundColor: 'transparent', pointStyle: 'crossRot', pointRadius: 6, borderWidth: 2 });
    const { pa, pb } = stats[sd];
    if (pa.defined) datasets.push({ label: `Personal Average${sfx(sd)}`, data: [{ x: x0, y: pa.value }, { x: x1, y: pa.value }], borderColor: lr ? col : PAL.texto, borderDash: [6, 4], pointRadius: 0, borderWidth: 2 });
    if (pb.defined) datasets.push({ label: `Personal Best${sfx(sd)}`, data: [{ x: x0, y: pb.value }, { x: x1, y: pb.value }], borderColor: lr ? col : PAL.texto, borderDash: [2, 3], pointRadius: 0, borderWidth: 2 });
  }
  refLines.forEach((r) => datasets.push({ label: r.label, data: [{ x: x0, y: r.value }, { x: x1 === x0 ? x0 + 1 : x1, y: r.value }], borderColor: r.color, borderDash: r.dash, pointRadius: 0, borderWidth: r.w }));
  const tgs = sides.map((sd) => tg[sd]).filter(Boolean).filter((t, i, a) => a.findIndex((u) => u.value === t.value) === i);
  tgs.forEach((t) => datasets.push({ label: `Target (${t.origin})`, data: [{ x: x0, y: t.value }, { x: x1 === x0 ? x0 + 1 : x1, y: t.value }], borderColor: PAL.target, borderDash: [10, 4], pointRadius: 0, borderWidth: 2, bandera: true }));
  const o = baseOptions(c, unit, yMin, yMax);
  o.plugins.tooltip.callbacks.label = (it) => {
    const p = it.raw?.p;
    return p ? `${it.dataset.label}: ${nf(p.value)} ${unit ?? ''} · ${p.reps ?? '?'} rep.` : `${it.dataset.label}: ${nf(it.parsed.y)} ${unit ?? ''}`;
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
  const name = { L: 'Izquierda', R: 'Derecha', S: 'Valor' };
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
    ${sides.map((sd) => html`<label key=${'v' + sd}>${name[sd]} (${variable.name}${variable.unit ? `, ${variable.unit}` : ''}) <input inputmode="decimal" value=${f['v' + sd]} onInput=${set('v' + sd)} /></label>`)}
    ${sides.map((sd) => html`<label key=${'r' + sd}>Repeticiones${sides.length === 2 ? ' ' + name[sd].toLowerCase() : ''} <input inputmode="numeric" value=${f['r' + sd]} onInput=${set('r' + sd)} /></label>`)}
    <p class="muted">Cambiar las repeticiones modifica el peso de la sesión en el Personal Average. Solo se corrige la variable que estás viendo; las demás variables de la sesión no cambian.</p>
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
    <p><strong>Eliminar definitivamente</strong> la sesión de <em>${playerLabel(player)}</em> en <em>${test.name}</em> del <em>${fmtDay(s.date)}</em>${s.time ? ` (${s.time})` : ''}. No se borra ninguna otra sesión. Las copias de seguridad antiguas pueden conservarla.</p>
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
  const cell = (s, side) => { const v = s.values?.[variable.id]?.[side]; return Number.isFinite(v) ? (isAsymVariable(variable) ? asymText(v) : nf(v)) : '—'; };
  const reps = (s, side) => (side === 'S' ? s.reps?.total : s.reps?.[side]) ?? '—';
  return html`<div class="table-wrap"><table><caption>Sesiones de ${test.name} · ${variable.name}${variable.unit ? ` (${variable.unit})` : ''}</caption>
    <thead><tr><th>Fecha</th>${lr ? html`<th>Izquierda</th><th>Derecha</th><th>Rep. I / D</th>` : html`<th>Valor</th><th>Rep.</th>`}<th>Estado</th><th>Origen</th><th>Acciones</th></tr></thead>
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
  const sideName = { L: 'Izquierda', R: 'Derecha', S: 'Valor' };
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
    ${rows.length ? html`<div class="table-wrap"><table><caption>Target aplicable a ${playerLabel(player)} en ${variable.name}</caption><thead><tr><th>Lado</th><th class="num">Target</th><th>Origen</th><th>Resultado actual</th><th>Personal Average</th></tr></thead>
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
    <p class="muted">Un target es un valor objetivo que defines tú. No se colorea: solo se indica si está alcanzado y la distancia, usando la dirección de la variable en el catálogo.</p></section>`;
}

// Asimetría horizontal como en VALD: eje central en 0, azul (izquierda) hacia la izquierda y naranja (derecha) hacia la derecha, con la fecha en el eje vertical.
function asymConfig(c, asym, variable) {
  const m = Math.max(1, ...asym.map((a) => Math.abs(a.pct))); const lim = Math.ceil(m * 1.35);
  const etiquetas = { id: 'etiquetasAsim', afterDatasetsDraw(ch) {
    const meta = ch.getDatasetMeta(0); const g = ch.ctx; g.save(); g.font = 'bold 12px sans-serif'; g.fillStyle = PAL.texto; g.textBaseline = 'middle';
    meta.data.forEach((bar, i) => { const v = asym[i].pct; g.textAlign = v >= 0 ? 'left' : 'right'; g.fillText(`${nf(Math.abs(v), 1)} %`, bar.x + (v >= 0 ? 6 : -6), bar.y); });
    g.restore(); } };
  return { type: 'bar', plugins: [etiquetas], data: { labels: asym.map((a) => fmtDay(a.date)), datasets: [{ label: 'Asimetría (%)', data: asym.map((a) => a.pct), backgroundColor: asym.map((a) => (a.pct >= 0 ? PAL.der : PAL.izq)), barPercentage: 0.7 }] },
    options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, animation: false, layout: { padding: { right: 36, left: 4 } },
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: (it) => `${asymText(it.parsed.x)} · I ${nf(asym[it.dataIndex].left)} / D ${nf(asym[it.dataIndex].right)} ${variable.unit ?? ''}` } } },
      scales: { x: { min: -lim, max: lim, title: { display: true, text: 'Asimetría interlateral (%) · izquierda ◄  ► derecha', color: PAL.texto }, ticks: { color: PAL.texto, callback: (v) => `${Math.abs(v)}` }, grid: { color: (ctx) => (ctx.tick.value === 0 ? PAL.texto : PAL.rejilla) } },
        y: { ticks: { color: PAL.texto }, grid: { display: false } } } } };
}

function PanelTest({ player, test, catalog, sessions, omitted = {}, reload, q, setQ, targets = [], positions = [], positionId = null }) {
  const refData = useRefData(test);
  const protocols = catalog.protocols.filter((p) => p.testId === test.id);
  const vars = orderVars(catalog.variables.filter((v) => v.testId === test.id && isViewable(v) && hasData(v, sessions)));
  const proto = q.p ?? 'all';
  const from = q.from ?? '', to = q.to ?? '';
  const variable = vars.find((v) => String(v.id) === String(q.v)) ?? defaultVar(vars, sessions);
  if (!variable) return html`<p class="muted">Este test no tiene variables con datos.</p>`;
  const protocolId = proto === 'all' ? undefined : proto === 'none' ? null : Number(proto);
  const f = { from: from || null, to: to || null, protocolId };
  const sides = variable.sides === 'LR' ? ['L', 'R'] : ['S'];
  const series = Object.fromEntries(sides.map((sd) => [sd, buildSeries(sessions, variable.id, sd, f)]));
  const stats = Object.fromEntries(sides.map((sd) => [sd, { pa: personalAverage(series[sd].valid), pb: personalBest(series[sd].valid, variable.direction) }]));
  const tg = Object.fromEntries(sides.map((sd) => [sd, resolveTarget(targets, { playerId: player.id, positionId, variableId: variable.id, side: sd })]));
  // Variable relativa (BW/SW): la Premier League solo publica valores absolutos (N), así que su zona se calcula con el valor absoluto equivalente del jugador.
  const srcVar = isRelative(variable) ? catalog.variables.find((x) => x.id === variable.formula.operands[0]) : null;
  const abs = srcVar ? (() => { const ser = Object.fromEntries(sides.map((sd) => [sd, buildSeries(sessions, srcVar.id, sd, f)])); return { variable: srcVar, stats: Object.fromEntries(sides.map((sd) => [sd, { pa: personalAverage(ser[sd].valid), pb: personalBest(ser[sd].valid, srcVar.direction) }])), current: Object.fromEntries(sides.map((sd) => [sd, currentResult(ser[sd].valid)])) }; })() : null;
  const ctx = refData ? refContext({ refData, test, variable, sides, filters: f, playerId: player.id, positionId, srcVar }) : null;
  const posNombre = positions.find((p) => p.id === positionId)?.name;
  const REF_OPTS = [['p50', 'P50 La Liga', 'p50', [], 2], ['p50pos', `P50 La Liga (${posNombre ?? 'posición'})`, 'p50pos', [8, 4], 2], ['p75', 'P75 La Liga', 'p75', [2, 3], 2], ['p75pos', `P75 La Liga (${posNombre ?? 'posición'})`, 'p75pos', [10, 3, 2, 3], 2], ['premier50', 'P50 Premier League', 'premier50', [], 1.5], ['premier75', 'P75 Premier League', 'premier75', [8, 3], 1.5]];
  const chosen = String(q.rl ?? '').split(',').filter(Boolean);
  const refLines = ctx ? REF_OPTS.filter(([k]) => chosen.includes(k) && ctx.lines[k] != null).map(([k, label, , dash, w]) => ({ k, label, value: ctx.lines[k], dash, w, color: k.startsWith('premier') ? PAL.premier : PAL.laLiga })) : [];
  const all = sides.flatMap((sd) => [...series[sd].valid, ...series[sd].excluded].map((p) => p.value).concat(tg[sd] ? [tg[sd].value] : [])).concat(refLines.map((r) => r.value));
  const pad = all.length ? (Math.max(...all) - Math.min(...all)) * 0.1 || Math.abs(Math.max(...all)) * 0.1 || 1 : 1;
  const yMin = all.length ? Math.min(...all) - pad : undefined, yMax = all.length ? Math.max(...all) + pad : undefined; // mismo eje para ambos lados
  const asym = variable.sides === 'LR' ? asymmetrySeries(sessions, variable.id, f) : null;
  const sideName = { L: 'Izquierda', R: 'Derecha', S: 'Valor' };
  const key = [player.id, test.id, variable.id, proto, from, to, sessions.map((s) => s.id + s.status).join(), sides.map((sd) => (tg[sd] ? tg[sd].origin + tg[sd].value : '-')).join()].join('|');
  const allUrl = buildHash(`test-${test.id}`, { ...KEEP(q), v: variable.id, m: q.m ?? 'pa', j: player.id });
  return html`<div class="evo">
    <p><a class="button" href=${allUrl}>Ver todos los jugadores en este test</a></p>
    <div class="filters">
      <label>Variable <select value=${variable.id} onChange=${(e) => setQ({ v: e.target.value })}>${vars.map((v) => html`<option key=${v.id} value=${v.id}>${v.name}${v.unit && !v.name.includes(`(${v.unit})`) ? ` (${v.unit})` : ''}${v.sides === 'LR' ? ' · I/D' : ''}</option>`)}</select></label>
      ${protocols.length ? html`<label>Protocolo <select value=${proto} onChange=${(e) => setQ({ p: e.target.value })}><option value="all">Todos</option><option value="none">Sin protocolo</option>${protocols.map((p) => html`<option key=${p.id} value=${p.id}>${p.name}</option>`)}</select></label>` : null}
      <label>Desde <input type="date" value=${from} onInput=${(e) => setQ({ from: e.target.value })} /></label>
      <label>Hasta <input type="date" value=${to} onInput=${(e) => setQ({ to: e.target.value })} /></label>
    </div>
    <${NotaRelativa} variable=${variable} omitted=${omitted} catalog=${catalog} />
    <fieldset class="modes"><legend>Líneas de referencia en el gráfico</legend>${REF_OPTS.map(([k, label]) => { const off = !ctx || ctx.lines[k] == null ; return html`<label class="check" key=${k} title=${off ? (k.endsWith('pos') && positionId == null ? 'El jugador no tiene posición principal.' : k.startsWith('premier') ? 'Esta variable no figura en las tablas de la Premier League.' : `Sin muestra suficiente (mínimo ${ctx?.minN ?? 10} jugadores).`) : ''}><input type="checkbox" disabled=${off} checked=${chosen.includes(k)} onChange=${(e) => setQ({ rl: (e.target.checked ? [...chosen, k] : chosen.filter((x) => x !== k)).join(',') || undefined })} /> ${label}</label>`; })}</fieldset>
    ${sides.some((sd) => series[sd].valid.length)
      ? html`<${Grafico} deps=${[key, 'lineas', refLines.map((r) => r.k + r.value).join(), !!ctx]} nombre=${`evolucion-${variable.name}`} label=${`Evolución de ${variable.name}: ${sides.map((sd) => `${sideName[sd]} ${series[sd].valid.length} sesiones`).join(', ')}`} build=${(c) => lineConfig(c, { sides, series, stats, unit: variable.unit, yMin, yMax, tg, refLines, info: ctx ? (v) => ctx.info(v, 'last') : null })} />`
      : html`<p class="muted">Sin sesiones válidas en el periodo.</p>`}
    <${TargetRapido} key=${'tr' + variable.id + player.id} player=${player} variable=${variable} sides=${sides} own=${targets.find((t) => t.scope === 'player' && t.playerId === player.id && t.variableId === variable.id)} reload=${reload} />
    <${TargetPanel} key=${'t' + variable.id} player=${player} variable=${variable} sides=${sides} targets=${targets} positions=${positions} positionId=${positionId} stats=${stats} current=${Object.fromEntries(sides.map((sd) => [sd, currentResult(series[sd].valid)]))} reload=${reload} />
    ${asym && asym.length ? html`<section><h4>Asimetría por sesión (como en VALD)</h4>
      <p class="leyenda" aria-label="Leyenda"><span class="leyenda-chip" style=${`background:${PAL.izq}`}>LEFT</span> <span class="leyenda-chip" style=${`background:${PAL.der}`}>RIGHT</span></p>
      <p class="muted">|D − I| ÷ máx × 100 y la letra del lado con el valor más alto (L izquierda, R derecha). Como en VALD: barra azul hacia la izquierda si el lado izquierdo es mayor, naranja hacia la derecha si lo es el derecho.</p>
      <${Grafico} deps=${[key, 'asim']} nombre=${`asimetria-${variable.name}`} alto=${`${Math.max(9, 3.2 + asym.length * 2.2)}rem`} label=${`Asimetría de ${variable.name}: ${asym.length} sesiones`} build=${(c) => asymConfig(c, asym, variable)} />
      <p class="muted">Última: ${asymText(asym[asym.length - 1].pct)} (izquierda ${nf(asym[asym.length - 1].left)}, derecha ${nf(asym[asym.length - 1].right)} ${variable.unit ?? ''}).</p></section>` : null}
    <${PercentilesPanel} key=${variable.id} player=${player} test=${test} variable=${variable} mine=${sessions} q=${q} setQ=${setQ} filters=${f} targets=${tg} refData=${refData} abs=${abs} stats=${stats} current=${Object.fromEntries(sides.map((sd) => [sd, currentResult(series[sd].valid)]))} />
    <${RadarPanel} key=${'radar' + test.id + player.id} player=${player} testName=${test.name} />
    <${TablaSesiones} sessions=${sessions.filter((s) => s.values?.[variable.id] && (protocolId === undefined || (s.protocolId ?? null) === protocolId) && (!f.from || s.date >= f.from) && (!f.to || s.date <= f.to))} variable=${variable} player=${player} test=${test} reload=${reload} />
    <p class="muted">Cada punto es el Average de una sesión (media de sus repeticiones). Las sesiones excluidas no cuentan en el Personal Best, el Personal Average ni en ningún análisis. La Máxima repetición no está disponible: los datos importados traen una media por sesión.</p>
  </div>`;
}

// Alta manual (opción A, 8/11/2026): la carga de Iso-Hold y RM no viene de VALD; se escribe aquí y crea una sesión con la variable de carga del test.
function AltaManualCarga({ player, catalog, reload }) {
  const { db } = useApp();
  const { msg, busy, run } = useRunner();
  const tests = catalog.tests.filter((t) => !t.archived && catalog.variables.some((v) => v.testId === t.id && !v.archived && v.kind !== 'derived' && LOAD_VARIABLE_NAMES.includes(v.name)));
  const [f, setF] = useState({ testId: '', date: todayIso(), time: '', load: '' });
  if (!tests.length) return null;
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const save = run(async () => {
    await addManualLoad(db, { playerId: player.id, testId: Number(f.testId), date: f.date, time: f.time, load: f.load });
    setF({ ...f, load: '' }); reload();
  }, 'Sesión guardada.');
  return html`<${Card} titulo="Alta manual de carga (Iso-Hold y RM)" id="alta-manual">
    <p class="muted">La carga de estos tests no viene de VALD: escríbela aquí. Se guarda una sesión con la carga (kg); las variables calculadas (MVIC, %PIMA, %BW/%SW, 1RM estimado) se obtienen solas. Si te equivocas, corrígela desde la tabla de sesiones del test.</p>
    <form class="filters" onSubmit=${save} aria-label="Alta manual de carga">
      <label>Test <select value=${f.testId} onChange=${set('testId')} required><option value="">Elige…</option>${tests.map((t) => html`<option key=${t.id} value=${t.id}>${t.name}</option>`)}</select></label>
      <label>Fecha <input type="date" value=${f.date} onInput=${set('date')} required /></label>
      <label>Hora (opcional) <input type="time" value=${f.time} onInput=${set('time')} /></label>
      <label>Carga (kg) <input inputmode="decimal" value=${f.load} onInput=${set('load')} required /></label>
      <button type="submit" disabled=${busy || !f.testId}>Guardar carga</button>
    </form><${Msg} msg=${msg} /><//>`;
}

export function ResultadosJugador({ player, query = {} }) {
  const { db, version } = useApp();
  const [tick, setTick] = useState(0);
  const reload = () => setTick((t) => t + 1);
  const { data, error } = useLoad(async () => {
    const catalog = await listCatalog(db);
    const raw = await db.sessions.where('playerId').equals(player.id).toArray();
    const anthropometry = withReferenceWeights(await db.anthropometry.where('playerId').equals(player.id).toArray(), [await db.players.get(player.id)]);
    let sessions = []; const omitted = {};
    for (const t of catalog.tests) { const e = expandRelative(catalog.variables, t.id, raw.filter((s) => s.testId === t.id), anthropometry, { tests: catalog.tests, allSessions: raw }); sessions = sessions.concat(e.sessions); Object.assign(omitted, e.omitted); }
    const [targets, positions, hist] = await Promise.all([db.targets.toArray(), db.positions.toArray(), db.playerPositions.where('playerId').equals(player.id).toArray()]);
    return { catalog, sessions, omitted, targets, positions, positionId: positionOnDate(hist).principal?.positionId ?? null };
  }, [db, player.id, version, tick]);
  const block = query.b ?? 'fuerza';
  const testId = query.t ? Number(query.t) : null;
  const setQ = (patch) => replaceQuery(`jugador-${player.id}`, { ...query, ...patch });
  if (error) return html`<p class="status fail">${error}</p>`;
  if (!data) return html`<p>Cargando…</p>`;
  const { catalog, sessions, omitted, targets, positions, positionId } = data;
  const blocks = [['fuerza', 'Manifestaciones de la fuerza'], ['perimetros', 'Perímetros'], ['nme', 'NME']];
  const testsOf = (b) => catalog.tests.filter((t) => (t.blockKey ?? 'fuerza') === b && !t.archived && sessions.some((s) => s.testId === t.id));
  const tests = testsOf(block);
  const test = tests.find((t) => t.id === testId) ?? tests[0];
  const mName = (t) => catalog.manifestations.find((m) => m.id === t.manifestationId)?.name ?? 'Sin manifestación';
  const zName = (t) => catalog.zones.find((z) => z.id === t.zoneId)?.name ?? null;
  const groups = [...new Set(tests.map(mName))];
  return html`<${Card} titulo="Resultados por bloque">
    ${test ? html`<${Migas} items=${[{ label: 'Jugadores', href: '#jugadores' }, { label: playerLabel(player) }, { label: test.name }]} />` : null}
    <div role="tablist" aria-label="Bloques" class="tabs">${blocks.map(([k, n]) => html`<button type="button" role="tab" key=${k} aria-selected=${block === k} class=${block === k ? 'tab on' : 'tab'} onClick=${() => setQ({ b: k, t: undefined, v: undefined })}>${n} <span class="muted">(${testsOf(k).length})</span></button>`)}</div>
    ${!tests.length ? html`<p class="muted">${block === 'fuerza' ? 'Este jugador aún no tiene sesiones de fuerza. Impórtalas desde «Importar».' : 'Sin datos en este bloque todavía (aún no hay importación para él).'}</p>` : html`
      <div class="test-list">${groups.map((g) => html`<div key=${g}><h3>${g}</h3><div class="chips">${tests.filter((t) => mName(t) === g).map((t) => html`<button type="button" key=${t.id} class=${t.id === test.id ? 'chip on' : 'chip'} aria-pressed=${t.id === test.id} onClick=${() => setQ({ t: t.id, v: undefined })}>${zName(t) ? zName(t) + ' · ' : ''}${t.name}</button>`)}</div></div>`)}</div>
      <h3>${test.name}</h3>
      <${PanelTest} key=${test.id} player=${player} test=${test} catalog=${catalog} sessions=${sessions.filter((s) => s.testId === test.id)} omitted=${omitted} reload=${reload} q=${query} setQ=${setQ} targets=${targets} positions=${positions} positionId=${positionId} />`}
  <//><${AltaManualCarga} player=${player} catalog=${catalog} reload=${reload} />`;
}
