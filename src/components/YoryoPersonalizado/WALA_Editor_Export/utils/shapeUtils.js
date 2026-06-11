/**
 * Utilidades para trabajar con formas de zonas de personalización
 */

export const SHAPE_TYPES = {
  RECTANGLE: 'rectangle',
  SQUARE: 'square',
  CIRCLE: 'circle',
  ELLIPSE: 'ellipse',
  HEART: 'heart',
  CUSTOM: 'custom'
};

// Cache para formas personalizadas
let customShapesCache = {};

/**
 * Cargar forma personalizada desde cache o Firestore
 * @param {string} customShapeId - ID de la forma personalizada
 * @returns {Promise<string>} SVG path string
 */
export async function loadCustomShape(customShapeId) {
  if (customShapesCache[customShapeId]) {
    return customShapesCache[customShapeId];
  }

  try {
    const { getCustomShape } = await import('../services/customShapes');
    const { data, error } = await getCustomShape(customShapeId);
    if (error || !data) return '';

    const svgPath = data.svgPath || '';
    customShapesCache[customShapeId] = svgPath;
    return svgPath;
  } catch (error) {
    console.error('Error loading custom shape:', error);
    return '';
  }
}

/**
 * Genera un SVG path para una forma específica
 * @param {string} shape - Tipo de forma
 * @param {number} width - Ancho en píxeles
 * @param {number} height - Alto en píxeles
 * @param {string} customShapeId - ID de forma personalizada (si shape === 'custom')
 * @param {string} customSvgPath - SVG path directo (opcional, para evitar carga async)
 * @returns {string} SVG path string
 */
export function renderShapeSVG(shape, width, height, customShapeId = null, customSvgPath = null) {
  const w = width || 100;
  const h = height || 100;
  const cx = w / 2;
  const cy = h / 2;

  switch (shape) {
    case SHAPE_TYPES.CUSTOM:
      // Si se proporciona el path directamente, usarlo
      if (customSvgPath) {
        return customSvgPath;
      }
      // Si hay customShapeId, intentar cargar desde cache
      if (customShapeId && customShapesCache[customShapeId]) {
        return customShapesCache[customShapeId];
      }
      // Por defecto, retornar rectángulo si no se puede cargar
      return `M 0,0 L ${w},0 L ${w},${h} L 0,${h} Z`;

    case SHAPE_TYPES.CIRCLE:
    case SHAPE_TYPES.SQUARE: {
      const radius = Math.min(w, h) / 2;
      return `M ${cx - radius},${cy} A ${radius},${radius} 0 1,0 ${cx + radius},${cy} A ${radius},${radius} 0 1,0 ${cx - radius},${cy}`;
    }
    case SHAPE_TYPES.ELLIPSE: {
      const rx = w / 2;
      const ry = h / 2;
      return `M ${cx},${cy - ry} A ${rx},${ry} 0 1,0 ${cx},${cy + ry} A ${rx},${ry} 0 1,0 ${cx},${cy - ry}`;
    }
    case SHAPE_TYPES.HEART: {
      // Forma de corazón generada con curvas de Bézier optimizadas para 0 a 100 proporciones
      return `M 50,85 C 50,85 15,55 15,30 C 15,15 35,10 50,25 C 65,10 85,15 85,30 C 85,55 50,85 50,85 Z`;
    }
    case SHAPE_TYPES.RECTANGLE:
    default:
      return `M 0,0 L ${w},0 L ${w},${h} L 0,${h} Z`;
  }
}

/**
 * Verifica si un punto está dentro de una forma
 * @param {number} x - Coordenada X del punto (en píxeles)
 * @param {number} y - Coordenada Y del punto (en píxeles)
 * @param {string} shape - Tipo de forma
 * @param {Object} area - { x, y, width, height, customShapeId?, customSvgPath? } en píxeles
 * @returns {boolean}
 */
export function isPointInShape(x, y, shape, area) {
  const { x: ax, y: ay, width: aw, height: ah } = area;
  const relX = x - ax;
  const relY = y - ay;

  switch (shape) {
    case SHAPE_TYPES.RECTANGLE:
    case SHAPE_TYPES.SQUARE:
      return relX >= 0 && relX <= aw && relY >= 0 && relY <= ah;

    case SHAPE_TYPES.CIRCLE: {
      const radius = Math.min(aw, ah) / 2;
      const centerX = aw / 2;
      const centerY = ah / 2;
      const dist = Math.sqrt(Math.pow(relX - centerX, 2) + Math.pow(relY - centerY, 2));
      return dist <= radius;
    }

    case SHAPE_TYPES.ELLIPSE: {
      const rx = aw / 2;
      const ry = ah / 2;
      const centerX = rx;
      const centerY = ry;
      const dx = (relX - centerX) / rx;
      const dy = (relY - centerY) / ry;
      return (dx * dx + dy * dy) <= 1;
    }

    case SHAPE_TYPES.HEART: {
      // Aproximación: usar bounding box elíptico
      const rx = aw / 2;
      const ry = ah / 2;
      const centerX = rx;
      const centerY = ry;
      const dx = (relX - centerX) / rx;
      const dy = (relY - centerY) / ry;
      return (dx * dx + dy * dy) <= 1.2; // Ligeramente más permisivo para corazón
    }

    case SHAPE_TYPES.CUSTOM: {
      // Para formas personalizadas, usar Canvas API para verificar
      // Crear un canvas temporal y usar isPointInPath
      try {
        const canvas = document.createElement('canvas');
        canvas.width = aw;
        canvas.height = ah;
        const ctx = canvas.getContext('2d');

        const svgPath = area.customSvgPath || customShapesCache[area.customShapeId] || '';
        if (!svgPath) {
          // Fallback a bounding box si no hay path
          return relX >= 0 && relX <= aw && relY >= 0 && relY <= ah;
        }

        // Crear un Path2D desde el SVG path
        const path = new Path2D(svgPath);
        return ctx.isPointInPath(path, relX, relY);
      } catch (error) {
        // Fallback a bounding box en caso de error
        return relX >= 0 && relX <= aw && relY >= 0 && relY <= ah;
      }
    }

    default:
      return false;
  }
}

