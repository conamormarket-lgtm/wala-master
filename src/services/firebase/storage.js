import { ref, uploadBytes, getDownloadURL, deleteObject, listAll } from 'firebase/storage';
import { obtenerStorage } from './config';

// Instancia de Storage, o null si Firebase no esta configurado (modo
// desarrollo sin credenciales). Se pide cuando hace falta en vez de al cargar
// el modulo: ver obtenerStorage en config.js — el SDK de Storage solo sirve
// para SUBIR, y ver la tienda no sube nada.

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
// Lado maximo (px) con el que se guarda una imagen. Ver convertirAWebp.
// Exportado para que la reconversion de imagenes ya subidas (imagenesWebp.js)
// decida con el MISMO numero cuales estan de mas.
export const MAX_LADO = 2000;

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
 * Anchos de las copias pequeñas que se generan junto a la imagen principal.
 *
 * No son números redondos al azar: salen de medir los huecos reales de la
 * tienda. 160 cubre el swatch de color (44 px), la miniatura de la lista de
 * deseos (60) y la de la ficha (68); 400 la tarjeta en móvil (~180); 800 la
 * tarjeta en escritorio (~320) — todos a densidad 2x. Por encima manda la
 * principal, limitada a MAX_LADO, que es la que necesita un hero a pantalla
 * completa.
 *
 * El objetivo es que ningún hueco reduzca más de ~2x: por encima de eso el
 * navegador remuestrea con un filtro barato y la imagen se ve sucia. Ese es el
 * motivo de CALIDAD, tanto o más que el peso.
 */
export const ANCHOS_VARIANTE = [160, 400, 800];

/** Dibuja la imagen ya decodificada en un canvas del tamaño pedido y la codifica. */
const codificarWebp = async (img, ancho, alto, calidad) => {
  const canvas = document.createElement('canvas');
  canvas.width = ancho;
  canvas.height = alto;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  // Al reducir, el remuestreo por defecto deja bordes sucios; 'high' usa el
  // filtrado bueno del navegador.
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, ancho, alto);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', calidad));
  // Si el navegador ignoró el formato, toBlob devuelve PNG: no sirve.
  return blob && blob.type === 'image/webp' ? blob : null;
};

/** `carpeta/foto.png` + 400 -> `carpeta/foto_400.webp` */
export const rutaDeVariante = (path, ancho) =>
  path.replace(/\.[^./]+$/, '') + `_${ancho}.webp`;

/**
 * Prepara TODO lo que se sube para una imagen: el archivo principal (limitado
 * a MAX_LADO) y sus copias pequeñas. La imagen se decodifica UNA vez y se
 * reutiliza para todos los tamaños.
 *
 * Es conservador: ante cualquier duda devuelve el original sin tocar y sin
 * variantes, y quien llame sigue funcionando igual que antes.
 */
