// excel.js — lectura de ficheros Excel (.xlsx) y CSV a una cuadrícula de filas y huella SHA-256 del fichero.
// Todo ocurre en el navegador: el fichero no sale del equipo. No se interpretan fórmulas: se lee el valor guardado en la celda.

import { readXlsx } from './libs.js';

export const MAX_FILE_BYTES = 25 * 1024 * 1024;

export async function sha256OfBuffer(buffer) {
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Divide un texto CSV respetando comillas. Detecta el separador (;, tabulador o coma) por la primera línea.
export function parseCsv(text) {
  const src = String(text ?? '').replace(/^﻿/, '');
  const firstLine = src.split(/\r?\n/, 1)[0] ?? '';
  const counts = [';', '\t', ','].map((d) => [d, firstLine.split(d).length - 1]).sort((x, y) => y[1] - x[1]);
  const delimiter = counts[0][1] > 0 ? counts[0][0] : ',';
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') { cell += '"'; i++; } else if (ch === '"') quoted = false; else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === delimiter) { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      rows.push(row); row = [];
    } else cell += ch;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return { rows: rows.map((r) => r.map((c) => (c === '' ? null : c))), delimiter };
}

// Devuelve { sheets: [{ name, rows }], kind, hash, size }. Lanza un error comprensible si el fichero no se puede leer.
export async function readFileGrid(file) {
  if (!file) throw new Error('No se ha elegido ningún fichero.');
  if (file.size > MAX_FILE_BYTES) throw new Error(`El fichero ocupa ${(file.size / 1048576).toFixed(1).replace('.', ',')} MB; el límite es ${MAX_FILE_BYTES / 1048576} MB.`);
  const buffer = await (file.arrayBuffer ? file.arrayBuffer() : new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(r.error); r.readAsArrayBuffer(file); }));
  const hash = await sha256OfBuffer(buffer);
  const name = String(file.name ?? '');
  if (/\.csv$/i.test(name) || /\.txt$/i.test(name)) {
    const { rows, delimiter } = parseCsv(new TextDecoder('utf-8').decode(buffer));
    return { sheets: [{ name: 'CSV', rows }], kind: 'csv', delimiter, hash, size: file.size };
  }
  if (/\.xls$/i.test(name)) throw new Error('El formato .xls antiguo no se admite: guárdalo como .xlsx (Archivo → Guardar como) y vuelve a elegirlo.');
  let sheets;
  try {
    const result = await readXlsx(new Blob([buffer]));
    sheets = result.map((s) => ({ name: s.sheet ?? s.name, rows: s.data }));
  } catch (e) {
    throw new Error(`No se pudo leer el fichero como Excel (.xlsx): ${e?.message || e}`);
  }
  if (!sheets.length) throw new Error('El libro no tiene hojas.');
  return { sheets, kind: 'xlsx', hash, size: file.size };
}
