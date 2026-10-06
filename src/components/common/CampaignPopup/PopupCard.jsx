// Tarjeta visual de un popup de campaña. Solo presentación: la usan el
// controlador de la tienda (CampaignPopup) y la vista previa del admin.
//
// Dos formatos:
//   - 'tarjeta': imagen opcional + título + texto + botón.
//   - 'imagen': solo la imagen (ya trae su propio texto) y TODA ella es el botón.
import React, { useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { X } from 'lucide-react';
import styles from './CampaignPopup.module.css';

const PopupCard = ({ popup, onCta, onClose }) => {
  // El foco inicial va a la ventana (no al botón): así el navegador no dibuja
  // el contorno de foco sobre la imagen al abrir, y Tab sigue funcionando.
  const dialogoRef = useRef(null);
  const soloImagen = popup.formato === 'imagen' && popup.imagenUrl;

  useEffect(() => {
    const anterior = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialogoRef.current?.focus({ preventScroll: true });
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
  const cerrar = (
    <button type="button" className={styles.cerrar} onClick={onClose} aria-label="Cerrar">
      <X size={18} />
    </button>
  );

  if (soloImagen) {
    return ReactDOM.createPortal(
      <div className={`${styles.overlay} ${styles.overlayImagen}`} onClick={onClose}>
        <div
          className={styles.cardImagen}
          ref={dialogoRef}
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          aria-label={popup.titulo || 'Anuncio'}
          onClick={(e) => e.stopPropagation()}
        >
          {cerrar}
          <button type="button" className={styles.imagenBoton} onClick={onCta}>
            <img src={popup.imagenUrl} alt={popup.titulo || ''} />
          </button>
        </div>
      </div>,
      document.body,
    );
  }

  return ReactDOM.createPortal(
    <div className={styles.overlay} onClick={onClose}>
      <div
        className={styles.card}
        ref={dialogoRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={tituloId}
        onClick={(e) => e.stopPropagation()}
      >
        {cerrar}
        {popup.imagenUrl && (
          <div className={styles.imagen}>
            <img src={popup.imagenUrl} alt="" />
          </div>
        )}
        <div className={styles.cuerpo}>
          <h2 id={tituloId} className={styles.titulo}>{popup.titulo}</h2>
          {popup.texto && <p className={styles.texto}>{popup.texto}</p>}
          <div className={styles.acciones}>
            <button type="button" className={styles.cta} onClick={onCta}>
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
