import { cargarImagen } from '../../../componentes/kit/imagenes';
import { toDirectImageUrl } from '../../../utils/imageUrl';
import { identidadDeMarca } from '../../../componentes/kit/adaptadores';
import { getDocument } from '../../../services/firebase/firestore';
import { leerLandingPages } from '../services/landingPages';

/*
 * La imagen "frente y espalda" de un producto: la foto principal y la segunda
 * (de ordinario el frente y la espalda, aunque puede ser al revés o dos vistas
 * cualesquiera) en una sola composición, sobre el fondo de Walá o los
 * colores de su marca, y con el sello de Walá + la marca abajo a la izquierda.
 * Se dibuja en un canvas del
 * navegador y sale como PNG; uploadFile la pasa a WebP con sus tamaños chicos.
 *
 * Las fotos vienen con fondo blanco: no van directo sobre el color (se verían
 * como un recorte), sino cada una en su tarjeta blanca, como una foto impresa,
 * y el color de la marca queda alrededor.
 */

// Cuadrada, como el marco de la foto en la ficha del producto (GaleriaProducto,
// 1:1): así se ve entera, sin bandas a los lados. El lado es MAX_LADO.
const ANCHO = 2000;
const ALTO = 2000;

const VIOLETA = '#6d28d9';
const HILO = '#a78bfa';
const FUENTE = 'Montserrat, Poppins, Arial, sans-serif';
const LOGO = '/assets/marca/logo-header-v2.webp';
const LOGO_HUECOS = '/assets/marca/logo-header-huecos-v2.webp';

/**
 * Carga una imagen para dibujarla sin "ensuciar" el canvas. Primero por fetch
 * sin caché: la <img> de la galería pudo dejar en caché la respuesta sin la
 * cabecera CORS y entonces la misma URL con crossOrigin fallaría.
 */
const cargar = async (url) => {
  const src = toDirectImageUrl(url);
  if (!src) throw new Error('Sin imagen');
  if (typeof createImageBitmap === 'function' && /^https?:/.test(src)) {
    try {
      const r = await fetch(src, { mode: 'cors', cache: 'no-store' });
      if (r.ok) return await createImageBitmap(await r.blob());
    } catch { /* se intenta como <img> */ }
  }
  return cargarImagen(src);
};

const cargarOpcional = (url) => (url ? cargar(url).catch(() => null) : Promise.resolve(null));

const lado = (img) => ({ w: img.naturalWidth || img.width, h: img.naturalHeight || img.height });

const hexARgb = (hex) => {
  const m = String(hex || '').trim().match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!m) return null;
  const h = m[1].length === 3 ? m[1].split('').map((c) => c + c).join('') : m[1];
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
};

/** Rectángulo de esquinas redondeadas (roundRect no está en todos los navegadores). */
const redondeado = (ctx, x, y, w, h, r) => {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
};

/** Dibuja `img` cubriendo el rectángulo (como object-fit: cover). */
const cubrir = (ctx, img, x, y, w, h) => {
  const { w: iw, h: ih } = lado(img);
  const k = Math.max(w / iw, h / ih);
  const sw = w / k;
  const sh = h / k;
  ctx.drawImage(img, (iw - sw) / 2, (ih - sh) / 2, sw, sh, x, y, w, h);
};

