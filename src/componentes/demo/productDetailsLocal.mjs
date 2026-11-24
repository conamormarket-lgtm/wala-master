import { detailMediaType, normalizeDetailComposition, validateDetailComposition, validateDetailFile } from '../../utils/productDetails.mjs';

let opening;
function database() {
  if (!opening) opening = new Promise((resolve, reject) => {
    const request = indexedDB.open('wala-product-details-preview', 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore('compositions');
      request.result.createObjectStore('assets', { keyPath: 'id' }).createIndex('productId', 'productId');
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => { opening = null; reject(new Error('No se pudo abrir el almacenamiento local.')); };
  });
  return opening;
}
const read = request => new Promise((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
const done = tx => new Promise((resolve, reject) => {
  tx.oncomplete = resolve;
  tx.onerror = () => reject(new Error('No se pudo guardar en este navegador. Comprueba el espacio disponible.'));
  tx.onabort = () => reject(new Error('El guardado local se interrumpió.'));
});

export async function readLocalProductDetails(productId) {
  const db = await database();
  const tx = db.transaction(['compositions', 'assets'], 'readonly');
  const [composition, assets] = await Promise.all([read(tx.objectStore('compositions').get(productId)), read(tx.objectStore('assets').index('productId').getAll(productId))]);
  return { composition: normalizeDetailComposition(composition, { allowLocal: true }), assets };
}

export async function saveLocalProductDetails(productId, value) {
  const invalid = validateDetailComposition(value, { allowLocal: true });
  if (invalid) throw new Error(invalid);
  const composition = normalizeDetailComposition(value, { allowLocal: true });
  const db = await database();
  const tx = db.transaction('compositions', 'readwrite');
  const completed = done(tx);
  tx.objectStore('compositions').put(composition, productId);
  await completed;
  return composition;
}

export async function uploadLocalDetailMedia(productId, file, { signal, onProgress } = {}) {
  const invalid = validateDetailFile(file);
  if (invalid) throw new Error(invalid);
  if (signal?.aborted) throw new Error('Subida cancelada.');
  const id = crypto.randomUUID();
  const db = await database();
  if (signal?.aborted) throw new Error('Subida cancelada.');
  const tx = db.transaction('assets', 'readwrite');
  const completed = done(tx);
  tx.objectStore('assets').put({ id, productId, blob: file });
  await completed;
  onProgress?.(100);
  return { id, type: detailMediaType(file), url: `local:${id}`, alt: file.name.replace(/\.[^.]+$/, '').slice(0, 240), caption: '' };
}
