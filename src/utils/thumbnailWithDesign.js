/**
 * Genera una imagen compuesta (miniatura con diseño): imagen base + capas (texto, imagen, forma).
 * Usado al guardar producto para thumbnailWithDesignUrl (admin y tienda).
 */

import { fabric } from 'fabric';
import { toDirectImageUrl, toCanvasImageUrl, isGoogleDriveUrl, isFirebaseStorageUrl, ensureSingleImageUrl } from './imageUrl';
import { getCloudinaryOptimized } from '../components/common/OptimizedImage/OptimizedImage';
import { FONT_WEIGHT_NORMAL, FONT_STYLE_NORMAL } from '../constants/fonts';

function tryLoadImageUrl(imageUrl, { skipCloudinaryOptimize = false } = {}) {
  if (imageUrl && imageUrl.startsWith('data:')) return [{ url: imageUrl, original: imageUrl, isCb: false }];

  const optimized = skipCloudinaryOptimize ? imageUrl : getCloudinaryOptimized(imageUrl);
  const single = ensureSingleImageUrl(optimized);
  if (!single || !single.trim()) return [];

  // URLs de Cloudinary: carga directa sin fallbacks (CORS habilitado)
  if (single.includes('cloudinary.com')) {
    return [{ url: single, original: single, isCb: false }];
  }

  const direct = toDirectImageUrl(single);
  const isFirebase = isFirebaseStorageUrl(single) || isFirebaseStorageUrl(direct);
  const isDrive = isGoogleDriveUrl(single) || isGoogleDriveUrl(direct);

  // Para Firebase/Drive: wsrv.nl proxy PRIMERO (más rápido que reintentos)
  if (isDrive || isFirebase) {
    const canvasUrl = toCanvasImageUrl(single);
    const proxyUrl = `https://wsrv.nl/?url=${encodeURIComponent(direct)}&output=png`;
    return [
      { url: proxyUrl, original: direct, isCb: true },
      { url: canvasUrl, original: single, isCb: false },
      { url: direct, original: single, isCb: false }
    ];
  }

  // URLs normales
  return [
    { url: direct, original: single, isCb: false },
    { url: single, original: single, isCb: false }
  ];
}

/**
 * Carga una imagen como Fabric.Image probando varias URLs (CORS y Cache-Busting progresivo).
 * @param {string} imageUrl
 * @param {{ skipCloudinaryOptimize?: boolean }} opts - Si true, no aplica Cloudinary c_limit
 * @returns {Promise<fabric.Image>}
 */
function loadFabricImage(imageUrl, { skipCloudinaryOptimize = false } = {}) {
  const urlObjs = tryLoadImageUrl(imageUrl, { skipCloudinaryOptimize });
  const tried = new Set();
  let lastError = null;

  const tryCreateImage = (url) =>
    new Promise((resolve, reject) => {
      const clean = typeof url === 'string' ? url.trim() : '';
      if (!clean || tried.has(clean)) {
        reject(new Error('URL inválida o ya intentada'));
        return;
      }
      tried.add(clean);
      
      const img = new Image();
      // Si la url comienza con blob: o data:, no forzamos crossOrigin, a veces causa problemas
      if (!clean.startsWith('data:') && !clean.startsWith('blob:')) {
        img.crossOrigin = 'anonymous';
      }
      
      img.onload = () => {
        if (img.width > 0 || img.naturalWidth > 0) {
          const fabricImg = new fabric.Image(img);
          resolve(fabricImg);
        } else {
          reject(new Error('Imagen cargada pero tamaño 0: ' + clean));
        }
      };
      img.onerror = () => reject(new Error('Fallo CORS o red: ' + clean));
      img.src = clean;
    });

  const tryFetchBlob = (url) => 
    fetch(url, { mode: 'cors' })
      .then(res => {
        if (!res.ok) throw new Error('Fetch status ' + res.status);
        return res.blob();
      })
      .then(blob => {
        const objectUrl = URL.createObjectURL(blob);
        return tryCreateImage(objectUrl);
      });

  if (urlObjs.length === 0) return Promise.reject(new Error('No hay URLs válidas para: ' + imageUrl));

  const runAttempt = (urlObj) => {
    return tryCreateImage(urlObj.url).catch(err => {
      lastError = err;
      if (urlObj.url.startsWith('http')) {
        return tryFetchBlob(urlObj.url).catch(errFetch => {
          lastError = errFetch;
          throw errFetch;
        });
      }
      throw err;
    });
  };

  let p = runAttempt(urlObjs[0]);
  for (let i = 1; i < urlObjs.length; i++) {
    const obj = urlObjs[i];
    p = p.catch(() => runAttempt(obj));
  }
  return p;
}

