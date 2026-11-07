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

const rowTexts = (root) => $$('tbody tr', root).map((r) => r.textContent.replace(/\s+/g, ' ').trim());
const testRow = (name) => $$('#tests tbody tr').find((r) => r.querySelector('a')?.textContent.trim() === name);
const varRow = (name) => $$('section.card tbody tr').find((r) => r.querySelector('td')?.firstChild?.textContent?.trim() === name);

// ---- Navegación y bloques
check('navegación: aparece «Catálogo de tests»', $$('nav a').some((a) => a.textContent.trim() === 'Catálogo de tests'));
await go('fuerza');
check('Manifestaciones de la fuerza: grupos del catálogo inicial', ['Max Isometric Strength', 'Heavy Dynamic Strength', 'Fast Dynamic Strength', 'Reactive Strength', 'Explosive Strength'].filter((m) => card(m)).length === 4 && !card('Explosive Strength'));
check('fuerza: aparece Run-Specific Hip Iso-Push con su zona y 4 variables', /Run-Specific Hip Iso-Push\s*·\s*Hip\s*·\s*4 variables/.test(card('Max Isometric Strength').textContent.replace(/\s+/g, ' ')), card('Max Isometric Strength')?.textContent.slice(0, 160));
await go('perimetros');
check('Perímetros: sin nada precargado', /No hay medidas de perímetro definidas/.test(text()) && /No se precarga nada/.test(text()));
await go('nme');
check('NME: sin nada precargado y con la etiqueta tal cual', /Bloque sin definir/.test(text()) && document.querySelector('h2.page-title').textContent === 'NME');

// ---- Catálogo: listas
await go('catalogo');
check('título de la pestaña', document.title.startsWith('Catálogo de tests'));
let tc = card('Tests');
check('35 tests del catálogo inicial', rowTexts(tc).length === 35, String(rowTexts(tc).length));
await setVal(field(tc, 'Buscar'), 'iso-hold');
check('búsqueda por nombre', rowTexts(card('Tests')).length === 5, String(rowTexts(card('Tests')).length));
await setVal(field(card('Tests'), 'Buscar'), '');
check('manifestaciones: 5 y zonas: 4', rowTexts(card('Manifestaciones de la fuerza')).length === 5 && rowTexts(card('Zonas anatómicas')).length === 4);
check('el catálogo inicial no muestra tests de otros bloques', $$('#tests tbody tr').length === 35);

// ---- Alta de un test y duplicado
tc = card('Tests');
const nf = $$('form', tc).pop();
await setVal(field(nf, 'Nombre del test'), 'Test de prueba');
await setVal(field(nf, 'Manifestación'), $$('option', field(nf, 'Manifestación')).find((o) => o.textContent === 'Max Isometric Strength').value, 'change');
await click(btn(nf, 'Añadir test'));
check('test nuevo en la lista', !!testRow('Test de prueba') && rowTexts(card('Tests')).length === 36);
const nf2 = $$('form', card('Tests')).pop();
await setVal(field(nf2, 'Nombre del test'), 'test de prueba');
await setVal(field(nf2, 'Manifestación'), $$('option', field(nf2, 'Manifestación')).find((o) => o.textContent === 'Max Isometric Strength').value, 'change');
await click(btn(nf2, 'Añadir test'));
check('duplicado rechazado con mensaje', /Ya existe un test «Test de prueba»/.test(card('Tests').textContent));

// ---- Detalle: Run-Specific Hip Iso-Push
await go(testRow('Run-Specific Hip Iso-Push').querySelector('a').getAttribute('href').slice(1));
const hipId = Number(location.hash.match(/catalogo-test-(\d+)/)[1]);
check('detalle: ruta propia y título', hipId > 0 && document.querySelector('h2.page-title').textContent.trim() === 'Run-Specific Hip Iso-Push');
let vc = card('Variables');
const rows = rowTexts(vc);
check('detalle: 4 variables en el orden definido', rows.length === 4 && /^Peak ForceN/.test(rows[0]) && /^Peak Force relativo \(SW\)/.test(rows[1]) && /^Peak Force asimetría/.test(rows[2]) && /^RFD at 100 ms/.test(rows[3]), rows.map((r) => r.slice(0, 30)).join(' | '));
check('Peak Force: unidad N y manifestación Max Isometric Strength', /Peak Force\s*N\s*Valor izquierdo y derecho\s*No definido\s*Max Isometric Strength/.test(rows[0]));
check('RFD at 100 ms: unidad y fórmula «No definido» y manifestación Explosive Strength', /RFD at 100 ms\s*No definido[\s\S]*Explosive Strength/.test(rows[3]));
check('relativo Hip: SW con factor 0.29 y definición visible', /Relativo al System Weight \(SW\)[\s\S]*factor 0.29/.test(rows[1]) && /9,80665/.test(rows[1]));
check('asimetría: fórmula del usuario visible', /\(derecha − izquierda\) ÷ máx\(izquierda, derecha\) × 100/.test(rows[2]));
check('dirección «No definido» en todas (no se infiere)', rowTexts(vc).every((r) => /No definido/.test(r)));

