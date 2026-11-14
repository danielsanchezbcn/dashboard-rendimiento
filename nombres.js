// nombres.js — cómo se muestran los nombres (10/11/2026): variables y tests en minúscula; bloques y subbloques (manifestaciones) en mayúscula.
// Solo es presentación: los datos, el catálogo y las comparaciones por nombre no cambian.
export const dn = (s) => String(s ?? '').toLocaleLowerCase('es');
export const up = (s) => String(s ?? '').toLocaleUpperCase('es');

// Comparación de nombres de test con los del catálogo de fábrica (13/11/2026). En la base del usuario los mismos tests están escritos de otra forma
// («SL Seated Calf Raise» por «Single-Leg Seated Calf Raise», «DL Hop Test» por «Double-Leg Hop Test», algunos Iso-Hold con «Run-Specific» delante).
// Se igualan al comparar: minúsculas, espacios colapsados, sin acentos, SL/DL por su forma larga y sin el prefijo «Run-Specific». Solo afecta a las
// comparaciones; el nombre guardado no se toca.
// Nombres que el usuario ha cambiado de verdad (no una abreviatura ni un prefijo): aquí se declara que el nombre viejo y el nuevo son el MISMO test,
// para que todo lo que busca por nombre (parejas iso-hold, importación de VALD, referencias, radar…) siga encontrándolo en las bases que aún lo tengan
// con el nombre anterior. Clave: nombre ya normalizado · valor: nombre normalizado actual. Añadir aquí un alias es la forma correcta de renombrar
// un test que el código usa (14/11/2026).
const ALIAS_TESTS = {
  'sl seated calf raise': 'seated calf raise iso-push',
  'sl seated calf raise iso-hold 20 s': 'seated calf raise iso-hold 20 s',
};
const normBase = (s) => String(s ?? '')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .trim().toLowerCase().replace(/\s+/g, ' ')
  .replace(/\bsingle[- ]leg\b/g, 'sl').replace(/\bdouble[- ]leg\b/g, 'dl')
  .replace(/^run-?specific /, '');
export const normTestName = (s) => { const n = normBase(s); return ALIAS_TESTS[n] ?? n; };
export const mismoTest = (a, b) => normTestName(a) === normTestName(b);
