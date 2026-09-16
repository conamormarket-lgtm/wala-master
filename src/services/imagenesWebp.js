import { getCollection, setDocument } from './firebase/firestore';
import { uploadFile, MAX_LADO } from './firebase/storage';

/**
 * RECONVERSIÓN A WEBP DE IMÁGENES YA SUBIDAS
 * ══════════════════════════════════════════
 * uploadFile ya convierte a WebP todo lo que se sube de ahora en adelante
 * (ver services/firebase/storage.js). Esto es para lo que quedó de ANTES:
 * recorre los documentos, encuentra las URLs de imágenes que siguen en
 * PNG/JPG, las vuelve a subir convertidas y reemplaza la URL en el documento.
 *
 * Cómo trabaja:
 *  1. Recorre el documento entero buscando strings que sean URLs de NUESTRO
 *     Firebase Storage con extensión de imagen. Se hace así, y no por una
 *     lista de campos, porque las imágenes viven en sitios muy distintos:
 *     brand.logoUrl, section.settings.mediaUrl, slides[].mobileImageUrl,
 *     items[].imageUrl… Enumerarlos todos sería olvidarse de la mitad.
 *  2. Carga cada imagen en un canvas y la sube de nuevo por uploadFile, que
 *     es quien hace la conversión. Así la reconversión y las subidas nuevas
 *     comparten exactamente las mismas reglas y calidad.
 *  3. Escribe el documento con las URLs nuevas.
 *
 * Lo que NO hace, a propósito:
 *  - NO borra los archivos viejos del Storage. La misma imagen puede estar
 *    referenciada desde otro documento que este proceso no toque, y borrarla
 *    dejaría un hueco imposible de deshacer. Ocupan espacio, pero ya no se
 *    piden. Si algo saliera mal, la URL vieja sigue viva.
 *  - NO toca imágenes externas (Google Drive, Unsplash, cualquier otro
 *    dominio): no son nuestras, no podemos volver a subirlas a su sitio.
 *  - NO toca SVG ni GIF, por lo mismo que uploadFile: el SVG es vectorial y
 *    el canvas solo ve el primer cuadro de un GIF.
 */

// PNG y JPG siempre valen la pena (van a WebP). Las WebP entran tambien, pero
// solo se reescriben si superan MAX_LADO: son las que se subieron cuando la
// conversion a WebP ya existia pero aun no habia techo de resolucion, asi que
// pesan lo que pesaba el original del movil. Las que ya estan dentro del techo
// se descartan al mirar sus dimensiones (ver mas abajo), sin reescribir nada.
const EXTENSIONES = /\.(png|jpe?g|webp)(\?|$)/i;

export const esWebp = (url) => /\.webp(\?|$)/i.test(nombreDelObjeto(url));

const esUrlDeNuestroStorage = (v) =>
  typeof v === 'string' && v.includes('firebasestorage.googleapis.com');

/**
 * Una URL de Firebase Storage trae el nombre del objeto codificado en la ruta
 * (/o/carpeta%2Farchivo.png?alt=media...). Hay que mirar ESE nombre y no la URL
 * entera, porque el token de acceso puede contener cualquier cosa.
 */
const nombreDelObjeto = (url) => {
  try {
    const m = String(url).match(/\/o\/([^?]+)/);
    return m ? decodeURIComponent(m[1]) : '';
  } catch {
    return '';
  }
};

const esImagenConvertible = (url) =>
  esUrlDeNuestroStorage(url) && EXTENSIONES.test(nombreDelObjeto(url));

/**
 * Recorre cualquier estructura y devuelve las URLs convertibles que encuentre.
 * Exportada para poder comprobarla por separado: es la pieza de la que depende
 * que no se escape ninguna imagen ni se toque una que no toca.
 */
export const buscarUrls = (valor, encontradas = new Set()) => {
  if (typeof valor === 'string') {
    if (esImagenConvertible(valor)) encontradas.add(valor);
    return encontradas;
  }
  if (Array.isArray(valor)) {
    valor.forEach((v) => buscarUrls(v, encontradas));
    return encontradas;
  }
  if (valor && typeof valor === 'object') {
    Object.values(valor).forEach((v) => buscarUrls(v, encontradas));
  }
  return encontradas;
};

/** Devuelve una copia de la estructura con las URLs reemplazadas según el mapa. */
export const reemplazarUrls = (valor, mapa) => {
  if (typeof valor === 'string') return mapa.get(valor) || valor;
  if (Array.isArray(valor)) return valor.map((v) => reemplazarUrls(v, mapa));
  if (valor && typeof valor === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(valor)) out[k] = reemplazarUrls(v, mapa);
    return out;
  }
  return valor;
};

/**
 * Descarga la imagen y la devuelve como File para volver a subirla.
 * Se usa <img crossOrigin="anonymous"> en vez de fetch porque es el mismo
 * camino que ya usa el editor con imágenes de Storage y se sabe que el CORS
 * lo permite.
 */
/**
 * Descarga una imagen y la devuelve como File PNG junto con sus dimensiones.
 * Las dimensiones son las que deciden si una WebP ya subida merece reescribirse
 * (ver el bucle de reconvertirImagenesAWebp). Exportada, como buscarUrls, para
 * poder comprobarla por separado.
 */
