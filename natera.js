import { mismoTest } from './nombres.js';
// natera.js — fase 6e: clasificación bibliográfica del Run-Specific Iso-Push (Dr. Alex Natera), aportada por el usuario el 7/11/2026
// (imagen «REFERENCIAS ISO PUSH»). Se aplica al Peak Force RELATIVO (Ankle y Knee en BW, Hip en SW). Intervalos continuos: cada clase empieza
// en su límite inferior (la fuente publica rangos con huecos de redondeo, p. ej. 2,75–2,99 y 3,0–3,24). Por debajo de «Normal» la fuente no da etiqueta.
// Los colores de la fuente (amarillo, verde claro, verde) se muestran con las bandas ya existentes; Por debajo de Normal en rojo (decisión del usuario, 7/11).
export const NATERA_SOURCE = 'Dr. Alex Natera (referencias Iso-Push aportadas por el usuario)';
export const NATERA = [
  { test: 'Run-Specific Ankle Iso-Push', unit: 'BW', normal: 2.75, good: 3.0, excellent: 3.25 },
  { test: 'Run-Specific Knee Iso-Push', unit: 'BW', normal: 3.75, good: 4.2, excellent: 4.5 },
  { test: 'Run-Specific Hip Iso-Push', unit: 'SW', normal: 2.0, good: 2.2, excellent: 2.5 },
];
// Colores de las tres marcas de Natera en los gráficos: los mismos de sus bandas (amarillo, verde suave, verde).
export const NATERA_HEX = { normal: '#ecc94b', good: '#9ae6b4', excellent: '#2f855a' };
export const NATERA_CLASSES = { below: { text: 'Por debajo de Normal', band: 'rojo' }, normal: { text: 'Normal', band: 'amarillo' }, good: { text: 'Good', band: 'verde-suave' }, excellent: { text: 'Excellent', band: 'verde' } };

// Solo variables relativas «Peak Force relativo (BW|SW)» de los tres tests y con la unidad correcta.
export function findNatera(test, variable) {
  if (!test || !variable || !/^Peak Force relativo \((BW|SW)\)$/.test(variable.name)) return null;
  const r = NATERA.find((n) => mismoTest(n.test, test.name));
  return r && variable.name === `Peak Force relativo (${r.unit})` ? r : null;
}
export function classifyNatera(ref, value) {
  if (!ref || typeof value !== 'number' || !Number.isFinite(value)) return null;
  const key = value >= ref.excellent ? 'excellent' : value >= ref.good ? 'good' : value >= ref.normal ? 'normal' : 'below';
  return { key, ...NATERA_CLASSES[key] };
}
