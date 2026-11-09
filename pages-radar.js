// pages-radar.js — fase 5d (D16): perfil radial G3 en la ficha del jugador, con el aspecto del radar aportado por el usuario
// (fondo negro, línea lila = jugador, amarilla = P50 de La Liga, blanca punteada = P50 de la Premier League). Descarga en PNG.
import { html, useState, useRef } from './libs.js';
import { useApp } from './context.js';
import { Card, useLoad, Msg } from './componentes.js';
import { fmtDay } from './fechas.js';
import { getSetting, setSetting, clearSetting } from './db.js';
import { listCatalog } from './catalogo.js';
import { listPositions } from './posiciones.js';
import { MIN_N_DEFAULT } from './percentiles.js';
import { buildRadar, profileFromSetting, RADAR_MIN_AXES, RADAR_MAX_AXES, RADAR_REFS, radarRefsFromSetting } from './radar.js';
import { downloadBlob } from './io.js';
import { playerLabel, baseName } from './jugadores.js';
import { Copiable } from './copiar.js';

const nf = (n, d = 2) => (n === null || n === undefined ? '—' : Number(n).toLocaleString('es-ES', { maximumFractionDigits: d }));
const fx = (v) => Number(v).toLocaleString('es-ES', { minimumFractionDigits: digits(v), maximumFractionDigits: digits(v) });
const digits = (v) => (Math.abs(v) >= 100 ? 0 : Math.abs(v) >= 10 ? 1 : 2);
import { FUENTE_GRAFICOS } from './fuentes.js';
const FONT = FUENTE_GRAFICOS;
const LILA = '#ffffff'; /* valores del jugador: blanco (9/11/2026) */ const MORADO = '#b8a2c9'; const AMARILLO = '#fec900'; const BLANCO = '#ffffff';
const W = 1000; const H = 490; const CX = 500; const CY = 276; const RREF = 130;

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
const refLabel = (k, posName) => { const l = RADAR_REFS.find((r) => r.key === k)?.label ?? k; return k.endsWith('pos') && posName ? `${l} (${posName})` : l; };

