import { html, useState } from './libs.js';
import { useApp } from './context.js';
import { Card, Msg, Sintetico, useLoad, useRunner } from './componentes.js';
import { fmtDay, todayIso, isIsoDay } from './fechas.js';
import { normalizeName, SOURCES, createPlayer, updatePlayer, setPlayerActive, addAlias, removeAlias, duplicateNameWarning } from './jugadores.js';
import { listPositions, playerHistory, positionOnDate, setMainPositionFrom, endMainPosition, addSecondaryPosition, updateHistoryRecord, deleteHistoryRecord } from './posiciones.js';
import { METRICS, playerAnthropometry, addAnthropometry, updateAnthropometry, deleteAnthropometry } from './antropometria.js';
import { totalOf, countSynthetic } from './sinteticos.js';

const posName = (positions, id) => positions.find((p) => p.id === id)?.name ?? '(posición eliminada)';

// ---------- Lista de jugadores ----------

export function Jugadores() {
  const { db, version, bump } = useApp();
  const [q, setQ] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [posId, setPosId] = useState('');
  const [from, setFrom] = useState('');
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
    .filter((p) => !key || normalizeName(p.jerseyName).key.includes(key) || data.aliases.some((a) => a.playerId === p.id && a.normalizedKey.includes(key)))
    .sort((a, b) => a.jerseyName.localeCompare(b.jerseyName, 'es'));
  const current = (id) => {
    const x = positionOnDate(data.history.filter((r) => r.playerId === id), today).principal;
    return x ? posName(data.positions, x.positionId) : 'Sin posición hoy';
  };
  const create = run(async () => {
    if (posId && !isIsoDay(from)) throw new Error('Indica la fecha desde la que rige la posición.');
    const warn = await duplicateNameWarning(db, name);
    if (warn && !confirm(`${warn}\n\n¿Crear el jugador de todos modos?`)) throw new Error('Creación cancelada.');
    const id = await createPlayer(db, { jerseyName: name, notes });
    if (posId) await setMainPositionFrom(db, id, Number(posId), from);
    setName(''); setNotes(''); setPosId(''); setFrom('');
    bump();
    return id;
  }, 'jugador creado.');
  return html`
    <h2 class="page-title">Jugadores</h2>
    ${totalOf(data.synth) > 0 ? html`<div class="banner info" role="status">Hay datos sintéticos de demostración (${totalOf(data.synth)} registros), marcados como <${Sintetico} />. Se eliminan todos juntos desde <a href="#configuracion">Configuración</a>.</div>` : null}
    <${Card} titulo="Nuevo jugador">
      <form onSubmit=${create} class="fields">
        <label>Nombre en camiseta <input type="text" required value=${name} onInput=${(e) => setName(e.target.value)} /></label>
        <label>Notas (opcional) <input type="text" value=${notes} onInput=${(e) => setNotes(e.target.value)} /></label>
        <label>Posición principal inicial (opcional)
          <select value=${posId} onChange=${(e) => setPosId(e.target.value)}>
            <option value="">Sin posición</option>
            ${data.positions.filter((p) => p.active).map((p) => html`<option value=${p.id} key=${p.id}>${p.name}</option>`)}
          </select>
        </label>
        <label>Rige desde <input type="date" value=${from} disabled=${!posId} onInput=${(e) => setFrom(e.target.value)} /></label>
        <div class="actions"><button type="submit" disabled=${busy}>Crear jugador</button></div>
      </form>
      ${data.positions.length === 0 ? html`<p class="muted">Todavía no hay posiciones definidas. Defínelas en <a href="#configuracion">Configuración</a>; no se precarga ninguna.</p>` : null}
      <${Msg} msg=${msg} />
    <//>
    <${Card} titulo=${`Lista (${rows.length})`}>
      <div class="fields">
        <label>Buscar por nombre o alias <input type="search" value=${q} onInput=${(e) => setQ(e.target.value)} /></label>
        <label class="check"><input type="checkbox" checked=${showInactive} onChange=${(e) => setShowInactive(e.target.checked)} /> Mostrar inactivos</label>
      </div>
      ${rows.length === 0
        ? html`<p class="muted">${data.players.length === 0 ? 'Todavía no hay jugadores.' : 'Ningún jugador coincide con el filtro.'}</p>`
        : html`<div class="table-wrap"><table>
            <thead><tr><th scope="col">Nombre en camiseta</th><th scope="col">Posición principal hoy</th><th scope="col">Estado</th></tr></thead>
            <tbody>${rows.map((p) => html`<tr key=${p.id}>
              <th scope="row"><a href=${'#jugador-' + p.id}>${p.jerseyName}</a> ${p.synthetic ? html`<${Sintetico} />` : null}</th>
              <td>${current(p.id)}</td><td>${p.active ? 'Activo' : 'Inactivo'}</td></tr>`)}</tbody>
          </table></div>`}
    <//>
  `;
}

