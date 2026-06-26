import React from 'react';
import { Link } from 'react-router-dom';
import OptimizedImage from '../../../../components/common/OptimizedImage/OptimizedImage';
import { GlassCard, Stagger, StaggerItem } from '../../../../components/ui';
import styles from './BestSellersRow.module.css';

const BestSellersRow = ({ cards = [] }) => {
  if (!cards || cards.length === 0) return null;

  // Cuerpo común de la tarjeta (imagen + textos). No cambia datos ni enlaces:
  // se reutiliza tanto en la variante con link como sin él.
  const renderBody = (card) => (
    <>
      <div className={styles.imageWrapper}>
        {card.imageUrl ? (
          <OptimizedImage
            src={card.imageUrl}
            alt={card.title || 'Destacado'}
            className={styles.image}
            showSkeleton={true}
          />
        ) : (
          <div className={styles.placeholder}></div>
        )}
      </div>
      <div className={styles.content}>
        {card.title && <h3 className={styles.title}>{card.title}</h3>}
        {card.subtitle && <p className={styles.subtitle}>{card.subtitle}</p>}
      </div>
    </>
  );

  return (
    <div className={styles.container}>
      {/* El grid ES el Stagger: sigue siendo un flex div (motion.div), mismo
          layout — solo orquesta la cascada de entrada de sus hijos una vez. */}
      <Stagger className={styles.grid}>
        {cards.map((card, index) => (
          // Cada tarjeta entra como StaggerItem (motion a nivel de tarjeta, sin
          // envolver/alterar el contenedor del grid) con acabado glass suave.
          <StaggerItem key={card.id || index} className={styles.card}>
            <GlassCard
              variant="soft"
              padding="sm"
              hover
              animate={false}
              className={styles.glassCard}
              bodyClassName={styles.glassBody}
            >
              {card.link ? (
                <Link to={card.link} className={styles.link}>
                  {renderBody(card)}
                </Link>
              ) : (
                <div className={styles.link}>{renderBody(card)}</div>
              )}
            </GlassCard>
          </StaggerItem>
        ))}
      </Stagger>
    </div>
  );
};

export default BestSellersRow;
