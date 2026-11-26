// db.js — base de datos local (IndexedDB mediante Dexie), ajustes, auditoría y estado local.
//
// Tablas de la fase 1b (esquema 1) y de la fase 1c (esquema 2, ver createDb):
//   settings  ajustes definidos por el usuario                (va en la copia)
//   auditLog  registro de acciones, sin valores de datos      (va en la copia)
//   meta      metadatos de la base                            (va en la copia)
//   local     estado propio de este navegador (última copia, carpeta recordada…)  (NO va en la copia)
//   players, playerAliases, positions, playerPositions, anthropometry  (van en la copia)
// Fase 2 (esquema 3): blocks, manifestations, zones, tests, protocols, variables, formulaHistory (catálogo; van en la copia).
// Fase 3 (esquema 4): sessions (una fila por sesión, D8), importBatches (lotes de importación), importMappings (mapeos guardados).
// Las repeticiones sueltas, referencias, etc. se añadirán en fases posteriores con nuevas versiones del esquema.

import { Dexie } from './libs.js';

export const APP_VERSION = '10i-0.18.0';
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
  // Esquema 2 (fase 1c): jugadores, alias por fuente, posiciones con historial y antropometría fechada.
  // «synthetic» vale 1 solo en los registros sintéticos (los booleanos no se pueden indexar).
  db.version(2).stores({
    players: '++id, jerseyName, synthetic',
    playerAliases: '++id, playerId, source, normalizedKey, synthetic',
    positions: '++id, name, order, synthetic',
    playerPositions: '++id, playerId, positionId, validFrom, synthetic',
    anthropometry: '++id, playerId, date, synthetic',
  });
  // Esquema 3 (fase 2): catálogo configurable. «archived» no se indexa (los booleanos no se pueden indexar).
  db.version(3).stores({
    blocks: 'key, order',
    manifestations: '++id, blockKey, order',
    zones: '++id, order',
    tests: '++id, blockKey, manifestationId, zoneId, order',
    protocols: '++id, testId',
    variables: '++id, testId, manifestationId, order',
    formulaHistory: '++id, variableId',
  });
  // Esquema 4 (fase 3): sesiones (una fila por jugador, test, fecha y hora; el valor de cada lado y las repeticiones van dentro, D8),
  // lotes de importación y mapeos de columnas guardados. «synthetic» vale 1 solo en los registros sintéticos.
  db.version(4).stores({
    sessions: '++id, playerId, testId, date, batchId, synthetic',
    importBatches: '++id, createdAt, fileHash',
    importMappings: '++id, testId',
  });
  // Esquema 5 (fase 6g, D15): targets individuales (jugador + variable) y por defecto de posición (posición + variable). «synthetic» vale 1 solo en los sintéticos.
  db.version(5).stores({
    targets: '++id, variableId, playerId, positionId, synthetic',
  });
  // Esquema 6 (G6, D17): perfiles carga-velocidad (puntos carga/velocidad por jugador y fecha). «synthetic» vale 1 solo en los sintéticos.
  db.version(6).stores({
    fvProfiles: '++id, playerId, date, synthetic',
  });
  // Esquema 7 (15/11/2026): configuración del rack de los iso-push por jugador. Es un registro permanente (uno por jugador), sin fecha ni historial.
  db.version(7).stores({
    isoRack: '++id, playerId',
  });
  // Esquema 8 (26/11/2026): se retiran los targets del dashboard por decisión del usuario, con sus datos. `targets: null` borra la tabla entera al
  // subir de esquema; no toca ninguna otra. Es permanente: solo se recupera restaurando una copia de seguridad anterior a esta versión.
  db.version(8).stores({
    targets: null,
  });
  return db;
}

// Abre la base. Si el navegador no puede subirla de esquema porque hay OTRA pestaña del dashboard abierta con el esquema anterior, `db.open()` se queda
// esperando para siempre y la pantalla se queda en «Cargando…» sin ningún error (16/11/2026: le pasó al usuario al actualizar al esquema 7).
// Por eso: 1) se avisa en cuanto IndexedDB dice que está bloqueada, 2) esta pestaña se aparta sola (cierra su conexión) cuando otra actualiza el esquema,
// y 3) si a los 4 segundos sigue sin abrir, se levanta un error con instrucciones en vez de dejar la pantalla colgada.
export class BaseBloqueadaError extends Error {
  constructor() {
    super('Hay otra pestaña o ventana del dashboard abierta con la versión anterior, y el navegador no puede actualizar la base mientras siga abierta. Cierra las demás pestañas del dashboard y vuelve a cargar esta. No se ha perdido ningún dato.');
    this.name = 'BaseBloqueadaError';
    this.bloqueada = true;
  }
}

export async function initDb(db) {
  let avisar = null;
  // IndexedDB avisa en cuanto el bloqueo ocurre, así que NO hace falta un tiempo de espera: una base grande puede tardar en abrir sin estar bloqueada,
  // y cortar por tiempo sería peor (abortaría una migración en curso). Se corre la carrera entre abrir y el aviso de bloqueo.
  const bloqueo = new Promise((_, no) => { avisar = () => no(new BaseBloqueadaError()); });
  db.on('blocked', () => avisar());
  // Otra pestaña quiere subir el esquema: esta cierra su conexión para no bloquearla. Al recargar, esta pestaña abrirá ya el esquema nuevo.
  db.on('versionchange', () => { try { db.close(); } catch { /* ya estaba cerrada */ } });
  try {
    await Promise.race([db.open(), bloqueo]);
  } catch (e) {
    if (e?.bloqueada || /blocked/i.test(e?.name ?? '')) throw new BaseBloqueadaError();
    throw e;
  }
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
