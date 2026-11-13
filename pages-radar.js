// pages-radar.js — fase 5d (D16): perfil radial G3 en la ficha del jugador, con el aspecto del radar aportado por el usuario
// (fondo negro, línea lila = jugador, amarilla = P50 de La Liga, blanca punteada = P50 de la Premier League). Descarga en PNG.
import { html, useState, useRef } from './libs.js';
import { mismoTest } from './nombres.js';
import { useApp } from './context.js';
import { Card, useLoad, Msg, Desplegable, agruparFiltros } from './componentes.js';
import { fmtDay } from './fechas.js';
import { getSetting, setSetting, clearSetting } from './db.js';
import { listCatalog } from './catalogo.js';
import { listPositions, positionOnDate } from './posiciones.js';
import { MIN_N_DEFAULT } from './percentiles.js';
import { buildRadar, profileFromSetting, profileForTest, RADAR_MIN_AXES, RADAR_MAX_AXES, RADAR_REFS, radarRefsFromSetting } from './radar.js';
import { downloadBlob } from './io.js';
import { playerLabel, baseName } from './jugadores.js';
import { Copiable } from './copiar.js';

const nf = (n, d = 2) => (n === null || n === undefined ? '—' : Number(n).toLocaleString('es-ES', { maximumFractionDigits: d }));
const fx = (v) => Number(v).toLocaleString('es-ES', { minimumFractionDigits: digits(v), maximumFractionDigits: digits(v) });
const digits = (v) => (Math.abs(v) >= 100 ? 0 : Math.abs(v) >= 10 ? 1 : 2);
import { FUENTE_GRAFICOS } from './fuentes.js';
import { dn } from './nombres.js';
const FONT = FUENTE_GRAFICOS;
const LILA = '#ffffff'; /* valores del jugador: blanco (9/11/2026) */ const MORADO = '#b8a2c9'; const AMARILLO = '#fec900'; const BLANCO = '#ffffff';
const W = 1000; const H = 484; const CX = 500; const CY = 260; const RREF = 130; // radio exterior: el polígono de La Liga (100 %) cuando nada se sale

function wrap(label) {
  if (label.length <= 14 || !label.includes(' ')) return [label];
  const words = label.split(' '); let best = 1; let diff = Infinity;
  for (let i = 1; i < words.length; i++) { const d = Math.abs(words.slice(0, i).join(' ').length - words.slice(i).join(' ').length); if (d < diff) { diff = d; best = i; } }
  return [words.slice(0, best).join(' '), words.slice(best).join(' ')];
}

// Aspecto de cada referencia: color de la paleta (La Liga amarillo, Premier lila, jugador blanco, grises para primera/última) y trazo distinto.
const GRIS = '#b3b3b3';
const REF_STYLE = {
  p50: { color: AMARILLO, w: 3.5 }, p75: { color: AMARILLO, w: 3, dash: '12 7' }, p50pos: { color: AMARILLO, w: 4, dash: '0.1 9', cap: 'round' }, p75pos: { color: AMARILLO, w: 3, dash: '14 6 2 6' },
  premier50: { color: MORADO, w: 4, dash: '0.1 9', cap: 'round' }, premier75: { color: MORADO, w: 3, dash: '12 7' },
  pa: { color: LILA, w: 3.5 }, pb: { color: LILA, w: 3, dash: '12 7' }, first: { color: GRIS, w: 3, dash: '14 6 2 6' }, last: { color: GRIS, w: 3 },
};
// «Primera» y «última medida» se rotulan con su fecha (si las variables del radar tienen fechas distintas, el intervalo).
const refLabel = (k, posName, dates = null) => {
  const l = RADAR_REFS.find((r) => r.key === k)?.label ?? k;
  const d = (k === 'first' || k === 'last') ? dates?.[k] : null;
  if (d) return d[0] === d[1] ? fmtDay(d[0]) : `${fmtDay(d[0])} – ${fmtDay(d[1])}`;
  return k.endsWith('pos') && posName ? `${l} (${posName})` : l;
};

