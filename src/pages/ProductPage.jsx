import React from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useProduct } from '../hooks/useProducts';
import { getCategories } from '../services/products';
import ProductDetail from './Tienda/components/ProductDetail';

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

  if (error) {
    return <div>Error al cargar el producto: {error.message}</div>;
  }

  return <ProductDetail product={product} loading={isLoading} categories={categories} />;
};

export default ProductPage;
