import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getFeaturedProducts, updateProduct } from '../../services/products';
import Button from '../../components/common/Button';
import styles from './AdminDestacados.module.css';

const AdminDestacados = () => {
  const queryClient = useQueryClient();
  const [orderUpdates, setOrderUpdates] = useState({});

  const { data: featuredData, isLoading, error } = useQuery({
    queryKey: ['admin-featured'],
    queryFn: async () => {
      const { data, error: err } = await getFeaturedProducts();
      if (err) throw new Error(err);
      return data;
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => updateProduct(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-featured'] });
      queryClient.invalidateQueries({ queryKey: ['featured-products'] });
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      setOrderUpdates({});
    }
  });

  const featured = featuredData ?? [];

  const handleOrderChange = (productId, value) => {
    const num = parseInt(value, 10);
    if (!Number.isNaN(num)) setOrderUpdates((u) => ({ ...u, [productId]: num }));
  };

  const handleSaveOrder = (product) => {
    const newOrder = orderUpdates[product.id] !== undefined ? orderUpdates[product.id] : product.featuredOrder;
    updateMutation.mutate({
      id: product.id,
      data: {
        name: product.name,
        categories: product.categories ?? (product.category ? [product.category] : []),
        price: product.price,
        images: product.images ?? [],
        description: product.description ?? '',
        inStock: product.inStock ?? 0,
        customizable: Boolean(product.customizable),
        variants: product.variants ?? { sizes: [], colors: [] },
        featured: true,
        featuredOrder: newOrder
      }
    });
  };

  const handleRemoveFeatured = (product) => {
    updateMutation.mutate({
      id: product.id,
      data: {
        name: product.name,
        categories: product.categories ?? (product.category ? [product.category] : []),
        price: product.price,
        images: product.images ?? [],
        description: product.description ?? '',
        inStock: product.inStock ?? 0,
        customizable: Boolean(product.customizable),
        variants: product.variants ?? { sizes: [], colors: [] },
        featured: false,
        featuredOrder: 0
      }
    });
  };

  if (isLoading) return <p className={styles.loading}>Cargando destacados...</p>;
  if (error) return <p className={styles.error}>{error.message}</p>;

  return (
    <div className={styles.wrapper}>
      <h1 className={styles.title}>Productos destacados</h1>
      <p className={styles.subtitle}>
        Los productos se marcan como destacados al editarlos en Productos. Aquí puedes cambiar el orden y quitar destacado.
      </p>

      {featured.length === 0 ? (
        <p className={styles.empty}>
          No hay productos destacados. Edita un producto y marca &quot;Mostrar en destacados&quot;.
        </p>
      ) : (
        <ul className={styles.list}>
          {featured.map((product) => (
            <li key={product.id} className={styles.item}>
              <div className={styles.itemImage}>
                <img
                  src={product.images?.[0] || 'https://via.placeholder.com/80x80'}
                  alt={product.name}
                />
              </div>
              <div className={styles.itemInfo}>
                <span className={styles.itemName}>{product.name}</span>
                <span className={styles.itemPrice}>S/ {Number(product.price || 0).toFixed(2)}</span>
              </div>
              <div className={styles.itemOrder}>
                <label htmlFor={`order-${product.id}`}>Orden</label>
                <input
                  id={`order-${product.id}`}
                  type="number"
                  min="0"
                  value={orderUpdates[product.id] !== undefined ? orderUpdates[product.id] : (product.featuredOrder ?? 0)}
                  onChange={(e) => handleOrderChange(product.id, e.target.value)}
                  className={styles.inputOrder}
                />
              </div>
              <div className={styles.itemActions}>
                <Button
                  size="small"
                  variant="secondary"
                  onClick={() => handleSaveOrder(product)}
                  disabled={updateMutation.isPending}
                >
                  Guardar orden
                </Button>
                <button
                  type="button"
                  className={styles.btnRemove}
                  onClick={() => handleRemoveFeatured(product)}
                  disabled={updateMutation.isPending}
                >
                  Quitar de destacados
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default AdminDestacados;
