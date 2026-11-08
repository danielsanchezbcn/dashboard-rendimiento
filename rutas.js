// rutas.js — rutas por hash con parámetros: «#jugador-12?t=5&v=9&m=pa», «#test-5?v=9&j=12». Compatible con alojamiento estático.
// La ficha y la vista de test guardan en la dirección el test, la variable, el protocolo, las fechas y el modo: así funcionan Atrás y recargar (RF-03.4).

export function parseHash(h = location.hash) {
  const raw = String(h).replace(/^#\/?/, '');
  const i = raw.indexOf('?');
  const path = i < 0 ? raw : raw.slice(0, i);
  const query = {};
  if (i >= 0) for (const [k, v] of new URLSearchParams(raw.slice(i + 1))) query[k] = v;
  return { path, query };
}

export function buildHash(path, params = {}) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') sp.set(k, String(v));
  const q = sp.toString();
  return '#' + path + (q ? '?' + q : '');
}

// Cambiar filtros reescribe la entrada actual (no llena el historial); abrir otra vista usa un enlace normal (entrada nueva).
export function replaceQuery(path, params) {
  history.replaceState(null, '', buildHash(path, params));
  window.dispatchEvent(new Event('hashquery'));
}
