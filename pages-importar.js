// pages-importar.js — asistente de importación de Excel propio (fase 3): archivo → mapeo → vista previa → jugadores → resumen → informe.
// Todo ocurre en el navegador. Nada se guarda hasta pulsar «Guardar importación».

import { html, useState, useEffect } from './libs.js';
import { useApp } from './context.js';
import { Card, Msg, useLoad, useRunner } from './componentes.js';
import { listCatalog } from './catalogo.js';
import { readFileGrid } from './excel.js';
import * as I from './importacion.js';
import * as V from './vald.js';
import * as A from './atletas.js';
import { listPositions } from './posiciones.js';
import { downloadBlob } from './io.js';
import { fmtDate } from './util.js';
import { fmtDay } from './fechas.js';

const show = (v) => (v === null || v === undefined ? '' : v instanceof Date ? v.toISOString().slice(0, 10) : String(v));
const STEPS = [['archivo', '1. Archivo'], ['mapeo', '2. Columnas'], ['vista', '3. Vista previa'], ['jugadores', '4. Jugadores'], ['resumen', '5. Resumen'], ['resultado', '6. Informe']];

function Pasos({ step }) {
  return html`<ol class="steps" aria-label="Pasos de la importación">${STEPS.map(([id, label]) => html`<li key=${id} aria-current=${id === step ? 'step' : null} class=${id === step ? 'active' : ''}>${label}</li>`)}</ol>`;
}

