import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createProduct, updateProduct, getProduct, generateProductId } from '../../../services/products';
import { getMockups } from '../../../services/mockups';
import { getBrands, createBrand, updateBrand } from '../../../services/brands';
import { getNiches } from '../../../services/niches';
import { getVendors } from '../../../services/vendors';
import { getCategories, createCategory } from '../../../services/categories';
import { getCollections, createCollection } from '../../../services/collections';
import { getTags, createTag } from '../../../services/tags';
import { getCharacters, createCharacter } from '../../../services/characters';
import { uploadFile, deleteFile } from '../../../services/firebase/storage';
import CreatableSelect from 'react-select/creatable';
import { ImagePlus, Save, ArrowLeft, Loader2, Shirt, Image as ImageIcon, Trash2, Camera, Star, X, Edit2 } from 'lucide-react';
import Button from '../../../components/common/Button';
import ProductImageContainer from '../components/ProductImageContainer/ProductImageContainer';
import AdminCustomizationViewsEditor from '../components/AdminCustomizationViewsEditor/AdminCustomizationViewsEditor';
import AdminComboEditor from '../components/AdminComboEditor/AdminComboEditor';
import YoryoPersonalizado from '../../../components/YoryoPersonalizado/YoryoPersonalizado';
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

// eslint-disable-next-line no-unused-vars
// eslint-disable-next-line no-unused-vars
const TagInput = ({ tags, setTags, placeholder }) => {
  const [input, setInput] = useState('');
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const val = input.trim();
      if (val && !tags.includes(val)) {
        setTags([...tags, val]);
      }
      setInput('');
    }
  };
  const removeTag = (indexToRemove) => {
    setTags(tags.filter((_, i) => i !== indexToRemove));
  };
  return (
    <div className={styles.tagInputContainer}>
      <div className={styles.tagList}>
        {tags.map((tag, i) => (
          <span key={i} className={styles.tagBadge}>
            {tag} <button type="button" onClick={() => removeTag(i)}><X size={12}/></button>
          </span>
        ))}
      </div>
      <input 
        type="text" 
        className={styles.input} 
        value={input} 
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
      />
    </div>
  );
};

