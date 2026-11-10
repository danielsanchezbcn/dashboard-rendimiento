/**
 * core/engine.js
 * Motor generico compartido por cualquier assessment: carga de imagen,
 * deteccion IA con fallback manual, arrastre de landmarks, lupa de precision,
 * calculo de angulos y renderizado. No contiene NINGUN dato especifico de
 * "Jurdan" -- todo lo especifico llega via AssessmentRegistry.getActive().
 *
 * Para anadir un assessment nuevo no se toca este archivo.
 */
const CYAN = '#4CD9E8';

/** Config de la pierna activa: soporta tests con "roles" (Jurdan, 2 piernas)
 *  y tests "planos" sin roles (AKET, 1 pierna por foto). */
function legConfig(photo, leg) {
  const cfg = AssessmentRegistry.getActive();
  if (cfg.roles) return cfg.roles[photo.legRole[leg]];
  return cfg; // test plano: points/labels/angles viven en la raiz de la config
}
function legsPerPhoto() {
  return AssessmentRegistry.getActive().legsPerPhoto || 2;
}
function activeJoints(photo, leg) {
  const cfg = legConfig(photo, leg);
  return cfg.points.map(j => ({ joint: j, pt: photo.points[leg][j] }));
}
function activeAngles(photo, leg) {
  const cfg = legConfig(photo, leg);
  return cfg.angles.map(a => {
    let deg;
    if (a.type === 'included') {
      deg = includedAngleSupplement(photo.points[leg][a.vertex], photo.points[leg][a.ray1], photo.points[leg][a.ray2]);
    } else {
      const rawDeg = angleUpPositive(photo.points[leg][a.pair[0]], photo.points[leg][a.pair[1]]);
      deg = rawDeg === null ? null : (a.invert ? -rawDeg : rawDeg); // la medicion invalida se conserva como null
    }
    const labelPts = a.type === 'included'
      ? [photo.points[leg][a.vertex], photo.points[leg][a.ray1]] // ancla visual de la etiqueta junto al vertice
      : [photo.points[leg][a.pair[0]], photo.points[leg][a.pair[1]]];
    return { outPrefix: a.outPrefix, p1: labelPts[0], p2: labelPts[1], deg };
  });
}
function sideColor(photo, leg, sideForFn) { return SIDE_COLORS[sideForFn(photo)[leg]]; }

/**
 * Crea el controlador de una foto (una de las dos columnas de la app).
 * @param {object} opts.ids        - ids de los elementos DOM involucrados
 * @param {function} opts.sideFor  - (photo) => {A:'left'|'right', B:...} -- logica de lado, la decide app.js
 */
