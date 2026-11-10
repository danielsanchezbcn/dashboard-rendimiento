// pages-cargas.js — Importar → «Cargas de Iso-Hold / RM (Excel)»: lee un libro con jugadores y cargas (kg), vincula los nombres y guarda una sesión manual por jugador.
import { html, useState } from './libs.js';
import { useApp } from './context.js';
import { Card, Msg, useLoad, useRunner } from './componentes.js';
import { readFileGrid } from './excel.js';
import { listCatalog } from './catalogo.js';
import { todayIso, isIsoDay, fmtDay } from './fechas.js';
import { playerLabel } from './jugadores.js';
import { parseLoadSheet, loadTests, guessLoadTest, proposeLinks, commitLoads } from './cargas-excel.js';
import { dn } from './nombres.js';

const nf = (n) => Number(n).toLocaleString('es-ES', { maximumFractionDigits: 2 });

export function ImportarCargas() {
  const { db, version, bump } = useApp();
  const { data } = useLoad(async () => ({ cat: await listCatalog(db), players: (await db.players.toArray()).sort((a, b) => playerLabel(a).localeCompare(playerLabel(b), 'es')) }), [db, version]);
  const { msg, setMsg, busy, run } = useRunner();
  const [hojas, setHojas] = useState(null); // [{ name, parsed, testId, on, links }]
  const [fecha, setFecha] = useState(todayIso());
  const [elegido, setElegido] = useState({}); // `${hoja}|${nombre}` → id de jugador ('' = omitir)
  const [res, setRes] = useState(null);
  const tests = data ? loadTests(data.cat) : [];

  const onFile = (ev) => { const f = ev.target.files?.[0] ?? null; return run(async () => {
    setRes(null); setElegido({}); setHojas(null); setMsg(null);
    if (!f) return;
    const grid = await readFileGrid(f);
    const lista = [];
    for (const s of grid.sheets) {
      const parsed = parseLoadSheet(s.rows);
      const links = parsed.ok ? await proposeLinks(db, parsed.rows.map((r) => r.name)) : {};
      lista.push({ name: s.name, parsed, links, testId: guessLoadTest(s.name, parsed.title ?? '', tests)?.id ?? '', on: parsed.ok && parsed.rows.some((r) => r.load != null) });
    }
    setHojas(lista);
    if (!lista.some((h) => h.parsed.ok)) throw new Error('Ninguna hoja tiene una columna de carga reconocible («ADDED EXTERNAL LOAD», «EXTERNAL LOAD ADDED» o «Carga externa»).');
  })(); };
  const setHoja = (name, patch) => setHojas(hojas.map((h) => (h.name === name ? { ...h, ...patch } : h)));
  const playerFor = (h, r) => { const k = `${h.name}|${r.name}`; return k in elegido ? (elegido[k] === '' ? null : Number(elegido[k])) : h.links[r.name]?.autoId ?? null; };
  const activas = (hojas ?? []).filter((h) => h.on && h.parsed.ok);
  const total = activas.reduce((n, h) => n + h.parsed.rows.filter((r) => r.load != null && playerFor(h, r)).length, 0);
  const listo = activas.length > 0 && activas.every((h) => h.testId) && isIsoDay(fecha) && total > 0;
  const importar = run(async () => {
    const out = { creadas: 0, duplicadas: 0, omitidas: 0, alias: 0, incidencias: [] };
    for (const h of activas) {
      const r = await commitLoads(db, { testId: Number(h.testId), date: fecha, items: h.parsed.rows.map((row) => ({ name: row.name, load: row.load, playerId: playerFor(h, row), remember: `${h.name}|${row.name}` in elegido && elegido[`${h.name}|${row.name}`] !== '' })) });
      for (const k of ['creadas', 'duplicadas', 'omitidas', 'alias']) out[k] += r[k];
      out.incidencias.push(...r.incidencias.map((x) => `${h.name}: ${x}`));
    }
    setRes(out); bump();
  }, 'Importación terminada.');

  return html`<${Card} titulo="Cargas de Iso-Hold / RM desde Excel">
    <p class="muted">Sube un Excel con los jugadores en una columna y la carga externa (kg) en otra, con cabecera «ADDED EXTERNAL LOAD», «EXTERNAL LOAD ADDED» o «Carga externa». Cada hoja (HIP, KNEE, ANKLE…) se puede asignar a un test. Solo se leen los valores de esa columna, no las fórmulas. El Excel no trae fecha: elige la de la sesión. Se guarda una sesión manual por jugador; MVIC, %PIMA y %BW/%SW se calculan solos.</p>
    <label class="fields"><span class="muted">Fichero</span><input type="file" accept=".xlsx,.csv,.txt" onChange=${onFile} disabled=${busy} /></label>
    <${Msg} msg=${msg} />
    ${hojas ? html`<div class="filters"><label>Fecha de las sesiones <input type="date" value=${fecha} onInput=${(e) => setFecha(e.target.value)} required /></label></div>
      ${hojas.map((h) => html`<section key=${h.name} class="refs"><h4>Hoja «${h.name}»</h4>
        ${!h.parsed.ok ? html`<p class="muted">${h.parsed.reason}</p>` : html`
        <div class="filters"><label class="check"><input type="checkbox" checked=${h.on} onChange=${(e) => setHoja(h.name, { on: e.target.checked })} /> Importar esta hoja</label>
          <label>Test <select value=${h.testId} onChange=${(e) => setHoja(h.name, { testId: e.target.value })}><option value="">Elige…</option>${tests.map((t) => html`<option key=${t.id} value=${t.id}>${dn(t.name)}</option>`)}</select></label></div>
        ${h.on ? html`<div class="table-wrap"><table><caption>Columna de carga: ${h.parsed.loadCol + 1} · nombres: columna ${h.parsed.nameCol + 1} · ${h.parsed.rows.length} filas con nombre</caption>
          <thead><tr><th>Nombre en el Excel</th><th>Jugador</th><th class="num">Carga (kg)</th><th>Estado</th></tr></thead>
          <tbody>${h.parsed.rows.map((r) => { const pid = playerFor(h, r); const L = h.links[r.name]; const ids = new Set((L?.candidates ?? []).map((c) => c.id));
            return html`<tr key=${r.rowNumber} class=${pid ? '' : 'excluded'}><th scope="row">${r.name}</th>
              <td>${r.load == null ? html`<span class="muted">—</span>` : html`<select aria-label=${`Jugador para ${r.name}`} value=${pid ?? ''} onChange=${(e) => setElegido({ ...elegido, [`${h.name}|${r.name}`]: e.target.value })}><option value="">— omitir —</option>${(L?.candidates ?? []).map((c) => html`<option key=${'c' + c.id} value=${c.id}>${playerLabel(data.players.find((p) => p.id === c.id))}${c.level === 'alta' ? '' : ' (parecido)'}</option>`)}${data.players.filter((p) => !ids.has(p.id)).map((p) => html`<option key=${p.id} value=${p.id}>${playerLabel(p)}</option>`)}</select>`}</td>
              <td class="num">${r.load == null ? '—' : nf(r.load)}</td>
              <td>${r.error ? html`<span class="status fail">${r.error}</span>` : r.empty ? html`<span class="muted">sin carga: se omite</span>` : pid ? 'Se importará' : html`<span class="muted" title=${(L?.reasons ?? []).join(' ')}>sin jugador vinculado: se omite</span>`}</td></tr>`; })}</tbody></table></div>` : null}`}
      </section>`)}
      <p>${total} carga(s) listas para importar${isIsoDay(fecha) ? ` con fecha ${fmtDay(fecha)}` : ''}. Las filas sin jugador vinculado o sin carga se omiten; si ya existe una sesión de ese jugador y test en esa fecha, no se duplica. Si eliges un jugador a mano, su nombre del Excel se guarda como alias (fuente Excel).</p>
      <button type="button" disabled=${busy || !listo} onClick=${importar}>Importar ${total} carga(s)</button>` : null}
    ${res ? html`<p class="status ok" role="status">Creadas: ${res.creadas} · ya existían: ${res.duplicadas} · omitidas: ${res.omitidas}${res.alias ? ` · alias guardados: ${res.alias}` : ''}.</p>${res.incidencias.map((x, i) => html`<p class="status warn" key=${i}>${x}</p>`)}` : null}
  <//>`;
}
