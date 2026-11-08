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

const csv = '﻿' + [
  'vald-id,given-name,middle-name,family-name,email,date-of-birth,weight,height,sport,position,sex,allow-photo-and-video-recording,external-id,Category 1,Group 1,Category 2,Group 2',
  'i1,Ana,,Sintética Uno,,2000-01-01,0,170,Unknown,,Male,TRUE,,Position,Central Midfielder,Season,Actual',
  'i2,Beto,,Sintético Dos,,2000-01-02,0,180,Unknown,,Male,TRUE,,Season,Previous,Position,Goalkeeper',
  'i3,Cris,,Sintética Tres,,2000-01-03,0,175,Unknown,,Male,TRUE,,Season,Actual,,'].join('\n');
const setFile = async (name, content) => {
  const input = $$('input[type=file]')[0];
  const f = new w.File([content], name, { type: 'text/csv' });
  if (!f.arrayBuffer) f.arrayBuffer = () => new Promise((res, rej) => { const r = new w.FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(r.error); r.readAsArrayBuffer(f); });
  Object.defineProperty(input, 'files', { value: [f], configurable: true });
  input.dispatchEvent(new w.Event('change', { bubbles: true }));
  await tick(500);
};
await go('importar');
await click($$('input[type=radio]').find((r) => /atletas/.test(r.parentElement.textContent)));
await setFile('athletes.csv', csv);
await click(btn(document, 'Continuar: revisar atletas'));
check('revisión: 3 atletas y 2 posiciones de VALD', /3 atletas leídos/.test(text()) && /Central Midfielder/.test(text()) && /Goalkeeper/.test(text()));
check('todos propuestos como jugador nuevo y sin acciones pendientes', !/Faltan \d+ atleta/.test(text()) && !!btn(document, 'Guardar atletas') && !btn(document, 'Guardar atletas').disabled);
const sel = $$('select').find((s) => s.getAttribute('aria-label') === 'Posición para Goalkeeper');
await setVal(sel, 'create', 'change');
check('al asignar posición NO se pide fecha (la posición no lleva fechas)', !btn(document, 'Guardar atletas').disabled && !/Vigente desde/.test(text()) && /no lleva fecha/.test(text()));
await click(btn(document, 'Guardar atletas'), 700);
check('resultado: 3 nuevos, 3 alias, 1 posición creada y asignada', /3 jugador\(es\) nuevo\(s\)/.test(text()) && /3 alias de VALD/.test(text()) && /1 asignada/.test(text()) && /1 creada/.test(text()), text().slice(0, 400));
await click(btn(document, 'Terminar'), 400);
await go('jugadores');
check('los jugadores aparecen en la lista', /Beto Sintético Dos/.test(text()));
process.exit(failed ? 1 : 0);
