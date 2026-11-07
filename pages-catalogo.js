// pages-catalogo.js — pantallas del catálogo: lista de tests, manifestaciones y zonas, y detalle de un test
// (protocolos y variables). Todo se edita sin tocar el código; archivar no borra nada.

import { html, useState } from './libs.js';
import { useApp } from './context.js';
import { Card, Msg, useLoad, useRunner } from './componentes.js';
import * as C from './catalogo.js';

const ND = html`<span class="muted">No definido</span>`;
const byId = (list) => Object.fromEntries(list.map((x) => [x.id, x]));
const Archivada = ({ x }) => (x.archived ? html` <span class="badge">ARCHIVADO</span>` : null);

// ---------- Manifestaciones y zonas ----------

function NameRow({ item, usos, onRename, onArchive }) {
  const { bump } = useApp();
  const [edit, setEdit] = useState(false);
  const [name, setName] = useState(item.name);
  const { msg, run, busy } = useRunner();
  const act = (fn) => run(async () => { await fn(); bump(); });
  return html`<tr class=${item.archived ? 'inactive' : ''}>
    <td>${edit ? html`<input type="text" aria-label="Nombre" value=${name} onInput=${(e) => setName(e.target.value)} />` : html`${item.name}<${Archivada} x=${item} />`}<${Msg} msg=${msg} /></td>
    <td class="num">${usos}</td>
    <td class="acts">
      ${edit
        ? html`<button type="button" disabled=${busy} onClick=${act(async () => { await onRename(item.id, name); setEdit(false); })}>Guardar</button><button type="button" class="secondary" onClick=${() => { setEdit(false); setName(item.name); }}>Cancelar</button>`
        : html`<button type="button" class="secondary" onClick=${() => setEdit(true)}>Renombrar</button>`}
      <button type="button" class="secondary" disabled=${busy} onClick=${act(() => onArchive(item.id, !item.archived))}>${item.archived ? 'Activar' : 'Archivar'}</button>
    </td></tr>`;
}

function NameList({ titulo, intro, items, usosDe, onCreate, onRename, onArchive, etiqueta }) {
  const { bump } = useApp();
  const [name, setName] = useState('');
  const { msg, run, busy } = useRunner();
  return html`<${Card} titulo=${titulo}>
    <p>${intro}</p>
    ${items.length === 0 ? html`<p class="muted">Todavía no hay elementos.</p>` : html`<div class="table-wrap"><table>
      <thead><tr><th scope="col">${etiqueta}</th><th scope="col" class="num">Tests</th><th scope="col"><span class="sr">Acciones</span></th></tr></thead>
      <tbody>${items.map((i) => html`<${NameRow} key=${i.id} item=${i} usos=${usosDe(i)} onRename=${onRename} onArchive=${onArchive} />`)}</tbody></table></div>`}
    <form class="fields" onSubmit=${run(async () => { await onCreate(name); setName(''); bump(); }, 'creado.')}>
      <label>Nuevo <input type="text" required value=${name} onInput=${(e) => setName(e.target.value)} /></label>
      <div class="actions"><button type="submit" disabled=${busy}>Añadir</button></div>
    </form>
    <${Msg} msg=${msg} />
  <//>`;
}

// ---------- Lista de tests ----------

function NuevoTest({ data }) {
  const { db, bump } = useApp();
  const [name, setName] = useState('');
  const [block, setBlock] = useState('fuerza');
  const [man, setMan] = useState('');
  const [zone, setZone] = useState('');
  const { msg, run, busy } = useRunner();
  const mans = data.manifestations.filter((m) => m.blockKey === block && !m.archived);
  return html`<form class="fields" onSubmit=${run(async () => {
      const id = await C.createTest(db, { name, blockKey: block, manifestationId: man ? Number(man) : null, zoneId: zone ? Number(zone) : null });
      setName(''); bump();
      return id;
    }, 'test creado.')}>
    <label>Nombre del test <input type="text" required value=${name} onInput=${(e) => setName(e.target.value)} /></label>
    <label>Bloque <select value=${block} onChange=${(e) => { setBlock(e.target.value); setMan(''); }}>${data.blocks.map((b) => html`<option key=${b.key} value=${b.key}>${b.name}</option>`)}</select></label>
    <label>Manifestación <select value=${man} onChange=${(e) => setMan(e.target.value)}><option value="">Sin manifestación</option>${mans.map((m) => html`<option key=${m.id} value=${m.id}>${m.name}</option>`)}</select></label>
    <label>Zona <select value=${zone} onChange=${(e) => setZone(e.target.value)}><option value="">Sin zona</option>${data.zones.filter((z) => !z.archived).map((z) => html`<option key=${z.id} value=${z.id}>${z.name}</option>`)}</select></label>
    <div class="actions"><button type="submit" disabled=${busy}>Añadir test</button></div>
    <${Msg} msg=${msg} />
  </form>`;
}

