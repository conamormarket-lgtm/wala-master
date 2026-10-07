import { fabric } from 'fabric';
import {
  UNIDADES_ZONA,
  altoZonaFraccion,
  cargarImagen,
  pixelesDeImpresion,
} from '../../utils/prendaBase';
import { loadFontResources } from '../../services/shared/fontResources';

/**
 * Dibujo de un diseño del apartado Crear. Lo usan el lienzo del estudio, la
 * vista previa que va al carrito y el archivo de impresión: los tres parten
 * de las mismas capas y de estas mismas funciones, así lo que el cliente ve
 * es exactamente lo que se imprime.
 *
 * Cada capa pertenece a una zona y guarda su centro (left, top) y su escala
 * en UNIDADES de esa zona (la zona mide UNIDADES_ZONA de ancho), medidos en
 * el sistema de la zona SIN girar. Para pintarla se usa la transformación de
 * la zona en el lienzo de destino:
 *
 *   { k, cx, cy, ang, wu, hu }
 *   k = píxeles por unidad · (cx, cy) = centro de la zona · ang = giro (grados)
 *   wu, hu = ancho y alto de la zona en unidades
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

export const asegurarFuentesDe = (capasPorZona) => {
  const familias = new Set();
  Object.values(capasPorZona || {}).forEach((capas) => {
    (capas || []).forEach((c) => { if (c.type === 'text' && c.fuente) familias.add(c.fuente); });
  });
  return Promise.all([...familias].map(asegurarFuente));
};

/** Alto de la zona en unidades. */
export const altoEnUnidades = (zona) => UNIDADES_ZONA * zona.proporcion;

/**
 * Transformación de una zona dibujada sobre la foto de su vista.
 * (ox, oy) = esquina de la foto en el lienzo; (iw, ih) = tamaño de la foto
 * en el lienzo; (anchoImg, altoImg) = tamaño natural de la foto.
 */
export const transformDeZona = (zona, { ox, oy, iw, ih, anchoImg, altoImg }) => {
  const zw = zona.w * iw;
  const zh = altoZonaFraccion(zona, anchoImg, altoImg) * ih;
  return {
    k: zw / UNIDADES_ZONA,
    cx: ox + zona.x * iw + zw / 2,
    cy: oy + zona.y * ih + zh / 2,
    ang: zona.angulo || 0,
    wu: UNIDADES_ZONA,
    hu: altoEnUnidades(zona),
    zw,
    zh,
  };
};

const rad = (grados) => (grados * Math.PI) / 180;

/** Punto en unidades de la zona -> píxeles del lienzo. */
export const aLienzo = (t, left, top) => {
  const dx = (left - t.wu / 2) * t.k;
  const dy = (top - t.hu / 2) * t.k;
  const a = rad(t.ang);
  return { x: t.cx + dx * Math.cos(a) - dy * Math.sin(a), y: t.cy + dx * Math.sin(a) + dy * Math.cos(a) };
};

/** Píxeles del lienzo -> unidades de la zona. */
export const desdeLienzo = (t, x, y) => {
  const dx = x - t.cx;
  const dy = y - t.cy;
  const a = rad(t.ang);
  return {
    left: (dx * Math.cos(a) + dy * Math.sin(a)) / t.k + t.wu / 2,
    top: (-dx * Math.sin(a) + dy * Math.cos(a)) / t.k + t.hu / 2,
  };
};

/** Rectángulo de la zona (para recortar y para la guía). */
export const rectDeZona = (t, extra = {}) => new fabric.Rect({
  left: t.cx,
  top: t.cy,
  width: t.zw,
  height: t.zh,
  angle: t.ang,
  originX: 'center',
  originY: 'center',
  ...extra,
});

export const recorteDeZona = (t) => rectDeZona(t, { absolutePositioned: true });

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

/** Posición, escala y giro de una capa en el lienzo de destino. */
export const ubicacion = (capa, t) => {
  const p = aLienzo(t, capa.left || 0, capa.top || 0);
  return {
    originX: 'center',
    originY: 'center',
    left: p.x,
    top: p.y,
    scaleX: (capa.escalaX || 1) * t.k,
    scaleY: (capa.escalaY || 1) * t.k,
    angle: (capa.angulo || 0) + t.ang,
    flipX: !!capa.flipX,
  };
};

/**
 * Crea el objeto de fabric de una capa. `srcDe(capa)` decide de dónde se lee
 * la imagen (la URL local mientras se sube, o la de Storage). Con
 * `editable`, el texto se puede escribir directo sobre la prenda (estudio en
 * escritorio); las vistas previas y la impresión usan texto fijo.
 */
export const crearObjeto = async (capa, t, srcDe = (c) => c.src, { editable = false } = {}) => {
  const comun = ubicacion(capa, t);
  if (capa.type === 'image') {
    const img = await cargarImagen(srcDe(capa));
    return new fabric.Image(img, comun);
  }
  const props = { ...comun, ...propiedadesTexto(capa) };
  if (editable) {
    return new fabric.IText(props.text, {
      ...props,
      cursorColor: '#7C3AED',
      cursorWidth: 3,
      selectionColor: 'rgba(124, 58, 237, 0.25)',
      editingBorderColor: '#7C3AED',
    });
  }
  return new fabric.Text(props.text, props);
};

/** Lee de vuelta la posición de un objeto del lienzo, en unidades de su zona. */
export const leerTransformacion = (obj, t) => {
  const p = desdeLienzo(t, obj.left, obj.top);
  return {
    left: p.left,
    top: p.top,
    escalaX: obj.scaleX / t.k,
    escalaY: obj.scaleY / t.k,
    angulo: (obj.angle || 0) - t.ang,
    flipX: !!obj.flipX,
  };
};

