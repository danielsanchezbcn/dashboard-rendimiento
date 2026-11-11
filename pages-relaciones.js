// pages-relaciones.js — fase 6: DSI y EUR (con orientación de fuerza) y ORZ en la pantalla del test correspondiente (orientativos; toda la historia siempre).
import { html, useState } from './libs.js';
import { useApp } from './context.js';
import { useLoad } from './componentes.js';
import { getSetting } from './db.js';
import { listCatalog } from './catalogo.js';
import { MIN_N_DEFAULT } from './percentiles.js';
import { locate, ratioReferences, G, withReferenceWeights, strengthOrientation, componentQuadrants, quadrantSide } from './relaciones.js';
import { Copiable } from './copiar.js';
import { playerLabel } from './jugadores.js';
import { PAL } from './colores.js';
import { FUENTE_GRAFICOS } from './fuentes.js';
import { BANDS } from './percentiles.js';
import { AsimTexto } from './asim-ui.js';

const nf = (n, d = 2) => (n === null || n === undefined ? '—' : Number(n).toLocaleString('es-ES', { maximumFractionDigits: d }));

// Percentil con el mismo formato y colores que en el resto de la aplicación (número visible, color de las seis bandas).
// Aquí el color indica la POSICIÓN en La Liga, no «mejor/peor»: DSI y EUR no tienen dirección de rendimiento.
function Chip({ ev, detail }) {
  if (!ev) return html`<span class="muted">—</span>`;
  if (!ev.sufficient || ev.percentileStat === null) return html`<span class="muted" title=${ev.reason ?? ''}>Muestra insuficiente (N = ${ev.n}, mínimo ${ev.minN})</span>`;
  const b = BANDS[ev.band];
  const tip = `${detail ? detail + ' · ' : ''}Percentil ${nf(ev.percentileStat, 0)} de ${ev.n} valores de La Liga (mediana ${nf(ev.p50)}). El color indica la posición, no «mejor/peor».`;
  return html`<span class=${'band band-' + b.key} title=${tip} aria-label=${tip} tabindex="0">${nf(ev.percentileStat, 0)}</span>`;
}

function useRatios(player) {
  const { db, version } = useApp();
  const [tick, setTick] = useState(0);
  const { data } = useLoad(async () => {
    const cat = await listCatalog(db);
    const [sessions, anthropometry, players, minN] = await Promise.all([db.sessions.toArray(), db.anthropometry.toArray(), db.players.toArray(), getSetting(db, 'percentileMinN')]);
    return { cat, sessions: sessions.filter((s) => s.status !== 'excluded'), anthropometry: withReferenceWeights(anthropometry, players), players, minN: Number.isInteger(minN) && minN >= 1 ? minN : MIN_N_DEFAULT };
  }, [db, version, player.id, tick]);
  if (!data) return { data: null };
  const loc = locate(data.cat.tests, data.cat.variables);
  const pl = Object.fromEntries(data.players.map((p) => [p.id, p]));
  const r = ratioReferences({ loc, sessions: data.sessions, anthropometry: data.anthropometry, players: pl, playerId: player.id, minN: data.minN });
  return { data, loc, pl, r, reload: () => setTick((t) => t + 1) };
}


