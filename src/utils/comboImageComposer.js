import { getCloudinaryOptimized } from '../components/common/OptimizedImage/OptimizedImage';
import { toDirectImageUrl, toCanvasImageUrl, isGoogleDriveUrl, isFirebaseStorageUrl, ensureSingleImageUrl } from './imageUrl';
import html2canvas from 'html2canvas';
import { generateThumbnailWithDesign } from './thumbnailWithDesign';

/**
 * Crea un canvas nativo de placeholder cuando una imagen no puede cargarse (p. ej. CORS).
 * Así el editor combo puede mostrarse igual y el usuario no pierde el diseño.
 */
function createPlaceholderCanvas(width = 400, height = 400) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#f0f0f0';
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = '#999';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Imagen no disponible', width / 2, height / 2);
  }
  return canvas;
}

/**
 * Carga una imagen desde URL y la devuelve como canvas nativo (para componer).
 * Usa crossOrigin 'anonymous' para poder exportar; si la imagen viene de otro dominio
 * sin CORS, fallará.
 * @param {string} imageUrl - URL de la imagen (puede ser Google Drive; se convierte con toDirectImageUrl)
 * @param {number} scale - Escala a aplicar (1 = tamaño original)
 * @returns {Promise<{ canvas: HTMLCanvasElement, scale: number }>}
 */
const loadImageElement = (url) => new Promise((resolve, reject) => {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => resolve(img);
  img.onerror = () => reject(new Error(`Error al cargar imagen: ${url}`));
  img.src = url;
});

