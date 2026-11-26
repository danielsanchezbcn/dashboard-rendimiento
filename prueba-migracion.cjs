// prueba-migracion.cjs — ¿qué pasa al ACTUALIZAR sobre una base que ya existe? (16/11/2026: al usuario se le quedó la pantalla en «Cargando…»).
// Crea una base con el esquema ANTERIOR (6) y datos dentro, y comprueba dos cosas en un navegador real:
//   1) al abrir el dashboard, la base sube al esquema nuevo sola y los datos siguen ahí;
//   2) si hay OTRA pestaña del dashboard abierta con el esquema viejo, el navegador no puede subir la base: entonces se explica qué hacer
//      en vez de dejar la pantalla colgada, y al cerrar esa pestaña el dashboard abre.
// Uso (necesita Playwright + Chromium):  node prueba-migracion.cjs      Nunca toca datos reales: perfil de navegador nuevo y vacío.
const { chromium } = require('playwright');
const http = require('http'); const fs = require('fs'); const path = require('path');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.wasm': 'application/wasm', '.png': 'image/png', '.task': 'application/octet-stream' };
const ROOT = __dirname;
let fail = 0; const check = (n, ok, d = '') => { console.log((ok ? 'OK   ' : 'FAIL ') + n + (ok ? '' : ' → ' + d)); if (!ok) fail = 1; };
// Esquema 6: los almacenes tal y como los dejó la versión anterior del dashboard (sin «isoRack», que es lo que añade el esquema 7).
const ESQUEMA_6 = {"anthropometry": {"keyPath": "id", "autoIncrement": true, "idx": ["date", "playerId", "synthetic"]}, "auditLog": {"keyPath": "id", "autoIncrement": true, "idx": ["action", "timestamp"]}, "blocks": {"keyPath": "key", "autoIncrement": false, "idx": ["order"]}, "formulaHistory": {"keyPath": "id", "autoIncrement": true, "idx": ["variableId"]}, "fvProfiles": {"keyPath": "id", "autoIncrement": true, "idx": ["date", "playerId", "synthetic"]}, "importBatches": {"keyPath": "id", "autoIncrement": true, "idx": ["createdAt", "fileHash"]}, "importMappings": {"keyPath": "id", "autoIncrement": true, "idx": ["testId"]}, "local": {"keyPath": "key", "autoIncrement": false, "idx": []}, "manifestations": {"keyPath": "id", "autoIncrement": true, "idx": ["blockKey", "order"]}, "meta": {"keyPath": "key", "autoIncrement": false, "idx": []}, "playerAliases": {"keyPath": "id", "autoIncrement": true, "idx": ["normalizedKey", "playerId", "source", "synthetic"]}, "playerPositions": {"keyPath": "id", "autoIncrement": true, "idx": ["playerId", "positionId", "synthetic", "validFrom"]}, "players": {"keyPath": "id", "autoIncrement": true, "idx": ["jerseyName", "synthetic"]}, "positions": {"keyPath": "id", "autoIncrement": true, "idx": ["name", "order", "synthetic"]}, "protocols": {"keyPath": "id", "autoIncrement": true, "idx": ["testId"]}, "sessions": {"keyPath": "id", "autoIncrement": true, "idx": ["batchId", "date", "playerId", "synthetic", "testId"]}, "settings": {"keyPath": "key", "autoIncrement": false, "idx": []}, "targets": {"keyPath": "id", "autoIncrement": true, "idx": ["playerId", "positionId", "synthetic", "variableId"]}, "tests": {"keyPath": "id", "autoIncrement": true, "idx": ["blockKey", "manifestationId", "order", "zoneId"]}, "variables": {"keyPath": "id", "autoIncrement": true, "idx": ["manifestationId", "order", "testId"]}, "zones": {"keyPath": "id", "autoIncrement": true, "idx": ["order"]}};
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html');
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res);
});
const crearVieja = ({ defs, retener }) => new Promise((ok, err) => {
  const rq = indexedDB.open('dashboard-rendimiento', 60); // Dexie numera la versión 6 como 60
  rq.onupgradeneeded = () => { const db = rq.result; for (const [n, d] of Object.entries(defs)) { const st = db.createObjectStore(n, { keyPath: d.keyPath, autoIncrement: d.autoIncrement }); for (const i of d.idx) st.createIndex(i, i); } };
  rq.onsuccess = () => {
    const db = rq.result; const tx = db.transaction(['players', 'meta', 'targets'], 'readwrite');
    tx.objectStore('players').add({ jerseyName: 'Jugador de antes', active: true, createdAt: '2026-01-01' });
    tx.objectStore('meta').put({ key: 'catalogSeeded', value: { version: 15 } });
    tx.objectStore('targets').add({ scope: 'player', playerId: 1, variableId: 1, values: { S: 10 } }); // 26/11/2026: tiene que desaparecer al migrar
    tx.oncomplete = () => { if (retener) window.__vieja = db; else db.close(); ok(true); };
    tx.onerror = () => err(tx.error?.message ?? 'tx');
  };
  rq.onerror = () => err(rq.error?.message ?? 'open');
});
const borrar = () => new Promise((ok) => { const r = indexedDB.deleteDatabase('dashboard-rendimiento'); r.onsuccess = () => ok(); r.onerror = () => ok(); r.onblocked = () => ok(); });