export function Importar() {
  const { db, version, bump } = useApp();
  const { data: cat } = useLoad(() => listCatalog(db), [db, version]);
  const { data: batches } = useLoad(() => I.listBatches(db), [db, version]);
  const [step, setStep] = useState('archivo');
  const [origin, setOrigin] = useState('excel');
  const [vald, setVald] = useState(null);
  const [file, setFile] = useState(null);
  const [dup, setDup] = useState(null);
  const [ackDup, setAckDup] = useState(false);
  const [sheetIdx, setSheetIdx] = useState(0);
  const [headerRow, setHeaderRow] = useState(0);
  const [noHeader, setNoHeader] = useState(false);
  const [testId, setTestId] = useState('');
  const [protocolId, setProtocolId] = useState('');
  const [cols, setCols] = useState([]);
  const [fixedDate, setFixedDate] = useState('');
  const [mappingName, setMappingName] = useState('');
  const [parsed, setParsed] = useState(null);
  const [proposals, setProposals] = useState([]);
  const [resolutions, setResolutions] = useState({});
  const [remember, setRemember] = useState({});
  const [plan, setPlan] = useState(null);
  const [vplans, setVplans] = useState([]);
  const [atl, setAtl] = useState(null);
  const [choices, setChoices] = useState({});
  const [result, setResult] = useState(null);
  const { msg, setMsg, busy, run } = useRunner();

  const sheet = file?.sheets[sheetIdx];
  const grid = sheet?.rows ?? [];
  const headers = noHeader ? I.genericHeaders(grid, headerRow + 1) : (grid[headerRow] ?? []).map(show);
  const variables = cat && testId ? cat.variables.filter((v) => v.testId === Number(testId)) : [];
  const test = cat?.tests.find((t) => t.id === Number(testId));
  const importable = cat ? cat.tests.filter((t) => !t.archived && cat.variables.some((v) => v.testId === t.id && v.kind === 'raw' && !v.archived)) : [];

  const reset = () => { setVald(null); setStep('archivo'); setFile(null); setDup(null); setAckDup(false); setSheetIdx(0); setHeaderRow(0); setNoHeader(false); setTestId(''); setProtocolId(''); setCols([]); setFixedDate(''); setMappingName(''); setParsed(null); setProposals([]); setResolutions({}); setRemember({}); setPlan(null); setChoices({}); setResult(null); setMsg(null); };

  const onFile = (e) => {
    const f = e.target.files?.[0];
    if (f) loadFile(f);
  };
  const loadFile = (f) => run(async () => {
    const g = await readFileGrid(f);
    setFile({ name: f.name, size: f.size, hash: g.hash, kind: g.kind, sheets: g.sheets });
    setDup(await I.findBatchByHash(db, g.hash));
    setAckDup(false);
    setSheetIdx(0);
    setHeaderRow(I.detectHeaderRow(g.sheets[0].rows));
    setTestId(''); setCols([]); setParsed(null);
  })();

  const chooseSheet = (i) => { setSheetIdx(i); setNoHeader(false); setHeaderRow(I.detectHeaderRow(file.sheets[i].rows)); setCols([]); };
  const chooseNoHeader = (on) => { setNoHeader(on); setHeaderRow(on ? Math.max(headerRow - 1, -1) : I.detectHeaderRow(grid)); setCols([]); };
  const chooseHeader = (n) => { setHeaderRow(n); setCols([]); };
  const chooseTest = (id) => {
    setTestId(id); setProtocolId('');
    if (id && cat) setCols(I.suggestMapping(headers, cat.variables.filter((v) => v.testId === Number(id))));
    else setCols([]);
  };
  const setCol = (i, patch) => setCols((cs) => cs.map((c, k) => (k === i ? { ...c, ...patch } : c)));

  const toAtletas = run(async () => {
    const res = A.parseAthletes(grid);
    if (!res.ok) throw new Error(res.error);
    setAtl({ ...res, plan: await A.planAthletes(db, res.rows) });
    setStep('atletas');
  });

  const toVald = run(async () => {
    const res = V.parseValdGrid(grid, cat);
    if (!res.ok) throw new Error(res.error);
    setVald(res);
    setParsed({ rows: res.groups.flatMap((g) => g.rows.map((r) => ({ ...r, testId: g.testId, testName: g.testName }))), stats: res.stats });
    setStep('vista');
  });

  const toPreview = run(async () => {
    const mapping = { headerRow, cols, fixedDate, noHeader };
    const errors = I.validateMapping(mapping, variables);
    if (errors.length) throw new Error(errors.join(' '));
    setParsed(I.buildRows(grid, mapping, variables));
    setStep('vista');
  });

  const toPlayers = run(async () => {
    const names = I.distinctNames(parsed.rows.filter((r) => r.ok));
    const props = await I.proposeLinks(db, names, origin === 'vald' ? V.VALD_SOURCE : I.IMPORT_SOURCE);
    setProposals(props);
    const init = {}; const rem = {};
    for (const p of props) { if (p.suggestedPlayerId) init[p.text] = { action: 'link', playerId: p.suggestedPlayerId }; rem[p.text] = true; }
    setResolutions(init); setRemember(rem);
    setStep('jugadores');
  });

  const toSummary = run(async () => {
    const res = {};
    for (const p of proposals) {
      const r = resolutions[p.text];
      if (!r) throw new Error(`Falta decidir qué hacer con «${p.text}».`);
      if (r.action === 'new' && !String(r.jerseyName ?? '').trim()) throw new Error(`Escribe el nombre en camiseta del jugador nuevo «${p.text}».`);
      res[p.text] = r;
    }
    if (origin === 'vald') { const r = await V.planValdImport(db, vald, res); setPlan(r.plan); setVplans(r.plans); }
    else setPlan(await I.planImport(db, { rows: parsed.rows, testId: Number(testId), protocolId: protocolId ? Number(protocolId) : null, resolutions: res }));
    setChoices({});
    setStep('resumen');
  });

  const save = run(async () => {
    if (origin === 'vald') {
      const rv = await V.commitValdImport(db, { file, vald, plans: vplans, choices, remember });
      setResult(rv); setStep('resultado'); bump();
      return;
    }
    const r = await I.commitImport(db, { file, sheetName: sheet.name, mappingName, testId: Number(testId), protocolId: protocolId ? Number(protocolId) : null, mapping: { headerRow, cols, fixedDate, noHeader }, parsed, plan, conflictChoices: choices, rememberAlias: remember });
    const batch = (await I.listBatches(db)).find((b) => b.id === r.batchId);
    setResult({ ...r, batch });
    setStep('resultado');
    bump();
  });

  return html`
    <h2 class="page-title">Importar</h2>
    ${step === 'atletas' ? null : html`<${Pasos} step=${step} />`}
    ${step === 'atletas' && atl ? html`<${PasoAtletas} atl=${atl} back=${() => setStep('archivo')} done=${() => { bump(); reset(); }} />` : null}
    ${step === 'archivo' ? html`
      <${Card} titulo="1. Elige el fichero">
        <p>Fichero Excel (.xlsx) o CSV con <strong>una fila por jugador</strong> (y fecha) y <strong>una columna por variable</strong>. Cada fila es una sesión: los valores son la <strong>media de la sesión</strong> (por lado, si el test es bilateral). El fichero no sale de este equipo. En la importación de VALD (fase 4) se usará otro asistente.</p>
        <fieldset class="player-choice"><legend>Origen del fichero</legend>
          <label class="check"><input type="radio" name="origen" checked=${origin === 'excel'} onChange=${() => { setOrigin('excel'); setVald(null); }} /> Excel propio (una fila por jugador, una columna por variable)</label>
          <label class="check"><input type="radio" name="origen" checked=${origin === 'vald'} onChange=${() => setOrigin('vald')} /> Exportación CSV de VALD ForceDecks (Iso-Push, Supine 90°/90°, Calf Raise, CMJ, SL CMJ, Squat Jump, Hop y Drop Jump)</label>
          <label class="check"><input type="radio" name="origen" checked=${origin === 'atletas'} onChange=${() => setOrigin('atletas')} /> Lista de atletas de VALD (da de alta los jugadores con su alias; hazlo antes de importar tests)</label>
        </fieldset>
        <label class="fields"><span class="muted">Fichero</span><input type="file" accept=".xlsx,.csv,.txt" onChange=${onFile} disabled=${busy} /></label>
        <${Msg} msg=${msg} />
        ${file ? html`
          <p class="status ok">Leído: ${file.name} (${(file.size / 1024).toFixed(0)} KB, ${file.sheets.length} hoja${file.sheets.length === 1 ? '' : 's'}).</p>
          ${dup ? html`<div class="banner warn" role="status">Este mismo fichero ya se importó el ${fmtDate(dup.createdAt)} (lote ${dup.id}). Las sesiones idénticas se omitirían, pero conviene comprobarlo.
            <label class="check"><input type="checkbox" checked=${ackDup} onChange=${(e) => setAckDup(e.target.checked)} /> Entendido, quiero continuar con este fichero</label></div>` : null}
          <div class="fields">
            <label>Hoja <select value=${sheetIdx} onChange=${(e) => chooseSheet(Number(e.target.value))}>${file.sheets.map((s, i) => html`<option key=${i} value=${i}>${s.name}</option>`)}</select></label>
            <label class="check"><input type="checkbox" checked=${noHeader} onChange=${(e) => chooseNoHeader(e.target.checked)} /> Mi fichero no tiene fila de encabezados</label>
            ${noHeader
              ? html`<label>Primera fila de datos <input type="number" min="1" max=${Math.max(grid.length, 1)} value=${headerRow + 2} onInput=${(e) => { setHeaderRow(Math.max(-1, Number(e.target.value) - 2)); setCols([]); }} /></label>`
              : html`<label>Fila de encabezados <input type="number" min="1" max=${Math.max(grid.length, 1)} value=${headerRow + 1} onInput=${(e) => chooseHeader(Math.max(0, Number(e.target.value) - 1))} /></label>`}
          </div>
          ${!noHeader && I.looksLikeData(grid[headerRow]) ? html`<p class="banner warn" role="status">La fila elegida como encabezado contiene números: parece una fila de datos. Si tu fichero no tiene encabezados, marca «Mi fichero no tiene fila de encabezados» para no perder esa fila.</p>` : null}
          <div class="table-wrap"><table><caption>Primeras filas de la hoja (${noHeader ? 'los datos empiezan en la fila marcada' : 'la fila de encabezados está marcada'})</caption>
            <tbody>${grid.slice(0, 8).map((r, i) => html`<tr key=${i} class=${i === (noHeader ? headerRow + 1 : headerRow) ? 'hdr' : ''}><th scope="row" class="num">${i + 1}</th>${(r.length ? r : ['']).slice(0, 12).map((c, k) => html`<td key=${k}>${show(c)}</td>`)}</tr>`)}</tbody></table></div>
          <div class="actions">${origin === 'atletas'
            ? html`<button type="button" disabled=${busy} onClick=${toAtletas}>Continuar: revisar atletas</button>`
            : origin === 'vald'
            ? html`<button type="button" disabled=${(dup && !ackDup) || busy || !cat} onClick=${toVald}>Continuar: reconocer fichero VALD</button>`
            : html`<button type="button" disabled=${(dup && !ackDup) || headers.filter(Boolean).length < 2} onClick=${() => setStep('mapeo')}>Continuar: asignar columnas</button>`}</div>
          ${headers.filter(Boolean).length < 2 ? html`<p class="muted">La fila de encabezados elegida debe tener al menos dos columnas con texto.</p>` : null}` : null}
      <//>` : null}
    ${step === 'mapeo' ? html`<${PasoMapeo} ...${{ cat, importable, headers, grid, headerRow, testId, chooseTest, protocolId, setProtocolId, cols, setCol, setCols, fixedDate, setFixedDate, mappingName, setMappingName, variables, test, msg, toPreview, back: () => setStep('archivo'), busy, db }} />` : null}
    ${step === 'vista' && parsed ? html`<${PasoVista} ...${{ parsed, cols: origin === 'vald' ? [] : cols, headers: origin === 'vald' ? [] : headers, vald: origin === 'vald' ? vald : null, back: () => setStep(origin === 'vald' ? 'archivo' : 'mapeo'), next: toPlayers, busy, msg }} />` : null}
    ${step === 'jugadores' ? html`<${PasoJugadores} ...${{ proposals, resolutions, setResolutions, remember, setRemember, back: () => setStep('vista'), next: toSummary, busy, msg }} />` : null}
    ${step === 'resumen' && plan ? html`<${PasoResumen} ...${{ plan, choices, setChoices, variables, test, back: () => setStep('jugadores'), save, busy, msg }} />` : null}
    ${step === 'resultado' && result ? html`<${PasoResultado} ...${{ result, again: reset }} />` : null}
    <${Historial} batches=${batches} cat=${cat} />
  `;
}

function PasoMapeo({ cat, importable, headers, grid, headerRow, testId, chooseTest, protocolId, setProtocolId, cols, setCol, setCols, fixedDate, setFixedDate, mappingName, setMappingName, variables, test, msg, toPreview, back, busy, db }) {
  const { bump } = useApp();
  const { data: saved } = useLoad(async () => (testId ? I.listMappings(db, Number(testId)) : []), [db, testId]);
  const { data: protocols } = useLoad(async () => (testId ? db.protocols.where('testId').equals(Number(testId)).toArray() : []), [db, testId]);
  const raw = variables.filter((v) => v.kind === 'raw' && !v.archived);
  const example = (i) => { for (let r = headerRow + 1; r < Math.min(grid.length, headerRow + 30); r++) { const v = grid[r]?.[i]; if (v !== null && v !== undefined && v !== '') return show(v); } return ''; };
  const hasDate = cols.some((c) => c.role === 'fecha');
  const { msg: m2, setMsg: setM2, run } = useRunner();
  return html`<${Card} titulo="2. Asigna las columnas">
    <p>Elige el test y di qué es cada columna. Si hay columnas con un valor por lado, asigna <strong>una columna por lado</strong> (por ejemplo, «Peak Force» izquierdo y «Peak Force» derecho). Las variables calculadas (relativos, asimetrías) no se importan: la aplicación las calcula.</p>
    <div class="fields">
      <label>Test <select value=${testId} onChange=${(e) => chooseTest(e.target.value)}><option value="">Elige un test…</option>${importable.map((t) => html`<option key=${t.id} value=${t.id}>${t.name}</option>`)}</select></label>
      ${testId && protocols?.length ? html`<label>Protocolo (opcional) <select value=${protocolId} onChange=${(e) => setProtocolId(e.target.value)}><option value="">Sin protocolo</option>${protocols.map((p) => html`<option key=${p.id} value=${p.id}>${p.name}</option>`)}</select></label>` : null}
      ${testId && !hasDate ? html`<label>Fecha única para todo el fichero <input type="date" value=${fixedDate} onInput=${(e) => setFixedDate(e.target.value)} /></label>` : null}
    </div>
    ${importable.length === 0 && cat ? html`<p class="status warn">Ningún test tiene variables de origen definidas todavía. Defínelas en el catálogo.</p>` : null}
    ${testId ? html`
      ${saved?.length ? html`<div class="fields"><label>Mapeo guardado <select value="" onChange=${(e) => { const s = saved.find((x) => x.id === Number(e.target.value)); if (!s) return; const { cols: c, missing } = I.applyMapping(s, headers); setCols(c); setMappingName(s.name); setM2(missing.length ? { level: 'warn', text: `En este fichero faltan columnas del mapeo guardado: ${missing.join(', ')}.` } : { level: 'info', text: 'mapeo aplicado; revísalo.' }); }}><option value="">Usar uno guardado…</option>${saved.map((s) => html`<option key=${s.id} value=${s.id}>${s.name}</option>`)}</select></label></div>` : null}
      <p class="muted">La propuesta inicial solo usa coincidencias exactas de nombre; revísala columna por columna.</p>
      <div class="table-wrap"><table><caption>Columnas del fichero</caption>
        <thead><tr><th scope="col" class="num">Col.</th><th scope="col">Encabezado</th><th scope="col">Ejemplo</th><th scope="col">¿Qué es?</th><th scope="col">Variable</th><th scope="col">Lado</th></tr></thead>
        <tbody>${headers.map((h, i) => {
          const c = cols[i] ?? { role: 'ignorar' };
          const v = raw.find((x) => x.id === Number(c.variableId));
          return html`<tr key=${i}>
            <td class="num">${i + 1}</td><td>${h || html`<span class="muted">(sin texto)</span>`}</td><td>${example(i)}</td>
            <td><select aria-label=${'Qué es la columna ' + (i + 1)} value=${c.role} onChange=${(e) => setCol(i, { role: e.target.value })}>${Object.entries(I.ROLES).map(([k, l]) => html`<option key=${k} value=${k}>${l}</option>`)}</select></td>
            <td>${c.role === 'valor' ? html`<select aria-label=${'Variable de la columna ' + (i + 1)} value=${c.variableId ?? ''} onChange=${(e) => { const nv = raw.find((x) => x.id === Number(e.target.value)); setCol(i, { variableId: e.target.value, side: nv?.sides === 'single' ? 'S' : c.side === 'S' && nv?.sides === 'LR' ? '' : c.side }); }}><option value="">Elige…</option>${raw.map((x) => html`<option key=${x.id} value=${x.id}>${x.name}${x.unit ? ` (${x.unit})` : ''}</option>`)}</select>` : ''}</td>
            <td>${c.role === 'valor' ? html`<select aria-label=${'Lado de la columna ' + (i + 1)} value=${c.side ?? ''} onChange=${(e) => setCol(i, { side: e.target.value })}><option value="">Elige…</option>${Object.entries(I.SIDE_LABELS).filter(([k]) => !v || (v.sides === 'LR' ? k !== 'S' : v.sides === 'single' ? k === 'S' : true)).map(([k, l]) => html`<option key=${k} value=${k}>${l}</option>`)}</select>` : ''}</td>
          </tr>`;
        })}</tbody></table></div>
      <div class="fields">
        <label>Nombre para guardar este mapeo <input type="text" value=${mappingName} onInput=${(e) => setMappingName(e.target.value)} placeholder="Opcional" /></label>
        <button type="button" class="secondary" disabled=${!mappingName.trim()} onClick=${run(async () => { await I.saveMapping(db, { name: mappingName, testId: Number(testId), protocolId: protocolId ? Number(protocolId) : null, headers, cols }); bump(); }, 'mapeo guardado: se reutilizará con los mismos encabezados.')}>Guardar mapeo</button>
      </div>
      <${Msg} msg=${m2} />` : null}
    <div class="actions"><button type="button" class="secondary" onClick=${back}>Atrás</button><button type="button" disabled=${!testId || busy} onClick=${toPreview}>Continuar: vista previa</button></div>
    <${Msg} msg=${msg} />
  <//>`;
}

