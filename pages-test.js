// pages-test.js — fase 5b: vista de un test para toda la plantilla (RF-02), con navegación de ida y vuelta al jugador (RF-03) y G4 básico.
import { html } from './libs.js';
import { useApp } from './context.js';
import { Card, useLoad } from './componentes.js';
import { fmtDay } from './fechas.js';
import { listCatalog, isAsymVariable, asymText, asymSideLetter } from './catalogo.js';
import { listPositions } from './posiciones.js';
import { compareTest, MODES } from './comparativa.js';
import { positionOnDate } from './posiciones.js';
import { buildHash, replaceQuery } from './rutas.js';
import { getSetting } from './db.js';
import { MIN_N_DEFAULT, buildReference, evaluate } from './percentiles.js';
import { CeldaPercentil } from './pages-percentiles.js';
import { buildCsv } from './exportar.js';
import { expandRelative, isViewable, isRelative, relFactor, hasData, orderVars, defaultVar } from './relativos.js';
import { pairContext, isIsoDerived } from './isohold.js';
import { PREMIER_SEASON, findPremier, estimateRelative, placeAgainstPremier } from './premier.js';
import { withReferenceWeights } from './relaciones.js';
import { downloadBlob } from './io.js';
import { AsimTexto, asimClase } from './asim-ui.js';
import { playerLabel } from './jugadores.js';
import { dn } from './nombres.js';

const nf = (n, d = 2) => (n === null || n === undefined ? '—' : Number(n).toLocaleString('es-ES', { maximumFractionDigits: d }));
export const Migas = ({ items }) => html`<nav aria-label="Ruta de navegación"><ol class="crumbs">${items.map((it, i) => html`<li key=${i}>${it.href ? html`<a href=${it.href}>${it.label}</a>` : html`<span aria-current="page">${it.label}</span>`}</li>`)}</ol></nav>`;

// Parámetros que se conservan al ir y volver entre jugador y test.
export const KEEP = (q) => ({ v: q.v, p: q.p, from: q.from, to: q.to, m: q.m, pos: q.pos });

const sideName = { L: 'Left', R: 'Right', S: 'Valor' };

// G4 en su forma básica: escala horizontal MIN–MAX de la variable con un marcador por jugador (círculo blanco sin lado; azul «L» y naranja «R» por lado).
// Sin referencias externas (llegan en la fase 5c). Los mismos datos están en la tabla.
function EscalaG4({ groups, sides, unit, originId, hrefFor }) {
  const rows = groups.flatMap((g) => g.rows.map((r) => ({ ...r, gname: g.name, first: r === g.rows[0] })));
  const vals = rows.flatMap((r) => sides.map((s) => r.cells[s]?.value).filter((v) => v != null));
  if (!vals.length) return null;
  const min = Math.min(...vals), max = Math.max(...vals), span = max - min || 1;
  const W = 640, left = 150, right = 20, rowH = 22, top = 24;
  const x = (v) => left + ((v - min) / span) * (W - left - right);
  let y = top, out = [];
  let lastGroup = null;
  for (const r of rows) {
    if (r.gname !== lastGroup) { out.push(html`<text key=${'g' + r.gname + y} x="4" y=${y + 10} class="gname">${r.gname}</text>`); y += 24; lastGroup = r.gname; }
    out.push(html`<g key=${'r' + r.playerId + '-' + y + r.date}><a href=${hrefFor(r.playerId)}>
      <text x="4" y=${y + 4} font-weight=${r.playerId === originId ? 700 : 400}>${r.playerName.length > 20 ? r.playerName.slice(0, 19) + '…' : r.playerName}</text>
      <line x1=${left} x2=${W - right} y1=${y} y2=${y} class="axis" />
      ${sides.map((s) => r.cells[s]?.value == null ? null : html`<g key=${s}><title>${r.playerName} · ${sideName[s]} ${nf(r.cells[s].value)} ${unit ?? ''}${r.cells[s].date ? ` (${fmtDay(r.cells[s].date)})` : ''}</title>
        <circle cx=${x(r.cells[s].value)} cy=${y} r="8" fill=${s === 'L' ? 'var(--side-l)' : s === 'R' ? 'var(--side-r)' : 'var(--surface)'} stroke=${s === 'S' ? 'var(--text)' : 'none'} stroke-width="1.5" />
        ${s === 'S' ? null : html`<text x=${x(r.cells[s].value)} y=${y + 3} text-anchor="middle" style="fill:var(--side-text);font-size:9px;font-weight:700">${s}</text>`}</g>`)}
    </a></g>`);
    y += rowH;
  }
  const H = y + 26;
  return html`<section><h3>Escala de la variable (forma básica de G4)</h3>
    <svg class="scale" viewBox=${`0 0 ${W} ${H}`} width="100%" role="img" aria-label=${`Escala de ${nf(min)} a ${nf(max)} ${unit ?? ''} con un marcador por jugador; los mismos datos están en la tabla`}>
      ${out}
      <text x=${left} y=${H - 6} text-anchor="start">${nf(min)} ${unit ?? ''}</text><text x=${W - right} y=${H - 6} text-anchor="end">${nf(max)} ${unit ?? ''}</text>
    </svg>
    <p class="muted">Sin referencias externas (percentiles y «La Liga» llegan en la fase 5c). Cada marcador abre el jugador en este test.</p></section>`;
}

