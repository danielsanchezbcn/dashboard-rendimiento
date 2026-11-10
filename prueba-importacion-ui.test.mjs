import 'fake-indexeddb/auto';
import { JSDOM } from 'jsdom';
import { webcrypto } from 'node:crypto';
import fs from 'node:fs';

const html = fs.readFileSync(new URL('./index.html', import.meta.url), 'utf8').replace(/<script[^>]*><\/script>/, '');
const dom = new JSDOM(html, { url: 'https://ejemplo.test/dashboard/', pretendToBeVisual: true });
const w = dom.window;
globalThis.window = w; globalThis.document = w.document; globalThis.location = w.location; globalThis.history = w.history;
Object.defineProperty(globalThis, 'navigator', { value: { platform: 'test', userAgent: 'smoke', storage: { persist: async () => false, persisted: async () => false, estimate: async () => ({ usage: 1048576, quota: 1073741824 }) } }, configurable: true });
Object.defineProperty(w, 'indexedDB', { value: globalThis.indexedDB, configurable: true });
w.scrollTo = () => {};
if (!globalThis.crypto?.subtle) globalThis.crypto = webcrypto;
let captured = null;
globalThis.URL.createObjectURL = (b) => { captured = b; return 'blob:x'; };
globalThis.URL.revokeObjectURL = () => {};
w.HTMLAnchorElement.prototype.click = function () {};
let confirmAnswer = true;
const confirms = [];
globalThis.confirm = (m) => { confirms.push(m); return confirmAnswer; };

let failed = 0;
const check = (name, cond, extra = '') => { console.log(`${cond ? 'OK  ' : 'FAIL'} ${name} ${extra}`); if (!cond) failed++; };
const tick = (ms = 200) => new Promise((r) => setTimeout(r, ms));
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const text = () => document.getElementById('app').textContent;
const go = async (hash) => { w.location.hash = '#' + hash; w.dispatchEvent(new w.HashChangeEvent('hashchange')); await tick(350); };
const card = (title) => $$('section.card').find((c) => c.querySelector('h2')?.textContent.trim().startsWith(title));
const btn = (root, label) => $$('button, a.btn', root).find((b) => b.textContent.trim() === label || b.getAttribute('aria-label') === label);
const click = async (el, ms = 300) => { el.click(); await tick(ms); };
const setVal = async (el, v, evt = 'input') => { el.value = v; el.dispatchEvent(new w.Event(evt, { bubbles: true })); await tick(40); };
const field = (root, labelStart) => { const l = $$('label', root).find((x) => x.textContent.trim().startsWith(labelStart)); return l.querySelector('input, select'); };
const rowsOf = (root) => $$('tbody tr', root).map((r) => r.textContent.replace(/\s+/g, ' ').trim());
const cellsOf = (root) => $$('tbody tr', root).map((r) => $$('th, td', r).map((c) => c.textContent.replace(/\s+/g, ' ').trim().replace(/ ?SINTÉTICO| ?INACTIVO| ?ARCHIVADA/g, '')));

await import('./main.js');
await tick(900);

const selectByAria = (label) => $$('select').find((s) => s.getAttribute('aria-label') === label);
const setFile = async (name, content) => {
  const input = $$('input[type=file]')[0];
  const f = new w.File([content], name, { type: 'text/csv' });
  if (!f.arrayBuffer) f.arrayBuffer = () => new Promise((res, rej) => { const r = new w.FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(r.error); r.readAsArrayBuffer(f); });
  Object.defineProperty(input, 'files', { value: [f], configurable: true });
  input.dispatchEvent(new w.Event('change', { bubbles: true }));
  await tick(500);
};
const csv = [
  'Jugador;Fecha;Reps;Peak Force Izq;Peak Force Der;RFD at 100 ms Izq;RFD at 100 ms Der',
  'jug. sintetico A;10/03/2026;3;410;398,5;5000;5200',
  'Jugador sintético Muñoz;10/03/2026;4;380,5;390;;',
  'Jugador desconocido;10/03/2026;2;300;310;;',
  'jug. sintetico B;;2;100;100;;',
  'jug. sintetico C;10/03/2026;2;abc;400;;',
  'jug. sintetico D;12/03/2026;3;200;210;;',
  'jug. sintetico D;12/03/2026;3;201;210;;',
].join('\n');

