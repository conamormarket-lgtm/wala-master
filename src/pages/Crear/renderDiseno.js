import { fabric } from 'fabric';
import {
  UNIDADES_ZONA,
  altoZonaFraccion,
  cargarImagen,
  pixelesDeImpresion,
} from '../../utils/prendaBase';
import { loadFontResources } from '../../services/shared/fontResources';
import { textoEnGrises, pixelesEnGrises } from '../../utils/laser.mjs';

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
  'Kanit', 'Rubik', 'Libre Baskerville', 'Crimson Pro',
  // Locales (public/fonts/fonts.css): se cargan del mismo sitio.
  'Back to Black', 'Franklin Gothic Heavy Italic', 'Varsity Team Bold', 'Keep on Truckin',
  'Brush Script', 'Bernadette', 'DK Longreach', 'Rainbow Kitty', 'Cinzel',
];

const fuentesListas = new Map();

// Letras cuyo archivo ya es grueso o inclinado (Back to Black, Franklin Gothic
// Heavy Italic…): el navegador no les "inventa" negrita ni cursiva y el botón
// no cambiaba nada. Se mide al cargarlas y, si hace falta, se dibuja aparte.
const sinVariante = new Map();

const firmaTexto = (font) => {
  const c = document.createElement('canvas');
  c.width = 400;
  c.height = 80;
  const ctx = c.getContext('2d');
  ctx.font = font;
  ctx.fillText('HaWo gl', 8, 60);
  const d = ctx.getImageData(0, 0, c.width, c.height).data;
  let s = 0;
  for (let i = 3; i < d.length; i += 4) s = (s * 31 + d[i]) % 1000000007;
  return s;
};

const medirVariantes = (familia) => {
  try {
    const normal = firmaTexto(`normal 400 48px "${familia}"`);
    sinVariante.set(familia, {
      negrita: normal === firmaTexto(`normal 700 48px "${familia}"`),
      cursiva: normal === firmaTexto(`italic 400 48px "${familia}"`),
    });
  } catch {
    // Sin canvas legible no se mide: queda lo que haga el navegador.
  }
};

/** Carga una fuente (normal, negrita y cursiva) antes de pintarla en canvas. */
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
          document.fonts.load(`italic 400 48px "${familia}"`),
          document.fonts.load(`italic 700 48px "${familia}"`),
        ]);
        medirVariantes(familia);
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
    // Esquinas redondeadas (el mousepad): radio en píxeles.
    r: (zona.radio || 0) * zw,
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
  ...(t.r > 0 && { rx: t.r, ry: t.r }),
  height: t.zh,
  angle: t.ang,
  originX: 'center',
  originY: 'center',
  ...extra,
});

export const recorteDeZona = (t) => rectDeZona(t, { absolutePositioned: true });

/**
 * El recorte de una capa: su zona o, si es la foto de una plantilla, su
 * ventana (`ventana: { x, y, w, h }` en unidades de la zona, sin girar). La
 * foto se mueve y agranda por dentro, pero no se sale de su marco.
 */
export const recorteDeCapa = (capa, t) => {
  const v = capa?.ventana;
  if (!v) return recorteDeZona(t);
  const centro = aLienzo(t, v.x + v.w / 2, v.y + v.h / 2);
  return new fabric.Rect({
    left: centro.x, top: centro.y, width: v.w * t.k, height: v.h * t.k, angle: t.ang,
    originX: 'center', originY: 'center', absolutePositioned: true,
    // Y además la forma de la zona: en un mousepad de esquinas redondas, la
    // foto de una ventana que llega a la orilla tampoco asoma por la esquina.
    ...(t.r > 0 && { clipPath: recorteDeZona(t) }),
  });
};

/**
 * Propiedades de fabric de un texto, con sus efectos:
 * - contorno: grosor visible en % del tamaño de letra (contornoColor). Se
 *   pinta detrás de la letra, así no la adelgaza. Con sinRelleno la letra
 *   queda transparente y solo se ve (e imprime) el contorno.
 * - sombra: distancia en % del tamaño (sombraColor). Sólida, sin
 *   desenfoque: una sombra difuminada no se imprime bien en la prenda.
 * - espaciado (milésimas de letra), interlineado y alineacion.
 * La curva va aparte (curvarTexto), porque depende del largo del texto.
 */
