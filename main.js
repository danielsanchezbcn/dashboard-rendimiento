import { render, html } from './libs.js';
import { createDb, initDb, requestPersistence } from './db.js';
import { App } from './app.js';
import { seedInitialCatalog } from './catalogo-inicial.js';
import { collapsePositions } from './posiciones.js';

const root = document.getElementById('app');

function showError(title, detail) {
  root.replaceChildren();
  const box = document.createElement('div');
  box.className = 'fatal';
  const h = document.createElement('h1');
  h.textContent = title;
  const p = document.createElement('p');
  p.textContent = detail;
  box.append(h, p);
  root.append(box);
}

async function boot() {
  if (!('indexedDB' in window)) {
    showError('Este navegador no es compatible', 'La aplicación necesita IndexedDB para guardar los datos en este equipo. Usa Chrome o Edge.');
    return;
  }
  let db;
  try {
    db = createDb();
    await initDb(db);
    await seedInitialCatalog(db);
    await collapsePositions(db);
  } catch (e) {
    showError('No se pudo abrir la base de datos local', `${e?.message || e}. Comprueba que no estás en una ventana privada y que el navegador permite guardar datos de este sitio.`);
    return;
  }
  try {
    await requestPersistence(db);
  } catch {
    /* no es crítico */
  }
  root.textContent = ''; // quita el «Cargando…» inicial antes de pintar la aplicación
  render(html`<${App} db=${db} />`, root);
}

boot();
