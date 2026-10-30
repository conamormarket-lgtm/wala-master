/**
 * Dibujo de un diseño de Crear en el servidor, para la app (fase del estudio, opción B de wala-mobile/docs/CREAR.md):
 * el mismo código de fabric 5.5.2 que usa la web (src/pages/Crear/renderDiseno.js, generarArchivosCreacion.js y la
 * parte de prendaBase.js que hace falta), con node-canvas en lugar del navegador. Lo que cambia frente a la web es
 * solo la entrada y salida: cómo se cargan las imágenes y las letras, y que devuelve Buffers en vez de Blobs.
 * Si cambia el dibujo en la web, hay que traerlo aquí igual.
 */
const path = require('node:path');
const fs = require('node:fs');
const { createCanvas, loadImage, registerFont } = require('canvas');

const UNIDADES_ZONA = 1000;
const LADO_IMPRESION = 3600;
const DPI_IMPRESION = 300;
const AREA_MAXIMA = 16000000;

// ── Letras: los mismos archivos que la web (FUENTES), registrados una vez ──
// fonts/manifest.json: [{ familia, archivo, peso: 'normal'|'bold', estilo: 'normal'|'italic' }]
const DIR_FUENTES = path.join(__dirname, 'fonts');
let fuentesRegistradas = false;
const familiasDisponibles = new Set();
function registrarFuentes() {
  if (fuentesRegistradas) return;
  fuentesRegistradas = true;
  const manifiesto = path.join(DIR_FUENTES, 'manifest.json');
  if (!fs.existsSync(manifiesto)) return;
  for (const f of JSON.parse(fs.readFileSync(manifiesto, 'utf8'))) {
    const archivo = path.join(DIR_FUENTES, f.archivo);
    if (!fs.existsSync(archivo)) continue;
    registerFont(archivo, { family: f.familia, weight: f.peso || 'normal', style: f.estilo || 'normal' });
    familiasDisponibles.add(f.familia);
  }
}

// node-canvas solo usa las letras registradas antes de crear el primer lienzo (fabric crea uno al cargarse).
registrarFuentes();
const { fabric } = require('fabric');

// Letras cuyo archivo ya es grueso o inclinado: se mide al empezar y, si no tienen variante, la negrita se dibuja
// con un trazo y la cursiva con una inclinación (sinVariante de la web).
const sinVariante = new Map();
const firmaTexto = (font) => {
  const c = createCanvas(400, 80);
  const ctx = c.getContext('2d');
  ctx.font = font;
  ctx.fillText('HaWo gl', 8, 60);
  const d = ctx.getImageData(0, 0, c.width, c.height).data;
  let s = 0;
  for (let i = 3; i < d.length; i += 4) s = (s * 31 + d[i]) % 1000000007;
  return s;
};
const medirVariantes = (familia) => {
  if (sinVariante.has(familia)) return;
  try {
    const normal = firmaTexto(`normal 400 48px "${familia}"`);
    sinVariante.set(familia, {
      negrita: normal === firmaTexto(`normal 700 48px "${familia}"`),
      cursiva: normal === firmaTexto(`italic 400 48px "${familia}"`),
    });
  } catch {
    sinVariante.set(familia, {});
  }
};

// ── prendaBase.js (lo necesario) ───────────────────────────────────────────
const num = (v, def) => { const n = typeof v === 'number' ? v : parseFloat(v); return Number.isFinite(n) ? n : def; };
const limitar = (v, min, max) => Math.min(max, Math.max(min, v));
const esHex = (v) => /^#[0-9a-f]{6}$/i.test(v || '');