export const loadImageAsFabricCanvas = async (imageUrl, scale = 1) => {
  const optimized = getCloudinaryOptimized(imageUrl);
  const single = ensureSingleImageUrl(optimized);
  if (!single) throw new Error('URL de imagen no válida');
  const directUrl = toDirectImageUrl(single);
  const canvasUrl = toCanvasImageUrl(single);
  const isDriveOrFirebase =
    isGoogleDriveUrl(single) || isFirebaseStorageUrl(single) ||
    isGoogleDriveUrl(directUrl) || isFirebaseStorageUrl(directUrl);

  const addCacheBuster = (url) => {
    if (!url || url.startsWith('data:')) return url;
    try {
      const u = new URL(url);
      u.searchParams.set('_cb', Date.now() + '_' + Math.random().toString(36).substr(2, 5));
      return u.toString();
    } catch {
      return url + (url.includes('?') ? '&' : '?') + '_cb=' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
    }
  };

  const baseUrls = [];
  if (isDriveOrFirebase) {
    baseUrls.push(canvasUrl, directUrl, single);
  } else {
    baseUrls.push(directUrl, single);
  }
  
  const urlsWithCb = [];
  baseUrls.filter(Boolean).forEach(u => {
    urlsWithCb.push(u);
    urlsWithCb.push(addCacheBuster(u));
    if (u.startsWith('http')) {
      urlsWithCb.push(`https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`);
    }
  });

  const tried = new Set();
  let lastError = null;

  for (const url of urlsWithCb) {
    const clean = typeof url === 'string' ? url.trim() : '';
    if (!clean || tried.has(clean)) continue;
    tried.add(clean);
    try {
      let objectUrlToCleanup = null;
      let finalUrlToLoad = clean;
      
      // Intentar fetch primero si es firebase para saltar caché envenenada de Chrome
      if (clean.includes('firebasestorage') && !clean.includes('allorigins')) {
          try {
              const res = await fetch(clean, { mode: 'cors', cache: 'reload' });
              if (res.ok) {
                  const blob = await res.blob();
                  finalUrlToLoad = URL.createObjectURL(blob);
                  objectUrlToCleanup = finalUrlToLoad;
              }
          } catch(e) {
             // Ignorar y seguir con carga normal
          }
      }

      const img = await loadImageElement(finalUrlToLoad);
      if (objectUrlToCleanup) URL.revokeObjectURL(objectUrlToCleanup);
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('No se pudo obtener contexto 2D para componer la imagen');
      }
      ctx.drawImage(img, 0, 0);
      return { canvas, scale };
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error('Error al cargar la imagen');
};

/**
 * Genera la imagen compuesta del combo como data URL (para usar en admin: generar y subir).
 * @param {Array<Object>} comboItems - Items del combo ({ productId, viewId, scale, variantMapping, ... })
 * @param {Object} comboLayout - { orientation: 'horizontal' | 'vertical', spacing: number }
 * @param {Function} getImageUrlForItem - Async (item, index) => Promise<{ imageUrl: string, scale: number } | null>
 * @returns {Promise<string>} Data URL PNG de la imagen compuesta
 */
export const generateComboPreviewDataUrl = async (comboItems, comboLayout, getImageUrlForItem) => {
  if (!comboItems || comboItems.length === 0) {
    throw new Error('El combo no tiene productos');
  }

  const canvasInstances = [];

  for (let i = 0; i < comboItems.length; i++) {
    const item = comboItems[i];
    try {
      const resolved = await getImageUrlForItem(item, i);
      if (!resolved || !resolved.imageUrl) continue;

      const { canvas, scale } = await loadImageAsFabricCanvas(
        resolved.imageUrl,
        typeof resolved.scale === 'number' && resolved.scale > 0 ? resolved.scale : 1
      );
      canvasInstances.push({ canvas, scale });
    } catch (err) {
      console.error(`Error loading image for combo item ${i}:`, err);
    }
  }

  if (canvasInstances.length === 0) {
    throw new Error('No se pudieron cargar las imágenes de los productos del combo');
  }

  return composeComboImage(canvasInstances, comboLayout);
};

/**
 * Compone múltiples canvases de Fabric.js en una sola imagen
 * @param {Array<Object>} canvasInstances - Array de objetos { canvas: Fabric.Canvas, scale?: number }
 * @param {Object} layout - { orientation: 'horizontal' | 'vertical', spacing: number }
 * @returns {Promise<string>} Data URL de la imagen compuesta
 */
export const composeComboImage = async (canvasInstances, layout) => {
  if (!canvasInstances || canvasInstances.length === 0) {
    throw new Error('Se requiere al menos un canvas');
  }

  const { orientation = 'horizontal', spacing = 20 } = layout || {};
  const isHorizontal = orientation === 'vertical' ? false : true;

  // Calcular dimensiones totales
  let totalWidth = 0;
  let totalHeight = 0;
  const canvasData = [];

  const getCanvasWidth = (canvas) => {
    if (!canvas) return 0;
    if (typeof canvas.getWidth === 'function') return canvas.getWidth();
    return Number(canvas.width) || 0;
  };

  const getCanvasHeight = (canvas) => {
    if (!canvas) return 0;
    if (typeof canvas.getHeight === 'function') return canvas.getHeight();
    return Number(canvas.height) || 0;
  };

  const canvasToDataUrl = (canvas) => {
    if (!canvas || typeof canvas.toDataURL !== 'function') {
      throw new Error('Canvas inválido para exportar imagen');
    }
    try {
      // Soporte para Fabric.js
      return canvas.toDataURL({ format: 'png', quality: 1, multiplier: 1 });
    } catch (_) {
      // Soporte para canvas nativo
      return canvas.toDataURL('image/png', 1.0);
    }
  };

  for (let i = 0; i < canvasInstances.length; i++) {
    const item = canvasInstances[i];
    const canvas = item.canvas;
    if (!canvas) continue;

    const scale = item.scale || 1;
    const width = getCanvasWidth(canvas) * scale;
    const height = getCanvasHeight(canvas) * scale;

    canvasData.push({
      canvas,
      scale,
      width,
      height
    });

    if (isHorizontal) {
      totalWidth += width + (i < canvasInstances.length - 1 ? spacing : 0);
      totalHeight = Math.max(totalHeight, height);
    } else {
      totalWidth = Math.max(totalWidth, width);
      totalHeight += height + (i < canvasInstances.length - 1 ? spacing : 0);
    }
  }

  if (totalWidth === 0 || totalHeight === 0) {
    throw new Error('No se pudieron calcular las dimensiones del combo');
  }

  // Hacer que el canvas final sea siempre un CUADRADO PERFECTO (1:1) para evitar estiramiento en ProductCard
  // o aplastamiento en ProductDetail.
  const finalSize = Math.max(totalWidth, totalHeight);

  // Crear canvas temporal para la composición
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = finalSize;
  tempCanvas.height = finalSize;
  const ctx = tempCanvas.getContext('2d');

  // Fondo transparente o blanco (prioriza blanco para mantener consistencia)
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, finalSize, finalSize);

  // Calcular offsets para centrar el combo en el lienzo cuadrado
  const offsetX = (finalSize - totalWidth) / 2;
  const offsetY = (finalSize - totalHeight) / 2;

  // Renderizar cada canvas en su posición central
  let currentX = offsetX;
  let currentY = offsetY;

  for (const item of canvasData) {
    const { canvas, width, height } = item;

    // Exportar canvas a imagen
    const canvasDataUrl = canvasToDataUrl(canvas);

    // Crear imagen desde data URL
    const img = await new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = canvasDataUrl;
    });

    // Dibujar imagen escalada en posición
    ctx.save();
    ctx.drawImage(img, currentX, currentY, width, height);
    ctx.restore();

    // Actualizar posición para el siguiente canvas
    if (isHorizontal) {
      currentX += width + spacing;
    } else {
      currentY += height + spacing;
    }
  }

  // Convertir a data URL (Usar webp para reducir drásticamente el peso y no romper Firestore)
  return tempCanvas.toDataURL('image/webp', 0.85);
};

