// colores.js — paleta de los informes del usuario (Physical Profile en PDF, fondo oscuro). Medida sobre las páginas del PDF
// (modo de los píxeles planos; el PDF está en JPEG, así que puede haber ±1-2 unidades por canal).
export const PAL = {
  fondo: '#040612',      // fondo de las diapositivas
  texto: '#FFFFFF',
  izq: '#31B3FE',        // lado izquierdo (azul VALD)
  der: '#FC912F',        // lado derecho (naranja VALD)
  laLiga: '#FEC900',     // referencia «La Liga» (amarillo)
  premier: '#B8A2C9',    // referencia «Premier League» (morado/lila del radar de los documentos)
  target: '#B2D581',     // target (verde de la bandera)
  jugador: '#FFFFFF',    // valores del jugador: siempre blanco (9/11/2026); se distinguen con línea continua/discontinua o con la escala de grises
  lila: '#B8A2C9',
  gris1: '#FFFFFF', gris2: '#B3B3B3', gris3: '#7A7A7A', // escala de grises sin connotación para series del jugador en barras (última sesión, Personal Best, Personal Average)
  rejilla: 'rgba(255,255,255,0.22)',
};
export const colorLado = (side) => (side === 'L' ? PAL.izq : side === 'R' ? PAL.der : PAL.jugador);
