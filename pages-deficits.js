// pages-deficits.js — bloque «Déficits» de la ficha del jugador (12/11/2026, pedido por el usuario): todo aquello en lo que su percentil de La Liga
// queda por debajo (o igual) de un umbral, con 35 por defecto. Recorre todos los tests con datos del jugador y, en cada uno, todas sus variables visibles.
// Usa `columnasNormativas`, la MISMA función que dibuja el cuadro Normative Benchmarking, así que un dato no puede salir aquí distinto que allí.
// No entran las variables sin dirección «mejor/peor» (su percentil indica posición, no rendimiento) ni las que no llegan a la muestra mínima.
import { html, useState } from './libs.js';
import { useApp } from './context.js';
import { useLoad, Card, Desplegable } from './componentes.js';
import { listCatalog } from './catalogo.js';
import { listPositions } from './posiciones.js';
import { getSetting } from './db.js';
import { expandRelative, orderVars, isViewable, hasData, isRelative } from './relativos.js';
import { withReferenceWeights } from './relaciones.js';
import { pairContext } from './isohold.js';
import { isAsymVariable, variableExcluidaDeDeficits } from './catalogo.js';
import { columnasNormativas, ordenIsoHold } from './pages-normativo.js';
import { Banda } from './pages-percentiles.js';
import { MIN_N_DEFAULT } from './percentiles.js';
import { buildHash } from './rutas.js';
import { fmtDay } from './fechas.js';
import { dn } from './nombres.js';

const BASES = [['pa', 'Personal Average'], ['pb', 'Personal Best'], ['last', 'Actual']];
const nf = (n, d = 2) => (n === null || n === undefined || !Number.isFinite(n) ? '—' : Number(n).toLocaleString('es-ES', { maximumFractionDigits: d }));
const LADO = { L: 'Izquierda', R: 'Derecha', S: '' };

// Déficits de un jugador: una fila por variable y lado cuyo percentil de rendimiento de La Liga sea ≤ umbral, más las asimetrías con percentil bajo
// (en asimetría, percentil bajo = asimetría grande). Lógica pura sobre lo ya calculado: no vuelve a decidir cómo se calcula un percentil.
export function deficitsDeTest({ player, test, catalog, refData, base, positionId, umbral }) {
  const mias = refData.sessions.filter((s) => s.playerId === player.id);
  if (!mias.length) return [];
  const candidatas = catalog.variables.filter((v) => v.testId === test.id && isViewable(v) && hasData(v, mias) && !isAsymVariable(v) && !variableExcluidaDeDeficits(v));
  // Si una variable tiene su versión relativa al peso con datos (Peak Force → Peak Force relativo, Max Force → Max Force relativo), se lista solo la
  // relativa: es la que permite comparar entre jugadores, y las dos juntas serían el mismo déficit contado dos veces (12/11/2026).
  const conRelativa = new Set(candidatas.filter((v) => isRelative(v)).map((v) => v.formula.operands[0]));
  const vars = ordenIsoHold(orderVars(candidatas.filter((v) => !conRelativa.has(v.id))));
  if (!vars.length) return [];
  const cols = columnasNormativas({ player, test, catalog, sessions: mias, refData, vars, base, f: {}, positionId });
  const out = [];
  for (const c of cols) {
    for (const sd of c.sides) {
      const l = c.lado[sd], ev = l?.ev;
      // Sin dirección «mejor/peor» el percentil solo dice dónde cae en La Liga, no si es un déficit: esas variables no entran.
      if (!l?.x || !ev || !ev.sufficient || ev.band === null || ev.positional || ev.percentilePerf > umbral) continue;
      out.push({ tipo: 'valor', test, variable: c.v, side: sd, value: l.x.value, date: l.x.date, from: l.x.from ?? l.x.date, unit: c.v.unit ?? '', ev });
    }
    if (c.evAsim && c.evAsim.sufficient && c.evAsim.band !== null && c.evAsim.percentilePerf <= umbral) {
      out.push({ tipo: 'asimetria', test, variable: c.v, side: null, value: Math.abs(c.asim), date: c.lado.L?.x?.date ?? null, unit: '%', ev: c.evAsim });
    }
  }
  return out;
}

