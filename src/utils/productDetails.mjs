import { isEmulatorDetailUrl, isLocalProductMediaUrl } from './detailMediaEnvironment.mjs';
import { mosaicCell, MEDIA_RATIO_OPTIONS, MEDIA_FIT_OPTIONS } from './productMosaic.mjs';
import { productVideoType, validateProductVideo } from './productVideos.mjs';
import { normalizeProductCommerce, validateProductCommerce } from './productCommerce.mjs';
import { detailVideoPlayback } from './detailVideoPlayback.mjs';

export const MAX_DETAIL_BLOCKS = 24;
export const MAX_DETAIL_MEDIA = 12;
export const MULTI_DETAIL_KINDS = ['gallery', 'mosaic', 'carousel'];
export const DETAIL_MEDIA_ACCEPT = 'image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm';
const text = (value, max) => typeof value === 'string' ? value.slice(0, max) : '';
const choice = (value, values, fallback) => values.includes(value) ? value : fallback;
const identifier = (value, fallback) => /^[\w-]{1,90}$/.test(value || '') ? value : fallback;

export function detailMediaUrl(value, { allowLocal = false } = {}) {
  if (typeof value !== 'string') return '';
  const url = value.trim();
  if (isEmulatorDetailUrl(url)) return url;
  if (allowLocal && isLocalProductMediaUrl(url)) return url;
  try { const u = new URL(url); return u.protocol === 'https:' && !u.username && !u.password && url.length <= 4096 ? u.href : ''; } catch { return ''; }
}

/** Datos declarativos: nunca se persiste HTML, estilos arbitrarios ni URLs blob. */
export function normalizeDetailComposition(value, options = {}) {
  if (!value || typeof value !== 'object' || value.version !== 1) return null;
  const ids = new Set();
  const blocks = (Array.isArray(value.blocks) ? value.blocks : []).slice(0, MAX_DETAIL_BLOCKS).map((b, i) => {
    if (!b || typeof b !== 'object') return null;
    let id = identifier(b.id, `block-${i}`);
    if (ids.has(id)) id = `block-${i}-${ids.size}`;
    ids.add(id);
    const kind = choice(b.kind, ['text', 'image', 'video', 'gallery', 'split', 'mosaic', 'carousel'], 'text');
    const columns = choice(Number(b.columns), kind === 'mosaic' ? [1, 2, 3, 4, 5, 6] : [1, 2, 3, 4], 2);
    const media = (Array.isArray(b.media) ? b.media : []).slice(0, MULTI_DETAIL_KINDS.includes(kind) ? MAX_DETAIL_MEDIA : 1).flatMap((m, index) => {
      const url = detailMediaUrl(m?.url, options);
      if (!url || kind === 'text') return [];
      const type = choice(m.type, ['image', 'video'], 'image');
      if ((kind === 'image' && type !== 'image') || (kind === 'video' && type !== 'video')) return [];
      return [{ id: identifier(m.id, `media-${index}`), type, url, ...(type === 'image' && detailMediaUrl(m.mobileUrl, options) && { mobileUrl: detailMediaUrl(m.mobileUrl, options) }), alt: text(m.alt, 240), caption: text(m.caption, 400), poster: type === 'video' ? detailMediaUrl(m.poster, options) : '', ...(type === 'video' && detailVideoPlayback(m)), ratio: choice(m.ratio, MEDIA_RATIO_OPTIONS, 'inherit'), fit: choice(m.fit, MEDIA_FIT_OPTIONS, 'inherit'), ...(b.mosaicLayout === 'flexible' && { cell: mosaicCell(m.cell, columns, Number(b.mobileColumns) === 2 ? 2 : 1) }) }];
    });
    return { id, kind, title: text(b.title, 200), text: text(b.text, 12000), media,
      side: choice(b.side, ['left', 'right'], 'left'), width: choice(b.width, ['wide', 'normal', 'narrow'], 'wide'),
      mosaicLayout: b.mosaicLayout === 'flexible' ? 'flexible' : 'classic', mosaicSizing: b.mosaicSizing === 'proportional' ? 'proportional' : 'manual', rowHeight: Math.min(400, Math.max(80, Number(b.rowHeight) || 200)),
      columns, mobileColumns: choice(Number(b.mobileColumns), [1, 2], 1),
      ratio: choice(b.ratio, ['auto', 'square', 'portrait', 'portrait34', 'landscape', 'story'], 'auto'),
      fit: choice(b.fit, ['contain', 'cover'], 'contain'), align: choice(b.align, ['left', 'center'], 'left'),
      background: choice(b.background, ['plain', 'soft'], 'plain') };
  }).filter(Boolean);
  const commerce = normalizeProductCommerce(value.commerce, options);
  if (commerce.storyMediaId && !blocks.some(b => b.media.some(m => m.type === 'video' && `${b.id}:${m.id}` === commerce.storyMediaId))) commerce.storyMediaId = '';
  return { version: 1, visible: value.visible !== false, heading: text(value.heading, 160), eyebrow: text(value.eyebrow, 160), blocks, commerce };
}

