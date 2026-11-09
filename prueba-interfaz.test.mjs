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

let failed = 0;
const check = (name, cond, extra = '') => { console.log(`${cond ? 'OK  ' : 'FAIL'} ${name} ${extra}`); if (!cond) failed++; };
const tick = (ms = 150) => new Promise((r) => setTimeout(r, ms));
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];
const text = () => document.getElementById('app').textContent;
const go = async (id) => { w.location.hash = '#' + id; w.dispatchEvent(new w.HashChangeEvent('hashchange')); await tick(250); };
const btn = (label) => $$('button, a.btn').find((b) => b.textContent.trim().startsWith(label));

await import('./main.js');
await tick(600);

// Navegación
const links = $$('nav a').map((a) => a.textContent.trim());
check('menú con 10 entradas (incluye Relaciones entre variables) y los 3 bloques', links.length === 10 && links.includes('Relaciones entre variables') && ['Manifestaciones de la fuerza', 'Perímetros', 'NME'].every((l) => links.includes(l)), links.join(' | '));
check('versión visible 4-0.1.0', document.querySelector('.ver')?.textContent === 'v7y-0.1.0', document.querySelector('.ver')?.textContent);
check('inicio por defecto con aria-current', $('nav a[aria-current="page"]')?.textContent === 'Inicio');
check('aviso de que no hay copia (sin plazo definido)', /Todavía no has creado ninguna copia/.test(text()));
check('almacenamiento no persistente explicado', /no garantiza conservar los datos/.test(text()));

// Bloques sin contenido inventado
await go('fuerza');
check('Fuerza: muestra el catálogo inicial aportado (fase 2), sin inventar variables', /Max Isometric Strength/.test(text()) && /Run-Specific Hip Iso-Push/.test(text()) && /Sin sesiones|Aún no hay sesiones/.test(text()));
await go('perimetros');
check('Perímetros: un test con las 5 medidas que indicó el usuario (9/11), sin inventar otras', /Perímetros/.test(text()) && /5 variable/.test(text()) && !/No hay medidas de perímetro/.test(text()));
await go('nme');
check('NME: etiqueta literal, sin expandir ni contenido', $('h2.page-title').textContent === 'NME' && /Bloque sin definir/.test(text()) && !/neuromuscular|NME \(/i.test(text()));
await go('jugadores');
check('Jugadores: lista vacía y formulario, sin jugadores inventados', /Todavía no hay jugadores/.test(text()) && /Nuevo jugador/.test(text()));
await go('importar');
check('Importar: asistente en el paso 1', /1\. Elige el fichero/.test(text()) && /Importaciones anteriores/.test(text()));

// Crear copia
await go('copias');
check('Copias: secciones crear y restaurar', /Crear copia completa/.test(text()) && /Restaurar copia/.test(text()));
await btn('Descargar copia').click();
await tick(600);
check('copia creada (descarga) y mensaje correcto', /Correcto: copia «dashboard-copia-/.test(text()) && captured instanceof Blob, text().match(/Correcto: [^.]*\./)?.[0]?.slice(0, 80));
const plain = captured;

// Cambiar un ajuste, luego restaurar
await go('configuracion');
const reminderCard = $$('section.card').find((c) => c.querySelector('h2')?.textContent === 'Recordatorio de copia de seguridad');
const days = reminderCard.querySelector('input[type="number"]');
days.value = '14'; days.dispatchEvent(new w.Event('input', { bubbles: true }));
await tick(100);
[...reminderCard.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Guardar').click();
await tick(400);
check('ajuste guardado', /se avisará si la última copia tiene más de 14 días/.test(text()));
const audits1 = $$('tbody tr').length;

await go('copias');
const fileInput = $('input[type="file"]');
const pick = (blob, name) => Object.defineProperty(fileInput, 'files', { value: [{ name, text: () => blob.text() }], configurable: true });
pick(plain, 'copia.json');
await btn('Leer y validar').click();
await tick(500);
check('copia válida con resumen y tabla comparativa', /Copia válida/.test(text()) && /Registros por tabla/.test(text()) && $$('tbody tr').length >= 3);
const restoreBtn = btn('Restaurar');
check('Restaurar deshabilitado hasta confirmar', restoreBtn.disabled === true);
const ack = $$('input[type="checkbox"]').find((c) => /Entiendo/.test(c.closest('label')?.textContent ?? ''));
ack.checked = true; ack.dispatchEvent(new w.Event('change', { bubbles: true }));
await tick(150);
check('Restaurar habilitado tras confirmar', btn('Restaurar').disabled === false);
await btn('Restaurar').click();
await tick(800);
check('restauración verificada', /restauración completada en .* y verificada/.test(text()), text().match(/restauración completada[^.]*\./)?.[0]);
await go('configuracion');
check('el ajuste posterior a la copia se ha revertido (sin plazo definido)', /Sin definir/.test(text()));
// El registro vuelve al estado de la copia (sin lo posterior) y añade la restauración.
check('auditoría: figura la restauración y no las acciones posteriores a la copia', /copia-restaurada/.test(text()) && !/ajuste-modificado/.test(text()) && /base-creada/.test(text()));

// Copia inválida
await go('copias');
const fi2 = $('input[type="file"]');
const bad = new Blob([JSON.stringify({ formatId: 'otra-cosa' })]);
Object.defineProperty(fi2, 'files', { value: [{ name: 'mala.json', text: () => bad.text() }], configurable: true });
await btn('Leer y validar').click();
await tick(400);
check('copia inválida: errores visibles y sin botón de restaurar activo', /no es válida y no se puede restaurar/.test(text()) && !btn('Restaurar'));
// Copia cifrada
{
  const mod = await import('./backup.js');
  const dbm = (await import('./db.js'));
  const d = dbm.createDb(); await d.open();
  const inner = await mod.buildBackup(d, dbm.APP_VERSION);
  const { blob } = await mod.encodeBackup(inner, { gzip: true, password: 'clave-segura-1' });
  const fi3 = $('input[type="file"]');
  Object.defineProperty(fi3, 'files', { value: [{ name: 'cifrada.json', text: () => blob.text() }], configurable: true });
  await btn('Leer y validar').click();
  await tick(400);
  check('copia cifrada sin contraseña: mensaje claro', /cifrado: escribe la contraseña/.test(text()));
  const pw = $$('input[type="password"]').at(-1);
  pw.value = 'clave-segura-1'; pw.dispatchEvent(new w.Event('input', { bubbles: true }));
  await tick(100);
  await btn('Leer y validar').click();
  await tick(1200);
  check('copia cifrada con contraseña: válida', /Copia válida/.test(text()) && /cifrada, comprimida/.test(text()));
}

console.log(failed ? `\n${failed} PRUEBA(S) FALLIDA(S)` : '\nTodas las pruebas de interfaz pasan');
process.exit(failed ? 1 : 0);