function TestsCard({ data }) {
  const [block, setBlock] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [q, setQ] = useState('');
  const mans = byId(data.manifestations);
  const zones = byId(data.zones);
  const nVars = {};
  for (const v of data.variables) nVars[v.testId] = (nVars[v.testId] || 0) + 1;
  const text = q.trim().toLowerCase();
  const rows = data.tests.filter((t) => (!block || t.blockKey === block) && (showArchived || !t.archived) && (!text || t.name.toLowerCase().includes(text)));
  return html`<${Card} titulo="Tests" id="tests">
    <div class="fields">
      <label>Buscar <input type="search" value=${q} onInput=${(e) => setQ(e.target.value)} /></label>
      <label>Bloque <select value=${block} onChange=${(e) => setBlock(e.target.value)}><option value="">Todos</option>${data.blocks.map((b) => html`<option key=${b.key} value=${b.key}>${b.name}</option>`)}</select></label>
      <label class="check"><input type="checkbox" checked=${showArchived} onChange=${(e) => setShowArchived(e.target.checked)} /> Mostrar archivados</label>
    </div>
    ${rows.length === 0 ? html`<p class="muted">No hay tests con ese filtro.</p>` : html`<div class="table-wrap"><table>
      <thead><tr><th scope="col">Test</th><th scope="col">Manifestación</th><th scope="col">Zona</th><th scope="col" class="num">Variables</th></tr></thead>
      <tbody>${rows.map((t) => html`<tr key=${t.id} class=${t.archived ? 'inactive' : ''}>
        <td><a href=${'#catalogo-test-' + t.id}>${t.name}</a><${Archivada} x=${t} /></td>
        <td>${mans[t.manifestationId]?.name ?? '—'}</td>
        <td>${zones[t.zoneId]?.name ?? '—'}</td>
        <td class="num">${nVars[t.id] || 0}</td></tr>`)}</tbody></table></div>`}
    <h3>Añadir un test</h3>
    <${NuevoTest} data=${data} />
  <//>`;
}

export function Catalogo() {
  const { db, version } = useApp();
  const { data, error } = useLoad(() => C.listCatalog(db), [db, version]);
  if (error) return html`<p class="status fail" role="alert">${error}</p>`;
  if (!data) return html`<h2 class="page-title">Catálogo de tests</h2><p>Cargando…</p>`;
  const fuerza = data.manifestations.filter((m) => m.blockKey === 'fuerza');
  return html`
    <h2 class="page-title">Catálogo de tests</h2>
    <p class="muted">Aquí se añaden, editan y archivan los tests, sus protocolos y sus variables sin tocar el código. Un test o una variable con datos no se borra: se archiva. Lo que no hayas definido (unidades, dirección de interpretación, fórmulas) aparece como «No definido»: no se supone nada.</p>
    <${TestsCard} data=${data} />
    <${NameList} titulo="Manifestaciones de la fuerza" etiqueta="Manifestación" intro="La manifestación es atributo de cada variable; el test conserva la de su listado. Se pueden añadir, renombrar y archivar."
      items=${fuerza} usosDe=${(m) => data.tests.filter((t) => t.manifestationId === m.id).length}
      onCreate=${(name) => C.createManifestation(db, { name })} onRename=${(id, n) => C.renameManifestation(db, id, n)} onArchive=${(id, a) => C.setManifestationArchived(db, id, a)} />
    <${NameList} titulo="Zonas anatómicas" etiqueta="Zona" intro="Los tests de Fast Dynamic Strength y Reactive Strength son globales y no tienen zona."
      items=${data.zones} usosDe=${(z) => data.tests.filter((t) => t.zoneId === z.id).length}
      onCreate=${(name) => C.createZone(db, { name })} onRename=${(id, n) => C.renameZone(db, id, n)} onArchive=${(id, a) => C.setZoneArchived(db, id, a)} />
  `;
}

