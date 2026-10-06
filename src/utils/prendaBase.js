/**
 * Prendas base del apartado "Crear".
 *
 * Una prenda base es un documento normal de productos_wala con
 * `esPrendaBase: true` y su configuración en `prendaBase`. Vive en la misma
 * colección que el resto del catálogo a propósito: así el carrito, el
 * checkout, la validación de precios del servidor y el ERP la tratan como un
 * producto más, sin rutas paralelas. La tienda la excluye (ver
 * esProductoDeTienda en services/products.js): solo se ve en Crear.
 *
 *   prendaBase: {
 *     tallas:  ['S', 'M', 'L', 'XL'],
 *     colores: [{ id, nombre, hex, fotos: { [vistaId]: url } }],
 *     vistas:  [{ id, nombre, imagen, costo, zona: { x, y, w, anchoCm, altoCm } }],
 *   }
 *
 * La zona se guarda en fracciones de la imagen (x, y, w) más su medida real
 * en cm. El alto en la imagen NO se guarda: sale del ancho y de la proporción
 * en cm, así el rectángulo nunca se deforma respecto de lo que se imprime.
 *
 * Las fotos de cada vista son PNG/WebP con fondo transparente de la prenda en
 * blanco; los colores se tiñen en el navegador (tintarImagen). Un color puede
 * traer su propia foto por vista (fotos[vistaId]) cuando el teñido no basta.
 */

// Ancho de la zona en "unidades" de diseño. Las capas guardan posición y
// escala en estas unidades, así el mismo diseño se pinta igual en el editor,
// en la vista previa y en el archivo de impresión, sin importar el tamaño.
export const UNIDADES_ZONA = 1000;

// Resolución del archivo de impresión.
export const DPI_IMPRESION = 300;

// Por debajo de esto una imagen se ve pixelada al imprimirse.
export const DPI_MINIMO_OK = 150;
export const DPI_MINIMO_ACEPTABLE = 100;

export const TALLAS_SUGERIDAS = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];

const num = (v, def) => {
  const n = typeof v === 'number' ? v : parseFloat(v);
  return Number.isFinite(n) ? n : def;
};

const limitar = (v, min, max) => Math.min(max, Math.max(min, v));

