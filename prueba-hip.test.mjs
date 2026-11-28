// Exploración de cadera (27/11/2026): escala 0–3 solo con enteros, impingement +/✓, anotación de origen según la postura y la regla de déficit (≥ 2).
// Lo que se vigila aquí es que no haya DOS reglas: el alta manual, el importador y el bloque Déficits tienen que decidir lo mismo con los mismos datos.
import 'fake-indexeddb/auto';
import { createDb, initDb } from './db.js';
import { seedInitialCatalog } from './catalogo-inicial.js';
import { listCatalog } from './catalogo.js';
import { addManualSession } from './alta-manual.js';
import { testHip, parseHipSheet, valorDeCelda, resumenFila, commitHip } from './hip-excel.js';
import { deficitsHip, ultimaValoracion, escalaDe, posturaDe, origenDeficit, validarValorEscala, etiquetaValor, ESCALA_ROM, ESCALA_IMPINGEMENT, UMBRAL_ROM, GRADOS_ROM } from './hip.js';

let failed = 0;
const check = (n, ok, d = '') => { console.log(`${ok ? 'OK  ' : 'FAIL'} ${n} ${ok ? '' : d}`); if (!ok) failed++; };

// ---- Escala: 0 a 3, solo enteros. Ni el 4 ni los medios puntos (decisión del usuario del 27/11/2026).
check('la escala de rango articular es 0, 1, 2 y 3', GRADOS_ROM.map((g) => g.valor).join() === '0,1,2,3');
for (const n of [0, 1, 2, 3]) check(`el ${n} es un grado válido`, validarValorEscala(ESCALA_ROM, n).ok);
check('el 4 se rechaza y dice por qué', !validarValorEscala(ESCALA_ROM, 4).ok && /fuera de la escala/.test(validarValorEscala(ESCALA_ROM, 4).razon));
check('el 0,5 se rechaza por no ser entero', !validarValorEscala(ESCALA_ROM, 0.5).ok && /enteros/.test(validarValorEscala(ESCALA_ROM, 0.5).razon));
check('el 2,5 se rechaza por no ser entero', !validarValorEscala(ESCALA_ROM, 2.5).ok && /enteros/.test(validarValorEscala(ESCALA_ROM, 2.5).razon));
check('el −1 se rechaza', !validarValorEscala(ESCALA_ROM, -1).ok);
check('el texto se rechaza', !validarValorEscala(ESCALA_ROM, NaN).ok);
check('el impingement solo admite 0 y 1', validarValorEscala(ESCALA_IMPINGEMENT, 1).ok && validarValorEscala(ESCALA_IMPINGEMENT, 0).ok && !validarValorEscala(ESCALA_IMPINGEMENT, 2).ok);
check('cada grado se enseña con su texto', etiquetaValor(ESCALA_ROM, 2) === '2 · Limitación moderada' && etiquetaValor(ESCALA_IMPINGEMENT, 1) === 'Positivo (+)' && etiquetaValor(ESCALA_IMPINGEMENT, 0) === 'Negativo (✓)');

// ---- Lectura de celdas: «+» positivo, «✓» negativo, vacío = no explorado.
check('«+» es impingement positivo', valorDeCelda('+', ESCALA_IMPINGEMENT).valor === 1);
check('«✓» es impingement negativo', valorDeCelda('✓', ESCALA_IMPINGEMENT).valor === 0);
check('una celda vacía es «no explorado», no un 0', valorDeCelda('', ESCALA_IMPINGEMENT).vacio === true && valorDeCelda(null, ESCALA_ROM).vacio === true);
check('un símbolo desconocido en impingement se rechaza con su motivo', !!valorDeCelda('?', ESCALA_IMPINGEMENT).razon);
check('el 0,5 de una celda de rango se rechaza con su motivo', /enteros/.test(valorDeCelda(0.5, ESCALA_ROM).razon ?? ''));
check('la coma decimal no cuela un medio punto', /enteros/.test(valorDeCelda('1,5', ESCALA_ROM).razon ?? ''));

// ---- Postura y origen: SOLO las rotaciones llevan anotación (decisión del usuario).
const vFalsa = (name) => ({ name, testId: 1, sides: 'LR' });
check('rotación en supino → compromiso articular', /articular/.test(origenDeficit(vFalsa('HIP INTERNAL ROTATION · SUPINE POSITION')) ?? ''));
check('rotación en prono → origen muscular', /muscular/.test(origenDeficit(vFalsa('HIP EXTERNAL ROTATION · PRONE POSITION')) ?? ''));
check('la flexión de cadera NO lleva anotación de origen', origenDeficit(vFalsa('HIP FLEXION')) === null && posturaDe(vFalsa('HIP FLEXION')) === null);
check('el Bent Knee Over NO lleva anotación de origen', origenDeficit(vFalsa('BENT KNEE OVER')) === null);
check('las dos grafías del impingement se reconocen', escalaDe(vFalsa('IMPINGEMENT')) === ESCALA_IMPINGEMENT && escalaDe(vFalsa('IMPIGMENT')) === ESCALA_IMPINGEMENT);
check('una variable que no es de cadera no tiene escala', escalaDe(vFalsa('Peak Force')) === null);

