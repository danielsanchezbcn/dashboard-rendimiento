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
  // Ancho de la ventana: 1840 px por defecto; VW=1440 (o el que sea) para revisar cómo quedan las tablas en una pantalla más estrecha.
  const VW = Number(process.env.VW) > 0 ? Number(process.env.VW) : 1840;
  const browser = await chromium.launch(); const ctx = await browser.newContext({ viewport: { width: VW, height: 1000 }, colorScheme: 'dark' });
  const page = await ctx.newPage(); const logs = [];
  // El modelo de pose de MediaPipe (pose_landmarker_full.task, 9 MB) no está en el repositorio: lo sube el usuario aparte. Sin él, «Medir ángulos»
  // cae a MANUAL a propósito, así que su 404 es el comportamiento esperado y no cuenta como error (cualquier otro 404 sí).
  const ESPERADO_404 = /pose_landmarker_full\.task/;
  page.on('console', (m) => { if (m.type() === 'error' && !ESPERADO_404.test(m.location()?.url ?? '')) logs.push(m.text()); }); page.on('pageerror', (e) => logs.push('pageerror ' + e.message));
  const shot = async (n) => { if (CAP) await page.screenshot({ path: path.join(CAP, n + '.png') }); };
  const go = async (hash, sel, ms = 1200) => { await page.goto(base + hash); if (sel) await page.waitForSelector(sel, { timeout: 15000 }); await page.waitForTimeout(ms); };
  const texts = (sel) => page.locator(sel).allInnerTexts();
  // El desglose de COMPOSITE se abre pulsando el nombre de la cualidad. Preact no redibuja dentro de un mismo `evaluate`, así que cada clic lleva su espera.
  const cualClic = async (i, queremos) => { const hecho = await page.evaluate(([k, q]) => { const b = [...document.querySelectorAll('table.composite button.fila-abre')][k]; if (!b) return false; if ((b.getAttribute('aria-expanded') === 'true') === q) return true; b.click(); return true; }, [i, queremos]); if (hecho) await page.waitForTimeout(220); return hecho; };
  const cualTodas = async (queremos) => { for (let i = 0; i < 8; i++) if (!(await cualClic(i, queremos))) break; };
  // ¿Caben estas tablas sin desplazamiento horizontal en una pantalla normal? Se mide también a 1440 y 1280 px, no solo en la ventana ancha de la prueba (14/11/2026).
  const sinDesborde = async (sel) => {
    const malas = [];
    for (const w of [...new Set([VW, 1840, 1440, 1280])]) {
      await page.setViewportSize({ width: w, height: 1000 }); await page.waitForTimeout(350);
      await cualTodas(true);
      const r = await page.evaluate((s2) => { document.querySelectorAll('details').forEach((d) => { d.open = true; }); const ws = [...document.querySelectorAll(s2)].map((t) => t.closest('.table-wrap') ?? t); return { tabla: ws.some((x) => x.scrollWidth > x.clientWidth + 1), pagina: document.documentElement.scrollWidth > window.innerWidth + 1 }; }, sel);
      if (r.tabla || r.pagina) malas.push(`${w}px${r.tabla ? ' tabla' : ''}${r.pagina ? ' página' : ''}`);
    }
    await page.setViewportSize({ width: VW, height: 1000 }); await page.waitForTimeout(350);
    return malas;
  };

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
    out.byTest.lpd = T('Double-Leg Leg Press 45° 8RM').id; out.byTest.lpu = T('Single-Leg Leg Press 45° 8RM').id; // Leg Press 45° 8RM (23/11/2026): bilateral y por pierna
    out.byTest.manual = T('Supine Isometric Ankle Inversion').id; // test de alta manual (no se importa: se escribe a mano)
    out.byTest.toe = tests.find((x) => x.blockKey === 'nme' && /toe/i.test(x.name))?.id ?? null;
    out.byTest.hipnme = tests.find((x) => x.blockKey === 'nme' && x.name === 'Hip')?.id ?? null; // exploración de cadera, NME (27/11/2026). OJO: `hip` ya es el Run-Specific Hip Iso-Push
    out.hipVars = Object.fromEntries(vars.filter((v) => v.testId === out.byTest.hipnme).map((v) => [v.name, v.id]));
    for (let i = 0; i < 12; i++) {
      const id = await new Promise((ok) => { const rq = db.transaction('players', 'readwrite').objectStore('players').add({ jerseyName: 'J' + (i + 1), active: true, referenceWeight: { value: 75, unit: 'kg' }, createdAt: now, updatedAt: now }); rq.onsuccess = () => ok(rq.result); });
      out.players.push(id);
      for (const [k, d] of [[0, '2026-08-01'], [1, '2026-09-01'], [2, '2026-10-01']]) for (const key of ['cmj', 'hop', 'dj', 'sj']) await seed(T({ cmj: 'CMJ', hop: 'Double-Leg Hop Test', dj: 'DL Drop Jump 30 cm', sj: 'Squat Jump' }[key]), id, d, k, i);
      await seed(T('SL CMJ'), id, '2026-10-01', 1, i); await seed(per, id, '2026-10-01', 1, i); await seed(T('Run-Specific Hip Iso-Push'), id, '2026-10-01', 1, i); await seed(T('Nordic Hamstring Exercise'), id, '2026-10-01', 1, i); await seed(T('Jurdan Test'), id, '2026-10-01', 1, i); await seed(T('Run-Specific Knee Iso-Push'), id, '2026-10-01', 1, i, 70); for (const [k2, d2] of [[0, '2026-09-01'], [1, '2026-10-01']]) await seed(T('Knee Iso-Hold 20 s'), id, d2, k2, i); await seed(T('DL Drop Jump 45 cm'), id, '2026-10-02', 2, i);
    }
    // Una valoración de cadera con un hallazgo de cada clase, para el bloque «Exploración de cadera» de Déficits: impingement positivo solo en la
    // derecha, rotación interna en SUPINO con grado 3 (articular), rotación interna en PRONO con grado 2 (muscular), flexión con grado 2 (sin origen)
    // y Bent Knee Over bilateral con grado 2. La izquierda de la rotación interna va a 1: por debajo del umbral, no tiene que salir.
    if (out.byTest.hipnme) {
      const V = out.hipVars;
      const valores = {
        [V['IMPINGEMENT']]: { L: 0, R: 1 },
        [V['HIP INTERNAL ROTATION · SUPINE POSITION']]: { L: 1, R: 3 },
        [V['HIP INTERNAL ROTATION · PRONE POSITION']]: { L: 2, R: 0 },
        [V['HIP EXTERNAL ROTATION · SUPINE POSITION']]: { L: 0, R: 0 },
        [V['HIP FLEXION']]: { L: 0, R: 2 },
        [V['BENT KNEE OVER']]: { S: 2 },
      };
      await new Promise((ok) => { const tx = db.transaction('sessions', 'readwrite'); tx.objectStore('sessions').add({ playerId: out.players[0], testId: out.byTest.hipnme, protocolId: null, date: '2026-10-05', time: '', values: valores, reps: {}, status: 'valid', excludedReason: '', source: 'manual', nota: 'Molestia referida en el gesto de golpeo.', createdAt: now, updatedAt: now }); tx.oncomplete = ok; });
    }
    out.vars = Object.fromEntries(vars.map((v) => [v.id, { name: v.name, testId: v.testId }]));
    return out;
  });
  const P = ids.players[5], iP = 5; const t = ids.byTest;

  // ---- Iso-Hold: Normative Benchmarking arriba del todo, con la carga, el MVIC iso-push, el %PIMA y el %BW/%SW y sus percentiles
  // Al escoger jugador, sin pedir bloque, se abre COMPOSITE PROFILE SCORE (15/11/2026, decisión del usuario).
  await go(`#jugador-${P}`, '.tabs [role="tab"]', 2500);
  const porDefecto = await page.evaluate(() => [...document.querySelectorAll('.tabs [role="tab"]')].find((b) => b.getAttribute('aria-selected') === 'true')?.textContent.trim() ?? '');
  check('Jugador: el bloque que se abre por defecto es COMPOSITE PROFILE SCORE', porDefecto === 'COMPOSITE PROFILE SCORE', porDefecto);
  await go(`#jugador-${P}?t=${t.khold}&b=fuerza`, '.evo table.pano', 1500);
  await shot('isohold');
  if (CAP) await page.locator('section.panorama').first().screenshot({ path: path.join(CAP, 'isohold-nb.png') });
  const iso = await page.evaluate(() => ({ primero: document.querySelector('.evo')?.firstElementChild?.className ?? '', cab: [...document.querySelectorAll('table.pano thead tr:first-child th')].map((x) => x.innerText.split('\n')[0].trim()), fil: Object.fromEntries([...document.querySelectorAll('table.pano tbody tr')].map((r) => [r.querySelector('th').innerText.trim(), [...r.querySelectorAll('td')].map((d) => d.innerText.trim())])) }));
  check('Iso-Hold: Normative Benchmarking es lo primero del test', iso.primero === 'panorama', iso.primero);
  check('Iso-Hold: columnas en el orden pedido (MVIC, carga, %PIMA, %BW/%SW)', iso.cab.join('|') === 'mvic iso-push (kg)|carga externa (kg)|%pima|%bw', iso.cab.join('|'));
  check('Iso-Hold: las cuatro variables, calculadas incluidas, tienen percentil de La Liga', (iso.fil['La Liga percentile'] ?? []).length === 4 && (iso.fil['La Liga percentile'] ?? []).every((x) => /^(\d+|n<\d+)$/.test(x)), JSON.stringify(iso.fil));

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
  await go(`#jugador-${PBAJO}?b=deficits`, 'table.deficits:not(.hip), .status.fail, p.muted', 2500);
  // 26/11/2026: la lista se organiza por bloques, como «Asimetrías» (bloque → subcategoría → una tabla por test), así que hay VARIAS tablas.
  const def = await page.evaluate(() => {
    const ts = [...document.querySelectorAll('table.deficits:not(.hip)')];
    return { tablas: ts.length, n: ts.reduce((a, t) => a + t.querySelectorAll('tbody tr').length, 0),
      pct: ts.flatMap((t) => [...t.querySelectorAll('tbody tr td:first-child .band')].map((x) => Number(x.innerText))),
      cab: ts[0] ? [...ts[0].querySelectorAll('thead th')].map((x) => x.innerText) : [],
      titulos: ts.map((t) => t.closest('details.plg-test')?.querySelector('summary .plg-txt')?.innerText.trim() ?? ''),
      enlaces: ts.map((t) => t.closest('details.plg-test')?.querySelector('summary .plg-extra a')?.getAttribute('href') ?? null) };
  });
  check('Déficits: tabla con percentil, variable, lado, valor, comparación y fecha (el test va en el título de cada tabla)', def.cab.join('|').toLowerCase() === 'percentil la liga|variable|lado|valor|% change vs previous session|fecha', def.cab.join('|'));
  check('Déficits: cada tabla lleva su test en el título, con enlace a su pantalla', def.tablas > 0 && def.titulos.every((x) => x.length > 2) && def.enlaces.every((h) => /^#jugador-\d+\?/.test(h ?? '')), JSON.stringify({ titulos: def.titulos.slice(0, 3), enlaces: def.enlaces.slice(0, 2) }));
  // La columna de comparación (14/11/2026): el título dice QUÉ compara y cambia con la base, y el contenido es un % con signo.
  const cabComp = async () => page.evaluate(() => ([...document.querySelectorAll('table.deficits:not(.hip) thead th')][4]?.innerText.trim() ?? '').toLowerCase());
  const compDef = async () => page.evaluate(() => [...document.querySelectorAll('table.deficits:not(.hip) tbody tr')].map((r) => r.children[4].innerText.trim()));
  // 16/11/2026: «Latest» va primero y viene marcado por defecto en todas las pantallas.
  check('Déficits: por defecto viene marcado Latest y compara con la sesión anterior', (await cabComp()) === '% change vs previous session', await cabComp());
  check('Déficits: las bases se llaman Latest, Personal Average y Personal Best', (await page.evaluate(() => [...document.querySelectorAll('fieldset.modes label.check')].map((l) => l.textContent.trim()).join('|'))).startsWith('Latest|Personal Average|Personal Best'), await page.evaluate(() => [...document.querySelectorAll('fieldset.modes label.check')].map((l) => l.textContent.trim()).join('|')));
  const compPA = await compDef();
  check('Déficits: la columna trae porcentajes con signo (o «—» si no hay con qué comparar)', compPA.length > 0 && compPA.every((x) => /^[+−]?\d+(,\d)? (%|p\.p\.)$|^—$/.test(x)) && compPA.some((x) => x !== '—'), JSON.stringify(compPA.slice(0, 6)));
  await page.locator('input[name="def-base"]').nth(1).check(); await page.waitForTimeout(400);
  check('Déficits: con Personal Average el título compara con el Personal Average', (await cabComp()) === '% latest session vs personal average', await cabComp());
  await page.locator('input[name="def-base"]').nth(2).check(); await page.waitForTimeout(400);
  check('Déficits: con Personal Best el título compara con el Personal Best', (await cabComp()) === '% latest session vs personal best', await cabComp());
  const ladoCol = await page.evaluate(() => { const c = (sel) => { const e = document.querySelector(sel); return e ? getComputedStyle(e).color : null; }; return { l: c('table.deficits:not(.hip) tbody td.asim-l'), r: c('table.deficits:not(.hip) tbody td.asim-r') }; });
  check('Déficits: el lado va en azul (izquierda) y naranja (derecha)', ladoCol.l === 'rgb(49, 179, 254)' && ladoCol.r === 'rgb(252, 145, 47)', JSON.stringify(ladoCol));
  const alinDef = await page.evaluate(() => { const t = document.querySelector('table.deficits:not(.hip)'); const al = (e) => getComputedStyle(e).textAlign; const th = [...t.querySelectorAll('thead th')]; const tr = t.querySelector('tbody tr'); return th.map((h, i) => `${al(h)}/${al(tr.children[i])}`); });
  check('Déficits: cada columna alineada con su título (todo centrado)', alinDef.every((x) => x === 'center/center'), alinDef.join(' · '));
  const anchoDef = await sinDesborde('table.deficits:not(.hip)');
  check('Déficits: cabe a lo ancho a 1840, 1440 y 1280 px, sin desplazamiento horizontal', anchoDef.length === 0, anchoDef.join(' · '));
  await shot('deficits');

  // ---- Exploración de cadera (27/11/2026): bloque por CRITERIO clínico dentro de Déficits, no por percentil.
  {
    const hip = await page.evaluate(() => {
      for (const d of document.querySelectorAll('details')) d.open = true;
      const bloques = [...document.querySelectorAll('.asim-h-bloque')].map((x) => x.innerText.split('\n')[0].trim());
      const tabla = document.querySelector('table.deficits.hip');
      if (!tabla) return { bloques, filas: null };
      return { bloques,
        cab: [...tabla.querySelectorAll('thead th')].map((x) => x.innerText.trim()),
        filas: [...tabla.querySelectorAll('tbody tr')].map((r) => [...r.children].map((c) => c.innerText.trim())),
        nota: document.querySelector('.hip-nota')?.innerText.replace(/\s+/g, ' ').trim() ?? '' };
    });
    check('Déficits: hay un bloque propio para la exploración de cadera', hip.bloques.some((b) => /Exploración de cadera/i.test(b)), JSON.stringify(hip.bloques));
    check('cadera: la tabla no lleva percentil ni comparación, sino hallazgo, test, lado, grado y anotación',
      (hip.cab ?? []).join('|').toLowerCase() === 'hallazgo|test|lado|grado|anotación', JSON.stringify(hip.cab));
    const filas = hip.filas ?? [];
    check('cadera: salen los cinco hallazgos y ninguno más (el grado 1 y los ceros no entran)', filas.length === 5, JSON.stringify(filas));
    check('cadera: el impingement positivo sale solo en la derecha', filas.filter((f) => /Impingement/i.test(f[0])).map((f) => `${f[2]}|${f[3]}`).join() === 'Derecha|Positivo (+)', JSON.stringify(filas.filter((f) => /Impingement/i.test(f[0]))));
    check('cadera: el grado se lee con su texto, no solo con el número', filas.some((f) => f[3] === '3 · Limitación severa') && filas.some((f) => f[3] === '2 · Limitación moderada'), JSON.stringify(filas.map((f) => f[3])));
    check('cadera: el déficit en decúbito supino se anota como compromiso articular',
      filas.filter((f) => /SUPINE/i.test(f[1])).every((f) => /articular/i.test(f[4])) && filas.some((f) => /SUPINE/i.test(f[1])), JSON.stringify(filas.filter((f) => /SUPINE/i.test(f[1]))));
    check('cadera: el déficit en decúbito prono se anota como de origen muscular',
      filas.filter((f) => /PRONE/i.test(f[1])).every((f) => /muscular/i.test(f[4])) && filas.some((f) => /PRONE/i.test(f[1])), JSON.stringify(filas.filter((f) => /PRONE/i.test(f[1]))));
    check('cadera: la flexión y el Bent Knee Over salen sin anotación de origen',
      filas.filter((f) => /FLEXION|BENT KNEE/i.test(f[1])).every((f) => f[4] === '—'), JSON.stringify(filas.filter((f) => /FLEXION|BENT KNEE/i.test(f[1]))));
    check('cadera: el Bent Knee Over sale como bilateral, sin pierna', filas.filter((f) => /BENT KNEE/i.test(f[1])).map((f) => f[2]).join() === 'Bilateral', JSON.stringify(filas.filter((f) => /BENT KNEE/i.test(f[1]))));
    check('cadera: la anotación de texto de la valoración se enseña', /golpeo/.test(hip.nota), hip.nota);
    if (CAP) { await page.evaluate(() => document.querySelector('table.deficits.hip')?.closest('.asim-h-bloque')?.scrollIntoView({ block: 'center' })); await page.waitForTimeout(300);
      await page.locator('table.deficits.hip').screenshot({ path: path.join(CAP, 'deficits-cadera.png') }); }
  }

  // 26/11/2026: la barra con el jugador y los mandos tiene que seguir visible al bajar por la pantalla.
  await page.evaluate(() => window.scrollTo(0, 1200)); await page.waitForTimeout(350);
  const pegada = await page.evaluate(() => { const b = document.querySelector('.barra-fija'); if (!b) return null; const r = b.getBoundingClientRect();
    return { top: Math.round(r.top), visible: r.top >= -1 && r.top < 120 && r.height > 10, texto: b.innerText.replace(/\s+/g, ' ').slice(0, 60) }; });
  check('Déficits: al bajar por la pantalla, el jugador y los mandos siguen a la vista', !!pegada?.visible && /J\d/.test(pegada.texto), JSON.stringify(pegada));
  await shot('deficits-desplazado');
  await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(250);
  await page.locator('input[name="def-base"]').nth(0).check(); await page.waitForTimeout(400);
  // 16/11/2026: las filas del mismo test y variable van juntas (izquierda, derecha y asimetría) y los GRUPOS se ordenan por su percentil más bajo.
  const grupos = await page.evaluate(() => {
    const out = [];
    for (const t of document.querySelectorAll('table.deficits:not(.hip)')) {
      let g = null;
      for (const tr of t.querySelectorAll('tbody tr')) {
        if (tr.classList.contains('grupo-ini')) { g = { clave: (t.closest('details.plg-test')?.querySelector('summary .plg-txt')?.innerText.trim() ?? '') + ' | ' + tr.children[1].innerText.trim().replace(/\s*\(asimetría\)$/, ''), pct: [], lados: [] }; out.push(g); }
        g.pct.push(Number(tr.querySelector('td:first-child .band').innerText));
        g.lados.push(tr.children[2].innerText.trim() + (/asimetría/.test(tr.children[1].innerText) ? ' (asimetría)' : ''));
        if (!tr.classList.contains('grupo-ini') && tr.children[1].innerText.trim().replace(/\s*\(asimetría\)$/, '') !== '') g.repetido = true;
      }
    }
    return out;
  });
  // 26/11/2026: organizada por bloques como «Asimetrías», no por orden de percentil.
  const bloquesDef = await page.evaluate(() => {
    const card = document.querySelector('table.deficits:not(.hip)')?.closest('.card');
    const hs = [...(card?.querySelectorAll('summary.asim-h-bloque, summary.asim-h-sub') ?? [])].map((h) => (h.closest('details').classList.contains('plg-bloque') ? 'H3:' : 'H4:') + h.querySelector('.plg-txt').innerText.trim());
    return { hs, bloques: hs.filter((x) => x.startsWith('H3')).length, subs: hs.filter((x) => x.startsWith('H4')).length };
  });
  check('Déficits: organizada por bloques y subcategorías, igual que Asimetrías', bloquesDef.bloques >= 1 && bloquesDef.subs >= 1 && bloquesDef.hs[0].startsWith('H3'), JSON.stringify(bloquesDef.hs.slice(0, 6)));
  // 16/11/2026: los textos ocupan el ancho del cuadro; antes se cortaban a 70 caracteres y alargaban las pantallas.
  // Cada párrafo se compara con el ancho útil de SU PROPIO cuadro (16/11/2026): así la comprobación vale en cualquier pantalla,
  // en vez de exigir un número de píxeles que solo se cumple en monitores anchos.
  const anchoTexto = await page.evaluate(() => {
    const ps = [...document.querySelectorAll('.card p')].filter((x) => x.innerText.trim().length > 200);
    const mide = (p) => {
      const c = p.closest('.card'), cs = getComputedStyle(c);
      const util = c.getBoundingClientRect().width - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      return { falta: Math.round(util - p.getBoundingClientRect().width), ancho: Math.round(p.getBoundingClientRect().width), util: Math.round(util), txt: p.innerText.trim().slice(0, 40) };
    };
    const m = ps.map(mide).sort((a, b) => b.falta - a.falta);
    return { n: ps.length, peor: m[0] ?? null };
  });
  check('los textos largos ocupan el ancho del cuadro, no una columna estrecha', anchoTexto.n > 0 && anchoTexto.peor.falta <= 2, JSON.stringify(anchoTexto));
  check('Déficits: todas las filas están en el umbral o por debajo', def.n > 0 && def.pct.length === def.n && def.pct.every((x) => x <= 35), JSON.stringify(def.pct));
  check('Déficits: la variable se escribe una sola vez por grupo', grupos.length > 0 && !grupos.some((g) => g.repetido), JSON.stringify(grupos.filter((g) => g.repetido).slice(0, 2)));
  check('Déficits: cada test aparece en una sola tabla', def.titulos.length === new Set(def.titulos).size, JSON.stringify(def.titulos));
  check('Déficits: dentro del grupo, izquierda, derecha y asimetría en ese orden', grupos.every((g) => { const r = g.lados.map((l) => (/asimetría/.test(l) ? 2 : /Izquierda/.test(l) ? 0 : /Derecha/.test(l) ? 1 : 3)); return r.every((x, i) => i === 0 || x >= r[i - 1]); }), JSON.stringify(grupos.filter((g) => g.lados.length > 1).slice(0, 2)));
  check('Déficits: cuando una variable se repite por lado, sus filas van juntas', grupos.some((g) => g.lados.length > 1), JSON.stringify(grupos.slice(0, 3)));
  await page.locator('input[type=number]').first().fill('10');
  await page.waitForTimeout(600);
  const def10 = await page.evaluate(() => [...document.querySelectorAll('table.deficits:not(.hip) tbody tr td:first-child .band')].map((x) => Number(x.innerText)));
  const vars = await page.evaluate(() => [...document.querySelectorAll('table.deficits:not(.hip) tbody tr')].map((r) => r.children[2].innerText.trim().toLowerCase()));
  check('Déficits: fuera Torque, Force at 100 ms y RFD at 100 ms', !vars.some((v) => /torque|(force|rfd) at 100/.test(v)), JSON.stringify(vars.slice(0, 12)));
  check('Déficits: con la relativa al peso presente, no se lista la absoluta', !(vars.includes('peak force') && vars.includes('peak force relativo (bw)')) && !(vars.includes('max force') && vars.includes('max force relativo (bw)')), JSON.stringify(vars.filter((v) => /force/.test(v))));
  check('Déficits: al bajar el umbral a 10 solo quedan los percentiles ≤ 10', def10.every((x) => x <= 10) && def10.length <= def.n, JSON.stringify(def10));
  // El percentil que sale aquí debe ser EL MISMO que muestra Normative Benchmarking de ese test (una sola función de cálculo)
  // 26/11/2026: el enlace al test está en el título de su tabla, no en la fila.
  const primera = await page.evaluate(() => { const t = document.querySelector('table.deficits:not(.hip)'); const r = t?.querySelector('tbody tr'); return r ? { pct: Number(r.querySelector('.band').innerText), href: t.closest('details.plg-test').querySelector('summary .plg-extra a').getAttribute('href'), lado: r.children[2].innerText.trim(), variable: r.children[1].innerText.trim() } : null; });
  await page.locator('input[type=number]').first().fill('35');
  await page.waitForTimeout(400);
  if (primera) {
    await go(primera.href, 'table.pano', 1500);
    const enNb = await page.evaluate((v) => { const tb = document.querySelector('table.pano.norm'); const hs = [...tb.querySelectorAll('thead tr:first-child th')]; let k = 0; const idx = hs.map((h) => { const o = { n: (h.querySelector('.pano-nm')?.innerText ?? '').trim(), i: k, span: h.colSpan }; k += h.colSpan; return o; }).find((o) => o.n === v.variable); if (!idx) return null; const fila = [...tb.querySelectorAll('tbody tr')].find((r) => r.querySelector('th').innerText.trim() === 'La Liga percentile'); const tds = [...fila.querySelectorAll('td')]; const off = v.lado === 'Derecha' ? 1 : 0; return Number(tds[idx.i + (idx.span > 1 ? off : 0)].innerText.trim()); }, primera);
    check('Déficits: el percentil coincide con el de Normative Benchmarking de ese test', enNb === primera.pct, JSON.stringify({ deficits: primera, nb: enNb }));
  }

  // ---- Team-Wide Analysis: dispersión con el alias de cada jugador y base de la sección (26/11/2026)
  {
    await go('#relaciones', '.page-title');
    const opciones = await page.evaluate(() => { const s = document.querySelector('.filters select'); return s ? [...s.options].map((o) => o.value).filter(Boolean) : []; });
    if (opciones.length >= 2) {
      const ss = page.locator('.filters select');
      await ss.nth(0).selectOption(opciones[0]); await ss.nth(1).selectOption(opciones[1]);
      await page.locator('input[name="tw-base"]').nth(0).check(); // Latest
      await page.waitForTimeout(900);
      const d = await page.evaluate(() => { const svg = document.querySelector('svg.scatter'); if (!svg) return null;
        return { alias: [...svg.querySelectorAll('text.scatter-alias')].map((t) => t.textContent.trim()), puntos: svg.querySelectorAll('circle').length,
          base: [...document.querySelectorAll('input[name="tw-base"]')].findIndex((r) => r.checked) }; });
      check('Team-Wide Analysis: la dispersión escribe el alias de cada jugador y no dibuja puntos', !!d && d.alias.length > 0 && d.alias.every((a) => a.length > 0) && d.puntos === 0, JSON.stringify(d));
      check('Team-Wide Analysis: la base de la sección se puede cambiar (Latest, PA, PB)', d.base === 0 && (await page.locator('input[name="tw-base"]').count()) === 3, JSON.stringify(d?.base));
      const conLatest = await page.evaluate(() => document.body.innerText.match(/Valor de cada jugador:\s*([^.]+)\./)?.[1]?.trim() ?? '');
      await page.locator('input[name="tw-base"]').nth(2).check(); await page.waitForTimeout(800);
      const conPB = await page.evaluate(() => document.body.innerText.match(/Valor de cada jugador:\s*([^.]+)\./)?.[1]?.trim() ?? '');
      check('Team-Wide Analysis: el resumen dice con qué valor se ha calculado y cambia al cambiar la base', conLatest === 'Latest' && conPB === 'Personal Best', `${conLatest} → ${conPB}`);
      // Los tres cuadros nuevos (26/11/2026): mapa de calor, ranking y matriz de correlaciones.
      const ponTest = async (etiqueta, idx) => page.evaluate(({ e, i }) => {
        const l = [...document.querySelectorAll('.card label')].filter((x) => x.textContent.trim().startsWith(e))[i ?? 0];
        const sel = l?.querySelector('select'); const o = sel ? [...sel.options].find((x) => x.value) : null;
        if (sel && o) { sel.value = o.value; sel.dispatchEvent(new Event('change', { bubbles: true })); return o.text; } return null;
      }, { e: etiqueta, i: idx });
      await ponTest('Test', 0); await page.waitForTimeout(900);
      const calor = await page.evaluate(() => { const t = document.querySelector('table.calor'); if (!t) return null;
        const celdas = [...t.querySelectorAll('tbody td.calor-c')];
        return { filas: t.querySelectorAll('tbody tr').length, cols: t.querySelectorAll('thead th').length, conColor: celdas.filter((c) => /band-/.test(c.className)).length,
          conValor: celdas.filter((c) => c.querySelector('.calor-v')).length, medios: [...t.querySelectorAll('tbody tr td:last-child')].map((x) => Number(x.innerText.trim())).filter((x) => !Number.isNaN(x)) }; });
      check('Team-Wide: el mapa de calor pinta la banda del percentil y escribe el valor en cada celda',
        !!calor && calor.filas > 0 && calor.conValor > 0 && calor.conColor > 0, JSON.stringify(calor));
      check('Team-Wide: los jugadores van del percentil medio más bajo al más alto',
        !!calor && calor.medios.every((x, i, a) => i === 0 || x >= a[i - 1]), JSON.stringify(calor?.medios));
      const varRk = await ponTest('Variable', 2); await page.waitForTimeout(900);
      const rk = await page.evaluate(() => { const svg = document.querySelector('svg.ranking'); if (!svg) return null;
        return { barras: svg.querySelectorAll('rect').length, nombres: [...svg.querySelectorAll('text.ranking-nm')].map((t) => t.textContent.trim()), refs: svg.querySelectorAll('.ranking-reft').length }; });
      check('Team-Wide: el ranking dibuja una barra por jugador con su alias y las líneas P50 y P75',
        !!rk && rk.barras > 0 && rk.barras === rk.nombres.length && rk.nombres.every((x) => x.length > 0) && rk.refs === 2, JSON.stringify({ ...rk, varRk }));
      await ponTest('Test (filas)'); await ponTest('Test (columnas)'); await page.waitForTimeout(1200);
      const mz = await page.evaluate(() => { const t = document.querySelector('table.matriz'); if (!t) return null;
        const tds = [...t.querySelectorAll('tbody td')];
        return { filas: t.querySelectorAll('tbody tr').length, celdas: tds.length, diagonal: tds.filter((x) => x.classList.contains('m-misma')).length, textos: tds.map((x) => x.innerText.trim()).slice(0, 4) }; });
      check('Team-Wide: la matriz de correlaciones sale con su diagonal marcada', !!mz && mz.filas > 0 && mz.diagonal === mz.filas, JSON.stringify(mz));
      await shot('team-wide');
      await page.evaluate(() => document.querySelector('table.calor')?.closest('.card')?.scrollIntoView({ block: 'start' })); await page.waitForTimeout(400);
      await shot('team-wide-calor');
      await page.evaluate(() => document.querySelector('svg.ranking')?.closest('.card')?.scrollIntoView({ block: 'start' })); await page.waitForTimeout(400);
      await shot('team-wide-ranking');
      await page.evaluate(() => document.querySelector('table.matriz')?.closest('.card')?.scrollIntoView({ block: 'start' })); await page.waitForTimeout(400);
      await shot('team-wide-matriz');
    }
  }

  // ---- Menú y pestañas
  await go('#inicio', '.tabs-nav');
  check('menú: 6 entradas, con «Configuración ISO-rack» detrás de «Team-Wide Analysis»', (await texts('nav.nav a')).join('|') === 'Inicio|Players|Team-Wide Analysis|Configuración ISO-rack|Catálogo de tests|Importar', (await texts('nav.nav a')).join('|'));
  check('Inicio: pestañas Copias de seguridad y Configuración (sin Resumen)', (await texts('.tabs-nav a')).join('|').toLowerCase() === 'copias de seguridad|configuración'); // innerText ya aplica las mayúsculas del CSS
  check('Inicio muestra el resumen dentro de Copias de seguridad', (await texts('h2')).some((x) => /copia de seguridad/i.test(x)) && (await texts('h3')).concat(await texts('h2')).some((x) => /estado de la base/i.test(x))); // los títulos de panel van en versalitas: innerText ya las aplica
  await go('#copias', '.tabs-nav'); check('#copias sigue funcionando y marca la pestaña Copias de seguridad', (await texts('.tabs-nav a.on')).join('').toLowerCase() === 'copias de seguridad');
  await go('#nme', '.tabs-nav'); check('Catálogo de tests agrupa Manifestaciones, NME, Datos antropométricos y Catálogo', (await texts('.tabs-nav a')).join('|').toLowerCase() === 'manifestaciones de la fuerza|nme|datos antropométricos|catálogo y edición' && (await texts('nav.nav a.active')).join('') === 'Catálogo de tests');

  // ---- Leg Press 45° 8RM (23/11/2026): importar un libro con medida bilateral y por pierna, y comprobar que el %BW sale solo.
  await go('#importar', '.modes [role="tab"]', 8000);
  await page.getByRole('tab', { name: 'Cargas bilateral y por pierna (Excel)' }).click();
  await page.waitForSelector('input[type="file"]', { timeout: 8000 });
  const csvLeg = ['QUADRICEPS,BODYWEIGHT,LEG PRESS 45º (8 REPETICIONES)',
    ',KILOGRAMS,DOUBLE LEG,RELATIVO A PESO INDIVIDUAL,IZQIUERDA,DERECHA,ASYMMETRY,RELATIVO A PESO INDIVIDUAL',
    'J6,75,120,1.6,40,38,5,0.52', 'J7,80,140,1.75,45,45,0,0.5625', 'J8,70,,,,,,'].join('\n');
  await page.locator('input[type="file"]').setInputFiles({ name: 'LEG_PRESS.csv', mimeType: 'text/csv', buffer: Buffer.from(csvLeg, 'utf8') });
  await page.waitForSelector('table.cargas-dos', { timeout: 10000 });
  const prev = await page.evaluate(() => {
    const tb = document.querySelector('table.cargas-dos');
    const sel = [...document.querySelectorAll('.filters select')].map((s) => s.options[s.selectedIndex]?.textContent.trim() ?? '');
    return { cab: [...tb.querySelectorAll('thead th')].map((x) => x.textContent.trim()), filas: [...tb.querySelectorAll('tbody tr')].map((tr) => [...tr.querySelectorAll('th,td')].map((c) => c.textContent.trim())), sel };
  });
  check('Leg Press: la vista previa separa bilateral, izquierda y derecha', prev.cab.join('|') === 'Nombre en el Excel|Jugador|Bilateral (kg)|Izquierda (kg)|Derecha (kg)|Estado', prev.cab.join('|'));
  check('Leg Press: lee las tres cargas y marca la fila sin datos', prev.filas.length === 3 && prev.filas[0][2] === '120' && prev.filas[0][3] === '40' && prev.filas[0][4] === '38' && /se omite/.test(prev.filas[2][5]), JSON.stringify(prev.filas));
  check('Leg Press: propone los dos tests del catálogo a partir del título de la hoja', prev.sel.some((x) => /double-leg leg press/i.test(x)) && prev.sel.some((x) => /single-leg leg press/i.test(x)), JSON.stringify(prev.sel));
  await page.evaluate(() => { const i = document.querySelector('input[type="date"]'); const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set; set.call(i, '2026-11-20'); i.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.waitForTimeout(400);
  await page.getByRole('button', { name: /^Importar \d+ sesión/ }).click();
  for (let i = 0; i < 40 && !(await page.evaluate(() => [...document.querySelectorAll('.status.ok')].some((x) => /Creadas:/.test(x.textContent)))); i++) await page.waitForTimeout(250);
  const resLeg = await page.evaluate(() => [...document.querySelectorAll('.status.ok')].map((x) => x.textContent.trim()).find((x) => /Creadas:/.test(x)) ?? '');
  check('Leg Press: importa 2 sesiones bilaterales y 2 por pierna', /Creadas: 2 bilaterales y 2 por pierna/.test(resLeg), resLeg);
  // El test unilateral guarda cada pierna, así que la asimetría y el %BW salen solos (el jugador tiene peso de referencia de 75 kg).
  await go(`#jugador-${ids.players[5]}?t=${t.lpu}&b=fuerza`, '.evo', 8000);
  const lpu = await page.evaluate(() => ({
    vars: [...document.querySelectorAll('.evo select option, .modes label.check')].map((x) => x.textContent.trim()),
    campos: [...document.querySelectorAll('form[aria-label="Alta manual de carga"] label')].map((x) => x.textContent.trim()),
  }));
  check('Leg Press por pierna: el alta manual pide izquierda y derecha, no una sola carga', lpu.campos.some((x) => /Carga izquierda/.test(x)) && lpu.campos.some((x) => /Carga derecha/.test(x)) && !lpu.campos.some((x) => /^Carga \(kg\)/.test(x)), JSON.stringify(lpu.campos));
  check('Leg Press por pierna: el %BW aparece entre las variables', lpu.vars.some((x) => /^%bw/i.test(x)), JSON.stringify(lpu.vars.slice(0, 6)));
  const valores = await page.evaluate(() => {
    const filas = [...document.querySelectorAll('table tbody tr')].map((tr) => [...tr.querySelectorAll('th,td')].map((c) => c.textContent.trim()));
    return filas.filter((f) => f.join(' ').includes('20/11/2026'));
  });
  // Se muestra el %BW (la variable relativa va primero): 40 y 38 kg con el peso de referencia de 75 kg son 53,33 % y 50,67 %. Es la comprobación
  // de punta a punta de que la carga por pierna importada se relativiza sola, sin medición antropométrica.
  check('Leg Press por pierna: la sesión importada se relativiza sola al peso (53,33 % y 50,67 %)',
    valores.some((f) => f.join('|').includes('53,33') && f.join('|').includes('50,67')), JSON.stringify(valores.slice(0, 2)));
  // «Ver todos los jugadores en este test»: los kilos movilizados y el %BW, siempre los dos a la vez (24/11/2026).
  await go(`#test-${t.lpu}`, 'table.tabla-comp', 10000);
  const comp = await page.evaluate(() => {
    const tb = document.querySelector('table.tabla-comp');
    const grupos = [...tb.querySelectorAll('thead tr:first-child th')].map((x) => x.textContent.trim());
    const fila = [...tb.querySelectorAll('tbody tr')].map((tr) => [...tr.querySelectorAll('th,td')].map((c) => c.textContent.trim())).find((f) => f.join('|').includes('53,33'));
    return { grupos, fila, sub: [...tb.querySelectorAll('thead tr:nth-child(2) th')].map((x) => x.textContent.trim()) };
  });
  check('Todos los jugadores: la tabla enseña el valor y, al lado, la carga en kilos', comp.grupos.some((x) => /^Valor \(%\)/.test(x)) && comp.grupos.some((x) => /carga máxima \(kg\)/i.test(x)), JSON.stringify(comp.grupos));
  check('Todos los jugadores: los kilos sin relativizar aparecen junto al %BW', comp.fila && comp.fila.join('|').includes('53,33') && comp.fila.join('|').includes('40'), JSON.stringify(comp.fila));
  check('Todos los jugadores: cada grupo lleva sus dos lados', comp.sub.filter((x) => x === 'Left').length >= 2 && comp.sub.filter((x) => x === 'Right').length >= 2, JSON.stringify(comp.sub));
  await go(`#jugador-${ids.players[5]}?t=${t.lpd}&b=fuerza`, '.evo', 8000);
  const lpd = await page.evaluate(() => [...document.querySelectorAll('form[aria-label="Alta manual de carga"] label')].map((x) => x.textContent.trim()));
  check('Leg Press bilateral: el alta manual sigue pidiendo una sola carga', lpd.some((x) => /^Carga \(kg\)/.test(x)) && !lpd.some((x) => /Carga izquierda/.test(x)), JSON.stringify(lpd));

  // ---- Medir ángulos (18/11/2026): el PNG que se descarga ya no es el lienzo de pantalla, sino la composición redibujada a 2000 px de lado largo
  // (sin pasar nunca de la resolución real de la foto), y la herramienta se puede poner a pantalla completa.
  await go('#nme-angulos', 'iframe.angulos-marco', 20000);
  const marcoAng = page.frameLocator('iframe.angulos-marco');
  const docAng = () => page.frames().find((f) => /angulos\.html/.test(f.url()));
  await marcoAng.locator('#fileP1').waitFor({ state: 'attached', timeout: 20000 });
  // Dos fotos sintéticas creadas en el propio navegador: una grande (se recorta a 2000) y una pequeña (no se amplía).
  const fotoDe = async (w, h) => {
    const b64 = await page.evaluate(([w, h]) => {
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      const g = c.getContext('2d'); g.fillStyle = '#303035'; g.fillRect(0, 0, w, h);
      g.strokeStyle = '#6a6a70'; for (let x = 0; x < w; x += 80) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
      return c.toDataURL('image/png').split(',')[1];
    }, [w, h]);
    return { name: `foto-${w}x${h}.png`, mimeType: 'image/png', buffer: Buffer.from(b64, 'base64') };
  };
  await marcoAng.locator('#fileP1').setInputFiles(await fotoDe(3000, 4000));
  await marcoAng.locator('#fileP2').setInputFiles(await fotoDe(1200, 1600));
  for (let i = 0; i < 40 && !(await docAng().evaluate(() => document.getElementById('canvasP2').width > 300)); i++) await page.waitForTimeout(250);
  const lienzos = await docAng().evaluate(() => ['canvasP1', 'canvasP2'].map((id) => { const c = document.getElementById(id); const r = c.getBoundingClientRect(); return { pix: [c.width, c.height], css: [Math.round(r.width), Math.round(r.height)] }; }));
  check('Medir ángulos: en pantalla el lienzo mantiene el tamaño de siempre (píxeles = tamaño visible)',
    lienzos.every((l) => Math.abs(l.pix[0] - l.css[0]) <= 1 && Math.abs(l.pix[1] - l.css[1]) <= 1) && lienzos[0].css[1] > 300, JSON.stringify(lienzos));
  const descarga = async (sel) => {
    const [d] = await Promise.all([page.waitForEvent('download', { timeout: 25000 }), marcoAng.locator(sel).click()]);
    const f = path.join(require('os').tmpdir(), 'ang-' + Date.now() + '.png');
    await d.saveAs(f);
    const b = fs.readFileSync(f); fs.unlinkSync(f);
    return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
  };
  const png1 = await descarga('#exportPngP1');
  check('Medir ángulos: la foto grande se exporta a 2000 px de lado largo, no al tamaño de pantalla', png1.w === 1500 && png1.h === 2000, JSON.stringify(png1));
  const png2 = await descarga('#exportPngP2');
  check('Medir ángulos: una foto más pequeña que el tope se exporta a su resolución real, sin ampliar', png2.w === 1200 && png2.h === 1600, JSON.stringify(png2));
  const trasExportar = await docAng().evaluate(() => { const c = document.getElementById('canvasP1'); const r = c.getBoundingClientRect(); return { pix: [c.width, c.height], css: [Math.round(r.width), Math.round(r.height)] }; });
  check('Medir ángulos: tras exportar, el lienzo de pantalla vuelve a su tamaño', Math.abs(trasExportar.pix[0] - trasExportar.css[0]) <= 1 && trasExportar.pix[0] === lienzos[0].pix[0], JSON.stringify(trasExportar));
  const anchoAntes = await docAng().evaluate(() => document.getElementById('canvasP1').width);
  await page.getByRole('button', { name: 'Pantalla completa' }).click();
  await page.waitForTimeout(1200);
  const pleno = await page.evaluate(() => document.body.classList.contains('angulos-pleno'));
  const anchoPleno = await docAng().evaluate(() => document.getElementById('canvasP1').width);
  check('Medir ángulos: a pantalla completa el área de trabajo crece', pleno === true && anchoPleno > anchoAntes, `${anchoAntes} → ${anchoPleno}`);
  await page.keyboard.press('Escape');
  let vuelto = false;
  for (let i = 0; i < 20 && !vuelto; i++) {
    await page.waitForTimeout(250);
    // Tolerancia de unos píxeles: al entrar y salir aparece y desaparece la barra de desplazamiento de la página, y el área útil cambia un poco.
    vuelto = !(await page.evaluate(() => document.body.classList.contains('angulos-pleno')))
      && Math.abs((await docAng().evaluate(() => document.getElementById('canvasP1').width)) - anchoAntes) <= 8;
  }
  check('Medir ángulos: Esc sale de pantalla completa y el área de trabajo vuelve a su tamaño', vuelto,
    `${anchoAntes} → ${await docAng().evaluate(() => document.getElementById('canvasP1').width)}`);
  await go('#nme', '.tabs-nav');
  check('Medir ángulos: al salir de la pantalla no queda el modo a pantalla completa pegado', (await page.evaluate(() => document.body.className)).includes('angulos-pleno') === false);

  // ---- Al elegir un test, la pantalla baja sola hasta «Normative Benchmarking» (15/11/2026)
  await go(`#jugador-${P}?b=fuerza`, '.test-items button');
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(250);
  const arriba = await page.evaluate(() => window.scrollY);
  await page.locator('.test-items button.test-item').filter({ hasText: /^cmj$/i }).first().click();
  await page.waitForTimeout(1400);
  const bajada = await page.evaluate(() => { const n = document.querySelector('[data-ancla="normativo"]'); return { y: window.scrollY, top: n ? Math.round(n.getBoundingClientRect().top) : null }; });
  check('al elegir un test, la pantalla baja hasta Normative Benchmarking', arriba === 0 && bajada.y > 100 && bajada.top !== null && Math.abs(bajada.top) < 160, JSON.stringify({ arriba, ...bajada }));

  // ---- Configuración ISO-rack (15/11/2026): registro permanente, sin fecha, editable y que sobrevive a recargar.
  await go('#isorack', 'table.isorack');
  if (CAP) await page.screenshot({ path: path.join(CAP, 'isorack.png'), fullPage: false });
  const rack = await page.evaluate(() => ({
    cab: [...document.querySelectorAll('table.isorack thead th')].map((t) => t.textContent.trim()),
    filas: document.querySelectorAll('table.isorack tbody tr').length,
    jugadores: [...document.querySelectorAll('table.isorack tbody th')].map((t) => t.textContent.trim()),
    calzados: [...document.querySelectorAll('table.isorack tbody tr:first-child select')].map((sel) => [...sel.options].map((o) => o.textContent.trim()).join('/')),
  }));
  check('ISO-rack: cuatro columnas, la altura del jugador y los tres iso-push', rack.cab.join('|') === 'Jugador|Altura del jugador|Knee iso-push|Ankle iso-push|Seated calf raise iso-push', rack.cab.join('|'));
  check('ISO-rack: una fila por jugador, por orden alfabético', rack.filas === 12 && rack.jugadores.join() === [...rack.jugadores].sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base', numeric: true })).join(), rack.jugadores.join());
  check('ISO-rack: en cada iso-push se elige descalzo o con zapatillas', rack.calzados.length === 3 && rack.calzados.every((c) => c === '—/Descalzo/Con zapatillas'), JSON.stringify(rack.calzados));
  check('ISO-rack: no se pide ninguna fecha', (await page.locator('table.isorack input[type="date"]').count()) === 0);
  await page.locator('table.isorack tbody tr').first().locator('input.rack-altura').first().fill('7');
  await page.locator('table.isorack tbody tr').first().locator('select.rack-calzado').first().selectOption('descalzo');
  await page.waitForTimeout(600);
  await go('#isorack', 'table.isorack');
  const rack2 = await page.evaluate(() => { const tr = document.querySelector('table.isorack tbody tr'); return { alt: tr.querySelector('input.rack-altura').value, cal: tr.querySelector('select.rack-calzado').value }; });
  check('ISO-rack: lo escrito se guarda y sigue ahí al volver a entrar', rack2.alt === '7' && rack2.cal === 'descalzo', JSON.stringify(rack2));
  // La tabla tiene que caber a lo ancho en una pantalla normal (16/11/2026, pedido del usuario): nada de desplazarse a la derecha para ver el último iso-push.
  const anchoRack = await sinDesborde('table.isorack');
  check('ISO-rack: cabe a lo ancho a 1840, 1440 y 1280 px, sin desplazamiento horizontal', anchoRack.length === 0, anchoRack.join(' · '));
  const rackVis = await page.evaluate(() => {
    const tr = document.querySelector('table.isorack tbody tr');
    const td = tr.querySelector('td.rack-celda'), inp = td.querySelector('input.rack-altura'), sel = td.querySelector('select.rack-calzado');
    const r = (e) => e.getBoundingClientRect();
    return { enLinea: Math.abs(r(inp).top - r(sel).top) < 6, dentro: r(sel).right <= r(td).right + 1 && r(inp).left >= r(td).left - 1, selAncho: Math.round(r(sel).width), inpAncho: Math.round(r(inp).width) };
  });
  check('ISO-rack: altura y calzado siguen en la misma línea, dentro de su columna', rackVis.enLinea && rackVis.dentro && rackVis.selAncho > 90 && rackVis.inpAncho > 40, JSON.stringify(rackVis));

  // ---- Alta manual de resultados en un test que no se importa (15/11/2026)
  await go(`#jugador-${P}?t=${t.manual}&b=fuerza`, '#alta-manual-resultado');
  const am = await page.evaluate(() => {
    const card = document.getElementById('alta-manual-resultado');
    const ult = [...document.querySelectorAll('#alta-manual-resultado, section.panorama, .card')].pop();
    return { hay: !!card, fecha: !!card.querySelector('input[type="date"]'), campos: card.querySelectorAll('input[inputmode="decimal"]').length, ultimo: ult === card || card.contains(ult) };
  });
  if (CAP) await page.locator('#alta-manual-resultado').screenshot({ path: path.join(CAP, 'alta-manual.png') });
  check('alta manual: el formulario aparece en la pantalla del test', am.hay && am.fecha && am.campos > 0, JSON.stringify(am));
  check('alta manual: va abajo del todo de la pantalla', am.ultimo, String(am.ultimo));
  const sesionesAntes = await page.evaluate(() => document.querySelectorAll('table tbody tr').length);
  await page.locator('#alta-manual-resultado input[inputmode="decimal"]').first().fill('123');
  await page.locator('#alta-manual-resultado button[type="submit"]').click();
  await page.waitForTimeout(900);
  const guardado = await page.evaluate(() => (document.getElementById('alta-manual-resultado')?.textContent ?? '') + (document.querySelector('.status')?.textContent ?? ''));
  check('alta manual: al guardar, el resultado se registra', /Resultado guardado/.test(guardado) || sesionesAntes > 0, guardado.slice(0, 80));
  await go(`#jugador-${P}?t=${t.manual}&b=fuerza`, '#alta-manual-resultado');
  check('alta manual: el test pasa a tener datos y aparece su cuadro Normative Benchmarking', (await page.locator('section.panorama').count()) > 0);
  await go(`#jugador-${P}?t=${t.cmj}&b=fuerza`, 'table.pano');
  check('alta manual: NO aparece en los tests que sí se importan (CMJ)', (await page.locator('#alta-manual-resultado').count()) === 0);

  // ---- Exploración de cadera: alta manual con desplegables de grado, anotación de texto y SIN cuadro de percentiles (27/11/2026).
  {
    await go(`#jugador-${P}?t=${t.hipnme}&b=nme`, '#alta-manual-resultado');
    const am = await page.evaluate(() => {
      const card = document.getElementById('alta-manual-resultado');
      const sel = [...card.querySelectorAll('select')];
      return { selects: sel.length, cajas: card.querySelectorAll('input[inputmode="decimal"]').length,
        opciones: sel.length ? [...sel[sel.length - 1].options].map((o) => o.text.trim()) : [],
        impingement: (sel.find((x) => /IMPINGEMENT/i.test(x.closest('label')?.innerText ?? '')) ?? null) && [...sel.find((x) => /IMPINGEMENT/i.test(x.closest('label')?.innerText ?? '')).options].map((o) => o.text.trim()),
        nota: card.querySelectorAll('.nota-valoracion textarea').length };
    });
    check('cadera: los grados se eligen en un desplegable, no se escriben a mano', am.selects === 13 && am.cajas === 0, JSON.stringify({ selects: am.selects, cajas: am.cajas }));
    check('cadera: el desplegable dice lo que significa cada grado y no deja poner un 4',
      am.opciones.join('|') === 'Sin explorar|0 · Sin déficit|1 · Limitación leve|2 · Limitación moderada|3 · Limitación severa', JSON.stringify(am.opciones));
    check('cadera: el impingement se elige entre positivo y negativo', (am.impingement ?? []).join('|') === 'Sin explorar|Negativo (✓)|Positivo (+)', JSON.stringify(am.impingement));
    check('cadera: hay un espacio de anotación de texto por valoración', am.nota === 1, String(am.nota));
    check('cadera: no se dibuja el cuadro de percentiles de La Liga sobre un grado clínico', (await page.locator('table.pano').count()) === 0);
    if (CAP) await page.locator('#alta-manual-resultado').screenshot({ path: path.join(CAP, 'cadera-alta-manual.png') });
    // Guardar una valoración desde la pantalla: el desplegable escribe el grado y la anotación se guarda con ella.
    await page.locator('#alta-manual-resultado select').first().selectOption('1'); // impingement: positivo
    await page.locator('#alta-manual-resultado select').last().selectOption('3'); // Bent Knee Over: limitación severa
    await page.locator('#alta-manual-resultado .nota-valoracion textarea').fill('Prueba de anotación.');
    await page.locator('#alta-manual-resultado button[type="submit"]').click(); await page.waitForTimeout(700);
    const tras = await page.evaluate(() => document.querySelector('#alta-manual-resultado .status')?.textContent ?? '');
    check('cadera: la valoración escrita a mano se guarda', /guardado/i.test(tras), tras);
  }
  // ---- Importar: pestaña propia para el Excel de la exploración de cadera
  {
    await go('#importar', 'nav.nav');
    const pestanas = await page.evaluate(() => [...document.querySelectorAll('[role="tab"]')].map((b) => b.innerText.trim()));
    check('Importar: hay una pestaña para el Excel de la exploración de cadera', pestanas.some((x) => /Exploración de cadera/i.test(x)), JSON.stringify(pestanas));
    await page.getByRole('tab', { name: /Exploración de cadera/i }).click();
    await page.waitForFunction(() => /Exploraci[oó]n de cadera desde Excel/.test(document.body.textContent), null, { timeout: 15000 });
    const txt = await page.evaluate(() => document.body.textContent.replace(/\s+/g, ' ')); // textContent: el formato va dentro de un desplegable cerrado
    check('Importar cadera: la pantalla explica la escala y que nada se redondea', /de 0 a 3/.test(txt) && /enteros/.test(txt) && /[Nn]ada se redondea/.test(txt), txt.slice(-320));
    // El Excel de cadera subido por la pestaña equivocada: la pantalla avisa y dice a dónde ir (27/11/2026, error del usuario).
    {
      await page.getByRole('tab', { name: /Datos de tests/i }).click(); await page.waitForTimeout(400);
      const tests = await page.evaluate(() => { const s = [...document.querySelectorAll('select')].find((x) => /Elige un test/.test(x.innerText)); return s ? [...s.options].map((o) => o.text.trim()) : []; });
      check('Importar genérico: el test «Hip» no se ofrece (sus valores no son números)', !tests.some((x) => x.trim().toLowerCase() === 'hip'), tests.filter((x) => /hip/i.test(x)).join());
      await page.getByRole('tab', { name: /Exploración de cadera/i }).click();
      await page.waitForFunction(() => /Exploraci[oó]n de cadera desde Excel/.test(document.body.textContent), null, { timeout: 15000 });
    }
    const anchoImp = await sinDesborde('.card');
    check('Importar cadera: con cinco pestañas la pantalla sigue cabiendo a 1840, 1440 y 1280 px', anchoImp.length === 0, anchoImp.join(' · '));
    if (CAP) await page.screenshot({ path: path.join(CAP, 'importar-cadera.png'), fullPage: false });
  }

  // ---- Perímetros: orden de filas y percentil de asimetría
  // Celdas de una fila de «Normative Benchmarking» localizada por su rótulo (no por su posición: así añadir una fila no rompe nada).
  const filaPano = async (lab) => page.evaluate((l) => { const r = [...document.querySelectorAll('table.pano tbody tr')].find((x) => x.querySelector('th').innerText.trim() === l); return r ? [...r.querySelectorAll('td')].map((td) => td.innerText.trim()) : null; }, lab);
  const filaPanoColor = async (lab) => page.evaluate((l) => { const r = [...document.querySelectorAll('table.pano tbody tr')].find((x) => x.querySelector('th').innerText.trim() === l); return r ? r.querySelectorAll('.asim-l, .asim-r').length : 0; }, lab);
  await go(`#jugador-${P}?t=${t.per}&b=perimetros`, 'table.pano');
  check('Perímetros: filas Value · La Liga percentile · Asymmetry · percentil de asimetría', (await texts('table.pano tbody th')).join('|') === 'Value (% change vs previous session)|La Liga percentile|La Liga (position) percentile|Asymmetry|Asymmetry (La Liga percentile)', (await texts('table.pano tbody th')).join('|'));
  check('Perímetros: 5 variables y texto de asimetría en color', (await page.locator('table.pano thead tr:first-child th').count()) === 5 && (await filaPanoColor('Asymmetry')) >= 1);
  check('Perímetros: percentil de asimetría con valores o «n<»', (await filaPano('Asymmetry (La Liga percentile)')).every((x) => /^(\d+|n<\d+)$/.test(x)), (await filaPano('Asymmetry (La Liga percentile)')).join(','));
  await shot('perimetros');

  // ---- Jurdan Test: L y R lado a lado, percentil de cada lado, asimetría en grados
  await go(`#jugador-${P}?t=${t.jur}&b=nme`, 'table.pano');
  check('Jurdan: filas Value · La Liga percentile · Asymmetry (°), sin percentil de asimetría', (await texts('table.pano tbody th')).join('|') === 'Value (% change vs previous session)|La Liga percentile|La Liga (position) percentile|Asymmetry', (await texts('table.pano tbody th')).join('|'));
  check('Jurdan: 4 variables, con L y R por separado (izquierda a la izquierda) en valor y percentil', (await page.locator('table.pano thead tr:first-child th').count()) === 4 && (await page.locator('table.pano thead tr.lados th').allInnerTexts()).join('') === 'LRLRLRLR' && (await filaPano('La Liga percentile')).length === 8);
  check('Jurdan: asimetría en grados con letra de lado y color', (await filaPano('Asymmetry')).every((x) => /^\d+(,\d+)? ° [LR]$|^0 °$/.test(x)) && (await filaPanoColor('Asymmetry')) >= 1, (await filaPano('Asymmetry')).join(','));
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
    check(`${key}: Normative Benchmarking con una columna por variable y fila de percentil`, n >= 2 && /\|La Liga percentile\|/.test(filas), `${n} · ${filas}`);
  }
  await shot('hip');
  // 26/11/2026: en la pantalla de un test, al bajar siguen a la vista el jugador con el test y los mandos de Normative Benchmarking.
  await page.evaluate(() => window.scrollTo(0, 1400)); await page.waitForTimeout(350);
  const pegadas = await page.evaluate(() => {
    const v = (sel) => { const e = document.querySelector(sel); if (!e) return null; const r = e.getBoundingClientRect(); return { top: Math.round(r.top), alto: Math.round(r.height) }; };
    return { barra: v('.test-sticky'), mandos: v('.panorama > .filters'), texto: document.querySelector('.test-sticky')?.innerText.replace(/\s+/g, ' ').slice(0, 40) };
  });
  check('Test: al bajar siguen a la vista el jugador con el test y el «Value shown», sin taparse entre sí',
    pegadas.barra && pegadas.barra.top >= -1 && pegadas.barra.top < 10 && pegadas.mandos
    && pegadas.mandos.top >= pegadas.barra.top + pegadas.barra.alto - 2 && pegadas.mandos.top < 140, JSON.stringify(pegadas));
  await shot('test-desplazado');
  await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(250);
  // Guardas del Normative Benchmarking unificado (causa del error «68 vs 60/68»: dos cálculos distintos del mismo percentil)
  await go(`#jugador-${P}?t=${t.hip}&b=fuerza`, 'table.pano.norm');
  const g = await page.evaluate(() => { const tb = document.querySelector('table.pano.norm'); const filas = [...tb.querySelectorAll('tbody tr')].map((r) => ({ lab: r.querySelector('th')?.innerText ?? '', n: r.querySelectorAll('td').length, txt: [...r.querySelectorAll('td')].map((d) => d.innerText.trim()) })); const w = tb.closest('.pano-wrap'); return { filas, desborda: w.scrollWidth > w.clientWidth + 1, pagina: document.documentElement.scrollWidth > window.innerWidth + 1, lados: [...tb.querySelectorAll('thead tr.lados th')].map((x) => x.innerText.trim()).join('') }; });
  check('Normative Benchmarking: izquierda a la izquierda y derecha a la derecha en cada variable', /^(LR)+$/.test(g.lados), g.lados);
  check('Normative Benchmarking: percentil La Liga por pierna (una celda por lado, ninguna vacía)', (() => { const f = g.filas.find((x) => x.lab === 'La Liga percentile'); return !!f && f.txt.length >= 2 && f.txt.every((x) => x !== '' && x !== '—'); })(), JSON.stringify(g.filas.map((x) => x.lab + ':' + x.txt.join(','))));
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
  // El DSI del Knee Iso-Push va al final de su pantalla, y tiene que seguir ahí aunque el usuario renombre el test (14/11/2026).
  const hayDsi = () => page.evaluate(() => [...document.querySelectorAll('.evo h4')].some((h) => /^DSI \(Dynamic Strength Index\)/.test(h.textContent.trim())));
  const dsiAlFinal = () => page.evaluate(() => { const sec = [...document.querySelectorAll('.evo section')].find((x) => /^DSI \(Dynamic Strength Index\)/.test(x.querySelector('h4')?.textContent.trim() ?? '')); if (!sec) return null; const hijos = [...document.querySelector('.evo').children]; return hijos.indexOf(sec.closest('.evo > *')) >= hijos.length - 4; });
  await go(`#jugador-${P}?t=${t.kpush}&b=fuerza`, '.evo');
  check('Knee Iso-Push: el DSI aparece y va al final de la pantalla', (await hayDsi()) && (await dsiAlFinal()) === true);
  await page.evaluate((id) => new Promise((res, rej) => { const q = indexedDB.open('dashboard-rendimiento'); q.onsuccess = () => { const d = q.result; const tx = d.transaction('tests', 'readwrite'); const st = tx.objectStore('tests'); const g = st.get(id); g.onsuccess = () => { const v = g.result; v.name = 'Knee Iso-Push'; st.put(v); }; tx.oncomplete = () => { d.close(); res(); }; tx.onerror = () => rej(tx.error); }; q.onerror = () => rej(q.error); }), t.kpush);
  await page.reload(); await page.waitForSelector('.evo');
  // El cuadro del DSI se dibuja cuando terminan de cargarse las relaciones, un instante después que el resto de la pantalla: se espera a que aparezca.
  const esperaDsi = async () => { for (let i = 0; i < 40; i++) { if (await hayDsi()) return true; await page.waitForTimeout(250); } return false; };
  check('Knee Iso-Push: tras renombrarlo a «Knee Iso-Push», el DSI sigue apareciendo', await esperaDsi());

  // ---- «Ver todos los jugadores» desde el DSI y desde el EUR (16/11/2026)
  const enlaceDsi = await page.evaluate(() => {
    const sec = [...document.querySelectorAll('.evo section')].find((x) => /^DSI \(Dynamic Strength Index\)/.test(x.querySelector('h4')?.textContent.trim() ?? ''));
    const a = sec?.querySelector('a.button');
    return a ? { txt: a.textContent.trim(), href: a.getAttribute('href') } : null;
  });
  check('DSI: tiene el botón «Ver todos los jugadores», que lleva a la pantalla común', enlaceDsi && enlaceDsi.txt === 'Ver todos los jugadores' && /^#dsi-eur\?j=\d+$/.test(enlaceDsi.href), JSON.stringify(enlaceDsi));
  await go(`#jugador-${P}?t=${t.sj}&b=fuerza`, '.evo');
  const esperaEur = async () => { for (let i = 0; i < 40; i++) { if (await page.evaluate(() => [...document.querySelectorAll('.evo h4')].some((h) => /^EUR \(Eccentric Utilization Ratio\)/.test(h.textContent.trim())))) return true; await page.waitForTimeout(250); } return false; };
  check('Squat Jump: el EUR aparece en su pantalla', await esperaEur());
  const enlaceEur = await page.evaluate(() => {
    const sec = [...document.querySelectorAll('.evo section')].find((x) => /^EUR \(Eccentric Utilization Ratio\)/.test(x.querySelector('h4')?.textContent.trim() ?? ''));
    const a = sec?.querySelector('a.button');
    return a ? { txt: a.textContent.trim(), href: a.getAttribute('href') } : null;
  });
  check('EUR: tiene el mismo botón y lleva a la misma pantalla', enlaceEur && enlaceEur.txt === 'Ver todos los jugadores' && /^#dsi-eur\?j=\d+$/.test(enlaceEur.href), JSON.stringify(enlaceEur));
  await go(`#dsi-eur?j=${P}`, 'table.dsieur', 4000);
  if (CAP) await page.locator('.card').first().screenshot({ path: path.join(CAP, 'dsi-eur-todos.png') });
  const todos = await page.evaluate(() => {
    const tb = document.querySelector('table.dsieur'), wrap = tb.closest('.table-wrap');
    const cab = [...tb.querySelectorAll('thead th')].map((x) => x.textContent.trim());
    const filas = [...tb.querySelectorAll('tbody tr')].map((tr) => ({
      nombre: tr.querySelector('th').textContent.trim(),
      enlace: tr.querySelector('th a')?.getAttribute('href') ?? null,
      celdas: [...tr.querySelectorAll('td')].map((td) => ({ val: td.querySelector('.dsieur-val')?.textContent.trim() ?? '', pct: td.querySelector('.band')?.textContent.trim() ?? null, ori: td.querySelector('.dsieur-ori')?.textContent.trim() ?? '' })),
    }));
    return { cab, filas, desborda: wrap.scrollWidth > wrap.clientWidth + 1, migas: [...document.querySelectorAll('.crumbs li')].map((l) => l.textContent.trim()) };
  });
  check('DSI y EUR · todos los jugadores: las cuatro columnas pedidas', todos.cab.join('|') === 'Jugador|DSI izquierda|DSI derecha|EUR', todos.cab.join('|'));
  check('DSI y EUR · todos los jugadores: un jugador por fila, con enlace a su ficha', todos.filas.length > 1 && todos.filas.every((f) => f.celdas.length === 3 && /^#jugador-\d+/.test(f.enlace ?? '')), JSON.stringify(todos.filas.slice(0, 2)));
  check('DSI y EUR · todos los jugadores: cada casilla lleva valor, percentil y orientación', todos.filas.some((f) => f.celdas.some((c) => /^[\d,.]+$/.test(c.val) && c.pct !== null && /strength|SSC|orientation/i.test(c.ori))), JSON.stringify(todos.filas[0]));
  check('DSI y EUR · todos los jugadores: cabe a lo ancho, sin desplazamiento horizontal', todos.desborda === false);
  check('DSI y EUR · todos los jugadores: las migas vuelven al jugador de origen', todos.migas.length === 3 && /todos los jugadores/.test(todos.migas[2]), JSON.stringify(todos.migas));
  const mismoDsi = await page.evaluate(async (pid) => {
    const tr = [...document.querySelectorAll('table.dsieur tbody tr')].find((x) => (x.querySelector('th a')?.getAttribute('href') ?? '').startsWith('#jugador-' + pid + '?'));
    return tr ? [...tr.querySelectorAll('td')].map((td) => (td.querySelector('.band')?.textContent.trim() ?? null)) : null;
  }, P);
  const ordenAntes = await page.evaluate(() => [...document.querySelectorAll('table.dsieur tbody tr th')].map((x) => x.textContent.trim()));
  await page.selectOption('.card .filters select', 'dsi'); await page.waitForTimeout(600);
  const ordenDespues = await page.evaluate(() => [...document.querySelectorAll('table.dsieur tbody tr th')].map((x) => x.textContent.trim()));
  check('DSI y EUR · todos los jugadores: se puede ordenar por DSI y cambia el orden sin perder filas', ordenAntes.length === ordenDespues.length && ordenAntes.join() !== ordenDespues.join(), `${ordenAntes.slice(0, 3)} → ${ordenDespues.slice(0, 3)}`);
  // El percentil de un jugador aquí tiene que ser el MISMO que el de su ficha (misma referencia, él excluido).
  await go(`#jugador-${P}?t=${t.kpush}&b=fuerza`, '.evo');
  await esperaDsi();
  const enFicha = await page.evaluate(() => {
    const sec = [...document.querySelectorAll('.evo section')].find((x) => /^DSI \(Dynamic Strength Index\)/.test(x.querySelector('h4')?.textContent.trim() ?? ''));
    return [...sec.querySelectorAll('tbody tr')].map((tr) => tr.querySelector('.band')?.textContent.trim() ?? null);
  });
  check('DSI y EUR · todos los jugadores: el percentil coincide con el de la ficha del jugador', mismoDsi !== null && JSON.stringify(mismoDsi.slice(0, 2)) === JSON.stringify(enFicha), `tabla ${JSON.stringify(mismoDsi)} · ficha ${JSON.stringify(enFicha)}`);
  for (const key of ['cmj', 'sl', 'sj', 'hop', 'dj']) { // Squat Jump también tiene RSI MOD en el catálogo, así que también arranca en RSI
    await go(`#jugador-${P}?t=${t[key]}&b=fuerza`, '.evo');
    const sel = await page.evaluate(() => document.querySelector('table.pano.norm thead th.sel .pano-nm')?.innerText.trim() ?? '');
    check(`${key}: variable por defecto = RSI`, /\bRSI\b/i.test(sel), sel);
  }
  // un test que no es Fast Dynamic ni Reactive Strength conserva su variable por defecto (la primera con datos)
  await go(`#jugador-${P}?t=${t.hip}&b=fuerza`, '.evo');
  const selHip = await page.evaluate(() => document.querySelector('table.pano.norm thead th.sel .pano-nm')?.innerText.trim() ?? '');
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
  // «Comparar dos medidas» (26/11/2026): sin análisis estadístico. Cinco filas: las dos medidas, su diferencia y la posterior frente al PA y al PB.
  {
    const selects = page.locator('section.comparar select');
    const n = await selects.count();
    if (n >= 2) {
      const ops = await page.evaluate(() => { const ss = [...document.querySelectorAll('section.comparar select')]; const s = ss[ss.length - 2]; return [...s.options].map((o) => o.value).filter(Boolean); });
      if (ops.length >= 2) {
        await selects.nth(n - 2).selectOption(ops[0]); await selects.nth(n - 1).selectOption(ops[1]); await page.waitForTimeout(500);
        const cmp = await page.evaluate(() => [...document.querySelectorAll('section.comparar table.comparar-tabla tbody tr')].map((r) => [...r.children].map((c) => c.innerText.trim())));
        const rot = cmp.map((r) => r[0]);
        check('Comparar dos medidas: cinco filas con la fecha en los rótulos, sin valor de p ni intervalos',
          /^Medida anterior\|Medida posterior\|Diferencia \(\d\d\/\d\d\/\d{4}\) vs \(\d\d\/\d\d\/\d{4}\)\|Diferencia \(\d\d\/\d\d\/\d{4}\) vs Personal Average\|Diferencia \(\d\d\/\d\d\/\d{4}\) vs Personal Best$/.test(rot.join('|')), rot.join('|'));
        const num = (x) => Number(String(x).replace(/[^\d,.-−]/g, '').replace('−', '-').replace(/\.(?=\d{3}\b)/g, '').replace(',', '.'));
        const ant = num(cmp[0][2]), pos = num(cmp[1][2]), dif = num(cmp[2][2].split('(')[0]); // la celda de la diferencia lleva además el porcentaje entre paréntesis
        check('Comparar dos medidas: la diferencia es posterior − anterior', Math.abs(dif - (pos - ant)) < 0.02, `${pos} − ${ant} = ${pos - ant} vs ${dif}`);
        check('Comparar dos medidas: las filas de PA y PB traen un valor o dicen por qué no', cmp[3][2].length > 0 && cmp[4][2].length > 0, JSON.stringify([cmp[3], cmp[4]]));
      }
    }
  }

  // ---- Escala de «Benchmark-Contextualized Positioning»: con «Personal Average» y «Personal Best» escritos enteros (26/11/2026), el rótulo no puede
  // montarse sobre la escala. Se comprueba midiendo: el texto tiene que acabar antes de donde empieza la barra.
  {
    const pa = page.locator('fieldset.modes.filas:has(legend:text-is("Benchmark-Contextualized Positioning")) label.check:has-text("Personal Average") input');
    if (await pa.count()) {
      if (!(await pa.first().isChecked())) await pa.first().check();
      await page.waitForTimeout(600);
      const m = await page.evaluate(() => {
        const svg = document.querySelector('svg[aria-label^="Escala"]');
        if (!svg) return { error: 'sin svg de escala' };
        const t = [...svg.querySelectorAll('text')].find((x) => x.textContent.trim() === 'Personal Average');
        if (!t) return { error: 'sin rótulo', textos: [...svg.querySelectorAll('text')].map((x) => x.textContent.trim()).slice(0, 8) };
        // El inicio de la escala es la x más pequeña de las figuras dibujadas (líneas, círculos y rectángulos), sin contar el fondo.
        const figuras = [...svg.querySelectorAll('line, circle, rect')].map((e) => e.getBBox()).filter((b) => b.width < 600);
        const b = t.getBBox();
        return { finTexto: Math.round(b.x + b.width), iniBarra: Math.round(Math.min(...figuras.map((f) => f.x))) };
      });
      check('escala: el rótulo «Personal Average» cabe entero sin pisar la barra', !!m && m.finTexto <= m.iniBarra, JSON.stringify(m));
    }
  }

  // ---- Radar: con «Zoom the radius to the data range» el título del centro no cabe dentro del polígono y sale arriba. Antes se dibujaba encima del
  // rótulo del eje superior y se solapaba con él (26/11/2026, fallo visto por el usuario).
  {
    const solapa = async () => page.evaluate(() => {
      const svg = document.querySelector('#radar svg.radar-svg'); if (!svg) return null;
      // getBoundingClientRect y no getBBox: el gráfico va dentro de un <g transform="translate(0 banda)">, y getBBox NO cuenta esa traslación,
      // así que los rótulos del gráfico se comparaban con el título en coordenadas distintas y salía un solapamiento que en pantalla no existe.
      const textos = [...svg.querySelectorAll('text')].map((t) => ({ t: t.textContent.trim(), b: t.getBoundingClientRect(), fs: parseFloat(getComputedStyle(t).fontSize) }));
      // El título es el del centro del perfil, que se localiza por su TEXTO (antes se buscaba «la letra más grande»: si el título salía pequeño
      // dentro del polígono, la prueba medía un rótulo de eje y no se enteraba del solapamiento, 26/11/2026).
      const marcados = new Set([...svg.querySelectorAll('text.radar-titulo')].map((t) => t.textContent.trim()));
      const esTit = (x) => marcados.has(x.t);
      const partes = textos.filter(esTit);
      if (!partes.length) return null;
      const titulo = { t: partes.map((p) => p.t).join(' '), fs: partes[0].fs,
        b: { x: Math.min(...partes.map((p) => p.b.x)), y: Math.min(...partes.map((p) => p.b.y)),
          width: Math.max(...partes.map((p) => p.b.x + p.b.width)) - Math.min(...partes.map((p) => p.b.x)),
          height: Math.max(...partes.map((p) => p.b.y + p.b.height)) - Math.min(...partes.map((p) => p.b.y)) } };
      const choca = textos.some((x) => !esTit(x) && x.t && !(x.b.y + x.b.height <= titulo.b.y + 1 || x.b.y >= titulo.b.y + titulo.b.height - 1 || x.b.x + x.b.width <= titulo.b.x + 1 || x.b.x >= titulo.b.x + titulo.b.width - 1));
      return { titulo: titulo.t, fs: titulo.fs, choca, alto: svg.viewBox.baseVal.height,
        zoomOn: !!document.querySelector('#radar label.check input[type="checkbox"]:checked'), y: Math.round(titulo.b.y) };
    });
    const zoomBox = page.locator('#radar label.check:has-text("Zoom the radius")').locator('input');
    const sinZoom = await solapa();
    if (await zoomBox.count()) {
      const estaba = await zoomBox.isChecked();
      if (!estaba) await zoomBox.check(); await page.waitForTimeout(600);
      const conZoom = await solapa();
      check('radar: con el radio ampliado, el título no se solapa con ningún rótulo', !!conZoom && conZoom.choca === false, JSON.stringify(conZoom));
      check('radar: con el radio ampliado el título sale ARRIBA, no encogido dentro del polígono', !!conZoom && conZoom.fs >= 18, JSON.stringify(conZoom));
      check('radar: al sacar el título arriba, el gráfico crece en alto en vez de encogerse', !!sinZoom && conZoom.alto >= sinZoom.alto, JSON.stringify([sinZoom?.alto, conZoom?.alto]));
      await shot('radar-zoom');
      if (!estaba) await zoomBox.uncheck(); await page.waitForTimeout(400);
    }
  }

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
  // 26/11/2026: ya no hay selector «Variable» en la fila de filtros; cada apartado tiene el suyo y se localiza por su título.
  const selDe = (titulo) => page.evaluate((t) => { const c = [...document.querySelectorAll('.evo section, .evo fieldset')].find((x) => (x.querySelector('h4, legend')?.textContent ?? '').includes(t)); return c?.querySelector('.sel-variable select')?.value ?? null; }, titulo);
  const selArriba = () => selDe('Benchmark-Contextualized Positioning');
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
    const filas = [...document.querySelectorAll('table.composite > tbody > tr')].map((tr) => [tr.querySelector('th').textContent.trim(), tr.querySelector('td').textContent.trim(), tr.querySelector('td .band')?.className ?? null]);
    const svg = document.querySelector('#bloque-composite svg.radar-svg') ?? document.querySelector('svg.radar-svg');
    const marcas = svg ? [...svg.querySelectorAll('text')].filter((t) => t.getAttribute('font-size') === '26').map((t) => t.textContent) : [];
    const leyenda = svg ? [...svg.querySelectorAll('g > line')].length : 0;
    const nLinea = [...document.querySelectorAll('p.muted')].map((p) => p.textContent).find((t) => /Percentiles sobre N/.test(t)) ?? '';
    const desgloses = [...document.querySelectorAll('table.composite button.fila-abre')].map((b) => b.textContent.trim());
    return { filas, marcas, leyenda, nLinea, desgloses, radar: !!svg, aria: svg?.getAttribute('aria-label') ?? '' };
  });
  if (CAP) { await page.locator('.card').filter({ hasText: 'COMPOSITE PROFILE SCORE' }).first().screenshot({ path: path.join(CAP, 'composite.png') }); await page.locator('svg.radar-svg').first().screenshot({ path: path.join(CAP, 'composite-radar.png') }); }
  // Por defecto el bloque viene en «Latest» (14/11/2026, decisión del usuario); el resto de comprobaciones se hacen en PA.
  check('COMPOSITE: por defecto el valor es «Latest»', await page.evaluate(() => { const f = [...document.querySelectorAll('fieldset.modes')].find((x) => /Valor/.test(x.querySelector('legend').textContent)); const r = [...f.querySelectorAll('input[type="radio"]')].findIndex((i) => i.checked); return r === 0 && /Latest/.test(f.querySelectorAll('label.check')[0].textContent); }));
  await page.evaluate(() => [...document.querySelectorAll('fieldset.modes')].find((x) => /Valor/.test(x.querySelector('legend').textContent)).querySelectorAll('input[type="radio"]')[1].click());
  await page.waitForTimeout(700);
  // 15/11/2026: 6 cualidades (Dynamic Strength y Propulsive unificadas; Reactivity pasa a Energy Storage / Reactivity).
  const NOMBRES = 'Isometric Strength,Propulsive / Dynamic Strength,Eccentric Deceleration,Energy Storage / Reactivity,Explosive / Snappy,Short GCT Reactive Strength';
  check('COMPOSITE: las 6 cualidades, en el orden del documento', cps.filas.map((f) => f[0]).join() === NOMBRES, cps.filas.map((f) => f[0]).join());
  // 14/11/2026: ya no hay «No aplicable»: las 7 cualidades puntúan siempre que haya datos y «—» solo significa que falta el dato.
  check('COMPOSITE: cada puntuación es un entero con su color o «—»', cps.filas.every(([, v, cls]) => (/^\d+$/.test(v) && Number(v) >= 0 && Number(v) <= 100 && /band band-/.test(cls ?? '')) || v === '—'), JSON.stringify(cps.filas));
  await cualTodas(true);
  check('COMPOSITE: ninguna cualidad ni fila del desglose sale «No aplicable»', !/No aplicable/.test(await page.evaluate(() => document.querySelector('table.composite')?.textContent ?? '')));
  await cualTodas(false);
  check('COMPOSITE: el radar tiene los 6 ejes con su marca', cps.radar && cps.marcas.length === 6 && cps.marcas.every((m) => /^\d+$|^—$/.test(m)), JSON.stringify(cps.marcas));
  check('COMPOSITE: un eje sin puntuación se marca «—» y nunca como 0', cps.marcas.every((m, i) => m === cps.filas[i][1]), `${JSON.stringify(cps.marcas)} vs ${JSON.stringify(cps.filas.map((f) => f[1]))}`);
  check('COMPOSITE: línea de contexto con el N de la referencia', /^Percentiles sobre N = [\d–]+ jugadores de la base\.$/.test(cps.nLinea.trim()), cps.nLinea);
  check('COMPOSITE: un desglose por cualidad', cps.desgloses.length === 6, JSON.stringify(cps.desgloses));
  // Las referencias elegidas salen como columnas del cuadro, con los mismos valores que dibuja el radar (13/11/2026, pedido por el usuario)
  const cols = await page.evaluate(() => {
    const cab = [...document.querySelectorAll('table.composite > thead > tr > th')].map((t) => t.textContent.trim());
    const fila = [...document.querySelectorAll('table.composite > tbody > tr')[0].children].map((t) => t.textContent.trim());
    const radarUltimo = (() => { const card = [...document.querySelectorAll('.card')].find((c) => /COMPOSITE PROFILE SCORE/.test(c.querySelector('h2,h3')?.textContent ?? ''));
      const svg = card?.querySelector('svg.radar-svg'); const tabla = card?.querySelector('table.composite');
      return svg && tabla ? (svg.compareDocumentPosition(tabla) & Node.DOCUMENT_POSITION_PRECEDING) !== 0 : null; })();
    return { cab, fila, radarUltimo };
  });
  // 15/11/2026: solo quedan las referencias POSICIONALES; los polígonos regulares de P50 y P75 de La Liga desaparecen.
  // Este jugador sintético no tiene posición principal: entonces no hay referencia posicional y NO se añade una columna de guiones.
  check('COMPOSITE: sin posición principal, la tabla se queda en Cualidad y el valor', cols.cab.join() === 'Cualidad,Personal Average' && cols.fila.length === 2, JSON.stringify(cols.cab));
  const sinPos = await page.evaluate(() => { const f = [...document.querySelectorAll('fieldset.modes')].find((x) => /Referencia posicional/.test(x.querySelector('legend').textContent)); return { aviso: !!f.querySelector('[data-ancla="sin-posicion"]'), apagadas: [...f.querySelectorAll('input[type="checkbox"]')].every((c) => c.disabled) }; });
  check('COMPOSITE: sin posición se explica por qué y las casillas están apagadas', sinPos.aviso && sinPos.apagadas, JSON.stringify(sinPos));
  const refsCps = await page.evaluate(() => [...[...document.querySelectorAll('fieldset.modes')].find((f) => /Referencia posicional/.test(f.querySelector('legend').textContent)).querySelectorAll('label.check')].map((l) => l.textContent.trim()));
  // 26/11/2026: la referencia posicional se llama IGUAL en todo el dashboard («P50 La Liga (External Midfielder)»); sin posición principal, «(by position)».
  check('COMPOSITE: el selector solo ofrece P50 y P75 posicionales, con el nombre único del dashboard', refsCps.join('|') === 'P50 La Liga (by position)|P75 La Liga (by position)', refsCps.join('|'));
  check('COMPOSITE: el radar va debajo de la tabla y de los desgloses', cols.radarUltimo === true, String(cols.radarUltimo));

  // ---- Capas del radar (16/11/2026): Latest, PA y PB se pueden dibujar a la vez, cada una con su trazo.
  const leeCapas = () => page.evaluate(() => {
    const f = [...document.querySelectorAll('fieldset.modes')].find((x) => /Capas del radar/.test(x.querySelector('legend').textContent));
    const svg = document.querySelector('#bloque-composite svg.radar-svg') ?? document.querySelector('svg.radar-svg');
    const trazos = [...svg.querySelectorAll('polygon, polyline')];
    const blancos = trazos.filter((p) => (p.getAttribute('stroke') ?? '').toUpperCase() === '#FFFFFF');
    const dash = [...new Set(blancos.map((p) => p.getAttribute('stroke-dasharray') ?? 'continuo'))];
    const leg = [...svg.querySelectorAll('g > text')].map((t) => t.textContent.trim());
    const pie = [...svg.querySelectorAll('text')].map((t) => t.textContent.trim()).find((t) => /^Axis values:/.test(t)) ?? '';
    return { etiquetas: [...f.querySelectorAll('label.check')].map((l) => l.textContent.trim()), marcadas: [...f.querySelectorAll('input')].map((i) => i.checked), apagadas: [...f.querySelectorAll('input')].map((i) => i.disabled), blancos: blancos.length, dash, leg, pie };
  });
  const capa1 = await leeCapas();
  check('COMPOSITE: el radar ofrece Latest, Personal Average y Personal Best, y arranca solo con Latest', capa1.etiquetas.join('|') === 'Latest|Personal Average|Personal Best' && JSON.stringify(capa1.marcadas) === '[true,false,false]', JSON.stringify(capa1));
  check('COMPOSITE: con una sola capa el gráfico no lleva pie de «Axis values»', capa1.pie === '' && capa1.leg.includes('Latest'), JSON.stringify({ pie: capa1.pie, leg: capa1.leg }));
  const marcaCapa = async (i) => { await page.evaluate((k) => [...document.querySelectorAll('fieldset.modes')].find((x) => /Capas del radar/.test(x.querySelector('legend').textContent)).querySelectorAll('input')[k].click(), i); await page.waitForTimeout(500); };
  await marcaCapa(1); await marcaCapa(2);
  const capa3 = await leeCapas();
  if (CAP) await page.locator('svg.radar-svg').first().screenshot({ path: path.join(CAP, 'composite-radar-3capas.png') });
  check('COMPOSITE: con las tres capas hay tres polígonos del jugador, con trazos distintos', capa3.blancos >= 3 && capa3.dash.length === 3, JSON.stringify({ blancos: capa3.blancos, dash: capa3.dash }));
  check('COMPOSITE: la leyenda nombra las tres capas y el pie dice de cuál son los números de los ejes', ['Latest', 'Personal Average', 'Personal Best'].every((n) => capa3.leg.includes(n)) && capa3.pie === 'Axis values: Latest', JSON.stringify({ leg: capa3.leg, pie: capa3.pie }));
  // Los números de los ejes son los de la primera capa marcada, no los de la tabla (que sigue la base de «Valor», aquí PA).
  const ejesVsTabla = await page.evaluate(() => {
    const svg = document.querySelector('#bloque-composite svg.radar-svg') ?? document.querySelector('svg.radar-svg');
    return { ejes: [...svg.querySelectorAll('text')].filter((t) => t.getAttribute('font-size') === '26').map((t) => t.textContent), tabla: [...document.querySelectorAll('table.composite > tbody > tr')].map((tr) => tr.querySelector('td').textContent.trim()) };
  });
  check('COMPOSITE: los números de los ejes siguen a la primera capa, no a la base de la tabla', ejesVsTabla.ejes.length === 6 && ejesVsTabla.ejes.every((m) => /^\d+$|^—$/.test(m)), JSON.stringify(ejesVsTabla));
  await marcaCapa(0); await marcaCapa(1);
  const capaUna = await leeCapas();
  check('COMPOSITE: con una sola capa marcada, esa casilla se apaga para que el radar nunca se quede vacío',
    JSON.stringify(capaUna.marcadas) === '[false,false,true]' && JSON.stringify(capaUna.apagadas) === '[false,false,true]', JSON.stringify(capaUna));
  await marcaCapa(2);
  check('COMPOSITE: la última capa no se puede desmarcar', JSON.stringify((await leeCapas()).marcadas) === '[false,false,true]');
  await marcaCapa(0); await marcaCapa(2);
  check('COMPOSITE: se vuelve a dejar solo Latest', JSON.stringify((await leeCapas()).marcadas) === '[true,false,false]');
  // 15/11/2026: el desglose se despliega haciendo clic en el NOMBRE de la cualidad, dentro de la tabla; ya no hay pestañas sueltas debajo.
  await cualTodas(false);
  const antesCps = await page.evaluate(() => ({ botones: document.querySelectorAll('table.composite button.fila-abre').length, abiertas: document.querySelectorAll('table.composite > tbody > tr.fila-det').length, sueltas: [...document.querySelectorAll('details')].filter((d) => /·/.test(d.querySelector('summary')?.textContent ?? '')).length }));
  check('COMPOSITE: cada cualidad tiene su nombre como botón y ninguna pestaña suelta debajo', antesCps.botones === 6 && antesCps.sueltas === 0, JSON.stringify(antesCps));
  check('COMPOSITE: los desgloses empiezan cerrados', antesCps.abiertas === 0, String(antesCps.abiertas));
  // El nombre sigue leyéndose como el texto de la fila, no como un botón de colores.
  const estiloCual = await page.evaluate(() => { const b = document.querySelector('table.composite button.fila-abre'); const cs = getComputedStyle(b); return { bg: cs.backgroundColor, borde: cs.borderTopWidth, sombra: cs.boxShadow, color: cs.color, texto: getComputedStyle(b.closest('th')).color }; });
  check('COMPOSITE: el nombre de la cualidad se ve como texto, no como un botón', estiloCual.bg === 'rgba(0, 0, 0, 0)' && estiloCual.borde === '0px' && estiloCual.sombra === 'none' && estiloCual.color === estiloCual.texto, JSON.stringify(estiloCual));
  await page.evaluate(() => [...document.querySelectorAll('table.composite button.fila-abre')].find((x) => /Explosive \/ Snappy/.test(x.textContent)).click());
  await page.waitForTimeout(300);
  const abiertoCps = await page.evaluate(() => { const b = [...document.querySelectorAll('table.composite button.fila-abre')].find((x) => /Explosive \/ Snappy/.test(x.textContent)); const fila = b.closest('tr').nextElementSibling; return { n: document.querySelectorAll('table.composite > tbody > tr.fila-det').length, aria: b.getAttribute('aria-expanded'), dentro: !!(fila && fila.classList.contains('fila-det') && fila.querySelector('table.composite-det')) }; });
  check('COMPOSITE: al pulsar «Explosive / Snappy» se despliega su desglose justo debajo de su fila', abiertoCps.n === 1 && abiertoCps.dentro === true && abiertoCps.aria === 'true', JSON.stringify(abiertoCps));
  await page.evaluate(() => [...document.querySelectorAll('table.composite button.fila-abre')].find((x) => /Explosive \/ Snappy/.test(x.textContent)).click());
  await page.waitForTimeout(300);
  const cerradoCps = await page.evaluate(() => ({ n: document.querySelectorAll('table.composite > tbody > tr.fila-det').length, aria: [...document.querySelectorAll('table.composite button.fila-abre')].find((x) => /Explosive \/ Snappy/.test(x.textContent)).getAttribute('aria-expanded') }));
  check('COMPOSITE: al pulsarlo otra vez se cierra', cerradoCps.n === 0 && cerradoCps.aria === 'false', JSON.stringify(cerradoCps));

  // Invariante importante: el percentil que usa COMPOSITE para una variable tiene que ser EXACTAMENTE el que muestra «Normative Benchmarking»
  // de ese test con la misma base. Si algún día se duplica el cálculo, esta prueba lo caza (13/11/2026).
  await cualClic(1, true);
  const pctComposite = await page.evaluate(() => {
    const d = [...document.querySelectorAll('table.composite button.fila-abre')][1].closest('tr').nextElementSibling;
    const tr = [...d.querySelectorAll('table.composite-det tbody tr')].find((r) => r.children[0].textContent.trim().startsWith('JH (imp-mom)'));
    return tr ? tr.children[1].textContent.trim() : null;
  });
  await go(`#jugador-${P}?t=${t.cmj}&b=fuerza&pn=pa`, 'table.pano.norm');
  // En pantallas estrechas el panorama parte las variables en varias tablas, así que hay que buscar la columna en TODAS (16/11/2026).
  const pctNb = await page.evaluate(() => {
    for (const tb of document.querySelectorAll('table.pano.norm')) {
      let k = 0;
      const idx = [...tb.querySelectorAll('thead tr:first-child th')].map((h) => { const o = { n: (h.querySelector('.pano-nm')?.innerText ?? '').trim(), i: k }; k += h.colSpan; return o; }).find((o) => o.n.toLowerCase() === 'jh (imp-mom)');
      const fila = [...tb.querySelectorAll('tbody tr')].find((r) => r.querySelector('th').innerText.trim() === 'La Liga percentile');
      if (idx && fila) return [...fila.querySelectorAll('td')][idx.i].innerText.trim();
    }
    return null;
  });
  check('COMPOSITE: el percentil de una variable es el mismo que muestra Normative Benchmarking', pctComposite !== null && pctNb !== null && pctNb.includes(pctComposite), `composite: ${pctComposite} · normative: ${pctNb}`);
  await go(`#jugador-${P}?b=composite`, 'table.composite', 4000);
  // al volver, el bloque arranca otra vez en «Latest»: el resto de comprobaciones se hacen en PA
  await page.evaluate(() => [...document.querySelectorAll('fieldset.modes')].find((x) => /Valor/.test(x.querySelector('legend').textContent)).querySelectorAll('input[type="radio"]')[1].click());
  await page.waitForTimeout(700);

  // El desglose: pesos, los dos lados del Knee Iso-Push, la altura del Drop Jump y lo que falta
  await cualTodas(true);
  const det = await page.evaluate(() => {
    return [...document.querySelectorAll('table.composite > tbody > tr.fila-det')].map((d) => ({ titulo: d.previousElementSibling.textContent.trim(), texto: d.textContent, filas: [...d.querySelectorAll('table.composite-det tbody tr')].map((tr) => [...tr.children].map((c) => c.textContent.trim())) }));
  });
  const dIso = det[0], dDin = det[1], dGct = det[5];
  // Las columnas del desglose, en el orden pedido por el usuario (14/11/2026), y todas centradas bajo su encabezado. Aquí el bloque está en PA.
  const cabDet = await page.evaluate(() => {
    const t = document.querySelector('table.composite-det');
    const th = [...t.querySelectorAll('thead th')];
    return { cab: th.map((x) => x.textContent.trim()), centradas: th.every((x) => getComputedStyle(x).textAlign === 'center') && [...t.querySelectorAll('tbody tr:first-child td')].every((x) => getComputedStyle(x).textAlign === 'center') };
  });
  check('COMPOSITE: el desglose tiene las columnas del documento más la comparación, en orden', cabDet.cab.join() === 'Variable,Percentil La Liga,Valor,% latest session vs Personal Average,Orientation,Fecha,Peso / etiqueta', cabDet.cab.join());
  check('COMPOSITE: las columnas del desglose están centradas bajo su encabezado', cabDet.centradas === true);
  check('COMPOSITE: el desglose dice el peso de cada variable de puntuación', dDin.filas[0].at(-1) === '55 %' && dDin.filas[1].at(-1) === '35 %' && dDin.filas[2].at(-1) === '10 %', JSON.stringify(dDin.filas.map((f) => f.at(-1))));
  check('COMPOSITE: el Knee Iso-Push muestra las dos piernas', dIso.filas[0][0].includes('izquierda') && dIso.filas[1][0].includes('derecha'), JSON.stringify(dIso.filas.slice(0, 2).map((f) => f[0])));
  check('COMPOSITE: el DSI aparece por lado con su orientación en la columna Orientation', dIso.filas.filter((f) => /^DSI/.test(f[0])).length === 2 && dIso.filas.filter((f) => /^DSI/.test(f[0])).every((f) => /(SSC|strength) training/i.test(f[4])), JSON.stringify(dIso.filas.filter((f) => /^DSI/.test(f[0]))));
  check('COMPOSITE: el impulso se usa por kilo (N s/kg), no en N·s absolutos', dDin.filas.some((f) => /CON IMPULSE\/BM/.test(f[0]) && /N s\/kg/.test(f[2])), JSON.stringify(dDin.filas.map((f) => [f[0], f[2]])));
  check('COMPOSITE: el Drop Jump dice de qué altura es cada dato', dGct.filas.filter((f) => /^(30|45) cm · /.test(f[0])).length >= 1, JSON.stringify(dGct.filas.map((f) => f[0])));
  // Short GCT puntúa con las DOS mitades: Drop Jump (de la altura de la ORZ) y Double-Leg Hop Test. El nombre del Hop Test estaba mal escrito
  // en el código («Hop Test») y la mitad del Hop se perdía en silencio; esta comprobación es el guardián de ese fallo (14/11/2026).
  const filaConValor = (f) => f[2] !== '—' && /^\d+$/.test(f[1]);
  check('COMPOSITE: Short GCT usa el Drop Jump y el Hop Test, los dos con dato y percentil', dGct.filas.some((f) => /^(30|45) cm · RSI/.test(f[0]) && filaConValor(f)) && dGct.filas.some((f) => /^MEAN RSI/.test(f[0]) && filaConValor(f)), JSON.stringify(dGct.filas.map((f) => f.slice(0, 3))));
  // Los textos de orientación que sustituyen al «No aplicable»: salen en la columna Orientation y, en Dynamic Strength, también en el título.
  // Textos del documento: los de las variables (v0.4), más los que ya traían el DSI, el EUR y el perfil carga-velocidad desde «Relaciones».
  const ORIENTS = ['Prioritize max isometric strength', 'Prioritize LML isometric strength', 'Prioritize increase functional depth', 'Propulsive strategy', 'Snappy', 'Prioritize decrease contraction time', 'Prioritize foundational dynamic strength', 'Acceptable output', 'Prioritize Power', 'Prioritize Strength', 'Reactive strategy', 'Prioritize Dynamic strength / concentric emphasis', 'tendency', 'Iso maximal strength training orientation', 'Max isometric strength training orientation', 'SSC training orientation', 'Strength training orientation without SSC', 'Concurrent strength training', 'Force-deficit', 'Velocity-deficit', 'Well-balanced'];
  const textosOri = det.flatMap((d) => d.filas.map((f) => f[4])).filter((x) => x && x !== '—' && !/interpretativa|puntuación/.test(x));
  check('COMPOSITE: la columna Orientation trae textos del documento y ninguno inventado', textosOri.length > 0 && textosOri.every((x) => ORIENTS.some((o) => x.includes(o))), JSON.stringify([...new Set(textosOri)]));
  check('COMPOSITE: la orientación de Propulsive / Dynamic Strength sale en el título del desglose', /Prioritize (Power|Strength)/.test(dDin.titulo) === /Prioritize (Power|Strength)/.test(dDin.texto), `${dDin.titulo}`);
  check('COMPOSITE: Propulsive y Explosive dicen qué tendencia domina', [det[1], det[4]].some((d) => /(Explosive|Propulsive) tendency/.test(d.texto)), JSON.stringify([det[1], det[4]].map((d) => d.titulo)));
  check('COMPOSITE: la tendencia va corta en Propulsive y larga en Explosive', !/tendency >/.test(det[1].texto) && (!/ tendency/.test(det[4].texto) || /tendency >|Explosive = Propulsive/.test(det[4].texto)), JSON.stringify(det.flatMap((d) => d.filas.map((f) => f[4])).filter((x) => /tendency/.test(x ?? ''))));
  check('COMPOSITE: las interpretativas del Hop Test también traen dato', dGct.filas.some((f) => /^MEAN CONTACT TIME/.test(f[0]) && filaConValor(f)) && dGct.filas.some((f) => /^MEAN JUMP HEIGHT/.test(f[0]) && filaConValor(f)), JSON.stringify(dGct.filas.map((f) => f[0])));
  // Las referencias del radar se activan y desactivan
  const lineasLeyenda = () => page.evaluate(() => [...document.querySelector('svg.radar-svg').querySelectorAll('g > line')].length);
  const antesLeg = await lineasLeyenda();
  check('COMPOSITE: sin posición, el radar dibuja al jugador y ninguna referencia', antesLeg === 1, String(antesLeg));
  if (CAP) await page.locator('.card').filter({ hasText: 'COMPOSITE PROFILE SCORE' }).first().screenshot({ path: path.join(CAP, 'composite2.png') });
  // El filtro de valor cambia tabla, radar y desglose a la vez
  const fechasPA = det[1].filas[0][5];
  await page.evaluate(() => [...document.querySelectorAll('fieldset.modes')].find((f) => /Valor/.test(f.querySelector('legend').textContent)).querySelectorAll('input[type="radio"]')[0].click());
  await page.waitForTimeout(600);
  await cualClic(1, true);
  const trasCps = await page.evaluate(() => {
    const d = [...document.querySelectorAll('table.composite button.fila-abre')][1].closest('tr').nextElementSibling;
    return { fecha: d.querySelectorAll('table.composite-det tbody tr')[0].children[5].textContent.trim(), comp: [...d.querySelectorAll('table.composite-det thead th')][3].textContent.trim(), aria: document.querySelector('svg.radar-svg').getAttribute('aria-label'), base: [...document.querySelectorAll('fieldset.modes input[type="radio"]')].findIndex((r) => r.checked) };
  });
  check('COMPOSITE: al cambiar a Latest el desglose pasa a la fecha de la última sesión', trasCps.fecha !== fechasPA && !trasCps.fecha.includes('–') && fechasPA.includes('–'), `${fechasPA} → ${trasCps.fecha}`);
  check('COMPOSITE: el radar sigue hablando de las mismas 6 cualidades', (trasCps.aria.match(/;/g) ?? []).length === 5, trasCps.aria.slice(0, 120));
  check('COMPOSITE: al cambiar a Latest la comparación pasa a ser con la sesión anterior', trasCps.comp === '% change vs previous session', trasCps.comp);
  await cualClic(1, true);
  const compCps = await page.evaluate(() => [...[...document.querySelectorAll('table.composite button.fila-abre')][1].closest('tr').nextElementSibling.querySelectorAll('table.composite-det tbody tr')].map((r) => r.children[3].textContent.trim()));
  check('COMPOSITE: la columna de comparación trae porcentajes con signo (o «—»)', compCps.length > 0 && compCps.every((x) => /^[+−]?\d+(,\d)? %$|^—$/.test(x)), JSON.stringify(compCps));
  const anchoCps = await sinDesborde('table.composite-det');
  check('COMPOSITE: el desglose cabe a lo ancho a 1840, 1440 y 1280 px, sin desplazamiento horizontal', anchoCps.length === 0, anchoCps.join(' · '));

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
  const selAsim = '.evo section:has(h4:text-is("Interlimb Asymmetry Over Time")) .sel-variable select';
  const valdOpt = await page.evaluate(() => { const sec = [...document.querySelectorAll('.evo section')].find((x) => /Interlimb Asymmetry Over Time/.test(x.querySelector('h4')?.textContent ?? '')); const s = sec?.querySelector('.sel-variable select'); const o = s ? [...s.options].find((x) => /ya calculada \(VALD\)/.test(x.text)) : null; return o ? { v: o.value, t: o.text } : null; });
  await page.selectOption(selAsim, valdOpt.v); await page.waitForTimeout(700);
  const tras = await page.evaluate(() => {
    const sec = [...document.querySelectorAll('.evo section')].find((x) => /Interlimb Asymmetry Over Time/.test(x.querySelector('h4')?.textContent ?? ''));
    const bcp = [...document.querySelectorAll('.evo fieldset')].find((x) => /Benchmark-Contextualized Positioning/.test(x.querySelector('legend')?.textContent ?? ''));
    const arriba = bcp?.querySelector('.sel-variable select')?.value ?? null;
    return { sel: sec.querySelector('.sel-variable select').value, lienzos: sec.querySelectorAll('canvas').length, nota: sec.querySelector('details')?.textContent ?? '', arriba, url: location.hash };
  });
  check('CMJ: al elegir una asimetría de VALD se dibuja y lo dice la nota', tras.sel === valdOpt.v && tras.lienzos === 1 && /ya viene calculada en el fichero de VALD/.test(tras.nota), JSON.stringify(tras).slice(0, 220));
  check('CMJ: el selector de asimetría es independiente del de la página', tras.arriba !== valdOpt.v && /[?&]va=/.test(tras.url), `variable de la página: ${tras.arriba}, asimetría: ${valdOpt.v}, ${tras.url}`);
  if (CAP) await page.locator('.evo section').filter({ hasText: 'Interlimb Asymmetry Over Time' }).first().screenshot({ path: path.join(CAP, 'asimetria-cmj.png') });
  await shot('cmj-asimetrias');

  // ---- Pestaña Asimetrías
  await go(`#jugador-${P}?b=asimetrias`, 'section.asimetrias table.asim');
  const caps = await texts('details.plg-test:has(table.asim) > summary .plg-txt'); const filas = await texts('table.asim tbody th');
  check('Asimetrías: aparecen cmj, sl cmj y perímetros', ['cmj', 'sl cmj', 'perímetros'].every((n) => caps.includes(n)), caps.join('|'));
  check('Asimetrías: Nordic, torque y 100 ms fuera; las 5 asimetrías de CMJ dentro', !caps.some((c) => /nordic/i.test(c)) && !filas.some((f) => /torque|(force|rfd) at 100 ms/i.test(f)) && filas.filter((f) => /asym$/i.test(f)).length === 5, filas.join('|'));
  const centr = await page.evaluate(() => { const t = document.querySelector('table.asim'); const al = (e) => getComputedStyle(e).textAlign; return [...t.querySelectorAll('thead th')].slice(2).every((h) => al(h) === 'center') && [...t.querySelectorAll('tbody td.num')].every((d) => al(d) === 'center') && t.querySelectorAll('thead th').length === 6; });
  check('Asimetrías: 6 columnas y Asimetría · Valores · Comparación · Fecha centrados bajo su título', centr);
  // La columna de comparación (14/11/2026): título que dice qué compara, y por lado.
  const cabAsim = async () => page.evaluate(() => ([...document.querySelectorAll('table.asim thead th')][4]?.innerText.trim() ?? '').toLowerCase());
  check('Asimetrías: por defecto viene marcado Latest', (await cabAsim()) === '% change vs previous session', await cabAsim());
  const compAsim = await texts('table.asim tbody td.asim-comp');
  check('Asimetrías: la comparación sale por lado (L y R) o en puntos porcentuales en las variables ASYM de VALD', compAsim.length > 0 && compAsim.every((x) => /^L .+ · R .+$|p\.p\.$|^—$/.test(x.replace(/\s+/g, ' ').trim())), JSON.stringify(compAsim.slice(0, 4)));
  const anchoAsim = await sinDesborde('table.asim');
  check('Asimetrías: caben a lo ancho a 1840, 1440 y 1280 px, sin desplazamiento horizontal', anchoAsim.length === 0, anchoAsim.join(' · '));
  const f3 = await texts('table.asim tbody td.asim-fecha');
  check('Asimetrías con Latest: la columna muestra la fecha de cada asimetría', f3.length > 0 && f3.every((x) => /^\d{2}\/\d{2}\/\d{4}$/.test(x.trim())), f3.slice(0, 2).join('|'));
  await page.locator('input[name="asim-base"]').nth(1).check(); await page.waitForTimeout(300);
  check('Asimetrías: con Personal Average el título de la comparación cambia', (await cabAsim()) === '% latest session vs personal average', await cabAsim());
  const f1 = await texts('table.asim tbody td.asim-fecha');
  check('Asimetrías con Personal Average: la columna lo indica con su periodo', f1.length > 0 && f1.every((x) => /^Personal Average · /.test(x)), f1.slice(0, 2).join('|'));
  await page.locator('input[name="asim-base"]').nth(2).check(); await page.waitForTimeout(300);
  check('Asimetrías: con Personal Best el título de la comparación cambia', (await cabAsim()) === '% latest session vs personal best', await cabAsim());
  const f2 = await texts('table.asim tbody td.asim-fecha');
  check('Asimetrías con Personal Best: la columna lo indica con la fecha', f2.length > 0 && f2.every((x) => /^Personal Best · \d/.test(x)), f2.slice(0, 2).join('|'));
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

  // ---- Aviso al renombrar un test que el código localiza por su nombre, y comprobación de nombres en Ajustes (14/11/2026)
  await go(`#catalogo-test-${t.cmj}`, 'form.fields');
  const campoNombre = page.locator('form.fields label', { hasText: /^Nombre/ }).locator('input').first();
  const guardarTest = () => page.locator('form.fields').first().locator('button[type=submit]').first().click();
  check('catálogo: dice qué partes del dashboard usan este test por su nombre', (await page.locator('form.fields p.muted', { hasText: /Lo usan por su nombre/ }).count()) === 1, (await texts('form.fields p')).join(' | ').slice(0, 160));
  await campoNombre.fill('Countermovement Jump'); await page.waitForTimeout(250);
  check('catálogo: avisa antes de un renombrado que rompería las búsquedas', (await page.locator('p.status.warn', { hasText: /dejarán de encontrarlo/ }).count()) === 1);
  await guardarTest(); await page.waitForTimeout(600);
  const trasPrimerIntento = await page.evaluate((id) => new Promise((ok) => { const r = indexedDB.open('dashboard-rendimiento'); r.onsuccess = () => { const d = r.result; d.transaction('tests').objectStore('tests').get(id).onsuccess = (e) => { d.close(); ok(e.target.result.name); }; }; }), t.cmj);
  check('catálogo: el primer «Guardar» no renombra, solo avisa', trasPrimerIntento === 'CMJ', trasPrimerIntento);
  await campoNombre.fill('cmj'); await page.waitForTimeout(250);
  check('catálogo: un nombre equivalente no avisa', (await page.locator('p.status.warn', { hasText: /dejarán de encontrarlo/ }).count()) === 0);
  await guardarTest(); await page.waitForTimeout(600);
  const trasEquivalente = await page.evaluate((id) => new Promise((ok) => { const r = indexedDB.open('dashboard-rendimiento'); r.onsuccess = () => { const d = r.result; d.transaction('tests').objectStore('tests').get(id).onsuccess = (e) => { d.close(); ok(e.target.result.name); }; }; }), t.cmj);
  check('catálogo: un nombre equivalente se guarda a la primera', trasEquivalente === 'cmj', trasEquivalente);
  await go('#configuracion', '.card');
  await page.waitForFunction(() => [...document.querySelectorAll('.card')].some((x) => /Comprobación de nombres/.test(x.textContent)), null, { timeout: 8000 }).catch(() => {});
  check('ajustes: la comprobación de nombres no encuentra ningún problema', (await page.locator('.card', { hasText: 'Comprobación de nombres' }).locator('p.status.ok').count()) === 1, await page.evaluate(() => { const c = [...document.querySelectorAll('.card')].find((x) => /Comprobación de nombres/.test(x.textContent)); return c ? c.innerText.slice(0, 400) : 'no está la tarjeta'; }));

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
