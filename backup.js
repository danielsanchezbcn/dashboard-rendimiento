// backup.js — copia completa (JSON, con gzip y cifrado opcionales), validación y restauración.
// La lista de tablas se obtiene del esquema de la base: las tablas que se añadan en fases posteriores
// entran automáticamente en la copia (salvo las de NON_BACKUP_TABLES).

import { NON_BACKUP_TABLES, audit } from './db.js';
import { seedInitialCatalog } from './catalogo-inicial.js';
import { collapsePositions } from './posiciones.js';

export const FORMAT_ID = 'dashboard-rendimiento-backup';
export const ENVELOPE_ID = 'dashboard-rendimiento-backup-envelope';
export const FORMAT_VERSION = 1;
export const PBKDF2_ITERATIONS = 600000;

export const backupTableNames = (db) =>
  db.tables.map((t) => t.name).filter((n) => !NON_BACKUP_TABLES.includes(n)).sort();

export async function readSnapshot(db) {
  const names = backupTableNames(db);
  const tables = {};
  await db.transaction('r', names.map((n) => db.table(n)), async () => {
    for (const n of names) tables[n] = await db.table(n).toArray();
  });
  return tables;
}

export const countTables = (tables) => Object.fromEntries(Object.keys(tables).sort().map((n) => [n, tables[n].length]));

// Los campos con valor undefined se omiten, igual que hace JSON.stringify: si no, una copia con un campo undefined cambiaría de suma de verificación
// al guardarse y leerse (JSON los pierde) y se avisaría de un fichero «dañado» sin estarlo.
export function canonicalStringify(v) {
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return '[' + v.map((x) => canonicalStringify(x) ?? 'null').join(',') + ']';
  const partes = [];
  for (const k of Object.keys(v).sort()) { const s = canonicalStringify(v[k]); if (s !== undefined) partes.push(JSON.stringify(k) + ':' + s); }
  return '{' + partes.join(',') + '}';
}

export async function sha256Hex(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export const checksumTables = (tables) => sha256Hex(canonicalStringify(tables));

export async function buildBackup(db, appVersion, createdAt = new Date().toISOString()) {
  const tables = await readSnapshot(db);
  return {
    formatId: FORMAT_ID,
    formatVersion: FORMAT_VERSION,
    schemaVersion: db.verno,
    appVersion,
    createdAt,
    counts: countTables(tables),
    checksum: await checksumTables(tables),
    tables,
  };
}

// Migraciones de copias antiguas al esquema actual: { desde: n, aplicar(tables) }. De momento no hay ninguna.
export const BACKUP_MIGRATIONS = [];

export function migrateTables(tables, fromVersion, toVersion) {
  let current = tables;
  for (let v = fromVersion; v < toVersion; v++) {
    const m = BACKUP_MIGRATIONS.find((x) => x.desde === v);
    if (m) current = m.aplicar(current);
  }
  return current;
}

export async function validateBackup(db, inner) {
  const errors = [];
  const warnings = [];
  if (!inner || typeof inner !== 'object') return { ok: false, errors: ['El fichero no es una copia válida.'], warnings };
  if (inner.formatId !== FORMAT_ID) errors.push('Identificador de formato desconocido: no es una copia de esta aplicación.');
  if (!Number.isInteger(inner.formatVersion) || inner.formatVersion > FORMAT_VERSION) errors.push('Versión de formato no soportada por esta aplicación.');
  if (!Number.isInteger(inner.schemaVersion) || inner.schemaVersion < 1) errors.push('Versión de esquema no válida.');
  else if (inner.schemaVersion > db.verno) errors.push(`La copia es de una versión de esquema (${inner.schemaVersion}) posterior a la de esta aplicación (${db.verno}). Actualiza la aplicación antes de restaurarla.`);
  if (!inner.tables || typeof inner.tables !== 'object') {
    errors.push('Faltan las tablas de datos.');
    return { ok: false, errors, warnings };
  }
  const known = backupTableNames(db);
  for (const name of Object.keys(inner.tables)) {
    if (!known.includes(name)) errors.push(`La copia contiene una tabla desconocida: «${name}».`);
    else if (!Array.isArray(inner.tables[name])) errors.push(`La tabla «${name}» no es una lista.`);
  }
  for (const name of known) {
    if (!(name in inner.tables)) {
      if (inner.schemaVersion < db.verno) warnings.push(`La copia no incluye la tabla «${name}» (se creó con una versión anterior): quedará vacía.`);
      else errors.push(`Falta la tabla «${name}».`);
    }
  }
  if (errors.length) return { ok: false, errors, warnings };
  const counts = countTables(inner.tables);
  for (const name of Object.keys(counts)) {
    if (inner.counts?.[name] !== counts[name]) errors.push(`El recuento de «${name}» no coincide (${inner.counts?.[name]} declarado, ${counts[name]} real).`);
  }
  if ((await checksumTables(inner.tables)) !== inner.checksum) errors.push('La suma de verificación no coincide: el fichero está dañado o ha sido modificado.');
  return {
    ok: errors.length === 0,
    errors,
    warnings,
    summary: { createdAt: inner.createdAt, appVersion: inner.appVersion, schemaVersion: inner.schemaVersion, counts },
  };
}

const sameRows = (a, b) => {
  if (a.length !== b.length) return false;
  const x = a.map(canonicalStringify).sort();
  const y = b.map(canonicalStringify).sort();
  return x.every((v, i) => v === y[i]);
};

// Reemplazo atómico: todo o nada. Dentro de la misma transacción se vuelve a leer lo escrito y se compara con
// la copia; si algo falla o no coincide, la transacción se revierte y los datos actuales quedan intactos.
export async function restoreBackup(db, inner) {
  const tables = migrateTables(inner.tables, inner.schemaVersion, db.verno);
  const names = backupTableNames(db);
  const before = countTables(await readSnapshot(db));
  await db.transaction('rw', names.map((n) => db.table(n)), async () => {
    for (const n of names) {
      const t = db.table(n);
      await t.clear();
      const rows = tables[n] ?? [];
      if (rows.length) await t.bulkPut(rows);
    }
    for (const n of names) {
      const written = await db.table(n).toArray();
      if (!sameRows(tables[n] ?? [], written)) throw new Error(`La verificación posterior a la restauración no coincide en «${n}»: se ha revertido y los datos actuales no se han modificado.`);
    }
  });
  // Una copia anterior al esquema 3 no trae el catálogo: se añade el catálogo inicial (nunca sobre un catálogo ya existente).
  const catalogo = await seedInitialCatalog(db);
  await collapsePositions(db); // copias con posiciones fechadas: se pasan al modelo sin fechas
  const after = countTables(await readSnapshot(db));
  await audit(db, 'copia-restaurada', { fechaCopia: inner.createdAt, versionEsquemaCopia: inner.schemaVersion, recuentosAntes: before, recuentosCopia: inner.counts });
  return { before, after, verificado: true, catalogoInicialAnadido: !!catalogo.sembrado };
}

// ---------- Codificación (gzip y cifrado opcionales) ----------

export function bytesToB64(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
export function b64ToBytes(b64) {
  const s = atob(b64);
  const bytes = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i);
  return bytes;
}
async function pipeBytes(bytes, transform) {
  return new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(transform)).arrayBuffer());
}
const gzipBytes = (b) => pipeBytes(b, new CompressionStream('gzip'));
const gunzipBytes = (b) => pipeBytes(b, new DecompressionStream('gzip'));

