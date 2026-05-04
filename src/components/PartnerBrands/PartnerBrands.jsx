import React from 'react';
import styles from './PartnerBrands.module.css';

const PartnerBrands = () => {
  return (
    <div className={styles.partnerContainer} title="Nuestras marcas">
      <p className={styles.partnerTitle}>Nuestras marcas</p>
      <div className={styles.partnerLogos}>
        <div 
          className={styles.brandLogoWrapper} 
          title="Con Amor"
          style={{ backgroundColor: '#ffffff' }}
        >
          <img 
            src="/marcas/con-amor.png" 
            alt="Con Amor" 
            onError={(e) => { e.target.style.display = 'none'; }}
          />
        </div>
        <div 
          className={styles.brandLogoWrapper} 
          title="Catas"
          style={{ backgroundColor: '#000000' }}
        >
          <img 
            src="/marcas/catas.png" 
            alt="Catas" 
            onError={(e) => { e.target.style.display = 'none'; }}
          />
        </div>
      </div>
    </div>
  );
};

export default PartnerBrands;
