import React, { useCallback, useState } from 'react';
import Cropper from 'react-easy-crop';
import styles from './AvatarCropModal.module.css';
import { T } from '../../i18n/useTranslatedText';

// Mismo recorte que ya usa Admin (AdminImageCropper, react-easy-crop) para
// logos/fondos de marca — se reimplementa acá en vez de importar ese
// componente porque el avatar necesita círculo fijo (cropShape="round",
// aspect=1, sin grilla) y el look del sitio (violeta #8b5cf6 + tokens
// --gris-/--blanco), en vez de los botones y el modal planos de Admin.
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

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label="Recortar foto de perfil">
      <div className={styles.modal}>
        <h3 className={styles.title}><T>Recorta tu foto</T></h3>
        <p className={styles.subtitle}><T>Arrastra la imagen y usa el zoom para elegir cómo se va a ver.</T></p>

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

        <div className={styles.actions}>
          <button type="button" className={styles.btnCancel} onClick={onCancel} disabled={processing}>
            <T>Cancelar</T>
          </button>
          <button type="button" className={styles.btnConfirm} onClick={handleConfirm} disabled={processing || !croppedAreaPixels}>
            {processing ? <T>Guardando...</T> : <T>Usar esta foto</T>}
          </button>
        </div>
      </div>
    </div>
  );
}
