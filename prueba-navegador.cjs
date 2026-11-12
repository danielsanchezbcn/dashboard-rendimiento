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
    const seed = (test, pid, date, k, i, mult = 1) => {
      const values = {};
      for (const v of vars.filter((x) => x.testId === test.id && x.kind === 'raw' && !x.archived)) {
        const rsi = /\bRSI\b/i.test(v.name); const b = rsi ? [0.5, 0.9, 0.6][k] + i * 0.01 : (30 + (v.id % 7) + [2, 0, 3][k] + i) * mult;
        values[v.id] = v.sides === 'LR' ? { L: b, R: b + ((v.id % 3) - 1) * (1 + k * 0.5) } : { S: /asym/i.test(v.name) ? ((v.id % 2) ? 1 : -1) * (3 + k) : b };
      }
      return new Promise((ok) => { const tx = db.transaction('sessions', 'readwrite'); tx.objectStore('sessions').add({ playerId: pid, testId: test.id, protocolId: null, date, time: '', values, reps: { L: 3, R: 3, S: 3, total: 3 }, status: 'valid', excludedReason: '', source: 'sintetico', createdAt: now, updatedAt: now }); tx.oncomplete = ok; });
    };
    const T = (n) => tests.find((t) => t.name === n); const per = tests.find((t) => t.blockKey === 'perimetros');
    for (const [k, n] of Object.entries({ cmj: 'CMJ', sl: 'SL CMJ', hop: 'Double-Leg Hop Test', dj: 'DL Drop Jump 30 cm', sj: 'Squat Jump', hip: 'Run-Specific Hip Iso-Push', kpush: 'Run-Specific Knee Iso-Push', khold: 'Knee Iso-Hold 20 s', bsq: 'Back Squat Force–Velocity Profile', nordic: 'Nordic Hamstring Exercise', jur: 'Jurdan Test' })) out.byTest[k] = T(n).id;
    out.byTest.per = per.id;
    for (let i = 0; i < 12; i++) {
      const id = await new Promise((ok) => { const rq = db.transaction('players', 'readwrite').objectStore('players').add({ jerseyName: 'J' + (i + 1), active: true, referenceWeight: { value: 75, unit: 'kg' }, createdAt: now, updatedAt: now }); rq.onsuccess = () => ok(rq.result); });
      out.players.push(id);
      for (const [k, d] of [[0, '2026-08-01'], [1, '2026-09-01'], [2, '2026-10-01']]) for (const key of ['cmj', 'hop', 'dj', 'sj']) await seed(T({ cmj: 'CMJ', hop: 'Double-Leg Hop Test', dj: 'DL Drop Jump 30 cm', sj: 'Squat Jump' }[key]), id, d, k, i);
      await seed(T('SL CMJ'), id, '2026-10-01', 1, i); await seed(per, id, '2026-10-01', 1, i); await seed(T('Run-Specific Hip Iso-Push'), id, '2026-10-01', 1, i); await seed(T('Nordic Hamstring Exercise'), id, '2026-10-01', 1, i); await seed(T('Jurdan Test'), id, '2026-10-01', 1, i); await seed(T('Run-Specific Knee Iso-Push'), id, '2026-10-01', 1, i, 70); for (const [k2, d2] of [[0, '2026-09-01'], [1, '2026-10-01']]) await seed(T('Knee Iso-Hold 20 s'), id, d2, k2, i); await seed(T('DL Drop Jump 45 cm'), id, '2026-10-02', 2, i);
    }
    out.vars = Object.fromEntries(vars.map((v) => [v.id, { name: v.name, testId: v.testId }]));
    return out;
  });
  const P = ids.players[5], iP = 5; const t = ids.byTest;

  // ---- Iso-Hold: Normative Benchmarking arriba del todo, con la carga, el MVIC iso-push, el %PIMA y el %BW/%SW y sus percentiles
  await go(`#jugador-${P}?t=${t.khold}&b=fuerza`, '.evo table.pano', 1500);
  await shot('isohold');
  if (CAP) await page.locator('section.panorama').first().screenshot({ path: path.join(CAP, 'isohold-nb.png') });
  const iso = await page.evaluate(() => ({ primero: document.querySelector('.evo')?.firstElementChild?.className ?? '', cab: [...document.querySelectorAll('table.pano thead tr:first-child th')].map((x) => x.innerText.split('\n')[0].trim()), fil: Object.fromEntries([...document.querySelectorAll('table.pano tbody tr')].map((r) => [r.querySelector('th').innerText.trim(), [...r.querySelectorAll('td')].map((d) => d.innerText.trim())])) }));
  check('Iso-Hold: Normative Benchmarking es lo primero del test', iso.primero === 'panorama', iso.primero);
  check('Iso-Hold: columnas en el orden pedido (MVIC, carga, %PIMA, %BW/%SW)', iso.cab.join('|') === 'mvic iso-push (kg)|carga externa (kg)|%pima|%bw', iso.cab.join('|'));
  check('Iso-Hold: las cuatro variables, calculadas incluidas, tienen percentil de La Liga', (iso.fil['Value (La Liga percentile)'] ?? []).length === 4 && (iso.fil['Value (La Liga percentile)'] ?? []).every((x) => /^(\d+|n<\d+)$/.test(x)), JSON.stringify(iso.fil));

  // Mismo test renombrado con el prefijo «Run-Specific» (como en la base del usuario): debe seguir encontrando su Iso-Push y calcular MVIC y %PIMA.
  await page.evaluate(async (id) => { const db = await new Promise((ok) => { const r = indexedDB.open('dashboard-rendimiento'); r.onsuccess = () => ok(r.result); }); await new Promise((ok, no) => { const tx = db.transaction('tests', 'readwrite'); const st = tx.objectStore('tests'); const rq = st.get(id); rq.onsuccess = () => { const t = rq.result; t.name = 'Run-Specific Knee Iso-Hold 20 s'; st.put(t); }; tx.oncomplete = ok; tx.onerror = () => no(tx.error); }); }, t.khold);
  await page.reload(); await page.waitForSelector('.evo table.pano', { timeout: 15000 }); await page.waitForTimeout(1200);
  const iso2 = await page.evaluate(() => [...document.querySelectorAll('table.pano tbody tr')][0].innerText.replace(/\s+/g, ' '));
  check('Iso-Hold renombrado «Run-Specific …»: el MVIC iso-push y el %PIMA se siguen calculando', !/—/.test(iso2) && /run-specific knee iso-hold/.test(await page.locator('.test-sticky h3').innerText()), iso2);

  // ---- Perfil carga-velocidad: al guardarlo, el test deja de aparecer «sin datos aún» en la lista (sin recargar la página)
  await go(`#jugador-${P}?t=${t.bsq}&b=fuerza`, 'form[aria-label="Nuevo perfil carga-velocidad"]', 800);
  const itemBsq = page.locator('.test-item', { hasText: 'back squat force–velocity profile' }).first();
  check('Perfil F–V sin perfil guardado: el test aparece «sin datos aún»', /sin datos aún/.test(await itemBsq.innerText()));
  for (const [i, [kg, vel]] of [[40, '1,20'], [60, '0,95'], [80, '0,70']].entries()) { await page.getByLabel(`Carga ${i + 1} (kg)`).fill(String(kg)); await page.getByLabel(`Velocidad ${i + 1} (m/s)`).fill(vel); }
  await page.locator('form[aria-label="Nuevo perfil carga-velocidad"] button[type=submit]').click();
  await page.waitForSelector('canvas', { timeout: 15000 }); await page.waitForTimeout(800);
  check('Perfil F–V guardado: el test ya no aparece «sin datos aún» (la lista se refresca sola)', !/sin datos aún/.test(await itemBsq.innerText()) && !/vacio/.test(await itemBsq.getAttribute('class')), await itemBsq.innerText());
  check('Perfil F–V: el perfil guardado NO aparece en los demás tests de perfil carga-velocidad', await page.evaluate(async (bsq) => { const db = await new Promise((ok) => { const r = indexedDB.open('dashboard-rendimiento'); r.onsuccess = () => ok(r.result); }); const todos = await new Promise((ok) => { const rq = db.transaction('fvProfiles').objectStore('fvProfiles').getAll(); rq.onsuccess = () => ok(rq.result); }); return todos.length === 1 && todos[0].testId === bsq; }, t.bsq));
  // Un perfil antiguo sin test asignado no se muestra como propio de ningún test: se ofrece para asignarlo.
  await page.evaluate(async () => { const db = await new Promise((ok) => { const r = indexedDB.open('dashboard-rendimiento'); r.onsuccess = () => ok(r.result); }); await new Promise((ok) => { const tx = db.transaction('fvProfiles', 'readwrite'); const st = tx.objectStore('fvProfiles'); const rq = st.getAll(); rq.onsuccess = () => { for (const p of rq.result) { p.testId = null; st.put(p); } }; tx.oncomplete = ok; }); });
  await page.reload(); await page.waitForSelector('form[aria-label="Nuevo perfil carga-velocidad"]', { timeout: 15000 }); await page.waitForTimeout(600);
  check('Perfil sin test asignado: no se muestra como dato del test y se ofrece asignarlo', (await page.locator('canvas').count()) === 0 && /sin test asignado/.test(await page.locator('.status.warn').first().innerText()) && /sin datos aún/.test(await itemBsq.innerText()));
  await page.locator('.status.warn button', { hasText: 'Asignar' }).first().click();
  await page.waitForSelector('canvas', { timeout: 15000 }); await page.waitForTimeout(600);
  check('Perfil asignado a este test: se muestra y el test deja de estar «sin datos aún»', (await page.locator('.status.warn').count()) === 0 && !/sin datos aún/.test(await itemBsq.innerText()));
  await page.evaluate(async () => { const db = await new Promise((ok) => { const r = indexedDB.open('dashboard-rendimiento'); r.onsuccess = () => ok(r.result); }); await new Promise((ok) => { const tx = db.transaction('fvProfiles', 'readwrite'); tx.objectStore('fvProfiles').clear(); tx.oncomplete = ok; }); });

  // ---- Tabla de comparación entre jugadores: columna de Natera, todo centrado y sin desplazamiento horizontal
  {
    const vSW = Object.entries(ids.vars).find(([, v]) => v.testId === t.hip && /relativo \(SW\)/i.test(v.name));
    await go(`#test-${t.hip}?v=${vSW[0]}`, 'table.tabla-comp', 1500);
    if (CAP) await page.locator('.tabla-wrap-comp').first().screenshot({ path: path.join(CAP, 'tabla-comp.png') });
    const tc = await page.evaluate(() => { const w = document.querySelector('.tabla-wrap-comp'); const tb = w.querySelector('table.tabla-comp'); const al = (e) => getComputedStyle(e).textAlign; return { grupos: [...tb.querySelectorAll('thead tr:first-child th')].map((x) => x.innerText.trim()), desborda: w.scrollWidth > w.clientWidth + 1, pagina: document.documentElement.scrollWidth > window.innerWidth + 1, centrado: [...tb.querySelectorAll('thead th:not([scope="row"])')].every((x) => al(x) === 'center') && [...tb.querySelectorAll('tbody td')].every((x) => al(x) === 'center'), nat: [...tb.querySelectorAll('tbody tr:first-child td')].map((x) => x.innerText.trim()).slice(-2) }; });
    check('tabla de todos los jugadores: columna de Natera además de los percentiles', tc.grupos.some((x) => /natera/i.test(x)), tc.grupos.join('|'));
    check('tabla de todos los jugadores: Natera clasifica cada pierna', tc.nat.every((x) => /Normal|Good|Excellent|—/.test(x)), JSON.stringify(tc.nat));
    check('tabla de todos los jugadores: todo centrado bajo su título', tc.centrado);
    check('tabla de todos los jugadores: cabe a lo ancho, sin desplazamiento horizontal', !tc.desborda && !tc.pagina, JSON.stringify(tc));
  }

  // ---- Déficits: todo lo que está en percentil de La Liga igual o por debajo del umbral
  const PBAJO = ids.players[0]; // el jugador con los valores más bajos de la siembra: es el que tiene déficits
  await go(`#jugador-${PBAJO}?b=deficits`, 'table.deficits, .status.fail, p.muted', 2500);
  const def = await page.evaluate(() => { const t = document.querySelector('table.deficits'); return { n: t ? t.querySelectorAll('tbody tr').length : 0, pct: t ? [...t.querySelectorAll('tbody tr td:first-child .band')].map((x) => Number(x.innerText)) : [], cab: t ? [...t.querySelectorAll('thead th')].map((x) => x.innerText) : [] }; });
  check('Déficits: tabla con percentil, test, variable, lado, valor y fecha', def.cab.join('|').toLowerCase() === 'percentil la liga|test|variable|lado|valor|fecha', def.cab.join('|'));
  check('Déficits: todas las filas están en el umbral o por debajo, de menor a mayor', def.n > 0 && def.pct.length === def.n && def.pct.every((x) => x <= 35) && def.pct.every((x, i) => i === 0 || x >= def.pct[i - 1]), JSON.stringify(def.pct));
  await page.locator('input[type=number]').first().fill('10');
  await page.waitForTimeout(600);
  const def10 = await page.evaluate(() => [...document.querySelectorAll('table.deficits tbody tr td:first-child .band')].map((x) => Number(x.innerText)));
  check('Déficits: al bajar el umbral a 10 solo quedan los percentiles ≤ 10', def10.every((x) => x <= 10) && def10.length <= def.n, JSON.stringify(def10));
  // El percentil que sale aquí debe ser EL MISMO que muestra Normative Benchmarking de ese test (una sola función de cálculo)
  const primera = await page.evaluate(() => { const r = document.querySelector('table.deficits tbody tr'); return r ? { pct: Number(r.querySelector('.band').innerText), href: r.querySelector('a').getAttribute('href'), lado: r.children[3].innerText.trim(), variable: r.children[2].innerText.trim() } : null; });
  await page.locator('input[type=number]').first().fill('35');
  await page.waitForTimeout(400);
  if (primera) {
    await go(primera.href, 'table.pano', 1500);
    const enNb = await page.evaluate((v) => { const tb = document.querySelector('table.pano.norm'); const hs = [...tb.querySelectorAll('thead tr:first-child th')]; let k = 0; const idx = hs.map((h) => { const o = { n: (h.querySelector('.pano-nm')?.innerText ?? '').trim(), i: k, span: h.colSpan }; k += h.colSpan; return o; }).find((o) => o.n === v.variable); if (!idx) return null; const fila = [...tb.querySelectorAll('tbody tr')].find((r) => /La Liga percentile\)$/.test(r.querySelector('th').innerText.trim())); const tds = [...fila.querySelectorAll('td')]; const off = v.lado === 'Derecha' ? 1 : 0; return Number(tds[idx.i + (idx.span > 1 ? off : 0)].innerText.trim()); }, primera);
    check('Déficits: el percentil coincide con el de Normative Benchmarking de ese test', enNb === primera.pct, JSON.stringify({ deficits: primera, nb: enNb }));
  }

  // ---- Menú y pestañas
  await go('#inicio', '.tabs-nav');
  check('menú: 5 entradas', (await texts('nav.nav a')).join('|') === 'Inicio|Jugadores|Relaciones entre variables|Catálogo de tests|Importar', (await texts('nav.nav a')).join('|'));
  check('Inicio: pestañas Copias de seguridad y Configuración (sin Resumen)', (await texts('.tabs-nav a')).join('|').toLowerCase() === 'copias de seguridad|configuración'); // innerText ya aplica las mayúsculas del CSS
  check('Inicio muestra el resumen dentro de Copias de seguridad', (await texts('h2')).some((x) => /Copia de seguridad/.test(x)) && (await texts('h3')).concat(await texts('h2')).some((x) => /Estado de la base/.test(x)));
  await go('#copias', '.tabs-nav'); check('#copias sigue funcionando y marca la pestaña Copias de seguridad', (await texts('.tabs-nav a.on')).join('').toLowerCase() === 'copias de seguridad');
  await go('#nme', '.tabs-nav'); check('Catálogo de tests agrupa Manifestaciones, NME, Datos antropométricos y Catálogo', (await texts('.tabs-nav a')).join('|').toLowerCase() === 'manifestaciones de la fuerza|nme|datos antropométricos|catálogo y edición' && (await texts('nav.nav a.active')).join('') === 'Catálogo de tests');

  // ---- Perímetros: orden de filas y percentil de asimetría
  await go(`#jugador-${P}?t=${t.per}&b=perimetros`, 'table.pano');
  check('Perímetros: filas Value · La Liga percentile · Asymmetry · percentil de asimetría', (await texts('table.pano tbody th')).join('|') === 'Value (% latest session vs Personal Average)|Value (La Liga percentile)|Asymmetry|Asymmetry (La Liga percentile)', (await texts('table.pano tbody th')).join('|'));
  check('Perímetros: 5 variables y texto de asimetría en color', (await page.locator('table.pano thead tr:first-child th').count()) === 5 && (await page.locator('table.pano tbody tr').nth(2).locator('.asim-l, .asim-r').count()) >= 1);
  check('Perímetros: percentil de asimetría con valores o «n<»', (await texts('table.pano tbody tr:nth-child(4) td')).every((x) => /^(\d+|n<\d+)$/.test(x.trim())), (await texts('table.pano tbody tr:nth-child(4) td')).join(','));
  await shot('perimetros');

  // ---- Jurdan Test: L y R lado a lado, percentil de cada lado, asimetría en grados
  await go(`#jugador-${P}?t=${t.jur}&b=nme`, 'table.pano');
  check('Jurdan: filas Value · La Liga percentile · Asymmetry (°), sin percentil de asimetría', (await texts('table.pano tbody th')).join('|') === 'Value (% latest session vs Personal Average)|Value (La Liga percentile)|Asymmetry', (await texts('table.pano tbody th')).join('|'));
  check('Jurdan: 4 variables, con L y R por separado (izquierda a la izquierda) en valor y percentil', (await page.locator('table.pano thead tr:first-child th').count()) === 4 && (await page.locator('table.pano thead tr.lados th').allInnerTexts()).join('') === 'LRLRLRLR' && (await page.locator('table.pano tbody tr:nth-child(1) td').count()) === 8 && (await page.locator('table.pano tbody tr:nth-child(2) td').count()) === 8);
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
    const n = await page.locator('section.panorama table.pano thead tr:first-child th').count();
    const filas = (await texts('section.panorama table.pano tbody th')).join('|');
    check(`${key}: Normative Benchmarking con una columna por variable y fila de percentil`, n >= 2 && /Value \(La Liga percentile\)/.test(filas), `${n} · ${filas}`);
  }
  await shot('hip');
  // Guardas del Normative Benchmarking unificado (causa del error «68 vs 60/68»: dos cálculos distintos del mismo percentil)
  await go(`#jugador-${P}?t=${t.hip}&b=fuerza`, 'table.pano.norm');
  const g = await page.evaluate(() => { const tb = document.querySelector('table.pano.norm'); const filas = [...tb.querySelectorAll('tbody tr')].map((r) => ({ lab: r.querySelector('th')?.innerText ?? '', n: r.querySelectorAll('td').length, txt: [...r.querySelectorAll('td')].map((d) => d.innerText.trim()) })); const w = tb.closest('.pano-wrap'); return { filas, desborda: w.scrollWidth > w.clientWidth + 1, pagina: document.documentElement.scrollWidth > window.innerWidth + 1, lados: [...tb.querySelectorAll('thead tr.lados th')].map((x) => x.innerText.trim()).join('') }; });
  check('Normative Benchmarking: izquierda a la izquierda y derecha a la derecha en cada variable', /^(LR)+$/.test(g.lados), g.lados);
  check('Normative Benchmarking: percentil La Liga por pierna (una celda por lado, ninguna vacía)', (() => { const f = g.filas.find((x) => /La Liga percentile\)$/.test(x.lab) && /^Value/.test(x.lab)); return !!f && f.txt.length >= 2 && f.txt.every((x) => x !== '' && x !== '—'); })(), JSON.stringify(g.filas.map((x) => x.lab + ':' + x.txt.join(','))));
  check('Normative Benchmarking: el percentil Premier League aparece también en este test (antes solo en la otra tabla)', g.filas.some((x) => /Premier League/.test(x.lab) && x.txt.some((y) => y !== '—' && y !== '')), JSON.stringify(g.filas.map((x) => x.lab + ':' + x.txt.join(','))));
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 15000 }), page.locator('.img-botones button', { hasText: 'Download PNG' }).first().click()]);
  const bufPng = require('fs').readFileSync(await dl.path());
  check('Normative Benchmarking: la tabla se descarga como PNG válido y con contenido', bufPng.subarray(0, 8).toString('hex') === '89504e470d0a1a0a' && bufPng.length > 5000, `${bufPng.length} bytes · ${dl.suggestedFilename()}`);
  require('fs').writeFileSync(require('path').join(process.env.CAPS_DIR || '/tmp', 'tabla-nb.png'), bufPng);
  check('Normative Benchmarking: cabe en pantalla sin desplazamiento horizontal', !g.desborda && !g.pagina, JSON.stringify({ d: g.desborda, p: g.pagina }));
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
    const cols = await page.evaluate(() => { const hs = [...document.querySelectorAll('table.pano thead tr:first-child th')]; const tds = [...document.querySelectorAll('table.pano tbody tr:first-child td')]; let k = 0; return hs.map((h) => { const o = { h: h.querySelector('.pano-nm')?.innerText ?? '', v: tds[k]?.querySelector('strong')?.innerText ?? '' }; k += h.colSpan; return o; }); });
    const heads = cols.map((c) => c.h); const vals = cols.map((c) => c.v.trim());
    const esperado = Object.entries(ids.vars).filter(([, v]) => v.testId === t[key]).map(([id, v]) => [v.name, id]);
    // cada columna debe ser el valor de la sesión de mejor RSI (k = 1): 30 + id%7 + 0 + i   (las variables RSI: 0,9 + i·0,01)
    let ok = true, det = '';
    heads.forEach((h, c) => { const e = esperado.find(([n]) => n.toLowerCase() === h.toLowerCase()); if (!e) return; const id = Number(e[1]); const want = /\bRSI\b/i.test(e[0]) ? 0.9 + iP * 0.01 : 30 + (id % 7) + iP; const got = Number(vals[c].replace(',', '.')); if (!(Math.abs(got - want) < 0.006)) { ok = false; det += `${h}: ${vals[c]} ≠ ${want}; `; } });
    check(`${testName}: Personal Best = valores de la sesión con mejor RSI`, heads.length >= 5 && ok, det);
    check(`${testName}: nombres de variables en minúscula y rótulo del PB`, heads.every((h) => h === h.toLowerCase()) && (await texts('fieldset.modes label')).some((x) => /Personal Best \(best RSI session/.test(x)), heads.join('|'));
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
  const centr = await page.evaluate(() => { const t = document.querySelector('table.asim'); const al = (e) => getComputedStyle(e).textAlign; return [...t.querySelectorAll('thead th')].slice(2).every((h) => al(h) === 'center') && [...t.querySelectorAll('tbody td.num')].every((d) => al(d) === 'center') && t.querySelectorAll('thead th').length === 5; });
  check('Asimetrías: 5 columnas y Asimetría · Valores · Fecha centrados bajo su título', centr);
  const f1 = await texts('table.asim tbody td.asim-fecha');
  check('Asimetrías con Personal Average: la columna indica PA y su periodo', f1.length > 0 && f1.every((x) => /^PA · /.test(x)), f1.slice(0, 2).join('|'));
  await page.locator('input[name="asim-base"]').nth(1).check(); await page.waitForTimeout(300);
  const f2 = await texts('table.asim tbody td.asim-fecha');
  check('Asimetrías con Personal Best: la columna indica PB y la fecha', f2.length > 0 && f2.every((x) => /^PB · \d/.test(x)), f2.slice(0, 2).join('|'));
  await page.locator('input[name="asim-base"]').nth(2).check(); await page.waitForTimeout(300);
  const f3 = await texts('table.asim tbody td.asim-fecha');
  check('Asimetrías con Actual: la columna muestra la fecha de cada asimetría', f3.length > 0 && f3.every((x) => /^\d{2}\/\d{2}\/\d{4}$/.test(x.trim())), f3.slice(0, 2).join('|'));
  await page.locator('input[name="asim-base"]').nth(0).check(); await page.waitForTimeout(300);
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
  check('el enlace «ver todos los jugadores» está en la cabecera del test, no debajo de la tabla', await page.evaluate(() => { const a = document.querySelector('.test-sticky a.sticky-link'); return !!a && /todos los jugadores/i.test(a.innerText) && a.getAttribute('href').startsWith('#test-'); }));
  await go(`#test-${t.cmj}?v=`, 'table', 1500);
  check('vista de todos los jugadores de un test carga con 12 filas de datos', (await page.locator('main table tbody tr').count()) >= 12);
  // Borrado masivo de las sesiones de un test (para volver a importar): solo se activa con el nombre exacto y respeta el filtro de fecha.
  {
    const antes = await page.evaluate(async (tid) => { const db = await new Promise((ok) => { const r = indexedDB.open('dashboard-rendimiento'); r.onsuccess = () => ok(r.result); }); const todas = await new Promise((ok) => { const rq = db.transaction('sessions').objectStore('sessions').getAll(); rq.onsuccess = () => ok(rq.result); }); return { test: todas.filter((x) => x.testId === tid).length, otras: todas.filter((x) => x.testId !== tid).length, fecha: todas.filter((x) => x.testId === tid && x.date === '2026-10-01').length }; }, t.khold);
    await go(`#test-${t.khold}?v=`, '.notas', 1500);
    const det = page.locator('details.notas', { hasText: 'Borrar sesiones de este test' }).first();
    await det.locator('summary').click();
    const bt = det.locator('button.danger');
    check('borrado masivo: el botón está bloqueado hasta escribir el nombre del test', await bt.isDisabled());
    await det.locator('select').selectOption({ index: 1 });
    await det.locator('input[type=text]').fill('run-specific knee iso-hold 20 S ');
    check('borrado masivo: con el nombre exacto se activa', !(await bt.isDisabled()));
    await bt.click();
    await page.waitForTimeout(1200);
    const desp = await page.evaluate(async (tid) => { const db = await new Promise((ok) => { const r = indexedDB.open('dashboard-rendimiento'); r.onsuccess = () => ok(r.result); }); const todas = await new Promise((ok) => { const rq = db.transaction('sessions').objectStore('sessions').getAll(); rq.onsuccess = () => ok(rq.result); }); return { test: todas.filter((x) => x.testId === tid).length, otras: todas.filter((x) => x.testId !== tid).length }; }, t.khold);
    check('borrado masivo: borra solo la fecha elegida de ese test y no toca los demás', desp.test === antes.test - antes.fecha && desp.otras === antes.otras, JSON.stringify({ antes, desp }));
  }

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
  check('test renombrado: conserva la tabla de columnas y el PB de la mejor sesión', (await page.locator('section.panorama').count()) === 1 && (await texts('fieldset.modes label')).some((x) => /Personal Best \(best RSI session/.test(x)));
  await go(`#catalogo-test-${t.hop}`, 'form.fields');
  const casilla = page.locator('label', { hasText: /Normative Benchmarking: mostrar todas las variables/ }).locator('input');
  await casilla.uncheck(); await page.locator('form.fields', { has: casilla }).locator('button[type=submit]').click(); await page.waitForTimeout(700);
  await go(`#jugador-${P}?t=${t.hop}&b=fuerza`, '.evo');
  check('desmarcar «todas las variables» deja solo la variable seleccionada', (await page.locator('section.panorama').count()) === 1 && (await page.locator('section.panorama table.pano thead tr:first-child th').count()) === 1);
  await go(`#catalogo-test-${t.hop}`, 'form.fields');
  const casilla2 = page.locator('label', { hasText: /Normative Benchmarking: mostrar todas las variables/ }).locator('input'); await casilla2.check(); await page.locator('form.fields', { has: casilla2 }).locator('button[type=submit]').click(); await page.waitForTimeout(700);
  await go(`#jugador-${P}?t=${t.hop}&b=fuerza`, 'table.pano');
  check('al volver a marcarla, reaparecen todas las variables', (await page.locator('section.panorama table.pano thead tr:first-child th').count()) >= 5);

  // ---- Política de seguridad: no se puede salir a internet y no hubo errores
  const externo = await page.evaluate(() => fetch('https://example.com/').then(() => 'salió', () => 'bloqueado'));
  check('política de seguridad: una petición a internet queda bloqueada', externo === 'bloqueado', externo);
  const propios = logs.filter((l) => !/example\.com/.test(l));
  check('sin errores de consola durante toda la prueba', propios.length === 0, JSON.stringify(propios.slice(0, 3)));
  await browser.close(); server.close();
  console.log(fail ? 'HAY FALLOS' : 'Todo bien'); process.exit(fail);
})().catch((e) => { console.error(e); server.close(); process.exit(2); });
