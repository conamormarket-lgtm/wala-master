import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import styles from './ComboProductImage.module.css';

/**
 * Flechas prev/next sobre la fila de piezas del conjunto. Se colocan dentro
 * de un wrapper `position: relative` que envuelve SOLO la fila (no los
 * puntos, que van debajo en flujo normal).
 */
export const ComboNavArrows = ({ atStart, atEnd, onPrev, onNext }) => (
  <>
    {!atStart && (
      <button
        type="button"
        className={`${styles.navArrow} ${styles.navArrowLeft}`}
        onClick={onPrev}
        aria-label="Pieza anterior"
      >
        <ChevronLeft size={18} strokeWidth={2.5} />
      </button>
    )}
    {!atEnd && (
      <button
        type="button"
        className={`${styles.navArrow} ${styles.navArrowRight}`}
        onClick={onNext}
        aria-label="Siguiente pieza"
      >
        <ChevronRight size={18} strokeWidth={2.5} />
      </button>
    )}
  </>
);

/**
 * Puntos de posición ("1 de 3"), clicables para saltar directo a esa pieza.
 */
export const ComboNavDots = ({ itemCount, index, onDot }) => (
  <div className={styles.navDots} role="tablist" aria-label="Piezas del conjunto">
    {Array.from({ length: itemCount }).map((_, i) => (
      <button
        key={i}
        type="button"
        role="tab"
        aria-selected={i === index}
        aria-label={`Ver pieza ${i + 1} de ${itemCount}`}
        className={`${styles.navDot} ${i === index ? styles.navDotActive : ''}`}
        onClick={() => onDot(i)}
      />
    ))}
  </div>
);
