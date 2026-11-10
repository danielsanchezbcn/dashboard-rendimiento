import { html, useState } from './libs.js';
import { useApp } from './context.js';
import { Card, Msg, Sintetico, useLoad, useRunner } from './componentes.js';
import { fmtDay, todayIso, isIsoDay } from './fechas.js';
import { normalizeName, playerLabel, baseName, SOURCES, createPlayer, updatePlayer, setPlayerActive, addAlias, removeAlias, duplicateNameWarning, mergePlayers, deletePlayerWithData, playerDataCounts } from './jugadores.js';
import { listPositions, playerHistory, positionOnDate, setMainPosition, clearMainPosition, addSecondaryPosition, deleteHistoryRecord } from './posiciones.js';
import { METRICS, playerAnthropometry, addAnthropometry, updateAnthropometry, deleteAnthropometry, setReferenceWeight, clearReferenceWeight } from './antropometria.js';
import { totalOf, countSynthetic } from './sinteticos.js';
import { ResultadosJugador } from './pages-evolucion.js';
import { FvPanel } from './pages-fv.js';
import { AntropPercentiles } from './pages-imagen.js';

const posName = (positions, id) => positions.find((p) => p.id === id)?.name ?? '(posición eliminada)';

// ---------- Lista de jugadores ----------

export function Jugadores() {
  const { db, version, bump } = useApp();
  const [q, setQ] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [name, setName] = useState('');
  const [full, setFull] = useState('');
  const [notes, setNotes] = useState('');
  const [posId, setPosId] = useState('');
  const { msg, run, busy } = useRunner();
  const { data, error } = useLoad(async () => {
    const [players, aliases, positions, history, synth] = await Promise.all([db.players.toArray(), db.playerAliases.toArray(), listPositions(db), db.playerPositions.toArray(), countSynthetic(db)]);
    return { players, aliases, positions, history, synth };
  }, [db, version]);
  if (error) return html`<p class="status fail">${error}</p>`;
  if (!data) return html`<p>Cargando…</p>`;
  const today = todayIso();
  const key = normalizeName(q).key;
  const rows = data.players
    .filter((p) => showInactive || p.active)
    .filter((p) => !key || normalizeName(p.jerseyName).key.includes(key) || normalizeName(p.fullName).key.includes(key) || data.aliases.some((a) => a.playerId === p.id && a.normalizedKey.includes(key)))
    .sort((a, b) => baseName(a).localeCompare(baseName(b), 'es'));
  const current = (id) => {
    const x = positionOnDate(data.history.filter((r) => r.playerId === id)).principal;
    return x ? posName(data.positions, x.positionId) : 'Sin posición';
  };
  const create = run(async () => {
    const warn = await duplicateNameWarning(db, full || name);
    if (warn && !confirm(`${warn}\n\n¿Crear el jugador de todos modos?`)) throw new Error('Creación cancelada.');
    const id = await createPlayer(db, { jerseyName: name, fullName: full, notes });
    if (posId) await setMainPosition(db, id, Number(posId));
    setName(''); setFull(''); setNotes(''); setPosId('');
    bump();
    return id;
  }, 'jugador creado.');
  return html`
    <h2 class="page-title">Jugadores</h2>
    ${totalOf(data.synth) > 0 ? html`<div class="banner info" role="status">Hay datos sintéticos de demostración (${totalOf(data.synth)} registros), marcados como <${Sintetico} />. Se eliminan todos juntos desde <a href="#configuracion">Configuración</a>.</div>` : null}
    <${Card} titulo=${`Lista (${rows.length})`}>
      <div class="fields">
        <label>Buscar por nombre o alias <input type="search" value=${q} onInput=${(e) => setQ(e.target.value)} /></label>
        <label class="check"><input type="checkbox" checked=${showInactive} onChange=${(e) => setShowInactive(e.target.checked)} /> Mostrar inactivos</label>
      </div>
      ${rows.length === 0
        ? html`<p class="muted">${data.players.length === 0 ? 'Todavía no hay jugadores.' : 'Ningún jugador coincide con el filtro.'}</p>`
        : html`<div class="table-wrap"><table>
            <thead><tr><th scope="col">Jugador (nombre completo y alias)</th><th scope="col">Posición principal hoy</th><th scope="col">Estado</th></tr></thead>
            <tbody>${rows.map((p) => html`<tr key=${p.id}>
              <th scope="row"><a href=${'#jugador-' + p.id}>${playerLabel(p)}</a> ${p.synthetic ? html`<${Sintetico} />` : null}</th>
              <td>${current(p.id)}</td><td>${p.active ? 'Activo' : 'Inactivo'}</td></tr>`)}</tbody>
          </table></div>`}
    <//>
    <${Card} titulo="Nuevo jugador">
      <form onSubmit=${create} class="fields">
        <label>Nombre completo (el de VALD) <input type="text" value=${full} onInput=${(e) => setFull(e.target.value)} /></label>
        <label>Alias (nombre en camiseta, el de tus Excel) <input type="text" value=${name} onInput=${(e) => setName(e.target.value)} /></label>
        <label>Notas (opcional) <input type="text" value=${notes} onInput=${(e) => setNotes(e.target.value)} /></label>
        <label>Posición principal inicial (opcional)
          <select value=${posId} onChange=${(e) => setPosId(e.target.value)}>
            <option value="">Sin posición</option>
            ${data.positions.filter((p) => p.active).map((p) => html`<option value=${p.id} key=${p.id}>${p.name}</option>`)}
          </select>
        </label>
        <div class="actions"><button type="submit" disabled=${busy}>Crear jugador</button></div>
      </form>
      ${data.positions.length === 0 ? html`<p class="muted">Todavía no hay posiciones definidas. Defínelas en <a href="#configuracion">Configuración</a>; no se precarga ninguna.</p>` : null}
      <${Msg} msg=${msg} />
    <//>
  `;
}

