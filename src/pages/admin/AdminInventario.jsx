import React, { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getProducts, updateProduct } from '../../services/products';
import { getCategories } from '../../services/products'; // O de categories si está ahí
import { getCollections } from '../../services/collections';
import { getBrands } from '../../services/brands';
import { getTags } from '../../services/tags';
import { getCharacters } from '../../services/characters';
import { getProductTypes } from '../../services/productTypes';
import { logInventoryChange } from '../../services/inventoryLogs';
import { useAuth } from '../../contexts/AuthContext';
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

    // Update locally for immediate feedback
    setProducts(prev => prev.map(p => p.id === id ? { ...p, inStock: newStock } : p));

    // Clear previous timeout for this product
    if (timeoutRefs.current[id]) {
      clearTimeout(timeoutRefs.current[id]);
    }

    setSavingId(id);
    
    // Debounce save to Firestore
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
    }, 1000); // 1 second debounce
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
    <div className={styles.container}>
      <div className={styles.header}>
        <h2>Inventario (Cantidades)</h2>
      </div>

      <div className={styles.controls} style={{ flexWrap: 'wrap' }}>
        <input 
          type="text" 
          placeholder="Buscar por nombre o SKU..." 
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className={styles.searchInput}
          style={{ minWidth: '250px' }}
        />
        
        <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} className={styles.searchInput} style={{ minWidth: '150px', flex: 'none' }}>
          <option value="">Todas las Categorías</option>
          {(categories || []).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>

        <select value={filterCollection} onChange={e => setFilterCollection(e.target.value)} className={styles.searchInput} style={{ minWidth: '150px', flex: 'none' }}>
          <option value="">Todas las Colecciones</option>
          {(collections || []).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>

        <select value={filterBrand} onChange={e => setFilterBrand(e.target.value)} className={styles.searchInput} style={{ minWidth: '150px', flex: 'none' }}>
          <option value="">Todas las Marcas</option>
          {(brands || []).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>

        <select value={filterType} onChange={e => setFilterType(e.target.value)} className={styles.searchInput} style={{ minWidth: '150px', flex: 'none' }}>
          <option value="">Todos los Tipos</option>
          {(productTypes || []).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>

        <select value={filterTag} onChange={e => setFilterTag(e.target.value)} className={styles.searchInput} style={{ minWidth: '150px', flex: 'none' }}>
          <option value="">Todas las Etiquetas</option>
          {(tags || []).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>

        <select value={filterCharacter} onChange={e => setFilterCharacter(e.target.value)} className={styles.searchInput} style={{ minWidth: '150px', flex: 'none' }}>
          <option value="">Todos los Personajes</option>
          {(characters || []).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {isLoading ? (
        <p>Cargando inventario...</p>
      ) : (
        <div className={styles.tableContainer}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Producto</th>
                <th>Estado</th>
                <th>Precio</th>
                <th>Stock Actual</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map(product => {
                const stock = product.inStock || 0;
                let statusClass = styles.inStock;
                let statusText = 'En Stock';
                if (stock === 0) {
                  statusClass = styles.outOfStock;
                  statusText = 'Agotado';
                } else if (stock <= 3) {
                  statusClass = styles.lowStock;
                  statusText = 'Stock Bajo';
                }

                return (
                  <tr key={product.id}>
                    <td>
                      <div className={styles.productCell}>
                        <img 
                          src={product.images && product.images[0] ? product.images[0] : 'https://via.placeholder.com/50'} 
                          alt={product.name} 
                          className={styles.productImage}
                        />
                        <div className={styles.productInfo}>
                          <span className={styles.productName}>{product.name}</span>
                          <span className={styles.productSku}>{product.sku ? `SKU: ${product.sku}` : 'Sin SKU'}</span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className={`${styles.stockStatus} ${statusClass}`}>
                        {statusText}
                      </span>
                    </td>
                    <td>
                      S/ {product.salePrice ? product.salePrice : product.price}
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        <input 
                          type="number"
                          min="0"
                          value={stock}
                          onChange={(e) => handleStockChange(product.id, e.target.value, product.name)}
                          className={styles.stockInput}
                        />
                        {savingId === product.id && <span style={{ marginLeft: 10, fontSize: '0.8rem', color: '#666' }}>Guardando...</span>}
                        {savedId === product.id && <span className={styles.savedIndicator}>¡Guardado!</span>}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredProducts.length === 0 && (
                <tr>
                  <td colSpan="4" style={{ textAlign: 'center', padding: '2rem', color: '#666' }}>
                    No se encontraron productos
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default AdminInventario;
