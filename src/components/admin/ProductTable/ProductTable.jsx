import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Toggle from '../../common/Toggle/Toggle';
import { toDirectImageUrl, toThumbnailImageUrl } from '../../../utils/imageUrl';
import ComboProductImage from '../../../pages/Tienda/components/ComboProductImage/ComboProductImage';
import OptimizedImage from '../../common/OptimizedImage/OptimizedImage';
import { EyeIcon, EyeOffIcon, EditIcon, TrashIcon, CopyIcon } from '../../common/Icons/Icons';
import styles from './ProductTable.module.css';

/**
 * Componente de tabla profesional para productos
 * Inspirado en Shopify Admin
 */
const ProductTable = ({
  products = [],
  categories = [],
  onToggleVisibility,
  onDelete,
  onDuplicate,
  optimisticVisibility = {},
  isToggling = false,
  isLoading = false,
  selectedIds = [],
  onSelectProduct = null,
  onSelectAll = null
}) => {
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });

  const allSelected = products.length > 0 && selectedIds.length === products.length;
  const someSelected = selectedIds.length > 0 && selectedIds.length < products.length;

  const categoryName = (p) => {
    const ids = p.categories ?? (p.category ? [p.category] : []);
    if (!ids.length) return '—';
    return ids.map((id) => categories.find((c) => c.id === id)?.name || id).join(', ');
  };

  const handleSort = (key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const sortedProducts = useMemo(() => {
    if (!sortConfig.key) return products;

    return [...products].sort((a, b) => {
      let aVal, bVal;

      switch (sortConfig.key) {
        case 'name':
          aVal = a.name?.toLowerCase() || '';
          bVal = b.name?.toLowerCase() || '';
          break;
        case 'price':
          aVal = Number(a.price || 0);
          bVal = Number(b.price || 0);
          break;
        case 'stock':
          aVal = Number(a.inStock || 0);
          bVal = Number(b.inStock || 0);
          break;
        case 'category':
          aVal = categoryName(a).toLowerCase();
          bVal = categoryName(b).toLowerCase();
          break;
        default:
          return 0;
      }

      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [products, sortConfig, categories]);

  const SortIcon = ({ columnKey }) => {
    if (sortConfig.key !== columnKey) {
      return <span className={styles.sortIcon}>↕</span>;
    }
    return (
      <span className={styles.sortIcon}>
        {sortConfig.direction === 'asc' ? '↑' : '↓'}
      </span>
    );
  };

  if (isLoading) {
    return (
      <div className={styles.tableWrapper}>
        <div className={styles.loadingState}>
          <div className={styles.skeletonRow} />
          <div className={styles.skeletonRow} />
          <div className={styles.skeletonRow} />
        </div>
      </div>
    );
  }

  if (sortedProducts.length === 0) {
    return (
      <div className={styles.emptyState}>
        <p>No hay productos para mostrar</p>
      </div>
    );
  }

  return (
    <div className={styles.tableWrapper}>
      <table className={styles.table}>
        <thead className={styles.thead}>
          <tr>
            {onSelectAll && (
              <th className={styles.thCheckbox}>
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(input) => {
                    if (input) input.indeterminate = someSelected;
                  }}
                  onChange={(e) => {
                    if (e.target.checked) {
                      onSelectAll(products.map(p => p.id));
                    } else {
                      onSelectAll([]);
                    }
                  }}
                  className={styles.checkbox}
                  aria-label="Seleccionar todos los productos"
                />
              </th>
            )}
            <th className={styles.thImage}>Imagen</th>
            <th
              className={`${styles.th} ${styles.sortable}`}
              onClick={() => handleSort('name')}
            >
              Nombre
              <SortIcon columnKey="name" />
            </th>
            <th
              className={`${styles.th} ${styles.sortable}`}
              onClick={() => handleSort('category')}
            >
              Categoría
              <SortIcon columnKey="category" />
            </th>
            <th
              className={`${styles.th} ${styles.sortable}`}
              onClick={() => handleSort('price')}
            >
              Precio
              <SortIcon columnKey="price" />
            </th>
            <th
              className={`${styles.th} ${styles.sortable}`}
              onClick={() => handleSort('stock')}
            >
              Stock
              <SortIcon columnKey="stock" />
            </th>
            <th className={styles.th}>Estado</th>
            <th className={styles.thActions}>Acciones</th>
          </tr>
        </thead>
        <tbody className={styles.tbody}>
          {sortedProducts.map((p) => {
            const isVisible = optimisticVisibility[p.id] !== undefined
              ? optimisticVisibility[p.id]
              : p.visible !== false;
            const isSelected = selectedIds.includes(p.id);

            return (
              <tr key={p.id} className={`${styles.tr} ${isSelected ? styles.selected : ''}`}>
                {onSelectProduct && (
                  <td className={styles.tdCheckbox}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={(e) => {
                        if (e.target.checked) {
                          onSelectProduct([...selectedIds, p.id]);
                        } else {
                          onSelectProduct(selectedIds.filter(id => id !== p.id));
                        }
                      }}
                      className={styles.checkbox}
                      aria-label={`Seleccionar ${p.name}`}
                    />
                  </td>
                )}
                <td className={styles.tdImage}>
                  <div className={styles.imageCell}>
                    {p.isComboProduct ? (
                      <ComboProductImage
                        comboProduct={p}
                        variantSelections={{}}
                        className={styles.productImageCombo}
                      />
                    ) : (() => {
                      const principalVariant = p.variants?.find(v => v.id === p.defaultVariantId) || p.variants?.[0];
                      const adminImageStr = p.thumbnailImageUrl || principalVariant?.imageUrl || p.mainImage || p.images?.[0] || '';
                      const displayUrl = adminImageStr || 'https://via.placeholder.com/60x60?text=Producto';
                      const adminCrop = principalVariant?.thumbnailCrop?.percentages;

                      return (
                        <OptimizedImage
                          src={toThumbnailImageUrl(displayUrl)}
                          fallbackSrc={toDirectImageUrl(displayUrl)}
                          alt={p.name}
                          className={styles.productImage}
                          containerClassName={styles.productImage}
                          cropData={adminCrop}
                          showSkeleton={true}
                        />
                      );
                    })()}
                  </div>
                </td>
                <td className={styles.td}>
                  <div className={styles.productName}>{p.name}</div>
                  {p.featured && (
                    <span className={styles.badgeInline}>Destacado</span>
                  )}
                </td>
                <td className={styles.td}>
                  <span className={styles.categoryText}>{categoryName(p)}</span>
                </td>
                <td className={styles.td}>
                  <span className={styles.priceText}>S/ {Number(p.price || 0).toFixed(2)}</span>
                </td>
                <td className={styles.td}>
                  <span className={styles.stockText}>{p.inStock ?? 0}</span>
                </td>
                <td className={styles.td}>
                  <div className={styles.statusCell}>
                    <Toggle
                      checked={isVisible}
                      onChange={() => onToggleVisibility(p)}
                      disabled={isToggling && optimisticVisibility[p.id] === undefined}
                      size="small"
                      aria-label={isVisible ? 'Producto visible' : 'Producto oculto'}
                    />
                    <span className={styles.statusIcon}>
                      {isVisible ? <EyeIcon size={14} /> : <EyeOffIcon size={14} />}
                    </span>
                  </div>
                </td>
                <td className={styles.tdActions}>
                  <div className={styles.actionButtons}>
                    <Link
                      to={`/admin/productos/${p.id}`}
                      className={styles.actionBtn}
                      title="Editar producto"
                    >
                      <EditIcon size={16} />
                    </Link>
                    {onDuplicate && (
                      <button
                        type="button"
                        className={styles.actionBtn}
                        onClick={() => onDuplicate(p)}
                        title="Duplicar producto"
                      >
                        <CopyIcon size={16} />
                      </button>
                    )}
                    <button
                      type="button"
                      className={styles.actionBtn}
                      onClick={() => onDelete(p)}
                      title="Eliminar producto"
                    >
                      <TrashIcon size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default React.memo(ProductTable);