export function RadarSvg({ profile, radar, playerName, shown = ['p50', 'premier50', 'pa'], posName = '', svgRef }) {
  const n = radar.axes.length;
  const draw = shown.filter((k) => radar.complete?.[k]);
  const mainKey = ['pa', 'last', 'pb', 'first'].find((k) => draw.includes(k)) ?? null; // medida del jugador que se rotula en los ejes
  const val = (a) => (mainKey ? a.refs[mainKey] : null);
  const ang = (i) => ((-90 + (i * 360) / n) * Math.PI) / 180;
  const maxRatio = Math.max(1, ...draw.flatMap((k) => radar.axes.map((a) => a.ratios[k])));
  const unit = maxRatio > 1.12 ? (RREF * 1.12) / maxRatio : RREF; // radio de La Liga (100 %); si algún eje pasa del 112 %, se reduce todo para que quepa sin pisar las etiquetas
  const pt = (i, ratio) => [CX + Math.cos(ang(i)) * unit * ratio, CY + Math.sin(ang(i)) * unit * ratio];
  const poly = (ratios) => ratios.map((r, i) => pt(i, r).map((x) => x.toFixed(1)).join(',')).join(' ');
  const rows = Math.ceil(draw.length / 2); const HH = H + (rows ? rows * 26 + 8 : 0);
  const basisText = mainKey ? refLabel(mainKey) : '';
  return html`<svg ref=${svgRef} xmlns="http://www.w3.org/2000/svg" viewBox=${`0 0 ${W} ${HH}`} width="100%" role="img" class="radar-svg"
      aria-label=${`Radar ${profile.title} de ${playerName}: ${radar.axes.map((a) => `${a.label}${val(a) != null ? ` ${fx(val(a))} ${a.unit}` : ''}`).join('; ')}. Referencias dibujadas: ${draw.map((k) => refLabel(k, posName)).join(', ')}`}>
    <rect width=${W} height=${HH} fill="#000" />
    <rect x="230" y="26" width="540" height="40" rx="8" fill="none" stroke=${LILA} stroke-width="3" />
    <text x=${CX} y="56" text-anchor="middle" font-family=${FONT} font-size="32" font-weight="700" fill=${LILA}>${profile.title}</text>
    <text x="985" y="42" text-anchor="end" font-family=${FONT} font-size="18" fill=${LILA}>${playerName.length > 24 ? playerName.slice(0, 23) + '…' : playerName}</text>
    <text x="985" y="62" text-anchor="end" font-family=${FONT} font-size="15" fill=${LILA}>${basisText}</text>
    ${draw.map((k) => { const st = REF_STYLE[k]; return html`<polygon key=${k} points=${poly(radar.axes.map((a) => a.ratios[k]))} fill="none" stroke=${st.color} stroke-width=${st.w} stroke-dasharray=${st.dash ?? null} stroke-linecap=${st.cap ?? 'butt'} stroke-linejoin="round" />`; })}
    <text x=${CX} y=${CY + 12} text-anchor="middle" font-family=${FONT} font-size="34" font-weight="700" fill=${BLANCO}>${profile.center}</text>
    ${radar.axes.map((a, i) => {
      const c = Math.cos(ang(i)); const s = Math.sin(ang(i));
      const top = s < -0.9; const bottom = s > 0.9;
      const lines = wrap(a.label); const wid = Math.max(...lines.map((l) => l.length)) * 11.5;
      const vtxX = CX + c * RREF; const vtxY = CY + s * RREF;
      const v = val(a); const vtxt = v == null ? '' : `${fx(v)} ${a.unit}`;
      if (top || bottom) {
        const y0 = top ? vtxY - 20 - (lines.length - 1) * 22 : vtxY + 32;
        return html`<g key=${i}>${lines.map((l, k) => html`<text key=${k} x=${vtxX} y=${y0 + k * 22} text-anchor="middle" font-family=${FONT} font-size="21" font-weight="700" fill=${BLANCO}>${l}</text>`)}
          <text x=${vtxX} y=${top ? y0 - 30 : y0 + (lines.length - 1) * 22 + 34} text-anchor="middle" font-family=${FONT} font-size="26" fill=${LILA}>${vtxt}</text></g>`;
      }
      const right = c > 0; const lx = vtxX + (right ? 10 : -10); const y0 = vtxY + (s < 0 ? -2 : 6) - (lines.length - 1) * 11;
      return html`<g key=${i}>${lines.map((l, k) => html`<text key=${k} x=${lx} y=${y0 + k * 22} text-anchor=${right ? 'start' : 'end'} font-family=${FONT} font-size="21" font-weight="700" fill=${BLANCO}>${l}</text>`)}
        <text x=${lx + (right ? wid + 22 : -wid - 22)} y=${vtxY + 6} text-anchor=${right ? 'start' : 'end'} font-family=${FONT} font-size="26" fill=${LILA}>${vtxt}</text></g>`;
    })}
    <g font-family=${FONT} font-size="19">${draw.map((k, i) => { const st = REF_STYLE[k]; const x = 40 + (i % 2) * 480; const y = H + Math.floor(i / 2) * 26;
      return html`<g key=${k}><line x1=${x} x2=${x + 60} y1=${y} y2=${y} stroke=${st.color} stroke-width=${st.w} stroke-dasharray=${st.dash ?? null} stroke-linecap=${st.cap ?? 'butt'} /><text x=${x + 72} y=${y + 6} fill=${st.color === GRIS ? GRIS : st.color}>${refLabel(k, posName)}</text></g>`; })}</g>
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
  const test = tests.find((t) => t.name === testName);
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
    <label>Test <select value=${testName} onChange=${(e) => { setTestName(e.target.value); setSel([]); }}>${tests.map((t) => html`<option key=${t.id} value=${t.name}>${t.name}</option>`)}</select></label>
    <fieldset><legend>Variables (de ${RADAR_MIN_AXES} a ${RADAR_MAX_AXES}; el orden es el de marcado: ${sel.length} elegidas)</legend>
      ${opts.length ? opts.map((v) => html`<label key=${v.id} class="check"><input type="checkbox" checked=${sel.includes(v.name)} onChange=${() => toggle(v.name)} /> ${v.name}${v.unit ? ` (${v.unit})` : ''}</label>`) : html`<p class="muted">Este test no tiene variables de un solo valor con «más alto es mejor».</p>`}
    </fieldset>
    <p class="muted">Orden actual de los ejes: ${sel.length ? sel.join(' → ') : '—'}. Se guarda en este navegador y vale para todos los jugadores.</p>
    <button type="button" onClick=${save}>Guardar variables</button> <button type="button" class="secondary" onClick=${reset}>Volver al perfil por defecto (CMJ)</button> <button type="button" class="secondary" onClick=${onCancel}>Cancelar</button><${Msg} msg=${msg} /></div>`;
}