export function RadarSvg({ profile, radar, playerName, shown = ['p50', 'premier50', 'pa'], posName = '', svgRef, zoom = false }) {
  const n = radar.axes.length;
  const draw = shown.filter((k) => radar.complete?.[k]);
  const mainKey = ['pa', 'last', 'pb', 'first'].find((k) => draw.includes(k)) ?? null; // medida del jugador que se rotula en los ejes
  const val = (a) => (mainKey ? a.refs[mainKey] : null);
  const ang = (i) => ((-90 + (i * 360) / n) * Math.PI) / 180;
  // Una referencia que se salga de la mitad o el doble del P50 casi siempre viene en otra unidad (tablas de la Premier): no se dibuja, porque
  // aplastaría el resto del gráfico contra el centro o lo desbordaría, y se nombra en el pie.
  const fuera = draw.filter((k) => radar.axes.some((a) => Number.isFinite(a.ratios[k]) && (a.ratios[k] < 0.5 || a.ratios[k] > 2)));
  const dentro = draw.filter((k) => !fuera.includes(k));
  const vals = dentro.flatMap((k) => radar.axes.map((a) => a.ratios[k])).filter((x) => Number.isFinite(x));
  // Escala radial. POR DEFECTO el radio es proporcional al cociente con el P50 y empieza en cero (como siempre): el polígono de La Liga queda
  // en RREF y, si algún eje pasa del 112 %, se reduce todo para que quepa sin pisar los rótulos. Con «escala ampliada» (opción del usuario,
  // 13/11/2026) el radio se ajusta al rango de lo dibujado y NO empieza en cero, para poder distinguir diferencias pequeñas cuando todas las
  // líneas se superponen (Hop Test, Drop Jump); el pie del gráfico avisa de ello y dice entre qué dos porcentajes va el radio.
  const maxRatio = Math.max(1, ...vals);
  const unit = maxRatio > 1.12 ? (RREF * 1.12) / maxRatio : RREF;
  const lo0 = Math.min(1, ...vals), hi0 = Math.max(1, ...vals), medio = (lo0 + hi0) / 2;
  const amp = Math.max(hi0 - lo0, 0.1);
  const lo = Math.min(lo0, medio - amp / 2) - amp * 0.12, hi = Math.max(hi0, medio + amp / 2) + amp * 0.12;
  const R0 = RREF * 0.42;
  const rOf = (ratio) => (!Number.isFinite(ratio) ? (zoom ? R0 : 0) : zoom ? R0 + ((Math.max(lo, Math.min(hi, ratio)) - lo) / (hi - lo)) * (RREF - R0) : unit * ratio);
  const pt = (i, ratio) => [CX + Math.cos(ang(i)) * rOf(ratio), CY + Math.sin(ang(i)) * rOf(ratio)];
  const poly = (ratios) => ratios.map((r, i) => pt(i, r).map((x) => x.toFixed(1)).join(',')).join(' ');
  // Dos series con los mismos valores en todos los ejes se dibujan una sola vez (p. ej. «primera» y «última medida» cuando solo hay una sesión):
  // superpuestas no se distinguen y parecían datos distintos que coinciden por casualidad (13/11/2026).
  const iguales = (k1, k2) => radar.axes.every((a) => Number.isFinite(a.ratios[k1]) && Number.isFinite(a.ratios[k2]) && Math.abs(a.ratios[k1] - a.ratios[k2]) < 1e-9);
  const pintadas = []; const juntas = {};
  for (const k of dentro) { const igual = pintadas.find((q) => iguales(q, k)); if (igual) (juntas[igual] ??= []).push(k); else pintadas.push(k); }
  const rotulo = (k) => [k, ...(juntas[k] ?? [])].map((q) => refLabel(q, posName, radar.dates)).filter((t, i, arr) => arr.indexOf(t) === i).join(' · ');
  // Geometría de los rótulos de los ejes: se calcula ANTES de dibujar para saber hasta dónde llegan por abajo y colocar debajo la leyenda.
  // Con el rótulo del eje inferior pisando la leyenda (13/11/2026) se vio que una altura fija no vale: depende del radio y de las unidades.
  const geo = radar.axes.map((a, i) => {
    const c = Math.cos(ang(i)); const s = Math.sin(ang(i));
    const top = s < -0.9; const bottom = s > 0.9;
    const lines = wrap(a.invertido ? `${a.label} ↓` : a.label); const wid = Math.max(...lines.map((l) => l.length)) * 13;
    // el rótulo se separa del vértice de La Liga y de la línea más alejada del jugador/referencias en ese eje (que no toque el polígono)
    const ext = Math.max(rOf(1), ...dentro.map((k) => rOf(a.ratios[k] ?? 1)));
    const RR = Math.max(RREF, ext) + 16;
    const vtxX = CX + c * RR; const vtxY = CY + s * RR;
    const v = val(a); const vtxt = v == null ? '' : `${fx(v)} ${a.unit}`;
    if (top || bottom) {
      const y0 = top ? vtxY - 20 - (lines.length - 1) * 22 : vtxY + 32;
      const yVal = top ? y0 - 28 : y0 + (lines.length - 1) * 22 + 28;
      return { eje: true, top, lines, vtxX, y0, yVal, vtxt, yMax: Math.max(y0 + (lines.length - 1) * 22, yVal) };
    }
    const right = c > 0; const lx = vtxX + (right ? 10 : -10); const y0 = vtxY + (s < 0 ? -2 : 6) - (lines.length - 1) * 11;
    return { eje: false, right, lines, lx, y0, vtxY, vtxt, xVal: lx + (right ? wid + 26 : -wid - 26), yMax: Math.max(y0 + (lines.length - 1) * 22, vtxY + 5) };
  });
  const BASE_NOMBRE = { pa: 'Personal Average', pb: 'Personal Best', last: 'latest measurement', first: 'first measurement' };
  // Los números de los ejes son de UNA serie (la primera activada en este orden: PA, última, PB, primera): el gráfico lo dice (13/11/2026).
  const basisText = mainKey ? (mainKey === 'last' || mainKey === 'first' ? `${BASE_NOMBRE[mainKey]} (${refLabel(mainKey, '', radar.dates)})` : BASE_NOMBRE[mainKey]) : '';
  const pie = [zoom ? `Radius zoomed to the data: ${Math.round(lo * 100)}% to ${Math.round(hi * 100)}% of the La Liga P50 (does not start at zero)` : '',
    fuera.length ? `off scale, not drawn: ${fuera.map((k) => refLabel(k, posName, radar.dates)).join(', ')}` : ''].filter(Boolean).join(' · ');
  const yEtiq = Math.max(...geo.map((g) => g.yMax));
  const yInfo = Math.max(H - 22, yEtiq + 18);                       // línea «Axis values: …»
  const rows = Math.ceil(pintadas.length / 2); const yLeg = yInfo + 28; // primera fila de la leyenda
  const HH = Math.round((rows ? yLeg + (rows - 1) * 26 + 10 : yInfo + 8) + (pie ? 26 : 8));
  return html`<svg ref=${svgRef} xmlns="http://www.w3.org/2000/svg" viewBox=${`0 0 ${W} ${HH}`} width="100%" role="img" class="radar-svg"
      aria-label=${`${profile.title} radar for ${playerName}: ${radar.axes.map((a) => `${a.label}${val(a) != null ? ` ${fx(val(a))} ${a.unit}` : ''}`).join('; ')}. References drawn: ${pintadas.map((k) => refLabel(k, posName, radar.dates)).join(', ')}`}>
    <rect width=${W} height=${HH} fill="#000" />
    ${pintadas.map((k) => { const st = REF_STYLE[k]; return html`<polygon key=${k} points=${poly(radar.axes.map((a) => a.ratios[k]))} fill="none" stroke=${st.color} stroke-width=${st.w} stroke-dasharray=${st.dash ?? null} stroke-linecap=${st.cap ?? 'butt'} stroke-linejoin="round" />`; })}
    ${(() => {
      // El título va en el centro, con el tamaño que quepa dentro del polígono más interior (apotema del polígono regular). Si ni a 12 px cabe,
      // se sube a la cabecera del gráfico en vez de pisar las líneas (13/11/2026).
      const interior = Math.min(...pintadas.map((k) => Math.min(...radar.axes.map((a) => rOf(a.ratios[k])))));
      const apotema = interior * Math.cos(Math.PI / n) - 6;
      const lineas = profile.center.length > 11 ? wrap(profile.center) : [profile.center];
      const anchoEm = Math.max(...lineas.map((l) => l.length)) * 0.58;
      const fs = Math.min(34, Math.floor(Math.min((apotema * 2) / anchoEm, (apotema * 2) / (lineas.length * 1.25))));
      const dentroOk = fs >= 12;
      const tam = dentroOk ? fs : 20; const y0 = dentroOk ? CY - ((lineas.length - 1) * tam * 1.15) / 2 + tam * 0.35 : 34;
      return html`<g font-family=${FONT} font-weight="700" fill=${BLANCO} text-anchor="middle">${lineas.map((l, k) => html`<text key=${k} x=${CX} y=${y0 + k * tam * 1.15} font-size=${tam}>${l}</text>`)}</g>`;
    })()}
    ${pie ? html`<text x=${CX} y=${HH - 8} text-anchor="middle" font-family=${FONT} font-size="17" fill=${MORADO}>${pie}</text>` : null}
    ${geo.map((g, i) => (g.eje
      ? html`<g key=${i}>${g.lines.map((l, k) => html`<text key=${k} x=${g.vtxX} y=${g.y0 + k * 22} text-anchor="middle" font-family=${FONT} font-size="21" font-weight="700" fill=${BLANCO}>${l}</text>`)}
          <text x=${g.vtxX} y=${g.yVal} text-anchor="middle" font-family=${FONT} font-size="20" fill=${LILA}>${g.vtxt}</text></g>`
      : html`<g key=${i}>${g.lines.map((l, k) => html`<text key=${k} x=${g.lx} y=${g.y0 + k * 22} text-anchor=${g.right ? 'start' : 'end'} font-family=${FONT} font-size="21" font-weight="700" fill=${BLANCO}>${l}</text>`)}
        <text x=${g.xVal} y=${g.vtxY + 5} text-anchor=${g.right ? 'start' : 'end'} font-family=${FONT} font-size="20" fill=${LILA}>${g.vtxt}</text></g>`))}
    ${basisText ? html`<text x=${CX} y=${yInfo} text-anchor="middle" font-family=${FONT} font-size="18" fill=${LILA}>${`Axis values: ${basisText}`}</text>` : null}
    <g font-family=${FONT} font-size="19">${(() => {
      const itemW = (k) => 72 + rotulo(k).length * 9; const GAP = 60;
      const rowsK = []; for (let q = 0; q < pintadas.length; q += 2) rowsK.push(pintadas.slice(q, q + 2));
      return rowsK.map((row, r) => { const total = row.reduce((a, k) => a + itemW(k), 0) + GAP * (row.length - 1); let x = (W - total) / 2; const y = yLeg + r * 26;
        return row.map((k) => { const st = REF_STYLE[k]; const x0 = x; x += itemW(k) + GAP;
          return html`<g key=${k}><line x1=${x0} x2=${x0 + 60} y1=${y} y2=${y} stroke=${st.color} stroke-width=${st.w} stroke-dasharray=${st.dash ?? null} stroke-linecap=${st.cap ?? 'butt'} /><text x=${x0 + 72} y=${y + 6} fill=${st.color}>${rotulo(k)}</text></g>`; }); });
    })()}</g>
  </svg>`;
}

