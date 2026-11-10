/**
 * app.js
 * Orquestacion especifica de ESTA aplicacion (2 fotos + toggle de lado global
 * con piernas siempre opuestas). Usa el motor generico de core/engine.js sin
 * modificarlo. Un assessment futuro con otro flujo (p.ej. una sola foto)
 * compondria el motor de otra forma aqui, sin tocar core/.
 *
 * Solo contiene: selector de assessment, regla de lados, creacion de las dos fotos,
 * sidebar, panel de resultados y la coordinacion con el controlador de exportacion
 * (features/export-controller.js).
 */

// --- selector de test, poblado dinamicamente desde el registro ---
const testSelect = document.getElementById('testSelect');
AssessmentRegistry.list().forEach(t => {
  const opt = document.createElement('option');
  opt.value = t.key; opt.textContent = t.label; opt.disabled = !t.enabled;
  testSelect.appendChild(opt);
});
testSelect.value = AssessmentRegistry.getActiveKey();
testSelect.addEventListener('change', () => {
  AssessmentRegistry.setActive(testSelect.value);
  buildSidebar(); renderAll();
});

// --- regla de protocolo: Foto 1 y Foto 2 siempre testan piernas opuestas ---
let globalElevatedSideP1 = 'left';
document.querySelectorAll('#globalSideToggle button').forEach(btn => {
  btn.addEventListener('click', () => {
    globalElevatedSideP1 = btn.dataset.side;
    document.querySelectorAll('#globalSideToggle button').forEach(b => b.classList.toggle('active', b === btn));
    renderAll(); buildSidebar();
  });
});

function sideFor(photo) {
  const isP1 = photo.key === 'P1';
  const side = isP1 ? globalElevatedSideP1 : (globalElevatedSideP1 === 'left' ? 'right' : 'left');
  if (legsPerPhoto() === 1) {
    return { [photo.activeSlot]: side };
  }
  const elevadaLeg = photo.legRole.A === 'elevada' ? 'A' : 'B';
  return { [elevadaLeg]: side, [elevadaLeg === 'A' ? 'B' : 'A']: side === 'left' ? 'right' : 'left' };
}

document.querySelectorAll('.browse-btn').forEach(btn => {
  btn.addEventListener('click', () => document.getElementById(btn.dataset.target).click());
});

const photoP1 = Photo({ key: 'P1', dropId: 'dropP1', fileId: 'fileP1', stageInnerId: 'stageInnerP1', canvasId: 'canvasP1', zoomId: 'zoomLensP1', zoomCanvasId: 'zoomCanvasP1', statusId: 'statusP1', sideFor });
const photoP2 = Photo({ key: 'P2', dropId: 'dropP2', fileId: 'fileP2', stageInnerId: 'stageInnerP2', canvasId: 'canvasP2', zoomId: 'zoomLensP2', zoomCanvasId: 'zoomCanvasP2', statusId: 'statusP2', sideFor });
photoP1.onChange = () => { renderAll(); buildSidebar(); };
photoP2.onChange = () => { renderAll(); buildSidebar(); };

// --- exportacion (PNG, SVG, copiar al portapapeles): vive en features/export-controller.js; aqui solo se crea y se coordina ---
const exportController = ExportController.create([
  { photo: photoP1, canvasId: 'canvasP1', defaultName: 'foto-1', suffix: 'P1' },
  { photo: photoP2, canvasId: 'canvasP2', defaultName: 'foto-2', suffix: 'P2' }
]);

function buildSidebar() {
  const container = document.getElementById('photosContainer');
  container.innerHTML = '';
  const cfg = AssessmentRegistry.getActive();
  [['Foto 1', photoP1], ['Foto 2', photoP2]].forEach(([label, photo]) => {
    if (!photo.ready) return;
    const legSide = sideFor(photo);
    const card = document.createElement('div'); card.className = 'photo-card';
    let rows = '';
    const legsToShow = legsPerPhoto() === 1 ? [photo.activeSlot] : ['A', 'B'];
    legsToShow.forEach(leg => {
      const roleLabel = cfg.roles ? cfg.roleLabel[photo.legRole[leg]] : (cfg.label || 'Medida');
      const roleClass = cfg.roles ? photo.legRole[leg] : 'elevada'; // sin roles (1 pierna): la pierna elegida es la relevante/elevada
      const sc = SIDE_COLORS[legSide[leg]];
      const sideLabel = legSide[leg] === 'left' ? 'Izquierda' : 'Derecha';
      rows += `<div class="leg-line"><span class="swatch" style="background:${sc}"></span>
        Pierna (<span style="color:${sc};font-weight:800;">${sideLabel}</span>)
        <span class="role-tag ${roleClass}">${roleLabel}</span></div>`;
    });
    card.innerHTML = `<div class="ptitle">${label}</div>${rows}`;
    container.appendChild(card);
  });
}

