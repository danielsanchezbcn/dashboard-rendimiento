// Configuración ISO-rack (15/11/2026): registro permanente por jugador, sin fecha ni historial.
import 'fake-indexeddb/auto';
import { createDb, initDb } from './db.js';
import { readSnapshot } from './backup.js';
import { ISO_RACK_TESTS, CALZADO, listIsoRack, setIsoRack, alturaDe, normalizar, vacio, calzadoLabel } from './isorack.js';

let fail = 0; const check = (n, ok, d = '') => { console.log((ok ? 'OK   ' : 'FAIL ') + n + (ok ? '' : ' ' + d)); if (!ok) fail = 1; };
const rej = async (f) => { try { await f(); return false; } catch { return true; } };

const db = createDb('t-isorack-' + Math.random()); await initDb(db);
const p1 = await db.players.add({ jerseyName: 'Ana' });
const p2 = await db.players.add({ jerseyName: 'Beto' });

check('la tabla isoRack sigue existiendo en el esquema 8', db.verno === 8 && db.tables.some((t) => t.name === 'isoRack'));
check('los tres iso-push del documento, en orden', ISO_RACK_TESTS.map((t) => t.key).join() === 'knee,ankle,calf' && ISO_RACK_TESTS.map((t) => t.label).join(' · ') === 'Knee iso-push · Ankle iso-push · Seated calf raise iso-push');
check('calzado: solo descalzo o con zapatillas', CALZADO.map(([k]) => k).join() === ',descalzo,zapatillas' && calzadoLabel('descalzo') === 'Descalzo' && calzadoLabel('zapatillas') === 'Con zapatillas' && calzadoLabel(undefined) === '—');

// ---- Guardar y leer
check('un jugador sin configurar sale vacío, no falta', Object.keys(await listIsoRack(db)).length === 0 && vacio(p1).knee.altura === '' && vacio(p1).knee.calzado === '');
await setIsoRack(db, p1, 'knee', { altura: '7', calzado: 'descalzo' });
let r = await listIsoRack(db);
check('se guarda la altura del rack y el calzado', r[p1].knee.altura === '7' && r[p1].knee.calzado === 'descalzo', JSON.stringify(r[p1]));
check('los otros dos tests del mismo jugador siguen vacíos', r[p1].ankle.altura === '' && r[p1].calf.calzado === '');
await setIsoRack(db, p1, 'calf', { altura: '32 cm', calzado: 'zapatillas' });
r = await listIsoRack(db);
check('guardar otro test no pisa el primero', r[p1].knee.altura === '7' && r[p1].calf.altura === '32 cm' && r[p1].calf.calzado === 'zapatillas');
check('un solo registro por jugador, no uno por cambio', (await db.isoRack.count()) === 1);
// La altura es texto libre a propósito: el usuario puede escribir el número de agujero de su rack o una medida con unidad.
check('la altura admite texto libre y se le quitan los espacios', r[p1].calf.altura === '32 cm');
await setIsoRack(db, p1, 'knee', { altura: '  9  ' });
r = await listIsoRack(db);
check('cambiar solo la altura conserva el calzado', r[p1].knee.altura === '9' && r[p1].knee.calzado === 'descalzo');
await setIsoRack(db, p1, 'knee', { calzado: '' });
r = await listIsoRack(db);
check('se puede dejar el calzado sin indicar', r[p1].knee.calzado === '' && r[p1].knee.altura === '9');
await setIsoRack(db, p1, 'knee', { calzado: 'chanclas' });
r = await listIsoRack(db);
check('un calzado que no es de la lista no se guarda', r[p1].knee.calzado === '');
check('un test desconocido se rechaza', await rej(() => setIsoRack(db, p1, 'cadera', { altura: '1' })));
await setIsoRack(db, p2, 'ankle', { altura: '4', calzado: 'descalzo' });
r = await listIsoRack(db);
check('cada jugador tiene su propio registro', r[p2].ankle.altura === '4' && r[p1].ankle.altura === '' && (await db.isoRack.count()) === 2);
check('queda constancia en el registro de auditoría', (await db.auditLog.toArray()).filter((a) => a.action === 'isorack-guardado').length >= 2);
check('no se guarda ninguna fecha de medición: solo cuándo se tocó', Object.keys(await db.isoRack.get(1)).includes('updatedAt') && !Object.keys(await db.isoRack.get(1)).includes('date'));
check('entra en las copias de seguridad', 'isoRack' in (await readSnapshot(db)));

// ---- Altura del jugador: la medición más reciente de su antropometría
await db.anthropometry.add({ playerId: p1, date: '2026-01-10', height: { value: 180, unit: 'cm' } });
await db.anthropometry.add({ playerId: p1, date: '2026-09-01', height: { value: 182, unit: 'cm' } });
await db.anthropometry.add({ playerId: p1, date: '2026-10-01', bodyMass: { value: 75, unit: 'kg' } });
await db.anthropometry.add({ playerId: p2, date: '2026-05-05', bodyMass: { value: 70, unit: 'kg' } });
const recs = await db.anthropometry.toArray();
const alt = alturaDe(recs, p1);
check('la altura es la medición de altura más reciente, con su unidad', alt.value === 182 && alt.unit === 'cm' && alt.date === '2026-09-01', JSON.stringify(alt));
check('una medición posterior sin altura no borra la altura', alturaDe(recs, p1).value === 182);
check('sin medición de altura no se inventa ninguna', alturaDe(recs, p2) === null);
check('un jugador sin antropometría tampoco', alturaDe([], p1) === null);

check('normalizar tolera un registro a medias', JSON.stringify(normalizar({ knee: { altura: 5 } }, p1).knee) === JSON.stringify({ altura: '5', calzado: '' }));

console.log(fail ? 'HAY FALLOS' : 'Todo bien');
process.exit(fail);
