// pages-dsieur.js — «DSI y EUR · todos los jugadores» (16/11/2026, pedido del usuario): un jugador por fila, con el DSI de cada pierna, el EUR,
// su percentil de La Liga y la orientación de fuerza. Los números salen de `dsiEurTodos`, que usa las mismas funciones que la ficha del jugador.
import { html } from './libs.js';
import { useApp } from './context.js';
import { Card, Desplegable, useLoad } from './componentes.js';
import { listCatalog } from './catalogo.js';
import { getSetting } from './db.js';
import { MIN_N_DEFAULT } from './percentiles.js';
import { locate, withReferenceWeights } from './relaciones.js';
import { dsiEurTodos, ORDENES, ordenar } from './dsieur.js';
import { buildHash, replaceQuery } from './rutas.js';
import { playerLabel } from './jugadores.js';
import { Migas } from './pages-test.js';
import { BANDS } from './percentiles.js';
import { buildCsv } from './exportar.js';
import { downloadBlob } from './io.js';

const nf = (n, d = 2) => (n === null || n === undefined ? '—' : Number(n).toLocaleString('es-ES', { maximumFractionDigits: d }));

// Mismo chip de percentil que en la ficha: el color indica la POSICIÓN en La Liga, no «mejor/peor» (DSI y EUR no tienen dirección de rendimiento).
const Chip = ({ ev }) => {
  if (!ev) return html`<span class="muted">—</span>`;
  if (!ev.sufficient || ev.percentileStat === null) return html`<span class="muted" title=${ev.reason ?? ''}>N = ${ev.n}</span>`;
  const b = BANDS[ev.band];
  const tip = `Percentil ${nf(ev.percentileStat, 0)} de ${ev.n} valores de La Liga (mediana ${nf(ev.p50)}). El color indica la posición, no «mejor/peor».`;
  return html`<span class=${'band band-' + b.key} title=${tip} aria-label=${tip}>${nf(ev.percentileStat, 0)}</span>`;
};

const Celda = ({ d }) => html`<div class="dsieur-celda">
  <span class="dsieur-val">${d.defined ? nf(d.value) : html`<span class="muted" title=${d.razon ?? ''}>—</span>`}</span>
  <${Chip} ev=${d.ev} />
  ${d.orientacion?.text ? html`<small class="dsieur-ori" title=${d.orientacion.kneeNote ?? ''}>${d.orientacion.text}</small>` : html`<small class="dsieur-ori muted">${d.orientacion?.reason ?? (d.defined ? '' : d.razon ?? '')}</small>`}
</div>`;

