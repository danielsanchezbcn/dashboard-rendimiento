// pages-composite.js — bloque «COMPOSITE PROFILE SCORE» (encargo del usuario, especificación v0.3 del 13/11/2026).
// Tabla de las 7 cualidades con su puntuación en color, radar de percentiles 0–100 con las referencias de La Liga, y desglose de cada cualidad
// con sus variables de puntuación (con peso) y sus interpretativas. Los percentiles salen de `columnasNormativas`, la MISMA función que dibuja
// Normative Benchmarking y alimenta Déficits: un número de aquí se puede rastrear hasta la tabla de su test.
import { html, useState, useRef } from './libs.js';
import { useApp } from './context.js';
import { useLoad, Card, Desplegable } from './componentes.js';
import { listCatalog } from './catalogo.js';
import { listPositions, positionOnDate } from './posiciones.js';
import { getSetting } from './db.js';
import { expandRelative } from './relativos.js';
import { withReferenceWeights, massNearest, relationsFor, ratioReferences, strengthOrientation, locate } from './relaciones.js';
import { columnasNormativas } from './pages-normativo.js';
import { Banda } from './pages-percentiles.js';
import { MIN_N_DEFAULT, perfQuantile, bandFor, BANDS } from './percentiles.js';
import { fitLoadVelocity, classText } from './fuerzavelocidad.js';
import { CUALIDADES, UMBRALES_DEFAULT, T, claveDesc, calcular, referenciaPosicional, pesosDe, expandirImpulsos, alturaDropJump, orientacionDe, tendencia, DESC_IMP100, DESC_CPP } from './composite.js';
import { BotonesImagen, Copiable, chartToBlob } from './copiar.js';
import { FUENTE_GRAFICOS } from './fuentes.js';
import { PAL } from './colores.js';
import { fmtDay } from './fechas.js';
import { mismoTest } from './nombres.js';
import { playerLabel } from './jugadores.js';

const FONT = FUENTE_GRAFICOS;
const lc = (s) => String(s ?? '').trim().toLowerCase();
const nf = (n, d = 2) => (n === null || n === undefined || !Number.isFinite(n) ? '—' : Number(n).toLocaleString('es-ES', { maximumFractionDigits: d }));
const pc = (p) => (Number.isFinite(p) ? String(Math.round(p)) : '—');
const BASES = [['last', 'Latest'], ['pa', 'PA'], ['pb', 'PB']];
const REFS = [['p50', 'P50 La Liga'], ['p50pos', 'P50 posicional'], ['p75', 'P75 La Liga'], ['p75pos', 'P75 posicional']];
const BACK_SQUAT = 'Back Squat Force–Velocity Profile';
const SIN_DATOS = '—';

