import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { IrALogin } from '../RutaPrivada/RutaPrivada';
import { tieneCuenta } from '../../utils/rutaPrivada';

/**
 * Ruta protegida: solo usuarios con rol admin pueden acceder (isAdmin viene de
 * AuthContext: custom claim de Firebase Auth o permisos en adminRoles — nunca de
 * localStorage ni de un email hardcodeado).
 * Sin cuenta → al login y, al entrar, de vuelta a la misma página del admin.
 * Con cuenta pero sin ser admin → redirige a inicio.
 */
const AdminRoute = () => {
  const { user, loading, isAdmin } = useAuth();

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <span>Verificando acceso...</span>
      </div>
    );
  }

  if (!tieneCuenta(user) && !isAdmin) {
    return <IrALogin />;
  }

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
};

export default AdminRoute;
