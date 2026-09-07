import { ref, uploadBytes, getDownloadURL, deleteObject, listAll } from 'firebase/storage';
import { storage } from './config';

// Verificar si Storage está disponible
const isStorageAvailable = () => {
  return storage !== null;
};

/* ═══════════════════════════════════════════════════════════════════════════
   CONVERSIÓN A WEBP AL SUBIR
   Todo lo que sube al Storage pasa por uploadFile: banners del hero, slides
   del carrusel, logos y fondos de marca, categorías, productos. Convertir
   aquí — y no en cada pantalla — deja una sola puerta y ninguna se olvida.

   WebP pesa bastante menos que PNG/JPG a la misma calidad percibida, así que
   la página carga antes sin que se note el cambio.

   Es CONSERVADOR a propósito: ante cualquier duda se sube el archivo original.
   No se toca lo que no conviene tocar, y si el WebP saliera más pesado que el
   original (pasa con imágenes ya muy optimizadas o diminutas) se descarta.
   ═══════════════════════════════════════════════════════════════════════════ */

// SVG es vectorial: pasarlo por canvas lo rasteriza y pierde el escalado.
// GIF puede estar animado y el canvas solo se queda con el primer cuadro.
// WebP y AVIF ya vienen en un formato moderno.
const TIPOS_SIN_CONVERTIR = new Set(['image/svg+xml', 'image/gif', 'image/webp', 'image/avif']);

let soportaWebpCache = null;

/** ¿El navegador sabe exportar WebP desde canvas? (Safari <16 no). */
const soportaWebp = () => {
  if (soportaWebpCache !== null) return soportaWebpCache;
  if (typeof document === 'undefined') return (soportaWebpCache = false);
  try {
    const c = document.createElement('canvas');
    c.width = 1;
    c.height = 1;
    soportaWebpCache = c.toDataURL('image/webp').startsWith('data:image/webp');
  } catch {
    soportaWebpCache = false;
  }
  return soportaWebpCache;
};

/** Decodifica el archivo a algo dibujable en un canvas. */
const decodificarImagen = (file) => {
  if (typeof createImageBitmap === 'function') {
    return createImageBitmap(file).catch(() => decodificarConImg(file));
  }
  return decodificarConImg(file);
};

const decodificarConImg = (file) => new Promise((resolve, reject) => {
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
  img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('No se pudo leer la imagen')); };
  img.src = url;
});

/**
 * Devuelve { file, path } listos para subir. Si no se puede o no conviene
 * convertir, devuelve los originales sin tocar.
 * Se exporta para poder comprobarla por separado y reutilizarla si alguna vez
 * hace falta reconvertir imagenes ya subidas.
 */
export const convertirAWebp = async (file, path) => {
  const original = { file, path };
  try {
    if (!file || typeof file.type !== 'string') return original;
    if (!file.type.startsWith('image/')) return original;   // fuentes, PDFs, etc.
    if (TIPOS_SIN_CONVERTIR.has(file.type)) return original;
    if (!soportaWebp() || typeof document === 'undefined') return original;

    const img = await decodificarImagen(file);
    const ancho = img.width || img.naturalWidth;
    const alto = img.height || img.naturalHeight;
    if (!ancho || !alto) return original;

    const canvas = document.createElement('canvas');
    canvas.width = ancho;
    canvas.height = alto;
    const ctx = canvas.getContext('2d');
    if (!ctx) return original;
    ctx.drawImage(img, 0, 0);
    if (typeof img.close === 'function') img.close();

    // Un PNG suele ser logo o gráfico con bordes duros, donde la compresión se
    // nota antes; un JPG ya es una foto que venía comprimida. De ahí los dos
    // niveles de calidad.
    const calidad = file.type === 'image/png' ? 0.92 : 0.82;
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', calidad));

    // Si el navegador ignoró el formato, toBlob devuelve PNG: no sirve.
    if (!blob || blob.type !== 'image/webp') return original;
    // Con imágenes diminutas o ya muy optimizadas el WebP puede salir más
    // pesado; en ese caso convertir empeoraría las cosas.
    if (blob.size >= file.size) return original;

    const nombre = String(file.name || path.split('/').pop() || 'imagen').replace(/\.[^.]+$/, '');
    return {
      file: new File([blob], `${nombre}.webp`, { type: 'image/webp' }),
      path: path.replace(/\.[^./]+$/, '') + '.webp',
    };
  } catch (error) {
    console.warn('[storage] no se pudo convertir a WebP, se sube el original:', error?.message || error);
    return original;
  }
};

/**
 * Subir archivo a Firebase Storage
 * Incluye timeout de 45 s para no quedar colgado si la red o Firebase no responden.
 *
 * Las imágenes se convierten a WebP antes de subir (ver convertirAWebp): es la
 * única puerta de subida de la app, así que con esto banners, logos, fondos de
 * marca, categorías y productos pesan menos sin tocar cada pantalla. Lo que no
 * sea imagen —fuentes, por ejemplo— pasa intacto.
 */
export const uploadFile = async (archivoOriginal, rutaOriginal) => {
  const { file, path } = await convertirAWebp(archivoOriginal, rutaOriginal);
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

/**
 * Obtener todos los archivos de una carpeta (ej. para boletas)
 */
export const listFilesInFolder = async (folderPath) => {
  if (!isStorageAvailable()) {
    return { urls: [], error: null };
  }
  try {
    const folderRef = ref(storage, folderPath);
    const result = await listAll(folderRef);
    const urlPromises = result.items.map(itemRef => getDownloadURL(itemRef));
    const urls = await Promise.all(urlPromises);
    return { urls, error: null };
  } catch (error) {
    // Si la carpeta no existe o no hay acceso, firebase lanza un error
    return { urls: [], error: error.message };
  }
};
