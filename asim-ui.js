// asim-ui.js — color del texto de asimetría: naranja (Right) si domina la derecha y azul (Left) si domina la izquierda; sin color si es 0.
import { html } from './libs.js';
import { asymText, asymSideLetter } from './catalogo.js';
export const asimClase = (pct) => { const l = asymSideLetter(pct); return l === 'R' ? 'asim-r' : l === 'L' ? 'asim-l' : ''; };
export const AsimTexto = ({ pct, d = 1, texto = null }) => html`<span class=${asimClase(pct) || null}>${texto ?? asymText(pct, d)}</span>`;
