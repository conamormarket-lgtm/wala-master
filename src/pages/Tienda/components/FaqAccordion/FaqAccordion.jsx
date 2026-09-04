import React, { useId, useState } from 'react';
import styles from './FaqAccordion.module.css';
import { TextoSeccion } from '../textStyleUtils.jsx';

const FaqAccordion = ({ config = {} }) => {
  const items = Array.isArray(config.items) ? config.items : [];
  const [openIdx, setOpenIdx] = useState(config.defaultOpen === true ? 0 : -1);
  const accordionId = useId();

  if (items.length === 0) return null;

  return (
    <div
      className={`${styles.root} ${config.layout === 'top' ? styles.topLayout : ''}`}
      style={{
        backgroundColor: config.backgroundColor || 'transparent',
        // Solo se fija inline si el admin lo configuro explicitamente: un
        // estilo inline SIEMPRE gana sobre la clase CSS, asi que forzar aqui
        // un '1rem' por defecto tapaba el padding-top/bottom de .root
        // (--section-gap) y la seccion quedaba pegada al footer sin que se
        // notara por que. Sin valor configurado, manda el CSS del componente.
        ...(config.paddingTop ? { paddingTop: config.paddingTop } : {}),
        ...(config.paddingBottom ? { paddingBottom: config.paddingBottom } : {}),
      }}
    >
      <div className={styles.layout}>
        <div className={styles.heading}>
          {config.title && (
            <TextoSeccion settings={config} prefix="title" as="h2" className={styles.title}>
              {config.title}
            </TextoSeccion>
          )}
          {config.subtitle && <p className={styles.subtitle}>{config.subtitle}</p>}
        </div>
        <div className={styles.list}>
          {items.map((item, idx) => {
            const isOpen = openIdx === idx;
            const answerId = `${accordionId}-answer-${idx}`;
            return (
              <div key={item.id || idx} className={styles.item}>
                <button
                  type="button"
                  className={styles.question}
                  onClick={() => setOpenIdx(isOpen ? -1 : idx)}
                  aria-expanded={isOpen}
                  aria-controls={answerId}
                >
                  <span>{item.question}</span>
                  <span className={`${styles.chevron} ${isOpen ? styles.chevronOpen : ''}`} aria-hidden="true">+</span>
                </button>
                {item.answer && (
                  <div
                    id={answerId}
                    className={`${styles.answerWrap} ${isOpen ? styles.open : ''}`}
                    aria-hidden={!isOpen}
                  >
                    <div className={styles.answerClip}>
                      <div className={styles.answer}>
                        <p className={styles.answerInner}>{item.answer}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default FaqAccordion;
