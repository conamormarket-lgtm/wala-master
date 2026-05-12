import React, { useState, useEffect } from 'react';
import { Upload, Plus, Trash2, X, Edit, Code } from 'lucide-react';
import { getThemes, saveTheme, deleteTheme } from '../services/themes';
// Importaremos JSZip dinámicamente para no cargar el bundle inicial si no es necesario
// import JSZip from 'jszip';

import styles from './AdminThemes.module.css';

const AdminThemes = () => {
  const [themes, setThemes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState(null); // 'upload' o 'manual'
  
  // Estado para crear manual
  const [manualTheme, setManualTheme] = useState({ name: '', author: '', cssContent: '' });
  const [editingId, setEditingId] = useState(null);

  // Estado para subida
  const [uploadStatus, setUploadStatus] = useState('');

  const fetchThemes = async () => {
    setLoading(true);
    const data = await getThemes();
    setThemes(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchThemes();
  }, []);

  const openManualModal = (theme = null) => {
    if (theme) {
      setManualTheme({ name: theme.name, author: theme.author || '', cssContent: theme.cssContent || '' });
      setEditingId(theme.id);
    } else {
      setManualTheme({ name: '', author: '', cssContent: '' });
      setEditingId(null);
    }
    setModalType('manual');
    setIsModalOpen(true);
  };

  const openUploadModal = () => {
    setUploadStatus('');
    setModalType('upload');
    setIsModalOpen(true);
  };

  const handleSaveManual = async () => {
    if (!manualTheme.name || !manualTheme.cssContent) {
      return alert('El nombre y el CSS son obligatorios.');
    }
    
    setUploadStatus('Guardando...');
    const themeData = {
      name: manualTheme.name,
      author: manualTheme.author || 'Custom',
      type: 'custom_css',
      cssContent: manualTheme.cssContent,
      version: '1.0'
    };

    const res = await saveTheme(editingId, themeData);
    if (res.success) {
      alert('Tema guardado con éxito');
      setIsModalOpen(false);
      fetchThemes();
    } else {
      alert('Error: ' + res.error);
    }
    setUploadStatus('');
  };

  const handleDelete = async (id) => {
    if (window.confirm('¿Seguro que deseas eliminar este tema? Las Landing Pages que lo usen perderán su estilo.')) {
      await deleteTheme(id);
      fetchThemes();
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    if (!file.name.endsWith('.zip')) {
      return alert('Por favor, sube un archivo .zip');
    }

    setUploadStatus('Procesando archivo ZIP...');
    
    try {
      // Importación dinámica de jszip
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();
      const loadedZip = await zip.loadAsync(file);
      
      // Buscar TODOS los archivos .css en el zip
      let cssPromises = [];
      let mainStyleFile = null;
      
      loadedZip.forEach((relativePath, zipEntry) => {
        if (relativePath.endsWith('.css') && !relativePath.includes('__MACOSX') && !relativePath.includes('/vendor/') && !relativePath.includes('/node_modules/')) {
          if (relativePath.endsWith('style.css') && relativePath.split('/').length <= 2) {
            mainStyleFile = zipEntry;
          }
          cssPromises.push(zipEntry.async('string'));
        }
      });

      if (cssPromises.length === 0) {
        setUploadStatus('');
        return alert('No se encontró ningún archivo .css válido en el tema.');
      }

      setUploadStatus('Extrayendo todo el CSS...');
      const allCssContents = await Promise.all(cssPromises);
      
      // Juntar todos los CSS en un solo string gigante
      const combinedCss = allCssContents.join('\n\n/* --- Siguiente Archivo --- */\n\n');

      // Extraer metadatos solo del style.css principal si existe, si no del primer archivo
      const metadataSource = mainStyleFile ? await mainStyleFile.async('string') : allCssContents[0];
      const nameMatch = metadataSource.match(/Theme Name:\s*(.*)/i);
      const authorMatch = metadataSource.match(/Author:\s*(.*)/i);
      const versionMatch = metadataSource.match(/Version:\s*(.*)/i);

      const themeName = nameMatch ? nameMatch[1].trim() : file.name.replace('.zip', '');
      const themeAuthor = authorMatch ? authorMatch[1].trim() : 'Desconocido';
      const themeVersion = versionMatch ? versionMatch[1].trim() : '1.0';

      setUploadStatus('Guardando Tema en Base de Datos...');
      
      // (Nota Futura: Aquí iría la lógica para buscar en el zip la carpeta assets, subir las imágenes a Firebase Storage y hacer un .replace() en cssContent).
      // Por ahora guardamos el CSS extraído de forma directa.

      const themeData = {
        name: themeName,
        author: themeAuthor,
        version: themeVersion,
        type: 'wordpress_import',
        cssContent: combinedCss
      };

      const res = await saveTheme(null, themeData);
      if (res.success) {
        setUploadStatus('');
        setIsModalOpen(false);
        fetchThemes();
        alert('Tema extraído e importado con éxito.');
      } else {
        throw new Error(res.error);
      }

    } catch (error) {
      console.error(error);
      setUploadStatus('');
      alert('Hubo un error al procesar el archivo: ' + error.message);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>Gestor de Temas</h1>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button className={styles.actionBtn} onClick={openUploadModal}>
            <Upload size={18} /> Subir Tema (.zip)
          </button>
          <button className={styles.actionBtn} style={{ background: '#475569' }} onClick={() => openManualModal()}>
            <Code size={18} /> Crear Tema Manual
          </button>
        </div>
      </div>

      {loading ? (
        <p>Cargando temas...</p>
      ) : themes.length === 0 ? (
        <p>No hay temas creados. Sube o crea uno para empezar.</p>
      ) : (
        <div className={styles.grid}>
          {themes.map(theme => (
            <div key={theme.id} className={styles.themeCard}>
              <span className={styles.themeTypeBadge}>
                {theme.type === 'wordpress_import' ? 'WordPress Import' : 'Custom CSS'}
              </span>
              <h3>{theme.name}</h3>
              <div className={styles.themeMeta}>
                <p>Autor: {theme.author}</p>
                <p>Versión: {theme.version}</p>
              </div>
              
              <div className={styles.themeActions}>
                <button className={styles.editBtn} onClick={() => openManualModal(theme)}>
                  <Edit size={16} /> Editar
                </button>
                <button className={styles.dangerBtn} onClick={() => handleDelete(theme.id)}>
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <div className={styles.modalOverlay}>
          <div className={`${styles.modalContent} ${modalType === 'manual' ? styles.large : ''}`}>
            <button className={styles.closeModalBtn} onClick={() => setIsModalOpen(false)}><X size={24} /></button>
            
            {modalType === 'upload' && (
              <div>
                <h2>Importar Tema de WordPress</h2>
                <p>Sube el archivo `.zip` del tema. El sistema extraerá el `style.css` y los metadatos de forma automática.</p>
                <div className={styles.dropzone}>
                  <label htmlFor="theme-upload" style={{ cursor: 'pointer', display: 'block' }}>
                    <Upload size={40} color="#3b82f6" style={{ margin: '0 auto 1rem' }}/>
                    <p>Haz clic para seleccionar el .zip</p>
                    <input 
                      id="theme-upload" 
                      type="file" 
                      accept=".zip" 
                      style={{ display: 'none' }} 
                      onChange={handleFileUpload}
                    />
                  </label>
                </div>
                {uploadStatus && <p style={{ marginTop: '1rem', color: '#2563eb', fontWeight: 'bold' }}>{uploadStatus}</p>}
              </div>
            )}

            {modalType === 'manual' && (
              <div>
                <h2>{editingId ? 'Editar Tema' : 'Nuevo Tema Manual'}</h2>
                <div className={styles.formGroup}>
                  <label>Nombre del Tema</label>
                  <input type="text" className={styles.input} value={manualTheme.name} onChange={e => setManualTheme({...manualTheme, name: e.target.value})} placeholder="Ej: Tema Oscuro" />
                </div>
                <div className={styles.formGroup}>
                  <label>Autor</label>
                  <input type="text" className={styles.input} value={manualTheme.author} onChange={e => setManualTheme({...manualTheme, author: e.target.value})} placeholder="Opcional" />
                </div>
                <div className={styles.formGroup}>
                  <label>Código CSS</label>
                  <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '0.5rem' }}>Escribe las reglas CSS aquí. Serán aplicadas únicamente dentro del contenedor de la Landing Page asignada.</p>
                  <textarea 
                    className={styles.textarea} 
                    value={manualTheme.cssContent} 
                    onChange={e => setManualTheme({...manualTheme, cssContent: e.target.value})}
                    placeholder="/* Escribe tu CSS personalizado aquí */"
                  />
                </div>
                <button className={styles.actionBtn} onClick={handleSaveManual} disabled={!!uploadStatus}>
                  {uploadStatus || 'Guardar Tema'}
                </button>
              </div>
            )}

          </div>
        </div>
      )}
    </div>
  );
};

export default AdminThemes;
