import React, { useState } from 'react';
import styles from './AccordionSection.module.css';

const AccordionSection = ({ title, defaultExpanded = false, children, icon, headerLeft, headerExtra }) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const handleHeaderClick = (e) => {
    if (e.target.closest('[data-accordion-no-toggle]')) return;
    setIsExpanded((prev) => !prev);
  };

  const handleKeyDown = (e) => {
    if (e.target.closest('[data-accordion-no-toggle]')) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setIsExpanded((prev) => !prev);
    }
  };

  return (
    <div className={styles.accordion}>
      <div
        role="button"
        tabIndex={0}
        className={styles.header}
        onClick={handleHeaderClick}
        onKeyDown={handleKeyDown}
        aria-expanded={isExpanded}
      >
        <div className={styles.headerContent}>
          {headerLeft != null && (
            <span className={styles.headerLeft} data-accordion-no-toggle onClick={(e) => e.stopPropagation()}>
              {headerLeft}
            </span>
          )}
          {icon && <span className={styles.icon}>{icon}</span>}
          <h3 className={styles.title}>{title}</h3>
          {headerExtra && (
            <span className={styles.headerExtra} data-accordion-no-toggle onClick={(e) => e.stopPropagation()}>
              {headerExtra}
            </span>
          )}
        </div>
        <span className={`${styles.chevron} ${isExpanded ? styles.expanded : ''}`}>
          ▼
        </span>
      </div>
      <div className={`${styles.content} ${isExpanded ? styles.expanded : ''}`}>
        <div className={styles.contentInner}>
          {children}
        </div>
      </div>
    </div>
  );
};

export default AccordionSection;