/** Dibuja `img` entera dentro del rectángulo (object-fit: contain). */
const contener = (ctx, img, x, y, w, h, recorte) => {
  const { w: iw, h: ih } = lado(img);
  // El encuadre que el admin eligió para la foto (porcentajes), si lo hay.
  const valido = recorte && recorte.width > 0 && recorte.height > 0;
  const sx = valido ? (recorte.x / 100) * iw : 0;
  const sy = valido ? (recorte.y / 100) * ih : 0;
  const sw = valido ? (recorte.width / 100) * iw : iw;
  const sh = valido ? (recorte.height / 100) * ih : ih;
  const k = Math.min(w / sw, h / sh);
  const dw = sw * k;
  const dh = sh * k;
  ctx.drawImage(img, sx, sy, sw, sh, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
};

/* ── Fondo ── */

/** `hex` mezclado con negro (k = 0..1): el segundo color cuando la marca no tiene. */
const oscurecer = (hex, k) => {
  const [r, g, b] = hexARgb(hex);
  return `rgb(${[r, g, b].map((c) => Math.round(c * (1 - k))).join(' ')})`;
};

const esOscuro = (hex) => {
  const [r, g, b] = hexARgb(hex);
  return 0.299 * r + 0.587 * g + 0.114 * b < 150;
};

/**
 * El fondo de una marca, en el orden en que la marca se muestra en la tienda:
 *  1. los colores de la portada de su página (pages/{slug}, sección
 *     brand_hero: "Color de la marca" y "Segundo color" del editor);
 *  2. los de su identidad en Marcas (o su bgColor si no es blanco);
 *  3. el fondo de su tarjeta de producto (imagen + color + opacidad).
 * Devuelve { color, color2 } o { imagen, color, opacidad }, o null si no tiene.
 */
export const fondoDeMarca = async (marca) => {
  if (!marca?.id) return null;
  let portada = null;
  try {
    const { data: landings } = await leerLandingPages(marca.id);
    const landing = Array.isArray(landings) ? landings[0] : null;
    if (landing) {
      const { data: pagina } = await getDocument('pages', landing.slug || landing.id);
      portada = (pagina?.sections || []).find((sec) => sec?.type === 'brand_hero')?.settings || null;
    }
  } catch { /* sin página: se sigue con lo de Marcas */ }
  if (hexARgb(portada?.color)) return { color: portada.color, color2: hexARgb(portada.color2) ? portada.color2 : '' };
  const identidad = identidadDeMarca(marca);
  if (hexARgb(identidad.color)) return { color: identidad.color, color2: hexARgb(identidad.color2) ? identidad.color2 : '' };
  if (marca.bgImage) return { imagen: marca.bgImage, color: hexARgb(marca.bgColor) ? marca.bgColor : '#ffffff', opacidad: marca.bgOpacity ?? 100 };
  return null;
};

/**
 * Pinta el fondo: el de Walá (fondo = null) o el de la marca (fondoDeMarca):
 * su degradado de dos colores —como la portada de su página; sin segundo
 * color, el primero oscurecido— o la imagen de su tarjeta con el velo de
 * color, como la tarjeta de producto de la tienda.
 */
const pintarFondo = (ctx, fondo, imagenFondo) => {
  if (!fondo) {
    pintarFondoWala(ctx);
    return;
  }
  if (fondo.imagen && imagenFondo) {
    ctx.fillStyle = fondo.color;
    ctx.fillRect(0, 0, ANCHO, ALTO);
    cubrir(ctx, imagenFondo, 0, 0, ANCHO, ALTO);
    const velo = 1 - fondo.opacidad / 100;
    if (velo > 0) {
      ctx.globalAlpha = velo;
      ctx.fillRect(0, 0, ANCHO, ALTO);
      ctx.globalAlpha = 1;
    }
    return;
  }
  const c1 = hexARgb(fondo.color) ? fondo.color : '#7c3aed';
  const g = ctx.createLinearGradient(0, 0, ANCHO, ALTO);
  g.addColorStop(0, c1);
  g.addColorStop(1, hexARgb(fondo.color2) ? fondo.color2 : oscurecer(c1, 0.35));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, ANCHO, ALTO);
  // Los garabatos de Walá, en el tono del fondo y no en los colores de Walá.
  const tinta = esOscuro(c1) ? 'rgba(255, 255, 255, 0.16)' : 'rgba(0, 0, 0, 0.1)';
  pintarGarabatos(ctx, tinta, [tinta, tinta, tinta, tinta]);
};

/** Destello de cuatro puntas (el ✦ de los banners), centrado en (x, y). */
const destello = (ctx, x, y, r, color) => {
  ctx.save();
  ctx.translate(x - r, y - r);
  ctx.scale(r / 12, r / 12);
  ctx.fillStyle = color;
  ctx.fill(new Path2D('M12 0c.6 5.6 2.6 9 12 12-9.4 3-11.4 6.4-12 12-.6-5.6-2.6-9-12-12C9.4 9 11.4 5.6 12 0Z'));
  ctx.restore();
};

