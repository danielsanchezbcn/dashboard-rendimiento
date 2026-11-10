// nombres.js — cómo se muestran los nombres (10/11/2026): variables y tests en minúscula; bloques y subbloques (manifestaciones) en mayúscula.
// Solo es presentación: los datos, el catálogo y las comparaciones por nombre no cambian.
export const dn = (s) => String(s ?? '').toLocaleLowerCase('es');
export const up = (s) => String(s ?? '').toLocaleUpperCase('es');
