// Nombres de tests y variables escritos a mano en el código: TODOS tienen que existir en el catálogo.
// Un nombre mal escrito no da error, simplemente deja de encontrar el dato: el jugador ve «sin datos» donde sí los hay. Esta prueba lo caza.
// Se siembra el catálogo inicial y se comprueba, módulo a módulo, que cada nombre literal resuelve con la MISMA regla que usa ese módulo.
import 'fake-indexeddb/auto';
import { createDb, initDb } from './db.js';
import { seedInitialCatalog } from './catalogo-inicial.js';
import { listCatalog } from './catalogo.js';
import { locate } from './relaciones.js';
import { RADAR_PROFILES } from './radar.js';
import { NATERA } from './natera.js';
import { PREMIER_REFERENCES } from './premier.js';
import { ISO_PAIRS, RM12_TESTS, LOAD_VARIABLE_NAMES } from './isohold.js';
import { CUALIDADES, T as CT, V as CV, IMPULSOS_REL } from './composite.js';
import { mismoTest } from './nombres.js';
import { updateTest } from './catalogo.js';
import { findNatera } from './natera.js';
import { findPremier } from './premier.js';
import { profileForTest } from './radar.js';
import { pairNameOf } from './isohold.js';
import { DSI_TESTS, EUR_TESTS, ANKLE_TESTS, HIP_TESTS, DJ_TESTS } from './relaciones.js';
import { comprobarNombres, usosDeTest, renombradoSeguro } from './usos.js';

let fail = 0; const check = (n, ok, d = '') => { console.log((ok ? 'OK   ' : 'FAIL ') + n + (ok ? '' : ' ' + d)); if (!ok) fail = 1; };

const db = createDb('t-nombres-' + Math.random()); await initDb(db); await seedInitialCatalog(db);
const cat = await listCatalog(db);
const lc = (s) => String(s ?? '').trim().toLowerCase();
const test = (n) => cat.tests.find((t) => mismoTest(t.name, n) && !t.archived) ?? null;
const variable = (tn, vn) => { const t = test(tn); return t ? cat.variables.find((v) => v.testId === t.id && lc(v.name) === lc(vn) && !v.archived) ?? null : null; };
const faltan = (lista) => lista.filter(([tn, vn]) => (vn === null ? !test(tn) : !variable(tn, vn))).map(([tn, vn]) => (vn === null ? tn : `${tn} · ${vn}`));

// ---- 1. «Relaciones»: DSI, EUR, ORZ y la fuerza del Knee Iso-Push. Si uno de estos no resuelve, el ratio sale «sin datos» sin decir por qué.
const loc = locate(cat.tests, cat.variables);
const sinLoc = Object.entries(loc).filter(([, v]) => !v).map(([k]) => k);
check('relaciones.js: los 10 tests y variables de locate() existen', sinLoc.length === 0, sinLoc.join(', '));

// ---- 2. Radar: el test de cada perfil y la variable de cada eje.
const sinRadar = RADAR_PROFILES.flatMap((p) => [...(test(p.test) ? [] : [`perfil ${p.id}: test «${p.test}»`]), ...p.axes.filter((a) => !variable(p.test, a.variable)).map((a) => `perfil ${p.id}: ${a.variable}`)]);
check('radar.js: los tests y las variables de los perfiles existen', sinRadar.length === 0, sinRadar.join(' | '));

// ---- 3. Natera: los tres Run-Specific Iso-Push.
check('natera.js: los tests con referencia de Natera existen', faltan(NATERA.map((n) => [n.test, null])).length === 0, faltan(NATERA.map((n) => [n.test, null])).join(', '));

// ---- 4. Premier League: cada referencia apunta a un test y a una variable del catálogo.
const sinPremier = PREMIER_REFERENCES.flatMap((r) => r.tests.filter((tn) => test(tn) && !variable(tn, r.variable)).map((tn) => `${tn} · ${r.variable}`));
const testsPremierSinCatalogo = [...new Set(PREMIER_REFERENCES.flatMap((r) => r.tests).filter((tn) => !test(tn)))];
check('premier.js: en los tests que existen, la variable de la referencia también existe', sinPremier.length === 0, sinPremier.join(' | '));
check('premier.js: no hay referencias a tests que el catálogo no tiene', testsPremierSinCatalogo.length === 0, testsPremierSinCatalogo.join(', '));

// ---- 5. Iso-Hold: las dos mitades de cada pareja (el Iso-Hold y su Iso-Push), y los tests de 12RM.
const sinIso = [...Object.entries(ISO_PAIRS).flatMap(([hold, push]) => [...(test(hold) ? [] : [`iso-hold «${hold}»`]), ...(test(push) ? [] : [`iso-push «${push}»`])]), ...RM12_TESTS.filter((n) => !test(n)).map((n) => `12RM «${n}»`)];
check('isohold.js: las parejas iso-hold/iso-push y los 12RM existen', sinIso.length === 0, sinIso.join(', '));

