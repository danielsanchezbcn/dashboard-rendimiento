// pages-asimetrias.js — bloque «Asimetrías» del perfil del jugador (10/11/2026): todas las asimetrías del jugador organizadas por bloque → subcategoría → test → variable.
// Cada fila lleva una barra desde el eje central: hacia la izquierda y azul si domina Left, hacia la derecha y naranja si domina Right. Longitud proporcional a la magnitud, con una escala común.
// Variables por lado (L y R): asimetría D25 = (R − L) ÷ máx × 100; en grados (ángulos) = R − L en °, con su propia escala. Variables «ASYM» de VALD (un valor con signo, %): se usan tal cual.
// Valores de la base elegida (Personal Average, Personal Best o Actual), calculados con las mismas funciones que el resto del perfil. Las variables relativas (BW/SW) no se repiten.
import { html } from './libs.js';
import { orderVars, isViewable, hasData, isRelative } from './relativos.js';
import { isAsymVariable, asymText, esGrados, asimetriaLR, testExcluidoDeAsimetrias, variableExcluidaDeAsimetrias } from './catalogo.js';
import { valorBase, valorPrevio, variacionBase, fmtVar, fmtPuntos, rotuloComp, TIP_COMP } from './evolucion.js';
import { AsimTexto } from './asim-ui.js';
import { fmtDay } from './fechas.js';
import { dn } from './nombres.js';
import { Desplegable } from './componentes.js';

// Variables de asimetría (VALD) del catálogo de un test en las que este jugador no tiene ningún valor.
export const asimSinDatos = (test, catalog, tsess) => orderVars(candidatas(test, catalog).filter((v) => isAsymVariable(v) && isViewable(v) && !hasData(v, tsess)));
export const BLOQUES_ASIM = [['fuerza', 'Manifestaciones de la fuerza'], ['perimetros', 'Datos antropométricos'], ['nme', 'NME']];
const BASES = [['pa', 'Personal Average'], ['pb', 'Personal Best'], ['last', 'Actual']];
const nf = (n, d = 1) => (n === null || n === undefined || !Number.isFinite(n) ? '—' : Number(n).toLocaleString('es-ES', { maximumFractionDigits: d }));

// Valor y fecha de un jugador en una variable y lado, según la base (definición única: valorBase en evolucion.js).
const own = (sessions, v, side, base) => { const x = valorBase(sessions, v, side, base, {}); return x ? { value: x.value, date: x.date, from: x.from ?? x.date } : null; };
// Cambio en PUNTOS porcentuales de una magnitud que ya es un porcentaje (variables «ASYM» de VALD): se compara la MAGNITUD de la asimetría,
// no el valor con signo, porque pasar de −8 % a +6 % es menos asimetría aunque cambie de lado.
const puntosBase = (sessions, v, side, base) => {
  const act = valorBase(sessions, v, side, 'last', {});
  const ref = base === 'last' ? valorPrevio(sessions, v, side, {}) : valorBase(sessions, v, side, base, {});
  return act && ref && Number.isFinite(act.value) && Number.isFinite(ref.value) ? Math.abs(act.value) - Math.abs(ref.value) : null;
};

