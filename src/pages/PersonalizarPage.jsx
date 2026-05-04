import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getProducts } from '../services/products';
import ProductGrid from './Tienda/components/ProductGrid';
import Button from '../components/common/Button';
import styles from './PersonalizarPage.module.css';

const PersonalizarPage = () => {
  const { data: productsData, isLoading, error } = useQuery({
    queryKey: ['products-personalizables'],
    queryFn: async () => {
      const { data, error } = await getProducts();
      if (error) throw new Error(error);
      return (data || []).filter(p => p.customizable !== false);
    }
  });

  const products = productsData || [];
  const hasProducts = products.length > 0;

  return (
    <div className={styles.container}>
      <div className={styles.hero}>
        <h1 className={styles.title}>Personaliza tu prenda</h1>
        <p className={styles.subtitle}>
          Elige un producto, agrega tu texto, imágenes o diseños y recibe una prenda única. 
          Selecciona abajo la prenda que quieres personalizar.
        </p>
      </div>

      {hasProducts ? (
        <>
          <p className={styles.sectionLabel}>Productos que puedes personalizar</p>
          <ProductGrid 
            products={products} 
            loading={isLoading}
            error={error?.message}
          />
        </>
      ) : (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>✨</div>
          <h2>Elige tu prenda en la tienda</h2>
          <p>
            Entra a la tienda, elige el producto que te guste y haz clic en <strong>Crear</strong> 
            para agregar tu diseño, texto o imágenes.
          </p>
          <Link to="/tienda">
            <Button variant="primary" size="large">Ir a la Tienda</Button>
          </Link>
        </div>
      )}
    </div>
  );
};

export default PersonalizarPage;
