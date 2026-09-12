import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { EASE_SIGNATURE, useReducedMotionSafe } from '../../../theme/motion';
import BrandLoader from './BrandLoader';
import Loading from '../Loading';

// El splash de marca de Walá (la bolsa con la "W" sobre el degradado violeta)
// se muestra UNA sola vez por navegador: la PRIMERA carga de la app. A partir
// de ahí, cualquier estado de carga —el de la tienda incluido— usa el círculo
// simple, más liviano y menos repetitivo. El mismo flag lo lee el splash
// estático de index.html para no repetir la marca en recargas posteriores.
export const BRAND_SEEN_KEY = 'wala_brand_seen';

// Lee el flag UNA vez al importar el módulo. Es un `let` mutable: en cuanto el
// primer splash de marca termina su carga se pone en true (y se persiste), así
// que dentro de la misma sesión SPA las siguientes cargas ya usan el círculo,
// sin esperar a una recarga completa.
let brandConsumed = (() => {
  try { return localStorage.getItem(BRAND_SEEN_KEY) === '1'; } catch (_) { return false; }
})();

const marcarMarcaVista = () => {
  if (brandConsumed) return;
  brandConsumed = true;
  try { localStorage.setItem(BRAND_SEEN_KEY, '1'); } catch (_) { /* storage no disponible */ }
};

/**
 * BrandLoaderOverlay — el BrandLoader a pantalla completa (via portal a
 * document.body, para que el position:fixed se ancle al viewport y ningun
 * ancestro con overflow/transform lo recorte) CON transicion de salida.
 *
 * Antes el overlay se montaba/desmontaba en seco (`{!pageReady && ...}`):
 * la pantalla de carga desaparecia de golpe y la tienda aparecia de un
 * corte. Ahora, cuando `show` pasa a false, AnimatePresence mantiene el
 * overlay montado el tiempo justo para reproducir su animacion de SALIDA:
 * el degradado de marca se funde mientras el conjunto hace un leve zoom
 * hacia afuera (como si la marca se "abriera" hacia la tienda que ya esta
 * pintada debajo). Curva firma del sistema (EASE_SIGNATURE).
 *
 * `initial={false}` en AnimatePresence: el overlay NO anima su ENTRADA
 * (aparece instantaneo), para relevar sin costura al splash estatico de
 * index.html; solo la salida se anima.
 *
 * Con prefers-reduced-motion la salida es un fundido corto y simple, sin
 * zoom (respeta la preferencia de menos movimiento).
 *
 * @param {boolean} show  true = cargando (overlay visible); false = listo
 *   (dispara la transicion de salida y luego desmonta).
 * @param {boolean} [relevo]  true = este overlay NO es el ultimo: al ocultarse
 *   hay OTRO loader identico detras que sigue la carga (es el caso de la
 *   landing, que releva a la tienda). Entonces se desmonta en seco, sin la
 *   animacion de salida: si se fundiera con zoom, se veria un loader
 *   desvaneciendose ENCIMA de otro loader igual — el "parpadeo" de la carga.
 *   La animacion de salida se reserva para el ultimo, que es el que de verdad
 *   abre hacia la tienda.
 */
// Tope absoluto: ningun estado de carga rio arriba (una landing sin
// try/catch alrededor de su fetch, un pageId que nunca se estabiliza, un
// Firestore caido) puede dejar a un usuario real atrapado detras de este
// overlay para siempre -sin poder scrollear NI tocar nada de la tienda, ver
// el comentario de pointerEvents mas abajo-. Pasados MAX_SHOW_MS con `show`
// en true sin soltar, se lo trata como oculto igual, decida lo que decida
// el padre.
const MAX_SHOW_MS = 15000;

