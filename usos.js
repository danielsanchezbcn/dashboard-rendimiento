// usos.js — qué partes del dashboard localizan un test (o una variable) POR SU NOMBRE, y comprobación de que todas lo encuentran en el catálogo real.
// El nombre es la única unión entre el código y el catálogo: si el usuario renombra un test al que el código llama por su nombre, ese cuadro deja de
// encontrarlo y el jugador ve «sin datos» sin ningún error. Aquí se centraliza el inventario, para avisar antes de renombrar (Catálogo) y para
// comprobarlo cuando se quiera (Ajustes). Creado el 14/11/2026 tras perderse las referencias del calf raise al renombrarlo.
import { mismoTest, normTestName } from './nombres.js';
import { TESTS_RELACIONES, DSI_TESTS, EUR_TESTS, ANKLE_TESTS, HIP_TESTS, DJ_TESTS } from './relaciones.js';
import { RADAR_PROFILES } from './radar.js';
import { NATERA } from './natera.js';
import { PREMIER_REFERENCES } from './premier.js';
import { ISO_PAIRS, RM12_TESTS } from './isohold.js';
import { CUALIDADES, T as CT } from './composite.js';

const lc = (s) => String(s ?? '').trim().toLowerCase();

// Inventario: [parte del dashboard, nombre del test, nombre de la variable (o null si solo necesita el test)].
export function inventarioNombres() {
  const out = [];
  const add = (quien, test, variable = null) => { if (test) out.push({ quien, test, variable }); };
  for (const [test, variable] of TESTS_RELACIONES) add('Relaciones (DSI, EUR, ORZ y ratios)', test, variable);
  for (const n of DSI_TESTS) add('cuadro del DSI', n);
  for (const n of EUR_TESTS) add('cuadro del EUR', n);
  for (const n of [...ANKLE_TESTS, ...HIP_TESTS]) add('ratio de tobillo / cadera', n);
  for (const n of DJ_TESTS) add('cuadro de la ORZ', n);
  for (const p of RADAR_PROFILES) for (const a of p.axes) add('radar', p.test, a.variable);
  for (const n of NATERA) add('referencias de Natera', n.test);
  for (const r of PREMIER_REFERENCES) for (const t of r.tests) add('referencias de la Premier League', t, r.variable);
  for (const [hold, push] of Object.entries(ISO_PAIRS)) { add('emparejamiento iso-hold / iso-push', hold); add('emparejamiento iso-hold / iso-push', push); }
  for (const n of RM12_TESTS) add('estimación de 1RM', n);
  for (const c of CUALIDADES) {
    const mete = (d) => {
      if (d && !d.tipo) { if (d.orz) { add('COMPOSITE PROFILE SCORE', CT.dj30, d.variable); add('COMPOSITE PROFILE SCORE', CT.dj45, d.variable); } else add('COMPOSITE PROFILE SCORE', d.test, d.variable); }
      (d?.interp ?? []).forEach(mete);
    };
    c.scores.forEach(mete); c.interp.forEach(mete);
  }
  return out;
}

// Partes del dashboard que localizan ESTE test por su nombre (para avisar antes de renombrarlo). Sin repetir y en orden alfabético.
export function usosDeTest(nombre) {
  return [...new Set(inventarioNombres().filter((u) => mismoTest(u.test, nombre)).map((u) => u.quien))].sort((a, b) => a.localeCompare(b, 'es'));
}

// ¿El nombre nuevo es el mismo para el dashboard? Quitar «Run-Specific», cambiar «Single-Leg» por «SL» o «Double-Leg» por «DL», las mayúsculas,
// los acentos y los espacios de más no cambian nada; cualquier otra cosa sí.
export const renombradoSeguro = (viejo, nuevo) => mismoTest(viejo, nuevo);

// Comprobación contra el catálogo REAL del usuario: devuelve los problemas encontrados, cada uno con su motivo. Lista vacía = todo en su sitio.
export function comprobarNombres(catalog) {
  const tests = (catalog?.tests ?? []).filter((t) => !t.archived);
  const vars = (catalog?.variables ?? []).filter((v) => !v.archived);
  const problemas = [];
  const testDe = (n) => tests.find((t) => mismoTest(t.name, n)) ?? null;
  // 1) Lo que el código busca y no está
  const vistos = new Set();
  for (const u of inventarioNombres()) {
    const clave = `${lc(u.test)}|${lc(u.variable ?? '')}`;
    if (vistos.has(clave)) continue;
    vistos.add(clave);
    const t = testDe(u.test);
    if (!t) {
      const k2 = `t:${u.quien}|${lc(u.test)}`; // un test que falta se nombra una vez por cuadro, aunque este le pida varias variables
      if (!vistos.has(k2)) { vistos.add(k2); problemas.push({ tipo: 'test', quien: u.quien, test: u.test, detalle: 'no hay ningún test con ese nombre en el catálogo' }); }
      continue;
    }
    if (u.variable && !vars.some((v) => v.testId === t.id && lc(v.name) === lc(u.variable))) problemas.push({ tipo: 'variable', quien: u.quien, test: t.name, variable: u.variable, detalle: 'el test existe, pero no tiene esa variable' });
  }
  // 2) Dos tests que para el dashboard son el mismo: las búsquedas por nombre se quedarían con el primero
  const porClave = new Map();
  for (const t of tests) { const k = lc(t.name).normalize('NFD').replace(/[̀-ͯ]/g, ''); porClave.set(k, [...(porClave.get(k) ?? []), t.name]); }
  for (const [, nombres] of porClave) if (nombres.length > 1) problemas.push({ tipo: 'duplicado', detalle: `dos tests con el mismo nombre: ${nombres.join(' / ')}` });
  const porNorm = new Map();
  for (const t of tests) { const k = normTestName(t.name); porNorm.set(k, [...(porNorm.get(k) ?? []), t.name]); }
  for (const [, nombres] of porNorm) if (nombres.length > 1 && new Set(nombres.map((n) => n.toLowerCase())).size > 1) problemas.push({ tipo: 'equivalente', detalle: `para el dashboard son el mismo test: ${nombres.join(' / ')}` });
  // 3) Dos variables con el mismo nombre dentro de un test
  for (const t of tests) {
    const m = new Map();
    for (const v of vars.filter((x) => x.testId === t.id)) m.set(lc(v.name), [...(m.get(lc(v.name)) ?? []), v.name]);
    for (const [, nombres] of m) if (nombres.length > 1) problemas.push({ tipo: 'duplicado', test: t.name, detalle: `dos variables con el mismo nombre: ${nombres.join(' / ')}` });
  }
  return problemas;
}