// ---------- Detalle de un test ----------

function TestDatos({ test, data }) {
  const { db, bump } = useApp();
  const [name, setName] = useState(test.name);
  const [man, setMan] = useState(test.manifestationId ?? '');
  const [zone, setZone] = useState(test.zoneId ?? '');
  const [notes, setNotes] = useState(test.notes ?? '');
  const { msg, run, busy } = useRunner();
  const mans = data.manifestations.filter((m) => m.blockKey === test.blockKey);
  return html`<${Card} titulo="Datos del test">
    <form class="fields" onSubmit=${run(async () => { await C.updateTest(db, test.id, { name, notes, manifestationId: man === '' ? null : Number(man), zoneId: zone === '' ? null : Number(zone) }); bump(); }, 'guardado.')}>
      <label>Nombre <input type="text" required value=${name} onInput=${(e) => setName(e.target.value)} /></label>
      <label>Manifestación del listado <select value=${man} onChange=${(e) => setMan(e.target.value)}><option value="">Sin manifestación</option>${mans.map((m) => html`<option key=${m.id} value=${m.id}>${m.name}</option>`)}</select></label>
      <label>Zona <select value=${zone} onChange=${(e) => setZone(e.target.value)}><option value="">Sin zona</option>${data.zones.map((z) => html`<option key=${z.id} value=${z.id}>${z.name}</option>`)}</select></label>
      <label>Notas <input type="text" value=${notes} onInput=${(e) => setNotes(e.target.value)} /></label>
      <div class="actions">
        <button type="submit" disabled=${busy}>Guardar</button>
        <button type="button" class="secondary" disabled=${busy} onClick=${run(async () => { await C.setTestArchived(db, test.id, !test.archived); bump(); }, test.archived ? 'test activado.' : 'test archivado: no se borra nada.')}>${test.archived ? 'Activar test' : 'Archivar test'}</button>
      </div>
    </form>
    <${Msg} msg=${msg} />
  <//>`;
}

function Protocolos({ test, protocols }) {
  const { db, bump } = useApp();
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const { msg, run, busy } = useRunner();
  return html`<${Card} titulo="Protocolos">
    <p class="muted">Posición, ángulos, palanca, carga y criterio de validez. El protocolo se asocia al test; no se cargan protocolos que no hayas definido.</p>
    ${protocols.length === 0 ? html`<p class="muted">Este test no tiene protocolos.</p>` : html`<ul>${protocols.map((p) => html`<li key=${p.id} class=${p.archived ? 'inactive' : ''}><strong>${p.name}</strong><${Archivada} x=${p} />${p.description ? ` — ${p.description}` : ''}
      <button type="button" class="secondary" onClick=${run(async () => { await C.setProtocolArchived(db, p.id, !p.archived); bump(); })}>${p.archived ? 'Activar' : 'Archivar'}</button></li>`)}</ul>`}
    <form class="fields" onSubmit=${run(async () => { await C.createProtocol(db, { testId: test.id, name, description: desc }); setName(''); setDesc(''); bump(); }, 'protocolo creado.')}>
      <label>Nombre <input type="text" required value=${name} onInput=${(e) => setName(e.target.value)} /></label>
      <label>Descripción <input type="text" value=${desc} onInput=${(e) => setDesc(e.target.value)} /></label>
      <div class="actions"><button type="submit" disabled=${busy}>Añadir protocolo</button></div>
    </form>
    <${Msg} msg=${msg} />
  <//>`;
}

const optionsOf = (obj, blank) => [html`<option key="" value="">${blank}</option>`, ...Object.entries(obj).map(([k, v]) => html`<option key=${k} value=${k}>${v}</option>`)];

