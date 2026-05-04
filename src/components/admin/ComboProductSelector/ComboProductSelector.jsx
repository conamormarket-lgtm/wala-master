import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getProducts, getCategories, getProduct } from '../../../services/products';
import { toDirectImageUrl } from '../../../utils/imageUrl';
import Button from '../../common/Button';
import styles from './ComboProductSelector.module.css';

const ComboProductSelector = ({ onSelect, onClose, excludeProductIds = [] }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedProductId, setSelectedProductId] = useState(null);
  const [selectedViewId, setSelectedViewId] = useState('');
  const [scale, setScale] = useState(1);
  const [selectedColors, setSelectedColors] = useState([]);

  const { data: productsData = [], isLoading: loadingProducts } = useQuery({
    queryKey: ['admin-products-for-combo'],
    queryFn: async () => {
      const { data, error } = await getProducts([], null, null, { includeHidden: true });
      if (error) throw new Error(error);
      return data;
    }
  });

  const { data: categoriesData = [] } = useQuery({
    queryKey: ['admin-categories'],
    queryFn: async () => {
      const { data, error } = await getCategories();
      if (error) throw new Error(error);
      return data;
    }
  });

  const { data: selectedProduct } = useQuery({
    queryKey: ['product', selectedProductId],
    queryFn: async () => {
      const { data, error } = await getProduct(selectedProductId);
      if (error) throw new Error(error);
      return data;
    },
    enabled: !!selectedProductId
  });

  const filteredProducts = useMemo(() => {
    let filtered = productsData.filter(p => !excludeProductIds.includes(p.id));

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(p =>
        p.name?.toLowerCase().includes(query)
      );
    }

    if (selectedCategory) {
      filtered = filtered.filter(p => {
        const categories = p.categories || (p.category ? [p.category] : []);
        return categories.includes(selectedCategory);
      });
    }

    return filtered;
  }, [productsData, searchQuery, selectedCategory, excludeProductIds]);

  const availableViews = useMemo(() => {
    if (!selectedProduct) return [];
    return Array.isArray(selectedProduct.customizationViews) && selectedProduct.customizationViews.length > 0
      ? selectedProduct.customizationViews
      : [{ id: 'default', name: 'Por defecto' }];
  }, [selectedProduct]);

  // Nuevo modelo: variantes como array { id, name, imageUrl, sizes }
  const availableVariants = useMemo(() => {
    if (!selectedProduct?.variants) return [];
    return Array.isArray(selectedProduct.variants) ? selectedProduct.variants : [];
  }, [selectedProduct]);

  // Modelo antiguo: variantes.colors
  const availableColors = useMemo(() => {
    if (!selectedProduct?.variants?.colors?.length) return [];
    return selectedProduct.variants.colors;
  }, [selectedProduct]);

  const handleSelect = () => {
    if (!selectedProductId || !selectedViewId) return;

    const viewIdToUse = selectedViewId === 'default'
      ? (selectedProduct?.customizationViews?.[0]?.id || 'default')
      : selectedViewId;

    onSelect({
      productId: selectedProductId,
      viewId: viewIdToUse,
      position: 0,
      scale: parseFloat(scale) || 1,
      variantMapping: selectedColors.length > 0 ? {
        color: selectedColors[0],
        allowedColors: selectedColors
      } : {}
    });

    setSelectedProductId(null);
    setSelectedViewId('');
    setScale(1);
    setSelectedColors([]);
    onClose();
  };

  const hasVariantChoice = availableVariants.length > 0 || availableColors.length > 0;
  const variantOptions = availableVariants.length > 0
    ? availableVariants
    : availableColors.map((c) => ({ id: c, name: c }));

  return (
    <div className={styles.modalBackdrop} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <div>
            <h2 className={styles.modalTitle}>Añadir Producto al Combo</h2>
            <p className={styles.modalHint}>Puedes añadir el mismo producto varias veces (ej. en distintos colores).</p>
          </div>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </div>

        <div className={styles.modalContent}>
          {/* Filtros */}
          <div className={styles.filters}>
            <div className={styles.filterGroup}>
              <label className={styles.filterLabel}>Buscar:</label>
              <input
                type="text"
                placeholder="Nombre del producto..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={styles.searchInput}
              />
            </div>
            <div className={styles.filterGroup}>
              <label className={styles.filterLabel}>Categoría:</label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className={styles.select}
              >
                <option value="">Todas</option>
                {categoriesData.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Lista de productos */}
          <div className={styles.productsList}>
            {loadingProducts ? (
              <div className={styles.loading}>Cargando productos...</div>
            ) : filteredProducts.length === 0 ? (
              <div className={styles.empty}>No se encontraron productos</div>
            ) : (
              filteredProducts.map(product => {
                const imageUrl = product.images?.[0] || '';
                const isSelected = selectedProductId === product.id;

                return (
                  <div
                    key={product.id}
                    className={`${styles.productCard} ${isSelected ? styles.selected : ''}`}
                    onClick={() => {
                      setSelectedProductId(product.id);
                      const firstView = product.customizationViews?.[0];
                      setSelectedViewId(firstView?.id || 'default');

                      // Auto-seleccionar todas las variantes por defecto
                      const productVariants = Array.isArray(product.variants) ? product.variants : [];
                      const productColors = !productVariants.length && product.variants?.colors ? product.variants.colors : [];
                      const names = productVariants.length > 0
                        ? productVariants.map(v => v.name)
                        : productColors.map(c => c);
                      setSelectedColors(names);
                    }}
                  >
                    {imageUrl && (
                      <img
                        src={toDirectImageUrl(imageUrl)}
                        alt={product.name}
                        className={styles.productImage}
                        loading="lazy"
                      />
                    )}
                    <div className={styles.productInfo}>
                      <div className={styles.productName}>{product.name}</div>
                      <div className={styles.productMeta}>
                        {product.variants?.colors?.length > 0 && (
                          <span className={styles.badge}>
                            {product.variants.colors.length} color{product.variants.colors.length !== 1 ? 'es' : ''}
                          </span>
                        )}
                        {product.variants?.sizes?.length > 0 && (
                          <span className={styles.badge}>
                            {product.variants.sizes.length} talla{product.variants.sizes.length !== 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Selección de vista y escala */}
          {selectedProduct && (
            <div className={styles.selectionPanel}>
              <h3 className={styles.panelTitle}>Configurar Producto</h3>

              <div className={styles.field}>
                <label className={styles.fieldLabel}>Vista:</label>
                <select
                  value={selectedViewId}
                  onChange={(e) => setSelectedViewId(e.target.value)}
                  className={styles.select}
                >
                  {availableViews.map(view => (
                    <option key={view.id} value={view.id}>
                      {view.name || 'Por defecto'}
                    </option>
                  ))}
                </select>
              </div>

              {hasVariantChoice && (
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>
                    Variaciones permitidas:
                  </label>
                  <div className={styles.variantGrid}>
                    {variantOptions.map((opt) => {
                      const isChecked = selectedColors.includes(opt.name);
                      const order = selectedColors.indexOf(opt.name) + 1;

                      return (
                        <label key={opt.id} className={`${styles.variantOption} ${isChecked ? styles.variantOptionActive : ''}`}>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedColors([...selectedColors, opt.name]);
                              } else {
                                setSelectedColors(selectedColors.filter(c => c !== opt.name));
                              }
                            }}
                            className={styles.checkbox}
                          />
                          <span className={styles.variantName}>{opt.name || opt.id}</span>
                          {isChecked && <span className={styles.selectionOrder}>{order}</span>}
                        </label>
                      );
                    })}
                  </div>
                  <span className={styles.fieldHint}>
                    Selecciona las variantes que estarán disponibles en el editor. El orden de selección determina cuál aparece primero (el #1 será el predeterminado).
                  </span>
                </div>
              )}

              <div className={styles.field}>
                <label className={styles.fieldLabel}>
                  Escala (0.1 - 2.0):
                </label>
                <input
                  type="number"
                  min="0.1"
                  max="2"
                  step="0.1"
                  value={scale}
                  onChange={(e) => setScale(e.target.value)}
                  className={styles.input}
                />
              </div>
            </div>
          )}
        </div>

        <div className={styles.modalFooter}>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            onClick={handleSelect}
            disabled={!selectedProductId || !selectedViewId}
          >
            Añadir al Combo
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ComboProductSelector;
