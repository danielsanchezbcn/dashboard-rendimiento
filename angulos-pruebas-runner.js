/**
 * tests/runner.js
 * Mini ejecutor de pruebas sin dependencias. Se ejecuta solo al cargar la pagina
 * (DOMContentLoaded), cuando geometry.tests.js ya ha registrado sus pruebas.
 * Deja el resultado en window.__TEST_RESULTS__ y en document.body.dataset.status.
 */
const Runner = (function () {
  const suites = [];
  const loadErrors = [];
  let current = null;

  // Errores de carga o de sintaxis en cualquier script (incluidos los de la aplicacion) y scripts que no se pueden cargar.
  window.addEventListener('error', e => {
    const t = e.target;
    if (t && t.tagName === 'SCRIPT') loadErrors.push(`No se pudo cargar ${t.getAttribute('src')}`);
    else loadErrors.push(`${e.filename ? e.filename.split('/').pop() + ': ' : ''}${e.message}`);
  }, true);

  function suite(name, fn) { current = { name, tests: [] }; suites.push(current); fn(); current = null; }
  function test(name, fn) { current.tests.push({ name, fn }); }

  function show(v) {
    if (typeof v === 'number') return Object.is(v, -0) ? '-0' : String(v);
    if (v === undefined) return 'undefined';
    return JSON.stringify(v);
  }
  function fail(msg) { throw new Error(msg); }

  const assert = {
    isTrue(cond, msg) { if (!cond) fail(msg || 'se esperaba una condicion verdadera'); },
    /** La medicion invalida debe ser exactamente null (no NaN, no 0, no undefined). */
    isNull(actual, msg) { if (actual !== null) fail((msg || 'se esperaba null (medicion invalida)') + ` — recibido: ${show(actual)}`); },
    /** Igualdad estricta (distingue 0 de -0 y reconoce NaN). */
    equal(actual, expected, msg) { if (!Object.is(actual, expected)) fail((msg || 'valores distintos') + ` — esperado: ${show(expected)}, recibido: ${show(actual)}`); },
    /** Numero finito dentro de una tolerancia. */
    approx(actual, expected, tol, msg) {
      tol = (tol === undefined) ? 1e-9 : tol;
      if (typeof actual !== 'number' || !Number.isFinite(actual)) fail((msg || 'se esperaba un numero finito') + ` — recibido: ${show(actual)}`);
      if (Math.abs(actual - expected) > tol) fail((msg || 'fuera de tolerancia') + ` — esperado: ${show(expected)} ±${tol}, recibido: ${show(actual)}`);
    },
    /** null o numero finito: nunca NaN ni Infinity. */
    finiteOrNull(actual, msg) {
      if (!(actual === null || (typeof actual === 'number' && Number.isFinite(actual)))) fail((msg || 'debe ser null o un numero finito') + ` — recibido: ${show(actual)}`);
    }
  };

  function run() {
    const results = [];
    suites.forEach(s => s.tests.forEach(t => {
      let ok = true, error = '';
      try { t.fn(); } catch (e) { ok = false; error = (e && e.message) ? e.message : String(e); }
      results.push({ suite: s.name, name: t.name, ok, error });
    }));
    return results;
  }

  function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; }

  function render(results) {
    const passed = results.filter(r => r.ok).length, failed = results.length - passed, total = results.length;
    document.getElementById('count-pass').textContent = passed;
    document.getElementById('count-fail').textContent = failed;
    document.getElementById('count-total').textContent = total;
    document.querySelector('.card.fail').classList.toggle('zero', failed === 0);
    const status = failed === 0 && total > 0 && loadErrors.length === 0 ? 'pass' : 'fail';
    document.body.dataset.status = status;
    document.getElementById('banner').textContent = status === 'pass'
      ? `✔ TODAS LAS PRUEBAS SUPERADAS (${passed} de ${total})`
      : (loadErrors.length ? `✘ ERRORES DE CARGA (${loadErrors.length}): las pruebas no son fiables hasta corregirlos`
        : total === 0 ? '✘ NO SE HA EJECUTADO NINGUNA PRUEBA'
        : `✘ HAY PRUEBAS FALLIDAS (${failed} de ${total} fallan)`);
    const old = document.getElementById('load-errors'); if (old) old.remove();
    if (loadErrors.length) {
      const box = el('pre', 'load-errors', 'Errores de carga:\n' + loadErrors.join('\n')); box.id = 'load-errors';
      document.getElementById('banner').after(box);
    }
    document.title = `${status === 'pass' ? '✔' : '✘'} ${passed}/${total} — Pruebas de geometría`;

    const root = document.getElementById('results'); root.textContent = '';
    suites.forEach(s => {
      const rs = results.filter(r => r.suite === s.name), bad = rs.filter(r => !r.ok).length;
      const sec = el('section', 'suite'); const h = el('h2', '', s.name);
      h.appendChild(el('span', 'count' + (bad ? ' bad' : ''), `${rs.length - bad}/${rs.length}`)); sec.appendChild(h);
      const ul = el('ul');
      rs.forEach(r => {
        const li = el('li', r.ok ? 'pass' : 'fail');
        li.appendChild(el('span', 'icon', r.ok ? '✔' : '✘')); li.appendChild(el('span', 'name', r.name));
        if (!r.ok) li.appendChild(el('pre', 'err', r.error));
        ul.appendChild(li);
      });
      sec.appendChild(ul); root.appendChild(sec);
    });
    window.__TEST_RESULTS__ = { passed, failed, total, loadErrors: loadErrors.slice(), failures: results.filter(r => !r.ok).map(r => ({ suite: r.suite, name: r.name, error: r.error })) };
  }

  document.addEventListener('DOMContentLoaded', () => render(run()));
  return { suite, test, assert, run, render };
})();
