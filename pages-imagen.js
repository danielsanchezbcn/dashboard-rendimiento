// pages-imagen.js — importación de una IMAGEN de antropometría (tabla con nombre, dorsal, peso y altura): OCR local + revisión obligatoria fila a fila.
// Guarda: peso → peso de referencia del jugador; altura → medición fechada. Jugadores que no existen se crean (alias = nombre de la imagen).

import { html, useState } from './libs.js';
import { useApp } from './context.js';
import { Card, Msg, useRunner } from './componentes.js';
import { leerTablaImagen } from './imagen-ocr.js';
import { construirFilas, proponerJugador, guardarFilas, RANGO_PESO, RANGO_ALTURA } from './imagen-antropometria.js';
import { playerLabel } from './jugadores.js';
import { todayIso, fmtDay } from './fechas.js';
import { getSetting } from './db.js';
import { useLoad } from './componentes.js';
import { MIN_N_DEFAULT, evaluate } from './percentiles.js';
import { massNearest, withReferenceWeights } from './relaciones.js';
import { Banda } from './pages-percentiles.js';
const nf = (n, d = 1) => (n === null || n === undefined ? '—' : Number(n).toLocaleString('es-ES', { maximumFractionDigits: d }));

const leerArchivo = (f) => new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = () => no(new Error('No se pudo leer el archivo.')); r.readAsDataURL(f); });
const abrir = (u) => new Promise((ok, no) => { const im = new Image(); im.onload = () => ok(im); im.onerror = () => no(new Error('No se pudo abrir la imagen.')); im.src = u; });
// Recorte de la fila original (para comparar a ojo con lo leído).
function recorte(im, y, h) {
  const alto = Math.min(46, Math.max(14, h * 1.5)), y0 = Math.max(0, Math.round(y - alto / 2)), hh = Math.min(im.height - y0, Math.round(alto));
  const k = Math.min(2, 900 / im.width); const c = document.createElement('canvas'); c.width = Math.round(im.width * k); c.height = Math.max(1, Math.round(hh * k));
  c.getContext('2d').drawImage(im, 0, y0, im.width, hh, 0, 0, c.width, c.height);
  return c.toDataURL('image/png');
}
const num = (s) => Number(String(s ?? '').replace(',', '.'));

