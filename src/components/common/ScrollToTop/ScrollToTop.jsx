import { useLayoutEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * ScrollToTop — React Router (a diferencia de una navegación con recarga de
 * página completa) NO vuelve el scroll arriba al cambiar de ruta: el
 * `window` sigue en la posición Y de la página anterior. En esta app el
 * scroll real vive en el `window`/documento (no hay ningún contenedor con
 * `overflow-y` propio en el layout general — ver #main-content-area en
 * App.css), así que alcanza con resetear `window.scrollTo`.
 *
 * Sin esto: si el usuario estaba scrolleado hacia abajo en, por ejemplo, la
 * home, y navega a otra sección, la pantalla nueva se pinta pero el scroll
 * sigue abajo — se ve "vacía" (el contenido real está mas arriba, fuera de
 * vista) hasta que el usuario sube manualmente.
 *
 * `useLayoutEffect` (no `useEffect`): corre ANTES de que el navegador pinte
 * el frame con el contenido nuevo ya montado, así el reset de scroll pasa
 * en el mismo frame en vez de un instante despues (que se alcanzaria a ver
 * como un "salto").
 *
 * `behavior: 'instant'` explícito: `html { scroll-behavior: smooth }` es
 * global (src/styles/globals.css) — sin esto, CADA cambio de ruta se veria
 * como un scroll animado de arriba a abajo en vez de un corte instantaneo.
 */
const ScrollToTop = () => {
  const { pathname } = useLocation();

  useLayoutEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [pathname]);

  return null;
};

export default ScrollToTop;
