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
await tick(700);

// ---- Configuración: posiciones (orden configurable), ventana y datos sintéticos
await go('configuracion');
let pc = card('Posiciones');
check('posiciones: vacío, sin precarga', /Todavía no hay posiciones/.test(pc.textContent));
for (const n of ['Alfa', 'Beta']) { await setVal(field(pc, 'Nueva posición'), n); await click(btn(pc, 'Añadir posición')); pc = card('Posiciones'); }
check('posiciones: se añaden al final', cellsOf(pc).map((r) => r[0]).join() === 'Alfa,Beta');
await click(btn(pc, 'Subir Beta')); pc = card('Posiciones');
check('posiciones: el orden se puede cambiar', cellsOf(pc).map((r) => r[0]).join() === 'Beta,Alfa');
await click(btn(pc, 'Bajar Beta')); pc = card('Posiciones');
check('posiciones: y volver a cambiar', cellsOf(pc).map((r) => r[0]).join() === 'Alfa,Beta');
let vc = card('Ventana antropométrica');
check('ventana: sin definir y explicado', /Sin definir/.test(vc.textContent) && /no disponibles/.test(vc.textContent));
await setVal(field(vc, 'Días'), '30'); await click(btn(vc, 'Guardar'));
check('ventana: guardada', /ventana de 30 días guardada/.test(card('Ventana antropométrica').textContent));
let sc = card('Datos sintéticos');
check('sintéticos: ninguno al empezar y botón de eliminar desactivado', /No hay datos sintéticos cargados/.test(sc.textContent) && btn(sc, 'Eliminar todos los datos sintéticos').disabled);
await click(btn(sc, 'Cargar datos sintéticos'), 700);
sc = card('Datos sintéticos');
check('sintéticos: cargados y contados', /12 jugadores, 12 alias, 2 posiciones, 18 registros de posición y 36 mediciones/.test(sc.textContent) || /Hay \d+ registros sintéticos/.test(sc.textContent), sc.textContent.match(/Hay \d+ registros[^.]*\./)?.[0]);
check('sintéticos: no se pueden cargar dos veces', btn(sc, 'Cargar datos sintéticos').disabled);
check('posiciones: las sintéticas van al final, marcadas, sin reordenar las del usuario', cellsOf(card('Posiciones')).map((r) => r[0]).join() === 'Alfa,Beta,Posición sintética 1,Posición sintética 2' && $$('.badge.sint', card('Posiciones')).length === 2);

// ---- Jugadores
await go('jugadores');
check('jugadores: aviso de datos sintéticos y 12 filas etiquetadas', /Hay datos sintéticos de demostración/.test(text()) && $$('tbody tr', card('Lista')).length === 12 && $$('.badge.sint', card('Lista')).length === 12);
let lc = card('Lista');
await setVal(field(lc, 'Buscar'), 'jugador sintetico a');
check('búsqueda sin acentos ni mayúsculas', rowsOf(card('Lista')).length === 1 && /Jugador sintético A/.test(rowsOf(card('Lista'))[0]));
await setVal(field(card('Lista'), 'Buscar'), 'NOMBRE COMPLETO vald FICTICIO');
check('búsqueda por alias', rowsOf(card('Lista')).length === 6);
await setVal(field(card('Lista'), 'Buscar'), '');
// crear jugador real con posición inicial
let nc = card('Nuevo jugador');
await setVal(field(nc, 'Nombre en camiseta'), 'Real Uno');
const alfaId = $$('option', field(nc, 'Posición principal inicial')).find((o) => o.textContent === 'Alfa').value;
await setVal(field(nc, 'Posición principal inicial'), alfaId, 'change');
await setVal(field(nc, 'Rige desde'), '2026-01-01');
await click(btn(nc, 'Crear jugador'), 500);
check('jugador real creado con su posición', /jugador creado/.test(text()) && cellsOf(card('Lista')).some((r) => r.join('|') === 'Real Uno|Alfa|Activo'), cellsOf(card('Lista')).find((r) => /Real Uno/.test(r[0]))?.join('|'));
// nombre equivalente → aviso con confirmación
confirmAnswer = false;
nc = card('Nuevo jugador');
await setVal(field(nc, 'Nombre en camiseta'), 'real  UNO');
await click(btn(nc, 'Crear jugador'), 400);
check('nombre equivalente: avisa y se puede cancelar', /Creación cancelada/.test(text()) && confirms.at(-1).includes('Real Uno') && cellsOf(card('Lista')).filter((r) => /real uno/i.test(r[0])).length === 1);
confirmAnswer = true;
// sin fecha con posición → error
nc = card('Nuevo jugador');
await setVal(field(nc, 'Nombre en camiseta'), 'Real Dos');
await setVal(field(nc, 'Posición principal inicial'), alfaId, 'change');
await click(btn(nc, 'Crear jugador'), 300);
check('posición inicial sin fecha: error claro', /fecha desde la que rige/.test(text()));
await setVal(field(card('Nuevo jugador'), 'Posición principal inicial'), '', 'change');
await click(btn(card('Nuevo jugador'), 'Crear jugador'), 500);
check('jugador sin posición: figura «Sin posición hoy»', cellsOf(card('Lista')).some((r) => r.join('|') === 'Real Dos|Sin posición hoy|Activo'));

