import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { obtenerStorage } from './firebase/config';
import { detailMediaType, validateDetailFile } from '../utils/productDetails.mjs';
import { productVideoType } from '../utils/productVideos.mjs';

export async function uploadProductDetailMedia(file, productId, { signal, onProgress } = {}) {
  const error = validateDetailFile(file);
  if (error) throw new Error(error);
  if (!/^[\w-]+$/.test(productId || '')) throw new Error('No se pudo identificar el producto.');
  const storage = await obtenerStorage();
  if (!storage) throw new Error('No se ha configurado el almacenamiento.');
  if (signal?.aborted) throw new Error('Subida cancelada.');
  const type = detailMediaType(file);
  const contentType = type === 'video' ? productVideoType(file) : file.type;
  const ext = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'video/mp4': 'mp4', 'video/webm': 'webm' }[contentType];
  const id = crypto.randomUUID();
  const task = uploadBytesResumable(ref(storage, `products/${productId}/details/${id}.${ext}`), file, { contentType });
  const cancel = () => task.cancel();
  signal?.addEventListener('abort', cancel, { once: true });
  try {
    await new Promise((resolve, reject) => task.on('state_changed', snapshot => onProgress?.(Math.round(snapshot.bytesTransferred / Math.max(snapshot.totalBytes, 1) * 100)), reject, resolve));
    return { id, type, url: await getDownloadURL(task.snapshot.ref), alt: file.name.replace(/\.[^.]+$/, '').slice(0, 240), caption: '' };
  } finally { signal?.removeEventListener('abort', cancel); }
}
