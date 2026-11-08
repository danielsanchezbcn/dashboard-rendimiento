// estadistica.js — fase 6c: estadística descriptiva para la vista de relaciones. Criterio PROVISIONAL, pendiente de confirmación del usuario.
// Fuentes: Bonett y Wright (2000, Psychometrika) para el IC de Spearman (error típico de atanh(ρ) = √((1 + ρ²/2)/(n − 3)); válido para |ρ| < 0,95);
// Bakdash y Marusich (2017, Frontiers in Psychology) para la correlación de medidas repetidas (rmcorr): r intra-sujeto con gl = N − k − 1 e IC de Fisher
// con n = gl + 2 (como la función rmcorr de R: psych::r.con(r, gl + 2)). No se calculan valores p: se describe la asociación y su incertidumbre.

const Z975 = 1.959963984540054;

export function ranks(values) {
  const idx = values.map((v, i) => [v, i]).sort((a, b) => a[0] - b[0]);
  const r = new Array(values.length);
  for (let i = 0; i < idx.length;) {
    let j = i;
    while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++;
    const avg = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) r[idx[k][1]] = avg;
    i = j + 1;
  }
  return r;
}

export function pearson(x, y) {
  const n = x.length;
  if (n < 3 || y.length !== n) return null;
  const mx = x.reduce((a, b) => a + b, 0) / n, my = y.reduce((a, b) => a + b, 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) { const dx = x[i] - mx, dy = y[i] - my; sxy += dx * dy; sxx += dx * dx; syy += dy * dy; }
  if (sxx === 0 || syy === 0) return null; // una variable constante: la correlación no existe
  return Math.max(-1, Math.min(1, sxy / Math.sqrt(sxx * syy)));
}

export const spearman = (x, y) => pearson(ranks(x), ranks(y));

// IC 95 % por transformación de Fisher con el error típico indicado.
export function fisherCI(r, se) {
  if (r === null || !Number.isFinite(se) || Math.abs(r) >= 1) return null;
  const z = Math.atanh(r);
  return [Math.tanh(z - Z975 * se), Math.tanh(z + Z975 * se)];
}

export function pearsonResult(x, y) {
  const n = x.length, r = pearson(x, y);
  if (r === null || n < 4) return { defined: false, n, reason: n < 4 ? 'Hacen falta al menos 4 observaciones.' : 'Una de las variables es constante: no hay correlación.' };
  return { defined: true, n, r, ci: fisherCI(r, 1 / Math.sqrt(n - 3)) };
}

export function spearmanResult(x, y) {
  const n = x.length, r = spearman(x, y);
  if (r === null || n < 4) return { defined: false, n, reason: n < 4 ? 'Hacen falta al menos 4 observaciones.' : 'Una de las variables es constante (o todo empata): no hay correlación.' };
  return { defined: true, n, r, ci: fisherCI(r, Math.sqrt((1 + (r * r) / 2) / (n - 3))), ciReliable: Math.abs(r) < 0.95 };
}

// Correlación de medidas repetidas: obs = [{ id (jugador), x, y }]. Se centra por jugador y se correlaciona; solo cuentan los jugadores con ≥ 2 pares.
export function rmcorr(obs) {
  const by = new Map();
  for (const o of obs) (by.get(o.id) ?? by.set(o.id, []).get(o.id)).push(o);
  const used = [...by.values()].filter((g) => g.length >= 2);
  const N = used.reduce((a, g) => a + g.length, 0), k = used.length, df = N - k - 1;
  if (k < 2 || df < 3) return { defined: false, N, k, df, reason: 'Hacen falta al menos 2 jugadores con 2 o más pares de datos y gl ≥ 3 (gl = pares − jugadores − 1).' };
  let sxy = 0, sxx = 0, syy = 0;
  for (const g of used) {
    const mx = g.reduce((a, o) => a + o.x, 0) / g.length, my = g.reduce((a, o) => a + o.y, 0) / g.length;
    for (const o of g) { const dx = o.x - mx, dy = o.y - my; sxy += dx * dy; sxx += dx * dx; syy += dy * dy; }
  }
  if (sxx === 0 || syy === 0) return { defined: false, N, k, df, reason: 'Dentro de los jugadores una variable no cambia nunca: no hay correlación intra-jugador.' };
  const r = Math.max(-1, Math.min(1, sxy / Math.sqrt(sxx * syy)));
  return { defined: true, N, k, df, r, ci: fisherCI(r, 1 / Math.sqrt(df - 1)), players: used.map((g) => g[0].id) };
}
