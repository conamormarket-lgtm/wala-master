/**
 * Extrae el ID de archivo de un enlace de Google Drive.
 * Formatos soportados:
 * - https://drive.google.com/file/d/FILE_ID/view?usp=sharing
 * - https://drive.google.com/open?id=FILE_ID
 * - https://drive.google.com/uc?id=FILE_ID
 * - https://www.google.com/url?q=https://drive.google.com/file/d/FILE_ID/...
 */
export function getGoogleDriveFileId(url) {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  // Si viene envuelto en google.com/url?q=... extraer la URL real
  let toParse = trimmed;
  if (trimmed.includes('google.com/url') && trimmed.includes('q=')) {
    try {
      const u = new URL(trimmed);
      const q = u.searchParams.get('q');
      if (q) toParse = q;
    } catch (_) { }
  }
  const fileIdMatch = toParse.match(/\/file\/d\/([a-zA-Z0-9_.-]+)/);
  if (fileIdMatch) return fileIdMatch[1];
  const idParamMatch = toParse.match(/[?&]id=([a-zA-Z0-9_.-]+)/);
  if (idParamMatch) return idParamMatch[1];
  return null;
}

/**
 * Indica si la URL parece ser de Google Drive.
 */
export function isGoogleDriveUrl(url) {
  return Boolean(url && typeof url === 'string' && url.trim().includes('drive.google.com'));
}

/**
 * Indica si la URL parece ser de Firebase Storage.
 * Formato: https://firebasestorage.googleapis.com/v0/b/.../o/...?alt=media&token=...
 */
export function isFirebaseStorageUrl(url) {
  return Boolean(url && typeof url === 'string' && url.trim().includes('firebasestorage.googleapis.com'));
}

/**
 * Convierte un enlace de Google Drive a URL que funcione en <img> (2024+).
 * Google dejó de servir bien uc?export=view; el endpoint thumbnail sí carga en el navegador.
 * Usar sz=w1000 para buena calidad en editor y previsualizaciones.
 * Para Firebase Storage: devuelve la URL tal cual (ya funciona directa en <img>).
 */
export function toDirectImageUrl(url) {
  if (!url || typeof url !== 'string') return url;
  const trimmed = url.trim();
  const fileId = getGoogleDriveFileId(trimmed);
  if (fileId) {
    return `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`;
  }
  
  if (isFirebaseStorageUrl(trimmed)) {
    const isLocalhost = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
    if (!isLocalhost) {
      // Optimización nativa de Vercel (1200px máx para vistas de detalle)
      return `/_vercel/image?url=${encodeURIComponent(trimmed)}&w=1200&q=80`;
    }
  }

  // Fallback
  return trimmed;
}

/**
 * Versión ligera para miniaturas (thumbnails de catálogo).
 */
export function toThumbnailImageUrl(url) {
  if (!url || typeof url !== 'string') return url;
  
  const trimmed = url.trim();
  const fileId = getGoogleDriveFileId(trimmed);
  if (fileId) {
    // w500 es suficiente para miniaturas y carga mucho más rápido que w1000
    return `https://drive.google.com/thumbnail?id=${fileId}&sz=w500`;
  }
  
  if (isFirebaseStorageUrl(trimmed)) {
    const isLocalhost = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
    if (!isLocalhost) {
      // Usar la optimización de imágenes nativa de Vercel en producción
      return `/_vercel/image?url=${encodeURIComponent(trimmed)}&w=640&q=75`;
    }
  }

  return trimmed;
}

/**
 * Convierte un enlace a URL que funcione en canvas (crossOrigin anonymous / CORS).
 * - Google Drive: usa thumbnail endpoint.
 * - Firebase Storage: devuelve igual (Firebase permite CORS con crossOrigin anonymous por defecto).
 */
export function toCanvasImageUrl(url) {
  if (!url || typeof url !== 'string') return url;
  const trimmed = url.trim();
  const fileId = getGoogleDriveFileId(trimmed);
  if (fileId) {
    return `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`;
  }
  // Firebase Storage ya soporta CORS con crossOrigin anonymous
  // Devolver la URL tal cual — no añadir parámetros extra que rompan el token de acceso
  return trimmed;
}

/**
 * Normaliza un valor que puede ser string o array de URLs a una sola string.
 * Evita que arrays guardados en Firestore (p. ej. imagesByColor[name] = [url]) rompan <img src>.
 */
export function ensureSingleImageUrl(value) {
  if (value == null) return '';
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (Array.isArray(value) && value.length > 0) {
    const first = value[0];
    if (typeof first === 'string' && first.trim()) return first.trim();
  }
  return '';
}

/**
 * Devuelve una URL directa lista para usar en <img src>, manejando string o array y convirtiendo Google Drive.
 */
export function toDisplayImageUrl(value) {
  const single = ensureSingleImageUrl(value);
  return single ? toDirectImageUrl(single) : '';
}