// Formulario de variable (alta y edición). La fórmula solo admite las operaciones cerradas definidas por el usuario.
function VariableForm({ test, variable, rawVars, data, onDone }) {
  const { db, bump } = useApp();
  const v = variable;
  const f = v?.formula ?? null;
  const [name, setName] = useState(v?.name ?? '');
  const [unit, setUnit] = useState(v?.unit ?? '');
  const [sides, setSides] = useState(v?.sides ?? '');
  const [direction, setDirection] = useState(v?.direction ?? '');
  const [man, setMan] = useState(v?.manifestationId ?? '');
  const [kind, setKind] = useState(v?.kind ?? 'raw');
  const [op, setOp] = useState(f?.op ?? '');
  const [source, setSource] = useState(f?.operands?.[0] ?? '');
  const [factor, setFactor] = useState(f?.params?.factor ?? C.SW_FACTOR_DEFAULT);
  const [text, setText] = useState(f?.text ?? '');
  const [reason, setReason] = useState('');
  const { msg, run, busy } = useRunner();
  const mans = data.manifestations.filter((m) => m.blockKey === test.blockKey);
  const formula = () => {
    if (kind === 'raw') return null;
    if (!op) return text.trim() ? { op: null, operands: [], params: {}, text } : null;
    return { op, operands: source === '' ? [] : [Number(source)], params: op === 'REL_SW' ? { factor: Number(factor) } : {}, text };
  };
  const save = run(async () => {
    const common = { name, unit, sides: sides || null, direction: direction || null, manifestationId: man === '' ? null : Number(man) };
    if (v) await C.updateVariable(db, v.id, { ...common, formula: formula() }, reason);
    else await C.createVariable(db, { testId: test.id, ...common, kind, formula: formula() });
    bump();
    onDone?.();
  }, v ? 'variable guardada.' : 'variable creada.');
  return html`<form class="fields" onSubmit=${save}>
    <label>Nombre <input type="text" required value=${name} onInput=${(e) => setName(e.target.value)} /></label>
    <label>Unidad (déjala vacía si no está definida) <input type="text" value=${kind === 'derived' && op ? C.OPERATIONS[op].unit : unit} disabled=${kind === 'derived' && !!op} onInput=${(e) => setUnit(e.target.value)} /></label>
    ${kind === 'derived' && op ? html`<p class="muted" style="flex-basis:100%">La unidad la fija la operación elegida (${C.OPERATIONS[op].unit}). Si cambias la operación, revisa también el nombre de la variable.</p>` : null}
    <label>Valores <select value=${sides} onChange=${(e) => setSides(e.target.value)}>${optionsOf(C.SIDES, 'No definido')}</select></label>
    <label>Dirección de interpretación <select value=${direction} onChange=${(e) => setDirection(e.target.value)}>${optionsOf(C.DIRECTIONS, 'No definida')}</select></label>
    <label>Manifestación de la variable <select value=${man} onChange=${(e) => setMan(e.target.value)}><option value="">La del test</option>${mans.map((m) => html`<option key=${m.id} value=${m.id}>${m.name}</option>`)}</select></label>
    <label>Tipo <select value=${kind} disabled=${!!v} onChange=${(e) => setKind(e.target.value)}>${Object.entries(C.KINDS).map(([k, l]) => html`<option key=${k} value=${k}>${l}</option>`)}</select></label>
    ${kind === 'derived' ? html`
      <label>Operación <select value=${op} onChange=${(e) => setOp(e.target.value)}><option value="">Solo descripción</option>${Object.entries(C.OPERATIONS).map(([k, d]) => html`<option key=${k} value=${k}>${d.label}</option>`)}</select></label>
      ${op ? html`<label>Variable de origen <select value=${source} onChange=${(e) => setSource(e.target.value)}><option value="">Elige…</option>${rawVars.filter((r) => !v || r.id !== v.id).map((r) => html`<option key=${r.id} value=${r.id}>${r.name}</option>`)}</select></label>` : null}
      ${op === 'REL_SW' ? html`<label>Factor SW <input type="number" step="any" min="0" value=${factor} onInput=${(e) => setFactor(e.target.value)} /></label>` : null}
      ${op ? html`<p class="muted" style="flex-basis:100%">Definición: ${C.OPERATIONS[op].definition}</p>` : null}
      <label>Descripción de la fórmula <input type="text" value=${text} onInput=${(e) => setText(e.target.value)} /></label>
      ${v ? html`<label>Motivo si cambias la fórmula <input type="text" value=${reason} onInput=${(e) => setReason(e.target.value)} /></label>` : null}` : null}
    <div class="actions">
      <button type="submit" disabled=${busy}>${v ? 'Guardar variable' : 'Añadir variable'}</button>
      ${v ? html`<button type="button" class="secondary" onClick=${() => onDone?.()}>Cancelar</button>` : null}
    </div>
    <${Msg} msg=${msg} />
  </form>`;
}

