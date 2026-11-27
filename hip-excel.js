// hip-excel.js — importación de la EXPLORACIÓN DE CADERA desde el Excel del usuario (27/11/2026, hoja «GENERICO.xlsx»).
//
// El libro tiene una cabecera de TRES filas con celdas combinadas:
//   fila 1: PLAYER | IMPIGMENT | HIP INTERNAL ROTATION | HIP EXTERNAL ROTATION | HIP FLEXION | BENT KNEE OVER
//   fila 2:                     SUPINE POSITION / PRONE POSITION (solo en las rotaciones)
//   fila 3:        LEFT / RIGHT en cada pareja (el Bent Knee Over no lo lleva: es un único valor bilateral)
// Una celda combinada llega con el valor SOLO en su esquina superior izquierda y el resto a null, así que las filas 1 y 2 se arrastran hacia la derecha
// hasta la siguiente cabecera. El fichero no trae fecha: se elige una para toda la importación, igual que en las cargas Iso-Hold.
//
// Lo que NO se hace: no se corrige ningún valor. La escala es 0 a 3 y solo enteros (decisión del usuario del 27/11/2026), así que un 4, un 0,5 o un texto
// desconocido se rechazan diciendo la fila y la columna. Una celda vacía es «no explorado», nunca 0. Un jugador cuya fila esté entera en blanco no se importa.
import { HIP_VARIABLES } from './catalogo-inicial.js';
import { ESCALA_IMPINGEMENT, escalaDe, validarValorEscala, HIP_TEST } from './hip.js';
import { addManualSession } from './alta-manual.js';
import { addAlias } from './jugadores.js';
import { audit } from './db.js';

const txt = (c) => (c === null || c === undefined ? '' : String(c).trim());
const lc = (c) => txt(c).toLowerCase();
const norm = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/gi, ' ').trim().toLowerCase();

// Grupos de la fila 1 y posturas de la fila 2, tal como los escribe el usuario (se admiten sus dos grafías de «impingement»).
const GRUPOS = [
  { re: /^(impig|imping)/i, grupo: 'impingement', conPostura: false, conLado: true },
  { re: /internal\s*rotation/i, grupo: 'rotacion-interna', conPostura: true, conLado: true },
  { re: /external\s*rotation/i, grupo: 'rotacion-externa', conPostura: true, conLado: true },
  { re: /flexion/i, grupo: 'flexion', conPostura: false, conLado: true },
  { re: /bent\s*knee/i, grupo: 'bent-knee-over', conPostura: false, conLado: false },
];
const POSTURAS = [{ re: /supin/i, postura: 'supina' }, { re: /pron/i, postura: 'prona' }];
const LADOS = [{ re: /^(left|izq)/i, side: 'L' }, { re: /^(right|der)/i, side: 'R' }];
// Grupo + postura → la clave de la variable del catálogo (HIP_VARIABLES).
const CLAVE = {
  'impingement': 'impingement',
  'rotacion-interna|supina': 'ri-supina', 'rotacion-interna|prona': 'ri-prona',
  'rotacion-externa|supina': 're-supina', 'rotacion-externa|prona': 're-prona',
  'flexion': 'flexion',
  'bent-knee-over': 'bent-knee-over',
};
export const nombreDeClave = (clave) => HIP_VARIABLES.find((v) => v.clave === clave)?.name ?? null;
const LADO_TXT = { L: 'izquierda', R: 'derecha', S: '' };

// Arrastra hacia la derecha el valor de una celda combinada hasta que aparece otra cabecera (las combinadas llegan como null).
const arrastrar = (fila, ancho) => {
  const out = []; let last = '';
  for (let c = 0; c < ancho; c++) { const v = txt(fila?.[c]); if (v) last = v; out.push(last); }
  return out;
};

