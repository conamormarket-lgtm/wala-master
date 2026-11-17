export const MAX_PRODUCT_VIDEOS = 5;
export const MAX_PRODUCT_VIDEO_BYTES = 100 * 1024 * 1024;
export const PRODUCT_VIDEO_ACCEPT = 'video/mp4,video/webm,.mp4,.webm';

export function productVideoType(file) {
  const type = String(file?.type || '').toLowerCase();
  if (['video/mp4', 'video/webm'].includes(type)) return type;
  // Algunos dispositivos no informan el MIME del archivo seleccionado.
  if (!type || type === 'application/octet-stream') {
    if (/\.mp4$/i.test(file?.name || '')) return 'video/mp4';
    if (/\.webm$/i.test(file?.name || '')) return 'video/webm';
  }
  return '';
}

export function validateProductVideo(file) {
  if (!productVideoType(file)) return 'Selecciona un vídeo MP4 o WebM. Para MOV, expórtalo primero como MP4.';
  if (!Number.isFinite(file?.size) || file.size <= 0) return 'El vídeo está vacío o no se puede leer.';
  if (file.size > MAX_PRODUCT_VIDEO_BYTES) return 'Cada vídeo puede pesar hasta 100 MB.';
  return null;
}

// Los vídeos viven separados de images: portadas, catálogo, carrito y pedidos
// siguen recibiendo exclusivamente fotos. Nunca persistimos URLs temporales.
export function normalizeProductVideos(videos) {
  if (!Array.isArray(videos)) return [];
  const seen = new Set();
  return videos.flatMap((item) => {
    const url = typeof item === 'string' ? item.trim() : typeof item?.url === 'string' ? item.url.trim() : '';
    if (!/^https?:\/\/[^\s/]+(?:\/[^\s]*)?$/i.test(url) || seen.has(url)) return [];
    seen.add(url);
    return [{ url, name: typeof item?.name === 'string' ? item.name.trim().slice(0, 120) : '' }];
  });
}

export function productVideoSlides(videos) {
  return normalizeProductVideos(videos).map((video, index) => ({
    url: video.url, tipo: 'video', nombre: video.name || `Vídeo ${index + 1}`, corto: `Vídeo ${index + 1}`,
  }));
}