// ---------- Perfil del jugador ----------

function Basicos({ player }) {
  const { db, bump } = useApp();
  const [name, setName] = useState(player.jerseyName);
  const [full, setFull] = useState(player.fullName ?? '');
  const [notes, setNotes] = useState(player.notes ?? '');
  const { msg, run, busy } = useRunner();
  return html`
    <${Card} titulo="Datos básicos">
      <form class="fields" onSubmit=${run(async () => { await updatePlayer(db, player.id, { jerseyName: name, fullName: full, notes }); bump(); }, 'datos guardados.')}>
        <label>Nombre completo (el de VALD) <input type="text" value=${full} onInput=${(e) => setFull(e.target.value)} /></label>
        <label>Alias (nombre en camiseta, el de tus Excel) <input type="text" required value=${name} onInput=${(e) => setName(e.target.value)} /></label>
        <label>Notas <input type="text" value=${notes} onInput=${(e) => setNotes(e.target.value)} /></label>
        <div class="actions">
          <button type="submit" disabled=${busy}>Guardar</button>
          <button type="button" class="secondary" disabled=${busy} onClick=${run(async () => { await setPlayerActive(db, player.id, !player.active); bump(); }, player.active ? 'jugador desactivado: se conserva todo su historial.' : 'jugador activado.')}>${player.active ? 'Desactivar' : 'Activar'}</button>
        </div>
      </form>
      <p class="muted">Un jugador desactivado no se borra: conserva su historial. Estado actual: ${player.active ? 'activo' : 'inactivo'}.</p>
      <${Msg} msg=${msg} />
    <//>`;
}

function Alias({ player, aliases }) {
  const { db, bump } = useApp();
  const [source, setSource] = useState(SOURCES[0]);
  const [text, setText] = useState('');
  const { msg, setMsg, run, busy } = useRunner();
  const add = run(async () => {
    const r = await addAlias(db, player.id, source, text);
    setText('');
    bump();
    return r;
  });
  const addAndReport = async (e) => {
    const r = await add(e);
    if (r) setMsg({ level: r.warnings.length ? 'warn' : 'ok', text: r.warnings.length ? `alias añadido. Aviso: ${r.warnings.join(' ')}` : 'alias añadido.' });
  };
  return html`
    <${Card} titulo="Alias por fuente">
      <p>Nombres con los que aparece este jugador en cada fuente (por ejemplo, el nombre completo de VALD y el nombre deportivo del Excel). Se usan para <strong>proponer</strong> coincidencias en las importaciones; nunca vinculan sin tu confirmación.</p>
      ${aliases.length === 0 ? html`<p class="muted">Sin alias.</p>` : html`<div class="table-wrap"><table>
        <thead><tr><th scope="col">Fuente</th><th scope="col">Texto original</th><th scope="col"><span class="sr">Acciones</span></th></tr></thead>
        <tbody>${aliases.map((a) => html`<tr key=${a.id}><td>${a.source}</td><td>${a.rawText} ${a.synthetic ? html`<${Sintetico} />` : null}</td>
          <td><button type="button" class="secondary" onClick=${run(async () => { if (confirm(`¿Eliminar el alias «${a.rawText}» (${a.source})?`)) { await removeAlias(db, a.id); bump(); } })}>Eliminar</button></td></tr>`)}</tbody></table></div>`}
      <form class="fields" onSubmit=${addAndReport}>
        <label>Fuente <select value=${source} onChange=${(e) => setSource(e.target.value)}>${SOURCES.map((s) => html`<option key=${s}>${s}</option>`)}</select></label>
        <label>Texto original, tal como aparece en la fuente <input type="text" required value=${text} onInput=${(e) => setText(e.target.value)} /></label>
        <div class="actions"><button type="submit" disabled=${busy}>Añadir alias</button></div>
      </form>
      <${Msg} msg=${msg} />
    <//>`;
}

