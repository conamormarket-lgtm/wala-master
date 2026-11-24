import React, { lazy, Suspense } from 'react';
import { useParams } from 'react-router-dom';
import useLoViejo from '../../../hooks/useLoViejo';
import FichaDelPanel from '../../../components/panel/FichaDelPanel';

// La ficha de antes solo baja con su interruptor.
const AdminProductoFormV2Viejo = lazy(() => import('./AdminProductoFormV2Viejo'));

/*
 * La ficha de un producto (/admin/productos/:id, /nuevo) y la de un
 * personalizable de Crear (modo="prenda", RutasPrendasCrear). D2 de la
 * migración (guia/ADMIN.md): PaginaFichaProducto por FichaDelPanel.
 * Vuelve la de antes con adminProductosViejo, y también con
 * personalizableViejo: solo la ficha de antes tiene "Producto
 * personalizable" (el editor viejo) y Yoryo.
 */
const AdminProductoFormV2 = ({ modo = 'producto' }) => {
  const productosViejo = useLoViejo('adminProductos');
  const personalizableViejo = useLoViejo('personalizable');
  const { id } = useParams();
  // Otra ficha, otro estado: al pasar de un producto a otro empieza de cero.
  if (!productosViejo && !personalizableViejo) return <FichaDelPanel key={`${modo}-${id || 'nuevo'}`} modo={modo} />;
  return (
    <Suspense fallback={null}>
      <AdminProductoFormV2Viejo modo={modo} />
    </Suspense>
  );
};

export default AdminProductoFormV2;