const normalizarZona = (zona, i = 0) => {
  const deCm = num(zona?.anchoCm, 0) > 0 && num(zona?.altoCm, 0) > 0 ? num(zona.altoCm, 1) / num(zona.anchoCm, 1) : 1;
  return {
    id: String(zona?.id || `zona-${i + 1}`), nombre: String(zona?.nombre || `Zona ${i + 1}`),
    x: limitar(num(zona?.x, 0.3), -0.5, 1), y: limitar(num(zona?.y, 0.3), -0.5, 1), w: limitar(num(zona?.w, 0.4), 0.02, 1),
    proporcion: limitar(num(zona?.proporcion, deCm), 0.05, 20), angulo: limitar(num(zona?.angulo, 0), -180, 180),
    ...(num(zona?.radio, 0) > 0 && { radio: limitar(num(zona.radio, 0), 0, 0.5) }),
  };
};
const normalizarReferencia = (ref) => (!ref || typeof ref !== 'object' ? null : {
  x1: limitar(num(ref.x1, 0.25), 0, 1), y1: limitar(num(ref.y1, 0.4), 0, 1),
  x2: limitar(num(ref.x2, 0.75), 0, 1), y2: limitar(num(ref.y2, 0.4), 0, 1), cm: Math.max(0, num(ref.cm, 0)),
});
const leerZonasBicolor = (crudo, zonas) => {
  if (Array.isArray(crudo)) return crudo.length ? crudo.map(normalizarZona) : null;
  if (!crudo || typeof crudo !== 'object') return null;
  const movidas = zonas.filter((z) => crudo[z.id]);
  if (!movidas.length) return null;
  return zonas.map((z) => { const p = crudo[z.id]; return p ? normalizarZona({ ...z, x: p.x, y: p.y }) : z; });
};
const normalizarVista = (vista, i = 0) => {
  const id = String(vista?.id || `vista-${i + 1}`);
  const nombre = String(vista?.nombre || `Vista ${i + 1}`);
  const zonas = Array.isArray(vista?.zonas) && vista.zonas.length ? vista.zonas.map(normalizarZona)
    : vista?.zona ? [normalizarZona({ ...vista.zona, id, nombre })] : [];
  const referencia = normalizarReferencia(vista?.referencia);
  const anchoImg = num(vista?.anchoImg, 0);
  const altoImg = num(vista?.altoImg, 0);
  const zonasBicolor = leerZonasBicolor(vista?.zonasBicolor, zonas);
  return {
    id, nombre, imagen: String(vista?.imagen || ''), ...(vista?.encima && { encima: String(vista.encima) }), zonas,
    ...(referencia && { referencia }), ...(anchoImg > 0 && altoImg > 0 && { anchoImg, altoImg }), ...(zonasBicolor && { zonasBicolor }),
  };
};
const leerZonasDeColor = (crudo) => {
  if (!crudo || typeof crudo !== 'object') return null;
  const out = {};
  Object.entries(crudo).forEach(([vistaId, zonas]) => { if (Array.isArray(zonas) && zonas.length) out[vistaId] = zonas.map(normalizarZona); });
  return Object.keys(out).length ? out : null;
};
const limpiarFotos = (fotos) => {
  const out = {};
  Object.entries(fotos || {}).forEach(([vistaId, url]) => { if (typeof url === 'string' && url.trim()) out[vistaId] = url.trim(); });
  return out;
};

/** Lo que hace falta de leerPrendaBase: vistas, el color elegido (con fotos, zonas y espejo), tipo y técnica. */
function leerPrenda(producto, colorId) {
  const cfg = producto?.prendaBase || {};
  const vistas = (Array.isArray(cfg.vistas) ? cfg.vistas : []).map(normalizarVista);
  const extra = cfg.colores && !Array.isArray(cfg.colores) ? cfg.colores : {};
  const variantes = (Array.isArray(producto?.variants) ? producto.variants : []).filter((v) => v && String(v.name || '').trim());
  const colores = variantes.map((v) => ({
    id: String(v.id), nombre: String(v.name).trim(), hex: esHex(v.colorHex) ? v.colorHex.toUpperCase() : '#FFFFFF',
    hex2: esHex(extra[v.id]?.hex2) ? extra[v.id].hex2.toUpperCase() : '', fotos: limpiarFotos(extra[v.id]?.fotos),
    ...(leerZonasDeColor(extra[v.id]?.zonas) && { zonas: leerZonasDeColor(extra[v.id]?.zonas) }),
    ...(extra[v.id]?.espejoDe ? { espejoDe: String(extra[v.id].espejoDe) } : {}),
  }));
  let color = colores.find((c) => c.id === String(colorId)) || null;
  if (color?.espejoDe) {
    const original = colores.find((o) => o.id === color.espejoDe && !o.espejoDe);
    color = original ? { ...color, espejo: true, hex2: color.hex2 || original.hex, fotos: original.fotos, ...(original.zonas ? { zonas: original.zonas } : {}) } : color;
  }
  const zonasDeVista = (v) => (color?.zonas?.[v.id]?.length ? color.zonas[v.id] : color?.hex2 && v.zonasBicolor?.length ? v.zonasBicolor : v.zonas);
  return {
    vistas: vistas.map((v) => ({ ...v, zonas: zonasDeVista(v) })), color,
    tipo: cfg.tipo === 'producto' ? 'producto' : 'prenda', tecnica: cfg.tecnica === 'laser' ? 'laser' : 'impresion',
  };
}

