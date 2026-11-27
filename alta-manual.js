// alta-manual.js — alta manual de resultados (15/11/2026, pedido del usuario): tests que no vienen de VALD ni de ningún Excel y cuyo resultado se
// escribe a mano en la propia pantalla del test. Crea UNA sesión con los valores escritos, igual que una sesión importada: a partir de ahí entra en
// percentiles, asimetrías, déficits y todo lo demás sin ninguna excepción.
// No se confunde con el «Alta manual de carga» de los Iso-Hold y los RM (isohold.js), que escribe una sola variable de carga.

import { audit } from './db.js';
import { isIsoDay } from './fechas.js';
import { mismoTest } from './nombres.js';
import { escalaDe, validarValorEscala } from './hip.js';

// Tests con alta manual, por nombre (lista del usuario). «Perímetros», el toe-touch y los tests de NME entran por su BLOQUE, así que
// cualquier test que se cree más adelante en NME o en Perímetros tendrá alta manual sin tocar esta lista.
export const TESTS_ALTA_MANUAL = [
  'Supine Isometric Ankle Inversion',
  'Supine Isometric Ankle Eversion',
  'Seated Isometric 90°/90° Knee Extension Test',
  'Hip Adduction 0° (Long Lever)',
  'Hip Abduction 0° (Long Lever)',
  'Hip Adduction 45° (Short Lever)',
];
export const BLOQUES_ALTA_MANUAL = ['nme', 'perimetros'];

export const admiteAltaManual = (test) =>
  !!test && !test.archived && (BLOQUES_ALTA_MANUAL.includes(test.blockKey ?? 'fuerza') || TESTS_ALTA_MANUAL.some((n) => mismoTest(n, test.name)));

// Variables que se pueden escribir: las del test que no estén archivadas y no sean calculadas (esas salen solas).
export const variablesAltaManual = (variables, testId) =>
  variables.filter((v) => v.testId === testId && !v.archived && v.kind !== 'derived').sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.id - b.id);

const num = (x) => {
  const t = String(x ?? '').trim();
  if (t === '') return null;
  const n = Number(t.replace(',', '.'));
  return Number.isFinite(n) ? n : NaN;
};

// `valores`: { [variableId]: { L, R } | { S } } con lo escrito (texto o número). Las casillas vacías no se guardan.
// `nota`: anotación de texto libre de la valoración, una por sesión (27/11/2026, pedido del usuario para la exploración de cadera). Se guarda tal cual.
export async function addManualSession(db, { playerId, testId, date, time = '', valores = {}, nota = '' }) {
  const player = await db.players.get(playerId);
  if (!player) throw new Error('Elige un jugador.');
  const test = await db.tests.get(testId);
  if (!test) throw new Error('Elige un test.');
  if (!admiteAltaManual(test)) throw new Error('Este test no admite alta manual.');
  const d = String(date ?? '').trim(); const t = String(time ?? '').trim();
  if (!isIsoDay(d)) throw new Error('La fecha no es válida (AAAA-MM-DD).');
  if (t && !/^([01]\d|2[0-3]):[0-5]\d$/.test(t)) throw new Error('La hora no es válida (HH:MM).');
  const vars = variablesAltaManual(await db.variables.where('testId').equals(testId).toArray(), testId);
  const values = {};
  for (const v of vars) {
    const lados = v.sides === 'LR' ? ['L', 'R'] : ['S'];
    const dentro = {};
    for (const sd of lados) {
      const n = num(valores?.[v.id]?.[sd]);
      if (n === null) continue;
      const donde = `${v.name}${v.sides === 'LR' ? ` (${sd === 'L' ? 'izquierda' : 'derecha'})` : ''}`;
      if (Number.isNaN(n)) throw new Error(`${donde}: escribe un número.`);
      // Variables con escala cerrada (los grados clínicos de la cadera): se valida AQUÍ, en el único sitio por el que pasan tanto el alta manual
      // como la importación, para que no haya dos reglas distintas. No se redondea nada: un 4 o un 2,5 se rechazan con su motivo (27/11/2026).
      const esc = escalaDe(v);
      if (esc) { const ok = validarValorEscala(esc, n); if (!ok.ok) throw new Error(`${donde}: ${ok.razon}.`); }
      dentro[sd] = n;
    }
    if (Object.keys(dentro).length) values[v.id] = dentro;
  }
  if (!Object.keys(values).length) throw new Error('Escribe al menos un valor.');
  const clash = (await db.sessions.where('playerId').equals(playerId).toArray()).find((s) => s.testId === testId && s.date === d && (s.time ?? '') === t);
  if (clash) throw new Error('Ya hay una sesión de ese jugador y test en esa fecha y hora. Corrígela desde su tabla de sesiones.');
  const id = await db.sessions.add({
    playerId, testId, protocolId: null, date: d, time: t, values, reps: {}, status: 'valid', excludedReason: '',
    source: 'manual', createdAt: new Date().toISOString(), ...(String(nota ?? '').trim() ? { nota: String(nota).trim() } : {}), ...(player.synthetic ? { synthetic: 1 } : {}),
  });
  await audit(db, 'sesion-alta-manual', { sessionId: id, playerId, testId, date: d, variables: Object.keys(values).length });
  return id;
}
