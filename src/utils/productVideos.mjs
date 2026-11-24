import { isLocalProductMediaUrl } from './detailMediaEnvironment.mjs';

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
export function normalizeProductVideos(videos, { allowLocal = false } = {}) {
  if (!Array.isArray(videos)) return [];
  const seen = new Set();
  return videos.flatMap((item) => {
    const url = typeof item === 'string' ? item.trim() : typeof item?.url === 'string' ? item.url.trim() : '';
    const safeUrl = value => typeof value === 'string' && (/^https?:\/\/[^\s/]+(?:\/[^\s]*)?$/i.test(value) || (allowLocal && isLocalProductMediaUrl(value)));
    if (!safeUrl(url) || seen.has(url)) return [];
    seen.add(url);
    return [{ url, name: typeof item?.name === 'string' ? item.name.trim().slice(0, 120) : '',
      ...(typeof item?.variantId === 'string' && /^[\w-]{1,150}$/.test(item.variantId) && { variantId: item.variantId }),
      ...(safeUrl(item?.poster) && { poster: item.poster.trim() }),
      ...(Number.isInteger(item?.afterImage) && item.afterImage >= 0 && item.afterImage <= 200 && { afterImage: item.afterImage }),
      ...(['autoPlay', 'muted', 'loop'].some(k => typeof item?.[k] === 'boolean') && { autoPlay: item.autoPlay === true, muted: item.autoPlay === true || item.muted === true, loop: item.loop === true }),
    }];
  });
}

export function productVideoSlides(videos, options) {
  return normalizeProductVideos(videos, options).map((video, index) => ({
    ...video,
    url: video.url, tipo: 'video', nombre: video.name || `Vídeo ${index + 1}`, corto: `Vídeo ${index + 1}`,
  }));
}

export function galleryWithProductVideos(images = [], videos = [], variantId) {
  const matching = videos.filter(v => !v.variantId || v.variantId === variantId);
  const at = position => matching.filter(v => Number.isInteger(v.afterImage) && Math.min(v.afterImage, images.length) === position);
  return [...at(0), ...images.flatMap((img, index) => [img, ...at(index + 1)]), ...matching.filter(v => !Number.isInteger(v.afterImage))];
}
