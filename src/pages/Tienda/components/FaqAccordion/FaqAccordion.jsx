import React, { useState } from 'react';
import styles from './FaqAccordion.module.css';

const FaqAccordion = ({ config = {} }) => {
  const items = Array.isArray(config.items) ? config.items : [];
  const [openIdx, setOpenIdx] = useState(config.defaultOpen === false ? -1 : 0);

  if (items.length === 0) return null;

  return (
    <div
      className={styles.root}
      style={{ backgroundColor: config.backgroundColor || 'transparent' }}
    >
      {config.title && <h2 className={styles.title}>{config.title}</h2>}
      <div className={styles.list}>
        {items.map((item, idx) => {
          const isOpen = openIdx === idx;
          return (
            <div key={idx} className={styles.item}>
              <button
                type="button"
                className={styles.question}
                onClick={() => setOpenIdx(isOpen ? -1 : idx)}
                aria-expanded={isOpen}
              >
                <span>{item.question}</span>
                <span className={`${styles.chevron} ${isOpen ? styles.chevronOpen : ''}`}>▼</span>
              </button>
              {isOpen && item.answer && (
                <div className={styles.answer}>
                  <p className={styles.answerInner}>{item.answer}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default FaqAccordion;
