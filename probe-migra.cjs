// Simula una base REAL ya existente en el esquema 6 (como la del usuario) y abre el dashboard para ver si la migración a 7 pasa de «Cargando…».
const { chromium } = require('playwright');
const http = require('http'); const fs = require('fs'); const path = require('path');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.wasm': 'application/wasm', '.png': 'image/png', '.task': 'application/octet-stream' };
const ROOT = __dirname;
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html');
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res);
});
(async () => {
  await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
  const base = `http://127.0.0.1:${server.address().port}/index.html`;
  const browser = await chromium.launch(); const ctx = await browser.newContext({ colorScheme: 'dark' });
  const page = await ctx.newPage(); const logs = [];
  page.on('console', (m) => { if (m.type() === 'error') logs.push('console ' + m.text()); });
  page.on('pageerror', (e) => logs.push('pageerror ' + e.message));
  page.on('response', (r) => { if (r.status() >= 400 && !/no-existe-solo/.test(r.url())) logs.push('HTTP ' + r.status() + ' ' + r.url()); });
  // 1) Crear la base en el esquema 6 (Dexie usa versión IDB = 6 * 10) con los stores de esa versión y algo de contenido.
  await page.goto(base.replace('index.html', 'no-existe-solo-para-el-origen')).catch(() => {});
  await page.evaluate(() => new Promise((ok) => { const r = indexedDB.deleteDatabase('dashboard-rendimiento'); r.onsuccess = () => ok(); r.onerror = () => ok(); r.onblocked = () => ok(); }));
  const creada = await page.evaluate(() => new Promise((ok, err) => {
    const rq = indexedDB.open('dashboard-rendimiento', 60);
    rq.onupgradeneeded = () => {
      const db = rq.result;
      const defs = {"anthropometry": {"keyPath": "id", "autoIncrement": true, "idx": ["date", "playerId", "synthetic"]}, "auditLog": {"keyPath": "id", "autoIncrement": true, "idx": ["action", "timestamp"]}, "blocks": {"keyPath": "key", "autoIncrement": false, "idx": ["order"]}, "formulaHistory": {"keyPath": "id", "autoIncrement": true, "idx": ["variableId"]}, "fvProfiles": {"keyPath": "id", "autoIncrement": true, "idx": ["date", "playerId", "synthetic"]}, "importBatches": {"keyPath": "id", "autoIncrement": true, "idx": ["createdAt", "fileHash"]}, "importMappings": {"keyPath": "id", "autoIncrement": true, "idx": ["testId"]}, "local": {"keyPath": "key", "autoIncrement": false, "idx": []}, "manifestations": {"keyPath": "id", "autoIncrement": true, "idx": ["blockKey", "order"]}, "meta": {"keyPath": "key", "autoIncrement": false, "idx": []}, "playerAliases": {"keyPath": "id", "autoIncrement": true, "idx": ["normalizedKey", "playerId", "source", "synthetic"]}, "playerPositions": {"keyPath": "id", "autoIncrement": true, "idx": ["playerId", "positionId", "synthetic", "validFrom"]}, "players": {"keyPath": "id", "autoIncrement": true, "idx": ["jerseyName", "synthetic"]}, "positions": {"keyPath": "id", "autoIncrement": true, "idx": ["name", "order", "synthetic"]}, "protocols": {"keyPath": "id", "autoIncrement": true, "idx": ["testId"]}, "sessions": {"keyPath": "id", "autoIncrement": true, "idx": ["batchId", "date", "playerId", "synthetic", "testId"]}, "settings": {"keyPath": "key", "autoIncrement": false, "idx": []}, "targets": {"keyPath": "id", "autoIncrement": true, "idx": ["playerId", "positionId", "synthetic", "variableId"]}, "tests": {"keyPath": "id", "autoIncrement": true, "idx": ["blockKey", "manifestationId", "order", "zoneId"]}, "variables": {"keyPath": "id", "autoIncrement": true, "idx": ["manifestationId", "order", "testId"]}, "zones": {"keyPath": "id", "autoIncrement": true, "idx": ["order"]}};
      for (const [n, d] of Object.entries(defs)) { const st = db.createObjectStore(n, { keyPath: d.keyPath, autoIncrement: d.autoIncrement }); for (const i of d.idx) st.createIndex(i, i); }
    };
    rq.onsuccess = () => { const db = rq.result; const tx = db.transaction(['players', 'meta'], 'readwrite');
      tx.objectStore('players').add({ jerseyName: 'Jugador real', active: true, createdAt: '2026-01-01' });
      tx.objectStore('meta').put({ key: 'catalogSeeded', value: { version: 15 } });
      tx.oncomplete = () => { db.close(); ok(true); }; tx.onerror = () => err(tx.error?.message ?? 'tx'); };
    rq.onerror = () => err(rq.error?.message ?? 'open');
  }));
  console.log('base en esquema 6 creada:', creada);
  // 2) Abrir el dashboard: ¿pasa de «Cargando…»?
  await page.goto(base + '#jugadores');
  let estado = 'cargando';
  try { await page.waitForSelector('nav.nav a', { timeout: 20000 }); estado = 'abre'; } catch { estado = await page.evaluate(() => document.body.innerText.slice(0, 200)); }
  console.log('ESTADO:', estado);
  console.log('ERRORES:', JSON.stringify(logs, null, 1));
  const ver = await page.evaluate(() => new Promise((ok) => { const r = indexedDB.open('dashboard-rendimiento'); r.onsuccess = () => { ok(r.result.version); r.result.close(); }; }));
  console.log('versión IDB tras abrir:', ver);
  await browser.close(); server.close();
})().catch((e) => { console.error('ERROR', e); server.close(); process.exit(2); });