async function deriveKey(password, salt, iterations) {
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, material, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

export async function encodeBackup(inner, { gzip = false, password = '' } = {}) {
  const json = JSON.stringify(inner);
  if (!gzip && !password) return { blob: new Blob([json], { type: 'application/json' }), gzip: false, encrypted: false };
  let bytes = new TextEncoder().encode(json);
  if (gzip) bytes = await gzipBytes(bytes);
  const envelope = { formatId: ENVELOPE_ID, formatVersion: 1, compression: gzip ? 'gzip' : 'none', encrypted: !!password };
  if (password) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await deriveKey(password, salt, PBKDF2_ITERATIONS);
    const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, bytes));
    Object.assign(envelope, { kdf: { name: 'PBKDF2', hash: 'SHA-256', iterations: PBKDF2_ITERATIONS }, cipher: 'AES-GCM-256', salt: bytesToB64(salt), iv: bytesToB64(iv), payload: bytesToB64(cipher) });
  } else {
    envelope.payload = bytesToB64(bytes);
  }
  return { blob: new Blob([JSON.stringify(envelope)], { type: 'application/json' }), gzip, encrypted: !!password };
}

export function parseBackupText(text) {
  try {
    return JSON.parse(text);
  } catch {
    throw Object.assign(new Error('El fichero no es JSON válido.'), { code: 'NOT_JSON' });
  }
}

export async function decodeBackupObject(obj, password = '') {
  if (obj?.formatId !== ENVELOPE_ID) return { inner: obj, encrypted: false, compression: 'none' };
  let bytes;
  if (obj.encrypted) {
    if (!password) throw Object.assign(new Error('El fichero está cifrado: escribe la contraseña.'), { code: 'PASSWORD_REQUIRED' });
    const key = await deriveKey(password, b64ToBytes(obj.salt), obj.kdf?.iterations ?? PBKDF2_ITERATIONS);
    try {
      bytes = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64ToBytes(obj.iv) }, key, b64ToBytes(obj.payload)));
    } catch {
      throw Object.assign(new Error('Contraseña incorrecta o fichero dañado.'), { code: 'BAD_PASSWORD' });
    }
  } else {
    bytes = b64ToBytes(obj.payload);
  }
  if (obj.compression === 'gzip') bytes = await gunzipBytes(bytes);
  return { inner: JSON.parse(new TextDecoder().decode(bytes)), encrypted: !!obj.encrypted, compression: obj.compression ?? 'none' };
}

export function backupFileName(now = new Date(), { gzip = false, encrypted = false } = {}) {
  const p = (n) => String(n).padStart(2, '0');
  const stamp = `${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}-${p(now.getHours())}${p(now.getMinutes())}`;
  return `dashboard-copia-${stamp}${gzip ? '-gzip' : ''}${encrypted ? '-cifrada' : ''}.json`;
}
