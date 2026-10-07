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
 *                 zonas: [{ id, nombre, x, y, w, proporcion, angulo }] }],
 *     colores: { [variantId]: { hex2, patron, fotos: { [vistaId]: url } } },
 *   }
 *
 * Cada vista (frente, espalda) tiene sus zonas de impresión (pecho, mangas,
 * bolsillo...). El cliente elige en cuál va cada imagen o texto; el precio
 * del producto ya incluye todos los diseños. Las capas se agrupan por zona.
 *
 * La zona se guarda en fracciones de la imagen (x, y, w), su proporción
 * (alto / ancho) y su giro.
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
  { nombre: 'Panda', hex: '#F3F3F3', hex2: '#101010', patron: 'mangas' },
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
 * Zona de impresión: un área de referencia sobre la foto. (x, y, w) en
 * fracciones de la foto: esquina superior izquierda y ancho del rectángulo
 * SIN girar; `proporcion` es su alto dividido entre su ancho (en la foto); el
 * giro (angulo, en grados) es alrededor de su centro, para las mangas u otras
 * zonas inclinadas. Las zonas guardadas con medidas en cm toman su proporción
 * de ellas.
 */
export const normalizarZona = (zona, i = 0) => {
  const deCm = num(zona?.anchoCm, 0) > 0 && num(zona?.altoCm, 0) > 0 ? num(zona.altoCm, 1) / num(zona.anchoCm, 1) : 1;
  return {
    id: String(zona?.id || `zona-${i + 1}`),
    nombre: String(zona?.nombre || `Zona ${i + 1}`),
    x: limitar(num(zona?.x, 0.3), -0.5, 1),
    y: limitar(num(zona?.y, 0.3), -0.5, 1),
    w: limitar(num(zona?.w, 0.4), 0.02, 1),
    proporcion: limitar(num(zona?.proporcion, deCm), 0.05, 20),
    angulo: limitar(num(zona?.angulo, 0), -180, 180),
  };
};

/**
 * Vista (frente, espalda...) con sus zonas. El formato anterior tenía una
 * sola `zona` por vista: se convierte a una zona con el id de la
 * vista, así los diseños guardados con ese formato siguen encajando.
 */
export const normalizarVista = (vista, i = 0) => {
  const id = String(vista?.id || `vista-${i + 1}`);
  const nombre = String(vista?.nombre || `Vista ${i + 1}`);
  const zonas = Array.isArray(vista?.zonas) && vista.zonas.length
    ? vista.zonas.map(normalizarZona)
    : vista?.zona
      ? [normalizarZona({ ...vista.zona, id, nombre })]
      : [];
  const referencia = normalizarReferencia(vista?.referencia);
  const anchoImg = num(vista?.anchoImg, 0);
  const altoImg = num(vista?.altoImg, 0);
  return {
    id,
    nombre,
    imagen: String(vista?.imagen || ''),
    zonas,
    ...(referencia && { referencia }),
    ...(anchoImg > 0 && altoImg > 0 && { anchoImg, altoImg }),
  };
};

/**
 * Medida de referencia de una vista (solo la ve el admin): una línea sobre la
 * foto (extremos en fracciones de la foto) y lo que mide en la prenda real.
 * Con ella se conoce la escala de la foto, las zonas se pueden ajustar en cm
 * exactos y el archivo de impresión sale a tamaño real.
 */
export const normalizarReferencia = (ref) => {
  if (!ref || typeof ref !== 'object') return null;
  return {
    x1: limitar(num(ref.x1, 0.25), 0, 1),
    y1: limitar(num(ref.y1, 0.4), 0, 1),
    x2: limitar(num(ref.x2, 0.75), 0, 1),
    y2: limitar(num(ref.y2, 0.4), 0, 1),
    cm: Math.max(0, num(ref.cm, 0)),
  };
};

