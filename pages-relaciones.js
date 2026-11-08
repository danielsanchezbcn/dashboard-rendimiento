// pages-relaciones.js — fase 6: DSI, EUR y ORZ en la ficha del jugador (orientativos; toda la historia siempre).
import { html, useState } from './libs.js';
import { useApp } from './context.js';
import { Card, useLoad, useRunner, Msg } from './componentes.js';
import { getSetting, setSetting, clearSetting } from './db.js';
import { listCatalog } from './catalogo.js';
import { MIN_N_DEFAULT } from './percentiles.js';
import { locate, ratioReferences, G, withReferenceWeights, squadRatios, quadrantCuts, quadrantOf } from './relaciones.js';

const nf = (n, d = 2) => (n === null || n === undefined ? '—' : Number(n).toLocaleString('es-ES', { maximumFractionDigits: d }));

function Pct({ ev }) {
  if (!ev) return null;
  if (!ev.sufficient) return html`<span class="muted">Muestra insuficiente (N = ${ev.n}, mínimo ${ev.minN}).</span>`;
  return html`<span>percentil <strong>${nf(ev.percentileStat, 0)}</strong> de ${ev.n} jugadores (mediana ${nf(ev.p50)}); sin color: no hay dirección «mejor/peor» definida</span>`;
}