export const descargarComoFile = (url, nombre) => new Promise((resolve, reject) => {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      // Se re-empaqueta como PNG para no perder calidad dos veces: la única
      // compresión con pérdida la hace uploadFile al pasarlo a WebP. (Para una
      // WebP que ya venía comprimida es una generación más, pero lo que importa
      // ahí es el redimensionado, que es de donde sale todo el ahorro.)
      canvas.toBlob((blob) => {
        if (!blob) { reject(new Error('El canvas no devolvió imagen')); return; }
        resolve({
          file: new File([blob], nombre, { type: 'image/png' }),
          ancho: img.naturalWidth,
          alto: img.naturalHeight,
        });
      }, 'image/png');
    } catch (e) {
      reject(e);
    }
  };
  img.onerror = () => reject(new Error('No se pudo cargar la imagen (¿CORS o archivo borrado?)'));
  img.src = url;
});

/**
 * Reconvierte las imágenes de las colecciones indicadas.
 *
 * @param {{ colecciones?: string[], onProgreso?: (info:object)=>void }} [opts]
 *   colecciones → por defecto marcas y páginas (que es donde viven los banners,
 *                 los slides del hero y los logos). Los productos quedan fuera:
 *                 son muchos más y conviene tratarlos aparte.
 *   onProgreso  → se llama con { hechas, total, actual } para poder mostrarlo.
 * @returns {Promise<{convertidas:number, documentos:number, saltadas:number, errores:string[]}>}
 */
export const reconvertirImagenesAWebp = async ({
  colecciones = ['tienda_brands', 'pages'],
  onProgreso,
} = {}) => {
  const errores = [];
  let convertidas = 0;
  let documentos = 0;
  let saltadas = 0;

  // Una misma imagen puede estar en varios documentos (el logo de una marca
  // aparece en su ficha y en el marquee de cada página). Se convierte UNA vez
  // y se reutiliza la URL nueva en todos.
  const yaConvertidas = new Map();

  const trabajos = [];
  for (const coleccion of colecciones) {
    const { data, error } = await getCollection(coleccion);
    if (error) { errores.push(`${coleccion}: ${error}`); continue; }
    for (const doc of (data || [])) {
      const { id, ...contenido } = doc;
      const urls = [...buscarUrls(contenido)];
      if (urls.length > 0) trabajos.push({ coleccion, id, contenido, urls });
    }
  }

  const total = trabajos.reduce((n, t) => n + t.urls.length, 0);
  let hechas = 0;

  for (const trabajo of trabajos) {
    const mapa = new Map();
    for (const url of trabajo.urls) {
      if (onProgreso) onProgreso({ hechas, total, actual: `${trabajo.coleccion}/${trabajo.id}` });
      if (yaConvertidas.has(url)) {
        mapa.set(url, yaConvertidas.get(url));
        hechas++;
        continue;
      }
      try {
        const nombre = (nombreDelObjeto(url).split('/').pop() || 'imagen').replace(/\.[^.]+$/, '');
        const { file, ancho, alto } = await descargarComoFile(url, `${nombre}.png`);

        // Una WebP que ya cabe en el techo no tiene nada que ganar: reescribirla
        // solo gastaría cuota y cambiaría la URL en el documento para nada.
        if (esWebp(url) && Math.max(ancho, alto) <= MAX_LADO) { saltadas++; hechas++; continue; }

        const ruta = `reconvertidas/${Date.now()}_${nombre}.png`;
        const { url: nueva, error } = await uploadFile(file, ruta);
        if (error || !nueva) throw new Error(error || 'No se pudo subir');
        // uploadFile descarta la conversión si el WebP no mejora. En ese caso
        // la URL nueva apunta a un PNG igual de pesado: no vale la pena
        // cambiar el documento por nada.
        if (!nombreDelObjeto(nueva).endsWith('.webp')) { saltadas++; hechas++; continue; }
        mapa.set(url, nueva);
        yaConvertidas.set(url, nueva);
        convertidas++;
      } catch (e) {
        errores.push(`${trabajo.coleccion}/${trabajo.id}: ${e?.message || e}`);
      }
      hechas++;
    }

    if (mapa.size === 0) continue;
    const actualizado = reemplazarUrls(trabajo.contenido, mapa);
    const { error } = await setDocument(trabajo.coleccion, trabajo.id, actualizado);
    if (error) errores.push(`${trabajo.coleccion}/${trabajo.id}: al guardar, ${error}`);
    else documentos++;
  }

  if (onProgreso) onProgreso({ hechas: total, total, actual: '' });
  return { convertidas, documentos, saltadas, errores };
};

/**
 * Cuenta, sin tocar nada, cuántas imágenes se van a REVISAR. Sirve para
 * decirle al admin qué va a pasar ANTES de que pulse el botón.
 *
 * Es un techo, no un exacto: en el recuento entran también las WebP, y de esas
 * solo se reescriben las que pasen de MAX_LADO. Saberlo requiere descargar cada
 * una para medirla, que es justo lo que hace el proceso de verdad — hacerlo dos
 * veces solo para dar una cifra más bonita no compensa. El resultado final
 * reporta cuántas se saltaron.
 */
export const contarImagenesPorConvertir = async ({
  colecciones = ['tienda_brands', 'pages'],
} = {}) => {
  const urls = new Set();
  let documentos = 0;
  for (const coleccion of colecciones) {
    const { data } = await getCollection(coleccion);
    for (const doc of (data || [])) {
      const { id, ...contenido } = doc;
      const encontradas = buscarUrls(contenido);
      if (encontradas.size > 0) {
        documentos++;
        encontradas.forEach((u) => urls.add(u));
      }
    }
  }
  return { imagenes: urls.size, documentos };
};
