import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { obtenerStorage } from './firebase/config';
import { productVideoType, validateProductVideo } from '../utils/productVideos.mjs';

/** Subida reanudable: un vídeo puede tardar más que el timeout de las fotos. */
export async function uploadProductVideo(file, productId, { onProgress, signal } = {}) {
  const error = validateProductVideo(file);
  if (error) throw new Error(error);
  if (!/^[A-Za-z0-9_-]+$/.test(productId || '')) throw new Error('No se pudo identificar el producto.');
  if (signal?.aborted) throw new Error('Subida cancelada.');
  const storage = await obtenerStorage();
  if (!storage) throw new Error('No se ha configurado el almacenamiento de vídeos.');
  if (signal?.aborted) throw new Error('Subida cancelada.');
  const contentType = productVideoType(file);
  const ext = contentType === 'video/webm' ? 'webm' : 'mp4';
  const path = `products/${productId}/videos/${crypto.randomUUID()}.${ext}`;
  const task = uploadBytesResumable(ref(storage, path), file, { contentType });
  const cancel = () => task.cancel();
  signal?.addEventListener('abort', cancel, { once: true });
  try {
    await new Promise((resolve, reject) => {
      task.on('state_changed', (snapshot) => {
        onProgress?.(Math.round(snapshot.bytesTransferred / Math.max(snapshot.totalBytes, 1) * 100));
      }, reject, resolve);
    });
    const url = await getDownloadURL(task.snapshot.ref);
    return { url, name: file.name.replace(/\.[^.]+$/, '').slice(0, 120) };
  } finally {
    signal?.removeEventListener('abort', cancel);
  }
}
