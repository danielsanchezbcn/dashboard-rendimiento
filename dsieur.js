// dsieur.js — DSI y EUR de TODOS los jugadores en una sola tabla (16/11/2026, pedido del usuario).
//
// Los números y las etiquetas son EXACTAMENTE los mismos que ve cada jugador en su ficha. Para conseguirlo sin repetir el trabajo N veces:
// se calculan las relaciones de cada jugador una sola vez, se juntan en una referencia de La Liga con todos ellos y después `evaluate` excluye
// a cada jugador de su propia referencia (lo hace siempre, filtrando por `playerId`), que es justo lo que hace `ratioReferences` jugador a jugador.
// Así el percentil de un jugador aquí y en su ficha es el mismo número, y el coste pasa de N × N a N.
import { evaluate, MIN_N_DEFAULT } from './percentiles.js';
import { relationsFor, strengthOrientation } from './relaciones.js';

const ladoNombre = (k) => (k === 'L' ? 'izquierda' : 'derecha');

export function dsiEurTodos({ loc, sessions, anthropometry, players, minN = MIN_N_DEFAULT, includeSynthetic = false }) {
  const ids = Object.keys(players).map(Number).filter((id) => includeSynthetic || !players[id].synthetic);
  const rel = new Map(ids.map((id) => [id, relationsFor({ loc, sessions, anthropometry, playerId: id })]));
  // DSI y Knee: un único conjunto con las dos piernas juntas (un P50 para ambas), igual que en la ficha del jugador.
  const entries = { dsi: [], knee: [], eur: [] };
  for (const id of ids) {
    const r = rel.get(id);
    for (const k of ['L', 'R']) {
      if (r.dsi[k].defined) entries.dsi.push({ playerId: id, value: r.dsi[k].value });
      if (r.knee[k].defined) entries.knee.push({ playerId: id, value: r.knee[k].value });
    }
    if (r.eur.defined) entries.eur.push({ playerId: id, value: r.eur.value });
  }
  const filas = ids.map((id) => {
    const r = rel.get(id);
    // direction 'higher': solo para colocar el percentil en las seis bandas de color. DSI y EUR no tienen sentido «mejor/peor».
    const ev = (e, v) => (v.defined ? evaluate(e, { playerId: id, value: v.value, direction: 'higher', minN }) : null);
    const knee = { L: ev(entries.knee, r.knee.L), R: ev(entries.knee, r.knee.R) };
    const lado = (k) => {
      const d = r.dsi[k], e = ev(entries.dsi, d);
      return {
        defined: d.defined, value: d.defined ? d.value : null, razon: d.defined ? null : d.reason, ev: e, kneeEv: knee[k],
        // La regla del knee por debajo del percentil 35 la aplica `strengthOrientation`, la MISMA función que usan la ficha y el COMPOSITE.
        orientacion: d.defined ? strengthOrientation('dsi', e, [{ label: ladoNombre(k), ev: knee[k] }]) : null,
      };
    };
    const eEur = ev(entries.eur, r.eur);
    return {
      playerId: id, player: players[id],
      dsi: { L: lado('L'), R: lado('R') },
      eur: { defined: r.eur.defined, value: r.eur.defined ? r.eur.value : null, razon: r.eur.defined ? null : r.eur.reason, ev: eEur, orientacion: r.eur.defined ? strengthOrientation('eur', eEur) : null },
    };
  });
  return { filas, n: { dsi: entries.dsi.length, eur: entries.eur.length, jugadores: ids.length } };
}

export const ORDENES = [['jugador', 'Jugador (A–Z)'], ['dsi', 'DSI (el más alto primero)'], ['eur', 'EUR (el más alto primero)']];

// Valor con el que se ordena cada fila: en el DSI, la media de las piernas con dato (una sola pierna vale). Las filas sin dato van siempre al final.
export const valorOrden = (f, orden) => {
  if (orden === 'eur') return f.eur.defined ? f.eur.value : null;
  if (orden === 'dsi') {
    const v = ['L', 'R'].map((k) => f.dsi[k]).filter((x) => x.defined).map((x) => x.value);
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
  }
  return null;
};

export function ordenar(filas, orden, nombreDe) {
  const porNombre = (a, b) => String(nombreDe(a)).localeCompare(String(nombreDe(b)), 'es', { sensitivity: 'base', numeric: true });
  if (orden !== 'dsi' && orden !== 'eur') return [...filas].sort(porNombre);
  return [...filas].sort((a, b) => {
    const va = valorOrden(a, orden), vb = valorOrden(b, orden);
    if (va === null && vb === null) return porNombre(a, b);
    if (va === null) return 1;
    if (vb === null) return -1;
    return vb - va || porNombre(a, b);
  });
}
