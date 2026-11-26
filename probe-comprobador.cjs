// Prueba manual de `comprobar.html` contra un servidor local.
//   OCULTA=archivo   simula un archivo que no llegó al repositorio
//   RECORTA=archivo  simula un archivo subido a medias (se sirve la mitad)
//   RANGO=1          el servidor admite «Range» y contesta 206 + Content-Range, como GitHub Pages
//   CAP=ruta.png     captura la página
const { chromium } = require('playwright'); const http = require('http'); const fs = require('fs'); const path = require('path');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.wasm': 'application/wasm', '.png': 'image/png', '.task': 'application/octet-stream', '.gz': 'application/gzip' };
const ROOT = __dirname; const OCULTA = process.env.OCULTA || ''; const RECORTA = process.env.RECORTA || '';
const RANGO = process.env.RANGO === '1'; const SIN_HEAD = process.env.SIN_HEAD === '1'; const COMPRIME = process.env.COMPRIME || '';
let rangosPedidos = 0, headsPedidos = 0; const escritos = {}; // bytes que el servidor manda de verdad
const server = http.createServer((req, res) => {
  const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html';
  if (OCULTA && rel === OCULTA) { res.writeHead(404); return res.end(); }
  const p = path.join(ROOT, rel);
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  const tipo = MIME[path.extname(p)] || 'application/octet-stream';
  const real = fs.statSync(p).size;
  const total = RECORTA && rel === RECORTA ? Math.floor(real / 2) : real; // «subido a medias»
  const cuenta = (n) => { escritos[rel] = (escritos[rel] ?? 0) + n; };
  if (req.method === 'HEAD') {
    headsPedidos++;
    if (SIN_HEAD) { res.writeHead(405); return res.end(); }
    // Comprimido: «Content-Length» sería el tamaño comprimido, que no sirve para comparar.
    const h = { 'Content-Type': tipo, 'Content-Length': COMPRIME && rel === COMPRIME ? Math.floor(total / 3) : total };
    if (COMPRIME && rel === COMPRIME) h['Content-Encoding'] = 'gzip';
    res.writeHead(200, h); return res.end();
  }
  if (RANGO && /^bytes=0-0$/.test(req.headers.range || '')) { rangosPedidos++; cuenta(1); res.writeHead(206, { 'Content-Type': tipo, 'Content-Range': `bytes 0-0/${total}`, 'Content-Length': 1 }); return res.end(fs.readFileSync(p).slice(0, 1)); }
  cuenta(total);
  res.writeHead(200, { 'Content-Type': tipo, 'Content-Length': total }); return res.end(fs.readFileSync(p).slice(0, total));
});
(async () => {
  await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
  const base = `http://127.0.0.1:${server.address().port}/comprobar.html`;
  const browser = await chromium.launch(); const page = await (await browser.newContext({ colorScheme: 'dark' })).newPage();
  await page.goto(base); await page.waitForTimeout(8000);
  console.log('RESUMEN:', await page.evaluate(() => document.getElementById('resumen').innerText.replace(/\s+/g, ' ')));
  console.log('GRANDES:', await page.evaluate(() => [...document.querySelectorAll('#tgrandes tbody tr')].map((t) => t.innerText.replace(/\s+/g, ' '))));
  console.log('AMBAR:', await page.evaluate(() => [...document.querySelectorAll('td.avi')].map((t) => t.closest('tr').innerText.replace(/\s+/g, ' ')).slice(0, 8)));
  console.log('ROJOS:', await page.evaluate(() => [...document.querySelectorAll('td.mal')].map((t) => t.closest('tr').innerText.replace(/\s+/g, ' ')).slice(0, 6)));
  const grandes = ['pose_landmarker_full.task', 'vision_wasm_internal.wasm', 'vision_wasm_nosimd_internal.wasm', 'eng.traineddata.gz'];
  console.log('BYTES SERVIDOS de los grandes:', Object.fromEntries(grandes.map((g) => [g, escritos[g] ?? 0])), '· HEAD:', headsPedidos, '· rangos:', rangosPedidos);
  if (process.env.CAP) await page.screenshot({ path: process.env.CAP, fullPage: false });
  await browser.close(); server.close();
})().catch((e) => { console.error(e); server.close(); process.exit(2); });
