// exportar.js — fase 6: exportación a CSV de la tabla que se está viendo. Formato para Excel en español:
// UTF-8 con BOM, separador «;», decimales con coma. Los textos que empiezan por = + - @ se neutralizan (inyección de fórmulas).
const needsQuote = /[";\r\n]/;
export function csvText(v) {
  let s = String(v ?? '');
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return needsQuote.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
export const csvNum = (n, d = 4) => (typeof n === 'number' && Number.isFinite(n) ? String(Math.round(n * 10 ** d) / 10 ** d).replace('.', ',') : '');
export function buildCsv(header, rows) {
  return '﻿' + [header, ...rows].map((r) => r.map((c) => (typeof c === 'number' ? csvNum(c) : csvText(c))).join(';')).join('\r\n') + '\r\n';
}
