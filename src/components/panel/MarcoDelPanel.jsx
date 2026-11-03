import React, { Suspense, useEffect, useMemo } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useLayoutContext } from '../../contexts/LayoutContext';
import { logout } from '../../services/firebase/auth';
import { MarcoAdmin, SinPermiso } from '../../componentes/kit/piezas/admin/Marco';
import { EsqueletoPaginaAdmin } from '../../componentes/kit/piezas/admin/CargandoPanel';
import {
  MENU_ADMIN, PERMISOS_ADMIN, menuAdminPara, accesosAdminPara, opcionActiva, textoPermisos,
} from '../../componentes/kit/adaptadoresAdmin';

/** La opción del menú de una ruta: las fichas de Crear viven bajo Productos. */
export const rutaDelMenu = (pathname) => {
  const ruta = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  return ruta.startsWith('/admin/prendas-crear') ? '/admin/productos' : ruta;
};

/*
 * El marco del panel (D0, guia/ADMIN.md): MarcoAdmin con el menú filtrado por
 * los permisos de hoy (las mismas reglas de AdminLayout, en adaptadoresAdmin).
 *  - Sin la cabecera, el pie ni la barra de la tienda: el marco trae su menú,
 *    su cabecera del celular y su propia barra inferior.
 *  - Una ruta que está en el menú pero no en el de este admin muestra
 *    SinPermiso (antes se abría escribiendo la dirección). Las que no están
 *    en el menú (direcciones viejas que redirigen, fichas de un sorteo…)
 *    abren igual que antes: AdminRoute sigue decidiendo la entrada.
 * Interruptor adminViejo: vuelve AdminLayout (AdminLayoutViejo).
 */
export default function MarcoDelPanel() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { user, userProfile, adminPermissions } = useAuth();
  const { setHeaderVisible, setFooterVisible } = useLayoutContext() || {};

  useEffect(() => {
    setHeaderVisible?.(false);
    setFooterVisible?.(false);
    return () => {
      setHeaderVisible?.(true);
      setFooterVisible?.(true);
    };
  }, [setHeaderVisible, setFooterVisible]);

  const permisos = useMemo(() => adminPermissions || [], [adminPermissions]);
  const grupos = useMemo(() => menuAdminPara(permisos), [permisos]);
  const accesos = useMemo(() => accesosAdminPara(permisos), [permisos]);
  const ruta = rutaDelMenu(pathname);

  // ¿Está en el menú completo pero no en el suyo? Qué permiso pedir.
  const enMenu = opcionActiva(MENU_ADMIN, ruta);
  const sinPermiso = enMenu && !opcionActiva(grupos, ruta);
  const permisoQueFalta = sinPermiso
    ? PERMISOS_ADMIN.find((p) => (enMenu.item.permiso || []).includes(p.valor))?.texto || 'Super Admin'
    : undefined;

  // El mismo nombre y la misma foto que la cabecera y Mi cuenta.
  const usuario = {
    nombre: userProfile?.displayName || userProfile?.nombre || user?.displayName || user?.email?.split('@')[0] || 'Admin',
    email: user?.email || '',
    avatar: userProfile?.avatarConfig?.avatarUrl || user?.photoURL || undefined,
    rol: textoPermisos(permisos),
  };

  return (
    <MarcoAdmin
      grupos={grupos}
      activo={ruta}
      accesos={accesos}
      usuario={usuario}
      urlTienda="/"
      // Primero fuera del panel: si se cierra antes, AdminRoute manda al login.
      onCerrarSesion={async () => { navigate('/'); await logout(); }}
      onNavegar={() => window.scrollTo(0, 0)}
    >
      {/* Mientras baja el código de una página, su esqueleto dentro del marco (sin esto, el de la tienda tapaba todo). */}
      {sinPermiso ? <SinPermiso permiso={permisoQueFalta} /> : <Suspense fallback={<EsqueletoPaginaAdmin />}><Outlet /></Suspense>}
    </MarcoAdmin>
  );
}
