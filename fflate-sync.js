// fflate-sync.js — se usa SOLO al compilar libs.js (alias de «fflate»). fflate descomprime en un Web Worker creado desde un «blob:» cuando el libro es grande
// (hojas de más de ~0,5 MB sin comprimir), y la política de seguridad de la página (script-src 'self') lo bloquea: el importador de Excel se quedaba sin continuar.
// Aquí «unzip» ejecuta la descompresión síncrona (unzipSync) y devuelve el resultado por la misma interfaz. Sin workers y sin cambiar la política de seguridad.
import { unzipSync } from './node_modules/fflate/esm/browser.js';
export * from './node_modules/fflate/esm/browser.js';
export function unzip(data, opts, cb) {
  if (typeof opts === 'function') { cb = opts; opts = {}; }
  let result;
  try { result = unzipSync(data, opts); } catch (e) { cb(e, null); return () => {}; }
  cb(null, result);
  return () => {};
}