/** Garabatos quietos: puntos de medio tono arriba a la izquierda y cuatro destellos. */
const pintarGarabatos = (ctx, puntos, destellos) => {
  ctx.fillStyle = puntos;
  for (let f = 0; f < 6; f += 1) {
    for (let c = 0; c < 9; c += 1) {
      const r = 11 * (1 - c / 10.5);
      ctx.beginPath();
      ctx.arc(90 + c * 42, 90 + f * 42 + (c % 2) * 21, Math.max(2.5, r), 0, Math.PI * 2);
      ctx.fill();
    }
  }
  destello(ctx, 1800, 200, 58, destellos[0]);
  destello(ctx, 1680, 330, 28, destellos[1]);
  destello(ctx, 1830, 1790, 44, destellos[2]);
  destello(ctx, 960, 190, 24, destellos[3]);
};

/** Lila suave de Walá con sus garabatos de colores. */
const pintarFondoWala = (ctx) => {
  const g = ctx.createLinearGradient(0, 0, ANCHO, ALTO);
  g.addColorStop(0, '#f5f3ff');
  g.addColorStop(0.55, '#ede9fe');
  g.addColorStop(1, '#fce7f3');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, ANCHO, ALTO);
  pintarGarabatos(ctx, 'rgba(124, 58, 237, 0.16)', ['#fcd34d', '#a78bfa', '#f9a8d4', '#c4b5fd']);
};

/* ── Tarjetas con las fotos ── */

const TARJETA_ANCHO = 820;
const TARJETA_ALTO = Math.round(TARJETA_ANCHO * 4 / 3);
const TARJETA_RADIO = 42;
const TARJETA_BORDE = 26;

/** Una foto en su tarjeta blanca, girada `giro` grados alrededor de su centro. */
const pintarTarjeta = (ctx, foto, recorte, cx, cy, giro, etiqueta) => {
  const x = -TARJETA_ANCHO / 2;
  const y = -TARJETA_ALTO / 2;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((giro * Math.PI) / 180);
  // Sombra suave para que la tarjeta se despegue de cualquier fondo, también del claro.
  ctx.save();
  ctx.shadowColor = 'rgba(20, 18, 28, 0.28)';
  ctx.shadowBlur = 70;
  ctx.shadowOffsetY = 30;
  ctx.fillStyle = '#ffffff';
  redondeado(ctx, x, y, TARJETA_ANCHO, TARJETA_ALTO, TARJETA_RADIO);
  ctx.fill();
  ctx.restore();
  ctx.save();
  redondeado(ctx, x + TARJETA_BORDE, y + TARJETA_BORDE, TARJETA_ANCHO - TARJETA_BORDE * 2, TARJETA_ALTO - TARJETA_BORDE * 2, TARJETA_RADIO - 10);
  ctx.clip();
  ctx.imageSmoothingQuality = 'high';
  contener(ctx, foto, x + TARJETA_BORDE, y + TARJETA_BORDE, TARJETA_ANCHO - TARJETA_BORDE * 2, TARJETA_ALTO - TARJETA_BORDE * 2, recorte);
  ctx.restore();
  // "FRENTE" / "ESPALDA" colgando del borde de arriba (si la foto lleva nombre).
  if (etiqueta) pintarColgante(ctx, etiqueta, x + 80, y + 12, 84);
  ctx.restore();
};

/**
 * Etiqueta colgante de Walá (la del kit): cuerpo violeta con la punta a la
 * izquierda, el ojal calado y el hilo saliendo hacia arriba, un poco inclinada.
 * (x, y) es la punta; alto = alto del cuerpo.
 */