export const propiedadesTexto = (capa) => {
  const tamano = capa.tamano || 90;
  const curvo = Boolean(Number(capa.curva));
  const texto = capa.text?.length ? capa.text : ' ';
  const contorno = Number(capa.contorno) || 0;
  const sombra = Number(capa.sombra) || 0;
  const fuente = capa.fuente || 'Montserrat';
  const color = capa.color || '#111111';
  // Negrita o cursiva que el navegador no puede hacer con esta letra: la
  // negrita es un trazo del color de la letra (ver pintarTextoConContorno) y
  // la cursiva, una inclinación.
  const falta = sinVariante.get(fuente) || {};
  const negritaFalsa = capa.negrita && falta.negrita ? tamano * 0.04 : 0;
  return {
    // Un texto curvo va en una sola línea (todas irían sobre el mismo arco).
    text: curvo ? texto.replace(/\s*\n\s*/g, ' ') : texto,
    fontFamily: fuente,
    fill: contorno > 0 && capa.sinRelleno ? 'rgba(0,0,0,0)' : color,
    fontSize: tamano,
    fontWeight: capa.negrita ? 'bold' : 'normal',
    fontStyle: capa.cursiva ? 'italic' : 'normal',
    textAlign: curvo ? 'center' : (capa.alineacion || 'center'),
    lineHeight: Number(capa.interlineado) || 1.05,
    charSpacing: Number(capa.espaciado) || 0,
    // El contorno crece con la negrita dibujada, para seguir viéndose igual de grueso.
    stroke: contorno > 0 ? (capa.contornoColor || '#FFFFFF') : negritaFalsa ? color : null,
    strokeWidth: (contorno > 0 ? (tamano * contorno * 2) / 100 : 0) + negritaFalsa,
    negritaFalsa,
    skewX: capa.cursiva && falta.cursiva ? -12 : 0,
    paintFirst: 'stroke',
    strokeLineJoin: 'round',
    shadow: sombra > 0
      ? new fabric.Shadow({
        color: capa.sombraColor || '#111111',
        blur: 0,
        offsetX: (tamano * sombra) / 100,
        offsetY: (tamano * sombra) / 100,
        affectStroke: true,
      })
      : null,
  };
};

/**
 * Pinta el contorno con la sombra y la letra encima sin sombra: así la
 * sombra es la de todo el conjunto (fabric, por defecto, o la pierde o
 * dibuja la de la letra encima del contorno).
 */
function pintarTextoConContorno(ctx) {
  if (this.stroke && this.strokeWidth > 0) {
    this._renderTextStroke(ctx);
    this._removeShadow(ctx);
    if (this.negritaFalsa > 0 && this.stroke !== this.fill) {
      // Con contorno, la negrita dibujada va aparte, del color de la letra.
      const { stroke, strokeWidth } = this;
      this.stroke = this.fill;
      this.strokeWidth = this.negritaFalsa;
      this._renderTextStroke(ctx);
      this.stroke = stroke;
      this.strokeWidth = strokeWidth;
    }
    this._renderTextFill(ctx);
    return;
  }
  this._renderTextFill(ctx);
}

const LIMITE_CURVA = (300 * Math.PI) / 180;

/**
 * Curva el texto sobre un arco del largo justo del texto. curva (−100 a
 * 100): positiva lo arquea hacia arriba (∩), negativa hacia abajo (∪);
 * 100 es casi un círculo. Un texto curvo no se escribe directo sobre la
 * prenda (se edita en el panel).
 */
