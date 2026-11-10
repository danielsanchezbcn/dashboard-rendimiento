// pages-angulos.js — «Medir ángulos» (NME): la herramienta de medición por fotografía (angulos.html) dentro del dashboard, con guardado en el jugador.
// La herramienta va en un marco del mismo origen, sin red; las fotos no salen del navegador ni se guardan. Solo se guardan los ángulos.
import { html, useState, useEffect, useRef } from './libs.js';
import { useApp } from './context.js';
import { Card, Msg, useLoad, useRunner } from './componentes.js';
import { todayIso } from './fechas.js';
import { listCatalog } from './catalogo.js';
import { playerLabel, baseName } from './jugadores.js';
import { mapearAngulos, guardarAngulos, hayDestino } from './angulos-mapa.js';
import { dn } from './nombres.js';

export const EnlaceAngulos = () => html`<${Card} titulo="Medir ángulos">
  <p>Mide el Jurdan Test a partir de dos fotografías y guarda los resultados en el jugador, sin pasar por el Excel.</p>
  <p><a class="button" href="#nme-angulos">Abrir «Medir ángulos»</a></p><//>`;

// jugadorId: dentro de la ficha de un jugador (Jurdan Test) el jugador ya está elegido.
export function Angulos({ jugadorId = null }) {
  const { db, version, bump } = useApp();
  const marco = useRef(null);
  const { data } = useLoad(async () => ({ catalog: await listCatalog(db), players: (await db.players.toArray()).filter((p) => p.active).sort((a, b) => baseName(a).localeCompare(baseName(b), 'es')) }), [db, version]);
  const [playerId, setPlayerId] = useState(jugadorId ? String(jugadorId) : '');
  const [date, setDate] = useState(todayIso());
  const [time, setTime] = useState('');
  const [medida, setMedida] = useState(null); // último mensaje de la herramienta
  const { msg, busy, run } = useRunner();
  useEffect(() => {
    const onMsg = (e) => {
      if (e.origin !== location.origin || e.source !== marco.current?.contentWindow || e.data?.type !== 'gfc-angulos') return;
      setMedida({ test: e.data.test, results: e.data.results ?? {}, photos: e.data.photos ?? {} });
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, []);
  if (!data) return html`${jugadorId ? null : html`<h2 class="page-title">Medir ángulos</h2>`}<p>Cargando…</p>`;
  const map = medida && hayDestino(medida.test) ? mapearAngulos(medida.test, medida.results, data.catalog) : null;
  const sinDestino = medida && !hayDestino(medida.test);
  const completo = !!map && !map.error && map.faltan.length === 0;
  const fmt = (x) => (x === null || x === undefined ? '—' : `${String(x).replace('.', ',')}${'°'}`);
  const guardar = run(async () => {
    if (!playerId) throw new Error('Elige el jugador.');
    const r = await guardarAngulos(db, { playerId: Number(playerId), testKey: medida.test, results: medida.results, date, time, catalog: data.catalog });
    bump();
    marco.current?.contentWindow?.postMessage({ type: 'gfc-angulos-reiniciar' }, location.origin); // listo para el siguiente jugador
    return r;
  }, 'medidas guardadas en el jugador. La herramienta queda lista para el siguiente.');
  const jug = data.players.find((p) => p.id === Number(playerId));
  return html`${jugadorId ? null : html`<p><a href="#nme">← NME</a></p>
    <h2 class="page-title">Medir ángulos</h2>`}
    <${Card} titulo="Guardar en el jugador">
      <form class="filters" onSubmit=${guardar} aria-label="Guardar medidas">
        ${jugadorId ? html`<p><strong>${jug ? playerLabel(jug) : ''}</strong></p>` : html`<label>Jugador <select value=${playerId} onChange=${(e) => setPlayerId(e.target.value)} required><option value="">Elige…</option>${data.players.map((p) => html`<option key=${p.id} value=${p.id}>${playerLabel(p)}</option>`)}</select></label>`}
        <label>Fecha <input type="date" value=${date} onInput=${(e) => setDate(e.target.value)} required /></label>
        <label>Hora (opcional) <input type="time" value=${time} onInput=${(e) => setTime(e.target.value)} /></label>
        <button type="submit" disabled=${busy || !completo || !playerId}>Guardar en ${jug ? playerLabel(jug) : 'el jugador'}</button>
      </form>
      ${sinDestino ? html`<p class="status warn">Este test de la herramienta todavía no tiene destino en el catálogo: puedes medir, pero no guardar. Cómo añadirlo: ver ANGULOS.md.</p>` : null}
      ${map?.error ? html`<p class="status fail">${map.error}</p>` : null}
      ${map && !map.error ? html`<div class="table-wrap"><table><caption>${dn(map.test.name)}: lo que se guardará (${completo ? 'completo' : `faltan ${map.faltan.length} medidas: carga y revisa las dos fotos`})</caption>
        <thead><tr><th scope="col">Variable</th><th scope="col" class="num">Izquierda</th><th scope="col" class="num">Derecha</th></tr></thead>
        <tbody>${map.filas.map((f) => html`<tr key=${f.variable}><th scope="row">${f.variable}</th><td class="num">${fmt(f.L)}</td><td class="num">${fmt(f.R)}</td></tr>`)}</tbody></table></div>` : null}
      <${Msg} msg=${msg} />
      <details class="notas"><summary>Cómo funciona</summary>
        <p class="muted">Carga la foto 1 y la foto 2, comprueba (y arrastra si hace falta) los puntos y elige el jugador. Las fotos no se guardan ni salen de tu navegador: solo se guardan los ángulos, en grados con un decimal. JURDAN RESULTS se calcula igual que en tu Excel (izquierda = Hams izq − Psoas der; derecha = Hams der − Psoas izq). No se sobrescribe nada: si ya hay una sesión de ese jugador, fecha y hora, se avisa. La detección automática de puntos solo funciona si se han añadido los archivos de MediaPipe (ver ANGULOS.md); si no, los puntos se colocan a mano.</p>
      </details>
    <//>
    <iframe ref=${marco} class="angulos-marco" src="angulos.html" title="Herramienta de medición de ángulos"></iframe>`;
}
