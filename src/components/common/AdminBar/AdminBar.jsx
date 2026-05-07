import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../../contexts/AuthContext';
import { useVisualEditor } from '../../../pages/Tienda/contexts/VisualEditorContext';
import styles from './AdminBar.module.css';
import { Settings, Save, Eye, Edit2 } from 'lucide-react';

const AdminBar = () => {
  const { isAdmin } = useAuth();
  const location = useLocation();
  const { isEditModeActive, toggleEditMode } = useVisualEditor();

  if (!isAdmin) return null;

  // Determinar qué enlace de edición mostrar dependiendo de la página actual
  let editLink = '/admin';
  let editText = 'Panel de Administración';
  let isStorefront = true; // Habilitado en todas partes para el Page Builder

  if (location.pathname.startsWith('/producto/')) {
    const productId = location.pathname.split('/')[2];
    editLink = `/admin/productos/${productId}`;
    editText = 'Editar este Producto';
    isStorefront = false; // Aquí mostramos el botón directo de editar producto
  } else if (location.pathname.startsWith('/admin') || location.pathname.startsWith('/login') || location.pathname.startsWith('/registro')) {
    isStorefront = false;
  }

  if (isStorefront) {
    editText = isEditModeActive ? 'Terminar Edición Visual' : 'Activar Edición Visual (WYSIWYG)';
  }

  return (
    <div className={styles.adminBar}>
      <div className={styles.adminBarContainer}>
        <div className={styles.adminInfo}>
          <span className={styles.icon} style={{ display: 'flex', alignItems: 'center' }}><Settings size={16} strokeWidth={1.5} /></span>
          <span className={styles.text}>Modo Administrador Activo</span>
        </div>
        <div className={styles.adminActions}>
          {isStorefront ? (
            <button 
              onClick={toggleEditMode} 
              className={`${styles.editButton} ${isEditModeActive ? styles.activeEdit : ''}`}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              {isEditModeActive ? <><Save size={16} strokeWidth={1.5} /> Guardar / Salir</> : <><Eye size={16} strokeWidth={1.5} /> Activar Editor Visual</>}
            </button>
          ) : (
            <Link to={editLink} className={styles.editButton} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Edit2 size={16} strokeWidth={1.5} /> {editText}
            </Link>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminBar;