// Lee la cabecera de tres filas y devuelve, por columna, qué variable y qué lado le corresponden.
export function columnasHip(grid) {
  const ancho = Math.max(...grid.slice(0, 6).map((r) => (r ?? []).length), 0);
  let fila1 = -1;
  for (let r = 0; r < Math.min(6, grid.length) && fila1 < 0; r++) {
    const fila = grid[r] ?? [];
    if (fila.some((x) => GRUPOS.some((g) => g.re.test(txt(x))))) fila1 = r;
  }
  if (fila1 < 0) return { ok: false, reason: 'No se reconoce la cabecera de la hoja: en las primeras filas no aparece ninguna de las columnas esperadas («IMPIGMENT», «HIP INTERNAL ROTATION», «HIP EXTERNAL ROTATION», «HIP FLEXION», «BENT KNEE OVER»).' };
  const g1 = arrastrar(grid[fila1], ancho);
  const g2 = arrastrar(grid[fila1 + 1], ancho);
  const r3 = grid[fila1 + 2] ?? [];
  // La fila de LEFT/RIGHT: la siguiente a la de posturas si la hay; si no, la propia fila 2.
  const filaLados = r3.some((x) => LADOS.some((l) => l.re.test(txt(x)))) ? fila1 + 2 : fila1 + 1;
  const lados = grid[filaLados] ?? [];
  const cols = [];
  for (let c = 0; c < ancho; c++) {
    const g = GRUPOS.find((x) => x.re.test(g1[c] ?? ''));
    if (!g) continue;
    const postura = g.conPostura ? POSTURAS.find((p) => p.re.test(g2[c] ?? ''))?.postura ?? null : null;
    if (g.conPostura && !postura) continue; // una rotación sin postura reconocida no se puede asignar: se avisa más abajo
    const side = g.conLado ? LADOS.find((l) => l.re.test(txt(lados[c])))?.side ?? null : 'S';
    if (!side) continue;
    const clave = CLAVE[g.conPostura ? `${g.grupo}|${postura}` : g.grupo];
    const nombre = nombreDeClave(clave);
    if (!clave || !nombre) continue;
    cols.push({ col: c, clave, nombre, side, etiqueta: `${nombre}${side === 'S' ? '' : ` · ${LADO_TXT[side]}`}` });
  }
  if (!cols.length) return { ok: false, reason: 'Se ha encontrado la cabecera, pero ninguna columna se puede asignar a una variable del test «Hip». Revisa que las rotaciones lleven «SUPINE POSITION» / «PRONE POSITION» y las parejas «LEFT» / «RIGHT».' };
  // Columna de jugadores: la que dice PLAYER en la fila 1, y si no, la primera que no sea de datos.
  const usadas = new Set(cols.map((x) => x.col));
  const porNombre = g1.findIndex((x) => /player|jugador|nombre/i.test(x ?? ''));
  const nameCol = porNombre >= 0 && !usadas.has(porNombre) ? porNombre : [0, 1, 2].find((c) => !usadas.has(c)) ?? 0;
  return { ok: true, fila1, filaLados, nameCol, cols, primeraFila: Math.max(fila1 + 2, filaLados) + 1 };
}

// Un valor de celda → número de la escala, o el motivo por el que no vale. No se redondea nada.
export function valorDeCelda(raw, escala) {
  if (raw === null || raw === undefined || txt(raw) === '') return { vacio: true };
  if (escala === ESCALA_IMPINGEMENT) {
    const t = lc(raw);
    if (t === '+' || t === '1' || /^posi/.test(t)) return { valor: 1 };
    if (t === '✓' || t === '✔' || t === '0' || /^nega/.test(t)) return { valor: 0 };
    return { razon: `valor no reconocido («${txt(raw)}»): se espera «+» para positivo o «✓» para negativo` };
  }
  const n = typeof raw === 'number' ? raw : Number(txt(raw).replace(',', '.'));
  const v = validarValorEscala(escala, n);
  return v.ok ? { valor: v.valor } : { razon: `«${txt(raw)}»: ${v.razon}` };
}

// Lee la hoja entera. Devuelve una fila por jugador con sus valores y, aparte, las incidencias de cada celda que no se ha podido leer.
export function parseHipSheet(rows) {
  const grid = Array.isArray(rows) ? rows : [];
  const cab = columnasHip(grid);
  if (!cab.ok) return { ...cab, filas: [] };
  const escalaDeClave = (clave) => escalaDe(HIP_VARIABLES.find((v) => v.clave === clave));
  const filas = [];
  for (let r = cab.primeraFila; r < grid.length; r++) {
    const fila = grid[r] ?? [];
    const name = txt(fila[cab.nameCol]);
    if (!name) continue;
    const valores = {}; const incidencias = []; let conDato = 0;
    for (const c of cab.cols) {
      const res = valorDeCelda(fila[c.col], escalaDeClave(c.clave));
      if (res.vacio) continue;
      if (res.razon) { incidencias.push(`${c.etiqueta}: ${res.razon}`); continue; }
      if (!valores[c.clave]) valores[c.clave] = {};
      valores[c.clave][c.side] = res.valor;
      conDato++;
    }
    filas.push({ name, valores, incidencias, conDato, vacia: conDato === 0, rowNumber: r + 1 });
  }
  return { ok: true, fila1: cab.fila1, nameCol: cab.nameCol, cols: cab.cols, filas };
}

