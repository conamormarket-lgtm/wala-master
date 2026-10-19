import React, { lazy, Suspense } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useLayoutContext } from '../../contexts/LayoutContext';
import useLoViejo from '../../hooks/useLoViejo';
import { tieneCuenta } from '../../utils/rutaPrivada';
import { BarraInferior } from '../../componentes/kit/BarraInferior';
import s from './BarraInferiorDeTienda.module.css';

// La barra de antes, solo con el interruptor barraVieja (guia/ELIMINAR.md).
const BottomNav = lazy(() => import('../common/BottomNav'));

/** La pestaña de la ruta: las cuatro primeras exactas, "Mi cuenta" con todo /cuenta/…; si no, ninguna. */
const EXACTAS = { '/': 'inicio', '/tienda': 'tienda', '/personalizar': 'crear', '/minijuegos': 'juegos' };
const pestanaDeRuta = (ruta) => {
  const limpia = ruta.length > 1 ? ruta.replace(/\/+$/, '') : ruta;
  if (EXACTAS[limpia]) return EXACTAS[limpia];
  if (limpia === '/cuenta' || limpia.startsWith('/cuenta/')) return 'cuenta';
  return null;
};

/*
 * Barra inferior del celular (M6) con el kit. Mismas reglas que BottomNav:
 *  - Solo hasta 768 px, fija abajo, 56 px (--bottom-nav-height) + la zona segura.
 *  - No sale si la página la apaga (landings del builder con "sin pie", el
 *    editor visual) ni en el estudio (/crear/…) y el editor viejo (/editor).
 * Diferencias a propósito (guia/INICIO.md): sin pestaña "Admin" (el panel se
 * abre desde BarraAdmin) y sin el "?" de la sesión anónima (el ícono de
 * persona); sin número en "Tienda" (el carrito lo tiene en la cabecera).
 * Interruptor barraVieja: vuelve BottomNav.
 */
export default function BarraInferiorDeTienda() {
  const { pathname } = useLocation();
  const { user, userProfile } = useAuth();
  const { isFooterVisible } = useLayoutContext();
  const barraVieja = useLoViejo('barra');

  if (barraVieja) return <Suspense fallback={null}><BottomNav /></Suspense>;
  if (!isFooterVisible || pathname.startsWith('/editor') || pathname.startsWith('/crear/')) return null;

  // La misma foto y el mismo nombre que la cabecera y Mi cuenta.
  const usuario = tieneCuenta(user) ? {
    nombre: userProfile?.displayName || userProfile?.nombre || user?.displayName || user?.email?.split('@')[0] || '',
    avatar: userProfile?.avatarConfig?.avatarUrl || user?.photoURL || null,
  } : null;

  return (
    <div className={s.fija} data-componente="BarraInferior">
      <BarraInferior activo={pestanaDeRuta(pathname)} usuario={usuario} />
    </div>
  );
}
