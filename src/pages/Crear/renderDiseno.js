import { fabric } from 'fabric';
import {
  UNIDADES_ZONA,
  DPI_IMPRESION,
  altoZonaFraccion,
  cargarImagen,
  pixelesDeImpresion,
} from '../../utils/prendaBase';
import { loadFontResources } from '../../services/shared/fontResources';

/**
 * Dibujo de un diseño del apartado Crear. Lo usan el lienzo del estudio, la
 * vista previa que va al carrito y el archivo de impresión: los tres parten
 * de las mismas capas y de esta misma función, así lo que el cliente ve es
 * exactamente lo que se imprime.
 *
 * Una capa guarda su centro (left, top) y su escala en UNIDADES de la zona
 * (la zona mide UNIDADES_ZONA de ancho). Para pintarla se le da una
 * transformación { k, ox, oy }: k = píxeles por unidad, (ox, oy) = esquina de
 * la zona en el lienzo de destino.
 *
 *   imagen: { id, type: 'image', src, anchoNatural, altoNatural, left, top, escalaX, escalaY, angulo, flipX }
 *   texto:  { id, type: 'text', text, fuente, color, tamano, negrita, cursiva, left, top, escalaX, escalaY, angulo }
 */

export const FUENTES = [
  'Montserrat', 'Bebas Neue', 'Anton', 'Oswald', 'Playfair Display', 'Righteous',
  'Pacifico', 'Lobster', 'Dancing Script', 'Great Vibes', 'Permanent Marker', 'Caveat',
  'Kanit', 'Rubik', 'Libre Baskerville',
];

const fuentesListas = new Map();

/** Carga una fuente (normal y negrita) antes de pintarla en canvas. */
export const asegurarFuente = (familia) => {
  if (!familia) return Promise.resolve();
  if (fuentesListas.has(familia)) return fuentesListas.get(familia);
  const promesa = (async () => {
    try {
      await loadFontResources([familia]);
      if (document.fonts?.load) {
        await Promise.all([
          document.fonts.load(`400 48px "${familia}"`),
          document.fonts.load(`700 48px "${familia}"`),
        ]);
      }
      fabric.util.clearFabricFontCache(familia);
    } catch {
      // Sin la fuente se pinta con la de reserva; no se bloquea el diseño.
    }
  })();
  fuentesListas.set(familia, promesa);
  return promesa;
};

export const asegurarFuentesDe = (capasPorVista) => {
  const familias = new Set();
  Object.values(capasPorVista || {}).forEach((capas) => {
    (capas || []).forEach((c) => { if (c.type === 'text' && c.fuente) familias.add(c.fuente); });
  });
  return Promise.all([...familias].map(asegurarFuente));
};

/** Alto de la zona en unidades. */
export const altoEnUnidades = (zona) => UNIDADES_ZONA * (zona.altoCm / zona.anchoCm);

export const propiedadesTexto = (capa) => ({
  text: capa.text?.length ? capa.text : ' ',
  fontFamily: capa.fuente || 'Montserrat',
  fill: capa.color || '#111111',
  fontSize: capa.tamano || 90,
  fontWeight: capa.negrita ? 'bold' : 'normal',
  fontStyle: capa.cursiva ? 'italic' : 'normal',
  textAlign: 'center',
  lineHeight: 1.05,
});

/**
 * Crea el objeto de fabric de una capa. `srcDe(capa)` decide de dónde se lee
 * la imagen (la URL local mientras se sube, o la de Storage).
 */
export const crearObjeto = async (capa, { k, ox, oy }, srcDe = (c) => c.src) => {
  const comun = {
    originX: 'center',
    originY: 'center',
    left: ox + (capa.left || 0) * k,
    top: oy + (capa.top || 0) * k,
    scaleX: (capa.escalaX || 1) * k,
    scaleY: (capa.escalaY || 1) * k,
    angle: capa.angulo || 0,
    flipX: !!capa.flipX,
  };
  if (capa.type === 'image') {
    const img = await cargarImagen(srcDe(capa));
    return new fabric.Image(img, comun);
  }
  return new fabric.Text(propiedadesTexto(capa).text, { ...comun, ...propiedadesTexto(capa) });
};

