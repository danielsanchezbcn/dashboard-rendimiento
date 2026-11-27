// hip.js — bloque «Hip» de NME: exploración clínica de la cadera (27/11/2026, pedido del usuario, con su Excel «GENERICO.xlsx» delante).
// Lógica pura: ni base de datos ni interfaz. Es el ÚNICO sitio donde viven la escala, la postura de cada test y la regla de déficit, para que el
// importador, el alta manual, la ficha del jugador y el bloque Déficits no puedan discrepar entre ellos.
//
// Qué NO es esto: no es una medida continua comparable entre jugadores. Son grados clínicos ordinales y un test dicotómico, así que estas variables
// van SIN dirección «mejor/peor», fuera de Asimetrías y fuera del déficit por percentil de La Liga. El déficit aquí es por CRITERIO, no por percentil:
// lo decide el grado, no la posición del jugador en la plantilla. Mezclar las dos cosas sería dar un percentil a un juicio clínico.
//
// Decisiones del usuario (27/11/2026), literales:
//  · La escala de rango articular va de 0 a 3 y SOLO admite enteros: 0 = sin déficit, 1 = limitación leve, 2 = limitación moderada, 3 = limitación severa.
//    Ni el 4 ni los medios puntos son válidos: un fichero que los traiga se rechaza celda a celda, diciendo fila y columna, en vez de redondear en silencio.
//  · Impingement: «+» = test positivo (hay limitación); «✓» = test realizado y negativo; celda vacía = no explorado.
//  · En Déficits aparecen los impingement positivos y todo rango articular ≥ 2.
//  · Anotación de origen SOLO en las rotaciones: en decúbito supino, «compromiso articular»; en decúbito prono, «origen muscular».
//    La flexión de cadera y el Bent Knee Over NO llevan anotación de origen.
//  · El Bent Knee Over es un único valor bilateral (no se anota por pierna), así que no entra en Asimetrías ni tiene lado.
//  · Cada valoración admite una anotación de texto libre (una por fecha, no por test ni por pierna).

export const HIP_TEST = 'Hip';
export const UMBRAL_ROM = 2; // en Déficits entra todo lo que sea ≥ 2 (decisión del usuario: «todo lo que sea ≥ 2»)

// --- Escalas -----------------------------------------------------------------------------------------------------------------------------------
export const ESCALA_ROM = 'rom03';
export const ESCALA_IMPINGEMENT = 'impingement';

export const GRADOS_ROM = [
  { valor: 0, etiqueta: 'Sin déficit' },
  { valor: 1, etiqueta: 'Limitación leve' },
  { valor: 2, etiqueta: 'Limitación moderada' },
  { valor: 3, etiqueta: 'Limitación severa' },
];
export const GRADOS_IMPINGEMENT = [
  { valor: 0, etiqueta: 'Negativo (✓)' },
  { valor: 1, etiqueta: 'Positivo (+)' },
];

export const gradosDeEscala = (escala) => (escala === ESCALA_ROM ? GRADOS_ROM : escala === ESCALA_IMPINGEMENT ? GRADOS_IMPINGEMENT : []);

// Escala de una variable: la que lleva escrita, y si no, la que le toca por su nombre (las variables creadas antes de esta versión no la llevan).
export function escalaDe(variable) {
  if (variable?.escala === ESCALA_ROM || variable?.escala === ESCALA_IMPINGEMENT) return variable.escala;
  const n = String(variable?.name ?? '').toLowerCase();
  if (/imping|impig/.test(n)) return ESCALA_IMPINGEMENT; // «impigment», tal como lo escribe el usuario en su Excel
  if (/hip (internal|external) rotation|hip flexion|bent knee/.test(n)) return ESCALA_ROM;
  return null;
}
export const esVariableHip = (variable) => escalaDe(variable) !== null;

