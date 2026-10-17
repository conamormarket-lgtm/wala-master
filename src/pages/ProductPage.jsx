import React, { lazy, Suspense } from 'react';
import { useParams, Link, Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useProduct } from '../hooks/useProducts';
import useLoViejo from '../hooks/useLoViejo';
import { getCategories } from '../services/products';
import FichaDeProducto from '../components/producto/FichaDeProducto';

// La ficha vieja solo baja si el interruptor fichaVieja está puesto.
const ProductDetail = lazy(() => import('./Tienda/components/ProductDetail'));

const ProductPage = () => {
  const { id } = useParams();
  // Paso 6 de la migración: la ficha del kit. fichaVieja vuelve a ProductDetail.
  const fichaVieja = useLoViejo('ficha');
  const { data: product, isLoading, error, refetch } = useProduct(id);
  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const { data, error: err } = await getCategories();
      if (err) throw new Error(err);
      return data;
    }
  });

  // Soft-delete: getProduct puede devolver un tombstone (deleted===true) o un
  // producto oculto (visible===false). En ambos casos NO se muestra la ficha
  // comprable (nada de agregar al carrito) sino un estado limpio de "no disponible".
  const noDisponible = Boolean(product) && (product.deleted === true || product.visible === false);

  // El recordatorio "¡Sigue disponible!" ya no lo arma el navegador mientras
  // el cliente mira el producto: lo manda el servidor al día siguiente (aviso
  // "Producto que estuvo mirando", functions/notificationsEngine.js).

  if (!fichaVieja) {
    // Las prendas de Crear y sus combos no tienen ficha (ver abajo).
    if (product?.esPrendaBase === true && !noDisponible) return <Navigate to={`/crear/${id}`} replace />;
    if (product?.esComboCrear === true) return <Navigate to={`/combo/${id}`} replace />;
    return (
      <FichaDeProducto
        key={id}
        product={product}
        cargando={isLoading}
        error={error}
        noDisponible={noDisponible}
        categories={categories}
        onReintentar={() => refetch()}
      />
    );
  }

  if (error) {
    return <div>Error al cargar el producto: {error.message}</div>;
  }

  // Las prendas del apartado Crear no tienen ficha: se compran diseñándolas.
  if (product?.esPrendaBase === true && !noDisponible) {
    return <Navigate to={`/crear/${id}`} replace />;
  }
  // Los combos de Crear tampoco: se arman pieza por pieza.
  if (product?.esComboCrear === true) {
    return <Navigate to={`/combo/${id}`} replace />;
  }

  if (noDisponible) {
    return (
      <div style={{
        maxWidth: '480px',
        margin: '80px auto',
        padding: '32px 24px',
        textAlign: 'center'
      }}>
        <h1 style={{ fontSize: '1.4rem', marginBottom: '12px' }}>
          Este producto ya no está disponible
        </h1>
        <p style={{ color: '#666', marginBottom: '24px' }}>
          El producto que buscas fue retirado del catálogo, pero tenemos muchas
          otras opciones esperándote.
        </p>
        <Link
          to="/tienda"
          style={{
            display: 'inline-block',
            padding: '12px 28px',
            borderRadius: '8px',
            background: '#111',
            color: '#fff',
            textDecoration: 'none',
            fontWeight: 600
          }}
        >
          Ir a la tienda
        </Link>
      </div>
    );
  }

  return (
    <Suspense fallback={null}>
      <ProductDetail product={product} loading={isLoading} categories={categories} />
    </Suspense>
  );
};

export default ProductPage;
