import React, { useState, useRef, useEffect, forwardRef, useImperativeHandle, useMemo, useCallback } from 'react';
import html2canvas from 'html2canvas';
import { uploadFile } from '../../services/firebase/storage';
import { getProduct, updateProductField } from '../../services/products';
import AdminViewEditor from './WALA_Editor_Export/components/admin/AdminViewEditor/AdminViewEditor';
import { toCanvasImageUrl } from '../../utils/imageUrl';

const YoryoPersonalizado = forwardRef(({ productImage, draftId, isComboProduct, comboItems, onComboItemsChange, onCapture }, ref) => {
  const [isCapturing, setIsCapturing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [activeComboTab, setActiveComboTab] = useState(null);
  const containerRef = useRef(null);

  const [data, setData] = useState({
    Zonas: [],
    "Imagenes del mockup": [],
    Capas: [],
    capturaPersonalizadoDefinido: ''
  });

  // 1. Cargar datos iniciales independientes del form principal
  useEffect(() => {
    const fetchInitialData = async () => {
      if (!draftId) return;
      try {
        const { data: prod } = await getProduct(draftId);
        if (prod && prod.YoryoPersonalizado) {
          setData({
            Zonas: prod.YoryoPersonalizado.Zonas || [],
            "Imagenes del mockup": prod.YoryoPersonalizado["Imagenes del mockup"] || [],
            Capas: prod.YoryoPersonalizado.Capas || [],
            capturaPersonalizadoDefinido: prod.YoryoPersonalizado.capturaPersonalizadoDefinido || ''
          });
        }
      } catch (err) {
        console.error("Error cargando YoryoPersonalizado:", err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchInitialData();
  }, [draftId]);

  // Setear la pestaña inicial del combo si no hay ninguna seleccionada
  useEffect(() => {
    if (isComboProduct && comboItems?.length > 0 && !activeComboTab) {
      const firstWithYoryo = comboItems.find(i => i.YoryoPersonalizado);
      if (firstWithYoryo) {
        const idx = comboItems.indexOf(firstWithYoryo);
        setActiveComboTab(firstWithYoryo._uid || `${firstWithYoryo.productId}_${idx}`);
      }
    }
  }, [isComboProduct, comboItems, activeComboTab]);

  // 2. Guardar en base de datos de manera independiente
  const saveToDatabase = async (newData) => {
    if (!draftId || isComboProduct) return; // En combo se guarda junto con el form principal
    setIsSaving(true);
    try {
      await updateProductField(draftId, { YoryoPersonalizado: newData });
    } catch (err) {
      console.error("Error guardando YoryoPersonalizado:", err);
      alert("Error al guardar la configuración de Yoryo.");
    } finally {
      setIsSaving(false);
    }
  };

  // Exponer métodos al componente padre (AdminProductoFormV2)
  useImperativeHandle(ref, () => ({
    saveYoryoData: async () => {
      if (!isComboProduct) {
        saveToDatabase(data);
        return null;
      } else {
        return await handleSaveAndCapture();
      }
    }
  }));

  const handlePrintAreasChange = (newPrintAreas) => {
    const newData = { ...data, Zonas: newPrintAreas };
    setData(newData);
  };

  const handleLayersChange = (colorKey, layers) => {
    const mappedImages = layers.filter(l => l.type === 'image').map(l => ({
      src: l.src,
      x: l.x, y: l.y, scaleX: l.scaleX, scaleY: l.scaleY, angle: l.angle
    }));
    
    const newData = { 
      ...data, 
      "Imagenes del mockup": mappedImages,
      Capas: layers
    };
    setData(newData);
  };

  const handleSaveAndCapture = async () => {
    if (!containerRef.current) return null;
    
    const captureTarget = containerRef.current.querySelector('[class*="canvasSection"]') || containerRef.current;
    
    setIsCapturing(true);
    
    // Esconder zonas de impresión temporalmente
    window.dispatchEvent(new Event('before-yoryo-capture'));
    // Pequeño delay para asegurar que React/Fabric apliquen los cambios visuales
    await new Promise(resolve => setTimeout(resolve, 100));

    let captureUrl = null;
    try {
      const canvas = await html2canvas(captureTarget, { useCORS: true, backgroundColor: null });
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      const captureFile = new File([blob], `preview_${draftId}.png`, { type: 'image/png' });

      if (isComboProduct) {
        if (onCapture) {
           captureUrl = await onCapture(captureFile);
        }
        window.dispatchEvent(new Event('after-yoryo-capture'));
        setIsCapturing(false);
        return captureUrl;
      } else {
        window.dispatchEvent(new Event('after-yoryo-capture'));
        const path = `YoryoPersonalizado/capturas/${draftId || 'default'}_screenshot.png`;
        const { url, error } = await uploadFile(blob, path);
        
        if (url && !error) {
          const newData = { ...data, capturaPersonalizadoDefinido: url };
          setData(newData);
          await saveToDatabase(newData);
          alert('Configuración y captura guardadas en la base de datos.');
        } else {
          alert('Error al subir captura: ' + error);
        }
        setIsCapturing(false);
        return url;
      }
    } catch (err) {
      console.error(err);
      alert('Error al procesar la captura.');
      window.dispatchEvent(new Event('after-yoryo-capture'));
      setIsCapturing(false);
      setIsSaving(false);
      return captureUrl;
    }
  };

  const initialLayersByColor = { default: data.Capas || [] };

  const customItems = useMemo(() => (comboItems || []).filter(i => i.YoryoPersonalizado), [comboItems]);
  const N = customItems.length;

  const [combinedImageUrl, setCombinedImageUrl] = useState(null);

  useEffect(() => {
    if (!isComboProduct || N === 0) return;

    let isMounted = true;
    const generateImage = async () => {
      const loadedImages = await Promise.all(
        customItems.map(item => {
          return new Promise(resolve => {
            if (!item.imageUrl) {
              resolve(null);
              return;
            }
            const img = new Image();
            img.crossOrigin = "anonymous";
            // Usa toCanvasImageUrl para evitar CORS
            img.src = toCanvasImageUrl(item.imageUrl) || item.imageUrl;
            img.onload = () => resolve(img);
            img.onerror = () => resolve(null);
          });
        })
      );

      if (!isMounted) return;

      const CELL_WIDTH = 500;
      const CELL_HEIGHT = 600;
      
      const canvas = document.createElement('canvas');
      canvas.width = CELL_WIDTH * N;
      canvas.height = CELL_HEIGHT;
      const ctx = canvas.getContext('2d');

      let currentX = 0;
      loadedImages.forEach((img, idx) => {
        if (img) {
          const scale = Math.min(CELL_WIDTH / img.width, CELL_HEIGHT / img.height);
          const drawW = img.width * scale;
          const drawH = img.height * scale;
          const dx = currentX + (CELL_WIDTH - drawW) / 2;
          const dy = (CELL_HEIGHT - drawH) / 2;
          ctx.drawImage(img, dx, dy, drawW, drawH);
        } else {
          ctx.fillStyle = "#f3f4f6";
          ctx.fillRect(currentX, 0, CELL_WIDTH, CELL_HEIGHT);
          ctx.fillStyle = "#9ca3af";
          ctx.font = "20px Arial";
          ctx.textAlign = "center";
          ctx.fillText(customItems[idx].name, currentX + CELL_WIDTH / 2, CELL_HEIGHT / 2);
        }
        currentX += CELL_WIDTH;
      });

      setCombinedImageUrl(canvas.toDataURL('image/png'));
    };

    generateImage();

    return () => { isMounted = false; };
  }, [isComboProduct, customItems, N]);

  const unifiedPrintAreas = useMemo(() => {
     if (N === 0) return [];
     let unified = [];
     customItems.forEach((item, i) => {
        const zonas = item.YoryoPersonalizado?.Zonas || [];
        zonas.forEach(z => {
          unified.push({ ...z, id: z.id ? `${z.id}_product_${i}` : z.id, width: z.width / N, x: (i * 100 / N) + (z.x / N) });
        });
     });
     return unified;
  }, [customItems, N]);

  const unifiedLayers = useMemo(() => {
     if (N === 0) return { default: [] };
     const CELL_WIDTH = 500;
     const CELL_HEIGHT = 600;
     let unified = [];
     customItems.forEach((item, i) => {
        const capas = item.YoryoPersonalizado?.Capas || [];
        capas.forEach(c => {
          const scaleRatioX = c.baseW ? (CELL_WIDTH / c.baseW) : 1;
          const scaleRatioY = c.baseH ? (CELL_HEIGHT / c.baseH) : scaleRatioX;
          
          let scaledFontSize = c.fontSize;
          if (c.fontSize && (c.type === 'i-text' || c.type === 'text')) {
             scaledFontSize = c.fontSize * scaleRatioY;
          }

          unified.push({
            ...c,
            id: c.id ? `${c.id}_product_${i}` : c.id,
            customId: c.customId ? `${c.customId}_product_${i}` : c.customId,
            baseW: CELL_WIDTH * N,
            baseH: CELL_HEIGHT,
            x: (c.x * scaleRatioX) + (i * CELL_WIDTH),
            y: c.y * scaleRatioY,
            scaleX: (c.scaleX || 1) * scaleRatioX,
            scaleY: (c.scaleY || 1) * scaleRatioY,
            fontSize: scaledFontSize,
          });
        });
     });
     return { default: unified };
  }, [customItems, N]);

  const latestComboItemsRef = useRef(comboItems);
  useEffect(() => {
    latestComboItemsRef.current = comboItems;
  }, [comboItems]);

  const handleUnifiedPrintAreasChange = useCallback((newZones) => {
    if (!onComboItemsChange) return;
    const currentComboItems = latestComboItemsRef.current || [];
    const newComboItems = [...currentComboItems];
    
    customItems.forEach(item => {
      const idx = currentComboItems.findIndex(ci => (ci._uid && ci._uid === item._uid) || ci === item);
      if (idx !== -1 && newComboItems[idx].YoryoPersonalizado) {
         newComboItems[idx] = {
           ...newComboItems[idx],
           YoryoPersonalizado: { ...newComboItems[idx].YoryoPersonalizado, Zonas: [] }
         };
      }
    });

    newZones.forEach(z => {
      const absPos = z.x * N / 100;
      let cellIndex = Math.floor(absPos);
      if (cellIndex < 0) cellIndex = 0;
      if (cellIndex >= N) cellIndex = N - 1;

      const item = customItems[cellIndex];
      const originalIdx = currentComboItems.findIndex(ci => (ci._uid && ci._uid === item._uid) || ci === item);
      
      const localX = (absPos - cellIndex) * 100;
      
      if (originalIdx !== -1 && newComboItems[originalIdx].YoryoPersonalizado) {
        newComboItems[originalIdx].YoryoPersonalizado.Zonas.push({
          ...z,
          id: z.id ? String(z.id).replace(/_product_\d+$/, '') : z.id,
          width: z.width * N,
          x: localX
        });
      }
    });

    latestComboItemsRef.current = newComboItems;
    onComboItemsChange(newComboItems);
  }, [customItems, N, onComboItemsChange]);

  const handleUnifiedLayersChange = useCallback((color, newLayers) => {
    if (!onComboItemsChange) return;
    const CELL_WIDTH = 500;
    const unifiedW = CELL_WIDTH * N;
    const currentComboItems = latestComboItemsRef.current || [];
    const newComboItems = [...currentComboItems];
    
    customItems.forEach(item => {
      const idx = currentComboItems.findIndex(ci => (ci._uid && ci._uid === item._uid) || ci === item);
      if (idx !== -1 && newComboItems[idx].YoryoPersonalizado) {
         newComboItems[idx] = {
           ...newComboItems[idx],
           YoryoPersonalizado: { 
             ...newComboItems[idx].YoryoPersonalizado, 
             Capas: [], 
             "Imagenes del mockup": [] 
           }
         };
      }
    });

    newLayers.forEach(layer => {
      const scaleToUnified = layer.baseW ? (unifiedW / layer.baseW) : 1;
      const absX = layer.x * scaleToUnified;
      let cellIndex = Math.floor(absX / CELL_WIDTH);
      
      if (cellIndex < 0) cellIndex = 0;
      if (cellIndex >= N) cellIndex = N - 1;

      const item = customItems[cellIndex];
      const originalIdx = currentComboItems.findIndex(ci => (ci._uid && ci._uid === item._uid) || ci === item);
      
      const localX = absX - (cellIndex * CELL_WIDTH);
      const localLayer = {
        ...layer,
        id: layer.id ? String(layer.id).replace(/_product_\d+$/, '') : layer.id,
        customId: layer.customId ? String(layer.customId).replace(/_product_\d+$/, '') : layer.customId,
        baseW: CELL_WIDTH,
        baseH: 600,
        x: localX,
      };

      if (originalIdx !== -1 && newComboItems[originalIdx].YoryoPersonalizado) {
        newComboItems[originalIdx].YoryoPersonalizado.Capas.push(localLayer);
        if (localLayer.type === 'image') {
           newComboItems[originalIdx].YoryoPersonalizado["Imagenes del mockup"].push({
               src: localLayer.src, x: localLayer.x, y: localLayer.y, scaleX: localLayer.scaleX, scaleY: localLayer.scaleY, angle: localLayer.angle
           });
        }
      }
    });

    latestComboItemsRef.current = newComboItems;
    onComboItemsChange(newComboItems);
  }, [customItems, N, onComboItemsChange]);

  if (isLoading) {
    return <div style={{ padding: '20px', textAlign: 'center' }}>Cargando editor personalizado...</div>;
  }

  return (
    <div ref={containerRef} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px', background: '#fff', borderRadius: '8px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #eee', paddingBottom: '10px', flexWrap: 'wrap', gap: '10px' }}>
        <h3 style={{ margin: 0, fontSize: '1.25rem', color: '#333' }}>Yoryo Personalizado - Editor Integrado</h3>
        
        {!isComboProduct && (
          <div style={{ display: 'flex', gap: '10px' }}>
            <button 
              type="button" 
              onClick={() => saveToDatabase(data)}
              disabled={isSaving || isCapturing}
              style={{ padding: '8px 16px', background: '#f3f4f6', color: '#374151', borderRadius: '4px', border: '1px solid #d1d5db', cursor: isSaving ? 'not-allowed' : 'pointer', fontWeight: 'bold' }}
            >
              {isSaving ? 'Guardando...' : '💾 Guardar Datos'}
            </button>
            <button 
              type="button" 
              onClick={handleSaveAndCapture}
              disabled={isCapturing || isSaving}
              style={{ padding: '8px 16px', background: '#000', color: '#fff', borderRadius: '4px', border: 'none', cursor: isCapturing ? 'not-allowed' : 'pointer', fontWeight: 'bold' }}
            >
              {isCapturing ? 'Capturando...' : '📸 Guardar y Generar Captura'}
            </button>
          </div>
        )}
      </div>
      
      {isComboProduct ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <p style={{ fontSize: '0.9rem', color: '#666', margin: 0 }}>
            Este es un producto Combo unificado. Ambos productos comparten un solo lienzo maestro. Las áreas y diseños se asignarán automáticamente al producto correspondiente basándose en su ubicación (lado izquierdo o derecho).
          </p>

          {N > 0 ? (
            <div style={{ padding: '15px', border: '1px solid #e5e7eb', borderRadius: '8px', background: '#f9fafb' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                {customItems.map((item, idx) => (
                  <h4 key={idx} style={{ margin: 0, fontSize: '0.9rem', color: '#333', textAlign: 'center', flex: 1 }}>
                    {item.name} <br/> <span style={{ fontSize: '0.75rem', color: '#666' }}>(Producto #{idx + 1})</span>
                  </h4>
                ))}
              </div>
              
              {!combinedImageUrl ? (
                <div style={{ padding: '40px', textAlign: 'center', color: '#666' }}>Generando lienzo unificado...</div>
              ) : (
                <AdminViewEditor
                  viewId={`combo_view_master`}
                  productImage={combinedImageUrl}
                  printAreas={unifiedPrintAreas}
                  initialLayersByColor={unifiedLayers}
                  currentColor="default"
                  onPrintAreasChange={handleUnifiedPrintAreasChange}
                  onLayersChange={handleUnifiedLayersChange}
                />
              )}
            </div>
          ) : (
            <div style={{ padding: '20px', textAlign: 'center', background: '#f8f9fa', border: '1px dashed #ccc', borderRadius: '8px' }}>
              <p style={{ margin: 0, color: '#666' }}>Ninguno de los productos agregados a este combo tiene opciones de personalización (YoryoPersonalizado).</p>
            </div>
          )}
        </div>
      ) : (
        <>
          <p style={{ fontSize: '0.9rem', color: '#666', margin: 0 }}>
            Dibuja las zonas de impresión y añade el diseño base. La información se guarda de manera independiente al formulario principal pulsando en los botones superiores.
          </p>

          <AdminViewEditor
            viewId="yoryo_default_view"
            productImage={productImage}
            printAreas={data.Zonas || []}
            initialLayersByColor={initialLayersByColor}
            currentColor="default"
            onPrintAreasChange={handlePrintAreasChange}
            onLayersChange={handleLayersChange}
          />

          {data.capturaPersonalizadoDefinido && (
            <div style={{ marginTop: '15px', padding: '15px', background: '#f8f9fa', borderRadius: '8px', border: '1px dashed #ccc', display: 'flex', gap: '15px', alignItems: 'center' }}>
              <img src={data.capturaPersonalizadoDefinido} alt="Captura generada" style={{ width: '100px', height: 'auto', borderRadius: '4px', border: '1px solid #eee', objectFit: 'contain' }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', overflow: 'hidden' }}>
                <span style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#333' }}>✅ Captura guardada exitosamente</span>
                <span style={{ fontSize: '0.8rem', color: '#666' }}>URL de la imagen:</span>
                <a href={data.capturaPersonalizadoDefinido} target="_blank" rel="noreferrer" style={{ fontSize: '0.8rem', color: '#0066cc', wordBreak: 'break-all', textDecoration: 'underline' }}>
                  {data.capturaPersonalizadoDefinido}
                </a>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
});

export default YoryoPersonalizado;