// ---- 6. COMPOSITE PROFILE SCORE: el test y la variable de cada puntuación, cada interpretativa y cada regla.
const descs = [];
for (const c of CUALIDADES) {
  const mete = (d) => { if (d && !d.tipo) descs.push(d); (d?.interp ?? []).forEach(mete); };
  c.scores.forEach(mete); c.interp.forEach(mete);
}
const nombreVar = (d) => (d.rel ? IMPULSOS_REL.find((r) => r.name === d.variable + '/BM')?.src ?? d.variable : d.variable);
const sinComposite = descs.flatMap((d) => (d.orz ? [CT.dj30, CT.dj45] : [d.test]).filter((tn) => !variable(tn, nombreVar(d))).map((tn) => `${tn} · ${nombreVar(d)}`));
check('composite.js: los tests y variables de las 7 cualidades existen', sinComposite.length === 0, [...new Set(sinComposite)].join(' | '));
check('composite.js: los tres impulsos que se relativizan existen en el CMJ', IMPULSOS_REL.every((r) => variable(CT.cmj, r.src)), IMPULSOS_REL.filter((r) => !variable(CT.cmj, r.src)).map((r) => r.src).join(', '));
check('composite.js: las constantes T y V apuntan a algo real', Object.values(CT).every((n) => test(n)) && Object.entries(CV).every(([, n]) => cat.variables.some((v) => lc(v.name) === lc(n))), [...Object.values(CT).filter((n) => !test(n)), ...Object.values(CV).filter((n) => !cat.variables.some((v) => lc(v.name) === lc(n)))].join(', '));

// ---- 7. Carga externa de los iso-hold.
check('isohold.js: alguna variable de carga externa existe en el catálogo', LOAD_VARIABLE_NAMES.some((n) => cat.variables.some((v) => lc(v.name) === lc(n))), LOAD_VARIABLE_NAMES.join(', '));

// ---- 8. El catálogo no debe tener dos tests activos con el mismo nombre normalizado: las búsquedas por nombre se quedarían con el primero.
const vistos = new Map();
for (const t of cat.tests.filter((x) => !x.archived)) { const k = lc(t.name).normalize('NFD').replace(/[̀-ͯ]/g, ''); vistos.set(k, [...(vistos.get(k) ?? []), t.name]); }
const choques = [...vistos.values()].filter((v) => v.length > 1);
check('catálogo: no hay dos tests activos con el mismo nombre', choques.length === 0, JSON.stringify(choques));
// Ni dos variables con el mismo nombre dentro de un test.
const choquesVar = [];
for (const t of cat.tests) { const m = new Map(); for (const v of cat.variables.filter((x) => x.testId === t.id && !x.archived)) m.set(lc(v.name), [...(m.get(lc(v.name)) ?? []), v.name]); for (const [, n] of m) if (n.length > 1) choquesVar.push(`${t.name}: ${n.join(' / ')}`); }
check('catálogo: no hay dos variables activas con el mismo nombre dentro de un test', choquesVar.length === 0, choquesVar.join(' | '));


// ---- 8 bis. Los cuadros que aparecen SOLO en ciertos tests (DSI, EUR, ratios de tobillo y cadera, ORZ) también localizan por nombre.
const PANELES = [['DSI', DSI_TESTS], ['EUR', EUR_TESTS], ['ratio de tobillo', ANKLE_TESTS], ['ratio de cadera', HIP_TESTS], ['ORZ', DJ_TESTS]];
const sinPanel = PANELES.flatMap(([q, ns]) => ns.filter((n) => !test(n)).map((n) => `${q}: ${n}`));
check('pages-relaciones.js: los tests de los cuadros DSI, EUR, ratios y ORZ existen', sinPanel.length === 0, sinPanel.join(' | '));

// ---- 8 ter. La comprobación que el usuario puede lanzar desde Ajustes tiene que dar cero problemas con el catálogo de fábrica.
check('usos.js: el catálogo recién sembrado no tiene ningún aviso de nombres', comprobarNombres(cat).length === 0, JSON.stringify(comprobarNombres(cat)).slice(0, 300));
check('usos.js: sabe qué partes usan cada test', usosDeTest('CMJ').length >= 3 && usosDeTest('Double-Leg Hop Test').includes('radar') && usosDeTest('Perímetros').length === 0, JSON.stringify(usosDeTest('CMJ')));
check('usos.js: distingue un renombrado inofensivo de uno que rompe', renombradoSeguro('Run-Specific Knee Iso-Push', 'Knee Iso-Push') && renombradoSeguro('Double-Leg Hop Test', 'DL Hop Test') && !renombradoSeguro('CMJ', 'Countermovement Jump'));

