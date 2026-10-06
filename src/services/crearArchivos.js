import { obtenerStorage } from './firebase/config';

/**
 * Subidas del apartado Crear.
 *
 * NO pasan por uploadFile (firebase/storage.js) a propósito: esa puerta
 * convierte a WebP y recorta a 2000 px, perfecto para mostrar en la tienda y
 * fatal para imprimir. Una zona de 30 cm a 300 dpi pide 3543 px; la imagen
 * del cliente y el archivo de impresión tienen que llegar enteros.
 *
 * Todo va bajo designs/{uid}/ (regla de Storage: cada usuario escribe solo en
 * su carpeta), así que hace falta sesión iniciada.
 */

const TIMEOUT_MS = 90000;

// Lado máximo de una imagen del cliente. Más que esto no mejora la impresión
// (35 cm a 300 dpi son ~4100 px) y solo hace la subida eterna en el celular.
const LADO_MAXIMO = 5000;

export const TAMANO_MAXIMO_MB = 25;

const extension = (tipo) => (tipo === 'image/png' ? 'png' : tipo === 'image/webp' ? 'webp' : 'jpg');

const subir = async (blob, ruta) => {
  const storage = await obtenerStorage();
  if (!storage) throw new Error('El almacenamiento no está disponible.');
  const { ref, uploadBytes, getDownloadURL } = await import('firebase/storage');
  const tarea = (async () => {
    const snap = await uploadBytes(ref(storage, ruta), blob, { contentType: blob.type || 'application/octet-stream' });
    return getDownloadURL(snap.ref);
  })();
  const limite = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('La subida tardó demasiado. Revisa tu conexión.')), TIMEOUT_MS);
  });
  return Promise.race([tarea, limite]);
};

const decodificar = (archivo) => new Promise((resolve, reject) => {
  const url = URL.createObjectURL(archivo);
  const img = new Image();
  img.onload = () => resolve({ img, url });
  img.onerror = () => {
    URL.revokeObjectURL(url);
    reject(new Error('No pudimos leer esa imagen. Prueba con un PNG o JPG.'));
  };
  img.src = url;
});

/**
 * Prepara la imagen que eligió el cliente: la valida y, si es enorme, la
 * reduce a LADO_MAXIMO conservando el formato (PNG sigue con transparencia).
 * Devuelve el archivo a subir, una URL local para mostrarla ya y su tamaño.
 */
export const prepararImagenCliente = async (archivo) => {
  if (!archivo || !/^image\/(png|jpe?g|webp)$/i.test(archivo.type)) {
    throw new Error('Sube una imagen PNG, JPG o WebP.');
  }
  if (archivo.size > TAMANO_MAXIMO_MB * 1024 * 1024) {
    throw new Error(`La imagen pesa más de ${TAMANO_MAXIMO_MB} MB.`);
  }
  const { img, url } = await decodificar(archivo);
  const ancho = img.naturalWidth;
  const alto = img.naturalHeight;
  const escala = Math.min(1, LADO_MAXIMO / Math.max(ancho, alto));
  if (escala === 1) return { blob: archivo, urlLocal: url, ancho, alto };

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(ancho * escala);
  canvas.height = Math.round(alto * escala);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  URL.revokeObjectURL(url);
  const tipo = archivo.type === 'image/png' || archivo.type === 'image/webp' ? 'image/png' : 'image/jpeg';
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, tipo, 0.95));
  if (!blob) throw new Error('No pudimos procesar esa imagen.');
  return { blob, urlLocal: URL.createObjectURL(blob), ancho: canvas.width, alto: canvas.height };
};

const marca = () => `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

/** Imagen original del cliente (la que coloca en su diseño). */
export const subirImagenCliente = (uid, blob) =>
  subir(blob, `designs/${uid}/crear/originales/${marca()}.${extension(blob.type)}`);

/** Archivo de impresión (PNG transparente a tamaño real) de una vista. */
export const subirArchivoImpresion = (uid, blob, vistaId) =>
  subir(blob, `designs/${uid}/crear/impresion/${marca()}_${vistaId}.png`);

/** Vista previa (prenda teñida + diseño) de una vista. */
export const subirVistaPrevia = (uid, blob, vistaId) =>
  subir(blob, `designs/${uid}/crear/previas/${marca()}_${vistaId}.jpg`);