export const slug = (texto) =>
  String(texto || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'item';

export const normalizarZona = (zona) => ({
  x: limitar(num(zona?.x, 0.3), 0, 1),
  y: limitar(num(zona?.y, 0.3), 0, 1),
  w: limitar(num(zona?.w, 0.4), 0.02, 1),
  anchoCm: limitar(num(zona?.anchoCm, 30), 1, 200),
  altoCm: limitar(num(zona?.altoCm, 30), 1, 200),
});

export const normalizarVista = (vista, i = 0) => ({
  id: String(vista?.id || `vista-${i + 1}`),
  nombre: String(vista?.nombre || `Vista ${i + 1}`),
  imagen: String(vista?.imagen || ''),
  costo: Math.max(0, num(vista?.costo, 0)),
  zona: normalizarZona(vista?.zona),
});

export const normalizarColor = (color, i = 0) => {
  const fotos = {};
  Object.entries(color?.fotos || {}).forEach(([vistaId, url]) => {
    if (typeof url === 'string' && url.trim()) fotos[vistaId] = url.trim();
  });
  const hex = /^#[0-9a-f]{6}$/i.test(color?.hex || '') ? color.hex.toUpperCase() : '#FFFFFF';
  return {
    id: String(color?.id || slug(color?.nombre) || `color-${i + 1}`),
    nombre: String(color?.nombre || `Color ${i + 1}`),
    hex,
    fotos,
  };
};

/** Configuración segura de una prenda base, con valores por defecto. */
export const leerPrendaBase = (producto) => {
  const cfg = producto?.prendaBase || {};
  const vistas = (Array.isArray(cfg.vistas) ? cfg.vistas : []).map(normalizarVista);
  const colores = (Array.isArray(cfg.colores) ? cfg.colores : []).map(normalizarColor);
  const tallas = (Array.isArray(cfg.tallas) ? cfg.tallas : [])
    .map((t) => String(t || '').trim())
    .filter(Boolean);
  return {
    vistas,
    colores: colores.length ? colores : [normalizarColor({ id: 'blanco', nombre: 'Blanco', hex: '#FFFFFF' })],
    tallas,
  };
};

export const esPrendaBase = (producto) => producto?.esPrendaBase === true;

/** Alto de la zona como fracción del alto de la imagen. */
export const altoZonaFraccion = (zona, anchoImg, altoImg) => {
  if (!anchoImg || !altoImg) return zona.w;
  return (zona.w * anchoImg * (zona.altoCm / zona.anchoCm)) / altoImg;
};

/** Mismo criterio que el servidor (functions/catalogPricing.js). */
export const precioBase = (producto) => {
  const price = Number(producto?.price);
  const sale = Number(producto?.salePrice);
  if (Number.isFinite(sale) && sale > 0 && sale < price) return sale;
  return Number.isFinite(price) ? price : 0;
};

/** Vistas que tienen al menos una capa. */
export const vistasConDiseno = (capasPorVista) =>
  Object.entries(capasPorVista || {})
    .filter(([, capas]) => Array.isArray(capas) && capas.length > 0)
    .map(([vistaId]) => vistaId);

/**
 * Precio final de una prenda personalizada: base + el costo de cada vista que
 * lleva diseño. El servidor repite este cálculo al cobrar.
 */
export const precioPersonalizado = (producto, vistasUsadas = []) => {
  const { vistas } = leerPrendaBase(producto);
  const extra = vistas
    .filter((v) => vistasUsadas.includes(v.id))
    .reduce((acc, v) => acc + v.costo, 0);
  return Math.round((precioBase(producto) + extra) * 100) / 100;
};

/**
 * Resolución real con la que se imprimiría una imagen, en puntos por pulgada.
 * La capa ocupa (anchoNatural * escala) unidades de las UNIDADES_ZONA que mide
 * la zona entera, o sea esa fracción de anchoCm.
 */
export const dpiDeCapa = (capa, zona) => {
  if (capa?.type !== 'image' || !capa.anchoNatural || !capa.escalaX) return null;
  const anchoCm = ((capa.anchoNatural * Math.abs(capa.escalaX)) / UNIDADES_ZONA) * zona.anchoCm;
  if (!(anchoCm > 0)) return null;
  return Math.round(capa.anchoNatural / (anchoCm / 2.54));
};

export const calidadDeDpi = (dpi) => {
  if (dpi == null) return null;
  if (dpi >= DPI_MINIMO_OK) return 'buena';
  if (dpi >= DPI_MINIMO_ACEPTABLE) return 'regular';
  return 'baja';
};

/** Tamaño en píxeles del archivo de impresión de una zona. */
export const pixelesDeImpresion = (zona) => ({
  ancho: Math.round((zona.anchoCm / 2.54) * DPI_IMPRESION),
  alto: Math.round((zona.altoCm / 2.54) * DPI_IMPRESION),
});

// ── Teñido de la prenda ────────────────────────────────────────────────────

const hexARgb = (hex) => {
  const h = String(hex || '#FFFFFF').replace('#', '');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) || 0);
};

/** ¿El color es tan claro que conviene mostrar la foto tal cual? */
export const esColorBlanco = (hex) => {
  const [r, g, b] = hexARgb(hex);
  return (r + g + b) / 3 / 255 > 0.96;
};

/** Color de texto legible sobre un fondo del color dado. */
export const textoSobre = (hex) => {
  const [r, g, b] = hexARgb(hex);
  return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? '#1F1B2E' : '#FFFFFF';
};

const cacheImagenes = new Map();

/** Carga una imagen con CORS (para poder leer sus píxeles). Cacheada. */
export const cargarImagen = (src) => {
  if (!src) return Promise.reject(new Error('Sin imagen'));
  if (cacheImagenes.has(src)) return cacheImagenes.get(src);
  const promesa = new Promise((resolve, reject) => {
    const img = new Image();
    if (!/^(blob:|data:)/.test(src)) img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => {
      cacheImagenes.delete(src);
      reject(new Error('No se pudo cargar la imagen'));
    };
    img.src = src;
  });
  cacheImagenes.set(src, promesa);
  return promesa;
};

const cacheTenidos = new Map();
const cacheLuminancia = new WeakMap();

/**
 * Pinta la foto blanca de la prenda del color pedido, conservando sus sombras.
 *
 * Multiplicar la foto por el color (lo obvio) deja los colores oscuros planos:
 * el negro sale negro parejo y se pierden pliegues, bolsillo y costuras. Aquí
 * el color se escala por la luz de cada píxel relativa a la luz media de la
 * prenda (así el promedio queda exactamente en el color elegido) y, cuanto
 * más oscuro es el color, más se suma de la variación de luz original para
 * que los relieves sigan visibles. Solo se tocan los píxeles de la prenda: el
 * fondo transparente sigue transparente.
 *
 * Devuelve un canvas listo para dibujar. Cacheado por imagen + color.
 */
