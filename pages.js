import { html, useState, useEffect, useRef } from '../../vendor/libs.js';
import { useApp } from './context.js';
import { fmtNum, fmtMB, fmtDate, backupState } from './util.js';
import { APP_VERSION, DB_NAME, getLocal, setLocal, getSetting, setSetting, clearSetting, audit, requestPersistence, storageEstimate } from '../db.js';
import {
  buildBackup, encodeBackup, backupFileName, parseBackupText, decodeBackupObject, validateBackup, restoreBackup, readSnapshot, countTables,
} from '../backup/backup.js';
import { saveBackup, saveToRememberedDir, pickDirectory, rememberedDirStatus, canPickFile, canPickDir } from '../backup/io.js';

// ---------- Piezas comunes ----------

const Msg = ({ msg }) => (msg ? html`<p class=${'status ' + msg.level} role="status">${msg.level === 'ok' ? 'Correcto: ' : msg.level === 'fail' ? 'Error: ' : ''}${msg.text}</p>` : null);

function Card({ titulo, children }) {
  return html`<section class="card"><h2>${titulo}</h2>${children}</section>`;
}

export function Proximamente({ titulo, fase, detalle }) {
  return html`
    <h2 class="page-title">${titulo}</h2>
    <${Card} titulo=${'Disponible en la fase ' + fase}><p>${detalle}</p><//>
  `;
}

export function Bloque({ titulo, vacio, detalle }) {
  return html`
    <h2 class="page-title">${titulo}</h2>
    <${Card} titulo=${vacio}><p>${detalle}</p><//>
  `;
}

// ---------- Inicio ----------

export function Inicio() {
  const { db, version } = useApp();
  const [info, setInfo] = useState(null);
  useEffect(() => {
    let alive = true;
    (async () => {
      const [lastBackup, persistence, estimate, createdAt, audits, days] = await Promise.all([
        getLocal(db, 'lastBackup'), getLocal(db, 'persistence'), storageEstimate(), db.meta.get('createdAt'), db.auditLog.count(), getSetting(db, 'backupReminderDays'),
      ]);
      if (alive) setInfo({ lastBackup, persistence, estimate, createdAt: createdAt?.value, audits, days });
    })();
    return () => { alive = false; };
  }, [db, version]);
  if (!info) return html`<p>Cargando…</p>`;
  const bs = backupState(info.lastBackup, info.days);
  return html`
    <h2 class="page-title">Inicio</h2>
    <div class="grid">
      <${Card} titulo="Copia de seguridad">
        <p class=${'status ' + bs.level}>${bs.level === 'warn' ? 'Atención: ' : ''}${bs.text}</p>
        ${info.lastBackup
          ? html`<p class="muted">${info.lastBackup.name} · ${fmtMB(info.lastBackup.size)} · ${info.lastBackup.destino}${info.lastBackup.cifrada ? ' · cifrada' : ''}${info.lastBackup.gzip ? ' · comprimida' : ''}</p>`
          : null}
        <p><a class="btn" href="#copias">Crear o restaurar una copia</a></p>
      <//>
      <${Card} titulo="Almacenamiento en este navegador">
        <p class=${'status ' + (info.persistence?.persistente ? 'ok' : 'warn')}>
          ${info.persistence?.persistente
            ? 'El navegador marca el almacenamiento de este sitio como persistente.'
            : 'El navegador no garantiza conservar los datos (almacenamiento no persistente). Puede borrarlos si se queda sin espacio, y se pierden si limpias los datos del sitio. Las copias de seguridad son la protección real.'}
        </p>
        ${info.estimate ? html`<p class="muted">Espacio usado por este sitio: ${fmtMB(info.estimate.usage)} de una cuota estimada de ${fmtMB(info.estimate.quota)}.</p>` : null}
      <//>
      <${Card} titulo="Estado de la base">
        <p>Base creada el ${fmtDate(info.createdAt)}.</p>
        <p class="muted">Registro de acciones: ${fmtNum(info.audits)} entradas. Todavía no hay jugadores ni mediciones: se añaden en las fases siguientes.</p>
        <p class="muted">Los datos están solo en este navegador y este perfil de usuario; no se sincronizan con ningún servidor ni con otros dispositivos.</p>
      <//>
    </div>
  `;
}

// ---------- Copias de seguridad ----------