const pxPorCm = (vista) => {
  const ref = vista?.referencia;
  if (!ref || !(ref.cm > 0) || !vista.anchoImg || !vista.altoImg) return 0;
  const largo = Math.hypot((ref.x2 - ref.x1) * vista.anchoImg, (ref.y2 - ref.y1) * vista.altoImg);
  return largo > 0 ? largo / ref.cm : 0;
};
const redondear = (n) => Math.round(n * 10) / 10;
const medidaZona = (zona, vista) => {
  const p = pxPorCm(vista);
  if (!p) return null;
  const anchoCm = (zona.w * vista.anchoImg) / p;
  return { anchoCm: redondear(anchoCm), altoCm: redondear(anchoCm * zona.proporcion) };
};
const altoZonaFraccion = (zona, anchoImg, altoImg) => (!anchoImg || !altoImg ? zona.w : (zona.w * anchoImg * zona.proporcion) / altoImg);
const pixelesDeImpresion = (zona, medida = null) => {
  let ancho; let alto;
  if (medida?.anchoCm > 0 && medida?.altoCm > 0) { ancho = (medida.anchoCm / 2.54) * DPI_IMPRESION; alto = (medida.altoCm / 2.54) * DPI_IMPRESION; }
  else if (zona.proporcion >= 1) { ancho = LADO_IMPRESION / zona.proporcion; alto = LADO_IMPRESION; }
  else { ancho = LADO_IMPRESION; alto = LADO_IMPRESION * zona.proporcion; }
  const reduccion = Math.min(1, Math.sqrt(AREA_MAXIMA / (ancho * alto)));
  return { ancho: Math.round(ancho * reduccion), alto: Math.round(alto * reduccion) };
};
const hexARgb = (hex) => { const h = String(hex || '#FFFFFF').replace('#', ''); return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) || 0); };
const esColorBlanco = (hex) => { const [r, g, b] = hexARgb(hex); return (r + g + b) / 3 / 255 > 0.94; };
const fotoDeVista = (vista, color) => color?.fotos?.[vista.id] || vista.imagen;

/** tintarImagen: la foto blanca del color pedido, conservando pliegues (mismo cálculo que la web). */
function tintarImagen(img, hex) {
  const ancho = img.naturalWidth || img.width;
  const alto = img.naturalHeight || img.height;
  const canvas = createCanvas(ancho, alto);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, ancho, alto);
  if (esColorBlanco(hex)) return canvas;
  const datos = ctx.getImageData(0, 0, ancho, alto);
  const d = datos.data;
  let suma = 0; let cuenta = 0;
  for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 128) { suma += (d[i] + d[i + 1] + d[i + 2]) / 3; cuenta += 1; }
  const media = cuenta ? suma / cuenta : 230;
  const [r, g, b] = hexARgb(hex);
  const oscuridad = 1 - (r + g + b) / 3 / 255;
  const realce = oscuridad * 1.4;
  const base = oscuridad * 8;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue;
    const luz = (d[i] + d[i + 1] + d[i + 2]) / 3;
    const factor = luz / media;
    const extraLuz = realce * (luz - media) + base;
    d[i] = limitar(r * factor + extraLuz, 0, 255);
    d[i + 1] = limitar(g * factor + extraLuz, 0, 255);
    d[i + 2] = limitar(b * factor + extraLuz, 0, 255);
  }
  ctx.putImageData(datos, 0, 0);
  return canvas;
}
function voltearImagen(img) {
  const ancho = img.naturalWidth || img.width;
  const alto = img.naturalHeight || img.height;
  const canvas = createCanvas(ancho, alto);
  const ctx = canvas.getContext('2d');
  ctx.translate(ancho, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(img, 0, 0, ancho, alto);
  return canvas;
}
const fondoDeVista = (img, vista, color) => (!color?.fotos?.[vista.id] ? tintarImagen(img, color?.hex) : color?.espejo ? voltearImagen(img) : img);

// ── laser.mjs ──────────────────────────────────────────────────────────────
const grisDe = (hex) => {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || '').trim());
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const y = Math.round(0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255));
  const h = y.toString(16).padStart(2, '0').toUpperCase();
  return `#${h}${h}${h}`;
};
const textoEnGrises = (capa) => ({
  ...capa, ...(capa.color && { color: grisDe(capa.color) }),
  ...(capa.contornoColor && { contornoColor: grisDe(capa.contornoColor) }), ...(capa.sombraColor && { sombraColor: grisDe(capa.sombraColor) }),
});
function enGrises(img) {
  const canvas = createCanvas(img.naturalWidth || img.width, img.naturalHeight || img.height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);
  const datos = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = datos.data;
  for (let i = 0; i < d.length; i += 4) { const y = Math.round(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]); d[i] = y; d[i + 1] = y; d[i + 2] = y; }
  ctx.putImageData(datos, 0, 0);
  return canvas;
}

