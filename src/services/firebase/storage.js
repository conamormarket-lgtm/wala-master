import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from './config';

// Verificar si Storage está disponible
const isStorageAvailable = () => {
  return storage !== null;
};

/**
 * Subir archivo a Firebase Storage
 * Incluye timeout de 45 s para no quedar colgado si la red o Firebase no responden.
 */
export const uploadFile = async (file, path) => {
  if (!isStorageAvailable()) {
    const tempUrl = URL.createObjectURL(file);
    return { url: tempUrl, error: null };
  }
  const TIMEOUT_MS = 45000;
  try {
    const storageRef = ref(storage, path);
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Tiempo de espera agotado. Revisa tu conexión y las reglas de Storage en Firebase.')), TIMEOUT_MS);
    });
    const uploadPromise = (async () => {
      const snapshot = await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(snapshot.ref);
      return { url: downloadURL, error: null };
    })();
    return await Promise.race([uploadPromise, timeoutPromise]);
  } catch (error) {
    return { url: null, error: error.message };
  }
};

/**
 * Convierte una data URL (ej. de canvas.toDataURL()) a Blob y luego a File para subir.
 * @param {string} dataUrl - Data URL (image/png o image/jpeg)
 * @param {string} filename - Nombre del archivo para el File
 * @returns {File}
 */
function dataUrlToFile(dataUrl, filename = 'image.png') {
  const [header, base64] = dataUrl.split(',');
  const mime = (header.match(/:(.*?);/) || [])[1] || 'image/png';
  const bytes = atob(base64);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
  const blob = new Blob([arr], { type: mime });
  const ext = mime === 'image/png' ? 'png' : 'jpg';
  return new File([blob], filename.endsWith(ext) ? filename : `${filename}.${ext}`, { type: mime });
}

/**
 * Subir imagen desde data URL (ej. generada por canvas) a Firebase Storage.
 * @param {string} dataUrl - Data URL de la imagen (image/png recomendado)
 * @param {string} path - Ruta en Storage (ej. products/abc123/comboPreview.png)
 * @returns {Promise<{ url: string | null, error: string | null }>}
 */
export const uploadFromDataUrl = async (dataUrl, path) => {
  if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) {
    return { url: null, error: 'Data URL inválida' };
  }
  const file = dataUrlToFile(dataUrl, path.split('/').pop() || 'image.png');
  return uploadFile(file, path);
};

/**
 * Subir múltiples archivos
 */
export const uploadMultipleFiles = async (files, basePath) => {
  try {
    const uploadPromises = files.map((file, index) => {
      const filePath = `${basePath}/${Date.now()}_${index}_${file.name}`;
      return uploadFile(file, filePath);
    });
    
    const results = await Promise.all(uploadPromises);
    const urls = results.map(result => result.url).filter(url => url !== null);
    const errors = results.filter(result => result.error).map(result => result.error);
    
    return {
      urls,
      errors: errors.length > 0 ? errors : null
    };
  } catch (error) {
    return { urls: [], errors: [error.message] };
  }
};

/**
 * Eliminar archivo de Storage
 */
export const deleteFile = async (path) => {
  if (!isStorageAvailable()) {
    return { error: null }; // En modo desarrollo, no hacer nada
  }
  try {
    const storageRef = ref(storage, path);
    await deleteObject(storageRef);
    return { error: null };
  } catch (error) {
    return { error: error.message };
  }
};

/**
 * Obtener URL de descarga
 */
export const getFileURL = async (path) => {
  if (!isStorageAvailable()) {
    return { url: path, error: null }; // En modo desarrollo, retornar path como URL
  }
  try {
    const storageRef = ref(storage, path);
    const url = await getDownloadURL(storageRef);
    return { url, error: null };
  } catch (error) {
    return { url: null, error: error.message };
  }
};
