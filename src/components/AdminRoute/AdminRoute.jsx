import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
// eslint-disable-next-line no-unused-vars
import { useAuth } from '../../contexts/AuthContext';

/**
 * Ruta protegida: solo usuarios con rol admin pueden acceder (isAdmin viene de
 * AuthContext: custom claim de Firebase Auth o permisos en adminRoles — nunca de
 * localStorage ni de un email hardcodeado).
 * Si no hay usuario → redirige a login. Si no es admin → redirige a inicio.
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

  if (!user && !isAdmin) {
    return <Navigate to="/login" replace />;
  }

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
};

export default AdminRoute;
