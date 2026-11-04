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