function Posiciones({ player, history, positions }) {
  const { db, bump } = useApp();
  const active = positions.filter((p) => p.active);
  const [mainPos, setMainPos] = useState('');
  const [secPos, setSecPos] = useState('');
  const a = useRunner(); const c = useRunner(); const d = useRunner();
  const main = positionOnDate(history).principal;
  const secs = history.filter((r) => r.role === 'secundaria');
  return html`
    <${Card} titulo="Posición">
      <p>Cada jugador tiene <strong>una posición principal, sin fechas</strong>: si la cambias, el cambio vale para todo su histórico. Las comparaciones agrupan por esta posición. Las posiciones secundarias son solo informativas.</p>
      <p class="status" role="status">${main ? html`Posición principal: <strong>${posName(positions, main.positionId)}</strong> ${main.synthetic ? html`<${Sintetico} />` : null}` : 'Sin posición principal: el jugador figura «Sin posición».'}</p>
      <form class="fields" onSubmit=${a.run(async () => { await setMainPosition(db, player.id, Number(mainPos)); setMainPos(''); bump(); }, 'posición principal guardada (vale para todo el histórico).')}>
        <label>${main ? 'Cambiar a' : 'Posición'} <select required value=${mainPos} onChange=${(e) => setMainPos(e.target.value)}><option value="">Elige…</option>${active.map((p) => html`<option value=${p.id} key=${p.id}>${p.name}</option>`)}</select></label>
        <div class="actions"><button type="submit" disabled=${a.busy}>${main ? 'Cambiar posición' : 'Asignar posición'}</button>
          ${main ? html`<button type="button" class="secondary" disabled=${d.busy} onClick=${d.run(async () => { if (confirm('El jugador quedará «Sin posición» en todo su histórico. ¿Continuar?')) { await clearMainPosition(db, player.id); bump(); } })}>Quitar posición</button>` : null}</div>
      </form>
      <${Msg} msg=${a.msg} /><${Msg} msg=${d.msg} />
      <h3>Posiciones secundarias (informativas)</h3>
      ${secs.length ? html`<ul>${secs.map((r) => html`<li key=${r.id}>${posName(positions, r.positionId)} <button type="button" class="secondary" onClick=${d.run(async () => { await deleteHistoryRecord(db, r.id); bump(); })}>Quitar</button></li>`)}</ul>` : html`<p class="muted">Ninguna.</p>`}
      <form class="fields" onSubmit=${c.run(async () => { await addSecondaryPosition(db, player.id, Number(secPos)); setSecPos(''); bump(); }, 'posición secundaria añadida.')}>
        <label>Posición <select required value=${secPos} onChange=${(e) => setSecPos(e.target.value)}><option value="">Elige…</option>${active.map((p) => html`<option value=${p.id} key=${p.id}>${p.name}</option>`)}</select></label>
        <div class="actions"><button type="submit" class="secondary" disabled=${c.busy}>Añadir secundaria</button></div>
      </form>
      <${Msg} msg=${c.msg} />
    <//>`;
}

const emptyForm = (last) => ({
  id: null, date: '', source: '', notes: '',
  ...Object.fromEntries(METRICS.flatMap((m) => [[m.key + 'V', ''], [m.key + 'U', last?.[m.key]?.unit ?? '']])),
});

