// cambio.js — ¿es real el cambio entre dos medidas de un jugador? (10/11/2026). Criterio PROVISIONAL, pendiente de confirmación del usuario.
// Cada sesión guarda solo la MEDIA de sus repeticiones (D8), así que no hay varianza dentro de la sesión y no se puede hacer un contraste t entre dos sesiones.
// Se usa el enfoque de «cambio fiable» de la ciencia del deporte: el error de medida se estima con la propia plantilla a partir de las diferencias entre sesiones
// CONSECUTIVAS de cada jugador (error típico TE = SD de las diferencias ÷ √2; Hopkins 2000, Sports Med 30:1-15). La diferencia entre dos medidas sueltas tiene error
// típico √2·TE = SD de las diferencias, de modo que t = diferencia ÷ SD(diferencias) con n − 1 grados de libertad; el cambio mínimo detectable al 95 %
// es t crítico × SD(diferencias) (Weir 2005, J Strength Cond Res 19:231-240; Jacobson y Truax 1991, J Consult Clin Psychol 59:12-19).
// Relevancia práctica: cambio mínimo importante (SWC) = 0,2 × desviación típica ENTRE jugadores (Hopkins et al. 2009, Med Sci Sports Exerc 41:3-13).
// Limitación: las diferencias entre sesiones incluyen también cambios reales (entrenamiento, lesión), así que el error estimado es, si acaso, mayor que el real
// (el criterio es conservador); y se aplica a este jugador el error medio de la plantilla.

// Función beta incompleta regularizada (fracción continua de Lentz) y distribución t de Student.
function lgamma(x) {
  const c = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
  let y = x, t = x + 5.5; t -= (x + 0.5) * Math.log(t); let s = 1.000000000190015;
  for (const k of c) s += k / ++y;
  return -t + Math.log((2.5066282746310005 * s) / x);
}
function betacf(a, b, x) {
  const TINY = 1e-300; let c = 1, d = 1 - ((a + b) * x) / (a + 1); if (Math.abs(d) < TINY) d = TINY; d = 1 / d; let h = d;
  for (let m = 1; m <= 300; m++) {
    const m2 = 2 * m; let aa = (m * (b - m) * x) / ((a + m2 - 1) * (a + m2));
    d = 1 + aa * d; if (Math.abs(d) < TINY) d = TINY; c = 1 + aa / c; if (Math.abs(c) < TINY) c = TINY; d = 1 / d; h *= d * c;
    aa = (-(a + m) * (a + b + m) * x) / ((a + m2) * (a + m2 + 1));
    d = 1 + aa * d; if (Math.abs(d) < TINY) d = TINY; c = 1 + aa / c; if (Math.abs(c) < TINY) c = TINY; d = 1 / d;
    const del = d * c; h *= del; if (Math.abs(del - 1) < 1e-14) break;
  }
  return h;
}
function ibeta(x, a, b) {
  if (x <= 0) return 0; if (x >= 1) return 1;
  const bt = Math.exp(lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  return x < (a + 1) / (a + b + 2) ? (bt * betacf(a, b, x)) / a : 1 - (bt * betacf(b, a, 1 - x)) / b;
}
// p bilateral: P(|T| ≥ |t|) con df grados de libertad.
export const tTwoSidedP = (t, df) => ibeta(df / (df + t * t), df / 2, 0.5);
// t crítico bilateral (95 %) por bisección.
export function tCritical(df, alpha = 0.05) {
  let lo = 0, hi = 1000; for (let i = 0; i < 200; i++) { const mid = (lo + hi) / 2; if (tTwoSidedP(mid, df) > alpha) lo = mid; else hi = mid; }
  return (lo + hi) / 2;
}

const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
export const sampleSd = (a) => { if (a.length < 2) return null; const m = mean(a); return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1)); };

// Diferencias entre valores consecutivos de cada serie (cada serie = valores de un jugador en orden cronológico).
export const consecutiveDiffs = (seriesList) => seriesList.flatMap((v) => v.slice(1).map((x, i) => x - v[i])).filter(Number.isFinite);

// a = medida anterior, b = posterior ({ value, date }); diffs = diferencias consecutivas de la plantilla; between = un valor por jugador (Personal Average) para el SWC.
export function changeTest({ a, b, diffs, between = [], direction = null, minDiffs = 10 }) {
  const diff = b.value - a.value;
  const pct = a.value !== 0 ? (diff / Math.abs(a.value)) * 100 : null;
  const sw = between.length >= minDiffs ? sampleSd(between) : null;
  const swc = sw === null ? null : 0.2 * sw;
  const out = { diff, pct, n: diffs.length, swc, exceedsSwc: swc === null ? null : Math.abs(diff) >= swc, improves: direction === 'higher' ? diff > 0 : direction === 'lower' ? diff < 0 : null };
  if (diffs.length < minDiffs) return { ...out, defined: false, reason: `Hacen falta al menos ${minDiffs} diferencias entre sesiones consecutivas en la plantilla para estimar el error de medida (hay ${diffs.length}).` };
  const sd = sampleSd(diffs);
  if (!(sd > 0)) return { ...out, defined: false, reason: 'Las diferencias entre sesiones de la plantilla no varían: no se puede estimar el error de medida.' };
  const df = diffs.length - 1, tc = tCritical(df), t = diff / sd, p = tTwoSidedP(t, df);
  return { ...out, defined: true, sd, te: sd / Math.SQRT2, df, t, p, mdc95: tc * sd, ci: [diff - tc * sd, diff + tc * sd], significant: p < 0.05 };
}
