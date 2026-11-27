// pages-deficits.js — bloque «Déficits» de la ficha del jugador (12/11/2026, pedido por el usuario): todo aquello en lo que su percentil de La Liga
// queda por debajo (o igual) de un umbral, con 35 por defecto. Recorre todos los tests con datos del jugador y, en cada uno, todas sus variables visibles.
// Usa `columnasNormativas`, la MISMA función que dibuja el cuadro Normative Benchmarking, así que un dato no puede salir aquí distinto que allí.
// No entran las variables sin dirección «mejor/peor» (su percentil indica posición, no rendimiento) ni las que no llegan a la muestra mínima.
import { html, useState } from './libs.js';
import { useApp } from './context.js';
import { useLoad, Card, Desplegable, Plegable, BarraFija } from './componentes.js';
import { playerLabel } from './jugadores.js';
import { listCatalog } from './catalogo.js';
import { listPositions } from './posiciones.js';
import { getSetting } from './db.js';
import { expandRelative, orderVars, isViewable, hasData, isRelative } from './relativos.js';
import { withReferenceWeights } from './relaciones.js';
import { pairContext, esTestDeCarga, esPorcentajeBW } from './isohold.js';
import { isAsymVariable, variableExcluidaDeDeficits, asimetriaLR } from './catalogo.js';
import { fmtVar, fmtPuntos, rotuloComp, TIP_COMP } from './evolucion.js';
import { columnasNormativas, ordenIsoHold } from './pages-normativo.js';
import { Banda } from './pages-percentiles.js';
import { BLOQUES_ASIM } from './pages-asimetrias.js';
import { MIN_N_DEFAULT } from './percentiles.js';
import { buildHash } from './rutas.js';
import { fmtDay } from './fechas.js';
import { dn } from './nombres.js';
import { deficitsHip, ultimaValoracion, UMBRAL_ROM, GRADOS_ROM } from './hip.js';
import { testHip } from './hip-excel.js';

const BASES = [['last', 'Latest'], ['pa', 'Personal Average'], ['pb', 'Personal Best']]; // «Latest» primero y por defecto en todas las pantallas (16/11/2026)
const nf = (n, d = 2) => (n === null || n === undefined || !Number.isFinite(n) ? '—' : Number(n).toLocaleString('es-ES', { maximumFractionDigits: d }));
const LADO = { L: 'Izquierda', R: 'Derecha', S: '' };

