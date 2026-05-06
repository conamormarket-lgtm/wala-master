import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createProduct, updateProduct, getProduct } from '../../../services/products';
import { getMockups } from '../../../services/mockups';
import { getBrands } from '../../../services/brands';
import { getCategories } from '../../../services/categories';
import { getCollections } from '../../../services/collections';
import { uploadFile } from '../../../services/firebase/storage';
import { ImagePlus, Save, ArrowLeft, Loader2, Shirt, Image as ImageIcon, Trash2 } from 'lucide-react';
import Button from '../../../components/common/Button';
import { fabric } from 'fabric';
import styles from './AdminProductoFormV2.module.css';

// We don't need the custom mergeImages anymore because Fabric.js does it perfectly.
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
  const isNew = !id;
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [mode, setMode] = useState('mockup'); // 'mockup' | 'direct'
  const [form, setForm] = useState({
    name: '',
    description: '',
    price: '',
    salePrice: '',
    sku: '',
    brandId: '',
    category: '',
    collection: '',
    mainImage: '', // Para modo directo o imagen final guardada
    images: [], // Imágenes adicionales de galería
  });

  const [mockupState, setMockupState] = useState({
    selectedMockupId: '',
    selectedVariantIndex: 0
  });

  const [uploading, setUploading] = useState(false);
  const canvasElRef = useRef(null);
  const [fabricCanvas, setFabricCanvas] = useState(null);
  const [hasActiveObject, setHasActiveObject] = useState(false);

  // Init Fabric Canvas
  useEffect(() => {
    if (mode === 'mockup' && canvasElRef.current && !fabricCanvas) {
      const canvas = new fabric.Canvas(canvasElRef.current, {
        width: 400,
        height: 533,
        preserveObjectStacking: true,
      });

      canvas.on('selection:created', () => setHasActiveObject(true));
      canvas.on('selection:updated', () => setHasActiveObject(true));
      canvas.on('selection:cleared', () => setHasActiveObject(false));

      setFabricCanvas(canvas);

      return () => {
        canvas.dispose();
        setFabricCanvas(null);
      };
    }
  }, [mode]);

  // Consultas de datos
  const { data: mockups } = useQuery({ queryKey: ['admin-mockups'], queryFn: async () => (await getMockups()).data });
  const { data: brands } = useQuery({ queryKey: ['admin-brands'], queryFn: async () => (await getBrands()).data });
  const { data: categories } = useQuery({ queryKey: ['admin-categories'], queryFn: async () => (await getCategories()).data });
  const { data: collections } = useQuery({ queryKey: ['admin-collections'], queryFn: async () => (await getCollections()).data });

  // Si editamos un producto existente
  const { data: productData, isLoading: loadingProduct } = useQuery({
    queryKey: ['admin-product', id],
    queryFn: async () => (await getProduct(id)).data,
    enabled: !isNew
  });

  useEffect(() => {
    if (!isNew && productData) {
      setForm({
        name: productData.name || '',
        description: productData.description || '',
        price: productData.price || '',
        salePrice: productData.salePrice || '',
        sku: productData.sku || '',
        brandId: productData.brandId || '',
        category: productData.category ? productData.category.id || productData.category : '',
        collection: productData.collections?.[0]?.id || productData.collections?.[0] || '',
        mainImage: productData.mainImage || '',
        images: productData.images || [],
      });
      setMode('direct'); // Los productos existentes suelen ser de imagen directa
    }
  }, [productData, isNew]);

  const selectedMockup = mockups?.find(m => m.id === mockupState.selectedMockupId);
  const selectedVariant = selectedMockup?.variants?.[mockupState.selectedVariantIndex];
  const baseImage = selectedVariant?.imageUrl || selectedMockup?.baseImageUrl || '';

  // Draw background image when mockup changes
  useEffect(() => {
    if (mode === 'mockup' && fabricCanvas && baseImage) {
      fabric.Image.fromURL(baseImage, (img) => {
        const scale = Math.min(400 / img.width, 533 / img.height); // Contain scale
        img.set({
          originX: 'center',
          originY: 'center',
          left: 200,
          top: 266.5,
          scaleX: scale,
          scaleY: scale,
          selectable: false,
          evented: false
        });
        fabricCanvas.setBackgroundImage(img, fabricCanvas.renderAll.bind(fabricCanvas));
      }, { crossOrigin: 'anonymous' });
    } else if (mode === 'mockup' && fabricCanvas && !baseImage) {
      fabricCanvas.clear();
      fabricCanvas.setBackgroundColor('', fabricCanvas.renderAll.bind(fabricCanvas));
    }
  }, [mode, baseImage, fabricCanvas]);

  const handleDesignUpload = (e) => {
    const file = e.target.files[0];
    if (file && fabricCanvas) {
      const url = URL.createObjectURL(file);
      fabric.Image.fromURL(url, (img) => {
        img.scaleToWidth(150);
        img.set({
          originX: 'center',
          originY: 'center',
          left: 200,
          top: 200,
          transparentCorners: false,
          cornerColor: '#111',
          borderColor: '#111',
          cornerSize: 10,
          padding: 5
        });
        fabricCanvas.add(img);
        fabricCanvas.setActiveObject(img);
        fabricCanvas.renderAll();
      });
    }
    e.target.value = ''; // Reset input
  };

  const handleGalleryUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    setUploading(true);
    try {
      const newImages = [];
      for (const file of files) {
        const path = `productos_v2/gallery_${Date.now()}_${file.name}`;
        const { url } = await uploadFile(file, path);
        if (url) newImages.push(url);
      }
      setForm(f => ({ ...f, images: [...f.images, ...newImages] }));
    } finally {
      setUploading(false);
    }
  };

  const removeGalleryImage = (index) => {
    setForm(f => ({
      ...f,
      images: f.images.filter((_, i) => i !== index)
    }));
  };

  // Drag & Drop para la galería
  const [draggedIdx, setDraggedIdx] = useState(null);

  const handleDragStart = (e, index) => {
    setDraggedIdx(index);
    // Para Firefox es necesario setear datos
    e.dataTransfer.setData('text/plain', index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e) => {
    e.preventDefault(); // Permite soltar
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e, targetIdx) => {
    e.preventDefault();
    if (draggedIdx === null || draggedIdx === targetIdx) return;

    setForm(f => {
      const newImages = [...f.images];
      const [draggedImg] = newImages.splice(draggedIdx, 1);
      newImages.splice(targetIdx, 0, draggedImg);
      return { ...f, images: newImages };
    });
    setDraggedIdx(null);
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
    if (!file) return;
    setUploading(true);
    try {
      const path = `productos_v2/${Date.now()}_${file.name}`;
      const { url } = await uploadFile(file, path);
      if (url) setForm(f => ({ ...f, mainImage: url }));
    } finally {
      setUploading(false);
    }
  };

  const saveMutation = useMutation({
    mutationFn: async (payload) => {
      if (isNew) return await createProduct(payload);
      return await updateProduct(id, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      navigate('/admin/productos');
    }
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;

    setUploading(true);
    try {
      let finalImageUrl = form.mainImage;

      // Si usamos Mockup generamos la imagen desde el Canvas (multiplicador 2x para buena resolución)
      if (mode === 'mockup' && baseImage && fabricCanvas) {
        fabricCanvas.discardActiveObject(); // Deseleccionar caja antes de tomar foto
        fabricCanvas.renderAll();

        const dataURL = fabricCanvas.toDataURL({ format: 'png', multiplier: 2 });
        const blob = dataURLtoBlob(dataURL);

        const path = `productos_v2/mockup_merged_${Date.now()}.png`;
        const { url } = await uploadFile(blob, path);
        if (url) finalImageUrl = url;
      }

      const payload = {
        name: form.name,
        description: form.description,
        price: Number(form.price) || 0,
        salePrice: Number(form.salePrice) || 0,
        sku: form.sku,
        brandId: form.brandId,
        category: form.category ? { id: form.category } : null,
        collections: form.collection ? [{ id: form.collection }] : [],
        mainImage: finalImageUrl,
        images: form.images,
        visible: true,
        isV2: true, // Flag to identify V2 architecture
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
          <h1 className={styles.title}>{isNew ? 'Crear Producto (Generador V2)' : 'Editar Producto V2'}</h1>
          <p className={styles.subtitle}>Crea productos usando mockups de alta calidad o imágenes directas.</p>
        </div>
      </div>

      <form className={styles.contentGrid} onSubmit={handleSubmit}>
        {/* COLUMNA IZQUIERDA: Formulario */}
        <div className={styles.leftCol}>
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>Información Básica</h2>

            <div className={styles.field}>
              <label className={styles.label}>Nombre del Producto</label>
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
                <label className={styles.label}>Precio Base</label>
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

            <div className={styles.field}>
              <label className={styles.label}>Descripción Breve</label>
              <textarea
                className={styles.textarea}
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                rows={3}
              />
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

        {/* COLUMNA DERECHA: Visual / Mockup */}
        <div className={styles.rightCol}>
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>Generador Visual</h2>

            <div className={styles.modeToggle}>
              <button
                type="button"
                className={`${styles.modeBtn} ${mode === 'mockup' ? styles.modeActive : ''}`}
                onClick={() => setMode('mockup')}
              >
                <Shirt size={18} /> Usar Mockup
              </button>
              <button
                type="button"
                className={`${styles.modeBtn} ${mode === 'direct' ? styles.modeActive : ''}`}
                onClick={() => setMode('direct')}
              >
                <ImageIcon size={18} /> Subir Foto
              </button>
            </div>

            {mode === 'mockup' ? (
              <div className={styles.mockupWorkspace}>
                <div className={styles.field}>
                  <label className={styles.label}>1. Elige una prenda base (Mockup)</label>
                  <select
                    className={styles.input}
                    value={mockupState.selectedMockupId}
                    onChange={e => setMockupState(prev => ({ ...prev, selectedMockupId: e.target.value, selectedVariantIndex: 0 }))}
                  >
                    <option value="">-- Selecciona un Mockup --</option>
                    {mockups?.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                </div>

                {selectedMockup && selectedMockup.variants?.length > 0 && (
                  <div className={styles.colorSelector}>
                    <label className={styles.label}>2. Selecciona el Color</label>
                    <div className={styles.colorDots}>
                      {selectedMockup.variants.map((v, idx) => (
                        <button
                          key={idx}
                          type="button"
                          className={`${styles.colorDot} ${mockupState.selectedVariantIndex === idx ? styles.colorDotActive : ''}`}
                          style={{ backgroundColor: v.colorHex || '#ddd' }}
                          title={v.colorName}
                          onClick={() => setMockupState(prev => ({ ...prev, selectedVariantIndex: idx }))}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {selectedMockup && (
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

                {/* VISUALIZADOR INTERACTIVO */}
                <div className={styles.previewBoxInteractive} style={brandBgStyle}>
                  {!baseImage && (
                    <div className={styles.emptyPreviewOverlay}>
                      <Shirt size={48} opacity={0.2} />
                      <span>Selecciona un mockup para empezar a editar</span>
                    </div>
                  )}
                  <canvas ref={canvasElRef} className={styles.fabricCanvasEl} />
                </div>

              </div>
            ) : (
              <div className={styles.directWorkspace}>
                <div className={styles.previewBox} style={brandBgStyle}>
                  {form.mainImage ? (
                    <div className={styles.mockupContainer}>
                      <img src={form.mainImage} alt="Producto" className={styles.mockupBaseImg} />
                    </div>
                  ) : (
                    <div className={styles.emptyPreview}>
                      <ImageIcon size={48} opacity={0.2} />
                      <span>Sube una imagen del producto terminado</span>
                    </div>
                  )}
                </div>
                <div className={styles.field} style={{ marginTop: '1rem' }}>
                  <label className={styles.uploadImageLabel}>
                    <ImagePlus size={24} />
                    <span>Subir Imagen Directa</span>
                    <input type="file" accept="image/*" onChange={handleDirectImageUpload} disabled={uploading} hidden />
                  </label>
                </div>
              </div>
            )}
          </div>

          <div className={styles.card}>
            <h2 className={styles.cardTitle}>Galería de Imágenes Extras</h2>
            <p className={styles.cardSubtitle}>
              Sube fotos del producto en uso. La primera imagen de esta galería se usará para el efecto <strong>"Hover"</strong>.
            </p>

            <div className={styles.galleryGrid}>
              {form.images.map((img, idx) => (
                <div
                  key={idx}
                  className={`${styles.galleryItem} ${draggedIdx === idx ? styles.galleryItemDragging : ''}`}
                  draggable
                  onDragStart={(e) => handleDragStart(e, idx)}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, idx)}
                >
                  <img src={img} alt={`Gallery ${idx}`} />
                  <button type="button" onClick={() => removeGalleryImage(idx)} className={styles.deleteGalleryBtn}>
                    <Trash2 size={14} />
                  </button>
                  {idx === 0 && <span className={styles.hoverBadge}>Hover Image</span>}
                </div>
              ))}

              <label className={styles.addGalleryBtn}>
                <ImagePlus size={24} />
                <span>Agregar Fotos</span>
                <input type="file" accept="image/*" multiple onChange={handleGalleryUpload} disabled={uploading} hidden />
              </label>
            </div>
          </div>

          <div className={styles.saveSection}>
            <Button
              type="submit"
              className={styles.saveBtn}
              disabled={uploading || saveMutation.isPending || (mode === 'mockup' && !baseImage) || (mode === 'direct' && !form.mainImage)}
            >
              {uploading ? <><Loader2 className="animate-spin" size={18} /> Guardando...</> : <><Save size={18} /> {isNew ? 'Crear Producto' : 'Guardar Cambios'}</>}
            </Button>
          </div>

        </div>
      </form>
    </div>
  );
};

export default AdminProductoFormV2;