function PesoReferencia({ player }) {
  const { db, bump } = useApp();
  const { msg, run, busy } = useRunner();
  const [v, setV] = useState(player.referenceWeight?.value ?? '');
  const [u, setU] = useState(player.referenceWeight?.unit ?? 'kg');
  const cur = player.referenceWeight;
  return html`<fieldset><legend>Peso de referencia del jugador</legend>
    <p class="muted">Se usa en todos los cálculos con masa solo si el jugador no tiene ninguna medición de masa corporal. Cualquier medición lo sustituye.${cur ? '' : ' Ahora no hay peso de referencia.'}</p>
    <div class="fields"><label>Peso de referencia <input type="text" inputmode="decimal" value=${v} onInput=${(e) => setV(e.target.value)} /></label>
      <label>Medida del peso (kg, g o lb) <input type="text" value=${u} onInput=${(e) => setU(e.target.value)} /></label></div>
    <div class="actions"><button type="button" disabled=${busy} onClick=${run(async () => { await setReferenceWeight(db, player.id, v, u); bump(); }, 'peso de referencia guardado.')}>Guardar peso de referencia</button>
      ${cur ? html`<button type="button" class="secondary" disabled=${busy} onClick=${run(async () => { await clearReferenceWeight(db, player.id); setV(''); bump(); }, 'peso de referencia eliminado.')}>Eliminar</button>` : null}</div>
    <${Msg} msg=${msg} /></fieldset>`;
}

// Sección plegada (cerrada por defecto): mismo aspecto de tarjeta, el título es el resumen.
const Desplegable = ({ titulo, children, abierto = false, onToggle = null, id }) => html`<section class="card despl" id=${id}><details open=${abierto} onToggle=${onToggle}><summary><h2>${titulo}</h2></summary>${children}</details></section>`;

function Antropometria({ player, records }) {
  const { db, bump } = useApp();
  const [f, setF] = useState(emptyForm(records[0]));
  const [formAbierto, setFormAbierto] = useState(false);
  const { msg, run, busy } = useRunner();
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const build = () => {
    const rec = { playerId: player.id, date: f.date, source: f.source, notes: f.notes };
    for (const m of METRICS) rec[m.key] = f[m.key + 'V'] === '' ? null : { value: Number(String(f[m.key + 'V']).replace(',', '.')), unit: f[m.key + 'U'] };
    return rec;
  };
  const save = run(async () => {
    if (f.id) await updateAnthropometry(db, f.id, build());
    else await addAnthropometry(db, build());
    // Se recuerdan las unidades que acaba de indicar el usuario (no hay unidades por defecto).
    setF(emptyForm(Object.fromEntries(METRICS.map((m) => [m.key, { unit: f[m.key + 'U'] }]))));
    bump();
  }, f.id ? 'medición actualizada.' : 'medición añadida.');
  const load = (r) => { setFormAbierto(true); setF({ id: r.id, date: r.date, source: r.source ?? '', notes: r.notes ?? '', ...Object.fromEntries(METRICS.flatMap((m) => [[m.key + 'V', r[m.key]?.value ?? ''], [m.key + 'U', r[m.key]?.unit ?? '']])) }); };
  const cell = (r, k) => (r[k] ? `${String(r[k].value).replace('.', ',')} ${r[k].unit}` : '—');
  const formulario = html`<form onSubmit=${save}>

        <div class="fields">
          <label>Fecha de medición <input type="date" required value=${f.date} onInput=${set('date')} /></label>
          ${METRICS.map((m) => html`<fieldset key=${m.key}><legend>${m.label}</legend>
            <label>Valor <input type="text" inputmode="decimal" value=${f[m.key + 'V']} onInput=${set(m.key + 'V')} /></label>
            <label>Unidad <input type="text" value=${f[m.key + 'U']} onInput=${set(m.key + 'U')} /></label></fieldset>`)}
          <label>Fuente (opcional) <input type="text" value=${f.source} onInput=${set('source')} /></label>
          <label>Observaciones (opcional) <input type="text" value=${f.notes} onInput=${set('notes')} /></label>
        </div>
        <div class="actions">
          <button type="submit" disabled=${busy}>${f.id ? 'Guardar cambios' : 'Añadir medición'}</button>
          ${f.id ? html`<button type="button" class="secondary" onClick=${() => setF(emptyForm(records[0]))}>Cancelar edición</button>` : null}
        </div>
      </form>
      <p class="muted">Rellena solo las medidas que tengas; al menos una. La unidad es obligatoria cuando hay valor.</p>
      <${Msg} msg=${msg} />`;
  return html`
    <${Desplegable} titulo="Percentil de peso y altura"><${AntropPercentiles} player=${player} /><//>
    <${Desplegable} titulo="Añadir medición" abierto=${formAbierto} onToggle=${(e) => setFormAbierto(e.currentTarget.open)}>
      ${formulario}<//>
    <${Desplegable} titulo="Antropometría con historial">
      <p>Cada medición es un registro fechado; no se sustituye un valor único. Los cálculos con masa corporal (relativos BW/SW, DSI, MVIC, %BW/%SW, 1RM estimado…) usan la medición de masa <strong>más cercana a la fecha</strong>, anterior o posterior, y si no hay ninguna, el peso de referencia de abajo. La unidad la indicas tú.</p>
      ${records.length === 0 ? html`<p class="muted">Sin mediciones.</p>` : html`<div class="table-wrap"><table>
        <thead><tr><th scope="col">Fecha</th>${METRICS.map((m) => html`<th scope="col" key=${m.key}>${m.label}</th>`)}<th scope="col">Fuente</th><th scope="col">Observaciones</th><th scope="col"><span class="sr">Acciones</span></th></tr></thead>
        <tbody>${records.map((r) => html`<tr key=${r.id}><td>${fmtDay(r.date)} ${r.synthetic ? html`<${Sintetico} />` : null}</td>${METRICS.map((m) => html`<td key=${m.key}>${cell(r, m.key)}</td>`)}<td>${r.source || '—'}</td><td>${r.notes || '—'}</td>
          <td class="acts"><button type="button" class="secondary" onClick=${() => load(r)}>Editar</button>
          <button type="button" class="secondary" onClick=${run(async () => { if (confirm('¿Eliminar esta medición?')) { await deleteAnthropometry(db, r.id); bump(); } })}>Eliminar</button></td></tr>`)}</tbody></table></div>`}
      <${PesoReferencia} player=${player} />
    <//>`;
}