function updateResults() {
  updateResultsPanel();
  notifyHost();
}
function updateResultsPanel() {
  const cfg = AssessmentRegistry.getActive();
  // claves de salida derivadas del propio registro -- soporta tests con "roles" (Jurdan)
  // y tests planos de 1 pierna (AKET), se adapta solo a cualquier numero de angulos futuro
  const allPrefixes = [];
  const angleDefs = cfg.roles ? Object.values(cfg.roles).flatMap(r => r.angles) : cfg.angles;
  angleDefs.forEach(a => { if (!allPrefixes.includes(a.outPrefix)) allPrefixes.push(a.outPrefix); });
  const results = {};
  allPrefixes.forEach(p => { results[p + '-left'] = null; results[p + '-right'] = null; });

  [photoP1, photoP2].forEach(photo => {
    if (!photo.ready) return;
    const legSide = sideFor(photo);
    const legs = legsPerPhoto() === 1 ? [photo.activeSlot] : ['A', 'B'];
    legs.forEach(leg => {
      activeAngles(photo, leg).forEach(a => { results[a.outPrefix + '-' + legSide[leg]] = a.deg; });
    });
  });

  const LABELS = Object.assign({ shin: 'Shin angle', thigh: 'Thigh angle', rf: 'RF angle' }, cfg.outputLabels || {});
  const sideFirst = cfg.sideLabelPosition === 'before';
  document.getElementById('resultsPanel').innerHTML = Object.entries(results).map(([key, val]) => {
    const [prefix, side] = key.split('-');
    const sc = SIDE_COLORS[side];
    const sideSpan = `<span style="color:${sc};font-weight:800;">${side.charAt(0).toUpperCase() + side.slice(1)}</span>`;
    const name = LABELS[prefix] || prefix;
    const label = sideFirst ? `${sideSpan} ${name}` : `${name} <span style="color:${sc};font-weight:800;">${side}</span>`;
    const valid = isValidMeasurement(val);
    const shown = formatMeasurement(val); // '—' si es invalida (null, NaN, Infinity)
    return `<div class="result-row" style="border-left:3px solid ${sc};padding-left:8px;"><span class="label">${label}</span><span class="val ${valid ? '' : 'pending'}" id="out-${key}" style="${valid ? 'color:' + sc : ''}">${shown}</span></div>`;
  }).join('');
}

function renderAll() { photoP1.render(); photoP2.render(); updateResults(); exportController.update(); }

// --- Integracion con el dashboard (10/11/2026) ---
// Si esta pagina va dentro de un marco del dashboard (mismo origen), le comunica los resultados vigentes y obedece a «reiniciar».
// No cambia ningun calculo: solo lee lo que updateResults() ya muestra. Abierta sola, no hace nada.
function currentResults() {
  const out = {};
  document.querySelectorAll('#resultsPanel .val[id^="out-"]').forEach(el => {
    const v = parseFloat(el.textContent); // «74.5°» -> 74.5 ; «—» -> NaN
    out[el.id.slice(4)] = Number.isFinite(v) ? v : null;
  });
  return out;
}
function notifyHost() {
  if (window.parent === window) return;
  const origin = location.origin === 'null' ? '*' : location.origin;
  window.parent.postMessage({ type: 'gfc-angulos', test: AssessmentRegistry.getActiveKey(), results: currentResults(), photos: { P1: photoP1.getStatus(), P2: photoP2.getStatus() } }, origin);
}
window.addEventListener('message', e => {
  if (e.source !== window.parent || (location.origin !== 'null' && e.origin !== location.origin)) return;
  if (e.data && e.data.type === 'gfc-angulos-reiniciar') { photoP1.reset(); photoP2.reset(); buildSidebar(); updateResults(); exportController.reset(); }
});

document.getElementById('copyBtn').addEventListener('click', () => {
  const rows = Array.from(document.querySelectorAll('#resultsPanel .result-row'));
  const text = rows.map(r => `${r.querySelector('.label').textContent}: ${r.querySelector('.val').textContent}`).join('\n');
  navigator.clipboard.writeText(text).then(() => {
    const b = document.getElementById('copyBtn'); b.textContent = 'Copiado ✓'; b.classList.add('copied');
    setTimeout(() => { b.textContent = 'Copiar resultados'; b.classList.remove('copied'); }, 1600);
  });
});

document.getElementById('resetBtn').addEventListener('click', () => { photoP1.reset(); photoP2.reset(); buildSidebar(); updateResults(); exportController.reset(); });
window.addEventListener('resize', () => { photoP1.refit(); photoP2.refit(); });
updateResults(); // el panel de resultados se inicializa al arrancar (todas las filas en «—»)
window.__test__ = { photoP1, photoP2, angleUpPositive, sideFor, detectPoints, AssessmentRegistry };
