import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getProduct, getCategories, createProduct, updateProduct } from '../../services/products';
import { createCategory } from '../../services/categories';
import { getCollections, createCollection } from '../../services/collections';
import { getBrands, createBrand } from '../../services/brands';
import { getTags, createTag } from '../../services/tags';
import { getCharacters, createCharacter } from '../../services/characters';
import { getProductTypes, createProductType } from '../../services/productTypes';
import { getVendors, createVendor } from '../../services/vendors';
import { uploadFile, uploadFromDataUrl } from '../../services/firebase/storage';
import { generateThumbnailWithDesign } from '../../utils/thumbnailWithDesign';
import { toDirectImageUrl, ensureSingleImageUrl } from '../../utils/imageUrl';
import Button from '../../components/common/Button';
import Toggle from '../../components/common/Toggle/Toggle';
import AdminQuickAddModal from '../../components/admin/AdminQuickAddModal/AdminQuickAddModal';
import AdminViewEditor from '../../components/admin/AdminViewEditor/AdminViewEditor';
import PrintAreasEditor from '../../components/admin/PrintAreasEditor/PrintAreasEditor';
import AccordionSection from '../../components/admin/AccordionSection/AccordionSection';
import ComboItemsManager from '../../components/admin/ComboItemsManager/ComboItemsManager';
import ComboProductSelector from '../../components/admin/ComboProductSelector/ComboProductSelector';
import ComboEditor from '../../components/admin/ComboEditor/ComboEditor';
import VariantEditModal from '../../components/admin/VariantEditModal';
import AdminButtonModal from '../../components/admin/AdminButtonModal/AdminButtonModal';
import AdminTemplateModal from '../../components/admin/AdminTemplateModal/AdminTemplateModal';
import { isComboProduct, generateComboVariants } from '../../utils/comboProductUtils';
import { DesignClipboardProvider } from '../../contexts/DesignClipboardContext';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import AdminImageCropper from '../../components/admin/AdminImageCropper/AdminImageCropper';
import styles from './AdminProductoForm.module.css';

const originalError = console.error;
console.error = (...args) => {
  if (args[0]?.includes?.('findDOMNode')) return;
  if (args[0]?.includes?.('Warning:')) return;
  originalError(...args);
};

window.Quill = ReactQuill.Quill;
const ImageResize = require('quill-image-resize-module-react').default;
ReactQuill.Quill.register('modules/imageResize', ImageResize);

const icons = ReactQuill.Quill.import('ui/icons');
icons['actionButton'] = '<span class="custom-icon-action" style="font-weight:700;font-size:11px;font-family:Inter,sans-serif;white-space:nowrap;color:inherit;">+ Botón</span>';
icons['template'] = '<span class="custom-icon-template" style="font-weight:700;font-size:11px;font-family:Inter,sans-serif;white-space:nowrap;color:inherit;">📑 Plantilla</span>';
icons['divider'] = '<span class="custom-icon-divider" style="font-weight:700;font-size:11px;font-family:Inter,sans-serif;white-space:nowrap;color:inherit;">➖ Línea</span>';

const Size = ReactQuill.Quill.import('attributors/style/size');
Size.whitelist = ['10px', '12px', '14px', '16px', '18px', '20px', '24px', '30px', '36px', '48px', '60px', '72px'];
ReactQuill.Quill.register(Size, true);

const AlignStyle = ReactQuill.Quill.import('attributors/style/align');
ReactQuill.Quill.register(AlignStyle, true);

const BlockEmbed = ReactQuill.Quill.import('blots/block/embed');
const InlineEmbed = ReactQuill.Quill.import('blots/embed');

class DividerBlot extends BlockEmbed {
  static create(value) {
    const node = super.create();
    node.setAttribute('contenteditable', 'false');
    node.style.borderTop = '2px dashed #e0e0e0';
    node.style.borderBottom = 'none';
    node.style.borderLeft = 'none';
    node.style.borderRight = 'none';
    node.style.margin = '2rem 0';
    return node;
  }
}
DividerBlot.blotName = 'divider';
DividerBlot.tagName = 'hr';
ReactQuill.Quill.register(DividerBlot);

class ActionButtonBlot extends InlineEmbed {
  static create(value) {
    const node = super.create();
    node.setAttribute('href', value.url);
    node.setAttribute('target', '_blank');
    node.setAttribute('rel', 'noopener noreferrer');
    node.setAttribute('contenteditable', 'false');
    node.classList.add('custom-quill-button');
    
    node.style.display = 'inline-flex';
    node.style.alignItems = 'center';
    node.style.justifyContent = 'center';
    node.style.padding = '12px 24px';
    node.style.borderRadius = '50px';
    node.style.textDecoration = 'none';
    node.style.fontWeight = 'bold';
    node.style.margin = '10px 0';
    node.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)';
    node.style.fontFamily = 'Inter, sans-serif';
    
    if (value.type === 'whatsapp') {
      node.style.backgroundColor = '#25D366';
      node.style.color = '#fff';
      node.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" style="margin-right: 8px; vertical-align: middle;"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884"/></svg>` + value.text;
    } else if (value.type === 'cuestionario') {
      node.style.backgroundColor = '#4f46e5';
      node.style.color = '#fff';
      node.innerHTML = `📋 ` + value.text;
    } else {
      node.style.backgroundColor = '#e31837';
      node.style.color = '#fff';
      node.innerText = value.text;
    }
    return node;
  }

  static value(node) {
    const isWhatsapp = node.style.backgroundColor === 'rgb(37, 211, 102)' || node.style.backgroundColor === '#25d366' || node.innerHTML.includes('svg');
    const isCuestionario = node.style.backgroundColor === 'rgb(79, 70, 229)' || node.style.backgroundColor === '#4f46e5' || (node.getAttribute('href') && node.getAttribute('href').startsWith('cuestionario://'));
    return {
      url: node.getAttribute('href'),
      text: node.textContent,
      type: isCuestionario ? 'cuestionario' : (isWhatsapp ? 'whatsapp' : 'normal')
    };
  }
}
ActionButtonBlot.blotName = 'actionButton';
ActionButtonBlot.tagName = 'a';
ActionButtonBlot.className = 'custom-quill-button';
ReactQuill.Quill.register(ActionButtonBlot);

const defaultPrintAreas = () => ([{
  id: `zone_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
  shape: 'rectangle',
  x: 10,
  y: 10,
  width: 80,
  height: 80,
  rotation: 0,
  skewX: 0,
  skewY: 0
}]);

const createDefaultBackSide = (frontView) => {
  const backId = `back_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const imagesByColor = { default: '' };
  const initialLayersByColor = { default: [] };
  const printAreas = frontView?.printAreas && Array.isArray(frontView.printAreas) && frontView.printAreas.length > 0
    ? frontView.printAreas.map(area => ({
        ...area,
        id: `zone_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
      }))
    : defaultPrintAreas();
  return {
    id: backId,
    name: 'Espalda',
    printAreas,
    imagesByColor,
    initialLayersByColor
  };
};

const defaultForm = {
  name: '',
  categories: [],
  collections: [],
  tags: [],
  characters: [],
  productType: '',
  price: '',
  salePrice: '',
  inStock: 0,
  description: '',
  customizable: false,
  hasVariants: false,
  mainImage: '',
  mainSizes: [],
  variants: [],
  defaultVariantId: '',
  variantDisplayBehavior: 'default_only',
  behaviorImpressionsThreshold: 3,
  customizationViews: [],
  productCliparts: [],
  featured: false,
  featuredOrder: 0,
  visible: true,
  isComboProduct: false,
  comboLayout: { orientation: 'horizontal', spacing: 20 },
  comboItems: [],
  comboPreviewImage: '',
  comboItemCustomization: [],
  thumbnailWithDesignUrl: '',
  whatsappEnabled: true,
  whatsappNumber: '+51912881722',
  whatsappMessage: 'Hola CON AMOR: Me interesa este producto de tu página: {url}',
  brandId: '',
  sku: '',
  vendors: [],
};

