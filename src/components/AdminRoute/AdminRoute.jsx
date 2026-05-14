import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { useAuth } from '../../contexts/AuthContext';

/**
 * Ruta protegida: solo usuarios con rol admin (o email yorh001@gmail.com) pueden acceder.
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
