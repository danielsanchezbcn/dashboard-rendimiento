# Registro de decisiones

## Decisiones del usuario

| Id | Decisión | Estado | Fecha |
|---|---|---|---|
| D1 | Pila: JavaScript con módulos ES sin compilar el código propio; librerías con versión fija | Aprobada | 2026-10-31 |
| D2 | Navegador de uso: Chrome o Edge, con copia a carpeta elegida | Decidida | 2026-10-31 |
| D3 | Alojamiento: GitHub Pages en su cuenta actual, sin publicar otros sitios en ella | Decidida | 2026-11-01 |
| D4 | Manifestación de la fuerza a nivel de variable (un test, una sesión) | Pendiente, antes de la fase 2 | |
| D5 | Resultado de sesión en perfiles de carga, RM, Iso-Hold y Nordic | Pendiente, antes de la fase 2 | |
| D6 | El lado (izquierdo/derecho) como atributo de la repetición | Pendiente, antes de la fase 2 | |
| D7 | Cifrado de copias con contraseña | Opcional al crear la copia | 2026-10-31 |
| D8 | Forma de guardar las repeticiones (filas largas o una fila por repetición con objeto por identificador de variable) | Aplazada al inicio de la fase 2 | 2026-11-01 |

## Evidencia de la prueba de viabilidad (Chrome 156, Windows, GitHub Pages)

- Datos conservados al reabrir (más de 19 horas entre creación y apertura); la carpeta recordada se conserva entre sesiones (el permiso puede volver a pedirse).
- Ciclo copia → borrar → restaurar → verificar correcto con y sin gzip + cifrado; restauración desde fichero real correcta.
- La política de seguridad de la página bloquea cualquier conexión.
- Persistencia solicitada cuatro veces: denegada. Se trata el almacenamiento como no persistente.
- D8: a 142.500 valores, filas largas 20,2 s y filas anchas 1,6–2,4 s de escritura; a 13.500 valores, 1,4 s frente a 0,4–0,5 s. Recomendación pendiente de decisión: una fila por repetición con objeto por identificador de variable.

## Decisiones técnicas de la fase 1b

- La interfaz usa Preact con htm; la base de datos, Dexie sobre IndexedDB (ver `LIBRERIAS.md`).
- La lista de tablas de la copia se obtiene del esquema: las tablas futuras entran automáticamente salvo `local`.
- La restauración reemplaza (no fusiona), es atómica y se verifica dentro de la transacción.
- No hay copias automáticas silenciosas: guardar en disco exige una acción del usuario. Existe un recordatorio configurable (sin valor por defecto) y un aviso cuando nunca se ha creado una copia.
- Los ajustes solo existen si el usuario los define.
- La auditoría guarda acción y alcance, nunca valores de datos.
- Rutas de la aplicación por hash (`#copias`), compatibles con alojamiento estático.
- Estructura plana: todos los archivos en la raíz del repositorio, sin carpetas, porque la subida web de GitHub del usuario sube los archivos sueltos. Los módulos se importan con rutas `./nombre.js`. El origen de las librerías se llama `libs-fuente.js` para que no colisione con el compilado `libs.js`.
- No hay inicio de sesión: la protección de acceso es la del perfil de usuario del equipo.

## Cambios

- 2026-11-02: estructura plana para publicar con la subida web de GitHub. Versión de aplicación 1b-0.1.1 (solo cambian las rutas de importación, el punto de entrada y el número de versión; lógica, esquema 1, política de seguridad y copias, sin cambios).
- 2026-11-01: fase 1b (esqueleto, navegación, copias de seguridad). Versión de aplicación 1b-0.1.0, esquema 1.