function Photo({ key, dropId, fileId, stageInnerId, canvasId, zoomId, zoomCanvasId, statusId, sideFor }) {
  const dropzone = document.getElementById(dropId), fileInput = document.getElementById(fileId);
  const stageInner = document.getElementById(stageInnerId), canvas = document.getElementById(canvasId);
  const statusTag = document.getElementById(statusId);
  const ctx = canvas.getContext('2d');
  const zoomLens = document.getElementById(zoomId), zoomCanvas = document.getElementById(zoomCanvasId);
  const zctx = zoomCanvas.getContext('2d');
  const img = new Image();
  let scale = 1;
  const photo = { key, canvas, points: null, legRole: null, activeSlot: 'A', ready: false, dragging: null, generation: 0, detection: null, adjusted: false, onChange: null };

  function notify() { if (photo.onChange) photo.onChange(); }

  // ---- Estado de la deteccion de cada foto ----
  // photo.detection (se fija UNA vez, al cargar): { status: 'AUTO' | 'REVISAR' | 'MANUAL', quality, reason }
  //   AUTO     MediaPipe detecto la pose y los 6 landmarks superan los umbrales (ver assessDetectionQuality).
  //   REVISAR  hay pose y se conservan sus coordenadas, pero algun landmark no supera los umbrales. No bloquea nada.
  //   MANUAL   MediaPipe fallo o no detecto ninguna pose: se usa el posicionamiento de respaldo (quality = null).
  // photo.adjusted: pasa a true en cuanto el usuario desplaza un landmark y dura hasta cargar otra foto o reiniciar.
  // Se muestra AJUSTADO si photo.adjusted y, si no, photo.detection.status. render() no interviene en nada de esto.
  const STATUS_CLASS = { AUTO: 'auto', REVISAR: 'review', MANUAL: 'manual', AJUSTADO: 'adjusted' };
  const JOINT_ES = { hip: 'cadera', knee: 'rodilla', ankle: 'tobillo' };
  const round2 = v => String(Math.round(v * 100) / 100);
  function currentStatus() { return photo.adjusted ? 'AJUSTADO' : photo.detection.status; }
  function statusTitle(status) {
    const d = photo.detection, q = d.quality;
    if (status === 'AJUSTADO') return 'AJUSTADO — Has desplazado manualmente al menos un landmark; se mantiene hasta cargar otras fotos. Detección original: ' + d.status + '.';
    if (status === 'MANUAL') return 'MANUAL — MediaPipe falló o no detectó ninguna pose (' + d.reason + '). Se usa el posicionamiento de respaldo: coloca los puntos a mano.';
    const thr = 'visibilidad ≥ ' + q.thresholds.visibility + (q.presenceAvailable ? ' y presencia ≥ ' + q.thresholds.presence : '');
    const noPresence = q.presenceAvailable ? '' : ' La presencia no la devuelve esta versión de MediaPipe: solo se evalúa la visibilidad.';
    if (status === 'AUTO') return 'AUTO — MediaPipe detectó la pose y los ' + q.evaluated + ' landmarks (cadera, rodilla y tobillo de cada pierna) superan los umbrales (' + thr + ').' + noPresence;
    const list = q.failing.map(f => JOINT_ES[f.joint] + ' (' + [
      !f.visibilityOk ? 'visibilidad ' + (f.visibility === null ? 'sin valor' : round2(f.visibility)) : '',
      f.presenceOk === false ? 'presencia ' + (f.presence === null ? 'sin valor' : round2(f.presence)) : ''].filter(Boolean).join(', ') + ')').join('; ');
    return 'REVISAR — Hay pose y se conservan sus coordenadas, pero ' + q.failing.length + ' de ' + q.evaluated + ' landmarks no superan los umbrales (' + thr + '): ' + list + '. Revisa esos puntos; la medición no se bloquea.' + noPresence;
  }
  function showStatus() {
    if (!photo.detection) return;
    const s = currentStatus();
    statusTag.style.display = 'inline-block';
    statusTag.textContent = s; statusTag.className = 'status-tag ' + STATUS_CLASS[s]; statusTag.title = statusTitle(s);
  }
  function showLoadingStatus() {
    statusTag.style.display = 'inline-block'; statusTag.textContent = 'detectando…'; statusTag.className = 'status-tag loading'; statusTag.title = '';
  }

  function fitCanvas() {
    const stageEl = canvas.closest('.stage');
    const topEl = stageEl.querySelector('.stage-top');
    const exportEl = stageEl.querySelector('.export-block'); // espacio reservado para los controles de exportacion
    const exportH = exportEl ? exportEl.offsetHeight + 22 : 0; // + holgura visual entre canvas y controles
    const availW = stageEl.clientWidth - 8;
    const availH = stageEl.clientHeight - topEl.offsetHeight - exportH - 10;
    scale = Math.min(availW / photo.imgW, availH / photo.imgH, 1);
    canvas.width = photo.imgW * scale; canvas.height = photo.imgH * scale;
  }

  // Clasificacion INICIAL, una sola vez por carga (tras una deteccion o un fallback correctos). Calcula los DOS estados
  // con independencia del assessment activo, para que sigan disponibles si luego se cambia de assessment:
  //  - legRole: que slot es elevada/apoyo (la elevada es la de rodilla y tobillo mas altos en la imagen).
  //  - activeSlot: que slot es la pierna relevante en los tests de una pierna (la de muslo mas vertical).
  // Despues solo un clic principal intencionado sobre una pierna (selectLeg) puede cambiarlos; render() nunca los toca.
  function classifyInitialState() {
    const ay = (photo.points.A.knee.y + photo.points.A.ankle.y) / 2;
    const by = (photo.points.B.knee.y + photo.points.B.ankle.y) / 2;
    photo.legRole = ay < by ? { A: 'elevada', B: 'apoyo' } : { A: 'apoyo', B: 'elevada' };
    const rawA = angleUpPositive(photo.points.A.hip, photo.points.A.knee);
    const rawB = angleUpPositive(photo.points.B.hip, photo.points.B.knee);
    // una medicion invalida (null) nunca gana; si ninguna es valida se mantiene A (valor por defecto)
    const thighAngleA = rawA === null ? -Infinity : Math.abs(rawA);
    const thighAngleB = rawB === null ? -Infinity : Math.abs(rawB);
    photo.activeSlot = thighAngleA >= thighAngleB ? 'A' : 'B';
  }

  // Clic principal intencionado sobre una pierna: esa pasa a ser la relevante/elevada y la otra se asigna sola.
  function selectLeg(leg) {
    if (legsPerPhoto() === 1) { photo.activeSlot = leg; return; }
    const other = leg === 'A' ? 'B' : 'A';
    photo.legRole[leg] = 'elevada'; photo.legRole[other] = 'apoyo';
  }

  async function loadFile(file) {
    if (!file || !file.type.startsWith('image/')) return;
    const gen = ++photo.generation; // cada carga nueva obtiene una generacion distinta; reset() tambien invalida las pendientes
    const reader = new FileReader();
    reader.onload = e => {
      if (gen !== photo.generation) return;
      img.onload = async () => {
        if (gen !== photo.generation) return;
        const w = img.naturalWidth, h = img.naturalHeight;
        photo.imgW = w; photo.imgH = h;
        dropzone.style.display = 'none'; stageInner.style.display = 'flex';
        fitCanvas();
        showLoadingStatus();
        let pts, detection;
        try {
          const result = await detectPoints(img, w, h); // { points, quality }
          pts = result.points; detection = { status: result.quality.status, quality: result.quality, reason: null };
        } catch (err) {
          // Cualquier fallo de MediaPipe (red, creacion, tiempo de espera, sin pose, landmarks invalidos) afecta SOLO a la deteccion
          console.warn('Deteccion IA no disponible, usando fallback manual:', err);
          pts = seedPointsFallback(w, h);
          detection = { status: 'MANUAL', quality: null, reason: (err && err.message) ? err.message : String(err) };
        }
        if (gen !== photo.generation) return; // reset() o una carga mas reciente: esta deteccion ya no vale y no confirma nada
        photo.points = pts; photo.detection = detection; photo.adjusted = false; showStatus();
        classifyInitialState();
        photo.ready = true;
        notify();
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  const toCanvas = p => ({ x: p.x * scale, y: p.y * scale });
  const toImage = (x, y) => ({ x: x / scale, y: y / scale });

  photo.render = () => {
    if (!photo.ready) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const legsToDraw = legsPerPhoto() === 1 ? [photo.activeSlot] : ['A', 'B'];
    legsToDraw.forEach(leg => {
      const joints = activeJoints(photo, leg);
      const angles = activeAngles(photo, leg);
      const color = sideColor(photo, leg, sideFor);
      const usesIncluded = legConfig(photo, leg).angles.some(a => a.type === 'included');

      ctx.lineWidth = 2.5; ctx.strokeStyle = color;
      for (let i = 0; i < joints.length - 1; i++) {
        const c1 = toCanvas(joints[i].pt), c2 = toCanvas(joints[i + 1].pt);
        ctx.beginPath(); ctx.moveTo(c1.x, c1.y); ctx.lineTo(c2.x, c2.y); ctx.stroke();
      }
      if (!usesIncluded) {
        const cFirst = toCanvas(joints[0].pt);
        ctx.save(); ctx.setLineDash([5, 5]); ctx.strokeStyle = CYAN; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(cFirst.x - 35, cFirst.y); ctx.lineTo(cFirst.x + 35, cFirst.y); ctx.stroke(); ctx.restore();
        if (joints.length === 3) {
          const cMid = toCanvas(joints[1].pt);
          ctx.save(); ctx.setLineDash([5, 5]); ctx.strokeStyle = CYAN; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.moveTo(cMid.x - 35, cMid.y); ctx.lineTo(cMid.x + 35, cMid.y); ctx.stroke(); ctx.restore();
        }
      }

      const drawable = angles.filter(a => isValidMeasurement(a.deg)); // una medicion invalida no dibuja etiqueta
      const labelPositions = drawable.map(a => mid(toCanvas(a.p1), toCanvas(a.p2)));
      const MIN_GAP = 26;
      for (let i = 1; i < labelPositions.length; i++) {
        const prev = labelPositions[i - 1], cur = labelPositions[i];
        const dist = Math.hypot(cur.x - prev.x, cur.y - prev.y);
        if (dist < MIN_GAP) {
          const push = (MIN_GAP - dist) / 2 + 2;
          prev.y -= push; cur.y += push;
        }
      }
      drawable.forEach((a, i) => { drawLabel(ctx, labelPositions[i], formatMeasurement(a.deg), color); });

      joints.forEach(({ pt }) => {
        const c = toCanvas(pt);
        const armLen = 9, dot = 2;
        ctx.lineWidth = 3.5; ctx.strokeStyle = '#0A0A0B';
        ctx.beginPath(); ctx.moveTo(c.x - armLen, c.y); ctx.lineTo(c.x + armLen, c.y);
        ctx.moveTo(c.x, c.y - armLen); ctx.lineTo(c.x, c.y + armLen); ctx.stroke();
        ctx.lineWidth = 1.5; ctx.strokeStyle = color;
        ctx.beginPath(); ctx.moveTo(c.x - armLen, c.y); ctx.lineTo(c.x + armLen, c.y);
        ctx.moveTo(c.x, c.y - armLen); ctx.lineTo(c.x, c.y + armLen); ctx.stroke();
        ctx.beginPath(); ctx.arc(c.x, c.y, dot, 0, Math.PI * 2);
        ctx.fillStyle = color; ctx.fill();
      });
    });
  };

  function hitPoint(x, y) {
    const legs = legsPerPhoto() === 1 ? [photo.activeSlot] : ['A', 'B'];
    for (const leg of legs) for (const { joint, pt } of activeJoints(photo, leg)) {
      const c = toCanvas(pt); if (Math.hypot(c.x - x, c.y - y) < 14) return { leg, joint };
    }
    return null;
  }
  function nearestLeg(x, y) {
    // usa siempre la cadena cruda cadera-rodilla-tobillo de AMBOS slots, no solo
    // el activo -- asi, en tests de 1 pierna, se puede pinchar la pierna
    // detectada pero no activa para intercambiarla.
    const imgPt = toImage(x, y); let best = null, bestD = Infinity;
    for (const leg of ['A', 'B']) {
      const p = photo.points[leg];
      const chain = [p.hip, p.knee, p.ankle].filter(Boolean);
      for (let i = 0; i < chain.length - 1; i++) {
        const d = distToSegment(imgPt, chain[i], chain[i + 1]);
        if (d !== null && d < bestD) { bestD = d; best = leg; }
      }
    }
    return best;
  }
  function getPos(e) {
    const r = canvas.getBoundingClientRect();
    return { x: (e.touches ? e.touches[0].clientX : e.clientX) - r.left, y: (e.touches ? e.touches[0].clientY : e.clientY) - r.top };
  }
  function showZoom(cx, cy) {
    zoomLens.style.display = 'block';
    // Posicion de la lupa: primero ENCIMA del landmark (comportamiento previo); si no cabe, DEBAJO;
    // si tampoco, a la DERECHA y despues a la IZQUIERDA. Al final se limita a stageInner con las
    // dimensiones reales (no se asume 210 px). Se recalcula en cada llamada (cada movimiento del arrastre).
    const lw = zoomLens.offsetWidth, lh = zoomLens.offsetHeight;
    const boxW = stageInner.clientWidth, boxH = stageInner.clientHeight;
    const px = canvas.offsetLeft + cx, py = canvas.offsetTop + cy; // landmark en coordenadas de stageInner
    const GAP = 20; // margen entre landmark y lupa (mismo valor que el comportamiento previo)
    const above = { left: px - lw / 2, top: py - lh - GAP };
    const below = { left: px - lw / 2, top: py + GAP };
    const right = { left: px + GAP, top: py - lh / 2 };
    const leftSide = { left: px - lw - GAP, top: py - lh / 2 };
    let pos;
    if (above.top >= 0) pos = above;
    else if (below.top + lh <= boxH) pos = below;
    else if (right.left + lw <= boxW) pos = right;
    else if (leftSide.left >= 0) pos = leftSide;
    else pos = above;
    zoomLens.style.left = Math.max(0, Math.min(pos.left, boxW - lw)) + 'px';
    zoomLens.style.top = Math.max(0, Math.min(pos.top, boxH - lh)) + 'px';
    const SRC = 70; // 210/70 = 3x, mismo factor de zoom que antes (120/40=3x), con mas contexto visible
    zctx.clearRect(0, 0, 210, 210);
    zctx.imageSmoothingEnabled = false;
    zctx.drawImage(canvas, cx - SRC / 2, cy - SRC / 2, SRC, SRC, 0, 0, 210, 210);
    zctx.strokeStyle = CYAN; zctx.lineWidth = 1.25;
    zctx.beginPath(); zctx.moveTo(105, 0); zctx.lineTo(105, 210); zctx.stroke();
    zctx.beginPath(); zctx.moveTo(0, 105); zctx.lineTo(210, 105); zctx.stroke();
  }
  function hideZoom() { zoomLens.style.display = 'none'; }

  let downPos = null, moved = false, mainButtonDown = false, activePointerId = null;

  // Limpia TODA la interaccion en curso (arrastre, clic pendiente, lupa y captura de puntero). Se usa al reiniciar, al
  // cancelarse la interaccion y cuando el puntero abandona el canvas, para no dejar estados bloqueados.
  function clearInteraction() {
    if (activePointerId !== null) {
      try { if (canvas.hasPointerCapture(activePointerId)) canvas.releasePointerCapture(activePointerId); } catch (err) { /* ya liberada */ }
    }
    photo.dragging = null; downPos = null; moved = false; mainButtonDown = false; activePointerId = null;
    hideZoom();
  }

  canvas.addEventListener('pointerdown', e => {
    // Solo el boton principal (0) puede iniciar una interaccion. El boton secundario (menu contextual) y el central
    // no deben tocar downPos, dragging ni ningun estado de seleccion de pierna.
    if (e.button !== 0) return;
    clearInteraction(); // toda interaccion nueva parte de un estado limpio
    mainButtonDown = true; activePointerId = e.pointerId;
    const pos = getPos(e); downPos = pos; moved = false;
    const hit = hitPoint(pos.x, pos.y);
    if (hit) {
      photo.dragging = hit;
      try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* sin captura: pointerleave cancelara la interaccion */ }
      showZoom(pos.x, pos.y);
    }
  });
  canvas.addEventListener('pointermove', e => {
    if (!mainButtonDown || e.pointerId !== activePointerId) return;
    if (e.buttons === 0) { clearInteraction(); notify(); return; } // el boton se solto sin que lo viesemos: sin arrastre fantasma
    const pos = getPos(e);
    if (downPos && Math.hypot(pos.x - downPos.x, pos.y - downPos.y) > 4) moved = true;
    if (!photo.dragging) return;
    const cx = Math.max(0, Math.min(canvas.width, pos.x)), cy = Math.max(0, Math.min(canvas.height, pos.y));
    const prev = photo.points[photo.dragging.leg][photo.dragging.joint], next = toImage(cx, cy);
    if (next.x !== prev.x || next.y !== prev.y) {
      // El usuario desplaza el landmark: ya no hay confianza de MediaPipe para esa posicion, y la foto pasa a AJUSTADO (persistente).
      photo.points[photo.dragging.leg][photo.dragging.joint] = makeLandmark(next.x, next.y);
      if (!photo.adjusted) { photo.adjusted = true; showStatus(); }
    }
    showZoom(cx, cy);
    notify();
  });
  canvas.addEventListener('pointerup', e => {
    // Solo cuenta el pointerup de ESA misma interaccion y del boton principal: un pointerup suelto (sin pointerdown
    // propio) no puede reasignar nada. Hay reasignacion solo si no hubo arrastre ni se movia un landmark.
    if (!mainButtonDown || e.pointerId !== activePointerId || e.button !== 0) return;
    if (!photo.dragging && downPos && !moved) {
      const leg = nearestLeg(downPos.x, downPos.y);
      if (leg) selectLeg(leg);
    }
    clearInteraction(); notify();
  });
  canvas.addEventListener('pointercancel', e => {
    // Solo limpieza de estado -- nunca selecciona pierna ni cambia elevada/apoyo.
    if (activePointerId !== null && e.pointerId !== activePointerId) return;
    clearInteraction(); notify();
  });
  canvas.addEventListener('pointerleave', e => {
    // Sin captura de puntero, soltar fuera del canvas no entregaria el pointerup: la interaccion se cancela entera.
    if (activePointerId !== null && e.pointerId !== activePointerId) return;
    clearInteraction();
  });

  ['dragover', 'dragenter'].forEach(evt => dropzone.addEventListener(evt, e => { e.preventDefault(); dropzone.classList.add('drag'); }));
  ['dragleave', 'drop'].forEach(evt => dropzone.addEventListener(evt, e => { e.preventDefault(); dropzone.classList.remove('drag'); }));
  dropzone.addEventListener('drop', e => loadFile(e.dataTransfer.files[0]));
  fileInput.addEventListener('change', e => loadFile(e.target.files[0]));

  photo.reset = () => {
    photo.generation++; // invalida cualquier carga o deteccion pendiente: nunca podra restaurar la foto
    clearInteraction();
    img.onload = null;
    photo.ready = false; img.src = '';
    photo.detection = null; photo.adjusted = false;
    stageInner.style.display = 'none'; dropzone.style.display = 'flex'; fileInput.value = '';
    statusTag.style.display = 'none';
  };
  photo.getStatus = () => (photo.ready && photo.detection) ? currentStatus() : null; // AUTO | REVISAR | MANUAL | AJUSTADO
  photo.refit = () => { if (photo.ready) { fitCanvas(); photo.render(); } };
  return photo;
}