export function Deficits({ player, positionId = null }) {
  const { db, version } = useApp();
  const [base, setBase] = useState('pa');
  const [umbral, setUmbral] = useState(35);
  const { data, error } = useLoad(async () => {
    const catalog = await listCatalog(db);
    const [allSessions, players, records, positions, mn, anthropometry] = await Promise.all([
      db.sessions.toArray(), db.players.toArray(), db.playerPositions.toArray(), listPositions(db), getSetting(db, 'percentileMinN'), db.anthropometry.toArray(),
    ]);
    const minN = Number.isInteger(mn) && mn >= 1 ? mn : MIN_N_DEFAULT;
    const anth = withReferenceWeights(anthropometry, players);
    const conDatos = new Set(allSessions.filter((s) => s.playerId === player.id).map((s) => s.testId));
    const porTest = new Map();
    for (const s of allSessions) (porTest.get(s.testId) ?? porTest.set(s.testId, []).get(s.testId)).push(s);
    const tests = catalog.tests.filter((t) => conDatos.has(t.id) && !t.archived);
    const refs = [];
    for (const t of tests) {
      const { sessions } = expandRelative(catalog.variables, t.id, porTest.get(t.id) ?? [], anth, { tests: catalog.tests, allSessions });
      refs.push([t, { sessions, players, records, positions, minN }]);
    }
    return { catalog, refs, minN };
  }, [db, player.id, version]);
  if (error) return html`<p class="status fail">${error}</p>`;
  if (!data) return html`<p>Calculando déficits…</p>`;
  const { catalog, refs, minN } = data;
  const u = Number.isFinite(Number(umbral)) ? Math.min(99, Math.max(1, Number(umbral))) : 35;
  const filas = refs.flatMap(([test, refData]) => deficitsDeTest({ player, test, catalog, refData, base, positionId, umbral: u }))
    .sort((a, b) => a.ev.percentilePerf - b.ev.percentilePerf || dn(a.test.name).localeCompare(dn(b.test.name), 'es'));
  const href = (f) => buildHash(`jugador-${player.id}`, { b: 'fuerza', t: f.test.id, v: f.variable.id, pn: base });
  return html`<${Card} titulo=${`Déficits (${filas.length})`}>
    <div class="filters">
      <fieldset class="modes"><legend>Valor usado</legend>${BASES.map(([k, n]) => html`<label class="check" key=${k}><input type="radio" name="def-base" checked=${base === k} onChange=${() => setBase(k)} /> ${n}</label>`)}</fieldset>
      <label>Percentil La Liga igual o inferior a <input type="number" min="1" max="99" step="1" value=${umbral} onInput=${(e) => setUmbral(e.target.value)} /></label>
    </div>
    ${!filas.length
      ? html`<p class="muted">Ninguna variable de este jugador tiene un percentil de La Liga igual o inferior a ${u} con esta base. Solo se miran las variables con dirección «mejor/peor» y con al menos ${minN} jugadores en la referencia.</p>`
      : html`<div class="table-wrap"><table class="deficits"><caption>Ordenados del percentil más bajo al más alto</caption>
        <thead><tr><th scope="col">Percentil La Liga</th><th scope="col">Test</th><th scope="col">Variable</th><th scope="col">Lado</th><th scope="col">Valor</th><th scope="col">Fecha</th></tr></thead>
        <tbody>${filas.map((f) => html`<tr key=${`${f.test.id}-${f.variable.id}-${f.tipo}-${f.side ?? ''}`}>
          <td><${Banda} ev=${f.ev} /></td>
          <td><a href=${href(f)}>${dn(f.test.name)}</a></td>
          <td>${dn(f.variable.name)}${f.tipo === 'asimetria' ? html` <span class="muted">(asimetría)</span>` : ''}</td>
          <td>${f.tipo === 'asimetria' ? '—' : LADO[f.side] || '—'}</td>
          <td class="num">${nf(f.value)}${f.unit ? ` ${f.unit}` : ''}</td>
          <td>${f.date ? (f.from && f.from !== f.date ? `${fmtDay(f.from)} – ${fmtDay(f.date)}` : fmtDay(f.date)) : '—'}</td>
        </tr>`)}</tbody></table></div>`}
    <${Desplegable} titulo="Qué entra en esta lista y qué no">
      <p class="muted">Se recorre cada test con datos del jugador y cada una de sus variables visibles, con el valor de la base elegida (Personal Average, Personal Best o Actual) y el mismo percentil de La Liga que muestra el cuadro «Normative Benchmarking» de ese test: es la misma función de cálculo, no una copia.</p>
      <p class="muted">Se listan las variables por lado (cada pierna por separado) y, además, las asimetrías: en ellas un percentil bajo significa una asimetría grande comparada con la de los demás jugadores.</p>
      <p class="muted">No entran: las variables sin dirección «mejor/peor» (ahí el percentil solo dice dónde cae en La Liga, no si es bueno o malo), las que no llegan al mínimo de ${minN} jugadores en la referencia, los valores que el jugador no tiene con esa base, y los tests archivados, las variables marcadas como excluidas en el Catálogo (por defecto Torque del Nordic y Force/RFD at 100 ms) y la medida absoluta cuando existe su relativa al peso con datos (se lista solo la relativa). La referencia nunca incluye al propio jugador ni datos sintéticos.</p>
    <//>
  <//>`;
}