// Exclusiones (pedidas el 10/11/2026) como propiedades editables en el catálogo (test: «excluir de Asimetrías»; variable: ídem). Por defecto: el test Nordic Hamstring Exercise completo
// y las variables Torque, Force at 100 ms y RFD at 100 ms. Solo afecta a esta pestaña.
const candidatas = (test, catalog) => (testExcluidoDeAsimetrias(test) ? [] : catalog.variables.filter((v) => v.testId === test.id && !v.archived && !variableExcluidaDeAsimetrias(v) && (v.sides === 'LR' || isAsymVariable(v))));
export function filasAsimetria(test, catalog, tsess, base) {
  const vars = orderVars(candidatas(test, catalog).filter((v) => isViewable(v) && !isRelative(v) && hasData(v, tsess)));
  const rows = [];
  for (const v of vars) {
    if (v.sides === 'LR') {
      const L = own(tsess, v, 'L', base), R = own(tsess, v, 'R', base);
      if (!L || !R) continue;
      const deg = esGrados(v);
      const pct = asimetriaLR(v, L.value, R.value);
      if (pct === null || !Number.isFinite(pct)) continue;
      // Comparación de la última sesión con la base mostrada, por lado (misma definición que Normative Benchmarking).
      rows.push({ v, deg, pct, L: L.value, R: R.value, date: [L.date, R.date].sort().at(-1), from: [L.from, R.from].sort()[0], variL: variacionBase(tsess, v, 'L', base), variR: variacionBase(tsess, v, 'R', base) });
    } else {
      const S = own(tsess, v, 'S', base);
      // Variable «ASYM» de VALD: es un porcentaje en sí misma, así que su cambio va en puntos porcentuales.
      if (S && Number.isFinite(S.value)) rows.push({ v, deg: false, pct: S.value, L: null, R: null, date: S.date, from: S.from ?? S.date, vald: true, variPuntos: puntosBase(tsess, v, 'S', base) });
    }
  }
  return rows;
}

const W = 100; // semianchura del eje (unidades del viewBox)
function Barra({ pct, lim }) {
  const w = Math.min(W, (Math.abs(pct) / lim) * W);
  return html`<svg class="asim-svg" viewBox=${`0 0 ${2 * W} 14`} preserveAspectRatio="none" role="img" aria-label=${asymText(pct)}>
    ${w > 0 ? html`<rect class=${pct < 0 ? 'bar-l' : 'bar-r'} x=${pct < 0 ? W - w : W} y="2" width=${w} height="10" />` : null}
    <line class="asim-eje" x1=${W} x2=${W} y1="0" y2="14" vector-effect="non-scaling-stroke" />
  </svg>`;
}

