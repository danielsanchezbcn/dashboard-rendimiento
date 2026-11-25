// pages-cargas-dos.js — Importar → «Cargas bilateral y por pierna (Excel)»: libros con la medida de las dos piernas juntas y la de cada pierna en la
// misma hoja (23/11/2026, el libro de Leg Press 45° 8RM del usuario). Cada hoja alimenta DOS tests a la vez: el bilateral y el unilateral.
// Se leen solo las columnas de carga: el relativo al peso y la asimetría los calcula el dashboard. El libro no trae fecha: se elige una para todo.
import { html, useState } from './libs.js';
import { useApp } from './context.js';
import { Card, Desplegable, Msg, useLoad, useRunner } from './componentes.js';
import { readFileGrid } from './excel.js';
import { listCatalog } from './catalogo.js';
import { todayIso, isIsoDay, fmtDay } from './fechas.js';
import { playerLabel } from './jugadores.js';
import { parseTwoWaySheet, guessTwoWayTests, loadTests, proposeLinks, commitTwoWay } from './cargas-excel.js';
import { LOAD_VARIABLE_NAMES } from './isohold.js';
import { dn } from './nombres.js';

const nf = (n) => (n == null ? '—' : Number(n).toLocaleString('es-ES', { maximumFractionDigits: 2 }));
const cargaDe = (cat, t) => cat.variables.find((v) => v.testId === t.id && !v.archived && v.kind !== 'derived' && LOAD_VARIABLE_NAMES.includes(v.name));

