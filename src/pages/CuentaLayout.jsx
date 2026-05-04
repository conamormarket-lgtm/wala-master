import React from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import CuentaLoginPrompt from '../components/CuentaLoginPrompt';
import styles from './CuentaPage.module.css';

const CuentaLayout = () => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.skeletonLayout}>
          <header className={styles.skeletonHeader}>
            <div className={styles.skeletonTabs} />
            <div className={styles.skeletonProfileBtn} />
          </header>
          <div className={styles.skeletonContentBox} />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className={styles.container}>
        <div className={styles.content}>
          <CuentaLoginPrompt />
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.contentLoggedIn}>
        <header className={styles.header}>
          <nav className={styles.tabs} aria-label="Mi cuenta">
            <NavLink
              to="/cuenta/pedidos"
              className={({ isActive }) => (isActive ? `${styles.tab} ${styles.tabActive}` : styles.tab)}
            >
              Mis Pedidos
            </NavLink>
            <NavLink
              to="/cuenta/creaciones"
              className={({ isActive }) => (isActive ? `${styles.tab} ${styles.tabActive}` : styles.tab)}
            >
              Mis Creaciones
            </NavLink>
            <NavLink
              to="/cuenta/referidos"
              className={({ isActive }) => (isActive ? `${styles.tab} ${styles.tabActive}` : styles.tab)}
            >
              Mis Referidos
            </NavLink>
          </nav>
          <NavLink
            to="/cuenta/perfil"
            className={({ isActive }) => (isActive ? `${styles.profileBtn} ${styles.profileBtnActive}` : styles.profileBtn)}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            Mi Perfil
          </NavLink>
        </header>
        <div className={styles.outlet} key={location.pathname}>
          <Outlet />
        </div>
      </div>
    </div>
  );
};

export default CuentaLayout;
