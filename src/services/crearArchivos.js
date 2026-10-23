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

const decodificarConImagen = (archivo) => new Promise((resolve, reject) => {
  const url = URL.createObjectURL(archivo);
  const img = new Image();
  img.onload = () => (img.naturalWidth && img.naturalHeight ? resolve({ img, url }) : (URL.revokeObjectURL(url), reject(new Error('vacía'))));
  img.onerror = () => {
    URL.revokeObjectURL(url);
    reject(new Error('no se pudo decodificar'));
  };
  img.src = url;
});

/** Dibuja algo (una imagen o un ImageBitmap) en un lienzo y lo devuelve como archivo. */
const aArchivo = async (fuente, ancho, alto, tipo) => {
  const canvas = document.createElement('canvas');
  canvas.width = ancho;
  canvas.height = alto;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(fuente, 0, 0, ancho, alto);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, tipo, 0.95));
  if (!blob) throw new Error('No pudimos procesar esa imagen.');
  return blob;
};

// El formato de verdad, por los primeros bytes: el nombre o el tipo que da el
// teléfono mienten seguido (una foto WebP o AVIF bajada de internet llega como
// .jpg; en la app de Android el tipo puede venir vacío).
const leerFormato = async (archivo) => {
  let b;
  try { b = new Uint8Array(await archivo.slice(0, 512).arrayBuffer()); } catch { return null; }
  if (!b.length) return null;
  const txt = (i, n) => String.fromCharCode(...b.slice(i, i + n));
  if (b[0] === 0x89 && txt(1, 3) === 'PNG') return 'png';
  if (b[0] === 0xff && b[1] === 0xd8) return 'jpg';
  if (txt(0, 4) === 'RIFF' && txt(8, 4) === 'WEBP') return 'webp';
  if (txt(0, 3) === 'GIF') return 'gif';
  if (txt(4, 4) === 'ftyp') {
    const marca = txt(8, 4);
    if (/^(avif|avis)$/.test(marca)) return 'avif';
    if (/^(heic|heix|hevc|hevx|heim|heis|mif1|msf1)$/.test(marca)) return 'heic';
  }
  if (/<svg[\s>]/i.test(new TextDecoder().decode(b))) return 'svg';
  return null;
};

// Lado largo con el que se convierte un SVG (dibujo vectorial) a PNG: alcanza
// para imprimir a 35 cm.
const LADO_SVG = 4000;

/** Un SVG pasa a PNG grande; sin tamaño propio se usa su viewBox. */
const svgAPng = async (archivo) => {
  const texto = await archivo.text();
  const doc = new DOMParser().parseFromString(texto, 'image/svg+xml');
  const svg = doc.documentElement;
  if (!svg || svg.nodeName.toLowerCase() !== 'svg') throw new Error('No pudimos leer ese SVG.');
  const caja = (svg.getAttribute('viewBox') || '').split(/[\s,]+/).map(Number);
  const medida = (n) => (/^[\d.]+(px)?$/.test(String(n || '').trim()) ? parseFloat(n) : 0);
  let ancho = medida(svg.getAttribute('width')) || caja[2] || 0;
  let alto = medida(svg.getAttribute('height')) || caja[3] || 0;
  if (!ancho || !alto) { ancho = 1000; alto = 1000; }
  if (!svg.getAttribute('viewBox')) svg.setAttribute('viewBox', `0 0 ${ancho} ${alto}`);
  const escala = LADO_SVG / Math.max(ancho, alto);
  const w = Math.round(ancho * escala);
  const h = Math.round(alto * escala);
  svg.setAttribute('width', String(w));
  svg.setAttribute('height', String(h));
  const fuente = new Blob([new XMLSerializer().serializeToString(svg)], { type: 'image/svg+xml' });
  const { img, url } = await decodificarConImagen(fuente).catch(() => { throw new Error('No pudimos leer ese SVG. Expórtalo como PNG y vuelve a subirlo.'); });
  try {
    return await aArchivo(img, w, h, 'image/png');
  } finally {
    URL.revokeObjectURL(url);
  }
};

const NO_SE_LEE = 'No pudimos leer esa imagen. Prueba con un PNG o JPG.';

/**
 * La imagen lista para usar: { img, url, archivo } (archivo puede cambiar: un
 * SVG o un formato raro pasan a PNG/JPG). Si el navegador no la abre con
 * <img>, se intenta con createImageBitmap y se pasa a PNG.
 */
const decodificar = async (archivo) => {
  if (!archivo.size) {
    throw new Error('No pudimos abrir ese archivo. Si está solo en la nube (Google Fotos, Drive), descárgalo al dispositivo y vuelve a elegirlo.');
  }
  const formato = await leerFormato(archivo);
  let fuente = archivo;
  if (formato === 'svg' || /svg/i.test(archivo.type)) {
    fuente = await svgAPng(archivo);
  } else if (!formato && !/^image\//i.test(archivo.type || '')) {
    throw new Error('Sube una imagen PNG, JPG, WebP o SVG.');
  }
  try {
    const { img, url } = await decodificarConImagen(fuente);
    return { img, url, archivo: fuente };
  } catch { /* se intenta de otra forma */ }
  if (typeof createImageBitmap === 'function') {
    try {
      const mapa = await createImageBitmap(fuente);
      const png = await aArchivo(mapa, mapa.width, mapa.height, 'image/png');
      mapa.close?.();
      const { img, url } = await decodificarConImagen(png);
      return { img, url, archivo: png };
    } catch { /* tampoco */ }
  }
  if (formato === 'heic') {
    throw new Error('Esa foto está en formato HEIC y no la podemos leer. Guárdala como JPG (o en la cámara elige JPG en vez de "Alta eficiencia") y vuelve a subirla.');
  }
  if (formato === 'gif' || formato === 'avif') throw new Error(`No pudimos leer esa imagen ${formato.toUpperCase()}. Prueba con un PNG o JPG.`);
  console.warn('[Crear] No se pudo leer la imagen:', { nombre: archivo.name, tipo: archivo.type, tamano: archivo.size, formato });
  throw new Error(NO_SE_LEE);
};

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
export const prepararImagenCliente = async (original) => {
  if (!original) throw new Error('Sube una imagen PNG, JPG, WebP o SVG.');
  if (original.size > TAMANO_MAXIMO_MB * 1024 * 1024) {
    throw new Error(`La imagen pesa más de ${TAMANO_MAXIMO_MB} MB.`);
  }
  const { img, url, archivo } = await decodificar(original);
  const ancho = img.naturalWidth;
  const alto = img.naturalHeight;
  // El tipo de verdad (por sus bytes): de eso depende si puede tener transparencia.
  const formato = archivo === original ? await leerFormato(archivo) : 'png';
  const conTransparencia = formato !== 'jpg';
  // Solo PNG, JPG y WebP se suben tal cual; lo demás (GIF, AVIF…) pasa a PNG.
  const subeTalCual = formato === 'png' || formato === 'jpg' || formato === 'webp';
  const tipoReal = { png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp' }[formato];
  const escala = Math.min(1, LADO_MAXIMO / Math.max(ancho, alto));
  const caja = conTransparencia ? bordesVisibles(img) : null;
  if (escala === 1 && !caja && subeTalCual) {
    // Con el tipo correcto (en la app el teléfono puede no darlo): así se guarda con su extensión.
    const blob = archivo.type === tipoReal ? archivo : new Blob([archivo], { type: tipoReal });
    return { blob, urlLocal: url, ancho, alto };
  }

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
