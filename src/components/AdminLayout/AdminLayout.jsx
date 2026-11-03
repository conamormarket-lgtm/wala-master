import React, { lazy, Suspense } from 'react';
import useLoViejo from '../../hooks/useLoViejo';
import MarcoDelPanel from '../panel/MarcoDelPanel';

// El marco de antes solo baja si el interruptor adminViejo está puesto.
const AdminLayoutViejo = lazy(() => import('./AdminLayoutViejo'));

/*
 * El marco de /admin. D0 de la migración (guia/ADMIN.md): MarcoAdmin del kit
 * por MarcoDelPanel. adminViejo (useLoViejo('admin'): en Firestore
 * `adminViejo: true`; en localStorage, "admin") vuelve al de antes.
 */
const AdminLayout = () => {
  const adminViejo = useLoViejo('admin');
  if (!adminViejo) return <MarcoDelPanel />;
  return (
    <Suspense fallback={null}>
      <AdminLayoutViejo />
    </Suspense>
  );
};

export default AdminLayout;