/** ¿Alguna esquina del objeto queda fuera de su zona? */
export const seSaleDeZona = (obj, t) => {
  const margen = 1.5 / t.k;
  return obj.getCoords(true, true).some(({ x, y }) => {
    const p = desdeLienzo(t, x, y);
    return p.left < -margen || p.top < -margen || p.left > t.wu + margen || p.top > t.hu + margen;
  });
};

const aBlob = (canvasEl, tipo, calidad) =>
  new Promise((resolve, reject) => {
    canvasEl.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('No se pudo generar la imagen.'))), tipo, calidad);
  });

/**
 * Archivo de impresión de una zona: PNG transparente con el diseño de la
 * zona, derecho (sin su giro). Con la medida real de la zona sale a tamaño
 * real (ver pixelesDeImpresion); sin ella, a una escala fija.
 */
export const renderizarImpresion = async (capas, zona, srcDe, medida = null) => {
  const { ancho, alto } = pixelesDeImpresion(zona, medida);
  const el = document.createElement('canvas');
  const lienzo = new fabric.StaticCanvas(el, {
    width: ancho,
    height: alto,
    enableRetinaScaling: false,
    renderOnAddRemove: false,
  });
  try {
    const t = { k: ancho / UNIDADES_ZONA, cx: ancho / 2, cy: alto / 2, ang: 0, wu: UNIDADES_ZONA, hu: altoEnUnidades(zona) };
    for (const capa of capas) {
      lienzo.add(await crearObjeto(capa, t, srcDe));
    }
    lienzo.renderAll();
    const blob = await aBlob(lienzo.lowerCanvasEl, 'image/png');
    return { blob, ancho, alto };
  } finally {
    lienzo.dispose();
  }
};

/**
 * Vista previa de una vista: la prenda (ya teñida) con el diseño de todas sus
 * zonas, cada uno recortado a la suya. Es la miniatura del carrito, de "Mis
 * compras" y la referencia visual del pedido en el ERP.
 */
export const renderizarVistaPrevia = async ({ fuente, anchoImg, altoImg, vista, capasPorZona, srcDe, ancho = 900 }) => {
  const margen = Math.round(ancho * 0.06);
  const iw = ancho - margen * 2;
  const ih = altoImg * (iw / anchoImg);
  const alto = Math.round(ih + margen * 2);
  const el = document.createElement('canvas');
  const lienzo = new fabric.StaticCanvas(el, {
    width: ancho,
    height: alto,
    backgroundColor: '#F3F1F7',
    enableRetinaScaling: false,
    renderOnAddRemove: false,
  });
  try {
    lienzo.add(new fabric.Image(fuente, { left: margen, top: margen, scaleX: iw / anchoImg, scaleY: ih / altoImg }));
    for (const zona of vista.zonas) {
      const capas = capasPorZona[zona.id] || [];
      if (!capas.length) continue;
      const t = transformDeZona(zona, { ox: margen, oy: margen, iw, ih, anchoImg, altoImg });
      for (const capa of capas) {
        const obj = await crearObjeto(capa, t, srcDe);
        obj.clipPath = recorteDeZona(t);
        lienzo.add(obj);
      }
    }
    lienzo.renderAll();
    return await aBlob(lienzo.lowerCanvasEl, 'image/jpeg', 0.88);
  } finally {
    lienzo.dispose();
  }
};

const aImagen = (blob) => new Promise((resolve, reject) => {
  const url = URL.createObjectURL(blob);
  const img = new Image();
  img.onload = () => resolve({ img, url });
  img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('No se pudo leer la vista previa.')); };
  img.src = url;
});

/**
 * Une las vistas previas (frente, espalda...) en una sola imagen, una al lado
 * de la otra y con su nombre encima. Es la imagen que el cliente descarga y
 * la que acompaña al pedido para ver la prenda completa de un vistazo.
 */
export const componerVistas = async (piezas, { titulo = '' } = {}) => {
  const cargadas = await Promise.all(piezas.map(async (p) => ({ ...p, ...(await aImagen(p.blob)) })));
  try {
    const margen = 40;
    const separacion = 24;
    const cabecera = titulo ? 120 : 76;
    const altoPieza = Math.max(...cargadas.map((p) => p.img.naturalHeight));
    const ancho = cargadas.reduce((acc, p) => acc + p.img.naturalWidth, 0) + separacion * (cargadas.length - 1) + margen * 2;
    const alto = altoPieza + cabecera + margen;
    const canvas = document.createElement('canvas');
    canvas.width = ancho;
    canvas.height = alto;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#F3F1F7';
    ctx.fillRect(0, 0, ancho, alto);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (titulo) {
      ctx.fillStyle = '#1F1B2E';
      ctx.font = '700 40px Montserrat, Arial, sans-serif';
      ctx.fillText(titulo, ancho / 2, 52);
    }
    let x = margen;
    cargadas.forEach((p) => {
      ctx.fillStyle = '#3C3489';
      ctx.font = '700 30px Montserrat, Arial, sans-serif';
      ctx.fillText(p.nombre, x + p.img.naturalWidth / 2, cabecera - 34);
      ctx.drawImage(p.img, x, cabecera + (altoPieza - p.img.naturalHeight) / 2);
      x += p.img.naturalWidth + separacion;
    });
    return await aBlob(canvas, 'image/jpeg', 0.9);
  } finally {
    cargadas.forEach((p) => URL.revokeObjectURL(p.url));
  }
};