// G8 (D18): cuadrantes DSI (vertical, un punto por lado) y EUR (horizontal). SVG propio; cortes = mediana de La Liga o valores fijados por el usuario.
function Cuadrantes({ sq, fixed, minN, playerName, db, reload }) {
  const { msg, busy, run } = useRunner();
  const [f, setF] = useState({ dsi: fixed?.dsi ? String(fixed.dsi).replace('.', ',') : '', eur: fixed?.eur ? String(fixed.eur).replace('.', ',') : '' });
  const cuts = quadrantCuts({ others: sq.others, fixed, minN });
  const m = sq.mine; const eurV = m.eur.defined ? m.eur.value : null;
  const mineP = [['L', 'Izquierda', 'I'], ['R', 'Derecha', 'D']].map(([k, name, ab]) => ({ k, name, ab, dsi: m.dsi[k].defined ? m.dsi[k].value : null })).filter((p) => p.dsi !== null && eurV !== null);
  const bg = sq.others.flatMap((o) => (o.eur === null ? [] : ['L', 'R'].filter((k) => o[k] !== null).map((k) => ({ x: o.eur, y: o[k] }))));
  const xs = bg.map((p) => p.x).concat(mineP.map(() => eurV), cuts.eur.value ?? []); const ys = bg.map((p) => p.y).concat(mineP.map((p) => p.dsi), cuts.dsi.value ?? []);
  const save = run(async () => {
    const num = (t) => { const x = String(t).trim(); return x === '' ? null : Number(x.replace(',', '.')); };
    const v = { dsi: num(f.dsi), eur: num(f.eur) };
    if ([v.dsi, v.eur].some((x) => x !== null && !(Number.isFinite(x) && x > 0))) throw new Error('Los cortes deben ser números mayores que 0 (o vacío para usar la mediana).');
    await setSetting(db, 'quadrantCuts', v); reload();
  }, 'Cortes guardados.');
  const W = 640, H = 420, L = 64, R = 16, T = 16, B = 52;
  const lo = (a) => Math.min(...a); const hi = (a) => Math.max(...a);
  const pad = (a) => { const d = (hi(a) - lo(a)) || 0.2; return [lo(a) - d * 0.08, hi(a) + d * 0.08]; };
  const [x0, x1] = xs.length ? pad(xs) : [0, 1]; const [y0, y1] = ys.length ? pad(ys) : [0, 1];
  const px = (x) => L + ((x - x0) / (x1 - x0)) * (W - L - R); const py = (y) => H - B - ((y - y0) / (y1 - y0)) * (H - T - B);
  const ticks = (a, b) => Array.from({ length: 5 }, (_, i) => a + ((b - a) * i) / 4);
  return html`<div>
    <h3>Cuadrantes DSI × EUR</h3>
    <p class="muted">Eje horizontal: EUR; vertical: DSI (un punto por lado). Los cortes son la <strong>mediana de La Liga</strong> (mínimo ${minN} jugadores con dato; DSI con los dos lados juntos) o los valores fijos que escribas. Las etiquetas solo dicen si cada valor queda por encima o por debajo del corte. <strong>No hay zona neutra</strong>: no se conoce el error de medida, así que un jugador muy cerca de un corte puede cambiar de cuadrante por ruido; el valor igual al corte cuenta como «por encima».</p>
    <div class="filters">
      <label>Corte DSI fijo (vacío = mediana) <input inputmode="decimal" value=${f.dsi} onInput=${(e) => setF({ ...f, dsi: e.target.value })} /></label>
      <label>Corte EUR fijo (vacío = mediana) <input inputmode="decimal" value=${f.eur} onInput=${(e) => setF({ ...f, eur: e.target.value })} /></label>
      <button type="button" disabled=${busy} onClick=${save}>Guardar cortes</button>
      <button type="button" class="secondary" onClick=${async () => { await clearSetting(db, 'quadrantCuts'); setF({ dsi: '', eur: '' }); reload(); }}>Volver a la mediana</button>
    </div><${Msg} msg=${msg} />
    <p class="muted">Corte DSI: ${cuts.dsi.value === null ? `sin mediana (N = ${cuts.dsi.n ?? 0} < ${minN})` : `${nf(cuts.dsi.value)} (${cuts.dsi.source === 'fijo' ? 'fijado por ti' : `mediana de ${cuts.dsi.n} jugadores`})`} · Corte EUR: ${cuts.eur.value === null ? `sin mediana (N = ${cuts.eur.n ?? 0} < ${minN})` : `${nf(cuts.eur.value)} (${cuts.eur.source === 'fijo' ? 'fijado por ti' : `mediana de ${cuts.eur.n} jugadores`})`}</p>
    ${mineP.length ? html`<svg viewBox=${`0 0 ${W} ${H}`} width="100%" role="img" style="display:block;max-width:720px" aria-label=${`Cuadrantes DSI por EUR de ${playerName}: ${mineP.map((p) => `${p.name} DSI ${nf(p.dsi)} con EUR ${nf(eurV)}`).join('; ')}`}>
      <rect x=${L} y=${T} width=${W - L - R} height=${H - T - B} style="fill:none;stroke:var(--line)" />
      ${ticks(x0, x1).map((v) => html`<g key=${'x' + v}><line x1=${px(v)} x2=${px(v)} y1=${T} y2=${H - B} style="stroke:var(--line)" stroke-width="0.5" /><text x=${px(v)} y=${H - B + 16} text-anchor="middle" font-size="12" style="fill:var(--muted)">${nf(v)}</text></g>`)}
      ${ticks(y0, y1).map((v) => html`<g key=${'y' + v}><line x1=${L} x2=${W - R} y1=${py(v)} y2=${py(v)} style="stroke:var(--line)" stroke-width="0.5" /><text x=${L - 6} y=${py(v) + 4} text-anchor="end" font-size="12" style="fill:var(--muted)">${nf(v)}</text></g>`)}
      ${bg.map((p, i) => html`<circle key=${i} cx=${px(p.x)} cy=${py(p.y)} r="3" style="fill:var(--muted);opacity:.55" />`)}
      ${cuts.eur.value !== null ? html`<line x1=${px(cuts.eur.value)} x2=${px(cuts.eur.value)} y1=${T} y2=${H - B} style="stroke:var(--text)" stroke-dasharray="6 4" />` : null}
      ${cuts.dsi.value !== null ? html`<line x1=${L} x2=${W - R} y1=${py(cuts.dsi.value)} y2=${py(cuts.dsi.value)} style="stroke:var(--text)" stroke-dasharray="6 4" />` : null}
      ${mineP.map((p) => html`<g key=${p.k}><circle cx=${px(eurV)} cy=${py(p.dsi)} r="8" style="fill:var(--accent)" /><text x=${px(eurV) + 12} y=${py(p.dsi) + 4} font-size="13" font-weight="700" style="fill:var(--text)">${p.ab}</text></g>`)}
      <text x=${(L + W - R) / 2} y=${H - 10} text-anchor="middle" font-size="13" style="fill:var(--text)">EUR</text>
      <text transform=${`translate(16 ${(T + H - B) / 2}) rotate(-90)`} text-anchor="middle" font-size="13" style="fill:var(--text)">DSI</text></svg>
      <p class="muted">Gris: otros jugadores de La Liga (un punto por jugador y lado, sin sintéticos). Punto de color: ${playerName}, I = izquierda, D = derecha. Líneas discontinuas: los cortes.</p>
      <div class="table-wrap"><table><caption>Posición del jugador respecto a los cortes</caption><thead><tr><th>Lado</th><th class="num">DSI</th><th class="num">EUR</th><th>Cuadrante</th></tr></thead>
        <tbody>${mineP.map((p) => { const q = quadrantOf(p.dsi, eurV, cuts); return html`<tr key=${p.k}><td>${p.name}</td><td class="num">${nf(p.dsi)}</td><td class="num">${nf(eurV)}</td><td>${q ? q.text : html`<span class="muted">Sin corte: fija un valor o espera a tener ${minN} jugadores con dato</span>`}</td></tr>`; })}</tbody></table></div>`
      : html`<p class="muted">Hacen falta el EUR y al menos un DSI del jugador para dibujar los cuadrantes.</p>`}
  </div>`;
}

