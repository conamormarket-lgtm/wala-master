import React, { useState, useEffect } from 'react';
import { X, Smartphone } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import useIsMobile from '../../../hooks/useIsMobile';
import styles from './AppDownloadBanner.module.css';

const AppDownloadBanner = () => {
  const { isMobileDevice } = useIsMobile();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Solo mostrar si es un dispositivo móvil y NO estamos dentro de la app nativa
    if (isMobileDevice && !Capacitor.isNativePlatform()) {
      setIsVisible(true);
    }
  }, [isMobileDevice]);

  if (!isVisible) return null;

  const handleClose = () => {
    setIsVisible(false);
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
        <button 
          onClick={() => {
            window.location.href = 'market://details?id=com.wala.tienda';
            setTimeout(() => {
              window.location.replace('https://play.google.com/store/apps/details?id=com.wala.tienda');
            }, 1000);
          }}
          className={styles.downloadBtn}
        >
          OBTENER
        </button>
        <button onClick={handleClose} className={styles.closeBtn} aria-label="Cerrar">
          <X size={18} />
        </button>
      </div>
    </div>
  );
};

export default AppDownloadBanner;
