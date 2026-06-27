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

  // Mapa de forma del marco → clase CSS (clip-path). Retrocompatible:
  // si el item no trae shape (items viejos), usamos 'circle' por defecto.
  const shapeClassMap = {
    circle: styles.shapeCircle,
    square: styles.shapeSquare,
    star: styles.shapeStar,
    pentagon: styles.shapePentagon,
  };

  // Renderiza el contenido (logo con forma + nombre) de un item.
  const renderContent = (item) => {
    // Forma del marco (default 'circle' para items sin shape).
    const shape = item.shape || 'circle';
    const shapeClass = shapeClassMap[shape] || styles.shapeCircle;

    // Zoom y posición manual de la imagen dentro del marco.
    // Retrocompatible: si no vienen, zoom=1 y posición centrada 50/50.
    const zoom = item.zoom != null ? item.zoom : 1;
    const posX = item.posX != null ? item.posX : 50;
    const posY = item.posY != null ? item.posY : 50;

    // El zoom/posición son dinámicos por item → estilos inline.
    // object-fit:cover lo aporta la clase .brandImage del module.css.
    const imageStyle = {
      transform: `scale(${zoom})`,
      objectPosition: `${posX}% ${posY}%`,
    };

    return (
      <>
        {/* Marco: la clase de forma aplica el clip-path correspondiente */}
        <div className={`${styles.logoCircle} ${shapeClass}`}>
          <img
            src={item.imageUrl}
            alt={item.name}
            className={styles.brandImage}
            style={imageStyle}
          />
        </div>
        {item.name && (
          <span className={styles.brandName}>{item.name}</span>
        )}
      </>
    );
  };

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
