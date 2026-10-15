import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import PageLoading from '../common/PageLoading/PageLoading';
import { tieneCuenta, urlLogin } from '../../utils/rutaPrivada';

/**
 * Manda al login y deja anotada la página actual para volver al entrar.
 * Para las páginas que deciden por su cuenta cuándo pedir sesión.
 */
export function IrALogin() {
  const { pathname, search, hash } = useLocation();
  return <Navigate to={urlLogin(pathname + search + hash)} replace />;
}

/**
 * Página que pide cuenta (ver utils/rutaPrivada.js). Mientras se sabe quién
 * entra, el esqueleto de carga: decidir con la sesión aún cargando mandaría al
 * login a quien sí la tiene (al abrir un enlace o recargar).
 * Como ruta padre (<Route element={<RutaPrivada />}>) o envolviendo una página.
 */
export default function RutaPrivada({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <PageLoading />;
  if (!tieneCuenta(user)) return <IrALogin />;
  return children ?? <Outlet />;
}