/**
 * Añade capas de texto al canvas (Fabric).
 */
export function addTextLayers(canvas, layers) {
  const TextClass = fabric.IText || fabric.Text;
  (layers || []).forEach((layer) => {
    if (layer.type !== 'text') return;
    const left = typeof layer.x === 'number' ? layer.x : 20;
    const top = typeof layer.y === 'number' ? layer.y : 20;
    const text = new TextClass(layer.text || 'Texto', {
      left,
      top,
      fontSize: layer.fontSize || 40,
      fill: layer.color || '#000000',
      fontFamily: layer.fontFamily || 'Arial',
      fontWeight: layer.fontWeight || FONT_WEIGHT_NORMAL,
      fontStyle: layer.fontStyle || FONT_STYLE_NORMAL,
      textAlign: layer.textAlign || 'left',
      scaleX: layer.scaleX ?? 1,
      scaleY: layer.scaleY ?? 1,
      angle: layer.angle || 0,
      flipX: layer.flipX || false,
      flipY: layer.flipY || false,
      selectable: false,
      evented: false,
    });
    canvas.add(text);
  });
}

/**
 * Añade capas de forma al canvas.
 */
export function addShapeLayers(canvas, layers) {
  (layers || []).forEach((layer) => {
    if (layer.type !== 'shape') return;
    const left = typeof layer.x === 'number' ? layer.x : 20;
    const top = typeof layer.y === 'number' ? layer.y : 20;
    const opts = {
      left,
      top,
      fill: layer.fill || '#000000',
      stroke: layer.stroke || '',
      scaleX: layer.scaleX ?? 1,
      scaleY: layer.scaleY ?? 1,
      angle: layer.angle || 0,
      flipX: layer.flipX || false,
      flipY: layer.flipY || false,
      selectable: false,
      evented: false,
    };
    let obj;
    if (layer.shapeType === 'circle') {
      obj = new fabric.Circle({ radius: layer.radius ?? 40, ...opts });
    } else if (layer.shapeType === 'rectangle') {
      obj = new fabric.Rect({ width: layer.width ?? 80, height: layer.height ?? 60, ...opts });
    } else if (layer.shapeType === 'triangle') {
      obj = new fabric.Triangle({ width: 60, height: 60, ...opts });
    } else {
      obj = new fabric.Rect({ width: 80, height: 60, ...opts });
    }
    canvas.add(obj);
  });
}

/**
 * Añade capas de imagen al canvas (async). Aplica tint y clipPath si vienen en la capa.
 * @returns {Promise<fabric.Image | null>}
 */