// Cuadrante con dos ejes (los componentes del ratio), con el mismo diseño que los demás gráficos: fondo negro, La Liga en amarillo.
function Cuadrante({ titulo, xLabel, yLabel, bg, cutX, cutY, mine, n, minN, nombre, playerLabel }) {
  const W = 640, H = 440, L = 64, R = 16, T = 40, B = 56;
  const xs = bg.map((p) => p.x).concat(mine.map((p) => p.x), cutX ?? []), ys = bg.map((p) => p.y).concat(mine.map((p) => p.y), cutY ?? []);
  if (!mine.length) return html`<p class="muted">Faltan datos de este jugador para dibujar el cuadrante.</p>`;
  const pad = (a) => { const lo = Math.min(...a), hi = Math.max(...a), d = (hi - lo) || 0.2; return [lo - d * 0.08, hi + d * 0.08]; };
  const [x0, x1] = pad(xs), [y0, y1] = pad(ys);
  const px = (x) => L + ((x - x0) / (x1 - x0)) * (W - L - R), py = (y) => H - B - ((y - y0) / (y1 - y0)) * (H - T - B);
  const ticks = (a, b) => Array.from({ length: 5 }, (_, i) => a + ((b - a) * i) / 4);
  const noCut = cutX === null || cutY === null;
  return html`<div>

    <${Copiable} nombre=${nombre}><svg viewBox=${`0 0 ${W} ${H}`} width="100%" class="cuadrante" font-family=${FUENTE_GRAFICOS} role="img" aria-label=${`${titulo} de ${playerLabel}: ${mine.map((p) => `${p.label} ${xLabel} ${nf(p.x)}, ${yLabel} ${nf(p.y)}`).join('; ')}`}>
      <rect width=${W} height=${H} fill=${PAL.fondo} />
      <text x=${W / 2} y="26" text-anchor="middle" font-size="20" font-weight="700" fill=${PAL.texto}>${titulo}</text>
      <rect x=${L} y=${T} width=${W - L - R} height=${H - T - B} fill="none" stroke=${PAL.rejilla} />
      ${ticks(x0, x1).map((v) => html`<g key=${'x' + v}><line x1=${px(v)} x2=${px(v)} y1=${T} y2=${H - B} stroke=${PAL.rejilla} stroke-width="0.5" /><text x=${px(v)} y=${H - B + 18} text-anchor="middle" font-size="14" fill=${PAL.texto}>${nf(v)}</text></g>`)}
      ${ticks(y0, y1).map((v) => html`<g key=${'y' + v}><line x1=${L} x2=${W - R} y1=${py(v)} y2=${py(v)} stroke=${PAL.rejilla} stroke-width="0.5" /><text x=${L - 8} y=${py(v) + 5} text-anchor="end" font-size="14" fill=${PAL.texto}>${nf(v)}</text></g>`)}
      ${bg.map((p, i) => html`<circle key=${i} cx=${px(p.x)} cy=${py(p.y)} r="3.5" fill=${PAL.laLiga} opacity="0.6" />`)}
      ${cutX !== null ? html`<line x1=${px(cutX)} x2=${px(cutX)} y1=${T} y2=${H - B} stroke=${PAL.laLiga} stroke-width="2" stroke-dasharray="6 4" />` : null}
      ${cutY !== null ? html`<line x1=${L} x2=${W - R} y1=${py(cutY)} y2=${py(cutY)} stroke=${PAL.laLiga} stroke-width="2" stroke-dasharray="6 4" />` : null}
      ${mine.map((p, i) => html`<g key=${i}><circle cx=${px(p.x)} cy=${py(p.y)} r="9" fill=${p.short === 'R' ? PAL.der : p.short === 'L' ? PAL.izq : PAL.jugador} stroke=${PAL.fondo} stroke-width="2" />${p.label ? html`<text x=${px(p.x) + 14} y=${py(p.y) + 5} font-size="16" font-weight="700" fill=${PAL.texto}>${p.short ?? ''}</text>` : null}</g>`)}
      <text x=${(L + W - R) / 2} y=${H - 8} text-anchor="middle" font-size="15" fill=${PAL.texto}>${xLabel}</text>
      <text transform=${`translate(18 ${(T + H - B) / 2}) rotate(-90)`} text-anchor="middle" font-size="15" fill=${PAL.texto}>${yLabel}</text></svg><//>
    <details class="notas"><summary>Cómo se lee el gráfico</summary><p class="muted">Puntos amarillos: otros jugadores de La Liga (sin sintéticos). Punto grande: ${playerLabel} (azul = izquierda, naranja = derecha, blanco = valor único). Líneas amarillas discontinuas: mediana de La Liga de cada eje${noCut ? ` (sin mediana: N = ${n} < ${minN})` : ` (N = ${n})`}. No hay zona neutra: un valor igual al corte cuenta como «por encima» y no se conoce el error de medida.</p></details>
    <ul>${mine.map((p, i) => { const q = quadrantSide(p, cutX, cutY); return html`<li key=${i}>${p.label}: ${q ? `${xLabel} ${q.xHigh ? 'por encima' : 'por debajo'} de la mediana · ${yLabel} ${q.yHigh ? 'por encima' : 'por debajo'} de la mediana` : 'sin cortes: faltan jugadores con dato'}</li>`; })}</ul>
  </div>`;
}