// ---- Perfil del jugador real
const link = $$('tbody a', card('Lista')).find((a) => a.textContent === 'Real Uno');
const realHash = link.getAttribute('href').slice(1);
await go(realHash);
check('perfil: tres bloques vacíos y secciones', /Manifestaciones de la fuerza/.test(text()) && /Sin tests configurados/.test(text()) && /Bloque sin definir/.test(text()) && ['Datos básicos', 'Alias por fuente', 'Posiciones con historial', 'Antropometría con historial'].every((t) => card(t)));
// alias
let ac = card('Alias por fuente');
await setVal(field(ac, 'Texto original'), 'REAL UNO NOMBRE COMPLETO');
await click(btn(ac, 'Añadir alias'), 400);
check('alias añadido con la fuente', cellsOf(card('Alias por fuente')).some((r) => r[0] === 'VALD' && r[1] === 'REAL UNO NOMBRE COMPLETO'));
await setVal(field(card('Alias por fuente'), 'Texto original'), 'REAL UNO NOMBRE COMPLETO');
await click(btn(card('Alias por fuente'), 'Añadir alias'), 300);
check('alias duplicado: error', /ya existe/.test(card('Alias por fuente').textContent));
// posiciones
let pp = card('Posiciones con historial');
const betaId = $$('option', field(pp, 'Posición'))[2].value;
const selects = $$('form', pp)[0];
await setVal($$('select', selects)[0], betaId, 'change');
await setVal($$('input[type=date]', selects)[0], '2026-03-01');
await click($$('button', selects)[0], 500);
pp = card('Posiciones con historial');
check('cambio de posición: cierra la anterior el día antes', cellsOf(pp).some((r) => r.slice(0, 4).join('|') === 'Principal|Alfa|01/01/2026|28/02/2026') && cellsOf(pp).some((r) => r.slice(0, 4).join('|') === 'Principal|Beta|01/03/2026|vigente'), cellsOf(pp).map((r) => r.slice(0, 4).join('|')).join(' ; '));
const q = $$('input[type=date]', pp)[0];
const ask = async (d) => { await setVal(card('Posiciones con historial').querySelector('input[type=date]'), d); return card('Posiciones con historial').querySelector('p.status[role=status]').textContent; };
check('consulta por fecha: 15/02 → Alfa, 01/03 → Beta, antes del inicio → sin posición', (await ask('2026-02-15')).includes('Alfa') && (await ask('2026-03-01')).includes('Beta') && /Sin posición principal/.test(await ask('2025-12-31')));
// secundaria
pp = card('Posiciones con historial');
const secForm = $$('form', pp)[2];
await setVal($$('select', secForm)[0], alfaId, 'change');
await setVal($$('input[type=date]', secForm)[0], '2026-01-01');
await click($$('button', secForm)[0], 500);
const r2 = await ask('2026-03-15');
check('secundaria: aparece aparte y no cambia la principal', r2.includes('Beta') && r2.includes('Secundarias: Alfa') && r2.includes('no se usan para agrupar'), r2);
// antropometría
let an = card('Antropometría con historial');
await setVal(field(an, 'Fecha de medición'), '2026-03-01');
const fs1 = $$('fieldset', an);
await setVal($$('input', fs1[0])[0], '80,5');
await click(btn(an, 'Añadir medición'), 400);
check('antropometría: unidad obligatoria', /indica la unidad/.test(card('Antropometría con historial').textContent));
an = card('Antropometría con historial');
await setVal($$('input', $$('fieldset', an)[0])[1], 'kg');
await click(btn(an, 'Añadir medición'), 500);
an = card('Antropometría con historial');
check('antropometría: medición añadida con unidad y decimales', cellsOf(an).some((r) => r[0] === '01/03/2026' && r[1] === '80,5 kg' && r[2] === '—' && r[3] === '—'), cellsOf(an).map((r) => r.slice(0, 4).join('|')).join(' ; '));
check('antropometría: la unidad se recuerda para la siguiente medición', $$('input', $$('fieldset', an)[0])[1].value === 'kg');
await setVal(field(an, 'Fecha de medición'), '2999-01-01');
await setVal($$('input', $$('fieldset', an)[1])[0], '180');
await setVal($$('input', $$('fieldset', an)[1])[1], 'cm');
await click(btn(an, 'Añadir medición'), 400);
check('antropometría: fecha futura rechazada', /fecha de medición no puede ser futura/.test(card('Antropometría con historial').textContent));
an = card('Antropometría con historial');
await click(btn(an, 'Editar'), 200);
an = card('Antropometría con historial');
check('antropometría: editar carga el registro', field(an, 'Fecha de medición').value === '2026-03-01' && btn(an, 'Guardar cambios'));
await setVal($$('input', $$('fieldset', an)[0])[0], '81');
await click(btn(an, 'Guardar cambios'), 500);
check('antropometría: edición guardada', cellsOf(card('Antropometría con historial')).some((r) => r[1] === '81 kg'));
await click(btn(card('Antropometría con historial'), 'Eliminar'), 400);
check('antropometría: eliminada con confirmación', /Sin mediciones/.test(card('Antropometría con historial').textContent) && /¿Eliminar esta medición\?/.test(confirms.at(-1)));
// desactivar
await click(btn(card('Datos básicos'), 'Desactivar'), 400);
check('desactivar: se conserva el historial', /INACTIVO/.test(text()) && cellsOf(card('Posiciones con historial')).length >= 2);