// ---------- Perfil del jugador ----------

function Basicos({ player }) {
  const { db, bump } = useApp();
  const [name, setName] = useState(player.jerseyName);
  const [notes, setNotes] = useState(player.notes ?? '');
  const { msg, run, busy } = useRunner();
  return html`
    <${Card} titulo="Datos básicos">
      <form class="fields" onSubmit=${run(async () => { await updatePlayer(db, player.id, { jerseyName: name, notes }); bump(); }, 'datos guardados.')}>
        <label>Nombre en camiseta <input type="text" required value=${name} onInput=${(e) => setName(e.target.value)} /></label>
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

function HistoryRow({ rec, positions }) {
  const { db, bump } = useApp();
  const [edit, setEdit] = useState(false);
  const [pos, setPos] = useState(String(rec.positionId));
  const [from, setFrom] = useState(rec.validFrom);
  const [to, setTo] = useState(rec.validTo ?? '');
  const { msg, run, busy } = useRunner();
  if (!edit) {
    return html`<tr><td>${rec.role === 'principal' ? 'Principal' : 'Secundaria'}</td><td>${posName(positions, rec.positionId)} ${rec.synthetic ? html`<${Sintetico} />` : null}</td><td>${fmtDay(rec.validFrom)}</td><td>${rec.validTo ? fmtDay(rec.validTo) : 'vigente'}</td>
      <td class="acts"><button type="button" class="secondary" onClick=${() => setEdit(true)}>Editar</button>
      <button type="button" class="secondary" onClick=${run(async () => { if (confirm('¿Eliminar este registro del historial de posiciones?')) { await deleteHistoryRecord(db, rec.id); bump(); } })}>Eliminar</button></td></tr>`;
  }
  return html`<tr><td>${rec.role === 'principal' ? 'Principal' : 'Secundaria'}</td>
    <td><select value=${pos} onChange=${(e) => setPos(e.target.value)}>${positions.map((p) => html`<option value=${p.id} key=${p.id}>${p.name}</option>`)}</select></td>
    <td><input type="date" value=${from} onInput=${(e) => setFrom(e.target.value)} /></td>
    <td><input type="date" value=${to} onInput=${(e) => setTo(e.target.value)} /></td>
    <td class="acts"><button type="button" disabled=${busy} onClick=${run(async () => { await updateHistoryRecord(db, rec.id, { positionId: Number(pos), validFrom: from, validTo: to || null }); setEdit(false); bump(); })}>Guardar</button>
      <button type="button" class="secondary" onClick=${() => setEdit(false)}>Cancelar</button><${Msg} msg=${msg} /></td></tr>`;
}

function Posiciones({ player, history, positions }) {
  const { db, bump } = useApp();
  const active = positions.filter((p) => p.active);
  const [mainPos, setMainPos] = useState('');
  const [mainFrom, setMainFrom] = useState('');
  const [endFrom, setEndFrom] = useState('');
  const [secPos, setSecPos] = useState('');
  const [secFrom, setSecFrom] = useState('');
  const [secTo, setSecTo] = useState('');
  const [qDate, setQDate] = useState(todayIso());
  const a = useRunner(); const b = useRunner(); const c = useRunner();
  const onDate = isIsoDay(qDate) ? positionOnDate(history, qDate) : null;
  return html`
    <${Card} titulo="Posiciones con historial">
      <p>Cada sesión se compara según la <strong>posición principal que tenía el jugador en la fecha de esa sesión</strong>, no la actual. Las posiciones secundarias no lo incluyen automáticamente en varios grupos.</p>
      ${history.length === 0 ? html`<p class="muted">Sin posiciones registradas: el jugador figura «sin posición» en cualquier fecha.</p>` : html`<div class="table-wrap"><table>
        <thead><tr><th scope="col">Tipo</th><th scope="col">Posición</th><th scope="col">Desde</th><th scope="col">Hasta</th><th scope="col"><span class="sr">Acciones</span></th></tr></thead>
        <tbody>${history.map((r) => html`<${HistoryRow} key=${r.id} rec=${r} positions=${positions} />`)}</tbody></table></div>`}
      <h3>Consultar la posición en una fecha</h3>
      <div class="fields"><label>Fecha <input type="date" value=${qDate} onInput=${(e) => setQDate(e.target.value)} /></label></div>
      <p class="status" role="status">${onDate ? (onDate.principal ? `Posición principal el ${fmtDay(qDate)}: ${posName(positions, onDate.principal.positionId)}.` : `Sin posición principal el ${fmtDay(qDate)}.`) : 'Indica una fecha válida.'}${onDate && onDate.secundarias.length ? ` Secundarias: ${onDate.secundarias.map((r) => posName(positions, r.positionId)).join(', ')} (no se usan para agrupar).` : ''}</p>
      <h3>Cambiar la posición principal desde una fecha</h3>
      <form class="fields" onSubmit=${a.run(async () => { await setMainPositionFrom(db, player.id, Number(mainPos), mainFrom); setMainPos(''); setMainFrom(''); bump(); }, 'posición principal registrada.')}>
        <label>Posición <select required value=${mainPos} onChange=${(e) => setMainPos(e.target.value)}><option value="">Elige…</option>${active.map((p) => html`<option value=${p.id} key=${p.id}>${p.name}</option>`)}</select></label>
        <label>Desde <input type="date" required value=${mainFrom} onInput=${(e) => setMainFrom(e.target.value)} /></label>
        <div class="actions"><button type="submit" disabled=${a.busy}>Registrar cambio</button></div>
      </form>
      <p class="muted">Cierra la posición vigente el día anterior y abre la nueva. No reasigna sesiones ya registradas.</p>
      <${Msg} msg=${a.msg} />
      <h3>Terminar la posición principal (dejar «sin posición»)</h3>
      <form class="fields" onSubmit=${b.run(async () => { await endMainPosition(db, player.id, endFrom); setEndFrom(''); bump(); }, 'posición principal terminada.')}>
        <label>Sin posición desde <input type="date" required value=${endFrom} onInput=${(e) => setEndFrom(e.target.value)} /></label>
        <div class="actions"><button type="submit" class="secondary" disabled=${b.busy}>Terminar</button></div>
      </form>
      <${Msg} msg=${b.msg} />
      <h3>Añadir una posición secundaria</h3>
      <form class="fields" onSubmit=${c.run(async () => { await addSecondaryPosition(db, player.id, Number(secPos), secFrom, secTo || null); setSecPos(''); setSecFrom(''); setSecTo(''); bump(); }, 'posición secundaria registrada.')}>
        <label>Posición <select required value=${secPos} onChange=${(e) => setSecPos(e.target.value)}><option value="">Elige…</option>${active.map((p) => html`<option value=${p.id} key=${p.id}>${p.name}</option>`)}</select></label>
        <label>Desde <input type="date" required value=${secFrom} onInput=${(e) => setSecFrom(e.target.value)} /></label>
        <label>Hasta (opcional) <input type="date" value=${secTo} onInput=${(e) => setSecTo(e.target.value)} /></label>
        <div class="actions"><button type="submit" class="secondary" disabled=${c.busy}>Añadir secundaria</button></div>
      </form>
      <${Msg} msg=${c.msg} />
    <//>`;
}