export const curvarTexto = (obj, curva) => {
  const c = Math.max(-100, Math.min(100, Number(curva) || 0));
  if (obj.type === 'i-text') obj.set({ editable: !c });
  obj.set({ path: null, pathAlign: 'center', pathStartOffset: 0 });
  if (!c) return obj;
  // fabric mide el arco con curvas aproximadas y le sale algo más corto que
  // el real: con un arco justo, la primera letra "daba la vuelta" y salía al
  // final (sobre todo con espaciado). Se deja un margen; el texto va centrado.
  const largo = Math.max(1, obj.calcTextWidth()) * 1.04 + obj.fontSize * 0.1;
  // El largo incluye el espaciado después de la última letra: se compensa
  // para que lo que se ve quede centrado en el arco.
  const espacioFinal = (obj.fontSize * (Number(obj.charSpacing) || 0)) / 1000;
  const angulo = (Math.abs(c) / 100) * LIMITE_CURVA;
  const r = largo / angulo;
  const x = Math.sin(angulo / 2) * r;
  const y = Math.cos(angulo / 2) * r;
  const grande = angulo > Math.PI ? 1 : 0;
  const d = c > 0
    ? `M ${-x} ${-y} A ${r} ${r} 0 ${grande} 1 ${x} ${-y}`
    : `M ${-x} ${y} A ${r} ${r} 0 ${grande} 0 ${x} ${y}`;
  obj.set({ path: new fabric.Path(d, { visible: false }), pathStartOffset: espacioFinal / 2 });
  return obj;
};

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
export const crearObjeto = async (capa, t, srcDe = (c) => c.src, { editable = false, laser = false } = {}) => {
  const comun = ubicacion(capa, t);
  if (capa.type === 'image') {
    const src = srcDe(capa);
    const img = laser ? await imagenEnGrises(src) : await cargarImagen(src);
    return new fabric.Image(img, comun);
  }
  const props = { ...comun, ...propiedadesTexto(laser ? textoEnGrises(capa) : capa) };
  const texto = editable
    ? new fabric.IText(props.text, {
      ...props,
      cursorColor: '#7C3AED',
      cursorWidth: 3,
      selectionColor: 'rgba(124, 58, 237, 0.25)',
      editingBorderColor: '#7C3AED',
    })
    : new fabric.Text(props.text, props);
  texto._renderText = pintarTextoConContorno;
  return curvarTexto(texto, capa.curva);
};

/**
 * La imagen en escala de grises (grabado láser), como un canvas que fabric
 * dibuja igual que una imagen. Se guarda por dirección: el estudio redibuja
 * seguido y la conversión de una foto grande tarda.
 */
