// imagen-antropometria.js — de las líneas leídas por OCR (imagen-ocr.js) a filas revisables, y guardado de lo confirmado.
// Regla de la guía: no se inventan datos. El OCR solo PROPONE; cada valor dudoso queda marcado y la pantalla obliga a revisar la imagen fila a fila.
// Se guarda: peso → peso de referencia del jugador (sirve para las medidas relativas si no hay masa medida; decidido el 9/11/2026) y altura → medición fechada.

import { audit } from './db.js';
import { createPlayer, findCandidates } from './jugadores.js';
import { addAnthropometry, setReferenceWeight } from './antropometria.js';

export const RANGO_PESO = [45, 130]; // kg, jugadores profesionales adultos: fuera de rango = ilegible/dudoso (no se guarda sin revisar)
export const RANGO_ALTURA = [140, 215]; // cm

// Confusiones típicas del OCR dentro de una cifra: O→0, I/l/|→1, B→8, S→5.
const arreglaDigitos = (s) => s.replace(/[Oo]/g, '0').replace(/[Il|]/g, '1').replace(/B/g, '8').replace(/S/g, '5');
const numero = (s) => { const t = arreglaDigitos(String(s ?? '')).replace(',', '.').replace(/[^0-9.]/g, ''); const m = t.match(/^\d+(?:\.\d+)?/); return m ? Number(m[0]) : null; };

// Una línea de la pasada A: «NOMBRE | dorsal 78.0kg 185cm» (con errores de lectura).
export function parseLinea(texto) {
  const t = String(texto).replace(/[|_=—–]/g, ' ').replace(/\s+/g, ' ').trim();
  const mp = t.match(/([0-9OoIlBS]{1,3}\s?[.,]?\s?[0-9OoIlBS]?)\s?(?:kg|kq|k9)/i);
  const ma = t.match(/([0-9OoIlBS]{2,3})\s?(?:cm|em|cn)\b/i);
  const todos = t.split(' ').filter(Boolean);
  // El nombre son las palabras iniciales hasta la primera con cifras o con restos de la unidad («Dkg», «Zcm»).
  let fin = todos.findIndex((w) => /\d/.test(w) || /^[A-Za-z0-9]{0,2}(?:k[gq9]|c[mn]|em)$/i.test(w));
  if (fin < 0) fin = todos.length;
  const tokens = todos.slice(0, fin);
  while (tokens.length > 1 && /^[IlL|DZSB.]{1,2}$/.test(tokens[tokens.length - 1])) tokens.pop(); // separadores leídos como letras
  const dorsalTok = todos.slice(fin).find((w) => /^\d{1,2}$/.test(w));
  const nombre = tokens.join(' ').replace(/[^A-Za-zÀ-ÿ.'\- ]/g, '').replace(/\s+/g, ' ').trim();
  return { nombre, dorsal: dorsalTok ? Number(dorsalTok) : null, peso: mp ? numero(mp[1]) : null, altura: ma ? numero(ma[1]) : null };
}
// Una línea de una tira numérica (pasada B): solo cifras y unidad.
export const parseNumero = (texto) => numero(String(texto).replace(/kg|kq|k9|cm|em|cn/gi, ''));

function juzgaPeso(v) {
  if (v == null) return { valor: null, avisos: [] };
  if (v >= RANGO_PESO[0] && v <= RANGO_PESO[1]) return { valor: v, avisos: [] };
  return { valor: null, avisos: [`peso leído «${String(v).replace('.', ',')}»: fuera de ${RANGO_PESO[0]}–${RANGO_PESO[1]} kg, escríbelo mirando la imagen`] };
}
function juzgaAltura(v) {
  if (v == null) return { valor: null, avisos: [] };
  if (v >= RANGO_ALTURA[0] && v <= RANGO_ALTURA[1]) return { valor: v, avisos: [] };
  // Falta la cifra inicial (p. ej. «72» por 172, «04» por 204): se propone la cifra más plausible, pero queda marcada como corregida.
  const cand = v >= 40 && v < 100 ? 100 + v : v >= 0 && v < 20 ? 200 + v : null;
  if (cand && cand >= RANGO_ALTURA[0] && cand <= RANGO_ALTURA[1]) return { valor: cand, corregida: true, avisos: [`altura leída «${v}», propuesta ${cand} (faltaba una cifra): comprueba la imagen`] };
  return { valor: null, avisos: [`altura leída «${v}»: fuera de ${RANGO_ALTURA[0]}–${RANGO_ALTURA[1]} cm, escríbela mirando la imagen`] };
}

// Une las tres lecturas por posición vertical. Prioridad de cifras: tira dedicada (B) si es plausible; si no, la lectura de la imagen entera (A).
export function construirFilas({ lineasA = [], lineasP = [], lineasH = [] }) {
  const filas = lineasA.map((l) => ({ y: l.y, h: l.h ?? 20, ...parseLinea(l.text), crudo: l.text, lP: null, lH: null }));
  const tol = Math.max(8, (filas.length ? filas.map((f) => f.h).sort((a, b) => a - b)[Math.floor(filas.length / 2)] : 20) * 0.6);
  const asigna = (lineas, campo) => {
    for (const l of lineas) {
      const v = parseNumero(l.text); if (v == null) continue;
      let best = null; for (const f of filas) { const d = Math.abs(f.y - l.y); if (d <= tol && (!best || d < best.d)) best = { f, d }; }
      if (best) best.f[campo] = v; else filas.push({ y: l.y, h: 20, nombre: '', dorsal: null, peso: null, altura: null, crudo: '', lP: campo === 'lP' ? v : null, lH: campo === 'lH' ? v : null });
    }
  };
  asigna(lineasP, 'lP'); asigna(lineasH, 'lH');
  filas.sort((a, b) => a.y - b.y);
  let omitidas = 0; const out = [];
  filas.forEach((f, i) => {
    const pB = f.lP != null ? juzgaPeso(f.lP) : null, pA = juzgaPeso(f.peso);
    const aB = f.lH != null ? juzgaAltura(f.lH) : null, aA = juzgaAltura(f.altura);
    const p = pB && pB.valor != null ? pB : pA.valor != null ? pA : (pB ?? pA);
    const a = aB && aB.valor != null && !aB.corregida ? aB : aA.valor != null && !aA.corregida ? aA : (aB && aB.valor != null ? aB : aA.valor != null ? aA : (aB ?? aA));
    const avisos = [...p.avisos, ...a.avisos];
    if (pA.valor != null && pB?.valor != null && pA.valor !== pB.valor) avisos.push(`el peso se leyó de dos formas (${String(pB.valor).replace('.', ',')} y ${String(pA.valor).replace('.', ',')}): se propone la de la columna`);
    if (aA.valor != null && aB?.valor != null && aA.valor !== aB.valor) avisos.push(`la altura se leyó de dos formas (${aB.valor} y ${aA.valor}): se propone la de la columna`);
    if (p.valor == null && a.valor == null && !p.avisos.length && !a.avisos.length) { omitidas++; return; }
    if (!f.nombre) avisos.push('sin nombre legible: escríbelo');
    out.push({ id: i, y: f.y, h: f.h, dorsal: f.dorsal, nombre: f.nombre, peso: p.valor, altura: a.valor, corregida: !!a.corregida, avisos });
  });
  return { filas: out, omitidas };
}

// Propuesta de jugador por nombre (acentos ignorados; nombre y apellido): único parecido alto → vincular; si no, crear jugador nuevo (alias = nombre de la imagen).
const compacto = (s) => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z]/g, '');
function distancia(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}
export async function proponerJugador(db, nombre) {
  const r = await findCandidates(db, nombre, { source: 'Excel' });
  let { candidates } = r; const { requiresManual } = r;
  // El OCR suele pegar o cambiar letras («SERGIPUIE» por «SERGI PUIG»): se añaden como parecido MEDIO los nombres a ≤ 2 letras de distancia sin espacios ni acentos.
  const c0 = compacto(nombre);
  if (c0.length >= 6) {
    const vistos = new Set(candidates.map((c) => c.player.id));
    for (const p of await db.players.toArray()) {
      if (vistos.has(p.id)) continue;
      const near = [p.jerseyName, p.fullName].filter(Boolean).some((n) => { const c1 = compacto(n); return c1.length >= 5 && distancia(c0, c1) <= 2; });
      if (near) candidates = [...candidates, { player: p, level: 'media', score: 0.7, why: 'nombre casi igual (letras mal leídas)', matches: [] }];
    }
  }
  const altas = candidates.filter((c) => c.level === 'alta');
  return { candidates, accion: altas.length === 1 && !requiresManual ? { tipo: 'vincular', playerId: altas[0].player.id } : { tipo: 'nuevo' } };
}