const AdminProductoFormV2 = () => {
  const { id } = useParams();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const urlDraftId = searchParams.get('draftId');
  // Marca preseleccionada al abrir el formulario desde "Crear producto en {marca}"
  // (AdminMarcas → /admin/productos/nuevo?brandId=<id>). Solo aplica a productos NUEVOS:
  // siembra form.brandId sin tocar nada de precios/stock ni la lógica de guardado.
  const urlBrandId = searchParams.get('brandId') || '';
  const isNew = !id;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  // Si no hay draftId en la URL, se genera uno nuevo (o se usa el id del producto si estamos editando)
  const [draftId] = useState(() => urlDraftId || (isNew ? generateProductId() : id));
  
  // Ref para comunicar la orden de guardado al componente YoryoPersonalizado
  const yoryoRef = useRef(null);

  // Prevenir duplicación de borradores: inyectar el draftId en la URL si es un producto nuevo
  // De esta manera, si el usuario recarga la página (F5), se leerá de la URL y reutilizará el mismo borrador.
  useEffect(() => {
    if (isNew && !urlDraftId) {
      // Conservamos brandId en la URL para no perder la marca preseleccionada al inyectar el draftId.
      const brandParam = urlBrandId ? `&brandId=${urlBrandId}` : '';
      navigate(`?draftId=${draftId}${brandParam}`, { replace: true });
    }
  }, [isNew, urlDraftId, urlBrandId, draftId, navigate]);

  const [form, setForm] = useState({
    name: '',
    description: '',
    price: '',
    salePrice: '',
    sku: '',
    brandId: '',
    nicheId: '',
    vendorId: '',
    fulfillmentType: '',
    category: '',
    collections: [],
    defaultVariantId: '', // ID de la variante principal
    variants: [], 
    customizable: false,
    customizationViews: [],
    characters: [],
    tags: [],
    isComboProduct: false,
    comboItems: [],
    comboPreviewImage: '',
    featured: false,
    inStock: 0,
  });

  const [initialFormState, setInitialFormState] = useState(null);
  const [activeGalleryTabId, setActiveGalleryTabId] = useState(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [designUrlInput, setDesignUrlInput] = useState('');
  const [uploading, setUploading] = useState(false);
  const canvasElRef = useRef(null);

  const [showBrandModal, setShowBrandModal] = useState(false);
  const [newBrandForm, setNewBrandForm] = useState({ id: null, name: '', logoUrl: '' });
  const [creatingBrand, setCreatingBrand] = useState(false);

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
  const { data: tags } = useQuery({ queryKey: ['admin-tags'], queryFn: async () => (await getTags()).data });
  const { data: characters } = useQuery({ queryKey: ['admin-characters'], queryFn: async () => (await getCharacters()).data });
  const { data: nicheOptions } = useQuery({ queryKey: ['admin-niches'], queryFn: async () => (await getNiches()).data });
  const { data: vendorOptions } = useQuery({ queryKey: ['admin-vendors'], queryFn: async () => (await getVendors()).data });

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
      let mappedVariants = (productData.variants || []).map(v => ({
        ...v,
        mode: v.imageUrl ? 'direct' : 'mockup',
        mockupState: { selectedMockupId: '', selectedVariantIndex: 0 },
        // Asegurar que images y sizes siempre sean arrays
        images: Array.isArray(v.images) ? v.images : [],
        sizes: Array.isArray(v.sizes) ? v.sizes : [],
        sizeLabel: v.sizeLabel || 'Talla',
        showSizeConfig: v.showSizeConfig || (Array.isArray(v.sizes) && v.sizes.length > 0),
      }));

      // ── FALLBACK: producto sin variants[] (legacy o guardado sin hasVariants) ──
      // Si no hay variantes pero hay mainImage, creamos una variante sintética
      // para que el editor de variantes pueda trabajar.
      if (mappedVariants.length === 0 && !productData.isComboProduct) {
        const syntheticId = productData.defaultVariantId || `var_${Date.now()}`;
        mappedVariants = [{
          id: syntheticId,
          name: 'Principal',
          colorHex: '#cccccc',
          mode: productData.mainImage ? 'direct' : 'mockup',
          imageUrl: productData.mainImage || '',
          images: Array.isArray(productData.images) ? productData.images.filter(u => u !== productData.mainImage) : [],
          sizes: Array.isArray(productData.mainSizes) ? productData.mainSizes : [],
          sizeLabel: 'Talla',
          showSizeConfig: Array.isArray(productData.mainSizes) && productData.mainSizes.length > 0,
          mockupState: { selectedMockupId: '', selectedVariantIndex: 0 },
        }];
      }

      const firstVariantId = mappedVariants[0]?.id || '';

      const newForm = {
        name: productData.name || '',
        description: productData.description || '',
        price: productData.price || '',
        salePrice: productData.salePrice || '',
        sku: productData.sku || '',
        brandId: productData.brandId || '',
        nicheId: productData.nicheId || '',
        vendorId: productData.vendorId || '',
        fulfillmentType: productData.fulfillmentType || '',
        category: (() => {
          const raw = Array.isArray(productData.categories)
            ? (productData.categories[0]?.id || productData.categories[0] || '')
            : (productData.category?.id || productData.category || '');
          return raw === '[object Object]' ? '' : raw;
        })(),
        collections: (() => {
          const raw = productData.collections;
          // Retrocompat: array de ids, array de objetos {id}, un solo string o {id}
          const arr = Array.isArray(raw) ? raw : (raw ? [raw] : []);
          return arr
            .map(c => (c && typeof c === 'object' ? c.id : c) || '')
            .filter(c => c && c !== '[object Object]');
        })(),
        defaultVariantId: productData.defaultVariantId || firstVariantId,
        variants: mappedVariants,
        customizable: productData.customizable || false,
        customizationViews: productData.customizable && productData.customizationViews ? productData.customizationViews : [],
        isComboProduct: Boolean(productData.isComboProduct),
        comboItems: productData.comboItems || [],
        comboPreviewImage: productData.comboPreviewImage || '',
        characters: productData.characters || [],
        tags: productData.tags || [],
        featured: productData.featured || false,
        inStock: productData.inStock || 0,
      };
      setForm(newForm);
      setInitialFormState(JSON.stringify(newForm));

      // Siempre activar la primera variante si existe
      if (firstVariantId) setActiveGalleryTabId(firstVariantId);
      return; // No cargamos draft si estamos editando uno oficial directamente sin draftId
    }

    // Si es un producto NUEVO pero viene con draftId, cargamos el borrador
    if (isNew && urlDraftId) {
      const savedDrafts = JSON.parse(localStorage.getItem('wala_drafts') || '[]');
      const draft = savedDrafts.find(d => d.draftId === urlDraftId);
      if (draft) {
        setForm(draft.form);
        setInitialFormState(JSON.stringify(draft.form));
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productData, isNew, urlDraftId]);

  const initEmptyForm = () => {
    const initialVariantId = `var_${Date.now()}`;
    setForm(f => {
      const newForm = {
        ...f,
        // Marca preseleccionada (si se abrió con ?brandId=...); si no, conserva lo que hubiera.
        brandId: urlBrandId || f.brandId || '',
        defaultVariantId: initialVariantId,
        variants: [{ id: initialVariantId, name: 'Variante 1', colorHex: '#cccccc', mode: 'mockup', mockupState: { selectedMockupId: '', selectedVariantIndex: 0 }, images: [], imageUrl: '', sizes: [], sizeLabel: 'Talla', showSizeConfig: false }],
        customizable: false,
        customizationViews: [],
        characters: [],
        tags: [],
        isComboProduct: false,
        comboItems: [],
        comboPreviewImage: '',
        featured: false,
        inStock: 0,
      };
      setInitialFormState(JSON.stringify(newForm));
      return newForm;
    });
    setActiveGalleryTabId(initialVariantId);
  };

  // 2. Autoguardado en LocalStorage
  useEffect(() => {
    // Guardar borrador SOLO si la data ha cambiado de su estado inicial
    if (form.variants.length > 0 && initialFormState && JSON.stringify(form) !== initialFormState) {
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
      // eslint-disable-next-line react-hooks/exhaustive-deps
      localStorage.setItem('wala_drafts', JSON.stringify(savedDrafts));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
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

    // eslint-disable-next-line react-hooks/exhaustive-deps
    return () => {
      // Cleanup handled via strict deps
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
        // eslint-disable-next-line react-hooks/exhaustive-deps
        fabricCanvas.clear();
        fabricCanvas.setBackgroundColor('', fabricCanvas.renderAll.bind(fabricCanvas));
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const handleDesignUrlSubmit = () => {
    if (!designUrlInput.trim() || !fabricCanvas) return;
    const url = designUrlInput.trim();
    fabric.Image.fromURL(url, (img) => {
      if (!img) {
        alert("No se pudo cargar la imagen desde la URL. Asegúrate de que sea pública o válida.");
        return;
      }
      img.scaleToWidth(120);
      img.set({
        originX: 'center', originY: 'center', left: 150, top: 150,
        transparentCorners: false, cornerColor: '#111', borderColor: '#111', cornerSize: 10, padding: 5
      });
      fabricCanvas.add(img);
      fabricCanvas.setActiveObject(img);
      fabricCanvas.renderAll();
      setDesignUrlInput('');
    }, { crossOrigin: 'anonymous' });
  };

  const safelyDeleteOldImage = async (url) => {
    if (url && url.includes('firebasestorage.googleapis.com')) {
      try { await deleteFile(url); } catch(e) { console.warn('Could not delete old image', e); }
    }
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
        await safelyDeleteOldImage(activeVariant.imageUrl);
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
        await safelyDeleteOldImage(activeVariant.imageUrl);
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

  const removeGalleryImage = async (index) => {
    const imageUrlToDelete = activeVariant.images[index];
    if (!imageUrlToDelete) return;
    
    setUploading(true);
    try {
      await safelyDeleteOldImage(imageUrlToDelete);
      updateActiveVariant({ images: activeVariant.images.filter((_, i) => i !== index) });
    } finally {
      setUploading(false);
    }
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
      if (isNew) return await createProduct(payload, draftId);
      return await updateProduct(id, payload);
    },
    onSuccess: async () => {
      // Limpiar borrador si existe
      const savedDrafts = JSON.parse(localStorage.getItem('wala_drafts') || '[]');
      const filtered = savedDrafts.filter(d => d.draftId !== draftId);
      localStorage.setItem('wala_drafts', JSON.stringify(filtered));

      // Forzamos la descarga de la nueva lista antes de navegar (refetchQueries sí o sí descarga aunque la query esté inactiva)
      await Promise.all([
        queryClient.refetchQueries({ queryKey: ['admin-products'] }),
        queryClient.invalidateQueries({ queryKey: ['products'] }),
        queryClient.invalidateQueries({ queryKey: ['product', id] }),
        queryClient.invalidateQueries({ queryKey: ['featured-products'] }),
        queryClient.invalidateQueries({ queryKey: ['collection-products'] })
      ]);
      
      navigate('/admin/productos');
    }
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || (!form.isComboProduct && form.variants.length === 0)) return;

    // Validación de imagen eliminada para permitir productos sin foto
    setUploading(true);
    try {
      const finalVariants = form.variants.map((v) => ({
        id: v.id,
        name: v.name,
        colorHex: v.colorHex,
        imageUrl: v.imageUrl || '',
        images: Array.isArray(v.images) ? v.images : [],
        sizes: Array.isArray(v.sizes) ? v.sizes : [],
        sizeLabel: v.sizeLabel || 'Talla',
        showSizeConfig: v.showSizeConfig || false,
      }));

      // Identify main image
      const defaultVariant = finalVariants.find(v => v.id === form.defaultVariantId) || finalVariants[0];
      let currentMainImage = defaultVariant?.imageUrl || '';
      const isCombo = form.isComboProduct;

      let currentComboPreview = form.comboPreviewImage;

      // ── CRÍTICO: Capturar la foto del lienzo unificado ANTES de armar el payload ──
      if (form.customizable && yoryoRef.current) {
        const newPreviewUrl = await yoryoRef.current.saveYoryoData();
        if (newPreviewUrl) {
          if (isCombo) {
            currentComboPreview = newPreviewUrl;
          }
          currentMainImage = newPreviewUrl;
        }
      }

      const payload = {
        name: form.name,
        description: form.description,
        price: Number(form.price) || 0,
        salePrice: Number(form.salePrice) || 0,
        inStock: Number(form.inStock) || 0,
        sku: form.sku,
        brandId: form.brandId,
        nicheId: form.nicheId || undefined,
        vendorId: form.vendorId || undefined,
        fulfillmentType: form.fulfillmentType || undefined,
        categories: form.category ? [form.category] : [],
        collections: Array.isArray(form.collections) ? form.collections : [],
        mainImage: currentMainImage,
        thumbnailWithDesignUrl: form.customizable ? currentMainImage : '',
        mainSizes: [],                     // Las tallas viven dentro de cada variante
        defaultVariantId: defaultVariant?.id || '',
        // ── CRÍTICO: persistir hasVariants para que normalizeProductForRead lo lea ──
        hasVariants: !isCombo && finalVariants.length > 0,
        customizable: form.customizable,
        customizationViews: form.customizationViews,
        isComboProduct: isCombo,
        comboItems: isCombo ? form.comboItems : [],
        comboPreviewImage: isCombo ? currentComboPreview : '',
        characters: form.characters || [],
        tags: form.tags || [],
        variants: isCombo ? [] : finalVariants,
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
      {/* TOAST DE CARGA (MENOS INVASIVO) */}
      {(uploading || saveMutation.isPending) && (
        <div className={styles.loadingToast}>
          <Loader2 className={styles.spin} size={32} color="#0a0a0a" />
          <div className={styles.toastText}>
            <h3>{isNew ? 'Creando Producto...' : 'Guardando Cambios...'}</h3>
            <p>Por favor, espera un momento.</p>
          </div>
        </div>
      )}
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

      {showBrandModal && (
        <div className={styles.brandModalOverlay}>
          <div className={styles.brandModal}>
            <h3>{newBrandForm.id ? 'Editar Marca' : 'Crear Nueva Marca'}</h3>
            <div className={styles.field}>
              <label>Nombre de la marca *</label>
              <input 
                type="text" 
                className={styles.input} 
                value={newBrandForm.name} 
                onChange={(e) => setNewBrandForm({ ...newBrandForm, name: e.target.value })}
                placeholder="Ej: Nike, Apple..."
                autoFocus
              />
            </div>
            <div className={styles.field}>
              <label>URL de Imagen / Logo (Opcional)</label>
              <input 
                type="text" 
                className={styles.input} 
                value={newBrandForm.logoUrl} 
                onChange={(e) => setNewBrandForm({ ...newBrandForm, logoUrl: e.target.value })}
                placeholder="https://..."
              />
            </div>
            <div className={styles.brandModalActions}>
              <button type="button" className={styles.cancelBtn} onClick={() => setShowBrandModal(false)} disabled={creatingBrand}>Cancelar</button>
              <button 
                type="button" 
                className={styles.saveBtn} 
                onClick={async () => {
                  if (!newBrandForm.name.trim()) return alert('El nombre es obligatorio');
                  setCreatingBrand(true);
                  try {
                    if (newBrandForm.id) {
                      await updateBrand(newBrandForm.id, { name: newBrandForm.name, logoUrl: newBrandForm.logoUrl });
                    } else {
                      const res = await createBrand({ name: newBrandForm.name, logoUrl: newBrandForm.logoUrl });
                      setForm(f => ({ ...f, brandId: res.id }));
                    }
                    queryClient.invalidateQueries({ queryKey: ['admin-brands'] });
                    setShowBrandModal(false);
                    setNewBrandForm({ id: null, name: '', logoUrl: '' });
                  } catch (err) {
                    alert('Error creando marca');
                  } finally {
                    setCreatingBrand(false);
                  }
                }}
                disabled={creatingBrand}
              >
                {creatingBrand ? <span key="creating">Creando...</span> : <span key="default">Guardar Marca</span>}
              </button>
            </div>
          </div>
        </div>
      )}

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
              <div className={styles.field}>
                <label className={styles.label}>Stock</label>
                <input
                  type="number"
                  min="0"
                  className={styles.input}
                  value={form.inStock}
                  onChange={e => setForm(f => ({ ...f, inStock: e.target.value }))}
                  placeholder="0"
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
            <div className={styles.cardHeaderFlex}>
              <h2 className={styles.cardTitle}>Organización</h2>
              <button type="button" onClick={() => setShowBrandModal(true)} className={styles.addBrandBtn}>
                + Crear Marca
              </button>
            </div>

            {/* Marketplace: nicho, vendedor y tipo de cumplimiento (Fase 1) */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, margin: '12px 0' }}>
              <label style={{ display: 'flex', flexDirection: 'column', fontSize: 13, gap: 4 }}>
                Nicho
                <select value={form.nicheId} onChange={(e) => setForm(f => ({ ...f, nicheId: e.target.value }))} style={{ padding: 8, borderRadius: 6, border: '1px solid #ccc' }}>
                  <option value="">(por defecto: regala-con-amor)</option>
                  {(nicheOptions || []).map(n => <option key={n.id} value={n.slug || n.id}>{n.name || n.slug || n.id}</option>)}
                </select>
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', fontSize: 13, gap: 4 }}>
                Vendedor
                <select value={form.vendorId} onChange={(e) => setForm(f => ({ ...f, vendorId: e.target.value }))} style={{ padding: 8, borderRadius: 6, border: '1px solid #ccc' }}>
                  <option value="">(por defecto: casa)</option>
                  {(vendorOptions || []).map(v => <option key={v.id} value={v.id}>{v.displayName || v.name || v.id}</option>)}
                </select>
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', fontSize: 13, gap: 4 }}>
                Tipo de cumplimiento
                <select value={form.fulfillmentType} onChange={(e) => setForm(f => ({ ...f, fulfillmentType: e.target.value }))} style={{ padding: 8, borderRadius: 6, border: '1px solid #ccc' }}>
                  <option value="">(auto)</option>
                  <option value="print_on_demand">Personalizado (POD)</option>
                  <option value="stock">En stock</option>
                  <option value="made_to_order">Bajo pedido</option>
                  <option value="dropship">Dropship</option>
                </select>
              </label>
            </div>

            {/* Fila de Marcas (Miniviews) */}
            <div className={styles.adminBrandsCarousel}>
              {(brands || []).map(b => (
                <div 
                  key={b.id} 
                  className={`${styles.adminBrandWrapper} ${form.brandId === b.id ? styles.adminBrandActive : ''}`}
                  onClick={() => setForm(f => ({ ...f, brandId: form.brandId === b.id ? '' : b.id }))}
                  title={b.name}
                >
                  <div className={styles.adminBrandItem}>
                    {b.logoUrl || b.imageUrl ? (
                      <img src={b.logoUrl || b.imageUrl} alt={b.name} className={styles.adminBrandImage} />
                    ) : (
                      <div className={styles.adminBrandFallback}>{b.name.substring(0, 2).toUpperCase()}</div>
                    )}
                    <button 
                      type="button" 
                      className={styles.editBrandBtn} 
                      onClick={(e) => { 
                        e.stopPropagation(); 
                        setNewBrandForm({ id: b.id, name: b.name, logoUrl: b.logoUrl || b.imageUrl || '' }); 
                        setShowBrandModal(true); 
                      }}
                      title="Editar marca"
                    >
                      <Edit2 size={12} />
                    </button>
                  </div>
                  <span className={styles.adminBrandName}>{b.name}</span>
                </div>
              ))}
            </div>

            <div className={styles.fieldRow}>
              <div className={styles.field}>
                <label className={styles.label}>Categoría</label>
                <CreatableSelect
                  isClearable
                  placeholder="Seleccionar o escribir..."
                  onChange={(val) => setForm(f => ({ ...f, category: val ? val.value : '' }))}
                  onCreateOption={async (inputValue) => {
                    const res = await createCategory({ name: inputValue });
                    queryClient.invalidateQueries({ queryKey: ['admin-categories'] });
                    setForm(f => ({ ...f, category: res.id }));
                  }}
                  options={categories?.map(c => ({ label: c.name, value: c.id })) || []}
                  value={categories?.find(c => c.id === form.category) ? { label: categories.find(c => c.id === form.category).name, value: form.category } : null}
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Colección</label>
                <CreatableSelect
                  isMulti
                  placeholder="Seleccionar o escribir..."
                  onChange={(val) => setForm(f => ({ ...f, collections: (val || []).map(v => v.value) }))}
                  onCreateOption={async (inputValue) => {
                    const res = await createCollection({ name: inputValue });
                    queryClient.invalidateQueries({ queryKey: ['admin-collections'] });
                    setForm(f => ({ ...f, collections: [...(f.collections || []), res.id] }));
                  }}
                  options={collections?.map(c => ({ label: c.name, value: c.id })) || []}
                  value={(form.collections || []).map(id => {
                    const col = collections?.find(c => c.id === id);
                    return col ? { label: col.name, value: id } : { label: id, value: id };
                  })}
                />
              </div>
            </div>
            
            <div className={styles.fieldRow}>
              <div className={styles.field}>
                <label className={styles.label}>Personajes</label>
                <CreatableSelect
                  isMulti
                  placeholder="Seleccionar o escribir..."
                  onChange={(val) => setForm(f => ({ ...f, characters: val.map(v => v.value) }))}
                  onCreateOption={async (inputValue) => {
                    const res = await createCharacter({ name: inputValue });
                    queryClient.invalidateQueries({ queryKey: ['admin-characters'] });
                    setForm(f => ({ ...f, characters: [...(f.characters || []), res.id] }));
                  }}
                  options={characters?.map(c => ({ label: c.name, value: c.id })) || []}
                  value={(form.characters || []).map(id => {
                    const char = characters?.find(c => c.id === id);
                    return char ? { label: char.name, value: id } : { label: id, value: id };
                  })}
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Etiquetas / Tags</label>
                <CreatableSelect
                  isMulti
                  placeholder="Seleccionar o escribir..."
                  onChange={(val) => setForm(f => ({ ...f, tags: val.map(v => v.value) }))}
                  onCreateOption={async (inputValue) => {
                    const res = await createTag({ name: inputValue });
                    queryClient.invalidateQueries({ queryKey: ['admin-tags'] });
                    setForm(f => ({ ...f, tags: [...(f.tags || []), res.id] }));
                  }}
                  options={tags?.map(c => ({ label: c.name, value: c.id })) || []}
                  value={(form.tags || []).map(id => {
                    const tag = tags?.find(c => c.id === id);
                    return tag ? { label: tag.name, value: id } : { label: id, value: id };
                  })}
                />
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

                   <div className={styles.fieldRow} style={{ marginTop: '1rem', alignItems: 'flex-start' }}>
                     {!activeVariant.showSizeConfig ? (
                       <button 
                         type="button" 
                         onClick={() => updateActiveVariant({ showSizeConfig: true, sizeLabel: 'Talla' })} 
                         style={{ padding: '8px 16px', background: '#f3f4f6', border: '1px dashed #9ca3af', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, color: '#4b5563', width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '8px' }}
                       >
                         <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"></path><path d="M12 5v14"></path></svg>
                         Añadir Medidas / Tallas (Opcional)
                       </button>
                     ) : (
                       <div style={{ width: '100%', padding: '1rem', background: '#f9fafb', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
                         <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                           <h4 style={{ margin: 0, fontSize: '0.9rem', color: '#111' }}>Tallas y Medidas</h4>
                           <button 
                             type="button" 
                             onClick={() => updateActiveVariant({ showSizeConfig: false, sizes: [], sizeLabel: 'Talla' })} 
                             style={{ color: '#ef4444', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}
                           >
                             Desactivar
                           </button>
                         </div>
                         <div className={styles.fieldRow} style={{ marginBottom: 0 }}>
                           <div className={styles.field} style={{ marginBottom: 0, flex: 1 }}>
                             <label className={styles.label}>Tipo de Medida (Etiqueta)</label>
                             <input 
                               type="text" 
                               className={styles.input} 
                               value={activeVariant.sizeLabel || ''}
                               onChange={e => updateActiveVariant({ sizeLabel: e.target.value })}
                               placeholder="Ej. Talla, Número, Tamaño, etc."
                             />
                             <span style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '4px', display: 'block' }}>
                               Esto verá el cliente. Ej: "Selecciona tu {activeVariant.sizeLabel || 'Talla'}"
                             </span>
                           </div>
                           <div className={styles.field} style={{ marginBottom: 0, flex: 2 }}>
                             <label className={styles.label}>Opciones disponibles (Escribe y presiona Enter o Coma)</label>
                             <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', padding: '0.4rem 0.6rem', border: '1px solid #ccc', borderRadius: '4px', background: '#fff', alignItems: 'center', minHeight: '42px' }}>
                               {(activeVariant.sizes || []).map((s, idx) => (
                                 <span key={idx} style={{ background: '#e5e7eb', color: '#374151', padding: '0.2rem 0.6rem', borderRadius: '16px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 500 }}>
                                   {s}
                                   <button 
                                     type="button" 
                                     onClick={() => updateActiveVariant({ sizes: activeVariant.sizes.filter((_, i) => i !== idx) })} 
                                     style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: 0, display: 'flex', alignItems: 'center' }}
                                   >
                                     <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18"></path><path d="M6 6l12 12"></path></svg>
                                   </button>
                                 </span>
                               ))}
                               <input 
                                 type="text" 
                                 placeholder={(!activeVariant.sizes || activeVariant.sizes.length === 0) ? "Ej. S, M, L..." : ""}
                                 style={{ border: 'none', outline: 'none', flex: 1, minWidth: '100px', fontSize: '0.9rem', background: 'transparent' }}
                                 onKeyDown={(e) => {
                                   if (e.key === ',' || e.key === 'Enter') {
                                     e.preventDefault();
                                     const val = e.currentTarget.value.trim();
                                     if (val && !(activeVariant.sizes || []).includes(val)) {
                                       updateActiveVariant({ sizes: [...(activeVariant.sizes || []), val] });
                                     }
                                     e.currentTarget.value = '';
                                   }
                                 }}
                                 onBlur={(e) => {
                                   const val = e.target.value.trim();
                                   if (val && !(activeVariant.sizes || []).includes(val)) {
                                     updateActiveVariant({ sizes: [...(activeVariant.sizes || []), val] });
                                   }
                                   e.target.value = '';
                                 }}
                               />
                             </div>
                           </div>
                         </div>
                       </div>
                     )}
                   </div>

                   <div style={{ marginTop: '1rem', display: 'flex', gap: '1rem', alignItems: 'center', justifyContent: 'space-between' }}>
                     <button
                       type="button"
                       onClick={() => setForm(f => ({ ...f, defaultVariantId: activeVariant.id }))}
                       className={styles.defaultVariantBtn}
                       disabled={form.defaultVariantId === activeVariant.id}
                     >
                       <Star size={16} fill={form.defaultVariantId === activeVariant.id ? "#f59f00" : "none"} color={form.defaultVariantId === activeVariant.id ? "#f59f00" : "#666"} />
                       {form.defaultVariantId === activeVariant.id ? <span key="main">Variante Principal</span> : <span key="set">Establecer como Principal</span>}
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
                          <div>
                            <canvas ref={canvasElRef} className={styles.fabricCanvasEl} />
                          </div>
                        </ProductImageContainer>

                        {activeVariant.mockupState.selectedMockupId && (
                          <>
                            <button type="button" onClick={handleCaptureMockup} className={styles.captureBtn} disabled={uploading}>
                              {uploading ? <Loader2 className="animate-spin" size={20} /> : <Camera size={20} />} 
                              {uploading ? <span key="uploading">Capturando...</span> : <span key="default">Capturar y Fijar Imagen</span>}
                            </button>
                            
                            <div style={{ marginTop: '15px', padding: '10px', background: '#f8f9fa', borderRadius: '6px', border: '1px solid #ddd' }}>
                              <span style={{ fontSize: '0.85rem', color: '#666', display: 'block', marginBottom: '8px' }}>O pega un enlace de diseño:</span>
                              <div style={{ display: 'flex', gap: '8px' }}>
                                <input 
                                  type="text" 
                                  placeholder="https://..." 
                                  value={designUrlInput}
                                  onChange={(e) => setDesignUrlInput(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      handleDesignUrlSubmit();
                                    }
                                  }}
                                  style={{ flex: 1, padding: '6px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '0.85rem' }}
                                />
                                <button 
                                  type="button"
                                  onClick={handleDesignUrlSubmit}
                                  disabled={!designUrlInput.trim()}
                                  style={{ padding: '6px 12px', background: '#e5e7eb', border: 'none', borderRadius: '4px', cursor: designUrlInput.trim() ? 'pointer' : 'not-allowed' }}
                                >
                                  Cargar
                                </button>
                              </div>
                            </div>
                          </>
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
                        {uploading ? <span key="uploading">Subiendo...</span> : <span key="default">Subir Imagen Directa</span>}
                        <input type="file" accept="image/*" onChange={handleDirectImageUpload} disabled={uploading} hidden />
                      </label>
                      <div style={{ marginTop: '10px', padding: '10px', background: '#f8f9fa', borderRadius: '6px', border: '1px solid #ddd' }}>
                        <span style={{ fontSize: '0.85rem', color: '#666', display: 'block', marginBottom: '8px' }}>O pega un enlace de imagen externa:</span>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <input 
                            type="text" 
                            placeholder="https://..." 
                            value={designUrlInput}
                            onChange={(e) => setDesignUrlInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                if (designUrlInput.trim()) {
                                  updateActiveVariant({ imageUrl: designUrlInput.trim() });
                                  setDesignUrlInput('');
                                }
                              }
                            }}
                            style={{ flex: 1, padding: '6px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '0.85rem' }}
                          />
                          <button 
                            type="button"
                            onClick={() => {
                              if (designUrlInput.trim()) {
                                updateActiveVariant({ imageUrl: designUrlInput.trim() });
                                setDesignUrlInput('');
                              }
                            }}
                            disabled={!designUrlInput.trim()}
                            style={{ padding: '6px 12px', background: '#e5e7eb', border: 'none', borderRadius: '4px', cursor: designUrlInput.trim() ? 'pointer' : 'not-allowed' }}
                          >
                            Fijar URL
                          </button>
                        </div>
                      </div>
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
                    {uploading ? <span key="uploading">Subiendo...</span> : <span key="default">Agregar Fotos</span>}
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
                    ? <span key="combo">Permite a los clientes personalizar los productos de este paquete usando las vistas originales de cada uno.</span>
                    : <span key="single">Permite a los clientes añadir sus propios textos y diseños sobre este producto en la tienda.</span>}
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

          {form.customizable && (
            <div className={styles.card} style={{ marginTop: '1.5rem' }}>
              <YoryoPersonalizado 
                ref={yoryoRef}
                productImage={form.isComboProduct ? form.comboPreviewImage : form.variants?.[0]?.designImage || form.variants?.[0]?.imageUrl || ''}
                draftId={draftId}
                isComboProduct={form.isComboProduct}
                comboItems={form.comboItems}
                onComboItemsChange={(newItems) => setForm(f => ({ ...f, comboItems: newItems }))}
              />
            </div>
          )}

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
              {uploading ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
              {uploading ? <span key="uploading">Procesando...</span> : <span key="default">{isNew ? 'Guardar Producto (Oficial)' : 'Guardar Cambios'}</span>}
            </Button>
          </div>

        </div>
      </form>
    </div>
  );
};

export default AdminProductoFormV2;
