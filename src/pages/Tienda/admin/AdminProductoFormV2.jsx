import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createProduct, updateProduct, getProduct } from '../../../services/products';
import { getMockups } from '../../../services/mockups';
import { getBrands } from '../../../services/brands';
import { getCategories } from '../../../services/categories';
import { getCollections } from '../../../services/collections';
import { uploadFile } from '../../../services/firebase/storage';
import { ImagePlus, Save, ArrowLeft, Loader2, Shirt, Image as ImageIcon, Trash2, Camera, Star } from 'lucide-react';
import Button from '../../../components/common/Button';
import ProductImageContainer from '../components/ProductImageContainer/ProductImageContainer';
import AdminCustomizationViewsEditor from '../components/AdminCustomizationViewsEditor/AdminCustomizationViewsEditor';
import AdminComboEditor from '../components/AdminComboEditor/AdminComboEditor';
import { fabric } from 'fabric';
import ReactQuill, { Quill } from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import styles from './AdminProductoFormV2.module.css';

const Size = Quill.import('attributors/style/size');
Size.whitelist = ['8px', '10px', '12px', '14px', '16px', '18px', '20px', '24px', '32px', '48px'];
Quill.register(Size, true);

const Font = Quill.import('attributors/style/font');
Font.whitelist = ['arial', 'courier', 'garamond', 'tahoma', 'times-new-roman', 'verdana', 'impact', 'roboto', 'open-sans', 'montserrat', 'lato'];
Quill.register(Font, true);

// Helper to convert dataURL to Blob
const dataURLtoBlob = (dataurl) => {
  const arr = dataurl.split(',');
  const mime = arr[0].match(/:(.*?);/)[1];
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8arr], { type: mime });
}

