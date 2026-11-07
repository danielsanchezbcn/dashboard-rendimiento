import { html, useState, useEffect, useCallback } from './libs.js';
import { AppContext } from './context.js';
import { getLocal, getSetting, APP_VERSION } from './db.js';
import { backupState } from './util.js';
import { Inicio, Proximamente, Copias, Configuracion } from './pages.js';
import { Jugadores, PerfilJugador } from './pages-jugadores.js';
import { Catalogo, TestDetalle, BloqueCatalogo } from './pages-catalogo.js';

export const NAV = [
  { id: 'inicio', label: 'Inicio' },
  { id: 'jugadores', label: 'Jugadores' },
  { id: 'fuerza', label: 'Manifestaciones de la fuerza' },
  { id: 'perimetros', label: 'Perímetros' },
  { id: 'nme', label: 'NME' },
  { id: 'catalogo', label: 'Catálogo de tests' },
  { id: 'importar', label: 'Importar' },
  { id: 'copias', label: 'Copias de seguridad' },
  { id: 'configuracion', label: 'Configuración' },
];

// Rutas por hash: «#copias», «#jugadores», «#jugador-12» (perfil del jugador con id 12) y «#catalogo-test-5» (detalle del test 5).
const routeFromHash = () => {
  const h = location.hash.replace(/^#\/?/, '');
  const m = /^jugador-(\d+)$/.exec(h);
  if (m) return { id: 'jugadores', param: Number(m[1]) };
  const t = /^catalogo-test-(\d+)$/.exec(h);
  if (t) return { id: 'catalogo', param: Number(t[1]) };
  return { id: NAV.some((n) => n.id === h) ? h : 'inicio', param: null };
};

function Page({ route }) {
  switch (route.id) {
    case 'inicio':
      return html`<${Inicio} />`;
    case 'jugadores':
      return route.param ? html`<${PerfilJugador} id=${route.param} />` : html`<${Jugadores} />`;
    case 'fuerza':
      return html`<${BloqueCatalogo} blockKey="fuerza" titulo="Manifestaciones de la fuerza" vacio="Aún no hay tests configurados." />`;
    case 'perimetros':
      return html`<${BloqueCatalogo} blockKey="perimetros" titulo="Perímetros" vacio="No hay medidas de perímetro definidas." />`;
    case 'nme':
      return html`<${BloqueCatalogo} blockKey="nme" titulo="NME" vacio="Bloque sin definir." />`;
    case 'catalogo':
      return route.param ? html`<${TestDetalle} id=${route.param} />` : html`<${Catalogo} />`;
    case 'importar':
      return html`<${Proximamente} titulo="Importar" fase="3 y 4" detalle="Importación de Excel propio y de exportaciones de VALD, con confirmación de cada nombre de jugador en cada lote." />`;
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
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
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
            ${NAV.map(
              (n) => html`<li key=${n.id}>
                <a href=${'#' + n.id} aria-current=${n.id === route.id ? 'page' : null} class=${n.id === route.id ? 'active' : ''}>${n.label}</a>
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