function CrearCopia() {
  const { db, bump } = useApp();
  const [gzip, setGzip] = useState(false);
  const [enc, setEnc] = useState(false);
  const [pw, setPw] = useState('');
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const [dir, setDir] = useState(null);
  const [last, setLast] = useState(null);
  const refresh = async () => {
    setDir(await rememberedDirStatus(db));
    setLast(await getLocal(db, 'lastBackup'));
  };
  useEffect(() => { refresh(); }, [db]);

  const make = async () => {
    if (enc && pw.length < 8) throw new Error('La contraseña debe tener al menos 8 caracteres.');
    const t0 = performance.now();
    const inner = await buildBackup(db, APP_VERSION);
    const { blob, gzip: g, encrypted } = await encodeBackup(inner, { gzip, password: enc ? pw : '' });
    return { inner, blob, g, encrypted, name: backupFileName(new Date(), { gzip: g, encrypted }), ms: Math.round(performance.now() - t0) };
  };
  const finish = async (made, res) => {
    const rec = { at: new Date().toISOString(), name: made.name, size: made.blob.size, destino: res.destino, verificado: res.verificado, cifrada: made.encrypted, gzip: made.g };
    await setLocal(db, 'lastBackup', rec);
    await audit(db, 'copia-creada', { destino: res.destino, cifrada: made.encrypted, comprimida: made.g, tamanoBytes: made.blob.size, recuentos: made.inner.counts });
    setMsg({ level: 'ok', text: `copia «${made.name}» (${fmtMB(made.blob.size)}) creada en ${fmtNum(made.ms)} ms. Destino: ${res.destino}${res.verificado === true ? '; tamaño escrito verificado' : res.verificado === false ? '; AVISO: el tamaño escrito no coincide con el de la copia' : ''}.` });
    await refresh();
    bump();
  };
  const run = (fn) => async () => {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
    } catch (e) {
      setMsg(e?.name === 'AbortError' ? { level: 'info', text: 'Guardado cancelado.' } : { level: 'fail', text: e?.message || String(e) });
    } finally {
      setBusy(false);
    }
  };

  return html`
    <${Card} titulo="Crear copia completa">
      <p>La copia incluye todos los datos y la configuración de la aplicación en un único fichero. No incluye los ajustes propios de este navegador (carpeta recordada, estado de la última copia).</p>
      <div class="fields">
        <label class="check"><input type="checkbox" checked=${gzip} onChange=${(e) => setGzip(e.target.checked)} /> Comprimir (gzip)</label>
        <label class="check"><input type="checkbox" checked=${enc} onChange=${(e) => { setEnc(e.target.checked); if (!e.target.checked) setPw(''); }} /> Cifrar con contraseña</label>
        <label>Contraseña (mínimo 8 caracteres)
          <input type="password" autocomplete="off" disabled=${!enc} value=${pw} onInput=${(e) => setPw(e.target.value)} />
        </label>
      </div>
      ${enc ? html`<p class="muted">Si pierdes la contraseña, la copia no se puede recuperar: no existe ningún mecanismo de recuperación.</p>` : null}
      <div class="actions">
        <button type="button" disabled=${busy} onClick=${run(async () => { const m = await make(); await finish(m, await saveBackup(db, m.blob, m.name)); })}>
          ${canPickFile() ? 'Guardar copia (elegir ubicación)' : 'Descargar copia'}
        </button>
      </div>
      <h3>Carpeta de copias recordada</h3>
      <p>Elige una carpeta (por ejemplo, un USB o una carpeta sincronizada) para guardar copias sin elegir la ubicación cada vez. El navegador puede volver a pedir permiso al reabrirlo.</p>
      <p class="muted">${dir ? `Carpeta recordada: «${dir.nombre}» · permiso de escritura: ${dir.permiso === 'granted' ? 'concedido' : dir.permiso === 'prompt' ? 'se volverá a pedir al guardar' : dir.permiso}.` : 'No hay carpeta recordada.'}</p>
      <div class="actions">
        <button type="button" class="secondary" disabled=${busy || !canPickDir()} onClick=${run(async () => { const n = await pickDirectory(db); setMsg({ level: 'ok', text: `carpeta «${n}» recordada.` }); await refresh(); })}>Elegir carpeta</button>
        <button type="button" class="secondary" disabled=${busy || !dir} onClick=${run(async () => { const m = await make(); await finish(m, await saveToRememberedDir(db, m.blob, m.name)); })}>Guardar copia en la carpeta recordada</button>
      </div>
      <${Msg} msg=${msg} />
      ${last ? html`<p class="muted">Última copia: ${fmtDate(last.at)} · ${last.name}</p>` : null}
    <//>
  `;
}