export const prepararSubida = async (file, path) => {
  const soloOriginal = { principal: { file, path }, variantes: [] };
  try {
    if (!file || typeof file.type !== 'string') return soloOriginal;
    if (!file.type.startsWith('image/')) return soloOriginal;   // fuentes, PDFs, etc.
    if (TIPOS_SIN_CONVERTIR.has(file.type)) return soloOriginal;
    if (!soportaWebp() || typeof document === 'undefined') return soloOriginal;

    const img = await decodificarImagen(file);
    const anchoOriginal = img.width || img.naturalWidth;
    const altoOriginal = img.height || img.naturalHeight;
    if (!anchoOriginal || !altoOriginal) return soloOriginal;

    // Un PNG suele ser logo o gráfico con bordes duros, donde la compresión se
    // nota antes; un JPG ya es una foto que venía comprimida. De ahí los dos
    // niveles de calidad.
    const calidad = file.type === 'image/png' ? 0.92 : 0.82;
    const nombre = String(file.name || path.split('/').pop() || 'imagen').replace(/\.[^.]+$/, '');
    const proporcion = altoOriginal / anchoOriginal;

    // ── Principal ───────────────────────────────────────────────────────────
    // Techo de resolución: Firebase Storage no redimensiona del lado del
    // servidor, así que esta es la única oportunidad. Lo que se sube es
    // literalmente lo que va a descargar cada visitante.
    const escala = Math.min(1, MAX_LADO / Math.max(anchoOriginal, altoOriginal));
    const anchoPrincipal = Math.round(anchoOriginal * escala);
    const blobPrincipal = await codificarWebp(
      img, anchoPrincipal, Math.round(altoOriginal * escala), calidad
    );

    let principal = { file, path };
    // Con imágenes diminutas o ya muy optimizadas el WebP puede salir más
    // pesado; ahí convertir empeoraría las cosas. Salvo que hayamos REDUCIDO
    // el tamaño: entonces preferimos el WebP aunque pese algo más, porque lo
    // que importa es no servir 4000 px para pintar 300.
    if (blobPrincipal && !(blobPrincipal.size >= file.size && escala === 1)) {
      principal = {
        file: new File([blobPrincipal], `${nombre}.webp`, { type: 'image/webp' }),
        path: path.replace(/\.[^./]+$/, '') + '.webp',
      };
    }

    // ── Variantes ───────────────────────────────────────────────────────────
    // Solo las que son de verdad más pequeñas que la principal: generar una
    // copia de 800 px a partir de un logo de 200 px sería agrandar, que pesa
    // más y se ve peor.
    const variantes = [];
    for (const ancho of ANCHOS_VARIANTE) {
      if (ancho >= anchoPrincipal) continue;
      const blob = await codificarWebp(img, ancho, Math.round(ancho * proporcion), calidad);
      if (!blob) continue;
      variantes.push({ ancho, file: new File([blob], `${nombre}_${ancho}.webp`, { type: 'image/webp' }), path: rutaDeVariante(path, ancho) });
    }

    if (typeof img.close === 'function') img.close();
    return { principal, variantes };
  } catch (error) {
    console.warn('[storage] no se pudieron preparar las variantes, se sube el original:', error?.message || error);
    return soloOriginal;
  }
};

/**
 * Compatibilidad: devuelve solo el archivo principal, como antes.
 * Se conserva porque estaba exportada y se podía comprobar por separado.
 */
export const convertirAWebp = async (file, path) => (await prepararSubida(file, path)).principal;

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
  const { principal, variantes } = await prepararSubida(archivoOriginal, rutaOriginal);
  const storage = await obtenerStorage();
  if (!storage) {
    const tempUrl = URL.createObjectURL(principal.file);
    return { url: tempUrl, variantes: {}, error: null };
  }
  const TIMEOUT_MS = 45000;
  try {
    const subirUno = async ({ file, path }) => {
      const snapshot = await uploadBytes(ref(storage, path), file);
      return await getDownloadURL(snapshot.ref);
    };
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Tiempo de espera agotado. Revisa tu conexión y las reglas de Storage en Firebase.')), TIMEOUT_MS);
    });

    // La principal manda: es la que se guarda en el documento y la que ve todo
    // el que aún no sepa de variantes.
    const url = await Promise.race([subirUno(principal), timeoutPromise]);

    // Las variantes van DESPUÉS y cada una por su cuenta: si una falla (red,
    // permisos, cuota) no puede tumbar una subida que ya tuvo éxito. Lo peor
    // que pasa es que esa imagen se siga sirviendo en su tamaño grande, que es
    // exactamente lo que ocurría antes de existir las variantes.
    const mapa = {};
    await Promise.all(variantes.map(async (v) => {
      try {
        mapa[v.ancho] = await subirUno(v);
      } catch (e) {
        console.warn(`[storage] la variante de ${v.ancho}px no se pudo subir:`, e?.message || e);
      }
    }));

    return { url, variantes: mapa, error: null };
  } catch (error) {
    return { url: null, variantes: {}, error: error.message };
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
  const storage = await obtenerStorage();
  if (!storage) {
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
  const storage = await obtenerStorage();
  if (!storage) {
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
  const storage = await obtenerStorage();
  if (!storage) {
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
