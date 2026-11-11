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

// ---- Tabla HTML -> PNG: se dibuja lo que se ve (fondos, bordes y texto palabra a palabra) sobre un canvas, sin SVG ni foreignObject (compatible con la CSP y sin «taint»).
const alfa = (c) => { if (!c || c === 'transparent') return 0; const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return 1; const p = m[1].split(/[ ,/]+/).filter(Boolean); return p.length > 3 ? Number(p[3]) : 1; };
function rr(g, x, y, w, h, r) { g.beginPath(); if (r > 0 && g.roundRect) g.roundRect(x, y, w, h, Math.min(r, h / 2, w / 2)); else g.rect(x, y, w, h); }
export function domToBlob(el, titulo = '', escala = 2) {
  const box = el.getBoundingClientRect(), bg = fondoDe(el), k = escala, cab = titulo ? 34 : 0, pad = 12;
  const c = document.createElement('canvas'); c.width = Math.ceil((box.width + pad * 2) * k); c.height = Math.ceil((box.height + cab + pad * 2) * k);
  const g = c.getContext('2d'); g.scale(k, k); g.fillStyle = bg; g.fillRect(0, 0, c.width, c.height);
  const ox = pad - box.left, oy = pad + cab - box.top;
  if (titulo) { const cs = getComputedStyle(el); g.fillStyle = cs.color; g.font = `600 15px ${cs.fontFamily}`; g.textBaseline = 'middle'; g.fillText(titulo, pad, pad + 12); }
  const tw = document.createTreeWalker(el, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
  for (let n = tw.currentNode; n; n = tw.nextNode()) {
    if (n.nodeType === 1) {
      const cs = getComputedStyle(n); if (cs.display === 'none' || cs.visibility === 'hidden' || n.classList.contains('sr')) { continue; }
      const r = n.getBoundingClientRect(); if (r.width === 0 || r.height === 0) continue;
      const x = r.left + ox, y = r.top + oy;
      if (alfa(cs.backgroundColor) > 0) { g.fillStyle = cs.backgroundColor; rr(g, x, y, r.width, r.height, parseFloat(cs.borderTopLeftRadius) || 0); g.fill(); }
      for (const [side, x1, y1, x2, y2] of [['Top', x, y, x + r.width, y], ['Bottom', x, y + r.height, x + r.width, y + r.height], ['Left', x, y, x, y + r.height], ['Right', x + r.width, y, x + r.width, y + r.height]]) {
        const w = parseFloat(cs[`border${side}Width`]); if (w > 0 && cs[`border${side}Style`] !== 'none' && alfa(cs[`border${side}Color`]) > 0) { g.strokeStyle = cs[`border${side}Color`]; g.lineWidth = w; g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); }
      }
    } else {
      const p = n.parentElement; if (!p || !n.nodeValue.trim() || p.closest('.sr')) continue;
      const cs = getComputedStyle(p); if (cs.display === 'none' || cs.visibility === 'hidden') continue;
      g.fillStyle = cs.color; g.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`; g.textBaseline = 'middle';
      const up = cs.textTransform === 'uppercase', txt = n.nodeValue; const re = /\S+/g; let m; const rg = document.createRange();
      while ((m = re.exec(txt))) {
        rg.setStart(n, m.index); rg.setEnd(n, m.index + m[0].length); const rc = rg.getClientRects()[0]; if (!rc) continue;
        g.fillText(up ? m[0].toUpperCase() : m[0], rc.left + ox, rc.top + oy + rc.height / 2);
      }
    }
  }
  return new Promise((ok, no) => c.toBlob((b) => (b ? ok(b) : no(new Error('No se pudo generar el PNG.'))), 'image/png'));
}

// Botones «Copiar imagen» / «Descargar PNG» para un elemento HTML (p. ej. la tabla de Normative Benchmarking).
export function BotonesImagen({ obtener, nombre = 'imagen', titulo = '' }) {
  const [msg, setMsg] = useState('');
  const arch = `${nombre}.png`.replace(/[^\w.-]+/g, '_');
  const copiar = async () => {
    try {
      if (!window.ClipboardItem || !navigator.clipboard?.write) throw new Error('sin-portapapeles');
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': domToBlob(obtener(), titulo) })]); setMsg('Imagen copiada al portapapeles.');
    } catch (e) {
      try { downloadBlob(await domToBlob(obtener(), titulo), arch); setMsg('Este navegador no permite copiar al portapapeles aquí: se ha descargado la imagen (PNG).'); } catch (e2) { setMsg(`No se pudo copiar la imagen: ${e2.message}`); }
    }
  };
  const bajar = async () => { try { downloadBlob(await domToBlob(obtener(), titulo), arch); setMsg('Imagen descargada (PNG).'); } catch (e) { setMsg(`No se pudo descargar la imagen: ${e.message}`); } };
  return html`<div class="img-botones"><button type="button" class="secondary" onClick=${copiar}>Copiar imagen</button> <button type="button" class="secondary" onClick=${bajar}>Descargar PNG</button>${msg ? html` <span class="muted" role="status">${msg}</span>` : null}</div>`;
}
