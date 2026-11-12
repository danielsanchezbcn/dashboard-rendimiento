// pages-fv.js — G6 (D17): perfil carga-velocidad en la ficha del jugador, con el aspecto del gráfico aportado por el usuario
// (fondo negro; verde = jugador, con su recta de regresión y la ecuación; amarillo = perfil «Balanced» de referencia). Entrada manual o desde su Excel.
import './fuentes.js';
import { html, useState, useEffect, useRef, Chart } from './libs.js';
import { useApp } from './context.js';
import { Card, useLoad, useRunner, Msg } from './componentes.js';
import { fmtDay, todayIso } from './fechas.js';
import { getSetting, setSetting, clearSetting } from './db.js';
import { massNearest, withReferenceWeights } from './relaciones.js';
import { readFileGrid } from './excel.js';
import { downloadBlob } from './io.js';
import { BANDS } from './percentiles.js';
import { fitLoadVelocity, classText, compareWithSquad, parseFvGrid, referenceFrom, addFvProfile, updateFvProfile, deleteFvProfile, asignarFvProfile, FV_REFERENCE_DEFAULT, FV_MAX_POINTS, FDM_VELOCITY_DEFAULT } from './fuerzavelocidad.js';
import { playerLabel } from './jugadores.js';
import { dn } from './nombres.js';
import { Copiable } from './copiar.js';
import { PAL } from './colores.js';

const nf = (n, d = 2) => (n === null || n === undefined || !Number.isFinite(n) ? '—' : Number(n).toLocaleString('es-ES', { maximumFractionDigits: d, minimumFractionDigits: d }));
const VERDE = '#7FBF98'; const AMARILLO = '#FFC000'; const BLANCO = '#FFFFFF';
const emptyRows = (n = 5) => Array.from({ length: n }, () => ({ load: '', velocity: '' }));
const rowsOf = (points) => points.map((p) => ({ load: String(p.load).replace('.', ','), velocity: String(p.velocity).replace('.', ',') }));

export function fvChartConfig({ fit, reference, name }) {
  const pts = fit.points;
  const xs = pts.map((p) => p.load).concat(reference.map((p) => p.load));
  const x0 = Math.min(...xs); const x1 = Math.max(...xs);
  const trend = fit.ok || Number.isFinite(fit.a) ? [{ x: pts[0].load, y: fit.a * pts[0].load + fit.b }, { x: pts[pts.length - 1].load, y: fit.a * pts[pts.length - 1].load + fit.b }] : [];
  const yMin = Math.min(fit.fdmVelocity ?? FDM_VELOCITY_DEFAULT, ...pts.map((p) => p.velocity), ...reference.map((p) => p.velocity));
  const eq = Number.isFinite(fit.a) ? `y = ${nf(fit.a, 4)}x ${fit.b < 0 ? '−' : '+'} ${nf(Math.abs(fit.b), 4)}    R² = ${nf(fit.r2, 4)}` : '';
  const axis = (title, fmt, min) => ({ min, title: { display: true, text: title, color: BLANCO, font: { size: 14, weight: 'bold' } }, ticks: { color: BLANCO, font: { size: 13 }, callback: fmt }, grid: { color: '#D9D9D9' }, border: { color: '#B3B3B3' } });
  return {
    type: 'line',
    data: { datasets: [
      { label: 'Balanced (reference)', data: reference.map((p) => ({ x: p.load, y: p.velocity })), borderColor: PAL.laLiga, backgroundColor: PAL.laLiga, borderDash: [8, 5], borderWidth: 3, pointRadius: 0, tension: 0 },
      { label: `${name}`, data: pts.map((p) => ({ x: p.load, y: p.velocity })), borderColor: BLANCO, backgroundColor: BLANCO, pointBackgroundColor: BLANCO, pointBorderColor: BLANCO, pointRadius: 5, borderWidth: 2.5, tension: 0.3 },
      { label: 'Regression line', data: trend, borderColor: BLANCO, borderWidth: 2, pointRadius: 0, tension: 0, borderDash: [3, 4] },
    ] },
    options: {
      responsive: true, maintainAspectRatio: false, animation: false,
      plugins: { legend: { labels: { color: BLANCO, usePointStyle: true } }, tooltip: { callbacks: { label: (it) => `${it.dataset.label}: ${nf(it.parsed.x, 0)} kg · ${nf(it.parsed.y, 2)} m/s` } } },
      scales: { x: { type: 'linear', ...axis('Load (kg)', (v) => `${v}kg`, Math.floor(x0 / 10) * 10 - 10), max: Math.ceil(x1 / 10) * 10 + 10 }, y: { type: 'linear', ...axis('Mean Propulsive Velocity (m/s)', (v) => Number(v).toFixed(2), Math.floor(yMin * 20) / 20) } },
    },
    plugins: [{ id: 'fvfondo', beforeDraw(c) { const { ctx } = c; ctx.save(); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, c.width, c.height); ctx.restore(); },
      afterDraw(c) { if (!eq) return; const { ctx, chartArea } = c; ctx.save(); ctx.fillStyle = BLANCO; ctx.font = '12px sans-serif'; ctx.textAlign = 'right'; ctx.fillText(eq, chartArea.right - 12, chartArea.top + 18); ctx.restore(); } }],
  };
}