// ---- Radar de las 7 cualidades (3.9): los ejes YA son percentiles, así que la escala es 0–100 fija y no se normaliza por el P50.
// Mismo estilo que el radar del CMJ (negro, Agency FB, jugador en blanco y referencias en amarillo), pero gráfico aparte: el del CMJ no se toca.
const W = 1000, CX = 500, CY = 300, RREF = 190, R0 = 0;
const LINEAS = { jugador: { color: PAL.jugador, w: 5, dash: null }, p50: { color: PAL.laLiga, w: 4, dash: null }, p75: { color: PAL.laLiga, w: 3, dash: [10, 6] }, p50pos: { color: PAL.laLiga, w: 3, dash: [14, 6, 2, 6] }, p75pos: { color: PAL.laLiga, w: 2, dash: [2, 6] } };
function wrap(label, max = 15) {
  if (label.length <= max || !label.includes(' ')) return [label];
  const words = label.split(' '); const out = []; let cur = '';
  for (const w of words) { if (cur && (cur + ' ' + w).length > max) { out.push(cur); cur = w; } else cur = cur ? cur + ' ' + w : w; }
  if (cur) out.push(cur);
  return out;
}
export function RadarCualidades({ ejes, series, playerName, svgRef }) {
  const n = ejes.length;
  const ang = (i) => ((-90 + (i * 360) / n) * Math.PI) / 180;
  const rOf = (p) => R0 + (Math.max(0, Math.min(100, p)) / 100) * (RREF - R0);
  const pt = (i, p) => [CX + Math.cos(ang(i)) * rOf(p), CY + Math.sin(ang(i)) * rOf(p)];
  // Un eje sin puntuación («—», falta el dato) deja un HUECO: nunca se dibuja como 0 (3.9).
  const trazos = (vals) => {
    const segs = []; let cur = [];
    for (let i = 0; i < n; i++) {
      const v = vals[i];
      if (Number.isFinite(v)) cur.push(pt(i, v).map((x) => x.toFixed(1)).join(','));
      else { if (cur.length > 1) segs.push(cur); cur = []; }
    }
    if (cur.length > 1) segs.push(cur);
    const completo = vals.every((v) => Number.isFinite(v));
    if (completo) return [{ pts: vals.map((v, i) => pt(i, v).map((x) => x.toFixed(1)).join(',')).join(' '), cerrado: true }];
    return segs.map((sg) => ({ pts: sg.join(' '), cerrado: false }));
  };
  const geo = ejes.map((e, i) => {
    const c = Math.cos(ang(i)), s = Math.sin(ang(i));
    const arriba = s < -0.9, abajo = s > 0.9;
    const lineas = wrap(e.nombre);
    const RR = RREF + 16;
    const x = CX + c * RR, y = CY + s * RR;
    const marca = e.texto ?? pc(e.valor);
    if (arriba || abajo) {
      const y0 = arriba ? y - 22 - (lineas.length - 1) * 23 : y + 32;
      return { i, x, lineas, y0, yMarca: arriba ? y0 - 30 : y0 + (lineas.length - 1) * 23 + 30, anchor: 'middle', marca, gris: e.gris, yMax: Math.max(y0 + (lineas.length - 1) * 23, arriba ? y0 : y0 + (lineas.length - 1) * 23 + 30) };
    }
    const der = c > 0; const lx = x + (der ? 10 : -10); const y0 = y + (s < 0 ? -2 : 6) - (lineas.length - 1) * 11;
    return { i, x: lx, lineas, y0, yMarca: y0 + (lineas.length - 1) * 23 + 26, anchor: der ? 'start' : 'end', marca, gris: e.gris, yMax: y0 + (lineas.length - 1) * 23 + 26 };
  });
  const yEtiq = Math.max(...geo.map((g) => g.yMax));
  const dibujadas = series.filter((sr) => sr.vals.some((v) => Number.isFinite(v)));
  const filas = Math.ceil(dibujadas.length / 2);
  const yLeg = yEtiq + 34;
  const HH = Math.round(yLeg + Math.max(0, filas - 1) * 26 + 18);
  return html`<svg ref=${svgRef} xmlns="http://www.w3.org/2000/svg" viewBox=${`0 0 ${W} ${HH}`} width="100%" role="img" class="radar-svg"
      aria-label=${`Composite profile radar for ${playerName}: ${ejes.map((e) => `${e.nombre} ${e.texto ?? pc(e.valor)}`).join('; ')}`}>
    <rect width=${W} height=${HH} fill="#000" />
    ${dibujadas.map((sr) => { const st = LINEAS[sr.clave]; return trazos(sr.vals).map((tz, k) => (tz.cerrado
      ? html`<polygon key=${sr.clave + k} points=${tz.pts} fill="none" stroke=${st.color} stroke-width=${st.w} stroke-dasharray=${st.dash?.join(' ') ?? null} stroke-linejoin="round" />`
      : html`<polyline key=${sr.clave + k} points=${tz.pts} fill="none" stroke=${st.color} stroke-width=${st.w} stroke-dasharray=${st.dash?.join(' ') ?? null} stroke-linejoin="round" />`)); })}
    ${geo.map((g) => html`<g key=${g.i}>
      ${g.lineas.map((l, k) => html`<text key=${k} x=${g.x} y=${g.y0 + k * 23} text-anchor=${g.anchor} font-family=${FONT} font-size="21" font-weight="700" fill=${g.gris ? '#8a8a8a' : '#ffffff'}>${l}</text>`)}
      <text x=${g.x} y=${g.yMarca} text-anchor=${g.anchor} font-family=${FONT} font-size="26" font-weight="700" fill=${g.gris ? '#8a8a8a' : '#ffffff'}>${g.marca}</text></g>`)}
    <text x=${CX} y=${CY + 8} text-anchor="middle" font-family=${FONT} font-size="20" fill="#8a8a8a">0 · centre</text>
    <g font-family=${FONT} font-size="19">${(() => {
      const ancho = (sr) => 72 + sr.nombre.length * 9; const GAP = 50;
      const filasK = []; for (let q = 0; q < dibujadas.length; q += 2) filasK.push(dibujadas.slice(q, q + 2));
      return filasK.map((fila, r) => { const total = fila.reduce((a, sr) => a + ancho(sr), 0) + GAP * (fila.length - 1); let x = (W - total) / 2; const y = yLeg + r * 26;
        return fila.map((sr) => { const st = LINEAS[sr.clave]; const x0 = x; x += ancho(sr) + GAP;
          return html`<g key=${sr.clave}><line x1=${x0} x2=${x0 + 60} y1=${y} y2=${y} stroke=${st.color} stroke-width=${st.w} stroke-dasharray=${st.dash?.join(' ') ?? null} /><text x=${x0 + 72} y=${y + 6} fill=${st.color}>${sr.nombre}</text></g>`; }); });
    })()}</g>
  </svg>`;
}