function PasoVista({ parsed, cols, headers, vald, back, next, busy, msg }) {
  const { rows, stats } = parsed;
  const bad = rows.filter((r) => !r.ok);
  const good = rows.filter((r) => r.ok);
  const unmapped = headers.map((h, i) => ({ h, i })).filter(({ h, i }) => h && (cols[i]?.role ?? 'ignorar') === 'ignorar');
  return html`<${Card} titulo="3. Vista previa">
    <p><strong>${stats.read}</strong> filas con datos · <strong>${good.length}</strong> válidas · <strong class=${bad.length ? 'warn-text' : ''}>${bad.length}</strong> con errores (no se importarán) · ${stats.empty} filas vacías omitidas.</p>
    ${vald ? html`<p class="status ok">Fichero VALD reconocido: ${vald.groups.map((g) => html`<span key=${g.testId}><strong>${g.testName}</strong> (${g.rows.length} ${g.rows.length === 1 ? 'sesión' : 'sesiones'})</span>`).reduce((acc, x) => (acc.length ? [...acc, ' · ', x] : [x]), [])}. No se importan el peso corporal (BW), las etiquetas (Tags) ni las columnas sin perfil${vald.ignored.length ? ` (${vald.ignored.length})` : ''}.</p>
      ${vald.stats.skipped ? html`<p class="status warn">${vald.stats.skipped} fila(s) del fichero no se importan por no tener perfil (código, altura o carga adicional): están detalladas abajo.</p>` : null}
      ${[...vald.notes, ...vald.groups.flatMap((g) => g.notes)].length ? html`<div class="banner warn" role="status"><strong>Fusiones y avisos</strong><ul>${[...vald.notes, ...vald.groups.flatMap((g) => g.notes)].map((n, i) => html`<li key=${i}>${n.rows?.length ? `Filas ${n.rows.slice(0, 12).join(', ')}${n.rows.length > 12 ? '…' : ''}: ` : ''}${n.text}</li>`)}</ul></div>` : null}` : null}
    ${unmapped.length ? html`<p class="muted">Columnas sin asignar (se ignoran): ${unmapped.map((u) => u.h).join(', ')}.</p>` : null}
    ${good.some((r) => r.reps.assumed) ? html`<p class="status warn">Sin columna de repeticiones: cada sesión se guarda con 1 repetición (un único valor equivale a una repetición).</p>` : null}
    ${bad.length ? html`<div class="table-wrap"><table><caption>Filas con errores (no se importan; corrige el fichero y vuelve a cargarlo)</caption>
      <thead><tr><th scope="col" class="num">Fila</th><th scope="col">Problema</th></tr></thead>
      <tbody>${bad.slice(0, 50).map((r) => html`<tr key=${r.rowNumber}><td class="num">${r.rowNumber}</td><td>${r.issues.map((x) => x.text).join(' ')}</td></tr>`)}</tbody></table>${bad.length > 50 ? html`<p class="muted">Se muestran las 50 primeras de ${bad.length}; el informe final las incluye todas.</p>` : null}</div>` : null}
    <div class="table-wrap"><table><caption>Primeras filas válidas</caption>
      <thead><tr><th scope="col" class="num">Fila</th>${vald ? html`<th scope="col">Test</th>` : null}<th scope="col">Jugador (como viene)</th><th scope="col">Fecha</th><th scope="col">Hora</th><th scope="col" class="num">Repeticiones</th><th scope="col" class="num">Valores</th></tr></thead>
      <tbody>${good.slice(0, 10).map((r) => html`<tr key=${r.rowNumber}><td class="num">${r.rowNumber}</td>${vald ? html`<td>${r.testName}</td>` : null}<td>${r.playerText}</td><td>${fmtDay(r.date)}</td><td>${r.time || '—'}</td><td class="num">${r.reps.total ?? [r.reps.L && 'I ' + r.reps.L, r.reps.R && 'D ' + r.reps.R].filter(Boolean).join(' / ')}${r.reps.assumed ? '*' : ''}</td><td class="num">${Object.values(r.values).reduce((n, v) => n + Object.keys(v).length, 0)}</td></tr>`)}</tbody></table></div>
    <div class="actions"><button type="button" class="secondary" onClick=${back}>Atrás</button><button type="button" disabled=${busy || good.length === 0} onClick=${next}>Continuar: confirmar jugadores</button></div>
    <${Msg} msg=${msg} />
  <//>`;
}