// ¿Es un valor válido de la escala? Devuelve el motivo exacto para poder decirlo en pantalla (nunca se redondea ni se corrige por nuestra cuenta).
export function validarValorEscala(escala, n) {
  const grados = gradosDeEscala(escala);
  if (!grados.length) return { ok: true, valor: n };
  if (!Number.isFinite(n)) return { ok: false, razon: 'no es un número' };
  if (!Number.isInteger(n)) return { ok: false, razon: `la escala solo admite números enteros (${grados[0].valor} a ${grados.at(-1).valor}); no se admiten medios puntos` };
  if (n < grados[0].valor || n > grados.at(-1).valor) return { ok: false, razon: `fuera de la escala (${grados[0].valor} a ${grados.at(-1).valor})` };
  return { ok: true, valor: n };
}

// Texto de un valor: «2 · Limitación moderada», «Positivo (+)». Lo usan la ficha del jugador, Déficits y los desplegables del alta manual.
export function etiquetaValor(escala, n) {
  const g = gradosDeEscala(escala).find((x) => x.valor === n);
  if (!g) return Number.isFinite(n) ? String(n) : '—';
  return escala === ESCALA_IMPINGEMENT ? g.etiqueta : `${g.valor} · ${g.etiqueta}`;
}

// --- Postura y origen del déficit ---------------------------------------------------------------------------------------------------------------
// Solo las rotaciones se exploran en las dos posturas, y solo ellas llevan anotación de origen (decisión del usuario).
export function posturaDe(variable) {
  const n = String(variable?.name ?? '').toLowerCase();
  if (!/rotation/.test(n)) return null;
  if (/supin/.test(n)) return 'supina';
  if (/pron/.test(n)) return 'prona';
  return null;
}
export const ORIGEN = {
  supina: 'Déficit por compromiso articular (explorado en decúbito supino)',
  prona: 'Déficit de origen muscular (explorado en decúbito prono)',
};
export const origenDeficit = (variable) => ORIGEN[posturaDe(variable)] ?? null;

// --- Déficits de una valoración -----------------------------------------------------------------------------------------------------------------
// `sesion` es UNA sesión del test Hip (los grados no se promedian ni se escogen «el mejor»: una exploración clínica es una foto de un día, así que
// Déficits mira siempre la ÚLTIMA valoración válida y lo dice con su fecha, al margen del selector Latest/Personal Average/Personal Best).
export function ultimaValoracion(sessions, testId) {
  return sessions
    .filter((s) => s.testId === testId && s.status === 'valid')
    .sort((a, b) => String(b.date ?? '').localeCompare(String(a.date ?? '')) || String(b.time ?? '').localeCompare(String(a.time ?? '')) || (b.id ?? 0) - (a.id ?? 0))[0] ?? null;
}

// Filas de déficit de una valoración: impingement positivo y rango articular ≥ 2. Una fila por variable y lado, en el orden del catálogo.
export function deficitsHip({ variables, testId, sesion }) {
  if (!sesion) return { fecha: null, nota: '', filas: [], explorado: 0 };
  const vars = variables
    .filter((v) => v.testId === testId && !v.archived && esVariableHip(v))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.id - b.id);
  const filas = []; let explorado = 0;
  for (const v of vars) {
    const escala = escalaDe(v);
    for (const sd of v.sides === 'LR' ? ['L', 'R'] : ['S']) {
      const x = sesion.values?.[v.id]?.[sd];
      if (!Number.isFinite(x)) continue;
      explorado++;
      if (escala === ESCALA_IMPINGEMENT) {
        if (x !== 1) continue;
        filas.push({ variable: v, side: sd, valor: x, escala, etiqueta: etiquetaValor(escala, x), origen: null, tipo: 'impingement' });
      } else if (escala === ESCALA_ROM) {
        if (x < UMBRAL_ROM) continue;
        filas.push({ variable: v, side: sd, valor: x, escala, etiqueta: etiquetaValor(escala, x), origen: origenDeficit(v), tipo: 'rom' });
      }
    }
  }
  return { fecha: sesion.date ?? null, nota: String(sesion.nota ?? '').trim(), filas, explorado };
}
