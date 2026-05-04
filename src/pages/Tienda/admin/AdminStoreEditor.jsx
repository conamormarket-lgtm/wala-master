import React, { useState, useEffect } from 'react';
import { getDocument, setDocument } from '../../../services/firebase/firestore';
import Button from '../../../components/common/Button';
import Loading from '../../../components/common/Loading';
import styles from '../../admin/AdminStoreEditor.module.css';

const AdminStoreEditor = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  
  const [config, setConfig] = useState({
    heroBanner: {
      mediaType: 'image', // 'image', 'video', 'gif'
      mediaUrl: '',
      thumbnailUrl: '', // Para carga rápida de videos
      title: 'Nueva Colección',
      subtitle: 'Descubre los nuevos estilos',
      buttonText: 'Comprar Ahora',
      buttonLink: '/tienda'
    },
    layout: {
      productGridColumnsDesktop: 4,
      productGridColumnsMobile: 2,
      showHoverSecondaryMedia: true
    }
  });

  useEffect(() => {
    const fetchConfig = async () => {
      const { data, error } = await getDocument('storeConfig', 'homePage');
      if (data) {
        setConfig(prev => ({
          ...prev,
          ...data
        }));
      }
      setLoading(false);
    };
    fetchConfig();
  }, []);

  const handleHeroChange = (e) => {
    const { name, value } = e.target;
    setConfig(prev => ({
      ...prev,
      heroBanner: {
        ...prev.heroBanner,
        [name]: value
      }
    }));
  };

  const handleLayoutChange = (e) => {
    const { name, value, type, checked } = e.target;
    setConfig(prev => ({
      ...prev,
      layout: {
        ...prev.layout,
        [name]: type === 'checkbox' ? checked : Number(value)
      }
    }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    
    const { error } = await setDocument('storeConfig', 'homePage', config);
    if (error) {
      setMessage(`Error al guardar: ${error}`);
    } else {
      setMessage('¡Configuración guardada exitosamente!');
    }
    setSaving(false);
  };

  if (loading) return <Loading message="Cargando configuración..." />;

  return (
    <div className={styles.container}>
      <h2>Editor de la Tienda</h2>
      <p>Modifica el aspecto principal de la página de inicio al estilo Shopify.</p>
      
      {message && <div className={styles.message}>{message}</div>}

      <form onSubmit={handleSave} className={styles.form}>
        <div className={styles.section}>
          <h3>Hero Banner Principal</h3>
          <p className={styles.helpText}>El banner que aparece arriba del todo. Puedes usar imágenes, GIFs o videos externos (Cloudinary, Imgur, etc).</p>
          
          <div className={styles.formGroup}>
            <label>Tipo de Medio</label>
            <select name="mediaType" value={config.heroBanner.mediaType} onChange={handleHeroChange}>
              <option value="image">Imagen Estática</option>
              <option value="gif">GIF Animado</option>
              <option value="video">Video (Autoplay)</option>
            </select>
          </div>

          <div className={styles.formGroup}>
            <label>URL del Medio Principal (Video de Alta Calidad o Imagen)</label>
            <input 
              type="text" 
              name="mediaUrl" 
              value={config.heroBanner.mediaUrl} 
              onChange={handleHeroChange} 
              placeholder="https://dominio.com/tu-video.mp4" 
            />
          </div>

          {config.heroBanner.mediaType === 'video' && (
            <div className={styles.formGroup}>
              <label>URL de Miniatura (Thumbnail) de Carga Rápida</label>
              <input 
                type="text" 
                name="thumbnailUrl" 
                value={config.heroBanner.thumbnailUrl} 
                onChange={handleHeroChange} 
                placeholder="https://dominio.com/tu-miniatura.jpg" 
              />
              <small>Esta imagen super comprimida se cargará primero mientras el video de alta resolución termina de cargar.</small>
            </div>
          )}

          <div className={styles.row}>
            <div className={styles.formGroup}>
              <label>Título Grande</label>
              <input type="text" name="title" value={config.heroBanner.title} onChange={handleHeroChange} />
            </div>
            <div className={styles.formGroup}>
              <label>Subtítulo</label>
              <input type="text" name="subtitle" value={config.heroBanner.subtitle} onChange={handleHeroChange} />
            </div>
          </div>

          <div className={styles.row}>
            <div className={styles.formGroup}>
              <label>Texto del Botón</label>
              <input type="text" name="buttonText" value={config.heroBanner.buttonText} onChange={handleHeroChange} />
            </div>
            <div className={styles.formGroup}>
              <label>Enlace del Botón</label>
              <input type="text" name="buttonLink" value={config.heroBanner.buttonLink} onChange={handleHeroChange} />
            </div>
          </div>
        </div>

        <div className={styles.section}>
          <h3>Layout de la Tienda</h3>
          
          <div className={styles.formGroupCheckbox}>
            <label>
              <input 
                type="checkbox" 
                name="showHoverSecondaryMedia" 
                checked={config.layout.showHoverSecondaryMedia} 
                onChange={handleLayoutChange} 
              />
              Mostrar segunda imagen/video de producto al hacer Hover (Estilo Nude Project)
            </label>
          </div>

          <div className={styles.row}>
            <div className={styles.formGroup}>
              <label>Columnas en Desktop (PC)</label>
              <select name="productGridColumnsDesktop" value={config.layout.productGridColumnsDesktop} onChange={handleLayoutChange}>
                <option value="3">3 Productos por fila</option>
                <option value="4">4 Productos por fila</option>
                <option value="5">5 Productos por fila</option>
              </select>
            </div>
            <div className={styles.formGroup}>
              <label>Columnas en Mobile (Teléfono)</label>
              <select name="productGridColumnsMobile" value={config.layout.productGridColumnsMobile} onChange={handleLayoutChange}>
                <option value="1">1 Producto por fila</option>
                <option value="2">2 Productos por fila</option>
              </select>
            </div>
          </div>
        </div>

        <Button type="submit" variant="primary" loading={saving} disabled={saving}>
          Guardar Configuración
        </Button>
      </form>
    </div>
  );
};

export default AdminStoreEditor;
