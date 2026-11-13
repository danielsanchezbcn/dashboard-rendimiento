import { html, useState } from './libs.js';
import { useApp } from './context.js';
import { Card, Msg, Sintetico, useLoad, useRunner } from './componentes.js';
import { getSetting, setSetting, clearSetting } from './db.js';
import { listPositions, createPosition, renamePosition, setPositionActive, movePosition, deletePosition, positionUsage } from './posiciones.js';
import { loadSyntheticDemo, deleteSynthetic, countSynthetic, totalOf } from './sinteticos.js';
import { CUALIDADES, UMBRALES_DEFAULT, pesosDe } from './composite.js';

// ---------- Posiciones: lista definida por el usuario con orden configurable (D9) ----------

function PositionRow({ p, first, last, used }) {
  const { db, bump } = useApp();
  const [edit, setEdit] = useState(false);
  const [name, setName] = useState(p.name);
  const { msg, run, busy } = useRunner();
  const act = (fn) => run(async () => { await fn(); bump(); });
  return html`<tr class=${p.active ? '' : 'inactive'}>
    <td>${edit
      ? html`<input type="text" aria-label="Nombre de la posición" value=${name} onInput=${(e) => setName(e.target.value)} />`
      : html`${p.name} ${p.synthetic ? html`<${Sintetico} />` : null} ${p.active ? null : html`<span class="badge">ARCHIVADA</span>`}`}
      <${Msg} msg=${msg} /></td>
    <td class="num">${used}</td>
    <td class="acts">
      <button type="button" class="secondary" aria-label=${`Subir ${p.name}`} disabled=${first || busy} onClick=${act(() => movePosition(db, p.id, 'up'))}>↑</button>
      <button type="button" class="secondary" aria-label=${`Bajar ${p.name}`} disabled=${last || busy} onClick=${act(() => movePosition(db, p.id, 'down'))}>↓</button>
      ${edit
        ? html`<button type="button" disabled=${busy} onClick=${act(async () => { await renamePosition(db, p.id, name); setEdit(false); })}>Guardar</button><button type="button" class="secondary" onClick=${() => { setEdit(false); setName(p.name); }}>Cancelar</button>`
        : html`<button type="button" class="secondary" onClick=${() => setEdit(true)}>Renombrar</button>`}
      <button type="button" class="secondary" disabled=${busy} onClick=${act(() => setPositionActive(db, p.id, !p.active))}>${p.active ? 'Archivar' : 'Activar'}</button>
      <button type="button" class="secondary" disabled=${busy || used > 0} title=${used > 0 ? 'La usan registros del historial: archívala' : ''} onClick=${act(async () => { if (confirm(`¿Eliminar la posición «${p.name}»?`)) await deletePosition(db, p.id); })}>Eliminar</button>
    </td></tr>`;
}

export function PosicionesCard() {
  const { db, version, bump } = useApp();
  const [name, setName] = useState('');
  const { msg, run, busy } = useRunner();
  const { data } = useLoad(async () => {
    const list = await listPositions(db);
    const usage = {};
    for (const p of list) usage[p.id] = await positionUsage(db, p.id);
    return { list, usage };
  }, [db, version]);
  if (!data) return html`<${Card} titulo="Posiciones"><p>Cargando…</p><//>`;
  return html`
    <${Card} titulo="Posiciones" id="posiciones">
      <p>Lista definida por ti; no se precarga ninguna. <strong>El orden es el que configures</strong> con las flechas: las posiciones nuevas se añaden al final y no hay un orden definitivo. Una posición usada en algún historial no se elimina: se archiva.</p>
      ${data.list.length === 0 ? html`<p class="muted">Todavía no hay posiciones.</p>` : html`<div class="table-wrap"><table>
        <thead><tr><th scope="col">Posición (por orden)</th><th scope="col" class="num">Registros que la usan</th><th scope="col"><span class="sr">Acciones</span></th></tr></thead>
        <tbody>${data.list.map((p, i) => html`<${PositionRow} key=${p.id} p=${p} first=${i === 0} last=${i === data.list.length - 1} used=${data.usage[p.id]} />`)}</tbody></table></div>`}
      <form class="fields" onSubmit=${run(async () => { await createPosition(db, { name }); setName(''); bump(); }, 'posición creada al final de la lista.')}>
        <label>Nueva posición <input type="text" required value=${name} onInput=${(e) => setName(e.target.value)} /></label>
        <div class="actions"><button type="submit" disabled=${busy}>Añadir posición</button></div>
      </form>
      <${Msg} msg=${msg} />
    <//>`;
}