const Orient = ({ o }) => (!o ? '—' : o.text ? html`<span><strong>${o.text}</strong>${o.kneeNote ? html`<br /><span class="status warn">${o.kneeNote}</span>` : null}</span>` : html`<span class="muted">${o.reason}</span>`);

// DSI en las pantallas de Knee Iso-Push y SL CMJ; EUR en las de CMJ y Squat Jump (9/11/2026). Detalle y comparación, solo con el cursor.
const DSI_TESTS = ['run-specific knee iso-push', 'sl cmj'];
const EUR_TESTS = ['cmj', 'squat jump'];
export function RelacionTest({ player, test }) {
  const name = String(test.name ?? '').trim().toLowerCase();
  const isDsi = DSI_TESTS.includes(name), isEur = EUR_TESTS.includes(name);
  if (!isDsi && !isEur) return null;
  return html`<${RelacionTestCarga} player=${player} isDsi=${isDsi} />`;
}
function RelacionTestCarga({ player, isDsi }) {
  const { data, r, loc, pl } = useRatios(player);
  if (!data) return null;
  const m = r.mine;
  const q = componentQuadrants({ loc, sessions: data.sessions, anthropometry: data.anthropometry, players: pl, playerId: player.id, minN: data.minN });
  if (isDsi) {
    const sides = [['L', 'Izquierda', r.dsiL, r.kneeL], ['R', 'Derecha', r.dsiR, r.kneeR]];
    return html`<section class="refs"><h4>DSI (Dynamic Strength Index) y orientación de fuerza</h4>
      <details class="notas"><summary>Cómo se calcula y cómo se interpreta</summary>
        <p class="muted">SL CMJ «CONCENTRIC PEAK FORCE / BM» (N/kg ÷ ${nf(G, 5)}, en múltiplos del peso) ÷ Knee Iso-Push Peak Force relativo al peso corporal (BW, con la masa medida más cercana a cada sesión o, si no hay ninguna, el peso de referencia). Usa toda la historia del jugador (Personal Average de cada término). Sin unidad; orientativo. El percentil compara cada pierna con las dos piernas de todos los jugadores (un único P50 para ambas); el color indica la posición en La Liga, no «mejor/peor».</p>
        <p class="muted">Orientación según el percentil del DSI: 0–40 Ballistic strength training orientation · 40–60 Concurrent strength training · 60–100 Maximal strength training orientation. Los cortes son los del usuario, no umbrales de la bibliografía. En la banda 0–40 se avisa si el percentil de Knee Iso-Push Peak Force (BW) de ese lado está por debajo de 40, porque la orientación puede variar.</p></details>
      <div class="table-wrap"><table><thead><tr><th scope="col">Lado</th><th scope="col" class="num">DSI</th><th scope="col">Percentil</th><th scope="col">Orientación de fuerza</th></tr></thead><tbody>
        ${sides.map(([k, nm, ev, kev]) => { const d = m.dsi[k]; const det = d.defined ? `SL ${nf(d.slBW)} BW (${d.slSessions} ses.) ÷ Knee ${nf(d.kneeBW)} BW (${d.kneeSessions} ses.)${d.omittedKnee ? ` · ${d.omittedKnee} sesión(es) de Knee sin masa previa, omitidas` : ''}` : d.reason;
          return html`<tr key=${k}><th scope="row">${nm}</th><td class="num" title=${det}>${d.defined ? nf(d.value) : html`<span class="muted" title=${det}>—</span>`}</td><td><${Chip} ev=${ev} detail=${det} /></td><td><${Orient} o=${d.defined ? strengthOrientation('dsi', ev, [{ label: nm.toLowerCase(), ev: kev }]) : null} /></td></tr>`; })}
      </tbody></table></div>
      <${Cuadrante} titulo="DSI quadrant: isometric vs dynamic force" xLabel="Knee Iso-Push Peak Force (BW)" yLabel="SL CMJ Peak Force (BW)" bg=${q.dsi.bg} cutX=${q.dsi.cutX} cutY=${q.dsi.cutY} n=${q.dsi.n} minN=${data.minN} nombre="cuadrante-DSI" playerLabel=${playerLabel(player)}
        mine=${q.mine.dsi.map((p) => ({ x: p.x, y: p.y, label: p.side === 'L' ? 'Izquierda' : 'Derecha', short: p.side }))} />
    </section>`;
  }
  const e = m.eur;
  const det = e.defined ? `CMJ ${nf(e.cmjPA)} cm (Personal Average) ÷ SJ ${nf(e.sjPB)} cm (Personal Best)` : e.reason;
  return html`<section class="refs"><h4>EUR (Eccentric Utilization Ratio) y orientación de fuerza</h4>
    <details class="notas"><summary>Cómo se calcula y cómo se interpreta</summary>
      <p class="muted">CMJ Jump Height (JH imp-mom), Personal Average ÷ Squat Jump Jump Height (JH imp-mom), Personal Best. Dividir una media entre un mejor valor sesga el cociente a la baja y no es comparable con los valores de la bibliografía. El color del percentil indica la posición en La Liga, no «mejor/peor».</p>
      <p class="muted">Orientación según el percentil del EUR: 0–40 Plyometric strength training orientation · 40–60 Concurrent strength training · 60–100 Maximal strength training orientation. Los cortes son los del usuario, no umbrales de la bibliografía. En la banda 60–100 se avisa si el percentil de Knee Iso-Push Peak Force (BW) de alguna pierna está por debajo de 40, porque la orientación puede variar.</p></details>
    <div class="table-wrap"><table><thead><tr><th scope="col" class="num">EUR</th><th scope="col">Percentil</th><th scope="col">Orientación de fuerza</th></tr></thead><tbody>
      <tr><td class="num" title=${det}>${e.defined ? nf(e.value) : html`<span class="muted" title=${det}>—</span>`}</td><td><${Chip} ev=${r.eur} detail=${det} /></td>
        <td><${Orient} o=${e.defined ? strengthOrientation('eur', r.eur, [{ label: 'izquierda', ev: r.kneeL }, { label: 'derecha', ev: r.kneeR }]) : null} /></td></tr>
    </tbody></table></div>
    <${Cuadrante} titulo="EUR quadrant: Squat Jump vs CMJ" xLabel="Squat Jump JH imp-mom, Personal Best (cm)" yLabel="CMJ JH imp-mom, Personal Average (cm)" bg=${q.eur.bg} cutX=${q.eur.cutX} cutY=${q.eur.cutY} n=${q.eur.n} minN=${data.minN} nombre="cuadrante-EUR" playerLabel=${playerLabel(player)}
      mine=${q.mine.eur ? [{ x: q.mine.eur.x, y: q.mine.eur.y, label: playerLabel(player), short: '' }] : []} />
  </section>`;
}

