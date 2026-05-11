import React, { useState, useEffect } from 'react';
import { X, Smartphone } from 'lucide-react';
import useIsMobile from '../../../hooks/useIsMobile';
import styles from './AppDownloadBanner.module.css';

const AppDownloadBanner = () => {
  const { isMobileDevice } = useIsMobile();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Solo mostrar si es un dispositivo móvil y si el usuario no lo ha cerrado antes
    const hasClosedBanner = sessionStorage.getItem('wala_app_banner_closed');
    if (isMobileDevice && !hasClosedBanner) {
      setIsVisible(true);
    }
  }, [isMobileDevice]);

  if (!isVisible) return null;

  const handleClose = () => {
    setIsVisible(false);
    sessionStorage.setItem('wala_app_banner_closed', 'true');
  };

  return (
    <div className={styles.banner}>
      <div className={styles.leftContent}>
        <div className={styles.iconWrapper}>
          <Smartphone size={20} color="#fff" />
        </div>
        <div className={styles.textGroup}>
          <p className={styles.title}>Wala App</p>
          <p className={styles.subtitle}>Para una mejor experiencia</p>
        </div>
      </div>
      <div className={styles.rightContent}>
        <a 
          href="https://play.google.com/store/apps/details?id=com.wala.tienda" 
          className={styles.downloadBtn}
          target="_blank"
          rel="noopener noreferrer"
        >
          OBTENER
        </a>
        <button onClick={handleClose} className={styles.closeBtn} aria-label="Cerrar">
          <X size={18} />
        </button>
      </div>
    </div>
  );
};

export default AppDownloadBanner;
