// nombres.js — cómo se muestran los nombres (10/11/2026): variables y tests en minúscula; bloques y subbloques (manifestaciones) en mayúscula.
// Solo es presentación: los datos, el catálogo y las comparaciones por nombre no cambian.
export const dn = (s) => String(s ?? '').toLocaleLowerCase('es');
export const up = (s) => String(s ?? '').toLocaleUpperCase('es');

// Comparación de nombres de test con los del catálogo de fábrica (13/11/2026). En la base del usuario los mismos tests están escritos de otra forma
// («SL Seated Calf Raise» por «Single-Leg Seated Calf Raise», «DL Hop Test» por «Double-Leg Hop Test», algunos Iso-Hold con «Run-Specific» delante).
// Se igualan al comparar: minúsculas, espacios colapsados, sin acentos, SL/DL por su forma larga y sin el prefijo «Run-Specific». Solo afecta a las
// comparaciones; el nombre guardado no se toca.
export const normTestName = (s) => String(s ?? '')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .trim().toLowerCase().replace(/\s+/g, ' ')
  .replace(/\bsingle[- ]leg\b/g, 'sl').replace(/\bdouble[- ]leg\b/g, 'dl')
  .replace(/^run-?specific /, '');
export const mismoTest = (a, b) => normTestName(a) === normTestName(b);
