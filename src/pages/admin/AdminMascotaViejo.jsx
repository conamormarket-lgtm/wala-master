import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getMessage, setMessage } from '../../services/messages';
import { toDirectImageUrl, getPreviewImageUrl } from '../../utils/mascotaImage';
import { uploadFile } from '../../services/firebase/storage';
import Button from '../../components/common/Button';
import styles from './AdminTiendaTextos.module.css';

const MASCOTA_KEY = 'mascota_kap_image_url';
const STORAGE_PATH = 'config/mascota_kap.png';

const AdminMascota = () => {
  const queryClient = useQueryClient();
  const [url, setUrl] = useState('');
  const [previewError, setPreviewError] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  const { data: savedUrl, isLoading } = useQuery({
    queryKey: ['admin-mascota-url'],
    queryFn: async () => {
      const { data } = await getMessage(MASCOTA_KEY);
      return data?.trim() ?? '';
    },
  });

  useEffect(() => {
    if (savedUrl !== undefined) setUrl(savedUrl);
  }, [savedUrl]);

  useEffect(() => {
    setPreviewError(false);
  }, [url]);

  const saveMutation = useMutation({
    mutationFn: async (value) => {
      const { error } = await setMessage(MASCOTA_KEY, value?.trim() ?? '');
      if (error) throw new Error(error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-mascota-url'] });
      queryClient.invalidateQueries({ queryKey: ['mascota-image-url'] });
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    saveMutation.mutate(url);
  };

  const handleEliminar = () => {
    if (!url && !savedUrl) return;
    if (!window.confirm('¿Quitar la imagen de la mascota? En Mi cuenta y en el registro ya no se mostrará.')) return;
    setUrl('');
    saveMutation.mutate('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    setUploading(true);
    try {
      const { url: downloadUrl, error } = await uploadFile(file, STORAGE_PATH);
      if (error) throw new Error(error);
      if (downloadUrl) {
        setUrl(downloadUrl);
        saveMutation.mutate(downloadUrl);
      }
    } catch (err) {
      alert('Error al subir: ' + (err.message || 'Intenta de nuevo.'));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const directPreview = getPreviewImageUrl(url) || toDirectImageUrl(url);

  if (isLoading) {
    return <p className={styles.loading}>Cargando...</p>;
  }

  return (
    <div className={styles.wrapper}>
      <h1 className={styles.title}>Imagen de la mascota (Kap)</h1>
      <p className={styles.subtitle}>
        Pega el enlace de la imagen o <strong>sube el archivo</strong>. Si subes la imagen, se guarda en tu proyecto y siempre cargará en Mi cuenta.
        Usa una imagen PNG con fondo transparente. Si la mascota no se ve en la web, sube el archivo aquí (los enlaces de Google Drive a veces el navegador los bloquea).
      </p>

      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.field}>
          <label htmlFor="mascota_url">URL de la imagen (opcional)</label>
          <input
            id="mascota_url"
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Ej: https://i.imgur.com/... o deja vacío y sube el archivo abajo"
            className={styles.input}
          />
        </div>

        <div className={styles.field}>
          <label>Subir imagen directamente (recomendado)</label>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/webp,image/jpeg"
            onChange={handleFileChange}
            disabled={uploading}
            style={{ marginTop: '0.35rem' }}
          />
          {uploading && <p style={{ marginTop: '0.35rem', fontSize: '0.875rem', color: '#666' }}>Subiendo...</p>}
        </div>

        {(url || directPreview) && (
          <div className={styles.field}>
            <span style={{ fontWeight: 500 }}>Vista previa</span>
            <div style={{ marginTop: '0.5rem', padding: '1rem', background: '#f5f5f5', borderRadius: 8, display: 'inline-block', minHeight: 120, minWidth: 140 }}>
              <img
                key={directPreview}
                src={directPreview}
                alt="Vista previa Kap"
                style={{ maxWidth: 140, maxHeight: 160, objectFit: 'contain', display: previewError ? 'none' : 'block' }}
                onLoad={() => setPreviewError(false)}
                onError={() => setPreviewError(true)}
              />
              {previewError && (
                <p style={{ margin: 0, fontSize: '0.8125rem', color: '#856404', maxWidth: 200 }}>
                  No se pudo cargar la vista previa (el enlace puede estar restringido). Si guardaste una URL, revisa en Mi cuenta. Mejor: sube la imagen con el botón de arriba para que siempre se vea.
                </p>
              )}
            </div>
          </div>
        )}

        <div className={styles.actions}>
          <Button type="submit" disabled={saveMutation.isPending || uploading}>
            {saveMutation.isPending ? 'Guardando...' : 'Guardar URL'}
          </Button>
          {(url || savedUrl) && (
            <Button
              type="button"
              variant="secondary"
              onClick={handleEliminar}
              disabled={saveMutation.isPending || uploading}
              style={{ marginLeft: '0.75rem' }}
            >
              Eliminar imagen
            </Button>
          )}
        </div>
      </form>

      {saveMutation.isSuccess && (
        <div style={{ marginTop: '1rem', padding: '0.75rem', background: '#d4edda', color: '#155724', borderRadius: 6, fontSize: '0.875rem' }}>
          ✓ Imagen guardada. La mascota se actualizará en Mi cuenta y en el registro.
        </div>
      )}
      {saveMutation.isError && (
        <div style={{ marginTop: '1rem', padding: '0.75rem', background: '#f8d7da', color: '#721c24', borderRadius: 6, fontSize: '0.875rem' }}>
          ✗ Error al guardar: {saveMutation.error?.message || 'Error desconocido'}
        </div>
      )}
    </div>
  );
};

export default AdminMascota;
