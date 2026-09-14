import React, { useCallback, useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import Cropper from 'react-easy-crop';
import styles from './AvatarCropModal.module.css';
import { T } from '../../i18n/useTranslatedText';

// Mismo recorte que ya usa Admin (AdminImageCropper, react-easy-crop) para
// logos/fondos de marca — se reimplementa acá en vez de importar ese
// componente porque el avatar necesita círculo fijo (cropShape="round",
// aspect=1, sin grilla) y una pantalla completa estilo WhatsApp/Instagram
// (barra superior con cerrar/confirmar + imagen grande en el medio) en vez
// de la card chica y centrada de Admin — con una foto real se ve mucho
// mejor para recortar con precisión.
//
// Se monta con un portal a document.body (mismo patrón que
// components/common/Modal) en vez de quedar anidado donde vive AvatarStudio
// -dentro de <Reveal>/<Stagger>, wrappers de framer-motion que aplican un
// transform inline-: un transform en cualquier ancestro convierte a ESE
// ancestro en el "contenedor" de todo lo position:fixed adentro, así que la
// pantalla completa quedaba encerrada en el ancho de la card de identidad en
// vez de cubrir la ventana entera.
const createImage = (url) =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', (error) => reject(error));
    image.setAttribute('crossOrigin', 'anonymous');
    image.src = url;
  });

async function getCroppedBlob(imageSrc, pixelCrop) {
  const image = await createImage(imageSrc);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;
  ctx.drawImage(
    image,
    pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height,
    0, 0, pixelCrop.width, pixelCrop.height
  );

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.92);
  });
}

export default function AvatarCropModal({ imageSrc, onConfirm, onCancel }) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [processing, setProcessing] = useState(false);

  const handleCropComplete = useCallback((_area, pixels) => {
    setCroppedAreaPixels(pixels);
  }, []);

  const handleConfirm = useCallback(async () => {
    if (!croppedAreaPixels || processing) return;
    setProcessing(true);
    try {
      const blob = await getCroppedBlob(imageSrc, croppedAreaPixels);
      if (!blob) throw new Error('No se pudo recortar la imagen');
      onConfirm(blob);
    } catch {
      // El recorte en sí falló (imagen corrupta, canvas bloqueado, etc.) —
      // AvatarStudio ya maneja los errores de SUBIDA por su cuenta; acá solo
      // evitamos quedar con el modal trabado.
      setProcessing(false);
      onCancel();
    }
  }, [imageSrc, croppedAreaPixels, processing, onConfirm, onCancel]);

  // Pantalla completa: bloquea el scroll del body mientras está abierto,
  // mismo criterio que components/common/Modal.
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  const contenido = (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label="Recortar foto de perfil">
      {/* Pantalla completa (patrón WhatsApp/Instagram) en vez de una card
          chica centrada: la imagen se ve mucho más grande para recortar con
          precisión, en vez de apretada en 280px dentro de un modal. */}
      <div className={styles.topBar}>
        <button
          type="button"
          className={styles.closeBtn}
          onClick={onCancel}
          disabled={processing}
          aria-label="Cancelar"
          title="Cancelar"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
        </button>
        <h3 className={styles.title}><T>Recorta tu foto</T></h3>
        <button
          type="button"
          className={styles.doneBtn}
          onClick={handleConfirm}
          disabled={processing || !croppedAreaPixels}
        >
          {processing ? <T>Guardando...</T> : <T>Listo</T>}
        </button>
      </div>

      <div className={styles.cropContainer}>
        <Cropper
          image={imageSrc}
          crop={crop}
          zoom={zoom}
          aspect={1}
          cropShape="round"
          showGrid={false}
          onCropChange={setCrop}
          onCropComplete={handleCropComplete}
          onZoomChange={setZoom}
        />
      </div>

      <div className={styles.bottomBar}>
        <p className={styles.subtitle}><T>Arrastra la imagen y usa el zoom para elegir cómo se va a ver.</T></p>
        <label className={styles.zoomLabel}>
          <T>Zoom</T>
          <input
            type="range"
            min={1}
            max={3}
            step={0.1}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className={styles.slider}
            aria-label="Zoom de la foto"
          />
        </label>
      </div>
    </div>
  );

  return ReactDOM.createPortal(contenido, document.body);
}
