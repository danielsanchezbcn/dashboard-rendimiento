/**
 * assessments/aket.js
 * AKET -- 1 pierna por foto (no hay "elevada/apoyo"), angulo incluido en la
 * rodilla entre femur y tibia, expresado como flexion respecto a extension
 * completa (0deg = pierna recta), siempre positivo.
 *
 * legsPerPhoto:1 le dice al motor que esta foto solo tiene una cadena de
 * puntos relevante -- el motor generico ya sabe interpretar esto (ver
 * core/engine.js: legConfig/legsPerPhoto), no ha hecho falta tocarlo mas.
 */
AssessmentRegistry.register('aket', {
  label: 'AKET',
  enabled: true,
  legsPerPhoto: 1,
  points: ['hip', 'knee', 'ankle'],
  labels: ['trocánter mayor', 'epicóndilo femoral lateral', 'maléolo lateral'],
  angles: [
    { type: 'included', vertex: 'knee', ray1: 'hip', ray2: 'ankle', outPrefix: 'aket' }
  ],
  // formato de salida especifico de este test: "Left AKET" / "Right AKET"
  // (en Jurdan el lado va detras: "Shin angle left"). app.js respeta este flag.
  sideLabelPosition: 'before',
  outputLabels: { aket: 'AKET' }
});