/**
 * Compone múltiples canvases y devuelve data URL + bounds de cada ítem (posición en px en la imagen compuesta).
 * @param {Array<Object>} canvasInstances - Array de { canvas, scale? }
 * @param {Object} layout - { orientation, spacing }
 * @returns {Promise<{ dataUrl: string, totalWidth: number, totalHeight: number, itemBounds: Array<{ x: number, y: number, width: number, height: number }> }>}
 */
export const composeComboImageWithBounds = async (canvasInstances, layout) => {
  if (!canvasInstances || canvasInstances.length === 0) {
    throw new Error('Se requiere al menos un canvas');
  }

  const { orientation = 'horizontal', spacing = 20 } = layout || {};
  const isHorizontal = orientation === 'vertical' ? false : true;

  let totalWidth = 0;
  let totalHeight = 0;
  const canvasData = [];

  const getCanvasWidth = (canvas) => {
    if (!canvas) return 0;
    if (typeof canvas.getWidth === 'function') return canvas.getWidth();
    return Number(canvas.width) || 0;
  };

  const getCanvasHeight = (canvas) => {
    if (!canvas) return 0;
    if (typeof canvas.getHeight === 'function') return canvas.getHeight();
    return Number(canvas.height) || 0;
  };

  const canvasToDataUrl = (canvas) => {
    if (!canvas || typeof canvas.toDataURL !== 'function') {
      throw new Error('Canvas inválido para exportar imagen');
    }
    try {
      return canvas.toDataURL({ format: 'png', quality: 1, multiplier: 1 });
    } catch (_) {
      return canvas.toDataURL('image/png', 1.0);
    }
  };

  for (let i = 0; i < canvasInstances.length; i++) {
    const item = canvasInstances[i];
    const canvas = item.canvas;
    if (!canvas) continue;

    const scale = item.scale || 1;
    const width = getCanvasWidth(canvas) * scale;
    const height = getCanvasHeight(canvas) * scale;

    canvasData.push({ canvas, scale, width, height });

    if (isHorizontal) {
      totalWidth += width + (i < canvasInstances.length - 1 ? spacing : 0);
      totalHeight = Math.max(totalHeight, height);
    } else {
      totalWidth = Math.max(totalWidth, width);
      totalHeight += height + (i < canvasInstances.length - 1 ? spacing : 0);
    }
  }

  const itemBounds = [];
  if (isHorizontal) {
    let currentX = 0;
    for (let i = 0; i < canvasData.length; i++) {
      itemBounds.push({
        x: currentX,
        y: 0,
        width: canvasData[i].width,
        height: canvasData[i].height
      });
      currentX += canvasData[i].width + (i < canvasData.length - 1 ? spacing : 0);
    }
  } else {
    let currentY = 0;
    for (let i = 0; i < canvasData.length; i++) {
      itemBounds.push({
        x: 0,
        y: currentY,
        width: canvasData[i].width,
        height: canvasData[i].height
      });
      currentY += canvasData[i].height + (i < canvasData.length - 1 ? spacing : 0);
    }
  }

  const finalSize = Math.max(totalWidth, totalHeight);
  const offsetX = (finalSize - totalWidth) / 2;
  const offsetY = (finalSize - totalHeight) / 2;

  // Actualizar los bounds para que reflejen el nuevo padding
  const centeredBounds = itemBounds.map(b => ({
    ...b,
    x: b.x + offsetX,
    y: b.y + offsetY
  }));

  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = finalSize;
  tempCanvas.height = finalSize;
  const ctx = tempCanvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, finalSize, finalSize);

  let currentX = offsetX;
  let currentY = offsetY;

  for (const item of canvasData) {
    const { canvas, width, height } = item;
    const canvasDataUrl = canvasToDataUrl(canvas);
    const img = await new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = canvasDataUrl;
    });
    ctx.drawImage(img, currentX, currentY, width, height);
    if (isHorizontal) {
      currentX += width + spacing;
    } else {
      currentY += height + spacing;
    }
  }

  const dataUrl = tempCanvas.toDataURL('image/webp', 0.85);
  return { dataUrl, totalWidth: finalSize, totalHeight: finalSize, itemBounds: centeredBounds };
};