/**
 * Obtiene el bounding box de una forma
 * @param {Object} area - { x, y, width, height }
 * @returns {Object} { x, y, width, height }
 */
export function getShapeBounds(area) {
  return {
    x: area.x,
    y: area.y,
    width: area.width,
    height: area.height
  };
}

/**
 * Verifica si dos áreas se superponen
 * @param {Object} area1 - { x, y, width, height, shape }
 * @param {Object} area2 - { x, y, width, height, shape }
 * @returns {boolean}
 */
export function areasOverlap(area1, area2) {
  // Bounding box check primero (rápido)
  const bounds1 = getShapeBounds(area1);
  const bounds2 = getShapeBounds(area2);

  const noOverlap =
    bounds1.x + bounds1.width < bounds2.x ||
    bounds2.x + bounds2.width < bounds1.x ||
    bounds1.y + bounds1.height < bounds2.y ||
    bounds2.y + bounds2.height < bounds1.y;

  if (noOverlap) return false;

  // Si los bounding boxes se superponen, verificar puntos de intersección
  // Para simplificar, verificamos si el centro de una está dentro de la otra
  const center1X = bounds1.x + bounds1.width / 2;
  const center1Y = bounds1.y + bounds1.height / 2;
  const center2X = bounds2.x + bounds2.width / 2;
  const center2Y = bounds2.y + bounds2.height / 2;

  return (
    isPointInShape(center1X, center1Y, area2.shape, bounds2) ||
    isPointInShape(center2X, center2Y, area1.shape, bounds1)
  );
}

/**
 * Ajusta la posición de un área para evitar superposición con áreas existentes
 * @param {Object} newArea - Área a ajustar { x, y, width, height, shape }
 * @param {Array<Object>} existingAreas - Array de áreas existentes
 * @param {number} imageWidth - Ancho de la imagen en píxeles
 * @param {number} imageHeight - Alto de la imagen en píxeles
 * @returns {Object} Área ajustada
 */
export function preventOverlap(newArea, existingAreas, imageWidth, imageHeight) {
  let adjustedArea = { ...newArea };
  const maxAttempts = 50;
  let attempts = 0;

  // Convertir porcentajes a píxeles si es necesario
  const toPixels = (area) => {
    if (area.x <= 1 && area.y <= 1 && area.width <= 1 && area.height <= 1) {
      // Parece estar en porcentajes (0-1)
      return {
        ...area,
        x: area.x * imageWidth,
        y: area.y * imageHeight,
        width: area.width * imageWidth,
        height: area.height * imageHeight
      };
    }
    if (
      area.width <= 100 && area.height <= 100 &&
      area.x >= 0 && area.y >= 0 &&
      (area.width > 2 || area.height > 2 || area.x > 0 || area.y > 0)
    ) {
      // Parece estar en porcentajes (0-100)
      return {
        ...area,
        x: (area.x / 100) * imageWidth,
        y: (area.y / 100) * imageHeight,
        width: (area.width / 100) * imageWidth,
        height: (area.height / 100) * imageHeight
      };
    }
    return area; // Ya está en píxeles
  };

  const areaPx = toPixels(adjustedArea);

  while (attempts < maxAttempts) {
    let hasOverlap = false;

    for (const existing of existingAreas) {
      if (existing.id === adjustedArea.id) continue; // Ignorar la misma área

      const existingPx = toPixels(existing);
      if (areasOverlap(areaPx, existingPx)) {
        hasOverlap = true;
        // Intentar mover hacia la derecha y abajo
        const stepX = imageWidth * 0.05;
        const stepY = imageHeight * 0.05;
        areaPx.x = Math.min(imageWidth - areaPx.width, areaPx.x + stepX);
        areaPx.y = Math.min(imageHeight - areaPx.height, areaPx.y + stepY);
        break;
      }
    }

    if (!hasOverlap) {
      // Convertir de vuelta a porcentajes
      return {
        ...adjustedArea,
        x: (areaPx.x / imageWidth) * 100,
        y: (areaPx.y / imageHeight) * 100,
        width: (areaPx.width / imageWidth) * 100,
        height: (areaPx.height / imageHeight) * 100
      };
    }

    attempts++;
  }

  // Si no se puede evitar superposición después de muchos intentos, mantener posición original
  return adjustedArea;
}

/**
 * Crea un ID único para una zona
 * @returns {string}
 */
export function createZoneId() {
  return `zone_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}
