import { html, useState, useEffect, useCallback } from '../../vendor/libs.js';
import { AppContext } from './context.js';
import { getLocal, getSetting, APP_VERSION } from '../db.js';
import { backupState } from './util.js';
import { Inicio, Bloque, Proximamente, Copias, Configuracion } from './pages.js';

export const NAV = [
  { id: 'inicio', label: 'Inicio' },
  { id: 'jugadores', label: 'Jugadores' },
  { id: 'fuerza', label: 'Manifestaciones de la fuerza' },
  { id: 'perimetros', label: 'Perímetros' },
  { id: 'nme', label: 'NME' },
  { id: 'importar', label: 'Importar' },
  { id: 'copias', label: 'Copias de seguridad' },
  { id: 'configuracion', label: 'Configuración' },
];

const routeFromHash = () => {
  const id = location.hash.replace(/^#\/?/, '');
  return NAV.some((n) => n.id === id) ? id : 'inicio';
};

function Page({ route }) {
  switch (route) {
    case 'inicio':
      return html`<${Inicio} />`;
    case 'jugadores':
      return html`<${Proximamente} titulo="Jugadores" fase="1c" detalle="Lista de jugadores, nombre en camiseta, alias por fuente, posiciones con fecha y antropometría con historial." />`;
    case 'fuerza':
      return html`<${Bloque}
        titulo="Manifestaciones de la fuerza"
        vacio="Aún no hay tests configurados."
        detalle="El catálogo (manifestaciones, zonas anatómicas, tests, protocolos y variables) se carga en la fase 2 a partir de la lista que aportaste, y se podrá editar sin tocar el código. No se añade nada que no hayas definido."
      />`;
    case 'perimetros':
      return html`<${Bloque}
        titulo="Perímetros"
        vacio="No hay medidas de perímetro definidas."
        detalle="Las zonas, si se mide por lado, las unidades, el procedimiento, el número de mediciones y cómo se resume cada sesión los defines tú. No se precarga ninguna medida."
      />`;
    case 'nme':
      return html`<${Bloque}
        titulo="NME"
        vacio="Bloque sin definir."
        detalle="Los tests, protocolos, variables y unidades de este bloque los defines tú. La etiqueta se conserva tal como la aportaste."
      />`;
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
  }, [db, version, route]);

  const current = NAV.find((n) => n.id === route);
  useEffect(() => {
    document.title = `${current.label} · Dashboard de rendimiento`;
  }, [route]);

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
                <a href=${'#' + n.id} aria-current=${n.id === route ? 'page' : null} class=${n.id === route ? 'active' : ''}>${n.label}</a>
              </li>`,
            )}
          </ul>
        </nav>
        <main id="contenido" tabindex="-1">
          ${reminder && reminder.level === 'warn' && route !== 'copias'
            ? html`<div class="banner warn" role="status">${reminder.text} <a href="#copias">Ir a copias de seguridad</a></div>`
            : null}
          <${Page} route=${route} />
        </main>
      </div>
    <//>
  `;
}