// ---- Catálogo y datos reales
const db = createDb('hip-' + Math.random());
await initDb(db); await seedInitialCatalog(db);
const cat = await listCatalog(db);
const hip = testHip(cat);
check('el test «Hip» está en el bloque NME con sus siete variables', !!hip && Object.keys(hip.porClave).length === 7, JSON.stringify(Object.keys(hip?.porClave ?? {})));
check('el Bent Knee Over es un único valor, sin lado', hip.porClave['bent-knee-over'].sides === 'single');
check('las seis restantes van por pierna', ['impingement', 'ri-supina', 'ri-prona', 're-supina', 're-prona', 'flexion'].every((k) => hip.porClave[k].sides === 'LR'));
check('ninguna variable de cadera tiene dirección «mejor/peor» (su percentil no significaría nada)', Object.values(hip.porClave).every((v) => v.direction === null));
check('quedan fuera de Asimetrías y del déficit por percentil', Object.values(hip.porClave).every((v) => v.excluirAsimetrias === true && v.excluirDeficits === true));

const now = new Date().toISOString();
const pid = await db.players.add({ jerseyName: 'HIP', fullName: 'Jugador De Cadera', active: true, createdAt: now, updatedAt: now });
const V = hip.porClave;
// Una valoración con un hallazgo de cada tipo.
await addManualSession(db, { playerId: pid, testId: hip.test.id, date: '2026-11-20', valores: {
  [V['impingement'].id]: { L: 0, R: 1 },
  [V['ri-supina'].id]: { L: 1, R: 3 },
  [V['ri-prona'].id]: { L: 2, R: 0 },
  [V['re-supina'].id]: { L: 0, R: 0 },
  [V['flexion'].id]: { L: 2, R: 1 },
  [V['bent-knee-over'].id]: { S: 3 },
}, nota: 'Refiere pinchazo en el gesto de golpeo.' });
const sesiones = await db.sessions.where('playerId').equals(pid).toArray();
check('la anotación de la valoración se guarda en la sesión', sesiones[0].nota === 'Refiere pinchazo en el gesto de golpeo.');

const d = deficitsHip({ variables: cat.variables, testId: hip.test.id, sesion: ultimaValoracion(sesiones, hip.test.id) });
const clavesDe = (f) => `${f.variable.name}|${f.side}`;
check('Déficits recoge el impingement positivo y solo ese lado', d.filas.filter((f) => f.tipo === 'impingement').map(clavesDe).join() === 'IMPINGEMENT|R');
check('entra todo rango articular ≥ 2 y nada por debajo',
  d.filas.filter((f) => f.tipo === 'rom').map(clavesDe).join() === 'HIP INTERNAL ROTATION · SUPINE POSITION|R,HIP INTERNAL ROTATION · PRONE POSITION|L,HIP FLEXION|L,BENT KNEE OVER|S',
  d.filas.filter((f) => f.tipo === 'rom').map(clavesDe).join());
check('el grado 1 no es déficit', !d.filas.some((f) => f.valor === 1 && f.tipo === 'rom'));
check('el supino del déficit se anota como articular', /articular/.test(d.filas.find((f) => /SUPINE/.test(f.variable.name)).origen));
check('el prono del déficit se anota como muscular', /muscular/.test(d.filas.find((f) => /PRONE/.test(f.variable.name)).origen));
check('la flexión y el Bent Knee Over salen sin anotación de origen', d.filas.filter((f) => /FLEXION|BENT KNEE/.test(f.variable.name)).every((f) => f.origen === null));
check('el Bent Knee Over sale como bilateral, sin lado', d.filas.find((f) => /BENT KNEE/.test(f.variable.name)).side === 'S');
check('cada fila lleva el grado escrito', d.filas.every((f) => /Limitación|Positivo/.test(f.etiqueta)));
check('la valoración lleva su fecha y su anotación', d.fecha === '2026-11-20' && /pinchazo/.test(d.nota));
check(`el umbral es ${UMBRAL_ROM}`, UMBRAL_ROM === 2);
check('una pierna sin explorar no cuenta como 0', !d.filas.some((f) => /EXTERNAL ROTATION · PRONE/.test(f.variable.name)));

