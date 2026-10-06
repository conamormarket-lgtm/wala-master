/**
 * Prendas personalizables del apartado "Crear".
 *
 * Son productos normales de productos_wala: se crean y editan en Admin ->
 * Productos, y en su apartado "Producto personalizable" se activa
 * `esPrendaBase` y se configura `prendaBase`. Al vivir en el catálogo, el
 * carrito, el checkout, la validación de precios del servidor y el ERP los
 * tratan como un producto más. La tienda los excluye (ver esProductoDeTienda
 * en services/products.js): solo se compran diseñándolos en Crear.
 *
 * Los COLORES y las TALLAS son las variantes del producto (nombre, colorHex y
 * tallas de cada una), las mismas que usa el resto del catálogo. `prendaBase`
 * solo guarda lo propio de la personalización:
 *
 *   prendaBase: {
 *     vistas:  [{ id, nombre, imagen,
 *                 zonas: [{ id, nombre, x, y, w, anchoCm, altoCm, angulo, costo }] }],
 *     colores: { [variantId]: { hex2, fotos: { [vistaId]: url } } },
 *   }
 *
 * Cada vista (frente, espalda) tiene sus zonas de impresión (pecho, mangas,
 * bolsillo...). El cliente elige en cuál va cada imagen o texto, y cada zona
 * usada suma su costo. Las capas del diseño se agrupan por id de zona.
 *
 * La zona se guarda en fracciones de la imagen (x, y, w) más su medida real
 * en cm y su giro. El alto en la imagen NO se guarda: sale del ancho y de la
 * proporción en cm, así el rectángulo nunca se deforma respecto de lo que se
 * imprime.
 *
 * Las fotos de cada vista son PNG/WebP con fondo transparente de la prenda en
 * blanco; los colores se tiñen en el navegador (tintarImagen). Un color puede
 * traer su propia foto por vista (fotos[vistaId]) cuando el teñido no basta.
 * Los bicolores (hex2) no se pueden teñir de un solo tono: solo se ofrecen
 * cuando tienen su foto en todas las vistas (colorDisponible).
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

/**
 * Tonos con los que el catálogo ya nombra sus prendas (los usan ~120
 * productos). Sirven de respaldo cuando una variante no trae colorHex y para
 * crear de un clic los colores de las poleras.
 */
export const PALETA_PRENDAS = {
  blanco: '#F3F3F3',
  negro: '#101010',
  melange: '#C8CACB',
  'azul acero': '#0F1E37',
  acero: '#0F1E37',
  guinda: '#651322',
  rosado: '#FDA9C9',
  celeste: '#A9D5F6',
};

/** Colores de la polera del proveedor (S a XL), incluidos los bicolores. */
export const COLORES_POLERA = [
  { nombre: 'Negro', hex: '#101010' },
  { nombre: 'Blanco', hex: '#F3F3F3' },
  { nombre: 'Melange', hex: '#C8CACB' },
  { nombre: 'Azul Acero', hex: '#0F1E37' },
  { nombre: 'Guinda', hex: '#651322' },
  { nombre: 'Rosado', hex: '#FDA9C9' },
  { nombre: 'Celeste', hex: '#A9D5F6' },
  { nombre: 'Celeste / Rosado', hex: '#A9D5F6', hex2: '#FDA9C9' },
  { nombre: 'Negro / Rosado', hex: '#101010', hex2: '#FDA9C9' },
  { nombre: 'Blanco / Negro', hex: '#F3F3F3', hex2: '#101010' },
  { nombre: 'Panda', hex: '#F3F3F3', hex2: '#101010' },
];

export const TALLAS_POLERA = ['S', 'M', 'L', 'XL'];

const num = (v, def) => {
  const n = typeof v === 'number' ? v : parseFloat(v);
  return Number.isFinite(n) ? n : def;
};

const limitar = (v, min, max) => Math.min(max, Math.max(min, v));

const esHex = (v) => /^#[0-9a-f]{6}$/i.test(v || '');