export const tintarImagen = (img, hex) => {
  const clave = `${img.src}|${hex}`;
  if (cacheTenidos.has(clave)) return cacheTenidos.get(clave);

  const ancho = img.naturalWidth || img.width;
  const alto = img.naturalHeight || img.height;
  const canvas = document.createElement('canvas');
  canvas.width = ancho;
  canvas.height = alto;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, ancho, alto);

  if (!esColorBlanco(hex)) {
    try {
      const datos = ctx.getImageData(0, 0, ancho, alto);
      const d = datos.data;

      let media = cacheLuminancia.get(img);
      if (media == null) {
        let suma = 0;
        let cuenta = 0;
        for (let i = 0; i < d.length; i += 4) {
          if (d[i + 3] > 128) {
            suma += (d[i] + d[i + 1] + d[i + 2]) / 3;
            cuenta += 1;
          }
        }
        media = cuenta ? suma / cuenta : 230;
        cacheLuminancia.set(img, media);
      }

      const [r, g, b] = hexARgb(hex);
      const oscuridad = 1 - (r + g + b) / 3 / 255;
      const realce = oscuridad * 1.4;
      const base = oscuridad * 8;
      for (let i = 0; i < d.length; i += 4) {
        if (d[i + 3] === 0) continue;
        const luz = (d[i] + d[i + 1] + d[i + 2]) / 3;
        const factor = luz / media;
        const extra = realce * (luz - media) + base;
        d[i] = limitar(r * factor + extra, 0, 255);
        d[i + 1] = limitar(g * factor + extra, 0, 255);
        d[i + 2] = limitar(b * factor + extra, 0, 255);
      }
      ctx.putImageData(datos, 0, 0);
    } catch (error) {
      // Imagen sin CORS: no se pueden leer sus píxeles. Se muestra sin teñir
      // antes que no mostrar nada.
      console.warn('[prendaBase] no se pudo teñir la prenda:', error?.message || error);
    }
  }

  cacheTenidos.set(clave, canvas);
  return canvas;
};

/** Foto a mostrar para una vista y un color: la propia del color, o la base. */
export const fotoDeVista = (vista, color) => color?.fotos?.[vista.id] || vista.imagen;

/** ¿Hay que teñir? No, si el color trae foto propia para esta vista. */
export const requiereTenido = (vista, color) => !color?.fotos?.[vista.id];

// ── Ejemplo listo para cargar desde el admin ───────────────────────────────

/**
 * Hoodie de ejemplo con las fotos que viven en /public/prendas. Las URLs se
 * arman absolutas con el dominio actual porque viajan al pedido (WhatsApp y
 * ERP necesitan links completos). El precio y los costos quedan en 0 para que
 * el admin los defina antes de publicar.
 */
export const hoodieDeEjemplo = (origen) => ({
  name: 'Hoodie clásico',
  description: 'Hoodie de algodón perchado con capucha y bolsillo canguro. Personalízalo con tu diseño en el frente, la espalda o ambos.',
  price: 0,
  visible: false,
  prendaBase: {
    tallas: ['S', 'M', 'L', 'XL'],
    colores: [
      { id: 'blanco', nombre: 'Blanco', hex: '#FFFFFF', fotos: {} },
      { id: 'negro', nombre: 'Negro', hex: '#1A1A1A', fotos: {} },
      { id: 'gris-jaspeado', nombre: 'Gris', hex: '#B4B2A9', fotos: {} },
      { id: 'azul-marino', nombre: 'Azul marino', hex: '#1F2F55', fotos: {} },
      { id: 'rojo', nombre: 'Rojo', hex: '#C0392B', fotos: {} },
      { id: 'lila', nombre: 'Lila', hex: '#B9A6E0', fotos: {} },
    ],
    vistas: [
      {
        id: 'frente',
        nombre: 'Frente',
        imagen: `${origen}/prendas/hoodie-frente.webp`,
        costo: 0,
        zona: { x: 0.357, y: 0.27, w: 0.284, anchoCm: 30, altoCm: 30 },
      },
      {
        id: 'espalda',
        nombre: 'Espalda',
        imagen: `${origen}/prendas/hoodie-espalda.webp`,
        costo: 0,
        zona: { x: 0.3255, y: 0.32, w: 0.349, anchoCm: 35, altoCm: 40 },
      },
    ],
  },
});