function PasoJugadores({ proposals, resolutions, setResolutions, remember, setRemember, back, next, busy, msg }) {
  const { db } = useApp();
  const { data: players } = useLoad(() => db.players.toArray(), [db]);
  const set = (text, v) => setResolutions((r) => { const n = { ...r }; if (v === undefined) delete n[text]; else n[text] = v; return n; });
  const valueOf = (text) => { const r = resolutions[text]; return !r ? '' : r.action === 'link' ? `link:${r.playerId}` : r.action; };
  const choose = (p, val) => {
    if (!val) return set(p.text, undefined);
    if (val === 'new') return set(p.text, { action: 'new', jerseyName: p.text });
    if (val === 'skip') return set(p.text, { action: 'skip' });
    return set(p.text, { action: 'link', playerId: Number(val.slice(5)) });
  };
  const candIds = (p) => new Set(p.candidates.map((c) => c.playerId));
  return html`<${Card} titulo="4. Confirma cada jugador">
    <p>Cada nombre distinto del fichero debe confirmarse en <strong>cada</strong> importación. Nada se vincula en silencio: lo marcado como «propuesta» solo es una sugerencia hasta que pulses «Continuar».</p>
    ${proposals.map((p) => html`<fieldset key=${p.text} class="player-choice"><legend>«${p.text}» · ${p.validRows} fila${p.validRows === 1 ? '' : 's'} válida${p.validRows === 1 ? '' : 's'}</legend>
      ${p.reasons.length && p.candidates.length ? html`<p class="status warn">${p.reasons.join(' ')}</p>` : p.candidates.length === 0 ? html`<p class="muted">Ningún jugador coincide con este nombre.</p>` : null}
      <label>Qué hacer <select aria-label=${'Qué hacer con ' + p.text} value=${valueOf(p.text)} onChange=${(e) => choose(p, e.target.value)}>
        <option value="">Elige…</option>
        ${p.candidates.length ? html`<optgroup label="Coincidencias propuestas">${p.candidates.map((c) => html`<option key=${c.playerId} value=${'link:' + c.playerId}>Vincular a ${c.name}${c.exact ? '' : ' (no exacta)'}${c.enye ? ' (cambia ñ/n)' : ''}</option>`)}</optgroup>` : null}
        <optgroup label="Otros jugadores">${(players ?? []).filter((x) => !candIds(p).has(x.id)).sort((a, b) => a.jerseyName.localeCompare(b.jerseyName, 'es')).map((x) => html`<option key=${x.id} value=${'link:' + x.id}>Vincular a ${x.jerseyName}</option>`)}</optgroup>
        <option value="new">Crear jugador nuevo</option>
        <option value="skip">Dejar sin resolver (no se importan sus filas)</option>
      </select></label>
      ${p.suggestedPlayerId && resolutions[p.text]?.playerId === p.suggestedPlayerId ? html`<span class="badge">PROPUESTA</span>` : null}
      ${resolutions[p.text]?.action === 'new' ? html`<label>Nombre en camiseta del jugador nuevo <input type="text" value=${resolutions[p.text].jerseyName} onInput=${(e) => set(p.text, { action: 'new', jerseyName: e.target.value })} /></label>` : null}
      ${resolutions[p.text] && resolutions[p.text].action !== 'skip' ? html`<label class="check"><input type="checkbox" checked=${!!remember[p.text]} onChange=${(e) => setRemember((r) => ({ ...r, [p.text]: e.target.checked }))} /> Recordar «${p.text}» como alias de Excel de este jugador</label>` : null}
    </fieldset>`)}
    <div class="actions"><button type="button" class="secondary" onClick=${back}>Atrás</button><button type="button" disabled=${busy || proposals.some((p) => !resolutions[p.text])} onClick=${next}>Continuar: resumen</button></div>
    <${Msg} msg=${msg} />
  <//>`;
}

