// colores.js — paleta de los informes del usuario (Physical Profile en PDF, fondo oscuro). Medida sobre las páginas del PDF
// (modo de los píxeles planos; el PDF está en JPEG, así que puede haber ±1-2 unidades por canal).
export const PAL = {
  fondo: '#040612',      // fondo de las diapositivas
  texto: '#FFFFFF',
  izq: '#31B3FE',        // lado izquierdo (azul VALD)
  der: '#FC912F',        // lado derecho (naranja VALD)
  laLiga: '#FEC900',     // referencia «La Liga» (amarillo)
  premier: '#FFFFFF',    // referencia «Premier League» (blanco)
  target: '#B2D581',     // target (verde de la bandera)
  jugador: '#ED6265',    // jugador sin lado / Personal Best usa el lila del radar
  lila: '#B8A2C9',
  rejilla: 'rgba(255,255,255,0.22)',
};
export const colorLado = (side) => (side === 'L' ? PAL.izq : side === 'R' ? PAL.der : PAL.jugador);
