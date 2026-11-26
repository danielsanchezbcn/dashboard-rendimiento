// ¿Qué pasa si el dashboard está abierto en OTRA pestaña con el esquema viejo cuando se actualiza? (IndexedDB bloquea la subida de versión.)
const { chromium } = require('playwright'); const http = require('http'); const fs = require('fs'); const path = require('path');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.wasm': 'application/wasm', '.png': 'image/png', '.task': 'application/octet-stream' };
const ROOT = __dirname;
const server = http.createServer((req, res) => { const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html'); if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res); });
(async () => {
  await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
  const base = `http://127.0.0.1:${server.address().port}/index.html`;
  const browser = await chromium.launch(); const ctx = await browser.newContext();
  const t1 = await ctx.newPage();
  await t1.goto(base.replace('index.html', 'origen-404')).catch(() => {});
  await t1.evaluate(() => new Promise((ok) => { const r = indexedDB.deleteDatabase('dashboard-rendimiento'); r.onsuccess = () => ok(); r.onerror = () => ok(); r.onblocked = () => ok(); }));
  const defs = require('/tmp/stores6.json');
  await t1.evaluate((defs) => new Promise((ok, err) => {
    const rq = indexedDB.open('dashboard-rendimiento', 60);
    rq.onupgradeneeded = () => { const db = rq.result; for (const [n, d] of Object.entries(defs)) { const st = db.createObjectStore(n, { keyPath: d.keyPath, autoIncrement: d.autoIncrement }); for (const i of d.idx) st.createIndex(i, i); } };
    rq.onsuccess = () => { window.__vieja = rq.result; ok(true); }; rq.onerror = () => err(rq.error?.message);
  }), defs);
  console.log('pestaña 1: base vieja (esquema 6) abierta y RETENIDA, como una pestaña del dashboard que sigue abierta');
  const t2 = await ctx.newPage(); const logs = [];
  t2.on('pageerror', (e) => logs.push('pageerror ' + e.message));
  await t2.goto(base + '#jugadores');
  let estado = 'se queda cargando';
  try { await t2.waitForSelector('nav.nav a, .fatal', { timeout: 12000 }); estado = await t2.evaluate(() => document.querySelector('.fatal') ? 'AVISO: ' + document.querySelector('.fatal').innerText.replace(/\s+/g, ' ').slice(0, 160) : 'abre'); } catch { estado = 'SE QUEDA EN: «' + (await t2.evaluate(() => document.body.innerText.trim().slice(0, 120))) + '»'; }
  console.log('pestaña 2 (con la 1 abierta):', estado);
  console.log('errores:', JSON.stringify(logs));
  // Ahora se cierra la pestaña vieja y se recarga
  await t1.evaluate(() => window.__vieja.close()); await t1.close();
  await t2.reload();
  let estado2 = 'se queda cargando';
  try { await t2.waitForSelector('nav.nav a', { timeout: 15000 }); estado2 = 'abre'; } catch { estado2 = 'SE QUEDA EN: «' + (await t2.evaluate(() => document.body.innerText.trim().slice(0, 120))) + '»'; }
  console.log('pestaña 2 tras cerrar la vieja:', estado2);
  await browser.close(); server.close();
})().catch((e) => { console.error(e); server.close(); process.exit(2); });
