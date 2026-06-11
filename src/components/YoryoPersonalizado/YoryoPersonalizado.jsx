import React, { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import html2canvas from 'html2canvas';
import { uploadFile } from '../../services/firebase/storage';
import { getProduct, updateProductField } from '../../services/products';
import AdminViewEditor from './WALA_Editor_Export/components/admin/AdminViewEditor/AdminViewEditor';

const YoryoPersonalizado = forwardRef(({ productImage, draftId }, ref) => {
  const [isCapturing, setIsCapturing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
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

  // 2. Guardar en base de datos de manera independiente
  const saveToDatabase = async (newData) => {
    if (!draftId) return;
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
    saveYoryoData: () => saveToDatabase(data)
  }));

  const handlePrintAreasChange = (newPrintAreas) => {
    const newData = { ...data, Zonas: newPrintAreas };
    setData(newData);
    // Podrías hacer autosave aquí, pero es mejor requerir guardar explícitamente para evitar exceso de escrituras
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
    if (!containerRef.current) return;
    
    const captureTarget = containerRef.current.querySelector('[class*="canvasSection"]') || containerRef.current;
    
    setIsCapturing(true);
    
    // Esconder zonas de impresión temporalmente
    window.dispatchEvent(new Event('before-yoryo-capture'));
    // Pequeño delay para asegurar que React/Fabric apliquen los cambios visuales
    await new Promise(resolve => setTimeout(resolve, 100));

    try {
      const canvas = await html2canvas(captureTarget, { useCORS: true, backgroundColor: null });
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      
      // Restaurar zonas de impresión
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
    } catch (err) {
      console.error(err);
      alert('Error al procesar la captura.');
      window.dispatchEvent(new Event('after-yoryo-capture')); // Restaurar por si hay error
    } finally {
      setIsCapturing(false);
    }
  };

  const initialLayersByColor = { default: data.Capas || [] };

  if (isLoading) {
    return <div style={{ padding: '20px', textAlign: 'center' }}>Cargando editor personalizado...</div>;
  }

  return (
    <div ref={containerRef} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px', background: '#fff', borderRadius: '8px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #eee', paddingBottom: '10px', flexWrap: 'wrap', gap: '10px' }}>
        <h3 style={{ margin: 0, fontSize: '1.25rem', color: '#333' }}>Yoryo Personalizado - Editor Integrado</h3>
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
      </div>
      
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
    </div>
  );
});

export default YoryoPersonalizado;