const BrandLoaderOverlay = ({ show, relevo = false }) => {
  const reducedMotion = useReducedMotionSafe();

  // ¿Esta instancia muestra el splash de MARCA o el círculo? Se decide UNA vez
  // al montar (useState con inicializador): si ya se consumió el splash de
  // marca, va el círculo. Capturarlo al montar evita que cambie a mitad de
  // vida si `brandConsumed` se marca durante esta misma carga.
  const [useBrand] = useState(() => !brandConsumed);
  // ¿Llegó a mostrarse de verdad? Solo entonces "gastamos" el splash único:
  // si el overlay se monta con show:false (tienda ya cacheada) no marcaría nada.
  const wasShownRef = useRef(false);

  // Al mostrar el CÍRCULO (navegación DENTRO de la app, ya con el header
  // pintado), el overlay arranca DEBAJO del header en vez de taparlo: uno ya
  // está en la app, el header debe seguir visible mientras carga el hero. El
  // splash de MARCA (primera carga en frío) sí cubre todo. `contentTop` es el
  // borde superior del área de contenido (#main-content-area, justo debajo del
  // header + barra admin si la hay); se mide al mostrarse y en cada resize.
  const [contentTop, setContentTop] = useState(0);
  useLayoutEffect(() => {
    if (useBrand || !show) return undefined;
    const medir = () => {
      const main = document.getElementById('main-content-area');
      setContentTop(main ? Math.max(0, Math.round(main.getBoundingClientRect().top)) : 0);
    };
    medir();
    window.addEventListener('resize', medir);
    return () => window.removeEventListener('resize', medir);
  }, [useBrand, show]);

  // Ver MAX_SHOW_MS arriba: `effectiveShow` reemplaza a `show` en todo lo de
  // abajo (bloqueo de scroll, pointer-events, AnimatePresence) para que el
  // tope realmente libere la pagina, no solo dispare un efecto que nadie lee.
  const [forceHidden, setForceHidden] = useState(false);
  useEffect(() => {
    if (!show) { setForceHidden(false); return undefined; }
    const t = setTimeout(() => setForceHidden(true), MAX_SHOW_MS);
    return () => clearTimeout(t);
  }, [show]);
  const effectiveShow = show && !forceHidden;

  // Marca el splash de marca como "ya visto" cuando ESTA instancia (de marca,
  // no relevo) termina su carga tras haberse mostrado. El relevo (la landing
  // que cede a la tienda) NO lo marca: el splash único se consume recién cuando
  // el overlay FINAL —el de la tienda— se abre hacia el contenido. Así el
  // handoff landing→tienda de la primera carga se ve entero con la marca.
  if (effectiveShow) wasShownRef.current = true;
  useEffect(() => {
    if (useBrand && !relevo && !effectiveShow && wasShownRef.current) {
      marcarMarcaVista();
    }
  }, [effectiveShow, useBrand, relevo]);

  // Bloquea el scroll del documento mientras el loader esta presente. Sin
  // esto, el contenido de la tienda (ya renderizado debajo del overlay) hace
  // que la pagina sea alta y aparece una barra de scroll SOBRE la pantalla de
  // carga. Se compensa el ancho de la barra con padding-right para que al
  // soltar el bloqueo el contenido no "salte" de lado.
  //
  // CLAVE: el bloqueo se mantiene durante TODA la animacion de SALIDA y se
  // suelta recien en onExitComplete (no cuando `show` pasa a false). El overlay
  // sale con scale:1.06 (zoom hacia afuera); al ser position:fixed inset:0, ese
  // 106% se sale del viewport por los 4 lados y, con el scroll ya libre,
  // disparaba una barra de scroll durante ~0.6s justo al terminar de cargar.
  // Con overflow:hidden vigente hasta que el zoom termina, queda recortado.
  const savedRef = useRef(null);

  const lockScroll = () => {
    if (savedRef.current) return; // ya bloqueado (idempotente)
    const html = document.documentElement;
    const scrollbarWidth = window.innerWidth - html.clientWidth;
    savedRef.current = {
      overflow: html.style.overflow,
      paddingRight: html.style.paddingRight,
    };
    html.style.overflow = 'hidden';
    if (scrollbarWidth > 0) html.style.paddingRight = `${scrollbarWidth}px`;
  };

  const unlockScroll = () => {
    if (!savedRef.current) return;
    const html = document.documentElement;
    html.style.overflow = savedRef.current.overflow;
    html.style.paddingRight = savedRef.current.paddingRight;
    savedRef.current = null;
  };

  useEffect(() => {
    if (effectiveShow) lockScroll();
    // Ojo: NO desbloqueamos cuando show pasa a false — eso lo hace
    // onExitComplete, cuando el zoom de salida ya termino (ver comentario
    // arriba). Aqui solo bloqueamos al entrar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveShow]);

  // Red de seguridad #1: si `onExitComplete` de framer-motion no llega a
  // dispararse -pestaña en segundo plano cuando arranca la salida (rAF se
  // pausa), la tab pierde foco a mitad de la animacion, o cualquier otro
  // corte del ciclo de la transicion- el scroll quedaba bloqueado PARA
  // SIEMPRE: el usuario ya no podia bajar la pagina ni aunque la tienda
  // estuviera pintada debajo. Un timer de respaldo, atado a la MISMA
  // duracion que la transicion de salida, garantiza que el candado se
  // suelta si o si un instante despues de que `show` pasa a false.
  const exitDurationMs = relevo ? 0 : (reducedMotion ? 300 : 600);
  useEffect(() => {
    if (effectiveShow) return undefined;
    const t = setTimeout(unlockScroll, exitDurationMs + 400);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveShow]);

  // Seguridad: si el overlay se desmonta por completo estando bloqueado
  // (p.ej. cambio de ruta a mitad de la salida), restauramos el scroll.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => () => unlockScroll(), []);

  return createPortal(
    <AnimatePresence initial={false} onExitComplete={unlockScroll}>
      {effectiveShow && (
        <motion.div
          key="brand-loader-overlay"
          // pointerEvents en 'none' apenas `show` pasa a false (no recien al
          // desmontar): si la transicion de salida de framer-motion no llega
          // a completarse -pestaña en segundo plano, tab sin foco, o
          // cualquier corte del ciclo de animacion- este div se queda
          // colgado en el DOM, invisible pero a pantalla completa y con
          // z-index por encima de TODO. Sin este cambio se traga cada click
          // / tap de la tienda para siempre: la pagina "se pega" y ninguna
          // tarjeta ni boton vuelve a responder. Con pointer-events:none deja
          // de interceptar clicks aunque el nodo nunca llegue a desmontarse.
          style={
            useBrand
              // Splash de MARCA (primera carga en frío): cubre TODO.
              ? { position: 'fixed', inset: 0, zIndex: 99999, transformOrigin: 'center', pointerEvents: effectiveShow ? 'auto' : 'none' }
              // CÍRCULO (navegación dentro de la app): arranca debajo del
              // header (contentTop) para dejarlo visible; centra el spinner
              // sobre el fondo claro de siempre. Cubre solo el contenido
              // mientras la tienda espera el hero (heroListo) — el header
              // queda intacto y el hero luego entra con su propia transición.
              : {
                  position: 'fixed', top: contentTop, left: 0, right: 0, bottom: 0,
                  zIndex: 99999, transformOrigin: 'center',
                  pointerEvents: effectiveShow ? 'auto' : 'none',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(248,249,250,0.98) 100%)',
                }
          }
          initial={false}
          exit={
            relevo
              ? {}
              // El zoom de salida (scale 1.06, "abrir hacia la tienda") es
              // gesto de MARCA. El círculo solo se funde.
              : (reducedMotion || !useBrand)
                ? { opacity: 0 }
                : { opacity: 0, scale: 1.06 }
          }
          transition={{
            duration: exitDurationMs / 1000,
            ease: EASE_SIGNATURE,
          }}
        >
          {useBrand ? <BrandLoader /> : <Loading />}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
};

export default BrandLoaderOverlay;
