import React, { useState } from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import styles from './AdminLayout.module.css';

const ChevronIcon = ({ open }) => (
  <svg
    className={`${styles.chevron} ${open ? styles.chevronOpen : ''}`}
    viewBox="0 0 24 24"
  >
    <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z"/>
  </svg>
);

const AdminLayout = () => {
  const { adminPermissions } = useAuth();
  
  // Helpers for permissions
  const isSuper = adminPermissions?.includes('superadmin');
  const canDesign = isSuper || adminPermissions?.includes('manage_design');
  const canProducts = isSuper || adminPermissions?.includes('manage_products');
  const canInventory = isSuper || adminPermissions?.includes('manage_inventory');
  const canClients = isSuper || adminPermissions?.includes('manage_clients');
  const canLandingPages = isSuper || adminPermissions?.includes('manage_landing_pages');

  const showCatalogGroup = canProducts || canInventory || canLandingPages;

  const [openGroups, setOpenGroups] = useState({
    diseno: true,
    catalogo: true,
    clientes: true
  });

  const toggleGroup = (key) => {
    setOpenGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const getLinkClass = (isActive, groupKey) => {
    const base = isActive ? `${styles.link} ${styles.linkActive}` : styles.link;
    const hideClass = !openGroups[groupKey] ? styles.linkHiddenDesktop : '';
    return `${base} ${hideClass}`.trim();
  };

  return (
    <div className={styles.container}>
      <aside className={styles.sidebar}>
        <nav className={styles.nav} aria-label="Administración">
          
          {isSuper && (
            <>
              <h3 className={styles.sidebarGroupTitle} onClick={() => toggleGroup('config')}>
                <span>Ajustes</span>
                <ChevronIcon open={openGroups.config !== false} />
              </h3>
              <NavLink
                to="/admin/configuracion"
                className={({ isActive }) => getLinkClass(isActive, 'config')}
                style={{ display: 'flex', alignItems: 'center', gap: '10px' }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3"></circle>
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                </svg>
                Configuración
              </NavLink>
            </>
          )}

          {canDesign && (
            <>
              <h3 className={styles.sidebarGroupTitle} onClick={() => toggleGroup('diseno')}>
                <span>Diseño de Tienda</span>
                <ChevronIcon open={openGroups.diseno} />
              </h3>
              <NavLink
                to="/admin"
                className={({ isActive }) => getLinkClass(isActive, 'diseno')}
                end
              >
                Panel Principal
              </NavLink>
              <a
                href="/tienda"
                className={getLinkClass(false, 'diseno')}
              >
                Vista Tienda (WYSIWYG)
              </a>
              <NavLink
                to="/admin/destacados"
                className={({ isActive }) => getLinkClass(isActive, 'diseno')}
              >
                Destacados
              </NavLink>
              <NavLink
                to="/admin/whatsapp"
                className={({ isActive }) => getLinkClass(isActive, 'diseno')}
              >
                WhatsApp
              </NavLink>
              <NavLink
                to="/admin/backups"
                className={({ isActive }) => getLinkClass(isActive, 'diseno')}
              >
                Historial y Backups
              </NavLink>
              <NavLink
                to="/admin/mascota"
                className={({ isActive }) => getLinkClass(isActive, 'diseno')}
              >
                Mascota
              </NavLink>
            </>
          )}

          {showCatalogGroup && (
            <>
              <h3 className={styles.sidebarGroupTitle} onClick={() => toggleGroup('catalogo')}>
                <span>Catálogo</span>
                <ChevronIcon open={openGroups.catalogo} />
              </h3>
              {canProducts && (
                <NavLink
                  to="/admin/productos"
                  className={({ isActive }) => getLinkClass(isActive, 'catalogo')}
                >
                  Productos
                </NavLink>
              )}
              {canInventory && (
                <NavLink
                  to="/admin/inventario"
                  className={({ isActive }) => getLinkClass(isActive, 'catalogo')}
                >
                  Inventario
                </NavLink>
              )}
              {canProducts && (
                <>
                  <NavLink
                    to="/admin/categorias"
                    className={({ isActive }) => getLinkClass(isActive, 'catalogo')}
                  >
                    Categorías
                  </NavLink>
                  <NavLink
                    to="/admin/colecciones"
                    className={({ isActive }) => getLinkClass(isActive, 'catalogo')}
                  >
                    Colecciones
                  </NavLink>
                  <NavLink
                    to="/admin/marcas"
                    className={({ isActive }) => getLinkClass(isActive, 'catalogo')}
                  >
                    Marcas
                  </NavLink>
                  {canLandingPages && (
                    <NavLink
                      to="/admin/landing-pages"
                      className={({ isActive }) => getLinkClass(isActive, 'catalogo')}
                    >
                      Landing Pages
                    </NavLink>
                  )}
                  <NavLink
                    to="/admin/cliparts"
                    className={({ isActive }) => getLinkClass(isActive, 'catalogo')}
                  >
                    Cliparts
                  </NavLink>
                </>
              )}
            </>
          )}

          {canClients && (
            <>
              <h3 className={styles.sidebarGroupTitle} onClick={() => toggleGroup('clientes')}>
                <span>Clientes y Pagos</span>
                <ChevronIcon open={openGroups.clientes} />
              </h3>
              <NavLink
                to="/admin/pagos"
                className={({ isActive }) => getLinkClass(isActive, 'clientes')}
              >
                Métodos de Pago
              </NavLink>
              <NavLink
                to="/admin/referidos"
                className={({ isActive }) => getLinkClass(isActive, 'clientes')}
              >
                Gestión de Referidos
              </NavLink>
              <NavLink
                to="/admin/crear-cuentas-pedidos"
                className={({ isActive }) => getLinkClass(isActive, 'clientes')}
              >
                Crear cuentas de pedidos
              </NavLink>
              <NavLink
                to="/admin/usuarios-analytics"
                className={({ isActive }) => getLinkClass(isActive, 'clientes')}
              >
                Usuarios y métricas
              </NavLink>
            </>
          )}

          )}

        </nav>
      </aside>
      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  );
};

export default AdminLayout;
