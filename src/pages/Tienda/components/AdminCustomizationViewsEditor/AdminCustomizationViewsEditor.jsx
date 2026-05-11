import React, { useState, useEffect, useRef } from 'react';
import { fabric } from 'fabric';
import { Plus, Trash2, ImagePlus, Type, Frame, Image as ImageIcon, Loader2 } from 'lucide-react';
import styles from './AdminCustomizationViewsEditor.module.css';
import { uploadFile } from '../../../../services/firebase/storage';

const AdminCustomizationViewsEditor = ({ views, onChange, draftId }) => {
  const [activeViewIdx, setActiveViewIdx] = useState(0);
  const activeView = views[activeViewIdx];
  const [fabricCanvas, setFabricCanvas] = useState(null);
  const canvasElRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [activeObjectInfo, setActiveObjectInfo] = useState({ isText: false, fontFamily: 'Arial' });

  const FONTS = ['Arial', 'Helvetica', 'Times New Roman', 'Courier New', 'Verdana', 'Georgia', 'Impact'];

  // Sync canvas instances
  useEffect(() => {
    if (activeView && canvasElRef.current) {
      if (fabricCanvas) {
        fabricCanvas.dispose();
      }
      const canvas = new fabric.Canvas(canvasElRef.current, {
        width: 400,
        height: 533,
        preserveObjectStacking: true,
      });

      const updateActiveInfo = () => {
        const activeObj = canvas.getActiveObject();
        if (activeObj) {
          setActiveObjectInfo({ 
            isText: activeObj.type === 'i-text' || activeObj.type === 'text', 
            fontFamily: activeObj.fontFamily || 'Arial' 
          });
        } else {
          setActiveObjectInfo({ isText: false, fontFamily: 'Arial' });
        }
      };

      canvas.on('selection:created', updateActiveInfo);
      canvas.on('selection:updated', updateActiveInfo);
      canvas.on('selection:cleared', updateActiveInfo);
      
      // Load background
      const baseImgUrl = activeView.imagesByColor?.default;
      if (baseImgUrl) {
        fabric.Image.fromURL(baseImgUrl, (img) => {
          const scale = Math.min(400 / img.width, 533 / img.height);
          img.set({ originX: 'center', originY: 'center', left: 200, top: 266.5, scaleX: scale, scaleY: scale, selectable: false, evented: false });
          canvas.setBackgroundImage(img, canvas.renderAll.bind(canvas));
        }, { crossOrigin: 'anonymous' });
      }

      // Load initial layers
      const layers = activeView.initialLayersByColor?.default || [];
      layers.forEach(layer => {
        if (layer.type === 'text') {
          const text = new fabric.IText(layer.text || 'Texto', {
            left: layer.left || 200, top: layer.top || 200,
            fill: layer.color || '#000', fontSize: layer.fontSize || 40,
            fontFamily: layer.fontFamily || 'sans-serif',
            originX: 'center', originY: 'center',
            scaleX: layer.scaleX || 1, scaleY: layer.scaleY || 1,
            angle: layer.angle || 0
          });
          canvas.add(text);
        } else if (layer.type === 'image' && layer.src) {
          fabric.Image.fromURL(layer.src, (img) => {
            img.set({
              left: layer.left || 200, top: layer.top || 200,
              originX: 'center', originY: 'center',
              scaleX: layer.scaleX || 1, scaleY: layer.scaleY || 1,
              angle: layer.angle || 0
            });
            canvas.add(img);
          }, { crossOrigin: 'anonymous' });
        }
      });

      canvas.on('object:modified', () => {
        // Use timeout to let fabric finish internal updates
        setTimeout(() => saveCanvasState(canvas), 50);
      });

      setFabricCanvas(canvas);
    }
  }, [activeViewIdx]);

  const saveCanvasState = (canvas = fabricCanvas) => {
    if (!canvas) return;
    const objects = canvas.getObjects().map(obj => {
      if (obj.type === 'i-text' || obj.type === 'text') {
        return {
          type: 'text', text: obj.text, color: obj.fill, fontSize: obj.fontSize, fontFamily: obj.fontFamily,
          left: obj.left, top: obj.top, scaleX: obj.scaleX, scaleY: obj.scaleY, angle: obj.angle
        };
      } else if (obj.type === 'image') {
        return {
          type: 'image', src: obj.getSrc(),
          left: obj.left, top: obj.top, scaleX: obj.scaleX, scaleY: obj.scaleY, angle: obj.angle
        };
      }
      return null;
    }).filter(Boolean);

    const updatedViews = [...views];
    updatedViews[activeViewIdx] = {
      ...updatedViews[activeViewIdx],
      initialLayersByColor: { default: objects }
    };
    onChange(updatedViews);
  };

  const updateActiveView = (updates) => {
    const updatedViews = [...views];
    updatedViews[activeViewIdx] = { ...updatedViews[activeViewIdx], ...updates };
    onChange(updatedViews);
  };

  const handleAddText = () => {
    if (!fabricCanvas) return;
    const text = new fabric.IText('Nuevo Texto', {
      left: 200, top: 200, fill: '#111', fontSize: 32, fontFamily: 'Arial', originX: 'center', originY: 'center'
    });
    fabricCanvas.add(text);
    fabricCanvas.setActiveObject(text);
    saveCanvasState(fabricCanvas);
  };

  const handleChangeFont = (e) => {
    const font = e.target.value;
    if (!fabricCanvas) return;
    const activeObj = fabricCanvas.getActiveObject();
    if (activeObj && (activeObj.type === 'i-text' || activeObj.type === 'text')) {
      activeObj.set({ fontFamily: font });
      fabricCanvas.renderAll();
      setActiveObjectInfo(prev => ({ ...prev, fontFamily: font }));
      saveCanvasState(fabricCanvas);
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !fabricCanvas) return;
    setUploading(true);
    try {
      const path = `productos_v2/${draftId}/layer_${Date.now()}_${file.name}`;
      const { url } = await uploadFile(file, path);
      if (url) {
        fabric.Image.fromURL(url, (img) => {
          img.scaleToWidth(150);
          img.set({ left: 200, top: 200, originX: 'center', originY: 'center' });
          fabricCanvas.add(img);
          fabricCanvas.setActiveObject(img);
          saveCanvasState(fabricCanvas);
        }, { crossOrigin: 'anonymous' });
      }
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleBaseImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const path = `productos_v2/${draftId}/base_${Date.now()}_${file.name}`;
      const { url } = await uploadFile(file, path);
      if (url) {
        updateActiveView({ imagesByColor: { default: url } });
        if (fabricCanvas) {
          fabric.Image.fromURL(url, (img) => {
            const scale = Math.min(400 / img.width, 533 / img.height);
            img.set({ originX: 'center', originY: 'center', left: 200, top: 266.5, scaleX: scale, scaleY: scale, selectable: false, evented: false });
            fabricCanvas.setBackgroundImage(img, fabricCanvas.renderAll.bind(fabricCanvas));
          }, { crossOrigin: 'anonymous' });
        }
      }
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const deleteActiveObject = () => {
    if (!fabricCanvas) return;
    const activeObjects = fabricCanvas.getActiveObjects();
    if (activeObjects.length) {
      activeObjects.forEach(obj => fabricCanvas.remove(obj));
      fabricCanvas.discardActiveObject();
      saveCanvasState(fabricCanvas);
    }
  };

  const addView = () => {
    const newView = {
      id: `view_${Date.now()}`,
      name: `Vista ${views.length + 1}`,
      imagesByColor: { default: '' },
      initialLayersByColor: { default: [] },
      printAreas: [{
        id: `zone_${Date.now()}_0`, shape: 'rectangle', x: 20, y: 20, width: 60, height: 60, rotation: 0, skewX: 0, skewY: 0
      }]
    };
    onChange([...views, newView]);
    setActiveViewIdx(views.length);
  };

  const removeView = () => {
    if (views.length <= 1) {
      alert('Debe existir al menos una vista.');
      return;
    }
    const nextViews = views.filter((_, i) => i !== activeViewIdx);
    onChange(nextViews);
    setActiveViewIdx(Math.max(0, activeViewIdx - 1));
  };

  if (!views || views.length === 0) return null;

  return (
    <div className={styles.wrapper}>
      <div className={styles.tabs}>
        {views.map((v, i) => (
          <button
            key={v.id}
            className={`${styles.tab} ${i === activeViewIdx ? styles.tabActive : ''}`}
            onClick={() => setActiveViewIdx(i)}
            type="button"
          >
            {v.name}
          </button>
        ))}
        <button type="button" onClick={addView} className={styles.addTabBtn} title="Añadir Vista">
          <Plus size={18} />
        </button>
      </div>

      <div className={styles.editorWorkspace}>
        {/* Tools */}
        <div className={styles.toolsPanel}>
          <div className={styles.toolSection}>
            <h4>Información de la Vista</h4>
            <input 
              className={styles.input}
              value={activeView.name}
              onChange={(e) => updateActiveView({ name: e.target.value })}
              placeholder="Ej. Frente"
            />
            <label className={styles.btn}>
              {uploading ? <Loader2 className="animate-spin" size={16} /> : <ImageIcon size={16} />}
              Subir Imagen Base
              <input type="file" hidden accept="image/*" onChange={handleBaseImageUpload} disabled={uploading} />
            </label>
            <button type="button" className={`${styles.btn} ${styles.btnDanger}`} onClick={removeView}>
              <Trash2 size={16} /> Eliminar Vista
            </button>
          </div>

          <div className={styles.toolSection}>
            <h4>Añadir Elementos Default</h4>
            <button type="button" className={styles.btn} onClick={handleAddText}>
              <Type size={16} /> Añadir Texto Libre
            </button>
            <label className={styles.btn}>
              {uploading ? <Loader2 className="animate-spin" size={16} /> : <ImagePlus size={16} />}
              Añadir Diseño / Mockup
              <input type="file" hidden accept="image/*" onChange={handleImageUpload} disabled={uploading} />
            </label>
            
            {activeObjectInfo.isText && (
              <div style={{ marginTop: '1rem', padding: '0.5rem', background: '#fff', borderRadius: '6px', border: '1px solid #ddd' }}>
                <label style={{ fontSize: '0.8rem', color: '#666', display: 'block', marginBottom: '0.25rem' }}>Tipo de Letra:</label>
                <select className={styles.input} value={activeObjectInfo.fontFamily} onChange={handleChangeFont} style={{ marginBottom: 0 }}>
                  {FONTS.map(f => <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>)}
                </select>
              </div>
            )}
            
            {(activeObjectInfo.isText || fabricCanvas?.getActiveObject()) && (
              <button type="button" className={`${styles.btn} ${styles.btnDanger}`} onClick={deleteActiveObject} style={{marginTop: '1rem'}}>
                <Trash2 size={16} /> Quitar Capa
              </button>
            )}
          </div>
        </div>

        {/* Canvas */}
        <div className={styles.canvasContainer}>
          {!activeView.imagesByColor?.default && (
            <div style={{position:'absolute', top:0, left:0, width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', color:'#999'}}>
              Sube la imagen base de la prenda
            </div>
          )}
          <canvas ref={canvasElRef} className={styles.fabricCanvasEl} />
        </div>
      </div>
    </div>
  );
};

export default AdminCustomizationViewsEditor;
