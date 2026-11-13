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
export const SelectorVariable = ({ vars, value, onChange, etiqueta = 'Variable', id = undefined }) => html`<div class="sel-variable">
  <label>${etiqueta} <select id=${id} value=${String(value)} onChange=${(e) => onChange(e.target.value)}>
    ${vars.map((v) => html`<option key=${v.id} value=${String(v.id)}>${v.label}</option>`)}
  </select></label></div>`;
