// io.js — guardado de copias: ubicación elegida, carpeta recordada o descarga.
import { getLocal, setLocal, audit } from '../db.js';

export const canPickFile = () => 'showSaveFilePicker' in window;
export const canPickDir = () => 'showDirectoryPicker' in window;

export function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

async function writeToHandle(fileHandle, blob) {
  const w = await fileHandle.createWritable();
  await w.write(blob);
  await w.close();
  return (await fileHandle.getFile()).size;
}

// Devuelve { destino, verificado } o lanza (AbortError si el usuario cancela).
export async function saveBackup(db, blob, name) {
  if (canPickFile()) {
    const handle = await window.showSaveFilePicker({ suggestedName: name, types: [{ description: 'Copia de seguridad (JSON)', accept: { 'application/json': ['.json'] } }] });
    const size = await writeToHandle(handle, blob);
    return { destino: `ubicación elegida (${handle.name})`, verificado: size === blob.size };
  }
  downloadBlob(blob, name);
  return { destino: 'descarga del navegador', verificado: null };
}

export async function pickDirectory(db) {
  if (!canPickDir()) throw new Error('Este navegador no permite elegir carpetas. Usa Chrome o Edge.');
  const dir = await window.showDirectoryPicker({ mode: 'readwrite', id: 'copias-dashboard' });
  await setLocal(db, 'dirHandle', dir);
  await audit(db, 'carpeta-de-copias-elegida', {});
  return dir.name;
}

export async function rememberedDirStatus(db) {
  const handle = await getLocal(db, 'dirHandle');
  if (!handle) return null;
  let permiso = 'desconocido';
  try {
    permiso = await handle.queryPermission({ mode: 'readwrite' });
  } catch {
    /* sin soporte */
  }
  return { nombre: handle.name, permiso };
}

export async function saveToRememberedDir(db, blob, name) {
  const handle = await getLocal(db, 'dirHandle');
  if (!handle) throw new Error('Primero elige una carpeta de copias.');
  const permiso = await handle.requestPermission({ mode: 'readwrite' });
  if (permiso !== 'granted') throw new Error('No se concedió permiso de escritura en la carpeta.');
  const size = await writeToHandle(await handle.getFileHandle(name, { create: true }), blob);
  return { destino: `carpeta recordada (${handle.name})`, verificado: size === blob.size };
}
