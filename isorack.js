// isorack.js — Configuración del rack para los tests iso-push (15/11/2026, pedido del usuario).
// Es un REGISTRO PERMANENTE, no un dato evolutivo: un único apunte por jugador y test, sin fecha y sin historial. Se edita cuando cambia y punto.
// Para cada iso-push se guardan dos cosas: la altura a la que se configura el rack (texto libre: el usuario puede escribir «7», «32 cm» o lo que use
// su rack, porque no hay una unidad acordada) y si el test se hace descalzo o con zapatillas.
// La altura del jugador NO se guarda aquí: se lee de su antropometría (la medición de altura más reciente), que ya tiene su propio historial.

import { audit } from './db.js';

export const ISO_RACK_TESTS = [
  { key: 'knee', label: 'Knee iso-push', test: 'Run-Specific Knee Iso-Push' },
  { key: 'ankle', label: 'Ankle iso-push', test: 'Run-Specific Ankle Iso-Push' },
  { key: 'calf', label: 'Seated calf raise iso-push', test: 'Seated Calf Raise Iso-Push' },
];
export const CALZADO = [['', '—'], ['descalzo', 'Descalzo'], ['zapatillas', 'Con zapatillas']];
const CLAVES = ISO_RACK_TESTS.map((t) => t.key);

export const calzadoLabel = (v) => CALZADO.find(([k]) => k === (v ?? ''))?.[1] ?? '—';

// Un registro por jugador, con una entrada por test: { altura: '', calzado: '' }. Devuelve el registro vacío si el jugador aún no tiene ninguno.
export const vacio = (playerId) => ({ playerId, ...Object.fromEntries(CLAVES.map((k) => [k, { altura: '', calzado: '' }])) });

export function normalizar(rec, playerId) {
  const out = vacio(playerId);
  for (const k of CLAVES) {
    const x = rec?.[k] ?? {};
    out[k] = { altura: String(x.altura ?? '').trim(), calzado: CALZADO.some(([c]) => c === x.calzado) ? x.calzado : '' };
  }
  if (rec?.id !== undefined) out.id = rec.id;
  return out;
}

export async function listIsoRack(db) {
  const filas = await db.isoRack.toArray();
  return Object.fromEntries(filas.map((r) => [r.playerId, normalizar(r, r.playerId)]));
}

// Guarda la configuración de UN test de UN jugador. Crea el registro del jugador si no existía y no toca los otros tests.
export async function setIsoRack(db, playerId, key, patch) {
  if (!CLAVES.includes(key)) throw new Error(`Test de rack desconocido: ${key}`);
  const previo = (await db.isoRack.where('playerId').equals(playerId).toArray())[0] ?? null;
  const rec = normalizar(previo, playerId);
  rec[key] = { altura: String(patch.altura ?? rec[key].altura ?? '').trim(), calzado: patch.calzado ?? rec[key].calzado ?? '' };
  if (!CALZADO.some(([c]) => c === rec[key].calzado)) rec[key].calzado = '';
  const now = new Date().toISOString();
  if (previo) await db.isoRack.update(previo.id, { ...rec, id: previo.id, updatedAt: now });
  else await db.isoRack.add({ ...rec, createdAt: now, updatedAt: now });
  await audit(db, 'isorack-guardado', { jugadorId: playerId, test: key, altura: rec[key].altura, calzado: rec[key].calzado });
  return rec;
}

// Altura del jugador: la medición de altura MÁS RECIENTE de su antropometría, con la unidad que escribió el usuario. Sin medición no se inventa nada.
export function alturaDe(records, playerId) {
  const con = (records ?? []).filter((r) => r.playerId === playerId && r.height && r.height.value != null);
  if (!con.length) return null;
  const mejor = con.slice().sort((a, b) => String(b.date).localeCompare(String(a.date)) || b.id - a.id)[0];
  return { value: mejor.height.value, unit: String(mejor.height.unit ?? '').trim(), date: mejor.date };
}