function UnificarEliminar({ player }) {
  const { db, bump } = useApp();
  const [other, setOther] = useState('');
  const [keepThis, setKeepThis] = useState('esta');
  const { msg, run, busy } = useRunner();
  const { data } = useLoad(async () => ({ players: (await db.players.toArray()).filter((p) => p.id !== player.id).sort((a, b) => baseName(a).localeCompare(baseName(b), 'es')), counts: await playerDataCounts(db, player.id) }), [db, player.id]);
  if (!data) return null;
  const o = data.players.find((p) => p.id === Number(other));
  const c = data.counts;
  const withData = c.sessions + c.fvProfiles + c.anthropometry + c.targets;
  const merge = run(async () => {
    if (!o) throw new Error('Elige el otro jugador.');
    const keepId = keepThis === 'esta' ? player.id : o.id, dropId = keepThis === 'esta' ? o.id : player.id;
    const keepName = keepThis === 'esta' ? playerLabel(player) : playerLabel(o), dropName = keepThis === 'esta' ? playerLabel(o) : playerLabel(player);
    if (!confirm(`Se unificarán dos fichas:\n\n· Se conserva: ${keepName}\n· Desaparece: ${dropName}\n\nTodas las sesiones, alias, posiciones, mediciones y targets de la segunda pasan a la primera. Es permanente: haz antes una copia de seguridad. ¿Continuar?`)) throw new Error('Unificación cancelada.');
    const r = await mergePlayers(db, keepId, dropId);
    bump();
    if (r.posiblesDuplicadas) alert(`Fichas unificadas. Atención: hay ${r.posiblesDuplicadas} sesión(es) del mismo test, fecha y hora repetidas (venían de las dos fichas). Se han conservado todas; revísalas en el perfil.`);
    window.location.hash = '#jugador-' + keepId;
    return r;
  });
  const mergeAndReport = async (e) => { await merge(e); };
  const del = run(async () => {
    const resumen = withData === 0 ? 'No tiene datos guardados.' : `Se borrarán también ${c.sessions} sesiones, ${c.anthropometry} mediciones, ${c.fvProfiles} perfiles carga-velocidad y ${c.targets} targets suyos.`;
    if (!confirm(`¿Eliminar definitivamente a «${playerLabel(player)}»?\n\n${resumen}\nEs permanente: haz antes una copia de seguridad.`)) throw new Error('Eliminación cancelada.');
    if (withData > 0 && !confirm(`Última confirmación: se perderán todos los datos de «${playerLabel(player)}». ¿Eliminar?`)) throw new Error('Eliminación cancelada.');
    await deletePlayerWithData(db, player.id);
    bump();
    window.location.hash = '#jugadores';
  });
  return html`<${Card} titulo="Unificar o eliminar">
    <p>¿Es el mismo jugador que otra ficha (por ejemplo, «Bernardo» de un Excel y «Bernardo Espinosa» de VALD)? Unifícalas: todo pasa a la ficha que conserves y los nombres de la otra quedan como alias para las próximas importaciones.</p>
    <form class="fields" onSubmit=${mergeAndReport}>
      <label>Otra ficha <select value=${other} onChange=${(e) => setOther(e.target.value)}><option value="">Elige un jugador…</option>${data.players.map((p) => html`<option key=${p.id} value=${p.id}>${playerLabel(p)}${p.active ? '' : ' (inactivo)'}</option>`)}</select></label>
      <label>Ficha que se conserva <select value=${keepThis} onChange=${(e) => setKeepThis(e.target.value)}><option value="esta">Esta (${playerLabel(player)})</option><option value="otra">La otra${o ? ` (${playerLabel(o)})` : ''}</option></select></label>
      <div class="actions"><button type="submit" class="secondary" disabled=${busy || !other}>Unificar fichas</button></div>
    </form>
    <p class="muted">Las sesiones no se fusionan: si tras unificar hubiera dos del mismo test, fecha y hora, se conservan las dos y se te avisa. Los datos del jugador que desaparece no se sobrescriben sobre los del que se conserva.</p>
    <h4>Eliminar este jugador</h4>
    ${withData === 0 ? html`<p>Esta ficha no tiene sesiones, mediciones, perfiles ni targets.</p>`
      : html`<p class="muted">Esta ficha tiene datos (${c.sessions} sesiones, ${c.anthropometry} mediciones, ${c.fvProfiles} perfiles carga-velocidad, ${c.targets} targets). Si la eliminas se borran con ella. Si solo quieres dejar de usarla, desactívala en «Datos básicos»; si es un duplicado, unifícala arriba.</p>`}
    <div class="actions"><button type="button" class="secondary" disabled=${busy} onClick=${del}>Eliminar jugador</button></div>
    <${Msg} msg=${msg} />
  <//>`;
}

