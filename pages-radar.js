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
const W = 1000; const H = 484; const CX = 500; const CY = 260; const RREF = 165; // radio exterior (13/11/2026: 130 → 165, para que quepa la escala ajustada)

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

export function RadarSvg({ profile, radar, playerName, shown = ['p50', 'premier50', 'pa'], posName = '', svgRef }) {
  const n = radar.axes.length;
  const draw = shown.filter((k) => radar.complete?.[k]);
  const mainKey = ['pa', 'last', 'pb', 'first'].find((k) => draw.includes(k)) ?? null; // medida del jugador que se rotula en los ejes
  const val = (a) => (mainKey ? a.refs[mainKey] : null);
  const ang = (i) => ((-90 + (i * 360) / n) * Math.PI) / 180;
  // Escala radial ajustada al rango dibujado (13/11/2026). Antes el radio era proporcional al cociente con el P50, así que una diferencia del 5 % eran
  // 6 px y todas las líneas parecían la misma. Ahora el radio NO empieza en cero: el rango observado (siempre incluyendo el P50) se reparte entre R0 y
  // RREF, con una amplitud mínima del 10 % para no agrandar el ruido. El pie del gráfico dice de qué % a qué % va el radio.
  // Para fijar la escala se ignora lo que queda fuera de la mitad y el doble del P50: casi siempre es una referencia en otra unidad, y un solo valor
  // disparatado aplastaría el resto del gráfico contra el centro. Esas series se dibujan igualmente, pegadas al borde, y el pie lo advierte.
  const vals = draw.flatMap((k) => radar.axes.map((a) => a.ratios[k])).filter((x) => Number.isFinite(x) && x >= 0.5 && x <= 2);
  const fuera = draw.filter((k) => radar.axes.some((a) => Number.isFinite(a.ratios[k]) && (a.ratios[k] < 0.5 || a.ratios[k] > 2)));
  const lo0 = Math.min(1, ...vals), hi0 = Math.max(1, ...vals), medio = (lo0 + hi0) / 2;
  const amp = Math.max(hi0 - lo0, 0.1);
  const lo = Math.min(lo0, medio - amp / 2) - amp * 0.12, hi = Math.max(hi0, medio + amp / 2) + amp * 0.12;
  const R0 = RREF * 0.42;
  const rOf = (ratio) => (Number.isFinite(ratio) ? R0 + ((Math.max(lo, Math.min(hi, ratio)) - lo) / (hi - lo)) * (RREF - R0) : R0);
  const unit = RREF; // compatibilidad con el cálculo de los rótulos exteriores
  const pt = (i, ratio) => [CX + Math.cos(ang(i)) * rOf(ratio), CY + Math.sin(ang(i)) * rOf(ratio)];
  const poly = (ratios) => ratios.map((r, i) => pt(i, r).map((x) => x.toFixed(1)).join(',')).join(' ');
  // Dos series con los mismos valores en todos los ejes se dibujan una sola vez (p. ej. «primera» y «última medida» cuando solo hay una sesión):
  // superpuestas no se distinguen y parecían datos distintos que coinciden por casualidad (13/11/2026).
  const iguales = (k1, k2) => radar.axes.every((a) => Number.isFinite(a.ratios[k1]) && Number.isFinite(a.ratios[k2]) && Math.abs(a.ratios[k1] - a.ratios[k2]) < 1e-9);
  const pintadas = []; const juntas = {};
  for (const k of draw) { if (fuera.includes(k)) continue; const igual = pintadas.find((q) => iguales(q, k)); if (igual) (juntas[igual] ??= []).push(k); else pintadas.push(k); }
  const rotulo = (k) => [k, ...(juntas[k] ?? [])].map((q) => refLabel(q, posName, radar.dates)).filter((t, i, arr) => arr.indexOf(t) === i).join(' · ');
  const rows = Math.ceil(pintadas.length / 2); const HH = H + (rows ? rows * 26 + 8 : 0) + 24;
  const basisText = mainKey ? refLabel(mainKey, '', radar.dates) : '';
  return html`<svg ref=${svgRef} xmlns="http://www.w3.org/2000/svg" viewBox=${`0 0 ${W} ${HH}`} width="100%" role="img" class="radar-svg"
      aria-label=${`Radar ${profile.title} de ${playerName}: ${radar.axes.map((a) => `${a.label}${val(a) != null ? ` ${fx(val(a))} ${a.unit}` : ''}`).join('; ')}. Referencias dibujadas: ${draw.map((k) => refLabel(k, posName, radar.dates)).join(', ')}`}>
    <rect width=${W} height=${HH} fill="#000" />
    ${pintadas.map((k) => { const st = REF_STYLE[k]; return html`<polygon key=${k} points=${poly(radar.axes.map((a) => a.ratios[k]))} fill="none" stroke=${st.color} stroke-width=${st.w} stroke-dasharray=${st.dash ?? null} stroke-linecap=${st.cap ?? 'butt'} stroke-linejoin="round" />`; })}
    ${(() => {
      // El título va en el centro, con el tamaño que quepa dentro del polígono más interior (apotema del polígono regular). Si ni a 12 px cabe,
      // se sube a la cabecera del gráfico en vez de pisar las líneas (13/11/2026).
      const interior = Math.min(...pintadas.map((k) => Math.min(...radar.axes.map((a) => rOf(a.ratios[k])))));
      const apotema = interior * Math.cos(Math.PI / n) - 6;
      const lineas = profile.center.length > 11 ? wrap(profile.center) : [profile.center];
      const anchoEm = Math.max(...lineas.map((l) => l.length)) * 0.58;
      const fs = Math.min(22, Math.floor(Math.min((apotema * 2) / anchoEm, (apotema * 2) / (lineas.length * 1.25))));
      const dentro = fs >= 12;
      const tam = dentro ? fs : 20; const y0 = dentro ? CY - ((lineas.length - 1) * tam * 1.15) / 2 + tam * 0.35 : 34;
      return html`<g font-family=${FONT} font-weight="700" fill=${BLANCO} text-anchor="middle">${lineas.map((l, k) => html`<text key=${k} x=${CX} y=${y0 + k * tam * 1.15} font-size=${tam}>${l}</text>`)}</g>`;
    })()}
    <text x=${CX} y=${HH - 8} text-anchor="middle" font-family=${FONT} font-size="17" fill=${MORADO}>${`Radius zoomed to the data: ${Math.round(lo * 100)}% to ${Math.round(hi * 100)}% of the La Liga P50 (does not start at zero)${fuera.length ? ` · off scale, not drawn: ${fuera.map((k) => refLabel(k, posName, radar.dates)).join(', ')}` : ''}`}</text>
    ${radar.axes.map((a, i) => {
      const c = Math.cos(ang(i)); const s = Math.sin(ang(i));
      const top = s < -0.9; const bottom = s > 0.9;
      const lines = wrap(a.invertido ? `${a.label} ↓` : a.label); const wid = Math.max(...lines.map((l) => l.length)) * 13;
      // el rótulo se separa del vértice de La Liga y de la línea más alejada del jugador/referencias en ese eje (que no toque el polígono)
      const ext = Math.max(...draw.map((k) => rOf(a.ratios[k]))); const RR = Math.max(RREF, ext) + 16;
      const vtxX = CX + c * RR; const vtxY = CY + s * RR;
      const v = val(a); const vtxt = v == null ? '' : `${fx(v)} ${a.unit}`;
      if (top || bottom) {
        const y0 = top ? vtxY - 20 - (lines.length - 1) * 22 : vtxY + 32;
        return html`<g key=${i}>${lines.map((l, k) => html`<text key=${k} x=${vtxX} y=${y0 + k * 22} text-anchor="middle" font-family=${FONT} font-size="21" font-weight="700" fill=${BLANCO}>${l}</text>`)}
          <text x=${vtxX} y=${top ? y0 - 28 : y0 + (lines.length - 1) * 22 + 28} text-anchor="middle" font-family=${FONT} font-size="20" fill=${LILA}>${vtxt}</text></g>`;
      }
      const right = c > 0; const lx = vtxX + (right ? 10 : -10); const y0 = vtxY + (s < 0 ? -2 : 6) - (lines.length - 1) * 11;
      return html`<g key=${i}>${lines.map((l, k) => html`<text key=${k} x=${lx} y=${y0 + k * 22} text-anchor=${right ? 'start' : 'end'} font-family=${FONT} font-size="21" font-weight="700" fill=${BLANCO}>${l}</text>`)}
        <text x=${lx + (right ? wid + 26 : -wid - 26)} y=${vtxY + 5} text-anchor=${right ? 'start' : 'end'} font-family=${FONT} font-size="20" fill=${LILA}>${vtxt}</text></g>`;
    })}
    <g font-family=${FONT} font-size="19">${(() => {
      const itemW = (k) => 72 + rotulo(k).length * 9; const GAP = 60;
      const rowsK = []; for (let q = 0; q < pintadas.length; q += 2) rowsK.push(pintadas.slice(q, q + 2));
      return rowsK.map((row, r) => { const total = row.reduce((a, k) => a + itemW(k), 0) + GAP * (row.length - 1); let x = (W - total) / 2; const y = H + r * 26;
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
      if (sel.length < RADAR_MIN_AXES) throw new Error(`Elige al menos ${RADAR_MIN_AXES} variables.`);
      await setSetting(db, 'radarConfig', { test: testName, variables: sel });
      onSaved();
    } catch (e) { setMsg({ level: 'fail', text: e.message }); }
  };
  const reset = async () => { await clearSetting(db, 'radarConfig'); onSaved(); };
  return html`<div class="inline-form" role="group" aria-label="Variables del radar">
    <label>Test <select value=${testName} onChange=${(e) => { setTestName(e.target.value); setSel([]); }}>${tests.map((t) => html`<option key=${t.id} value=${t.name}>${dn(t.name)}</option>`)}</select></label>
    <fieldset><legend>Variables (de ${RADAR_MIN_AXES} a ${RADAR_MAX_AXES}; el orden es el de marcado: ${sel.length} elegidas)</legend>
      ${opts.length ? opts.map((v) => html`<label key=${v.id} class="check"><input type="checkbox" checked=${sel.includes(v.name)} onChange=${() => toggle(v.name)} /> ${dn(v.name)}${v.unit ? ` (${v.unit})` : ''}</label>`) : html`<p class="muted">Este test no tiene variables de un solo valor con «más alto es mejor».</p>`}
    </fieldset>
    <p class="muted">Orden actual de los ejes: ${sel.length ? sel.join(' → ') : '—'}. Se guarda en este navegador y vale para todos los jugadores.</p>
    <button type="button" onClick=${save}>Guardar variables</button> <button type="button" class="secondary" onClick=${reset}>Volver al perfil por defecto (CMJ)</button> <button type="button" class="secondary" onClick=${onCancel}>Cancelar</button><${Msg} msg=${msg} /></div>`;
}

export function RadarPanel({ player, testName }) {
  const { db, version } = useApp();
  const [rpSel, setRp] = useState(null);
  const [shownLocal, setShownLocal] = useState(null);
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
    if (!test) return { test: null, profile, pickable, variables: cat.variables, refsSaved };
    const [sessions, players, records, positions, minN] = await Promise.all([db.sessions.where('testId').equals(test.id).toArray(), db.players.toArray(), db.playerPositions.toArray(), listPositions(db), getSetting(db, 'percentileMinN')]);
    return { test, profile, pickable, refsSaved, variables: cat.variables, sessions, players, records, positions, minN: Number.isInteger(minN) && minN >= 1 ? minN : MIN_N_DEFAULT };
  }, [db, version, player.id, testName, tick]);
  if (!data || data.sinPerfil) return null;
  const profile = data.profile;
  if (testName && data.test && data.test.name !== testName) return null; // el radar solo aparece al mirar su test
  if (testName && !data.test) return null;
  if (!data.test) return html`<${Card} titulo="Perfil radial" id="radar"><p class="muted">El test elegido para el radar («${profile.test}») ya no existe o está archivado.</p>
    <button type="button" class="secondary" onClick=${async () => { await clearSetting(db, 'radarConfig'); setTick((t) => t + 1); }}>Volver al perfil por defecto</button><//>`;
  const playersById = Object.fromEntries(data.players.map((p) => [p.id, p]));
  const histories = {}; for (const r of data.records) (histories[r.playerId] ??= []).push(r);
  // por defecto, la posición principal actual del jugador (así las referencias «por posición» están disponibles sin tener que elegirla)
  const mainPos = positionOnDate(data.records.filter((r) => r.playerId === player.id)).principal?.positionId ?? null;
  const rp = rpSel ?? (mainPos != null ? String(mainPos) : 'all');
  const positionId = rp === 'all' ? null : Number(rp);
  const radar = buildRadar({ profile, test: data.test, variables: data.variables, sessions: data.sessions, players: playersById, histories, playerId: player.id, basis: 'pa', positionId, minN: data.minN, multi: true });
  const shown = shownLocal ?? data.refsSaved;
  const toggleRef = (k) => { const next = shown.includes(k) ? shown.filter((x) => x !== k) : [...shown, k]; setShownLocal(next); setSetting(db, 'radarRefs', next); };
  const unavailable = (r) => (r.needsPosition && positionId === null ? 'Elige una posición para activarla.' : !radar.complete[r.key] ? (r.group === 'premier' ? 'La Premier League no publica esta referencia para todas las variables del radar.' : r.needsPosition ? 'Muestra insuficiente en esa posición.' : r.group === 'jugador' ? 'Falta dato del jugador en alguna variable.' : 'Muestra insuficiente en La Liga.') : null);
  const draw = shown.filter((k) => radar.complete[k]);
  const posName = positionId === null ? 'todas las posiciones' : data.positions.find((p) => p.id === positionId)?.name ?? '—';
  return html`<${Card} titulo=${`Perfil radial: ${profile.title} (${profile.center})`} id="radar">
    <p><button type="button" class="secondary" aria-expanded=${editing} onClick=${() => setEditing(!editing)}>${editing ? 'Cerrar selección' : 'Elegir variables del radar'}</button></p>
    ${editing ? html`<${RadarEditor} cfg=${{ test: profile.test, variables: profile.axes.map((a) => a.variable) }} tests=${data.pickable} variables=${data.variables} onSaved=${() => { setEditing(false); setTick((t) => t + 1); }} onCancel=${() => setEditing(false)} />` : null}
    <div class="filters">
      <label>Posición para las referencias por posición <select value=${rp} onChange=${(e) => setRp(e.target.value)}><option value="all">Ninguna (sin referencias por posición)</option>${data.positions.map((p) => html`<option key=${p.id} value=${p.id}>${p.name}</option>`)}</select></label>
    </div>
    <fieldset class="modes filas"><legend>Referencias del radar</legend>${agruparFiltros(RADAR_REFS).map((fila, i) => html`<div class="ref-fila" key=${'f' + i}>${fila.map((r) => { const why = radar.axes.length ? unavailable(r) : null; return html`<label class="check" key=${r.key} title=${why ?? ''}><input type="checkbox" checked=${shown.includes(r.key)} disabled=${!!why} onChange=${() => toggleRef(r.key)} /> ${refLabel(r.key, '', radar.dates)}${why ? html` <span class="muted">(no disponible)</span>` : null}</label>`; })}</div>`)}</fieldset>
    ${radar.drawable ? html`<${Copiable} nombre=${`radar-${profile.center}-${baseName(player)}`}><${RadarSvg} profile=${profile} radar=${radar} playerName=${playerLabel(player)} shown=${shown} posName=${posName} svgRef=${svgRef} /><//>
      <div class="actions"><button type="button" class="secondary" onClick=${() => toPng(svgRef.current, `radar-${profile.center}-${baseName(player)}.png`.replace(/[^\w.-]+/g, '_')).catch((e) => setMsg({ type: 'error', text: e.message }))}>Descargar imagen (PNG)</button></div>
      <${Msg} msg=${msg} />`
      : html`<p class="muted">No hay datos suficientes para dibujar el radar: hacen falta al menos 3 variables con dato del jugador y P50 suficiente de La Liga.</p>`}
    ${radar.axes.length && draw.length ? html`<${Desplegable} titulo="Valores originales y normalización"><div class="table-wrap"><table><caption>Cada referencia ÷ P50 de La Liga, todas las posiciones</caption>
      <thead><tr><th>Variable</th><th class="num">P50 La Liga (N)</th>${draw.filter((k) => k !== 'p50').map((k) => html`<th key=${k} class="num">${refLabel(k, posName, radar.dates)}</th>`)}</tr></thead>
      <tbody>${radar.axes.map((a) => html`<tr key=${a.variable.id}><th scope="row">${a.label}${a.invertido ? ' ↓' : ''}<small class="cell-date">${dn(a.variable.name)}</small></th>
        <td class="num">${nf(a.laLiga.p50, digits(a.laLiga.p50))} ${a.unit} (${a.laLiga.n})</td>
        ${draw.filter((k) => k !== 'p50').map((k) => html`<td key=${k} class="num">${nf(a.refs[k], digits(a.refs[k]))} ${a.unit} <span class="muted">· ${nf(a.ratios[k] * 100, 0)} %</span></td>`)}</tr>`)}</tbody></table></div><//>` : null}
    ${radar.omitted.length ? html`<p class="muted">Variables que no entran en el radar: ${radar.omitted.map((o) => `${o.label} (${o.reason})`).join(' · ')}</p>` : null}
    <details class="notas"><summary>Cómo se lee el radar</summary><p class="muted"><strong>↓</strong> marca las variables en las que es mejor un valor más bajo (por ejemplo el tiempo de contacto): su eje se dibuja invertido (P50 ÷ valor) para que, como en el resto, hacia fuera siempre sea mejor. En esos ejes, «P75» es también el percentil 75 de rendimiento (el cuantil 0,25 de los valores), para que signifique lo mismo en todos.</p><p class="muted"><strong>El radio no empieza en cero.</strong> Se ajusta al rango de lo dibujado, con una amplitud mínima del 10 %: si no, diferencias reales del 3 o 4 % se verían como una sola línea. El pie del gráfico dice de qué porcentaje a qué porcentaje del P50 va el radio. Una referencia que se salga de la mitad o el doble del P50 (casi siempre, una unidad distinta) no se dibuja y se nombra en ese mismo pie.</p><p class="muted">Cada eje es el valor dividido por la mediana (P50) de «La Liga» de esa variable (todas las posiciones), así que el polígono amarillo continuo (La Liga = 100 %) es regular. Las demás referencias son su valor ÷ ese P50: P75 y P50/P75 por posición de La Liga (amarillo), P50 y P75 de la Premier League in-season (lila; solo si la Premier publica esa referencia para todos los ejes) y las medidas del jugador (blanco: Personal Average y Personal Best; gris: primera y última medida). Los valores que se rotulan en los ejes son los de la primera medida del jugador activada en este orden: Personal Average, última, Personal Best, primera. La P50/P75 de La Liga excluyen al propio jugador y a los sintéticos; mínimo de jugadores el de Ajustes. Solo entran variables de un valor con «más alto es mejor».</p></details>
  <//>`;
}