function FvChart({ config, label, canvasRef }) {
  useEffect(() => {
    if (!canvasRef.current || !Chart) return undefined;
    let chart; try { chart = new Chart(canvasRef.current, config); } catch (e) { /* sin gráfico: las tablas siguen */ }
    return () => chart?.destroy();
  }, [JSON.stringify(config.data), config.options.scales.y.min]);
  return html`<${Copiable} nombre="perfil-carga-velocidad"><div class="chart-box" style="background:#000;border-radius:.5rem;height:380px"><canvas ref=${canvasRef} role="img" aria-label=${label}></canvas></div><//>`;
}

function FvForm({ player, test, editing, initial, onDone, setInitial }) {
  const { db } = useApp();
  const { msg, setMsg, busy, run } = useRunner();
  const [f, setF] = useState({ date: initial?.date ?? todayIso(), exercise: initial?.exercise ?? '', fdm: String(initial?.fdmVelocity ?? FDM_VELOCITY_DEFAULT).replace('.', ',') });
  const [rows, setRows] = useState(initial ? rowsOf(initial.points) : emptyRows());
  const [blocks, setBlocks] = useState(null);
  const setRow = (i, k) => (e) => setRows(rows.map((r, j) => (j === i ? { ...r, [k]: e.target.value } : r)));
  const input = () => ({ playerId: player.id, testId: editing ? (initial?.testId ?? (test ? test.id : null)) : (test ? test.id : null), date: f.date, exercise: f.exercise, fdmVelocity: f.fdm, points: rows.map((r) => ({ load: r.load, velocity: r.velocity })), source: blocks ? 'Excel' : 'manual' });
  const save = run(async () => {
    if (editing) await updateFvProfile(db, editing, input()); else await addFvProfile(db, input());
    setRows(emptyRows()); setBlocks(null); onDone();
  }, editing ? 'Corrección guardada.' : 'Perfil guardado.');
  const fromFile = (e) => { const file = e.target.files?.[0]; return loadFile(file).finally(() => { e.target.value = ''; }); };
  const loadFile = (file) => run(async () => {
    const g = await readFileGrid(file);
    const found = g.sheets.flatMap((s) => parseFvGrid(s.rows).map((b) => ({ ...b, sheet: s.name })));
    if (!found.length) throw new Error('No he encontrado filas «CARGA» y «VMP» (una debajo de la otra) en el fichero.');
    setBlocks(found); setRows(rowsOf(found[0].points.slice(0, FV_MAX_POINTS)));
  })();
  return html`<form class="inline-form" onSubmit=${save} aria-label=${editing ? 'Corregir perfil carga-velocidad' : 'Nuevo perfil carga-velocidad'}>
    <h4>${editing ? 'Corregir este perfil' : 'Nuevo perfil (manual o desde tu Excel)'}</h4>
    <div class="filters">
      <label>Fecha <input type="date" value=${f.date} onInput=${(e) => setF({ ...f, date: e.target.value })} required /></label>
      <label>Ejercicio (opcional) <input value=${f.exercise} onInput=${(e) => setF({ ...f, exercise: e.target.value })} placeholder="p. ej. sentadilla" /></label>
      <label>Velocidad de la FDM (m/s) <input inputmode="decimal" value=${f.fdm} onInput=${(e) => setF({ ...f, fdm: e.target.value })} /></label>
      ${editing ? null : html`<label>Cargar desde Excel o CSV <input type="file" accept=".xlsx,.csv,.txt" onChange=${fromFile} /></label>`}
    </div>
    ${blocks && blocks.length > 1 ? html`<label>Bloque encontrado <select onChange=${(e) => setRows(rowsOf(blocks[Number(e.target.value)].points.slice(0, FV_MAX_POINTS)))}>${blocks.map((b, i) => html`<option key=${i} value=${i}>Hoja «${b.sheet}», fila ${b.row} (${b.points.length} cargas)</option>`)}</select></label>` : null}
    <div class="table-wrap"><table><caption>Cargas y velocidad media propulsiva (la carga en kg, la velocidad en m/s)</caption>
      <thead><tr><th>Carga</th><th>Carga (kg)</th><th>VMP (m/s)</th></tr></thead>
      <tbody>${rows.map((r, i) => html`<tr key=${i}><th scope="row">${i + 1}</th><td><input aria-label=${`Carga ${i + 1} (kg)`} inputmode="decimal" value=${r.load} onInput=${setRow(i, 'load')} /></td><td><input aria-label=${`Velocidad ${i + 1} (m/s)`} inputmode="decimal" value=${r.velocity} onInput=${setRow(i, 'velocity')} /></td></tr>`)}</tbody></table></div>
    <p class="muted">Se necesitan al menos 3 cargas distintas con su velocidad. Las filas vacías se ignoran.</p>
    <button type="button" class="secondary" disabled=${rows.length >= FV_MAX_POINTS} onClick=${() => setRows(rows.concat([{ load: '', velocity: '' }]))}>Añadir carga</button>
    <button type="submit" disabled=${busy}>${editing ? 'Guardar corrección' : 'Guardar perfil'}</button>
    ${editing ? html` <button type="button" class="secondary" onClick=${() => { setInitial(null); onDone(); }}>Cancelar</button>` : null}<${Msg} msg=${msg} /></form>`;
}