// ---------- Ventana antropométrica ----------

// ---------- Muestra mínima para percentiles (D52) ----------

export function PercentilCard() {
  const { db, version, bump } = useApp();
  const [input, setInput] = useState(null);
  const { msg, setMsg } = useRunner();
  const { data: saved } = useLoad(async () => (await getSetting(db, 'percentileMinN')) ?? null, [db, version]);
  const cur = Number.isInteger(saved) && saved >= 1 ? saved : 10;
  const shown = input ?? String(cur);
  const save = async (e) => {
    e.preventDefault();
    const n = Number(shown);
    if (!Number.isInteger(n) || n < 1 || n > 1000) return setMsg({ level: 'fail', text: 'Introduce un número entero de jugadores entre 1 y 1000.' });
    await setSetting(db, 'percentileMinN', n);
    setInput(null);
    setMsg({ level: 'ok', text: `mínimo de ${n} jugadores guardado.` });
    bump();
  };
  return html`
    <${Card} titulo="Muestra mínima para percentiles">
      <p>Número mínimo de jugadores en la referencia de «La Liga» para mostrar un percentil como clasificación y colorearlo. Con menos jugadores se muestra «muestra insuficiente» con el N, sin color. Ahora: <strong>${cur}</strong> (10 por decisión del usuario). Un N pequeño da percentiles poco estables.</p>
      <form class="fields" onSubmit=${save}>
        <label>Jugadores <input type="number" min="1" max="1000" value=${shown} onInput=${(e) => setInput(e.target.value)} /></label>
        <div class="actions"><button type="submit">Guardar</button></div>
      </form>
      <${Msg} msg=${msg} />
    <//>`;
}

// ---------- Datos sintéticos ----------

export function SinteticosCard() {
  const { db, version, bump } = useApp();
  const { msg, run, busy } = useRunner();
  const { data } = useLoad(() => countSynthetic(db), [db, version]);
  const total = data ? totalOf(data) : 0;
  return html`
    <${Card} titulo="Datos sintéticos de demostración" id="sinteticos">
      <p>Datos ficticios para probar la aplicación. Se identifican con la etiqueta <${Sintetico} /> y se eliminan todos juntos con un botón. <strong>No representan jugadores, posiciones ni mediciones reales.</strong> Incluyen las posiciones «Posición sintética 1» y «2» y los jugadores A a F del conjunto de aceptación de <code>REQUISITOS.md</code>, además de una pareja con y sin ñ para probar la propuesta de candidatos.</p>
      ${data ? html`<p class=${'status ' + (total ? 'warn' : '')}>${total ? `Hay ${total} registros sintéticos: ${data.players} jugadores, ${data.playerAliases} alias, ${data.positions} posiciones, ${data.playerPositions} registros de posición y ${data.anthropometry} mediciones.` : 'No hay datos sintéticos cargados.'}</p>` : null}
      <div class="actions">
        <button type="button" disabled=${busy || total > 0} onClick=${run(async () => { const r = await loadSyntheticDemo(db); bump(); return r; }, (r) => `${r.counts.players} jugadores sintéticos cargados (lote ${r.batch}).`)}>Cargar datos sintéticos</button>
        <button type="button" class="danger" disabled=${busy || total === 0} onClick=${run(async () => {
          if (!confirm(`Se eliminarán TODOS los datos sintéticos (${total} registros: jugadores, alias, posiciones sintéticas, historial y mediciones sintéticas). Los datos reales no se tocan. ¿Continuar?`)) throw new Error('Eliminación cancelada: no se ha borrado nada.');
          const r = await deleteSynthetic(db);
          bump();
          return r;
        }, (r) => `${totalOf(r)} registros sintéticos eliminados.`)}>Eliminar todos los datos sintéticos</button>
      </div>
      <p class="muted">Si restauras una copia hecha mientras había datos sintéticos, volverán a aparecer. Si algún dato real depende de uno sintético (por ejemplo, un jugador real con una posición sintética), no se elimina nada hasta que lo reasignes.</p>
      <${Msg} msg=${msg} />
    <//>`;
}

// ---------- COMPOSITE PROFILE SCORE: pesos de cada cualidad y umbrales de las reglas (13/11/2026, especificación v0.3 §3.10) ----------

