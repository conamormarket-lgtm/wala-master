const key = id => `crear_continuar_${id}`;
const TTL = 24 * 60 * 60 * 1000;

export function rememberPersonalizationAction(id, action, storage = sessionStorage, now = Date.now()) {
  if (!['image', 'save', 'cart'].includes(action)) return false;
  try { storage.setItem(key(id), JSON.stringify({ action, at: now })); return true; } catch { return false; }
}

export function readPersonalizationAction(id, storage = sessionStorage, now = Date.now()) {
  try {
    const value = JSON.parse(storage.getItem(key(id)) || 'null');
    return value && now >= value.at && now - value.at < TTL && ['image', 'save', 'cart'].includes(value.action) ? value.action : null;
  } catch { return null; }
}

export function clearPersonalizationAction(id, storage = sessionStorage) {
  try { storage.removeItem(key(id)); } catch { /* No persistence available. */ }
}

async function pendingFile(id, mode, file) {
  const database = await new Promise((resolve, reject) => {
    const request = indexedDB.open('wala-personalization-return', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('files');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  try {
    return await new Promise((resolve, reject) => {
      const tx = database.transaction('files', mode === 'read' ? 'readonly' : 'readwrite');
      const store = tx.objectStore('files');
      const request = mode === 'read' ? store.get(id) : mode === 'clear' ? store.delete(id) : store.put({ file, at: Date.now() }, id);
      tx.oncomplete = () => resolve(mode === 'read' && Date.now() - request.result?.at < TTL ? request.result.file : null);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error('No se pudo conservar la imagen.'));
    });
  } finally { database.close(); }
}
export const readPendingImage = id => pendingFile(id, 'read');
export const clearPendingImage = id => pendingFile(id, 'clear');
export async function savePendingImage(id, file) {
  if (!/^image\/(jpeg|png|webp|gif)$/.test(file?.type) || file.size > 20 * 1024 * 1024 || file.size <= 0) throw new Error('Usa una foto JPG, PNG, WebP o GIF de hasta 20 MB.');
  await pendingFile(id, 'write', file);
}