// Ratios del Excel del usuario (9/11/2026): Personal Best ÷ Personal Best. Tobillo (inversión÷eversión, izquierda, derecha y asimetría) en las pantallas de inversión y eversión;
// cadera (aducción 0° ÷ abducción 0°, palanca larga, valor único) en las de aducción 0° y abducción 0°. Color de posición en La Liga (sin dirección «mejor/peor»).
const ANKLE_TESTS = ['supine isometric ankle inversion', 'supine isometric ankle eversion'];
const HIP_TESTS = ['hip adduction 0° (long lever)', 'hip abduction 0° (long lever)'];
export function RatioTest({ player, test }) {
  const name = String(test.name ?? '').trim().toLowerCase();
  const isAnkle = ANKLE_TESTS.includes(name), isHip = HIP_TESTS.includes(name);
  if (!isAnkle && !isHip) return null;
  return html`<${RatioTestCarga} player=${player} isAnkle=${isAnkle} />`;
}
function RatioTestCarga({ player, isAnkle }) {
  const { data, r } = useRatios(player);
  if (!data) return null;
  const m = r.mine;
  const det = (x) => (x.defined ? `Personal Best ${nf(x.num, 1)} N ÷ Personal Best ${nf(x.den, 1)} N` : x.reason);
  if (isAnkle) {
    const rows = [['L', 'Izquierda', m.ankle.L, r.ankleL], ['R', 'Derecha', m.ankle.R, r.ankleR]];
    return html`<section class="refs"><h4>Ratio inversión : eversión (tobillo)</h4>
      <details class="notas"><summary>Cómo se calcula</summary><p class="muted">Peak Force Personal Best de Supine Isometric Ankle Inversion ÷ Peak Force Personal Best de Supine Isometric Ankle Eversion, por lado (como en tu Excel, que usa el valor máximo). La asimetría es la del ratio izquierdo frente al derecho (positiva si domina la derecha, D25). El color indica la posición en La Liga (las dos piernas juntas), no «mejor/peor».</p></details>
      <div class="table-wrap"><table><thead><tr><th scope="col">Lado</th><th scope="col" class="num">Ratio</th><th scope="col">La Liga</th></tr></thead><tbody>
        ${rows.map(([k, nm, x, ev]) => html`<tr key=${k}><th scope="row">${nm}</th><td class="num" title=${det(x)}>${x.defined ? nf(x.value) : html`<span class="muted" title=${det(x)}>—</span>`}</td><td><${Chip} ev=${ev} detail=${det(x)} /></td></tr>`)}
        <tr><th scope="row">Asimetría</th><td class="num">${m.ankleAsym === null ? '—' : html`<${AsimTexto} pct=${m.ankleAsym} d=${1} />`}</td><td class="muted">—</td></tr>
      </tbody></table></div>
    </section>`;
  }
  const x = m.hip;
  return html`<section class="refs"><h4>Ratio aducción : abducción (cadera, palanca larga)</h4>
    <details class="notas"><summary>Cómo se calcula</summary><p class="muted">Peak Force Personal Best de Hip Adduction 0° (Long Lever) ÷ Peak Force Personal Best de Hip Abduction 0° (Long Lever), en N (como en tu Excel, que usa el valor máximo). Valor único. El color indica la posición en La Liga, no «mejor/peor».</p></details>
    <div class="table-wrap"><table><thead><tr><th scope="col" class="num">Ratio</th><th scope="col">La Liga</th></tr></thead><tbody>
      <tr><td class="num" title=${det(x)}>${x.defined ? nf(x.value) : html`<span class="muted" title=${det(x)}>—</span>`}</td><td><${Chip} ev=${r.hip} detail=${det(x)} /></td></tr>
    </tbody></table></div>
    ${x.defined ? null : html`<p class="muted">${x.reason}</p>`}
  </section>`;
}

