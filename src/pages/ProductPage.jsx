import React from 'react';
import { useParams } from 'react-router-dom';
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

  // Rastreo de vistas de producto para notificaciones de comportamiento
  useProductTracking(product);

  if (error) {
    return <div>Error al cargar el producto: {error.message}</div>;
  }

  return <ProductDetail product={product} loading={isLoading} categories={categories} />;
};

export default ProductPage;
