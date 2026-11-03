import React, { lazy, Suspense } from 'react';
import useLoViejo from '../hooks/useLoViejo';
import InicioDelPanel from '../components/panel/InicioDelPanel';

// El inicio de antes (accesos y el editor de secciones por zonas) solo baja con adminViejo.
const AdminDashboardViejo = lazy(() => import('./AdminDashboardViejo'));

/*
 * /admin. D0 de la migración (guia/ADMIN.md): PaginaInicioAdmin por
 * InicioDelPanel. adminViejo vuelve al inicio de antes, con el marco de antes.
 */
const AdminDashboard = () => {
  const adminViejo = useLoViejo('admin');
  if (!adminViejo) return <InicioDelPanel />;
  return (
    <Suspense fallback={null}>
      <AdminDashboardViejo />
    </Suspense>
  );
};

export default AdminDashboard;