// Guarda las filas confirmadas. accion: {tipo:'vincular', playerId} | {tipo:'nuevo'} | {tipo:'omitir'}.
export async function guardarFilas(db, filas, { fecha, guardarPeso = true, guardarAltura = true }) {
  const res = { jugadoresNuevos: 0, pesosGuardados: 0, pesosCambiados: 0, alturasGuardadas: 0, alturasIgualesOmitidas: 0, omitidas: 0 };
  for (const f of filas) {
    if (!f.accion || f.accion.tipo === 'omitir') { res.omitidas++; continue; }
    let id = f.accion.playerId;
    if (f.accion.tipo === 'nuevo') { id = await createPlayer(db, { jerseyName: f.nombre, fullName: '' }); res.jugadoresNuevos++; }
    const peso = Number(String(f.peso ?? '').replace(',', '.')), alt = Number(String(f.altura ?? '').replace(',', '.'));
    if (guardarPeso && Number.isFinite(peso) && peso > 0) {
      const p = await db.players.get(id);
      if (p.referenceWeight && p.referenceWeight.unit === 'kg' && p.referenceWeight.value !== peso) res.pesosCambiados++;
      await setReferenceWeight(db, id, peso, 'kg'); res.pesosGuardados++;
    }
    if (guardarAltura && Number.isFinite(alt) && alt > 0) {
      const ya = (await db.anthropometry.where('playerId').equals(id).toArray()).some((r) => r.date === fecha && r.height?.value === alt && r.height?.unit === 'cm');
      if (ya) res.alturasIgualesOmitidas++; else { await addAnthropometry(db, { playerId: id, date: fecha, source: 'Imagen de antropometría', height: { value: alt, unit: 'cm' } }); res.alturasGuardadas++; }
    }
  }
  await audit(db, 'importacion-imagen-antropometria', { ...res, fecha });
  return res;
}