/**
 * Genera la imagen compuesta del combo con bounds (para editor unificado).
 * @param {Array<Object>} comboItems
 * @param {Object} comboLayout
 * @param {Function} getImageUrlForItem - Async (item, index) => Promise<{ imageUrl: string, scale: number } | null>
 * @returns {Promise<{ dataUrl: string, totalWidth: number, totalHeight: number, itemBounds: Array }>}
 */
export const generateComboPreviewDataUrlWithBounds = async (comboItems, comboLayout, getImageUrlForItem) => {
  if (!comboItems || comboItems.length === 0) {
    throw new Error('El combo no tiene productos');
  }

  const canvasInstances = [];

  for (let i = 0; i < comboItems.length; i++) {
    const item = comboItems[i];
    try {
      const resolved = await getImageUrlForItem(item, i);
      if (!resolved || !resolved.imageUrl) {
        canvasInstances.push({ canvas: createPlaceholderCanvas(400, 400), scale: 1 });
        continue;
      }

      const { canvas, scale } = await loadImageAsFabricCanvas(
        resolved.imageUrl,
        typeof resolved.scale === 'number' && resolved.scale > 0 ? resolved.scale : 1
      );
      canvasInstances.push({ canvas, scale });
    } catch (err) {
      if (typeof console !== 'undefined' && console.debug) {
        console.debug('Combo: imagen no cargada (CORS/URL inválida). Abortando composición para usar Fallback.', err?.message || err);
      }
      throw err;
    }
  }

  return composeComboImageWithBounds(canvasInstances, comboLayout);
};

/**
 * Genera preview del combo desde productos y variantes seleccionadas
 * @param {Object} product - Producto combo
 * @param {Object} variantSelections - { [itemIndex]: { size?, color? } }
 * @returns {Promise<string>} Data URL de la imagen compuesta
 */
