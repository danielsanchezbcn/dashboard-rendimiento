// componentes.js — piezas de interfaz compartidas por las páginas.
import { html, useState, useEffect } from './libs.js';

export const Msg = ({ msg }) =>
  msg ? html`<p class=${'status ' + msg.level} role="status">${msg.level === 'ok' ? 'Correcto: ' : msg.level === 'fail' ? 'Error: ' : ''}${msg.text}</p>` : null;

export const Card = ({ titulo, children, id }) => html`<section class="card" id=${id}><h2>${titulo}</h2>${children}</section>`;

export const Sintetico = () => html`<span class="badge sint" title="Dato sintético de demostración, no real">SINTÉTICO</span>`;

// Carga asíncrona: mantiene los datos anteriores mientras recarga (los formularios no se desmontan).
export function useLoad(fn, deps) {
  const [state, setState] = useState({ data: null, error: null });
  useEffect(() => {
    let alive = true;
    fn().then((data) => alive && setState({ data, error: null })).catch((e) => alive && setState({ data: null, error: e?.message || String(e) }));
    return () => { alive = false; };
  }, deps);
  return state;
}

// Ejecuta una acción mostrando errores en un mensaje.
export function useRunner() {
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const run = (fn, okText) => async (e) => {
    e?.preventDefault?.();
    setBusy(true);
    try {
      const r = await fn();
      setMsg(okText ? { level: 'ok', text: typeof okText === 'function' ? okText(r) : okText } : null);
      return r;
    } catch (err) {
      setMsg({ level: 'fail', text: err?.message || String(err) });
    } finally {
      setBusy(false);
    }
  };
  return { msg, setMsg, busy, run };
}

// Texto explicativo desplegable (como «Notas y método de los percentiles»): los textos largos no se muestran enteros, se abren a demanda.
export const Desplegable = ({ titulo, children }) => html`<details class="notas"><summary>${titulo}</summary>${children}</details>`;

// Filtros de referencias en cuatro filas fijas (13/11/2026, pedido por el usuario): 1) medidas del jugador (Latest, PA, PB…), 2) La Liga,
// 3) Premier League, 4) Natera. Solo agrupa y ordena: cada página sigue decidiendo sus etiquetas y qué filtro está disponible.
const FILAS_FILTROS = [
  ['last', 'pa', 'pb', 'first'],
  ['p50', 'p50pos', 'p75', 'p75pos'],
  ['premier50', 'premier75'],
  ['natNormal', 'natGood', 'natExcellent'],
];
const ALIAS_FILTRO = { natN: 'natNormal', natG: 'natGood', natE: 'natExcellent' };
// Clave de fila de un filtro: «paL»/«paR» son la misma medida (Personal Average) en dos lados, y «natN» es el nombre corto de «natNormal».
export function claveFiltro(k) {
  const s = String(k ?? '');
  if (ALIAS_FILTRO[s]) return ALIAS_FILTRO[s];
  const m = /^(pa|pb|last|first)([LRS])$/.exec(s);
  return m ? m[1] : s;
}
// Reparte los filtros en sus filas y devuelve solo las filas con contenido. Entre claves de la misma fila mantiene el orden de la lista
// original, así que los lados izquierdo y derecho de una misma medida quedan juntos. Una clave desconocida va a una última fila: nunca desaparece.
export function agruparFiltros(items, keyOf = (x) => x.key) {
  const pos = (k) => {
    const c = claveFiltro(k);
    for (let i = 0; i < FILAS_FILTROS.length; i++) { const j = FILAS_FILTROS[i].indexOf(c); if (j >= 0) return [i, j]; }
    return [FILAS_FILTROS.length, 0];
  };
  const filas = Array.from({ length: FILAS_FILTROS.length + 1 }, () => []);
  items.forEach((it, i) => { const [f, r] = pos(keyOf(it)); filas[f].push({ it, r, i }); });
  return filas.map((f) => f.sort((a, b) => a.r - b.r || a.i - b.i).map((x) => x.it)).filter((f) => f.length);
}

// Selector de variable bajo el título de un apartado (13/11/2026, pedido por el usuario): con el foco puesto, las flechas recorren
// las variables una tras otra sin tener que subir a «Normative Benchmarking». `vars` son objetos {id, label}.
// Al cambiar de variable cambia la altura de lo que hay encima (la escala tiene una fila o dos, la nota aparece o no…) y la página «saltaba»:
// el gráfico quedaba cada vez en un sitio distinto de la pantalla. Se devuelve el selector al mismo punto en el que estaba, hasta que todo
// termina de dibujarse; si mientras tanto el usuario mueve la pantalla a mano, se deja de corregir para no pelearse con él.
export const SelectorVariable = ({ vars, value, onChange, etiqueta = 'Variable', id = undefined, ancla = 'variable' }) => {
  // El apartado se localiza por su marca («data-ancla»), no por una referencia al nodo: al cambiar de variable se vuelve a crear, y una
  // referencia al nodo viejo no sirve para medir dónde ha quedado el nuevo.
  const nodo = () => (typeof document === 'undefined' ? null : document.querySelector(`[data-ancla="${ancla}"]`));
  const cambia = (v) => {
    const antes = nodo()?.getBoundingClientRect().top ?? null;
    onChange(v);
    if (antes === null || typeof window === 'undefined' || !window.requestAnimationFrame) return;
    let vivo = true;
    const parar = () => { vivo = false; };
    const eventos = ['wheel', 'touchstart'];
    eventos.forEach((e) => window.addEventListener(e, parar, { passive: true }));
    const ajusta = () => { const el = vivo ? nodo() : null; if (!el) return; const d = el.getBoundingClientRect().top - antes; if (Math.abs(d) > 1) window.scrollBy(0, d); };
    requestAnimationFrame(() => { ajusta(); requestAnimationFrame(ajusta); });
    const t1 = setTimeout(ajusta, 120);
    const t2 = setTimeout(() => { ajusta(); eventos.forEach((e) => window.removeEventListener(e, parar)); }, 400);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  };
  return html`<div class="sel-variable" data-ancla=${ancla}>
    <label>${etiqueta} <select id=${id} value=${String(value)} onChange=${(e) => cambia(e.target.value)}>
      ${vars.map((v) => html`<option key=${v.id} value=${String(v.id)}>${v.label}</option>`)}
    </select></label></div>`;
};
