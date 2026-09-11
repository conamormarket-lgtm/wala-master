import React, { useMemo, useState, useRef, useEffect } from 'react';
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { LogOut, ChevronDown } from 'lucide-react';
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

  // Selector de cuenta en móvil: antes era un <select> nativo — funcional,
  // pero el popup de opciones lo pinta el sistema operativo (gris, sin
  // radios ni tipografía del sitio) y desentonaba con el resto, que usa
  // desplegables propios en todos lados. Este es el mismo patrón que ya usan
  // los menús del header: botón + panel absoluto que se cierra solo.
  const [menuCuentaAbierto, setMenuCuentaAbierto] = useState(false);
  const menuCuentaRef = useRef(null);

  useEffect(() => {
    if (!menuCuentaAbierto) return undefined;
    const cerrarSiEsAfuera = (e) => {
      if (menuCuentaRef.current && !menuCuentaRef.current.contains(e.target)) {
        setMenuCuentaAbierto(false);
      }
    };
    document.addEventListener('mousedown', cerrarSiEsAfuera);
    return () => document.removeEventListener('mousedown', cerrarSiEsAfuera);
  }, [menuCuentaAbierto]);

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

  // Opción resaltada en el botón del selector móvil: la página actual.
  const itemActual = useMemo(
    () => navGroups.flatMap((g) => g.items).find((item) => item.to === location.pathname),
    [navGroups, location.pathname]
  );

  // En /cuenta (el índice — CuentaResumenPage) el selector "Menú de cuenta"
  // quedaba repetido: la propia grilla de abajo YA muestra, una por una,
  // esas mismas opciones. En el resto de /cuenta/* (donde no hay grilla)
  // sigue sirviendo: deja saltar a otra sección sin volver primero al
  // resumen.
  const isCuentaIndex = location.pathname === '/cuenta';

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

          {/* Antes había acá una tarjeta de identidad (avatar/nombre/correo/
              monedas) repetida en CADA página de /cuenta — el mismo dato que
              ya está en "Mi Perfil" (nombre/foto/correo) y en las monedas
              del header (arriba de toda la app). Se quita del todo: no
              aporta nada que no esté ya visible en otro lado. */}

          {/* Móvil (<900px): el sidebar se reemplaza por este selector agrupado
              — mismo patrón que usan los desplegables del header (botón +
              panel propio), en vez de un <select> nativo: ese delega el
              popup de opciones al sistema operativo, que lo pinta gris y sin
              nada del estilo del sitio (radios, tipografía, colores de
              marca), y desentonaba con cualquier otro menú de la página.
              Oculto en /cuenta: sería un selector con las mismas opciones que
              ya están, una a una, en la grilla de abajo. */}
          {!isCuentaIndex && (
            <div className={styles.sidebarMobile} ref={menuCuentaRef}>
              <button
                type="button"
                className={styles.sidebarSelectBtn}
                onClick={() => setMenuCuentaAbierto((v) => !v)}
                aria-haspopup="listbox"
                aria-expanded={menuCuentaAbierto}
              >
                {itemActual && (
                  <itemActual.icon size={18} strokeWidth={1.75} aria-hidden="true" />
                )}
                <span className={styles.sidebarSelectBtnLabel}>
                  {itemActual?.label || t('account.menu', 'Menú de cuenta')}
                </span>
                <ChevronDown
                  size={18}
                  strokeWidth={2}
                  aria-hidden="true"
                  className={`${styles.sidebarSelectChevron} ${menuCuentaAbierto ? styles.sidebarSelectChevronOpen : ''}`}
                />
              </button>

              {menuCuentaAbierto && (
                <div className={styles.sidebarSelectMenu} role="listbox" aria-label={t('account.menu', 'Menú de cuenta')}>
                  {navGroups.map((group) => (
                    <div key={group.label} className={styles.sidebarSelectGroup}>
                      <p className={styles.sidebarSelectGroupLabel}>{group.label}</p>
                      {group.items.map((item) => {
                        const activo = location.pathname === item.to;
                        return (
                          <button
                            key={item.to}
                            type="button"
                            role="option"
                            aria-selected={activo}
                            className={`${styles.sidebarSelectOption} ${activo ? styles.sidebarSelectOptionActive : ''}`}
                            onClick={() => { navigate(item.to); setMenuCuentaAbierto(false); }}
                          >
                            <item.icon size={16} strokeWidth={1.75} aria-hidden="true" />
                            <span>{item.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className={styles.outlet} key={location.pathname}>
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  );
};

export default CuentaLayout;
