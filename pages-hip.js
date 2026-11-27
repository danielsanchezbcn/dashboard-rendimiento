// pages-hip.js — Importar → «Exploración de cadera (Excel)»: lee el libro del usuario (cabecera de tres filas combinadas), vincula los nombres con
// los jugadores y guarda UNA valoración por jugador en el test «Hip» de NME. El fichero no trae fecha: se elige una para toda la importación.
// Nada se corrige por nuestra cuenta: las celdas que no son un valor válido de la escala (0 a 3, solo enteros) se enseñan con su motivo y NO se importan.
import { html, useState } from './libs.js';
import { useApp } from './context.js';
import { Card, Desplegable, Msg, useLoad, useRunner } from './componentes.js';
import { readFileGrid } from './excel.js';
import { listCatalog } from './catalogo.js';
import { todayIso, isIsoDay, fmtDay } from './fechas.js';
import { playerLabel } from './jugadores.js';
import { proposeLinks } from './cargas-excel.js';
import { parseHipSheet, resumenFila, testHip, commitHip } from './hip-excel.js';
import { GRADOS_ROM, HIP_TEST } from './hip.js';

export function ImportarHip() {
  const { db, version, bump } = useApp();
  const { data } = useLoad(async () => ({ cat: await listCatalog(db), players: (await db.players.toArray()).sort((a, b) => playerLabel(a).localeCompare(playerLabel(b), 'es')) }), [db, version]);
  const { msg, setMsg, busy, run } = useRunner();
  const [hojas, setHojas] = useState(null); // [{ name, parsed, links, on }]
  const [fecha, setFecha] = useState(todayIso());
  const [elegido, setElegido] = useState({}); // `${hoja}|${nombre}` → id de jugador ('' = omitir)
  const [notas, setNotas] = useState({}); // `${hoja}|${nombre}` → anotación de esa valoración
  const [res, setRes] = useState(null);
  const hip = data ? testHip(data.cat) : null;

  const onFile = (ev) => { const f = ev.target.files?.[0] ?? null; return run(async () => {
    setRes(null); setElegido({}); setNotas({}); setHojas(null); setMsg(null);
    if (!f) return;
    const grid = await readFileGrid(f);
    const lista = [];
    for (const s of grid.sheets) {
      const parsed = parseHipSheet(s.rows);
      const links = parsed.ok ? await proposeLinks(db, parsed.filas.filter((r) => !r.vacia).map((r) => r.name)) : {};
      lista.push({ name: s.name, parsed, links, on: parsed.ok && parsed.filas.some((r) => !r.vacia) });
    }
    setHojas(lista);
    if (!lista.some((h) => h.parsed.ok)) throw new Error('Ninguna hoja tiene la cabecera de la exploración de cadera («IMPIGMENT», «HIP INTERNAL ROTATION»…).');
  })(); };
  const setHoja = (name, patch) => setHojas(hojas.map((h) => (h.name === name ? { ...h, ...patch } : h)));
  const clave = (h, r) => `${h.name}|${r.name}`;
  const playerFor = (h, r) => { const k = clave(h, r); return k in elegido ? (elegido[k] === '' ? null : Number(elegido[k])) : h.links[r.name]?.autoId ?? null; };
  const activas = (hojas ?? []).filter((h) => h.on && h.parsed.ok);
  const total = activas.reduce((n, h) => n + h.parsed.filas.filter((r) => !r.vacia && playerFor(h, r)).length, 0);
  const celdasMal = activas.reduce((n, h) => n + h.parsed.filas.reduce((m, r) => m + r.incidencias.length, 0), 0);
  const listo = activas.length > 0 && isIsoDay(fecha) && total > 0 && !!hip;
  const importar = run(async () => {
    const out = { creadas: 0, duplicadas: 0, omitidas: 0, alias: 0, incidencias: [] };
    for (const h of activas) {
      const r = await commitHip(db, { catalog: data.cat, date: fecha, items: h.parsed.filas.filter((row) => !row.vacia).map((row) => ({
        name: row.name, valores: row.valores, playerId: playerFor(h, row), nota: notas[clave(h, row)] ?? '',
        remember: clave(h, row) in elegido && elegido[clave(h, row)] !== '',
      })) });
      for (const k of ['creadas', 'duplicadas', 'omitidas', 'alias']) out[k] += r[k];
      out.incidencias.push(...r.incidencias.map((x) => `${h.name}: ${x}`));
    }
    setRes(out); bump();
  }, 'Importación terminada.');

  return html`<${Card} titulo="Exploración de cadera desde Excel">
    <${Desplegable} titulo="Formato del Excel de cadera">
      <p class="muted">Sube el libro con los jugadores en la primera columna y la cabecera de tres filas: «IMPIGMENT», «HIP INTERNAL ROTATION» y «HIP EXTERNAL ROTATION» con sus «SUPINE POSITION» / «PRONE POSITION», «HIP FLEXION» y «BENT KNEE OVER», y debajo «LEFT» / «RIGHT» en cada pareja. El Bent Knee Over es un único valor, sin lado.</p>
      <p class="muted">Impingement: «+» es positivo y «✓» es negativo. El resto de columnas son el déficit de rango articular, de ${GRADOS_ROM[0].valor} a ${GRADOS_ROM.at(-1).valor} y solo con números enteros (${GRADOS_ROM.map((g) => `${g.valor} = ${g.etiqueta.toLowerCase()}`).join(', ')}). Una celda vacía es «no explorado», nunca 0.</p>
      <p class="muted">Nada se redondea: una celda con un 4, con medio punto o con un texto que no se reconoce se señala con su fila y su columna y esa celda no se importa; el resto de la fila sí. El fichero no trae fecha: elige la de la valoración. Cada jugador genera una valoración del test «${HIP_TEST}» de NME.</p>
    <//>
    <label class="fields"><span class="muted">Fichero</span><input type="file" accept=".xlsx,.csv,.txt" onChange=${onFile} disabled=${busy} /></label>
    <${Msg} msg=${msg} />
    ${hojas && !hip ? html`<p class="status warn" role="status">El test «${HIP_TEST}» todavía no está en el catálogo. Abre «Catálogo de tests» una vez para que se cree y vuelve aquí.</p>` : null}
    ${hojas ? html`<div class="filters"><label>Fecha de la valoración <input type="date" value=${fecha} onInput=${(e) => setFecha(e.target.value)} required /></label></div>
      ${hojas.map((h) => html`<section key=${h.name} class="refs"><h4>Hoja «${h.name}»</h4>
        ${!h.parsed.ok ? html`<p class="muted">${h.parsed.reason}</p>` : html`
        <div class="filters"><label class="check"><input type="checkbox" checked=${h.on} onChange=${(e) => setHoja(h.name, { on: e.target.checked })} /> Importar esta hoja</label></div>
        ${h.on ? html`<div class="table-wrap"><table><caption>${h.parsed.cols.length} columnas reconocidas · nombres en la columna ${h.parsed.nameCol + 1} · ${h.parsed.filas.length} filas con nombre</caption>
          <thead><tr><th>Nombre en el Excel</th><th>Jugador</th><th>Valores leídos</th><th>Anotación (opcional)</th><th>Estado</th></tr></thead>
          <tbody>${h.parsed.filas.map((r) => { const pid = playerFor(h, r); const L = h.links[r.name]; const ids = new Set((L?.candidates ?? []).map((c) => c.id));
            return html`<tr key=${r.rowNumber} class=${pid && !r.vacia ? '' : 'excluded'}><th scope="row">${r.name}</th>
              <td>${r.vacia ? html`<span class="muted">—</span>` : html`<select aria-label=${`Jugador para ${r.name}`} value=${pid ?? ''} onChange=${(e) => setElegido({ ...elegido, [clave(h, r)]: e.target.value })}><option value="">— omitir —</option>${(L?.candidates ?? []).map((c) => html`<option key=${'c' + c.id} value=${c.id}>${playerLabel(data.players.find((p) => p.id === c.id))}${c.level === 'alta' ? '' : ' (parecido)'}</option>`)}${data.players.filter((p) => !ids.has(p.id)).map((p) => html`<option key=${p.id} value=${p.id}>${playerLabel(p)}</option>`)}</select>`}</td>
              <td class="hip-valores">${r.vacia ? html`<span class="muted">—</span>` : resumenFila(r.valores)}</td>
              <td>${r.vacia ? html`<span class="muted">—</span>` : html`<input aria-label=${`Anotación para ${r.name}`} value=${notas[clave(h, r)] ?? ''} onInput=${(e) => setNotas({ ...notas, [clave(h, r)]: e.target.value })} />`}</td>
              <td>${r.incidencias.map((x, i) => html`<span class="status fail" key=${i}>${x}</span>`)}${r.vacia ? html`<span class="muted">fila sin ningún valor: se omite</span>` : pid ? 'Se importará' : html`<span class="muted" title=${(L?.reasons ?? []).join(' ')}>sin jugador vinculado: se omite</span>`}</td></tr>`; })}</tbody></table></div>` : null}`}
      </section>`)}
      <p>${total} valoración(es) listas para importar${isIsoDay(fecha) ? ` con fecha ${fmtDay(fecha)}` : ''}${celdasMal ? ` · ${celdasMal} celda(s) no se importan por no ser un valor válido de la escala` : ''}. Las filas sin jugador vinculado o sin ningún valor se omiten; si ya existe una valoración de ese jugador en esa fecha, no se duplica. Si eliges un jugador a mano, su nombre del Excel se guarda como alias (fuente Excel).</p>
      <button type="button" disabled=${busy || !listo} onClick=${importar}>Importar ${total} valoración(es)</button>` : null}
    ${res ? html`<p class="status ok" role="status">Creadas: ${res.creadas} · ya existían: ${res.duplicadas} · omitidas: ${res.omitidas}${res.alias ? ` · alias guardados: ${res.alias}` : ''}.</p>${res.incidencias.map((x, i) => html`<p class="status warn" key=${i}>${x}</p>`)}` : null}
  <//>`;
}
