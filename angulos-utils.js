/**
 * core/utils.js
 * Funciones puras, sin estado y sin dependencias del DOM salvo el propio
 * contexto canvas que se les pasa. Reutilizables por cualquier assessment futuro.
 */

// Convencion de color por lado anatomico real (no por slot A/B) - estilo VALD.
// Cambiar aqui afecta a toda la aplicacion de forma consistente.
const SIDE_COLORS = { left: '#00A2DE', right: '#ED7D31' };

/**
 * Tolerancia numerica de la geometria, en unidades de coordenada de imagen (pixeles).
 * Un segmento o rayo de longitud <= GEOMETRY_EPSILON se trata como de longitud cero:
 * su orientacion no esta definida, asi que la medicion es INVALIDA (null) y no un angulo ficticio.
 */
const GEOMETRY_EPSILON = 1e-6;

/** true si p es un punto con coordenadas numericas finitas. */
function isFinitePoint(p) { return !!p && Number.isFinite(p.x) && Number.isFinite(p.y); }

/** Garantiza el contrato de las funciones geometricas: un numero finito o null, nunca NaN ni Infinity. */
function finiteOrNull(v) { return Number.isFinite(v) ? v : null; }

/** true si v es una medicion valida (numero finito). null, NaN, +-Infinity y undefined no lo son. */
function isValidMeasurement(v) { return typeof v === 'number' && Number.isFinite(v); }

/** Texto de una medicion para el usuario: '—' si es invalida. Unico sitio donde se aplica toFixed a una medicion. */
function formatMeasurement(v) { return isValidMeasurement(v) ? v.toFixed(1) + '°' : '—'; }

/**
 * Angulo del segmento p1->p2 respecto a la horizontal.
 * Convencion: positivo hacia arriba, independiente de la direccion izquierda/derecha
 * del segmento en la imagen (usa |dx|), para que el signo no dependa de la orientacion
 * de la camara.
 */
function angleUpPositive(p1, p2) {
  if (!isFinitePoint(p1) || !isFinitePoint(p2)) return null;
  const dx = p2.x - p1.x, dy = p2.y - p1.y;
  if (Math.hypot(dx, dy) <= GEOMETRY_EPSILON) return null; // segmento de longitud cero: orientacion indefinida
  return finiteOrNull(Math.atan2(-dy, Math.abs(dx)) * 180 / Math.PI);
}

/** Distancia minima de un punto p al segmento a-b (para detectar clic sobre una pierna). */
function distToSegment(p, a, b) {
  if (!isFinitePoint(p) || !isFinitePoint(a) || !isFinitePoint(b)) return null;
  const l2 = (b.x - a.x) ** 2 + (b.y - a.y) ** 2;
  // segmento de longitud cero (o practicamente cero): se comporta como un punto, sin dividir por ~0
  if (Math.sqrt(l2) <= GEOMETRY_EPSILON) return finiteOrNull(Math.hypot(p.x - a.x, p.y - a.y));
  let t = ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / l2;
  t = Math.max(0, Math.min(1, t));
  return finiteOrNull(Math.hypot(p.x - (a.x + t * (b.x - a.x)), p.y - (a.y + t * (b.y - a.y))));
}

function mid(a, b) { return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; }

/**
 * Angulo incluido entre knee->ray1 y knee->ray2 (p.ej. rodilla como vertice,
 * cadera y tobillo como rayos), expresado como suplemento (180 - incluido)
 * para que la extension completa (puntos colineales) de 0 y el angulo
 * crezca con la flexion -- convencion goniometrica estandar, siempre positivo.
 * Independiente del sistema de coordenadas de la imagen (no usa horizontal).
 */
function includedAngleSupplement(vertex, ray1, ray2) {
  if (!isFinitePoint(vertex) || !isFinitePoint(ray1) || !isFinitePoint(ray2)) return null;
  const v1 = { x: ray1.x - vertex.x, y: ray1.y - vertex.y };
  const v2 = { x: ray2.x - vertex.x, y: ray2.y - vertex.y };
  const m1 = Math.hypot(v1.x, v1.y), m2 = Math.hypot(v2.x, v2.y);
  if (m1 <= GEOMETRY_EPSILON || m2 <= GEOMETRY_EPSILON) return null; // rayo de longitud cero: angulo indefinido
  const dot = v1.x * v2.x + v1.y * v2.y;
  const included = Math.acos(Math.max(-1, Math.min(1, dot / (m1 * m2)))) * 180 / Math.PI;
  return finiteOrNull(180 - included);
}

/** Etiqueta con caja de fondo oscura -- garantiza legibilidad sobre cualquier foto. */
function drawLabel(ctx, pos, text, color, textColor) {
  ctx.font = '800 13px -apple-system, sans-serif';
  const w = ctx.measureText(text).width;
  ctx.fillStyle = 'rgba(10,10,11,0.88)';
  ctx.fillRect(pos.x - w / 2 - 5, pos.y - 10, w + 10, 20);
  ctx.fillStyle = textColor || '#fff';
  ctx.fillText(text, pos.x - w / 2, pos.y + 5);
}