export function NotaRelativa({ variable, omitted = {}, catalog }) {
  if (isIsoDerived(variable)) {
    const n = omitted[variable.id] ?? 0;
    const op = variable.formula.op;
    const txt = { ISO_MVIC: 'MVIC iso-push: media, ponderada por repeticiones y de ambos lados, de (Peak Force del Iso-Push emparejado ÷ 9,80665 − factor × masa de cada sesión de Iso-Push), con todas las sesiones válidas.', ISO_PIMA: '%PIMA: carga externa ÷ MVIC iso-push × 100.', ISO_LOAD_BW: '%BW: carga externa ÷ masa corporal × 100, con la masa medida más cercana a hoy.', ISO_LOAD_SW: `%SW: carga externa ÷ (${String(variable.formula.params?.factor ?? '').replace('.', ',')} × masa corporal) × 100, con la masa medida más cercana a hoy.`, RM_EST: `1RM estimado: (carga + masa corporal) × ${String(variable.formula.params?.factor ?? '').replace('.', ',')}; estimado, no medido. La masa es la medida más cercana a la fecha de la sesión.` }[op];
    return html`<details class="notas"><summary>Cómo se calcula esta variable</summary><p class="muted">Variable <strong>calculada</strong> al vuelo (no se guarda). ${txt} Sin medición de masa ni peso de referencia no se calcula${n ? `: ${n} sesión(es) o jugador(es) sin valor por ese motivo` : ''}.</p></details>`;
  }
  if (!isRelative(variable)) return null;
  const f = relFactor(variable);
  const raw = catalog.variables.find((v) => v.id === variable.formula.operands[0]);
  const n = omitted[variable.id] ?? 0;
  if (variable.formula.op === 'REL_LEVER') return html`<details class="notas"><summary>Cómo se calcula esta variable</summary><p class="muted">Valor <strong>relativo</strong> (${variable.unit}): ${raw?.name ?? 'fuerza'} (N) × longitud de pierna / palanca (m) ÷ masa corporal (kg). La masa y la longitud son las medidas más cercanas a la fecha de cada sesión (antes o después); la masa puede ser el peso de referencia. Sin longitud de pierna o sin masa no hay valor${n ? `: ${n} sesión(es) sin valor por ese motivo` : ''}. Rellena la longitud en «Antropometría» del jugador o impórtala con la columna «Longitud de pierna / palanca».</p></details>`;
  return html`<details class="notas"><summary>Cómo se calcula esta variable</summary><p class="muted">Valor <strong>relativo</strong> (${variable.unit}): ${raw?.name ?? 'fuerza'} del lado (N) ÷ (${f !== 1 ? `${String(f).replace('.', ',')} × ` : ''}masa corporal (kg) × 9,80665). La masa es la masa corporal medida más cercana a la fecha de cada sesión (antes o después), o el peso de referencia del jugador si no tiene ninguna medición. El valor absoluto está en la variable «${raw?.name ?? 'absoluta'}».${n ? html` <span class="muted" title="Añade una medición de masa corporal o el peso de referencia en la ficha del jugador (Antropometría) y esas sesiones tendrán valor relativo.">Sin masa: ${n} sesión(es) no tienen valor relativo (ver el valor absoluto).</span>` : null}</p></details>`;
}