// Déficits de un jugador: una fila por variable y lado cuyo percentil de rendimiento de La Liga sea ≤ umbral, más las asimetrías con percentil bajo
// (en asimetría, percentil bajo = asimetría grande). Lógica pura sobre lo ya calculado: no vuelve a decidir cómo se calcula un percentil.
// 25/11/2026 (fallo encontrado por el usuario): este bloque compara SIEMPRE contra toda La Liga, nunca contra la posición del jugador. Antes recibía la
// posición principal del jugador y se la pasaba a `columnasNormativas`, que entonces calculaba el percentil solo entre los de su posición. En los tests
// que pocos jugadores han hecho, esa muestra no llega al mínimo y la variable desaparecía de la lista **sin decir nada**, aunque su percentil de La Liga
// fuera 9. Además contradecía lo que dice la propia tarjeta («el mismo percentil que Normative Benchmarking») y la decisión 121. Ya no se pasa posición.
export function deficitsDeTest({ player, test, catalog, refData, base, umbral }) {
  const mias = refData.sessions.filter((s) => s.playerId === player.id);
  if (!mias.length) return { filas: [], sinMuestra: [] };
  const visibles = catalog.variables.filter((v) => v.testId === test.id && isViewable(v) && hasData(v, mias) && !isAsymVariable(v) && !variableExcluidaDeDeficits(v));
  // Tests de carga (iso-hold y todos los RM): solo el %BW (25/11/2026, petición del usuario). Los kilos no son comparables entre jugadores, y el MVIC
  // iso-push, el %PIMA y el 1RM estimado se calculan desde esa misma carga: listarlos sería el mismo déficit contado tres o cuatro veces. La asimetría
  // del test sigue apareciendo, calculada sobre el %BW, que es la misma que la de los kilos.
  const candidatas = esTestDeCarga(test.id, catalog.variables) ? visibles.filter(esPorcentajeBW) : visibles;
  // Si una variable tiene su versión relativa al peso con datos (Peak Force → Peak Force relativo, Max Force → Max Force relativo), se lista solo la
  // relativa: es la que permite comparar entre jugadores, y las dos juntas serían el mismo déficit contado dos veces (12/11/2026).
  const conRelativa = new Set(candidatas.filter((v) => isRelative(v)).map((v) => v.formula.operands[0]));
  const vars = ordenIsoHold(orderVars(candidatas.filter((v) => !conRelativa.has(v.id))));
  if (!vars.length) return { filas: [], sinMuestra: [] };
  const cols = columnasNormativas({ player, test, catalog, sessions: mias, refData, vars, base, f: {}, positionId: null });
  const out = []; const sinMuestra = [];
  // Asimetría de la última sesión y de la anterior, para poder compararlas (la asimetría ya es un %, así que su cambio se da en PUNTOS porcentuales).
  const asimDe = (c, campo) => { const L = c.lado.L?.[campo], R = c.lado.R?.[campo]; return L && R ? asimetriaLR(c.v, L.value, R.value) : null; };
  for (const c of cols) {
    for (const sd of c.sides) {
      const l = c.lado[sd], ev = l?.ev;
      // Sin dirección «mejor/peor» el percentil solo dice dónde cae en La Liga, no si es un déficit: esas variables no entran.
      if (!l?.x || !ev) continue;
      // Lo que no se puede evaluar se anota para decirlo en pantalla, en vez de desaparecer sin más (25/11/2026).
      if (!ev.sufficient) { sinMuestra.push({ test, variable: c.v, side: sd, n: ev.n, minN: ev.minN, razon: ev.reason ?? '' }); continue; }
      if (ev.band === null || ev.positional || ev.percentilePerf > umbral) continue;
      // La misma comparación que muestra Normative Benchmarking para esa base: viene ya calculada en `columnasNormativas`, no se recalcula aquí.
      out.push({ tipo: 'valor', test, variable: c.v, side: sd, value: l.x.value, date: l.x.date, from: l.x.from ?? l.x.date, unit: c.v.unit ?? '', ev, vari: l.vari ?? null, variPuntos: null });
    }
    if (c.evAsim && c.evAsim.sufficient && c.evAsim.band !== null && c.evAsim.percentilePerf <= umbral) {
      const act = asimDe(c, 'act'), ref = base === 'last' ? asimDe(c, 'prev') : c.asim;
      const variPuntos = Number.isFinite(act) && Number.isFinite(ref) ? Math.abs(act) - Math.abs(ref) : null;
      out.push({ tipo: 'asimetria', test, variable: c.v, side: null, value: Math.abs(c.asim), date: c.lado.L?.x?.date ?? null, unit: '%', ev: c.evAsim, vari: null, variPuntos });
    }
  }
  return { filas: out, sinMuestra };
}