export function PanelAsimetrias({ catalog, sessions, q, setQ }) {
  const base = BASES.some(([k]) => k === q.am) ? q.am : 'pa';
  const mName = (t) => catalog.manifestations.find((m) => m.id === t.manifestationId)?.name ?? null;
  const zName = (t) => catalog.zones.find((z) => z.id === t.zoneId)?.name ?? null;
  const rank = (t) => { const z = (zName(t) ?? '').toLowerCase(); return z.startsWith('ankle') ? 0 : z.startsWith('knee') ? 1 : z.startsWith('hip') ? 2 : z.startsWith('groin') ? 3 : 4; };
  const bloques = BLOQUES_ASIM.map(([key, nombre]) => {
    const tests = catalog.tests.filter((t) => (t.blockKey ?? 'fuerza') === key && !t.archived && sessions.some((s) => s.testId === t.id)).map((t) => { const ts = sessions.filter((s) => s.testId === t.id); return { t, rows: filasAsimetria(t, catalog, ts, base), falta: asimSinDatos(t, catalog, ts) }; }).filter((x) => x.rows.length || x.falta.length);
    const grupos = [...new Set(tests.map((x) => mName(x.t)))].map((g) => ({ g, tests: tests.filter((x) => mName(x.t) === g).map((x, i) => [x, i]).sort((a, b) => rank(a[0].t) - rank(b[0].t) || a[1] - b[1]).map(([x]) => x) }));
    return { key, nombre, grupos };
  }).filter((b) => b.grupos.length);
  const todas = bloques.flatMap((b) => b.grupos.flatMap((g) => g.tests.flatMap((x) => x.rows)));
  const limPct = Math.max(10, Math.ceil(Math.max(0, ...todas.filter((r) => !r.deg).map((r) => Math.abs(r.pct))) / 5) * 5);
  const limDeg = Math.max(5, Math.ceil(Math.max(0, ...todas.filter((r) => r.deg).map((r) => Math.abs(r.pct))) / 5) * 5);
  const hayDeg = todas.some((r) => r.deg);
  return html`<section class="asimetrias" aria-label="Asimetrías del jugador">
    <fieldset class="modes"><legend>Valor mostrado</legend>${BASES.map(([k, n]) => html`<label class="check" key=${k}><input type="radio" name="asim-base" checked=${base === k} onChange=${() => setQ({ am: k })} /> ${n}</label>`)}</fieldset>
    ${!bloques.length ? html`<p class="muted">Este jugador aún no tiene asimetrías calculables (hacen falta tests con valores por lado —izquierda y derecha— o variables de asimetría de VALD).</p>` : html`
      <${Desplegable} titulo="Cómo leer las barras"><p class="muted">Barra hacia la izquierda y <span class="asim-l">azul</span>: domina Left. Hacia la derecha y <span class="asim-r">naranja</span>: domina Right. Escala común de ±${limPct} % (la barra llena = ese valor o más)${hayDeg ? `; las medidas en grados (°) usan su propia escala de ±${limDeg} °` : ''}. Asimetría = |R − L| ÷ máx × 100 con el valor del lado más alto. La columna «${rotuloComp(base)}» compara, en cada lado, el valor de la última sesión con la base elegida (con «Actual», con la sesión válida anterior): es la misma comparación que muestra el cuadro «Normative Benchmarking» de cada test.</p><//>
      ${bloques.map((b) => html`<div class="asim-bloque" key=${b.key}><h3 class="asim-h-bloque">${b.nombre}</h3>
        ${b.grupos.map((g) => html`<div key=${g.g ?? '-'}>${g.g ? html`<h4 class="asim-h-sub">${g.g}</h4>` : null}
          ${g.tests.map(({ t, rows, falta }) => html`<div class="table-wrap asim-test" key=${t.id}><table class="asim"><caption><strong>${dn(t.name)}</strong>${zName(t) ? html` <span class="muted">· ${zName(t)}</span>` : null}</caption>
            <thead><tr><th scope="col">Variable</th><th scope="col" class="asim-th-barra"><span class="asim-l">◄ Left</span> <span class="asim-r">Right ►</span></th><th scope="col">Asimetría</th><th scope="col">Valores</th><th scope="col" title=${TIP_COMP[base]}>${rotuloComp(base)}</th><th scope="col">${base === 'last' ? 'Fecha' : base === 'pa' ? 'Periodo' : 'Sesión'}</th></tr></thead>
            <tbody>${rows.map((r) => html`<tr key=${r.v.id} title=${fmtDay(r.date)}>
              <th scope="row">${dn(r.v.name)}</th>
              <td class="asim-barra"><${Barra} pct=${r.pct} lim=${r.deg ? limDeg : limPct} /></td>
              <td class="num">${r.deg ? html`<${AsimTexto} pct=${r.pct} texto=${Math.abs(r.pct) < 0.05 ? '0 °' : `${nf(Math.abs(r.pct))} ° ${r.pct > 0 ? 'R' : 'L'}`} />` : html`<${AsimTexto} pct=${r.pct} />`}</td>
              <td class="num muted">${r.vald ? 'VALD' : html`<span class="asim-l">L ${nf(r.L, 2)}</span> · <span class="asim-r">R ${nf(r.R, 2)}</span>${r.v.unit ? ' ' + r.v.unit : ''}`}</td>
              <td class="num muted asim-comp" title=${r.vald ? 'La variable de asimetría de VALD ya es un porcentaje: su cambio se da en puntos porcentuales.' : TIP_COMP[base]}>${r.vald
                ? fmtPuntos(r.variPuntos) ?? '—'
                : fmtVar(r.variL) || fmtVar(r.variR)
                  ? html`<span class="asim-l">L ${fmtVar(r.variL) ?? '—'}</span> · <span class="asim-r">R ${fmtVar(r.variR) ?? '—'}</span>`
                  : '—'}</td>
              <td class="num muted asim-fecha">${base === 'last' ? fmtDay(r.date) : base === 'pb' ? `PB · ${fmtDay(r.date)}` : `PA · ${r.from === r.date ? fmtDay(r.date) : `${fmtDay(r.from)} – ${fmtDay(r.date)}`}`}</td></tr>`)}</tbody></table>${falta.length ? html`<p class="muted asim-falta">Sin valores en este jugador: ${falta.map((v) => dn(v.name)).join(', ')}. Para verlas hay que importar esas columnas de VALD en su sesión.</p>` : null}</div>`)}
        </div>`)}</div>`)}`}
  </section>`;
}