// ---- Puntuación con el color del percentil exacto de La Liga (mismo código de color que el resto del dashboard).
const Puntuacion = ({ q }) => (q.estado === 'ok'
  ? html`<span class=${'band band-' + BANDS[bandFor(q.score)].key} title=${`${BANDS[bandFor(q.score)].name} (P${BANDS[bandFor(q.score)].range})`}>${q.score}</span>`
  : html`<span class="muted">${SIN_DATOS}</span>`);

const fechaTexto = (x) => (!x?.date ? '—' : x.from && x.from !== x.date ? `${fmtDay(x.from)} – ${fmtDay(x.date)}` : fmtDay(x.date));

export function CompositeProfile({ player, positionId = null }) {
  const { db, version } = useApp();
  const [base, setBase] = useState('last');
  const [refs, setRefs] = useState(['p50']);
  const refTabla = useRef(null), refSvg = useRef(null), refRadar = useRef(null);
  const { data, error } = useLoad(async () => {
    const catalog = await listCatalog(db);
    const [allSessions, players, records, positions, mn, anthropometry, fvProfiles, cfg] = await Promise.all([
      db.sessions.toArray(), db.players.toArray(), db.playerPositions.toArray(), listPositions(db), getSetting(db, 'percentileMinN'), db.anthropometry.toArray(), db.fvProfiles.toArray(), getSetting(db, 'compositeConfig'),
    ]);
    const minN = Number.isInteger(mn) && mn >= 1 ? mn : MIN_N_DEFAULT;
    const anth = withReferenceWeights(anthropometry, players);
    const testDe = (nombre) => catalog.tests.find((t) => mismoTest(t.name, nombre) && !t.archived) ?? null;
    const porTest = new Map();
    for (const s of allSessions) (porTest.get(s.testId) ?? porTest.set(s.testId, []).get(s.testId)).push(s);
    // Un «refData» por test, igual que en Déficits: sesiones de TODOS los jugadores con las variables relativas ya calculadas.
    const prep = (nombre) => {
      const test = testDe(nombre);
      if (!test) return null;
      const crudas = porTest.get(test.id) ?? [];
      const { sessions } = expandRelative(catalog.variables, test.id, crudas, anth, { tests: catalog.tests, allSessions });
      const imp = expandirImpulsos({ variables: catalog.variables, testId: test.id, sessions, anthropometry: anth });
      return { test, refData: { sessions: imp.sessions, players, records, positions, minN }, variables: [...catalog.variables.filter((v) => v.testId === test.id), ...imp.variables], sinMasa: imp.sinMasa };
    };
    const tests = {};
    for (const nombre of [T.cmj, T.knee, T.hop, T.dj30, T.dj45]) { const p = prep(nombre); if (p) tests[nombre] = p; }
    // DSI, EUR y ORZ: las funciones ya existentes de «Relaciones» (mismos números y mismas etiquetas que allí).
    const loc = locate(catalog.tests, catalog.variables);
    const playersById = Object.fromEntries(players.map((p) => [p.id, p]));
    const rel = ratioReferences({ loc, sessions: allSessions, anthropometry: anth, players: playersById, playerId: player.id, minN });
    const mias = relationsFor({ loc, sessions: allSessions, anthropometry: anth, playerId: player.id });
    // Perfil carga-velocidad del Back Squat: el más reciente de ese test (etiqueta existente).
    const bs = testDe(BACK_SQUAT);
    const perfiles = fvProfiles.filter((p) => p.playerId === player.id && bs && (p.testId ?? null) === bs.id).sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
    const fv = perfiles.length ? fitLoadVelocity(perfiles[0].points, { fdmVelocity: perfiles[0].fdmVelocity, mass: massNearest(anth.filter((a) => a.playerId === player.id), perfiles[0].date)?.kg ?? null }) : null;
    const posActual = positionOnDate(records.filter((r) => r.playerId === player.id)).principal?.positionId ?? positionId;
    return { catalog, tests, minN, rel, mias, fv, fvFecha: perfiles[0]?.date ?? null, posActual, positions, cfg: cfg ?? {}, nJugadores: players.filter((p) => !p.synthetic).length };
  }, [db, player.id, version]);
  if (error) return html`<p class="status fail">${error}</p>`;
  if (!data) return html`<p>Calculando el perfil…</p>`;
  const { catalog, tests, minN, rel, mias, fv, fvFecha, posActual, positions, cfg } = data;
  const umbrales = { ...UMBRALES_DEFAULT, ...(cfg.umbrales ?? {}) };
  const pesos = cfg.pesos ?? {};

  // ---- ORZ (3.4): la altura del Drop Jump con mayor RSI de Personal Average; con una sola altura, esa; con empate exacto, la media de las dos.
  const hayDj = (n) => !!tests[n] && tests[n].refData.sessions.some((s) => s.playerId === player.id);
  const dj = alturaDropJump({ orz: mias.orz, hay30: hayDj(T.dj30), hay45: hayDj(T.dj45) });
  const djTests = dj.alturas.map((h) => (h === 30 ? T.dj30 : T.dj45));
  const orzNota = dj.motivo === 'orz' ? `ORZ: ${dj.alturas[0]} cm (mayor RSI de Personal Average)`
    : dj.motivo === 'empate' ? 'Empate exacto de RSI entre 30 y 45 cm: no hay ORZ, se usa la media de los percentiles de las dos alturas'
    : dj.motivo === 'unica' ? `Solo hay una altura testada (${dj.alturas[0]} cm): se usa esa` : 'Sin sesiones de Drop Jump';

  // ---- Columnas (valores y percentiles) de cada test, con la base elegida. positionId = null: el percentil del jugador es SIEMPRE el de La Liga completa.
  const columnas = {};
  for (const [nombre, t] of Object.entries(tests)) {
    const mine = t.refData.sessions.filter((s) => s.playerId === player.id);
    const necesarias = new Set();
    const recoger = (d) => { if (!d.tipo && (d.orz ? djTests.includes(nombre) : mismoTest(d.test, nombre))) necesarias.add(lc(d.rel ? d.variable + '/BM' : d.variable)); };
    for (const c of CUALIDADES) { for (const s of c.scores) { recoger(s); (s.interp ?? []).forEach(recoger); } c.interp.forEach(recoger); }
    recoger(DESC_IMP100); recoger(DESC_CPP); // la comparación propulsivo / explosivo necesita los dos percentiles
    const vars = t.variables.filter((v) => necesarias.has(lc(v.name)) && !v.archived);
    columnas[nombre] = vars.length && mine.length
      ? columnasNormativas({ player, test: t.test, catalog, sessions: mine, refData: t.refData, vars, base, f: {}, positionId: null })
      : [];
  }

  // ---- Una medida por descriptor: valor, percentil de La Liga, fecha y, con dos lados, cada pierna por separado (3.6).
  // Los nombres se comparan sin distinguir mayúsculas (y los tests con `mismoTest`), como en el resto de la aplicación: si renombras una
  // variable cambiando una mayúscula, el bloque tiene que seguir encontrándola (14/11/2026).
  const colDe = (nombre, varName) => (columnas[nombre] ?? []).find((c) => lc(c.v.name) === lc(varName)) ?? null;
  const medidaCol = (col, nombre) => {
    if (!col) return null;
    const partes = col.sides.map((sd) => {
      const l = col.lado[sd] ?? {};
      const pct = l.ev && l.ev.sufficient && Number.isFinite(l.ev.percentilePerf) ? l.ev.percentilePerf : null;
      return { sd, x: l.x ?? null, ev: l.ev ?? null, pct };
    });
    const con = partes.filter((p) => p.pct !== null);
    return { pct: con.length ? con.reduce((a, p) => a + p.pct, 0) / con.length : null, partes, v: col.v, test: nombre, n: partes.find((p) => p.ev)?.ev?.n ?? 0 };
  };
  const cache = new Map();
  const medida = (d) => {
    if (!d || d.tipo) return medidaEspecial(d);
    const k = claveDesc(d);
    if (cache.has(k)) return cache.get(k);
    const varName = d.rel ? d.variable + '/BM' : d.variable;
    let out = null;
    if (d.orz) {
      const ms = djTests.map((n) => medidaCol(colDe(n, varName), n)).filter((x) => x && Number.isFinite(x.pct));
      // Empate de ORZ: media de los percentiles de las dos alturas (3.4).
      out = ms.length ? (ms.length === 1 ? ms[0] : { ...ms[0], pct: ms.reduce((a, x) => a + x.pct, 0) / ms.length, varias: ms }) : null;
    } else out = medidaCol(colDe(d.test, varName), d.test);
    cache.set(k, out);
    return out;
  };
  // Conclusiones de texto: no puntúan, se muestran con su etiqueta (3.5).
  function medidaEspecial(d) {
    if (d.tipo === 'dsi') {
      const kneeEvs = [{ label: 'L', ev: rel.kneeL }, { label: 'R', ev: rel.kneeR }];
      const filas = ['L', 'R'].map((sd) => {
        const ev = sd === 'L' ? rel.dsiL : rel.dsiR;
        const val = mias.dsi[sd];
        const knee = (sd === 'L' ? rel.kneeL : rel.kneeR);
        const kneePct = knee && knee.sufficient ? knee.percentilePerf : null;
        // La orientación la decide `strengthOrientation`, que ya aplica la regla del usuario (14/11/2026): con el Knee Iso-Push de ESA pierna por
        // debajo del percentil 35 de La Liga, la orientación es siempre «Iso max strength training orientation», sea cual sea el ratio del DSI.
        const o = strengthOrientation('dsi', ev, kneeEvs.filter((k) => k.label === sd), umbrales.p35);
        return { sd, defined: val.defined, value: val.defined ? val.value : null, ev, kneePct, etiqueta: o?.text ?? null, nota: o?.kneeNote ?? null, razon: val.defined ? null : val.reason };
      });
      return { tipo: 'dsi', filas };
    }
    if (d.tipo === 'eur') {
      const e = mias.eur;
      return { tipo: 'eur', defined: e.defined, value: e.defined ? e.value : null, ev: rel.eur, etiqueta: strengthOrientation('eur', rel.eur)?.text ?? null, razon: e.defined ? null : e.reason };
    }
    if (d.tipo === 'fv') return { tipo: 'fv', etiqueta: fv && fv.ok ? classText(fv.class) : null, fecha: fvFecha, razon: !fv ? 'Sin datos' : fv.ok ? null : fv.reason };
    // Interpretativa que mira la puntuación de OTRA cualidad (Reactivity lee Dynamic Strength; Propulsive lee Reactivity): el número ya está calculado.
    if (d.tipo === 'cualidad') { const q = porId[d.id]; return q && q.score !== null ? { tipo: 'cualidad', pct: q.score } : null; }
    return null;
  }

  const qs = calcular({ medida, umbrales, pesos });
  const porId = Object.fromEntries(qs.map((q) => [q.id, q]));

  // ---- Referencias del radar: P50 y P75 de La Liga son polígonos regulares; las posicionales se combinan con los mismos pesos (3.9).
  const pctPosicional = (d, p) => {
    if (d.tipo || posActual == null) return null;
    const varName = d.rel ? d.variable + '/BM' : d.variable;
    const nombres = d.orz ? djTests : [d.test];
    const vs = nombres.map((n) => colDe(n, varName)).filter(Boolean);
    const out = vs.map((col) => {
      const vals = col.ctx.entries(base, posActual).filter((e) => e.playerId !== player.id).map((e) => e.value);
      if (vals.length < minN) return null;
      const q = perfQuantile(vals, p, col.v.direction);
      if (!Number.isFinite(q)) return null;
      const ev = col.ctx.evalValor(q, base, null);
      return ev.sufficient && Number.isFinite(ev.percentilePerf) ? ev.percentilePerf : null;
    }).filter((x) => x !== null);
    return out.length ? out.reduce((a, x) => a + x, 0) / out.length : null;
  };
  // Una sola lista de referencias para la TABLA y el RADAR: las columnas que se ven en el cuadro son exactamente los polígonos que se dibujan,
  // así que no pueden contarse cosas distintas (13/11/2026, pedido por el usuario).
  const referencias = [
    ...(refs.includes('p50') ? [{ clave: 'p50', nombre: 'P50 La Liga', vals: qs.map(() => 50) }] : []),
    ...(refs.includes('p50pos') ? [{ clave: 'p50pos', nombre: `P50 ${posNombre(positions, posActual)}`, vals: CUALIDADES.map((c) => referenciaPosicional(c, (d) => pctPosicional(d, 0.5), pesos)) }] : []),
    ...(refs.includes('p75') ? [{ clave: 'p75', nombre: 'P75 La Liga', vals: qs.map(() => 75) }] : []),
    ...(refs.includes('p75pos') ? [{ clave: 'p75pos', nombre: `P75 ${posNombre(positions, posActual)}`, vals: CUALIDADES.map((c) => referenciaPosicional(c, (d) => pctPosicional(d, 0.75), pesos)) }] : []),
  ];
  const series = [{ clave: 'jugador', nombre: 'Player', vals: qs.map((q) => (q.estado === 'ok' ? q.score : null)) }, ...referencias];
  // Un eje solo deja hueco cuando FALTA el dato (14/11/2026): ya no hay cualidades anuladas por regla.
  const ejes = qs.map((q) => ({ nombre: q.nombre, valor: q.score, texto: q.estado === 'ok' ? null : SIN_DATOS, gris: q.estado !== 'ok' }));

  // N de la referencia: el número de jugadores con los que se ha comparado, que depende de la variable.
  const enes = qs.flatMap((q) => q.scores.map((s) => s.med?.n).filter((x) => Number.isFinite(x) && x > 0));
  const nTexto = enes.length ? (Math.min(...enes) === Math.max(...enes) ? `${Math.max(...enes)}` : `${Math.min(...enes)}–${Math.max(...enes)}`) : '0';

  const toggleRef = (k) => setRefs(refs.includes(k) ? refs.filter((x) => x !== k) : [...refs, k]);
  const etiquetaVar = (d, med) => (d.tipo === 'dsi' ? 'DSI' : d.tipo === 'eur' ? 'EUR' : d.tipo === 'fv' ? 'Back Squat load–velocity profile' : d.tipo === 'cualidad' ? porId[d.id]?.nombre ?? d.id : `${d.orz ? (med?.varias ? '30 + 45 cm' : `${dj.alturas[0] ?? '—'} cm`) + ' · ' : ''}${d.variable}${d.rel ? '/BM' : ''}`);

  // ---- Comparación propulsivo / explosivo (14/11/2026): se decide con los percentiles de los dos impulsos, no con los valores.
  const textoTendencia = tendencia(medida);

  // Una fila del desglose: SEIS columnas, en el orden pedido por el usuario (14/11/2026).
  // Variable | Percentil La Liga | Valor | Orientation | Fecha | Peso / etiqueta
  const fila = (k, { variable, percentil, valor, orientacion, nota = null, fecha, peso }) => html`<tr key=${k}>
    <th scope="row">${variable}</th>
    <td>${percentil ?? html`<span class="muted">${SIN_DATOS}</span>`}</td>
    <td class="num">${valor ?? html`<span class="muted">${SIN_DATOS}</span>`}</td>
    <td>${orientacion ? html`<span title=${nota ?? ''}>${orientacion}</span>` : html`<span class="muted">${SIN_DATOS}</span>`}</td>
    <td>${fecha ?? html`<span class="muted">${SIN_DATOS}</span>`}</td>
    <td>${peso ?? html`<span class="muted">${SIN_DATOS}</span>`}</td></tr>`;
  const pesoTexto = (peso) => (peso === null ? null : html`<span class="muted">${pc(peso * 100)} %</span>`);

  const filaMedida = (d, med, peso = null) => {
    if (d.tipo === 'dsi') return med.filas.map((f) => fila('dsi' + f.sd, {
      variable: `DSI ${f.sd === 'L' ? 'izquierda' : 'derecha'}`,
      percentil: f.ev ? html`<${Banda} ev=${f.ev} />` : null,
      valor: f.defined ? nf(f.value) : html`<span class="muted">${f.razon}</span>`,
      orientacion: f.etiqueta, nota: f.nota, fecha: null, peso: html`<span class="muted">interpretativa</span>`,
    }));
    if (d.tipo === 'eur') return fila('eur', {
      variable: 'EUR', percentil: med.ev ? html`<${Banda} ev=${med.ev} />` : null,
      valor: med.defined ? nf(med.value) : html`<span class="muted">${med.razon}</span>`,
      orientacion: med.etiqueta, fecha: null, peso: html`<span class="muted">interpretativa</span>`,
    });
    if (d.tipo === 'fv') return fila('fv', {
      variable: 'Back Squat load–velocity profile', percentil: null, valor: null,
      orientacion: med.etiqueta, nota: med.razon, fecha: med.fecha ? fmtDay(med.fecha) : null, peso: html`<span class="muted">interpretativa</span>`,
    });
    if (d.tipo === 'cualidad') return fila('q' + d.id, {
      variable: etiquetaVar(d), percentil: med && Number.isFinite(med.pct) ? pc(med.pct) : null, valor: null,
      orientacion: orientacionDe(d, med?.pct, umbrales), fecha: null, peso: html`<span class="muted">puntuación de la cualidad</span>`,
    });
    const u = med?.v?.unit ? ` ${med.v.unit}` : '';
    if (!med) return fila(etiquetaVar(d, med), { variable: etiquetaVar(d, med), percentil: null, valor: null, orientacion: null, nota: 'Sin dato con esta base', fecha: null, peso: pesoTexto(peso) ?? html`<span class="muted">interpretativa</span>` });
    return med.partes.map((p, i) => fila(etiquetaVar(d, med) + p.sd, {
      variable: html`${i === 0 ? etiquetaVar(d, med) : ''}${med.partes.length > 1 ? html` <span class="muted">${p.sd === 'L' ? 'izquierda' : 'derecha'}</span>` : null}`,
      percentil: p.ev ? html`<${Banda} ev=${p.ev} />` : null,
      valor: p.x ? `${nf(p.x.value)}${u}` : null,
      orientacion: orientacionDe(d, p.pct, umbrales) ?? (d.tendencia && i === 0 ? textoTendencia : null),
      fecha: p.x ? fechaTexto(p.x) : null,
      peso: i === 0 ? pesoTexto(peso) ?? html`<span class="muted">interpretativa</span>` : null,
    }));
  };

  const desglose = (q) => {
    const cual = CUALIDADES.find((c) => c.id === q.id);
    const ps = pesosDe(cual, pesos);
    const sumaP = ps.reduce((a, b) => a + b, 0) || 1;
    return html`<${Desplegable} titulo=${`${q.nombre} · ${q.estado === 'ok' ? q.score : SIN_DATOS}${q.orientacion ? ' · ' + q.orientacion : ''}`}>
      ${q.orientacion ? html`<p class="status" role="status">${q.nombre}: ${q.orientacion}</p>` : null}
      ${q.estado !== 'sin-datos' && q.usadas < q.total ? html`<p class="muted">Calculado con ${q.usadas} de ${q.total} variables de puntuación: el peso se reparte entre las que hay.</p>` : null}
      ${q.faltaCritica ? html`<p class="muted">Falta la variable principal de esta cualidad, así que no se puntúa (${SIN_DATOS}).</p>` : null}
      ${q.id === 'shortgct' ? html`<p class="muted">${orzNota}.</p>` : null}
      <div class="table-wrap"><table class="composite-det">
        <thead><tr><th scope="col">Variable</th><th scope="col">Percentil La Liga</th><th scope="col">Valor</th><th scope="col">Orientation</th><th scope="col">Fecha</th><th scope="col">Peso / etiqueta</th></tr></thead>
        <tbody>
          ${cual.scores.flatMap((s, i) => [filaMedida(s, q.scores[i].med, ps[i] / sumaP), ...(s.interp ?? []).map((it) => filaMedida(it, medida(it), null))])}
          ${cual.interp.map((it) => filaMedida(it, medida(it), null))}
        </tbody></table></div>
    <//>`;
  };

  return html`<${Card} titulo="COMPOSITE PROFILE SCORE">
    <div class="filters">
      <fieldset class="modes"><legend>Valor</legend>${BASES.map(([k, n]) => html`<label class="check" key=${k}><input type="radio" name="cps-base" checked=${base === k} onChange=${() => setBase(k)} /> ${n}</label>`)}</fieldset>
      <fieldset class="modes"><legend>Referencia La Liga (radar)</legend>${REFS.map(([k, n]) => { const off = k.endsWith('pos') && posActual == null; return html`<label class="check" key=${k} title=${off ? 'El jugador no tiene posición principal.' : ''}><input type="checkbox" disabled=${off} checked=${!off && refs.includes(k)} onChange=${() => toggleRef(k)} /> ${n}</label>`; })}</fieldset>
    </div>
    <${BotonesImagen} rotulo="Tabla" obtener=${() => refTabla.current} nombre=${`composite-${player.id}`} titulo=${`COMPOSITE PROFILE SCORE · ${playerLabel(player)}`} />
    <div ref=${refTabla}><div class="table-wrap"><table class="composite">
      <thead><tr><th scope="col">Cualidad</th><th scope="col">${BASES.find(([k]) => k === base)[1]}</th>${referencias.map((r) => html`<th scope="col" key=${r.clave}>${r.nombre}</th>`)}</tr></thead>
      <tbody>${qs.map((q, i) => html`<tr key=${q.id}><th scope="row">${q.nombre}</th><td><${Puntuacion} q=${q} /></td>
        ${referencias.map((r) => html`<td key=${r.clave} class="ref">${Number.isFinite(r.vals[i]) ? r.vals[i] : SIN_DATOS}</td>`)}</tr>`)}</tbody>
    </table></div>
    <p class="muted">Percentiles sobre N = ${nTexto} jugadores de la base.</p></div>
    ${qs.map((q) => html`<div key=${q.id}>${desglose(q)}</div>`)}
    <div ref=${refRadar}><${Copiable} nombre=${`composite-radar-${player.id}`}><${RadarCualidades} ejes=${ejes} series=${series} playerName=${playerLabel(player)} svgRef=${refSvg} /><//></div>
    <${BotonesImagen} rotulo="Radar" obtener=${() => refRadar.current} hacerBlob=${() => chartToBlob(refRadar.current)} nombre=${`composite-radar-${player.id}`} />
    <${NotaMetodo} umbrales=${umbrales} minN=${minN} />
  <//>`;
}

