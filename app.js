import { parseHash } from './rutas.js';
import { VistaTest } from './pages-test.js';
import { Relaciones } from './pages-asociaciones.js';
import { html, useState, useEffect, useCallback } from './libs.js';
import { AppContext } from './context.js';
import { getLocal, getSetting, APP_VERSION } from './db.js';
import { backupState } from './util.js';
import { Inicio, Proximamente, Copias, Configuracion } from './pages.js';
import { Jugadores, PerfilJugador } from './pages-jugadores.js';
import { Catalogo, TestDetalle, BloqueCatalogo } from './pages-catalogo.js';
import { Importar } from './pages-importar.js';
import { Angulos, EnlaceAngulos } from './pages-angulos.js';

export const NAV = [
  { id: 'inicio', label: 'Inicio' },
  { id: 'jugadores', label: 'Jugadores' },
  { id: 'fuerza', label: 'Manifestaciones de la fuerza' },
  { id: 'relaciones', label: 'Relaciones entre variables' },
  { id: 'perimetros', label: 'Datos antropométricos' },
  { id: 'nme', label: 'NME' },
  { id: 'catalogo', label: 'Catálogo de tests' },
  { id: 'importar', label: 'Importar' },
  { id: 'copias', label: 'Copias de seguridad' },
  { id: 'configuracion', label: 'Configuración' },
];

// Menú lateral (10/11/2026): cinco entradas. Las secciones agrupadas se alcanzan con pestañas dentro de la propia página; las rutas por hash no cambian.
export const NAV_GRUPOS = [
  { id: 'inicio', label: 'Inicio', miembros: ['inicio', 'copias', 'configuracion'], pestanas: [['inicio', 'Resumen'], ['copias', 'Copias de seguridad'], ['configuracion', 'Configuración']] },
  { id: 'jugadores', label: 'Jugadores', miembros: ['jugadores'] },
  { id: 'relaciones', label: 'Relaciones entre variables', miembros: ['relaciones'] },
  { id: 'fuerza', label: 'Catálogo de tests', miembros: ['fuerza', 'nme', 'perimetros', 'catalogo'], pestanas: [['fuerza', 'Manifestaciones de la fuerza'], ['nme', 'NME'], ['perimetros', 'Datos antropométricos'], ['catalogo', 'Catálogo y edición']] },
  { id: 'importar', label: 'Importar', miembros: ['importar'] },
];
const Pestanas = ({ items, actual }) => html`<div class="tabs tabs-nav" role="navigation" aria-label="Secciones">${items.map(([id, label]) => html`<a key=${id} href=${'#' + id} class=${'tab' + (id === actual ? ' on' : '')} aria-current=${id === actual ? 'page' : null}>${label}</a>`)}</div>`;

// Rutas por hash: «#copias», «#jugadores», «#jugador-12» (perfil del jugador con id 12) y «#catalogo-test-5» (detalle del test 5).
const routeFromHash = () => {
  const { path: h, query } = parseHash();
  if (h === 'nme-angulos') return { id: 'nme', view: 'angulos', param: null, query };
  const m = /^jugador-(\d+)$/.exec(h);
  if (m) return { id: 'jugadores', param: Number(m[1]), query };
  const t = /^catalogo-test-(\d+)$/.exec(h);
  if (t) return { id: 'catalogo', param: Number(t[1]), query };
  const v = /^test-(\d+)$/.exec(h); // vista comparativa de un test (fase 5b)
  if (v) return { id: 'fuerza', view: 'test', param: Number(v[1]), query };
  return { id: NAV.some((n) => n.id === h) ? h : 'inicio', param: null, query };
};

function Page({ route }) {
  const grupo = NAV_GRUPOS.find((g) => g.pestanas && g.miembros.includes(route.id));
  const lista = grupo && !route.param && !route.view; // las pantallas de detalle (un jugador, un test, el digitalizador) no llevan pestañas
  return html`${lista ? html`<${Pestanas} items=${grupo.pestanas} actual=${route.id} />` : null}<${Contenido} route=${route} />`;
}

function Contenido({ route }) {
  switch (route.id) {
    case 'inicio':
      return html`<${Inicio} />`;
    case 'jugadores':
      return route.param ? html`<${PerfilJugador} id=${route.param} query=${route.query} />` : html`<${Jugadores} />`;
    case 'fuerza':
      if (route.view === 'test') return html`<${VistaTest} id=${route.param} query=${route.query} />`;
      return html`<${BloqueCatalogo} blockKey="fuerza" titulo="Manifestaciones de la fuerza" vacio="Aún no hay tests configurados." />`;
    case 'relaciones':
      return html`<${Relaciones} query=${route.query} />`;
    case 'perimetros':
      return html`<${BloqueCatalogo} blockKey="perimetros" titulo="Datos antropométricos" vacio="No hay medidas de perímetro definidas." />`;
    case 'nme':
      if (route.view === 'angulos') return html`<${Angulos} />`;
      return html`<${EnlaceAngulos} /><${BloqueCatalogo} blockKey="nme" titulo="NME" vacio="Bloque sin definir." />`;
    case 'catalogo':
      return route.param ? html`<${TestDetalle} id=${route.param} />` : html`<${Catalogo} />`;
    case 'importar':
      return html`<${Importar} />`;
    case 'copias':
      return html`<${Copias} />`;
    case 'configuracion':
      return html`<${Configuracion} />`;
    default:
      return null;
  }
}

export function App({ db }) {
  const [route, setRoute] = useState(routeFromHash());
  const [version, setVersion] = useState(0);
  const [reminder, setReminder] = useState(null);
  const bump = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    const onHash = () => {
      setRoute(routeFromHash());
      window.scrollTo(0, 0);
    };
    const onQuery = () => setRoute(routeFromHash()); // cambio de filtros: sin saltar al principio
    window.addEventListener('hashchange', onHash);
    window.addEventListener('hashquery', onQuery);
    return () => {
      window.removeEventListener('hashchange', onHash);
      window.removeEventListener('hashquery', onQuery);
    };
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [last, days] = await Promise.all([getLocal(db, 'lastBackup'), getSetting(db, 'backupReminderDays')]);
      if (alive) setReminder(backupState(last, days));
    })();
    return () => {
      alive = false;
    };
  }, [db, version, route.id]);

  const current = NAV.find((n) => n.id === route.id);
  useEffect(() => {
    document.title = `${current.label} · Dashboard de rendimiento`;
  }, [route.id, route.param]);

  return html`
    <${AppContext.Provider} value=${{ db, version, bump }}>
      <a class="skip" href="#contenido">Saltar al contenido</a>
      <div class="shell">
        <header class="top">
          <h1>Dashboard de rendimiento</h1>
          <span class="ver">v${APP_VERSION}</span>
        </header>
        <nav aria-label="Principal" class="nav">
          <ul>
            ${NAV_GRUPOS.map(
              (n) => html`<li key=${n.id}>
                <a href=${'#' + n.id} aria-current=${n.miembros.includes(route.id) ? 'page' : null} class=${n.miembros.includes(route.id) ? 'active' : ''}>${n.label}</a>
              </li>`,
            )}
          </ul>
        </nav>
        <main id="contenido" tabindex="-1">
          ${reminder && reminder.level === 'warn' && route.id !== 'copias'
            ? html`<div class="banner warn" role="status">${reminder.text} <a href="#copias">Ir a copias de seguridad</a></div>`
            : null}
          <${Page} route=${route} />
        </main>
      </div>
    <//>
  `;
}