export function DsiEurTodos({ query = {} }) {
  const { db, version } = useApp();
  const { data, error } = useLoad(async () => {
    const cat = await listCatalog(db);
    const [sessions, anthropometry, players, mn] = await Promise.all([db.sessions.toArray(), db.anthropometry.toArray(), db.players.toArray(), getSetting(db, 'percentileMinN')]);
    const minN = Number.isInteger(mn) && mn >= 1 ? mn : MIN_N_DEFAULT;
    const porId = Object.fromEntries(players.map((p) => [p.id, p]));
    const loc = locate(cat.tests, cat.variables);
    const r = dsiEurTodos({ loc, sessions: sessions.filter((s) => s.status !== 'excluded'), anthropometry: withReferenceWeights(anthropometry, players), players: porId, minN });
    return { ...r, minN, porId };
  }, [db, version]);
  if (error) return html`<p class="status fail">${error}</p>`;
  if (!data) return html`<p>Calculando DSI y EUR de todos los jugadores…</p>`;
  const orden = ORDENES.some(([k]) => k === query.o) ? query.o : 'jugador';
  const origen = query.j ? Number(query.j) : null;
  const nombre = (f) => playerLabel(f.player);
  const filas = ordenar(data.filas, orden, nombre);
  const crumbs = [{ label: 'Players', href: '#jugadores' },
    ...(origen && data.porId[origen] ? [{ label: playerLabel(data.porId[origen]), href: buildHash(`jugador-${origen}`, { b: 'fuerza' }) }] : []),
    { label: 'DSI y EUR · todos los jugadores' }];
  const exportCsv = () => {
    const header = ['Jugador', 'DSI izquierda', 'Percentil DSI izquierda', 'Orientación izquierda', 'DSI derecha', 'Percentil DSI derecha', 'Orientación derecha', 'EUR', 'Percentil EUR', 'Orientación EUR'];
    const pct = (ev) => (ev?.sufficient ? ev.percentileStat ?? '' : '');
    const rows = filas.map((f) => [nombre(f),
      f.dsi.L.defined ? f.dsi.L.value : '', pct(f.dsi.L.ev), f.dsi.L.orientacion?.text ?? '',
      f.dsi.R.defined ? f.dsi.R.value : '', pct(f.dsi.R.ev), f.dsi.R.orientacion?.text ?? '',
      f.eur.defined ? f.eur.value : '', pct(f.eur.ev), f.eur.orientacion?.text ?? '']);
    downloadBlob(new Blob([buildCsv(header, rows)], { type: 'text/csv;charset=utf-8' }), `dsi_eur_todos_${orden}.csv`);
  };
  const conDsi = filas.filter((f) => f.dsi.L.defined || f.dsi.R.defined).length;
  const conEur = filas.filter((f) => f.eur.defined).length;
  return html`<${Card} titulo="DSI y EUR · todos los jugadores">
    <${Migas} items=${crumbs} />
    <p class="muted">El DSI y el EUR de toda la plantilla, con el percentil de La Liga y la orientación de fuerza. Son los mismos números y las mismas etiquetas que aparecen en la ficha de cada jugador: usan toda la historia (Personal Average de cada término) y no dependen de ninguna base elegida. El color del percentil indica la posición en La Liga, no «mejor o peor»: ni el DSI ni el EUR tienen dirección de rendimiento.</p>
    <div class="filters">
      <label>Ordenar por <select value=${orden} onChange=${(e) => replaceQuery('dsi-eur', { ...query, o: e.target.value })}>${ORDENES.map(([k, n]) => html`<option key=${k} value=${k}>${n}</option>`)}</select></label>
    </div>
    <p>${filas.length} jugador(es) · ${conDsi} con DSI · ${conEur} con EUR. <button type="button" class="secondary" disabled=${!filas.length} onClick=${exportCsv}>Exportar CSV</button></p>
    ${!filas.length ? html`<p class="muted">No hay jugadores con datos.</p>` : html`<div class="table-wrap"><table class="dsieur">
      <thead><tr><th scope="col">Jugador</th><th scope="col">DSI izquierda</th><th scope="col">DSI derecha</th><th scope="col">EUR</th></tr></thead>
      <tbody>${filas.map((f) => html`<tr key=${f.playerId}>
        <th scope="row"><a href=${buildHash(`jugador-${f.playerId}`, { b: 'fuerza' })}>${nombre(f)}</a></th>
        <td><${Celda} d=${f.dsi.L} /></td>
        <td><${Celda} d=${f.dsi.R} /></td>
        <td><${Celda} d=${f.eur} /></td></tr>`)}</tbody>
    </table></div>`}
    <${Desplegable} titulo="Cómo se calculan">
      <p class="muted">DSI = SL CMJ Peak Force (BW) ÷ Knee Iso-Push Peak Force (BW), una pierna contra la misma pierna. EUR = CMJ (JH imp-mom, Personal Average) ÷ Squat Jump (JH imp-mom, Personal Best). El percentil compara con La Liga sin datos sintéticos y sin el propio jugador, con un mínimo de ${data.minN} jugadores; en el DSI las dos piernas de todos los jugadores forman una única referencia, así que el mismo valor da el mismo percentil en las dos piernas.</p>
      <p class="muted">La orientación de fuerza sale de la misma regla que en la ficha y en el COMPOSITE: con el Knee Iso-Push de esa pierna en el percentil 0–35 de La Liga, la orientación del DSI es siempre «Iso maximal strength training orientation», sea cual sea el ratio.</p>
    <//>
  <//>`;
}