const posNombre = (positions, id) => (id == null ? 'posición' : positions.find((p) => p.id === id)?.name ?? 'posición');

const NotaMetodo = ({ umbrales, minN }) => html`<${Desplegable} titulo="Cómo se calcula">
  <p class="muted">Cada cualidad es la media ponderada de los percentiles de rendimiento de La Liga de sus variables de puntuación, redondeada a entero. Los percentiles son los mismos que muestra «Normative Benchmarking» de cada test: la referencia excluye al propio jugador y a los sintéticos, y hace falta un mínimo de ${minN} jugadores. Las variables interpretativas nunca puntúan: están para leer el número.</p>
  <p class="muted">Las 7 cualidades puntúan siempre que haya datos (14/11/2026): ninguna regla anula una cualidad. Lo que antes era «No aplicable» es ahora un texto en la columna «Orientation», que dice qué hacer con ese número: jump height por debajo de p${umbrales.p35} → «Prioritize foundational dynamic strength»; depth o contraction time por debajo de p${umbrales.p10} → «Prioritize Dynamic strength depth»; por encima de p${umbrales.p65} → «Propulsive strategy»; Dynamic Strength por encima de p${umbrales.p65} → «Prioritize Power», y por debajo de p${umbrales.p35} → «Prioritize Strength». En Propulsive y en Explosive / Snappy se compara además el percentil de con impulse 100 ms con el de con peak power, y se indica qué tendencia domina. Con el Knee Iso-Push por debajo de p${umbrales.p35} de La Liga, la orientación del DSI es siempre «Iso max strength training orientation», sea cual sea el ratio. «${SIN_DATOS}» significa que no hay datos suficientes para puntuar, y nunca se muestra como 0.</p>
  <p class="muted">Los impulsos (con impulse, con impulse 100 ms y ecc deceleration impulse) llegan de VALD en N·s absolutos y aquí se usan divididos por la masa corporal (N·s/kg), también en la referencia de La Liga: comparar un valor relativo con una referencia absoluta sería un error. La masa es la medida más cercana a la fecha de la sesión (la misma regla que el resto del dashboard); sin masa utilizable, esa sesión no tiene impulso relativo. En el Drop Jump se usa la altura de la ORZ, y las interpretativas son de esa misma altura. Los tests de Groin, Hip y Ankle no entran en este bloque.</p>
  <p class="muted">El radar tiene los ejes en percentil 0–100 (el centro es 0) y no normaliza por el P50, porque los ejes ya son percentiles: por eso el P50 y el P75 de La Liga son polígonos regulares. Las referencias posicionales son, para cada variable, el percentil de La Liga del P50 (o P75) de la posición del jugador, combinado con los mismos pesos de la cualidad. Un eje sin puntuación deja un hueco en el polígono; nunca se dibuja como 0.</p>
<//>`;
