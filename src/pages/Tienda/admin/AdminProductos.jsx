import React, { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getProducts, getCategories, deleteProduct, updateProduct, createProduct } from '../../../services/products';
import { getBrands } from '../../../services/brands';
import { deleteFile } from '../../../services/firebase/storage';
import { createReferenceProducts } from '../../../scripts/createReferenceProducts';
import { exportProducts } from '../../../utils/exportProducts';
import { useToast } from '../../../hooks/useToast';
import Button from '../../../components/common/Button';
import Toggle from '../../../components/common/Toggle/Toggle';
import ProductTable from '../../../components/admin/ProductTable/ProductTable';
import BulkActions from '../../../components/admin/BulkActions/BulkActions';
import ToastContainer from '../../../components/common/Toast/ToastContainer';
import { EyeIcon, EyeOffIcon, EditIcon, TrashIcon, GridIcon, TableIcon, CopyIcon } from '../../../components/common/Icons/Icons';
import { Clock, Edit2, Trash2 } from 'lucide-react';
import { toDirectImageUrl, toThumbnailImageUrl } from '../../../utils/imageUrl';
import ComboProductImage from '../components/ComboProductImage/ComboProductImage';
import OptimizedImage from '../../../components/common/OptimizedImage/OptimizedImage';
import styles from './AdminProductos.module.css';