export const generateComboPreview = async (product, variantSelections = {}) => {
  if (!product?.isComboProduct || !product.comboItems || product.comboItems.length === 0) {
    throw new Error('Producto no es un combo válido');
  }

  const { orientation = 'horizontal', spacing = 20 } = product.comboLayout || {};
  const isHorizontal = orientation === 'vertical' ? false : true;

  // Cargar imágenes de cada producto según variantes
  const images = [];
  let totalWidth = 0;
  let totalHeight = 0;

  for (let i = 0; i < product.comboItems.length; i++) {
    const item = product.comboItems[i];
    const variant = variantSelections[i] || {};

    try {
      // En una implementación completa, aquí cargaríamos el producto
      // y obtendríamos la imagen según la variante seleccionada
      // Por ahora, retornamos null para que se use comboPreviewImage si existe
      images.push(null);
    } catch (error) {
      console.error(`Error loading image for combo item ${i}:`, error);
      images.push(null);
    }
  }

  // Si hay imágenes cargadas, componerlas
  // Por ahora, retornamos null para indicar que se debe usar comboPreviewImage
  return null;
};

/**
 * Convierte un canvas de Fabric.js a blob
 * @param {Fabric.Canvas} canvas - Canvas de Fabric.js
 * @param {string} format - Formato de imagen ('png' | 'jpeg')
 * @param {number} quality - Calidad (0-1) para JPEG
 * @returns {Promise<Blob>}
 */
export const canvasToBlob = (canvas, format = 'png', quality = 1.0) => {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error('Error al convertir canvas a blob'));
      }
    }, `image/${format}`, quality);
  });
};

/**
 * Verifica que todas las imágenes dentro de un elemento estén completamente cargadas
 * @param {HTMLElement} element - Elemento DOM que contiene las imágenes
 * @returns {Promise<void>}
 */
const waitForImagesToLoad = (element) => {
  const images = element.querySelectorAll('img');
  if (images.length === 0) {
    return Promise.resolve();
  }

  return Promise.all(
    Array.from(images).map((img) => {
      if (img.complete && img.naturalWidth > 0) {
        return Promise.resolve();
      }
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error(`Timeout esperando imagen: ${img.src}`));
        }, 10000); // 10 segundos timeout

        img.onload = () => {
          clearTimeout(timeout);
          resolve();
        };
        img.onerror = () => {
          clearTimeout(timeout);
          reject(new Error(`Error cargando imagen: ${img.src}`));
        };
      });
    })
  );
};

/**
 * Captura el preview HTML del combo como imagen usando html2canvas
 * @param {HTMLElement} previewElement - Referencia al elemento DOM del preview (div con clase .preview)
 * @param {Object} options - Opciones para html2canvas
 * @param {number} options.scale - Escala de la captura (default: 2 para mejor calidad)
 * @param {string} options.backgroundColor - Color de fondo (default: '#ffffff')
 * @param {boolean} options.useCORS - Usar CORS para imágenes externas (default: true)
 * @returns {Promise<string>} Data URL de la imagen capturada (PNG)
 */
export const captureComboPreviewAsImage = async (previewElement, options = {}) => {
  if (!previewElement || !(previewElement instanceof HTMLElement)) {
    throw new Error('Se requiere un elemento DOM válido para capturar');
  }

  const {
    scale = 2,
    backgroundColor = '#ffffff',
    useCORS = true,
    logging = false
  } = options;

  // Verificar que el elemento sea visible
  const rect = previewElement.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) {
    throw new Error('El elemento preview no es visible o no tiene dimensiones');
  }

  // Esperar a que todas las imágenes estén cargadas
  try {
    await waitForImagesToLoad(previewElement);
  } catch (error) {
    console.warn('Algunas imágenes no se cargaron completamente:', error);
    // Continuar de todas formas, html2canvas puede manejar imágenes parcialmente cargadas
  }

  // Timeout para no quedarse colgado (20 segundos)
  const CAPTURE_TIMEOUT_MS = 20000;
  const capturePromise = (async () => {
    const canvas = await html2canvas(previewElement, {
      scale,
      backgroundColor,
      useCORS,
      logging,
      allowTaint: false,
      removeContainer: false,
      imageTimeout: 15000,
      onclone: (clonedDoc) => {
        const firstClass = previewElement.className.split(' ')[0];
        if (!firstClass) return;
        const clonedPreview = clonedDoc.querySelector(`.${firstClass}`);
        if (clonedPreview) {
          clonedPreview.querySelectorAll('img').forEach((img) => {
            if (!img.complete || img.naturalWidth === 0) {
              const newImg = new Image();
              newImg.crossOrigin = 'anonymous';
              newImg.src = img.src;
            }
          });
        }
      }
    });
    return canvas.toDataURL('image/png', 1.0);
  })();

  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('Tiempo de espera agotado al generar la imagen. Vuelve a intentar.')), CAPTURE_TIMEOUT_MS);
  });

  try {
    return await Promise.race([capturePromise, timeoutPromise]);
  } catch (error) {
    console.error('Error capturando preview con html2canvas:', error);
    throw error instanceof Error ? error : new Error(String(error));
  }
};