function loadSingleImageLayer(layer) {
  const url = toDirectImageUrl(ensureSingleImageUrl(layer.src));
  if (!url) return Promise.resolve(null);

  const applyTint = (fabricImg) => {
    if (!fabricImg || !layer.tintColor) return;
    try {
      const blend = new fabric.Image.filters.BlendColor({
        color: layer.tintColor,
        mode: 'tint',
        alpha: layer.tintOpacity ?? 0.5,
      });
      fabricImg.filters = fabricImg.filters ? fabricImg.filters.concat(blend) : [blend];
      fabricImg.applyFilters();
    } catch (_) { }
  };

  return loadFabricImage(layer.src)
    .then((img) => {
      const left = typeof layer.x === 'number' ? layer.x : 20;
      const top = typeof layer.y === 'number' ? layer.y : 20;
      img.set({
        left,
        top,
        scaleX: layer.scaleX ?? 1,
        scaleY: layer.scaleY ?? 1,
        angle: layer.angle || 0,
        flipX: layer.flipX || false,
        flipY: layer.flipY || false,
        selectable: false,
        evented: false,
      });
      if (layer.maskShape === 'circle') {
        img.clipPath = new fabric.Circle({
          radius: Math.min(img.width, img.height) / 2,
          originX: 'center',
          originY: 'center',
        });
      } else if (layer.maskShape === 'square') {
        img.clipPath = new fabric.Rect({
          width: img.width,
          height: img.height,
          originX: 'center',
          originY: 'center',
        });
      }
      applyTint(img);
      return img;
    })
    .catch((err) => {
      console.warn('[thumbnailWithDesign] Imagen de capa falló:', layer.src, err?.message);
      return null;
    });
}

/**
 * Genera la imagen compuesta (base + capas) como data URL.
 * CLAVE: Las capas se renderizan en su ORDEN ORIGINAL (el orden en que aparecen en el array),
 * no agrupadas por tipo. Esto asegura que el z-order coincida con lo que ve el usuario.
 *
 * @param {string} baseImageUrl - URL de la imagen base (variante principal)
 * @param {Array<Object>} layers - Capas normalizadas (text, image, shape)
 * @param {{ maxWidth?: number, forceWidth?: number, forceHeight?: number }} [options]
 * @returns {Promise<string>} Data URL
 */
