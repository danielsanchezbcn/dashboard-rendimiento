// pages-isorack.js — «Configuración ISO-rack» (15/11/2026, pedido del usuario): a qué altura se configura el rack para cada iso-push y si el test
// se hace descalzo o con zapatillas. Es un registro PERMANENTE y editable, sin fecha y sin historial: lo que vale es lo último escrito.
// La altura del jugador no se escribe aquí: la pone el sistema con la medición de altura más reciente de su antropometría.
import { html, useState } from './libs.js';
import { useApp } from './context.js';
import { useLoad, Msg, useRunner } from './componentes.js';
import { playerLabel, baseName } from './jugadores.js';
import { fmtDay } from './fechas.js';
import { ISO_RACK_TESTS, CALZADO, listIsoRack, setIsoRack, alturaDe, vacio } from './isorack.js';

const nf = (n) => (n === null || n === undefined ? '—' : Number(n).toLocaleString('es-ES', { maximumFractionDigits: 1 }));

export function ConfiguracionIsoRack() {
  const { db, version } = useApp();
  const [tick, setTick] = useState(0);
  const { msg, run, busy } = useRunner();
  const { data, error } = useLoad(async () => {
    const [players, anthropometry, rack] = await Promise.all([db.players.toArray(), db.anthropometry.toArray(), listIsoRack(db)]);
    return { players, anthropometry, rack };
  }, [db, version, tick]);
  if (error) return html`<p class="status fail">${error}</p>`;
  if (!data) return html`<p>Cargando…</p>`;
  const { players, anthropometry, rack } = data;
  // Todos los jugadores por orden alfabético (los inactivos también, marcados: el rack no deja de estar configurado porque el jugador no esté activo).
  const lista = players.slice().sort((a, b) => baseName(a).localeCompare(baseName(b), 'es', { sensitivity: 'base', numeric: true }));
  const guardar = (playerId, key, patch) => run(async () => { await setIsoRack(db, playerId, key, patch); setTick((t) => t + 1); }, 'Guardado.')();

  // Lo que se está escribiendo se guarda en un borrador hasta salir de la casilla. Así, si se escribe la altura y se toca el desplegable sin salir
  // antes del campo, no se pierde el número: al guardar el calzado se manda también la altura que hay escrita.
  const [borrador, setBorrador] = useState({});
  const celda = (p, t) => {
    const r = (rack[p.id] ?? vacio(p.id))[t.key];
    const k = `${p.id}:${t.key}`;
    const altura = borrador[k] ?? r.altura;
    const soltar = () => setBorrador((b) => { const { [k]: _, ...resto } = b; return resto; });
    // La altura y el calzado van dentro de un contenedor flexible (16/11/2026): así se reparten el ancho de la columna y la tabla entera cabe en pantalla.
    return html`<td key=${t.key} class="rack-celda"><div class="rack-par">
      <label class="sr" for=${`alt-${p.id}-${t.key}`}>${t.label}: altura del rack para ${baseName(p)}</label>
      <input id=${`alt-${p.id}-${t.key}`} class="rack-altura" inputmode="decimal" placeholder="Altura" value=${altura}
        onInput=${(e) => setBorrador((b) => ({ ...b, [k]: e.target.value }))}
        onBlur=${() => { if (altura !== r.altura) { guardar(p.id, t.key, { altura }); } soltar(); }} />
      <label class="sr" for=${`cal-${p.id}-${t.key}`}>${t.label}: calzado para ${baseName(p)}</label>
      <select id=${`cal-${p.id}-${t.key}`} class="rack-calzado" value=${r.calzado} onChange=${(e) => { guardar(p.id, t.key, { altura, calzado: e.target.value }); soltar(); }}>
        ${CALZADO.map(([c, n]) => html`<option key=${c} value=${c}>${n}</option>`)}
      </select></div></td>`;
  };

  return html`<h2 class="page-title">Configuración ISO-rack</h2>
    <p class="muted">A qué altura se configura el rack para cada iso-push y si el test se hace descalzo o con zapatillas. Es un dato permanente, no una medición: no lleva fecha ni historial, y cada cambio sustituye a lo anterior. Se guarda solo al salir de la casilla.</p>
    <p class="muted">La altura del rack se escribe tal cual la uses (un número de agujero, centímetros…): el dashboard no le supone ninguna unidad ni la usa en ningún cálculo. La altura del jugador la pone el sistema con su medición de altura más reciente, que se edita en la ficha del jugador.</p>
    <${Msg} msg=${msg} />
    ${lista.length === 0 ? html`<p class="muted">Todavía no hay jugadores.</p>` : html`<div class="table-wrap"><table class="isorack">
      <thead><tr><th scope="col">Jugador</th><th scope="col">Altura del jugador</th>${ISO_RACK_TESTS.map((t) => html`<th scope="col" key=${t.key}>${t.label}</th>`)}</tr></thead>
      <tbody>${lista.map((p) => {
        const alt = alturaDe(anthropometry, p.id);
        return html`<tr key=${p.id}>
          <th scope="row"><a href=${`#jugador-${p.id}`}>${playerLabel(p)}</a>${p.active === false ? html` <span class="muted">(inactivo)</span>` : null}</th>
          <td class="rack-altura-jugador" title=${alt ? `Medición del ${fmtDay(alt.date)}` : 'Sin medición de altura en su antropometría'}>${alt ? `${nf(alt.value)}${alt.unit ? ' ' + alt.unit : ''}` : html`<span class="muted">—</span>`}</td>
          ${ISO_RACK_TESTS.map((t) => celda(p, t))}</tr>`;
      })}</tbody></table></div>`}
    ${busy ? html`<p class="muted">Guardando…</p>` : null}`;
}