const AdminProductoFormV2 = () => {
  const { id } = useParams();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const urlDraftId = searchParams.get('draftId');
  const isNew = !id;
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [draftId, setDraftId] = useState(urlDraftId || Date.now().toString());

  const [form, setForm] = useState({
    name: '',
    description: '',
    price: '',
    salePrice: '',
    sku: '',
    brandId: '',
    category: '',
    collection: '',
    defaultVariantId: '', // ID de la variante principal
    variants: [], 
    customizable: false,
    customizationViews: [],
    isComboProduct: false,
    comboItems: [],
    comboPreviewImage: '',
    featured: false,
  });

  const [activeGalleryTabId, setActiveGalleryTabId] = useState(null);
  const [uploading, setUploading] = useState(false);
  const canvasElRef = useRef(null);

  const quillModules = {
    toolbar: [
      [{ 'font': Font.whitelist }],
      [{ 'size': Size.whitelist }],
      ['bold', 'italic', 'underline', 'strike'],
      [{ 'color': [] }, { 'background': [] }],
      [{ 'list': 'ordered'}, { 'list': 'bullet' }],
      ['link'],
      ['clean']
    ],
  };

  const [fabricCanvas, setFabricCanvas] = useState(null);
  const [hasActiveObject, setHasActiveObject] = useState(false);

  // Consultas de datos
  const { data: mockups } = useQuery({ queryKey: ['admin-mockups'], queryFn: async () => (await getMockups()).data });
  const { data: brands } = useQuery({ queryKey: ['admin-brands'], queryFn: async () => (await getBrands()).data });
  const { data: categories } = useQuery({ queryKey: ['admin-categories'], queryFn: async () => (await getCategories()).data });
  const { data: collections } = useQuery({ queryKey: ['admin-collections'], queryFn: async () => (await getCollections()).data });

  // Si editamos un producto existente en DB
  const { data: productData, isLoading: loadingProduct } = useQuery({
    queryKey: ['admin-product', id],
    queryFn: async () => (await getProduct(id)).data,
    enabled: !isNew
  });

  // 1. Cargar datos iniciales (De Firebase o de LocalStorage Draft)
  useEffect(() => {
    // Si estamos editando un producto oficial
    if (!isNew && productData) {
      const mappedVariants = (productData.variants || []).map(v => ({
        ...v,
        mode: v.imageUrl ? 'direct' : 'mockup',
        mockupState: { selectedMockupId: '', selectedVariantIndex: 0 },
      }));

      setForm({
        name: productData.name || '',
        description: productData.description || '',
        price: productData.price || '',
        salePrice: productData.salePrice || '',
        sku: productData.sku || '',
        brandId: productData.brandId || '',
        category: productData.category ? productData.category.id || productData.category : '',
        collection: productData.collections?.[0]?.id || productData.collections?.[0] || '',
        defaultVariantId: productData.defaultVariantId || (mappedVariants[0]?.id || ''),
        variants: mappedVariants,
        customizable: productData.customizable || false,
        customizationViews: productData.customizable && productData.customizationViews ? productData.customizationViews : [],
        isComboProduct: Boolean(productData.isComboProduct),
        comboItems: productData.comboItems || [],
        comboPreviewImage: productData.comboPreviewImage || '',
        featured: productData.featured || false,
      });

      if (mappedVariants.length > 0) setActiveGalleryTabId(mappedVariants[0].id);
      return; // No cargamos draft si estamos editando uno oficial directamente sin draftId
    }

    // Si es un producto NUEVO pero viene con draftId, cargamos el borrador
    if (isNew && urlDraftId) {
      const savedDrafts = JSON.parse(localStorage.getItem('wala_drafts') || '[]');
      const draft = savedDrafts.find(d => d.draftId === urlDraftId);
      if (draft) {
        setForm(draft.form);
        if (draft.form.variants?.length > 0) {
          setActiveGalleryTabId(draft.form.variants[0].id);
        }
      } else {
        // Fallback si no encuentra el draft
        initEmptyForm();
      }
      return;
    }

    // Si es completamente nuevo y sin draftId
    if (isNew && !urlDraftId && form.variants.length === 0) {
      initEmptyForm();
    }
  }, [productData, isNew, urlDraftId]);

  const initEmptyForm = () => {
    const initialVariantId = `var_${Date.now()}`;
    setForm(f => ({
      ...f,
      defaultVariantId: initialVariantId,
      variants: [{ id: initialVariantId, name: 'Variante 1', colorHex: '#cccccc', mode: 'mockup', mockupState: { selectedMockupId: '', selectedVariantIndex: 0 }, images: [], imageUrl: '' }],
      customizable: false,
      customizationViews: [],
      isComboProduct: false,
      comboItems: [],
      comboPreviewImage: '',
      featured: false,
    }));
    setActiveGalleryTabId(initialVariantId);
  };

  // 2. Autoguardado en LocalStorage
  useEffect(() => {
    if (form.variants.length > 0) {
      const savedDrafts = JSON.parse(localStorage.getItem('wala_drafts') || '[]');
      const existingDraftIndex = savedDrafts.findIndex(d => d.draftId === draftId);
      
      const draftObj = {
        draftId,
        form,
        updatedAt: new Date().toISOString(),
      };

      if (existingDraftIndex >= 0) {
        savedDrafts[existingDraftIndex] = draftObj;
      } else {
        savedDrafts.push(draftObj);
      }
      localStorage.setItem('wala_drafts', JSON.stringify(savedDrafts));
    }
  }, [form, draftId]);

  const activeVariant = form.variants.find(v => v.id === activeGalleryTabId);

  // Init Fabric Canvas ONLY when active variant is in mockup mode and HAS NO IMAGE YET
  useEffect(() => {
    const shouldShowCanvas = activeVariant && activeVariant.mode === 'mockup' && !activeVariant.imageUrl;

    if (shouldShowCanvas && canvasElRef.current && !fabricCanvas) {
      const canvas = new fabric.Canvas(canvasElRef.current, {
        width: 300,
        height: 400,
        preserveObjectStacking: true,
      });

      canvas.on('selection:created', () => setHasActiveObject(true));
      canvas.on('selection:updated', () => setHasActiveObject(true));
      canvas.on('selection:cleared', () => setHasActiveObject(false));

      setFabricCanvas(canvas);
    } else if (!shouldShowCanvas && fabricCanvas) {
      fabricCanvas.dispose();
      setFabricCanvas(null);
    }

    return () => {
      // Cleanup handled via strict deps
    };
  }, [activeVariant?.mode, activeVariant?.imageUrl, activeGalleryTabId]);

  // Draw background image when mockup state changes
  useEffect(() => {
    if (fabricCanvas && activeVariant?.mode === 'mockup') {
      const mockup = mockups?.find(m => m.id === activeVariant.mockupState.selectedMockupId);
      const baseImgUrl = mockup?.variants?.[activeVariant.mockupState.selectedVariantIndex]?.imageUrl || mockup?.baseImageUrl || '';

      if (baseImgUrl) {
        fabric.Image.fromURL(baseImgUrl, (img) => {
          const scale = Math.min(300 / img.width, 400 / img.height);
          img.set({ originX: 'center', originY: 'center', left: 150, top: 200, scaleX: scale, scaleY: scale, selectable: false, evented: false });
          fabricCanvas.setBackgroundImage(img, fabricCanvas.renderAll.bind(fabricCanvas));
        }, { crossOrigin: 'anonymous' });
      } else {
        fabricCanvas.clear();
        fabricCanvas.setBackgroundColor('', fabricCanvas.renderAll.bind(fabricCanvas));
      }
    }
  }, [activeVariant?.mockupState.selectedMockupId, activeVariant?.mockupState.selectedVariantIndex, fabricCanvas, mockups]);

  const updateActiveVariant = (updates) => {
    setForm(f => ({
      ...f,
      variants: f.variants.map(v => v.id === activeGalleryTabId ? { ...v, ...updates } : v)
    }));
  };

  const handleDesignUpload = (e) => {
    const file = e.target.files[0];
    if (file && fabricCanvas) {
      const url = URL.createObjectURL(file);
      fabric.Image.fromURL(url, (img) => {
        img.scaleToWidth(120);
        img.set({
          originX: 'center', originY: 'center', left: 150, top: 150,
          transparentCorners: false, cornerColor: '#111', borderColor: '#111', cornerSize: 10, padding: 5
        });
        fabricCanvas.add(img);
        fabricCanvas.setActiveObject(img);
        fabricCanvas.renderAll();
      });
    }
    e.target.value = ''; 
  };

  const handleCaptureMockup = async () => {
    if (!fabricCanvas || !activeVariant) return;
    setUploading(true);
    try {
      fabricCanvas.discardActiveObject();
      fabricCanvas.renderAll();
      const dataURL = fabricCanvas.toDataURL({ format: 'png', multiplier: 2 });
      const blob = dataURLtoBlob(dataURL);
      
      const path = `productos_v2/${draftId}/main_${activeVariant.id}_${Date.now()}.png`;
      const { url } = await uploadFile(blob, path);
      if (url) {
        updateActiveVariant({ imageUrl: url });
      }
    } finally {
      setUploading(false);
    }
  };

  const handleRedoMockup = () => {
    // Si queremos ser exquisitos, podríamos borrar la URL actual de Firebase aquí.
    // Por simplicidad, la sobreescribiremos (dejando un archivo huérfano que se borrará si descartan el draft).
    updateActiveVariant({ imageUrl: '' });
  };

  const handleDeleteActiveDesign = () => {
    if (!fabricCanvas) return;
    const activeObjects = fabricCanvas.getActiveObjects();
    if (activeObjects.length) {
      activeObjects.forEach(obj => fabricCanvas.remove(obj));
      fabricCanvas.discardActiveObject();
      fabricCanvas.renderAll();
    }
  };

  const handleDirectImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !activeVariant) return;
    setUploading(true);
    try {
      const path = `productos_v2/${draftId}/main_${activeVariant.id}_${Date.now()}_${file.name}`;
      const { url } = await uploadFile(file, path);
      if (url) {
        updateActiveVariant({ imageUrl: url });
      }
    } finally {
      setUploading(false);
    }
  };

  const handleGalleryUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length || !activeGalleryTabId) return;
    setUploading(true);
    try {
      const newImages = [];
      for (const file of files) {
        const path = `productos_v2/${draftId}/gallery_${Date.now()}_${file.name}`;
        const { url } = await uploadFile(file, path);
        if (url) newImages.push(url);
      }
      updateActiveVariant({ images: [...(activeVariant.images || []), ...newImages] });
    } finally {
      setUploading(false);
    }
  };

  const removeGalleryImage = (index) => {
    updateActiveVariant({ images: activeVariant.images.filter((_, i) => i !== index) });
  };

  // Drag & Drop
  const [draggedIdx, setDraggedIdx] = useState(null);
  const handleDragStart = (e, index) => {
    setDraggedIdx(index);
    e.dataTransfer.setData('text/plain', index);
    e.dataTransfer.effectAllowed = 'move';
  };
  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };
  const handleDrop = (e, targetIdx) => {
    e.preventDefault();
    if (draggedIdx === null || draggedIdx === targetIdx) return;
    const newImages = [...(activeVariant.images || [])];
    const [draggedImg] = newImages.splice(draggedIdx, 1);
    newImages.splice(targetIdx, 0, draggedImg);
    updateActiveVariant({ images: newImages });
    setDraggedIdx(null);
  };

  const addVariant = () => {
    const newId = `var_${Date.now()}`;
    setForm(f => ({
      ...f,
      variants: [...f.variants, { id: newId, name: 'Nueva Variante', colorHex: '#cccccc', mode: 'mockup', mockupState: { selectedMockupId: '', selectedVariantIndex: 0 }, images: [], imageUrl: '' }]
    }));
    setActiveGalleryTabId(newId);
  };

  const removeVariant = (variantId) => {
    if (form.variants.length <= 1) {
      alert("El producto debe tener al menos una variante.");
      return;
    }
    const confirmDelete = window.confirm("¿Seguro que deseas eliminar esta variante? Esto quitará su foto principal y galería.");
    if (!confirmDelete) return;

    setForm(f => {
      const newVariants = f.variants.filter(v => v.id !== variantId);
      return {
        ...f,
        variants: newVariants,
        defaultVariantId: f.defaultVariantId === variantId ? newVariants[0].id : f.defaultVariantId
      };
    });

    if (activeGalleryTabId === variantId) {
      setActiveGalleryTabId(form.variants.find(v => v.id !== variantId)?.id || null);
    }
  };

  const handleToggleCustomizable = (e) => {
    const isCustomizable = e.target.checked;
    setForm(f => {
      const newState = { ...f, customizable: isCustomizable };
      
      if (isCustomizable && f.customizationViews.length === 0) {
        let baseImageUrl = '';
        const defaultVariant = f.variants.find(v => v.id === f.defaultVariantId) || f.variants[0];
        
        if (defaultVariant) {
          if (defaultVariant.mode === 'mockup' && defaultVariant.mockupState?.selectedMockupId) {
            const mockup = mockups?.find(m => m.id === defaultVariant.mockupState.selectedMockupId);
            baseImageUrl = mockup?.variants?.[defaultVariant.mockupState.selectedVariantIndex]?.imageUrl || mockup?.baseImageUrl || '';
          } else {
            baseImageUrl = defaultVariant.imageUrl || '';
          }
        }

        const newView = {
          id: `view_${Date.now()}`,
          name: 'Vista 1 (Frente)',
          imagesByColor: { default: baseImageUrl },
          initialLayersByColor: { default: [] },
          printAreas: [{
            id: `zone_${Date.now()}_0`,
            shape: 'rectangle',
            x: 20, y: 20, width: 60, height: 60, rotation: 0, skewX: 0, skewY: 0
          }]
        };
        newState.customizationViews = [newView];
      }
      return newState;
    });
  };

  const saveMutation = useMutation({
    mutationFn: async (payload) => {
      if (isNew) return await createProduct(payload);
      return await updateProduct(id, payload);
    },
    onSuccess: () => {
      // Limpiar borrador si existe
      const savedDrafts = JSON.parse(localStorage.getItem('wala_drafts') || '[]');
      const filtered = savedDrafts.filter(d => d.draftId !== draftId);
      localStorage.setItem('wala_drafts', JSON.stringify(filtered));

      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      navigate('/admin/productos');
    }
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || form.variants.length === 0) return;

    // Validación de imagen eliminada para permitir productos sin foto
    setUploading(true);
    try {
      const finalVariants = form.variants.map((v) => ({
        id: v.id,
        name: v.name,
        colorHex: v.colorHex,
        imageUrl: v.imageUrl,
        images: v.images || [],
        sizes: v.sizes || []
      }));

      // Identify main image
      const defaultVariant = finalVariants.find(v => v.id === form.defaultVariantId) || finalVariants[0];
      const mainImage = defaultVariant?.imageUrl || '';

      const payload = {
        name: form.name,
        description: form.description,
        price: Number(form.price) || 0,
        salePrice: Number(form.salePrice) || 0,
        sku: form.sku,
        brandId: form.brandId,
        category: form.category ? { id: form.category } : null,
        collections: form.collection ? [{ id: form.collection }] : [],
        mainImage: mainImage,
        defaultVariantId: defaultVariant.id,
        customizable: form.customizable,
        customizationViews: form.customizationViews,
        isComboProduct: form.isComboProduct,
        comboItems: form.isComboProduct ? form.comboItems : [],
        comboPreviewImage: form.isComboProduct ? form.comboPreviewImage : '',
        variants: form.isComboProduct ? [] : finalVariants,
        visible: true,
        featured: form.featured,
        isV2: true, 
      };

      await saveMutation.mutateAsync(payload);
    } finally {
      setUploading(false);
    }
  };

  if (loadingProduct) return <div className={styles.wrapper}>Cargando...</div>;

  const selectedBrand = brands?.find(b => b.id === form.brandId);
  const brandBgStyle = selectedBrand ? {
    backgroundColor: selectedBrand.bgType === 'color' ? selectedBrand.bgColor : 'transparent',
    backgroundImage: selectedBrand.bgType === 'image' && selectedBrand.bgImage
      ? `url(${selectedBrand.bgImage})`
      : 'none',
    backgroundSize: 'cover',
    backgroundPosition: 'center'
  } : {};

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={() => navigate('/admin/productos')} type="button">
          <ArrowLeft size={20} /> Volver
        </button>
        <div>
          <h1 className={styles.title}>{isNew ? 'Crear Producto' : 'Editar Producto'}</h1>
          <p className={styles.subtitle}>
            {isNew && <span style={{ color: '#f59f00', fontWeight: 'bold', marginRight: '8px' }}>[Autoguardado Activo]</span>}
            Crea productos configurando mockups o imágenes independientes por cada variante.
          </p>
        </div>
      </div>

      <form className={styles.contentGrid} onSubmit={handleSubmit}>
        
        {/* Type Selector (Individual vs Combo) */}
        <div className={styles.card} style={{ marginBottom: '1.5rem', padding: '1rem 1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h2 className={styles.cardTitle} style={{ margin: 0, padding: 0, borderBottom: 'none' }}>📦 Tipo de Producto</h2>
              <p className={styles.cardSubtitle} style={{ marginTop: '0.25rem', marginBottom: 0 }}>¿Qué vas a vender?</p>
            </div>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                <input type="radio" checked={!form.isComboProduct} onChange={() => setForm(f => ({ ...f, isComboProduct: false }))} />
                <span style={{ fontWeight: !form.isComboProduct ? 600 : 400 }}>Producto Individual</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                <input type="radio" checked={form.isComboProduct} onChange={() => setForm(f => ({ ...f, isComboProduct: true }))} />
                <span style={{ fontWeight: form.isComboProduct ? 600 : 400 }}>Combo / Paquete</span>
              </label>
            </div>
          </div>
        </div>

        {/* COLUMNA IZQUIERDA: Formulario */}
        <div className={styles.leftCol}>
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>Información Básica</h2>

            <div className={styles.field}>
              <label className={styles.label}>Nombre del Producto <span style={{color: '#e03131'}}>*</span></label>
              <input
                type="text"
                className={styles.input}
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                required
                placeholder="Ej. Hoodie Oversize"
              />
            </div>

            <div className={styles.fieldRow}>
              <div className={styles.field}>
                <label className={styles.label}>Precio Base <span style={{color: '#e03131'}}>*</span></label>
                <input
                  type="number"
                  step="0.01"
                  className={styles.input}
                  value={form.price}
                  onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
                  required
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Precio Oferta (Opcional)</label>
                <input
                  type="number"
                  step="0.01"
                  className={styles.input}
                  value={form.salePrice}
                  onChange={e => setForm(f => ({ ...f, salePrice: e.target.value }))}
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>SKU</label>
                <input
                  type="text"
                  className={styles.input}
                  value={form.sku}
                  onChange={e => setForm(f => ({ ...f, sku: e.target.value }))}
                  placeholder="Ej. HOOD-BLK-01"
                />
              </div>
            </div>

            <div className={styles.field} style={{ marginBottom: '1.5rem' }}>
              <label className={styles.label}>Descripción Breve</label>
              <div style={{ background: '#fff' }}>
                <ReactQuill 
                  theme="snow"
                  value={form.description}
                  onChange={(content) => setForm(f => ({ ...f, description: content }))}
                  modules={quillModules}
                  placeholder="Escribe la descripción de tu producto..."
                  style={{ minHeight: '150px' }}
                />
              </div>
            </div>
          </div>

          <div className={styles.card}>
            <h2 className={styles.cardTitle}>Organización</h2>

            <div className={styles.fieldRow}>
              <div className={styles.field}>
                <label className={styles.label}>Marca</label>
                <select className={styles.input} value={form.brandId} onChange={e => setForm(f => ({ ...f, brandId: e.target.value }))}>
                  <option value="">Ninguna</option>
                  {brands?.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Categoría</label>
                <select className={styles.input} value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                  <option value="">Seleccionar...</option>
                  {categories?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Colección</label>
                <select className={styles.input} value={form.collection} onChange={e => setForm(f => ({ ...f, collection: e.target.value }))}>
                  <option value="">Ninguna</option>
                  {collections?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* COLUMNA DERECHA: Editor de Variante / Combo */}
        <div className={styles.rightCol}>
          
          {form.isComboProduct ? (
            <AdminComboEditor 
              comboItems={form.comboItems} 
              setComboItems={(items) => setForm(f => ({ ...f, comboItems: items }))} 
              comboPreviewImage={form.comboPreviewImage}
              setComboPreviewImage={(img) => setForm(f => ({ ...f, comboPreviewImage: img }))}
              draftId={draftId}
            />
          ) : (
            <>
              <div className={styles.card}>
            <div className={styles.cardHeaderFlex}>
              <div>
                <h2 className={styles.cardTitle}>Editor de Variantes</h2>
                <p className={styles.cardSubtitle}>Configura el diseño y fotos para cada color/variante.</p>
              </div>
              <button type="button" onClick={addVariant} className={styles.addVariantBtn}>
                + Añadir Variante
              </button>
            </div>

            <div className={styles.galleryTabs}>
              {form.variants.map(v => (
                <button
                  key={v.id}
                  type="button"
                  className={`${styles.galleryTab} ${activeGalleryTabId === v.id ? styles.galleryTabActive : ''}`}
                  onClick={() => setActiveGalleryTabId(v.id)}
                >
                  <span className={styles.tabColorDot} style={{ backgroundColor: v.colorHex || '#ccc' }}></span>
                  {v.name || 'Variante'}
                  {form.defaultVariantId === v.id && <span style={{ marginLeft: '4px' }}>👑</span>}
                </button>
              ))}
            </div>

            {activeVariant && (
              <div className={styles.variantEditorWorkspace}>
                
                <div className={styles.variantTopBar}>
                   <div className={styles.fieldRow} style={{ marginBottom: 0, alignItems: 'flex-end' }}>
                     <div className={styles.field} style={{ marginBottom: 0, flex: 2 }}>
                       <label className={styles.label}>Nombre Color / Variante</label>
                       <input 
                         type="text" 
                         className={styles.input} 
                         value={activeVariant.name}
                         onChange={e => updateActiveVariant({ name: e.target.value })}
                         placeholder="Ej. Rojo"
                       />
                     </div>
                     <div className={styles.field} style={{ marginBottom: 0, flex: 1 }}>
                       <label className={styles.label}>Color (Hex)</label>
                       <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                         <input 
                           type="color" 
                           value={activeVariant.colorHex}
                           onChange={e => updateActiveVariant({ colorHex: e.target.value })}
                           style={{ height: '42px', width: '42px', padding: 0, border: 'none', borderRadius: '8px', cursor: 'pointer' }}
                         />
                         <input 
                           type="text" 
                           className={styles.input} 
                           value={activeVariant.colorHex}
                           onChange={e => updateActiveVariant({ colorHex: e.target.value })}
                         />
                       </div>
                     </div>
                   </div>

                   <div style={{ marginTop: '1rem', display: 'flex', gap: '1rem', alignItems: 'center', justifyContent: 'space-between' }}>
                     <button
                       type="button"
                       onClick={() => setForm(f => ({ ...f, defaultVariantId: activeVariant.id }))}
                       className={styles.defaultVariantBtn}
                       disabled={form.defaultVariantId === activeVariant.id}
                     >
                       <Star size={16} fill={form.defaultVariantId === activeVariant.id ? "#f59f00" : "none"} color={form.defaultVariantId === activeVariant.id ? "#f59f00" : "#666"} />
                       {form.defaultVariantId === activeVariant.id ? 'Variante Principal' : 'Establecer como Principal'}
                     </button>
                     <button
                       type="button"
                       onClick={() => removeVariant(activeVariant.id)}
                       className={styles.deleteVariantBtn}
                     >
                       <Trash2 size={16} /> Eliminar Variante
                     </button>
                   </div>
                </div>

                <hr style={{ border: 'none', borderTop: '1px solid #f0f0f0', margin: '2rem 0' }} />

                <h3 className={styles.sectionHeading}>1. Imagen Principal (Mockup / Directo)</h3>

                <div className={styles.modeToggle}>
                  <button
                    type="button"
                    className={`${styles.modeBtn} ${activeVariant.mode === 'mockup' ? styles.modeActive : ''}`}
                    onClick={() => updateActiveVariant({ mode: 'mockup' })}
                  >
                    <Shirt size={18} /> Usar Mockup
                  </button>
                  <button
                    type="button"
                    className={`${styles.modeBtn} ${activeVariant.mode === 'direct' ? styles.modeActive : ''}`}
                    onClick={() => updateActiveVariant({ mode: 'direct' })}
                  >
                    <ImageIcon size={18} /> Subir Foto
                  </button>
                </div>

                {activeVariant.mode === 'mockup' ? (
                  <div className={styles.mockupWorkspace}>
                    
                    {activeVariant.imageUrl ? (
                      // SHOW PREVIEW IF CAPTURED
                      <div className={styles.capturedPreviewContainer}>
                        <ProductImageContainer 
                          imageUrl={activeVariant.imageUrl} 
                          style={brandBgStyle} 
                        />
                        <button type="button" onClick={handleRedoMockup} className={styles.redoBtn}>
                          Rehacer Diseño (Volver al Canvas)
                        </button>
                      </div>
                    ) : (
                      // SHOW CANVAS
                      <>
                        <div className={styles.field}>
                          <label className={styles.label}>Elige una prenda base (Mockup)</label>
                          <select
                            className={styles.input}
                            value={activeVariant.mockupState.selectedMockupId}
                            onChange={e => updateActiveVariant({ mockupState: { ...activeVariant.mockupState, selectedMockupId: e.target.value, selectedVariantIndex: 0 } })}
                          >
                            <option value="">-- Selecciona un Mockup --</option>
                            {mockups?.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                          </select>
                        </div>

                        {activeVariant.mockupState.selectedMockupId && mockups?.find(m => m.id === activeVariant.mockupState.selectedMockupId)?.variants?.length > 0 && (
                          <div className={styles.colorSelector}>
                            <label className={styles.label}>Selecciona el Color Base</label>
                            <div className={styles.colorDots}>
                              {mockups.find(m => m.id === activeVariant.mockupState.selectedMockupId).variants.map((v, idx) => (
                                <button
                                  key={idx}
                                  type="button"
                                  className={`${styles.colorDot} ${activeVariant.mockupState.selectedVariantIndex === idx ? styles.colorDotActive : ''}`}
                                  style={{ backgroundColor: v.colorHex || '#ddd' }}
                                  title={v.colorName}
                                  onClick={() => updateActiveVariant({ mockupState: { ...activeVariant.mockupState, selectedVariantIndex: idx } })}
                                />
                              ))}
                            </div>
                          </div>
                        )}

                        {activeVariant.mockupState.selectedMockupId && (
                          <div className={styles.designTools}>
                            <label className={styles.designUploadBtn}>
                              <ImagePlus size={16} /> Agregar Diseño (PNG)
                              <input type="file" accept="image/png" hidden onChange={handleDesignUpload} />
                            </label>
                            {hasActiveObject && (
                              <button type="button" className={styles.deleteDesignBtn} onClick={handleDeleteActiveDesign}>
                                <Trash2 size={16} /> Quitar
                              </button>
                            )}
                          </div>
                        )}

                        <ProductImageContainer style={brandBgStyle}>
                          {!activeVariant.mockupState.selectedMockupId && (
                            <div className={styles.emptyPreviewOverlay}>
                              <Shirt size={48} opacity={0.2} />
                              <span>Selecciona un mockup para empezar a editar</span>
                            </div>
                          )}
                          <canvas ref={canvasElRef} className={styles.fabricCanvasEl} />
                        </ProductImageContainer>

                        {activeVariant.mockupState.selectedMockupId && (
                          <button type="button" onClick={handleCaptureMockup} className={styles.captureBtn} disabled={uploading}>
                            {uploading ? <Loader2 className="animate-spin" size={20} /> : <Camera size={20} />} 
                            {uploading ? 'Capturando...' : 'Capturar y Fijar Imagen'}
                          </button>
                        )}
                      </>
                    )}

                  </div>
                ) : (
                  <div className={styles.directWorkspace}>
                    <ProductImageContainer 
                      imageUrl={activeVariant.imageUrl} 
                      style={brandBgStyle}
                      emptyMessage="Sube una imagen del producto terminado"
                    />
                    <div className={styles.field} style={{ marginTop: '1rem' }}>
                      <label className={styles.uploadImageLabel}>
                        <ImagePlus size={24} />
                        <span>{uploading ? 'Subiendo...' : 'Subir Imagen Directa'}</span>
                        <input type="file" accept="image/*" onChange={handleDirectImageUpload} disabled={uploading} hidden />
                      </label>
                    </div>
                  </div>
                )}

                <hr style={{ border: 'none', borderTop: '1px solid #f0f0f0', margin: '2rem 0' }} />

                <h3 className={styles.sectionHeading}>2. Galería Extra (Opcional)</h3>
                <p className={styles.cardSubtitle}>
                  Fotos en uso de <b>este color específico</b>. La primera será el hover.
                </p>

                <div className={styles.galleryGrid}>
                  {(activeVariant.images || []).map((img, idx) => (
                    <div
                      key={idx}
                      className={`${styles.galleryItem} ${draggedIdx === idx ? styles.galleryItemDragging : ''}`}
                      draggable
                      onDragStart={(e) => handleDragStart(e, idx)}
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(e, idx)}
                    >
                      <ProductImageContainer imageUrl={img} isGallery={true} />
                      <button type="button" onClick={() => removeGalleryImage(idx)} className={styles.deleteGalleryBtn}>
                        <Trash2 size={14} />
                      </button>
                      {idx === 0 && <span className={styles.hoverBadge}>Hover Image</span>}
                    </div>
                  ))}

                  <label className={styles.addGalleryBtn}>
                    <ImagePlus size={24} />
                    <span>{uploading ? 'Subiendo...' : 'Agregar Fotos'}</span>
                    <input type="file" accept="image/*" multiple onChange={handleGalleryUpload} disabled={uploading} hidden />
                  </label>
                </div>

              </div>
            )}
          </div>
          </>
          )}

          <div className={styles.card} style={{ marginTop: '1.5rem' }}>
            <div className={styles.cardHeaderFlex} style={{ borderBottom: 'none', paddingBottom: 0 }}>
              <div>
                <h2 className={styles.cardTitle} style={{ borderBottom: 'none', margin: 0, padding: 0 }}>Producto Personalizable</h2>
                <p className={styles.cardSubtitle} style={{ marginTop: '0.25rem' }}>
                  {form.isComboProduct 
                    ? 'Permite a los clientes personalizar los productos de este paquete usando las vistas originales de cada uno.'
                    : 'Permite a los clientes añadir sus propios textos y diseños sobre este producto en la tienda.'}
                </p>
              </div>
              <label className={styles.toggleSwitch}>
                <input
                  type="checkbox"
                  checked={form.customizable}
                  onChange={handleToggleCustomizable}
                />
                <span className={styles.slider}></span>
              </label>
            </div>
            {form.customizable && !form.isComboProduct && (
              <div style={{ marginTop: '2rem' }}>
                <AdminCustomizationViewsEditor 
                  views={form.customizationViews} 
                  onChange={(views) => setForm(f => ({ ...f, customizationViews: views }))} 
                  draftId={draftId}
                />
              </div>
            )}
            {form.customizable && form.isComboProduct && (
              <div style={{ marginTop: '1.5rem', padding: '1rem', background: '#f8f9fa', borderRadius: '8px', border: '1px solid #e9ecef' }}>
                <p style={{ margin: 0, color: '#666', fontSize: '0.9rem' }}>
                  ✅ <strong>Personalización activada.</strong> En la tienda, el cliente podrá personalizar cada elemento de este combo. Las áreas de impresión y vistas se heredarán automáticamente de la configuración original de cada producto.
                </p>
              </div>
            )}
          </div>


          <div className={styles.card} style={{ marginTop: '1.5rem' }}>
            <div className={styles.cardHeaderFlex} style={{ borderBottom: 'none', paddingBottom: 0 }}>
              <div>
                <h2 className={styles.cardTitle} style={{ borderBottom: 'none', margin: 0, padding: 0 }}>Configuración</h2>
                <p className={styles.cardSubtitle} style={{ marginTop: '0.25rem' }}>
                  Ajustes adicionales para la visualización del producto en la tienda.
                </p>
              </div>
            </div>
            
            <div style={{ marginTop: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem', background: '#f8f9fa', borderRadius: '8px', border: '1px solid #e9ecef' }}>
              <div>
                <h4 style={{ margin: 0, color: '#111', fontSize: '1rem' }}>Producto Destacado</h4>
                <p style={{ margin: 0, color: '#666', fontSize: '0.85rem', marginTop: '0.2rem' }}>
                  Resalta este producto en los módulos de "Productos Destacados" de tus landing pages.
                </p>
              </div>
              <label className={styles.toggleSwitch}>
                <input
                  type="checkbox"
                  checked={form.featured}
                  onChange={(e) => setForm(f => ({ ...f, featured: e.target.checked }))}
                />
                <span className={styles.slider}></span>
              </label>
            </div>
          </div>

          <div className={styles.saveSection}>
            <Button
              type="submit"
              className={styles.saveBtn}
              disabled={uploading || saveMutation.isPending}
            >
              {uploading ? <><Loader2 className="animate-spin" size={18} /> Procesando...</> : <><Save size={18} /> {isNew ? 'Guardar Producto (Oficial)' : 'Guardar Cambios'}</>}
            </Button>
          </div>

        </div>
      </form>
    </div>
  );
};

export default AdminProductoFormV2;