export function ImportarImagen() {
  const { db, bump } = useApp();
  const { msg, setMsg, busy, run } = useRunner();
  const [imagen, setImagen] = useState(null);
  const [progreso, setProgreso] = useState('');
  const [filas, setFilas] = useState(null);
  const [omitidas, setOmitidas] = useState(0);
  const [fecha, setFecha] = useState(todayIso());
  const [gPeso, setGPeso] = useState(true);
  const [gAltura, setGAltura] = useState(true);
  const [ack, setAck] = useState(false);
  const [res, setRes] = useState(null);

  const onFile = async (e) => {
    const f = e.target.files?.[0]; if (!f) return;
    setMsg(null); setFilas(null); setRes(null); setAck(false);
    if (!/^image\//.test(f.type)) { setMsg({ level: 'fail', text: 'El archivo no es una imagen (PNG, JPG…).' }); return; }
    setImagen({ nombre: f.name, url: await leerArchivo(f) });
  };

  const leer = run(async () => {
    setProgreso('Preparando…');
    const lectura = await leerTablaImagen(imagen.url, setProgreso);
    const { filas: fs, omitidas: om } = construirFilas(lectura);
    const im = await abrir(imagen.url);
    const players = await db.players.toArray(); const heights = new Map();
    for (const r of await db.anthropometry.toArray()) if (r.height && (!heights.get(r.playerId) || r.date > heights.get(r.playerId).date)) heights.set(r.playerId, r);
    const out = [];
    for (const f of fs) {
      const prop = f.nombre ? await proponerJugador(db, f.nombre) : { candidates: [], accion: { tipo: 'nuevo' } };
      out.push({ ...f, incluir: true, peso: f.peso == null ? '' : String(f.peso).replace('.', ','), altura: f.altura == null ? '' : String(f.altura), candidatos: prop.candidates, sel: prop.accion.tipo === 'vincular' ? 'link:' + prop.accion.playerId : 'new', img: recorte(im, f.y, f.h) });
    }
    setFilas(out); setOmitidas(om); setProgreso('');
    return out.length;
  }, (n) => `${n} filas leídas. Revísalas contra la imagen antes de guardar.`);

  const cambia = (id, patch) => setFilas((fs) => fs.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  const actual = (f) => {
    if (!f.sel.startsWith('link:')) return null;
    const c = f.candidatos.find((x) => 'link:' + x.player.id === f.sel); if (!c) return null;
    const rw = c.player.referenceWeight; return rw ? `peso de referencia actual: ${nf(rw.value, 1)} ${rw.unit}` : 'sin peso de referencia';
  };

  const guardar = run(async () => {
    const sel = filas.filter((f) => f.incluir && f.sel !== 'skip');
    const errores = [];
    for (const f of sel) {
      const etiqueta = f.nombre || `fila ${f.id + 1}`;
      if (f.sel === 'new' && !f.nombre.trim()) errores.push(`${etiqueta}: escribe el nombre del jugador nuevo.`);
      if (gPeso && f.peso !== '' && !(num(f.peso) >= 30 && num(f.peso) <= 200)) errores.push(`${etiqueta}: el peso debe ser un número entre 30 y 200 kg.`);
      if (gAltura && f.altura !== '' && !(num(f.altura) >= 100 && num(f.altura) <= 230)) errores.push(`${etiqueta}: la altura debe ser un número entre 100 y 230 cm.`);
      if (f.peso === '' && f.altura === '') errores.push(`${etiqueta}: no tiene peso ni altura.`);
    }
    if (errores.length) throw new Error(errores.join(' '));
    const r = await guardarFilas(db, filas.map((f) => ({ ...f, accion: !f.incluir || f.sel === 'skip' ? { tipo: 'omitir' } : f.sel === 'new' ? { tipo: 'nuevo' } : { tipo: 'vincular', playerId: Number(f.sel.slice(5)) } })), { fecha, guardarPeso: gPeso, guardarAltura: gAltura });
    setRes(r); setFilas(null); setImagen(null); bump();
  });

  return html`
    <${Card} titulo="Importar una imagen de antropometría">
      <p>Imagen (PNG, JPG…) de una tabla con <strong>nombre, dorsal, peso y altura</strong>. La lectura se hace <strong>en tu navegador</strong> (no se envía nada) y es solo una <strong>propuesta</strong>: ves la fila original junto a lo leído y confirmas antes de guardar.
      El <strong>peso</strong> se guarda como <strong>peso de referencia</strong> del jugador (se usa en las medidas relativas solo si no tiene masa medida) y la <strong>altura</strong> como medición fechada. Los jugadores que no existan se crean con ese nombre como alias.</p>
      <label class="fields"><span class="muted">Imagen</span><input type="file" accept="image/*" onChange=${onFile} disabled=${busy} /></label>
      ${imagen && !filas ? html`<div class="img-prev"><img src=${imagen.url} alt=${`Imagen cargada: ${imagen.nombre}`} /></div>
        <div class="actions"><button type="button" disabled=${busy} onClick=${leer}>${busy ? (progreso || 'Leyendo…') : 'Leer la imagen'}</button></div>` : null}
      <${Msg} msg=${msg} />
      ${res ? html`<div class="status ok" role="status"><p><strong>Importación terminada.</strong> Jugadores nuevos: ${res.jugadoresNuevos} · pesos de referencia guardados: ${res.pesosGuardados} (${res.pesosCambiados} sustituyen a uno distinto) · alturas guardadas: ${res.alturasGuardadas}${res.alturasIgualesOmitidas ? ` (${res.alturasIgualesOmitidas} ya existían con el mismo valor y fecha)` : ''} · filas no importadas: ${res.omitidas}.</p></div>` : null}
    <//>
    ${filas ? html`<${Card} titulo="Revisión (obligatoria)">
      <p>${filas.length} filas con peso o altura. ${omitidas ? html`Se han omitido <strong>${omitidas}</strong> filas sin ningún valor (por ejemplo dorsales sin datos). ` : null}Cada fila muestra el recorte de la imagen original: <strong>comprueba nombre, peso y altura</strong>. Los avisos señalan lo que el lector dudó; <strong>un valor sin aviso también puede estar mal leído</strong>.</p>
      <div class="fields">
        <label>Fecha de la medición (altura) <input type="date" value=${fecha} max=${todayIso()} onInput=${(e) => setFecha(e.target.value)} /></label>
        <label class="check"><input type="checkbox" checked=${gPeso} onChange=${(e) => setGPeso(e.target.checked)} /> Guardar el peso como peso de referencia</label>
        <label class="check"><input type="checkbox" checked=${gAltura} onChange=${(e) => setGAltura(e.target.checked)} /> Guardar la altura (${fmtDay(fecha)})</label>
      </div>
      <div class="table-wrap"><table class="img-filas"><caption>Filas leídas de la imagen (${RANGO_PESO[0]}–${RANGO_PESO[1]} kg y ${RANGO_ALTURA[0]}–${RANGO_ALTURA[1]} cm se consideran plausibles; fuera de ahí se deja el campo vacío)</caption>
        <thead><tr><th scope="col">Importar</th><th scope="col">Imagen original</th><th scope="col">Nombre leído</th><th scope="col">Jugador</th><th scope="col">Peso (kg)</th><th scope="col">Altura (cm)</th><th scope="col">Avisos</th></tr></thead>
        <tbody>${filas.map((f) => html`<tr key=${f.id} class=${f.avisos.length ? 'hdr' : ''}>
          <td><input type="checkbox" aria-label=${`Importar la fila ${f.id + 1}`} checked=${f.incluir} onChange=${(e) => cambia(f.id, { incluir: e.target.checked })} /></td>
          <td><img class="img-fila" src=${f.img} alt=${`Fila original: ${f.nombre}`} /></td>
          <td><input type="text" value=${f.nombre} aria-label="Nombre" onInput=${(e) => cambia(f.id, { nombre: e.target.value })} />${f.dorsal != null ? html`<div class="muted">dorsal ${f.dorsal}</div>` : null}</td>
          <td><select aria-label="Jugador" value=${f.sel} onChange=${(e) => cambia(f.id, { sel: e.target.value })}>
            ${f.candidatos.map((c) => html`<option key=${c.player.id} value=${'link:' + c.player.id}>Vincular a ${playerLabel(c.player)} · parecido ${c.level}</option>`)}
            <option value="new">Crear jugador nuevo${f.nombre ? ` «${f.nombre}»` : ''}</option><option value="skip">No importar esta fila</option></select>
            ${actual(f) ? html`<div class="muted">${actual(f)}</div>` : null}</td>
          <td><input type="text" inputmode="decimal" size="6" aria-label="Peso en kg" value=${f.peso} onInput=${(e) => cambia(f.id, { peso: e.target.value })} /></td>
          <td><input type="text" inputmode="numeric" size="5" aria-label="Altura en cm" value=${f.altura} onInput=${(e) => cambia(f.id, { altura: e.target.value })} /></td>
          <td class=${f.avisos.length ? 'avisos status warn' : 'avisos'}>${f.avisos.join('. ')}</td></tr>`)}</tbody></table></div>
      ${filas.filter((f) => f.incluir && f.sel === 'new').length ? html`<p class="banner warn" role="status">Se crearán <strong>${filas.filter((f) => f.incluir && f.sel === 'new').length}</strong> jugadores nuevos. Si alguno ya existe en tu base, elígelo en la columna «Jugador» para no duplicarlo.</p>` : null}
      <label class="check"><input type="checkbox" checked=${ack} onChange=${(e) => setAck(e.target.checked)} /> He comparado cada fila con la imagen original</label>
      <div class="actions"><button type="button" disabled=${busy || !ack} onClick=${guardar}>Guardar lo confirmado</button> <button type="button" class="secondary" disabled=${busy} onClick=${() => { setFilas(null); setAck(false); }}>Descartar</button></div>
    <//>` : null}`;
}

// Percentil (color de posición: ni «más alto» ni «más bajo» es mejor) de peso y altura frente a los demás jugadores de la base (sin sintéticos).
// Peso = masa medida más cercana a hoy o, si no hay, el peso de referencia. Altura = última medición en cm.
export function AntropPercentiles({ player }) {
  const { db, version } = useApp();
  const { data } = useLoad(async () => {
    const [players, an, mn] = await Promise.all([db.players.toArray(), db.anthropometry.toArray(), getSetting(db, 'percentileMinN')]);
    const all = withReferenceWeights(an, players); const hoy = todayIso();
    const pesos = [], alturas = [];
    for (const p of players.filter((x) => !x.synthetic)) {
      const m = massNearest(all.filter((r) => r.playerId === p.id), hoy); if (m) pesos.push({ playerId: p.id, value: m.kg, ref: m.reference });
      const h = an.filter((r) => r.playerId === p.id && r.height && ['cm', 'm'].includes(String(r.height.unit).toLowerCase())).sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id)[0];
      if (h) alturas.push({ playerId: p.id, value: String(h.height.unit).toLowerCase() === 'm' ? h.height.value * 100 : h.height.value, date: h.date });
    }
    return { pesos, alturas, minN: Number.isInteger(mn) && mn >= 1 ? mn : MIN_N_DEFAULT };
  }, [db, version]);
  if (!data) return null;
  const fila = (nombre, entries, unidad, nota) => {
    const mine = entries.find((e) => e.playerId === player.id);
    if (!mine) return html`<tr><th scope="row">${nombre}</th><td colspan="2" class="muted">Sin dato de este jugador.</td></tr>`;
    const ev = evaluate(entries, { playerId: player.id, value: mine.value, direction: null, minN: data.minN });
    return html`<tr><th scope="row">${nombre}</th><td class="num">${nf(mine.value, 1)} ${unidad}${nota ? html` <span class="muted">(${nota(mine)})</span>` : null}</td>
      <td>${ev.sufficient && ev.percentileStat != null ? html`<${Banda} ev=${ev} /> <span class="muted" title=${`Mediana de la base ${nf(ev.p50, 1)} ${unidad}`}>(N = ${ev.n})</span>` : html`<span class="muted">${ev.reason}</span>`}</td></tr>`;
  };
  return html`<h3>Percentil de peso y altura</h3>
    <div class="table-wrap"><table><thead><tr><th scope="col">Medida</th><th scope="col" class="num">Valor</th><th scope="col">La Liga</th></tr></thead><tbody>
      ${fila('Peso', data.pesos, 'kg', (m) => (m.ref ? 'peso de referencia' : 'masa medida'))}${fila('Altura', data.alturas, 'cm', (m) => fmtDay(m.date))}</tbody></table></div>
    <p class="muted">Percentil con color de posición (ni más alto ni más bajo es «mejor»): un valor por jugador de la base, sin sintéticos ni este jugador; mínimo ${data.minN} jugadores (Configuración).</p>`;
}
