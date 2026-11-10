/**
 * core/registry.js
 * Registro compartido de assessments (tests). Cada assessment se registra a si
 * mismo ejecutando su propio <script src="assessments/xxx.js">, sin fetch ni
 * import de JSON -- esto es deliberado: fetch() de archivos locales falla por
 * CORS al abrir con file://, y este proyecto debe poder abrirse sin servidor
 * y empaquetarse en una futura app de escritorio (Electron/Tauri/WebView2).
 *
 * Anadir un assessment nuevo = crear js/assessments/nombre.js que llame a
 * AssessmentRegistry.register(...) y anadir una linea <script> en index.html.
 * Ningun archivo del core necesita tocarse.
 */
const AssessmentRegistry = (function () {
  const tests = {};
  let active = null;

  function register(key, config) {
    tests[key] = config;
    if (active === null) active = key;
  }
  function get(key) { return tests[key]; }
  function list() { return Object.entries(tests).map(([key, cfg]) => ({ key, ...cfg })); }
  function setActive(key) { if (tests[key]) active = key; }
  function getActive() { return tests[active]; }
  function getActiveKey() { return active; }

  return { register, get, list, setActive, getActive, getActiveKey };
})();