const emptyForm = (last) => ({
  id: null, date: '', source: '', notes: '',
  ...Object.fromEntries(METRICS.flatMap((m) => [[m.key + 'V', ''], [m.key + 'U', last?.[m.key]?.unit ?? '']])),
});

function Antropometria({ player, records }) {
  const { db, bump } = useApp();
  const [f, setF] = useState(emptyForm(records[0]));
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
  const load = (r) => setF({ id: r.id, date: r.date, source: r.source ?? '', notes: r.notes ?? '', ...Object.fromEntries(METRICS.flatMap((m) => [[m.key + 'V', r[m.key]?.value ?? ''], [m.key + 'U', r[m.key]?.unit ?? '']])) });
  const cell = (r, k) => (r[k] ? `${String(r[k].value).replace('.', ',')} ${r[k].unit}` : '—');
  return html`
    <${Card} titulo="Antropometría con historial">
      <p>Cada medición es un registro fechado; no se sustituye un valor único. Las métricas relativas usarán la medición más próxima a la fecha de cada test dentro de una ventana configurable, nunca «la última» sin límite. La unidad la indicas tú.</p>
      ${records.length === 0 ? html`<p class="muted">Sin mediciones.</p>` : html`<div class="table-wrap"><table>
        <thead><tr><th scope="col">Fecha</th>${METRICS.map((m) => html`<th scope="col" key=${m.key}>${m.label}</th>`)}<th scope="col">Fuente</th><th scope="col">Observaciones</th><th scope="col"><span class="sr">Acciones</span></th></tr></thead>
        <tbody>${records.map((r) => html`<tr key=${r.id}><td>${fmtDay(r.date)} ${r.synthetic ? html`<${Sintetico} />` : null}</td>${METRICS.map((m) => html`<td key=${m.key}>${cell(r, m.key)}</td>`)}<td>${r.source || '—'}</td><td>${r.notes || '—'}</td>
          <td class="acts"><button type="button" class="secondary" onClick=${() => load(r)}>Editar</button>
          <button type="button" class="secondary" onClick=${run(async () => { if (confirm('¿Eliminar esta medición?')) { await deleteAnthropometry(db, r.id); bump(); } })}>Eliminar</button></td></tr>`)}</tbody></table></div>`}
      <h3>${f.id ? 'Editar medición' : 'Añadir medición'}</h3>
      <form onSubmit=${save}>
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
      <${Msg} msg=${msg} />
    <//>`;
}

export function PerfilJugador({ id }) {
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
  return html`
    <p><a href="#jugadores">← Jugadores</a></p>
    <h2 class="page-title">${player.jerseyName} ${player.synthetic ? html`<${Sintetico} />` : null} ${player.active ? null : html`<span class="badge">INACTIVO</span>`}</h2>
    <${Basicos} key=${'b' + player.id + player.updatedAt} player=${player} />
    <${Alias} player=${player} aliases=${data.aliases} />
    <${Posiciones} player=${player} history=${data.history} positions=${data.positions} />
    <${Antropometria} key=${'a' + player.id} player=${player} records=${data.records} />
    <${Card} titulo="Resultados por bloque">
      <div class="grid">
        <div><h3>Manifestaciones de la fuerza</h3><p class="muted">Sin tests configurados. Los resultados aparecerán aquí cuando existan sesiones (fases 2 a 5).</p></div>
        <div><h3>Perímetros</h3><p class="muted">Sin medidas definidas.</p></div>
        <div><h3>NME</h3><p class="muted">Bloque sin definir.</p></div>
      </div>
    <//>
  `;
}
