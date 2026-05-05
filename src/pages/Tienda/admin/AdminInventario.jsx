import React, { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getProducts, updateProduct } from '../../../services/products';
import { getCategories } from '../../../services/categories';
import { getCollections } from '../../../services/collections';
import { getBrands } from '../../../services/brands';
import { getTags } from '../../../services/tags';
import { getCharacters } from '../../../services/characters';
import { getProductTypes } from '../../../services/productTypes';
import { logInventoryChange } from '../../../services/inventoryLogs';
import { useAuth } from '../../../contexts/AuthContext';
import { Search, Filter, Loader2, Save, PackageX, PackageSearch } from 'lucide-react';
import styles from './AdminInventario.module.css';

const AdminInventario = () => {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterCollection, setFilterCollection] = useState('');
  const [filterBrand, setFilterBrand] = useState('');
  const [filterTag, setFilterTag] = useState('');
  const [filterCharacter, setFilterCharacter] = useState('');
  const [filterType, setFilterType] = useState('');
  
  const [products, setProducts] = useState([]);
  const [savingId, setSavingId] = useState(null);
  const [savedId, setSavedId] = useState(null);
  
  const timeoutRefs = useRef({});
  const initialStockRefs = useRef({});

  const { data: productsData, isLoading } = useQuery({
    queryKey: ['admin-inventory-products'],
    queryFn: async () => {
      const { data, error } = await getProducts([], null, null, { includeHidden: true });
      if (error) throw new Error(error);
      return data;
    }
  });

  const { data: categories } = useQuery({ queryKey: ['categories'], queryFn: async () => (await getCategories()).data });
  const { data: collections } = useQuery({ queryKey: ['collections'], queryFn: async () => (await getCollections()).data });
  const { data: brands } = useQuery({ queryKey: ['brands'], queryFn: async () => (await getBrands()).data });
  const { data: tags } = useQuery({ queryKey: ['tags'], queryFn: async () => (await getTags()).data });
  const { data: characters } = useQuery({ queryKey: ['characters'], queryFn: async () => (await getCharacters()).data });
  const { data: productTypes } = useQuery({ queryKey: ['productTypes'], queryFn: async () => (await getProductTypes()).data });

  useEffect(() => {
    if (productsData) {
      setProducts(productsData);
      productsData.forEach(p => {
        initialStockRefs.current[p.id] = p.inStock || 0;
      });
    }
  }, [productsData]);

  const handleStockChange = (id, newStockStr, productName) => {
    const newStock = parseInt(newStockStr, 10);
    if (isNaN(newStock) || newStock < 0) return;

    setProducts(prev => prev.map(p => p.id === id ? { ...p, inStock: newStock } : p));

    if (timeoutRefs.current[id]) {
      clearTimeout(timeoutRefs.current[id]);
    }

    setSavingId(id);
    
    timeoutRefs.current[id] = setTimeout(async () => {
      try {
        const oldStock = initialStockRefs.current[id] || 0;
        if (oldStock !== newStock) {
          await updateProduct(id, { inStock: newStock });
          await logInventoryChange(id, productName, oldStock, newStock, user?.email || 'Admin');
          initialStockRefs.current[id] = newStock;
        }
        setSavingId(null);
        setSavedId(id);
        setTimeout(() => setSavedId(null), 2000);
      } catch (error) {
        console.error("Error updating stock", error);
        setSavingId(null);
        alert('Error al guardar el inventario para ' + productName);
      }
    }, 1000);
  };

  const filteredProducts = products.filter(p => {
    const term = searchTerm.toLowerCase();
    const matchName = p.name?.toLowerCase().includes(term) || p.sku?.toLowerCase().includes(term);
    if (!matchName) return false;

    if (filterCategory && p.categoryId !== filterCategory && p.category !== filterCategory && !(p.categories || []).includes(filterCategory)) return false;
    if (filterCollection && !(p.collections || []).includes(filterCollection)) return false;
    if (filterBrand && p.brandId !== filterBrand) return false;
    if (filterTag && !(p.tags || []).includes(filterTag)) return false;
    if (filterCharacter && !(p.characters || []).includes(filterCharacter)) return false;
    if (filterType && p.productType !== filterType) return false;

    return true;
  });

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Inventario</h1>
          <p className={styles.subtitle}>Gestión rápida de cantidades, precios y disponibilidad</p>
        </div>
      </div>

      <div className={styles.filtersCard}>
        <div className={styles.searchRow}>
          <div className={styles.searchBox}>
            <Search size={20} className={styles.searchIcon} />
            <input 
              type="text" 
              placeholder="Buscar por nombre o SKU..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className={styles.searchInput}
            />
          </div>
        </div>
        
        <div className={styles.filtersGrid}>
          <div className={styles.filterGroup}>
            <Filter size={16} className={styles.filterIcon} />
            <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} className={styles.selectFilter}>
              <option value="">Todas las Categorías</option>
              {(categories || []).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div className={styles.filterGroup}>
            <Filter size={16} className={styles.filterIcon} />
            <select value={filterCollection} onChange={e => setFilterCollection(e.target.value)} className={styles.selectFilter}>
              <option value="">Todas las Colecciones</option>
              {(collections || []).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div className={styles.filterGroup}>
            <Filter size={16} className={styles.filterIcon} />
            <select value={filterBrand} onChange={e => setFilterBrand(e.target.value)} className={styles.selectFilter}>
              <option value="">Todas las Marcas</option>
              {(brands || []).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>

          <div className={styles.filterGroup}>
            <Filter size={16} className={styles.filterIcon} />
            <select value={filterType} onChange={e => setFilterType(e.target.value)} className={styles.selectFilter}>
              <option value="">Todos los Tipos</option>
              {(productTypes || []).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className={styles.loadingState}>
          <Loader2 className={styles.spinner} size={40} />
          <p>Cargando inventario completo...</p>
        </div>
      ) : (
        <div className={styles.tableCard}>
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Estado</th>
                  <th>Precio Venta</th>
                  <th>Stock Físico</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map(product => {
                  const stock = product.inStock || 0;
                  let statusClass = styles.inStock;
                  let statusText = 'Disponible';
                  if (stock === 0) {
                    statusClass = styles.outOfStock;
                    statusText = 'Agotado';
                  } else if (stock <= 3) {
                    statusClass = styles.lowStock;
                    statusText = 'Últimas uds';
                  }

                  const imgUrl = product.images?.[0] || product.thumbnailImageUrl || product.mainImage;

                  return (
                    <tr key={product.id}>
                      <td>
                        <div className={styles.productCell}>
                          {imgUrl ? (
                            <img src={imgUrl} alt={product.name} className={styles.productImage} />
                          ) : (
                            <div className={styles.productImageFallback}><PackageSearch size={20} /></div>
                          )}
                          <div className={styles.productInfo}>
                            <span className={styles.productName}>{product.name}</span>
                            <span className={styles.productSku}>{product.sku ? `SKU: ${product.sku}` : 'Sin SKU asignado'}</span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className={`${styles.stockBadge} ${statusClass}`}>
                          {statusText}
                        </span>
                      </td>
                      <td>
                        <span className={styles.priceText}>S/ {Number(product.salePrice || product.price || 0).toFixed(2)}</span>
                      </td>
                      <td>
                        <div className={styles.stockEditor}>
                          <input 
                            type="number"
                            min="0"
                            value={stock}
                            onChange={(e) => handleStockChange(product.id, e.target.value, product.name)}
                            className={styles.stockInput}
                          />
                          <div className={styles.saveStatus}>
                            {savingId === product.id && <Loader2 size={16} className={styles.savingSpinner} />}
                            {savedId === product.id && <Save size={16} className={styles.savedIcon} />}
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            
            {filteredProducts.length === 0 && (
              <div className={styles.emptyState}>
                <PackageX size={48} className={styles.emptyIcon} />
                <h3>No se encontraron productos</h3>
                <p>Intenta ajustar los filtros o el término de búsqueda</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminInventario;