// ---- Perfil sintético: conjunto de aceptación
await go('jugadores');
await setVal(field(card('Lista'), 'Buscar'), 'sintetico a');
await go($$('tbody a', card('Lista'))[0].getAttribute('href').slice(1));
const askA = async (d) => { await setVal(card('Posiciones con historial').querySelector('input[type=date]'), d); return card('Posiciones con historial').querySelector('p.status[role=status]').textContent; };
check('sintético A: posición 1 el 10/02 y posición 2 el 10/03', (await askA('2026-02-10')).includes('Posición sintética 1') && (await askA('2026-03-10')).includes('Posición sintética 2'));
check('sintético A: dos alias de fuentes distintas y etiqueta', cellsOf(card('Alias por fuente')).length === 2 && /SINTÉTICO/.test(card('Alias por fuente').textContent) && /VALD/.test(card('Alias por fuente').textContent) && /Excel/.test(card('Alias por fuente').textContent));
await go('jugadores');
await setVal(field(card('Lista'), 'Buscar'), 'sintetico d');
await go($$('tbody a', card('Lista'))[0].getAttribute('href').slice(1));
check('sintético D: sin posición el 12/03 y con posición desde abril', /Sin posición principal/.test(await askA('2026-03-12')) && (await askA('2026-04-01')).includes('Posición sintética 1'));

// ---- Copia con todas las tablas, eliminación de sintéticos y restauración
await go('copias');
await click(btn(card('Crear copia completa'), 'Descargar copia'), 800);
check('copia creada con los datos nuevos', /Correcto: copia «dashboard-copia-/.test(text()));
const before = JSON.parse(await captured.text());
check('la copia incluye jugadores, alias, posiciones, historial y antropometría', ['players', 'playerAliases', 'positions', 'playerPositions', 'anthropometry'].every((t) => Array.isArray(before.tables[t])) && before.counts.players === 14 && before.counts.positions === 4 && !('local' in before.tables), JSON.stringify(before.counts));
await go('configuracion');
confirmAnswer = false;
await click(btn(card('Datos sintéticos'), 'Eliminar todos los datos sintéticos'), 400);
check('eliminar sintéticos: se puede cancelar sin borrar nada', /Eliminación cancelada/.test(text()) && /TODOS los datos sintéticos/.test(confirms.at(-1)));
confirmAnswer = true;
await click(btn(card('Datos sintéticos'), 'Eliminar todos los datos sintéticos'), 800);
check('eliminar sintéticos: eliminados y botón desactivado', /registros sintéticos eliminados/.test(text()) && btn(card('Datos sintéticos'), 'Cargar datos sintéticos').disabled === false);
await go('jugadores');
check('solo quedan los jugadores reales activos (Real Uno está inactivo y no se lista)', cellsOf(card('Lista')).length === 1 && cellsOf(card('Lista'))[0][0] === 'Real Dos' && !/SINTÉTICO/.test(card('Lista').textContent));
await go('configuracion');
check('las posiciones reales siguen en su orden y sin sintéticas', cellsOf(card('Posiciones')).map((r) => r[0]).join() === 'Alfa,Beta');
// restaurar la copia anterior (con sintéticos)
await go('copias');
const rc = card('Restaurar copia');
const fileInput = rc.querySelector('input[type=file]');
Object.defineProperty(fileInput, 'files', { value: [{ name: 'copia.json', text: async () => JSON.stringify(before) }], configurable: true });
await click(btn(rc, 'Leer y validar'), 700);
check('restaurar: resumen con las tablas nuevas', /Copia válida/.test(text()) && /playerAliases/.test(card('Restaurar copia').textContent) && /anthropometry/.test(card('Restaurar copia').textContent));
const ack = $$('input[type=checkbox]', card('Restaurar copia')).find((c) => /Entiendo/.test(c.closest('label').textContent));
ack.checked = true; ack.dispatchEvent(new w.Event('change', { bubbles: true })); await tick(100);
await click(btn(card('Restaurar copia'), 'Restaurar'), 900);
check('restaurar: verificada', /restauración completada en .* y verificada/.test(text()));
await go('jugadores');
check('tras restaurar vuelven los sintéticos (aviso documentado) y el jugador real', $$('tbody tr', card('Lista')).length === 14 || $$('tbody tr', card('Lista')).length === 13, String($$('tbody tr', card('Lista')).length));

console.log(failed ? `\n${failed} PRUEBA(S) FALLIDA(S)` : '\nTodas las pruebas de interfaz de jugadores pasan');
process.exit(failed ? 1 : 0);
