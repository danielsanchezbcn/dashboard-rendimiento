const { chromium } = require('playwright'); const http = require('http'); const fs = require('fs'); const path = require('path');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.wasm': 'application/wasm', '.png': 'image/png', '.task': 'application/octet-stream' };
const ROOT = __dirname;
const server = http.createServer((req, res) => { const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html'); if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res); });
(async () => {
  await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
  const base = `http://127.0.0.1:${server.address().port}/index.html`;
  const browser = await chromium.launch(); const page = await (await browser.newContext()).newPage();
  await page.goto(base + '#inicio'); await page.waitForSelector('nav.nav a', { timeout: 20000 });
  const info = await page.evaluate(() => new Promise((ok) => { const r = indexedDB.open('dashboard-rendimiento'); r.onsuccess = () => { const db = r.result; const out = { version: db.version, stores: {} }; for (const n of db.objectStoreNames) { const s = db.transaction(n).objectStore(n); out.stores[n] = { keyPath: s.keyPath, autoIncrement: s.autoIncrement, idx: [...s.indexNames] }; } db.close(); ok(out); }; }));
  console.log(JSON.stringify(info, null, 1));
  await browser.close(); server.close();
})().catch((e) => { console.error(e); server.close(); process.exit(2); });
