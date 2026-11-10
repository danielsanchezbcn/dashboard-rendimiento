// copiar.js — «Copiar imagen» para cualquier gráfico (canvas de Chart.js o SVG). Al hacer clic sobre el gráfico aparece un menú
// con «Copiar imagen» y «Descargar PNG». Todo ocurre en el navegador; el portapapeles exige HTTPS (la página publicada lo es) o localhost.
import { html, useState, useRef, useEffect } from './libs.js';
import { downloadBlob } from './io.js';

const PROPS = ['fill', 'stroke', 'stroke-width', 'stroke-dasharray', 'font-size', 'font-weight', 'font-family', 'text-anchor', 'opacity', 'fill-opacity', 'stroke-opacity', 'dominant-baseline'];

function fondoDe(el) {
  for (let n = el; n; n = n.parentElement) { const c = getComputedStyle(n).backgroundColor; if (c && c !== 'transparent' && !/rgba\(.*,\s*0\)$/.test(c)) return c; }
  return '#ffffff';
}

function svgToCanvas(svg, bg) {
  const vb = svg.viewBox?.baseVal; const w0 = vb?.width || svg.clientWidth || 800, h0 = vb?.height || svg.clientHeight || 400;
  const k = 2; const clone = svg.cloneNode(true);
  const src = [svg, ...svg.querySelectorAll('*')], dst = [clone, ...clone.querySelectorAll('*')];
  src.forEach((s, i) => { const cs = getComputedStyle(s); for (const p of PROPS) { const v = cs.getPropertyValue(p); if (v) dst[i].setAttribute(p, v); } dst[i].removeAttribute('style'); });
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg'); clone.setAttribute('width', String(w0 * k)); clone.setAttribute('height', String(h0 * k));
  const xml = new XMLSerializer().serializeToString(clone);
  return new Promise((ok, no) => {
    const img = new Image();
    img.onload = () => { const c = document.createElement('canvas'); c.width = w0 * k; c.height = h0 * k; const g = c.getContext('2d'); g.fillStyle = bg; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height); ok(c); };
    img.onerror = () => no(new Error('No se pudo crear la imagen del gráfico.'));
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(xml);
  });
}

export async function chartToBlob(box) {
  const canvas = box.querySelector('canvas'), svg = box.querySelector('svg');
  const bg = fondoDe(canvas ?? svg ?? box);
  let c;
  if (canvas) { c = document.createElement('canvas'); c.width = canvas.width; c.height = canvas.height; const g = c.getContext('2d'); g.fillStyle = bg; g.fillRect(0, 0, c.width, c.height); g.drawImage(canvas, 0, 0); }
  else if (svg) c = await svgToCanvas(svg, bg);
  else throw new Error('No hay ningún gráfico que copiar.');
  return new Promise((ok, no) => c.toBlob((b) => (b ? ok(b) : no(new Error('No se pudo generar el PNG.'))), 'image/png'));
}

export function Copiable({ children, nombre = 'grafico', omitir = null }) {
  const box = useRef(null);
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState('');
  useEffect(() => {
    if (!open) return undefined;
    const off = (e) => { if (e.type === 'keydown' ? e.key === 'Escape' : !box.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('keydown', off); document.addEventListener('pointerdown', off);
    return () => { document.removeEventListener('keydown', off); document.removeEventListener('pointerdown', off); };
  }, [open]);
  const copy = async () => {
    setOpen(false);
    try {
      if (!window.ClipboardItem || !navigator.clipboard?.write) throw new Error('sin-portapapeles');
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': chartToBlob(box.current) })]);
      setMsg('Imagen copiada al portapapeles.');
    } catch (e) {
      try { downloadBlob(await chartToBlob(box.current), `${nombre}.png`.replace(/[^\w.-]+/g, '_')); setMsg('Este navegador no permite copiar al portapapeles aquí: se ha descargado la imagen (PNG).'); }
      catch (e2) { setMsg(`No se pudo copiar la imagen: ${e2.message}`); }
    }
  };
  const download = async () => { setOpen(false); try { downloadBlob(await chartToBlob(box.current), `${nombre}.png`.replace(/[^\w.-]+/g, '_')); setMsg('Imagen descargada (PNG).'); } catch (e) { setMsg(`No se pudo descargar: ${e.message}`); } };
  return html`<div class="copiable" ref=${box} onClick=${(e) => { if (omitir?.(e)) return; if (!e.target.closest?.('.copiable-menu')) setOpen(true); }} onKeyDown=${(e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target === box.current) { e.preventDefault(); setOpen((v) => !v); } }} tabindex="0" role="group" aria-label="Gráfico: pulsa para copiar la imagen">
    ${children}
    ${open ? html`<div class="copiable-menu" role="menu"><button type="button" role="menuitem" onClick=${copy}>Copiar imagen</button><button type="button" role="menuitem" class="secondary" onClick=${download}>Descargar PNG</button></div>` : null}
    ${msg ? html`<p class="muted copiable-msg" role="status">${msg}</p>` : null}
  </div>`;
}