await go('configuracion');
await click(btn(card('Datos sintéticos'), 'Cargar datos sintéticos'), 700);
await go('importar');
check('paso 1: sin importaciones previas', /Todavía no se ha importado ningún fichero/.test(text()));
await setFile('demo.csv', csv);
check('paso 1: fichero leído con su tabla de filas', /Leído: demo\.csv/.test(text()) && $$('tr.hdr').length === 1);
await click(btn(document, 'Continuar: asignar columnas'));
check('paso 2 visible', /2\. Asigna las columnas/.test(text()));
check('paso 2: «Continuar» desactivado sin test', btn(document, 'Continuar: vista previa').disabled);
const sel = $$('select').find((s) => [...s.options].some((o) => o.textContent.toLowerCase() === 'run-specific hip iso-push'));
await setVal(sel, [...sel.options].find((o) => o.textContent.toLowerCase() === 'run-specific hip iso-push').value, 'change');
check('propuesta inicial: columna 1 jugador, 2 fecha, 3 repeticiones', selectByAria('Qué es la columna 1').value === 'jugador' && selectByAria('Qué es la columna 2').value === 'fecha' && selectByAria('Qué es la columna 3').value === 'reps');
check('propuesta inicial: Peak Force izquierdo y derecho', selectByAria('Qué es la columna 4').value === 'valor' && selectByAria('Lado de la columna 4').value === 'L' && selectByAria('Lado de la columna 5').value === 'R');
check('propuesta inicial: RFD at 100 ms izquierdo y derecho', selectByAria('Lado de la columna 6').value === 'L' && selectByAria('Lado de la columna 7').value === 'R');
// provocar un error: quitar la variable de la columna 7
const s7 = selectByAria('Variable de la columna 7');
const rfdId = s7.value;
await setVal(s7, '', 'change');
await click(btn(document, 'Continuar: vista previa'));
check('mapeo incompleto: error visible y no avanza', /elige la variable/.test(text()) && /2\. Asigna/.test(text()));
await setVal(selectByAria('Variable de la columna 7'), rfdId, 'change');
await click(btn(document, 'Continuar: vista previa'));
check('paso 3: 7 filas con datos, 5 válidas, 2 con errores', /7 filas con datos · 5 válidas · 2 con errores/.test(text().replace(/\s+/g, ' ')), text().match(/\d+ filas con datos[^.]*/)?.[0]);
check('paso 3: errores explican la causa', /Falta la fecha/.test(text()) && /abc/.test(text()));
await click(btn(document, 'Continuar: confirmar jugadores'));
check('paso 4: un grupo por nombre distinto de filas válidas (A, Muñoz, desconocido, D)', $$('fieldset.player-choice').length === 4);
check('paso 4: «Continuar» desactivado hasta decidir', btn(document, 'Continuar: resumen').disabled === ($$('select').filter((s) => /Qué hacer/.test(s.getAttribute('aria-label') ?? '')).some((s) => !s.value)));
const q = (t) => selectByAria('Qué hacer con ' + t);
check('paso 4: A viene como PROPUESTA preseleccionada, el desconocido no', q('jug. sintetico A').value.startsWith('link:') && q('Jugador desconocido').value === '');
const muñoz = q('Jugador sintético Muñoz');
check('paso 4: Muñoz exige elegir (hay coincidencia con ñ/n)', /ñ|exacta|Más de un/.test(text()) || muñoz.value.startsWith('link:'));
await setVal(q('Jugador desconocido'), 'new', 'change');
if (!muñoz.value) await setVal(muñoz, [...muñoz.options].find((o) => /Vincular a Jugador sintético Muñoz/.test(o.textContent)).value, 'change');
const dsel = q('jug. sintetico D');
if (!dsel.value) await setVal(dsel, [...dsel.options].find((o) => /Vincular a Jugador sintético D/.test(o.textContent)).value, 'change');
await click(btn(document, 'Continuar: resumen'));
check('paso 5: resumen con sesiones nuevas y grupo contradictorio', /3\s*sesiones nuevas/.test(text().replace(/\s+/g, ' ')) && /grupos de filas contradictorias/.test(text()), text().replace(/\s+/g, ' ').match(/\d+ sesiones nuevas/)?.[0]);
await click(btn(document, 'Guardar importación'), 600);
check('paso 6: importación guardada y botón de informe', /Importación guardada/.test(text()) && !!btn(document, 'Descargar informe (CSV)'));
captured = null;
await click(btn(document, 'Descargar informe (CSV)'));
check('informe descargado sin valores de datos', captured && (await captured.text()).includes('Resumen') && !/410|398,5/.test(await captured.text()));
check('historial muestra el lote', /demo\.csv/.test(card('Importaciones anteriores').textContent));
// mismo fichero otra vez → aviso y reconocimiento
await click(btn(document, 'Importar otro fichero'));
await setFile('demo.csv', csv);
check('mismo fichero: aviso de duplicado y «Continuar» bloqueado hasta confirmar', /ya se importó/.test(text()) && btn(document, 'Continuar: asignar columnas').disabled);
await click($$('input[type=checkbox]').find((c) => /Entendido/.test(c.parentElement.textContent)));
check('tras confirmar se puede continuar', !btn(document, 'Continuar: asignar columnas').disabled);
process.exit(failed ? 1 : 0);
