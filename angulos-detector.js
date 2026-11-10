/**
 * core/ai-detector.js
 * Deteccion automatica de landmarks (MediaPipe Pose Landmarker), cargada bajo
 * demanda con import() dinamico -- nunca un <script type="module"> estatico,
 * porque un fallo de red en un import estatico se lleva por delante TODO el
 * script (nos paso y lo corregimos). Aqui el fallo solo afecta a esta funcion,
 * y quien la llama decide el fallback (ver seedPointsFallback).
 *
 * DETECTOR LOCAL (integracion en el dashboard, 10/11/2026): el dashboard no permite conexiones a internet, asi que MediaPipe se carga
 * desde ESTA misma carpeta (mismo origen) y no desde una CDN. Archivos necesarios junto a angulos.html (ver ANGULOS.md):
 *   vision_bundle.mjs, vision_wasm_internal.js/.wasm, vision_wasm_nosimd_internal.js/.wasm  (paquete npm @mediapipe/tasks-vision 0.10.14)
 *   pose_landmarker_full.task                                                                 (modelo de MediaPipe, ~9 MB; el «heavy» de ~29 MB no cabe en la subida por navegador de GitHub, límite 25 MB)
 * Si no estan, la carga falla y la foto pasa a MANUAL (colocar los puntos a mano): todo lo demas funciona igual. Version original: CDN
 * jsdelivr + storage.googleapis (comentada abajo).
 */
// const AI_DETECTOR_CDN_BASE = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14";
// const AI_DETECTOR_MODEL_URL = "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_heavy/float16/1/pose_landmarker_heavy.task";
const AI_DETECTOR_BASE = new URL('.', location.href).href.replace(/\/$/, '');
const AI_DETECTOR_MODEL_URL = AI_DETECTOR_BASE + '/pose_landmarker_full.task'; // 10/11/2026: «full» en vez de «heavy» (por el límite de 25 MB de la subida por navegador); menos preciso, pero la calidad se sigue avisando con AUTO / REVISAR

const LM = { LEFT_HIP: 23, RIGHT_HIP: 24, LEFT_KNEE: 25, RIGHT_KNEE: 26, LEFT_ANKLE: 27, RIGHT_ANKLE: 28 };

/**
 * Umbrales de calidad de la deteccion (configurables). Un landmark SUPERA un umbral si su valor es >= al minimo.
 */
const MIN_VISIBILITY = 0.50;
const MIN_PRESENCE = 0.50;

/**
 * IMPORTANTE (comprobado en vision.d.ts y vision_bundle.mjs de @mediapipe/tasks-vision@0.10.14): la API de JavaScript
 * de esta version devuelve cada landmark como {x, y, z, visibility} y NO devuelve `presence` (solo la API de Python
 * lo hace). Por eso `presence` se conserva si MediaPipe lo da y es null si no.
 *  - false (por defecto): un landmark sin valor de presence no se penaliza; se evalua solo su visibilidad, y la
 *    calidad lo hace constar (presenceAvailable = false). Si MediaPipe SI devuelve presence, se aplica MIN_PRESENCE.
 *  - true: un landmark sin valor de presence NO supera el umbral. Con 0.10.14 eso significa que toda deteccion
 *    saldria REVISAR y AUTO seria inalcanzable.
 */
const REQUIRE_PRESENCE_VALUE = false;

/**
 * Landmarks que se evaluan: los 6 que la aplicacion extrae (cadera, rodilla y tobillo de cada pierna). Se evaluan los
 * seis porque cuales se usan depende del assessment y de que pierna se seleccione, y eso puede cambiar despues.
 */
const REQUIRED_LANDMARKS = [['A', 'hip'], ['A', 'knee'], ['A', 'ankle'], ['B', 'hip'], ['B', 'knee'], ['B', 'ankle']];

/**
 * Forma de TODO landmark de la aplicacion: { x, y, visibility, presence } (x, y en pixeles de la imagen).
 * visibility y presence son numeros si vienen de MediaPipe, o null cuando no hay confianza de MediaPipe para esa
 * posicion (fallback, landmark colocado por el usuario, o presence que esta version de MediaPipe no devuelve).
 */
function makeLandmark(x, y, visibility = null, presence = null) { return { x, y, visibility, presence }; }