export const slug = (texto) =>
  String(texto || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'item';

/** Id nuevo para una zona: único en toda la prenda (las capas se agrupan por él). */
export const nuevoIdZona = () => `z${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/**
 * Zona de impresión. (x, y, w) en fracciones de la foto: esquina superior
 * izquierda y ancho del rectángulo SIN girar; el giro (angulo, en grados) es
 * alrededor de su centro, para las mangas u otras zonas inclinadas.
 */
export const normalizarZona = (zona, i = 0) => ({
  id: String(zona?.id || `zona-${i + 1}`),
  nombre: String(zona?.nombre || `Zona ${i + 1}`),
  x: limitar(num(zona?.x, 0.3), -0.5, 1),
  y: limitar(num(zona?.y, 0.3), -0.5, 1),
  w: limitar(num(zona?.w, 0.4), 0.02, 1),
  anchoCm: limitar(num(zona?.anchoCm, 30), 1, 200),
  altoCm: limitar(num(zona?.altoCm, 30), 1, 200),
  angulo: limitar(num(zona?.angulo, 0), -180, 180),
  costo: Math.max(0, num(zona?.costo, 0)),
});

/**
 * Vista (frente, espalda...) con sus zonas. El formato anterior tenía una
 * sola `zona` y el costo en la vista: se convierte a una zona con el id de la
 * vista, así los diseños guardados con ese formato siguen encajando.
 */
export const normalizarVista = (vista, i = 0) => {
  const id = String(vista?.id || `vista-${i + 1}`);
  const nombre = String(vista?.nombre || `Vista ${i + 1}`);
  const zonas = Array.isArray(vista?.zonas) && vista.zonas.length
    ? vista.zonas.map(normalizarZona)
    : vista?.zona
      ? [normalizarZona({ ...vista.zona, id, nombre, costo: vista.costo })]
      : [];
  return { id, nombre, imagen: String(vista?.imagen || ''), zonas };
};

/** Todas las zonas de la prenda, cada una con su vista. */
export const listarZonas = (vistas) =>
  (vistas || []).flatMap((v) => v.zonas.map((z) => ({ ...z, vistaId: v.id, vistaNombre: v.nombre })));

/** Tono de respaldo por nombre ("Azul Acero" -> paleta), o blanco. */
const hexPorNombre = (nombre) => {
  const n = String(nombre || '').trim().toLowerCase();
  if (PALETA_PRENDAS[n]) return PALETA_PRENDAS[n];
  const clave = Object.keys(PALETA_PRENDAS).find((k) => n.startsWith(k));
  return clave ? PALETA_PRENDAS[clave] : '#FFFFFF';
};

const limpiarFotos = (fotos) => {
  const out = {};
  Object.entries(fotos || {}).forEach(([vistaId, url]) => {
    if (typeof url === 'string' && url.trim()) out[vistaId] = url.trim();
  });
  return out;
};

export const normalizarColor = (color, i = 0) => ({
  id: String(color?.id || slug(color?.nombre) || `color-${i + 1}`),
  nombre: String(color?.nombre || `Color ${i + 1}`),
  hex: esHex(color?.hex) ? color.hex.toUpperCase() : hexPorNombre(color?.nombre),
  hex2: esHex(color?.hex2) ? color.hex2.toUpperCase() : '',
  fotos: limpiarFotos(color?.fotos),
  tallas: (Array.isArray(color?.tallas) ? color.tallas : []).map((t) => String(t || '').trim()).filter(Boolean),
});

const ordenTallas = (tallas) => {
  const pos = (t) => {
    const i = TALLAS_SUGERIDAS.indexOf(String(t).toUpperCase());
    return i === -1 ? 100 : i;
  };
  return [...new Set(tallas)].sort((a, b) => pos(a) - pos(b));
};

/**
 * Configuración segura de una prenda: vistas de `prendaBase` y colores/tallas
 * de las variantes del producto. Si el producto no tiene variantes se acepta
 * el formato anterior (colores y tallas dentro de prendaBase).
 */
export const leerPrendaBase = (producto) => {
  const cfg = producto?.prendaBase || {};
  const vistas = (Array.isArray(cfg.vistas) ? cfg.vistas : []).map(normalizarVista);
  const variantes = (Array.isArray(producto?.variants) ? producto.variants : [])
    .filter((v) => v && String(v.name || '').trim());

  let colores;
  if (variantes.length) {
    const extra = cfg.colores && !Array.isArray(cfg.colores) ? cfg.colores : {};
    colores = variantes.map((v, i) => normalizarColor({
      id: v.id,
      nombre: String(v.name).trim(),
      hex: v.colorHex,
      hex2: extra[v.id]?.hex2,
      fotos: extra[v.id]?.fotos,
      tallas: v.sizes,
    }, i));
  } else {
    colores = (Array.isArray(cfg.colores) ? cfg.colores : []).map(normalizarColor);
  }

  const tallasSueltas = [
    ...(Array.isArray(cfg.tallas) ? cfg.tallas : []),
    ...(Array.isArray(producto?.mainSizes) ? producto.mainSizes : []),
  ].map((t) => String(t || '').trim()).filter(Boolean);
  const tallas = ordenTallas([...colores.flatMap((c) => c.tallas), ...tallasSueltas]);

  return {
    vistas,
    colores: colores.length ? colores : [normalizarColor({ id: 'blanco', nombre: 'Blanco', hex: '#FFFFFF' })],
    tallas,
  };
};

/** Tallas que se pueden pedir en un color (las suyas, o las de la prenda). */
export const tallasDeColor = (color, cfg) => (color?.tallas?.length ? ordenTallas(color.tallas) : cfg.tallas);

/**
 * ¿Se puede ofrecer este color? Un bicolor necesita su foto en cada vista:
 * teñir de un solo tono lo mostraría mal.
 */
export const colorDisponible = (color, vistas) =>
  !color.hex2 || vistas.every((v) => Boolean(color.fotos[v.id]));

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

/** Zonas (ids) que tienen al menos una capa. Las capas se guardan por zona. */
export const zonasConDiseno = (capasPorZona) =>
  Object.entries(capasPorZona || {})
    .filter(([, capas]) => Array.isArray(capas) && capas.length > 0)
    .map(([zonaId]) => zonaId);

/**
 * Precio final de una prenda personalizada: base + el costo de cada zona que
 * lleva diseño. El servidor repite este cálculo al cobrar
 * (functions/cartValidation.js).
 */
export const precioPersonalizado = (producto, zonasUsadas = []) => {
  const { vistas } = leerPrendaBase(producto);
  const extra = listarZonas(vistas)
    .filter((z) => zonasUsadas.includes(z.id))
    .reduce((acc, z) => acc + z.costo, 0);
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
  // 0.94 deja entrar el blanco del catálogo (#F3F3F3): la foto ya es blanca.
  return (r + g + b) / 3 / 255 > 0.94;
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

// ── Fotos de ejemplo listas para cargar desde el admin ─────────────────────

/**
 * Vistas del hoodie con las fotos que viven en /public/prendas, con sus zonas
 * ya ubicadas. Las URLs se arman absolutas con el dominio actual porque viajan
 * al pedido (WhatsApp y ERP necesitan links completos). Los costos quedan en 0
 * para que el admin los defina.
 */
export const vistasDeEjemplo = (origen) => [
  {
    id: 'frente',
    nombre: 'Frente',
    imagen: `${origen}/prendas/hoodie-frente.webp`,
    zonas: [
      { id: 'frente-pecho', nombre: 'Pecho', x: 0.357, y: 0.27, w: 0.284, anchoCm: 30, altoCm: 30, angulo: 0, costo: 0 },
      // Las mangas caen inclinadas: la zona gira con ellas.
      { id: 'frente-manga-derecha', nombre: 'Manga derecha', x: 0.067, y: 0.399, w: 0.0755, anchoCm: 8, altoCm: 30, angulo: 5, costo: 0 },
      { id: 'frente-manga-izquierda', nombre: 'Manga izquierda', x: 0.8575, y: 0.399, w: 0.0755, anchoCm: 8, altoCm: 30, angulo: -5, costo: 0 },
    ],
  },
  {
    id: 'espalda',
    nombre: 'Espalda',
    imagen: `${origen}/prendas/hoodie-espalda.webp`,
    zonas: [
      { id: 'espalda-centro', nombre: 'Espalda', x: 0.3255, y: 0.32, w: 0.349, anchoCm: 35, altoCm: 40, angulo: 0, costo: 0 },
    ],
  },
];
