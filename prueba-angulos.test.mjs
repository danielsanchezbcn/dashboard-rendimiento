// «Medir ángulos»: destino de las medidas en el catálogo (Jurdan Test) y guardado en el jugador. Datos sintéticos.
import 'fake-indexeddb/auto';
import { webcrypto } from 'node:crypto';
import fs from 'node:fs';
if (!globalThis.crypto?.subtle) globalThis.crypto = webcrypto;
import * as D from './db.js';
import * as CI from './catalogo-inicial.js';
import { listCatalog } from './catalogo.js';
import { createPlayer } from './jugadores.js';
import { mapearAngulos, guardarAngulos, hayDestino, ANGULOS_DESTINOS } from './angulos-mapa.js';
let failed = 0; const check = (n, c, x = '') => { console.log(`${c ? 'OK  ' : 'FAIL'} ${n} ${x}`); if (!c) failed++; };
const db = D.createDb('angulos-1'); await D.initDb(db); await CI.seedInitialCatalog(db);
const catalog = await listCatalog(db);
const t = catalog.tests.find((x) => x.name === 'Jurdan Test');
const V = (n) => catalog.variables.find((v) => v.testId === t.id && v.name.startsWith(n));
const res = { 'shin-left': 47.04, 'shin-right': 57.8, 'thigh-left': -11, 'thigh-right': -14, 'rf-left': 68, 'rf-right': 65 };

check('Jurdan tiene destino; AKET y los pendientes no', hayDestino('jurdan') && !hayDestino('aket') && !hayDestino('nordic'));
check('todas las variables destino existen en el catálogo', Object.values(ANGULOS_DESTINOS.jurdan.salidas).every(([n]) => catalog.variables.some((v) => v.testId === t.id && v.name === n)) && ANGULOS_DESTINOS.jurdan.derivadas.every((d) => catalog.variables.some((v) => v.testId === t.id && v.name === d.variable)));
const m = mapearAngulos('jurdan', res, catalog);
check('valores a su variable y lado, a 1 decimal', m.values[V('JURDAN HAMS').id].L === 47 && m.values[V('JURDAN HAMS').id].R === 57.8 && m.values[V('JURDAN PSOAS').id].R === -14 && m.values[V('JURDAN RECTUS').id].L === 68 && m.faltan.length === 0, JSON.stringify(m.values));
// Excel del usuario: L = HAMS izq − PSOAS der ; R = HAMS der − PSOAS izq  (47 − (−14) = 61 ; 57,8 − (−11) = 68,8)
check('JURDAN RESULTS como en el Excel: 61 y 68,8', m.values[V('JURDAN RESULTS').id].L === 61 && m.values[V('JURDAN RESULTS').id].R === 68.8);
check('sin las dos fotos: faltan medidas', mapearAngulos('jurdan', { ...res, 'thigh-left': null }, catalog).faltan.length >= 2);
check('test sin destino devuelve error', !!mapearAngulos('aket', res, catalog).error);

const id = await createPlayer(db, { jerseyName: 'Jug Ang', fullName: '', synthetic: true });
let e1 = ''; try { await guardarAngulos(db, { playerId: id, testKey: 'jurdan', results: { ...res, 'rf-left': null }, date: '2026-11-10', catalog }); } catch (e) { e1 = e.message; }
check('no guarda si faltan medidas', /Faltan medidas/.test(e1) && (await db.sessions.count()) === 0);
const r = await guardarAngulos(db, { playerId: id, testKey: 'jurdan', results: res, date: '2026-11-10', catalog });
const s = await db.sessions.get(r.id);
check('guarda una sesión con origen «angulos» y 1 repetición', s.source === 'angulos' && s.reps.total === 1 && s.testId === t.id && Object.keys(s.values).length === 4, JSON.stringify(s));
let e2 = ''; try { await guardarAngulos(db, { playerId: id, testKey: 'jurdan', results: res, date: '2026-11-10', catalog }); } catch (e) { e2 = e.message; }
check('no sobrescribe: avisa de la sesión repetida', /Ya hay una sesión/.test(e2) && (await db.sessions.count()) === 1);
await guardarAngulos(db, { playerId: id, testKey: 'jurdan', results: res, date: '2026-11-10', time: '10:30', catalog });
check('con otra hora sí se guarda', (await db.sessions.count()) === 2);
let e3 = ''; try { await guardarAngulos(db, { playerId: id, testKey: 'jurdan', results: res, date: '10/11/2026', catalog }); } catch (e) { e3 = e.message; }
check('fecha inválida rechazada', /fecha no es válida/.test(e3));
check('la auditoría no guarda valores', (await db.auditLog.toArray()).filter((x) => x.action === 'sesion-angulos').every((x) => !/values|shin|thigh|57\.8/.test(JSON.stringify(x).replace(/\d{4}-\d\d-\d\dT[\d:.]+Z/g, ''))))  // se quita la marca de tiempo: sus milisegundos podían coincidir con «57.8» (falso positivo intermitente);
// la herramienta: sin red y sin almacenamiento
const html = fs.readFileSync('angulos.html', 'utf8'); const js = ['angulos-app.js', 'angulos-engine.js', 'angulos-detector.js', 'angulos-exportar.js', 'angulos-utils.js', 'angulos-registry.js'].map((f) => fs.readFileSync(f, 'utf8')).join('\n');
check('angulos.html: política sin red (solo mismo origen)', /default-src 'none'/.test(html) && !/https?:\/\//.test(html.replace(/<!--[\s\S]*?-->/g, '').replace(/xmlns[^"]*"[^"]*"/g, '')));
check('el código de la herramienta no hace peticiones externas ni usa almacenamiento', !/fetch\(|XMLHttpRequest|WebSocket|sendBeacon|localStorage|sessionStorage|indexedDB/.test(js.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')) && !/https:\/\/(cdn|storage)/.test(js.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')));
console.log(failed ? `${failed} FALLOS` : 'TODO OK');
process.exit(failed ? 1 : 0);
