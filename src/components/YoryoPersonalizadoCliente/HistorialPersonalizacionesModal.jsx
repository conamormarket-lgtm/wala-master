import React from 'react';
import styles from './HistorialPersonalizacionesModal.module.css';

export default function HistorialPersonalizacionesModal({ pastDesigns, onSelectDesign, onCreateNew, onClose }) {
  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <h2>Tus Diseños Anteriores</h2>
          <button className={styles.closeBtn} onClick={onClose}>&times;</button>
        </div>

        <div className={styles.body}>
          <p className={styles.subtitle}>
            Tienes personalizaciones previas para este producto. ¿Qué te gustaría hacer?
          </p>

          <button className={styles.createNewBtn} onClick={onCreateNew}>
            ✨ Crear un Diseño Nuevo
          </button>

          <div className={styles.divider}>
            <span>O elige uno de tus diseños anteriores</span>
          </div>

          <div className={styles.grid}>
            {pastDesigns.map((design) => (
              <div key={design.id} className={styles.card}>
                <div className={styles.imageContainer}>
                  <img 
                    src={design.mainImage || design.thumbnailWithDesignUrl || design.variants?.[0]?.designImage || 'https://via.placeholder.com/150'} 
                    alt="Diseño previo" 
                    className={styles.image}
                  />
                </div>
                <div className={styles.cardFooter}>
                  <button className={styles.useBtn} onClick={() => onSelectDesign(design)}>
                    Editar este diseño
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