function RestaurarCopia() {
  const { db, bump } = useApp();
  const fileRef = useRef(null);
  const [pw, setPw] = useState('');
  const [state, setState] = useState({ stage: 'idle' });
  const [ack, setAck] = useState(false);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const guard = (fn) => async () => {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
    } catch (e) {
      setMsg({ level: 'fail', text: e?.message || String(e) });
    } finally {
      setBusy(false);
    }
  };

  const read = async () => {
    setState({ stage: 'idle' });
    setAck(false);
    const f = fileRef.current?.files?.[0];
    if (!f) throw new Error('Elige primero un fichero de copia.');
    const dec = await decodeBackupObject(parseBackupText(await f.text()), pw);
    const v = await validateBackup(db, dec.inner);
    if (!v.ok) {
      setState({ stage: 'invalid', errors: v.errors });
      return;
    }
    const current = countTables(await readSnapshot(db));
    setState({ stage: 'ready', inner: dec.inner, v, fileName: f.name, encrypted: dec.encrypted, compression: dec.compression, current });
  };

  const restore = async () => {
    const t0 = performance.now();
    const r = await restoreBackup(db, state.inner);
    const ms = Math.round(performance.now() - t0);
    setState({ stage: 'done', r, ms, fileName: state.fileName });
    setAck(false);
    setMsg({ level: 'ok', text: `restauración completada en ${fmtNum(ms)} ms y verificada: los datos coinciden con la copia.` });
    bump();
  };

  const names = state.stage === 'ready' ? [...new Set([...Object.keys(state.v.summary.counts), ...Object.keys(state.current)])].sort() : [];
  return html`
    <${Card} titulo="Restaurar copia">
      <p>La restauración <strong>reemplaza todos los datos actuales</strong> por los de la copia. Antes se valida el fichero y se muestra un resumen; no se modifica nada hasta que confirmes. Se hace en una sola operación: si falla, los datos actuales se conservan.</p>
      <div class="fields">
        <label>Fichero de copia <input type="file" accept=".json,application/json" ref=${fileRef} onChange=${() => { setState({ stage: 'idle' }); setMsg(null); setAck(false); }} /></label>
        <label>Contraseña (si la copia está cifrada) <input type="password" autocomplete="off" value=${pw} onInput=${(e) => setPw(e.target.value)} /></label>
      </div>
      <div class="actions"><button type="button" class="secondary" disabled=${busy} onClick=${guard(read)}>Leer y validar</button></div>
      ${state.stage === 'invalid'
        ? html`<div class="status fail" role="alert"><p>La copia no es válida y no se puede restaurar:</p><ul>${state.errors.map((e) => html`<li>${e}</li>`)}</ul></div>`
        : null}
      ${state.stage === 'ready'
        ? html`
            <div class="status ok" role="status">
              <p>Copia válida: «${state.fileName}», creada el ${fmtDate(state.v.summary.createdAt)} con la versión ${state.v.summary.appVersion}, esquema ${state.v.summary.schemaVersion}${state.encrypted ? ', cifrada' : ''}${state.compression === 'gzip' ? ', comprimida' : ''}.</p>
              ${state.v.warnings.map((w) => html`<p class="warn-text">Aviso: ${w}</p>`)}
            </div>
            <div class="table-wrap">
              <table>
                <caption>Registros por tabla</caption>
                <thead><tr><th scope="col">Tabla</th><th scope="col" class="num">Datos actuales</th><th scope="col" class="num">En la copia</th></tr></thead>
                <tbody>${names.map((n) => html`<tr key=${n}><th scope="row">${n}</th><td class="num">${fmtNum(state.current[n] ?? 0)}</td><td class="num">${fmtNum(state.v.summary.counts[n] ?? 0)}</td></tr>`)}</tbody>
              </table>
            </div>
            <label class="check"><input type="checkbox" checked=${ack} onChange=${(e) => setAck(e.target.checked)} /> Entiendo que esto reemplaza los datos actuales. Si no tengo una copia reciente de ellos, los perderé.</label>
            <div class="actions"><button type="button" class="danger" disabled=${busy || !ack} onClick=${guard(restore)}>Restaurar</button></div>
          `
        : null}
      <${Msg} msg=${msg} />
    <//>
  `;
}

