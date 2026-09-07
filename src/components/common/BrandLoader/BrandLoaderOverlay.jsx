import React, { useEffect, useRef } from 'react';
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
 * @param {boolean} [relevo]  true = este overlay NO es el ultimo: al ocultarse
 *   hay OTRO loader identico detras que sigue la carga (es el caso de la
 *   landing, que releva a la tienda). Entonces se desmonta en seco, sin la
 *   animacion de salida: si se fundiera con zoom, se veria un loader
 *   desvaneciendose ENCIMA de otro loader igual — el "parpadeo" de la carga.
 *   La animacion de salida se reserva para el ultimo, que es el que de verdad
 *   abre hacia la tienda.
 */
const BrandLoaderOverlay = ({ show, relevo = false }) => {
  const reducedMotion = useReducedMotionSafe();

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
    if (show) lockScroll();
    // Ojo: NO desbloqueamos cuando show pasa a false — eso lo hace
    // onExitComplete, cuando el zoom de salida ya termino (ver comentario
    // arriba). Aqui solo bloqueamos al entrar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show]);

  // Seguridad: si el overlay se desmonta por completo estando bloqueado
  // (p.ej. cambio de ruta a mitad de la salida), restauramos el scroll.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => () => unlockScroll(), []);

  return createPortal(
    <AnimatePresence initial={false} onExitComplete={unlockScroll}>
      {show && (
        <motion.div
          key="brand-loader-overlay"
          style={{ position: 'fixed', inset: 0, zIndex: 99999, transformOrigin: 'center' }}
          initial={false}
          exit={
            relevo
              ? {}
              : reducedMotion
                ? { opacity: 0 }
                : { opacity: 0, scale: 1.06 }
          }
          transition={{
            duration: relevo ? 0 : (reducedMotion ? 0.3 : 0.6),
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
