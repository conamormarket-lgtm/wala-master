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
        paddingTop: config.paddingTop || '1rem',
        paddingBottom: config.paddingBottom || '1rem'
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
                {isOpen && item.answer && (
                  <div id={answerId} className={styles.answer}>
                    <p className={styles.answerInner}>{item.answer}</p>
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
