import React, { useState, useEffect } from 'react';
import { getProducts } from '../../../services/products';
import { saveSuggestedPackage } from '../../../services/fechasImportantes';
import Button from '../../common/Button';
import { X, Search, Sparkles, Trash2 } from 'lucide-react';
import styles from './PackageCreatorModal.module.css';

const PackageCreatorModal = ({ recipientData, onClose }) => {
  const [step, setStep] = useState(1); // 1: Resumen y opciones, 2: Creador/Edición
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [allProducts, setAllProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Cargar productos
  useEffect(() => {
    const fetchProds = async () => {
      setLoadingProducts(true);
      try {
        const prods = await getProducts();
        setAllProducts(prods);
      } catch (e) {
        console.error(e);
      } finally {
        setLoadingProducts(false);
      }
    };
    fetchProds();
  }, []);

  const handleAutoGenerate = () => {
    // Filtrar productos que coincidan con las categorías seleccionadas por la persona (recipientData.selectedCategories)
    const prefs = recipientData.selectedCategories || [];
    
    let matchedProducts = [];
    if (prefs.length > 0) {
      matchedProducts = allProducts.filter(p => 
        p.categories && prefs.some(pref => p.categories.includes(pref))
      );
    }

    // Si no hay suficientes coincidencias, rellenar con aleatorios
    let candidates = [...matchedProducts];
    if (candidates.length < 3) {
      const remaining = allProducts.filter(p => !candidates.includes(p));
      const shuffled = remaining.sort(() => 0.5 - Math.random());
      candidates = [...candidates, ...shuffled.slice(0, 3 - candidates.length)];
    }

    // Tomar máximo 3
    const finalSelection = candidates.slice(0, 3);
    setSelectedProducts(finalSelection);
    setStep(2);
  };

  const handleManualCreate = () => {
    setSelectedProducts([]);
    setStep(2);
  };

  const addProduct = (prod) => {
    if (!selectedProducts.find(p => p.id === prod.id)) {
      setSelectedProducts([...selectedProducts, prod]);
    }
  };

  const removeProduct = (id) => {
    setSelectedProducts(selectedProducts.filter(p => p.id !== id));
  };

  const handleSavePackage = async () => {
    if (selectedProducts.length === 0) {
      return alert('El paquete debe tener al menos un producto.');
    }
    
    setSaving(true);
    try {
      const packageData = {
        userId: recipientData.userId,
        recipientId: recipientData.recipientId,
        eventId: recipientData.eventId,
        eventType: recipientData.eventType,
        products: selectedProducts.map(p => ({
          id: p.id,
          name: p.name,
          price: p.price,
          image: p.images?.[0] || ''
        })),
        status: 'pending_notification'
      };
      
      await saveSuggestedPackage(packageData);
      alert('Paquete sugerido guardado correctamente.');
      onClose();
    } catch (e) {
      alert('Error al guardar el paquete.');
    } finally {
      setSaving(false);
    }
  };

  const filteredCatalog = allProducts.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) && 
    !selectedProducts.find(sp => sp.id === p.id)
  );

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalContent}>
        <div className={styles.header}>
          <h2>Crear Paquete para {recipientData.recipientName}</h2>
          <button onClick={onClose} className={styles.closeBtn}>
            <X size={24} />
          </button>
        </div>

        {step === 1 && (
          <div className={styles.body}>
            <div className={styles.infoCard}>
              <h3>Información del Destinatario</h3>
              <p><strong>Relación:</strong> {recipientData.recipientRole}</p>
              <p><strong>Evento:</strong> {recipientData.eventType} ({recipientData.eventDate})</p>
              <div className={styles.tagsContainer}>
                <strong>Gustos principales:</strong>
                {recipientData.selectedCategories && recipientData.selectedCategories.length > 0 ? (
                  recipientData.selectedCategories.map((cat, i) => (
                    <span key={i} className={styles.tag}>{cat}</span>
                  ))
                ) : (
                  <span style={{color: '#64748b'}}>No se registraron gustos específicos.</span>
                )}
              </div>
            </div>

            <div className={styles.actionsBox}>
              <button 
                onClick={handleAutoGenerate} 
                className={`${styles.actionBtn} ${styles.autoBtn}`}
                disabled={loadingProducts}
              >
                <Sparkles size={24} />
                <span>Generación Automática</span>
                <small>Arma un paquete de 3 productos según sus gustos</small>
              </button>

              <button 
                onClick={handleManualCreate} 
                className={`${styles.actionBtn} ${styles.manualBtn}`}
                disabled={loadingProducts}
              >
                <Search size={24} />
                <span>Selección Manual</span>
                <small>Escoge los productos del catálogo tú mismo</small>
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className={styles.body}>
            <div className={styles.layout}>
              <div className={styles.selectedSection}>
                <h3>Productos en el Paquete ({selectedProducts.length})</h3>
                {selectedProducts.length === 0 ? (
                  <div className={styles.emptySelected}>No hay productos seleccionados</div>
                ) : (
                  <div className={styles.selectedList}>
                    {selectedProducts.map(prod => (
                      <div key={prod.id} className={styles.selectedItem}>
                        <img src={prod.images?.[0] || 'https://via.placeholder.com/50'} alt={prod.name} />
                        <div className={styles.itemInfo}>
                          <h4>{prod.name}</h4>
                          <p>S/ {prod.price}</p>
                        </div>
                        <button onClick={() => removeProduct(prod.id)} className={styles.removeBtn}>
                          <Trash2 size={18} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                
                <div style={{ marginTop: 'auto', paddingTop: '1rem' }}>
                  <Button variant="primary" fullWidth onClick={handleSavePackage} disabled={saving || selectedProducts.length === 0}>
                    {saving ? 'Guardando...' : 'Guardar Paquete Sugerido'}
                  </Button>
                </div>
              </div>

              <div className={styles.catalogSection}>
                <h3>Catálogo de Productos</h3>
                <div className={styles.searchBar}>
                  <Search size={18} />
                  <input 
                    type="text" 
                    placeholder="Buscar producto..." 
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                  />
                </div>
                
                <div className={styles.catalogGrid}>
                  {filteredCatalog.map(prod => (
                    <div key={prod.id} className={styles.catalogItem}>
                      <img src={prod.images?.[0] || 'https://via.placeholder.com/100'} alt={prod.name} />
                      <h4>{prod.name}</h4>
                      <p>S/ {prod.price}</p>
                      <button onClick={() => addProduct(prod)} className={styles.addBtn}>
                        Añadir
                      </button>
                    </div>
                  ))}
                  {filteredCatalog.length === 0 && (
                    <p className={styles.emptySelected}>No se encontraron productos.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PackageCreatorModal;