export function VistaTest({ id, query = {} }) {
  const { db, version } = useApp();
  const { data, error } = useLoad(async () => {
    const test = await db.tests.get(id);
    if (!test) return { missing: true };
    const [catalog, raw, players, records, positions, mn, anthropometry] = await Promise.all([listCatalog(db), db.sessions.where('testId').equals(id).toArray(), db.players.toArray(), db.playerPositions.toArray(), listPositions(db), getSetting(db, 'percentileMinN'), db.anthropometry.toArray()]);
    const { sessions, omitted } = expandRelative(catalog.variables, id, raw, withReferenceWeights(anthropometry, players), await pairContext(db, catalog.tests, test));
    return { test, catalog, sessions, omitted, players, records, positions, minN: Number.isInteger(mn) && mn >= 1 ? mn : MIN_N_DEFAULT };
  }, [db, id, version]);
  if (error) return html`<p class="status fail">${error}</p>`;
  if (!data) return html`<p>Cargando…</p>`;
  if (data.missing) return html`<p>El test no existe. <a href="#fuerza">Volver</a></p>`;
  const { test, catalog, sessions, omitted, players, records, positions, minN } = data;
  const path = `test-${id}`;
  const set = (patch) => replaceQuery(path, { ...query, ...patch });
  const vars = orderVars(catalog.variables.filter((v) => v.testId === id && isViewable(v) && hasData(v, sessions)));
  const variable = vars.find((v) => String(v.id) === String(query.v)) ?? defaultVar(vars, sessions);
  const protocols = catalog.protocols.filter((p) => p.testId === id);
  const mode = MODES.some(([k]) => k === query.m) ? query.m : 'pa';
  const proto = query.p ?? 'all';
  const protocolId = proto === 'all' ? undefined : proto === 'none' ? null : Number(proto);
  const sort = ['player', 'value', 'date'].includes(query.s) ? query.s : 'player';
  const originId = query.j ? Number(query.j) : null;
  const origin = originId ? players.find((p) => p.id === originId) : null;
  const playersById = Object.fromEntries(players.map((p) => [p.id, p]));
  const histories = {}; for (const r of records) (histories[r.playerId] ??= []).push(r);
  const backLink = (pid) => buildHash(`jugador-${pid}`, { ...KEEP(query), t: id, v: variable?.id, b: 'fuerza' });
  const crumbs = [{ label: 'Jugadores', href: '#jugadores' }, ...(origin ? [{ label: playerLabel(origin), href: backLink(origin.id) }] : []), { label: `${dn(test.name)} · todos los jugadores` }];
  if (!variable) return html`<${Card} titulo=${dn(test.name)}><${Migas} items=${crumbs} /><p class="muted">Ningún jugador tiene sesiones válidas de este test con variables que mostrar.</p><//>`;
  // Filtro de posición (la posición única del jugador): 'all', 'none' (sin posición) o el id de una posición.
  const posQ = query.pos ?? 'all';
  const posOfPlayer = (pid) => positionOnDate(histories[pid] ?? []).principal?.positionId ?? null;
  const posOk = (pid) => posQ === 'all' || (posQ === 'none' ? posOfPlayer(pid) === null : posOfPlayer(pid) === Number(posQ));
  const inRange = (s) => (protocolId === undefined || (s.protocolId ?? null) === protocolId) && (!query.from || s.date >= query.from) && (!query.to || s.date <= query.to);
  const excluded = query.ex === '1' ? sessions.filter((s) => s.status === 'excluded' && s.values?.[variable.id] && posOk(s.playerId) && inRange(s)).sort((a, b) => b.date.localeCompare(a.date)) : [];
  const res = compareTest({ sessions: sessions.filter((s) => posOk(s.playerId)), variable, players: playersById, histories, positions, mode, protocolId, from: query.from || null, to: query.to || null, sort });
  const lr = res.sides.length === 2;
  // Percentil frente a La Liga (todas las posiciones) en los modos que lo definen: Personal Average, Personal Best y Última sesión.
  const pctOn = mode === 'pa' || mode === 'last' || mode === 'pb';
  // Referencia ÚNICA con ambos lados juntos (un valor por jugador y lado), igual que en el perfil del jugador (9/11/2026): así el mismo valor da el mismo percentil en las dos pantallas.
  const pooled = pctOn ? res.sides.flatMap((sd) => buildReference({ sessions, variable, side: sd, players: playersById, histories, basis: mode === 'last' ? 'pa' : mode, protocolId, from: query.from || null, to: query.to || null })) : null;
  const refs = pctOn ? Object.fromEntries(res.sides.map((sd) => [sd, pooled])) : null;
  const pctOf = (r, sd) => (refs && r.cells[sd]?.value != null ? evaluate(refs[sd], { playerId: r.playerId, value: r.cells[sd].value, direction: variable.direction, minN }) : null);
  const unit = variable.unit ? ` ${variable.unit}` : '';
  // Zona de la Premier League (sin interpolar; en medida relativa es una estimación, como en el perfil del jugador).
  const srcVar = isRelative(variable) ? catalog.variables.find((v) => v.id === variable.formula.operands[0]) ?? null : null;
  const plRef = isRelative(variable) ? (srcVar ? estimateRelative(findPremier(test, srcVar), relFactor(variable)) : null) : findPremier(test, variable);
  const plOf = (r, sd) => (plRef && r.cells[sd]?.value != null ? placeAgainstPremier(plRef, r.cells[sd].value) : null);
  const CeldaPremier = ({ pl }) => (!plRef ? html`<span class="muted">—</span>` : pl?.placed ? html`<span class=${`badge band-${pl.band}`}>${pl.text}</span>` : html`<span class="muted" title=${pl?.reason ?? ''}>${pl ? 'sin ubicar' : '—'}</span>`);
  // Percentil medio del grupo (posición) por lado: media aritmética de los percentiles de rendimiento de La Liga de sus jugadores con muestra suficiente.
  const mediaPct = (g, sd) => { const v = g.rows.map((r) => pctOf(r, sd)).filter((e) => e?.sufficient && e.percentilePerf != null).map((e) => e.percentilePerf); return v.length ? { mean: v.reduce((a, b) => a + b, 0) / v.length, n: v.length } : null; };
  const cell = (c) => {
    if (c == null) return html`<span class="muted">—</span>`;
    if (c.value === null) return html`<span class="muted" title=${c.reason}>no definido</span>`;
    const asimV = isAsymVariable(variable), txt = asimV ? asymText(c.value) : `${nf(c.value)}${unit}`;
    const tip = mode === 'pa' ? `${fmtDay(c.from)} a ${fmtDay(c.date)}` : c.date ? fmtDay(c.date) : '';
    const cls = asimV ? asimClase(c.value) || null : null;
    return tip ? html`<span class=${cls} title=${tip} aria-label=${`${txt}. ${tip}`}>${txt}</span>` : html`<span class=${cls}>${txt}</span>`;
  };
  const repsOf = (r) => res.sides.map((s) => r.cells[s]).filter(Boolean).map((c) => (c.sessions ? `${c.sessions} ses.${c.reps != null ? `, ${c.reps} rep.` : ''}` : c.reps ?? '—')).join(' / ');
  const hrefFor = (pid) => buildHash(`jugador-${pid}`, { ...KEEP({ ...query, m: mode }), t: id, v: variable.id, b: 'fuerza', from: query.from, to: query.to });
  const exportCsv = () => {
    const header = ['Posición', 'Jugador', ...res.sides.map((s) => `${sideName[s]}${variable.unit ? ` (${variable.unit})` : ''}`), ...(lr ? ['Asimetría (%)', 'Lado con el valor más alto'] : []), ...(pctOn ? res.sides.map((s) => `Percentil ${sideName[s].toLowerCase()} (La Liga)`) : []), ...(pctOn && plRef ? res.sides.map((s) => `Zona ${sideName[s].toLowerCase()} (Premier League)`) : []), 'Desde', 'Hasta', 'Sesiones', 'Repeticiones'];
    const rows = res.groups.flatMap((g) => g.rows.map((r) => {
      const cs = res.sides.map((s) => r.cells[s]).filter(Boolean);
      return [g.name, r.playerName, ...res.sides.map((s) => r.cells[s]?.value ?? ''), ...(lr ? [r.asym == null ? '' : Math.abs(r.asym), asymSideLetter(r.asym)] : []),
        ...(pctOn ? res.sides.map((s) => { const e = pctOf(r, s); return e?.sufficient ? e.percentileStat ?? '' : ''; }) : []),
        ...(pctOn && plRef ? res.sides.map((s) => plOf(r, s)?.text ?? '') : []),
        cs[0]?.from ?? cs[0]?.date ?? '', cs[0]?.to ?? cs[0]?.date ?? '', cs[0]?.sessions ?? '', cs.map((c) => c.reps ?? '').join(' / ')];
    }));
    const slug = (s) => String(s).normalize('NFD').replace(/\p{M}/gu, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase();
    downloadBlob(new Blob([buildCsv(header, rows)], { type: 'text/csv;charset=utf-8' }), `${slug(test.name)}_${slug(variable.name)}_${mode}.csv`);
  };
  return html`<${Card} titulo=${`${dn(test.name)} · todos los jugadores`}>
    <div class="test-sticky"><h3>${dn(test.name)}</h3><span class="muted">· todos los jugadores</span></div>
    <${Migas} items=${crumbs} />
    <div class="filters">
      <label>Variable <select value=${variable.id} onChange=${(e) => set({ v: e.target.value })}>${vars.map((v) => html`<option key=${v.id} value=${v.id}>${dn(v.name)}${v.unit && !v.name.includes(`(${v.unit})`) ? ` (${v.unit})` : ''}${v.sides === 'LR' ? ' · I/D' : ''}</option>`)}</select></label>
      ${protocols.length ? html`<label>Protocolo <select value=${proto} onChange=${(e) => set({ p: e.target.value })}><option value="all">Todos</option><option value="none">Sin protocolo</option>${protocols.map((p) => html`<option key=${p.id} value=${p.id}>${p.name}</option>`)}</select></label>` : null}
      <label>Posición <select value=${posQ} onChange=${(e) => set({ pos: e.target.value })}><option value="all">Todas</option><option value="none">Sin posición</option>${positions.map((p) => html`<option key=${p.id} value=${p.id}>${p.name}</option>`)}</select></label>
      <label>Desde <input type="date" value=${query.from ?? ''} onInput=${(e) => set({ from: e.target.value })} /></label>
      <label>Hasta <input type="date" value=${query.to ?? ''} onInput=${(e) => set({ to: e.target.value })} /></label>
      <label>Ordenar por <select value=${sort} onChange=${(e) => set({ s: e.target.value })}><option value="player">Jugador</option><option value="value">Valor (el mejor primero)</option><option value="date">Fecha (la más reciente primero)</option></select></label>
    </div>
    <${NotaRelativa} variable=${variable} omitted=${omitted} catalog=${catalog} />
    <label class="check"><input type="checkbox" checked=${query.ex === '1'} onChange=${(e) => set({ ex: e.target.checked ? '1' : undefined })} /> Mostrar también las sesiones excluidas (solo informativas: no entran en ningún cálculo)</label>
    <fieldset class="modes"><legend>Valor mostrado</legend>${MODES.map(([k, n]) => html`<label class="check" key=${k}><input type="radio" name="modo" checked=${mode === k} onChange=${() => set({ m: k })} /> ${n}</label>`)}</fieldset>
    ${mode === 'pa' ? html`<p class="muted">Personal Average: media de las sesiones válidas ponderada por repeticiones.</p>` : null}
    ${mode === 'pb' && variable.direction !== 'higher' && variable.direction !== 'lower' ? html`<p class="status warn">Esta variable no tiene una dirección que permita definir el Personal Best (${variable.direction === 'target' ? 'rango objetivo, D23' : 'defínela en el catálogo'}).</p>` : null}
    <p>${res.players} jugador(es) con datos · ${res.rows} fila(s). Las sesiones excluidas no aparecen. <button type="button" class="secondary" disabled=${!res.rows} onClick=${exportCsv}>Exportar CSV</button></p>
    ${!res.rows ? html`<p class="muted">Sin datos para estos filtros.</p>` : res.groups.map((g) => html`<div class="table-wrap tabla-wrap-comp" key=${g.key}><table class="tabla-comp"><caption>${g.name}</caption>
      <thead><tr><th rowspan="2" scope="col">Jugador</th><th colspan=${res.sides.length} scope="colgroup">Valor${variable.unit ? ` (${variable.unit})` : ''}</th>${lr ? html`<th rowspan="2" scope="col" class="num" title="|right − left| ÷ máx × 100 y la letra del lado con el valor más alto (como VALD), con los dos valores mostrados">Asimetría</th>` : null}${pctOn ? html`<th colspan=${res.sides.length} scope="colgroup">Percentil La Liga</th>` : null}${pctOn ? html`<th colspan=${res.sides.length} scope="colgroup" title=${plRef ? `Zona entre los cortes publicados de la Premier League ${PREMIER_SEASON}${plRef.estimated ? ' (ESTIMADA en medida relativa)' : ''}` : 'Esta variable no figura en las tablas de la Premier League aportadas'}>Premier League</th>` : null}</tr>
        <tr>${res.sides.map((s) => html`<th key=${'v' + s} scope="col" class="num">${sideName[s]}</th>`)}${pctOn ? res.sides.map((s) => html`<th key=${'p' + s} scope="col">${sideName[s]}</th>`) : null}${pctOn ? res.sides.map((s) => html`<th key=${'q' + s} scope="col">${sideName[s]}</th>`) : null}</tr>
        ${pctOn ? html`<tr class="media-grupo"><th scope="row">Percentil medio La Liga (${g.name})</th>${res.sides.map((s) => html`<td key=${'m' + s}></td>`)}${lr ? html`<td></td>` : null}${res.sides.map((s) => { const m = mediaPct(g, s); return html`<td key=${'mp' + s} title=${m ? `Media del percentil de rendimiento de ${m.n} jugador(es) con muestra suficiente` : 'Sin jugadores con percentil calculable'}>${m ? html`<strong>${nf(m.mean, 0)}</strong> <small class="muted">n=${m.n}</small>` : '—'}</td>`; })}${res.sides.map((s) => html`<td key=${'mq' + s}></td>`)}</tr>` : null}</thead>
      <tbody>${g.rows.map((r, i) => html`<tr key=${i} class=${r.playerId === originId ? 'origin' : ''}>
        <th scope="row"><a href=${hrefFor(r.playerId)}>${r.playerName}</a>${r.playerId === originId ? html` <span class="muted">(origen)</span>` : ''}${r.multi ? html`<small class="cell-date">ocupó varias posiciones</small>` : ''}<small class="cell-date">${repsOf(r)}</small></th>
        ${res.sides.map((s) => html`<td key=${s} class="num"><a href=${hrefFor(r.playerId)}>${cell(r.cells[s])}</a></td>`)}
        ${lr ? html`<td class="num">${r.asym == null ? '—' : html`<${AsimTexto} pct=${r.asym} />`}</td>` : null}
        ${pctOn ? res.sides.map((s) => html`<td key=${'p' + s}><${CeldaPercentil} ev=${pctOf(r, s)} /></td>`) : null}
        ${pctOn ? res.sides.map((s) => html`<td key=${'q' + s}><${CeldaPremier} pl=${plOf(r, s)} /></td>`) : null}</tr>`)}</tbody></table></div>`)}
    ${query.ex === '1' ? (excluded.length ? html`<div class="table-wrap"><table><caption>Sesiones excluidas (no cuentan en la tabla anterior ni en percentiles)</caption>
      <thead><tr><th>Jugador</th><th>Fecha</th>${res.sides.map((s) => html`<th key=${s} class="num">${sideName[s]}</th>`)}<th>Motivo</th></tr></thead>
      <tbody>${excluded.map((s) => html`<tr key=${s.id} class="excluded"><th scope="row">${(playersById[s.playerId] ? playerLabel(playersById[s.playerId]) : '—')}</th><td>${fmtDay(s.date)}</td>${res.sides.map((sd) => html`<td key=${sd} class="num">${isAsymVariable(variable) ? asymText(s.values[variable.id]?.[sd]) : html`${nf(s.values[variable.id]?.[sd])}${unit}`}</td>`)}<td>${s.excludedReason || '—'}</td></tr>`)}</tbody></table></div>` : html`<p class="muted">No hay sesiones excluidas con estos filtros.</p>`) : null}
    ${pctOn ? html`<details class="notas"><summary>Cómo se calcula el percentil</summary><p class="muted">Percentil de rendimiento frente a «La Liga» (todas las posiciones; sin datos sintéticos ni el propio jugador; mínimo ${minN} jugadores; rango medio). Referencia única con las dos piernas juntas (un valor por jugador y lado), la misma que en el perfil del jugador. La última sesión y el Personal Average se comparan con el Personal Average de los demás; el Personal Best con sus Personal Best.</p></details>` : null}
    ${lr ? html`<p class="muted">Asimetría como en VALD: |D − I| ÷ máx × 100, con la letra del lado que tiene el valor más alto (L left, R right); calculada con los dos valores que se ven en la fila.</p>` : null}
    <${EscalaG4} groups=${res.groups} sides=${res.sides} unit=${variable.unit} originId=${originId} hrefFor=${hrefFor} />
  <//>`;
}
