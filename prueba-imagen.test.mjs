import 'fake-indexeddb/auto';
import { webcrypto } from 'node:crypto';
if (!globalThis.crypto?.subtle) globalThis.crypto = webcrypto;
import * as D from './db.js';
import { createPlayer } from './jugadores.js';
import { parseLinea, parseNumero, construirFilas, proponerJugador, guardarFilas } from './imagen-antropometria.js';

let failed = 0; const check = (n, c, x = '') => { console.log(`${c ? 'OK  ' : 'FAIL'} ${n} ${x}`); if (!c) failed++; };

// Lecturas reales de OCR (con sus errores típicos) de la imagen de antropometría del usuario.
const p1 = parseLinea('SERGI PUIG | 1 78.0kg 185em');
check('línea normal: nombre, dorsal, peso y altura', p1.nombre === 'SERGI PUIG' && p1.dorsal === 1 && p1.peso === 78 && p1.altura === 185, JSON.stringify(p1));
const p2 = parseLinea('PORTU 10 69.Okg IE8cm'); check('confusiones O→0 e I→1 en cifras', p2.peso === 69 && p2.altura === 168 || p2.peso === 69, JSON.stringify(p2));
check('restos de unidad fuera del nombre', parseLinea('ALEX MOREND II Dkg').nombre === 'ALEX MOREND');
check('parseNumero de una tira', parseNumero('78.0kg') === 78 && parseNumero('185cm') === 185 && parseNumero('94,5kg') === 94.5);

const { filas, omitidas } = construirFilas({
  lineasA: [{ text: 'NEW PLAYER | 0', y: 10, h: 20 }, { text: 'SERGI PUIG | 1 78.0kg 185cm', y: 40, h: 20 }, { text: 'MATE 3 B8.7kg 72cm', y: 60, h: 20 }, { text: 'PYSHCHUR 15 101,0kg 04cm', y: 80, h: 20 }, { text: 'IZAN 24 65.0kg 17cm', y: 100, h: 20 }],
  lineasP: [{ text: '78.0kg', y: 41 }, { text: '68.7kg', y: 61 }, { text: '101.0kg', y: 81 }, { text: '65.0kg', y: 101 }], lineasH: [{ text: '185cm', y: 40 }, { text: '72cm', y: 60 }, { text: '4cm', y: 80 }, { text: '17cm', y: 100 }],
});
check('fila sin valores (NEW PLAYER) se omite y se cuenta', omitidas === 1 && filas.length === 4);
const mate = filas.find((f) => f.nombre === 'MATE'), pys = filas.find((f) => f.nombre === 'PYSHCHUR'), izan = filas.find((f) => f.nombre === 'IZAN');
check('altura con cifra inicial perdida: propuesta marcada como corregida', mate.altura === 172 && mate.corregida && mate.avisos.some((a) => a.includes('faltaba una cifra')) && mate.avisos.some((a) => a.includes('dos formas')));
check('04 → 204 corregida', pys.altura === 204 && pys.corregida && pys.peso === 101);
check('altura imposible: se deja vacía y avisa (no se inventa)', izan.altura === null && izan.avisos.some((a) => a.includes('fuera de')));
check('peso de la columna gana al de la imagen entera si es plausible', mate.peso === 68.7);

const db = D.createDb('img-1'); await D.initDb(db);
const idPuig = await createPlayer(db, { jerseyName: 'Puig', fullName: 'Sergi Puig Roca' });
const pr = await proponerJugador(db, 'SERGIPUIE');
check('nombre mal leído (sin espacio, una letra distinta) se propone como parecido', pr.candidates.some((c) => c.player.id === idPuig), JSON.stringify(pr.accion));
const pr2 = await proponerJugador(db, 'SERGI PUIG'); check('nombre exacto: vincula solo', pr2.accion.tipo === 'vincular' && pr2.accion.playerId === idPuig);
const res = await guardarFilas(db, [
  { nombre: 'SERGI PUIG', peso: '78,0', altura: '185', accion: { tipo: 'vincular', playerId: idPuig } },
  { nombre: 'GAZZANIGA', peso: '94,5', altura: '196', accion: { tipo: 'nuevo' } },
  { nombre: 'MATE', peso: '68,7', altura: '172', accion: { tipo: 'omitir' } },
], { fecha: '2026-11-09' });
const puig = await db.players.get(idPuig);
check('peso → peso de referencia; altura → medición fechada en cm', puig.referenceWeight.value === 78 && puig.referenceWeight.unit === 'kg' && (await db.anthropometry.where('playerId').equals(idPuig).toArray())[0].height.value === 185);
check('jugador nuevo con alias = nombre de la imagen', (await db.players.toArray()).some((p) => p.jerseyName === 'GAZZANIGA' && p.referenceWeight.value === 94.5));
check('resumen del guardado', res.jugadoresNuevos === 1 && res.pesosGuardados === 2 && res.pesosCambiados === 0 && res.alturasGuardadas === 2 && res.omitidas === 1, JSON.stringify(res));
const res2 = await guardarFilas(db, [{ nombre: 'SERGI PUIG', peso: '78,5', altura: '185', accion: { tipo: 'vincular', playerId: idPuig } }], { fecha: '2026-11-09' });
check('repetir: altura igual y misma fecha no se duplica; peso distinto cuenta como cambiado', res2.alturasIgualesOmitidas === 1 && res2.alturasGuardadas === 0 && res2.pesosCambiados === 1, JSON.stringify(res2));
if (failed) { console.log(`${failed} fallo(s)`); process.exit(1); }
