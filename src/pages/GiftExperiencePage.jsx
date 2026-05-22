import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getOrderGiftDetails } from '../services/erp/firebase';
import styles from './GiftExperiencePage.module.css';

const GiftExperiencePage = () => {
  const { orderId } = useParams();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [giftData, setGiftData] = useState(null);
  const [isOpen, setIsOpen] = useState(false);
  
  // Detectar si está en la app nativa o en navegador web
  const isNativeApp = window.Capacitor && window.Capacitor.isNativePlatform();

  useEffect(() => {
    const fetchGift = async () => {
      setLoading(true);
      const { data, error: fetchErr } = await getOrderGiftDetails(orderId);
      if (fetchErr || !data) {
        setError('No pudimos encontrar este regalo. Tal vez el enlace es incorrecto.');
      } else {
        setGiftData(data);
      }
      setLoading(false);
    };

    if (orderId) {
      fetchGift();
    }
  }, [orderId]);

  const handleOpenGift = () => {
    if (!isOpen) {
      setIsOpen(true);
    }
  };

  const handleDownloadApp = () => {
    // Redirigir a la landing de descarga o abrir la tienda
    window.location.href = 'https://wala.pe/descargar';
  };

  const handleGoToStore = () => {
    navigate('/tienda');
  };

  if (loading) {
    return (
      <div className={styles.pageContainer}>
        <div className={styles.loading}>Preparando tu sorpresa...</div>
      </div>
    );
  }

  if (error || !giftData) {
    return (
      <div className={styles.pageContainer}>
        <div className={styles.error}>{error}</div>
        <button className={styles.downloadBtn} onClick={handleGoToStore} style={{ marginTop: '2rem' }}>
          Ir a la tienda
        </button>
      </div>
    );
  }

  const stickerEmoji = giftData.sticker === 'kapi-party' ? '🎉' : 
                       giftData.sticker === 'kapi-smile' ? '😊' : '😍';

  return (
    <div className={styles.pageContainer}>
      <div className={`${styles.scene} ${isOpen ? styles.open : ''}`}>
        
        {/* Kapi dibujado en CSS */}
        <div className={styles.kapiContainer}>
          <div className={styles.kapiEars}>
            <div className={styles.earLeft}></div>
            <div className={styles.earRight}></div>
          </div>
          <div className={styles.kapiBody}></div>
          <div className={styles.kapiFace}>
            <div className={styles.eyeLeft}></div>
            <div className={styles.eyeRight}></div>
            <div className={styles.nose}></div>
          </div>
          <div className={styles.sticker}>{stickerEmoji}</div>
        </div>

        {/* Sobre y Tarjeta */}
        <div className={styles.envelopeWrapper} onClick={handleOpenGift}>
          <div className={styles.envelopeFlap}></div>
          <div className={styles.envelopeFront}></div>
          <div className={styles.instruction}>¡Toca para abrir!</div>
          
          <div className={styles.card}>
            <div className={styles.recipientName}>
              Para: {giftData.recipientName}
            </div>
            <div className={styles.message}>
              "{giftData.message}"
            </div>
          </div>
        </div>
      </div>

      {isOpen && (
        <div className={styles.ctaContainer}>
          {!isNativeApp ? (
            <>
              <div className={styles.ctaText}>
                Alguien te regaló algo especial. Descarga Walá para ver más y regalar tú también.
              </div>
              <button className={styles.downloadBtn} onClick={handleDownloadApp}>
                Descargar Walá
              </button>
            </>
          ) : (
            <>
              <div className={styles.ctaText}>
                ¡Bienvenido a Walá! Explora nuestra tienda para ver tu regalo o enviar uno tú mismo.
              </div>
              <button className={styles.downloadBtn} onClick={handleGoToStore}>
                Explorar Tienda
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default GiftExperiencePage;
