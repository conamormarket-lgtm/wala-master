import { useLayoutEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * ScrollToTop — React Router (a diferencia de una navegación con recarga de
 * página completa) NO vuelve el scroll arriba al cambiar de ruta. Sin esto,
 * si el usuario estaba scrolleado hacia abajo y navegaba a otra sección, la
 * pantalla nueva se pintaba pero el scroll seguía abajo — se veía "vacía"
 * (el contenido real quedaba fuera de vista) hasta subir manualmente.
 * Pasaba en todo el proyecto (tienda, cuenta, admin, minijuegos, etc.).
 *
 * Por qué la versión anterior (solo `window.scrollTo(0,0)`) no bastaba:
 *  1. `history.scrollRestoration` estaba en 'auto' — el navegador RESTAURA
 *     por su cuenta la posición de scroll de la entrada de historial al
 *     navegar, pisando nuestro reset (la página "se bajaba" sola). Lo
 *     fijamos en 'manual' una sola vez.
 *  2. La ruta destino es lazy (React.lazy + <Suspense>): su contenido real
 *     monta DESPUÉS de este efecto, y al montar puede correr el scroll
 *     (imágenes que cargan y crecen el layout, un componente que hace
 *     focus, etc.). Por eso reseteamos también en el frame siguiente.
 *  3. Distintos motores exponen el scroll del documento en distintos
 *     elementos y algún layout podría scrollear en un contenedor propio;
 *     reseteamos window + documentElement + body + #main-content-area.
 *
 * `scrollTop = 0` directo es SIEMPRE instantáneo (no lo afecta el
 * `html { scroll-behavior: smooth }` global de globals.css); `scrollTo` con
 * `behavior: 'instant'` cubre el resto. `useLayoutEffect` (no `useEffect`)
 * para que el reset pase en el mismo commit que el contenido nuevo, sin
 * verse como un salto.
 */

// Fuera del componente: se ejecuta una sola vez al cargar el módulo, no en
// cada render/navegación.
if (typeof window !== 'undefined' && 'scrollRestoration' in window.history) {
  window.history.scrollRestoration = 'manual';
}

const resetScroll = () => {
  try {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  } catch {
    window.scrollTo(0, 0);
  }
  const doc = document.documentElement;
  if (doc) doc.scrollTop = 0;
  if (document.body) document.body.scrollTop = 0;
  const main = document.getElementById('main-content-area');
  if (main) main.scrollTop = 0;
};

const ScrollToTop = () => {
  const { pathname } = useLocation();

  useLayoutEffect(() => {
    resetScroll();
    // Segundo reset en el frame siguiente: re-asienta arriba una vez que el
    // contenido lazy de la ruta ya montó (ver punto 2 del comentario). Un
    // único rAF no pelea con el scroll manual del usuario, que no puede
    // ocurrir en ese primer frame tras la navegación.
    const raf = requestAnimationFrame(resetScroll);
    return () => cancelAnimationFrame(raf);
  }, [pathname]);

  return null;
};

export default ScrollToTop;