/** Lee de vuelta la posición de un objeto del lienzo, en unidades. */
export const leerTransformacion = (obj, { k, ox, oy }) => ({
  left: (obj.left - ox) / k,
  top: (obj.top - oy) / k,
  escalaX: obj.scaleX / k,
  escalaY: obj.scaleY / k,
  angulo: obj.angle || 0,
  flipX: !!obj.flipX,
});

const aBlob = (canvasEl, tipo, calidad) =>
  new Promise((resolve, reject) => {
    canvasEl.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('No se pudo generar la imagen.'))), tipo, calidad);
  });

// Safari de iPhone no dibuja canvas de más de ~16,7 millones de píxeles (un
// 35 x 40 cm a 300 dpi son 19,5). Por encima se baja la resolución lo justo.
const AREA_MAXIMA = 16000000;

/**
 * Archivo de impresión de una vista: PNG transparente del tamaño real de la
 * zona a DPI_IMPRESION. Devuelve también los dpi reales con que salió.
 */
export const renderizarImpresion = async (capas, zona, srcDe) => {
  const base = pixelesDeImpresion(zona);
  const reduccion = Math.min(1, Math.sqrt(AREA_MAXIMA / (base.ancho * base.alto)));
  const ancho = Math.round(base.ancho * reduccion);
  const alto = Math.round(base.alto * reduccion);
  const el = document.createElement('canvas');
  const lienzo = new fabric.StaticCanvas(el, {
    width: ancho,
    height: alto,
    enableRetinaScaling: false,
    renderOnAddRemove: false,
  });
  try {
    const t = { k: ancho / UNIDADES_ZONA, ox: 0, oy: 0 };
    for (const capa of capas) {
      lienzo.add(await crearObjeto(capa, t, srcDe));
    }
    lienzo.renderAll();
    const blob = await aBlob(lienzo.lowerCanvasEl, 'image/png');
    return { blob, dpi: Math.round(DPI_IMPRESION * reduccion) };
  } finally {
    lienzo.dispose();
  }
};

/**
 * Vista previa de una vista: la prenda (ya teñida) con el diseño encima,
 * recortado a la zona. Es la miniatura del carrito, de "Mis compras" y la
 * referencia visual del pedido en el ERP.
 */
export const renderizarVistaPrevia = async ({ fuente, anchoImg, altoImg, zona, capas, srcDe, ancho = 900 }) => {
  const margen = Math.round(ancho * 0.06);
  const escala = (ancho - margen * 2) / anchoImg;
  const altoPrenda = altoImg * escala;
  const alto = Math.round(altoPrenda + margen * 2);
  const el = document.createElement('canvas');
  const lienzo = new fabric.StaticCanvas(el, {
    width: ancho,
    height: alto,
    backgroundColor: '#F3F1F7',
    enableRetinaScaling: false,
    renderOnAddRemove: false,
  });
  try {
    lienzo.add(new fabric.Image(fuente, { left: margen, top: margen, scaleX: escala, scaleY: escala }));
    const zx = margen + zona.x * anchoImg * escala;
    const zy = margen + zona.y * altoPrenda;
    const zw = zona.w * anchoImg * escala;
    const zh = altoZonaFraccion(zona, anchoImg, altoImg) * altoPrenda;
    const t = { k: zw / UNIDADES_ZONA, ox: zx, oy: zy };
    for (const capa of capas) {
      const obj = await crearObjeto(capa, t, srcDe);
      obj.clipPath = new fabric.Rect({ left: zx, top: zy, width: zw, height: zh, absolutePositioned: true });
      lienzo.add(obj);
    }
    lienzo.renderAll();
    return await aBlob(lienzo.lowerCanvasEl, 'image/jpeg', 0.88);
  } finally {
    lienzo.dispose();
  }
};