// ---- 9. Renombrar quitando «Run-Specific» y pasando «Double-Leg» a «DL» no puede romper nada (plan del usuario, 14/11/2026).
// Estos dos cambios son invisibles para el normalizador, así que todas las búsquedas por nombre tienen que seguir encontrando su test.
const RENOMBRES = {
  'Run-Specific Hip Iso-Push': 'Hip Iso-Push', 'Run-Specific Knee Iso-Push': 'Knee Iso-Push', 'Run-Specific Ankle Iso-Push': 'Ankle Iso-Push',
  'Double-Leg Hop Test': 'DL Hop Test', 'Double-Leg Leg Press 45° 8RM': 'DL Leg Press 45° 8RM',
};
const premierDe = (c2, nombre) => { const t = c2.tests.find((x) => x.name === nombre); const v = c2.variables.find((x) => x.testId === t.id && lc(x.name) === 'peak force'); return !!(v && findPremier(t, v)); };
const nateraDe = (c2, nombre) => { const t = c2.tests.find((x) => x.name === nombre); const v = c2.variables.find((x) => x.testId === t.id && /^Peak Force relativo/.test(x.name)); return !!(v && findNatera(t, v)); };
const isoPushAntes = ['Run-Specific Hip Iso-Push', 'Run-Specific Knee Iso-Push', 'Run-Specific Ankle Iso-Push'];
check('antes de renombrar: los tres iso-push tienen referencia de la Premier League y de Natera', isoPushAntes.every((n) => premierDe(cat, n) && nateraDe(cat, n)));
for (const [de, a] of Object.entries(RENOMBRES)) { const t = cat.tests.find((x) => x.name === de); if (t) await updateTest(db, t.id, { name: a }); }
const cat2 = await listCatalog(db);
const test2 = (n) => cat2.tests.find((t) => mismoTest(t.name, n) && !t.archived) ?? null;
const variable2 = (tn, vn) => { const t = test2(tn); return t ? cat2.variables.find((v) => v.testId === t.id && lc(v.name) === lc(vn) && !v.archived) ?? null : null; };
check('tras renombrar: los tres iso-push conservan su referencia de la Premier League', ['Hip Iso-Push', 'Knee Iso-Push', 'Ankle Iso-Push'].every((n) => premierDe(cat2, n)), ['Hip Iso-Push', 'Knee Iso-Push', 'Ankle Iso-Push'].filter((n) => !premierDe(cat2, n)).join(', '));
check('tras renombrar: los tres iso-push conservan su referencia de Natera', ['Hip Iso-Push', 'Knee Iso-Push', 'Ankle Iso-Push'].every((n) => nateraDe(cat2, n)));
const loc2 = locate(cat2.tests, cat2.variables);
check('tras renombrar: locate() sigue resolviendo los 10', Object.values(loc2).every(Boolean), Object.entries(loc2).filter(([, v]) => !v).map(([k]) => k).join(', '));
check('tras renombrar: el radar sigue encontrando sus perfiles', RADAR_PROFILES.every((p) => test2(p.test) && p.axes.every((a) => variable2(p.test, a.variable))));
check('tras renombrar: cada iso-hold sigue encontrando su iso-push', Object.keys(ISO_PAIRS).every((hold) => !test2(hold) || !!test2(pairNameOf(hold))), Object.keys(ISO_PAIRS).filter((h) => test2(h) && !test2(pairNameOf(h))).join(', '));
const sinComposite2 = descs.flatMap((d) => (d.orz ? [CT.dj30, CT.dj45] : [d.test]).filter((tn) => !variable2(tn, nombreVar(d))).map((tn) => `${tn} · ${nombreVar(d)}`));
check('tras renombrar: las 7 cualidades siguen encontrando sus variables', sinComposite2.length === 0, [...new Set(sinComposite2)].join(' | '));
const sinPanel2 = PANELES.flatMap(([q, ns]) => ns.filter((n) => !test2(n)).map((n) => `${q}: ${n}`));
check('tras renombrar: los cuadros DSI, EUR, ratios y ORZ siguen apareciendo en su test', sinPanel2.length === 0, sinPanel2.join(' | '));
check('tras renombrar: los dos tests de una pierna nuevos siguen siendo distintos de los de dos piernas', !mismoTest('SL Hop Test', 'DL Hop Test') && !mismoTest('SL Drop Jump 30 cm', 'DL Drop Jump 30 cm') && !!test2('SL Hop Test') && !!test2('SL Drop Jump 30 cm'));
check('tras renombrar: la comprobación de Ajustes sigue sin dar avisos', comprobarNombres(cat2).length === 0, JSON.stringify(comprobarNombres(cat2)).slice(0, 300));
check('tras renombrar: el perfil del radar del Hop y los Drop Jump sigue existiendo', ['DL Hop Test', 'DL Drop Jump 30 cm', 'DL Drop Jump 45 cm', 'CMJ'].every((n) => profileForTest(n)));

process.exit(fail);
