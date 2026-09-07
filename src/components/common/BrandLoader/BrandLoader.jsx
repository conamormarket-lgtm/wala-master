import React, { useRef } from 'react';
import { useReducedMotionSafe } from '../../../theme/motion';
import styles from './BrandLoader.module.css';

/** Duraciones de las animaciones, en ms. Deben coincidir con el CSS. */
const CICLO_RESPIRACION = 3200;
const CICLO_BARRA = 1400;

/**
 * Pantalla de carga estilizada del sistema (isotipo del logo en "negativo"
 * — bolsa blanca + W violeta — sobre el degradado de marca).
 *
 * Animación (CSS, ver BrandLoader.module.css). El icono respira y la luz
 * respira CON el.
 *  - El icono flota en un ciclo continuo y calmado (~3.2s, ease-in-out, sin
 *    pausa): sube unos px y escala apenas al 1.05, luego vuelve. Solo escala
 *    + traslada (no deforma ni recolorea).
 *  - Los dos halos detras del icono pulsan EN SINCRONIA con esa respiracion
 *    (mismo 3.2s / mismo ease): mas brillo y algo mas grandes justo cuando el
 *    icono llega arriba, de modo que la luz "acompaña" el gesto en vez de
 *    quedarse quieta. Tenue a proposito para que se lea como luz que respira y
 *    no como destellos.
 *  - Una barra de progreso indeterminada con brillo suave: comunica "algo
 *    esta pasando" sin fingir un porcentaje real.
 *
 * POR QUE EN CSS Y NO EN framer-motion: este loader se muestra JUSTO mientras
 * React monta la tienda entera. framer-motion recalcula los estilos en cada
 * fotograma desde el hilo principal, que en ese momento esta saturado, asi
 * que la animacion se congelaba un rato y al liberarse pegaba un salto — se
 * veia como si la carga se trabara y volviera a empezar. En CSS, transform y
 * opacity los anima el compositor en su propio hilo y siguen fluidas por muy
 * ocupado que este React.
 *
 * Los elementos NO tienen animacion de ENTRADA (aparecen ya en su estado
 * final): asi el relevo desde el splash estatico de index.html — que muestra
 * el MISMO lockup con los MISMOS numeros — es invisible. La animacion de
 * SALIDA (al terminar la carga) vive en BrandLoaderOverlay.jsx.
 *
 * Respeta prefers-reduced-motion: las animaciones se apagan en el propio CSS
 * y aqui solo se usa el hook para cambiar la barra por un trazo estatico.
 *
 * @param {'fill'|'inline'} variant  'fill' = llena el alto de su contenedor,
 *   'inline' = alto fijo mas chico para usar suelto dentro de un layout.
 *   OJO: 'fill' se dimensiona con height:100%, asi que necesita un contenedor
 *   con alto definido. Para pantalla completa usa BrandLoaderOverlay, que lo
 *   monta dentro de un position:fixed inset:0.
 */
const BrandLoader = ({ variant = 'fill' }) => {
  const reducedMotion = useReducedMotionSafe();

  // FASE COMPARTIDA. Durante una carga se muestran DOS loaders seguidos: el de
  // la landing y, en cuanto monta, el de la tienda. Son instancias distintas,
  // asi que el segundo arrancaba su ciclo desde cero y el icono pegaba un salto
  // — se veia como si la carga volviera a empezar.
  // Con un animation-delay NEGATIVO calculado desde el reloj de la pagina, cada
  // instancia entra en el punto del ciclo en el que ya iba la anterior, y el
  // relevo no se nota. Se calcula una sola vez por montaje (useRef), no en cada
  // render, o el icono saltaria en cada re-render.
  const faseRef = useRef(null);
  if (faseRef.current === null) {
    const ahora = typeof performance !== 'undefined' ? performance.now() : 0;
    faseRef.current = {
      respiracion: `-${Math.round(ahora % CICLO_RESPIRACION)}ms`,
      barra: `-${Math.round(ahora % CICLO_BARRA)}ms`,
    };
  }
  const fase = faseRef.current;

  return (
    <div
      className={`${styles.loader} ${variant === 'inline' ? styles.inline : styles.fill}`}
      role="status"
      aria-label="Cargando"
    >
      <div className={styles.stack}>
        <div className={styles.markWrap}>
          {/* Resplandor detras del icono (dos capas radiales para dar
              profundidad). Pulsan en sincronia con la respiracion del icono:
              mas brillo y algo mas grandes cuando el icono llega arriba.
              Tenue a proposito: es luz que respira, no destellos. */}
          <span className={styles.haloWide} aria-hidden="true" style={{ animationDelay: fase.respiracion }} />
          <span className={styles.halo} aria-hidden="true" style={{ animationDelay: fase.respiracion }} />

          <svg
            viewBox="12 0 94 109"
            className={styles.mark}
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
            style={{ animationDelay: fase.respiracion }}
          >
            <defs>
              {/* Mismo degradado de marca que el logo real del Header
                  (walaGradient: #8B5CF6 -> #5B21B6 en diagonal). Id propio
                  ('walaLoaderGrad') para no colisionar con el id del Header,
                  que puede estar en el DOM a la vez detras del overlay. */}
              <linearGradient id="walaLoaderGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#8B5CF6" />
                <stop offset="100%" stopColor="#5B21B6" />
              </linearGradient>
            </defs>
            <path
              d="M 32 42 L 28 88 C 27 92 30 94 34 93 L 85 80 C 89 79 91 76 89 72 L 76 18 C 75 13 68 11 65 14 L 36 34 C 32 37 31 40 32 42 Z"
              fill="#FFFFFF"
            />
            <circle cx="67" cy="23" r="6.5" fill="#8B5CF6" />
            {/* La W en el degradado de marca, para que combine con el logo
                real de la tienda. Se escala al 0.8 sobre su centro (55,58)
                para dejar aire con el borde blanco de la bolsa. */}
            <path
              d="M 38 42 L 43 78 L 54 52 L 64 72 L 72 38"
              fill="none"
              stroke="url(#walaLoaderGrad)"
              strokeWidth="15"
              strokeLinecap="round"
              strokeLinejoin="round"
              transform="translate(55 58) scale(0.8) translate(-55 -58)"
            />
          </svg>
        </div>

        <span className={styles.wordmark}>Walá</span>

        <div className={styles.progressTrack} aria-hidden="true">
          {reducedMotion ? (
            <span className={styles.progressStatic} />
          ) : (
            <span className={styles.progressBar} style={{ animationDelay: fase.barra }} />
          )}
        </div>
      </div>
    </div>
  );
};

export default BrandLoader;