/** Píxeles de la foto (tamaño natural) que hay en un cm de la prenda real. */
export const pxPorCm = (vista) => {
  const ref = vista?.referencia;
  if (!ref || !(ref.cm > 0) || !vista.anchoImg || !vista.altoImg) return 0;
  const largo = Math.hypot((ref.x2 - ref.x1) * vista.anchoImg, (ref.y2 - ref.y1) * vista.altoImg);
  return largo > 0 ? largo / ref.cm : 0;
};

const redondear = (n) => Math.round(n * 10) / 10;

/** Medida real de una zona en cm, o null si su vista no tiene escala. */
export const medidaZona = (zona, vista) => {
  const p = pxPorCm(vista);
  if (!p) return null;
  const anchoCm = (zona.w * vista.anchoImg) / p;
  return { anchoCm: redondear(anchoCm), altoCm: redondear(anchoCm * zona.proporcion) };
};

/** La zona con el ancho y alto en cm pedidos (en la escala de su vista). */
export const zonaConMedida = (zona, vista, anchoCm, altoCm) => {
  const p = pxPorCm(vista);
  if (!p || !(anchoCm > 0) || !(altoCm > 0)) return zona;
  return { ...zona, w: limitar((anchoCm * p) / vista.anchoImg, 0.01, 1), proporcion: limitar(altoCm / anchoCm, 0.05, 20) };
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

/**
 * Cómo se reparte un bicolor en la prenda, para pintar su muestra igual:
 * mitad y mitad (el segundo tono a la izquierda, como en las fotos) o el
 * cuerpo de un tono y las mangas del otro (Panda).
 */
export const PATRONES_BICOLOR = [
  { id: 'mitades', nombre: 'Mitad y mitad' },
  { id: 'mangas', nombre: 'Cuerpo y mangas' },
];

const esPatron = (id) => PATRONES_BICOLOR.some((p) => p.id === id);

/**
 * El patrón guardado; si no hay, el del color de la polera con el mismo
 * nombre (Panda: cuerpo y mangas), y si no, mitad y mitad.
 */
const patronDe = (color) => {
  if (esPatron(color?.patron)) return color.patron;
  const nombre = String(color?.nombre || '').trim().toLowerCase();
  const dePolera = COLORES_POLERA.find((c) => c.nombre.toLowerCase() === nombre)?.patron;
  return esPatron(dePolera) ? dePolera : PATRONES_BICOLOR[0].id;
};

export const normalizarColor = (color, i = 0) => ({
  id: String(color?.id || slug(color?.nombre) || `color-${i + 1}`),
  nombre: String(color?.nombre || `Color ${i + 1}`),
  hex: esHex(color?.hex) ? color.hex.toUpperCase() : hexPorNombre(color?.nombre),
  hex2: esHex(color?.hex2) ? color.hex2.toUpperCase() : '',
  patron: patronDe(color),
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
      patron: extra[v.id]?.patron,
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

/**
 * Fondo de la muestra redonda de un color. Un bicolor se pinta con su patrón
 * (PATRONES_BICOLOR): franjas verticales con el corte suavizado 1px y
 * pintadas también bajo el borde, sin repetirse (si no, en el borde asoma el
 * otro color y el círculo se ve mordido).
 */
export const fondoMuestra = (c) => {
  if (!c.hex2) return c.hex;
  const { hex: a, hex2: b } = c;
  const franjas = c.patron === 'mangas'
    // Mangas a los lados, cuerpo al centro.
    ? `${b} calc(30% - 0.5px), ${a} calc(30% + 0.5px), ${a} calc(70% - 0.5px), ${b} calc(70% + 0.5px)`
    : `${b} calc(50% - 0.5px), ${a} calc(50% + 0.5px)`;
  return `linear-gradient(90deg, ${franjas}) border-box no-repeat`;
};

export const esPrendaBase = (producto) => producto?.esPrendaBase === true;

/** Alto de la zona como fracción del alto de la imagen. */
export const altoZonaFraccion = (zona, anchoImg, altoImg) => {
  if (!anchoImg || !altoImg) return zona.w;
  return (zona.w * anchoImg * zona.proporcion) / altoImg;
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
 * Precio de una prenda personalizada: el del producto, que ya incluye todos
 * los diseños que el cliente quiera poner, en las zonas que quiera. El
 * servidor lo vuelve a validar al cobrar (functions/cartValidation.js).
 */
export const precioPersonalizado = (producto) => precioBase(producto);

// Lado mayor del archivo de impresión de una zona, en píxeles (unos 30 cm a
// 300 dpi). Las zonas son de referencia, así que todas salen a esta escala.
export const LADO_IMPRESION = 3600;

export const DPI_IMPRESION = 300;

// Safari de iPhone no dibuja canvas de más de ~16,7 millones de píxeles (un
// 35 x 40 cm a 300 dpi son 19,5). Por encima se baja la resolución lo justo.
const AREA_MAXIMA = 16000000;

/**
 * Tamaño en píxeles del archivo de impresión de una zona. Con su medida real
 * (la vista tiene escala) sale a tamaño real a DPI_IMPRESION; sin ella, a
 * LADO_IMPRESION por el lado mayor.
 */
export const pixelesDeImpresion = (zona, medida = null) => {
  let ancho;
  let alto;
  if (medida?.anchoCm > 0 && medida?.altoCm > 0) {
    ancho = (medida.anchoCm / 2.54) * DPI_IMPRESION;
    alto = (medida.altoCm / 2.54) * DPI_IMPRESION;
  } else if (zona.proporcion >= 1) {
    ancho = LADO_IMPRESION / zona.proporcion;
    alto = LADO_IMPRESION;
  } else {
    ancho = LADO_IMPRESION;
    alto = LADO_IMPRESION * zona.proporcion;
  }
  const reduccion = Math.min(1, Math.sqrt(AREA_MAXIMA / (ancho * alto)));
  return { ancho: Math.round(ancho * reduccion), alto: Math.round(alto * reduccion) };
};

/**
 * ¿Se verá nítida una imagen al imprimirse? Compara cuántos píxeles ocupará
 * en el archivo de impresión con los que trae: si hay que estirarla mucho, se
 * pixela.
 */
export const calidadDeCapa = (capa, zona, medida = null) => {
  if (capa?.type !== 'image' || !capa.anchoNatural || !capa.escalaX || !zona) return null;
  const { ancho } = pixelesDeImpresion(zona, medida);
  const estiramiento = (Math.abs(capa.escalaX) * ancho) / UNIDADES_ZONA;
  if (estiramiento <= 1.5) return 'buena';
  if (estiramiento <= 2.5) return 'regular';
  return 'baja';
};

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
 * al pedido (WhatsApp y ERP necesitan links completos).
 */
export const vistasDeEjemplo = (origen) => [
  {
    id: 'frente',
    nombre: 'Frente',
    imagen: `${origen}/prendas/hoodie-frente.webp`,
    anchoImg: 1100,
    altoImg: 1289,
    // De axila a axila. Es una estimación: mídela en la prenda real.
    referencia: { x1: 0.224, y1: 0.36, x2: 0.773, y2: 0.36, cm: 58 },
    zonas: [
      { id: 'frente-pecho', nombre: 'Pecho', x: 0.357, y: 0.27, w: 0.284, proporcion: 1, angulo: 0 },
      // Las mangas caen inclinadas: la zona gira con ellas.
      { id: 'frente-manga-derecha', nombre: 'Manga derecha', x: 0.067, y: 0.399, w: 0.0755, proporcion: 3.75, angulo: 5 },
      { id: 'frente-manga-izquierda', nombre: 'Manga izquierda', x: 0.8575, y: 0.399, w: 0.0755, proporcion: 3.75, angulo: -5 },
    ],
  },
  {
    id: 'espalda',
    nombre: 'Espalda',
    imagen: `${origen}/prendas/hoodie-espalda.webp`,
    anchoImg: 1073,
    altoImg: 1235,
    referencia: { x1: 0.21, y1: 0.38, x2: 0.79, y2: 0.38, cm: 58 },
    zonas: [
      { id: 'espalda-centro', nombre: 'Espalda', x: 0.3255, y: 0.32, w: 0.349, proporcion: 1.1429, angulo: 0 },
    ],
  },
];
