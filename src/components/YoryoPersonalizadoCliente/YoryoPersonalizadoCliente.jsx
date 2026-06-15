import React, { useState, useRef } from 'react';
import html2canvas from 'html2canvas';
import { getStorage, ref, uploadString, getDownloadURL } from 'firebase/storage';
import AdminViewEditor from '../YoryoPersonalizado/WALA_Editor_Export/components/admin/AdminViewEditor/AdminViewEditor';
import { EditorProvider } from '../YoryoPersonalizado/WALA_Editor_Export/contexts/EditorContext';
import { createCustomerCustomProduct } from '../../services/customerCustomProducts';
import styles from './YoryoPersonalizadoCliente.module.css';

const YoryoPersonalizadoClienteContent = ({ productData, existingDesignData, onSaved }) => {
  const [isSaving, setIsSaving] = useState(false);
  const containerRef = useRef(null);
  
  // Extraemos la info de Yoryo (configurada por el admin o proveniente de un diseño previo)
  const adminYoryo = productData?.YoryoPersonalizado || {
    Zonas: [],
    Capas: [],
    "Imagenes del mockup": [],
  };

  // Si hay un diseño previo, usamos las capas del diseño del cliente. Si no, usamos las capas base del admin.
  const [clientLayers, setClientLayers] = useState(
    existingDesignData ? existingDesignData.YoryoPersonalizado?.Capas || [] : adminYoryo.Capas || []
  );

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // 1. Ocultar bordes de selección de Fabric y preparar para captura
      window.dispatchEvent(new Event('before-yoryo-capture'));
      
      // Esperar un tick
      await new Promise(resolve => setTimeout(resolve, 100));

      // 2. Tomar captura con html2canvas
      const canvasEl = containerRef.current?.querySelector('canvas');
      let captureUrl = '';
      if (canvasEl) {
        // En este punto, podríamos tomar captura del canvas de fabric o del contenedor
        // El contenedor incluye el fondo, lo cual es ideal para el cliente
        const printContainer = containerRef.current.querySelector('.canvas-container')?.parentElement;
        if (printContainer) {
           const finalCanvas = await html2canvas(printContainer, { useCORS: true, backgroundColor: null });
           const dataUrl = finalCanvas.toDataURL('image/jpeg', 0.85);
           
           // Subir a Firebase Storage
           const storage = getStorage();
           const filename = `customer_designs/${productData.id}_${Date.now()}.jpg`;
           const storageRef = ref(storage, filename);
           await uploadString(storageRef, dataUrl, 'data_url');
           captureUrl = await getDownloadURL(storageRef);
        }
      }

      window.dispatchEvent(new Event('after-yoryo-capture'));

      // 3. Mapear las capas para las "Imagenes del mockup"
      const mappedImages = clientLayers.filter(l => l.type === 'image').map(l => ({
        src: l.src,
        x: l.x,
        y: l.y,
        scaleX: l.scaleX,
        scaleY: l.scaleY,
        angle: l.angle
      }));

      const finalYoryoData = {
        ...adminYoryo,
        Capas: clientLayers,
        "Imagenes del mockup": mappedImages,
        capturaPersonalizadoDefinido: captureUrl || adminYoryo.capturaPersonalizadoDefinido
      };

      // 4. Crear el clon en la base de datos de cliente
      const customProduct = await createCustomerCustomProduct(productData, finalYoryoData);

      if (customProduct.error) {
        throw new Error(customProduct.error);
      }

      // 5. Devolver producto personalizado para meter al carrito
      const finalProductObj = {
        ...productData,
        ...customProduct, // Sobrescribe con el ID nuevo y bandera isCustomerCustomized
        id: customProduct.id,
        YoryoPersonalizado: finalYoryoData,
        price: productData.price, // asegurar que conserve precio
      };

      onSaved(finalProductObj);

    } catch (error) {
      console.error("Error guardando personalización:", error);
      alert("Hubo un error guardando tu diseño. Por favor intenta de nuevo.");
      window.dispatchEvent(new Event('after-yoryo-capture'));
    } finally {
      setIsSaving(false);
    }
  };

  const fallbackImage = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
  const baseImage = productData.isComboProduct 
    ? productData.comboPreviewImage 
    : productData.variants?.[0]?.designImage || productData.variants?.[0]?.imageUrl || productData.mainImage;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2>Personaliza tu producto</h2>
        <button 
          className={styles.saveButton} 
          onClick={handleSave} 
          disabled={isSaving}
        >
          {isSaving ? 'Generando tu diseño...' : '✅ Guardar y Añadir al Carrito'}
        </button>
      </div>

      <div className={styles.editorWrapper} ref={containerRef}>
        <div className={styles.editorInner}>
          <AdminViewEditor
            viewId="yoryo_default_view"
            productImage={baseImage || fallbackImage}
            printAreas={adminYoryo.Zonas || []}
            initialLayersByColor={{ default: existingDesignData ? existingDesignData.YoryoPersonalizado?.Capas || [] : adminYoryo.Capas || [] }}
            currentColor="default"
            onLayersChange={(color, layers) => setClientLayers(layers)}
            designOnly={true} // Modo cliente puro
            noHeader={true}
          />
        </div>
      </div>
    </div>
  );
};

export default function YoryoPersonalizadoCliente(props) {
  return (
    <EditorProvider>
      <YoryoPersonalizadoClienteContent {...props} />
    </EditorProvider>
  );
}
