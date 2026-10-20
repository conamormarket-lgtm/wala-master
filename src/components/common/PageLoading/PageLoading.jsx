import React from 'react';
import { useTexto } from '../../../componentes/kit/Traduccion';
import styles from './PageLoading.module.css';

/**
 * PageLoading — Skeleton profesional para el fallback de Suspense.
 * Simula la estructura de la página mientras carga, sin spinner lento.
 */
const PageLoading = () => {
  const cargando = useTexto('Cargando página');
  return (
    <div className={styles.wrapper} aria-busy="true" aria-label={cargando}>
      <div className={styles.skeletonPage}>
        {/* Simula una fila de tarjetas de producto */}
        <div className={styles.skeletonGrid}>
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className={styles.skeletonCard}>
              <div className={styles.skeletonImage} />
              <div className={styles.skeletonLine} style={{ width: '75%' }} />
              <div className={styles.skeletonLine} style={{ width: '45%' }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PageLoading;