function PasoAtletas({ atl, back, done }) {
  const { db } = useApp();
  const { data: positions } = useLoad(() => listPositions(db), [db]);
  const [dec, setDec] = useState(() => Object.fromEntries(atl.plan.map((x) => [x.name, x.suggested ? x.suggested : { action: 'pending' }])));
  const [pmap, setPmap] = useState({});
  const [result, setResult] = useState(null);
  const { msg, busy, run } = useRunner();
  const pending = atl.plan.filter((x) => dec[x.name]?.action === 'pending').length;
  const assigning = atl.positions.some((p) => pmap[p.name]);
  const save = run(async () => setResult(await A.commitAthletes(db, { rows: atl.rows, decisions: dec, positionMap: pmap })));
  const setD = (name, v) => setDec((d) => ({ ...d, [name]: v }));
  if (result) {
    const c = result.counts;
    return html`<${Card} titulo="Atletas importados">
      <p class="status ok">${c.jugadoresNuevos} jugador(es) nuevo(s), ${c.vinculados} vinculado(s) a jugadores existentes, ${c.aliasAnadidos} alias de VALD añadidos${c.aliasYaExistian ? ` (${c.aliasYaExistian} ya existían)` : ''}, ${c.omitidos} omitido(s).</p>
      <p>Posiciones: ${c.posicionesAsignadas} asignada(s)${c.posicionesCreadas ? `, ${c.posicionesCreadas} creada(s)` : ''}${c.posicionesYaTenian ? `, ${c.posicionesYaTenian} atleta(s) ya tenían posición principal y no se tocaron` : ''}.${c.errores ? ` Errores: ${c.errores}.` : ''}</p>
      <div class="actions"><button type="button" onClick=${done}>Terminar</button></div><//>`;
  }
  return html`<${Card} titulo="Atletas de VALD: revisión">
    <p>${atl.rows.length} atletas leídos. Se importan solo el <strong>nombre completo</strong> (queda como nombre en camiseta, que podrás editar) y el <strong>alias de la fuente VALD</strong>. No se importan fecha de nacimiento, altura, peso, sexo, correo ni vald-id${atl.ignored.length ? ` (columnas sin usar: ${atl.ignored.join(', ')})` : ''}.</p>
    ${atl.notes.length ? html`<div class="banner warn" role="status"><ul>${atl.notes.map((n, i) => html`<li key=${i}>Filas ${n.rows.join(', ')}: ${n.text}</li>`)}</ul></div>` : null}
    <div class="table-wrap"><table><caption>Qué se hará con cada atleta</caption>
      <thead><tr><th>Atleta (nombre VALD)</th><th>Posición en VALD</th><th>Acción</th></tr></thead>
      <tbody>${atl.plan.map((x) => html`<tr key=${x.rowNumber}><td>${x.name}</td><td>${x.position || '—'}</td><td>
        <select aria-label=${`Acción para ${x.name}`} value=${dec[x.name]?.action === 'link' ? `link:${dec[x.name].playerId}` : dec[x.name]?.action ?? 'pending'} onChange=${(e) => { const v = e.target.value; setD(x.name, v.startsWith('link:') ? { action: 'link', playerId: Number(v.slice(5)) } : { action: v }); }}>
          <option value="pending">— Elegir —</option>
          <option value="new">Crear jugador nuevo</option>
          ${x.candidates.map((c) => html`<option key=${c.playerId} value=${`link:${c.playerId}`}>Vincular con «${c.jerseyName}»</option>`)}
          <option value="skip">No importar</option>
        </select></td></tr>`)}</tbody></table></div>
    ${atl.positions.length ? html`<fieldset class="player-choice"><legend>Posiciones (opcional: solo se asignan si eliges)</legend>
      <p class="muted">Solo se asigna posición principal a quien aún no tiene ninguna; no se pisa nada. ${atl.withoutPosition} atleta(s) no traen posición.</p>
      ${atl.positions.map((p) => html`<label class="fields" key=${p.name}><span>«${p.name}» (${p.count})</span>
        <select aria-label=${`Posición para ${p.name}`} value=${pmap[p.name]?.create ? 'create' : pmap[p.name]?.positionId ?? ''} onChange=${(e) => { const v = e.target.value; setPmap((m) => ({ ...m, [p.name]: v === '' ? null : v === 'create' ? { create: true } : { positionId: Number(v) } })); }}>
          <option value="">No asignar</option>
          ${(positions ?? []).filter((q) => q.active !== false).map((q) => html`<option key=${q.id} value=${q.id}>${q.name}</option>`)}
          <option value="create">Crear posición «${p.name}»</option>
        </select></label>`)}
      ${assigning ? html`<p class="muted">La posición no lleva fecha: se aplica a todo el histórico del jugador, y nunca sustituye una posición que ya tenga.</p>` : null}
    <//>` : null}
    <${Msg} msg=${msg} />
    <div class="actions"><button type="button" class="secondary" onClick=${back}>Atrás</button>
      <button type="button" disabled=${busy || pending > 0} onClick=${save}>Guardar atletas</button></div>
    ${pending ? html`<p class="muted">Faltan ${pending} atleta(s) por elegir acción (los que coinciden con más de un jugador).</p>` : null}
  <//>`;
}