const createDefaultVariant = () => ({
  id: `variant_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
  name: '',
  imageUrl: '',
  sizes: []
});

const AdminProductoForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isNew = !id;

  const [form, setForm] = useState(() => {
    if (isNew) {
      const v = createDefaultVariant();
      return {
        ...defaultForm,
        variants: [v],
        hasVariants: true,
        defaultVariantId: v.id
      };
    }
    return defaultForm;
  });
  const formRef = useRef(form);
  useEffect(() => { formRef.current = form; }, [form]);
  const [viewImageUrlInputs, setViewImageUrlInputs] = useState({});
  const [clipartUrlInput, setClipartUrlInput] = useState('');
  const [selectedColorByView, setSelectedColorByView] = useState({});
  const [showComboSelector, setShowComboSelector] = useState(false);
  const [variantModalOpen, setVariantModalOpen] = useState(false);
  const [editingVariantIndex, setEditingVariantIndex] = useState(null);
  const [saveStatus, setSaveStatus] = useState(null);
  const editingVariantIndexRef = useRef(null);
  const comboEditorRef = useRef(null);
  const triggerComboCaptureRef = useRef(null);
  const quillRef = useRef(null);

  const [cropImageObj, setCropImageObj] = useState(null);
  const [buttonModalState, setButtonModalState] = useState({ open: false, index: null, blot: null, initialData: null });
  const [templateModalOpen, setTemplateModalOpen] = useState(false);

  const [quickAddModal, setQuickAddModal] = useState({ isOpen: false, type: null });

  const imageHandler = useCallback(() => {
    const input = document.createElement('input');
    input.setAttribute('type', 'file');
    input.setAttribute('accept', 'image/*');
    input.click();

    input.onchange = async () => {
      const file = input.files[0];
      if (file && quillRef.current) {
         const reader = new FileReader();
         reader.onload = () => {
            const quill = quillRef.current.getEditor();
            const cursorPosition = quill.getSelection(true)?.index || quill.getLength();
            setCropImageObj({ src: reader.result, name: file.name, cursorPosition });
         };
         reader.readAsDataURL(file);
      }
    };
  }, []);

  const handleCropComplete = useCallback(async (croppedBlob) => {
      if (!cropImageObj || !quillRef.current) return;
      
      const { name, cursorPosition } = cropImageObj;
      setCropImageObj(null);
      const quill = quillRef.current.getEditor();
      
      quill.insertText(cursorPosition, '⏳ Subiendo imagen...', { color: '#999', italic: true });
        
      try {
        const path = `productos_wala/${id || 'new'}/descriptions/${Date.now()}_cropped_${name}`;
        const { url, error } = await uploadFile(croppedBlob, path);
        
        quill.deleteText(cursorPosition, '⏳ Subiendo imagen...'.length);
        
        if (url && !error) {
          quill.insertEmbed(cursorPosition, 'image', url);
          quill.setSelection(cursorPosition + 1);
        } else {
          console.error("Upload failed", error);
          alert("Error al subir imagen");
        }
      } catch (e) {
        quill.deleteText(cursorPosition, '⏳ Subiendo imagen...'.length);
        console.error("Upload error", e);
        alert("Error al subir imagen");
      }
  }, [cropImageObj, id]);

  const buttonHandler = useCallback(() => {
    const quill = quillRef.current?.getEditor();
    if (!quill) return;
    const cursorPosition = quill.getSelection(true)?.index || quill.getLength();
    setButtonModalState({ open: true, index: cursorPosition, blot: null, initialData: null });
  }, []);

  const handleButtonInsert = useCallback((btnData) => {
    const quill = quillRef.current?.getEditor();
    if (!quill) return;
    
    if (buttonModalState.blot) {
      const index = quill.getIndex(buttonModalState.blot);
      quill.deleteText(index, 1);
      quill.insertEmbed(index, 'actionButton', btnData);
    } else if (buttonModalState.index !== null) {
      quill.insertEmbed(buttonModalState.index, 'actionButton', btnData);
      quill.insertText(buttonModalState.index + 1, ' ');
      quill.setSelection(buttonModalState.index + 2);
    }
    setButtonModalState({ open: false, index: null, blot: null, initialData: null });
  }, [buttonModalState]);

  const templateHandler = useCallback(() => {
    setTemplateModalOpen(true);
  }, []);

  const handleTemplateInsert = useCallback((htmlContent) => {
    const quill = quillRef.current?.getEditor();
    if (!quill) return;
    const cursorPosition = quill.getSelection(true)?.index || quill.getLength();
    quill.clipboard.dangerouslyPasteHTML(cursorPosition, htmlContent);
    setTemplateModalOpen(false);
  }, []);

  const dividerHandler = useCallback(() => {
    const quill = quillRef.current?.getEditor();
    if (!quill) return;
    const cursorPosition = quill.getSelection(true)?.index || quill.getLength();
    quill.insertEmbed(cursorPosition, 'divider', true);
    quill.setSelection(cursorPosition + 1);
  }, []);

  const quillModules = React.useMemo(() => ({
    toolbar: {
      container: [
        [{ 'header': [1, 2, 3, 4, 5, 6, false] }],
        [{ 'size': Size.whitelist }],
        ['bold', 'italic', 'underline', 'strike'],
        [{ 'color': [] }, { 'background': [] }],
        [{ 'list': 'ordered' }, { 'list': 'bullet' }],
        [{ 'align': [] }],
        ['link', 'image', 'video'],
        ['clean']
      ],
      handlers: {
        image: imageHandler
      }
    },
    imageResize: {
      parchment: ReactQuill.Quill.import('parchment'),
      modules: ['Resize', 'DisplaySize', 'Toolbar']
    }
  }), [imageHandler]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!quillRef.current) return;
      try {
        const toolbar = quillRef.current.getEditor().getModule('toolbar')?.container;
        if (!toolbar) return;
        const tooltips = {
          'ql-bold': 'Negrita', 'ql-italic': 'Cursiva', 'ql-underline': 'Subrayado', 'ql-strike': 'Tachado',
          'ql-list[value="ordered"]': 'Lista enumerada', 'ql-list[value="bullet"]': 'Lista de viñetas',
          'ql-link': 'Insertar enlace', 'ql-image': 'Subir imagen con opción de recorte',
          'ql-video': 'Insertar iframe de video', 'ql-clean': 'Limpiar formato',
          '.ql-header .ql-picker-label': 'Tamaño de título', '.ql-size .ql-picker-label': 'Tamaño de letra',
          '.ql-color .ql-picker-label': 'Color de texto', '.ql-background .ql-picker-label': 'Color de fondo',
          '.ql-align .ql-picker-label': 'Alinear texto'
        };
        Object.entries(tooltips).forEach(([selector, title]) => {
           let el = null;
           if (selector.startsWith('.')) {
             el = toolbar.querySelector(`button${selector}`) || toolbar.querySelector(selector);
           } else {
             el = toolbar.querySelector(`button.${selector}`) || toolbar.querySelector(`.${selector}`);
           }
           if (el) el.setAttribute('title', title);
        });
      } catch (e) {
         console.warn("No se pudieron inyectar tooltips de Quill", e);
      }
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    editingVariantIndexRef.current = editingVariantIndex;
  }, [editingVariantIndex]);

  const handleComboColorChange = useCallback((index, colorCode) => {
    setForm((f) => {
      const newItems = [...(f.comboItems || [])];
      if (newItems[index]) {
        newItems[index] = {
          ...newItems[index],
          variantMapping: {
            ...(newItems[index].variantMapping || {}),
            color: colorCode === 'default' ? '' : colorCode
          }
        };
      }
      return { ...f, comboItems: newItems };
    });
  }, []);

  const { data: productData, isLoading: loadingProduct } = useQuery({
    queryKey: ['admin-product', id],
    queryFn: async () => {
      const { data, error } = await getProduct(id);
      if (error) throw new Error(error);
      return data;
    },
    enabled: !isNew
  });

  const { data: categoriesData } = useQuery({
    queryKey: ['admin-categories'],
    queryFn: async () => {
      const { data, error } = await getCategories();
      if (error) throw new Error(error);
      return data;
    }
  });

  const { data: collectionsData } = useQuery({
    queryKey: ['admin-collections'],
    queryFn: async () => {
      const { data, error } = await getCollections();
      if (error) throw new Error(error);
      return data;
    }
  });

  const { data: brandsData } = useQuery({
    queryKey: ['admin-brands'],
    queryFn: async () => {
      const { data, error } = await getBrands();
      if (error) throw new Error(error);
      return data;
    }
  });

  const { data: tagsData } = useQuery({
    queryKey: ['admin-tags'],
    queryFn: async () => {
      const { data, error } = await getTags();
      if (error) throw new Error(error);
      return data;
    }
  });

  const { data: charactersData } = useQuery({
    queryKey: ['admin-characters'],
    queryFn: async () => {
      const res = await getCharacters();
      if (res.error) throw new Error(res.error);
      return res.data;
    }
  });

  const { data: vendorsData } = useQuery({
    queryKey: ['admin-vendors'],
    queryFn: async () => {
      const res = await getVendors();
      if (res.error) throw new Error(res.error);
      return res.data;
    }
  });

  const { data: productTypesData } = useQuery({
    queryKey: ['admin-productTypes'],
    queryFn: async () => {
      const { data, error } = await getProductTypes();
      if (error) throw new Error(error);
      return data;
    }
  });

  // Crear vista por defecto cuando se marca como personalizable
  useEffect(() => {
    if (form.customizable && form.customizationViews.length === 0) {
      const viewId = `view_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      const imagesByColor = { default: form.hasVariants ? (form.variants[0]?.imageUrl || '') : form.mainImage || '' };
      if (form.hasVariants && form.variants.length > 0) {
        form.variants.forEach((v) => {
          imagesByColor[v.name] = v.imageUrl || '';
        });
      }
      const initialLayersByColor = { default: [] };
      if (form.hasVariants && form.variants.length > 0) {
        form.variants.forEach((v) => {
          initialLayersByColor[v.name] = [];
        });
      }
      setForm((f) => ({
        ...f,
        customizationViews: [
          { id: viewId, name: 'Vista 1', printAreas: defaultPrintAreas(), imagesByColor, initialLayersByColor }
        ]
      }));
    }
  }, [form.customizable, form.customizationViews.length, form.hasVariants, form.mainImage, form.variants]);

  // Eliminamos el borrado automático de variantes en ComboProducts
  // para permitir que el operador asigne manualmente imágenes al producto combinado.

  // Sincronizar imagen principal con vistas
  useEffect(() => {
    if (!form.customizable || form.customizationViews.length === 0) return;
    const mainImg = form.hasVariants ? (form.variants[0]?.imageUrl || '') : form.mainImage || '';
    if (mainImg) {
      const firstView = form.customizationViews[0];
      if (!firstView.imagesByColor?.default || firstView.imagesByColor.default === '') {
        updateCustomizationView(0, {
          imagesByColor: { ...firstView.imagesByColor, default: mainImg }
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: sync when main image/customizable/views change
  }, [form.mainImage, form.hasVariants, form.variants, form.customizable, form.customizationViews.length]);

  // Sincronizar imágenes por variante con vistas (preservar imágenes existentes)
  useEffect(() => {
    if (!form.customizable || form.customizationViews.length === 0 || !form.hasVariants) return;
    form.customizationViews.forEach((view, viewIndex) => {
      let updated = false;
      const newImagesByColor = { ...view.imagesByColor };
      form.variants.forEach((v) => {
        const variantImage = v.imageUrl || '';
        if (variantImage && (!newImagesByColor[v.name] || newImagesByColor[v.name] === '')) {
          newImagesByColor[v.name] = variantImage;
          updated = true;
        }
      });
      if (view.imagesByColor?.default && view.imagesByColor.default !== '') {
        newImagesByColor.default = view.imagesByColor.default;
      }
      if (updated) {
        updateCustomizationView(viewIndex, { imagesByColor: newImagesByColor });
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: sync when variants change
  }, [form.variants, form.customizable, form.hasVariants]);

  // Preservar imágenes existentes cuando se marca como producto pareja
  useEffect(() => {
    if (!form.customizable || form.customizationViews.length === 0) return;
    form.customizationViews.forEach((view, viewIndex) => {
      const currentImagesByColor = view.imagesByColor || {};
      const hasExistingImages = Object.values(currentImagesByColor).some(url => url && url.trim() !== '');
      if (hasExistingImages && form.hasVariants) {
        const preservedImages = { ...currentImagesByColor };
        form.variants.forEach((v) => {
          if (!preservedImages[v.name] || preservedImages[v.name] === '') {
            preservedImages[v.name] = v.imageUrl || currentImagesByColor.default || '';
          }
        });
        if (currentImagesByColor.default && currentImagesByColor.default !== '') {
          preservedImages.default = currentImagesByColor.default;
        }
        if (JSON.stringify(preservedImages) !== JSON.stringify(currentImagesByColor)) {
          updateCustomizationView(viewIndex, { imagesByColor: preservedImages });
        }
      }
    });
  }, [form.customizable, form.hasVariants, form.variants]);

  // Actualizar vistas cuando se agregan variantes nuevas
  useEffect(() => {
    if (!form.customizable || form.customizationViews.length === 0) return;
    form.customizationViews.forEach((view, viewIndex) => {
      let updated = false;
      const newImagesByColor = { ...view.imagesByColor };
      const newInitialLayersByColor = { ...view.initialLayersByColor };
      form.variants.forEach((v) => {
        if (!newImagesByColor[v.name] || newImagesByColor[v.name] === '') {
          newImagesByColor[v.name] = v.imageUrl || newImagesByColor.default || '';
          updated = true;
        }
        if (!newInitialLayersByColor[v.name]) {
          newInitialLayersByColor[v.name] = [];
          updated = true;
        }
      });
      if (view.imagesByColor?.default && view.imagesByColor.default !== '') {
        newImagesByColor.default = view.imagesByColor.default;
      }
      if (updated) {
        updateCustomizationView(viewIndex, {
          imagesByColor: newImagesByColor,
          initialLayersByColor: newInitialLayersByColor
        });
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: sync when variants count or customizable change
  }, [form.variants.length, form.customizable]);

  useEffect(() => {
    if (!isNew && productData) {
      setForm({
        name: productData.name ?? '',
        whatsappEnabled: productData.whatsappEnabled !== false,
        whatsappNumber: productData.whatsappNumber || '+51912881722',
        whatsappMessage: productData.whatsappMessage ?? 'Hola CON AMOR: Me interesa este producto de tu página: {url}',
        categories: Array.isArray(productData.categories)
          ? [...productData.categories]
          : productData.category
            ? [productData.category]
            : [],
        collections: Array.isArray(productData.collections)
          ? [...productData.collections]
          : [],
        tags: Array.isArray(productData.tags) ? [...productData.tags] : [],
        characters: Array.isArray(productData.characters) ? [...productData.characters] : [],
        vendors: Array.isArray(productData.vendors) ? [...productData.vendors] : (productData.vendor ? [productData.vendor] : []),
        productType: productData.productType || '',
        price: productData.price ?? '',
        salePrice: productData.salePrice ?? '',
        inStock: productData.inStock ?? 0,
        description: productData.description ?? '',
        customizable: Boolean(productData.customizable),
        mainImage: productData.mainImage ?? '',
        mainSizes: Array.isArray(productData.mainSizes) ? [...productData.mainSizes] : [],
        ...(() => {
          const list = Array.isArray(productData.variants)
            ? productData.variants.map((v) => ({
              id: v.id || `variant_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
              name: v.name ?? '',
              imageUrl: v.imageUrl ?? '',
              sizes: Array.isArray(v.sizes) ? [...v.sizes] : [],
              thumbnailCrop: v.thumbnailCrop ?? null
            }))
            : [];
          if (list.length === 0) {
            const v = createDefaultVariant();
            list.push(v);
          }
          return {
            hasVariants: list.length > 0,
            variants: list,
            defaultVariantId: productData.defaultVariantId ?? productData.variants?.[0]?.id ?? list[0]?.id ?? ''
          };
        })(),
        variantDisplayBehavior: productData.variantDisplayBehavior ?? 'default_only',
        behaviorImpressionsThreshold: typeof productData.behaviorImpressionsThreshold === 'number' ? productData.behaviorImpressionsThreshold : 3,
        customizationViews: Array.isArray(productData.customizationViews)
          ? productData.customizationViews.map((v) => {
            // Migrar initialLayers antiguos a initialLayersByColor.default
            let initialLayersByColor = {};
            if (v.initialLayersByColor && typeof v.initialLayersByColor === 'object') {
              Object.keys(v.initialLayersByColor).forEach(colorKey => {
                initialLayersByColor[colorKey] = Array.isArray(v.initialLayersByColor[colorKey])
                  ? [...v.initialLayersByColor[colorKey]]
                  : [];
              });
            } else if (Array.isArray(v.initialLayers)) {
              initialLayersByColor.default = [...v.initialLayers];
            } else {
              initialLayersByColor.default = [];
            }

            // Migrar printArea antiguo a printAreas (preservar todas las propiedades)
            let printAreas = [];
            if (Array.isArray(v.printAreas) && v.printAreas.length > 0) {
              printAreas = v.printAreas.map(area => ({
                id: area.id || `zone_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
                shape: area.shape || 'rectangle',
                x: Number(area.x) ?? 10,
                y: Number(area.y) ?? 10,
                width: Number(area.width) ?? 80,
                height: Number(area.height) ?? 80,
                rotation: Number(area.rotation) ?? 0,
                skewX: Number(area.skewX) ?? 0,
                skewY: Number(area.skewY) ?? 0,
                ...(area.customShapeId && { customShapeId: String(area.customShapeId) }),
                ...(area.freeDrawPath && { freeDrawPath: String(area.freeDrawPath) })
              }));
            } else if (v.printArea && typeof v.printArea === 'object') {
              // Migrar printArea antiguo
              printAreas = [{
                id: `zone_${Date.now()}_0`,
                shape: 'rectangle',
                x: Number(v.printArea.x) ?? 10,
                y: Number(v.printArea.y) ?? 10,
                width: Number(v.printArea.width) ?? 80,
                height: Number(v.printArea.height) ?? 80,
                rotation: 0,
                skewX: 0,
                skewY: 0
              }];
            } else {
              printAreas = defaultPrintAreas();
            }

            return {
              id: v.id || `view_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
              name: v.name ?? 'Vista',
              printAreas,
              imagesByColor: v.imagesByColor && typeof v.imagesByColor === 'object' ? { ...v.imagesByColor } : { default: '' },
              initialLayersByColor,
              hasBackSide: Boolean(v.hasBackSide),
              ...(v.hasBackSide && v.backSide && typeof v.backSide === 'object' ? {
                backSide: {
                  id: v.backSide.id || `back_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
                  name: v.backSide.name || 'Espalda',
                  printAreas: Array.isArray(v.backSide.printAreas) && v.backSide.printAreas.length > 0
                    ? v.backSide.printAreas.map(area => ({
                        id: area.id || `zone_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
                        shape: area.shape || 'rectangle',
                        x: Number(area.x) ?? 10,
                        y: Number(area.y) ?? 10,
                        width: Number(area.width) ?? 80,
                        height: Number(area.height) ?? 80,
                        rotation: Number(area.rotation) ?? 0,
                        skewX: Number(area.skewX) ?? 0,
                        skewY: Number(area.skewY) ?? 0
                      }))
                    : defaultPrintAreas(),
                  imagesByColor: v.backSide.imagesByColor && typeof v.backSide.imagesByColor === 'object'
                    ? { ...v.backSide.imagesByColor }
                    : { default: '' },
                  initialLayersByColor: v.backSide.initialLayersByColor && typeof v.backSide.initialLayersByColor === 'object'
                    ? (() => {
                        const layers = {};
                        Object.keys(v.backSide.initialLayersByColor).forEach(key => {
                          layers[key] = Array.isArray(v.backSide.initialLayersByColor[key])
                            ? [...v.backSide.initialLayersByColor[key]]
                            : [];
                        });
                        return layers;
                      })()
                    : { default: [] }
                }
              } : {})
            };
          })
          : [],
        productCliparts: Array.isArray(productData.productCliparts)
          ? productData.productCliparts.map((c) => ({ id: c.id, name: c.name ?? '', url: c.url ?? '' }))
          : [],
        featured: Boolean(productData.featured),
        featuredOrder: productData.featuredOrder ?? 0,
        visible: productData.visible !== false,
        isComboProduct: Boolean(productData.isComboProduct),
        comboLayout: productData.comboLayout && typeof productData.comboLayout === 'object'
          ? {
            orientation: productData.comboLayout.orientation === 'vertical' ? 'vertical' : 'horizontal',
            spacing: typeof productData.comboLayout.spacing === 'number' ? productData.comboLayout.spacing : 20
          }
          : { orientation: 'horizontal', spacing: 20 },
        comboItems: Array.isArray(productData.comboItems)
          ? productData.comboItems.map((item, index) => ({
            productId: String(item.productId || ''),
            viewId: String(item.viewId || ''),
            position: typeof item.position === 'number' ? item.position : index,
            scale: typeof item.scale === 'number' && item.scale > 0 ? item.scale : 1,
            variantMapping: item.variantMapping && typeof item.variantMapping === 'object' ? item.variantMapping : {}
          }))
          : [],
        comboPreviewImage: productData.comboPreviewImage || '',
        thumbnailWithDesignUrl: productData.thumbnailWithDesignUrl || '',
        comboItemCustomization: Array.isArray(productData.comboItemCustomization)
          ? productData.comboItemCustomization.map((c) => ({
            productId: String(c.productId || ''),
            viewId: String(c.viewId || ''),
            printAreas: Array.isArray(c.printAreas) ? c.printAreas.map((a) => ({ ...a })) : [],
            initialLayersByColor: c.initialLayersByColor && typeof c.initialLayersByColor === 'object' ? { ...c.initialLayersByColor } : { default: [] },
            backSide: c.backSide && typeof c.backSide === 'object' ? { ...c.backSide } : undefined
          }))
          : [],
        brandId: productData.brandId || '',
        sku: productData.sku || '',
        vendor: productData.vendor || ''
      });
    }
  }, [isNew, productData]);

  // Mantener defaultVariantId válido cuando se elimina la variante que era principal
  useEffect(() => {
    if (!form.hasVariants || form.variants.length === 0) return;
    const ids = form.variants.map((v) => v.id);
    if (!form.defaultVariantId || !ids.includes(form.defaultVariantId)) {
      setForm((f) => ({ ...f, defaultVariantId: f.variants[0]?.id ?? '' }));
    }
  }, [form.hasVariants, form.variants, form.defaultVariantId]);

  const createMutation = useMutation({
    mutationFn: (data) => createProduct(data)
  });

  const updateMutation = useMutation({
    mutationFn: ({ id: productId, data }) => updateProduct(productId, data)
  });

  const categories = categoriesData ?? [];
  const collectionsList = collectionsData ?? [];
  const brandsList = brandsData ?? [];
  const saving = createMutation.isPending || updateMutation.isPending;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaveStatus('loading');
    createMutation.reset();
    updateMutation.reset();

    const currentForm = formRef.current;

    if (!currentForm.isComboProduct && currentForm.hasVariants) {
      if (!currentForm.variants?.length) {
        setSaveStatus(null);
        alert('Añade al menos una variante.');
        return;
      }
      const invalid = currentForm.variants.some((v) => !(v.name?.trim() && v.imageUrl?.trim()));
      if (invalid) {
        setSaveStatus(null);
        alert('Cada variante debe tener nombre e imagen.');
        return;
      }
    }

    const savedInStock = Number.isNaN(parseInt(currentForm.inStock, 10)) ? 0 : parseInt(currentForm.inStock, 10);
    if (savedInStock === 0) {
      const msg = 'Este producto se guardará con stock 0. En la tienda aparecerá como "Agotado" y los clientes no podrán agregarlo al carrito.\n\n¿Deseas continuar?';
      if (!window.confirm(msg)) {
        setSaveStatus(null);
        return;
      }
    }
    let finalComboPreviewImage = currentForm.comboPreviewImage || '';

    // Combo personalizable: intentar generar miniatura con diseño y subir a Storage
    // Estrategia de retry: 1) triggerComboCaptureRef, 2) generar por item con generateThumbnailWithDesign
    if (
      currentForm.isComboProduct &&
      currentForm.customizable &&
      Array.isArray(currentForm.comboItems) &&
      currentForm.comboItems.length > 0
    ) {
      let capturedDataUrl = null;

      try {
        const { composeComboImage, loadImageAsFabricCanvas } = await import('../../utils/comboImageComposer');
        const canvases = [];

        for (let i = 0; i < currentForm.comboItems.length; i++) {
          const item = currentForm.comboItems[i];
          const cust = (currentForm.comboItemCustomization || [])[i] || {};
          const color = item.variantMapping?.color || 'default';
          const layers = cust.initialLayersByColor?.[color] || cust.initialLayersByColor?.default || [];

          // Obtener URL de imagen del producto base
          let baseImageUrl = '';
          try {
            const { data: prod } = await getProduct(item.productId);
            if (prod) {
              const variant = color && color !== 'default'
                ? prod.variants?.find(v => v.name === color)
                : prod.variants?.find(v => v.id === prod.defaultVariantId) || prod.variants?.[0];
              baseImageUrl = variant?.imageUrl || prod.mainImage || prod.images?.[0] || '';
            }
          } catch { /* ignorar */ }

          if (!baseImageUrl) continue;

          // Generar la previsualización nativa perfecta usando Fabric
          const singleDataUrl = await generateThumbnailWithDesign(baseImageUrl, layers, { maxWidth: 600 });
          if (singleDataUrl) {
            const itemScale = item?.scale || 1;
            const { canvas } = await loadImageAsFabricCanvas(singleDataUrl, itemScale);
            canvases.push({ canvas, scale: itemScale });
          }
        }

        if (canvases.length > 0) {
          capturedDataUrl = await composeComboImage(canvases, currentForm.comboLayout);
          console.log(`[Combo Captura] ✅ Miniatura generada nativamente (len=${capturedDataUrl?.length})`);
        }
      } catch (err) {
        console.warn('[Combo Captura] Error generando miniatura activa:', err?.message, err);
      }

      // Subir resultado a Firebase Storage
      if (capturedDataUrl && typeof capturedDataUrl === 'string' && capturedDataUrl.trim().startsWith('data:')) {
        console.log(`[Combo Upload] Subiendo miniatura (${capturedDataUrl.length} chars)...`);
        try {
          const timestamp = Date.now();
          const path = `productos_wala/combos/${id || 'new_' + timestamp}_preview_${timestamp}.webp`;
          const { url } = await uploadFromDataUrl(capturedDataUrl, path);
          if (url) {
            try {
              const u = new URL(url);
              u.searchParams.set('v', timestamp);
              finalComboPreviewImage = u.toString();
            } catch (e) {
              finalComboPreviewImage = url;
            }
            console.log(`[Combo Upload] ✅ Miniatura subida: ${finalComboPreviewImage.substring(0, 80)}...`);
          } else {
            console.warn('[Combo Upload] ❌ uploadFromDataUrl devolvió url vacía');
          }
        } catch (uploadErr) {
          console.warn('[Combo Upload] ❌ Error subiendo miniatura del combo:', uploadErr?.message);
        }
      } else {
        console.warn(`[Combo Upload] ❌ capturedDataUrl inválido (tipo: ${typeof capturedDataUrl}, starts: ${capturedDataUrl?.substring?.(0, 20)})`);
      }

      // Si no se pudo generar ni subir, advertir al usuario (pero no bloquear guardado)
      if (!finalComboPreviewImage && (typeof currentForm.comboPreviewImage !== 'string' || !currentForm.comboPreviewImage.trim())) {
        console.info(
          'No se pudo generar la miniatura del combo. Los diseños se renderizarán client-side en la tienda.'
        );
      }
    }

    const payload = {
      ...currentForm,
      name: (currentForm.name || '').trim() || (currentForm.isComboProduct ? 'Combo' : 'Sin nombre'),
      whatsappEnabled: currentForm.whatsappEnabled !== false,
      whatsappNumber: String(currentForm.whatsappNumber || '').trim(),
      whatsappMessage: String(currentForm.whatsappMessage || '').trim(),
      visible: currentForm.visible !== false,
      collections: Array.isArray(currentForm.collections) ? currentForm.collections : [],
      brandId: currentForm.brandId || '',
      hasVariants: Array.isArray(currentForm.variants) && currentForm.variants.length > 0,
      price: parseFloat(currentForm.price) || 0,
      salePrice: currentForm.salePrice ? parseFloat(currentForm.salePrice) : null,
      inStock: savedInStock,
      ...(currentForm.isComboProduct && finalComboPreviewImage && !String(finalComboPreviewImage).trim().startsWith('data:')
        ? { comboPreviewImage: String(finalComboPreviewImage).trim() }
        : {}),
      ...(currentForm.isComboProduct && Array.isArray(currentForm.comboItemCustomization) && {
        comboItemCustomization: currentForm.comboItemCustomization.map((c) => ({
          productId: String(c.productId || ''),
          viewId: String(c.viewId || ''),
          printAreas: Array.isArray(c.printAreas) ? c.printAreas.map((a) => ({
            id: a.id,
            shape: a.shape || 'rectangle',
            x: Number(a.x) ?? 10,
            y: Number(a.y) ?? 10,
            width: Number(a.width) ?? 80,
            height: Number(a.height) ?? 80,
            rotation: Number(a.rotation) ?? 0,
            skewX: Number(a.skewX) ?? 0,
            skewY: Number(a.skewY) ?? 0,
            ...(a.customShapeId && { customShapeId: String(a.customShapeId) }),
            ...(a.freeDrawPath && { freeDrawPath: String(a.freeDrawPath) })
          })) : [],
          initialLayersByColor: c.initialLayersByColor && typeof c.initialLayersByColor === 'object' ? c.initialLayersByColor : { default: [] },
          backSide: c.backSide && typeof c.backSide === 'object' ? {
            ...(c.backSide),
            printAreas: Array.isArray(c.backSide.printAreas) ? c.backSide.printAreas.map((a) => ({
              id: a.id,
              shape: a.shape || 'rectangle',
              x: Number(a.x) ?? 10,
              y: Number(a.y) ?? 10,
              width: Number(a.width) ?? 80,
              height: Number(a.height) ?? 80,
              rotation: Number(a.rotation) ?? 0,
              skewX: Number(a.skewX) ?? 0,
              skewY: Number(a.skewY) ?? 0,
              ...(a.customShapeId && { customShapeId: String(a.customShapeId) }),
              ...(a.freeDrawPath && { freeDrawPath: String(a.freeDrawPath) })
            })) : [],
            initialLayersByColor: c.backSide.initialLayersByColor && typeof c.backSide.initialLayersByColor === 'object' ? c.backSide.initialLayersByColor : { default: [] }
          } : undefined
        }))
      }),
      featuredOrder: parseInt(currentForm.featuredOrder, 10) || 0,
      // Asegurar explícitamente que customizationViews se incluye con todas las actualizaciones
      customizationViews: Array.isArray(currentForm.customizationViews)
        ? currentForm.customizationViews.map(v => ({
            id: v.id,
            name: v.name || 'Vista',
            printAreas: Array.isArray(v.printAreas) ? v.printAreas.map(area => ({
              id: area.id,
              shape: area.shape || 'rectangle',
              x: Number(area.x) ?? 10,
              y: Number(area.y) ?? 10,
              width: Number(area.width) ?? 80,
              height: Number(area.height) ?? 80,
              rotation: Number(area.rotation) ?? 0,
              skewX: Number(area.skewX) ?? 0,
              skewY: Number(area.skewY) ?? 0,
              ...(area.customShapeId && { customShapeId: String(area.customShapeId) }),
              ...(area.freeDrawPath && { freeDrawPath: String(area.freeDrawPath) })
            })) : [],
            imagesByColor: v.imagesByColor && typeof v.imagesByColor === 'object' ? v.imagesByColor : { default: '' },
            initialLayersByColor: v.initialLayersByColor && typeof v.initialLayersByColor === 'object'
              ? v.initialLayersByColor
              : { default: [] },
            hasBackSide: Boolean(v.hasBackSide),
            ...(v.hasBackSide && v.backSide ? {
              backSide: {
                id: v.backSide.id,
                name: v.backSide.name || 'Espalda',
                printAreas: Array.isArray(v.backSide.printAreas) ? v.backSide.printAreas.map(area => ({
                  id: area.id,
                  shape: area.shape || 'rectangle',
                  x: Number(area.x) ?? 10,
                  y: Number(area.y) ?? 10,
                  width: Number(area.width) ?? 80,
                  height: Number(area.height) ?? 80,
                  rotation: Number(area.rotation) ?? 0,
                  skewX: Number(area.skewX) ?? 0,
                  skewY: Number(area.skewY) ?? 0
                })) : [],
                imagesByColor: v.backSide.imagesByColor && typeof v.backSide.imagesByColor === 'object'
                  ? v.backSide.imagesByColor
                  : { default: '' },
                initialLayersByColor: v.backSide.initialLayersByColor && typeof v.backSide.initialLayersByColor === 'object'
                  ? v.backSide.initialLayersByColor
                  : { default: [] }
              }
            } : {})
          }))
        : []
    };

    // Añadir a productCliparts las URLs de imagen usadas en las capas (para que admin y usuarios puedan reutilizarlas)
    const collectedImageUrls = new Set();
    (payload.customizationViews || []).forEach((v) => {
      if (!v.initialLayersByColor || typeof v.initialLayersByColor !== 'object') return;
      Object.values(v.initialLayersByColor).forEach((arr) => {
        (Array.isArray(arr) ? arr : []).forEach((l) => {
          if (l?.type === 'image' && l.src && typeof l.src === 'string') {
            const s = l.src.trim();
            if (s && !s.toLowerCase().startsWith('blob:') && !s.toLowerCase().startsWith('data:')) collectedImageUrls.add(s);
          }
        });
      });
      // También recolectar imágenes de backSide
      if (v.hasBackSide && v.backSide && v.backSide.initialLayersByColor) {
        Object.values(v.backSide.initialLayersByColor).forEach((arr) => {
          (Array.isArray(arr) ? arr : []).forEach((l) => {
            if (l?.type === 'image' && l.src && typeof l.src === 'string') {
              const s = l.src.trim();
              if (s && !s.toLowerCase().startsWith('blob:') && !s.toLowerCase().startsWith('data:')) collectedImageUrls.add(s);
            }
          });
        });
      }
    });
    (payload.comboItemCustomization || []).forEach((c) => {
      if (!c.initialLayersByColor || typeof c.initialLayersByColor !== 'object') return;
      Object.values(c.initialLayersByColor).forEach((arr) => {
        (Array.isArray(arr) ? arr : []).forEach((l) => {
          if (l?.type === 'image' && l.src && typeof l.src === 'string') {
            const s = l.src.trim();
            if (s && !s.toLowerCase().startsWith('blob:') && !s.toLowerCase().startsWith('data:')) collectedImageUrls.add(s);
          }
        });
      });
    });
    const existingClipartUrls = new Set((payload.productCliparts || []).map((c) => c?.url).filter(Boolean));
    const newUrls = [...collectedImageUrls].filter((u) => !existingClipartUrls.has(u));
    if (newUrls.length > 0) {
      const existing = payload.productCliparts || [];
      const added = newUrls.map((url, i) => ({
        id: `clipart_${Date.now()}_${i}`,
        name: `Imagen ${existing.length + i + 1}`,
        url
      }));
      payload.productCliparts = [...existing, ...added];
    }

    // Miniatura con diseño: generar imagen compuesta (variante principal + capas) y subir
    if (
      !currentForm.isComboProduct &&
      currentForm.hasVariants &&
      Array.isArray(currentForm.variants) &&
      currentForm.variants.length > 0 &&
      currentForm.defaultVariantId &&
      Array.isArray(currentForm.customizationViews) &&
      currentForm.customizationViews.length > 0
    ) {
      const defaultVariant =
        currentForm.variants.find((v) => String(v.id) === String(currentForm.defaultVariantId)) ||
        currentForm.variants[0];
      const baseImageUrl = defaultVariant?.imageUrl?.trim();
      const firstView = currentForm.customizationViews[0];
      const variantName = defaultVariant?.name;
      const layers =
        (firstView.initialLayersByColor && variantName && firstView.initialLayersByColor[variantName]) ||
        firstView.initialLayersByColor?.default ||
        [];
      const hasDesignLayers = layers.length > 0;

      if (baseImageUrl) {
        // Si la imagen es de Firebase Storage y no hay capas de diseño,
        // usar la URL directa como miniatura (evita fallo de CORS en canvas)
        const isFirebase = baseImageUrl.includes('firebasestorage.googleapis.com');
        if (isFirebase && !hasDesignLayers) {
          // La imagen ya está en Firebase - usarla directamente como thumbnail
          payload.thumbnailWithDesignUrl = baseImageUrl;
        } else {
          // Intentar generar miniatura compuesta desde canvas
          try {
            const dataUrl = await generateThumbnailWithDesign(baseImageUrl, layers);
            const path = `productos_wala/thumbnails/${id || 'new_' + Date.now()}_thumbnail.png`;
            const { url: thumbUrl } = await uploadFromDataUrl(dataUrl, path);
            if (thumbUrl) payload.thumbnailWithDesignUrl = thumbUrl;
          } catch (err) {
            console.warn('No se pudo generar miniatura con diseño (p. ej. CORS):', err);
            // Fallback: usar la URL de la imagen directamente (garantiza que se actualice la miniatura)
            if (baseImageUrl) payload.thumbnailWithDesignUrl = baseImageUrl;
          }
        }
      }
    }


    try {
      if (isNew) {
        await createMutation.mutateAsync(payload);
      } else {
        await updateMutation.mutateAsync({ id, data: payload });
      }
      await queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      await queryClient.invalidateQueries({ queryKey: ['products'] });
      await queryClient.invalidateQueries({ queryKey: ['admin-product', id] });
      await queryClient.invalidateQueries({ queryKey: ['featured-products'] });
      await queryClient.invalidateQueries({ queryKey: ['collection-products'] });
      setSaveStatus('success');
      setTimeout(() => navigate('/admin/productos'), 1200);
    } catch (error) {
      console.error('Error al guardar producto:', error);
      setSaveStatus('error');
    }
  };

  const addVariant = () => {
    const newIndex = form.variants.length;
    setForm((f) => ({
      ...f,
      hasVariants: true,
      variants: [...f.variants, createDefaultVariant()]
    }));
    setEditingVariantIndex(newIndex);
    setVariantModalOpen(true);
  };

  const removeVariant = (index) => {
    setForm((f) => {
      const next = f.variants.filter((_, i) => i !== index);
      return { ...f, hasVariants: next.length > 0, variants: next };
    });
  };

  const openEditVariant = (index) => {
    setEditingVariantIndex(index);
    setVariantModalOpen(true);
  };

  const saveVariantFromModal = (variantData) => {
    const idx = editingVariantIndexRef.current;
    if (idx === null || idx === undefined || idx < 0) return;
    setForm((f) => {
      const next = [...f.variants];
      if (idx >= next.length) return f;
      next[idx] = { ...next[idx], ...variantData };
      return { ...f, variants: next };
    });
    setVariantModalOpen(false);
    setEditingVariantIndex(null);
  };

  const addCustomizationView = () => {
    const viewId = `view_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const imagesByColor = { default: form.hasVariants ? (form.variants[0]?.imageUrl || '') : form.mainImage || '' };
    if (form.hasVariants && form.variants.length > 0) {
      form.variants.forEach((v) => { imagesByColor[v.name] = v.imageUrl || ''; });
    }
    const initialLayersByColor = { default: [] };
    if (form.hasVariants && form.variants.length > 0) {
      form.variants.forEach((v) => { initialLayersByColor[v.name] = []; });
    }
    setForm((f) => ({
      ...f,
      customizationViews: [
        ...f.customizationViews,
        { id: viewId, name: `Vista ${f.customizationViews.length + 1}`, printAreas: defaultPrintAreas(), imagesByColor, initialLayersByColor }
      ]
    }));
  };

  const updateCustomizationView = (viewIndex, updates) => {
    setForm((f) => {
      const updatedViews = f.customizationViews.map((v, i) => {
        if (i === viewIndex) {
          // Merge profundo para asegurar que se preserven todas las propiedades
          const updated = { ...v, ...updates };
          // Si se actualiza imagesByColor, fusionar con el actual
          if (updates.imagesByColor && typeof updates.imagesByColor === 'object') {
            updated.imagesByColor = { ...(v.imagesByColor || {}), ...updates.imagesByColor };
          }
          // Si se actualiza printAreas, asegurar que todas las propiedades se preserven
          if (updates.printAreas && Array.isArray(updates.printAreas)) {
            updated.printAreas = updates.printAreas.map(area => ({
              id: area.id || `zone_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
              shape: area.shape || 'rectangle',
              x: Number(area.x) ?? 10,
              y: Number(area.y) ?? 10,
              width: Number(area.width) ?? 80,
              height: Number(area.height) ?? 80,
              rotation: Number(area.rotation) ?? 0,
              skewX: Number(area.skewX) ?? 0,
              skewY: Number(area.skewY) ?? 0,
              ...(area.customShapeId && { customShapeId: String(area.customShapeId) }),
              ...(area.freeDrawPath && { freeDrawPath: String(area.freeDrawPath) })
            }));
          }
          // Si se actualiza initialLayersByColor, asegurar que sea un objeto válido
          if (updates.initialLayersByColor && typeof updates.initialLayersByColor === 'object') {
            updated.initialLayersByColor = { ...(v.initialLayersByColor || {}), ...updates.initialLayersByColor };
          }
          // Si se actualiza backSide, fusionar con el actual
          if (updates.backSide !== undefined) {
            if (updates.backSide === null) {
              updated.backSide = null;
            } else if (updates.backSide && typeof updates.backSide === 'object') {
              updated.backSide = {
                ...(v.backSide || {}),
                ...updates.backSide,
                // Merge profundo de imagesByColor y initialLayersByColor
                imagesByColor: updates.backSide.imagesByColor
                  ? { ...(v.backSide?.imagesByColor || {}), ...updates.backSide.imagesByColor }
                  : (v.backSide?.imagesByColor || {}),
                initialLayersByColor: updates.backSide.initialLayersByColor
                  ? { ...(v.backSide?.initialLayersByColor || {}), ...updates.backSide.initialLayersByColor }
                  : (v.backSide?.initialLayersByColor || {}),
                printAreas: updates.backSide.printAreas
                  ? updates.backSide.printAreas.map(area => ({
                      id: area.id || `zone_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
                      shape: area.shape || 'rectangle',
                      x: Number(area.x) ?? 10,
                      y: Number(area.y) ?? 10,
                      width: Number(area.width) ?? 80,
                      height: Number(area.height) ?? 80,
                      rotation: Number(area.rotation) ?? 0,
                      skewX: Number(area.skewX) ?? 0,
                      skewY: Number(area.skewY) ?? 0
                    }))
                  : (v.backSide?.printAreas || [])
              };
            }
          }
          return updated;
        }
        return v;
      });
      return { ...f, customizationViews: updatedViews };
    });
  };

  const setViewImageForColor = (viewIndex, colorKey, url) => {
    setForm((f) => {
      const views = [...f.customizationViews];
      const view = { ...views[viewIndex], imagesByColor: { ...views[viewIndex].imagesByColor, [colorKey]: url } };
      views[viewIndex] = view;
      return { ...f, customizationViews: views };
    });
  };

  const removeCustomizationView = (viewIndex) => {
    setForm((f) => ({
      ...f,
      customizationViews: f.customizationViews.filter((_, i) => i !== viewIndex)
    }));
  };

  const clipartFileRef = useRef(null);
  const [clipartUploading, setClipartUploading] = useState(false);
  const viewImageRefs = useRef({});

  const handleClipartUpload = async (e) => {
    const file = e?.target?.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    setClipartUploading(true);
    try {
      const path = `productos_wala/${id || 'new'}/cliparts/${Date.now()}_${file.name}`;
      const { url, error } = await uploadFile(file, path);
      if (url && !error) {
        setForm((f) => ({
          ...f,
          productCliparts: [...f.productCliparts, { id: `clipart_${Date.now()}`, name: file.name.replace(/\.[^.]+$/, ''), url }]
        }));
      }
    } finally {
      setClipartUploading(false);
      if (clipartFileRef.current) clipartFileRef.current.value = '';
    }
  };

  const handleViewImageUpload = async (viewIndex, colorKey, file) => {
    if (!file || !file.type.startsWith('image/')) return;
    const path = `productos_wala/${id || 'new'}/views/${Date.now()}_${file.name}`;
    const { url, error } = await uploadFile(file, path);
    if (url && !error) setViewImageForColor(viewIndex, colorKey, url);
    const refKey = `${viewIndex}_${colorKey}`;
    if (viewImageRefs.current[refKey]) viewImageRefs.current[refKey].value = '';
  };

  const viewImageUrlInputKey = (viewIndex, colorKey) => `${viewIndex}_${colorKey}`;
  const applyViewImageUrl = (viewIndex, colorKey) => {
    const key = viewImageUrlInputKey(viewIndex, colorKey);
    const raw = (viewImageUrlInputs[key] ?? '').trim();
    if (!raw) return;
    setViewImageForColor(viewIndex, colorKey, toDirectImageUrl(raw));
    setViewImageUrlInputs((prev) => ({ ...prev, [key]: '' }));
  };

  const handleViewImageUploadBackSide = async (viewIndex, colorKey, file) => {
    if (!file || !file.type.startsWith('image/')) return;
    const path = `productos_wala/${id || 'new'}/views/${Date.now()}_${file.name}`;
    const { url, error } = await uploadFile(file, path);
    if (url && !error) {
      setForm((f) => {
        const view = f.customizationViews[viewIndex];
        if (!view || !view.backSide) return f;
        const updatedViews = [...f.customizationViews];
        updatedViews[viewIndex] = {
          ...view,
          backSide: {
            ...view.backSide,
            imagesByColor: { ...view.backSide.imagesByColor, [colorKey]: url }
          }
        };
        return { ...f, customizationViews: updatedViews };
      });
    }
    const refKey = `${viewIndex}_back_${colorKey}`;
    if (viewImageRefs.current[refKey]) viewImageRefs.current[refKey].value = '';
  };

  const applyViewImageUrlBackSide = (viewIndex, colorKey) => {
    const key = `${viewIndex}_back_${colorKey}`;
    const raw = (viewImageUrlInputs[key] ?? '').trim();
    if (!raw) return;
    setForm((f) => {
      const view = f.customizationViews[viewIndex];
      if (!view || !view.backSide) return f;
      const updatedViews = [...f.customizationViews];
      updatedViews[viewIndex] = {
        ...view,
        backSide: {
          ...view.backSide,
          imagesByColor: { ...view.backSide.imagesByColor, [colorKey]: toDirectImageUrl(raw) }
        }
      };
      return { ...f, customizationViews: updatedViews };
    });
    setViewImageUrlInputs((prev) => ({ ...prev, [key]: '' }));
  };

  const removeProductClipart = (index) => {
    setForm((f) => ({ ...f, productCliparts: f.productCliparts.filter((_, i) => i !== index) }));
  };


  const handleAddClipartFromUrl = () => {
    const url = clipartUrlInput.trim();
    if (!url) return;
    const directUrl = toDirectImageUrl(url);
    setForm((f) => ({
      ...f,
      productCliparts: [...f.productCliparts, { id: `clipart_${Date.now()}`, name: url.split('/').pop() || 'Clipart', url: directUrl }]
    }));
    setClipartUrlInput('');
  };

  const handleAddComboItem = (item) => {
    setForm((f) => {
      const newItems = [...(f.comboItems || []), { ...item, position: f.comboItems.length }];
      return { ...f, comboItems: newItems };
    });
  };

  const handleUpdateComboItems = (newItems) => {
    setForm((f) => ({ ...f, comboItems: newItems }));
  };

  const handleComboLayoutChange = (updates) => {
    setForm((f) => ({
      ...f,
      comboLayout: { ...f.comboLayout, ...updates }
    }));
  };

  if (!isNew && loadingProduct) {
    return <p className={styles.loading}>Cargando producto...</p>;
  }

  return (
    <div className={styles.wrapper}>
      <h1 className={styles.title}>{isNew ? 'Nuevo producto' : 'Editar producto'}</h1>

      <div className={styles.form}>
        {/* Sección 1: Información del Producto */}
        <AccordionSection title="Información del Producto" defaultExpanded={true}>
          <div className={styles.infoSubsection}>
            <h4 className={styles.sectionTitle}>Datos básicos</h4>
            <div className={styles.field}>
              <label htmlFor="name">Nombre *</label>
              <input
                id="name"
                type="text"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                required
                className={styles.input}
              />
            </div>
            
          </div>

          <div className={styles.infoSubsection}>
            <h4 className={styles.sectionTitle}>Organización del Producto</h4>
            
            {/* MARCAS */}
            <div className={styles.field} style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                <h5 style={{ margin: 0 }}>Marca (Principal)</h5>
                <Button size="small" variant="secondary" onClick={() => setQuickAddModal({ isOpen: true, type: 'brand' })}>+ Nueva Marca</Button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))', gap: '10px' }}>
                {brandsList.map((b) => (
                  <div 
                    key={b.id} 
                    onClick={() => setForm(f => ({ ...f, brandId: f.brandId === b.id ? '' : b.id }))}
                    style={{
                      border: form.brandId === b.id ? '2px solid #6366f1' : '1px solid #ddd',
                      borderRadius: '8px',
                      padding: '8px',
                      cursor: 'pointer',
                      textAlign: 'center',
                      background: form.brandId === b.id ? '#e0e7ff' : '#fff'
                    }}
                  >
                    {b.imageUrl ? (
                      <img src={b.imageUrl} alt={b.name} style={{ width: '100%', height: '50px', objectFit: 'contain', marginBottom: '5px' }} />
                    ) : (
                      <div style={{ width: '100%', height: '50px', background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '5px', borderRadius: '4px' }}>
                         <span style={{ fontSize: '10px', color: '#999' }}>Sin logo</span>
                      </div>
                    )}
                    <div style={{ fontSize: '11px', fontWeight: '500', wordBreak: 'break-word', lineHeight: '1.2' }}>{b.name}</div>
                  </div>
                ))}
              </div>
              {brandsList.length === 0 && <p className={styles.sectionHint}>No hay marcas. Haz clic en + Nueva Marca.</p>}
            </div>

            {/* TIPO DE PRODUCTO */}
            <div className={styles.field} style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '5px' }}>
                <label style={{ margin: 0, fontWeight: 'bold' }}>Tipo de Producto</label>
                <Button size="small" variant="secondary" onClick={() => setQuickAddModal({ isOpen: true, type: 'productType' })}>+ Nuevo Tipo</Button>
              </div>
              <select 
                value={form.productType || ''} 
                onChange={(e) => setForm(f => ({ ...f, productType: e.target.value }))}
                className={styles.input}
              >
                <option value="">Selecciona un tipo...</option>
                {(productTypesData || []).map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>

            <div className={styles.row}>
              {/* CATEGORIES */}
              <div className={styles.field} style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <h5 style={{ margin: 0 }}>Categorías</h5>
                  <Button size="small" variant="secondary" onClick={() => setQuickAddModal({ isOpen: true, type: 'category' })}>+ Nueva</Button>
                </div>
                <div className={styles.categoryCheckboxes}>
                  {categories.map((c) => (
                    <label key={c.id} className={styles.checkLabel}>
                      <input
                        type="checkbox"
                        checked={form.categories.includes(c.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setForm((f) => ({ ...f, categories: [...f.categories, c.id] }));
                          } else {
                            setForm((f) => ({ ...f, categories: f.categories.filter((id) => id !== c.id) }));
                          }
                        }}
                      />
                      {c.name}
                    </label>
                  ))}
                </div>
              </div>

              {/* COLLECTIONS */}
              <div className={styles.field} style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <h5 style={{ margin: 0 }}>Colecciones</h5>
                  <Button size="small" variant="secondary" onClick={() => setQuickAddModal({ isOpen: true, type: 'collection' })}>+ Nueva</Button>
                </div>
                <div className={styles.categoryCheckboxes}>
                  {collectionsList.map((c) => (
                    <label key={c.id} className={styles.checkLabel}>
                      <input
                        type="checkbox"
                        checked={form.collections.includes(c.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setForm((f) => ({ ...f, collections: [...f.collections, c.id] }));
                          } else {
                            setForm((f) => ({ ...f, collections: f.collections.filter((id) => id !== c.id) }));
                          }
                        }}
                      />
                      {c.name}
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className={styles.row}>
              {/* PERSONAJES */}
              <div className={styles.field} style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <h5 style={{ margin: 0 }}>Personajes</h5>
                  <Button size="small" variant="secondary" onClick={() => setQuickAddModal({ isOpen: true, type: 'character' })}>+ Nuevo</Button>
                </div>
                <div className={styles.categoryCheckboxes}>
                  {(charactersData || []).map((c) => (
                    <label key={c.id} className={styles.checkLabel}>
                      <input
                        type="checkbox"
                        checked={form.characters.includes(c.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setForm((f) => ({ ...f, characters: [...f.characters, c.id] }));
                          } else {
                            setForm((f) => ({ ...f, characters: f.characters.filter((id) => id !== c.id) }));
                          }
                        }}
                      />
                      {c.name}
                    </label>
                  ))}
                </div>
              </div>

              {/* ETIQUETAS */}
              <div className={styles.field} style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <h5 style={{ margin: 0 }}>Etiquetas (Tags)</h5>
                  <Button size="small" variant="secondary" onClick={() => setQuickAddModal({ isOpen: true, type: 'tag' })}>+ Nueva</Button>
                </div>
                <div className={styles.categoryCheckboxes}>
                  {(tagsData || []).map((t) => (
                    <label key={t.id} className={styles.checkLabel}>
                      <input
                        type="checkbox"
                        checked={form.tags.includes(t.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setForm((f) => ({ ...f, tags: [...f.tags, t.id] }));
                          } else {
                            setForm((f) => ({ ...f, tags: f.tags.filter((id) => id !== t.id) }));
                          }
                        }}
                      />
                      {t.name}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className={styles.infoSubsection}>
            <h4 className={styles.sectionTitle}>Precios e Inventario</h4>
            <div className={styles.row}>
              <div className={styles.field}>
                <label htmlFor="price">Precio Regular (S/) *</label>
                <input
                  id="price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.price}
                  onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                  required
                  className={styles.input}
                />
              </div>
              <div className={styles.field}>
                <label htmlFor="salePrice">Precio Oferta (S/)</label>
                <input
                  id="salePrice"
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.salePrice}
                  onChange={(e) => setForm((f) => ({ ...f, salePrice: e.target.value }))}
                  className={styles.input}
                  placeholder="Opcional"
                />
              </div>
              <div className={styles.field}>
                <label htmlFor="inStock">Inventario (Unidades)</label>
                <input
                  id="inStock"
                  type="number"
                  min="0"
                  value={form.inStock}
                  onChange={(e) => setForm((f) => ({ ...f, inStock: e.target.value }))}
                  className={styles.input}
                />
              </div>
            </div>
            {form.salePrice && parseFloat(form.salePrice) >= parseFloat(form.price || 0) && (
              <p className={styles.sectionHint} style={{ color: '#d32f2f', fontSize: '0.8125rem' }}>
                El precio de oferta debe ser menor que el precio regular.
              </p>
            )}
          </div>

          <div className={styles.infoSubsection}>
            <h4 className={styles.sectionTitle}>Identificación del Producto</h4>
            <div className={styles.row}>
              <div className={styles.field}>
                <label htmlFor="sku">SKU (Código Interno)</label>
                <input
                  id="sku"
                  type="text"
                  value={form.sku || ''}
                  onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))}
                  className={styles.input}
                  placeholder="Ej: POL-ANI-001"
                />
              </div>
              <div className={styles.field} style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <h5 style={{ margin: 0 }}>Empresa / Proveedor</h5>
                  <Button size="small" variant="secondary" onClick={() => setQuickAddModal({ isOpen: true, type: 'vendor' })}>+ Nuevo</Button>
                </div>
                <div className={styles.categoryCheckboxes}>
                  {(vendorsData || []).map((v) => (
                    <label key={v.id} className={styles.checkLabel}>
                      <input
                        type="checkbox"
                        checked={form.vendors?.includes(v.id) || false}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setForm((f) => ({ ...f, vendors: [...(f.vendors || []), v.id] }));
                          } else {
                            setForm((f) => ({ ...f, vendors: (f.vendors || []).filter((id) => id !== v.id) }));
                          }
                        }}
                      />
                      {v.name}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className={styles.infoSubsection}>
            <h4 className={styles.sectionTitle}>Descripción</h4>
            <div className={styles.field} style={{ position: 'relative' }} onClickCapture={(e) => {
              const buttonEl = e.target.closest('a.custom-quill-button');
              if (buttonEl) {
                e.preventDefault();
                e.stopPropagation();
                if (quillRef.current) {
                  const quill = quillRef.current.getEditor();
                  const blot = ReactQuill.Quill.find(buttonEl);
                  if (blot) {
                    setButtonModalState({
                      open: true,
                      index: null,
                      blot: blot,
                      initialData: blot.value()
                    });
                  }
                }
              }
            }}>
              <ReactQuill
                ref={quillRef}
                theme="snow"
                value={form.description}
                onChange={(content) => setForm((f) => ({ ...f, description: content }))}
                modules={quillModules}
                className={styles.quillContainer}
              />
              {/* Toolbar extra: botones personalizados fuera de Quill */}
              <div className={styles.customQuillToolbar}>
                <button
                  type="button"
                  className={styles.customToolbarBtnDivider}
                  onClick={dividerHandler}
                  title="Insertar línea divisora"
                >
                  ➖ Línea
                </button>
                <button
                  type="button"
                  className={styles.customToolbarBtnAction}
                  onClick={buttonHandler}
                  title="Añadir Botón (WhatsApp/Enlace)"
                >
                  + Botón
                </button>
                <button
                  type="button"
                  className={styles.customToolbarBtnTemplate}
                  onClick={templateHandler}
                  title="Insertar bloque preconstruido"
                >
                  📑 Plantilla
                </button>
              </div>
            </div>
          </div>
        </AccordionSection>

        {cropImageObj && (
          <AdminImageCropper
            imageSrc={cropImageObj.src}
            onCropComplete={handleCropComplete}
            onCancel={() => setCropImageObj(null)}
          />
        )}

        <AdminButtonModal
           isOpen={buttonModalState.open}
           onClose={() => setButtonModalState({ open: false, index: null, blot: null, initialData: null })}
           onInsert={handleButtonInsert}
           defaultNumber={form.whatsappNumber}
           initialData={buttonModalState.initialData}
        />

        <AdminTemplateModal
           isOpen={templateModalOpen}
           onClose={() => setTemplateModalOpen(false)}
           onInsert={handleTemplateInsert}
        />

        <VariantEditModal
          isOpen={variantModalOpen}
          variant={editingVariantIndex !== null ? form.variants[editingVariantIndex] : null}
          onSave={saveVariantFromModal}
          onClose={() => { setVariantModalOpen(false); setEditingVariantIndex(null); }}
        />

        <AccordionSection
          title="Configuración de WhatsApp"
          defaultExpanded={false}
          headerLeft={
            <Toggle
              size="small"
              checked={form.whatsappEnabled}
              onChange={(enabled) => setForm((f) => ({ ...f, whatsappEnabled: enabled }))}
              aria-label="Activar botón de WhatsApp"
            />
          }
        >
          <p className={styles.sectionHint} style={{ marginTop: 0 }}>
            Configura el comportamiento del botón flotante de WhatsApp.
          </p>

          <div className={styles.infoSubsection}>
            <div className={styles.row}>
              <div className={styles.field} style={{ flex: '1' }}>
                <label htmlFor="whatsappNumber">Número de WhatsApp</label>
                <input
                  id="whatsappNumber"
                  type="text"
                  value={form.whatsappNumber}
                  onChange={(e) => setForm((f) => ({ ...f, whatsappNumber: e.target.value }))}
                  className={styles.input}
                  placeholder="+51912881722"
                />
                <span className={styles.fieldHint} style={{ fontSize: '0.8rem', color: '#666', marginTop: '4px', display: 'block' }}>
                  A este número se enviarán los mensajes cuando el cliente presione el botón en este producto.
                </span>
              </div>
            </div>

            <div className={styles.field} style={{ marginTop: '1rem' }}>
              <label htmlFor="whatsappMessage">Mensaje personalizado</label>
              <textarea
                id="whatsappMessage"
                value={form.whatsappMessage}
                onChange={(e) => setForm((f) => ({ ...f, whatsappMessage: e.target.value }))}
                className={styles.input}
                rows={3}
                placeholder="Ejemplo: Hola CON AMOR: Me interesa este producto de tu página: {url}"
                style={{ resize: 'vertical' }}
              />
              <span className={styles.fieldHint} style={{ fontSize: '0.8rem', color: '#666', marginTop: '4px', display: 'block' }}>
                Usa <strong>{'{url}'}</strong> para insertar automáticamente el enlace de este producto.
              </span>
            </div>
          </div>
        </AccordionSection>

        {/* Sección 2: Producto Combo (siempre justo después de Información del Producto) */}
        <AccordionSection
          title="Producto Combo"
          defaultExpanded={false}
          headerLeft={
            <Toggle
              size="small"
              checked={form.isComboProduct}
              onChange={(isCombo) => {
                setForm((f) => ({
                  ...f,
                  isComboProduct: isCombo,
                  comboItems: isCombo ? (f.comboItems || []) : [],
                  comboLayout: isCombo ? (f.comboLayout || { orientation: 'horizontal', spacing: 20 }) : { orientation: 'horizontal', spacing: 20 }
                }));
              }}
              aria-label="Activar producto combo"
            />
          }
        >
          <p className={styles.sectionHint} style={{ marginTop: 0 }}>
            Un producto combo muestra la unión de los productos que elijas aquí; no hace falta configurar «Imágenes y variantes» arriba. La miniatura y la imagen del producto serán las del combo (generadas desde los productos añadidos).
          </p>

          {form.isComboProduct && (
            <>
              <div className={styles.infoSubsection}>
                <h4 className={styles.sectionTitle}>Configuración de Layout</h4>
                <div className={styles.row}>
                  <div className={styles.field}>
                    <label htmlFor="comboOrientation">Orientación:</label>
                    <select
                      id="comboOrientation"
                      value={form.comboLayout.orientation}
                      onChange={(e) => handleComboLayoutChange({ orientation: e.target.value })}
                      className={styles.input}
                    >
                      <option value="horizontal">Horizontal (lado a lado)</option>
                      <option value="vertical">Vertical (uno debajo del otro)</option>
                    </select>
                  </div>
                  <div className={styles.field}>
                    <label htmlFor="comboSpacing">Separación (px):</label>
                    <input
                      id="comboSpacing"
                      type="number"
                      min="0"
                      max="200"
                      value={form.comboLayout.spacing}
                      onChange={(e) => handleComboLayoutChange({ spacing: parseInt(e.target.value) || 20 })}
                      className={styles.input}
                    />
                  </div>
                </div>
              </div>

              <div className={styles.infoSubsection}>
                <ComboItemsManager
                  comboItems={form.comboItems || []}
                  onItemsChange={handleUpdateComboItems}
                  onAddItem={() => setShowComboSelector(true)}
                />
              </div>
            </>
          )}
        </AccordionSection>

        {/* Imágenes y variantes */}
        <AccordionSection title="Imágenes y variantes" defaultExpanded={form.isComboProduct ? true : false}>
          <>
            {form.isComboProduct && (
              <div className={styles.field} style={{ marginBottom: '1rem', padding: '0.75rem 1rem', background: '#e8f4fd', borderRadius: 8, border: '1px solid #b8daff' }}>
                <label style={{ marginBottom: '0.5rem', display: 'block', fontWeight: 600 }}>Miniatura del Combo</label>

                {/* Preview de la miniatura actual */}
                {form.comboPreviewImage && typeof form.comboPreviewImage === 'string' && form.comboPreviewImage.trim() && !form.comboPreviewImage.startsWith('data:') ? (
                  <div style={{ marginBottom: '0.75rem' }}>
                    <p className={styles.sectionHint} style={{ margin: '0 0 0.5rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <span style={{ color: '#2e7d32' }}>✅</span> Miniatura generada y guardada
                    </p>
                    <img
                      src={toDirectImageUrl(form.comboPreviewImage)}
                      alt="Miniatura del combo"
                      style={{ maxWidth: 280, maxHeight: 200, objectFit: 'contain', border: '1px solid #ddd', borderRadius: 6, background: '#fff' }}
                      loading="lazy"
                    />
                  </div>
                ) : (
                  <p className={styles.sectionHint} style={{ margin: '0 0 0.5rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <span style={{ color: '#ed6c02' }}>⚠️</span> Sin miniatura guardada — los diseños se renderizan en tiempo real en la tienda.
                  </p>
                )}

                {/* Acciones */}
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
                  {/* Regenerar miniatura */}
                  <Button
                    type="button"
                    variant="secondary"
                    size="small"
                    onClick={async () => {
                      try {
                        const captureFn = triggerComboCaptureRef.current;
                        if (typeof captureFn !== 'function') {
                          alert('Activa la pestaña "Personalizable" y abre el Editor de Combo primero.');
                          return;
                        }
                        const dataUrl = await captureFn();
                        if (dataUrl && dataUrl.startsWith('data:')) {
                          const path = `productos_wala/combos/${id || 'new_' + Date.now()}_preview.png`;
                          const { url } = await uploadFromDataUrl(dataUrl, path);
                          if (url) {
                            setForm(f => ({ ...f, comboPreviewImage: url }));
                            alert('✅ Miniatura regenerada correctamente.');
                          }
                        } else {
                          alert('No se pudo capturar. Asegúrate de que el Editor de Combo está abierto y tiene imágenes cargadas.');
                        }
                      } catch (err) {
                        console.error('Error regenerando miniatura:', err);
                        alert('Error al regenerar: ' + (err?.message || 'Error desconocido'));
                      }
                    }}
                  >
                    📸 Regenerar miniatura
                  </Button>

                  {/* Subir imagen manual */}
                  <Button
                    type="button"
                    variant="secondary"
                    size="small"
                    onClick={() => {
                      const input = document.createElement('input');
                      input.type = 'file';
                      input.accept = 'image/*';
                      input.onchange = async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        try {
                          const path = `productos_wala/combos/${id || 'new_' + Date.now()}_manual.${file.name.split('.').pop()}`;
                          const { url, error } = await uploadFile(file, path);
                          if (url && !error) {
                            setForm(f => ({ ...f, comboPreviewImage: url }));
                            alert('✅ Imagen subida correctamente.');
                          } else {
                            alert('Error al subir la imagen.');
                          }
                        } catch (err) {
                          alert('Error: ' + (err?.message || 'Error desconocido'));
                        }
                      };
                      input.click();
                    }}
                  >
                    📤 Subir imagen manual
                  </Button>

                  {/* Eliminar miniatura */}
                  {form.comboPreviewImage && form.comboPreviewImage.trim() && (
                    <Button
                      type="button"
                      variant="secondary"
                      size="small"
                      onClick={() => {
                        if (window.confirm('¿Eliminar la miniatura del combo? Los diseños se renderizarán en tiempo real en la tienda.')) {
                          setForm(f => ({ ...f, comboPreviewImage: '' }));
                        }
                      }}
                      style={{ color: '#d32f2f' }}
                    >
                      🗑 Eliminar miniatura
                    </Button>
                  )}
                </div>

                <p className={styles.sectionHint} style={{ marginTop: '0.75rem', fontSize: '0.78rem', color: '#666' }}>
                  La miniatura se genera automáticamente al guardar si el Editor de Combo está activo. También puedes regenerarla manualmente o subir una imagen propia.
                </p>
              </div>
            )}
            {!form.isComboProduct && (
              <>
                <div className={styles.field}>
                  <label>Variantes</label>
                  <p className={styles.sectionHint}>
                    Cada producto tiene al menos una opción (imagen y tallas).
                  </p>
                  <ul className={styles.variantsList}>
                    {form.variants.map((v, i) => {
                      const isPrincipal = String(form.defaultVariantId || '') === String(v.id || '');
                      const thumbSrc = toDirectImageUrl(ensureSingleImageUrl(v.imageUrl) || '') || '';
                      return (
                        <li key={v.id} className={styles.variantItem}>
                          <img src={thumbSrc} alt="" className={styles.thumb} loading="lazy" onError={(e) => { e.target.style.display = 'none'; }} />
                          <div className={styles.variantInfo}>
                            <span className={styles.variantName}>{v.name || 'Sin nombre'}</span>
                            {isPrincipal && <span className={styles.principalBadge}>Principal</span>}
                            <span className={styles.variantSizes}>{v.sizes?.length ? v.sizes.join(', ') : 'Sin tallas'}</span>
                          </div>
                          <div className={styles.variantActions}>
                            <Button
                              type="button"
                              variant={isPrincipal ? 'primary' : 'secondary'}
                              size="small"
                              onClick={() => setForm((f) => ({ ...f, defaultVariantId: v.id }))}
                              title="Marcar como variante principal"
                            >
                              Principal
                            </Button>
                            <Button type="button" variant="secondary" size="small" onClick={() => openEditVariant(i)}>Editar</Button>
                            <button type="button" className={styles.btnRemove} onClick={() => removeVariant(i)}>Quitar</button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                  <Button type="button" variant="secondary" onClick={addVariant}>
                    Añadir variante
                  </Button>
                </div>

                {form.variants.length > 0 && (
                  <>
                    <div className={styles.field}>
                      <label>Variante principal</label>
                      <p className={styles.sectionHint}>
                        Se mostrará por defecto en miniaturas para usuarios que no han visto el producto o cuando no aplique la lógica de comportamiento.
                      </p>
                      <div className={styles.radioGroup}>
                        {form.variants.map((v) => (
                          <label key={v.id} className={styles.radioLabel}>
                            <input
                              type="radio"
                              name="defaultVariant"
                              value={v.id}
                              checked={String(form.defaultVariantId || '') === String(v.id || '')}
                              onChange={() => setForm((f) => ({ ...f, defaultVariantId: v.id }))}
                            />
                            {v.name || 'Por defecto'}
                          </label>
                        ))}
                      </div>
                    </div>
                    <div className={styles.field}>
                      <label>Visualización en miniaturas</label>
                      <p className={styles.sectionHint}>
                        Opcional: mostrar variantes según el comportamiento del usuario (impresiones sin clic o tiempo de visualización).
                      </p>
                      {form.thumbnailWithDesignUrl ? (
                        <div className={styles.thumbnailPreviewWrap} style={{ marginBottom: '0.75rem' }}>
                          <p className={styles.sectionHint} style={{ marginBottom: '0.5rem' }}>
                            Vista previa de la miniatura (variante principal con diseño aplicado):
                          </p>
                          <img
                            src={toDirectImageUrl(form.thumbnailWithDesignUrl)}
                            alt="Miniatura con diseño"
                            className={styles.thumb}
                            style={{ maxWidth: 200, maxHeight: 200, objectFit: 'contain', border: '1px solid #ddd', borderRadius: 4 }}
                            loading="lazy"
                          />
                        </div>
                      ) : null}
                      <select
                        value={form.variantDisplayBehavior}
                        onChange={(e) => setForm((f) => ({ ...f, variantDisplayBehavior: e.target.value }))}
                        className={styles.input}
                      >
                        <option value="default_only">Solo variante principal</option>
                        <option value="after_impressions">Tras N impresiones sin clic (variantes al azar)</option>
                        <option value="by_engagement">Por tiempo de visualización</option>
                        <option value="both">Ambas reglas</option>
                      </select>
                      {(form.variantDisplayBehavior === 'after_impressions' || form.variantDisplayBehavior === 'both') && (
                        <div className={styles.field} style={{ marginTop: '0.75rem' }}>
                          <label htmlFor="behaviorImpressionsThreshold">Número de impresiones (N) para activar variantes al azar</label>
                          <input
                            id="behaviorImpressionsThreshold"
                            type="number"
                            min={1}
                            max={20}
                            value={form.behaviorImpressionsThreshold}
                            onChange={(e) => setForm((f) => ({
                              ...f,
                              behaviorImpressionsThreshold: Math.max(1, Math.min(20, parseInt(e.target.value, 10) || 3))
                            }))}
                            className={styles.input}
                            style={{ width: '80px' }}
                          />
                        </div>
                      )}
                    </div>
                  </>
                )}
              </>
            )}
          </>
        </AccordionSection>
        {/* Sección 3: Personalizable */}
        <AccordionSection
          title="Personalizable"
          defaultExpanded={false}
          headerLeft={
            <Toggle
              size="small"
              checked={form.customizable}
              onChange={(value) => setForm((f) => ({ ...f, customizable: value }))}
              aria-label="Activar producto personalizable"
            />
          }
        >
          {form.customizable && (
            <>
              {form.isComboProduct && form.comboItems.length > 0 ? (
                <div className={styles.field}>
                  <label>Editor de Combo</label>
                  <p className={styles.sectionHint}>
                    Define zonas de impresión y diseños sobre la vista unificada. Los cambios se guardan al pulsar &quot;Guardar cambios&quot;.
                  </p>
                  <ComboEditor
                    key={id || 'new'}
                    ref={comboEditorRef}
                    comboItems={form.comboItems || []}
                    comboLayout={form.comboLayout || { orientation: 'horizontal', spacing: 20 }}
                    onItemsChange={handleUpdateComboItems}
                    comboItemCustomization={form.comboItemCustomization || []}
                    onComboItemCustomizationChange={(next) => setForm((f) => ({ ...f, comboItemCustomization: next }))}
                    onCaptureDefaultThumbnail={(dataUrl) => {
                      setForm(f => ({ ...f, comboPreviewImage: dataUrl }));
                    }}
                    onColorChange={handleComboColorChange}
                    triggerCaptureRef={triggerComboCaptureRef}
                  />
                </div>
              ) : (
                <DesignClipboardProvider>
                  <>
                    <div className={styles.field}>
                      <label>Vistas de personalización</label>
                      <p className={styles.sectionHint}>
                        Cada vista es una zona del producto (ej. Frente, Espalda). Sube una imagen por vista{form.hasVariants && form.variants.length > 0 ? ' y por variante' : ''} (URL o Google Drive). En &quot;Zona de impresión&quot; defines el área donde el cliente podrá colocar textos, imágenes y diseños a su gusto; esa zona se muestra en el editor.
                        <br /><small style={{ color: '#666', marginTop: '0.25rem', display: 'block' }}>💡 <strong>Tip:</strong> Puedes copiar elementos entre vistas con Ctrl+C / Ctrl+V, duplicar con Alt+click, y arrastrar entre lienzos.</small>
                      </p>
                      {form.customizationViews.map((view, viewIndex) => (
                        <div key={view.id} className={styles.viewCard}>
                          <div className={styles.viewCardHeader}>
                            <input
                              type="text"
                              value={view.name}
                              onChange={(e) => updateCustomizationView(viewIndex, { name: e.target.value })}
                              placeholder="Nombre (ej. Frente)"
                              className={styles.input}
                            />
                            <button type="button" className={styles.btnRemove} onClick={() => removeCustomizationView(viewIndex)} aria-label="Quitar vista">
                              Quitar vista
                            </button>
                          </div>
                          {(() => {
                            // Determinar color seleccionado para esta vista
                            const currentColor = selectedColorByView[view.id] || 'default';

                            // Obtener imagen según el color seleccionado
                            const viewImage = view.imagesByColor?.[currentColor] || view.imagesByColor?.default || '';

                            // Layers por color disponibles en view.initialLayersByColor

                            // Colores disponibles para esta vista
                            const availableColors = form.hasVariants && form.variants.length > 0
                              ? form.variants.map((v) => v.name)
                              : [];

                            return viewImage ? (
                              <AdminViewEditor
                                productId={id}
                                viewId={view.id}
                                productImage={viewImage}
                                printAreas={view.printAreas || []}
                                initialLayersByColor={view.initialLayersByColor || {}}
                                currentColor={currentColor}
                                availableColors={availableColors}
                                onColorChange={(color) => {
                                  setSelectedColorByView(prev => ({ ...prev, [view.id]: color }));
                                }}
                                onCopyToAllColors={(layers, sourceDims = {}) => {
                                  const newInitialLayers = { ...(view.initialLayersByColor || {}) };
                                  // Asignar nuevos IDs a cada elemento copiado para forzar a FabricJS a tratar las capas como objetos individuales nuevos
                                  const createClonesWithNewIds = () => layers.map(l => ({
                                    ...JSON.parse(JSON.stringify(l)),
                                    id: `layer_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
                                    baseW: l.baseW || sourceDims.width || undefined,
                                    baseH: l.baseH || sourceDims.height || undefined
                                  }));

                                  if (currentColor !== 'default') {
                                    newInitialLayers['default'] = createClonesWithNewIds();
                                  }
                                  availableColors.forEach(c => {
                                    if (c !== currentColor) {
                                      newInitialLayers[c] = createClonesWithNewIds();
                                    } else {
                                      // Al color actual se le deja su referencia intacta para que no brinque la pantalla
                                      newInitialLayers[c] = JSON.parse(JSON.stringify(layers));
                                    }
                                  });
                                  updateCustomizationView(viewIndex, {
                                    initialLayersByColor: newInitialLayers
                                  });
                                  alert('✅ Diseño copiado a todas las variaciones. Ahora puedes cambiar a cada variación y personalizar sus colores individualmente.');
                                }}
                                onLayersChange={(color, layers) => {
                                  updateCustomizationView(viewIndex, {
                                    initialLayersByColor: {
                                      ...view.initialLayersByColor,
                                      [color]: layers
                                    }
                                  });
                                }}
                                onPrintAreasChange={(newAreas) => updateCustomizationView(viewIndex, { printAreas: newAreas })}
                              />
                            ) : (
                              <div style={{ padding: '1.5rem', background: '#fff3cd', border: '2px dashed #ffc107', borderRadius: '8px', marginTop: '1rem' }}>
                                <p style={{ margin: '0 0 0.75rem 0', fontWeight: '600', color: '#856404' }}>
                                  ⚠️ Editor no disponible
                                </p>
                                <p style={{ margin: 0, fontSize: '0.875rem', color: '#856404' }}>
                                  Para usar el editor visual, primero debes subir una imagen de esta vista. Una vez que subas la imagen, aparecerá el editor completo donde podrás agregar texto, imágenes, formas y definir el área de impresión.
                                </p>
                                <div className={styles.printAreaRow} style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #ffc107' }}>
                                  <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.875rem', color: '#856404' }}>
                                    Sube una imagen para usar el editor visual de zonas. Por ahora puedes usar el editor básico cuando subas la imagen.
                                  </p>
                                </div>
                              </div>
                            );
                          })()}
                          <div className={styles.viewImages}>
                            {/* Siempre renderizar el slot de default como fallback base de la vista */}
                            <div className={styles.viewImageSlot}>
                              <label className={styles.viewImageLabel}>Imagen Base / Por Defecto</label>
                              {view.imagesByColor?.default ? (
                                <div className={styles.viewImagePreview}>
                                  <img src={toDirectImageUrl(ensureSingleImageUrl(view.imagesByColor?.default) ?? '') || ''} alt="" loading="lazy" />
                                  <button type="button" className={styles.btnRemove} onClick={() => setViewImageForColor(viewIndex, 'default', '')}>Quitar</button>
                                </div>
                              ) : (
                                <div className={styles.viewImageInputGroup}>
                                  <input
                                    ref={(el) => { viewImageRefs.current[`${viewIndex}_default`] = el; }}
                                    type="file"
                                    accept="image/*"
                                    onChange={(e) => handleViewImageUpload(viewIndex, 'default', e.target.files?.[0])}
                                    className={styles.fileInput}
                                  />
                                  <div className={styles.urlRow}>
                                    <input
                                      type="text"
                                      placeholder="O pega URL / Google Drive o Firebase"
                                      value={viewImageUrlInputs[viewImageUrlInputKey(viewIndex, 'default')] ?? ''}
                                      onChange={(e) => setViewImageUrlInputs((prev) => ({ ...prev, [viewImageUrlInputKey(viewIndex, 'default')]: e.target.value }))}
                                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), applyViewImageUrl(viewIndex, 'default'))}
                                      className={styles.input}
                                    />
                                    <Button type="button" variant="secondary" size="small" onClick={() => applyViewImageUrl(viewIndex, 'default')}>
                                      Usar URL
                                    </Button>
                                  </div>
                                </div>
                              )}
                            </div>

                            {form.hasVariants && form.variants.map((v) => {
                              const variantName = v.name;
                              return (
                                <div key={v.id} className={styles.viewImageSlot}>
                                  <label className={styles.viewImageLabel}>Variante: {variantName}</label>
                                  {(view.imagesByColor[variantName] ?? '') ? (
                                    <div className={styles.viewImagePreview}>
                                      <img src={toDirectImageUrl(ensureSingleImageUrl(view.imagesByColor[variantName]) ?? '') || ''} alt="" loading="lazy" />
                                      <button type="button" className={styles.btnRemove} onClick={() => setViewImageForColor(viewIndex, variantName, '')}>Quitar</button>
                                    </div>
                                  ) : (
                                    <div className={styles.viewImageInputGroup}>
                                      <input
                                        ref={(el) => { viewImageRefs.current[`${viewIndex}_${variantName}`] = el; }}
                                        type="file"
                                        accept="image/*"
                                        onChange={(e) => handleViewImageUpload(viewIndex, variantName, e.target.files?.[0])}
                                        className={styles.fileInput}
                                      />
                                      <div className={styles.urlRow}>
                                        <input
                                          type="text"
                                          placeholder="O pega URL / Google Drive o Firebase"
                                          value={viewImageUrlInputs[viewImageUrlInputKey(viewIndex, variantName)] ?? ''}
                                          onChange={(e) => setViewImageUrlInputs((prev) => ({ ...prev, [viewImageUrlInputKey(viewIndex, variantName)]: e.target.value }))}
                                          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), applyViewImageUrl(viewIndex, variantName))}
                                          className={styles.input}
                                        />
                                        <Button type="button" variant="secondary" size="small" onClick={() => applyViewImageUrl(viewIndex, variantName)}>
                                          Usar URL
                                        </Button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>

                          <div style={{ marginTop: '1.5rem', padding: '1rem', background: '#f8f9fa', borderRadius: '8px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                              <label style={{ fontWeight: '600', margin: 0 }}>Vista Espalda (Opcional)</label>
                              <Toggle
                                size="small"
                                checked={view.hasBackSide || false}
                                onChange={(value) => {
                                  if (value) {
                                    const backSide = createDefaultBackSide(view);
                                    updateCustomizationView(viewIndex, { hasBackSide: true, backSide });
                                  } else {
                                    updateCustomizationView(viewIndex, { hasBackSide: false, backSide: null });
                                  }
                                }}
                              />
                            </div>
                            {view.hasBackSide && view.backSide && (() => {
                              const backView = view.backSide;
                              const currentBackColor = selectedColorByView[backView.id] || 'default';
                              const fallbackImage = Object.values(backView.imagesByColor || {}).find(img => img && typeof img === 'string') || '';
                              const backViewImage = backView.imagesByColor?.[currentBackColor] || backView.imagesByColor?.default || fallbackImage;
                              const availableBackColors = form.hasVariants && form.variants.length > 0
                                ? form.variants.map((v) => v.name)
                                : [];

                              return (
                                <div style={{ marginTop: '1rem', borderTop: '1px dashed #ccc', paddingTop: '1rem' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                                    <input
                                      type="text"
                                      value={backView.name}
                                      onChange={(e) => updateCustomizationView(viewIndex, {
                                        backSide: { ...view.backSide, name: e.target.value }
                                      })}
                                      placeholder="Nombre (ej. Espalda)"
                                      className={styles.input}
                                      style={{ maxWidth: '200px' }}
                                    />
                                    <button type="button" className={styles.btnRemove} onClick={() => updateCustomizationView(viewIndex, { hasBackSide: false, backSide: null })}>
                                      Quitar espalda
                                    </button>
                                  </div>

                                  <div className={styles.viewImages}>
                                    <div className={styles.viewImageSlot}>
                                      <label className={styles.viewImageLabel}>Imagen Base / Por Defecto (Espalda)</label>
                                      {backView.imagesByColor?.default ? (
                                        <div className={styles.viewImagePreview}>
                                          <img src={toDirectImageUrl(ensureSingleImageUrl(backView.imagesByColor?.default) ?? '') || ''} alt="" loading="lazy" />
                                          <button type="button" className={styles.btnRemove} onClick={() => {
                                            updateCustomizationView(viewIndex, {
                                              backSide: {
                                                ...backView,
                                                imagesByColor: { ...backView.imagesByColor, default: '' }
                                              }
                                            });
                                          }}>Quitar</button>
                                        </div>
                                      ) : (
                                        <div className={styles.viewImageInputGroup}>
                                          <input
                                            ref={(el) => { viewImageRefs.current[`${viewIndex}_back_default`] = el; }}
                                            type="file"
                                            accept="image/*"
                                            onChange={(e) => handleViewImageUploadBackSide(viewIndex, 'default', e.target.files?.[0])}
                                            className={styles.fileInput}
                                          />
                                          <div className={styles.urlRow}>
                                            <input
                                              type="text"
                                              placeholder="O pega URL / Google Drive"
                                              value={viewImageUrlInputs[`${viewIndex}_back_default`] ?? ''}
                                              onChange={(e) => setViewImageUrlInputs((prev) => ({ ...prev, [`${viewIndex}_back_default`]: e.target.value }))}
                                              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), applyViewImageUrlBackSide(viewIndex, 'default'))}
                                              className={styles.input}
                                            />
                                            <Button type="button" variant="secondary" size="small" onClick={() => applyViewImageUrlBackSide(viewIndex, 'default')}>
                                              Usar URL
                                            </Button>
                                          </div>
                                        </div>
                                      )}
                                    </div>

                                    {form.hasVariants && form.variants.map((v) => {
                                      const variantName = v.name;
                                      return (
                                        <div key={v.id} className={styles.viewImageSlot}>
                                          <label className={styles.viewImageLabel}>Variante Espalda: {variantName}</label>
                                          {(backView.imagesByColor[variantName] ?? '') ? (
                                            <div className={styles.viewImagePreview}>
                                              <img src={toDirectImageUrl(ensureSingleImageUrl(backView.imagesByColor[variantName]) ?? '') || ''} alt="" loading="lazy" />
                                              <button type="button" className={styles.btnRemove} onClick={() => {
                                                updateCustomizationView(viewIndex, {
                                                  backSide: {
                                                    ...backView,
                                                    imagesByColor: { ...backView.imagesByColor, [variantName]: '' }
                                                  }
                                                });
                                              }}>Quitar</button>
                                            </div>
                                          ) : (
                                            <div className={styles.viewImageInputGroup}>
                                              <input
                                                ref={(el) => { viewImageRefs.current[`${viewIndex}_back_${variantName}`] = el; }}
                                                type="file"
                                                accept="image/*"
                                                onChange={(e) => handleViewImageUploadBackSide(viewIndex, variantName, e.target.files?.[0])}
                                                className={styles.fileInput}
                                              />
                                              <div className={styles.urlRow}>
                                                <input
                                                  type="text"
                                                  placeholder="O pega URL / Google Drive"
                                                  value={viewImageUrlInputs[`${viewIndex}_back_${variantName}`] ?? ''}
                                                  onChange={(e) => setViewImageUrlInputs((prev) => ({ ...prev, [`${viewIndex}_back_${variantName}`]: e.target.value }))}
                                                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), applyViewImageUrlBackSide(viewIndex, variantName))}
                                                  className={styles.input}
                                                />
                                                <Button type="button" variant="secondary" size="small" onClick={() => applyViewImageUrlBackSide(viewIndex, variantName)}>
                                                  Usar URL
                                                </Button>
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>

                                  {backViewImage ? (
                                    <AdminViewEditor
                                      productId={id}
                                      viewId={backView.id}
                                      productImage={backViewImage}
                                      printAreas={backView.printAreas || []}
                                      initialLayersByColor={backView.initialLayersByColor || {}}
                                      currentColor={currentBackColor}
                                      availableColors={availableBackColors}
                                      onColorChange={(color) => {
                                        setSelectedColorByView(prev => ({ ...prev, [backView.id]: color }));
                                      }}
                                      onCopyToAllColors={(layers, sourceDims = {}) => {
                                        const newInitialLayers = { ...(backView.initialLayersByColor || {}) };
                                        const createClonesWithNewIds = () => layers.map(l => ({
                                          ...JSON.parse(JSON.stringify(l)),
                                          id: `layer_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
                                          baseW: l.baseW || sourceDims.width || undefined,
                                          baseH: l.baseH || sourceDims.height || undefined
                                        }));

                                        if (currentBackColor !== 'default') {
                                          newInitialLayers['default'] = createClonesWithNewIds();
                                        }
                                        availableBackColors.forEach(c => {
                                          if (c !== currentBackColor) {
                                            newInitialLayers[c] = createClonesWithNewIds();
                                          } else {
                                            newInitialLayers[c] = JSON.parse(JSON.stringify(layers));
                                          }
                                        });

                                        updateCustomizationView(viewIndex, {
                                          backSide: {
                                            ...view.backSide,
                                            initialLayersByColor: newInitialLayers
                                          }
                                        });
                                        alert('✅ Diseño copiado a todas las variaciones de la ESPALDA.');
                                      }}
                                      onLayersChange={(color, layers) => {
                                        updateCustomizationView(viewIndex, {
                                          backSide: {
                                            ...view.backSide,
                                            initialLayersByColor: {
                                              ...view.backSide.initialLayersByColor,
                                              [color]: layers
                                            }
                                          }
                                        });
                                      }}
                                      onPrintAreasChange={(newAreas) => updateCustomizationView(viewIndex, {
                                        backSide: { ...view.backSide, printAreas: newAreas }
                                      })}
                                    />
                                  ) : (
                                    <div style={{ padding: '1.5rem', background: '#fff3cd', border: '2px dashed #ffc107', borderRadius: '8px', margin: '1rem 0' }}>
                                      <p style={{ margin: '0 0 0.75rem 0', fontWeight: '600', color: '#856404' }}>
                                        ⚠️ Editor de espalda no disponible
                                      </p>
                                      <p style={{ margin: 0, fontSize: '0.875rem', color: '#856404' }}>
                                        Para usar el editor visual de la espalda, primero debes subir una imagen de esta vista.
                                      </p>
                                    </div>
                                  )}
                                </div>
                              );
                            })()}
                          </div>
                        </div>
                      ))}
                      <Button type="button" variant="secondary" onClick={addCustomizationView}>
                        Añadir vista
                      </Button>
                    </div>
                  </>
                </DesignClipboardProvider>
              )}

              <div className={styles.field}>
                <label>Clipart de este producto</label>
                <p className={styles.sectionHint}>Imágenes que los clientes podrán usar al personalizar este producto.</p>
                <input
                  ref={clipartFileRef}
                  type="file"
                  accept="image/*"
                  onChange={handleClipartUpload}
                  className={styles.fileInput}
                  disabled={clipartUploading}
                />
                {clipartUploading && <span className={styles.uploadingLabel}>Subiendo...</span>}
                <div className={styles.urlRow} style={{ marginTop: '0.75rem' }}>
                  <input
                    type="text"
                    placeholder="O pega URL / Google Drive o Firebase"
                    value={clipartUrlInput}
                    onChange={(e) => setClipartUrlInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddClipartFromUrl())}
                    className={styles.input}
                  />
                  <Button type="button" variant="secondary" size="small" onClick={handleAddClipartFromUrl}>
                    Agregar desde URL
                  </Button>
                </div>
                <ul className={styles.list}>
                  {form.productCliparts.map((c, i) => (
                    <li key={c.id} className={styles.listItem}>
                      <img src={toDirectImageUrl(ensureSingleImageUrl(c.url) || '') || ''} alt="" className={styles.thumb} loading="lazy" onError={(e) => { e.target.style.display = 'none'; }} />
                      <span className={styles.listUrl}>{c.name || c.url}</span>
                      <button type="button" className={styles.btnRemove} onClick={() => removeProductClipart(i)}>Quitar</button>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}
        </AccordionSection>

        {/* Sección 4: Configuración */}
        <AccordionSection title="Configuración" defaultExpanded={false}>
          <div className={styles.field}>
            <label htmlFor="inStock">Stock</label>
            <input
              id="inStock"
              type="number"
              min="0"
              value={form.inStock}
              onChange={(e) => setForm((f) => ({ ...f, inStock: e.target.value }))}
              className={styles.input}
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="brandId">Marca</label>
            <select
              id="brandId"
              value={form.brandId || ''}
              onChange={(e) => setForm((f) => ({ ...f, brandId: e.target.value }))}
              className={styles.input}
            >
              <option value="">Walá (predeterminada)</option>
              {brandsList.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
            <span className={styles.sectionHint} style={{ fontSize: '0.8rem', marginTop: '4px', display: 'block' }}>
              Selecciona la marca a la que pertenece este producto. Si no se elige ninguna, se mostrará como un producto de Walá.
            </span>
          </div>

          <div className={styles.field}>
            <label className={styles.checkLabel}>
              <input
                type="checkbox"
                checked={form.visible !== false}
                onChange={(e) => setForm((f) => ({ ...f, visible: e.target.checked }))}
              />
              Visible en tienda (si lo desmarcas, el producto no se mostrará a los clientes)
            </label>
          </div>

          <div className={styles.field}>
            <label className={styles.checkLabel}>
              <input
                type="checkbox"
                checked={form.featured}
                onChange={(e) => setForm((f) => ({ ...f, featured: e.target.checked }))}
              />
              Mostrar en destacados
            </label>
            {form.featured && (
              <div className={styles.field} style={{ marginTop: '0.75rem' }}>
                <label htmlFor="featuredOrder">Orden en destacados</label>
                <input
                  id="featuredOrder"
                  type="number"
                  min="0"
                  value={form.featuredOrder}
                  onChange={(e) => setForm((f) => ({ ...f, featuredOrder: e.target.value }))}
                  className={styles.inputOrder}
                />
              </div>
            )}
          </div>
        </AccordionSection>

        {saveStatus === 'success' && (
          <div className={styles.formSuccess} role="status">
            Producto guardado correctamente. Redirigiendo a la lista…
          </div>
        )}
        {(saveStatus === 'error' || createMutation.isError || updateMutation.isError) && (
          <div className={styles.formError} role="alert">
            {createMutation.error?.message || updateMutation.error?.message || 'Error al guardar. Comprueba la conexión y vuelve a intentarlo.'}
          </div>
        )}

        <div className={styles.formActions}>
          <Button type="button" onClick={handleSubmit} disabled={saving || saveStatus === 'loading'}>
            {saveStatus === 'loading' || saving ? 'Guardando…' : (isNew ? 'Crear producto' : 'Guardar cambios')}
          </Button>
          <Button type="button" variant="secondary" onClick={() => navigate('/admin/productos')} disabled={saving || saveStatus === 'loading'}>
            Cancelar
          </Button>
        </div>
      </div>

      {
        showComboSelector && (
          <ComboProductSelector
            onSelect={handleAddComboItem}
            onClose={() => setShowComboSelector(false)}
            excludeProductIds={form.isComboProduct ? [id].filter(Boolean) : []}
          />
        )
      }
      <AdminQuickAddModal 
        isOpen={quickAddModal.isOpen}
        onClose={() => setQuickAddModal({ isOpen: false, type: null })}
        title={
          quickAddModal.type === 'category' ? 'Nueva Categoría' :
          quickAddModal.type === 'collection' ? 'Nueva Colección' :
          quickAddModal.type === 'tag' ? 'Nueva Etiqueta' :
          quickAddModal.type === 'character' ? 'Nuevo Personaje' :
          quickAddModal.type === 'productType' ? 'Nuevo Tipo de Producto' :
          quickAddModal.type === 'vendor' ? 'Nuevo Proveedor' :
          quickAddModal.type === 'brand' ? 'Nueva Marca' :
          'Nuevo Elemento'
        }
        label="Nombre"
        isImageNeeded={quickAddModal.type === 'brand'}
        onSubmit={async (data) => {
          if (quickAddModal.type === 'brand') {
            await createBrand(data);
            queryClient.invalidateQueries({ queryKey: ['admin-brands'] });
          } else if (quickAddModal.type === 'category') {
            await createCategory(data);
            queryClient.invalidateQueries({ queryKey: ['admin-categories'] });
          } else if (quickAddModal.type === 'collection') {
            await createCollection(data);
            queryClient.invalidateQueries({ queryKey: ['admin-collections'] });
          } else if (quickAddModal.type === 'tag') {
            await createTag(data);
            queryClient.invalidateQueries({ queryKey: ['admin-tags'] });
          } else if (quickAddModal.type === 'character') {
            await createCharacter(data);
            queryClient.invalidateQueries({ queryKey: ['admin-characters'] });
          } else if (quickAddModal.type === 'productType') {
            await createProductType(data);
            queryClient.invalidateQueries({ queryKey: ['admin-productTypes'] });
          } else if (quickAddModal.type === 'vendor') {
            await createVendor(data);
            queryClient.invalidateQueries({ queryKey: ['admin-vendors'] });
          }
        }}
      />
    </div >
  );
};

export default AdminProductoForm;
