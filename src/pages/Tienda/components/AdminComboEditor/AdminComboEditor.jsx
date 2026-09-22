import React, { useState, useEffect } from 'react';
import { Search, Plus, Trash2, ImagePlus, Loader2, Package, X } from 'lucide-react';
import { searchProducts, getProduct } from '../../../../services/products';
import { uploadFile } from '../../../../services/firebase/storage';
import ProductImageContainer from '../ProductImageContainer/ProductImageContainer';
import styles from './AdminComboEditor.module.css';

const AdminComboEditor = ({ comboItems, setComboItems, comboPreviewImage, setComboPreviewImage, draftId, excludeProductId, comboWillOverridePreview }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [uploading, setUploading] = useState(false);
  // Variantes de cada pieza del combo, { [productId]: [variante, ...] }. El
  // comboItem guardado solo trae productId/name/imageUrl, así que para poder
  // ofrecer los colores hay que traerse el producto.
  const [variantesPorProducto, setVariantesPorProducto] = useState({});

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
        // Antes se cortaba a los primeros 5 sin avisar — con un término corto
        // ("el", "casaca") eso escondía la mayoría de coincidencias. La lista
        // ya es scrolleable (max-height + overflow-y en el CSS), así que se
        // muestran todas.
        setSearchResults(eligible);
      }
      setIsSearching(false);
    }, 500);

    return () => clearTimeout(timer);
  }, [searchTerm, excludeProductId]);

  // Carga las variantes de las piezas que ya estaban guardadas en el combo (al
  // abrir un combo existente no pasan por addProductToCombo, así que sus
  // colores no están en memoria). Solo pide las que faltan.
  useEffect(() => {
    const pendientes = (comboItems || [])
      .map((i) => i.productId)
      .filter((id) => id && !(id in variantesPorProducto));
    if (pendientes.length === 0) return;

    let cancelado = false;
    (async () => {
      const nuevos = {};
      for (const id of [...new Set(pendientes)]) {
        try {
          const { data } = await getProduct(id);
          nuevos[id] = Array.isArray(data?.variants) ? data.variants : [];
        } catch {
          nuevos[id] = [];   // si falla, esa pieza simplemente no ofrece colores
        }
      }
      if (!cancelado) setVariantesPorProducto((prev) => ({ ...prev, ...nuevos }));
    })();

    return () => { cancelado = true; };
  }, [comboItems, variantesPorProducto]);

  /**
   * Fija con qué color entra una pieza al combo. Se escribe en
   * variantMapping.color, que es lo que la ficha usa como selección inicial
   * (ver getComboVariantInfo en ProductDetail), y de paso se cambia la
   * imageUrl de la pieza por la de esa variante para que la miniatura de aquí
   * y el collage de la tienda muestren el color correcto.
   */
  const setItemColor = (idx, colorName) => {
    setComboItems(comboItems.map((item, i) => {
      if (i !== idx) return item;
      const variante = (variantesPorProducto[item.productId] || []).find((v) => v.name === colorName);
      return {
        ...item,
        variantMapping: { ...(item.variantMapping || {}), color: colorName },
        ...(variante?.imageUrl ? { imageUrl: variante.imageUrl } : {}),
      };
    }));
  };

  const addProductToCombo = (product) => {
    // Sin este chequeo se podía agregar el mismo producto varias veces (cada
    // click sumaba otra tarjeta idéntica en la tienda, sin ningún aviso).
    if (comboItems.some(item => item.productId === product.id)) {
      alert(`"${product.name}" ya está en este combo.`);
      return;
    }
    // El buscador ya devuelve el producto entero, así que sus colores se
    // guardan aquí mismo y el selector puede pintarse sin ir de nuevo a la BD.
    const variantes = Array.isArray(product.variants) ? product.variants : [];
    setVariantesPorProducto((prev) => ({ ...prev, [product.id]: variantes }));

    // Se preselecciona el primer color. Antes la pieza entraba SIN
    // variantMapping y la ficha, al no ver colores fijados, le ofrecía al
    // cliente todas las variantes del producto (ver getComboVariantInfo).
    const primera = variantes[0];

    const newItem = {
      _uid: Math.random().toString(36).substring(2, 10), // Unique ID para React keys
      productId: product.id,
      name: product.name,
      imageUrl: primera?.imageUrl || product.images?.[0] || product.mainImage || '',
      position: comboItems.length,
      scale: 1,
      ...(primera?.name ? { variantMapping: { color: primera.name } } : {}),
      ...(product.YoryoPersonalizado ? { YoryoPersonalizado: product.YoryoPersonalizado } : {})
    };
    setComboItems([...comboItems, newItem]);
    setSearchTerm('');
  };

  const renameItem = (idx, newName) => {
    setComboItems(comboItems.map((item, i) => (i === idx ? { ...item, name: newName } : item)));
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
                  {/* Antes esto era texto fijo (<strong>{item.name}</strong>): el
                      nombre quedaba pegado para siempre al que tenía el producto
                      al momento de agregarlo ("Ella"/"Él", etc.), sin forma de
                      corregirlo por diseño desde el combo. */}
                  <input
                    type="text"
                    className={styles.comboItemNameInput}
                    value={item.name}
                    onChange={(e) => renameItem(idx, e.target.value)}
                    placeholder="Nombre de esta pieza en el combo"
                    aria-label={`Nombre de la pieza #${idx + 1} del combo`}
                  />
                  {/* Color con el que entra esta pieza al combo. Si el producto
                      no tiene variantes no se pinta nada. */}
                  {(() => {
                    const colores = variantesPorProducto[item.productId] || [];
                    if (colores.length === 0) return <span>Producto #{idx + 1}</span>;

                    const actual = item.variantMapping?.color || '';
                    // Si el color guardado ya no existe (se renombró o se borró
                    // la variante) el select se quedaría en blanco y al guardar
                    // se perdería sin aviso. Se muestra marcado para que el
                    // admin vea que hay que reelegirlo.
                    const huerfano = actual && !colores.some((v) => v.name === actual);

                    return (
                      <label className={styles.comboItemColor}>
                        <span>Color:</span>
                        <select
                          value={actual}
                          onChange={(e) => setItemColor(idx, e.target.value)}
                          aria-label={`Color de ${item.name} en el combo`}
                        >
                          {!actual && <option value="">— elegir —</option>}
                          {huerfano && <option value={actual}>{actual} (ya no existe)</option>}
                          {colores.map((v) => (
                            <option key={v.id || v.name} value={v.name}>{v.name}</option>
                          ))}
                        </select>
                      </label>
                    );
                  })()}
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
