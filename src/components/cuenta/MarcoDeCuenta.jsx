import React from 'react';
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { logout } from '../../services/firebase/auth';
import { IrALogin } from '../RutaPrivada/RutaPrivada';
import { tieneCuenta, urlLogin } from '../../utils/rutaPrivada';
import { MarcoCuenta, PaginaCuentaInvitado } from '../../componentes/kit/paginas/Cuenta';
import { EsqueletoPagina } from '../../componentes/kit/Esqueletos';
import { moduloDeRuta, rutaLimpia, useGruposDeCuenta } from './gruposDeCuenta';

/*
 * El marco de /cuenta (paso 6 de la migración): MarcoCuenta del kit, con el
 * menú lateral en escritorio y "← Mi cuenta" en el celular. Las secciones
 * (el <Outlet>) son las de siempre hasta que migra cada una. Lo de antes, en
 * pages/CuentaLayoutViejo.jsx (interruptor cuentaVieja).
 *
 * Igual que antes:
 *  - mientras carga la sesión, el esqueleto de la sección;
 *  - sin cuenta, la bienvenida en /cuenta y el login en cada sección;
 *  - Mis pedidos sin documento ni teléfono va a "Completar perfil" y vuelve;
 *  - el aviso "Te faltan tu documento…" con "Completar" (vuelve aquí).
 */
export default function MarcoDeCuenta() {
  const { user, userProfile, loading, profileIncomplete } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const grupos = useGruposDeCuenta();
  const ruta = rutaLimpia(location.pathname);

  if (loading) return <EsqueletoPagina forma="cuenta" modulo={moduloDeRuta(ruta)} />;

  if (!tieneCuenta(user)) {
    if (ruta === '/cuenta') {
      return <PaginaCuentaInvitado urlLogin={urlLogin('/cuenta')} urlRegistro={`/registro?redirect=${encodeURIComponent('/cuenta')}`} />;
    }
    return <IrALogin />;
  }

  // Mis pedidos necesita el documento y el teléfono: se completan y se vuelve aquí.
  const enPedidos = ruta === '/cuenta/pedidos' || ruta.startsWith('/cuenta/pedidos/');
  if (profileIncomplete && enPedidos) {
    return <Navigate to="/completar-perfil" replace state={{ from: location.pathname }} />;
  }

  const usuario = {
    nombre: userProfile?.displayName || userProfile?.nombre || user?.displayName || user?.email?.split('@')[0] || '',
    email: user?.email || '',
    avatar: userProfile?.avatarConfig?.avatarUrl || user?.photoURL || null,
  };
  const cerrarSesion = async () => {
    await logout();
    navigate('/');
  };

  return (
    <MarcoCuenta
      usuario={usuario}
      grupos={grupos}
      activo={ruta}
      onCerrarSesion={cerrarSesion}
      perfilIncompleto={Boolean(profileIncomplete)}
      estadoCompletar={{ from: location.pathname }}
    >
      <Outlet />
    </MarcoCuenta>
  );
}