export function Copias() {
  return html`
    <h2 class="page-title">Copias de seguridad</h2>
    <${CrearCopia} />
    <${RestaurarCopia} />
    <${Card} titulo="Qué debes saber">
      <ul>
        <li>Los datos están <strong>solo en este navegador y este perfil de usuario</strong>. No se sincronizan: para usarlos en otro portátil hay que restaurar una copia allí.</li>
        <li>Si borras los datos del sitio en el navegador, usas otro perfil o pierdes el equipo antes de descargar una copia, los datos pueden perderse.</li>
        <li>Una copia completa no es lo mismo que una exportación parcial a CSV o Excel.</li>
        <li>Guarda copias en dos ubicaciones distintas (por ejemplo, un USB y una carpeta sincronizada). Si la copia contiene datos de jugadores y va a una carpeta en la nube, valora cifrarla.</li>
        <li>Restaurar una copia anterior recuperará cualquier dato que hubieras eliminado después de crearla.</li>
      </ul>
    <//>
  `;
}

// ---------- Configuración ----------

export function Configuracion() {
  const { db, version, bump } = useApp();
  const [days, setDays] = useState(null);
  const [input, setInput] = useState('');
  const [persist, setPersist] = useState(null);
  const [est, setEst] = useState(null);
  const [audits, setAudits] = useState([]);
  const [msg, setMsg] = useState(null);
  useEffect(() => {
    let alive = true;
    (async () => {
      const d = await getSetting(db, 'backupReminderDays');
      const p = await getLocal(db, 'persistence');
      const e = await storageEstimate();
      const a = await db.auditLog.orderBy('id').reverse().limit(20).toArray();
      if (alive) { setDays(d ?? null); setInput(d ? String(d) : ''); setPersist(p); setEst(e); setAudits(a); }
    })();
    return () => { alive = false; };
  }, [db, version]);

  const save = async () => {
    const n = Number(input);
    if (!Number.isInteger(n) || n < 1 || n > 365) { setMsg({ level: 'fail', text: 'Introduce un número entero de días entre 1 y 365.' }); return; }
    await setSetting(db, 'backupReminderDays', n);
    setMsg({ level: 'ok', text: `se avisará si la última copia tiene más de ${n} días.` });
    bump();
  };
  const remove = async () => {
    await clearSetting(db, 'backupReminderDays');
    setMsg({ level: 'ok', text: 'ajuste eliminado: no se avisará por antigüedad de la copia.' });
    bump();
  };
  const ask = async () => {
    setPersist(await requestPersistence(db));
    bump();
  };
  const diag = [
    `Aplicación: ${APP_VERSION} · esquema ${db.verno} · base «${DB_NAME}»`,
    `Origen: ${location.origin}`,
    `Navegador: ${navigator.userAgentData?.brands?.map((b) => `${b.brand} ${b.version}`).join(', ') ?? navigator.userAgent}`,
    `Persistencia: ${persist?.persistente ? 'sí' : 'no'}`,
    est ? `Espacio: ${fmtMB(est.usage)} de ${fmtMB(est.quota)}` : 'Espacio: no disponible',
  ].join('\n');

  return html`
    <h2 class="page-title">Configuración</h2>
    <${Card} titulo="Recordatorio de copia de seguridad">
      <p>Plazo máximo, en días, desde la última copia antes de mostrar un aviso. ${days ? `Ahora: ${days} días.` : 'Sin definir: solo se avisa si nunca has creado una copia.'}</p>
      <div class="fields"><label>Días <input type="number" min="1" max="365" value=${input} onInput=${(e) => setInput(e.target.value)} /></label></div>
      <div class="actions">
        <button type="button" onClick=${save}>Guardar</button>
        <button type="button" class="secondary" disabled=${!days} onClick=${remove}>Quitar plazo</button>
      </div>
      <${Msg} msg=${msg} />
    <//>
    <${Card} titulo="Almacenamiento y entorno">
      <pre class="diag">${diag}</pre>
      <div class="actions"><button type="button" class="secondary" onClick=${ask}>Volver a solicitar persistencia</button></div>
      <p class="muted">Chrome decide si concede la persistencia con sus propios criterios; que no la conceda no impide usar la aplicación, pero hace imprescindibles las copias.</p>
    <//>
    <${Card} titulo="Registro de acciones (últimas 20)">
      <p class="muted">Guarda la fecha, el tipo de acción y su alcance. Nunca guarda valores de datos eliminados.</p>
      <div class="table-wrap">
        <table>
          <thead><tr><th scope="col">Fecha</th><th scope="col">Acción</th><th scope="col">Alcance</th></tr></thead>
          <tbody>${audits.map((a) => html`<tr key=${a.id}><td>${fmtDate(a.timestamp)}</td><td>${a.action}</td><td><code>${JSON.stringify(a.scope)}</code></td></tr>`)}</tbody>
        </table>
      </div>
    <//>
  `;
}
