import { medidasConfirmadas } from '../../utils/yoryoPersonalizacion.mjs';
import { FUENTES_YORYO, ajusteSeccion, esDistribucionEditable, seccionesYoryo, vistaYoryo } from '../../utils/distribucionYoryo.mjs';
import { componerEditableYoryo } from './componerYoryo.mjs';
import { serializarTrazos } from './trazosYoryo.mjs';
import { configurarDisenoYoryo, medidasMockupYoryo } from '../../utils/mockupYoryo.mjs';
import { establecerPppPng } from '../../utils/resolucionPng.mjs';

const escape = (s) => String(s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));
const ETIQUETAS = new Set(['svg', 'g', 'path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon']);
const PRESENTACION = new Set(['fill', 'stroke', 'stroke-width', 'fill-rule', 'clip-rule', 'stroke-linecap', 'stroke-linejoin', 'stroke-miterlimit']);
const ATRIBUTOS = new Set(['d', 'x', 'y', 'width', 'height', 'cx', 'cy', 'r', 'rx', 'ry', 'x1', 'x2', 'y1', 'y2', 'points', 'transform', ...PRESENTACION, 'viewBox', 'xmlns']);
const AUXILIAR = /^(?:id|class|version|role|aria-[\w-]+|data-[\w-]+|xmlns:[\w-]+|(?:inkscape|sodipodi):[\w-]+)$/;