function toPng(svgEl, name) {
  const vb = svgEl.getAttribute('viewBox').split(/\s+/).map(Number); const HH = vb[3];
  const xml = new XMLSerializer().serializeToString(svgEl).replace('width="100%"', `width="${W * 2}" height="${HH * 2}"`);
  const img = new Image();
  return new Promise((ok, no) => {
    img.onload = () => { const c = document.createElement('canvas'); c.width = W * 2; c.height = HH * 2; c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); c.toBlob((b) => (b ? (downloadBlob(b, name), ok()) : no(new Error('No se pudo crear la imagen.'))), 'image/png'); };
    img.onerror = () => no(new Error('No se pudo crear la imagen.'));
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(xml);
  });
}

// Variables elegibles: de un solo valor, «más alto es mejor» y no archivadas (el cociente con La Liga no sirve en las demás).
const eligible = (variables, testId) => variables.filter((v) => v.testId === testId && !v.archived && v.sides !== 'LR' && v.direction === 'higher');

function RadarEditor({ cfg, tests, variables, onSaved, onCancel }) {
  const { db } = useApp();
  const [testName, setTestName] = useState(cfg.test);
  const [sel, setSel] = useState(cfg.variables);
  const [msg, setMsg] = useState(null);
  const test = tests.find((t) => mismoTest(t.name, testName));
  const opts = test ? eligible(variables, test.id) : [];
  const toggle = (name) => setSel(sel.includes(name) ? sel.filter((n) => n !== name) : sel.length >= RADAR_MAX_AXES ? sel : [...sel, name]);
  const save = async () => {
    try {
      if (sel.length < RADAR_MIN_AXES) throw new Error(`Choose at least ${RADAR_MIN_AXES} variables.`);
      await setSetting(db, 'radarConfig', { test: testName, variables: sel });
      onSaved();
    } catch (e) { setMsg({ level: 'fail', text: e.message }); }
  };
  const reset = async () => { await clearSetting(db, 'radarConfig'); onSaved(); };
  return html`<div class="inline-form" role="group" aria-label="Radar variables">
    <label>Test <select value=${testName} onChange=${(e) => { setTestName(e.target.value); setSel([]); }}>${tests.map((t) => html`<option key=${t.id} value=${t.name}>${dn(t.name)}</option>`)}</select></label>
    <fieldset><legend>Variables (${RADAR_MIN_AXES} to ${RADAR_MAX_AXES}; the axes follow the order you tick them: ${sel.length} chosen)</legend>
      ${opts.length ? opts.map((v) => html`<label key=${v.id} class="check"><input type="checkbox" checked=${sel.includes(v.name)} onChange=${() => toggle(v.name)} /> ${dn(v.name)}${v.unit ? ` (${v.unit})` : ''}</label>`) : html`<p class="muted">This test has no single-value variables where «higher is better».</p>`}
    </fieldset>
    <p class="muted">Current axis order: ${sel.length ? sel.join(' → ') : '—'}. Saved in this browser and used for every player.</p>
    <button type="button" onClick=${save}>Save variables</button> <button type="button" class="secondary" onClick=${reset}>Back to the default profile (CMJ)</button> <button type="button" class="secondary" onClick=${onCancel}>Cancel</button><${Msg} msg=${msg} /></div>`;
}