export function RadarPanel({ player, testName }) {
  const { db, version } = useApp();
  const [rp, setRp] = useState('all');
  const [shownLocal, setShownLocal] = useState(null);
  const [msg, setMsg] = useState(null);
  const [editing, setEditing] = useState(false);
  const [tick, setTick] = useState(0);
  const svgRef = useRef(null);
  const { data } = useLoad(async () => {
    const cat = await listCatalog(db);
    const profile = profileFromSetting(await getSetting(db, 'radarConfig'));
    const test = cat.tests.find((t) => t.name === profile.test && !t.archived);
    const pickable = cat.tests.filter((t) => !t.archived && eligible(cat.variables, t.id).length >= RADAR_MIN_AXES);
    const refsSaved = radarRefsFromSetting(await getSetting(db, 'radarRefs'));
    if (!test) return { test: null, profile, pickable, variables: cat.variables, refsSaved };
    const [sessions, players, records, positions, minN] = await Promise.all([db.sessions.where('testId').equals(test.id).toArray(), db.players.toArray(), db.playerPositions.toArray(), listPositions(db), getSetting(db, 'percentileMinN')]);
    return { test, profile, pickable, refsSaved, variables: cat.variables, sessions, players, records, positions, minN: Number.isInteger(minN) && minN >= 1 ? minN : MIN_N_DEFAULT };
  }, [db, version, player.id, tick]);
  if (!data) return null;
  const profile = data.profile;
  if (testName && data.test && data.test.name !== testName) return null; // el radar solo aparece al mirar su test (CMJ por defecto)
  if (testName && !data.test) return null;
  if (!data.test) return html`<${Card} titulo="Perfil radial" id="radar"><p class="muted">El test elegido para el radar («${profile.test}») ya no existe o está archivado.</p>
    <button type="button" class="secondary" onClick=${async () => { await clearSetting(db, 'radarConfig'); setTick((t) => t + 1); }}>Volver al perfil por defecto</button><//>`;
  const playersById = Object.fromEntries(data.players.map((p) => [p.id, p]));
  const histories = {}; for (const r of data.records) (histories[r.playerId] ??= []).push(r);
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
      <label>Posición para las referencias por posición <select value=${rp} onChange=${(e) => setRp(e.target.value)}><option value="all">Ninguna</option>${data.positions.map((p) => html`<option key=${p.id} value=${p.id}>${p.name}</option>`)}</select></label>
    </div>
    <fieldset class="modes"><legend>Referencias del radar</legend>${RADAR_REFS.map((r) => { const why = radar.axes.length ? unavailable(r) : null; return html`<label class="check" key=${r.key} title=${why ?? ''}><input type="checkbox" checked=${shown.includes(r.key)} disabled=${!!why} onChange=${() => toggleRef(r.key)} /> ${r.label}${why ? html` <span class="muted">(no disponible)</span>` : null}</label>`; })}</fieldset>
    ${radar.drawable ? html`<${Copiable} nombre=${`radar-${profile.center}-${baseName(player)}`}><${RadarSvg} profile=${profile} radar=${radar} playerName=${playerLabel(player)} shown=${shown} posName=${posName} svgRef=${svgRef} /><//>
      <div class="actions"><button type="button" class="secondary" onClick=${() => toPng(svgRef.current, `radar-${profile.center}-${baseName(player)}.png`.replace(/[^\w.-]+/g, '_')).catch((e) => setMsg({ type: 'error', text: e.message }))}>Descargar imagen (PNG)</button></div>
      <${Msg} msg=${msg} />`
      : html`<p class="muted">No hay datos suficientes para dibujar el radar: hacen falta al menos 3 variables con dato del jugador y P50 suficiente de La Liga.</p>`}
    ${radar.axes.length && draw.length ? html`<div class="table-wrap"><table><caption>Valores originales y normalización (cada referencia ÷ P50 de La Liga, todas las posiciones)</caption>
      <thead><tr><th>Variable</th><th class="num">P50 La Liga (N)</th>${draw.filter((k) => k !== 'p50').map((k) => html`<th key=${k} class="num">${refLabel(k, posName)}</th>`)}</tr></thead>
      <tbody>${radar.axes.map((a) => html`<tr key=${a.variable.id}><th scope="row">${a.label}<small class="cell-date">${a.variable.name}</small></th>
        <td class="num">${nf(a.laLiga.p50, digits(a.laLiga.p50))} ${a.unit} (${a.laLiga.n})</td>
        ${draw.filter((k) => k !== 'p50').map((k) => html`<td key=${k} class="num">${nf(a.refs[k], digits(a.refs[k]))} ${a.unit} <span class="muted">· ${nf(a.ratios[k] * 100, 0)} %</span></td>`)}</tr>`)}</tbody></table></div>` : null}
    ${radar.omitted.length ? html`<p class="muted">Variables que no entran en el radar: ${radar.omitted.map((o) => `${o.label} (${o.reason})`).join(' · ')}</p>` : null}
    <details class="notas"><summary>Cómo se lee el radar</summary><p class="muted">Cada eje es el valor dividido por la mediana (P50) de «La Liga» de esa variable (todas las posiciones), así que el polígono amarillo continuo (La Liga = 100 %) es regular. Las demás referencias son su valor ÷ ese P50: P75 y P50/P75 por posición de La Liga (amarillo), P50 y P75 de la Premier League in-season (lila; solo si la Premier publica esa referencia para todos los ejes) y las medidas del jugador (blanco: Personal Average y Personal Best; gris: primera y última medida). Los valores que se rotulan en los ejes son los de la primera medida del jugador activada en este orden: Personal Average, última, Personal Best, primera. La P50/P75 de La Liga excluyen al propio jugador y a los sintéticos; mínimo de jugadores el de Ajustes. Solo entran variables de un valor con «más alto es mejor».</p></details>
  <//>`;
}