// Sin hallazgos: la función no inventa filas.
const pid2 = await db.players.add({ jerseyName: 'SANO', active: true, createdAt: now });
await addManualSession(db, { playerId: pid2, testId: hip.test.id, date: '2026-11-20', valores: { [V['impingement'].id]: { L: 0, R: 0 }, [V['flexion'].id]: { L: 1, R: 0 } } });
const d2 = deficitsHip({ variables: cat.variables, testId: hip.test.id, sesion: ultimaValoracion(await db.sessions.where('playerId').equals(pid2).toArray(), hip.test.id) });
check('un jugador sin hallazgos no genera ninguna fila, pero sí consta lo explorado', d2.filas.length === 0 && d2.explorado === 4);
check('sin ninguna valoración no hay bloque', deficitsHip({ variables: cat.variables, testId: hip.test.id, sesion: null }).filas.length === 0);

// El alta manual rechaza lo que el importador rechaza: una sola regla.
let err = '';
try { await addManualSession(db, { playerId: pid2, testId: hip.test.id, date: '2026-11-21', valores: { [V['flexion'].id]: { L: 4 } } }); } catch (e) { err = e.message; }
check('el alta manual rechaza un 4 con su motivo', /fuera de la escala/.test(err), err);
err = '';
try { await addManualSession(db, { playerId: pid2, testId: hip.test.id, date: '2026-11-21', valores: { [V['flexion'].id]: { L: 2.5 } } }); } catch (e) { err = e.message; }
check('el alta manual rechaza un 2,5 con su motivo', /enteros/.test(err), err);

// Déficits mira la ÚLTIMA valoración, no la primera ni una media.
await addManualSession(db, { playerId: pid, testId: hip.test.id, date: '2026-11-25', valores: { [V['flexion'].id]: { L: 0, R: 0 }, [V['impingement'].id]: { L: 0, R: 0 } } });
const d3 = deficitsHip({ variables: cat.variables, testId: hip.test.id, sesion: ultimaValoracion(await db.sessions.where('playerId').equals(pid).toArray(), hip.test.id) });
check('con una valoración nueva sin hallazgos, el bloque se vacía (no se promedian grados)', d3.filas.length === 0 && d3.fecha === '2026-11-25');

