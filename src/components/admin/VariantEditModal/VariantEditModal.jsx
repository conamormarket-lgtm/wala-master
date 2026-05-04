import React, { useState, useEffect, useCallback } from 'react';
import Modal from '../../common/Modal';
import Button from '../../common/Button';
import Cropper from 'react-easy-crop';
import { toDirectImageUrl } from '../../../utils/imageUrl';
import { uploadFile } from '../../../services/firebase/storage';
import styles from './VariantEditModal.module.css';

const VariantEditModal = ({ isOpen, variant, onSave, onClose }) => {
  const [name, setName] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [galleryImages, setGalleryImages] = useState([]);
  const [newGalleryUrl, setNewGalleryUrl] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');
  const [sizes, setSizes] = useState([]);
  const [sizeInput, setSizeInput] = useState('');
  const [colorHex, setColorHex] = useState('#cccccc');
  const [uploading, setUploading] = useState(false);

  // Thumbnail crop states
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPercentages, setCroppedAreaPercentages] = useState(null);

  useEffect(() => {
    if (variant) {
      setName(variant.name ?? '');
      const raw = variant.imageUrl ?? '';
      setImageUrl(raw);
      setGalleryImages(Array.isArray(variant.galleryImages) ? [...variant.galleryImages] : []);
      setPreviewUrl(toDirectImageUrl(raw));
      setSizes(Array.isArray(variant.sizes) ? [...variant.sizes] : []);
      setColorHex(variant.colorHex || '#cccccc');

      // Load crop settings if available
      if (variant.thumbnailCrop) {
        setCrop(variant.thumbnailCrop.crop || { x: 0, y: 0 });
        setZoom(variant.thumbnailCrop.zoom || 1);
        setCroppedAreaPercentages(variant.thumbnailCrop.percentages || null);
      } else {
        setCrop({ x: 0, y: 0 });
        setZoom(1);
        setCroppedAreaPercentages(null);
      }
    } else {
      setName('');
      setImageUrl('');
      setGalleryImages([]);
      setNewGalleryUrl('');
      setPreviewUrl('');
      setSizes([]);
      setColorHex('#cccccc');
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setCroppedAreaPercentages(null);
    }
    setSizeInput('');
  }, [variant, isOpen]);

  const addSize = () => {
    const s = sizeInput.trim();
    if (s) {
      setSizes((prev) => [...prev, s]);
      setSizeInput('');
    }
  };

  const removeSize = (index) => {
    setSizes((prev) => prev.filter((_, i) => i !== index));
  };

  const handleGalleryUpload = async (e) => {
    const files = e?.target?.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const newUrls = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!file.type.startsWith('image/')) continue;
        const path = `products/variants/gallery/${Date.now()}_${file.name}`;
        const { url, error } = await uploadFile(file, path);
        if (url && !error) newUrls.push(url);
      }
      if (newUrls.length > 0) {
        setGalleryImages(prev => [...prev, ...newUrls]);
      }
    } finally {
      setUploading(false);
    }
  };

  const removeGalleryImage = (index) => {
    setGalleryImages(prev => prev.filter((_, i) => i !== index));
  };
  
  const handleAddGalleryUrl = () => {
    if (newGalleryUrl.trim()) {
      setGalleryImages(prev => [...prev, newGalleryUrl.trim()]);
      setNewGalleryUrl('');
    }
  };
  
  const moveImage = (index, direction) => {
     setGalleryImages(prev => {
         const arr = [...prev];
         if (direction === -1 && index > 0) {
             [arr[index - 1], arr[index]] = [arr[index], arr[index - 1]];
         } else if (direction === 1 && index < arr.length - 1) {
             [arr[index + 1], arr[index]] = [arr[index], arr[index + 1]];
         }
         return arr;
     });
  };

  // Actualizar preview en tiempo real mientras se escribe la URL
  const handleUrlChange = (e) => {
    const val = e.target.value;
    setImageUrl(val);
    setPreviewUrl(toDirectImageUrl(val.trim()));
    // Reset crop on new image
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPercentages(null);
  };

  // Subir archivo de imagen a Firebase Storage
  const handleFileUpload = async (e) => {
    const file = e?.target?.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    setUploading(true);
    try {
      const path = `products/variants/${Date.now()}_${file.name}`;
      const { url, error } = await uploadFile(file, path);
      if (url && !error) {
        setImageUrl(url);
        setPreviewUrl(url);
        // Reset crop for new upload
        setCrop({ x: 0, y: 0 });
        setZoom(1);
        setCroppedAreaPercentages(null);
      }
    } finally {
      setUploading(false);
    }
  };

  const onCropComplete = useCallback((croppedArea, croppedAreaPercentages) => {
    setCroppedAreaPercentages(croppedAreaPercentages);
  }, []);

  const handleEyeDropper = async () => {
    if ('EyeDropper' in window) {
      try {
        const eyeDropper = new window.EyeDropper();
        const result = await eyeDropper.open();
        setColorHex(result.sRGBHex);
      } catch (e) {
        // El usuario canceló o hubo pre-condición que falló
        console.log('EyeDropper cancelado');
      }
    } else {
      alert('Tu navegador actual no soporta la herramienta cuentagotas nativa. Por favor usa el selector manual haciendo clic en el cuadro de color.');
    }
  };

  const handleSave = (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    const cropData = (previewUrl && croppedAreaPercentages) ? {
      crop,
      zoom,
      percentages: croppedAreaPercentages
    } : null;

    // Guardar la URL original (Firebase, Drive o directa)
    onSave({
      name: name.trim(),
      imageUrl: imageUrl.trim(),
      galleryImages: [...galleryImages],
      sizes: [...sizes],
      colorHex: colorHex,
      thumbnailCrop: cropData
    });
  };

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Editar variante">
      <div className={styles.form}>
        <div className={styles.field}>
          <label htmlFor="variant-name">Nombre de la variante</label>
          <input
            id="variant-name"
            type="text"
            placeholder="Ej. Negro, Blanco, Edición especial"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={styles.input}
            required
          />
        </div>
        <div className={styles.field}>
          <label htmlFor="variant-color">Color para mostrar en la tienda (Bolita visual)</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <input
              id="variant-color"
              type="color"
              value={colorHex}
              onChange={(e) => setColorHex(e.target.value)}
              style={{ width: '50px', height: '40px', padding: '0', cursor: 'pointer', border: '1px solid #ccc', borderRadius: '4px', flexShrink: 0 }}
              title="Selector de color manual"
            />
            {('EyeDropper' in window) && (
              <button
                type="button"
                onClick={handleEyeDropper}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 12px',
                  backgroundColor: '#f3f4f6',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: '600',
                  color: '#374151',
                  fontSize: '0.85rem',
                  transition: 'background-color 0.2s',
                  flexShrink: 0
                }}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#e5e7eb'}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
                title="Copiar color de cualquier parte de la pantalla (Cuentagotas)"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m2 22 1-1h3l9-9"></path>
                  <path d="M3 21v-3l9-9"></path>
                  <path d="m15 6 3.4-3.4a2.1 2.1 0 1 1 3 3L18 9l.4.4a2.1 2.1 0 1 1-3 3l-3.8-3.8a2.1 2.1 0 1 1 3-3l.4.4Z"></path>
                </svg>
                Cuentagotas
              </button>
            )}
            <span style={{ fontSize: '0.85rem', color: '#555', lineHeight: '1.4', flex: '1 1 100%' }}>
              Puedes usar el cuentagotas para copiar el color exacto de la foto del lado (u otra parte de la pantalla), o cambiarlo manualmente.
            </span>
          </div>
        </div>
        <div className={styles.field}>
          <label htmlFor="variant-image">Imagen Principal (Frente / Portada)</label>
          <p style={{ fontSize: '0.82rem', color: '#666', margin: '0 0 0.5rem 0' }}>
            Esta será la primera imagen. Sube o pega un enlace. Abajo podrás encuadrarla.
          </p>
          {/* Subida de archivo */}
          <input
            type="file"
            accept="image/*"
            onChange={handleFileUpload}
            disabled={uploading}
            style={{ marginBottom: '0.5rem', display: 'block' }}
          />
          {uploading && <span style={{ fontSize: '0.82rem', color: '#666' }}>Subiendo imagen…</span>}
          {/* Input de URL */}
          <input
            id="variant-image"
            type="text"
            placeholder="https://... o enlace de Google Drive"
            value={imageUrl}
            onChange={handleUrlChange}
            className={styles.input}
          />
          {/* Vista previa en tiempo real con Cropper */}
          {previewUrl && (
            <div className={styles.cropContainerWrapper}>
              <div className={styles.cropContainer}>
                  <Cropper
                    image={previewUrl}
                    crop={crop}
                    zoom={zoom}
                    aspect={1}
                    onCropChange={setCrop}
                    onCropComplete={(croppedAreaPercentages, croppedAreaPixels) => {
                      // react-easy-crop emits percentages as the PREVIOUS first argument
                      setCroppedAreaPercentages(croppedAreaPercentages);
                    }}
                    onZoomChange={setZoom}
                    minZoom={0.3}
                    maxZoom={3}
                    restrictPosition={false}
                  />
              </div>
              <div className={styles.zoomControl}>
                <button
                  type="button"
                  className={styles.zoomBtn}
                  onClick={() => setZoom(z => Math.max(0.3, z - 0.1))}
                  aria-label="Alejar"
                >
                  -
                </button>
                <input
                  type="range"
                  value={zoom}
                  min={0.3}
                  max={3}
                  step={0.01}
                  aria-labelledby="Zoom"
                  onChange={(e) => {
                    setZoom(Number(e.target.value));
                  }}
                  className={styles.zoomSlider}
                />
                <button
                  type="button"
                  className={styles.zoomBtn}
                  onClick={() => setZoom(z => Math.min(3, z + 0.1))}
                  aria-label="Acercar"
                >
                  +
                </button>
              </div>
            </div>
          )}
        </div>

        <div className={styles.field} style={{ marginTop: '1rem', borderTop: '1px solid #eee', paddingTop: '1rem' }}>
          <label>Galería de imágenes extras (Miniatura 2, 3, 4...)</label>
          <p style={{ fontSize: '0.82rem', color: '#666', margin: '0 0 0.5rem 0' }}>
            Agrega otras vistas (espalda, detalles). Aperecerán debajo o al lado de la portada. Puedes reordenarlas con las flechas.
          </p>
          
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', alignItems: 'center' }}>
            <input 
               type="text" 
               placeholder="Pegar URL directa (ej. de Cloudinary)..." 
               value={newGalleryUrl} 
               onChange={(e) => setNewGalleryUrl(e.target.value)} 
               className={styles.input} 
               style={{ margin: 0 }}
               onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                     e.preventDefault();
                     handleAddGalleryUrl();
                  }
               }}
            />
            <Button type="button" variant="secondary" onClick={handleAddGalleryUrl} disabled={!newGalleryUrl.trim()}>
              Agregar URL
            </Button>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <span style={{ fontSize: '0.8rem', color: '#555', fontWeight: 600 }}>O subir desde PC:</span>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handleGalleryUpload}
              disabled={uploading}
              style={{ fontSize: '0.85rem' }}
            />
          </div>
          
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {galleryImages.map((src, i) => (
              <li key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#f9f9f9', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ddd' }}>
                 <div style={{ fontWeight: 'bold', color: '#888', width: '20px', textAlign: 'center', fontSize: '0.85rem' }}>{i + 2}</div>
                 <img src={toDirectImageUrl(src)} alt={`Extra ${i+1}`} style={{ width: '40px', height: '40px', objectFit: 'contain', background: '#fff', borderRadius: '4px' }} />
                 <input 
                   type="text" 
                   value={src} 
                   onChange={(e) => {
                      const newArr = [...galleryImages];
                      newArr[i] = e.target.value;
                      setGalleryImages(newArr);
                   }}
                   placeholder="https://..."
                   style={{ flexGrow: 1, fontSize: '0.8rem', padding: '0.4rem', borderRadius: '4px', border: '1px solid #ccc' }} 
                 />
                 <button type="button" onClick={() => moveImage(i, -1)} disabled={i === 0} style={{ padding: '0.2rem 0.5rem', cursor: i === 0 ? 'not-allowed' : 'pointer', background: '#e5e7eb', border: 'none', borderRadius: '4px' }}>↑</button>
                 <button type="button" onClick={() => moveImage(i, 1)} disabled={i === galleryImages.length - 1} style={{ padding: '0.2rem 0.5rem', cursor: i === galleryImages.length - 1 ? 'not-allowed' : 'pointer', background: '#e5e7eb', border: 'none', borderRadius: '4px' }}>↓</button>
                 <button type="button" onClick={() => removeGalleryImage(i)} style={{ color: 'white', background: '#ef4444', border: 'none', fontWeight: 'bold', padding: '0.2rem 0.5rem', cursor: 'pointer', borderRadius: '4px' }}>X</button>
              </li>
            ))}
            {galleryImages.length === 0 && <li style={{ fontSize: '0.85rem', color: '#888', fontStyle: 'italic', textAlign: 'center', padding: '1rem' }}>No hay imágenes extra.</li>}
          </ul>
        </div>
        
        <div className={styles.field} style={{ marginTop: '1rem', borderTop: '1px solid #eee', paddingTop: '1rem' }}>
          <label>Tallas disponibles (opcional)</label>
          <div className={styles.addRow}>
            <input
              type="text"
              placeholder="Ej. S, M, L"
              value={sizeInput}
              onChange={(e) => setSizeInput(e.target.value)}
              className={styles.input}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addSize())}
            />
            <Button type="button" variant="secondary" onClick={addSize}>
              Añadir
            </Button>
          </div>
          <ul className={styles.tagList}>
            {sizes.map((s, i) => (
              <li key={i} className={styles.tag}>
                {s}
                <button type="button" className={styles.tagRemove} onClick={() => removeSize(i)} aria-label="Quitar">×</button>
              </li>
            ))}
          </ul>
        </div>
        <div className={styles.actions}>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="button" variant="primary" onClick={handleSave} disabled={uploading}>
            Guardar
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default VariantEditModal;
