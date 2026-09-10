import React, { useState, useEffect } from 'react';
import { Search, Plus, Trash2, ImagePlus, Loader2, Package, X } from 'lucide-react';
import { searchProducts } from '../../../../services/products';
import { uploadFile } from '../../../../services/firebase/storage';
import ProductImageContainer from '../ProductImageContainer/ProductImageContainer';
import styles from './AdminComboEditor.module.css';

const AdminComboEditor = ({ comboItems, setComboItems, comboPreviewImage, setComboPreviewImage, draftId, excludeProductId, comboWillOverridePreview }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!searchTerm.trim()) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      const res = await searchProducts(searchTerm);
      if (!res.error) {
        // Antes solo mostraba productos "Personalizable" (res.data.filter(p =>
        // p.customizable === true)) — un producto normal (la mayoría del
        // catálogo) nunca podía agregarse a un combo, ese flag no tiene nada
        // que ver con poder formar parte de uno. Ahora se excluye lo que sí
        // rompería el combo: otro combo (anidar combos no está soportado en
        // ningún lado del renderizado) y el propio producto que se está
        // editando (agregarse a sí mismo).
        const eligible = res.data.filter(p =>
          !p.isComboProduct &&
          (!excludeProductId || p.id !== excludeProductId)
        );
        setSearchResults(eligible.slice(0, 5)); // Limit to 5 results
      }
      setIsSearching(false);
    }, 500);

    return () => clearTimeout(timer);
  }, [searchTerm, excludeProductId]);

  const addProductToCombo = (product) => {
    // Sin este chequeo se podía agregar el mismo producto varias veces (cada
    // click sumaba otra tarjeta idéntica en la tienda, sin ningún aviso).
    if (comboItems.some(item => item.productId === product.id)) {
      alert(`"${product.name}" ya está en este combo.`);
      return;
    }
    const newItem = {
      _uid: Math.random().toString(36).substring(2, 10), // Unique ID para React keys
      productId: product.id,
      name: product.name,
      imageUrl: product.images?.[0] || product.mainImage || '',
      position: comboItems.length,
      scale: 1,
      ...(product.YoryoPersonalizado ? { YoryoPersonalizado: product.YoryoPersonalizado } : {})
    };
    setComboItems([...comboItems, newItem]);
    setSearchTerm('');
  };

  const removeProduct = (idx) => {
    setComboItems(comboItems.filter((_, i) => i !== idx));
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const path = `productos_v2/${draftId}/combo_preview_${Date.now()}_${file.name}`;
      const { url, error } = await uploadFile(file, path);
      if (url) {
        setComboPreviewImage(url);
      } else {
        // Antes, si uploadFile fallaba (permisos, timeout, etc.), esto se
        // quedaba callado: el botón volvía a su estado normal y parecía que
        // no había pasado nada, sin decirle al admin que la foto NO se subió.
        alert(error || 'No se pudo subir la foto. Intenta de nuevo.');
      }
    } catch (err) {
      alert(err?.message || 'No se pudo subir la foto. Intenta de nuevo.');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  return (
    <div className={styles.wrapper}>
      <h2 className={styles.title}>Gestor de Productos Combo</h2>
      <p className={styles.subtitle}>Agrega productos de tu catálogo para conformar este combo.</p>

      {/* Selector de Productos */}
      <div className={styles.searchSection}>
        <div className={styles.searchBox}>
          <Search size={18} className={styles.searchIcon} />
          <input 
            type="text" 
            placeholder="Buscar producto por nombre..." 
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className={styles.searchInput}
          />
          {isSearching && <Loader2 size={16} className={`${styles.searchIcon} animate-spin`} style={{ right: '1rem', left: 'auto' }} />}
        </div>
        
        {searchResults.length > 0 && (
          <div className={styles.searchResults}>
            {searchResults.map(p => (
              <div key={p.id} className={styles.searchResultItem}>
                <img src={p.images?.[0] || p.mainImage || '/images/placeholder.svg'} alt={p.name} />
                <div className={styles.searchResultInfo}>
                  <strong>{p.name}</strong>
                  <span>{p.sku || 'Sin SKU'}</span>
                </div>
                <button type="button" onClick={() => addProductToCombo(p)} className={styles.addBtn}>
                  <Plus size={16} /> Agregar
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <hr className={styles.divider} />

      {/* Lista de Productos Añadidos */}
      <div className={styles.comboItemsSection}>
        <h3>Productos en el Combo ({comboItems.length})</h3>
        {comboItems.length === 0 ? (
          <div className={styles.emptyState}>
            <Package size={40} opacity={0.2} />
            <p>Busca y selecciona productos arriba para añadirlos al paquete.</p>
          </div>
        ) : (
          <div className={styles.comboItemsList}>
            {comboItems.map((item, idx) => (
              <div key={item._uid || `${item.productId}_${idx}`} className={styles.comboItem}>
                <img src={item.imageUrl || '/images/placeholder.svg'} alt={item.name} />
                <div className={styles.comboItemDetails}>
                  <strong>{item.name}</strong>
                  <span>Producto #{idx + 1}</span>
                </div>
                <button type="button" onClick={() => removeProduct(idx)} className={styles.removeBtn}>
                  <Trash2 size={18} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <hr className={styles.divider} />

      {/* Imagen Promocional del Combo */}
      <div className={styles.previewSection}>
        <h3>Foto Principal del Combo</h3>
        <p className={styles.subtitle}>Sube una foto promocional de los productos juntos.</p>
        {comboWillOverridePreview && (
          <div className={styles.overrideWarning}>
            ⚠️ Este combo tiene <strong>"Personalizable"</strong> activado: al guardar, esta foto se
            va a <strong>reemplazar sola</strong> por una captura automática del editor de diseño.
            Si quieres que se quede la que subiste aquí, desactiva "Personalizable".
          </div>
        )}
        <div className={styles.previewBox}>
          <ProductImageContainer
            imageUrl={comboPreviewImage}
            emptyMessage="Sin foto promocional"
          />
          <div className={styles.uploadRow} style={{ marginTop: '1rem' }}>
            <label className={styles.uploadBtn}>
              {uploading ? <Loader2 className="animate-spin" size={18} /> : <ImagePlus size={18} />}
              {uploading ? <span key="uploading">Subiendo...</span> : <span key="default">{comboPreviewImage ? 'Reemplazar Portada' : 'Subir Portada del Combo'}</span>}
              <input type="file" accept="image/*" onChange={handleImageUpload} hidden disabled={uploading} />
            </label>
            {/* Antes solo se podía REEMPLAZAR la foto, nunca quitarla del todo. */}
            {comboPreviewImage && (
              <button type="button" className={styles.removeImageBtn} onClick={() => setComboPreviewImage('')} disabled={uploading}>
                <X size={16} /> Quitar foto
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminComboEditor;