export function CompositeCard() {
  const { db, version, bump } = useApp();
  const [borrador, setBorrador] = useState(null);
  const { msg, setMsg } = useRunner();
  const { data: cfg } = useLoad(async () => (await getSetting(db, 'compositeConfig')) ?? {}, [db, version]);
  if (!cfg) return null;
  const umbrales = { ...UMBRALES_DEFAULT, ...(cfg.umbrales ?? {}) };
  const pesos = cfg.pesos ?? {};
  const d = borrador ?? { pesos: Object.fromEntries(CUALIDADES.map((c) => [c.id, pesosDe(c, pesos).map((p) => String(Math.round(p * 1000) / 10))])), umbrales: Object.fromEntries(Object.entries(umbrales).map(([k, v]) => [k, String(v)])) };
  const set = (patch) => setBorrador({ ...d, ...patch });
  const setPeso = (id, i, val) => set({ pesos: { ...d.pesos, [id]: d.pesos[id].map((x, k) => (k === i ? val : x)) } });
  const guardar = async (e) => {
    e.preventDefault();
    const out = { pesos: {}, umbrales: {} };
    for (const c of CUALIDADES) {
      const vals = d.pesos[c.id].map((x) => Number(String(x).replace(',', '.')));
      if (vals.some((v) => !Number.isFinite(v) || v < 0)) return setMsg({ level: 'fail', text: `Los pesos de ${c.nombre} tienen que ser números de 0 en adelante.` });
      if (!(vals.reduce((a, b) => a + b, 0) > 0)) return setMsg({ level: 'fail', text: `${c.nombre} no puede tener todos los pesos a cero.` });
      out.pesos[c.id] = vals.map((v) => v / 100);
    }
    for (const k of Object.keys(UMBRALES_DEFAULT)) {
      const v = Number(d.umbrales[k]);
      if (!Number.isFinite(v) || v < 0 || v > 100) return setMsg({ level: 'fail', text: 'Los umbrales son percentiles entre 0 y 100.' });
      out.umbrales[k] = v;
    }
    await setSetting(db, 'compositeConfig', out);
    setBorrador(null); setMsg({ level: 'ok', text: 'Pesos y umbrales guardados.' }); bump();
  };
  const volver = async () => { await clearSetting(db, 'compositeConfig'); setBorrador(null); setMsg({ level: 'ok', text: 'Se han restaurado los pesos y umbrales del documento.' }); bump(); };
  return html`<${Card} titulo="COMPOSITE PROFILE SCORE">
    <p>Pesos de las variables de puntuación de cada cualidad (en %, sobre el total de la cualidad: si no suman 100 se reparten en proporción) y umbrales de las reglas de «No aplicable». Los valores de partida son los de la especificación.</p>
    <form class="fields" onSubmit=${guardar}>
      ${CUALIDADES.map((c) => html`<fieldset key=${c.id}><legend>${c.nombre}</legend>
        ${c.scores.map((s, i) => html`<label key=${i}>${s.orz ? 'Drop Jump (ORZ) · ' : s.test + ' · '}${s.variable}${s.rel ? '/BM' : ''} <input type="number" min="0" max="100" step="0.1" value=${d.pesos[c.id][i]} onInput=${(e) => setPeso(c.id, i, e.target.value)} /></label>`)}
      </fieldset>`)}
      <fieldset><legend>Umbrales de las reglas (percentil)</legend>
        <label>Jump height mínimo (p35) <input type="number" min="0" max="100" value=${d.umbrales.p35} onInput=${(e) => set({ umbrales: { ...d.umbrales, p35: e.target.value } })} /></label>
        <label>Depth y contraction time mínimos (p10) <input type="number" min="0" max="100" value=${d.umbrales.p10} onInput=${(e) => set({ umbrales: { ...d.umbrales, p10: e.target.value } })} /></label>
        <label>Knee Iso-Push máximo para el DSI (p65) <input type="number" min="0" max="100" value=${d.umbrales.p65} onInput=${(e) => set({ umbrales: { ...d.umbrales, p65: e.target.value } })} /></label>
      </fieldset>
      <div class="actions"><button type="submit">Guardar</button> <button type="button" class="secondary" onClick=${volver}>Volver a los valores del documento</button></div>
    </form>
    <${Msg} msg=${msg} />
  <//>`;
}