// ---- Editar una variable: unidad de RFD (acción del usuario) y cambio de fórmula con motivo
let r3 = varRow('RFD at 100 ms');
await click(btn(r3, 'Editar'), 200);
let form = $$('section.card tbody tr form')[0];
await setVal(field(form, 'Unidad'), 'N/s');
await click(btn(form, 'Guardar variable'), 400);
check('unidad editada y guardada', /RFD at 100 ms\s*N\/s/.test(rowTexts(card('Variables'))[3]), rowTexts(card('Variables'))[3].slice(0, 40));
await click(btn(varRow('Peak Force relativo (SW)'), 'Editar'), 200);
form = $$('section.card tbody tr form')[0];
await setVal(field(form, 'Factor SW'), '0.3');
await click(btn(form, 'Guardar variable'), 400);
check('cambiar la fórmula sin motivo se rechaza', /hay que indicar el motivo/.test(card('Variables').textContent));
form = $$('section.card tbody tr form')[0];
await setVal(field(form, 'Motivo'), 'Comprobación de interfaz');
await click(btn(form, 'Guardar variable'), 400);
const rel = rowTexts(card('Variables'))[1];
check('con motivo: factor 0.3 y dos versiones conservadas', /factor 0.3\b/.test(rel) && /Versiones \(2\)/.test(rel) && /Comprobación de interfaz/.test(rel) && /factor 0.29/.test(rel), rel.slice(0, 220));

// ---- Añadir y eliminar una variable en CMJ; las 19 variables del usuario
await go('catalogo');
await go(testRow('CMJ').querySelector('a').getAttribute('href').slice(1));
check('CMJ: 19 variables sin unidad ni dirección definidas', rowTexts(card('Variables')).length === 19 && rowTexts(card('Variables')).every((r) => (r.match(/No definido/g) || []).length >= 3));
const addForm = $$('section.card > form.fields').pop();
await setVal(field(addForm, 'Nombre'), 'VARIABLE DE PRUEBA');
await click(btn(addForm, 'Añadir variable'), 400);
check('variable nueva añadida', rowTexts(card('Variables')).length === 20 && !!varRow('VARIABLE DE PRUEBA'));
await click(btn(varRow('VARIABLE DE PRUEBA'), 'Eliminar'), 400);
check('variable eliminada con confirmación', rowTexts(card('Variables')).length === 19 && /Eliminar la variable «VARIABLE DE PRUEBA»/.test(confirms.at(-1)));
await click(btn(varRow('RSI MOD'), 'Archivar'), 300);
check('archivar una variable no la borra', rowTexts(card('Variables')).length === 19 && /ARCHIVADO/.test(varRow('RSI MOD').textContent));

// ---- Archivar un test
await go('catalogo');
await go(testRow('Test de prueba').querySelector('a').getAttribute('href').slice(1));
await click(btn(card('Datos del test'), 'Archivar test'), 400);
check('test archivado: marcado y sin borrar', /ARCHIVADO/.test(document.querySelector('h2.page-title').textContent));
await go('catalogo');
check('archivado oculto por defecto y visible al pedirlo', !testRow('Test de prueba') && (await (async () => { const c = field(card('Tests'), 'Mostrar archivados'); c.checked = true; c.dispatchEvent(new w.Event('change', { bubbles: true })); await tick(80); return !!testRow('Test de prueba'); })()));

// ---- Test inexistente
await go('catalogo-test-99999');
check('test inexistente: mensaje claro y enlace de vuelta', /El test no existe/.test(text()) && /Volver al catálogo/.test(text()));

// ---- Los datos originales no se tocan: no hay sesiones ni tablas de datos
check('sin tablas de sesiones todavía', !(await (async () => { const { createDb } = await import('./db.js'); const d = createDb(); return d.tables.some((t) => t.name === 'sessions'); })()));

console.log(failed ? `\n${failed} prueba(s) fallan` : '\nTodas las pruebas de interfaz del catálogo pasan');
process.exit(failed ? 1 : 0);
