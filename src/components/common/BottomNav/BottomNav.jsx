import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../../contexts/AuthContext';
import { useLayoutContext } from '../../../contexts/LayoutContext';
import styles from './BottomNav.module.css';
import { T } from '../../../i18n/useTranslatedText';

const navLinkClass = ({ isActive }) =>
  isActive ? `${styles.link} ${styles.linkActive}` : styles.link;

// Iniciales (1-2 letras) para el avatar cuando no hay foto — mismo criterio
// que ya usan Header.jsx y CuentaLayout.jsx, para que se vea igual en toda
// la app.
const initialsOf = (name) => {
  const clean = String(name || '').trim();
  if (!clean) return '?';
  return clean.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
};

const BottomNav = () => {
  const { user, userProfile, isAdmin } = useAuth();
  const location = useLocation();
  const { isFooterVisible } = useLayoutContext();

  // Misma fuente de verdad que el avatar del header/cuenta: foto propia
  // (avatarConfig, el editor de avatar) o, si no eligió una, la foto de
  // Google/etc. con la que inició sesión.
  const avatarUrl = userProfile?.avatarConfig?.avatarUrl || user?.photoURL || null;
  const displayName = userProfile?.displayName || userProfile?.nombre || user?.displayName || user?.email?.split('@')[0] || '';

  if (!isFooterVisible) return null;

  // Ocultar BottomNav en la ruta del editor para dar espacio al Toolbar móvil
  if (location.pathname.startsWith('/editor')) {
    return null;
  }

  return (
    <nav className={styles.bottomNav} aria-label="Navegación principal">
      {/* "/" y "/tienda" son paginas DISTINTAS (pageId 'home' vs 'tienda' en
          TiendaPage.jsx, cada una con sus propias secciones configuradas en
          Firestore: home trae el hero/marcas/testimonios, tienda va directo
          al catalogo) — antes compartian un solo tab con icono de casa que
          llevaba a /tienda, saltandose la home real pese al icono. Ahora
          cada una tiene su propio tab: casa = Inicio (la landing real),
          bolsa = Tienda (el catalogo). */}
      <NavLink to="/" className={navLinkClass} end>
        <span className={styles.icon} aria-hidden="true">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
        </span>
        <span className={styles.label}><T>Inicio</T></span>
      </NavLink>
      <NavLink to="/tienda" className={navLinkClass} end>
        <span className={styles.icon} aria-hidden="true">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
            <path d="M3 6h18" />
            <path d="M16 10a4 4 0 0 1-8 0" />
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
      <NavLink to="/minijuegos" className={navLinkClass} end>
        <span className={styles.icon} aria-hidden="true">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="6" y1="12" x2="10" y2="12"></line>
            <line x1="8" y1="10" x2="8" y2="14"></line>
            <line x1="15" y1="13" x2="15.01" y2="13"></line>
            <line x1="18" y1="11" x2="18.01" y2="11"></line>
            <rect x="2" y="6" width="20" height="12" rx="2"></rect>
          </svg>
        </span>
        <span className={styles.label}>Juegos</span>
      </NavLink>
      <NavLink to="/cuenta" className={navLinkClass} end={false}>
        <span className={styles.icon} aria-hidden="true">
          {user ? (
            avatarUrl ? (
              <img src={avatarUrl} alt="" className={styles.avatarImg} referrerPolicy="no-referrer" />
            ) : (
              <span className={styles.avatarFallback}>{initialsOf(displayName)}</span>
            )
          ) : (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          )}
        </span>
        <span className={styles.label}><T>Mi cuenta</T></span>
      </NavLink>
      {user && isAdmin && (
        <NavLink to="/admin" className={navLinkClass} aria-label="Admin">
          <span className={styles.icon} aria-hidden="true">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
              <rect x="14" y="14" width="7" height="7" rx="1" />
            </svg>
          </span>
          <span className={styles.label}>Admin</span>
        </NavLink>
      )}
    </nav>
  );
};

export default BottomNav;