export function validateDetailComposition(value, options = {}) {
  if (!value || value.version !== 1 || !Array.isArray(value.blocks)) return 'La composición no tiene un formato válido.';
  if (value.blocks.length > MAX_DETAIL_BLOCKS) return `Puedes usar hasta ${MAX_DETAIL_BLOCKS} bloques.`;
  const commerceError = validateProductCommerce(value.commerce, options);
  if (commerceError) return commerceError;
  for (const [index, b] of value.blocks.entries()) {
    const prefix = `Bloque ${index + 1}: `;
    if (!b || !['text', 'image', 'video', 'gallery', 'split', 'mosaic', 'carousel'].includes(b.kind)) return prefix + 'elige un tipo válido.';
    if ((b.title || '').length > 200 || (b.text || '').length > 12000) return prefix + 'el texto es demasiado largo.';
    if (b.kind === 'text' && !b.title?.trim() && !b.text?.trim()) return prefix + 'añade un título o texto.';
    if (b.kind !== 'text') {
      if (!b.media?.length) return prefix + 'añade una foto o un vídeo.';
      if (b.media.length > (MULTI_DETAIL_KINDS.includes(b.kind) ? MAX_DETAIL_MEDIA : 1)) return prefix + 'hay demasiados archivos.';
      if (b.kind === 'mosaic' && b.mosaicLayout !== 'flexible' && b.media.length < 3) return prefix + 'el mosaico necesita al menos tres archivos.';
      for (const m of b.media) {
        if (m.ratio != null && !MEDIA_RATIO_OPTIONS.includes(m.ratio)) return prefix + 'elige una proporción válida para cada archivo.';
        if (m.fit != null && !MEDIA_FIT_OPTIONS.includes(m.fit)) return prefix + 'elige un ajuste válido para cada archivo.';
        if (m.type === 'video' && ['autoPlay', 'muted', 'loop'].some(field => m[field] != null && typeof m[field] !== 'boolean')) return prefix + 'las opciones de reproducción del vídeo deben estar activadas o desactivadas.';
        if (!detailMediaUrl(m.url, options)) return prefix + 'usa un archivo subido o una URL HTTPS válida.';
        if (m.poster && !detailMediaUrl(m.poster, options)) return prefix + 'la portada del vídeo necesita una imagen subida o una URL HTTPS.';
        if (m.mobileUrl && (m.type !== 'image' || !detailMediaUrl(m.mobileUrl, options))) return prefix + 'la versión móvil necesita una imagen subida o una URL HTTPS.';
        if (!['image', 'video'].includes(m.type) || (['image', 'video'].includes(b.kind) && m.type !== b.kind)) return prefix + 'el tipo de archivo no corresponde al bloque.';
      }
    }
  }
  return null;
}

export function detailMediaType(file) {
  if (['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file?.type)) return 'image';
  return productVideoType(file) ? 'video' : null;
}

export function validateDetailFile(file) {
  const type = detailMediaType(file);
  if (type === 'video') return validateProductVideo(file);
  if (type !== 'image') return 'Usa fotos JPG, PNG, WebP o GIF, o vídeos MP4/WebM.';
  if (!Number.isFinite(file.size) || file.size <= 0) return 'El archivo está vacío.';
  return file.size > 20 * 1024 * 1024 ? 'Cada foto puede pesar hasta 20 MB.' : null;
}

export function newDetailBlock(kind = 'text') {
  return normalizeDetailComposition({ version: 1, blocks: [{ id: crypto.randomUUID(), kind, ...(kind === 'carousel' && { ratio: 'story', columns: 4, fit: 'cover' }), ...(kind === 'mosaic' && { fit: 'contain', ratio: 'portrait34', mosaicLayout: 'flexible', mosaicSizing: 'proportional', columns: 3, rowHeight: 200 }) }] }).blocks[0];
}

export function moveDetailItem(items, index, offset) {
  const next = index + offset;
  if (index < 0 || next < 0 || next >= items.length) return items;
  const result = [...items];
  [result[index], result[next]] = [result[next], result[index]];
  return result;
}

export function initialDetailComposition({ descripcion = '', imagenes = [], videos = [] } = {}) {
  const texto = descripcion.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<(br|\/p|\/div|\/li)\b[^>]*>/gi, '\n').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/\n{3,}/g, '\n\n').trim();
  const fotos = imagenes.filter(f => f.tipo !== 'video' && detailMediaUrl(f.url));
  const foto = fotos[1] || fotos[0];
  const blocks = [];
  if (texto || foto) blocks.push({ id: 'detalle-inicial', kind: foto ? (texto ? 'split' : 'image') : 'text', text: texto, media: foto ? [{ id: 'foto-inicial', type: 'image', url: foto.url, alt: foto.nombre || '' }] : [] });
  if (videos.length) blocks.push({ id: 'videos-iniciales', kind: 'gallery', title: 'Velo en movimiento', ratio: 'portrait', columns: 3, media: videos.map((v, i) => ({ id: `video-${i}`, type: 'video', url: v.url, alt: v.nombre || '' })) });
  return normalizeDetailComposition({ version: 1, heading: 'Todos los detalles', eyebrow: 'Conoce tu próxima elección', blocks });
}
