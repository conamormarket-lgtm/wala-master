import React, { useState, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Smartphone } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import useIsMobile from '../../../hooks/useIsMobile';
import styles from './AppDownloadBanner.module.css';
import { T } from '../../../i18n/useTranslatedText';

const AppDownloadBanner = () => {
  const { isMobileDevice } = useIsMobile();
  const [isVisible, setIsVisible] = useState(false);
  // El componente se monta dentro de TiendaPage (misma condición de siempre:
  // !isLandingPage && !categoryId && !searchTerm), pero se pinta ANTES del
  // Header vía portal — ver #app-top-banner-slot en App.jsx. useLayoutEffect
  // (no useEffect) para engancharlo antes del paint y evitar un parpadeo
  // sin banner en el primer frame.
  const [portalTarget, setPortalTarget] = useState(null);

  useEffect(() => {
    // Solo mostrar si es un dispositivo móvil y NO estamos dentro de la app nativa
    if (isMobileDevice && !Capacitor.isNativePlatform()) {
      setIsVisible(true);
    }
  }, [isMobileDevice]);

  useLayoutEffect(() => {
    setPortalTarget(document.getElementById('app-top-banner-slot'));
  }, []);

  if (!isVisible || !portalTarget) return null;

  const handleClose = () => {
    setIsVisible(false);
  };

  return createPortal((
    <div className={styles.banner}>
      <div className={styles.leftContent}>
        <div className={styles.iconWrapper}>
          <Smartphone size={20} color="#fff" />
        </div>
        <div className={styles.textGroup}>
          <p className={styles.title}>Wala App</p>
          <p className={styles.subtitle}><T>Para una mejor experiencia</T></p>
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
  ), portalTarget);
};

export default AppDownloadBanner;
