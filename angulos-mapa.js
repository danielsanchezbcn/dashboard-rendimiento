// angulos-mapa.js — destino en el catálogo de las medidas de ángulos de la herramienta «Medir ángulos» (angulos.html).
// Para añadir un nuevo test de ángulos: (1) registrarlo en la herramienta (angulos-test-xxx.js), (2) crear su test y variables en el bloque NME
// del catálogo y (3) añadir aquí una entrada en ANGULOS_DESTINOS con qué salida de la herramienta va a qué variable y lado. Ver ANGULOS.md.
// Las fotos nunca se guardan: solo los ángulos (grados, redondeados a 1 decimal, como se muestran).
import { audit } from './db.js';
import { isIsoDay } from './fechas.js';

const lc = (x) => String(x ?? '').trim().toLowerCase();
const r1 = (x) => Math.round(x * 10) / 10;

// «salidas»: clave de la herramienta (prefijo-lado) → [nombre de la variable en el catálogo, lado L/R/S].
// «derivadas»: variables que se calculan al guardar a partir de las salidas (misma fórmula que el Excel del usuario).
export const ANGULOS_DESTINOS = {
  jurdan: {
    test: 'Jurdan Test',
    salidas: {
      'shin-left': ['JURDAN HAMS (SHIN ANGLE = TIBIA vs HORIZONTAL)', 'L'], 'shin-right': ['JURDAN HAMS (SHIN ANGLE = TIBIA vs HORIZONTAL)', 'R'],
      'thigh-left': ['JURDAN PSOAS (THIGH ANGLE = FÉMUR vs HORIZONTAL)', 'L'], 'thigh-right': ['JURDAN PSOAS (THIGH ANGLE = FÉMUR vs HORIZONTAL)', 'R'],
      'rf-left': ['JURDAN RECTUS FEMORIS (FÉMUR vs TIBIA)', 'L'], 'rf-right': ['JURDAN RECTUS FEMORIS (FÉMUR vs TIBIA)', 'R'],
    },
    // JURDAN RESULTS: izquierda = Hams izq − Psoas der («LEFT SHIN vs RIGHT THIGH»); derecha = Hams der − Psoas izq («RIGHT SHIN vs LEFT THIGH»)
    derivadas: [
      { variable: 'JURDAN RESULTS', lado: 'L', resta: ['shin-left', 'thigh-right'] },
      { variable: 'JURDAN RESULTS', lado: 'R', resta: ['shin-right', 'thigh-left'] },
    ],
  },
};

export const hayDestino = (testKey) => !!ANGULOS_DESTINOS[testKey];

// Convierte los resultados de la herramienta ({ 'shin-left': 74.5, … }) en valores del catálogo.
// Devuelve { test, values: {variableId: {L,R,S}}, filas: [{variable, L, R}], faltan: [claves sin valor] }. Pura: no toca la base.
export function mapearAngulos(testKey, results, catalog) {
  const dest = ANGULOS_DESTINOS[testKey];
  if (!dest) return { error: 'Este test de la herramienta todavía no tiene destino en el catálogo (ver ANGULOS.md).' };
  const test = catalog.tests.find((t) => lc(t.name) === lc(dest.test) && !t.archived);
  if (!test) return { error: `No existe el test «${dest.test}» en el catálogo.` };
  const vars = catalog.variables.filter((v) => v.testId === test.id && !v.archived);
  const byName = (n) => vars.find((v) => lc(v.name) === lc(n));
  const values = {}; const faltan = [];
  const put = (name, side, x) => { const v = byName(name); if (!v) throw new Error(`Falta la variable «${name}» en el test «${test.name}».`); (values[v.id] ??= {})[side] = x; };
  const val = (k) => (Number.isFinite(results?.[k]) ? r1(results[k]) : null);
  for (const [k, [name, side]] of Object.entries(dest.salidas)) { const x = val(k); if (x === null) faltan.push(k); else put(name, side, x); }
  for (const d of dest.derivadas ?? []) {
    const [a, b] = d.resta.map(val);
    if (a === null || b === null) { if (!faltan.includes(d.variable + '-' + d.lado)) faltan.push(d.variable + '-' + d.lado); continue; }
    put(d.variable, d.lado, r1(a - b));
  }
  const filas = [];
  for (const v of vars) if (values[v.id]) filas.push({ variable: v.name, unit: v.unit, L: values[v.id].L ?? null, R: values[v.id].R ?? null });
  return { test, values, filas, faltan };
}

// Guarda UNA sesión del test con los valores medidos. No sobrescribe: si ya hay una del mismo jugador, test, fecha y hora, avisa.
export async function guardarAngulos(db, { playerId, testKey, results, date, time = '', catalog }) {
  const player = await db.players.get(playerId);
  if (!player) throw new Error('Elige un jugador.');
  const m = mapearAngulos(testKey, results, catalog);
  if (m.error) throw new Error(m.error);
  if (m.faltan.length) throw new Error('Faltan medidas: carga y marca las dos fotos hasta que todas las medidas tengan valor.');
  const d = String(date ?? '').trim(); const t = String(time ?? '').trim();
  if (!isIsoDay(d)) throw new Error('La fecha no es válida (AAAA-MM-DD).');
  if (t && !/^([01]\d|2[0-3]):[0-5]\d$/.test(t)) throw new Error('La hora no es válida (HH:MM).');
  const clash = (await db.sessions.where('playerId').equals(playerId).toArray()).find((s) => s.testId === m.test.id && s.date === d && (s.time ?? '') === t);
  if (clash) throw new Error('Ya hay una sesión de ese jugador y test en esa fecha y hora. Indica otra hora o corrígela desde su tabla de sesiones.');
  const id = await db.sessions.add({ playerId, testId: m.test.id, protocolId: null, date: d, time: t, values: m.values, reps: { total: 1, assumed: true }, status: 'valid', excludedReason: '', source: 'angulos', createdAt: new Date().toISOString(), ...(player.synthetic ? { synthetic: 1 } : {}) });
  await audit(db, 'sesion-angulos', { sessionId: id, playerId, testId: m.test.id, date: d });
  return { id, filas: m.filas };
}
