import React, { useRef, useEffect } from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import CuentaLoginPrompt from '../components/CuentaLoginPrompt';
import PedidosLoginPrompt from '../components/PedidosLoginPrompt/PedidosLoginPrompt';
import styles from './CuentaPage.module.css';

const CuentaLayout = () => {
  const { user, loading } = useAuth();
  const { t } = useLanguage();
  const location = useLocation();

  // Ref al <nav> de tabs para el "asomo" animado en móvil (pista de deslizar).
  const tabsRef = useRef(null);

  // Animación "asomo" SOLO en móvil: al montar, si los tabs no caben (scrollWidth
  // > clientWidth) hacemos un auto-scroll suave de ~56px a la derecha y de vuelta
  // a 0, un par de veces, lento, para sugerir que hay más tabs deslizables.
  // Respeta prefers-reduced-motion (si reduce, no anima). Sin dependencias nuevas.
  useEffect(() => {
    if (loading || !user) return; // el nav solo existe ya logueado

    const nav = tabsRef.current;
    if (!nav) return;
    if (typeof window === 'undefined') return;
    if (window.innerWidth > 768) return; // solo móvil

    const prefersReduced =
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReduced) return;
    if (nav.scrollWidth <= nav.clientWidth) return; // no hay nada que asomar

    const HINT = 56; // px que asoma
    const timers = [];

    const peek = (delay) => {
      timers.push(
        setTimeout(() => {
          nav.scrollTo({ left: HINT, behavior: 'smooth' });
        }, delay)
      );

      timers.push(
        setTimeout(() => {
          nav.scrollTo({ left: 0, behavior: 'smooth' });
        }, delay + 550)
      );
    };

    // Dos asomos lentos, "poco a poco".
    peek(450);
    peek(1500);

    return () => {
      timers.forEach(clearTimeout);
    };
  }, [loading, user]);

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
    // Si el visitante entra directo a /cuenta/pedidos sin sesión,
    // mostramos el prompt específico de pedidos. Para el resto de cuenta,
    // mantenemos el prompt general.
    const isPedidosRoute =
      location.pathname === '/cuenta/pedidos' ||
      location.pathname.startsWith('/cuenta/pedidos/');

    return (
      <div className={styles.container}>
        <div className={styles.content}>
          {isPedidosRoute ? <PedidosLoginPrompt /> : <CuentaLoginPrompt />}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.contentLoggedIn}>
        <header className={styles.header}>
          <nav ref={tabsRef} className={styles.tabs} aria-label="Mi cuenta">
            <NavLink
              to="/cuenta/pedidos"
              className={({ isActive }) =>
                isActive ? `${styles.tab} ${styles.tabActive}` : styles.tab
              }
            >
              {t('account.misPedidos', 'Mis Pedidos')}
            </NavLink>

            {/* Rastreo del pedido por fases de producción del ERP — al lado de Mis Pedidos. */}
            <NavLink
              to="/cuenta/rastreo"
              className={({ isActive }) =>
                isActive ? `${styles.tab} ${styles.tabActive}` : styles.tab
              }
            >
              {t('account.rastreo', 'Rastreo del Pedido')}
            </NavLink>

            <NavLink
              to="/cuenta/wishlist"
              className={({ isActive }) =>
                isActive ? `${styles.tab} ${styles.tabActive}` : styles.tab
              }
            >
              {t('account.wishlist', 'Lista de Deseos')}
            </NavLink>

            <NavLink
              to="/cuenta/creaciones"
              className={({ isActive }) =>
                isActive ? `${styles.tab} ${styles.tabActive}` : styles.tab
              }
            >
              {t('account.creaciones', 'Mis Creaciones')}
            </NavLink>

            <NavLink
              to="/cuenta/referidos"
              className={({ isActive }) =>
                isActive ? `${styles.tab} ${styles.tabActive}` : styles.tab
              }
            >
              {t('account.referidos', 'Mis Referidos')}
            </NavLink>

            <NavLink
              to="/cuenta/fechas-importantes"
              className={({ isActive }) =>
                isActive ? `${styles.tab} ${styles.tabActive}` : styles.tab
              }
            >
              {t('account.fechas', 'Fechas Importantes')}
            </NavLink>

            <NavLink
              to="/cuenta/misiones"
              className={({ isActive }) =>
                isActive ? `${styles.tab} ${styles.tabActive}` : styles.tab
              }
            >
              {t('account.misiones', 'Misiones')}
            </NavLink>

            <NavLink
              to="/cuenta/catalogo"
              className={({ isActive }) =>
                isActive ? `${styles.tab} ${styles.tabActive}` : styles.tab
              }
            >
              {t('account.catalogo', 'Catálogo Recompensas')}
            </NavLink>
          </nav>

          <NavLink
            to="/cuenta/perfil"
            className={({ isActive }) =>
              isActive
                ? `${styles.profileBtn} ${styles.profileBtnActive}`
                : styles.profileBtn
            }
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            {t('account.perfil', 'Mi Perfil')}
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