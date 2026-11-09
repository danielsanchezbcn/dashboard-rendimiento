// fuentes.js — tipografía de los gráficos: Agency FB, como en los documentos del usuario (9/11/2026).
// Agency FB es una fuente comercial (viene con Microsoft Office): NO se incluye en la aplicación (licencia); se usa la instalada en el equipo del usuario.
// Si no está instalada, el navegador recurre a una condensada parecida (Arial Narrow) y, en último caso, a la fuente del sistema.
import { Chart } from './libs.js';

export const FUENTE_GRAFICOS = "'Agency FB','Agency FB Regular','Agency','Arial Narrow','Liberation Sans Narrow',sans-serif";
Chart.defaults.font.family = FUENTE_GRAFICOS;
Chart.defaults.font.size = 14; // Agency FB es estrecha y de ojo pequeño: un punto y medio más que el valor por defecto (12)
