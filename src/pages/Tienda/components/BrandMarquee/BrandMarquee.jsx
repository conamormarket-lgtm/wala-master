import React from 'react';
import styles from './BrandMarquee.module.css';

const BrandMarquee = () => {
  const marcasUnicas = [
    'wala 900x900.png',
    '../familia.png',
    '../geek.png',
    '../deporte.png'
  ];

  const multiplicador = 100; // Multiplicamos para crear la cinta infinita
  const totalItems = marcasUnicas.length * multiplicador;

  // 1.25 segundos por cada ítem generado para mantener la misma velocidad siempre
  const duracionAnimacion = totalItems * 1.25;

  return (
    <div className={styles.mainContainer}>
      {/* Título Estilo Píldora Gris */}
      <div className={styles.brandsTitle}>
        <span className={styles.brandsTitleSpan}>
          Empresas con las que trabajamos
        </span>
      </div>

      {/* Carrusel Deslizable Infinito */}
      <div className={styles.marqueeContainer}>
        <div className={styles.marqueeTrack} style={{ animationDuration: `${duracionAnimacion}s` }}>
          {Array(multiplicador).fill(marcasUnicas).flat().map((imagen, index) => (
            <div key={index} className={styles.logoCircleWrapper}>
              <div className={styles.logoCircle}>
                <img
                  src={`${process.env.PUBLIC_URL}/diseno/${imagen}`}
                  alt={`Logo Empresa ${index}`}
                  className={styles.brandImage}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default BrandMarquee;

