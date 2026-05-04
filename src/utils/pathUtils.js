/**
 * Utilidades para manipular paths SVG
 */

/**
 * Convierte un array de puntos a un path SVG
 * @param {Array} points - Array de { x, y, type?, handles? }
 * @param {boolean} closed - Si el path está cerrado
 * @returns {string} SVG path string
 */
export function pointsToPath(points, closed = false) {
  if (!points || points.length === 0) return '';
  
  if (points.length === 1) {
    return `M ${points[0].x},${points[0].y}`;
  }
  
  let path = `M ${points[0].x},${points[0].y}`;
  
  for (let i = 1; i < points.length; i++) {
    const prevPoint = points[i - 1];
    const currentPoint = points[i];
    
    if (currentPoint.type === 'smooth' && currentPoint.handles && prevPoint.handles) {
      // Curva de Bézier suave
      const cp1x = prevPoint.x + (prevPoint.handles.out?.x || 0);
      const cp1y = prevPoint.y + (prevPoint.handles.out?.y || 0);
      const cp2x = currentPoint.x + (currentPoint.handles.in?.x || 0);
      const cp2y = currentPoint.y + (currentPoint.handles.in?.y || 0);
      path += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${currentPoint.x},${currentPoint.y}`;
    } else if (currentPoint.handles && (currentPoint.handles.in || currentPoint.handles.out)) {
      // Curva de Bézier con handles
      const cp1x = prevPoint.x + (prevPoint.handles?.out?.x || 0);
      const cp1y = prevPoint.y + (prevPoint.handles?.out?.y || 0);
      const cp2x = currentPoint.x + (currentPoint.handles?.in?.x || 0);
      const cp2y = currentPoint.y + (currentPoint.handles?.in?.y || 0);
      path += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${currentPoint.x},${currentPoint.y}`;
    } else {
      // Línea recta
      path += ` L ${currentPoint.x},${currentPoint.y}`;
    }
  }
  
  if (closed) {
    path += ' Z';
  }
  
  return path;
}

/**
 * Parsea un path SVG a un array de puntos
 * @param {string} pathString - SVG path string
 * @returns {Array} Array de puntos con información de handles
 */
export function pathToPoints(pathString) {
  if (!pathString) return [];
  
  const points = [];
  const commands = pathString.match(/[MmLlHhVvCcSsQqTtAaZz][^MmLlHhVvCcSsQqTtAaZz]*/g) || [];
  
  let currentX = 0;
  let currentY = 0;
  
  commands.forEach(cmd => {
    const type = cmd[0];
    const coords = cmd.slice(1).trim().split(/[\s,]+/).map(Number).filter(n => !isNaN(n));
    
    switch (type) {
      case 'M':
      case 'm':
        if (coords.length >= 2) {
          currentX = type === 'M' ? coords[0] : currentX + coords[0];
          currentY = type === 'M' ? coords[1] : currentY + coords[1];
          points.push({ x: currentX, y: currentY, type: 'corner' });
        }
        break;
      case 'L':
      case 'l':
        if (coords.length >= 2) {
          currentX = type === 'L' ? coords[0] : currentX + coords[0];
          currentY = type === 'L' ? coords[1] : currentY + coords[1];
          points.push({ x: currentX, y: currentY, type: 'corner' });
        }
        break;
      case 'C':
      case 'c':
        if (coords.length >= 6) {
          const cp1x = type === 'C' ? coords[0] : currentX + coords[0];
          const cp1y = type === 'C' ? coords[1] : currentY + coords[1];
          const cp2x = type === 'C' ? coords[2] : currentX + coords[2];
          const cp2y = type === 'C' ? coords[3] : currentY + coords[3];
          currentX = type === 'C' ? coords[4] : currentX + coords[4];
          currentY = type === 'C' ? coords[5] : currentY + coords[5];
          
          // Si hay un punto previo, actualizar sus handles
          if (points.length > 0) {
            const prevPoint = points[points.length - 1];
            if (!prevPoint.handles) prevPoint.handles = {};
            prevPoint.handles.out = { x: cp1x - prevPoint.x, y: cp1y - prevPoint.y };
          }
          
          points.push({
            x: currentX,
            y: currentY,
            type: 'smooth',
            handles: {
              in: { x: cp2x - currentX, y: cp2y - currentY }
            }
          });
        }
        break;
      case 'Z':
      case 'z':
        // Cerrar path
        break;
      default:
        break;
    }
  });
  
  return points;
}

