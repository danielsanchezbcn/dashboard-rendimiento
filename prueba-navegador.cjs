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
  const vars = await page.evaluate(() => [...document.querySelectorAll('table.deficits tbody tr')].map((r) => r.children[2].innerText.trim().toLowerCase()));
  check('Déficits: fuera Torque, Force at 100 ms y RFD at 100 ms', !vars.some((v) => /torque|(force|rfd) at 100/.test(v)), JSON.stringify(vars.slice(0, 12)));
  check('Déficits: con la relativa al peso presente, no se lista la absoluta', !(vars.includes('peak force') && vars.includes('peak force relativo (bw)')) && !(vars.includes('max force') && vars.includes('max force relativo (bw)')), JSON.stringify(vars.filter((v) => /force/.test(v))));
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
  // Radar de Drop Jump 30 cm: tres ejes, título centrado pequeño y escala ajustada (13/11/2026)
  await go(`#jugador-${P}?t=${t.dj}&b=fuerza`, '#radar svg.radar-svg', 2000);
  if (CAP) await page.locator('#radar').first().screenshot({ path: path.join(CAP, 'radar-dj30.png') });
  const leeRadar = () => page.evaluate(() => {
    const svg = document.querySelector('#radar svg.radar-svg');
    const tx = [...svg.querySelectorAll('text')]; const poly = [...svg.querySelectorAll('polygon')];
    const pts = (p) => p.getAttribute('points').trim().split(/\s+/).map((q) => q.split(',').map(Number));
    const dist = (p) => Math.hypot(p[0] - 500, p[1] - 260);
    const centro = tx.filter((x) => Number(x.getAttribute('x')) === 500 && Number(x.getAttribute('y')) > 120 && Number(x.getAttribute('y')) < 400);
    const anchoTitulo = Math.max(0, ...centro.map((x) => x.getBBox().width));
    const radios = poly.flatMap((p) => pts(p).map(dist));
    const rMin = Math.min(...radios); const rDisp = Math.max(...radios) - rMin;
    const n = pts(poly[0]).length;
    // ¿dónde cae cada rótulo de eje y dónde empieza la leyenda? (la leyenda son las líneas cortas horizontales de abajo)
    const lineas = [...svg.querySelectorAll('g > line')].map((l) => Number(l.getAttribute('y1')));
    const yLeyenda = lineas.length ? Math.min(...lineas) : null;
    // rótulos de los ejes: nombre (21 px) y valor (20 px); la línea «Axis values» (18), la leyenda (19) y el pie (17) no cuentan
    const rotulos = tx.filter((x) => !centro.includes(x) && [20, 21].includes(Number(x.getAttribute('font-size'))));
    const yRotulos = Math.max(0, ...rotulos.map((x) => { const b = x.getBBox(); return b.y + b.height; }));
    const yPie = tx.find((x) => /Radius zoomed|off scale/.test(x.textContent))?.getBBox().y ?? null;
    return { ejes: n, poligonos: poly.length, tamTitulo: Math.max(0, ...centro.map((x) => Number(x.getAttribute('font-size')) || 0)), anchoTitulo, rMin, rDisp,
      pie: tx.find((x) => /Radius zoomed/.test(x.textContent))?.textContent ?? '',
      ejeValores: tx.find((x) => /^Axis values:/.test(x.textContent))?.textContent ?? '',
      rP50: Math.min(...pts(poly.find((p) => p.getAttribute('stroke') === '#fec900') ?? poly[0]).map(dist)),
      yLeyenda, yRotulos, yPie,
      repetidos: poly.map((x) => x.getAttribute('points')).length - new Set(poly.map((x) => x.getAttribute('points'))).size };
  });
  const rad = await leeRadar();
  check('radar Drop Jump: tres ejes', rad.ejes === 3, JSON.stringify(rad).slice(0, 220));
  check('radar Drop Jump: el título del centro cabe dentro del polígono más interior', rad.tamTitulo > 0 && rad.anchoTitulo / 2 <= rad.rMin * Math.cos(Math.PI / rad.ejes), `tam ${rad.tamTitulo}, ancho ${Math.round(rad.anchoTitulo)}, rMin ${Math.round(rad.rMin)}`);
  // Por defecto el radio vuelve a ser proporcional al cociente y a empezar en cero (13/11/2026): el P50 de La Liga queda en el radio de referencia (130) y no hay pie de escala.
  check('radar: por defecto el radio empieza en cero y el P50 de La Liga está en el radio de referencia', rad.pie === '' && Math.abs(rad.rP50 - 130) <= 1.5, `pie «${rad.pie}», r(P50) ${Math.round(rad.rP50)}`);
  check('radar: el gráfico dice de qué serie son los números de los ejes', /^Axis values: (Personal Average|Personal Best|latest measurement|first measurement)/.test(rad.ejeValores), rad.ejeValores);
  check('radar: ningún rótulo de eje pisa la leyenda', rad.yLeyenda !== null && rad.yRotulos > 0 && rad.yRotulos < rad.yLeyenda - 8, `rótulos hasta ${Math.round(rad.yRotulos)}, leyenda en ${rad.yLeyenda}`);
  // La escala ampliada es una opción, apagada por defecto, para cuando todas las líneas se superponen
  await page.locator('#radar .filters label.check input[type="checkbox"]').check(); await page.waitForTimeout(600);
  const radZ = await leeRadar();
  check('radar: al activar la escala ampliada el radio deja de empezar en cero y el pie lo dice', /^Radius zoomed to the data: \d+% to \d+% of the La Liga P50 \(does not start at zero\)/.test(radZ.pie) && radZ.rDisp > rad.rDisp * 2, `${radZ.pie} · separación entre polígonos ${Math.round(rad.rDisp)} → ${Math.round(radZ.rDisp)} px`);
  check('radar ampliado: los rótulos siguen sin pisar la leyenda ni el pie', radZ.yRotulos < radZ.yLeyenda - 8 && radZ.yLeyenda < radZ.yPie, `rótulos ${Math.round(radZ.yRotulos)}, leyenda ${radZ.yLeyenda}, pie ${Math.round(radZ.yPie)}`);
  await page.locator('#radar .filters label.check input[type="checkbox"]').uncheck(); await page.waitForTimeout(600);
  check('radar: al desactivarla vuelve a la escala de siempre', (await leeRadar()).pie === '');
  check('radar: ninguna línea se dibuja encima de otra idéntica', rad.repetidos === 0, JSON.stringify(rad).slice(0, 200));

  check('CMJ: el radar (perfil radial) aparece justo debajo de la tabla de columnas', (await page.locator('#radar').count()) === 1 && (await page.locator('#radar svg.radar-svg').count()) === 1, 'radar: ' + (await page.locator('#radar').count()) + ' svg: ' + (await page.locator('#radar svg.radar-svg').count()));
  await shot('cmj');

  // ---- Radar: la tabla de valores originales es desplegable y empieza cerrada (13/11/2026, pedido por el usuario)
  const despl = await page.evaluate(() => {
    const d = [...document.querySelectorAll('#radar details')].find((x) => /Original values and normalisation/.test(x.querySelector('summary')?.textContent ?? ''));
    return d ? { abierto: d.open, tabla: d.querySelectorAll('table').length, visible: d.querySelector('table')?.checkVisibility?.({ contentVisibilityAuto: true, visibilityProperty: true }) ?? null } : null;
  });
  check('radar: «Original values and normalisation» es un desplegable cerrado', !!despl && despl.abierto === false && despl.tabla === 1 && despl.visible === false && !(await page.locator('#radar details table').first().isVisible()), JSON.stringify(despl));

  // ---- Filtros de referencias en cuatro filas y selector de variable bajo el título (13/11/2026, pedido por el usuario)
  const filasDe = (legend) => page.evaluate((lg) => {
    const fs = [...document.querySelectorAll('fieldset.modes.filas')].find((f) => new RegExp(lg, 'i').test(f.querySelector('legend')?.textContent ?? ''));
    if (!fs) return null;
    const hijos = [...fs.children].map((e) => e.tagName.toLowerCase() + '.' + (e.className || ''));
    return { hijos, filas: [...fs.querySelectorAll(':scope > .ref-fila')].map((r) => [...r.querySelectorAll('label.check')].map((l) => l.innerText.trim())), tam: parseFloat(getComputedStyle(fs.querySelector('label.check')).fontSize) };
  }, legend);
  const fLong = await filasDe('Longitudinal Performance');
  check('longitudinal: el selector de variable va justo bajo el título', !!fLong && fLong.hijos[0].startsWith('legend') && fLong.hijos[1] === 'div.sel-variable', JSON.stringify(fLong?.hijos));
  check('longitudinal: fila 1 = medidas del jugador', !!fLong && fLong.filas[0].every((x) => /Personal Average|Personal Best|Latest|\d{2}\//.test(x)), JSON.stringify(fLong?.filas[0]));
  check('longitudinal: fila 2 = La Liga (P50, P50 posicional, P75, P75 posicional)', !!fLong && fLong.filas[1].every((x) => /La Liga/.test(x)) && /^P50 La Liga$/.test(fLong.filas[1][0]) && /P75 La Liga/.test(fLong.filas[1][2]), JSON.stringify(fLong?.filas[1]));
  check('longitudinal: fila 3 = Premier League', !!fLong && fLong.filas[2].every((x) => /Premier League/.test(x)) && fLong.filas.length === 3, JSON.stringify(fLong?.filas));
  check('longitudinal: letra reducida para que la fila quepa en una línea', !!fLong && fLong.tam > 0 && fLong.tam <= 13, String(fLong?.tam));
  if (CAP) { await page.locator('fieldset.modes.filas').first().screenshot({ path: path.join(CAP, 'filtros-filas.png') }); await page.locator('#radar').first().screenshot({ path: path.join(CAP, 'radar-cmj.png') }); }
  const fEsc = await filasDe('Benchmark-Contextualized Positioning');
  check('escala: selector bajo el título y fila 1 en orden Latest, PA, PB', !!fEsc && fEsc.hijos[1] === 'div.sel-variable' && fEsc.filas[0].length === 3 && /Personal Average/.test(fEsc.filas[0][1]) && /Personal Best/.test(fEsc.filas[0][2]), JSON.stringify(fEsc?.filas[0]));
  check('escala: La Liga en la fila 2 y Premier en la 3', !!fEsc && fEsc.filas[1].every((x) => /La Liga/.test(x)) && fEsc.filas[2].every((x) => /Premier League/.test(x)), JSON.stringify(fEsc?.filas.slice(1)));
  // El selector de debajo del título cambia la variable de TODA la página (el de arriba queda igual que él)
  const selArriba = () => page.evaluate(() => { const l = [...document.querySelectorAll('#detalle-variable label')].find((x) => /^Variable/.test(x.textContent.trim())); return l.querySelector('select').value; });
  const antesSel = await selArriba();
  const opcion = await page.evaluate(() => { const s = document.querySelector('fieldset.modes.filas .sel-variable select'); const o = [...s.options].find((x) => x.value !== s.value); return o ? o.value : null; });
  // se cambia disparando el evento (sin que Playwright desplace la pantalla por su cuenta), para poder medir si la página salta
  await page.evaluate((v) => { const s = document.querySelector('fieldset.modes.filas .sel-variable select'); s.value = v; s.dispatchEvent(new Event('change', { bubbles: true })); }, opcion);
  await page.waitForTimeout(800);
  check('el selector bajo el título cambia la variable de toda la página', (await selArriba()) === opcion && opcion !== antesSel, `${antesSel} → ${opcion} / ${await selArriba()}`);

  // La pantalla no debe saltar al cambiar de variable (13/11/2026, pedido por el usuario). Solo prueba de verdad un cambio en el que lo de
  // ARRIBA cambia de altura (`offsetTop` distinto): si el apartado se mueve dentro del documento y aun así se queda en el mismo punto de la
  // pantalla, es que se ha corregido el desplazamiento. Se buscan esos casos en varios tests; si no aparece ninguno, la prueba falla.
  const medir = () => page.evaluate(() => { const fs = [...document.querySelectorAll('fieldset.modes.filas')].find((f) => f.querySelector('.sel-variable select')); if (!fs) return null; let o = 0, e = fs; while (e) { o += e.offsetTop; e = e.offsetParent; } return { doc: o, pantalla: fs.getBoundingClientRect().top }; });
  let anclados = 0, saltos = '';
  for (const tk of ['cmj', 'hip', 'kpush']) {
    await go(`#jugador-${P}?t=${t[tk]}&b=fuerza`, 'fieldset.modes.filas');
    const ops = await page.evaluate(() => { const s = document.querySelector('fieldset.modes.filas .sel-variable select'); return s ? [...s.options].map((o) => o.value) : []; });
    for (const o of ops) {
      await page.evaluate(() => { const fs = [...document.querySelectorAll('fieldset.modes.filas')].find((f) => f.querySelector('.sel-variable select')); fs?.scrollIntoView({ block: 'center' }); });
      await page.waitForTimeout(150);
      const antes = await medir(); if (!antes) continue;
      await page.evaluate((v) => { const s = [...document.querySelectorAll('fieldset.modes.filas')].find((f) => f.querySelector('.sel-variable select')).querySelector('.sel-variable select'); s.value = v; s.dispatchEvent(new Event('change', { bubbles: true })); }, o);
      await page.waitForTimeout(800);
      const despues = await medir(); if (!despues) continue;
      if (Math.abs(despues.doc - antes.doc) <= 8) continue; // ese cambio no movía nada: no prueba nada
      if (Math.abs(despues.pantalla - antes.pantalla) <= 6) anclados++; else saltos += `${tk}/${o}: ${Math.round(antes.pantalla)}→${Math.round(despues.pantalla)} (doc ${Math.round(antes.doc)}→${Math.round(despues.doc)}); `;
    }
  }
  check('al cambiar de variable la pantalla no salta, aunque cambie la altura de lo que hay encima', anclados > 0 && saltos === '', `anclados: ${anclados}; saltos: ${saltos || 'ninguno'}`);

  // ---- COMPOSITE PROFILE SCORE (13/11/2026, especificación v0.3)
  await go(`#jugador-${P}?b=composite`, 'table.composite', 4000);
  const cps = await page.evaluate(() => {
    const filas = [...document.querySelectorAll('table.composite tbody tr')].map((tr) => [tr.querySelector('th').textContent.trim(), tr.querySelector('td').textContent.trim(), tr.querySelector('td .band')?.className ?? null]);
    const svg = document.querySelector('#bloque-composite svg.radar-svg') ?? document.querySelector('svg.radar-svg');
    const marcas = svg ? [...svg.querySelectorAll('text')].filter((t) => t.getAttribute('font-size') === '26').map((t) => t.textContent) : [];
    const leyenda = svg ? [...svg.querySelectorAll('g > line')].length : 0;
    const nLinea = [...document.querySelectorAll('p.muted')].map((p) => p.textContent).find((t) => /Percentiles sobre N/.test(t)) ?? '';
    const desgloses = [...document.querySelectorAll('details')].map((d) => d.querySelector('summary')?.textContent.trim()).filter((t) => /·/.test(t ?? ''));
    return { filas, marcas, leyenda, nLinea, desgloses, radar: !!svg, aria: svg?.getAttribute('aria-label') ?? '' };
  });
  if (CAP) { await page.locator('.card').filter({ hasText: 'COMPOSITE PROFILE SCORE' }).first().screenshot({ path: path.join(CAP, 'composite.png') }); await page.locator('svg.radar-svg').first().screenshot({ path: path.join(CAP, 'composite-radar.png') }); }
  const NOMBRES = 'Isometric Strength,Dynamic Strength,Short GCT Reactive Strength,Deceleration,Reactivity,Propulsive,Explosive / Snappy';
  check('COMPOSITE: las 7 cualidades, en el orden del documento', cps.filas.map((f) => f[0]).join() === NOMBRES, cps.filas.map((f) => f[0]).join());
  check('COMPOSITE: cada puntuación es un entero con su color, «No aplicable» o «—»', cps.filas.every(([, v, cls]) => (/^\d+$/.test(v) && Number(v) >= 0 && Number(v) <= 100 && /band band-/.test(cls ?? '')) || v === 'No aplicable' || v === '—'), JSON.stringify(cps.filas));
  check('COMPOSITE: al menos una de Propulsive y Explosive sale «No aplicable» (consecuencia de comparar sus percentiles)', ['Propulsive', 'Explosive / Snappy'].some((n) => cps.filas.find((f) => f[0] === n)?.[1] === 'No aplicable'), JSON.stringify(cps.filas.slice(5)));
  check('COMPOSITE: el radar tiene los 7 ejes con su marca', cps.radar && cps.marcas.length === 7 && cps.marcas.every((m) => /^\d+$|^n\/a$|^—$/.test(m)), JSON.stringify(cps.marcas));
  check('COMPOSITE: un eje sin puntuación se marca «n/a» o «—» y nunca como 0', cps.marcas.every((m, i) => (cps.filas[i][1] === 'No aplicable' ? m === 'n/a' : cps.filas[i][1] === '—' ? m === '—' : m === cps.filas[i][1])), `${JSON.stringify(cps.marcas)} vs ${JSON.stringify(cps.filas.map((f) => f[1]))}`);
  check('COMPOSITE: línea de contexto con el N de la referencia', /^Percentiles sobre N = [\d–]+ jugadores de la base\.$/.test(cps.nLinea.trim()), cps.nLinea);
  check('COMPOSITE: un desglose por cualidad', cps.desgloses.length === 7, JSON.stringify(cps.desgloses));
  // Las referencias elegidas salen como columnas del cuadro, con los mismos valores que dibuja el radar (13/11/2026, pedido por el usuario)
  const cols = await page.evaluate(() => {
    const cab = [...document.querySelectorAll('table.composite thead th')].map((t) => t.textContent.trim());
    const fila = [...document.querySelectorAll('table.composite tbody tr')[0].children].map((t) => t.textContent.trim());
    const radarUltimo = (() => { const card = [...document.querySelectorAll('.card')].find((c) => /COMPOSITE PROFILE SCORE/.test(c.querySelector('h2,h3')?.textContent ?? ''));
      const svg = card?.querySelector('svg.radar-svg'); const tabla = card?.querySelector('table.composite'); const det = [...card?.querySelectorAll('details') ?? []].filter((d) => /·/.test(d.querySelector('summary')?.textContent ?? ''));
      return svg && tabla && det.length ? (svg.compareDocumentPosition(tabla) & Node.DOCUMENT_POSITION_PRECEDING) !== 0 && (svg.compareDocumentPosition(det[det.length - 1]) & Node.DOCUMENT_POSITION_PRECEDING) !== 0 : null; })();
    return { cab, fila, radarUltimo };
  });
  check('COMPOSITE: la columna de valor es la del filtro y las referencias elegidas son columnas', cols.cab[1] === 'PA' && cols.cab.slice(2).join() === 'P50 La Liga' && cols.fila.length === 3, JSON.stringify(cols.cab));
  check('COMPOSITE: el valor de la columna de referencia es el mismo que dibuja el radar', cols.fila[2] === '50', JSON.stringify(cols.fila));
  check('COMPOSITE: el radar va debajo de la tabla y de los desgloses', cols.radarUltimo === true, String(cols.radarUltimo));

  // Invariante importante: el percentil que usa COMPOSITE para una variable tiene que ser EXACTAMENTE el que muestra «Normative Benchmarking»
  // de ese test con la misma base. Si algún día se duplica el cálculo, esta prueba lo caza (13/11/2026).
  const pctComposite = await page.evaluate(() => {
    const d = [...document.querySelectorAll('details')].filter((x) => /·/.test(x.querySelector('summary')?.textContent ?? ''))[1];
    d.open = true;
    const tr = [...d.querySelectorAll('table.composite-det tbody tr')].find((r) => r.children[0].textContent.trim().startsWith('JH (imp-mom)'));
    return tr ? tr.children[2].textContent.trim() : null;
  });
  await go(`#jugador-${P}?t=${t.cmj}&b=fuerza&pn=pa`, 'table.pano.norm');
  const pctNb = await page.evaluate(() => {
    const tb = document.querySelector('table.pano.norm');
    let k = 0;
    const idx = [...tb.querySelectorAll('thead tr:first-child th')].map((h) => { const o = { n: (h.querySelector('.pano-nm')?.innerText ?? '').trim(), i: k }; k += h.colSpan; return o; }).find((o) => o.n.toLowerCase() === 'jh (imp-mom)');
    const fila = [...tb.querySelectorAll('tbody tr')].find((r) => /La Liga percentile\)$/.test(r.querySelector('th').innerText.trim()));
    return idx && fila ? [...fila.querySelectorAll('td')][idx.i].innerText.trim() : null;
  });
  check('COMPOSITE: el percentil de una variable es el mismo que muestra Normative Benchmarking', pctComposite !== null && pctNb !== null && pctNb.includes(pctComposite), `composite: ${pctComposite} · normative: ${pctNb}`);
  await go(`#jugador-${P}?b=composite`, 'table.composite', 4000);

  // El desglose: pesos, los dos lados del Knee Iso-Push, la altura del Drop Jump y lo que falta
  const det = await page.evaluate(() => {
    const ds = [...document.querySelectorAll('details')].filter((d) => /·/.test(d.querySelector('summary')?.textContent ?? ''));
    ds.forEach((d) => { d.open = true; });
    return ds.map((d) => ({ titulo: d.querySelector('summary').textContent.trim(), texto: d.textContent, filas: [...d.querySelectorAll('table.composite-det tbody tr')].map((tr) => [...tr.children].map((c) => c.textContent.trim())) }));
  });
  const dIso = det[0], dDin = det[1], dGct = det[2];
  check('COMPOSITE: el desglose dice el peso de cada variable de puntuación', dDin.filas[0].at(-1) === 'peso 70 %' && dDin.filas[1].at(-1) === 'peso 15 %' && dDin.filas[2].at(-1) === 'peso 15 %', JSON.stringify(dDin.filas.map((f) => f.at(-1))));
  check('COMPOSITE: el Knee Iso-Push muestra las dos piernas', dIso.filas[0][0].includes('izquierda') && dIso.filas[1][0].includes('derecha'), JSON.stringify(dIso.filas.slice(0, 2).map((f) => f[0])));
  check('COMPOSITE: el DSI aparece por lado con su etiqueta de orientación', dIso.filas.filter((f) => /^DSI/.test(f[0])).length === 2 && /strength training/i.test(dIso.filas.find((f) => /^DSI/.test(f[0])).at(-1)), JSON.stringify(dIso.filas.filter((f) => /^DSI/.test(f[0]))));
  check('COMPOSITE: el impulso se usa por kilo (N s/kg), no en N·s absolutos', dDin.filas.some((f) => /CON IMPULSE\/BM/.test(f[0]) && /N s\/kg/.test(f[1])), JSON.stringify(dDin.filas.map((f) => f.slice(0, 2))));
  check('COMPOSITE: el Drop Jump dice de qué altura es cada dato', dGct.filas.filter((f) => /^(30|45) cm · /.test(f[0])).length >= 1, JSON.stringify(dGct.filas.map((f) => f[0])));
  // Short GCT puntúa con las DOS mitades: Drop Jump (de la altura de la ORZ) y Double-Leg Hop Test. El nombre del Hop Test estaba mal escrito
  // en el código («Hop Test») y la mitad del Hop se perdía en silencio; esta comprobación es el guardián de ese fallo (14/11/2026).
  const filaConValor = (f) => f[1] !== '—' && /^\d+$/.test(f[2]);
  check('COMPOSITE: Short GCT usa el Drop Jump y el Hop Test, los dos con dato y percentil', dGct.filas.some((f) => /^(30|45) cm · RSI/.test(f[0]) && filaConValor(f)) && dGct.filas.some((f) => /^MEAN RSI/.test(f[0]) && filaConValor(f)), JSON.stringify(dGct.filas.map((f) => f.slice(0, 3))));
  check('COMPOSITE: las interpretativas del Hop Test también traen dato', dGct.filas.some((f) => /^MEAN CONTACT TIME/.test(f[0]) && filaConValor(f)) && dGct.filas.some((f) => /^MEAN JUMP HEIGHT/.test(f[0]) && filaConValor(f)), JSON.stringify(dGct.filas.map((f) => f[0])));
  // Las referencias del radar se activan y desactivan
  const lineasLeyenda = () => page.evaluate(() => [...document.querySelector('svg.radar-svg').querySelectorAll('g > line')].length);
  const antesLeg = await lineasLeyenda();
  await page.evaluate(() => [...document.querySelectorAll('fieldset.modes')].find((f) => /Referencia La Liga/.test(f.querySelector('legend').textContent)).querySelectorAll('input[type="checkbox"]')[2].click());
  await page.waitForTimeout(500);
  check('COMPOSITE: activar el P75 de La Liga añade su polígono al radar', (await lineasLeyenda()) === antesLeg + 1, `${antesLeg} → ${await lineasLeyenda()}`);
  check('COMPOSITE: y también su columna en el cuadro', (await page.evaluate(() => [...document.querySelectorAll('table.composite thead th')].map((t) => t.textContent.trim()).join())) === 'Cualidad,PA,P50 La Liga,P75 La Liga');
  if (CAP) await page.locator('.card').filter({ hasText: 'COMPOSITE PROFILE SCORE' }).first().screenshot({ path: path.join(CAP, 'composite2.png') });
  // El filtro de valor cambia tabla, radar y desglose a la vez
  const fechasPA = det[1].filas[0][3];
  await page.evaluate(() => [...document.querySelectorAll('fieldset.modes')].find((f) => /Valor/.test(f.querySelector('legend').textContent)).querySelectorAll('input[type="radio"]')[0].click());
  await page.waitForTimeout(600);
  const trasCps = await page.evaluate(() => {
    const d = [...document.querySelectorAll('details')].filter((x) => /·/.test(x.querySelector('summary')?.textContent ?? ''))[1];
    d.open = true;
    return { fecha: d.querySelectorAll('table.composite-det tbody tr')[0].children[3].textContent.trim(), aria: document.querySelector('svg.radar-svg').getAttribute('aria-label'), base: [...document.querySelectorAll('fieldset.modes input[type="radio"]')].findIndex((r) => r.checked) };
  });
  check('COMPOSITE: al cambiar a Latest el desglose pasa a la fecha de la última sesión', trasCps.fecha !== fechasPA && !trasCps.fecha.includes('–') && fechasPA.includes('–'), `${fechasPA} → ${trasCps.fecha}`);
  check('COMPOSITE: el radar sigue hablando de las mismas 7 cualidades', (trasCps.aria.match(/;/g) ?? []).length === 6, trasCps.aria.slice(0, 120));

  // ---- CMJ: las asimetrías del propio test, con su selector independiente (13/11/2026, pedido por el usuario)
  await go(`#jugador-${P}?t=${t.cmj}&b=fuerza`, '.evo');
  const asimUi = await page.evaluate(() => {
    const sec = [...document.querySelectorAll('.evo section')].find((x) => /Interlimb Asymmetry Over Time/.test(x.querySelector('h4')?.textContent ?? ''));
    if (!sec) return null;
    const s = sec.querySelector('.sel-variable select');
    return { opciones: s ? [...s.options].map((o) => o.text) : [], valor: s?.value ?? null, lienzos: sec.querySelectorAll('canvas').length, etiqueta: sec.querySelector('.sel-variable label')?.innerText.trim() ?? '' };
  });
  check('CMJ: la sección de asimetrías tiene su propio selector', !!asimUi && /^Asimetría de/.test(asimUi.etiqueta) && asimUi.lienzos === 1, JSON.stringify(asimUi).slice(0, 200));
  check('CMJ: el selector incluye las 5 asimetrías ya calculadas por VALD', !!asimUi && asimUi.opciones.filter((o) => /ya calculada \(VALD\)/.test(o)).length === 5, JSON.stringify(asimUi?.opciones));
  const valdOpt = await page.evaluate(() => { const s = [...document.querySelectorAll('.evo section .sel-variable select')].pop(); const o = [...s.options].find((x) => /ya calculada \(VALD\)/.test(x.text)); return o ? { v: o.value, t: o.text } : null; });
  await page.selectOption('.evo section .sel-variable select >> nth=-1', valdOpt.v); await page.waitForTimeout(700);
  const tras = await page.evaluate(() => {
    const sec = [...document.querySelectorAll('.evo section')].find((x) => /Interlimb Asymmetry Over Time/.test(x.querySelector('h4')?.textContent ?? ''));
    const arriba = [...document.querySelectorAll('#detalle-variable label')].find((x) => /^Variable/.test(x.textContent.trim())).querySelector('select').value;
    return { sel: sec.querySelector('.sel-variable select').value, lienzos: sec.querySelectorAll('canvas').length, nota: sec.querySelector('details')?.textContent ?? '', arriba, url: location.hash };
  });
  check('CMJ: al elegir una asimetría de VALD se dibuja y lo dice la nota', tras.sel === valdOpt.v && tras.lienzos === 1 && /ya viene calculada en el fichero de VALD/.test(tras.nota), JSON.stringify(tras).slice(0, 220));
  check('CMJ: el selector de asimetría es independiente del de la página', tras.arriba !== valdOpt.v && /[?&]va=/.test(tras.url), `variable de la página: ${tras.arriba}, asimetría: ${valdOpt.v}, ${tras.url}`);
  if (CAP) await page.locator('.evo section').filter({ hasText: 'Interlimb Asymmetry Over Time' }).first().screenshot({ path: path.join(CAP, 'asimetria-cmj.png') });
  await shot('cmj-asimetrias');

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
