// prueba-navegador.cjs — prueba de extremo a extremo en un navegador real (Chromium), con DATOS SINTÉTICOS. 10/11/2026.
// Sirve la carpeta en local, abre el dashboard, crea jugadores y sesiones inventados en una base nueva y comprueba lo que se ve en pantalla:
// menú y pestañas, tablas de columnas (CMJ, Reactive Strength y Perímetros), Personal Best de la mejor sesión, pestaña Asimetrías, colores de asimetría,
// minúsculas/mayúsculas de los nombres y que no haya errores de consola (incluidas las violaciones de la política de seguridad).
// Uso (necesita Playwright + Chromium, que no forman parte del dashboard):  node prueba-navegador.cjs   [--capturas carpeta]
// Nunca toca datos reales: cada ejecución usa un perfil de navegador nuevo y vacío.
const { chromium } = require('playwright');
const http = require('http'); const fs = require('fs'); const path = require('path');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.wasm': 'application/wasm', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.gz': 'application/gzip', '.task': 'application/octet-stream' };
const ROOT = __dirname; const capIdx = process.argv.indexOf('--capturas'); const CAP = capIdx > 0 ? process.argv[capIdx + 1] : null;
let fail = 0; const check = (n, ok, d = '') => { console.log((ok ? 'OK   ' : 'FAIL ') + n + (ok ? '' : ' → ' + d)); if (!ok) fail = 1; };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html');
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res);
});
(async () => {
  await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
  const base = `http://127.0.0.1:${server.address().port}/index.html`;
  const browser = await chromium.launch(); const ctx = await browser.newContext({ viewport: { width: 1840, height: 1000 }, colorScheme: 'dark' });
  const page = await ctx.newPage(); const logs = [];
  page.on('console', (m) => { if (m.type() === 'error') logs.push(m.text()); }); page.on('pageerror', (e) => logs.push('pageerror ' + e.message));
  const shot = async (n) => { if (CAP) await page.screenshot({ path: path.join(CAP, n + '.png') }); };
  const go = async (hash, sel, ms = 1200) => { await page.goto(base + hash); if (sel) await page.waitForSelector(sel, { timeout: 15000 }); await page.waitForTimeout(ms); };
  const texts = (sel) => page.locator(sel).allInnerTexts();

  await go('#configuracion', '.ver', 800);
  // ---- Datos sintéticos (12 jugadores): sesión k de cada test; RSI mejor en la sesión 1 (la «mejor sesión»)
  const ids = await page.evaluate(async () => {
    const db = await new Promise((ok) => { const r = indexedDB.open('dashboard-rendimiento'); r.onsuccess = () => ok(r.result); });
    const all = (st) => new Promise((ok) => { const rq = db.transaction(st).objectStore(st).getAll(); rq.onsuccess = () => ok(rq.result); });
    const tests = await all('tests'), vars = await all('variables'); const now = new Date().toISOString(); const out = { players: [], byTest: {} };
    const seed = (test, pid, date, k, i) => {
      const values = {};
      for (const v of vars.filter((x) => x.testId === test.id && x.kind === 'raw' && !x.archived)) {
        const rsi = /\bRSI\b/i.test(v.name); const b = rsi ? [0.5, 0.9, 0.6][k] + i * 0.01 : 30 + (v.id % 7) + [2, 0, 3][k] + i;
        values[v.id] = v.sides === 'LR' ? { L: b, R: b + ((v.id % 3) - 1) * (1 + k * 0.5) } : { S: /asym/i.test(v.name) ? ((v.id % 2) ? 1 : -1) * (3 + k) : b };
      }
      return new Promise((ok) => { const tx = db.transaction('sessions', 'readwrite'); tx.objectStore('sessions').add({ playerId: pid, testId: test.id, protocolId: null, date, time: '', values, reps: { L: 3, R: 3, S: 3, total: 3 }, status: 'valid', excludedReason: '', source: 'sintetico', createdAt: now, updatedAt: now }); tx.oncomplete = ok; });
    };
    const T = (n) => tests.find((t) => t.name === n); const per = tests.find((t) => t.blockKey === 'perimetros');
    for (const [k, n] of Object.entries({ cmj: 'CMJ', sl: 'SL CMJ', hop: 'Double-Leg Hop Test', dj: 'DL Drop Jump 30 cm', sj: 'Squat Jump', hip: 'Run-Specific Hip Iso-Push', nordic: 'Nordic Hamstring Exercise', jur: 'Jurdan Test' })) out.byTest[k] = T(n).id;
    out.byTest.per = per.id;
    for (let i = 0; i < 12; i++) {
      const id = await new Promise((ok) => { const rq = db.transaction('players', 'readwrite').objectStore('players').add({ jerseyName: 'J' + (i + 1), active: true, referenceWeight: { value: 75, unit: 'kg' }, createdAt: now, updatedAt: now }); rq.onsuccess = () => ok(rq.result); });
      out.players.push(id);
      for (const [k, d] of [[0, '2026-08-01'], [1, '2026-09-01'], [2, '2026-10-01']]) for (const key of ['cmj', 'hop', 'dj', 'sj']) await seed(T({ cmj: 'CMJ', hop: 'Double-Leg Hop Test', dj: 'DL Drop Jump 30 cm', sj: 'Squat Jump' }[key]), id, d, k, i);
      await seed(T('SL CMJ'), id, '2026-10-01', 1, i); await seed(per, id, '2026-10-01', 1, i); await seed(T('Run-Specific Hip Iso-Push'), id, '2026-10-01', 1, i); await seed(T('Nordic Hamstring Exercise'), id, '2026-10-01', 1, i); await seed(T('Jurdan Test'), id, '2026-10-01', 1, i); await seed(T('DL Drop Jump 45 cm'), id, '2026-10-02', 2, i);
    }
    out.vars = Object.fromEntries(vars.map((v) => [v.id, { name: v.name, testId: v.testId }]));
    return out;
  });
  const P = ids.players[5], iP = 5; const t = ids.byTest;

  // ---- Menú y pestañas
  await go('#inicio', '.tabs-nav');
  check('menú: 5 entradas', (await texts('nav.nav a')).join('|') === 'Inicio|Jugadores|Relaciones entre variables|Catálogo de tests|Importar', (await texts('nav.nav a')).join('|'));
  check('Inicio: pestañas Copias de seguridad y Configuración (sin Resumen)', (await texts('.tabs-nav a')).join('|').toLowerCase() === 'copias de seguridad|configuración'); // innerText ya aplica las mayúsculas del CSS
  check('Inicio muestra el resumen dentro de Copias de seguridad', (await texts('h2')).some((x) => /Copia de seguridad/.test(x)) && (await texts('h3')).concat(await texts('h2')).some((x) => /Estado de la base/.test(x)));
  await go('#copias', '.tabs-nav'); check('#copias sigue funcionando y marca la pestaña Copias de seguridad', (await texts('.tabs-nav a.on')).join('').toLowerCase() === 'copias de seguridad');
  await go('#nme', '.tabs-nav'); check('Catálogo de tests agrupa Manifestaciones, NME, Datos antropométricos y Catálogo', (await texts('.tabs-nav a')).join('|').toLowerCase() === 'manifestaciones de la fuerza|nme|datos antropométricos|catálogo y edición' && (await texts('nav.nav a.active')).join('') === 'Catálogo de tests');

  // ---- Perímetros: orden de filas y percentil de asimetría
  await go(`#jugador-${P}?t=${t.per}&b=perimetros`, 'table.pano');
  check('Perímetros: filas Valor · Percentil La Liga · Asimetría · Percentil asimetría', (await texts('table.pano tbody th')).join('|') === 'Valor|Percentil La Liga (media de ambas piernas)|Asimetría|Percentil asimetría', (await texts('table.pano tbody th')).join('|'));
  check('Perímetros: 5 columnas y texto de asimetría en color', (await page.locator('table.pano thead th').count()) === 5 && (await page.locator('table.pano tbody tr').nth(2).locator('.asim-l, .asim-r').count()) >= 1);
  check('Perímetros: percentil de asimetría con valores o «n<»', (await texts('table.pano tbody tr:nth-child(4) td')).every((x) => /^(\d+|n<\d+)$/.test(x.trim())), (await texts('table.pano tbody tr:nth-child(4) td')).join(','));
  await shot('perimetros');

  // ---- Jurdan Test: L y R lado a lado, percentil de cada lado, asimetría en grados
  await go(`#jugador-${P}?t=${t.jur}&b=nme`, 'table.pano');
  check('Jurdan: filas Valor · Percentil La Liga (L · R) · Asimetría (°), sin percentil de asimetría', (await texts('table.pano tbody th')).join('|') === 'Valor|Percentil La Liga (L · R)|Asimetría (°)', (await texts('table.pano tbody th')).join('|'));
  check('Jurdan: 4 columnas, con L y R lado a lado en el valor y en el percentil', (await page.locator('table.pano thead th').count()) === 4 && (await page.locator('table.pano tbody tr:nth-child(1) .lr-h').count()) === 4 && (await page.locator('table.pano tbody tr:nth-child(2) .lr-h > span').count()) === 8);
  check('Jurdan: asimetría en grados con letra de lado y color', (await texts('table.pano tbody tr:nth-child(3) td')).every((x) => /^\d+(,\d+)? ° [LR]$|^0 °$/.test(x.trim())) && (await page.locator('table.pano tbody tr:nth-child(3) .asim-l, table.pano tbody tr:nth-child(3) .asim-r').count()) >= 1, (await texts('table.pano tbody tr:nth-child(3) td')).join(','));
  check('Jurdan: sin opción Personal Best (ángulos sin dirección)', !(await texts('section.panorama fieldset.modes label')).some((x) => /Personal Best/.test(x)));
  await shot('jurdan');

  // ---- Conclusión ORZ: lo primero y destacado en Drop Jump
  await go(`#jugador-${P}?t=${t.dj}&b=fuerza`, '.evo');
  const orz = await page.evaluate(() => { const e = document.querySelector('.evo')?.firstElementChild; return { cls: e ? e.className : '', txt: e?.querySelector('.orz-conclusion')?.innerText ?? '' }; });
  check('Drop Jump: la conclusión ORZ es lo primero y está destacada', /refs/.test(orz.cls) && /conclusi[oó]n orz/i.test(orz.txt) && /\b(30|45) cm\b/.test(orz.txt), JSON.stringify(orz));
  // ---- Tabla de columnas en todos los tests
  for (const key of ['sl', 'hip', 'nordic']) {
    await go(`#jugador-${P}?t=${t[key]}&b=fuerza`, '.evo');
    const n = await page.locator('section.panorama table.pano thead th').count();
    const filas = (await texts('section.panorama table.pano tbody th')).join('|');
    check(`${key}: tabla de columnas con una columna por variable y fila de percentil`, n >= 2 && /Percentil La Liga/.test(filas), `${n} · ${filas}`);
  }
  await shot('hip');
  // ---- Cuadrantes arriba del todo (EUR en Squat Jump, DSI en SL CMJ) y RSI por defecto
  for (const [key, nm] of [['sj', 'Squat Jump (EUR)'], ['sl', 'SL CMJ (DSI)']]) {
    await go(`#jugador-${P}?t=${t[key]}&b=fuerza`, '.evo');
    const primero = await page.evaluate(() => { const e = document.querySelector('.evo')?.firstElementChild; return e ? (e.className || e.tagName) : ''; });
    check(`${nm}: el cuadrante va arriba del todo`, /refs/.test(primero), primero);
  }
  for (const key of ['cmj', 'sl', 'sj', 'hop', 'dj']) { // Squat Jump también tiene RSI MOD en el catálogo, así que también arranca en RSI
    await go(`#jugador-${P}?t=${t[key]}&b=fuerza`, '.evo');
    const sel = await page.evaluate(() => { const l = [...document.querySelectorAll('.evo .filters label')].find((x) => /^Variable/.test(x.textContent.trim())); const s = l?.querySelector('select'); return s ? s.options[s.selectedIndex].text : ''; });
    check(`${key}: variable por defecto = RSI`, /\bRSI\b/i.test(sel), sel);
  }
  // un test que no es Fast Dynamic ni Reactive Strength conserva su variable por defecto (la primera con datos)
  await go(`#jugador-${P}?t=${t.hip}&b=fuerza`, '.evo');
  const selHip = await page.evaluate(() => { const l = [...document.querySelectorAll('.evo .filters label')].find((x) => /^Variable/.test(x.textContent.trim())); const s = l?.querySelector('select'); return s ? s.options[s.selectedIndex].text : ''; });
  check('Iso-Push (otro bloque): la variable por defecto no cambia a RSI', selHip.length > 0 && !/\bRSI\b/i.test(selHip), selHip);

  // ---- Reactive Strength y CMJ: tabla de columnas y Personal Best de la mejor sesión
  const nombreVar = (id) => ids.vars[id].name;
  for (const [key, testName] of [['hop', 'hop'], ['dj', 'dj'], ['cmj', 'cmj']]) {
    await go(`#jugador-${P}?t=${t[key]}&b=fuerza&pn=pb`, 'table.pano');
    const heads = (await texts('table.pano thead th')).map((x) => x.split('\n')[0]); const vals = (await texts('table.pano tbody tr:first-child td')).map((x) => x.trim());
    const esperado = Object.entries(ids.vars).filter(([, v]) => v.testId === t[key]).map(([id, v]) => [v.name, id]);
    // cada columna debe ser el valor de la sesión de mejor RSI (k = 1): 30 + id%7 + 0 + i   (las variables RSI: 0,9 + i·0,01)
    let ok = true, det = '';
    heads.forEach((h, c) => { const e = esperado.find(([n]) => n.toLowerCase() === h.toLowerCase()); if (!e) return; const id = Number(e[1]); const want = /\bRSI\b/i.test(e[0]) ? 0.9 + iP * 0.01 : 30 + (id % 7) + iP; const got = Number(vals[c].replace(',', '.')); if (!(Math.abs(got - want) < 0.006)) { ok = false; det += `${h}: ${vals[c]} ≠ ${want}; `; } });
    check(`${testName}: Personal Best = valores de la sesión con mejor RSI`, heads.length >= 5 && ok, det);
    check(`${testName}: nombres de variables en minúscula y rótulo del PB`, heads.every((h) => h === h.toLowerCase()) && (await texts('fieldset.modes label')).some((x) => /Personal Best \(sesión con mejor RSI/.test(x)), heads.join('|'));
  }
  await go(`#jugador-${P}?t=${t.cmj}&b=fuerza`, 'table.pano');
  const orden = await page.evaluate(() => [...document.querySelectorAll('.evo > *')].map((e) => e.className || e.tagName).slice(0, 4));
  check('CMJ: la tabla de columnas va arriba del todo', orden[0].includes('panorama'), orden.join(','));
  await page.waitForTimeout(800);
  check('CMJ: el radar (perfil radial) aparece justo debajo de la tabla de columnas', (await page.locator('#radar').count()) === 1 && (await page.locator('#radar svg.radar-svg').count()) === 1, 'radar: ' + (await page.locator('#radar').count()) + ' svg: ' + (await page.locator('#radar svg.radar-svg').count()));
  await shot('cmj');

  // ---- Pestaña Asimetrías
  await go(`#jugador-${P}?b=asimetrias`, 'section.asimetrias table.asim');
  const caps = await texts('table.asim caption'); const filas = await texts('table.asim tbody th');
  check('Asimetrías: aparecen cmj, sl cmj y perímetros', ['cmj', 'sl cmj', 'perímetros'].every((n) => caps.includes(n)), caps.join('|'));
  check('Asimetrías: Nordic, torque y 100 ms fuera; las 5 asimetrías de CMJ dentro', !caps.some((c) => /nordic/i.test(c)) && !filas.some((f) => /torque|(force|rfd) at 100 ms/i.test(f)) && filas.filter((f) => /asym$/i.test(f)).length === 5, filas.join('|'));
  check('Asimetrías: barras azules (L) y naranjas (R) y texto coloreado', (await page.locator('.asim-svg .bar-l').count()) > 0 && (await page.locator('.asim-svg .bar-r').count()) > 0 && (await page.locator('table.asim td .asim-r').count()) > 0 && (await page.locator('table.asim td .asim-l').count()) > 0);
  check('Asimetrías: encabezados de bloque y subbloque en mayúscula', (await page.locator('.asim-h-bloque').first().evaluate((e) => getComputedStyle(e).textTransform)) === 'uppercase' && (await page.locator('.asim-h-sub').first().evaluate((e) => getComputedStyle(e).textTransform)) === 'uppercase');
  const colores = await page.evaluate(() => { const c = (s) => getComputedStyle(document.querySelector(s)).color; return { l: c('table.asim td .asim-l'), r: c('table.asim td .asim-r') }; });
  check('colores de asimetría: azul para Left y naranja para Right', colores.l === 'rgb(49, 179, 254)' && colores.r === 'rgb(252, 145, 47)', JSON.stringify(colores));
  await shot('asimetrias');

  // ---- Nombres: tests en minúscula y bloques/subbloques en mayúscula
  await go(`#jugador-${P}?b=fuerza`, '.test-list');
  const items = await texts('.test-items button'); const cab = await texts('.test-list h3');
  check('lista de tests en minúscula', items.length > 20 && items.every((x) => !/[A-ZÁÉÍÓÚÑ]/.test(x.replace(/\(.*\)/, '').split('·').pop().replace(/sin datos aún/i, ''))), items.filter((x) => /[A-Z]/.test(x.split('·').pop())).slice(0, 3).join('|'));
  check('subbloques (manifestaciones) en mayúscula', cab.length >= 4 && (await page.locator('.test-list h3').first().evaluate((e) => getComputedStyle(e).textTransform)) === 'uppercase', cab.join('|'));
  check('pestañas de bloque en mayúscula', (await page.locator('[role=tablist] .tab').first().evaluate((e) => getComputedStyle(e).textTransform)) === 'uppercase');

  // ---- Todos los jugadores, Squat Jump (PB por JH) y Personal Best sin tabla
  await go(`#test-${t.cmj}?v=`, 'table', 1500);
  check('vista de todos los jugadores de un test carga con 12 filas de datos', (await page.locator('main table tbody tr').count()) >= 12);
  await go(`#jugador-${P}?t=${t.sj}&b=fuerza&pn=pb`, '.evo');
  check('Squat Jump: ahora también tiene tabla de columnas (todos los tests) y su gráfico longitudinal', (await page.locator('section.panorama').count()) === 1 && (await page.locator('h4.sec-titulo').count()) > 0);

  // ---- Reglas por propiedad: la tarjeta del catálogo y que renombrar un test no rompa nada
  await go(`#catalogo-test-${t.hop}`, 'form.fields');
  check('catálogo: tarjeta «Comportamiento en el perfil» con criterio de PB, tabla de columnas y exclusión', (await texts('h3, h2')).some((x) => /Comportamiento en el perfil/i.test(x)) && (await page.locator('select option', { hasText: /Mejor sesión según mean rsi/i }).count()) >= 1);
  await page.evaluate(async (id) => {
    const db = await new Promise((ok) => { const r = indexedDB.open('dashboard-rendimiento'); r.onsuccess = () => ok(r.result); });
    await new Promise((ok) => { const tx = db.transaction('tests', 'readwrite'); const st = tx.objectStore('tests'); st.get(id).onsuccess = (e) => { const row = e.target.result; row.name = 'Hop test renombrado'; st.put(row); }; tx.oncomplete = ok; });
  }, t.hop);
  await go(`#jugador-${P}?t=${t.hop}&b=fuerza&pn=pb`, 'table.pano');
  check('test renombrado: conserva la tabla de columnas y el PB de la mejor sesión', (await page.locator('section.panorama').count()) === 1 && (await texts('fieldset.modes label')).some((x) => /Personal Best \(sesión con mejor RSI/.test(x)));
  await go(`#catalogo-test-${t.hop}`, 'form.fields');
  const casilla = page.locator('label', { hasText: /Mostrar la tabla «todas las variables»/ }).locator('input');
  await casilla.uncheck(); await page.locator('form.fields', { has: casilla }).locator('button[type=submit]').click(); await page.waitForTimeout(700);
  await go(`#jugador-${P}?t=${t.hop}&b=fuerza`, '.evo');
  check('desmarcar «tabla de columnas» en el catálogo la quita del perfil', (await page.locator('section.panorama').count()) === 0);
  await go(`#catalogo-test-${t.hop}`, 'form.fields');
  const casilla2 = page.locator('label', { hasText: /Mostrar la tabla «todas las variables»/ }).locator('input'); await casilla2.check(); await page.locator('form.fields', { has: casilla2 }).locator('button[type=submit]').click(); await page.waitForTimeout(700);
  await go(`#jugador-${P}?t=${t.hop}&b=fuerza`, 'table.pano');
  check('al volver a marcarla, reaparece', (await page.locator('section.panorama').count()) === 1);

  // ---- Política de seguridad: no se puede salir a internet y no hubo errores
  const externo = await page.evaluate(() => fetch('https://example.com/').then(() => 'salió', () => 'bloqueado'));
  check('política de seguridad: una petición a internet queda bloqueada', externo === 'bloqueado', externo);
  const propios = logs.filter((l) => !/example\.com/.test(l));
  check('sin errores de consola durante toda la prueba', propios.length === 0, JSON.stringify(propios.slice(0, 3)));
  await browser.close(); server.close();
  console.log(fail ? 'HAY FALLOS' : 'Todo bien'); process.exit(fail);
})().catch((e) => { console.error(e); server.close(); process.exit(2); });