const cacheGrises = new Map();
const imagenEnGrises = (src) => {
  if (!cacheGrises.has(src)) {
    const promesa = cargarImagen(src).then((img) => {
      const el = document.createElement('canvas');
      el.width = img.naturalWidth;
      el.height = img.naturalHeight;
      const ctx = el.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(img, 0, 0);
      const datos = ctx.getImageData(0, 0, el.width, el.height);
      pixelesEnGrises(datos.data);
      ctx.putImageData(datos, 0, 0);
      return el;
    });
    promesa.catch(() => cacheGrises.delete(src));
    cacheGrises.set(src, promesa);
  }
  return cacheGrises.get(src);
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
 * real (ver pixelesDeImpresion); sin ella, a una escala fija. Para grabado
 * láser (`laser`) sale en escala de grises.
 */
export const renderizarImpresion = async (capas, zona, srcDe, medida = null, { laser = false } = {}) => {
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
      const obj = await crearObjeto(capa, t, srcDe, { laser });
      if (capa.ventana) obj.clipPath = recorteDeCapa(capa, t);
      lienzo.add(obj);
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
export const renderizarVistaPrevia = async ({ fuente, anchoImg, altoImg, vista, capasPorZona, srcDe, ancho = 900, laser = false, producto = false }) => {
  // El borde del producto que va encima del diseño (vista.encima), si tiene.
  const encima = vista.encima ? await cargarImagen(vista.encima).catch(() => null) : null;
  const margen = Math.round(ancho * 0.06);
  const iw = ancho - margen * 2;
  const ih = altoImg * (iw / anchoImg);
  // Un producto (cuadro, mousepad, tomatodo) va en 4:5, centrado y sobre
  // blanco: las tarjetas de la tienda funden el blanco con su escenario
  // (multiply), así no queda un recuadro lila ni se recorta el marco. Una
  // prenda sigue sobre lila: su foto es blanca y sobre blanco se perdería.
  const alto = producto ? Math.max(Math.round(ih + margen * 2), Math.round(ancho * 1.25)) : Math.round(ih + margen * 2);
  const oy = Math.round((alto - ih) / 2);
  const el = document.createElement('canvas');
  const lienzo = new fabric.StaticCanvas(el, {
    width: ancho,
    height: alto,
    backgroundColor: producto ? '#FFFFFF' : '#F3F1F7',
    enableRetinaScaling: false,
    renderOnAddRemove: false,
  });
  try {
    lienzo.add(new fabric.Image(fuente, { left: margen, top: oy, scaleX: iw / anchoImg, scaleY: ih / altoImg }));
    for (const zona of vista.zonas) {
      const capas = capasPorZona[zona.id] || [];
      if (!capas.length) continue;
      const t = transformDeZona(zona, { ox: margen, oy, iw, ih, anchoImg, altoImg });
      for (const capa of capas) {
        const obj = await crearObjeto(capa, t, srcDe, { laser });
        obj.clipPath = recorteDeCapa(capa, t);
        lienzo.add(obj);
      }
    }
    if (encima) lienzo.add(new fabric.Image(encima, { left: margen, top: oy, scaleX: iw / encima.naturalWidth, scaleY: ih / encima.naturalHeight }));
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

/** Logo de Walá (mismo dominio: no bloquea el lienzo al exportarlo). */
const LOGO_WALA = '/logo-wala-192.png';

/** El logo ya cargado, o null si no se pudo (la imagen sale igual, sin él). */
const cargarLogo = () => new Promise((resolve) => {
  const img = new Image();
  img.onload = () => resolve(img);
  img.onerror = () => resolve(null);
  img.src = LOGO_WALA;
});

/**
 * Une las vistas previas (frente, espalda...) en una sola imagen, una al lado
 * de la otra y con su nombre encima. Es la imagen que el cliente descarga y
 * la que acompaña al pedido para ver la prenda completa de un vistazo.
 * Lleva el logo de Walá en la esquina inferior derecha ("Creado en wala.pe")
 * para que se sepa de dónde es el diseño cuando se comparte.
 */
export const componerVistas = async (piezas, { titulo = '', fondo = '#F3F1F7' } = {}) => {
  const [cargadas, logo] = await Promise.all([
    Promise.all(piezas.map(async (p) => ({ ...p, ...(await aImagen(p.blob)) }))),
    cargarLogo(),
  ]);
  try {
    const margen = 40;
    const separacion = 24;
    const cabecera = titulo ? 120 : 76;
    const tamLogo = 76;
    const pie = logo ? tamLogo + 32 : 0;
    const altoPieza = Math.max(...cargadas.map((p) => p.img.naturalHeight));
    const ancho = cargadas.reduce((acc, p) => acc + p.img.naturalWidth, 0) + separacion * (cargadas.length - 1) + margen * 2;
    const alto = altoPieza + cabecera + margen + pie;
    const canvas = document.createElement('canvas');
    canvas.width = ancho;
    canvas.height = alto;
    const ctx = canvas.getContext('2d');
    // El de las vistas (blanco en un producto), para que no se vean recuadros.
    ctx.fillStyle = fondo;
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
    if (logo) {
      const lx = ancho - margen - tamLogo;
      const ly = alto - margen / 2 - tamLogo;
      ctx.drawImage(logo, lx, ly, tamLogo, tamLogo);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#3C3489';
      ctx.font = '700 30px Montserrat, Arial, sans-serif';
      ctx.fillText('Creado en wala.pe', lx - 16, ly + tamLogo / 2);
    }
    return await aBlob(canvas, 'image/jpeg', 0.9);
  } finally {
    cargadas.forEach((p) => URL.revokeObjectURL(p.url));
  }
};
