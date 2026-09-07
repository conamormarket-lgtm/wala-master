import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { EASE_SIGNATURE, useReducedMotionSafe } from '../../../theme/motion';
import BrandLoader from './BrandLoader';

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
 */
const BrandLoaderOverlay = ({ show }) => {
  const reducedMotion = useReducedMotionSafe();

  // Bloquea el scroll del documento mientras el loader esta visible: sin
  // esto, el contenido de la tienda (ya renderizado debajo del overlay) hace
  // que la pagina sea alta y aparece una barra de scroll SOBRE la pantalla
  // de carga — se veia raro (una barra que aparecia y desaparecia durante la
  // carga). Se compensa el ancho de la barra con padding-right para que al
  // soltar el bloqueo el contenido no "salte" de lado.
  useEffect(() => {
    if (!show) return undefined;
    const html = document.documentElement;
    const prevOverflow = html.style.overflow;
    const prevPadding = html.style.paddingRight;
    const scrollbarWidth = window.innerWidth - html.clientWidth;
    html.style.overflow = 'hidden';
    if (scrollbarWidth > 0) html.style.paddingRight = `${scrollbarWidth}px`;
    return () => {
      html.style.overflow = prevOverflow;
      html.style.paddingRight = prevPadding;
    };
  }, [show]);

  return createPortal(
    <AnimatePresence initial={false}>
      {show && (
        <motion.div
          key="brand-loader-overlay"
          style={{ position: 'fixed', inset: 0, zIndex: 99999, transformOrigin: 'center' }}
          initial={false}
          exit={
            reducedMotion
              ? { opacity: 0 }
              : { opacity: 0, scale: 1.06 }
          }
          transition={{
            duration: reducedMotion ? 0.3 : 0.6,
            ease: EASE_SIGNATURE,
          }}
        >
          <BrandLoader />
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
};

export default BrandLoaderOverlay;
