import React, { useMemo } from 'react';
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  User,
  Package,
  Truck,
  Gift,
  Ticket,
  Trophy,
  Users,
  Sparkles,
  Heart,
  Calendar,
  LogOut,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { logout } from '../services/firebase/auth';
import CuentaLoginPrompt from '../components/CuentaLoginPrompt';
import PedidosLoginPrompt from '../components/PedidosLoginPrompt/PedidosLoginPrompt';
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
  const navGroups = useMemo(() => ([
    {
      label: t('account.grupoCuenta', 'Cuenta'),
      items: [
        { to: '/cuenta/perfil', label: t('account.perfil', 'Mi Perfil'), icon: User },
        { to: '/cuenta/pedidos', label: t('account.misPedidos', 'Mis Pedidos'), icon: Package },
        { to: '/cuenta/rastreo', label: t('account.rastreo', 'Rastreo del Pedido'), icon: Truck },
      ],
    },
    {
      label: t('account.grupoRecompensas', 'Recompensas'),
      items: [
        { to: '/cuenta/catalogo', label: t('account.catalogo', 'Catálogo Recompensas'), icon: Gift },
        { to: '/cuenta/cupones', label: t('account.cupones', 'Mis Cupones'), icon: Ticket },
        { to: '/cuenta/misiones', label: t('account.misiones', 'Misiones'), icon: Trophy },
        { to: '/cuenta/referidos', label: t('account.referidos', 'Mis Referidos'), icon: Users },
      ],
    },
    {
      label: t('account.grupoPersonalizacion', 'Personalización'),
      items: [
        { to: '/cuenta/creaciones', label: t('account.creaciones', 'Mis Creaciones'), icon: Sparkles },
        { to: '/cuenta/wishlist', label: t('account.wishlist', 'Lista de Deseos'), icon: Heart },
        { to: '/cuenta/fechas-importantes', label: t('account.fechas', 'Fechas Importantes'), icon: Calendar },
      ],
    },
  ]), [t]);

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

          {/* Móvil (<900px): el sidebar se reemplaza por un selector agrupado
              (optgroup por categoría) en vez de una fila de píldoras con
              scroll horizontal — mismo patrón que usan paneles de ajustes
              "serios" en pantallas chicas. */}
          <div className={styles.sidebarMobile}>
            <select
              className={styles.sidebarSelect}
              value={location.pathname}
              onChange={(e) => navigate(e.target.value)}
              aria-label={t('account.menu', 'Menú de cuenta')}
            >
              {navGroups.map((group) => (
                <optgroup key={group.label} label={group.label}>
                  {group.items.map((item) => (
                    <option key={item.to} value={item.to}>{item.label}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          <div className={styles.outlet} key={location.pathname}>
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  );
};

export default CuentaLayout;