export function RadarPanel({ player, testName }) {
  const { db, version } = useApp();
  const [rpSel, setRp] = useState(null);
  const [shownLocal, setShownLocal] = useState(null);
  const [zoomLocal, setZoomLocal] = useState(null);
  const [msg, setMsg] = useState(null);
  const [editing, setEditing] = useState(false);
  const [tick, setTick] = useState(0);
  const svgRef = useRef(null);
  const { data } = useLoad(async () => {
    const cat = await listCatalog(db);
    // En la ficha de un test se usa el perfil de ESE test (el guardado por el usuario si es suyo, y si no el de fábrica: CMJ, Hop Test y Drop Jump 30/45).
    const cfg = await getSetting(db, 'radarConfig');
    const profile = testName ? profileForTest(testName, cfg) : profileFromSetting(cfg);
    if (!profile) return { sinPerfil: true };
    const test = cat.tests.find((t) => mismoTest(t.name, profile.test) && !t.archived);
    const pickable = cat.tests.filter((t) => !t.archived && eligible(cat.variables, t.id).length >= RADAR_MIN_AXES);
    const refsSaved = radarRefsFromSetting(await getSetting(db, 'radarRefs'));
    const zoomSaved = (await getSetting(db, 'radarZoom')) === true; // escala ampliada: apagada por defecto (13/11/2026)
    if (!test) return { test: null, profile, pickable, variables: cat.variables, refsSaved, zoomSaved };
    const [sessions, players, records, positions, minN] = await Promise.all([db.sessions.where('testId').equals(test.id).toArray(), db.players.toArray(), db.playerPositions.toArray(), listPositions(db), getSetting(db, 'percentileMinN')]);
    return { test, profile, pickable, refsSaved, zoomSaved, variables: cat.variables, sessions, players, records, positions, minN: Number.isInteger(minN) && minN >= 1 ? minN : MIN_N_DEFAULT };
  }, [db, version, player.id, testName, tick]);
  if (!data || data.sinPerfil) return null;
  const profile = data.profile;
  if (testName && data.test && data.test.name !== testName) return null; // el radar solo aparece al mirar su test
  if (testName && !data.test) return null;
  if (!data.test) return html`<${Card} titulo="Radar profile" id="radar"><p class="muted">The test chosen for the radar («${profile.test}») no longer exists or is archived.</p>
    <button type="button" class="secondary" onClick=${async () => { await clearSetting(db, 'radarConfig'); setTick((t) => t + 1); }}>Back to the default profile</button><//>`;
  const playersById = Object.fromEntries(data.players.map((p) => [p.id, p]));
  const histories = {}; for (const r of data.records) (histories[r.playerId] ??= []).push(r);
  // por defecto, la posición principal actual del jugador (así las referencias «por posición» están disponibles sin tener que elegirla)
  const mainPos = positionOnDate(data.records.filter((r) => r.playerId === player.id)).principal?.positionId ?? null;
  const rp = rpSel ?? (mainPos != null ? String(mainPos) : 'all');
  const positionId = rp === 'all' ? null : Number(rp);
  const radar = buildRadar({ profile, test: data.test, variables: data.variables, sessions: data.sessions, players: playersById, histories, playerId: player.id, basis: 'pa', positionId, minN: data.minN, multi: true });
  const shown = shownLocal ?? data.refsSaved;
  const zoom = zoomLocal ?? data.zoomSaved;
  const toggleZoom = (v) => { setZoomLocal(v); setSetting(db, 'radarZoom', v); };
  const toggleRef = (k) => { const next = shown.includes(k) ? shown.filter((x) => x !== k) : [...shown, k]; setShownLocal(next); setSetting(db, 'radarRefs', next); };
  const unavailable = (r) => (r.needsPosition && positionId === null ? 'Choose a position to enable it.' : !radar.complete[r.key] ? (r.group === 'premier' ? 'The Premier League does not publish this reference for every variable in the radar.' : r.needsPosition ? 'Not enough players in that position.' : r.group === 'jugador' ? 'The player has no value for one of the variables.' : 'Not enough players in La Liga.') : null);
  const draw = shown.filter((k) => radar.complete[k]);
  const posName = positionId === null ? 'all positions' : data.positions.find((p) => p.id === positionId)?.name ?? '—';
  return html`<${Card} titulo=${`Radar profile: ${profile.title} (${profile.center})`} id="radar">
    <p><button type="button" class="secondary" aria-expanded=${editing} onClick=${() => setEditing(!editing)}>${editing ? 'Close' : 'Choose radar variables'}</button></p>
    ${editing ? html`<${RadarEditor} cfg=${{ test: profile.test, variables: profile.axes.map((a) => a.variable) }} tests=${data.pickable} variables=${data.variables} onSaved=${() => { setEditing(false); setTick((t) => t + 1); }} onCancel=${() => setEditing(false)} />` : null}
    <div class="filters">
      <label>Position for the by-position references <select value=${rp} onChange=${(e) => setRp(e.target.value)}><option value="all">None (no by-position references)</option>${data.positions.map((p) => html`<option key=${p.id} value=${p.id}>${p.name}</option>`)}</select></label>
      <label class="check" title="El radio deja de empezar en cero y se ajusta al rango de lo dibujado. Útil cuando todas las líneas se superponen (Hop Test, Drop Jump).">
        <input type="checkbox" checked=${zoom} onChange=${(e) => toggleZoom(e.target.checked)} /> Zoom the radius to the data range</label>
    </div>
    <fieldset class="modes filas"><legend>Radar references</legend>${agruparFiltros(RADAR_REFS).map((fila, i) => html`<div class="ref-fila" key=${'f' + i}>${fila.map((r) => { const why = radar.axes.length ? unavailable(r) : null; return html`<label class="check" key=${r.key} title=${why ?? ''}><input type="checkbox" checked=${shown.includes(r.key)} disabled=${!!why} onChange=${() => toggleRef(r.key)} /> ${refLabel(r.key, '', radar.dates)}${why ? html` <span class="muted">(not available)</span>` : null}</label>`; })}</div>`)}</fieldset>
    ${radar.drawable ? html`<${Copiable} nombre=${`radar-${profile.center}-${baseName(player)}`}><${RadarSvg} profile=${profile} radar=${radar} playerName=${playerLabel(player)} shown=${shown} posName=${posName} svgRef=${svgRef} zoom=${zoom} /><//>
      <div class="actions"><button type="button" class="secondary" onClick=${() => toPng(svgRef.current, `radar-${profile.center}-${baseName(player)}.png`.replace(/[^\w.-]+/g, '_')).catch((e) => setMsg({ type: 'error', text: e.message }))}>Download image (PNG)</button></div>
      <${Msg} msg=${msg} />`
      : html`<p class="muted">Not enough data to draw the radar: at least 3 variables with a value for this player and a sufficient La Liga P50 are needed.</p>`}
    ${radar.axes.length && draw.length ? html`<${Desplegable} titulo="Original values and normalisation"><div class="table-wrap"><table><caption>Each reference ÷ the La Liga P50, all positions</caption>
      <thead><tr><th>Variable</th><th class="num">La Liga P50 (N)</th>${draw.filter((k) => k !== 'p50').map((k) => html`<th key=${k} class="num">${refLabel(k, posName, radar.dates)}</th>`)}</tr></thead>
      <tbody>${radar.axes.map((a) => html`<tr key=${a.variable.id}><th scope="row">${a.label}${a.invertido ? ' ↓' : ''}<small class="cell-date">${dn(a.variable.name)}</small></th>
        <td class="num">${nf(a.laLiga.p50, digits(a.laLiga.p50))} ${a.unit} (${a.laLiga.n})</td>
        ${draw.filter((k) => k !== 'p50').map((k) => html`<td key=${k} class="num">${nf(a.refs[k], digits(a.refs[k]))} ${a.unit} <span class="muted">· ${nf(a.ratios[k] * 100, 0)} %</span></td>`)}</tr>`)}</tbody></table></div><//>` : null}
    ${radar.omitted.length ? html`<p class="muted">Variables left out of the radar: ${radar.omitted.map((o) => `${o.label} (${o.reason})`).join(' · ')}</p>` : null}
    <details class="notas"><summary>How to read the radar</summary><p class="muted">Each axis is the value divided by the La Liga P50 (the 50th percentile) of that variable, all positions, so the solid yellow polygon (La Liga = 100 %) is regular. Every other reference is its value ÷ that same P50: La Liga P75 and the by-position P50/P75 (yellow), Premier League in-season P50 and P75 (purple; only when the Premier publishes that reference for every axis) and the player's own measurements (white: Personal Average and Personal Best; grey: first and latest measurement). The La Liga P50/P75 exclude the player himself and any synthetic data; the minimum number of players is the one set in Ajustes. Only single-value variables where «higher is better» are eligible.</p>
      <p class="muted"><strong>↓</strong> marks the variables where a lower value is better (contact time, for instance): that axis is drawn inverted (P50 ÷ value) so that, as everywhere else, further out is always better. On those axes «P75» is also the 75th performance percentile (the 0.25 quantile of the values), so it means the same on every axis.</p>
      <p class="muted"><strong>The radius starts at zero</strong> and is proportional to the ratio with the La Liga P50, so the shape can be compared from one radar to the next. If a value goes above 112 % everything is scaled down so the labels still fit. <strong>Zoom the radius to the data range</strong> turns that off: the radius then spans only the range of what is drawn (minimum width 10 %) and no longer starts at zero, which is the way to tell apart differences of 3 or 4 % when every line sits on top of the next (Hop Test, Drop Jump). While it is on, the foot of the chart says so and gives the two percentages — read it before comparing two radars, because the scale is no longer the same.</p>
      <p class="muted">The numbers printed next to each axis come from ONE series, the first of these that is switched on: Personal Average, latest measurement, Personal Best, first measurement. The chart states which one under the «Axis values» line. A reference further than half or twice the La Liga P50 (almost always a different unit in the Premier League tables) is not drawn and is named at the foot of the chart.</p></details>
  <//>`;
}
