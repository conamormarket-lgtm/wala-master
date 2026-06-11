import React, { useRef } from 'react';
import { uploadFile } from '../../../../../../services/firebase/storage';
import { useAuth } from '../../../../../../contexts/AuthContext';
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
  const [urlInput, setUrlInput] = React.useState('');
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
      const path = `YoryoPersonalizado/${Date.now()}_${file.name}`;

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

  const handleUrlSubmit = () => {
    if (!urlInput.trim()) return;
    setUploadError(null);
    try {
      const url = new URL(urlInput.trim()).href;
      const layerId = typeof onImageSelect === 'function' ? onImageSelect(url) : null;
      if (layerId && typeof onUploadComplete === 'function') {
        onUploadComplete(url, layerId);
      }
      setUrlInput('');
    } catch (e) {
      setUploadError('URL inválida. Asegúrate de incluir http:// o https://');
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
      
      <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
        <span style={{ fontSize: '0.85rem', color: '#666' }}>O pega un enlace de imagen:</span>
        <div style={{ display: 'flex', gap: '5px' }}>
          <input 
            type="text" 
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="https://..."
            style={{ flex: 1, padding: '5px', borderRadius: '4px', border: '1px solid #ccc', fontSize: '0.9rem' }}
          />
          <button 
            type="button" 
            onClick={handleUrlSubmit}
            disabled={!urlInput.trim()}
            style={{ padding: '5px 10px', background: '#e5e7eb', border: 'none', borderRadius: '4px', cursor: urlInput.trim() ? 'pointer' : 'not-allowed' }}
          >
            Añadir
          </button>
        </div>
      </div>

      {uploadError && <p className={styles.uploadError}>{uploadError}</p>}
    </div>
  );
};

export default ImageUploader;
