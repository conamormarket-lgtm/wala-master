
const fs = require('fs');
const file = 'src/utils/comboImageComposer.js';
let content = fs.readFileSync(file, 'utf8');

if (!content.includes('generateFullUserComboCartPreview')) {
  // We need to import generateThumbnailWithDesign if not present
  if (!content.includes('generateThumbnailWithDesign')) {
    content = content.replace(
      'import html2canvas from \'html2canvas\';',
      'import html2canvas from \'html2canvas\';\\nimport { generateThumbnailWithDesign } from \'./thumbnailWithDesign\';'
    );
  }

  const newFunc = \n\n
/**
 * Utility para generar el preview de TODO el Combo (Frente y Espalda) para el Carrito/WhatsApp.
 * Itera secuencialmente por todos los ítems y ambos lados.
 */
export const generateFullUserComboCartPreview = async (
  comboProduct,
  userComboCustomization
) => {
  if (!comboProduct || !comboProduct.comboItems) return null;
  const { comboItems, comboLayout } = comboProduct;
  const canvasInstances = [];

  for (let i = 0; i < comboItems.length; i++) {
    const item = comboItems[i];
    const cust = (userComboCustomization || [])[i] || {};
    
    // Si estamos guardando del Editor, customisation.variant = variant
    const colorCode = cust.variant?.color || item.variantMapping?.color || 'default';
    
    // Obtenemos la vista de este producto
    const viewObj = comboProduct.customizationViews?.find(v => v.id === item.viewId) 
                 || comboProduct.customizationViews?.[0] || {};
    
    // ===== FRENTE =====
    let frontImgUrl = viewObj.imagesByColor?.[colorCode] || viewObj.imagesByColor?.default || '';
    if (!frontImgUrl) frontImgUrl = comboProduct.images?.[0] || '';
    
    const vIdFront = \combo-view-\-\\;
    const frontLayers = cust.layersByView?.[vIdFront] || cust.initialLayersByColor?.[colorCode] || [];
    
    try {
      const frontDataUrl = await generateThumbnailWithDesign(frontImgUrl, frontLayers, { maxWidth: 600 });
      const { canvas, scale } = await loadImageAsFabricCanvas(frontDataUrl, item.scale || 1);
      canvasInstances.push({ canvas, scale });
    } catch (err) {
      console.warn('Error capturando frente para item ' + i, err);
    }
    
    // ===== ESPALDA (Si existe) =====
    if (viewObj.hasBackSide && viewObj.backSide) {
      const backImgUrl = viewObj.backSide.imagesByColor?.[colorCode] || viewObj.backSide.imagesByColor?.default || '';
      if (backImgUrl) {
         const vIdBack = \combo-view-\-\-back\;
         const backLayers = cust.layersByView?.[vIdBack] || cust.backSide?.initialLayersByColor?.[colorCode] || [];
         try {
           const backDataUrl = await generateThumbnailWithDesign(backImgUrl, backLayers, { maxWidth: 600 });
           const { canvas, scale } = await loadImageAsFabricCanvas(backDataUrl, item.scale || 1);
           canvasInstances.push({ canvas, scale });
         } catch (err) {
           console.warn('Error capturando espalda para item ' + i, err);
         }
      }
    }
  }

  if (canvasInstances.length === 0) return null;

  // Componer imagen en forma secuencial
  // Usaremos composeComboImage que los formará lado a lado (horizontal) o vertical según layout.
  try {
     return await composeComboImage(canvasInstances, comboLayout || { orientation: 'horizontal', spacing: 20 });
  } catch (err) {
     console.error('Error final en composeComboImage:', err);
     return null;
  }
};
;

  content += newFunc;
  fs.writeFileSync(file, content);
  console.log('Function added successfully!');
} else {
  console.log('Function already exists!');
}

