/**
 * assessments/jurdan.js
 * Configuracion del Jurdan Test. Este es el patron a seguir para futuros
 * assessments: un archivo, una llamada a AssessmentRegistry.register(...),
 * cero cambios en el core.
 */
AssessmentRegistry.register('jurdan', {
  label: 'Jurdan Test',
  enabled: true,
  roleLabel: { elevada: 'Shin angle', apoyo: 'Thigh angle' },
  roles: {
    elevada: {
      points: ['knee', 'ankle'],
      labels: ['rodilla', 'maléolo lateral'],
      angles: [{ pair: ['knee', 'ankle'], outPrefix: 'shin' }]
    },
    apoyo: {
      points: ['hip', 'knee', 'ankle'],
      labels: ['trocánter', 'rodilla', 'maléolo lateral'],
      angles: [
        { pair: ['hip', 'knee'], outPrefix: 'thigh' },
        { pair: ['knee', 'ankle'], outPrefix: 'rf', invert: true }
      ]
    }
  }
});
