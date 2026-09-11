import React, { useMemo } from 'react';
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { logout } from '../services/firebase/auth';
import CuentaLoginPrompt from '../components/CuentaLoginPrompt';
import PedidosLoginPrompt from '../components/PedidosLoginPrompt/PedidosLoginPrompt';
import { useCuentaNavGroups } from './cuenta/useCuentaNavGroups';
import styles from './CuentaPage.module.css';

// Iniciales (1-2 letras) para el avatar del sidebar cuando no hay foto —
// mismo criterio que usa el header (Header.jsx) para que el avatar de
// iniciales se vea igual en toda la app.
const initialsOf = (name) => {
  const clean = String(name || '').trim();
  if (!clean) return '?';
  return clean.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
};

const CuentaLayout = () => {
  const { user, userProfile, loading } = useAuth();
  const { t } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();

  // Menú de cuenta agrupado por categoría (antes: una sola fila de 9 tabs en
  // píldora, sin jerarquía — "Mis Cupones" pesaba visualmente igual que
  // "Mis Pedidos"). Un sidebar agrupado es el patrón de un panel de cuenta
  // "serio" (Stripe/Notion/Linear) en vez de un segmented-control de app.
  // Datos compartidos con CuentaResumenPage (la grilla de accesos directos
  // que ve el usuario apenas entra a /cuenta) — ver useCuentaNavGroups.
  const rawNavGroups = useCuentaNavGroups();
  const navGroups = useMemo(
    () => rawNavGroups.map((group) => ({
      label: t(group.label, group.labelFallback),
      items: group.items.map((item) => ({ ...item, label: t(item.labelKey, item.label) })),
    })),
    [rawNavGroups, t]
  );

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.skeletonLayout}>
          <div className={styles.skeletonShell}>
            <div className={styles.skeletonSidebar} />
            <div className={styles.skeletonContentBox} />
          </div>
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
      <div className={`${styles.container} ${styles.containerAuth}`}>
        <div className={styles.content}>
          {isPedidosRoute ? <PedidosLoginPrompt /> : <CuentaLoginPrompt />}
        </div>
      </div>
    );
  }

  const avatarUrl = userProfile?.avatarConfig?.avatarUrl || user?.photoURL || null;
  const displayName = userProfile?.displayName || userProfile?.nombre || user?.displayName || user?.email?.split('@')[0] || '';
  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <div className={styles.container}>
      <div className={styles.contentLoggedIn}>
        <div className={styles.shell}>
          {/* Sidebar (≥900px): agrupado por categoría, con identidad arriba. */}
          <aside className={styles.sidebar} aria-label={t('account.menu', 'Menú de cuenta')}>
            <div className={styles.sidebarIdentity}>
              {avatarUrl ? (
                <img src={avatarUrl} alt="" className={styles.sidebarAvatar} referrerPolicy="no-referrer" />
              ) : (
                <span className={styles.sidebarAvatarFallback} aria-hidden="true">{initialsOf(displayName)}</span>
              )}
              <div className={styles.sidebarIdentityText}>
                <p className={styles.sidebarName}>{displayName}</p>
                <p className={styles.sidebarEmail}>{user.email}</p>
              </div>
            </div>

            {navGroups.map((group) => (
              <div key={group.label} className={styles.navGroup}>
                <p className={styles.navGroupLabel}>{group.label}</p>
                {group.items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) =>
                      isActive ? `${styles.navItem} ${styles.navItemActive}` : styles.navItem
                    }
                  >
                    <item.icon size={18} strokeWidth={1.75} className={styles.navItemIcon} aria-hidden="true" />
                    <span>{item.label}</span>
                  </NavLink>
                ))}
              </div>
            ))}

            <button type="button" className={styles.navLogout} onClick={handleLogout}>
              <LogOut size={18} strokeWidth={1.75} aria-hidden="true" />
              <span>{t('account.cerrarSesion', 'Cerrar sesión')}</span>
            </button>
          </aside>

          {/* Antes había acá, en móvil: una tarjeta de identidad (avatar/
              nombre/correo/monedas) y un selector "Menú de cuenta" — ambos
              repetidos en CADA página de /cuenta. La identidad ya está en
              "Mi Perfil" y en las monedas del header; el selector, en la
              grilla de accesos directos de CuentaResumenPage (que además es
              justo a donde vuelve el tab "Mi cuenta" del BottomNav). Sin
              ellos, cada sección de /cuenta se ve como una pantalla propia
              en vez de una lista de tabs con la misma cabecera repetida
              arriba de cada una. */}

          <div className={styles.outlet} key={location.pathname}>
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  );
};

export default CuentaLayout;