const AdminProductos = () => {
  const queryClient = useQueryClient();
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [creatingReference, setCreatingReference] = useState(false);
  const [createResult, setCreateResult] = useState(null);
  const [optimisticVisibility, setOptimisticVisibility] = useState({});
  const [viewMode, setViewMode] = useState(() => {
    const saved = localStorage.getItem('admin-products-view-mode');
    return saved === 'table' ? 'table' : 'cards';
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProductIds, setSelectedProductIds] = useState([]);
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const { toasts, removeToast, success, error: showError } = useToast();

  const [drafts, setDrafts] = useState([]);

  useEffect(() => {
    const savedDrafts = JSON.parse(localStorage.getItem('wala_drafts') || '[]');
    setDrafts(savedDrafts);
  }, []);

  const handleDiscardDraft = async (draftId) => {
    if (!window.confirm('¿Seguro que deseas descartar este borrador? Se eliminarán todas las fotos asociadas de la nube.')) return;
    
    const draft = drafts.find(d => d.draftId === draftId);
    if (!draft) return;

    const urlsToDelete = [];
    if (draft.form?.variants) {
      draft.form.variants.forEach(v => {
        if (v.imageUrl) urlsToDelete.push(v.imageUrl);
        if (v.images && v.images.length > 0) urlsToDelete.push(...v.images);
      });
    }

    if (urlsToDelete.length > 0) {
      success('Borrando archivos temporales...', { duration: 3000 });
      try {
        await Promise.all(urlsToDelete.map(url => deleteFile(url)));
      } catch (e) {
        console.error("Error al borrar archivos de Firebase", e);
      }
    }

    const newDrafts = drafts.filter(d => d.draftId !== draftId);
    setDrafts(newDrafts);
    localStorage.setItem('wala_drafts', JSON.stringify(newDrafts));
    
    success('Borrador descartado exitosamente');
  };

  const { data: productsData, isLoading, error } = useQuery({
    queryKey: ['admin-products'],
    queryFn: async () => {
      const { data, error: err } = await getProducts([], null, null, { includeHidden: true });
      if (err) throw new Error(err);
      return data;
    }
  });

  const { data: categoriesData = [] } = useQuery({
    queryKey: ['admin-categories'],
    queryFn: async () => {
      const { data, error: err } = await getCategories();
      if (err) throw new Error(err);
      return data;
    }
  });

  const { data: brandsData = [] } = useQuery({
    queryKey: ['admin-brands'],
    queryFn: async () => {
      const { data, error: err } = await getBrands();
      if (err) throw new Error(err);
      return data;
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => deleteProduct(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['featured-products'] });
      queryClient.invalidateQueries({ queryKey: ['collection-products'] });
      setDeleteConfirm(null);
      success('Producto eliminado exitosamente');
    },
    onError: () => {
      showError('Error al eliminar el producto');
    }
  });

  const toggleVisibleMutation = useMutation({
    mutationFn: ({ id, product, visible }) => updateProduct(id, { ...product, visible }),
    onMutate: async ({ id, visible }) => {
      // Cancelar queries en curso
      await queryClient.cancelQueries({ queryKey: ['admin-products'] });

      // Snapshot del valor anterior
      const previousProducts = queryClient.getQueryData(['admin-products']);

      // Optimistic update
      queryClient.setQueryData(['admin-products'], (old) => {
        if (!old) return old;
        return old.map((p) => (p.id === id ? { ...p, visible } : p));
      });

      // Guardar estado optimista
      setOptimisticVisibility((prev) => ({ ...prev, [id]: visible }));

      return { previousProducts };
    },
    onError: (err, variables, context) => {
      // Revertir en caso de error
      if (context?.previousProducts) {
        queryClient.setQueryData(['admin-products'], context.previousProducts);
      }
      setOptimisticVisibility((prev) => {
        const newState = { ...prev };
        delete newState[variables.id];
        return newState;
      });
      showError('Error al cambiar visibilidad del producto');
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['featured-products'] });
      queryClient.invalidateQueries({ queryKey: ['collection-products'] });
      // Limpiar estado optimista después de éxito
      setOptimisticVisibility({});
      success(variables.visible ? 'Producto mostrado exitosamente' : 'Producto ocultado exitosamente');
    },
    onSettled: () => {
      // Limpiar estado optimista después de completar
      setTimeout(() => {
        setOptimisticVisibility({});
      }, 500);
    }
  });

  // Guardar preferencia de vista
  useEffect(() => {
    localStorage.setItem('admin-products-view-mode', viewMode);
  }, [viewMode]);

  const products = useMemo(() => {
    if (!productsData) return [];
    let filtered = productsData.map((p) => {
      // Aplicar estado optimista si existe
      if (optimisticVisibility[p.id] !== undefined) {
        return { ...p, visible: optimisticVisibility[p.id] };
      }
      return p;
    });

    // Filtrar por búsqueda
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter((p) => {
        const nameMatch = p.name?.toLowerCase().includes(query);
        const categoryMatch = categoryName(p).toLowerCase().includes(query);
        const priceMatch = String(p.price || '').includes(query);
        return nameMatch || categoryMatch || priceMatch;
      });
    }

    return filtered;
  }, [productsData, optimisticVisibility, searchQuery]);

  const categoryName = (p) => {
    const ids = p.categories ?? (p.category ? [p.category] : []);
    if (!ids.length) return '—';
    return ids.map((id) => categoriesData.find((c) => c.id === id)?.name || id).join(', ');
  };

  const handleToggleVisibility = (product) => {
    const newVisible = !(product.visible !== false);
    toggleVisibleMutation.mutate({
      id: product.id,
      product,
      visible: newVisible
    });
  };

  const handleDelete = (product) => {
    setDeleteConfirm(product);
  };

  const handleBulkShow = async () => {
    if (selectedProductIds.length === 0) return;
    if (!window.confirm(`¿Mostrar ${selectedProductIds.length} producto(s) seleccionado(s)?`)) return;

    setBulkProcessing(true);
    try {
      const updates = products
        .filter(p => selectedProductIds.includes(p.id))
        .map(p => ({
          id: p.id,
          product: p,
          visible: true
        }));

      await Promise.all(updates.map(update =>
        updateProduct(update.id, { ...update.product, visible: true })
      ));

      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['featured-products'] });
      queryClient.invalidateQueries({ queryKey: ['collection-products'] });
      setSelectedProductIds([]);
      success(`${selectedProductIds.length} producto(s) mostrado(s) exitosamente`);
    } catch (error) {
      console.error('Error al mostrar productos:', error);
      showError('Error al mostrar algunos productos');
    } finally {
      setBulkProcessing(false);
    }
  };

  const handleBulkHide = async () => {
    if (selectedProductIds.length === 0) return;
    if (!window.confirm(`¿Ocultar ${selectedProductIds.length} producto(s) seleccionado(s)?`)) return;

    setBulkProcessing(true);
    try {
      const updates = products
        .filter(p => selectedProductIds.includes(p.id))
        .map(p => ({
          id: p.id,
          product: p,
          visible: false
        }));

      await Promise.all(updates.map(update =>
        updateProduct(update.id, { ...update.product, visible: false })
      ));

      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['featured-products'] });
      queryClient.invalidateQueries({ queryKey: ['collection-products'] });
      setSelectedProductIds([]);
      success(`${selectedProductIds.length} producto(s) ocultado(s) exitosamente`);
    } catch (error) {
      console.error('Error al ocultar productos:', error);
      showError('Error al ocultar algunos productos');
    } finally {
      setBulkProcessing(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedProductIds.length === 0) return;
    if (!window.confirm(`¿Eliminar ${selectedProductIds.length} producto(s) seleccionado(s)? Esta acción no se puede deshacer.`)) return;

    setBulkProcessing(true);
    try {
      await Promise.all(selectedProductIds.map(id => deleteProduct(id)));

      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['featured-products'] });
      queryClient.invalidateQueries({ queryKey: ['collection-products'] });
      const count = selectedProductIds.length;
      setSelectedProductIds([]);
      success(`${count} producto(s) eliminado(s) exitosamente`);
    } catch (error) {
      console.error('Error al eliminar productos:', error);
      showError('Error al eliminar algunos productos');
    } finally {
      setBulkProcessing(false);
    }
  };

  const handleExport = () => {
    try {
      const count = exportProducts(products, categoriesData, selectedProductIds.length > 0 ? selectedProductIds : null);
      success(`Se exportaron ${count} producto(s) exitosamente`);
    } catch (err) {
      console.error('Error al exportar:', err);
      showError('Error al exportar productos: ' + err.message);
    }
  };

  const handleDuplicate = async (product) => {
    try {
      // Crear copia del producto sin el ID
      const { id, createdAt, ...productData } = product;
      const duplicateData = {
        ...productData,
        name: `${productData.name} (Copia)`,
        visible: false, // Oculto por defecto para que el admin lo revise
      };

      const result = await createProduct(duplicateData);

      if (result.error) {
        throw new Error(result.error);
      }

      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['featured-products'] });
      queryClient.invalidateQueries({ queryKey: ['collection-products'] });
      success('Producto duplicado exitosamente');

      // Navegar al producto duplicado para editarlo
      if (result.data?.id) {
        setTimeout(() => {
          window.location.href = `/admin/productos/${result.data.id}`;
        }, 1000);
      }
    } catch (err) {
      console.error('Error al duplicar producto:', err);
      showError('Error al duplicar producto: ' + (err.message || 'Error desconocido'));
    }
  };

  const handleCreateReferenceProducts = async () => {
    if (!window.confirm('¿Crear 5 productos de referencia (Poleras, Polos, Joggers, Gorros, Joyas)?\n\nEsto creará productos con datos de ejemplo.')) {
      return;
    }

    setCreatingReference(true);
    setCreateResult(null);

    try {
      const result = await createReferenceProducts();
      setCreateResult(result);

      // Invalidar queries para refrescar la lista
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['admin-categories'] });
      queryClient.invalidateQueries({ queryKey: ['categories'] });
    } catch (error) {
      console.error('Error al crear productos de referencia:', error);
      setCreateResult({
        success: false,
        error: error.message || 'Error desconocido'
      });
    } finally {
      setCreatingReference(false);
    }
  };

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Productos</h1>
          <p className={styles.subtitle}>Gestiona tu catálogo, precios y visibilidad en la tienda</p>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <Button
            variant="secondary"
            onClick={handleExport}
            disabled={products.length === 0}
            title="Exportar productos a CSV"
          >
            Exportar CSV
          </Button>
          <Link to="/admin/productos/nuevo">
            <Button>Crear Producto</Button>
          </Link>
        </div>
      </div>

      {/* SECCIÓN BORRADORES PENDIENTES */}
      {drafts.length > 0 && (
        <div style={{ background: '#fafafa', border: '1px solid #eaeaea', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem' }}>
          <h2 style={{ color: '#111', margin: '0 0 0.5rem 0', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Clock size={18} color="#666" /> Borradores Pendientes ({drafts.length})
          </h2>
          <p style={{ color: '#666', margin: '0 0 1rem 0', fontSize: '0.9rem' }}>
            Productos con ediciones sin finalizar. Las imágenes asociadas ocupan espacio temporal.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {drafts.map(draft => (
              <div key={draft.draftId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff', padding: '0.75rem', borderRadius: '6px', border: '1px solid #eaeaea' }}>
                <div>
                  <strong style={{ color: '#333' }}>{draft.form?.name || 'Producto sin nombre'}</strong>
                  <span style={{ fontSize: '0.8rem', color: '#888', marginLeft: '0.5rem' }}>
                    Modificado: {new Date(draft.updatedAt).toLocaleString()}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <Link to={`/admin/productos/nuevo?draftId=${draft.draftId}`}>
                    <Button variant="secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      <Edit2 size={14} /> Continuar
                    </Button>
                  </Link>
                  <Button variant="secondary" onClick={() => handleDiscardDraft(draft.draftId)} style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem', color: '#e03131', borderColor: '#ffc9c9', background: '#fff5f5', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <Trash2 size={14} /> Descartar
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {createResult && (
        <div style={{
          padding: '12px',
          marginBottom: '20px',
          borderRadius: '4px',
          backgroundColor: createResult.success ? '#d4edda' : '#f8d7da',
          color: createResult.success ? '#155724' : '#721c24',
          border: `1px solid ${createResult.success ? '#c3e6cb' : '#f5c6cb'}`
        }}>
          {createResult.success ? (
            <div>
              <strong>✅ Productos creados exitosamente!</strong>
              <p style={{ margin: '8px 0 0 0', fontSize: '14px' }}>
                Se crearon {createResult.successful} de {createResult.total} productos de referencia.
              </p>
            </div>
          ) : (
            <div>
              <strong>❌ Error al crear productos</strong>
              <p style={{ margin: '8px 0 0 0', fontSize: '14px' }}>
                {createResult.error || 'Error desconocido'}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Barra de búsqueda y vista */}
      <div className={styles.toolbar}>
        <div className={styles.searchContainer}>
          <input
            type="text"
            placeholder="Buscar productos por nombre, categoría o precio..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={styles.searchInput}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className={styles.clearSearch}
              aria-label="Limpiar búsqueda"
            >
              ×
            </button>
          )}
        </div>
        <div className={styles.viewToggle}>
          <button
            type="button"
            className={`${styles.viewToggleBtn} ${viewMode === 'cards' ? styles.active : ''}`}
            onClick={() => setViewMode('cards')}
            title="Vista de tarjetas"
            aria-label="Vista de tarjetas"
          >
            <GridIcon size={18} />
          </button>
          <button
            type="button"
            className={`${styles.viewToggleBtn} ${viewMode === 'table' ? styles.active : ''}`}
            onClick={() => setViewMode('table')}
            title="Vista de tabla"
            aria-label="Vista de tabla"
          >
            <TableIcon size={18} />
          </button>
        </div>
      </div>

      {isLoading && <p className={styles.loading}>Cargando productos...</p>}
      {error && <p className={styles.error}>{error.message}</p>}

      {/* Barra de acciones en masa */}
      {viewMode === 'table' && selectedProductIds.length > 0 && (
        <BulkActions
          selectedCount={selectedProductIds.length}
          onShowAll={handleBulkShow}
          onHideAll={handleBulkHide}
          onDeleteAll={handleBulkDelete}
          onExport={() => {
            try {
              const count = exportProducts(products, categoriesData, selectedProductIds);
              success(`Se exportaron ${count} producto(s) exitosamente`);
            } catch (err) {
              showError('Error al exportar: ' + err.message);
            }
          }}
          onClearSelection={() => setSelectedProductIds([])}
          isProcessing={bulkProcessing}
        />
      )}

      {viewMode === 'table' ? (
        <div className={styles.tableCard}>
          <ProductTable
            products={products}
            categories={categoriesData}
            onToggleVisibility={handleToggleVisibility}
            onDelete={handleDelete}
            onDuplicate={handleDuplicate}
            optimisticVisibility={optimisticVisibility}
            isToggling={toggleVisibleMutation.isPending}
            isLoading={isLoading}
            selectedIds={selectedProductIds}
            onSelectProduct={setSelectedProductIds}
            onSelectAll={setSelectedProductIds}
          />
        </div>
      ) : (
        <div className={styles.grid}>
          {products.map((p) => {
            const isVisible = p.visible !== false;
            const isToggling = optimisticVisibility[p.id] !== undefined;

            return (
              <div key={p.id} className={styles.card}>
                {/* Toggle de visibilidad en esquina superior derecha */}
                <div className={styles.cardToggle}>
                  <Toggle
                    checked={isVisible}
                    onChange={() => handleToggleVisibility(p)}
                    disabled={toggleVisibleMutation.isPending && !isToggling}
                    size="small"
                    aria-label={isVisible ? 'Producto visible - Click para ocultar' : 'Producto oculto - Click para mostrar'}
                  />
                  <span className={styles.toggleIcon}>
                    {isVisible ? <EyeIcon size={14} /> : <EyeOffIcon size={14} />}
                  </span>
                </div>

                <div className={styles.cardImage}>
                  {p.isComboProduct ? (
                    <ComboProductImage
                      comboProduct={p}
                      variantSelections={{}}
                      className={styles.cardImageCombo}
                    />
                  ) : (() => {
                    const principalVariant = p.variants?.find(v => v.id === p.defaultVariantId) || p.variants?.[0];
                    const adminImageStr = p.thumbnailImageUrl || principalVariant?.imageUrl || p.mainImage || p.images?.[0] || '';
                    const displayUrl = adminImageStr || 'https://via.placeholder.com/400x400/eee/999?text=Producto';
                    const adminCrop = principalVariant?.thumbnailCrop?.percentages;

                    const brand = brandsData.find(b => b.id === p.brandId);
                    const brandBgStyle = brand ? {
                      backgroundColor: brand.bgType === 'color' ? brand.bgColor : 'transparent',
                      backgroundImage: brand.bgType === 'image' && brand.bgImage ? `url(${brand.bgImage})` : 'none',
                      backgroundSize: 'cover',
                      backgroundPosition: 'center'
                    } : {};

                    return (
                      <div style={{ width: '100%', height: '100%', ...brandBgStyle }}>
                        <OptimizedImage
                          src={toThumbnailImageUrl(displayUrl)}
                          fallbackSrc={toDirectImageUrl(displayUrl)}
                          alt={p.name}
                          containerClassName={styles.cardImageContainer}
                          cropData={adminCrop}
                          showSkeleton={true}
                        />
                      </div>
                    );
                  })()}
                </div>
                <div className={styles.cardBody}>
                  <h3 className={styles.cardName}>{p.name}</h3>
                  <p className={styles.cardMeta}>
                    {categoryName(p)} · S/ {Number(p.price || 0).toFixed(2)} · Stock: {p.inStock ?? 0}
                  </p>
                  <div className={styles.badges}>
                    {p.featured && <span className={styles.badge}>Destacado</span>}
                    {!isVisible && <span className={styles.badgeOculto}>Oculto</span>}
                  </div>
                </div>
                <div className={styles.cardActions}>
                  <Link
                    to={`/admin/productos/${p.id}`}
                    className={styles.btnEdit}
                    title="Editar producto"
                  >
                    <EditIcon size={16} />
                    <span>Editar</span>
                  </Link>
                  <button
                    type="button"
                    className={styles.btnDuplicate}
                    onClick={() => handleDuplicate(p)}
                    title="Duplicar producto"
                  >
                    <CopyIcon size={16} />
                    <span>Duplicar</span>
                  </button>
                  <button
                    type="button"
                    className={styles.btnDelete}
                    onClick={() => setDeleteConfirm(p)}
                    title="Eliminar producto"
                  >
                    <TrashIcon size={16} />
                    <span>Eliminar</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {products.length === 0 && !isLoading && (
        <p className={styles.empty}>No hay productos. <Link to="/admin/productos/nuevo">Crear uno</Link>.</p>
      )}

      {deleteConfirm && (
        <div className={styles.modalBackdrop} onClick={() => setDeleteConfirm(null)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <p>¿Eliminar el producto &quot;{deleteConfirm.name}&quot;?</p>
            <div className={styles.modalActions}>
              <Button variant="secondary" onClick={() => setDeleteConfirm(null)}>
                Cancelar
              </Button>
              <Button
                variant="primary"
                onClick={() => deleteMutation.mutate(deleteConfirm.id)}
                disabled={deleteMutation.isPending}
                style={{ backgroundColor: '#ff4757', borderColor: '#ff4757' }}
              >
                Eliminar
              </Button>
            </div>
          </div>
        </div>
      )}

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
};

export default AdminProductos;