/** SVG geométrico autocontenido. No acepta fotos incrustadas ni texto dependiente de fuentes. */
export function validarVectorSvg(texto) {
  if (texto.length > 1024 * 1024 || /<!DOCTYPE|<!ENTITY/i.test(texto)) throw new Error('El SVG no es válido o pesa más de 1 MB.');
  const doc = new DOMParser().parseFromString(texto, 'image/svg+xml');
  if (doc.getElementsByTagName('parsererror').length || doc.documentElement.localName !== 'svg') throw new Error('No pudimos leer el SVG.');
  // Estos nodos no se dibujan. Un path de defs sin referencias tampoco debe
  // convertirse accidentalmente en parte del escudo al quitar su contenedor.
  for (const el of Array.from(doc.getElementsByTagName('*'))) {
    if (['metadata', 'title', 'desc', 'defs'].includes(el.localName)) el.parentNode?.removeChild(el);
  }
  let formas = 0;
  for (const el of Array.from(doc.getElementsByTagName('*'))) {
    if (el.localName === 'image') throw new Error('Este SVG contiene una imagen incrustada. Para el grabado, usa el escudo formado por trazos vectoriales.');
    if (el.localName === 'text' || el.localName === 'tspan') throw new Error('El SVG contiene texto editable. Convierte sus textos a trazos y vuelve a subirlo.');
    if (!ETIQUETAS.has(el.localName)) throw new Error('Usa un SVG vectorial con textos convertidos a trazos, sin imágenes ni efectos.');
    if (!['svg', 'g'].includes(el.localName)) formas++;
    // Los exportadores guardan rellenos y líneas en style; se convierten a
    // atributos para que el archivo final no dependa de hojas de estilo.
    if (el.hasAttribute('style')) {
      for (const declaracion of el.getAttribute('style').split(';').filter((v) => v.trim())) {
        const separador = declaracion.indexOf(':');
        const propiedad = declaracion.slice(0, separador).trim().toLowerCase();
        if (separador < 0 || !PRESENTACION.has(propiedad)) throw new Error('El SVG contiene estilos o efectos que no sirven para este grabado.');
        el.setAttribute(propiedad, declaracion.slice(separador + 1).trim().replace(/\s*!important\s*$/i, ''));
      }
      el.removeAttribute('style');
    }
    for (const a of Array.from(el.attributes)) {
      if (AUXILIAR.test(a.name)) { el.removeAttribute(a.name); continue; }
      if (!ATRIBUTOS.has(a.name) || /url\s*\(|javascript:|data:|https?:/i.test(a.value) && a.name !== 'xmlns') throw new Error('El SVG contiene referencias o efectos que no sirven para este grabado.');
      if (a.name === 'fill' || a.name === 'stroke') el.setAttribute(a.name, a.value === 'none' ? 'none' : /^(white|#fff|#ffffff)$/i.test(a.value) ? '#FFFFFF' : '#000000');
    }
    if (Array.from(el.childNodes).some((n) => n.nodeType === 3 && n.textContent.trim())) throw new Error('Convierte los textos del SVG a trazos.');
  }
  const raiz = doc.documentElement;
  const caja = (raiz.getAttribute('viewBox') || '').trim().split(/[\s,]+/).map(Number);
  if (caja.length !== 4 || !caja.every(Number.isFinite) || caja[2] <= 0 || caja[3] <= 0 || !formas) throw new Error('El SVG necesita un viewBox válido y trazos visibles.');
  // Al colocar el escudo se retira su svg exterior. Conserva en un grupo el
  // relleno, trazo y transformaciones heredados de esa raíz.
  const limpia = doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
  limpia.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  limpia.setAttribute('viewBox', caja.join(' '));
  const grupo = doc.createElementNS('http://www.w3.org/2000/svg', 'g');
  for (const a of Array.from(raiz.attributes)) if (PRESENTACION.has(a.name) || a.name === 'transform') grupo.setAttribute(a.name, a.value);
  const destino = grupo.attributes.length ? grupo : limpia;
  while (raiz.firstChild) destino.appendChild(raiz.firstChild);
  if (destino === grupo) limpia.appendChild(grupo);
  return { svg: new XMLSerializer().serializeToString(limpia), viewBox: caja };
}

const fuentes = new Map();
export async function cargarFuenteYoryo(estilo = 'Clásica') {
  const archivo = FUENTES_YORYO.find((f) => f.id === estilo)?.archivo || 'segoeui.ttf';
  if (!fuentes.has(archivo)) fuentes.set(archivo, Promise.all([import('opentype.js'), fetch(`/fonts/${encodeURIComponent(archivo)}`).then((r) => { if (!r.ok) throw new Error('No pudimos cargar la fuente del diseño.'); return r.arrayBuffer(); })])
    .then(([mod, bytes]) => (mod.parse || mod.default.parse)(bytes))
    .catch((e) => { fuentes.delete(archivo); throw e; }));
  return fuentes.get(archivo);
}

export async function cargarFuentesYoryo(datos, config) {
  if (!esDistribucionEditable(datos)) return { general: await cargarFuenteYoryo(datos.tipografia) };
  const pares = await Promise.all(seccionesYoryo(datos, config).filter((s) => s.fuente).map(async (s) => [s.id, await cargarFuenteYoryo(ajusteSeccion(datos, s).fuente)]));
  return Object.fromEntries(pares);
}

function textoTrazado(fuente, texto, x, y, tamano, maximo, color = '#000000') {
  if (!texto) return '';
  texto = String(texto).replace(/\s+/g, ' ').trim();
  if ([...texto].some((c) => !fuente.charToGlyph(c).index && !/\s/.test(c))) throw new Error('Uno de los caracteres no está disponible en la fuente del grabado.');
  const ancho = fuente.getAdvanceWidth(texto, tamano);
  const escala = Math.min(1, maximo / Math.max(1, ancho));
  const path = serializarTrazos(fuente.getPath(texto, 0, 0, tamano));
  return `<g transform="translate(${x - ancho * escala / 2} ${y}) scale(${escala})"><path fill="${color}" d="${path}"/></g>`;
}

const foto = (url, x, y, w, h, id) => !url ? `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#DED9D0"/>` : `<defs><clipPath id="${id}"><rect x="${x}" y="${y}" width="${w}" height="${h}"/></clipPath></defs><image href="${escape(url)}" x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid slice" clip-path="url(#${id})"/>`;

/** El mismo arte alimenta la vista previa y el archivo final. Láser: solo trazos. */
function crearArteLegacy({ datos, config, fuente, fotos = [] }) {
  const w = 1000, h = Math.round(w * config.proporcion);
  const t = (s, x, y, size, max = 850, color) => textoTrazado(fuente, s, x, y, size, max, color);
  let contenido = '';
  if (config.tecnica === 'laser') {
    if (datos.vector?.svg && datos.plantilla === 'escudo') {
      const [x, y, vw, vh] = datos.vector.viewBox;
      const k = Math.min(620 / vw, h * 0.43 / vh);
      const interior = datos.vector.svg.replace(/^<svg\b[^>]*>/, '').replace(/<\/svg>\s*$/, '');
      contenido += `<g transform="translate(${500 - vw * k / 2} ${h * 0.08}) scale(${k}) translate(${-x} ${-y})">${interior}</g>`;
    } else {
      contenido += t(datos.equipo || (datos.plantilla === 'iniciales' ? datos.nombre.split(/\s+/).map((p) => p[0]).slice(0, 3).join('') : ''), 500, h * 0.35, datos.plantilla === 'iniciales' ? 230 : 75);
    }
    contenido += t(datos.nombre, 500, h * 0.66, 118);
    const palabras = String(datos.frase || '').split(/\s+/);
    const medio = Math.ceil(palabras.length / 2);
    const lineas = datos.frase?.length > 30 ? [palabras.slice(0, medio).join(' '), palabras.slice(medio).join(' ')] : [datos.frase];
    lineas.forEach((linea, i) => { contenido += t(linea, 500, h * 0.79 + i * 65, 56); });
  } else {
    const equipo = datos.plantilla === 'equipo';
    const fondo = equipo ? (datos.equipo === 'Universitario' ? '#801B22' : '#14294A') : '#F6EFE5';
    const tinta = equipo ? '#FFFFFF' : '#26342B';
    contenido += `<rect width="${w}" height="${h}" fill="${fondo}"/>`;
    if (datos.plantilla === 'collage') {
      contenido += foto(fotos[0], 35, 35, 450, h * 0.35, 'f0') + foto(fotos[1], 35, h * 0.35 + 50, 450, h * 0.35, 'f1') + foto(fotos[2], 505, 35, 460, h * 0.7 + 15, 'f2');
    } else contenido += foto(fotos[0], 35, 35, 930, h * 0.68, 'f0');
    contenido += t(datos.nombre, 500, h * 0.82, 65, 900, tinta);
    contenido += t(datos.fecha || (equipo ? datos.equipo : ''), 500, h * 0.89, 32, 900, tinta);
    contenido += t(datos.frase, 500, h * 0.96, 31, 900, tinta);
  }
  const medidas = config.produccion || {};
  const dimensiones = medidasConfirmadas(medidas) ? ` width="${Number(medidas.anchoMm)}mm" height="${Number(medidas.altoMm)}mm"` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"${dimensiones} viewBox="0 0 ${w} ${h}">${contenido}</svg>`;
}

export const componerArteYoryo = (opciones) => {
  opciones = { ...opciones, config: configurarDisenoYoryo(opciones.config, opciones.datos) };
  return esDistribucionEditable(opciones.datos) ? componerEditableYoryo(opciones)
    : { svg: crearArteLegacy({ ...opciones, fuente: opciones.fuentes?.general || opciones.fuente }), elementos: [] };
};
export const crearArteYoryo = (opciones) => componerArteYoryo(opciones).svg;

export const svgComoUrl = (svg) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
export const svgMetalico = (svg) => svg.replace(/((?:fill|stroke)=")#000000"/g, '$1#DAC9A8"').replace(/((?:fill|stroke)=")#FFFFFF"/g, '$1#171717"').replace(/(<svg\b[^>]*>)/, '$1<g fill="#DAC9A8">').replace('</svg>', '</g></svg>');
export const archivoComoDataUrl = (blob) => new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(r.result); r.onerror = () => reject(new Error('No pudimos abrir la imagen.')); r.readAsDataURL(blob); });

export async function svgComoPng(svg, ancho = 1800, alto) {
  const img = new Image();
  img.src = svgComoUrl(svg);
  await img.decode();
  const canvas = document.createElement('canvas');
  canvas.width = ancho;
  canvas.height = alto || Math.round(ancho * img.naturalHeight / img.naturalWidth);
  canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('No pudimos preparar la imagen.');
  return establecerPppPng(blob);
}

/** Simulación sobre la foto real. Sus coordenadas visuales no son medidas de fabricación. */
export async function vistaProductoYoryo(producto, arte, datos) {
  const config = configurarDisenoYoryo(producto.personalizacionYoryo, datos);
  if (config.tecnica === 'impresion') {
    const dibujo = new Image(); dibujo.src = svgComoUrl(arte); await dibujo.decode();
    const m = medidasMockupYoryo(config), canvas = document.createElement('canvas');
    canvas.width = m.ancho; canvas.height = m.alto;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#F7F8FC'; ctx.fillRect(0, 0, m.ancho, m.alto);
    ctx.shadowColor = '#00000038'; ctx.shadowBlur = 12; ctx.shadowOffsetY = 5;
    ctx.fillStyle = '#202124'; ctx.beginPath(); ctx.roundRect(m.margen, m.margen, m.w + 2 * m.borde, m.h + 2 * m.borde, m.radio); ctx.fill();
    ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
    if (!m.mousepad) {
      ctx.strokeStyle = '#55565A'; ctx.lineWidth = 3; ctx.strokeRect(m.margen + 3, m.margen + 3, m.w + 2 * m.borde - 6, m.h + 2 * m.borde - 6);
      ctx.strokeStyle = '#0B0B0C'; ctx.lineWidth = 4; ctx.strokeRect(m.x - 2, m.y - 2, m.w + 4, m.h + 4);
    }
    ctx.save(); ctx.beginPath(); ctx.roundRect(m.x, m.y, m.w, m.h, Math.max(0, m.radio - m.borde)); ctx.clip();
    ctx.drawImage(dibujo, m.x, m.y, m.w, m.h); ctx.restore();
    if (m.mousepad) { ctx.strokeStyle = '#777'; ctx.lineWidth = 1.5; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.roundRect(m.margen + m.borde / 2, m.margen + m.borde / 2, m.w + m.borde, m.h + m.borde, m.radio - m.borde / 2); ctx.stroke(); }
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', .9));
    if (!blob) throw new Error('No pudimos preparar la vista del producto.');
    return blob;
  }
  const url = producto.variants?.[0]?.imageUrl || producto.mainImage || producto.images?.[0];
  if (!url || !config.vista) return svgComoPng(arte, 1000, Math.round(1000 * config.proporcion));
  const r = await fetch(url);
  if (!r.ok) throw new Error('No pudimos preparar la vista del producto.');
  const fondo = new Image(); fondo.src = await archivoComoDataUrl(await r.blob()); await fondo.decode();
  const dibujo = new Image(); dibujo.src = svgComoUrl(config.tecnica === 'laser' ? svgMetalico(arte) : arte); await dibujo.decode();
  const canvas = document.createElement('canvas');
  canvas.width = 1000; canvas.height = Math.round(1000 * fondo.naturalHeight / fondo.naturalWidth);
  const ctx = canvas.getContext('2d'); ctx.drawImage(fondo, 0, 0, canvas.width, canvas.height);
  const { x, y, w, h } = vistaYoryo(config, datos);
  const zonaW = w * canvas.width, zonaH = h * canvas.height;
  const escala = Math.min(zonaW / dibujo.naturalWidth, zonaH / dibujo.naturalHeight);
  const ancho = dibujo.naturalWidth * escala, alto = dibujo.naturalHeight * escala;
  ctx.drawImage(dibujo, x * canvas.width + (zonaW - ancho) / 2, y * canvas.height + (zonaH - alto) / 2, ancho, alto);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9));
  if (!blob) throw new Error('No pudimos preparar la vista del producto.');
  return blob;
}