let landmarkerPromise = null;
function getLandmarker() {
  if (!landmarkerPromise) {
    const attempt = (async () => {
      const { PoseLandmarker, FilesetResolver } = await import(AI_DETECTOR_BASE + '/vision_bundle.mjs');
      const vision = await FilesetResolver.forVisionTasks(AI_DETECTOR_BASE);
      return await PoseLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: AI_DETECTOR_MODEL_URL, delegate: "GPU" },
        runningMode: "IMAGE",
        numPoses: 1
      });
    })().catch(err => {
      // Si la creacion FALLA de verdad, no se guarda la promesa rechazada: el siguiente intento vuelve a intentarlo.
      // (El tiempo de espera de detectPoints NO pasa por aqui: una creacion lenta sigue en curso y se reutiliza.)
      if (landmarkerPromise === attempt) landmarkerPromise = null;
      throw err;
    });
    landmarkerPromise = attempt;
  }
  return landmarkerPromise;
}

/**
 * Calidad global de una deteccion (funcion pura). Devuelve:
 *   status            'AUTO' si los 6 REQUIRED_LANDMARKS superan los umbrales; 'REVISAR' si alguno no los supera
 *   thresholds        { visibility, presence }: los umbrales aplicados
 *   evaluated         numero de landmarks evaluados (6)
 *   presenceAvailable true si MediaPipe devolvio presence en TODOS los landmarks evaluados
 *   failing           un elemento por cada landmark que no supera algun umbral:
 *                     { leg, joint, visibility, presence, visibilityOk, presenceOk }
 *                     visibilityOk: boolean. presenceOk: true / false / null (null = no evaluable: MediaPipe no lo devuelve).
 */
function assessDetectionQuality(points) {
  const failing = []; let withPresence = 0;
  for (const [leg, joint] of REQUIRED_LANDMARKS) {
    const lm = points[leg][joint];
    const visibilityOk = lm.visibility !== null && lm.visibility >= MIN_VISIBILITY;
    let presenceOk;
    if (lm.presence === null) presenceOk = REQUIRE_PRESENCE_VALUE ? false : null;
    else { withPresence++; presenceOk = lm.presence >= MIN_PRESENCE; }
    if (!visibilityOk || presenceOk === false) failing.push({ leg, joint, visibility: lm.visibility, presence: lm.presence, visibilityOk, presenceOk });
  }
  return {
    status: failing.length === 0 ? 'AUTO' : 'REVISAR',
    thresholds: { visibility: MIN_VISIBILITY, presence: MIN_PRESENCE },
    evaluated: REQUIRED_LANDMARKS.length,
    presenceAvailable: withPresence === REQUIRED_LANDMARKS.length,
    failing
  };
}

/**
 * Detecta cadera/rodilla/tobillo de ambas piernas sobre una imagen ya cargada y devuelve, de forma explicita:
 *   points   { A: {hip, knee, ankle}, B: {...} } con cada landmark { x, y, visibility, presence } (ver makeLandmark)
 *   quality  la calidad global (ver assessDetectionQuality)
 * Lanza si MediaPipe falla o no detecta ninguna pose -- el llamador (core/engine.js) captura el error, aplica
 * seedPointsFallback y marca la foto como MANUAL. Nunca deja la aplicacion en un estado roto.
 */
async function detectPoints(imgEl, w, h) {
  const landmarker = await Promise.race([
    getLandmarker(),
    new Promise((_, rej) => setTimeout(() => rej(new Error('tiempo de espera agotado (12 s)')), 12000))
  ]);
  const result = landmarker.detect(imgEl);
  if (!result || !result.landmarks || !result.landmarks.length) throw new Error('MediaPipe no ha detectado ninguna pose');
  const lm = result.landmarks[0];
  const read = idx => {
    const l = lm[idx];
    if (!l || !Number.isFinite(l.x) || !Number.isFinite(l.y)) throw new Error('MediaPipe ha devuelto un landmark sin coordenadas validas (indice ' + idx + ')');
    return makeLandmark(l.x * w, l.y * h, finiteOrNull(l.visibility), finiteOrNull(l.presence));
  };
  const points = {
    A: { hip: read(LM.LEFT_HIP), knee: read(LM.LEFT_KNEE), ankle: read(LM.LEFT_ANKLE) },
    B: { hip: read(LM.RIGHT_HIP), knee: read(LM.RIGHT_KNEE), ankle: read(LM.RIGHT_ANKLE) }
  };
  return { points, quality: assessDetectionQuality(points) };
}

/** Posicionamiento de respaldo (sin red, 100% offline) cuando la IA no esta disponible. */
function seedPointsFallback(w, h) {
  return {
    A: { hip: makeLandmark(w * 0.45, h * 0.55), knee: makeLandmark(w * 0.55, h * 0.35), ankle: makeLandmark(w * 0.60, h * 0.15) },
    B: { hip: makeLandmark(w * 0.45, h * 0.60), knee: makeLandmark(w * 0.30, h * 0.65), ankle: makeLandmark(w * 0.18, h * 0.85) }
  };
}