// ORZ solo en las pantallas de DL Drop Jump 30 cm y 45 cm (9/11/2026).
const DJ_TESTS = ['dl drop jump 30 cm', 'dl drop jump 45 cm'];
export function OrzTest({ test, player }) {
  if (!DJ_TESTS.includes(String(test.name ?? '').trim().toLowerCase())) return null;
  return html`<${OrzCarga} player=${player} />`;
}
function OrzCarga({ player }) {
  const { data, r } = useRatios(player);
  if (!data) return null;
  const o = r.mine.orz;
  return html`<section class="refs"><h4>Optimal Reactive Zone (ORZ)</h4>
    <details class="notas"><summary>Cómo se calcula</summary><p class="muted">Altura del Drop Jump (30 o 45 cm) con mayor RSI (FLIGHT TIME / CONTACT TIME), Personal Average, con toda la historia del jugador. Hace falta al menos una sesión válida en cada altura. Empate exacto: sin ORZ.</p></details>
    ${o.hidden ? html`<p class="muted">Sin datos de ambas alturas: no se muestra la ORZ (hace falta al menos una sesión válida de 30 cm y otra de 45 cm).</p>` : o.defined
      ? html`<p class="fv-conclusion orz-conclusion" role="status"><span class="fv-conclusion-rot">Conclusión ORZ</span><strong>${o.height} cm</strong> <span class="muted">RSI Personal Average: 30 cm ${nf(o.pa30)} · 45 cm ${nf(o.pa45)}</span></p>` : html`<p>${o.reason} (30 cm ${nf(o.pa30)} · 45 cm ${nf(o.pa45)})</p>`}
  </section>`;
}