function ReferenceEditor({ reference, onDone }) {
  const { db } = useApp();
  const { msg, busy, run } = useRunner();
  const [rows, setRows] = useState(rowsOf(reference));
  const setRow = (i, k) => (e) => setRows(rows.map((r, j) => (j === i ? { ...r, [k]: e.target.value } : r)));
  const save = run(async () => {
    const pts = rows.map((r) => ({ load: r.load, velocity: r.velocity })).filter((r) => r.load !== '' || r.velocity !== '');
    const clean = referenceFrom(pts.map((r) => ({ load: Number(String(r.load).replace(',', '.')), velocity: Number(String(r.velocity).replace(',', '.')) })));
    if (clean === FV_REFERENCE_DEFAULT && pts.length) throw new Error('La referencia necesita al menos 2 puntos válidos (carga y velocidad > 0).');
    await setSetting(db, 'fvReference', clean); onDone();
  }, 'Referencia guardada.');
  return html`<details><summary>Línea de referencia «Balanced» (la de tu Excel por defecto)</summary>
    <div class="table-wrap"><table><caption>Puntos de la referencia</caption><thead><tr><th>Carga (kg)</th><th>VMP (m/s)</th></tr></thead>
      <tbody>${rows.map((r, i) => html`<tr key=${i}><td><input aria-label=${`Referencia carga ${i + 1}`} inputmode="decimal" value=${r.load} onInput=${setRow(i, 'load')} /></td><td><input aria-label=${`Referencia velocidad ${i + 1}`} inputmode="decimal" value=${r.velocity} onInput=${setRow(i, 'velocity')} /></td></tr>`)}</tbody></table></div>
    <p class="muted">Es una referencia fija, igual para todos los jugadores (como en tu Excel); no depende de la masa corporal.</p>
    <button type="button" class="secondary" disabled=${rows.length >= FV_MAX_POINTS} onClick=${() => setRows(rows.concat([{ load: '', velocity: '' }]))}>Añadir punto</button>
    <button type="button" disabled=${busy} onClick=${save}>Guardar referencia</button>
    <button type="button" class="secondary" onClick=${async () => { await clearSetting(db, 'fvReference'); onDone(); }}>Volver a la de tu Excel</button><${Msg} msg=${msg} /></details>`;
}

