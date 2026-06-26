import React from 'react';
import { Link } from 'react-router-dom';
import { AuroraBackground, Reveal } from '../../../../components/ui';
import styles from './BrandMarquee.module.css';

const BrandMarquee = ({ items = [], speed = 15, title = 'Empresas con las que trabajamos' }) => {
  // Si no hay items, no renderizamos nada.
  if (!items || items.length === 0) {
    return null;
  }

  // Duplicamos la lista una vez para lograr el loop continuo.
  // El keyframe usa translateX(-50%), por lo que la pista debe contener
  // exactamente dos copias de la lista para un desplazamiento sin saltos.
  const loopItems = [...items, ...items];

  // Renderiza el contenido (logo circular + nombre) de un item.
  const renderContent = (item) => (
    <>
      <div className={styles.logoCircle}>
        <img
          src={item.imageUrl}
          alt={item.name}
          className={styles.brandImage}
        />
      </div>
      {item.name && (
        <span className={styles.brandName}>{item.name}</span>
      )}
    </>
  );

  return (
    // Reveal a nivel del CONTENEDOR (no del track): la cascada de entrada del
    // bloque no interfiere con la animación/pausa infinita del marquee interno.
    <Reveal className={styles.mainContainer}>
      {/* Aurora MUY suave detrás de todo el bloque; decorativa, no afecta a los
          logos ni intercepta gestos (el componente ya va con z-index -1). */}
      <AuroraBackground variant="subtle" className={styles.aurora} intensity={0.3} />

      {/* Título Estilo Píldora Gris (oculto si title es '' o null) */}
      {title && (
        <div className={styles.brandsTitle}>
          <span className={styles.brandsTitleSpan}>
            {title}
          </span>
        </div>
      )}

      {/* Carrusel Deslizable Infinito */}
      <div className={styles.marqueeContainer}>
        <div
          className={styles.marqueeTrack}
          style={{ animationDuration: `${speed}s` }}
        >
          {loopItems.map((item, index) => {
            const content = renderContent(item);
            const link = item.link;

            let inner;
            if (link && typeof link === 'string' && link.startsWith('/')) {
              // Enlace interno → React Router
              inner = (
                <Link to={link} className={styles.brandLink}>
                  {content}
                </Link>
              );
            } else if (link) {
              // Enlace externo → anchor normal
              inner = (
                <a
                  href={link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.brandLink}
                >
                  {content}
                </a>
              );
            } else {
              // Sin enlace
              inner = content;
            }

            return (
              <div key={index} className={styles.logoCircleWrapper}>
                {inner}
              </div>
            );
          })}
        </div>
      </div>
    </Reveal>
  );
};

export default BrandMarquee;
