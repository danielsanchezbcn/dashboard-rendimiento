// pages-relaciones.js — fase 6: DSI, EUR y ORZ en la ficha del jugador (orientativos; toda la historia siempre).
import { html } from './libs.js';
import { useApp } from './context.js';
import { Card, useLoad } from './componentes.js';
import { getSetting } from './db.js';
import { listCatalog } from './catalogo.js';
import { MIN_N_DEFAULT } from './percentiles.js';
import { locate, ratioReferences, G, withReferenceWeights } from './relaciones.js';

const nf = (n, d = 2) => (n === null || n === undefined ? '—' : Number(n).toLocaleString('es-ES', { maximumFractionDigits: d }));

function Pct({ ev }) {
  if (!ev) return null;
  if (!ev.sufficient) return html`<span class="muted">Muestra insuficiente (N = ${ev.n}, mínimo ${ev.minN}).</span>`;
  return html`<span>percentil <strong>${nf(ev.percentileStat, 0)}</strong> de ${ev.n} jugadores (mediana ${nf(ev.p50)}); sin color: no hay dirección «mejor/peor» definida</span>`;
}

export function RelacionesPanel({ player }) {
  const { db, version } = useApp();
  const { data } = useLoad(async () => {
    const cat = await listCatalog(db);
    const [sessions, anthropometry, players, minN] = await Promise.all([db.sessions.toArray(), db.anthropometry.toArray(), db.players.toArray(), getSetting(db, 'percentileMinN')]);
    return { cat, sessions: sessions.filter((s) => s.status !== 'excluded'), anthropometry: withReferenceWeights(anthropometry, players), players, minN: Number.isInteger(minN) && minN >= 1 ? minN : MIN_N_DEFAULT };
  }, [db, version, player.id]);
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
    <//>`;
}