const STATUS_TEXT = { nueva: 'Nueva', duplicada: 'Ya existe idéntica (se omite)', conflicto: 'Ya existe con valores distintos', 'conflicto-fichero': 'Filas contradictorias en el fichero' };

function PasoResumen({ plan, choices, setChoices, back, save, busy, msg }) {
  const c = plan.counts;
  const conflicts = plan.sessions.filter((s) => s.status === 'conflicto');
  const inFile = plan.sessions.filter((s) => s.status === 'conflicto-fichero');
  const newPlayers = new Set(plan.sessions.filter((s) => s.status !== 'duplicada' && s.resolution.action === 'new').map((s) => s.ref)).size;
  const creates = c.nuevas + conflicts.filter((s) => choices[s.key] === 'nueva').length;
  return html`<${Card} titulo="5. Resumen antes de guardar">
    <ul>
      <li><strong>${c.nuevas}</strong> sesiones nuevas.</li>
      <li><strong>${c.duplicadas}</strong> ya existían idénticas: se omiten sin cambios.</li>
      <li><strong>${c.conflictos}</strong> coinciden en jugador, test, fecha y hora con valores distintos: no se sobrescribe nada (elige abajo).</li>
      <li><strong>${c.conflictosFichero}</strong> grupos de filas contradictorias dentro del fichero: no se importan.</li>
      <li><strong>${c.pendientes}</strong> filas de jugadores sin resolver: no se importan.</li>
      <li><strong>${c.filasConError}</strong> filas con errores: no se importan.</li>
      <li><strong>${newPlayers}</strong> jugadores nuevos se crearán.</li>
    </ul>
    ${conflicts.length ? html`<div class="table-wrap"><table><caption>Conflictos con sesiones ya guardadas</caption>
      <thead><tr><th scope="col">Jugador</th><th scope="col">Fecha</th><th scope="col">Qué hacer</th></tr></thead>
      <tbody>${conflicts.map((s) => html`<tr key=${s.key}><td>${s.playerText}</td><td>${fmtDay(s.date)} ${s.time}</td><td><select aria-label=${'Conflicto de ' + s.playerText + ' ' + s.date} value=${choices[s.key] ?? 'omitir'} onChange=${(e) => setChoices((x) => ({ ...x, [s.key]: e.target.value }))}><option value="omitir">Omitir (conservar la sesión existente)</option><option value="nueva">Guardar como sesión nueva (otra sesión ese día)</option></select></td></tr>`)}</tbody></table></div>` : null}
    ${inFile.length ? html`<p class="status warn">Filas contradictorias en el fichero (filas ${inFile.map((s) => s.rowNumbers.join('+')).join('; ')}): si son sesiones distintas del mismo día, añade una columna de hora.</p>` : null}
    <p>${creates} ${creates === 1 ? 'sesión se guardará' : 'sesiones se guardarán'}. Los valores originales no se modifican y las derivadas se calcularán después.</p>
    <div class="actions"><button type="button" class="secondary" onClick=${back}>Atrás</button><button type="button" disabled=${busy} onClick=${save}>Guardar importación</button></div>
    <${Msg} msg=${msg} />
  <//>`;
}