// ---- Hoja de Excel con la cabecera de tres filas combinadas, tal como la escribe el usuario.
const hoja = [
  ['PLAYER', 'IMPIGMENT', null, 'HIP INTERNAL ROTATION', null, null, null, 'HIP EXTERNAL ROTATION', null, null, null, 'HIP FLEXION', null, 'BENT KNEE OVER'],
  [null, null, null, 'SUPINE POSITION', null, 'PRONE POSITION', null, 'SUPINE POSITION', null, 'PRONE POSITION', null, null, null, null],
  [null, 'LEFT', 'RIGHT', 'LEFT', 'RIGHT', 'LEFT', 'RIGHT', 'LEFT', 'RIGHT', 'LEFT', 'RIGHT', 'LEFT', 'RIGHT', null],
  [null, null, null, null, null, null, null, null, null, null, null, null, null, null],
  ['SIN DATOS', null, null, null, null, null, null, null, null, null, null, null, null, null],
  ['DAVID LOPEZ', '✓', '+', 1, 3, 1, 2, 1, 1, 0, 0, 1, 2, 2],
  ['PORTU', '+', '+', 1, 3, 0, 0.5, 1, 0, 0, 0, 1, 3, 1],
  ['CUATRO', '+', '✓', 4, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
];
const p = parseHipSheet(hoja);
check('se reconocen las trece columnas de datos', p.ok && p.cols.length === 13, JSON.stringify(p.cols?.map((c) => c.clave)));
check('el Bent Knee Over se lee como columna única', p.cols.filter((c) => c.clave === 'bent-knee-over').map((c) => c.side).join() === 'S');
check('las rotaciones se separan por postura', p.cols.filter((c) => c.clave.startsWith('ri-') || c.clave.startsWith('re-')).length === 8);
check('la columna de jugadores es la de «PLAYER»', p.nameCol === 0);
const fila = (n) => p.filas.find((f) => f.name === n);
check('una fila entera en blanco no se importa', fila('SIN DATOS').vacia === true && fila('SIN DATOS').conDato === 0);
check('«✓» y «+» se guardan como 0 y 1', fila('DAVID LOPEZ').valores['impingement'].L === 0 && fila('DAVID LOPEZ').valores['impingement'].R === 1);
check('los grados se leen en su columna y su lado', fila('DAVID LOPEZ').valores['ri-supina'].R === 3 && fila('DAVID LOPEZ').valores['bent-knee-over'].S === 2);
check('el 0,5 se señala con su columna y su lado, y no se importa',
  fila('PORTU').incidencias.length === 1 && /PRONE POSITION · derecha/.test(fila('PORTU').incidencias[0]) && fila('PORTU').valores['ri-prona'].R === undefined,
  JSON.stringify(fila('PORTU').incidencias));
check('el resto de la fila con un error sí se importa', fila('PORTU').valores['ri-supina'].R === 3 && fila('PORTU').conDato === 12);
check('un 4 se señala y no se importa', fila('CUATRO').incidencias.length === 1 && /fuera de la escala/.test(fila('CUATRO').incidencias[0]) && fila('CUATRO').valores['ri-supina'].L === undefined);
check('el resumen de una fila se lee de un vistazo', /IMP ✓\/\+/.test(resumenFila(fila('DAVID LOPEZ').valores)) && /BKO 2/.test(resumenFila(fila('DAVID LOPEZ').valores)));
check('sin cabecera reconocible se dice por qué', !parseHipSheet([['Jugador', 'Peso'], ['A', 70]]).ok);
check('una hoja vacía no revienta', !parseHipSheet([]).ok && !parseHipSheet(null).ok);

// La importación guarda exactamente lo que se ha leído, y el déficit que sale es el mismo que el de la ficha.
const pid3 = await db.players.add({ jerseyName: 'D. LOPEZ', fullName: 'David Lopez', active: true, createdAt: now });
const r = await commitHip(db, { catalog: cat, date: '2026-11-26', items: [{ name: 'DAVID LOPEZ', playerId: pid3, valores: fila('DAVID LOPEZ').valores, nota: 'Importado del Excel.' }] });
check('la importación crea una valoración', r.creadas === 1 && r.omitidas === 0, JSON.stringify(r));
const sImp = ultimaValoracion(await db.sessions.where('playerId').equals(pid3).toArray(), hip.test.id);
check('los valores guardados son los leídos', sImp.values[V['ri-supina'].id].R === 3 && sImp.values[V['impingement'].id].R === 1 && sImp.values[V['bent-knee-over'].id].S === 2);
check('la anotación de la importación se guarda', sImp.nota === 'Importado del Excel.');
const dImp = deficitsHip({ variables: cat.variables, testId: hip.test.id, sesion: sImp });
check('el déficit importado coincide con la regla: impingement derecho, RI supina derecha 3, RI prona derecha 2, flexión derecha 2 y BKO 2',
  dImp.filas.map((f) => `${f.variable.name}|${f.side}|${f.valor}`).join(' · ') ===
  'IMPINGEMENT|R|1 · HIP INTERNAL ROTATION · SUPINE POSITION|R|3 · HIP INTERNAL ROTATION · PRONE POSITION|R|2 · HIP FLEXION|R|2 · BENT KNEE OVER|S|2',
  dImp.filas.map((f) => `${f.variable.name}|${f.side}|${f.valor}`).join(' · '));
const r2 = await commitHip(db, { catalog: cat, date: '2026-11-26', items: [{ name: 'DAVID LOPEZ', playerId: pid3, valores: fila('DAVID LOPEZ').valores }] });
check('importar dos veces el mismo día no duplica la valoración', r2.creadas === 0 && r2.duplicadas === 1, JSON.stringify(r2));
const r3 = await commitHip(db, { catalog: cat, date: '2026-11-27', items: [{ name: 'X', playerId: null, valores: {} }] });
check('una fila sin jugador vinculado se omite, no se inventa', r3.creadas === 0 && r3.omitidas === 1);


// ---- El Excel de cadera NO se puede importar por el importador genérico (27/11/2026, error visto por el usuario).
// Aquel importador exige números, así que con «+» y «✓» soltaba un «no es un número» por celda y parecía que el fichero estuviera mal.
{
  const importables = cat.tests.filter((t) => !t.archived && cat.variables.some((v) => v.testId === t.id && v.kind === 'raw' && !v.archived && !escalaDe(v)));
  check('el test «Hip» no aparece en la lista del importador genérico', !importables.some((t) => t.id === hip.test.id), importables.filter((t) => t.blockKey === 'nme').map((t) => t.name).join());
  check('los demás tests de NME sí siguen apareciendo', importables.some((t) => t.blockKey === 'nme'), importables.filter((t) => t.blockKey === 'nme').map((t) => t.name).join());
  const asignables = cat.variables.filter((v) => v.testId === hip.test.id && v.kind === 'raw' && !v.archived && !escalaDe(v));
  check('ninguna variable de cadera se puede asignar a una columna del importador genérico', asignables.length === 0, asignables.map((v) => v.name).join());
}

process.exit(failed ? 1 : 0);
