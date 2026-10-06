// Tarjeta visual de un popup de campaña. Solo presentación: la usan el
// controlador de la tienda (CampaignPopup) y la vista previa del admin.
import React, { useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { X } from 'lucide-react';
import styles from './CampaignPopup.module.css';

const PopupCard = ({ popup, onCta, onClose }) => {
  const ctaRef = useRef(null);

  useEffect(() => {
    const anterior = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    ctaRef.current?.focus({ preventScroll: true });
    const alTeclear = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', alTeclear);
    return () => {
      document.body.style.overflow = anterior;
      window.removeEventListener('keydown', alTeclear);
    };
  }, [onClose]);

  const tituloId = `popup-titulo-${popup.id || 'preview'}`;

  return ReactDOM.createPortal(
    <div className={styles.overlay} onClick={onClose}>
      <div
        className={styles.card}
        role="dialog"
        aria-modal="true"
        aria-labelledby={tituloId}
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className={styles.cerrar} onClick={onClose} aria-label="Cerrar">
          <X size={18} />
        </button>
        {popup.imagenUrl && (
          <div className={styles.imagen}>
            <img src={popup.imagenUrl} alt="" />
          </div>
        )}
        <div className={styles.cuerpo}>
          <h2 id={tituloId} className={styles.titulo}>{popup.titulo}</h2>
          {popup.texto && <p className={styles.texto}>{popup.texto}</p>}
          <div className={styles.acciones}>
            <button ref={ctaRef} type="button" className={styles.cta} onClick={onCta}>
              {popup.botonTexto || 'Continuar'}
            </button>
            {popup.cerrarTexto && (
              <button type="button" className={styles.secundario} onClick={onClose}>
                {popup.cerrarTexto}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default PopupCard;