function PasoResultado({ result, again }) {
  const k = result.counts;
  return html`<${Card} titulo="6. Importación guardada">
    <p class="status ok">${result.batchIds?.length > 1 ? `Lotes ${result.batchIds.join(', ')} guardados` : `Lote ${result.batchId} guardado`}: ${k.sesionesCreadas} sesiones creadas.</p>
    <ul>
      <li>${k.duplicadasOmitidas} duplicadas omitidas · ${k.conflictosOmitidos} conflictos omitidos · ${k.conflictosGuardadosComoNuevas} conflictos guardados como sesión nueva · ${k.conflictosFichero} grupos contradictorios del fichero sin importar.</li>
      <li>${k.jugadoresNuevos} jugadores nuevos · ${k.aliasGuardados} alias guardados · ${k.filasSinResolver} filas sin resolver · ${k.filasConError} filas con error.</li>
    </ul>
    <div class="actions">
      ${(result.batches ?? [result.batch]).map((b) => html`<button type="button" key=${b.id} onClick=${() => downloadBlob(new Blob([I.reportCsv(b)], { type: 'text/csv;charset=utf-8' }), `informe-importacion-lote-${b.id}.csv`)}>Descargar informe (CSV)${(result.batches?.length ?? 1) > 1 ? ' · lote ' + b.id : ''}</button>`)}
      <button type="button" class="secondary" onClick=${again}>Importar otro fichero</button>
    </div>
    <p class="muted">Haz una copia de seguridad cuando termines de cargar datos.</p>
  <//>`;
}

