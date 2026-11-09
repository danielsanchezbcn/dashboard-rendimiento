// imagen-ocr.js — lectura (OCR) de una imagen de antropometría, TODO en el navegador (nada sale del equipo; connect-src 'none' no se toca).
// Motor: Tesseract.js 5.1.1 (Apache-2.0) con los ficheros locales ocr-tesseract.js, ocr-worker.js, ocr-core.js (núcleo wasm con SIMD) y eng.traineddata.gz.
// Dos pasadas: (A) la imagen entera (nombres, dorsales y cifras) y (B) tiras solo con las columnas de peso y de altura con lista de caracteres permitidos
// (más fiable en cifras). La lectura NUNCA se guarda sola: la pantalla de revisión obliga a comprobar cada fila contra la imagen.

const abs = (f) => new URL(f, document.baseURI).href;
const ESCALA = 3;

function cargar(dataUrl) {
  return new Promise((ok, no) => { const im = new Image(); im.onload = () => ok(im); im.onerror = () => no(new Error('No se pudo abrir la imagen.')); im.src = dataUrl; });
}
// Gris + escala ×3; con «contraste» se estira el histograma y se aplica gamma 1,8 (mejora las cifras de fuentes condensadas).
function preparar(im, { x0 = 0, x1 = im.width, y0 = 0, contraste = false } = {}) {
  const w = Math.max(1, Math.round(x1 - x0)), h = Math.max(1, im.height - y0);
  const c = document.createElement('canvas'); c.width = w * ESCALA; c.height = h * ESCALA;
  const g = c.getContext('2d', { willReadFrequently: true }); g.imageSmoothingQuality = 'high';
  g.drawImage(im, x0, y0, w, h, 0, 0, c.width, c.height);
  const d = g.getImageData(0, 0, c.width, c.height); const p = d.data;
  let lo = 255, hi = 0; const gris = new Uint8Array(p.length / 4);
  for (let i = 0, k = 0; i < p.length; i += 4, k++) { const v = Math.round(0.299 * p[i] + 0.587 * p[i + 1] + 0.114 * p[i + 2]); gris[k] = v; if (v < lo) lo = v; if (v > hi) hi = v; }
  const span = Math.max(1, hi - lo);
  for (let i = 0, k = 0; i < p.length; i += 4, k++) {
    let v = gris[k];
    if (contraste) v = Math.round(255 * ((v - lo) / span) ** 1.8);
    p[i] = p[i + 1] = p[i + 2] = v; p[i + 3] = 255;
  }
  g.putImageData(d, 0, 0);
  return c;
}

export async function leerTablaImagen(dataUrl, onProgress = () => {}) {
  const mod = await import('./ocr-tesseract.js'); const createWorker = mod.createWorker ?? mod.default?.createWorker;
  const im = await cargar(dataUrl);
  let fase = 'Cargando el motor de lectura…';
  const worker = await createWorker('eng', 1, {
    workerPath: abs('ocr-worker.js'), corePath: abs('ocr-core.js'), langPath: abs('./'), workerBlobURL: false, cacheMethod: 'none',
    logger: (m) => { if (m.status === 'recognizing text') onProgress(`${fase} ${Math.round(m.progress * 100)} %`); else onProgress(fase); },
  });
  try {
    fase = 'Leyendo la tabla (1/3)…';
    await worker.setParameters({ tessedit_pageseg_mode: '6' });
    const a = await worker.recognize(preparar(im));
    const lineasA = (a.data.lines ?? []).map((l) => ({ text: l.text.trim(), y: (l.bbox.y0 + l.bbox.y1) / 2 / ESCALA, h: (l.bbox.y1 - l.bbox.y0) / ESCALA, words: (l.words ?? []).map((w) => ({ text: w.text, x0: w.bbox.x0 / ESCALA, x1: w.bbox.x1 / ESCALA })) })).filter((l) => l.text);
    // Columnas de peso (…kg) y de altura (…cm) a partir de las palabras de la primera pasada.
    const caja = (re) => { const ws = lineasA.flatMap((l) => l.words).filter((w) => re.test(w.text)); return ws.length >= 3 ? { x0: Math.min(...ws.map((w) => w.x0)), x1: Math.max(...ws.map((w) => w.x1)) } : null; };
    const colP = caja(/kg|kq|k9/i), colA = caja(/cm|em|cn/i);
    const tira = async (col, wl, etiqueta) => {
      if (!col) return [];
      fase = etiqueta; await worker.setParameters({ tessedit_pageseg_mode: '6', tessedit_char_whitelist: wl });
      const pad = Math.max(8, (col.x1 - col.x0) * 0.35); const x0 = Math.max(0, col.x0 - pad), x1 = Math.min(im.width, col.x1 + pad);
      const r = await worker.recognize(preparar(im, { x0, x1, contraste: true }));
      return (r.data.lines ?? []).map((l) => ({ text: l.text.trim(), y: (l.bbox.y0 + l.bbox.y1) / 2 / ESCALA })).filter((l) => l.text);
    };
    const lineasP = await tira(colP, '0123456789.,kg', 'Leyendo la columna de peso (2/3)…');
    const lineasH = await tira(colA, '0123456789cm', 'Leyendo la columna de altura (3/3)…');
    return { lineasA, lineasP, lineasH, ancho: im.width, alto: im.height };
  } finally { await worker.terminate(); }
}
