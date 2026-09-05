import React, { useLayoutEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { useAuth } from '../../../contexts/AuthContext';
import { useVisualEditor } from '../../../pages/Tienda/contexts/VisualEditorContext';
import styles from './AdminBar.module.css';
import { Settings, Save, Eye, Edit2 } from 'lucide-react';

const AdminBar = () => {
  const { isAdmin } = useAuth();
  const location = useLocation();
  const { isEditModeActive, toggleEditMode } = useVisualEditor();
  const barRef = useRef(null);

  // Esta barra y el <Header/> (App.jsx los renderiza uno tras otro) son
  // AMBOS position:sticky; top:0 — al hacer scroll, los dos "quieren"
  // pegarse al mismo y=0 del viewport. Como esta barra tiene un z-index
  // mucho mayor (9999 vs el del header), termina tapando al header en vez
  // de apilarse arriba de el. Medimos el alto REAL de esta barra (no un
  // numero fijo: cambia un poco segun idioma/tamaño de fuente) y lo
  // publicamos como variable global; Header.module.css la usa como su
  // propio `top`, así que el header se pega justo DEBAJO de esta barra en
  // vez de competir por el mismo lugar. Sin admin (barra desmontada), la
  // variable se limpia y el header vuelve a pegarse a top:0 como siempre.
  useLayoutEffect(() => {
    if (!isAdmin) {
      document.documentElement.style.removeProperty('--admin-bar-height');
      return undefined;
    }
    const el = barRef.current;
    if (!el) return undefined;
    const setHeight = () => {
      document.documentElement.style.setProperty('--admin-bar-height', `${el.offsetHeight}px`);
    };
    setHeight();
    const ro = new ResizeObserver(setHeight);
    ro.observe(el);
    return () => {
      ro.disconnect();
      document.documentElement.style.removeProperty('--admin-bar-height');
    };
  }, [isAdmin]);

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

  // Desactivar la edición de landing pages (editor visual) en la app móvil nativa
  if (isStorefront && Capacitor.isNativePlatform()) return null;

  if (isStorefront) {
    editText = isEditModeActive ? 'Terminar Edición Visual' : 'Activar Edición Visual (WYSIWYG)';
  }

  return (
    <div className={styles.adminBar} ref={barRef}>
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
