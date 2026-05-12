import React, { useState, useEffect } from 'react';
import { getLandingPages, saveLandingPage, deleteLandingPage } from '../services/landingPages';
import { getThemes } from '../services/themes';
import { getProducts } from '../../../services/products';
import Button from '../../../components/common/Button';
import styles from '../../admin/AdminLandingPages.module.css';
import { useNavigate } from 'react-router-dom';

const AdminLandingPages = () => {
  const [pages, setPages] = useState([]);
  const [themes, setThemes] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    id: null,
    title: '',
    slug: '',
    hideHeader: false,
    hideFooter: false,
    themeId: '',
    linkedProducts: [] // { productId, stockType: 'global' | 'infinite' | 'exclusive', allocatedStock: 0 }
  });

  const [searchProduct, setSearchProduct] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const [pagesData, productsData, themesData] = await Promise.all([
      getLandingPages(),
      getProducts(),
      getThemes()
    ]);
    setPages(pagesData);
    setProducts(productsData.data || []);
    setThemes(themesData);
    setLoading(false);
  };

  const handleAddNew = () => {
    setFormData({
      id: null,
      title: '',
      slug: '',
      hideHeader: true,
      hideFooter: true,
      themeId: '',
      linkedProducts: []
    });
    setIsEditing(true);
  };

  const handleEdit = (page) => {
    setFormData({
      id: page.id,
      title: page.title || '',
      slug: page.slug || '',
      hideHeader: !!page.hideHeader,
      hideFooter: !!page.hideFooter,
      themeId: page.themeId || '',
      linkedProducts: page.linkedProducts || []
    });
    setIsEditing(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('¿Seguro que quieres eliminar esta Landing Page? Esto también borrará su diseño visual.')) {
      await deleteLandingPage(id);
      fetchData();
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!formData.title || !formData.slug) {
      alert("El título y el slug son obligatorios.");
      return;
    }
    // Formato slug (remover slash inicial si lo puso)
    const cleanSlug = formData.slug.replace(/^\/+/, '').toLowerCase().trim().replace(/\s+/g, '-');
    
    // Check if slug is unique
    const existing = pages.find(p => p.slug === cleanSlug && p.id !== formData.id);
    if (existing) {
      alert("Ya existe una página con esa URL. Escoge otra.");
      return;
    }

    const { error } = await saveLandingPage(formData.id, {
      ...formData,
      slug: cleanSlug
    });

    if (error) {
      alert("Error guardando: " + error);
    } else {
      setIsEditing(false);
      fetchData();
    }
  };

  const addLinkedProduct = (product) => {
    if (formData.linkedProducts.find(lp => lp.productId === product.id)) return;
    setFormData(prev => ({
      ...prev,
      linkedProducts: [...prev.linkedProducts, { 
        productId: product.id, 
        stockType: 'global', // default
        allocatedStock: 0 
      }]
    }));
  };

  const updateLinkedProduct = (productId, field, value) => {
    setFormData(prev => ({
      ...prev,
      linkedProducts: prev.linkedProducts.map(lp => 
        lp.productId === productId ? { ...lp, [field]: value } : lp
      )
    }));
  };

  const removeLinkedProduct = (productId) => {
    setFormData(prev => ({
      ...prev,
      linkedProducts: prev.linkedProducts.filter(lp => lp.productId !== productId)
    }));
  };

  const filteredProducts = products.filter(p => p.name?.toLowerCase().includes(searchProduct.toLowerCase()) || p.sku?.toLowerCase().includes(searchProduct.toLowerCase())).slice(0, 5);

  if (loading) return <div className={styles.container}>Cargando...</div>;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h2>Landing Pages Dinámicas</h2>
          <p>Crea páginas promocionales o embudos sin distracciones (con URL personalizada).</p>
        </div>
        {!isEditing && (
          <Button variant="primary" onClick={handleAddNew}>+ Nueva Landing Page</Button>
        )}
      </div>

      {isEditing ? (
        <div className={styles.formCard}>
          <h3>{formData.id ? 'Editar Configuración' : 'Nueva Configuración'}</h3>
          <form onSubmit={handleSave} className={styles.form}>
            <div className={styles.row}>
              <div className={styles.inputGroup}>
                <label>Nombre Interno (Título)</label>
                <input 
                  type="text" 
                  value={formData.title} 
                  onChange={e => setFormData({...formData, title: e.target.value})} 
                  placeholder="Ej: Promo Navidad 2026"
                  required
                />
              </div>
              <div className={styles.inputGroup}>
                <label>URL Personalizada (Slug)</label>
                <div className={styles.slugInput}>
                  <span>misitio.com/</span>
                  <input 
                    type="text" 
                    value={formData.slug} 
                    onChange={e => setFormData({...formData, slug: e.target.value})} 
                    placeholder="promo-navidad"
                    required
                  />
                </div>
              </div>
            </div>

            <div className={styles.row}>
              <div className={styles.inputGroup}>
                <label>Tema Visual Personalizado (Opcional)</label>
                <select 
                  value={formData.themeId} 
                  onChange={e => setFormData({...formData, themeId: e.target.value})}
                  className={styles.input}
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid #ccc', borderRadius: '4px' }}
                >
                  <option value="">-- Tema Global de la Tienda --</option>
                  {themes.map(t => (
                    <option key={t.id} value={t.id}>{t.name} ({t.type === 'custom_css' ? 'CSS' : 'WP'})</option>
                  ))}
                </select>
              </div>
            </div>

            <div className={styles.toggles}>
              <label className={styles.toggleLabel}>
                <input 
                  type="checkbox" 
                  checked={formData.hideHeader} 
                  onChange={e => setFormData({...formData, hideHeader: e.target.checked})} 
                />
                Ocultar Encabezado (Header global)
              </label>
              <label className={styles.toggleLabel}>
                <input 
                  type="checkbox" 
                  checked={formData.hideFooter} 
                  onChange={e => setFormData({...formData, hideFooter: e.target.checked})} 
                />
                Ocultar Pie de Página (Footer global)
              </label>
            </div>

            <hr className={styles.divider} />
            
            <div className={styles.linkedProductsSection}>
              <h4>Productos Enlazados (Opcional)</h4>
              <p className={styles.helpText}>Asigna productos específicos a esta Landing Page y define cómo se descontará su inventario al comprarse desde aquí.</p>
              
              <div className={styles.productSearch}>
                <input 
                  type="text" 
                  placeholder="Buscar producto por nombre o SKU para añadir..." 
                  value={searchProduct}
                  onChange={e => setSearchProduct(e.target.value)}
                />
                {searchProduct && (
                  <ul className={styles.searchResults}>
                    {filteredProducts.map(p => (
                      <li key={p.id} onClick={() => { addLinkedProduct(p); setSearchProduct(''); }}>
                        <img src={p.images?.[0] || 'https://via.placeholder.com/40'} alt={p.name} />
                        <span>{p.name}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {formData.linkedProducts.length > 0 && (
                <table className={styles.linkedTable}>
                  <thead>
                    <tr>
                      <th>Producto</th>
                      <th>Tipo de Inventario</th>
                      <th>Cantidad Asignada</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {formData.linkedProducts.map(lp => {
                      const product = products.find(p => p.id === lp.productId);
                      if (!product) return null;
                      return (
                        <tr key={lp.productId}>
                          <td>{product.name} <br/><small>{product.sku || 'Sin SKU'}</small></td>
                          <td>
                            <select 
                              value={lp.stockType} 
                              onChange={e => updateLinkedProduct(lp.productId, 'stockType', e.target.value)}
                            >
                              <option value="global">Descontar del Total (Global)</option>
                              <option value="exclusive">Stock Exclusivo de Landing</option>
                              <option value="infinite">Stock Infinito (Sin Límite)</option>
                            </select>
                          </td>
                          <td>
                            {lp.stockType === 'exclusive' ? (
                              <input 
                                type="number" 
                                min="0" 
                                value={lp.allocatedStock} 
                                onChange={e => updateLinkedProduct(lp.productId, 'allocatedStock', parseInt(e.target.value) || 0)}
                                className={styles.numberInput}
                              />
                            ) : (
                              <span className={styles.mutedText}>No aplica</span>
                            )}
                          </td>
                          <td>
                            <button type="button" onClick={() => removeLinkedProduct(lp.productId)} className={styles.dangerBtn}>Quitar</button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            <div className={styles.formActions}>
              <Button variant="secondary" onClick={() => setIsEditing(false)}>Cancelar</Button>
              <Button type="submit" variant="primary">Guardar Configuración</Button>
            </div>
          </form>
        </div>
      ) : (
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Título</th>
                <th>URL (Slug)</th>
                <th>Header / Footer</th>
                <th>Productos</th>
                <th>Diseño Visual</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {pages.map(page => (
                <tr key={page.id}>
                  <td><strong>{page.title}</strong></td>
                  <td><a href={`/${page.slug}`} target="_blank" rel="noreferrer" className={styles.urlLink}>/{page.slug}</a></td>
                  <td>
                    <span className={styles.badge}>{page.hideHeader ? 'Oculto' : 'Visible'}</span> / <span className={styles.badge}>{page.hideFooter ? 'Oculto' : 'Visible'}</span>
                  </td>
                  <td>{page.linkedProducts?.length || 0} asignados</td>
                  <td>
                    <Button variant="primary" onClick={() => {
                      // Usar el visual editor en el landing page
                      navigate(`/${page.slug}`);
                    }} className={styles.editDesignBtn}>
                      Abrir Editor Visual
                    </Button>
                  </td>
                  <td>
                    <div className={styles.actions}>
                      <button onClick={() => handleEdit(page)} className={styles.actionBtn}>Configurar</button>
                      <button onClick={() => handleDelete(page.id)} className={`${styles.actionBtn} ${styles.danger}`}>Eliminar</button>
                    </div>
                  </td>
                </tr>
              ))}
              {pages.length === 0 && (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '2rem' }}>No has creado ninguna Landing Page todavía.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default AdminLandingPages;
