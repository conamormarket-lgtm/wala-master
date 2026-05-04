import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../../contexts/AuthContext';
import { useLayoutContext } from '../../../contexts/LayoutContext';
import styles from './BottomNav.module.css';

const navLinkClass = ({ isActive }) =>
  isActive ? `${styles.link} ${styles.linkActive}` : styles.link;

const BottomNav = () => {
  const { user } = useAuth();
  const location = useLocation();
  const { isFooterVisible } = useLayoutContext();

  if (!isFooterVisible) return null;

  // Ocultar BottomNav en la ruta del editor para dar espacio al Toolbar móvil
  if (location.pathname.startsWith('/editor')) {
    return null;
  }

  return (
    <nav className={styles.bottomNav} aria-label="Navegación principal">
      <NavLink to="/tienda" className={navLinkClass} end>
        <span className={styles.icon} aria-hidden="true">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
        </span>
        <span className={styles.label}>Tienda</span>
      </NavLink>
      <NavLink to="/personalizar" className={navLinkClass} end>
        <span className={styles.icon} aria-hidden="true">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 19l7-7 3 3-7 7-3-3z" />
            <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
            <path d="M2 2l7.586 7.586" />
            <circle cx="11" cy="11" r="2" />
          </svg>
        </span>
        <span className={styles.label}>Crear</span>
      </NavLink>
      <NavLink to="/cuenta" className={navLinkClass} end={false}>
        <span className={styles.icon} aria-hidden="true">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        </span>
        <span className={styles.label}>Mi cuenta</span>
      </NavLink>
    </nav>
  );
};

export default BottomNav;