export function PerfilJugador({ id, query = {} }) {
  const { db, version } = useApp();
  const { data, error } = useLoad(async () => {
    const player = await db.players.get(id);
    if (!player) return { missing: true };
    const [aliases, positions, history, records] = await Promise.all([db.playerAliases.where('playerId').equals(id).toArray(), listPositions(db), playerHistory(db, id), playerAnthropometry(db, id)]);
    return { player, aliases, positions, history, records };
  }, [db, id, version]);
  if (error) return html`<p class="status fail">${error}</p>`;
  if (!data) return html`<p>Cargando…</p>`;
  if (data.missing) return html`<p>El jugador no existe. <a href="#jugadores">Volver a la lista</a></p>`;
  const { player } = data;
  const edicion = html`<${Basicos} key=${'b' + player.id + player.updatedAt} player=${player} />
    <${Alias} player=${player} aliases=${data.aliases} />
    <${Posiciones} player=${player} history=${data.history} positions=${data.positions} />
    <${UnificarEliminar} key=${'u' + player.id} player=${player} />`;
  const antrop = html`<${Antropometria} key=${'a' + player.id} player=${player} records=${data.records} />`;
  return html`
    <p><a href="#jugadores">← Jugadores</a></p>
    <h2 class="page-title">${playerLabel(player)} ${player.synthetic ? html`<${Sintetico} />` : null} ${player.active ? null : html`<span class="badge">INACTIVO</span>`}</h2>
    <${ResultadosJugador} key=${'r' + player.id} player=${player} query=${query} edicion=${edicion} antrop=${antrop} fv=${html`<${FvPanel} key=${'fv' + player.id} player=${player} />`} />
  `;
}