export function RelacionesPanel({ player }) {
  const { db, version } = useApp();
  const [tick, setTick] = useState(0);
  const { data } = useLoad(async () => {
    const cat = await listCatalog(db);
    const [sessions, anthropometry, players, minN, fixed] = await Promise.all([db.sessions.toArray(), db.anthropometry.toArray(), db.players.toArray(), getSetting(db, 'percentileMinN'), getSetting(db, 'quadrantCuts')]);
    return { cat, fixed, sessions: sessions.filter((s) => s.status !== 'excluded'), anthropometry: withReferenceWeights(anthropometry, players), players, minN: Number.isInteger(minN) && minN >= 1 ? minN : MIN_N_DEFAULT };
  }, [db, version, player.id, tick]);
  if (!data) return null;
  const loc = locate(data.cat.tests, data.cat.variables);
  const pl = Object.fromEntries(data.players.map((p) => [p.id, p]));
  const r = ratioReferences({ loc, sessions: data.sessions, anthropometry: data.anthropometry, players: pl, playerId: player.id, minN: data.minN });
  const m = r.mine;
  const none = !m.dsi.L.defined && !m.dsi.R.defined && !m.eur.defined && m.orz.hidden;
  return html`
    <${Card} titulo="Relaciones: DSI, EUR y ORZ" id="relaciones">
      <p class="muted">Ratios <strong>orientativos</strong> y sin unidad. Usan toda la historia del jugador (no cambian con los filtros de pantalla) y el Personal Average de cada término. Las sesiones excluidas no cuentan.</p>
      ${none ? html`<p class="muted">Aún no hay datos para calcular ningún ratio (hacen falta, según el caso, SL CMJ y Knee Iso-Push con masa corporal medida, CMJ y Squat Jump, o Drop Jump de 30 y 45 cm).</p>` : null}
      <h3>DSI (Dynamic Strength Index)</h3>
      <p class="muted">SL CMJ «CONCENTRIC PEAK FORCE / BM» (N/kg ÷ ${nf(G, 5)}, en múltiplos del peso) ÷ Knee Iso-Push Peak Force relativo al peso corporal (BW, con la masa medida más cercana a cada sesión o, si no hay ninguna, el peso de referencia del jugador).</p>
      <div class="table-wrap"><table><thead><tr><th>Lado</th><th class="num">DSI</th><th>Detalle</th><th>Frente a La Liga</th></tr></thead><tbody>
        ${[['L', 'Izquierda', r.dsiL], ['R', 'Derecha', r.dsiR]].map(([k, name, ev]) => html`<tr key=${k}><td>${name}</td>
          <td class="num">${m.dsi[k].defined ? nf(m.dsi[k].value) : '—'}</td>
          <td>${m.dsi[k].defined ? html`SL ${nf(m.dsi[k].slBW)} BW (${m.dsi[k].slSessions} ses.) ÷ Knee ${nf(m.dsi[k].kneeBW)} BW (${m.dsi[k].kneeSessions} ses.)${m.dsi[k].omittedKnee ? html` <span class="status warn">${m.dsi[k].omittedKnee} sesión(es) de Knee sin masa previa, omitidas</span>` : null}` : m.dsi[k].reason}</td>
          <td><${Pct} ev=${ev} /></td></tr>`)}
      </tbody></table></div>
      <h3>EUR (Eccentric Utilization Ratio)</h3>
      <p class="muted">CMJ Jump Height (JH imp-mom), Personal Average ÷ Squat Jump Jump Height (JH imp-mom), Personal Best. Dividir una media entre un mejor valor sesga el cociente a la baja y no es comparable con los valores de la bibliografía.</p>
      <p>${m.eur.defined ? html`<strong>${nf(m.eur.value)}</strong> (CMJ ${nf(m.eur.cmjPA)} cm ÷ SJ ${nf(m.eur.sjPB)} cm). <${Pct} ev=${r.eur} />` : m.eur.reason}</p>
      <h3>Optimal Reactive Zone (Drop Jump)</h3>
      ${m.orz.hidden ? html`<p class="muted">Sin datos de ambas alturas: no se muestra la ORZ (hace falta al menos una sesión válida de 30 cm y otra de 45 cm).</p>` : m.orz.defined
        ? html`<p><strong>ORZ: ${m.orz.height} cm</strong> — RSI Personal Average: 30 cm ${nf(m.orz.pa30)} · 45 cm ${nf(m.orz.pa45)}.</p>` : html`<p>${m.orz.reason} (30 cm ${nf(m.orz.pa30)} · 45 cm ${nf(m.orz.pa45)})</p>`}
      <${Cuadrantes} sq=${squadRatios({ loc, sessions: data.sessions, anthropometry: data.anthropometry, players: pl, playerId: player.id })} fixed=${data.fixed} minN=${data.minN} playerName=${player.jerseyName} db=${db} reload=${() => setTick((t) => t + 1)} />
    <//>`;
}