export function Deficits({ player }) {
  const { db, version } = useApp();
  const [base, setBase] = useState('last');
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
    // Exploración de cadera (27/11/2026): no va por percentil, sino por criterio clínico, así que no pasa por `refs`. Se coge la ÚLTIMA valoración
    // válida del jugador: un grado clínico no se promedia ni se escoge «el mejor», y por eso este bloque no depende del selector Latest / PA / PB.
    const hip = testHip(catalog);
    const hipSesion = hip ? ultimaValoracion(allSessions.filter((s) => s.playerId === player.id), hip.test.id) : null;
    return { catalog, refs, minN, hip, hipSesion };
  }, [db, player.id, version]);
  if (error) return html`<p class="status fail">${error}</p>`;
  if (!data) return html`<p>Calculando déficits…</p>`;
  const { catalog, refs, minN, hip, hipSesion } = data;
  const hipDef = hip ? deficitsHip({ variables: catalog.variables, testId: hip.test.id, sesion: hipSesion }) : { fecha: null, nota: '', filas: [], explorado: 0 };
  const u = Number.isFinite(Number(umbral)) ? Math.min(99, Math.max(1, Number(umbral))) : 35;
  const porTest = refs.map(([test, refData]) => deficitsDeTest({ player, test, catalog, refData, base, umbral: u }));
  const filas = porTest.flatMap((x) => x.filas);
  const sinMuestra = porTest.flatMap((x) => x.sinMuestra);
  // 26/11/2026 (pedido del usuario): la lista se organiza POR BLOQUES, igual que «Asimetrías» —bloque → subcategoría (manifestación) → test—, en vez de
  // ir del percentil más bajo al más alto. Con muchos déficits, una lista ordenada por percentil mezcla tobillo con cadera y salto con fuerza isométrica,
  // y cuesta leer de qué va el problema; por categorías se ve de un vistazo dónde se concentra. La información de cada fila no cambia: el nombre del test
  // pasa al título de su tabla (sigue siendo el mismo enlace a su pantalla), que es como lo presenta Asimetrías.
  const ordenLado = (f) => (f.tipo === 'asimetria' ? 2 : f.side === 'L' ? 0 : f.side === 'R' ? 1 : 3);
  const mName = (t) => catalog.manifestations.find((m) => m.id === t.manifestationId)?.name ?? null;
  const zName = (t) => catalog.zones.find((z) => z.id === t.zoneId)?.name ?? null;
  const rank = (t) => { const z = (zName(t) ?? '').toLowerCase(); return z.startsWith('ankle') ? 0 : z.startsWith('knee') ? 1 : z.startsWith('hip') ? 2 : z.startsWith('groin') ? 3 : 4; };
  // Dentro de cada test, las variables conservan el orden del catálogo (el mismo que usa Normative Benchmarking) y las filas de una variable van juntas:
  // izquierda, derecha y asimetría, en ese orden.
  const testsConFilas = (() => {
    const m = new Map();
    for (const f of filas) {
      if (!m.has(f.test.id)) m.set(f.test.id, { test: f.test, vars: new Map() });
      const g = m.get(f.test.id).vars;
      if (!g.has(f.variable.id)) g.set(f.variable.id, []);
      g.get(f.variable.id).push(f);
    }
    for (const x of m.values()) for (const g of x.vars.values()) g.sort((a, b) => ordenLado(a) - ordenLado(b));
    return [...m.values()].map((x) => ({ test: x.test, grupos: [...x.vars.values()] }));
  })();
  const bloques = BLOQUES_ASIM.map(([key, nombre]) => {
    const tests = testsConFilas.filter((x) => (x.test.blockKey ?? 'fuerza') === key);
    const grupos = [...new Set(tests.map((x) => mName(x.test)))].map((g) => ({
      g, tests: tests.filter((x) => mName(x.test) === g).map((x, i) => [x, i]).sort((a, b) => rank(a[0].test) - rank(b[0].test) || a[1] - b[1]).map(([x]) => x),
    }));
    return { key, nombre, grupos };
  }).filter((b) => b.grupos.length);
  const href = (f) => buildHash(`jugador-${player.id}`, { b: f.test.blockKey ?? 'fuerza', t: f.test.id, v: f.variable.id, pn: base });
  const hrefHip = hip ? buildHash(`jugador-${player.id}`, { b: 'nme', t: hip.test.id }) : '#';
  // Bloque de la exploración de cadera: va aparte de los bloques por percentil porque no es lo mismo. Aquí el déficit es un CRITERIO clínico
  // (impingement positivo, o rango articular ≥ 2 en la escala 0–3), no una posición en la plantilla, así que la tabla no lleva percentil ni comparación.
  const bloqueHip = !hip || !hipDef.filas.length ? null : html`<${Plegable} key="hip" nivel="bloque" clase="asim-h-bloque" titulo="NME · Exploración de cadera" extra=${`${hipDef.filas.length} hallazgo(s)`}>
    <${Plegable} nivel="test" clase="asim-h-test" titulo=${html`<strong>${dn(hip.test.name)}</strong><span class="muted"> · valoración del ${fmtDay(hipDef.fecha)}</span>`}
      extra=${html`<a href=${hrefHip} onClick=${(e) => e.stopPropagation()}>ver test</a>`}>
      <div class="table-wrap asim-test"><table class="deficits hip">
        <thead><tr><th scope="col">Hallazgo</th><th scope="col">Test</th><th scope="col">Lado</th><th scope="col">Grado</th><th scope="col">Anotación</th></tr></thead>
        <tbody>${hipDef.filas.map((f) => html`<tr key=${`hip-${f.variable.id}-${f.side}`}>
          <td>${f.tipo === 'impingement' ? 'Impingement positivo' : 'Déficit de rango articular'}</td>
          <td>${dn(f.variable.name)}</td>
          <td class=${f.side === 'L' ? 'asim-l' : f.side === 'R' ? 'asim-r' : ''}>${LADO[f.side] || 'Bilateral'}</td>
          <td>${f.etiqueta}</td>
          <td class="hip-origen">${f.origen ?? '—'}</td>
        </tr>`)}</tbody></table></div>
      ${hipDef.nota ? html`<p class="hip-nota"><strong>Anotación de la valoración:</strong> ${hipDef.nota}</p>` : null}
    <//>
  <//>`;
  return html`<${Card} titulo=${`Déficits (${filas.length + hipDef.filas.length})`}>
    <${BarraFija} jugador=${playerLabel(player)}>
      <fieldset class="modes"><legend>Valor usado</legend>${BASES.map(([k, n]) => html`<label class="check" key=${k}><input type="radio" name="def-base" checked=${base === k} onChange=${() => setBase(k)} /> ${n}</label>`)}</fieldset>
      <label>Percentil La Liga igual o inferior a <input type="number" min="1" max="99" step="1" value=${umbral} onInput=${(e) => setUmbral(e.target.value)} /></label>
    <//>
    ${!filas.length
      ? html`<p class="muted">Ninguna variable de este jugador tiene un percentil de La Liga igual o inferior a ${u} con esta base. Solo se miran las variables con dirección «mejor/peor» y con al menos ${minN} jugadores en la referencia.${hipDef.filas.length ? ' La exploración de cadera va aparte, debajo: no se evalúa por percentil.' : ''}</p>`
      : bloques.map((b) => html`<${Plegable} key=${b.key} nivel="bloque" clase="asim-h-bloque" titulo=${b.nombre} extra=${`${b.grupos.reduce((n, g) => n + g.tests.length, 0)} test(s)`}>
        ${b.grupos.map((g) => html`<${Plegable} key=${g.g ?? '-'} nivel="sub" clase="asim-h-sub" titulo=${g.g ?? 'Sin manifestación'}>
          ${g.tests.map(({ test, grupos }) => html`<${Plegable} key=${test.id} nivel="test" clase="asim-h-test"
            titulo=${html`<strong>${dn(test.name)}</strong>${zName(test) ? html` <span class="muted">· ${zName(test)}</span>` : null}`}
            extra=${html`<a href=${href({ test, variable: grupos[0][0].variable })} onClick=${(e) => e.stopPropagation()}>ver test</a>`}>
            <div class="table-wrap asim-test"><table class="deficits">
            <thead><tr><th scope="col">Percentil La Liga</th><th scope="col">Variable</th><th scope="col">Lado</th><th scope="col">Valor</th><th scope="col" title=${TIP_COMP[base]}>${rotuloComp(base)}</th><th scope="col">Fecha</th></tr></thead>
            <tbody>${grupos.flatMap((gv) => gv.map((f, i) => html`<tr key=${`${f.test.id}-${f.variable.id}-${f.tipo}-${f.side ?? ''}`} class=${i === 0 ? 'grupo-ini' : ''}>
              <td><${Banda} ev=${f.ev} /></td>
              <td>${i === 0 ? dn(f.variable.name) : null}${f.tipo === 'asimetria' ? html` <span class="muted">(asimetría)</span>` : ''}</td>
              <td class=${f.side === 'L' ? 'asim-l' : f.side === 'R' ? 'asim-r' : ''}>${f.tipo === 'asimetria' ? '—' : LADO[f.side] || '—'}</td>
              <td class="num">${nf(f.value)}${f.unit ? ` ${f.unit}` : ''}</td>
              <td class="num muted" title=${f.tipo === 'asimetria' ? 'La asimetría ya es un porcentaje: su cambio se da en puntos porcentuales.' : TIP_COMP[base]}>${(f.tipo === 'asimetria' ? fmtPuntos(f.variPuntos) : fmtVar(f.vari)) ?? '—'}</td>
              <td>${f.date ? (f.from && f.from !== f.date ? `${fmtDay(f.from)} – ${fmtDay(f.date)}` : fmtDay(f.date)) : '—'}</td>
            </tr>`))}</tbody></table></div>
          <//>`)}
        <//>`)}<//>`)}
    ${bloqueHip}
    ${hip && hipSesion && !hipDef.filas.length ? html`<p class="muted">Exploración de cadera del ${fmtDay(hipDef.fecha)}: ningún impingement positivo y ningún rango articular de ${UMBRAL_ROM} o más (${hipDef.explorado} medida(s) exploradas).${hipDef.nota ? '' : ''}</p>${hipDef.nota ? html`<p class="hip-nota"><strong>Anotación de la valoración:</strong> ${hipDef.nota}</p>` : null}` : null}
    <${Desplegable} titulo="Qué entra en esta lista y qué no">
      ${sinMuestra.length ? html`<p class="muted">${sinMuestra.length} variable(s) no se han podido evaluar por muestra insuficiente y no entran en la lista: ${sinMuestra.map((x) => `${dn(x.test.name)} · ${dn(x.variable.name)}${x.side === 'S' ? '' : ` (${LADO[x.side]})`} (N = ${x.n}, mínimo ${x.minN})`).join(' · ')}.</p>` : null}
      <p class="muted">Se recorre cada test con datos del jugador y cada una de sus variables visibles, con el valor de la base elegida (Latest, Personal Average o Personal Best) y el mismo percentil de La Liga que muestra el cuadro «Normative Benchmarking» de ese test: es la misma función de cálculo, no una copia.</p>
      <p class="muted">La columna «${rotuloComp(base)}» es la misma comparación que muestra el cuadro «Normative Benchmarking»: el valor de la última sesión frente a la base elegida y, con «Latest», frente a la sesión válida anterior. En las filas de asimetría el cambio va en puntos porcentuales (p.p.), porque la asimetría ya es un porcentaje.</p>
      <p class="muted">La lista se organiza por <strong>bloques</strong>, igual que «Asimetrías»: bloque → subcategoría → test, y dentro de cada test las variables van en el orden del catálogo, con la izquierda, la derecha y la asimetría seguidas. Así se ve de un vistazo dónde se concentran los déficits, en lugar de mezclar tobillo con cadera por orden de percentil. Se listan las variables por lado (cada pierna por separado) y, además, las asimetrías: en ellas un percentil bajo significa una asimetría grande comparada con la de los demás jugadores.</p>
      <p class="muted">En los tests cuya medida es una <strong>carga externa</strong> —los iso-hold y todos los de RM— solo se lista el <strong>%BW</strong>: los kilos no se pueden comparar entre jugadores de distinto tamaño, y el MVIC iso-push, el %PIMA y el 1RM estimado se calculan a partir de esa misma carga, así que serían el mismo déficit contado varias veces. La asimetría del test sigue apareciendo: sale del %BW y es la misma que la de los kilos.</p>
      <p class="muted">La <strong>exploración de cadera</strong> (NME) se evalúa aparte y por criterio clínico, no por percentil: entran los <strong>impingement positivos</strong> y todo <strong>rango articular igual o superior a ${UMBRAL_ROM}</strong> en la escala del usuario (${GRADOS_ROM.map((g) => `${g.valor} = ${g.etiqueta.toLowerCase()}`).join(', ')}). En las <strong>rotaciones</strong> se anota el origen del déficit según la postura en la que se exploró: en decúbito supino, compromiso articular; en decúbito prono, origen muscular. La flexión de cadera y el Bent Knee Over no llevan anotación de origen. Se mira siempre la <strong>última valoración</strong>, con su fecha, al margen del selector Latest / Personal Average / Personal Best: un grado clínico es la foto de un día, no una media.</p>
      <p class="muted">No entran: las variables sin dirección «mejor/peor» (ahí el percentil solo dice dónde cae en La Liga, no si es bueno o malo), las que no llegan al mínimo de ${minN} jugadores en la referencia, los valores que el jugador no tiene con esa base, y los tests archivados, las variables marcadas como excluidas en el Catálogo (por defecto Torque del Nordic y Force/RFD at 100 ms) y la medida absoluta cuando existe su relativa al peso con datos (se lista solo la relativa). La referencia nunca incluye al propio jugador ni datos sintéticos.</p>
    <//>
  <//>`;
}