function VariableRow({ v, test, rawVars, data, history }) {
  const { db, bump } = useApp();
  const [edit, setEdit] = useState(false);
  const { msg, run, busy } = useRunner();
  const mans = byId(data.manifestations);
  const manName = mans[C.variableManifestationId(v, test)]?.name ?? '—';
  const op = v.formula?.op ? C.OPERATIONS[v.formula.op] : null;
  const src = v.formula?.operands?.[0] ? rawVars.find((r) => r.id === v.formula.operands[0])?.name : null;
  return html`<tr class=${v.archived ? 'inactive' : ''}>
    <td>${v.name}<${Archivada} x=${v} /></td>
    <td>${v.unit ?? ND}</td>
    <td>${v.sides ? C.SIDES[v.sides] : ND}</td>
    <td>${v.direction ? C.DIRECTIONS[v.direction] : ND}</td>
    <td>${manName}</td>
    <td>${v.kind === 'derived'
      ? html`<strong>${op ? op.label : 'Calculada'}</strong>${src ? ` de «${src}»` : ''}${v.formula?.op === 'REL_SW' ? ` (factor ${v.formula.params.factor})` : ''}${v.formula?.text ? html`<br /><span class="muted">${v.formula.text}</span>` : null}
        ${op ? html`<br /><span class="muted">${op.definition}</span>` : null}${!v.formula ? html`<br /><span class="muted">Fórmula no definida</span>` : null}
        ${history.length > 1 ? html`<details><summary>Versiones (${history.length})</summary><ul>${history.map((h) => html`<li key=${h.id}>v${h.version} · ${new Date(h.at).toLocaleDateString('es-ES')} · ${h.reason}${h.formula?.params?.factor ? ` · factor ${h.formula.params.factor}` : ''}</li>`)}</ul></details>` : null}`
      : html`Dato de origen`}</td>
    <td class="acts">
      <button type="button" class="secondary" onClick=${() => setEdit(!edit)}>${edit ? 'Cerrar' : 'Editar'}</button>
      <button type="button" class="secondary" disabled=${busy} onClick=${run(async () => { await C.setVariableArchived(db, v.id, !v.archived); bump(); })}>${v.archived ? 'Activar' : 'Archivar'}</button>
      <button type="button" class="secondary" disabled=${busy} onClick=${run(async () => { if (confirm(`¿Eliminar la variable «${v.name}»? Solo es posible si no tiene datos ni otras variables dependen de ella.`)) { await C.deleteVariable(db, v.id); bump(); } })}>Eliminar</button>
      <${Msg} msg=${msg} />
    </td></tr>
    ${edit ? html`<tr><td colspan="7"><${VariableForm} test=${test} variable=${v} rawVars=${rawVars} data=${data} onDone=${() => setEdit(false)} /></td></tr>` : null}`;
}