const pintarColgante = (ctx, texto, x, y, alto) => {
  ctx.save();
  ctx.font = `900 ${Math.round(alto * 0.5)}px ${FUENTE}`;
  const anchoTexto = ctx.measureText(texto).width + alto * 0.12 * texto.length;
  const punta = alto * 0.55;
  const ancho = punta + alto * 0.4 + anchoTexto + alto * 0.5;
  ctx.translate(x, y);
  ctx.rotate((-4 * Math.PI) / 180);

  // El hilo: un arco desde el ojal hacia arriba y afuera.
  ctx.strokeStyle = HILO;
  ctx.lineWidth = alto * 0.1;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(punta * 0.62, 0);
  ctx.quadraticCurveTo(-alto * 0.2, -alto * 0.55, -alto * 0.75, -alto * 0.4);
  ctx.stroke();

  // Cuerpo con la punta en una capa aparte, para calar el ojal (deja ver lo de atrás).
  const capa = document.createElement('canvas');
  const k = 2;
  capa.width = Math.ceil(ancho * k);
  capa.height = Math.ceil(alto * k);
  const c = capa.getContext('2d');
  c.scale(k, k);
  const r = alto * 0.22;
  c.fillStyle = VIOLETA;
  c.beginPath();
  c.moveTo(0, alto / 2);
  c.lineTo(punta, 0);
  c.lineTo(ancho - r, 0);
  c.arcTo(ancho, 0, ancho, r, r);
  c.lineTo(ancho, alto - r);
  c.arcTo(ancho, alto, ancho - r, alto, r);
  c.lineTo(punta, alto);
  c.closePath();
  c.fill();
  c.globalCompositeOperation = 'destination-out';
  c.beginPath();
  c.arc(punta * 0.62, alto / 2, alto * 0.11, 0, Math.PI * 2);
  c.fill();
  c.globalCompositeOperation = 'source-over';
  c.fillStyle = '#ffffff';
  c.font = `900 ${Math.round(alto * 0.5)}px ${FUENTE}`;
  c.textBaseline = 'middle';
  if ('letterSpacing' in c) c.letterSpacing = `${alto * 0.06}px`;
  c.fillText(texto, punta + alto * 0.35, alto / 2 + alto * 0.03);

  ctx.drawImage(capa, 0, -alto / 2, ancho, alto);
  ctx.restore();
};

/* ── Sello Walá + marca ── */

/** Pinta `mascara` (su alfa) con `relleno`, en una capa del tamaño dado. */
const pintadoPorMascara = (mascara, w, h, relleno) => {
  const capa = document.createElement('canvas');
  capa.width = Math.ceil(w);
  capa.height = Math.ceil(h);
  const c = capa.getContext('2d');
  c.fillStyle = typeof relleno === 'function' ? relleno(c) : relleno;
  c.fillRect(0, 0, w, h);
  c.globalCompositeOperation = 'destination-in';
  c.drawImage(mascara, 0, 0, w, h);
  return capa;
};

/** El logo de la cabecera: degradado violeta con la W de la etiqueta blanca. */
const pintarLogoWala = (ctx, logo, huecos, x, y, alto) => {
  const w = (alto * 431) / 168;
  ctx.drawImage(pintadoPorMascara(logo, w, alto, (c) => {
    const g = c.createLinearGradient(0, 0, w, alto);
    g.addColorStop(0, '#8b5cf6');
    g.addColorStop(0.5, '#6d28d9');
    g.addColorStop(1, '#5b21b6');
    return g;
  }), x, y, w, alto);
  if (huecos) ctx.drawImage(pintadoPorMascara(huecos, w, alto, '#ffffff'), x, y, w, alto);
  return w;
};

const esWala = (marca) => !marca || /^wal[aá]\+?$/i.test(String(marca.name || '').trim());

/**
 * El sello de abajo a la izquierda (la esquina que la ficha deja libre: arriba
 * a la izquierda va el nombre del color, abajo al centro los puntos y abajo a
 * la derecha "Pasa el cursor…"): una tarjeta blanca un poco girada (como los
 * stickers de los banners) con el logo de Walá y, separada por una raya, la
 * marca (su logo o, si no tiene, su nombre en la letra del logo).
 */
