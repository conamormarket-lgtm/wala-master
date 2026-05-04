import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { useProduct } from '../hooks/useProducts';
import { useEditor, EditorProvider } from '../contexts/EditorContext';
import { useCart } from '../contexts/CartContext';
import { useAuth } from '../contexts/AuthContext';
import { DesignClipboardProvider } from '../contexts/DesignClipboardContext';
import { getDesignById, saveDesign, getDesignsByUser } from '../services/designs';
import { isComboProduct } from '../utils/comboProductUtils';
import { generateFullUserComboCartPreview, generatePerItemSidePreviews } from '../utils/comboImageComposer';
import AdminViewEditor from '../components/admin/AdminViewEditor/AdminViewEditor';
import UnifiedComboEditor from '../components/admin/UnifiedComboEditor/UnifiedComboEditor';
import ComboUserEditor from '../components/editor/ComboUserEditor/ComboUserEditor';
import Button from '../components/common/Button';
import Modal from '../components/common/Modal/Modal';
import DraggableContainer from '../components/common/DraggableContainer/DraggableContainer';
import { useImagePreloader } from '../components/common/OptimizedImage/OptimizedImage';
import styles from './EditorPage.module.css';

const DEFAULT_VIEW_ID = 'default';

const EditorPage = () => {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const size = searchParams.get('size') || '';
  const color = searchParams.get('color') || '';
  const designId = searchParams.get('designId');

  const { data: product, isLoading } = useProduct(id);
  const {
    setProduct,
    setVariant,
    setActiveViewId,
    setLayersByViewFromDesign,
    setLayersForView,
    calculatePrice,
    price,
    layersByView,
    activeViewId,
    product: editorProduct,
    variant,
    setActivePrintAreaId
  } = useEditor();
  const { addToCart } = useCart();
  const { user } = useAuth();
  // Estado local de customización del combo para el USUARIO.
  // NUNCA modifica el producto original del administrador.
  // Al guardar, se crea un clon en "Mis creaciones" del usuario.
  const [userComboCustomization, setUserComboCustomization] = useState(null);
  const [savingDesign, setSavingDesign] = useState(false);
  const [designLoaded, setDesignLoaded] = useState(false);
  const [editorMounted, setEditorMounted] = useState(false);
  const [existingDesignPrompt, setExistingDesignPrompt] = useState(null);
  const [showExitModal, setShowExitModal] = useState(false);
  const [showSavePromptModal, setShowSavePromptModal] = useState(false);
  const [isEditingBackSide, setIsEditingBackSide] = useState(false);
  const bypassGuardsRef = useRef(false);
  const [savedHash, setSavedHash] = useState(null);
  const [showMobileSettingsModal, setShowMobileSettingsModal] = useState(false);

  const currentHash = useMemo(() => 
    JSON.stringify({ layersByView, userComboCustomization, variant }),
  [layersByView, userComboCustomization, variant]);

  // Precargar todas las imágenes del producto para navegación sin saltos (caché)
  const allProductUrls = useMemo(() => {
    if (!product) return [];
    const urls = new Set();
    const extract = (obj) => {
      if (!obj) return;
      if (typeof obj === 'string') {
        if (obj.startsWith('http') && (obj.includes('cloudinary') || obj.match(/\.(jpeg|jpg|webp|png|gif)$/i))) {
          urls.add(obj);
        }
      } else if (Array.isArray(obj)) {
        obj.forEach(extract);
      } else if (typeof obj === 'object') {
        Object.values(obj).forEach(extract);
      }
    };
    extract(product);
    return Array.from(urls);
  }, [product]);

  useImagePreloader(allProductUrls);

  useEffect(() => {
    if (designLoaded && savedHash === null) {
      setSavedHash(currentHash);
    }
  }, [designLoaded, currentHash, savedHash]);

  const handleComboLayersChange = useCallback((newLayers) => {
    setUserComboCustomization((prev) => {
      const base = prev || product?.comboItemCustomization || [];
      let changed = false;
      const next = base.map(x => ({ ...x })); // shallow clone to safely assign
      
      Object.entries(newLayers).forEach(([vId, layers]) => {
        const match = vId.match(/^combo-view-(\d+)-([^]+)$/);
        if (match) {
          const index = parseInt(match[1], 10);
          if (!next[index]) {
            next[index] = { layersByView: {} };
            changed = true;
          }
          if (!next[index].layersByView) {
            next[index].layersByView = {};
            changed = true;
          }
          if (next[index].layersByView[vId] !== layers) {
            next[index].layersByView = { ...next[index].layersByView, [vId]: layers };
            changed = true;
          }
        }
      });
      return changed ? next : prev;
    });
  }, [product?.comboItemCustomization]);

  const handleVariantChange = useCallback((idx, variant) => {
    setUserComboCustomization(prev => {
      const next = [...(prev || product?.comboItemCustomization || [])];
      if (!next[idx]) next[idx] = {};
      
      // Compare to avoid infinite loops if it hasn't actually changed
      if (next[idx].variant?.color === variant?.color && next[idx].variant?.size === variant?.size) {
        return prev;
      }
      
      next[idx] = { ...next[idx], variant };
      return next;
    });
  }, [product?.comboItemCustomization]);

  React.useEffect(() => {
    const t = setTimeout(() => setEditorMounted(true), 0);
    
    // Añadimos clase global para ocultar elementos invasivos en móvil (footer, nav bottom, etc.)
    document.body.classList.add('mobile-editor-active');
    
    return () => {
      clearTimeout(t);
      document.body.classList.remove('mobile-editor-active');
    };
  }, []);

  const isCombo = isComboProduct(product || {});

  const hasUnsavedLayers = useMemo(() => {
    let hasAnyLayer = false;
    if (isCombo) {
      if (Array.isArray(userComboCustomization)) {
        hasAnyLayer = userComboCustomization.some(item => 
          item.layersByView && Object.values(item.layersByView).some(arr => Array.isArray(arr) && arr.length > 0)
        );
      }
    } else {
      hasAnyLayer = Object.values(layersByView || {}).some((arr) => Array.isArray(arr) && arr.length > 0);
    }
    return hasAnyLayer && savedHash !== null && currentHash !== savedHash;
  }, [isCombo, userComboCustomization, layersByView, currentHash, savedHash]);

  useEffect(() => {
    if (!hasUnsavedLayers) return;

    // 1. Native Tab Closing Prevention
    const onBeforeUnload = (e) => {
      if (bypassGuardsRef.current) return;
      e.preventDefault();
      e.returnValue = ''; 
    };
    window.addEventListener('beforeunload', onBeforeUnload);

    // 2. Browser Back Button / History Interception
    // Push a dummy state so clicking back doesn't actually leave
    window.history.pushState(null, null, window.location.pathname);
    const handlePopState = (e) => {
      if (bypassGuardsRef.current) return;
      // Push it back immediately
      window.history.pushState(null, null, window.location.pathname);
      setShowExitModal(true);
    };
    window.addEventListener('popstate', handlePopState);

    // 3. React Router Link Interception (global click interception)
    const handleClick = (e) => {
      if (bypassGuardsRef.current) return;
      const anchor = e.target.closest('a');
      if (anchor && anchor.href) {
        // Ignorar descargas o modales locales reales
        if (anchor.target === '_blank' || anchor.hasAttribute('download')) return;
        
        // Verifica si la url de destino es distinta a la ruta actual (excluyendo query parameters si se desea, aquí excluiremos id)
        const currentOrigin = window.location.origin;
        if (anchor.href.startsWith(currentOrigin) && anchor.pathname !== window.location.pathname) {
          e.preventDefault();
          e.stopPropagation();
          setShowExitModal(true);
        }
      }
    };
    document.addEventListener('click', handleClick, true);

    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      window.removeEventListener('popstate', handlePopState);
      document.removeEventListener('click', handleClick, true);
    };
  }, [hasUnsavedLayers]);

  const handleReturn = () => {
    if (hasUnsavedLayers) {
      setShowExitModal(true);
    } else {
      bypassGuardsRef.current = true;
      navigate(`/producto/${product?.id || id}`);
    }
  };

  const handleResetDesign = () => {
    if (!window.confirm("¿Seguro que deseas restablecer el diseño al original? Se perderán todos tus cambios no guardados.")) return;
    const url = new URL(window.location.href);
    url.searchParams.delete('designId');
    window.location.href = url.toString();
  };

  const views = useMemo(
    () => (Array.isArray(product?.customizationViews) ? product.customizationViews : []),
    [product?.customizationViews]
  );
  const hasMultipleViews = views.length > 0;

  useEffect(() => {
    if (product) {
      setProduct(product);
      setVariant({ size: size || '', color: color || '' });
      const viewIdToSet = hasMultipleViews && views[0]?.id ? views[0].id : DEFAULT_VIEW_ID;
      setActiveViewId(viewIdToSet);

      const comboSelectionsParam = searchParams.get('comboSelections');
      if (isComboProduct(product) && comboSelectionsParam) {
        try {
          const parsed = JSON.parse(comboSelectionsParam);
          const baseCustomization = Array.isArray(product.comboItemCustomization) 
            ? product.comboItemCustomization 
            : Array((product.comboItems || []).length).fill({});
            
          const initialComboCust = baseCustomization.map((dbItem, index) => {
             const urlSel = parsed[index];
             if (urlSel) {
               return {
                 ...dbItem,
                 variant: { ...(dbItem.variant || {}), ...urlSel }
               };
             }
             return dbItem;
          });
          setUserComboCustomization(prev => prev || initialComboCust);
        } catch (e) {
          console.error("Error parsing comboSelections", e);
        }
      }

      // Inicializar zona activa: primera zona de la vista actual
      const currentView = views.find(v => v.id === viewIdToSet) || views[0] || null;
      if (currentView?.printAreas && Array.isArray(currentView.printAreas) && currentView.printAreas.length > 0) {
        setActivePrintAreaId(viewIdToSet, currentView.printAreas[0].id);
      }
    }
  }, [product, size, color, setProduct, setVariant, setActiveViewId, setActivePrintAreaId, hasMultipleViews, views]);

  useEffect(() => {
    if (!product || designLoaded) return;

    const loadEmptyDesign = () => {
      const currentViewId = hasMultipleViews && views.length > 0 ? views[0].id : DEFAULT_VIEW_ID;
      const currentView = hasMultipleViews ? views.find((v) => v.id === currentViewId) : null;
      const colorKey = product?.isClothing && variant?.color ? variant.color : 'default';
      const newLayersByView = {};

      if (!isComboProduct(product)) {
        if (currentView?.initialLayersByColor && typeof currentView.initialLayersByColor === 'object') {
          const layersForColor = currentView.initialLayersByColor[colorKey] || currentView.initialLayersByColor.default || [];
          if (Array.isArray(layersForColor) && layersForColor.length > 0) newLayersByView[currentViewId] = layersForColor;
        } else if (currentView?.initialLayers && Array.isArray(currentView.initialLayers) && currentView.initialLayers.length > 0) {
          newLayersByView[currentViewId] = currentView.initialLayers;
        } else if (!hasMultipleViews && product?.customizationViews?.[0]) {
          const firstView = product.customizationViews[0];
          if (firstView.initialLayersByColor && typeof firstView.initialLayersByColor === 'object') {
            const layersForColor = firstView.initialLayersByColor[colorKey] || firstView.initialLayersByColor.default || [];
            if (Array.isArray(layersForColor) && layersForColor.length > 0) newLayersByView[DEFAULT_VIEW_ID] = layersForColor;
          } else if (Array.isArray(firstView.initialLayers) && firstView.initialLayers.length > 0) {
            newLayersByView[DEFAULT_VIEW_ID] = firstView.initialLayers;
          }
        }
      }
      setLayersByViewFromDesign(newLayersByView);
      setDesignLoaded(true);
    };

    // Si hay designId explícito, cargamos ese
    if (designId && !existingDesignPrompt) {
      let cancelled = false;
      (async () => {
        const { data: design, error } = await getDesignById(designId);
        if (cancelled || error || !design) return;
        if (design.layersByView && typeof design.layersByView === 'object' && Object.keys(design.layersByView).length > 0) {
          setLayersByViewFromDesign(design.layersByView);
        } else if (design.layers && Array.isArray(design.layers) && design.layers.length > 0) {
          setLayersForView(product?.customizationViews?.[0]?.id ?? DEFAULT_VIEW_ID, design.layers);
        }
        if (design.variant && (design.variant.size || design.variant.color)) {
          setVariant(design.variant);
        }
        // Si es un combo del usuario, restaurar su customización personal
        if (design.isUserComboDesign && Array.isArray(design.comboItemCustomization)) {
          setUserComboCustomization(design.comboItemCustomization);
        }
        setDesignLoaded(true);
      })();
      return () => { cancelled = true; };
    }

    // Si no hay designId y el usuario está logueado, verificamos si existe uno guardado previamente
    if (!designId && user && existingDesignPrompt === null) {
      let cancelled = false;
      (async () => {
        const { data: designs } = await getDesignsByUser(user.uid);
        if (cancelled) return;
        
        const existing = (designs || [])
          .sort((a, b) => {
            const timeA = a.updatedAt?.toMillis ? a.updatedAt.toMillis() : (a.updatedAt || 0);
            const timeB = b.updatedAt?.toMillis ? b.updatedAt.toMillis() : (b.updatedAt || 0);
            return timeB - timeA;
          })
          .find(d => d.productId === product.id);

        if (existing) {
          setExistingDesignPrompt(existing);
        } else {
          loadEmptyDesign();
        }
      })();
      return () => { cancelled = true; };
    }

    if (!designId && (!user || existingDesignPrompt === false)) {
      loadEmptyDesign();
    }
  }, [product, designId, designLoaded, hasMultipleViews, views, variant, setLayersByViewFromDesign, setLayersForView, setVariant, user, existingDesignPrompt]);

  useEffect(() => {
    calculatePrice();
  }, [layersByView, calculatePrice]);



  const handleSaveDesign = async () => {
    if (!user) {
      setShowSavePromptModal(true);
      return;
    }
    if (!editorProduct) return;
    
    setSavingDesign(true);

    // Si es combo: incluir la customización del combo del usuario (no la del admin)
    const isComboSave = isComboProduct(editorProduct);
    const comboPayload = isComboSave ? {
      comboItemCustomization: userComboCustomization || editorProduct.comboItemCustomization || [],
      // Clonar la referencia del producto admin sin modificarla
      isUserComboDesign: true,
    } : {};

    const { id: savedId, error } = await saveDesign(user.uid, {
      designId: designId || undefined,
      productId: editorProduct.id,
      productName: editorProduct.name,
      layersByView,
      variant: variant || { size, color },
      ...comboPayload,
    });
    setSavingDesign(false);
    if (error) {
      alert('No se pudo guardar el diseño: ' + error);
      return;
    }
    if (!designId && savedId) {
      navigate(`/editor/${id}?designId=${savedId}${size ? '&size='+size : ''}${color ? '&color='+color : ''}`, { replace: true });
    }
    setSavedHash(currentHash);
    alert('✅ Diseño guardado en tus creaciones.');
  };

  const handleAddToCart = async () => {
    if (!product) return;
    
    // Simplificamos la detección de capas según si es Combo o Normal
    const isCombo = isComboProduct(product);
    let hasAnyLayer = false;
    
    if (isCombo) {
      if (userComboCustomization && Array.isArray(userComboCustomization)) {
        hasAnyLayer = userComboCustomization.some(c => 
          c.layersByView && Object.values(c.layersByView).some(arr => Array.isArray(arr) && arr.length > 0)
        );
      }
    } else {
      hasAnyLayer = Object.values(layersByView || {}).some((arr) => Array.isArray(arr) && arr.length > 0);
    }

    const variantToAdd = { size: variant?.size ?? size, color: variant?.color ?? color };

    if (!hasAnyLayer) {
      if (window.confirm('No has añadido ningún diseño a la personalización. ¿Deseas agregar al carrito sin personalizar?')) {
        addToCart(product, variantToAdd, null, 1);
        navigate('/carrito');
      }
      return;
    }

    // Si tiene diseño y NO está logueado, lo frenamos con el Nodal de Registro
    if (hasAnyLayer && !user) {
      setShowSavePromptModal(true);
      return;
    }

    // Si tiene diseño y SÍ está logueado, forzamos un Autoguardado silencioso antes de ir al carrito
    if (hasAnyLayer && user && hasUnsavedLayers) {
       // Guardamos silenciosamente (ya sabemos que es usuario)
       setSavingDesign(true);
       try {
         const isComboSave = isComboProduct(editorProduct || product);
         const comboPayload = isComboSave ? {
           comboItemCustomization: userComboCustomization || (editorProduct || product).comboItemCustomization || [],
           isUserComboDesign: true,
         } : {};

         await saveDesign(user.uid, {
           designId: designId || undefined,
           productId: (editorProduct || product).id,
           productName: (editorProduct || product).name,
           layersByView,
           variant: variant || { size, color },
           ...comboPayload,
         });
       } catch (e) {
         console.error("Autosave falló", e);
       }
       setSavingDesign(false);
    }

    // Si es combo, generamos en paralelo:
    // 1) Thumbnail unificado (preview del carrito/WhatsApp)
    // 2) Renders individuales por sub-producto/lado para el ERP (frente + espalda con diseño)
    let finalCustomizedImage = null;
    let comboItemRenderedPreviews = null; // [ { frente: dataUrl|null, espalda: dataUrl|null }, ... ]
    if (isCombo) {
      setSavingDesign(true); 
      try {
        [finalCustomizedImage, comboItemRenderedPreviews] = await Promise.all([
          generateFullUserComboCartPreview(product, userComboCustomization),
          generatePerItemSidePreviews(product, userComboCustomization),
        ]);
      } catch (e) {
        console.error("Error generando thumbnails para carrito", e);
      }
      setSavingDesign(false);
    }

    // Agregar al Carrito Final
    const customization = {
      layersByView,
      comboItemCustomization: isCombo ? userComboCustomization : null,
      // Renders individuales por sub-producto/lado (frente + espalda con diseño del cliente)
      comboItemRenderedPreviews: comboItemRenderedPreviews || null,
      variant: variant || { size, color },
      finalPrice: price,
      isComboDesign: isCombo,
      designId: designId, // Se pasa el ID si ya existía
      imageURL: finalCustomizedImage
    };
    
    addToCart(product, variantToAdd, customization, 1);
    
    // Ignorar bloqueadores nativos porque yendo al carrito es una acción deseada
    bypassGuardsRef.current = true;
    navigate('/carrito');
  };

  const PLACEHOLDER_IMAGE = 'https://via.placeholder.com/500x600';

  // Misma lógica que en AdminProductoForm: view.imagesByColor?.[currentColor] || view.imagesByColor?.default
  const colorKey = product?.isClothing && variant?.color ? variant.color : 'default';
  const currentView = hasMultipleViews ? views.find((v) => v.id === activeViewId) : views[0] || null;
  
  const productImage = (() => {
    if (!product) return null;

    const trim = (s) => (typeof s === 'string' ? s.trim() : '');
    const valid = (url) => url && trim(url).length > 0 ? trim(url) : null;
    const matchedVar = product?.variants?.find(v => v.name === colorKey);

    // 1) Imagen de la vista actual por color
    if (currentView?.imagesByColor && typeof currentView.imagesByColor === 'object') {
      const viewImage = currentView.imagesByColor[colorKey];
      const url = valid(viewImage);
      if (url) return url;
    }

    // 2) Imagen de la variante explícita
    const varUrl = valid(matchedVar?.imageUrl);
    if (varUrl) return varUrl;

    // 3) Imagen default
    if (currentView?.imagesByColor && typeof currentView.imagesByColor === 'object') {
      const viewDefault = currentView.imagesByColor.default;
      const url = valid(viewDefault);
      if (url) return url;
    }

    // 4) Otra vista del mismo producto (por si la actual no tiene imagen)
    if (Array.isArray(product.customizationViews)) {
      for (const v of product.customizationViews) {
        if (!v?.imagesByColor || typeof v.imagesByColor !== 'object') continue;
        const def = valid(v.imagesByColor.default);
        if (def) return def;
        const any = Object.values(v.imagesByColor).find((val) => valid(val));
        if (any) return trim(any);
      }
    }

    // 3) Imagen principal del producto
    if (Array.isArray(product?.images) && product.images.length > 0) {
      const url = valid(product.images[0]);
      if (url) return url;
    }

    return PLACEHOLDER_IMAGE;
  })();

  // Memoizar printAreas para evitar nueva referencia en cada render (evita bucle en EditorCanvas)
  const printAreas = useMemo(() => {
    const cv = hasMultipleViews ? views.find((v) => v.id === activeViewId) : views[0] || null;
    if (cv?.printAreas && Array.isArray(cv.printAreas) && cv.printAreas.length > 0) {
      return cv.printAreas;
    }
    if (cv?.printArea && typeof cv.printArea === 'object') {
      return [{
        id: 'default',
        shape: 'rectangle',
        x: cv.printArea.x || 10,
        y: cv.printArea.y || 10,
        width: cv.printArea.width || 80,
        height: cv.printArea.height || 80
      }];
    }
    return [{ id: 'default', shape: 'rectangle', x: 10, y: 10, width: 80, height: 80 }];
  }, [hasMultipleViews, views, activeViewId]);

  const hasBackSide = currentView?.hasBackSide && currentView?.backSide;
  const backSideView = currentView?.backSide || null;
  
  const backSideImage = useMemo(() => {
    if (!backSideView || !product) return null;
    const trim = (s) => (typeof s === 'string' ? s.trim() : '');
    const valid = (url) => url && trim(url).length > 0 ? trim(url) : null;
    
    if (backSideView.imagesByColor && typeof backSideView.imagesByColor === 'object') {
      const viewImage = backSideView.imagesByColor[colorKey];
      const url = valid(viewImage);
      if (url) return url;
      const viewDefault = backSideView.imagesByColor.default;
      const urlDefault = valid(viewDefault);
      if (urlDefault) return urlDefault;
    }
    return null;
  }, [backSideView, colorKey, product]);

  const backSidePrintAreas = useMemo(() => {
    if (!backSideView?.printAreas || !Array.isArray(backSideView.printAreas) || backSideView.printAreas.length === 0) {
      return [{ id: 'back_default', shape: 'rectangle', x: 10, y: 10, width: 80, height: 80 }];
    }
    return backSideView.printAreas;
  }, [backSideView]);

  const viewIdToUse = isEditingBackSide && backSideView ? backSideView.id : activeViewId;

  if (isLoading || (existingDesignPrompt && existingDesignPrompt !== false)) {
    if (existingDesignPrompt && existingDesignPrompt !== false) {
      return (
        <div className={styles.container}>
          <div className={styles.promptModal}>
            <h3>Continuar diseño</h3>
            <p>Hemos encontrado que previamente estabas personalizando este equipo. ¿Qué deseas hacer?</p>
            <div className={styles.promptActions}>
              <Button onClick={() => {
                // Forzamos la recarga completa del navegador actuando como "otra página"
                window.location.href = `/editor/${id}?designId=${existingDesignPrompt.id}${size ? '&size='+size : ''}${color ? '&color='+color : ''}`;
              }}>
                Continuar Editando
              </Button>
              <Button variant="outline" onClick={() => setExistingDesignPrompt(false)}>
                Ver Producto Original
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className={styles.container}>
        <div className={styles.loadingInline}>
          <span className={styles.loadingDot} />
          <span>Cargando producto...</span>
        </div>
      </div>
    );
  }

  if (!product) {
    return <div className={styles.container}>Producto no encontrado</div>;
  }

  const priceDisplay = typeof price === 'number' && !Number.isNaN(price) ? price.toFixed(2) : '0.00';

  const renderExitModal = () => (
    <Modal isOpen={showExitModal} onClose={() => setShowExitModal(false)} title="¿Salir sin guardar?">
      <div style={{ padding: '0 1rem', paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom, 24px))' }}>
        <p style={{ marginBottom: '1.5rem', color: '#4b5563', lineHeight: '1.5', fontSize: '0.9375rem', textAlign: 'center' }}>
          Tienes cambios sin guardar. Si sales ahora, perderás toda tu personalización.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <Button variant="primary" onClick={() => setShowExitModal(false)}>
            No, seguir editando
          </Button>
          {user && (
            <Button variant="outline" onClick={async () => {
              setShowExitModal(false);
              bypassGuardsRef.current = true;
              await handleSaveDesign();
              // Retraso para que se guarde
              setTimeout(() => navigate(`/producto/${product?.id || id}`), 1000);
            }}>
              Guardar diseño y salir
            </Button>
          )}
          <button 
            type="button"
            onClick={() => { 
              setShowExitModal(false); 
              bypassGuardsRef.current = true; 
              navigate(`/producto/${product?.id || id}`); 
            }}
            style={{ 
              background: 'none', 
              border: 'none', 
              color: '#dc2626', 
              padding: '0.75rem', 
              fontWeight: 600, 
              cursor: 'pointer',
              marginTop: '0.5rem',
              fontSize: '0.9375rem'
            }}
          >
            Sí, salir sin guardar
          </button>
        </div>
      </div>
    </Modal>
  );

  const renderSavePromptModal = () => (
    <Modal isOpen={showSavePromptModal} onClose={() => setShowSavePromptModal(false)} title="¡Guarda tu progreso!">
      <div style={{ padding: '0 1rem', paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom, 24px))' }}>
        <p style={{ marginBottom: '1.5rem', color: '#4b5563', lineHeight: '1.5', fontSize: '0.9375rem', textAlign: 'center' }}>
          Tu diseño está quedando increíble. Guarda tu progreso para no perderlo y poder continuar en cualquier momento o dispositivo.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <Button variant="primary" onClick={() => navigate('/login?redirect=' + encodeURIComponent(window.location.pathname + window.location.search))}>
            Iniciar Sesión
          </Button>
          <Button variant="outline" onClick={() => navigate('/registro?redirect=' + encodeURIComponent(window.location.pathname + window.location.search))}>
            Crear una Cuenta
          </Button>
          <button 
            type="button"
            onClick={() => setShowSavePromptModal(false)}
            style={{ 
              background: 'none', 
              border: 'none', 
              color: '#6b7280', 
              padding: '0.75rem', 
              fontWeight: 600, 
              cursor: 'pointer',
              marginTop: '0.5rem',
              fontSize: '0.9375rem'
            }}
          >
            Seguir editando sin guardar
          </button>
        </div>
      </div>
    </Modal>
  );

  // Si es combo, renderizar el editor de combos en vez del AdminViewEditor
  if (isCombo && editorMounted) {
    return (
      <div className={styles.container}>
        <ComboUserEditor
          comboProduct={product}
          comboItems={product.comboItems || []}
          userComboCustomization={userComboCustomization}
          comboLayout={product.comboLayout || { orientation: 'horizontal', spacing: 20 }}
          initialVariantSelections={userComboCustomization ? userComboCustomization.reduce((acc, item, idx) => {
            // Asegurar que capturemos la variante guardada, o rellenemos con la permitida/defecto del item
            if (item.variant) {
              acc[idx] = item.variant;
            } else if (product.comboItems?.[idx]) {
               const variantMap = product.comboItems[idx].variantMapping;
               acc[idx] = { color: variantMap?.color || 'default', size: variantMap?.size || '' };
            }
            return acc;
          }, {}) : {}}
          onVariantChange={handleVariantChange}
          onLayersChange={handleComboLayersChange}
          isDesignLoaded={designLoaded}
        />
        <div className={styles.resetDesignContainer}>
          <button 
             type="button" 
             className={styles.resetDesignBtn} 
             onClick={handleResetDesign}
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><path d="M3 3v5h5"></path></svg>
             Restablecer diseño original
          </button>
        </div>
        <div className={styles.actionsBar} aria-label="Acciones del editor">
          <Button variant="outline" onClick={handleReturn}>
            Volver
          </Button>
          <Button variant="outline" onClick={handleSaveDesign} disabled={savingDesign}>
            {savingDesign ? 'Guardando...' : 'Guardar'}
          </Button>
          <Button variant="primary" onClick={handleAddToCart} className={styles.btnPrimaryMobile}>
            Agregar al Carrito
          </Button>
        </div>
        {renderExitModal()}
        {renderSavePromptModal()}
      </div>
    );
  }

  const SingleProductControls = (
    <div className={styles.singleProductControlsWrapper}>
      {product.isClothing && (
        <div className={styles.variantBar}>
          {product.variants?.sizes?.length > 0 && (
            <div className={styles.variantGroup}>
              <span className={styles.variantLabel}>
                Talla:
                {product.variants.sizes.length > 5 && <span className={styles.scrollHint}>Deslizar <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"></path><path d="m12 5 7 7-7 7"></path></svg></span>}
              </span>
              <DraggableContainer className={styles.variantOptions} onPointerDown={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
                {(product.variants.sizes || []).map((s) => (
                  <button
                    key={s}
                    type="button"
                    className={`${styles.variantBtn} ${variant?.size === s ? styles.variantBtnActive : ''}`}
                    onClick={() => setVariant((prev) => ({ ...prev, size: s }))}
                  >
                    {s}
                  </button>
                ))}
              </DraggableContainer>
            </div>
          )}
          {product.variants?.colors?.length > 0 && (
            <div className={styles.variantGroup}>
              <span className={styles.variantLabel}>
                Color:
                {product.variants.colors.length > 5 && <span className={styles.scrollHint}>Deslizar <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"></path><path d="m12 5 7 7-7 7"></path></svg></span>}
              </span>
              <DraggableContainer className={styles.variantOptions} onPointerDown={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
                {(product.variants.colors || []).map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={`${styles.variantBtn} ${styles.colorBtn} ${variant?.color === c ? styles.variantBtnActive : ''}`}
                    onClick={() => setVariant((prev) => ({ ...prev, color: c }))}
                    title={c}
                    style={{ backgroundColor: /^#|[a-fA-F0-9]{6}$/.test(c) ? c : undefined }}
                  >
                    {/^#|[a-fA-F0-9]{6}$/.test(c) ? '' : c.slice(0, 1)}
                  </button>
                ))}
              </DraggableContainer>
            </div>
          )}
        </div>
      )}

      <div className={styles.resetDesignContainer}>
        <button 
           type="button" 
           className={styles.resetDesignBtn} 
           onClick={handleResetDesign}
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><path d="M3 3v5h5"></path></svg>
          Restablecer diseño original
        </button>
      </div>

      {hasMultipleViews && (
        <div className={styles.viewTabs}>
          {views.map((v) => (
            <button
              key={v.id}
              type="button"
              className={`${styles.viewTab} ${activeViewId === v.id && !isEditingBackSide ? styles.viewTabActive : ''}`}
              onClick={() => {
                setActiveViewId(v.id);
                setIsEditingBackSide(false);
                // Inicializar zona activa al cambiar de vista
                if (v.printAreas && Array.isArray(v.printAreas) && v.printAreas.length > 0) {
                  setActivePrintAreaId(v.id, v.printAreas[0].id);
                }
              }}
            >
              {v.name}
            </button>
          ))}
          {hasBackSide && (
            <button
              type="button"
              className={`${styles.viewTab} ${isEditingBackSide ? styles.viewTabActive : ''}`}
              onClick={() => {
                setIsEditingBackSide(true);
                if (backSideView?.printAreas && Array.isArray(backSideView.printAreas) && backSideView.printAreas.length > 0) {
                  setActivePrintAreaId(backSideView.id, backSideView.printAreas[0].id);
                }
              }}
            >
              {backSideView?.name || 'Espalda'}
            </button>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div className={styles.container}>

      {/* Botón exclusivo para móvil para abrir ajustes */}
      <div className={styles.showOnlyMobile}>
        <button className={styles.mobileSettingsBtn} onClick={() => setShowMobileSettingsModal(true)}>
          <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
          Ajustes de Producto
        </button>
      </div>

      <div className={styles.desktopControls}>
        {SingleProductControls}
      </div>

      {showMobileSettingsModal && (
        <Modal 
          isOpen={showMobileSettingsModal} 
          onClose={() => setShowMobileSettingsModal(false)}
          title="Ajustes de Producto"
          position="center"
        >
          {SingleProductControls}
          <Button 
            variant="primary" 
            onClick={() => setShowMobileSettingsModal(false)}
            style={{ width: '100%', marginTop: '1rem' }}
          >
            Aceptar
          </Button>
        </Modal>
      )}

      {editorMounted && (isEditingBackSide ? backSideImage : productImage) ? (
        <AdminViewEditor
          viewId={viewIdToUse}
          productImage={isEditingBackSide ? backSideImage : productImage}
          printAreas={isEditingBackSide ? backSidePrintAreas : printAreas}
          initialLayersByColor={{
            [colorKey]: (layersByView?.[viewIdToUse]?.length > 0)
              ? layersByView[viewIdToUse]
              : (isEditingBackSide
                  ? backSideView?.initialLayersByColor?.[colorKey] || backSideView?.initialLayersByColor?.default
                  : currentView?.initialLayersByColor?.[colorKey] || currentView?.initialLayersByColor?.default) || []
          }}
          currentColor={colorKey}
          availableColors={product?.variants?.colors}
          onColorChange={(c) => setVariant((prev) => ({ ...prev, color: c }))}
          onLayersChange={(color, newLayers) => setLayersForView(viewIdToUse, newLayers)}
          designOnly
          noHeader
        />
      ) : editorMounted && !(isEditingBackSide ? backSideImage : productImage) ? (
        <div className={styles.loadingInline}>
          <span className={styles.loadingDot} />
          <span>Cargando imagen del producto...</span>
        </div>
      ) : (
        <div className={styles.loadingInline}>
          <span className={styles.loadingDot} />
          <span>Preparando editor...</span>
        </div>
      )}

      <div className={styles.actionsBar} aria-label="Acciones del editor">
        <Button variant="outline" onClick={handleReturn}>
          Volver
        </Button>
        <Button variant="outline" onClick={handleSaveDesign} disabled={savingDesign}>
          {savingDesign ? 'Guardando...' : 'Guardar'}
        </Button>
        <Button variant="primary" onClick={handleAddToCart} className={styles.btnPrimaryMobile}>
          Agregar al Carrito
        </Button>
      </div>

      {renderExitModal()}
      {renderSavePromptModal()}
    </div >
  );
};

export default function EditorPageWrapper(props) {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const currentDesignId = searchParams.get('designId') || 'new';

  return (
    <DesignClipboardProvider>
      <EditorProvider key={`${id}-${currentDesignId}`}>
        <EditorPage {...props} key={`editor-${id}-${currentDesignId}`} />
      </EditorProvider>
    </DesignClipboardProvider>
  );
}