/**
 * Genera una previsualización de TODOS los lados (Frente y Espalda) para el Carrito/WhatsApp.
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
    frontImgUrl = getCloudinaryOptimized(frontImgUrl);
    
    const vIdFront = `combo-view-${i}-${colorCode}`;
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
      let backImgUrl = viewObj.backSide.imagesByColor?.[colorCode] || viewObj.backSide.imagesByColor?.default || '';
      if (backImgUrl) {
         backImgUrl = getCloudinaryOptimized(backImgUrl);
         const vIdBack = `combo-view-${i}-${colorCode}-back`;
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

  try {
     return await composeComboImage(canvasInstances, comboLayout || { orientation: 'horizontal', spacing: 20 });
  } catch (err) {
     console.error('Error final en composeComboImage:', err);
     return null;
  }
};

/**
 * Genera renders individuales (frente y espalda) por cada sub-producto del combo
 * con los layers del editor superpuestos.
 * Devuelve: [ { frente: dataUrl|null, espalda: dataUrl|null }, ... ]
 *
 * @param {Object} comboProduct
 * @param {Array}  userComboCustomization
 */
export const generatePerItemSidePreviews = async (comboProduct, userComboCustomization) => {
  if (!comboProduct?.comboItems) return [];
  const { comboItems } = comboProduct;
  const results = [];

  for (let i = 0; i < comboItems.length; i++) {
    const item      = comboItems[i];
    const cust      = (userComboCustomization || [])[i] || {};
    const colorCode = cust.variant?.color || item.variantMapping?.color || 'default';

    const viewObj =
      comboProduct.customizationViews?.find((v) => v.id === item.viewId) ||
      comboProduct.customizationViews?.[0] || {};

    let frenteUrl  = null;
    let espaldaUrl = null;

    // FRENTE
    try {
      let frontImgUrl =
        viewObj.imagesByColor?.[colorCode] ||
        viewObj.imagesByColor?.default      ||
        comboProduct.images?.[0] || '';
      if (frontImgUrl) {
        frontImgUrl = getCloudinaryOptimized(frontImgUrl);
        const vIdFront    = `combo-view-${i}-${colorCode}`;
        const frontLayers = cust.layersByView?.[vIdFront] || cust.initialLayersByColor?.[colorCode] || [];
        frenteUrl = await generateThumbnailWithDesign(frontImgUrl, frontLayers, { maxWidth: 800 });
      }
    } catch (err) {
      console.warn(`[ComboPreview] Error frente item ${i}:`, err);
    }

    // ESPALDA
    if (viewObj.hasBackSide && viewObj.backSide) {
      try {
        let backImgUrl =
          viewObj.backSide.imagesByColor?.[colorCode] ||
          viewObj.backSide.imagesByColor?.default || '';
        if (backImgUrl) {
          backImgUrl = getCloudinaryOptimized(backImgUrl);
          const vIdBack    = `combo-view-${i}-${colorCode}-back`;
          const backLayers = cust.layersByView?.[vIdBack] || cust.backSide?.initialLayersByColor?.[colorCode] || [];
          espaldaUrl = await generateThumbnailWithDesign(backImgUrl, backLayers, { maxWidth: 800 });
        }
      } catch (err) {
        console.warn(`[ComboPreview] Error espalda item ${i}:`, err);
      }
    }

    results.push({ frente: frenteUrl, espalda: espaldaUrl });
  }

  return results;
};
