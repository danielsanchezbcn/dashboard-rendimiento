/**
 * features/export-controller.js
 * Exportacion de cada fotografia: «Descargar PNG», «Descargar SVG» y «Copiar PNG para PowerPoint».
 * Solo LEE el canvas de su propia foto: no recalcula angulos y no toca landmarks, lados, piernas ni roles.
 * Un fallo aqui nunca afecta al canvas ni a la asignacion.
 *
 * INTERFAZ GLOBAL (unica; script clasico, sin modulos, funciona con file://):
 *
 *   const controller = ExportController.create([
 *     { photo, canvasId: 'canvasP1', defaultName: 'foto-1', suffix: 'P1' },
 *     { photo, canvasId: 'canvasP2', defaultName: 'foto-2', suffix: 'P2' }
 *   ]);
 *   controller.update();  // muestra/activa el bloque de cada foto solo cuando photo.ready es true
 *   controller.reset();   // estado inicial: nombre vacio, texto original, sin mensajes, temporizadores cancelados
 *
 * `photo` es cualquier objeto con la propiedad booleana `ready`. Los elementos del bloque se buscan por id con el
 * sufijo indicado: export<suffix>, exportName<suffix>, exportPng<suffix>, exportSvg<suffix>, exportCopy<suffix>,
 * exportHint<suffix>. Todo lo demas de este archivo es privado.
 */