function Comparacion({ data, cur, player }) {
  const rows = compareWithSquad({ profiles: data.allProfiles, players: data.players, anthropometry: data.allAnthro, playerId: player.id, current: cur, minN: data.minN });
  const d = (v) => nf(v, Math.abs(v) >= 100 ? 0 : Math.abs(v) >= 10 ? 1 : 2);
  return html`<div class="table-wrap"><table><caption>Frente a La Liga (tu base): un valor por jugador, su perfil válido más reciente del mismo ejercicio${cur.exercise ? ` («${cur.exercise}»)` : ' (sin ejercicio indicado)'}</caption>
    <thead><tr><th>Métrica</th><th class="num">Jugador</th><th class="num">P50 La Liga (N)</th><th>Percentil</th></tr></thead>
    <tbody>${rows.map((r) => html`<tr key=${r.key}><th scope="row">${r.label}${r.unit ? html` <small class="cell-date">${r.unit}</small>` : null}</th>
      <td class="num">${r.value === null ? '—' : d(r.value)}</td><td class="num">${r.ev && r.ev.p50 !== null ? `${d(r.ev.p50)} (${r.ev.n})` : r.ev ? `— (${r.ev.n})` : '—'}</td>
      <td>${!r.ev ? html`<span class="muted">Sin dato</span>` : r.ev.band !== null ? html`<span class=${'band band-' + BANDS[r.ev.band].key} title=${`${BANDS[r.ev.band].name} (P${BANDS[r.ev.band].range})${r.ev.positional ? ' · color según la posición en La Liga (sin dirección «mejor/peor»)' : ''}`}>${nf(r.ev.percentilePerf, 0)}</span>` : r.ev.percentileStat !== null ? html`<span title=${r.direction === null ? 'La pendiente no tiene «mejor» o «peor»: solo percentil estadístico, sin color' : ''}>P${nf(r.ev.percentileStat, 0)} estadístico (sin color)</span>` : html`<span class="muted">${r.ev.reason}</span>`}</td></tr>`)}</tbody></table></div>
    <details class="notas"><summary>Cómo se calcula el percentil</summary><p class="muted">Percentil por rango medio, sin el propio jugador, mínimo de muestra el de tus ajustes de percentiles. Vo, Fo ÷ masa y potencia óptima llevan color («más alto es mejor»); en la pendiente el color indica solo la posición en La Liga, porque no hay mejor ni peor.</p></details>`;
}