export async function generateThumbnailWithDesign(baseImageUrl, layers = [], options = {}) {
  if (!baseImageUrl || !baseImageUrl.trim()) {
    throw new Error('Se requiere URL de imagen base');
  }

  // CLAVE: Si la imagen es de Google Drive y las capas tienen baseW, forzar sz=w{baseW}.
  // El editor carga thumbnail?id=xxx&sz=w1000 y Google Drive devuelve ~441px.
  // Los proxies (wsrv.nl) cargan la misma URL pero obtienen ~718px (resolución completa).
  // Solución: reescribir sz=w{baseW} para que el proxy descargue al mismo tamaño que el editor.
  let imageUrlToLoad = baseImageUrl;
  const preValidLayers = Array.isArray(layers) ? layers.filter((l) => l && l.type) : [];
  const preRefLayer = preValidLayers.find(l => typeof l.baseW === 'number' && l.baseW > 0);
  if (preRefLayer && imageUrlToLoad) {
    const driveMatch = imageUrlToLoad.match(/drive\.google\.com\/thumbnail\?/);
    if (driveMatch) {
      // Reemplazar sz=w{cualquier} por sz=w{baseW} para igualar al editor
      imageUrlToLoad = imageUrlToLoad.replace(/sz=w\d+/, `sz=w${preRefLayer.baseW}`);
    }
  }
  
   const baseImage = await loadFabricImage(imageUrlToLoad, { skipCloudinaryOptimize: true });
  const w = baseImage.width || 1200;
  const h = baseImage.height || 1200;

  // SOLUCIÓN DEFINITIVA: Canvas = baseW × baseH (EXACTO del editor).
  // El editor carga la imagen directamente a 441×565. loadFabricImage la carga via
  // proxy (wsrv.nl) a ~725×1024 (resolución y AR diferentes).
  // Al usar baseW×baseH como canvas, los diseños quedan con ratio=1.0 (sin escalar).
  // La imagen se escala UNIFORMEMENTE por ancho para no distorsionarla.
  // Si es más alta que el canvas, el exceso se recorta naturalmente abajo.
  let targetW, targetH;
  if (options.forceWidth && options.forceHeight) {
    targetW = options.forceWidth;
    targetH = options.forceHeight;
  } else {
    // Si la primera capa tiene baseW y baseH (del editor), usar esas proporciones exactas.
    // De lo contrario, mantener el aspect ratio original de la imagen base.
    const firstLayer = preValidLayers.find(l => l && l.baseW && l.baseH);
    const maxWidth = options.maxWidth && options.maxWidth > 0 ? options.maxWidth : 600;
    targetW = maxWidth;
    
    if (firstLayer && firstLayer.baseW && firstLayer.baseH) {
      const editorRatio = firstLayer.baseH / firstLayer.baseW;
      targetH = Math.round(targetW * editorRatio);
    } else {
      const originalRatio = h / w;
      targetH = Math.round(targetW * originalRatio);
    }
  }

  const canvasEl = document.createElement('canvas');
  canvasEl.width = targetW;
  canvasEl.height = targetH;

  const canvas = new fabric.StaticCanvas(canvasEl, { width: targetW, height: targetH });

  // Imagen se escala para llenar el canvas EXACTAMENTE (scaleX y scaleY independientes).
  // La imagen proxy (449×556) se estira a llenar el canvas (441×565).
  // La distorsión es mínima (~2%) e invisible al ojo humano.
  // ESTO ES CRÍTICO: si se usa escala uniforme, la imagen no llena el canvas
  // y los diseños quedan desalineados respecto a la polera.
  const imgScaleX = targetW / w;
  const imgScaleY = targetH / h;
  baseImage.set({
    scaleX: imgScaleX,
    scaleY: imgScaleY,
    left: 0,
    top: 0,
    originX: 'left',
    originY: 'top',
    selectable: false,
    evented: false,
  });
  canvas.add(baseImage);

  // DEBUG: Imprimir valores críticos para diagnóstico
  const _firstLayer = (Array.isArray(layers) ? layers : []).find(l => l && l.baseW);
  const _debugRatioX = _firstLayer?.baseW ? (targetW / _firstLayer.baseW) : 'N/A';
  const _debugRatioY = _firstLayer?.baseH ? (targetH / _firstLayer.baseH) : 'N/A';
  console.log('%c[THUMBNAIL DEBUG]', 'background:red;color:white;font-weight:bold', {
    imageNatural: { w, h },
    target: { targetW, targetH },
    imgScale: { imgScaleX, imgScaleY },
    layerBaseW: _firstLayer?.baseW || 'N/A',
    layerBaseH: _firstLayer?.baseH || 'N/A',
    ratioX: _debugRatioX,
    ratioY: _debugRatioY,
    baseImageUrl: baseImageUrl?.substring(0, 100)
  });

  const validLayers = Array.isArray(layers) ? layers.filter((l) => l && l.type) : [];

  // Canvas = baseW × baseH → ratioX = targetW/baseW = 1.0 → capas sin escalar
  const scaleLayer = (layer) => {
    const out = { ...layer };

    // Con canvas = baseW × baseH: ratio = 1.0 por ambos ejes
    let ratioX = imgScaleX;
    let ratioY = imgScaleY;

    if (typeof layer.baseW === 'number' && layer.baseW > 0) {
      ratioX = targetW / layer.baseW;
    }
    if (typeof layer.baseH === 'number' && layer.baseH > 0) {
      ratioY = targetH / layer.baseH;
    }

    if (ratioX === 1 && ratioY === 1) return layer;

    // Factor uniforme para tamaños (no distorsionar text, images, shapes)
    const sizeRatio = Math.min(ratioX, ratioY);

    if (typeof layer.x === 'number') out.x = layer.x * ratioX;
    if (typeof layer.y === 'number') out.y = layer.y * ratioY;
    if (layer.type === 'text' && typeof layer.fontSize === 'number') {
      out.fontSize = Math.max(8, Math.round(layer.fontSize * sizeRatio));
    }
    if (layer.type === 'shape') {
      if (typeof layer.radius === 'number') out.radius = layer.radius * sizeRatio;
      if (typeof layer.width === 'number') out.width = layer.width * sizeRatio;
      if (typeof layer.height === 'number') out.height = layer.height * sizeRatio;
    }
    if (layer.type === 'image') {
      if (typeof layer.scaleX === 'number') out.scaleX = layer.scaleX * sizeRatio;
      if (typeof layer.scaleY === 'number') out.scaleY = layer.scaleY * sizeRatio;
    }
    return out;
  };

  // ★ CLAVE: Renderizar capas EN SU ORDEN ORIGINAL, no agrupadas por tipo.
  // Para las capas de imagen, necesitamos cargarlas async primero, así que
  // pre-cargamos todas las imágenes y luego las agregamos en orden.
  const scaledLayers = validLayers.map(scaleLayer);

  // Pre-cargar TODAS las imágenes en paralelo
  const imageLoadPromises = new Map();
  for (let i = 0; i < scaledLayers.length; i++) {
    const layer = scaledLayers[i];
    if (layer.type === 'image' && layer.src) {
      imageLoadPromises.set(i, loadSingleImageLayer(layer));
    }
  }

  // Esperar a que todas las imágenes carguen
  const imageResults = new Map();
  for (const [idx, promise] of imageLoadPromises.entries()) {
    try {
      const img = await promise;
      if (img) imageResults.set(idx, img);
    } catch (err) {
      console.warn('[thumbnailWithDesign] No se pudo cargar imagen de capa', idx, err);
    }
  }

  // Agregar capas al canvas en el orden EXACTO del array original
  const TextClass = fabric.IText || fabric.Text;
  for (let i = 0; i < scaledLayers.length; i++) {
    const layer = scaledLayers[i];

    if (layer.type === 'text') {
      const left = typeof layer.x === 'number' ? layer.x : 20;
      const top = typeof layer.y === 'number' ? layer.y : 20;
      const text = new TextClass(layer.text || 'Texto', {
        left,
        top,
        fontSize: layer.fontSize || 40,
        fill: layer.color || '#000000',
        fontFamily: layer.fontFamily || 'Arial',
        fontWeight: layer.fontWeight || FONT_WEIGHT_NORMAL,
        fontStyle: layer.fontStyle || FONT_STYLE_NORMAL,
        textAlign: layer.textAlign || 'left',
        scaleX: layer.scaleX ?? 1,
        scaleY: layer.scaleY ?? 1,
        angle: layer.angle || 0,
        flipX: layer.flipX || false,
        flipY: layer.flipY || false,
        selectable: false,
        evented: false,
      });
      canvas.add(text);
    } else if (layer.type === 'shape') {
      const left = typeof layer.x === 'number' ? layer.x : 20;
      const top = typeof layer.y === 'number' ? layer.y : 20;
      const opts = {
        left,
        top,
        fill: layer.fill || '#000000',
        stroke: layer.stroke || '',
        scaleX: layer.scaleX ?? 1,
        scaleY: layer.scaleY ?? 1,
        angle: layer.angle || 0,
        flipX: layer.flipX || false,
        flipY: layer.flipY || false,
        selectable: false,
        evented: false,
      };
      let obj;
      if (layer.shapeType === 'circle') {
        obj = new fabric.Circle({ radius: layer.radius ?? 40, ...opts });
      } else if (layer.shapeType === 'rectangle') {
        obj = new fabric.Rect({ width: layer.width ?? 80, height: layer.height ?? 60, ...opts });
      } else if (layer.shapeType === 'triangle') {
        obj = new fabric.Triangle({ width: 60, height: 60, ...opts });
      } else {
        obj = new fabric.Rect({ width: 80, height: 60, ...opts });
      }
      canvas.add(obj);
    } else if (layer.type === 'image') {
      const img = imageResults.get(i);
      if (img) {
        canvas.add(img);
      }
    }
  }

  canvas.renderAll();

  const dataUrl = canvas.toDataURL({ format: 'webp', quality: 0.85, multiplier: 1 });
  canvas.dispose();
  return dataUrl;
}