const ExportController = (function () {
  const EXPORT_HINT_DEFAULT = 'El PNG conserva exactamente la apariencia. El SVG conserva la composición, aunque la fotografía seguirá siendo raster.';
  const EXPORT_COPY_LABEL = 'Copiar PNG para PowerPoint';
  const EXPORT_COPY_ERROR = 'No se pudo copiar la imagen: el navegador no permite escribir imágenes en el portapapeles. Puedes reintentarlo o usar «Descargar PNG».';
  const EXPORT_FILE_ERROR = 'No se pudo generar el archivo. Inténtalo de nuevo.';

  /** Nombre final: recorta, quita .png/.svg ya escritos por el usuario y anade la extension una sola vez. */
  function exportFileName(rawName, defaultName, ext) {
    let base = (rawName || '').trim();
    while (/\.(png|svg)$/i.test(base)) base = base.replace(/\.(png|svg)$/i, '').trim();
    if (!base) base = defaultName;
    return base + '.' + ext;
  }

  /** PNG del canvas tal cual esta ahora (sin reescalar ni redibujar). */
  function canvasToPngBlob(canvas, photo) {
    // Los nombres de los puntos (Hip / Knee / Ankle) son una ayuda de pantalla: se quitan un instante para que el PNG salga como siempre.
    if (photo) { photo.exporting = true; photo.render(); }
    const p = new Promise((resolve, reject) => {
      canvas.toBlob(b => b ? resolve(b) : reject(new Error('toBlob devolvio null')), 'image/png'); // toBlob toma la imagen en el momento de la llamada
    });
    if (photo) { photo.exporting = false; photo.render(); }
    return p;
  }

  function triggerDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000); // liberar una vez iniciada la descarga
  }

  function showExportMessage(cfg, text) {
    clearTimeout(cfg.msgTimer);
    cfg.hint.textContent = text; cfg.hint.classList.add('is-error');
    cfg.msgTimer = setTimeout(() => clearExportMessage(cfg), 6000);
  }
  function clearExportMessage(cfg) {
    clearTimeout(cfg.msgTimer);
    cfg.hint.textContent = EXPORT_HINT_DEFAULT; cfg.hint.classList.remove('is-error');
  }

  async function exportPng(cfg) {
    const blob = await canvasToPngBlob(document.getElementById(cfg.canvasId), cfg.photo);
    triggerDownload(blob, exportFileName(cfg.name.value, cfg.defaultName, 'png'));
  }

  /** Contenedor SVG de la composicion raster (NO es una vectorizacion): mismas dimensiones que el canvas + <image> con su PNG. */
  async function exportSvg(cfg) {
    const canvas = document.getElementById(cfg.canvasId);
    const w = canvas.width, h = canvas.height;
    const blob = await canvasToPngBlob(canvas, cfg.photo);
    const dataUrl = await new Promise((resolve, reject) => {
      const r = new FileReader(); r.onload = () => resolve(r.result); r.onerror = () => reject(r.error); r.readAsDataURL(blob);
    });
    const svg = '<?xml version="1.0" encoding="UTF-8"?>\n' +
      `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">` +
      `<image x="0" y="0" width="${w}" height="${h}" xlink:href="${dataUrl}"/></svg>`;
    triggerDownload(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }), exportFileName(cfg.name.value, cfg.defaultName, 'svg'));
  }

  async function exportCopy(cfg) {
    const canvas = document.getElementById(cfg.canvasId);
    try {
      if (!navigator.clipboard || !navigator.clipboard.write || typeof ClipboardItem === 'undefined') throw new Error('clipboard-unsupported');
      // write() se invoca de forma sincrona dentro del clic (la activacion de usuario se conserva) y recibe la promesa del PNG
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': canvasToPngBlob(canvas, cfg.photo) })]);
    } catch (err) {
      console.warn('Copia al portapapeles no disponible:', err);
      showExportMessage(cfg, EXPORT_COPY_ERROR); // sin descarga sustitutiva
      return;
    }
    clearTimeout(cfg.copyTimer);
    cfg.copy.style.minWidth = cfg.copy.offsetWidth + 'px'; // evita saltos de maquetacion al cambiar el texto
    cfg.copy.textContent = 'Copiado ✓';
    cfg.copyTimer = setTimeout(() => { cfg.copy.textContent = EXPORT_COPY_LABEL; cfg.copy.style.minWidth = ''; }, 1500);
  }

  function runExport(cfg, action) {
    clearExportMessage(cfg);
    Promise.resolve().then(() => action(cfg)).catch(err => {
      console.warn('Exportacion fallida:', err);
      showExportMessage(cfg, EXPORT_FILE_ERROR);
    });
  }

  /** Crea el controlador de exportacion de un conjunto de fotografias (ver la interfaz arriba). */
  function create(blockConfigs) {
    const blocks = blockConfigs.map(c => ({
      photo: c.photo, canvasId: c.canvasId, defaultName: c.defaultName, suffix: c.suffix, msgTimer: null, copyTimer: null,
      block: document.getElementById('export' + c.suffix),
      name:  document.getElementById('exportName' + c.suffix),
      png:   document.getElementById('exportPng' + c.suffix),
      svg:   document.getElementById('exportSvg' + c.suffix),
      copy:  document.getElementById('exportCopy' + c.suffix),
      hint:  document.getElementById('exportHint' + c.suffix)
    }));

    blocks.forEach(cfg => {
      cfg.png.addEventListener('click', () => runExport(cfg, exportPng));
      cfg.svg.addEventListener('click', () => runExport(cfg, exportSvg));
      cfg.copy.addEventListener('click', () => { clearExportMessage(cfg); exportCopy(cfg); });
    });

    /** Controles visibles/activos solo cuando su fotografia esta cargada. */
    function update() {
      blocks.forEach(cfg => {
        const on = !!cfg.photo.ready;
        cfg.block.classList.toggle('ready', on);
        [cfg.name, cfg.png, cfg.svg, cfg.copy].forEach(el => { el.disabled = !on; });
      });
    }
    /** Estado inicial: ocultos/desactivados, nombre vacio, texto original, sin mensajes. */
    function reset() {
      blocks.forEach(cfg => {
        clearTimeout(cfg.copyTimer);
        cfg.name.value = '';
        cfg.copy.textContent = EXPORT_COPY_LABEL; cfg.copy.style.minWidth = '';
        clearExportMessage(cfg);
      });
      update();
    }

    return { update, reset };
  }

  return { create };
})();
