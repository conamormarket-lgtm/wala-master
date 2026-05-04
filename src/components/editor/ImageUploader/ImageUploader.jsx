import React, { useRef } from 'react';
import { uploadFile } from '../../../services/firebase/storage';
import { useAuth } from '../../../contexts/AuthContext';
import styles from './ImageUploader.module.css';

/**
 * Añade la capa con vista previa (tempUrl) de inmediato.
 * onImageSelect(tempUrl) debe devolver el layerId.
 * Cuando la subida termina, onUploadComplete(url, layerId) actualiza la misma capa.
 */
const ImageUploader = ({ onImageSelect, onUploadComplete, label = 'Subir Imagen', productId = null, isAdmin = false }) => {
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = React.useState(false);
  const [uploadError, setUploadError] = React.useState(null);
  const { user } = useAuth();

  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploadError(null);
    const tempUrl = URL.createObjectURL(file);
    const layerId = typeof onImageSelect === 'function' ? onImageSelect(tempUrl) : null;

    setUploading(true);
    const timeout = setTimeout(() => {
      setUploading(false);
      setUploadError('Tiempo de espera agotado. La imagen se muestra pero guarda el diseño para no perderla.');
    }, 50000);

    try {
      const userId = user?.uid || 'anonymous';
      const path = isAdmin && productId
        ? `products/${productId}/designs/${Date.now()}_${file.name}`
        : `designs/${userId}/${Date.now()}_${file.name}`;

      const { url, error } = await uploadFile(file, path);
      clearTimeout(timeout);

      if (url && !error && layerId && typeof onUploadComplete === 'function') {
        onUploadComplete(url, layerId);
      } else if (error) {
        setUploadError(error || 'Error al subir. La imagen se muestra; guarda el diseño para conservarla.');
      }
    } catch (err) {
      clearTimeout(timeout);
      console.error('Error al subir imagen:', err);
      setUploadError(err?.message || 'Error al subir. La imagen se muestra; guarda el diseño.');
    } finally {
      clearTimeout(timeout);
      setUploading(false);
      URL.revokeObjectURL(tempUrl);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className={styles.uploader}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        disabled={uploading}
        className={styles.fileInput}
        id="image-upload"
      />
      <label htmlFor="image-upload" className={styles.uploadButton}>
        {uploading ? 'Subiendo...' : `📷 ${label}`}
      </label>
      {uploadError && <p className={styles.uploadError}>{uploadError}</p>}
    </div>
  );
};

export default ImageUploader;