export function TestDetalle({ id }) {
  const { db, version } = useApp();
  const { data, error } = useLoad(async () => {
    const cat = await C.listCatalog(db);
    const history = await db.formulaHistory.toArray();
    return { cat, history };
  }, [db, version, id]);
  if (error) return html`<p class="status fail" role="alert">${error}</p>`;
  if (!data) return html`<p>Cargando…</p>`;
  const { cat, history } = data;
  const test = cat.tests.find((t) => t.id === id);
  if (!test) return html`<p><a href="#catalogo">← Volver al catálogo</a></p><p class="status fail" role="alert">El test no existe.</p>`;
  const vars = cat.variables.filter((v) => v.testId === id);
  const rawVars = vars.filter((v) => v.kind === 'raw' && !v.archived);
  const protocols = cat.protocols.filter((p) => p.testId === id);
  return html`
    <p><a href="#catalogo">← Volver al catálogo</a></p>
    <h2 class="page-title">${test.name}${test.archived ? html` <span class="badge">ARCHIVADO</span>` : null}</h2>
    <${TestDatos} key=${'d' + test.id + test.updatedAt} test=${test} data=${cat} />
    <${Protocolos} test=${test} protocols=${protocols} />
    <${Card} titulo="Variables">
      <p class="muted">Cada variable tiene su unidad, su dirección de interpretación y, si es calculada, su fórmula. El dato absoluto y el relativo son variables separadas. La unidad, la dirección y las fórmulas que no hayas definido aparecen como «No definido».</p>
      ${vars.length === 0 ? html`<p class="muted">Este test aún no tiene variables definidas.</p>` : html`<div class="table-wrap"><table>
        <thead><tr><th scope="col">Variable</th><th scope="col">Unidad</th><th scope="col">Valores</th><th scope="col">Dirección</th><th scope="col">Manifestación</th><th scope="col">Origen / fórmula</th><th scope="col"><span class="sr">Acciones</span></th></tr></thead>
        <tbody>${vars.map((v) => html`<${VariableRow} key=${v.id} v=${v} test=${test} rawVars=${rawVars} data=${cat} history=${history.filter((h) => h.variableId === v.id).sort((a, b) => a.version - b.version)} />`)}</tbody></table></div>`}
      <h3>Añadir una variable</h3>
      <${VariableForm} key=${'n' + vars.length} test=${test} variable=${null} rawVars=${rawVars} data=${cat} />
    <//>
  `;
}

// ---------- Resumen de un bloque (solo lectura) ----------

export function BloqueCatalogo({ blockKey, titulo, vacio }) {
  const { db, version } = useApp();
  const { data } = useLoad(() => C.listCatalog(db), [db, version]);
  if (!data) return html`<h2 class="page-title">${titulo}</h2><p>Cargando…</p>`;
  const tests = data.tests.filter((t) => t.blockKey === blockKey && !t.archived);
  if (tests.length === 0) {
    return html`<h2 class="page-title">${titulo}</h2><${Card} titulo=${vacio}><p>Los tests, protocolos, variables y unidades de este bloque los defines tú en el <a href="#catalogo">catálogo</a>. No se precarga nada.</p><//>`;
  }
  const mans = byId(data.manifestations);
  const zones = byId(data.zones);
  const groups = [];
  const order = data.manifestations.filter((m) => m.blockKey === blockKey && !m.archived).map((m) => m.id);
  for (const mid of [...order, null]) {
    const ts = tests.filter((t) => (t.manifestationId ?? null) === mid);
    if (ts.length) groups.push({ mid, ts });
  }
  const nVars = {};
  for (const v of data.variables) if (!v.archived) nVars[v.testId] = (nVars[v.testId] || 0) + 1;
  return html`<h2 class="page-title">${titulo}</h2>
    <p class="muted">Aún no hay sesiones: los resultados llegarán con los importadores. Esto es el catálogo configurado; se edita en el <a href="#catalogo">catálogo de tests</a>.</p>
    ${groups.map((g) => html`<${Card} key=${g.mid ?? 'sin'} titulo=${g.mid ? mans[g.mid].name : 'Sin manifestación'}>
      <ul>${g.ts.map((t) => html`<li key=${t.id}><a href=${'#catalogo-test-' + t.id}>${t.name}</a>${t.zoneId ? html` <span class="muted">· ${zones[t.zoneId]?.name}</span>` : null} <span class="muted">· ${nVars[t.id] || 0} variables</span></li>`)}</ul>
    <//>`)}`;
}