function Historial({ batches, cat }) {
  if (!batches) return null;
  const tname = (id) => cat?.tests.find((t) => t.id === id)?.name ?? `test ${id}`;
  return html`<${Card} titulo="Importaciones anteriores" id="historial-importaciones">
    ${batches.length === 0 ? html`<p class="muted">Todavía no se ha importado ningún fichero.</p>` : html`<div class="table-wrap"><table>
      <thead><tr><th scope="col">Fecha</th><th scope="col">Fichero</th><th scope="col">Test</th><th scope="col" class="num">Sesiones</th><th scope="col" class="num">Omitidas</th><th scope="col" class="num">Sin importar</th><th scope="col"><span class="sr">Informe</span></th></tr></thead>
      <tbody>${batches.map((b) => html`<tr key=${b.id}><td>${fmtDate(b.createdAt)}</td><td>${b.fileName}</td><td>${tname(b.testId)}</td><td class="num">${b.sesionesCreadas ?? 0}</td><td class="num">${(b.duplicadasOmitidas ?? 0) + (b.conflictosOmitidos ?? 0)}</td><td class="num">${(b.filasConError ?? 0) + (b.filasSinResolver ?? 0) + (b.conflictosFichero ?? 0)}</td><td class="acts"><button type="button" class="secondary" onClick=${() => downloadBlob(new Blob([I.reportCsv(b)], { type: 'text/csv;charset=utf-8' }), `informe-importacion-lote-${b.id}.csv`)}>Informe</button></td></tr>`)}</tbody></table></div>`}
  <//>`;
}
