import React, { useState, useRef, useCallback } from 'react';
import { useEditor } from '../../../contexts/EditorContext';
import { toDirectImageUrl, ensureSingleImageUrl } from '../../../utils/imageUrl';
import { makeColorTransparent } from '../../../utils/imageBackgroundRemoval';
import { uploadFromDataUrl } from '../../../services/firebase/storage';
import { useAuth } from '../../../contexts/AuthContext';
import styles from './ImageProperties.module.css';

const MASK_OPTIONS = [
  { value: '', label: 'Ninguna' },
  { value: 'circle', label: 'Circular' },
  { value: 'square', label: 'Cuadrado' },
];

const ImageProperties = ({ layerId }) => {
  const { layers, updateLayer, canvas, product } = useEditor();
  const { user, isAdmin } = useAuth();
  const layer = layers.find((l) => l.id === layerId);
  const [cropOpen, setCropOpen] = useState(false);
  const [cropData, setCropData] = useState(null);
  const imgRef = useRef(null);
  const cropOverlayRef = useRef(null);
  const [removeBgColor, setRemoveBgColor] = useState('#FFFFFF');
  const [removeBgTolerance, setRemoveBgTolerance] = useState(25);
  const [removeBgApplying, setRemoveBgApplying] = useState(false);
  const [removeBgError, setRemoveBgError] = useState(null);

  const handleCropApply = useCallback(() => {
    if (!layer?.src || !imgRef.current || !cropData) return;
    const img = imgRef.current;
    const naturalW = img.naturalWidth || img.width;
    const naturalH = img.naturalHeight || img.height;
    const x = Math.round(cropData.x * naturalW);
    const y = Math.round(cropData.y * naturalH);
    const w = Math.round(cropData.w * naturalW);
    const h = Math.round(cropData.h * naturalH);

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, x, y, w, h, 0, 0, w, h);
    const dataUrl = canvas.toDataURL('image/png');
    // Actualizar pantalla inmediatamente con base64 para que sea rápido
    updateLayer(layerId, { src: dataUrl });
    setCropOpen(false);

    // Subir a Storage silenciosamente para no exceder limite de 1MB en Firestore al guardar el diseño
    const uploadEditedImage = async () => {
      const userId = user?.uid || 'anonymous';
      const path = isAdmin && product?.id
        ? `products/${product.id}/designs/${Date.now()}_crop.png`
        : `designs/${userId}/${Date.now()}_crop.png`;
      const { url, error } = await uploadFromDataUrl(dataUrl, path);
      if (url && !error) {
        updateLayer(layerId, { src: url });
      }
    };
    uploadEditedImage();
  }, [layer?.src, layerId, cropData, updateLayer, user, isAdmin, product]);

  const handleRemoveBackground = useCallback(async () => {
    const srcStr = layer ? ensureSingleImageUrl(layer.src) : '';
    if (!srcStr || removeBgApplying) return;
    setRemoveBgError(null);
    setRemoveBgApplying(true);
    try {
      let imageSource = toDirectImageUrl(srcStr);
      if (canvas && layerId) {
        const obj = canvas.getObjects().find((o) => o.customId === layerId);
        if (obj && obj.type === 'image' && typeof obj.toDataURL === 'function') {
          try {
            imageSource = obj.toDataURL({ format: 'png' });
          } catch (_) { }
        }
      }
      const dataUrl = await makeColorTransparent(
        imageSource,
        removeBgColor,
        removeBgTolerance,
        1200
      );

      // Mostrar rápidamente base64
      updateLayer(layerId, { src: dataUrl });

      // Subir asíncronamente a Storage para evitar límite de Firebase Firestore (1MB)
      const uploadEditedImage = async () => {
        const userId = user?.uid || 'anonymous';
        const path = isAdmin && product?.id
          ? `products/${product.id}/designs/${Date.now()}_nobg.png`
          : `designs/${userId}/${Date.now()}_nobg.png`;
        const { url, error } = await uploadFromDataUrl(dataUrl, path);
        if (url && !error) {
          updateLayer(layerId, { src: url });
        }
      };
      uploadEditedImage();
    } catch (err) {
      setRemoveBgError(err?.message || 'No se pudo quitar el fondo');
    } finally {
      setRemoveBgApplying(false);
    }
  }, [layer, layerId, removeBgColor, removeBgTolerance, updateLayer, removeBgApplying, canvas]);

  if (!layer || layer.type !== 'image') return null;

  const imageUrlForLayer = toDirectImageUrl(ensureSingleImageUrl(layer.src));
  const canEditImage = Boolean(imageUrlForLayer);

  const handleMaskChange = (e) => {
    const value = e.target.value;
    updateLayer(layerId, { maskShape: value || undefined });
  };

  const handleCropStart = () => {
    setCropOpen(true);
    setCropData({ x: 0.1, y: 0.1, w: 0.8, h: 0.8 });
  };

  const handleTintColorChange = (e) => {
    const val = e.target.value;
    if (!val) {
      updateLayer(layerId, { tintColor: undefined, tintOpacity: undefined });
      return;
    }
    updateLayer(layerId, {
      tintColor: val,
      tintOpacity: layer.tintOpacity ?? 1, // 1.0 por defecto para color sólido (ideal para cliparts)
    });
  };

  const handleTintOpacityChange = (e) => {
    const val = Number(e.target.value) / 100;
    updateLayer(layerId, { tintOpacity: val });
  };

  const clearTint = () => {
    updateLayer(layerId, { tintColor: undefined, tintOpacity: undefined });
  };

  return (
    <div className={styles.wrapper}>
      <div className={styles.field}>
        <label>Máscara de forma:</label>
        <select value={layer.maskShape || ''} onChange={handleMaskChange} className={styles.select}>
          {MASK_OPTIONS.map((opt) => (
            <option key={opt.value || 'none'} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
      <div className={styles.field}>
        <button type="button" className={styles.cropButton} onClick={handleCropStart} disabled={!canEditImage}>
          Recortar imagen
        </button>
      </div>

      <div className={styles.section}>
        <h4 className={styles.sectionTitle}>Quitar fondo</h4>
        <p className={styles.hint}>Elige el color del fondo a eliminar (p. ej. blanco) y la tolerancia.</p>
        {!canEditImage && <p className={styles.errorText}>Esta imagen no tiene una URL válida para editar.</p>}
        <div className={styles.field}>
          <label>Color a quitar:</label>
          <input
            type="color"
            value={removeBgColor}
            onChange={(e) => setRemoveBgColor(e.target.value)}
            className={styles.colorInput}
            disabled={!canEditImage}
          />
          <span className={styles.colorHex}>{removeBgColor}</span>
        </div>
        <div className={styles.field}>
          <label>Tolerancia: {removeBgTolerance}%</label>
          <input
            type="range"
            min="0"
            max="100"
            value={removeBgTolerance}
            onChange={(e) => setRemoveBgTolerance(Number(e.target.value))}
            className={styles.range}
            disabled={!canEditImage}
          />
        </div>
        {removeBgError && <p className={styles.errorText}>{removeBgError}</p>}
        <button
          type="button"
          className={styles.cropButton}
          onClick={handleRemoveBackground}
          disabled={removeBgApplying || !canEditImage}
        >
          {removeBgApplying ? 'Aplicando...' : 'Aplicar quitar fondo'}
        </button>
      </div>

      <div className={styles.section}>
        <h4 className={styles.sectionTitle}>Color (Cliparts e Imágenes)</h4>
        <p className={styles.hint}>Reemplaza el color de un clipart/dibujo o aplica un tinte a las fotos.</p>
        <div className={styles.field}>
          <label>Color a aplicar:</label>
          <div className={styles.tintRow}>
            <input
              type="color"
              value={layer.tintColor || '#000000'}
              onChange={handleTintColorChange}
              className={styles.colorInput}
            />
            <span className={styles.colorHex}>{layer.tintColor ? layer.tintColor : 'Original'}</span>
            {!layer.tintColor && (
              <button
                type="button"
                className={styles.cropButton}
                onClick={() => updateLayer(layerId, { tintColor: '#000000', tintOpacity: 1 })}
                style={{ padding: '0.4rem', marginLeft: 'auto', minHeight: 'auto' }}
              >
                Colorear
              </button>
            )}
          </div>
        </div>
        {layer.tintColor && (
          <div className={styles.field}>
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <button
                type="button"
                className={styles.cropButton}
                onClick={() => updateLayer(layerId, { tintOpacity: 1 })}
                style={{ flex: 1, padding: '0.4rem', fontSize: '12px', minHeight: 'auto', background: layer.tintOpacity === 1 ? '#eee' : 'transparent', color: '#333', borderColor: layer.tintOpacity === 1 ? '#333' : '#ccc' }}
              >
                Color sólido
              </button>
              <button
                type="button"
                className={styles.cropButton}
                onClick={() => updateLayer(layerId, { tintOpacity: 0.5 })}
                style={{ flex: 1, padding: '0.4rem', fontSize: '12px', minHeight: 'auto', background: layer.tintOpacity !== 1 ? '#eee' : 'transparent', color: '#333', borderColor: layer.tintOpacity !== 1 ? '#333' : '#ccc' }}
              >
                Tinte suave
              </button>
              <button
                type="button"
                className={styles.cropButton}
                onClick={clearTint}
                style={{ flex: 1, padding: '0.4rem', fontSize: '12px', minHeight: 'auto', background: '#fff0f0', color: '#b4171e', borderColor: '#ffcccc' }}
              >
                Quitar
              </button>
            </div>
            <label>Opacidad / Mezcla: {Math.round((layer.tintOpacity ?? 1) * 100)}%</label>
            <input
              type="range"
              min="0"
              max="100"
              value={(layer.tintOpacity ?? 1) * 100}
              onChange={handleTintOpacityChange}
              className={styles.range}
            />
          </div>
        )}
      </div>

      {cropOpen && imageUrlForLayer && (
        <div className={styles.modalBackdrop} onClick={() => setCropOpen(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h4>Recortar</h4>
            <p className={styles.hint}>Ajusta el área. La imagen se recortará al aplicar.</p>
            <div className={styles.cropPreview}>
              <img
                ref={imgRef}
                src={imageUrlForLayer}
                alt=""
                crossOrigin="anonymous"
                onLoad={() => setCropData((d) => d || { x: 0.1, y: 0.1, w: 0.8, h: 0.8 })}
              />
              {cropData && (
                <div
                  ref={cropOverlayRef}
                  className={styles.cropOverlay}
                  style={{
                    left: `${cropData.x * 100}%`,
                    top: `${cropData.y * 100}%`,
                    width: `${cropData.w * 100}%`,
                    height: `${cropData.h * 100}%`,
                  }}
                />
              )}
            </div>
            <div className={styles.cropControls}>
              <label>X: <input type="range" min="0" max="100" value={(cropData?.x ?? 0) * 100} onChange={(e) => setCropData((d) => ({ ...d, x: Number(e.target.value) / 100 }))} /></label>
              <label>Y: <input type="range" min="0" max="100" value={(cropData?.y ?? 0) * 100} onChange={(e) => setCropData((d) => ({ ...d, y: Number(e.target.value) / 100 }))} /></label>
              <label>Ancho: <input type="range" min="10" max="100" value={(cropData?.w ?? 0.8) * 100} onChange={(e) => setCropData((d) => ({ ...d, w: Number(e.target.value) / 100 }))} /></label>
              <label>Alto: <input type="range" min="10" max="100" value={(cropData?.h ?? 0.8) * 100} onChange={(e) => setCropData((d) => ({ ...d, h: Number(e.target.value) / 100 }))} /></label>
            </div>
            <div className={styles.modalActions}>
              <button type="button" className={styles.btnSecondary} onClick={() => setCropOpen(false)}>
                Cancelar
              </button>
              <button type="button" className={styles.btnPrimary} onClick={handleCropApply}>
                Aplicar recorte
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ImageProperties;