const pintarSello = (ctx, { logo, huecos, logoMarca, marca }) => {
  const altoLogo = 116;
  const relleno = 50;
  const anchoWala = logo ? (altoLogo * 431) / 168 : 0;
  const conMarca = !esWala(marca);

  let anchoMarca = 0;
  let altoMarca = 0;
  if (conMarca && logoMarca) {
    const { w, h } = lado(logoMarca);
    const k = Math.min(330 / w, 132 / h);
    anchoMarca = w * k;
    altoMarca = h * k;
  } else if (conMarca) {
    ctx.font = `900 68px ${FUENTE}`;
    anchoMarca = Math.min(ctx.measureText(String(marca.name).toUpperCase()).width, 540);
    altoMarca = 68;
  }
  const separacion = conMarca ? 80 : 0;
  const ancho = relleno * 2 + anchoWala + separacion + anchoMarca;
  const alto = relleno * 2 + Math.max(altoLogo * 1.1, altoMarca);
  if (!logo && !conMarca) return;

  ctx.save();
  ctx.translate(90 + ancho / 2, ALTO - 90 - alto / 2);
  ctx.rotate((-3 * Math.PI) / 180);
  const x = -ancho / 2;
  const y = -alto / 2;
  ctx.save();
  ctx.shadowColor = 'rgba(20, 18, 28, 0.25)';
  ctx.shadowBlur = 50;
  ctx.shadowOffsetY = 20;
  ctx.fillStyle = '#ffffff';
  redondeado(ctx, x, y, ancho, alto, 42);
  ctx.fill();
  ctx.restore();

  let cursor = x + relleno;
  if (logo) cursor += pintarLogoWala(ctx, logo, huecos, cursor, -altoLogo / 2 - 4, altoLogo);
  if (conMarca) {
    // La raya de "Walá × marca", con el degradado del logo.
    const g = ctx.createLinearGradient(0, -alto / 2, 0, alto / 2);
    g.addColorStop(0, '#a855f7');
    g.addColorStop(1, '#5b21b6');
    ctx.fillStyle = g;
    redondeado(ctx, cursor + separacion / 2 - 4, -alto * 0.28, 8, alto * 0.56, 4);
    ctx.fill();
    cursor += separacion;
    if (logoMarca) {
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(logoMarca, cursor, -altoMarca / 2, anchoMarca, altoMarca);
    } else {
      ctx.fillStyle = '#1f1b2e';
      ctx.font = `900 68px ${FUENTE}`;
      ctx.textBaseline = 'middle';
      ctx.fillText(String(marca.name).toUpperCase(), cursor, 4, anchoMarca);
    }
  }
  ctx.restore();
};

/**
 * Compone la imagen frente + espalda.
 *  - principal / segunda: { url, recorte? } (recorte = encuadre en porcentajes);
 *    la principal va a la izquierda y la segunda a la derecha
 *  - etiquetas: [de la principal, de la segunda]; null = sin etiqueta. Por
 *    defecto FRENTE y ESPALDA; al revés si la principal es la espalda.
 *  - marca: el doc de tienda_brands, o null (sello solo de Walá)
 *  - fondo: el de la marca (fondoDeMarca), o null para el de Walá
 * Devuelve un Blob PNG de 2000 × 2000.
 */
export const componerFrenteEspalda = async ({ principal, segunda, etiquetas = ['FRENTE', 'ESPALDA'], marca = null, fondo = null }) => {
  const [fotoPrincipal, fotoSegunda, logo, huecos, logoMarca, fondoMarca] = await Promise.all([
    cargar(principal.url).catch(() => { throw new Error('No se pudo leer la imagen principal. Si es un enlace externo, súbela como archivo.'); }),
    cargar(segunda.url).catch(() => { throw new Error('No se pudo leer la segunda imagen. Si es un enlace externo, súbela como archivo.'); }),
    cargarOpcional(LOGO),
    cargarOpcional(LOGO_HUECOS),
    esWala(marca) ? null : cargarOpcional(marca?.logoUrl),
    cargarOpcional(fondo?.imagen),
    document.fonts?.load(`900 52px ${FUENTE}`).catch(() => null),
  ]);

  const canvas = document.createElement('canvas');
  canvas.width = ANCHO;
  canvas.height = ALTO;
  const ctx = canvas.getContext('2d');
  pintarFondo(ctx, fondo, fondoMarca);

  // La principal a la izquierda y la segunda a la derecha, un poco giradas
  // hacia afuera y a distinta altura; bajo ellas queda sitio para el sello.
  pintarTarjeta(ctx, fotoSegunda, segunda.recorte, 1450, 900, 4, etiquetas[1]);
  pintarTarjeta(ctx, fotoPrincipal, principal.recorte, 550, 960, -4, etiquetas[0]);
  pintarSello(ctx, { logo, huecos, logoMarca, marca });

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('El navegador no pudo crear la imagen.');
  return blob;
};
