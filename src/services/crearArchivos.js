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
 * Caja (en píxeles de la imagen) que contiene todo lo que no es transparente,
 * o null si la imagen no tiene bordes transparentes que quitar. Recorre de
 * afuera hacia adentro y se detiene en la primera fila/columna con algo
 * visible, así no lee la imagen entera.
 */
export const bordesVisibles = (fuente) => {
  const ancho = fuente.naturalWidth || fuente.width;
  const alto = fuente.naturalHeight || fuente.height;
  const canvas = document.createElement('canvas');
  canvas.width = ancho;
  canvas.height = alto;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(fuente, 0, 0, ancho, alto);
  let d;
  try {
    d = ctx.getImageData(0, 0, ancho, alto).data;
  } catch {
    return null;
  }
  const visible = (x, y) => d[(y * ancho + x) * 4 + 3] > 12;
  const filaVisible = (y) => { for (let x = 0; x < ancho; x += 1) if (visible(x, y)) return true; return false; };
  let arriba = 0;
  while (arriba < alto && !filaVisible(arriba)) arriba += 1;
  if (arriba === alto) return null; // toda transparente
  let abajo = alto - 1;
  while (abajo > arriba && !filaVisible(abajo)) abajo -= 1;
  const columnaVisible = (x) => { for (let y = arriba; y <= abajo; y += 1) if (visible(x, y)) return true; return false; };
  let izquierda = 0;
  while (izquierda < ancho && !columnaVisible(izquierda)) izquierda += 1;
  let derecha = ancho - 1;
  while (derecha > izquierda && !columnaVisible(derecha)) derecha -= 1;
  const caja = { x: izquierda, y: arriba, w: derecha - izquierda + 1, h: abajo - arriba + 1 };
  // Si casi no hay borde que quitar, no vale la pena recortar.
  if (caja.w * caja.h > ancho * alto * 0.98) return null;
  return caja;
};

/** Recorta un trozo (en píxeles de la imagen) y lo devuelve como PNG. */
export const recortarImagen = async (fuente, { x, y, w, h }) => {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(w));
  canvas.height = Math.max(1, Math.round(h));
  canvas.getContext('2d').drawImage(fuente, x, y, w, h, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('No pudimos recortar la imagen.');
  return { blob, ancho: canvas.width, alto: canvas.height };
};

/**
 * Prepara la imagen que eligió el cliente: la valida, si es enorme la reduce
 * a LADO_MAXIMO, y si es PNG/WebP le quita los bordes transparentes (así la
 * imagen ocupa en la prenda solo lo que se ve). Devuelve el archivo a subir,
 * una URL local para mostrarla ya y su tamaño.
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
  const conTransparencia = archivo.type === 'image/png' || archivo.type === 'image/webp';
  const escala = Math.min(1, LADO_MAXIMO / Math.max(ancho, alto));
  const caja = conTransparencia ? bordesVisibles(img) : null;
  if (escala === 1 && !caja) return { blob: archivo, urlLocal: url, ancho, alto };

  const origen = caja || { x: 0, y: 0, w: ancho, h: alto };
  const reduccion = Math.min(1, LADO_MAXIMO / Math.max(origen.w, origen.h));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(origen.w * reduccion);
  canvas.height = Math.round(origen.h * reduccion);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, origen.x, origen.y, origen.w, origen.h, 0, 0, canvas.width, canvas.height);
  URL.revokeObjectURL(url);
  const tipo = conTransparencia ? 'image/png' : 'image/jpeg';
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
