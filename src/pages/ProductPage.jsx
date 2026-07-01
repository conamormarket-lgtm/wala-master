import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useProduct } from '../hooks/useProducts';
import { getCategories } from '../services/products';
import ProductDetail from './Tienda/components/ProductDetail';
import { useProductTracking } from '../hooks/useProductTracking';

const ProductPage = () => {
  const { id } = useParams();
  const { data: product, isLoading, error } = useProduct(id);
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

  // Rastreo de vistas de producto para notificaciones de comportamiento
  // (no se rastrean productos borrados/ocultos).
  useProductTracking(noDisponible ? null : product);

  if (error) {
    return <div>Error al cargar el producto: {error.message}</div>;
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

  return <ProductDetail product={product} loading={isLoading} categories={categories} />;
};

export default ProductPage;