export function ImportarCargasDos() {
  const { db, version, bump } = useApp();
  const { data } = useLoad(async () => ({ cat: await listCatalog(db), players: (await db.players.toArray()).sort((a, b) => playerLabel(a).localeCompare(playerLabel(b), 'es')) }), [db, version]);
  const { msg, setMsg, busy, run } = useRunner();
  const [hojas, setHojas] = useState(null);
  const [fecha, setFecha] = useState(todayIso());
  const [elegido, setElegido] = useState({});
  const [res, setRes] = useState(null);
  // El selector bilateral ofrece los tests cuya carga es de valor único; el de por pierna, los que la tienen por lado.
  const todos = data ? loadTests(data.cat) : [];
  const testsDoble = data ? todos.filter((t) => cargaDe(data.cat, t)?.sides !== 'LR') : [];
  const testsUni = data ? todos.filter((t) => cargaDe(data.cat, t)?.sides === 'LR') : [];

  const onFile = (ev) => { const f = ev.target.files?.[0] ?? null; return run(async () => {
    setRes(null); setElegido({}); setHojas(null); setMsg(null);
    if (!f) return;
    const grid = await readFileGrid(f);
    // El catálogo se lee aquí, no del estado de la pantalla: si el fichero se elige antes de que termine de cargar, la lista estaría vacía y la
    // propuesta de tests saldría en blanco sin decir por qué (24/11/2026).
    const paraAdivinar = loadTests(data?.cat ?? (await listCatalog(db)));
    const lista = [];
    for (const s of grid.sheets) {
      const parsed = parseTwoWaySheet(s.rows);
      const links = parsed.ok ? await proposeLinks(db, parsed.rows.map((r) => r.name)) : {};
      const guess = parsed.ok ? guessTwoWayTests(s.name, parsed.title ?? '', paraAdivinar) : { doble: null, uni: null };
      lista.push({ name: s.name, parsed, links, dobleId: guess.doble?.id ?? '', uniId: guess.uni?.id ?? '', on: parsed.ok && parsed.rows.some((r) => !r.empty) });
    }
    setHojas(lista);
    if (!lista.some((h) => h.parsed.ok)) throw new Error('Ninguna hoja tiene columnas reconocibles: hace falta «DOUBLE LEG» o las dos de pierna («IZQUIERDA» y «DERECHA»).');
  })(); };

  const setHoja = (name, patch) => setHojas(hojas.map((h) => (h.name === name ? { ...h, ...patch } : h)));
  const playerFor = (h, r) => { const k = `${h.name}|${r.name}`; return k in elegido ? (elegido[k] === '' ? null : Number(elegido[k])) : h.links[r.name]?.autoId ?? null; };
  const activas = (hojas ?? []).filter((h) => h.on && h.parsed.ok);
  const cuenta = (h, r) => (playerFor(h, r) ? (r.doble != null && h.dobleId ? 1 : 0) + ((r.izq != null || r.der != null) && h.uniId ? 1 : 0) : 0);
  const total = activas.reduce((n, h) => n + h.parsed.rows.reduce((m, r) => m + cuenta(h, r), 0), 0);
  const listo = activas.length > 0 && activas.every((h) => h.dobleId || h.uniId) && isIsoDay(fecha) && total > 0;

  const importar = run(async () => {
    const out = { creadasDoble: 0, creadasUni: 0, duplicadas: 0, omitidas: 0, alias: 0, incidencias: [] };
    for (const h of activas) {
      const r = await commitTwoWay(db, {
        testDobleId: h.dobleId ? Number(h.dobleId) : null,
        testUniId: h.uniId ? Number(h.uniId) : null,
        date: fecha,
        items: h.parsed.rows.map((row) => ({ name: row.name, doble: row.doble, izq: row.izq, der: row.der, playerId: playerFor(h, row), remember: `${h.name}|${row.name}` in elegido && elegido[`${h.name}|${row.name}`] !== '' })),
      });
      for (const k of ['creadasDoble', 'creadasUni', 'duplicadas', 'omitidas', 'alias']) out[k] += r[k];
      out.incidencias.push(...r.incidencias.map((x) => `${h.name}: ${x}`));
    }
    setRes(out); bump();
  }, 'Importación terminada.');

  return html`<${Card} titulo="Cargas bilateral y por pierna desde Excel">
    <${Desplegable} titulo="Formato del Excel">
      <p class="muted">Para los libros que llevan en la misma hoja la medida de las dos piernas juntas y la de cada pierna, como el de Leg Press 45° 8RM. En la fila de cabecera hacen falta «DOUBLE LEG» (o «BILATERAL») y/o «IZQUIERDA» y «DERECHA» (también valen «LEFT» y «RIGHT»); los nombres de los jugadores, en una de las tres primeras columnas.</p>
      <p class="muted">Las columnas de <strong>relativo al peso</strong> y de <strong>asimetría</strong> no se leen: las calcula el dashboard a partir de la carga y de la masa corporal más cercana a la fecha de la sesión (o del peso de referencia). La columna de peso del libro tampoco se importa. Cada hoja crea una sesión en el test bilateral y otra en el de por pierna, solo donde haya dato. En los dos calf raise, donde la carga es la misma en las dos piernas, aportar un solo lado guarda ese valor en los dos.</p>
    <//>
    <label class="fields"><span class="muted">Fichero</span><input type="file" accept=".xlsx,.csv,.txt" onChange=${onFile} disabled=${busy} /></label>
    <${Msg} msg=${msg} />
    ${hojas ? html`<div class="filters"><label>Fecha de las sesiones <input type="date" value=${fecha} onInput=${(e) => setFecha(e.target.value)} required /></label></div>
      ${hojas.map((h) => html`<section key=${h.name} class="refs"><h4>Hoja «${h.name}»</h4>
        ${!h.parsed.ok ? html`<p class="muted">${h.parsed.reason}</p>` : html`
        <div class="filters"><label class="check"><input type="checkbox" checked=${h.on} onChange=${(e) => setHoja(h.name, { on: e.target.checked })} /> Importar esta hoja</label>
          <label>Test bilateral <select value=${h.dobleId} onChange=${(e) => setHoja(h.name, { dobleId: e.target.value })}><option value="">— no importar —</option>${testsDoble.map((t) => html`<option key=${t.id} value=${t.id}>${dn(t.name)}</option>`)}</select></label>
          <label>Test por pierna <select value=${h.uniId} onChange=${(e) => setHoja(h.name, { uniId: e.target.value })}><option value="">— no importar —</option>${testsUni.map((t) => html`<option key=${t.id} value=${t.id}>${dn(t.name)}</option>`)}</select></label></div>
        ${h.on ? html`<div class="table-wrap"><table class="cargas-dos"><caption>Bilateral: columna ${h.parsed.dobleCol >= 0 ? h.parsed.dobleCol + 1 : '—'} · izquierda: ${h.parsed.izqCol >= 0 ? h.parsed.izqCol + 1 : '—'} · derecha: ${h.parsed.derCol >= 0 ? h.parsed.derCol + 1 : '—'} · nombres: columna ${h.parsed.nameCol + 1} · ${h.parsed.rows.length} filas con nombre</caption>
          <thead><tr><th>Nombre en el Excel</th><th>Jugador</th><th class="num">Bilateral (kg)</th><th class="num">Izquierda (kg)</th><th class="num">Derecha (kg)</th><th>Estado</th></tr></thead>
          <tbody>${h.parsed.rows.map((r) => { const pid = playerFor(h, r); const L = h.links[r.name]; const ids = new Set((L?.candidates ?? []).map((c) => c.id)); const n = cuenta(h, r);
            return html`<tr key=${r.rowNumber} class=${n ? '' : 'excluded'}><th scope="row">${r.name}</th>
              <td>${r.empty ? html`<span class="muted">—</span>` : html`<select aria-label=${`Jugador para ${r.name}`} value=${pid ?? ''} onChange=${(e) => setElegido({ ...elegido, [`${h.name}|${r.name}`]: e.target.value })}><option value="">— omitir —</option>${(L?.candidates ?? []).map((c) => html`<option key=${'c' + c.id} value=${c.id}>${playerLabel(data.players.find((p) => p.id === c.id))}${c.level === 'alta' ? '' : ' (parecido)'}</option>`)}${data.players.filter((p) => !ids.has(p.id)).map((p) => html`<option key=${p.id} value=${p.id}>${playerLabel(p)}</option>`)}</select>`}</td>
              <td class="num">${nf(r.doble)}</td><td class="num">${nf(r.izq)}</td><td class="num">${nf(r.der)}</td>
              <td>${r.error ? html`<span class="status fail">${r.error}</span>` : r.empty ? html`<span class="muted">sin cargas: se omite</span>` : !pid ? html`<span class="muted" title=${(L?.reasons ?? []).join(' ')}>sin jugador vinculado: se omite</span>` : n ? `${n} sesión(es)` : html`<span class="muted">sin test asignado: se omite</span>`}</td></tr>`; })}</tbody></table></div>` : null}`}
      </section>`)}
      <p>${total} sesión(es) lista(s) para importar${isIsoDay(fecha) ? ` con fecha ${fmtDay(fecha)}` : ''}. Las filas sin jugador vinculado o sin cargas se omiten; si ya existe una sesión de ese jugador y test en esa fecha, no se duplica. Si eliges un jugador a mano, su nombre del Excel se guarda como alias (fuente Excel).</p>
      <button type="button" disabled=${busy || !listo} onClick=${importar}>Importar ${total} sesión(es)</button>` : null}
    ${res ? html`<p class="status ok" role="status">Creadas: ${res.creadasDoble} bilaterales y ${res.creadasUni} por pierna · ya existían: ${res.duplicadas} · omitidas: ${res.omitidas}${res.alias ? ` · alias guardados: ${res.alias}` : ''}.</p>${res.incidencias.map((x, i) => html`<p class="status warn" key=${i}>${x}</p>`)}` : null}
  <//>`;
}
