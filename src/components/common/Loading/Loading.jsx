import React from 'react';
import { createPortal } from 'react-dom';
import styles from './Loading.module.css';

/**
 * @param {boolean} [portal] Solo con fullScreen: monta el overlay por portal a
 *   document.body en vez de en su lugar en el árbol. Sirve para que cubra TODA
 *   la pantalla (incluido el header): renderizado in situ, un ancestro con
 *   contexto de apilamiento/containing block lo confina y queda por DEBAJO del
 *   header. Al salir a body escapa de todos esos ancestros y tapa el viewport
 *   entero. NO lo usa el círculo interno de BrandLoaderOverlay (ese ya vive
 *   dentro de su propio portal animado; portarlo otra vez lo sacaría de la
 *   animación de salida).
 */
const Loading = ({ size = 'medium', fullScreen = false, message, portal = false }) => {
  const sizeClass = styles[size] || styles.medium;

  if (fullScreen) {
    const overlay = (
      <div className={styles.fullScreen}>
        <div className={`${styles.spinner} ${sizeClass}`}></div>
        {message && <p className={styles.message}>{message}</p>}
      </div>
    );
    return portal && typeof document !== 'undefined'
      ? createPortal(overlay, document.body)
      : overlay;
  }

  return <div className={`${styles.spinner} ${sizeClass}`}></div>;
};

export default Loading;