/**
 * Añade un punto a un path en una posición específica
 * @param {Array} points - Array de puntos
 * @param {number} segmentIndex - Índice del segmento donde añadir (0 = después del primer punto)
 * @param {number} x - Coordenada X del nuevo punto
 * @param {number} y - Coordenada Y del nuevo punto
 * @returns {Array} Nuevo array de puntos
 */
export function addPointToPath(points, segmentIndex, x, y) {
  if (segmentIndex < 0 || segmentIndex >= points.length) return points;
  
  const newPoints = [...points];
  const newPoint = { x, y, type: 'corner' };
  newPoints.splice(segmentIndex + 1, 0, newPoint);
  return newPoints;
}

/**
 * Elimina un punto de un path
 * @param {Array} points - Array de puntos
 * @param {number} pointIndex - Índice del punto a eliminar
 * @returns {Array} Nuevo array de puntos
 */
export function removePointFromPath(points, pointIndex) {
  if (points.length <= 2) return points; // Mantener al menos 2 puntos
  const newPoints = [...points];
  newPoints.splice(pointIndex, 1);
  return newPoints;
}

/**
 * Convierte un punto de corner a smooth o viceversa
 * @param {Object} point - Punto a convertir
 * @returns {Object} Punto convertido
 */
export function convertPointType(point) {
  if (point.type === 'smooth') {
    return { ...point, type: 'corner' };
  } else {
    // Convertir a smooth con handles simétricos
    const handleLength = 30; // Longitud por defecto de los handles
    return {
      ...point,
      type: 'smooth',
      handles: {
        in: { x: -handleLength, y: 0 },
        out: { x: handleLength, y: 0 }
      }
    };
  }
}

/**
 * Calcula el punto más cercano en un segmento de línea
 * @param {number} x - Coordenada X del punto
 * @param {number} y - Coordenada Y del punto
 * @param {Object} p1 - Primer punto del segmento
 * @param {Object} p2 - Segundo punto del segmento
 * @returns {Object} { point: {x, y}, distance, segmentIndex }
 */
export function findClosestPointOnSegment(x, y, p1, p2) {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const length2 = dx * dx + dy * dy;
  
  if (length2 === 0) {
    return { point: p1, distance: Math.sqrt((x - p1.x) ** 2 + (y - p1.y) ** 2), segmentIndex: 0 };
  }
  
  const t = Math.max(0, Math.min(1, ((x - p1.x) * dx + (y - p1.y) * dy) / length2));
  const closestPoint = {
    x: p1.x + t * dx,
    y: p1.y + t * dy
  };
  
  const distance = Math.sqrt((x - closestPoint.x) ** 2 + (y - closestPoint.y) ** 2);
  
  return { point: closestPoint, distance, segmentIndex: 0 };
}

/**
 * Simplifica un path reduciendo el número de puntos
 * @param {Array} points - Array de puntos
 * @param {number} tolerance - Tolerancia para simplificación
 * @returns {Array} Array de puntos simplificado
 */
export function simplifyPath(points, tolerance = 2) {
  if (points.length <= 2) return points;
  
  // Algoritmo de simplificación de Douglas-Peucker simplificado
  const simplified = [points[0]];
  
  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1];
    const current = points[i];
    const next = points[i + 1];
    
    // Calcular distancia del punto medio al segmento
    const dx = next.x - prev.x;
    const dy = next.y - prev.y;
    const length = Math.sqrt(dx * dx + dy * dy);
    
    if (length > 0) {
      const t = ((current.x - prev.x) * dx + (current.y - prev.y) * dy) / (length * length);
      const projX = prev.x + t * dx;
      const projY = prev.y + t * dy;
      const distance = Math.sqrt((current.x - projX) ** 2 + (current.y - projY) ** 2);
      
      if (distance > tolerance) {
        simplified.push(current);
      }
    } else {
      simplified.push(current);
    }
  }
  
  simplified.push(points[points.length - 1]);
  return simplified;
}