// ── renderDiseno.js ────────────────────────────────────────────────────────
const altoEnUnidades = (zona) => UNIDADES_ZONA * zona.proporcion;
const transformDeZona = (zona, { ox, oy, iw, ih, anchoImg, altoImg }) => {
  const zw = zona.w * iw;
  const zh = altoZonaFraccion(zona, anchoImg, altoImg) * ih;
  return { k: zw / UNIDADES_ZONA, cx: ox + zona.x * iw + zw / 2, cy: oy + zona.y * ih + zh / 2, ang: zona.angulo || 0,
    wu: UNIDADES_ZONA, hu: altoEnUnidades(zona), zw, zh, r: (zona.radio || 0) * zw };
};
const rad = (grados) => (grados * Math.PI) / 180;
const aLienzo = (t, left, top) => {
  const dx = (left - t.wu / 2) * t.k; const dy = (top - t.hu / 2) * t.k; const a = rad(t.ang);
  return { x: t.cx + dx * Math.cos(a) - dy * Math.sin(a), y: t.cy + dx * Math.sin(a) + dy * Math.cos(a) };
};
const rectDeZona = (t, extra = {}) => new fabric.Rect({
  left: t.cx, top: t.cy, width: t.zw, ...(t.r > 0 && { rx: t.r, ry: t.r }), height: t.zh, angle: t.ang, originX: 'center', originY: 'center', ...extra,
});
const recorteDeZona = (t) => rectDeZona(t, { absolutePositioned: true });
const recorteDeCapa = (capa, t) => {
  const v = capa?.ventana;
  if (!v) return recorteDeZona(t);
  const centro = aLienzo(t, v.x + v.w / 2, v.y + v.h / 2);
  return new fabric.Rect({
    left: centro.x, top: centro.y, width: v.w * t.k, height: v.h * t.k, angle: t.ang, originX: 'center', originY: 'center',
    absolutePositioned: true, ...(t.r > 0 && { clipPath: recorteDeZona(t) }),
  });
};
const propiedadesTexto = (capa) => {
  const tamano = capa.tamano || 90;
  const curvo = Boolean(Number(capa.curva));
  const texto = capa.text?.length ? capa.text : ' ';
  const contorno = Number(capa.contorno) || 0;
  const sombra = Number(capa.sombra) || 0;
  const fuente = familiasDisponibles.has(capa.fuente) ? capa.fuente : 'Montserrat';
  const color = capa.color || '#111111';
  medirVariantes(fuente);
  const falta = sinVariante.get(fuente) || {};
  const negritaFalsa = capa.negrita && falta.negrita ? tamano * 0.04 : 0;
  return {
    text: curvo ? texto.replace(/\s*\n\s*/g, ' ') : texto, fontFamily: fuente,
    fill: contorno > 0 && capa.sinRelleno ? 'rgba(0,0,0,0)' : color, fontSize: tamano,
    fontWeight: capa.negrita ? 'bold' : 'normal', fontStyle: capa.cursiva ? 'italic' : 'normal',
    textAlign: curvo ? 'center' : (capa.alineacion || 'center'), lineHeight: Number(capa.interlineado) || 1.05,
    charSpacing: Number(capa.espaciado) || 0,
    stroke: contorno > 0 ? (capa.contornoColor || '#FFFFFF') : negritaFalsa ? color : null,
    strokeWidth: (contorno > 0 ? (tamano * contorno * 2) / 100 : 0) + negritaFalsa,
    negritaFalsa, skewX: capa.cursiva && falta.cursiva ? -12 : 0, paintFirst: 'stroke', strokeLineJoin: 'round',
    shadow: sombra > 0 ? new fabric.Shadow({ color: capa.sombraColor || '#111111', blur: 0, offsetX: (tamano * sombra) / 100,
      offsetY: (tamano * sombra) / 100, affectStroke: true }) : null,
  };
};
function pintarTextoConContorno(ctx) {
  if (this.stroke && this.strokeWidth > 0) {
    this._renderTextStroke(ctx);
    this._removeShadow(ctx);
    if (this.negritaFalsa > 0 && this.stroke !== this.fill) {
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
const curvarTexto = (obj, curva) => {
  const c = Math.max(-100, Math.min(100, Number(curva) || 0));
  obj.set({ path: null, pathAlign: 'center', pathStartOffset: 0 });
  if (!c) return obj;
  const largo = Math.max(1, obj.calcTextWidth()) * 1.04 + obj.fontSize * 0.1;
  const espacioFinal = (obj.fontSize * (Number(obj.charSpacing) || 0)) / 1000;
  const angulo = (Math.abs(c) / 100) * LIMITE_CURVA;
  const r = largo / angulo;
  const x = Math.sin(angulo / 2) * r;
  const y = Math.cos(angulo / 2) * r;
  const grande = angulo > Math.PI ? 1 : 0;
  const d = c > 0 ? `M ${-x} ${-y} A ${r} ${r} 0 ${grande} 1 ${x} ${-y}` : `M ${-x} ${y} A ${r} ${r} 0 ${grande} 0 ${x} ${y}`;
  obj.set({ path: new fabric.Path(d, { visible: false }), pathStartOffset: espacioFinal / 2 });
  return obj;
};
const ubicacion = (capa, t) => {
  const p = aLienzo(t, capa.left || 0, capa.top || 0);
  return { originX: 'center', originY: 'center', left: p.x, top: p.y, scaleX: (capa.escalaX || 1) * t.k, scaleY: (capa.escalaY || 1) * t.k,
    angle: (capa.angulo || 0) + t.ang, flipX: !!capa.flipX };
};
/** crearObjeto: `imagenDe(capa)` da la imagen ya cargada (y en gris si es láser). */
const crearObjeto = (capa, t, imagenDe, { laser = false } = {}) => {
  const comun = ubicacion(capa, t);
  if (capa.type === 'image') {
    const img = imagenDe(capa);
    return new fabric.Image(laser ? enGrises(img) : img, comun);
  }
  const props = { ...comun, ...propiedadesTexto(laser ? textoEnGrises(capa) : capa) };
  const texto = new fabric.Text(props.text, props);
  texto._renderText = pintarTextoConContorno;
  return curvarTexto(texto, capa.curva);
};
const lienzo = (ancho, alto, extra = {}) => new fabric.StaticCanvas(null, { width: ancho, height: alto, enableRetinaScaling: false, renderOnAddRemove: false, ...extra });
const exportar = (canvas, tipo, calidad) => fabric.util.getNodeCanvas(canvas.lowerCanvasEl).toBuffer(tipo, tipo === 'image/jpeg' ? { quality: calidad } : undefined);

/** renderizarImpresion: PNG transparente de la zona, derecho, a tamaño real si hay medida. */
function renderizarImpresion(capas, zona, imagenDe, medida = null, { laser = false } = {}) {
  const { ancho, alto } = pixelesDeImpresion(zona, medida);
  const c = lienzo(ancho, alto);
  try {
    const t = { k: ancho / UNIDADES_ZONA, cx: ancho / 2, cy: alto / 2, ang: 0, wu: UNIDADES_ZONA, hu: altoEnUnidades(zona) };
    for (const capa of capas) {
      const obj = crearObjeto(capa, t, imagenDe, { laser });
      if (capa.ventana) obj.clipPath = recorteDeCapa(capa, t);
      c.add(obj);
    }
    c.renderAll();
    return { buffer: exportar(c, 'image/png'), ancho, alto };
  } finally {
    c.dispose();
  }
}

/** renderizarVistaPrevia: la prenda teñida con el diseño de sus zonas, 900 px, fondo lila (blanco 4:5 en productos). */
function renderizarVistaPrevia({ fuente, anchoImg, altoImg, vista, capasPorZona, imagenDe, encima = null, ancho = 900, laser = false, producto = false }) {
  const margen = Math.round(ancho * 0.06);
  const iw = ancho - margen * 2;
  const ih = altoImg * (iw / anchoImg);
  const alto = producto ? Math.max(Math.round(ih + margen * 2), Math.round(ancho * 1.25)) : Math.round(ih + margen * 2);
  const oy = Math.round((alto - ih) / 2);
  const c = lienzo(ancho, alto, { backgroundColor: producto ? '#FFFFFF' : '#F3F1F7' });
  try {
    c.add(new fabric.Image(fuente, { left: margen, top: oy, scaleX: iw / anchoImg, scaleY: ih / altoImg }));
    for (const zona of vista.zonas) {
      const capas = capasPorZona[zona.id] || [];
      if (!capas.length) continue;
      const t = transformDeZona(zona, { ox: margen, oy, iw, ih, anchoImg, altoImg });
      for (const capa of capas) {
        const obj = crearObjeto(capa, t, imagenDe, { laser });
        obj.clipPath = recorteDeCapa(capa, t);
        c.add(obj);
      }
    }
    if (encima) c.add(new fabric.Image(encima, { left: margen, top: oy, scaleX: iw / encima.width, scaleY: ih / encima.height }));
    c.renderAll();
    return exportar(c, 'image/jpeg', 0.88);
  } finally {
    c.dispose();
  }
}

/** componerVistas: los lados uno al lado del otro con su nombre, el título y "Creado en wala.pe". */
async function componerVistas(piezas, { titulo = '', fondo = '#F3F1F7', logo = null } = {}) {
  const cargadas = await Promise.all(piezas.map(async (p) => ({ ...p, img: await loadImage(p.buffer) })));
  const margen = 40; const separacion = 24; const cabecera = titulo ? 120 : 76; const tamLogo = 76;
  const pie = logo ? tamLogo + 32 : 0;
  const altoPieza = Math.max(...cargadas.map((p) => p.img.height));
  const ancho = cargadas.reduce((acc, p) => acc + p.img.width, 0) + separacion * (cargadas.length - 1) + margen * 2;
  const alto = altoPieza + cabecera + margen + pie;
  const canvas = createCanvas(ancho, alto);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = fondo;
  ctx.fillRect(0, 0, ancho, alto);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (titulo) { ctx.fillStyle = '#1F1B2E'; ctx.font = '700 40px Montserrat, Arial, sans-serif'; ctx.fillText(titulo, ancho / 2, 52); }
  let x = margen;
  cargadas.forEach((p) => {
    ctx.fillStyle = '#3C3489';
    ctx.font = '700 30px Montserrat, Arial, sans-serif';
    ctx.fillText(p.nombre, x + p.img.width / 2, cabecera - 34);
    ctx.drawImage(p.img, x, cabecera + (altoPieza - p.img.height) / 2);
    x += p.img.width + separacion;
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
  return canvas.toBuffer('image/jpeg', { quality: 0.9 });
}

/**
 * generarArchivosCreacion de la web, sin subir: devuelve los PNG por zona, las vistas previas por lado y la conjunta.
 * `cargar(src)` trae una imagen (Buffer) de una URL de confianza: la de la prenda o un archivo del propio cliente.
 */
/** Lo común a dibujar una creación: la prenda en su color, las imágenes del diseño cargadas una vez y cada lado. */
async function prepararDibujo({ producto, colorId, capas, cargar }) {
  registrarFuentes();
  const { vistas, color, tipo, tecnica } = leerPrenda(producto, colorId);
  if (!color) throw new Error('color');
  const laser = tecnica === 'laser';
  const esProducto = tipo === 'producto';
  // Cada imagen una sola vez (las capas pueden repetirla).
  const imagenes = new Map();
  const traer = async (src) => {
    if (!imagenes.has(src)) imagenes.set(src, loadImage(await cargar(src)));
    return imagenes.get(src);
  };
  for (const lista of Object.values(capas)) for (const capa of lista) if (capa.type === 'image') await traer(capa.src);
  const listas = new Map();
  for (const [src, promesa] of imagenes) listas.set(src, await promesa);
  const imagenDe = (capa) => listas.get(capa.src);
  const renderVista = async (vista, ancho = 900) => {
    const img = await loadImage(await cargar(fotoDeVista(vista, color)));
    const encima = vista.encima ? await loadImage(await cargar(vista.encima)).catch(() => null) : null;
    return renderizarVistaPrevia({ fuente: fondoDeVista(img, vista, color), anchoImg: img.width, altoImg: img.height, vista,
      capasPorZona: capas, imagenDe, encima, laser, producto: esProducto, ancho });
  };
  return { vistas, color, tipo, tecnica, laser, esProducto, imagenDe, renderVista };
}

/**
 * Las miniaturas de un borrador, como las del autoguardado de la web (renderizarVista a 420 px): un JPEG por cada lado
 * con diseño (o el primero si todavía no tiene nada).
 */
async function generarMiniaturas({ producto, colorId, capas, cargar, ancho = 420 }) {
  const { vistas, renderVista } = await prepararDibujo({ producto, colorId, capas, cargar });
  const conDiseno = vistas.filter((vista) => vista.zonas.some((zona) => capas[zona.id]?.length));
  const miniaturas = [];
  for (const vista of conDiseno.length ? conDiseno : vistas.slice(0, 1)) miniaturas.push({ vistaId: vista.id, nombre: vista.nombre, buffer: await renderVista(vista, ancho) });
  return miniaturas;
}

async function generarArchivos({ producto, colorId, capas, cargar }) {
  const { vistas, color, tecnica, laser, esProducto, imagenDe, renderVista } = await prepararDibujo({ producto, colorId, capas, cargar });
  const logoArchivo = path.join(__dirname, 'assets', 'logo-wala-192.png');
  const logo = fs.existsSync(logoArchivo) ? await loadImage(fs.readFileSync(logoArchivo)) : null;
  const impresion = [];
  const previas = [];
  const porVista = new Map();
  for (const vista of vistas) {
    const zonas = vista.zonas.filter((zona) => capas[zona.id]?.length);
    if (!zonas.length) continue;
    for (const zona of zonas) {
      const medida = medidaZona(zona, vista);
      const { buffer, ancho, alto } = renderizarImpresion(capas[zona.id], zona, imagenDe, medida, { laser });
      impresion.push({ buffer, zonaId: zona.id, datos: { vista: zona.id, vistaId: vista.id, nombre: `${vista.nombre} · ${zona.nombre}`, ancho, alto, tecnica,
        ...(medida && { anchoCm: medida.anchoCm, altoCm: medida.altoCm }) } });
    }
    const buffer = await renderVista(vista);
    porVista.set(vista.id, buffer);
    previas.push({ buffer, vistaId: vista.id, datos: { vista: vista.id, nombre: vista.nombre, zonas: zonas.map((z) => z.id) } });
  }
  const lados = [];
  for (const vista of vistas) lados.push({ nombre: vista.nombre, buffer: porVista.get(vista.id) || await renderVista(vista) });
  const conjunta = await componerVistas(lados, { titulo: `${producto.name} · ${color.nombre}`, ...(esProducto && { fondo: '#FFFFFF' }), logo });
  return { impresion, previas, conjunta, color, vistas };
}

module.exports = { generarArchivos, generarMiniaturas, leerPrenda, pixelesDeImpresion, medidaZona, propiedadesTexto, UNIDADES_ZONA, registrarFuentes, familiasDisponibles };
