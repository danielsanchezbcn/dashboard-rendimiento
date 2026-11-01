// db.js — base de datos local (IndexedDB mediante Dexie), ajustes, auditoría y estado local.
//
// Tablas de la fase 1b:
//   settings  ajustes definidos por el usuario                (va en la copia)
//   auditLog  registro de acciones, sin valores de datos      (va en la copia)
//   meta      metadatos de la base                            (va en la copia)
//   local     estado propio de este navegador (última copia, carpeta recordada…)  (NO va en la copia)
// Las tablas de jugadores, catálogo, sesiones, etc. se añadirán en fases posteriores con nuevas versiones del esquema.

import { Dexie } from '../vendor/libs.js';

export const APP_VERSION = '1b-0.1.0';
export const DB_NAME = 'dashboard-rendimiento';
export const NON_BACKUP_TABLES = ['local'];

export function createDb(name = DB_NAME) {
  const db = new Dexie(name);
  db.version(1).stores({
    settings: 'key',
    auditLog: '++id, timestamp, action',
    meta: 'key',
    local: 'key',
  });
  return db;
}

export async function initDb(db) {
  await db.open();
  if (!(await db.meta.get('createdAt'))) {
    await db.meta.put({ key: 'createdAt', value: new Date().toISOString() });
    await audit(db, 'base-creada', { versionApp: APP_VERSION, versionEsquema: db.verno });
  }
  return db;
}

// ---- Estado local del navegador (no se incluye en las copias) ----
export const getLocal = async (db, key) => (await db.local.get(key))?.value;
export const setLocal = (db, key, value) => db.local.put({ key, value });

// ---- Ajustes definidos por el usuario ----
export const getSetting = async (db, key) => (await db.settings.get(key))?.value;
export async function setSetting(db, key, value) {
  await db.settings.put({ key, value, definedByUser: true, updatedAt: new Date().toISOString() });
  await audit(db, 'ajuste-modificado', { clave: key });
}
export async function clearSetting(db, key) {
  await db.settings.delete(key);
  await audit(db, 'ajuste-eliminado', { clave: key });
}

// ---- Auditoría: acción, alcance y recuentos; nunca valores de datos eliminados ----
export function audit(db, action, scope = {}, reason = '') {
  return db.auditLog.add({ timestamp: new Date().toISOString(), action, scope, reason });
}

// ---- Almacenamiento del navegador ----
export async function requestPersistence(db) {
  const out = { disponible: !!navigator.storage?.persist, comprobadoEl: new Date().toISOString() };
  if (out.disponible) {
    out.antes = await navigator.storage.persisted();
    out.respuesta = out.antes ? true : await navigator.storage.persist();
    out.persistente = await navigator.storage.persisted();
  } else {
    out.persistente = false;
  }
  await setLocal(db, 'persistence', out);
  return out;
}

export async function storageEstimate() {
  if (!navigator.storage?.estimate) return null;
  const e = await navigator.storage.estimate();
  return { usage: e.usage ?? 0, quota: e.quota ?? 0 };
}