export function FvPanel({ player, test = null }) {
  const { db, version, bump } = useApp();
  const [tick, setTick] = useState(0);
  const [sel, setSel] = useState(null);
  const [editId, setEditId] = useState(null);
  const [confirmDel, setConfirmDel] = useState(null);
  const [msg, setMsg] = useState(null);
  const canvasRef = useRef(null);
  // Un perfil guardado, corregido, borrado o asignado también cambia la lista de tests del jugador (deja de estar «sin datos aún»): se refresca toda la ficha, no solo este panel.
  const reload = () => { setTick((t) => t + 1); bump(); };
  const { data } = useLoad(async () => {
    const [profiles, anthro, ref, allProfiles, allPlayers, allAnthro, minN] = await Promise.all([db.fvProfiles.where('playerId').equals(player.id).toArray(), db.anthropometry.where('playerId').equals(player.id).toArray(), getSetting(db, 'fvReference'), db.fvProfiles.toArray(), db.players.toArray(), db.anthropometry.toArray(), getSetting(db, 'percentileMinN')]);
    return { profiles: profiles.sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id), anthro: withReferenceWeights(anthro, [await db.players.get(player.id)]), reference: referenceFrom(ref),
      allProfiles, players: Object.fromEntries(allPlayers.map((p) => [p.id, p])), allAnthro: withReferenceWeights(allAnthro, allPlayers), minN: Number.isInteger(minN) && minN >= 1 ? minN : undefined };
  }, [db, version, player.id, tick]);
  if (!data) return null;
  const { anthro, reference } = data;
  // Solo los perfiles de ESTE test de perfil F–V. Los guardados sin test asignado (antes de 9n) NO se muestran como si fueran suyos —antes aparecían en
  // todos los tests de perfil carga-velocidad y parecía que los datos se habían copiado (aviso del 11/11/2026)—: se ofrecen aparte para asignarlos.
  const profiles = test ? data.profiles.filter((p) => (p.testId ?? null) === test.id) : data.profiles;
  const sinTest = test ? data.profiles.filter((p) => (p.testId ?? null) === null) : [];
  const cur = profiles.find((p) => p.id === sel) ?? profiles[0] ?? null;
  const editing = editId === null ? null : profiles.find((p) => p.id === editId) ?? null;
  const mass = cur ? massNearest(anthro, cur.date) : null;
  const fit = cur ? fitLoadVelocity(cur.points, { fdmVelocity: cur.fdmVelocity, mass: mass?.kg ?? null }) : null;
  const done = () => { setEditId(null); reload(); };
  return html`<${Card} titulo="Perfil carga-velocidad (VBT)" id="fv">
    ${sinTest.length ? html`<p class="status warn" role="status">${sinTest.length === 1 ? 'Hay un perfil guardado sin test asignado' : `Hay ${sinTest.length} perfiles guardados sin test asignado`} (se guardaron antes de poder elegir test). No se muestra en ningún test hasta que digas a cuál pertenece.${sinTest.map((p) => html` <button type="button" class="secondary" key=${p.id} onClick=${async () => { try { await asignarFvProfile(db, p.id, test.id); setSel(p.id); reload(); } catch (e) { setMsg({ level: 'fail', text: e.message }); } }}>Asignar el del ${fmtDay(p.date)}${p.exercise ? ` (${p.exercise})` : ''} a «${dn(test.name)}»</button>`)}</p>` : null}
    ${cur ? html`
      ${profiles.length > 1 ? html`<label>Perfil <select value=${cur.id} onChange=${(e) => { setSel(Number(e.target.value)); setConfirmDel(null); }}>${profiles.map((p) => html`<option key=${p.id} value=${p.id}>${fmtDay(p.date)}${p.exercise ? ` · ${p.exercise}` : ''}</option>`)}</select></label>` : null}
      ${fit.points?.length ? html`<${FvChart} canvasRef=${canvasRef} config=${fvChartConfig({ fit, reference, name: `${playerLabel(player)}${cur.exercise ? ' · ' + cur.exercise : ''}` })} label=${`Relación carga-velocidad de ${playerLabel(player)} el ${fmtDay(cur.date)}: ${fit.points.map((p) => `${p.load} kg ${nf(p.velocity)} m/s`).join(', ')}`} />
        <div class="actions"><button type="button" class="secondary" onClick=${() => canvasRef.current?.toBlob((b) => (b ? downloadBlob(b, `perfil-carga-velocidad-${playerLabel(player)}-${cur.date}.png`.replace(/[^\w.-]+/g, '_')) : setMsg({ level: 'fail', text: 'No se pudo crear la imagen.' })))}>Descargar imagen (PNG)</button></div>` : null}
      <p class=${'fv-conclusion' + (fit.ok ? '' : ' sint')} role="status" title="Umbrales de tu Excel; la pendiente depende también del nivel de fuerza, así que no es una clasificación validada"><span class="fv-conclusion-rot">Conclusión del perfil</span><strong>${classText(fit.class)}</strong> <span class="muted">(clasificación de tu Excel, no validada)</span></p>
      ${fit.ok ? null : html`<p class="status fail" role="status">${fit.reason}</p>`}
      ${Number.isFinite(fit.fo) ? html`<dl class="stats">
        <div><dt>Fo (kg)</dt><dd>${nf(fit.fo, 1)}</dd></div><div><dt>Vo (m/s)</dt><dd>${nf(fit.vo, 3)}</dd></div>
        <div><dt>Pendiente (−a × 1000)</dt><dd>${nf(fit.slope, 2)}</dd></div>
        <div><dt>FDM (${nf(fit.fdmVelocity, 2)} m/s) (kg)</dt><dd>${nf(fit.fdm, 1)}</dd></div>
        <div><dt>Fuerza relativa (Fo ÷ masa)</dt><dd>${fit.relativeForce === null ? '—' : nf(fit.relativeForce, 2)} <span class="muted">${mass ? (mass.reference ? `(peso de referencia ${nf(mass.kg, 1)} kg)` : `(${nf(mass.kg, 1)} kg medidos el ${fmtDay(mass.date)}${mass.daysAway ? `, a ${mass.daysAway} días` : ''})`) : '(sin masa del jugador: añade una medición o su peso de referencia)'}</span></dd></div>
        <div><dt>Potencia óptima (Fo × Vo ÷ 4)</dt><dd>${nf(fit.pmax, 1)}</dd></div>
        <div><dt>Extrapolación de Fo</dt><dd>${nf(((fit.fo - fit.points[fit.points.length - 1].load) / fit.points[fit.points.length - 1].load) * 100, 0)} % <span class="muted">sobre la mayor carga probada (${nf(fit.points[fit.points.length - 1].load, 0)} kg)</span></dd></div>
        <div><dt>R² · cargas</dt><dd>${nf(fit.r2, 3)} · ${fit.n}</dd></div></dl>` : null}
      ${fit.ok ? html`<${Comparacion} data=${data} cur=${cur} player=${player} />` : null}
      <div class="table-wrap"><table><caption>Cargas del perfil del ${fmtDay(cur.date)}${cur.exercise ? ` (${cur.exercise})` : ''}</caption><thead><tr><th>Carga (kg)</th><th class="num">VMP (m/s)</th><th class="num">Potencia externa (W)</th></tr></thead>
        <tbody>${fit.points.map((p) => html`<tr key=${p.load}><th scope="row">${nf(p.load, 1)}</th><td class="num">${nf(p.velocity, 3)}</td><td class="num">${nf(p.load * 9.81 * p.velocity, 1)}</td></tr>`)}</tbody></table></div>
      <p class="actions"><button type="button" class="secondary" onClick=${() => { setEditId(cur.id); setConfirmDel(null); }}>Corregir este perfil…</button>
        ${confirmDel === cur.id ? html` <button type="button" class="danger" onClick=${async () => { try { await deleteFvProfile(db, cur.id); setSel(null); setConfirmDel(null); reload(); } catch (e) { setMsg({ level: 'fail', text: e.message }); } }}>Confirmar: eliminar este perfil</button> <button type="button" class="secondary" onClick=${() => setConfirmDel(null)}>Cancelar</button>` : html` <button type="button" class="secondary" onClick=${() => setConfirmDel(cur.id)}>Eliminar…</button>`}</p><${Msg} msg=${msg} />
      ${profiles.length > 1 ? html`<div class="table-wrap"><table><caption>Historial de perfiles</caption><thead><tr><th>Fecha</th><th>Ejercicio</th><th class="num">Fo (kg)</th><th class="num">Pendiente</th><th>Perfil</th></tr></thead>
        <tbody>${profiles.map((p) => { const x = fitLoadVelocity(p.points, { fdmVelocity: p.fdmVelocity }); return html`<tr key=${p.id}><th scope="row">${fmtDay(p.date)}</th><td>${p.exercise || '—'}</td><td class="num">${nf(x.fo, 1)}</td><td class="num">${nf(x.slope, 2)}</td><td>${classText(x.class)}</td></tr>`; })}</tbody></table></div>` : null}`
      : html`<p class="muted">Este jugador aún no tiene perfiles carga-velocidad en este test. Introduce uno a mano o cárgalo desde tu Excel (filas «CARGA» y «VMP»).</p>`}
    ${editId !== null && editing ? html`<${FvForm} key=${'e' + editId} player=${player} test=${test} editing=${editId} initial=${editing} setInitial=${() => {}} onDone=${done} />` : html`<${FvForm} key=${'n' + profiles.length} player=${player} test=${test} editing=${null} initial=${null} setInitial=${() => {}} onDone=${() => { setSel(null); reload(); }} />`}
    <${ReferenceEditor} key=${'r' + tick} reference=${reference} onDone=${reload} />
    <details class="notas"><summary>Método</summary><p class="muted"><strong>Método:</strong> recta de mínimos cuadrados velocidad = a × carga + b con ≥ 3 cargas distintas; Fo = −b/a (kg), Vo = b (m/s), pendiente = −a × 1000, FDM = carga con la que la velocidad llega a la velocidad de la FDM, potencia óptima = Fo × Vo ÷ 4. Los umbrales del perfil (pendiente ≥ 13,1 Moderate VELOCITY; ≥ 11,1 Slight VELOCITY; ≥ 9 BALANCED; ≥ 7 Slight FORCE; ≥ 1 Moderate FORCE) y la línea Balanced son los de tu Excel; no están contrastados con una fuente publicada. La pendiente es V0 ÷ L0, así que depende del nivel de fuerza además de la orientación: un jugador más fuerte tiene una pendiente menor sin ser «más de fuerza». Fo y Vo son extrapolaciones; cuanto más lejos de las cargas probadas, menos fiables. Tu Excel calcula «Vo» como a + b (velocidad con 1 kg); aquí es el intercepto, y la diferencia con Ansu es de un 0,7 %.</p></details>
  <//>`;
}