// El test «Hip» del catálogo, con sus variables por clave. Devuelve null si todavía no está (catálogo antiguo).
export function testHip(catalog) {
  const test = catalog.tests.find((t) => !t.archived && norm(t.name) === norm(HIP_TEST) && (t.blockKey ?? '') === 'nme') ?? null;
  if (!test) return null;
  const porClave = {};
  for (const def of HIP_VARIABLES) {
    const v = catalog.variables.find((x) => x.testId === test.id && !x.archived && norm(x.name) === norm(def.name));
    if (v) porClave[def.clave] = v;
  }
  return { test, porClave };
}

// Guarda las valoraciones elegidas. items: [{ name, playerId (null = omitir), valores, nota, remember }].
// Cada jugador genera UNA sesión del test «Hip» con la fecha elegida; las duplicadas (mismo jugador, test, fecha y hora) se omiten sin error.
export async function commitHip(db, { catalog, date, items, nota = '' }) {
  const res = { creadas: 0, duplicadas: 0, omitidas: 0, alias: 0, incidencias: [] };
  const hip = testHip(catalog);
  if (!hip) { res.incidencias.push('El test «Hip» no está en el catálogo: abre «Catálogo de tests» para que se cree y vuelve a intentarlo.'); return res; }
  const vistos = new Set();
  for (const it of items) {
    if (!it.playerId) { res.omitidas++; continue; }
    if (vistos.has(it.playerId)) { res.incidencias.push(`«${it.name}»: el jugador aparece dos veces en el Excel; solo se importa la primera fila.`); res.omitidas++; continue; }
    vistos.add(it.playerId);
    const valores = {};
    for (const [clave, porLado] of Object.entries(it.valores ?? {})) {
      const v = hip.porClave[clave];
      if (!v) { res.incidencias.push(`«${it.name}»: la variable «${nombreDeClave(clave)}» no está en el catálogo; esa columna no se importa.`); continue; }
      valores[v.id] = porLado;
    }
    if (!Object.keys(valores).length) { res.omitidas++; continue; }
    try {
      await addManualSession(db, { playerId: it.playerId, testId: hip.test.id, date, time: '', valores, nota: String(it.nota ?? nota ?? '').trim() });
      res.creadas++;
      if (it.remember) { try { await addAlias(db, it.playerId, 'Excel', it.name); res.alias++; } catch { /* alias ya existente o en conflicto: no impide la importación */ } }
    } catch (e) {
      if (/Ya hay una sesión/.test(e.message)) res.duplicadas++;
      else { res.incidencias.push(`«${it.name}»: ${e.message}`); res.omitidas++; }
    }
  }
  await audit(db, 'importacion-hip', { testId: hip.test.id, date, creadas: res.creadas, duplicadas: res.duplicadas, omitidas: res.omitidas });
  return res;
}

// Abreviaturas para el resumen de una fila en la pantalla de importación (la tabla no cabe con los trece nombres completos).
export const ABREV = { 'impingement': 'IMP', 'ri-supina': 'RI sup', 'ri-prona': 'RI pron', 're-supina': 'RE sup', 're-prona': 'RE pron', 'flexion': 'FLEX', 'bent-knee-over': 'BKO' };
export function resumenFila(valores) {
  const partes = [];
  for (const def of HIP_VARIABLES) {
    const v = valores?.[def.clave];
    if (!v) continue;
    const esIm = def.escala === ESCALA_IMPINGEMENT;
    const uno = (x) => (x === undefined ? '·' : esIm ? (x === 1 ? '+' : '✓') : String(x));
    partes.push(`${ABREV[def.clave]} ${def.sides === 'LR' ? `${uno(v.L)}/${uno(v.R)}` : uno(v.S)}`);
  }
  return partes.join(' · ');
}