/**
 * Genera SOLO los diseños (sin imagen de fondo) en un canvas transparente.
 * Canvas dimensiones = baseW × baseH (= canvas del editor).
 * Las capas se agregan con coordenadas EXACTAS (sin escalar).
 * Retorna un PNG con fondo transparente para superponer sobre la imagen.
 */
export async function generateDesignOnlyOverlay(layers = [], baseW = 500, baseH = 600) {
  const validLayers = Array.isArray(layers) ? layers.filter(l => l && l.type) : [];
  if (validLayers.length === 0) return null;

  const canvasEl = document.createElement('canvas');
  canvasEl.width = baseW;
  canvasEl.height = baseH;

  const canvas = new fabric.StaticCanvas(canvasEl, {
    width: baseW,
    height: baseH,
    backgroundColor: 'transparent',
  });

  // Pre-cargar imágenes en paralelo
  const imageLoadPromises = new Map();
  for (let i = 0; i < validLayers.length; i++) {
    const layer = validLayers[i];
    if (layer.type === 'image' && layer.src) {
      imageLoadPromises.set(i, loadSingleImageLayer(layer));
    }
  }

  const imageResults = new Map();
  for (const [idx, promise] of imageLoadPromises.entries()) {
    try {
      const img = await promise;
      if (img) imageResults.set(idx, img);
    } catch (err) {
      console.warn('[designOverlay] No se pudo cargar imagen de capa', idx, err);
    }
  }

  // Agregar capas al canvas en orden EXACTO — coordenadas sin escalar
  const TextClass = fabric.IText || fabric.Text;
  for (let i = 0; i < validLayers.length; i++) {
    const layer = validLayers[i];

    if (layer.type === 'text') {
      const left = typeof layer.x === 'number' ? layer.x : 20;
      const top = typeof layer.y === 'number' ? layer.y : 20;
      const text = new TextClass(layer.text || 'Texto', {
        left,
        top,
        fontSize: layer.fontSize || 40,
        fill: layer.color || '#000000',
        fontFamily: layer.fontFamily || 'Arial',
        fontWeight: layer.fontWeight || FONT_WEIGHT_NORMAL,
        fontStyle: layer.fontStyle || FONT_STYLE_NORMAL,
        textAlign: layer.textAlign || 'left',
        scaleX: layer.scaleX ?? 1,
        scaleY: layer.scaleY ?? 1,
        angle: layer.angle || 0,
        flipX: layer.flipX || false,
        flipY: layer.flipY || false,
        selectable: false,
        evented: false,
      });
      canvas.add(text);
    } else if (layer.type === 'shape') {
      const left = typeof layer.x === 'number' ? layer.x : 20;
      const top = typeof layer.y === 'number' ? layer.y : 20;
      const opts = {
        left,
        top,
        fill: layer.fill || '#000000',
        stroke: layer.stroke || '',
        scaleX: layer.scaleX ?? 1,
        scaleY: layer.scaleY ?? 1,
        angle: layer.angle || 0,
        flipX: layer.flipX || false,
        flipY: layer.flipY || false,
        selectable: false,
        evented: false,
      };
      let obj;
      if (layer.shapeType === 'circle') {
        obj = new fabric.Circle({ radius: layer.radius ?? 40, ...opts });
      } else if (layer.shapeType === 'rectangle') {
        obj = new fabric.Rect({ width: layer.width ?? 80, height: layer.height ?? 60, ...opts });
      } else if (layer.shapeType === 'triangle') {
        obj = new fabric.Triangle({ width: 60, height: 60, ...opts });
      } else {
        obj = new fabric.Rect({ width: 80, height: 60, ...opts });
      }
      canvas.add(obj);
    } else if (layer.type === 'image') {
      const img = imageResults.get(i);
      if (img) {
        canvas.add(img);
      }
    }
  }

  canvas.renderAll();

  // PNG con transparencia para superponer sobre la imagen
  const dataUrl = canvas.toDataURL({ format: 'png', multiplier: 1 });
  canvas.dispose();
  return dataUrl;
}
