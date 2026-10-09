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

          {/* Etiqueta del logo OFICIAL (public/logo-wala.png): con su cordón y
              la W calada (por la W se ve el violeta del fondo). Antes era una
              bolsa dibujada a mano. Imagen blanca con transparencia,
              public/assets/marca/splash-etiqueta.webp (~9 KB). */}
          <img
            src="/assets/marca/splash-etiqueta.webp"
            width={246}
            height={330}
            alt=""
            className={styles.mark}
            aria-hidden="true"
            draggable={false}
            style={{ animationDelay: fase.respiracion }}
          />
        </div>

        {/* "WALÁ" del logo oficial: letra redondeada y la etiquetita que hace
            de tilde (antes: "Walá" escrito en Poppins). */}
        <img
          src="/assets/marca/splash-wala.webp"
          width={368}
          height={160}
          alt="Walá"
          className={styles.wordmark}
          draggable={false}
        />

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
