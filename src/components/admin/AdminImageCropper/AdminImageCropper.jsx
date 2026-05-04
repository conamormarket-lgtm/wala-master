import React, { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import Button from '../../common/Button';
import styles from './AdminImageCropper.module.css';

const createImage = (url) =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', (error) => reject(error));
    image.setAttribute('crossOrigin', 'anonymous');
    image.src = url;
  });

async function getCroppedImg(imageSrc, pixelCrop) {
  const image = await createImage(imageSrc);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (!ctx) return null;

  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height
  );

  return new Promise((resolve) => {
    canvas.toBlob((file) => {
      resolve(file);
    }, 'image/jpeg', 0.95);
  });
}

function AdminImageCropper({ imageSrc, onCropComplete, onCancel }) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [processing, setProcessing] = useState(false);

  const handleCropComplete = useCallback((croppedArea, croppedAreaPixels) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const showCroppedImage = useCallback(async () => {
    try {
      setProcessing(true);
      const croppedImage = await getCroppedImg(imageSrc, croppedAreaPixels);
      onCropComplete(croppedImage);
    } catch (e) {
      console.error(e);
      setProcessing(false);
      alert('Error al recortar la imagen');
    }
  }, [imageSrc, croppedAreaPixels, onCropComplete]);

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <h3 className={styles.title}>Recortar Imagen</h3>
        <p className={styles.subtitle}>Selecciona la parte de la imagen que deseas mostrar</p>
        
        <div className={styles.cropContainer}>
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={undefined} // Free aspect ratio
            onCropChange={setCrop}
            onCropComplete={handleCropComplete}
            onZoomChange={setZoom}
          />
        </div>

        <div className={styles.controls}>
          <label className={styles.zoomLabel}>
            Aumentar Zoom:
            <input
              type="range"
              value={zoom}
              min={1}
              max={3}
              step={0.1}
              aria-labelledby="Zoom"
              onChange={(e) => setZoom(e.target.value)}
              className={styles.slider}
            />
          </label>
        </div>

        <div className={styles.actions}>
          <Button variant="outline" onClick={onCancel} disabled={processing}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={showCroppedImage} disabled={processing}>
            {processing ? 'Recortando...' : 'Aplicar Recorte'}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default AdminImageCropper;