(async () => {
  await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
  const base = `http://127.0.0.1:${server.address().port}/index.html`;
  const origen = base.replace('index.html', 'solo-para-el-origen');
  const browser = await chromium.launch(); const ctx = await browser.newContext({ colorScheme: 'dark' });
  const logs = [];

  // ---- 1) Actualizar sobre una base que ya existe
  let p1 = await ctx.newPage();
  p1.on('pageerror', (e) => logs.push('pageerror ' + e.message));
  await p1.goto(origen).catch(() => {});
  await p1.evaluate(borrar);
  await p1.evaluate(crearVieja, { defs: ESQUEMA_6, retener: false });
  await p1.goto(base + '#jugadores');
  let abre = true;
  try { await p1.waitForSelector('nav.nav a', { timeout: 20000 }); } catch { abre = false; }
  check('con una base del esquema anterior, el dashboard abre', abre, await p1.evaluate(() => document.body.innerText.trim().slice(0, 120)));
  const tras = await p1.evaluate(() => new Promise((ok) => { const r = indexedDB.open('dashboard-rendimiento'); r.onsuccess = () => { const db = r.result; const tx = db.transaction('players'); const todos = tx.objectStore('players').getAll(); todos.onsuccess = () => { const v = db.version; const tablas = [...db.objectStoreNames]; db.close(); ok({ v, tablas, jugadores: todos.result.map((x) => x.jerseyName) }); }; }; }));
  check('la base sube al esquema 8 y conserva la tabla isoRack', tras.v === 80 && tras.tablas.includes('isoRack'), JSON.stringify({ v: tras.v, iso: tras.tablas.includes('isoRack') }));
  // 26/11/2026: los targets se retiran del dashboard CON sus datos. Esta comprobación vigila que se borre esa tabla y solo esa.
  check('la tabla de targets desaparece al migrar', !tras.tablas.includes('targets'), tras.tablas.join());
  check('las demás tablas siguen ahí (21)', tras.tablas.length === 21, tras.tablas.length + ': ' + tras.tablas.join());
  check('los datos de antes siguen ahí', tras.jugadores.includes('Jugador de antes'), JSON.stringify(tras.jugadores));
  check('sin errores de consola al migrar', logs.length === 0, JSON.stringify(logs));
  await p1.close();

  // ---- 2) Otra pestaña abierta con el esquema viejo: el navegador no deja subir la base
  await p1.close().catch(() => {});
  const vieja = await ctx.newPage();
  await vieja.goto(origen).catch(() => {});
  await vieja.evaluate(borrar);
  await vieja.evaluate(crearVieja, { defs: ESQUEMA_6, retener: true }); // se queda abierta, como una pestaña del dashboard sin cerrar
  const nueva = await ctx.newPage();
  await nueva.goto(base + '#jugadores');
  let aviso = '';
  try { await nueva.waitForSelector('nav.nav a, .fatal', { timeout: 15000 }); aviso = await nueva.evaluate(() => (document.querySelector('.fatal') ? document.querySelector('.fatal').innerText.replace(/\s+/g, ' ') : 'abre')); } catch { aviso = 'se queda cargando'; }
  check('con otra pestaña abierta en el esquema viejo, se explica qué hacer y no se queda en «Cargando…»', /otras pestañas del dashboard/i.test(aviso) && /cierra/i.test(aviso), aviso.slice(0, 160));
  await vieja.evaluate(() => { window.__vieja.close(); });
  await vieja.close();
  await nueva.reload();
  let abre2 = true;
  try { await nueva.waitForSelector('nav.nav a', { timeout: 20000 }); } catch { abre2 = false; }
  check('al cerrar esa pestaña y recargar, el dashboard abre', abre2, await nueva.evaluate(() => document.body.innerText.trim().slice(0, 120)));

  await browser.close(); server.close();
  console.log(fail ? 'HAY FALLOS' : 'Todo bien'); process.exit(fail);
})().catch((e) => { console.error(e); server.close(); process.exit(2); });
