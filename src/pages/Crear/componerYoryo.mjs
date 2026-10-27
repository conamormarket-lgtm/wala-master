import { ajusteSeccion, cajaSeccion, limitar, seccionesYoryo } from '../../utils/distribucionYoryo.mjs';
import { medidasConfirmadas } from '../../utils/yoryoPersonalizacion.mjs';
import { serializarTrazos } from './trazosYoryo.mjs';
import { encajePlantillaYoryo } from '../../utils/plantillasYoryo.mjs';
import { usaCapasYoryo } from '../../utils/capasYoryo.mjs';

const escape = (s) => String(s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));
const textoLimpio = (s) => String(s || '').replace(/[^\S\n]+/g, ' ').trim();

function partir(texto, cantidad, fuente) {
  const palabras = texto.split(/\s+/), lineas = [];
  let quedan = palabras;
  for (let n = cantidad; n > 1 && quedan.length; n--) {
    const meta = fuente.getAdvanceWidth(quedan.join(' '), 100) / n;
    let corte = 1;
    while (corte < quedan.length - n + 1 && Math.abs(fuente.getAdvanceWidth(quedan.slice(0, corte + 1).join(' '), 100) - meta) < Math.abs(fuente.getAdvanceWidth(quedan.slice(0, corte).join(' '), 100) - meta)) corte++;
    lineas.push(quedan.slice(0, corte).join(' ')); quedan = quedan.slice(corte);
  }
  if (quedan.length) lineas.push(quedan.join(' '));
  return lineas;
}

/** Encaja por la tinta real de los glifos, no por el ancho nominal de la fuente. */
const bloques = new WeakMap();
function textoEnCaja(texto, fuente, ancho, alto, multilinea) {
  if (!bloques.has(fuente)) bloques.set(fuente, new Map());
  const cache = bloques.get(fuente), clave = JSON.stringify([texto, ancho, alto, multilinea]);
  if (cache.has(clave)) return cache.get(clave);
  if ([...texto].some((c) => !fuente.charToGlyph(c).index && !/\s/.test(c))) throw new Error('Uno de los caracteres no está disponible en esta letra. Elige otro estilo.');
  const explicitas = texto.includes('\n') ? texto.split('\n') : null;
  const maxLineas = multilinea ? Math.min(3, texto.split(/\s+/).length) : 1;
  const minLineas = multilinea && alto / ancho > .18 && texto.length > 18 ? Math.min(2, maxLineas) : 1;
  const opciones = explicitas ? [explicitas] : Array.from({ length: maxLineas - minLineas + 1 }, (_, i) => partir(texto, i + minLineas, fuente));
  let mejor;
  for (const lineas of opciones) {
    const rutas = lineas.map((linea) => {
      const path = fuente.getPath(linea, 0, 0, 100);
      const d = serializarTrazos(path);
      return { d, caja: path.getBoundingBox() };
    });
    const w = Math.max(1, ...rutas.map((p) => p.caja.x2 - p.caja.x1));
    const altura = Math.max(1, ...rutas.map((p) => p.caja.y2 - p.caja.y1));
    const h = altura * rutas.length + 16 * (rutas.length - 1);
    const escala = Math.min(ancho / w, alto / h);
    // Ante tamaños casi iguales, conserva menos saltos de línea.
    if (!mejor || escala > mejor.escala * 1.04) mejor = { rutas, w, h, altura, escala };
  }
  if (cache.size >= 64) cache.delete(cache.keys().next().value);
  cache.set(clave, mejor);
  return mejor;
}

const foto = (url, x, y, w, h, id, encaje) => !url ? `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#DED9D0"/>` : `<defs><clipPath id="${id}"><rect x="${x}" y="${y}" width="${w}" height="${h}"/></clipPath></defs><image href="${escape(url)}" x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="${encaje === 'completa' ? 'xMidYMid meet' : 'xMidYMid slice'}" clip-path="url(#${id})"/>`;

export function componerEditableYoryo({ datos, config, fuente, fuentes = {}, fotos = [], plantilla = {} }) {
  const w = 1000, h = datos.formatoPlantilla >= 3 ? w * config.proporcion : Math.round(w * config.proporcion);
  const capas = usaCapasYoryo(datos);
  const laser = config.tecnica === 'laser';
  const equipo = datos.plantilla === 'equipo';
  const tinta = !laser && equipo ? '#FFFFFF' : laser ? '#000000' : '#26342B';
  const fondo = laser ? '' : equipo ? datos.equipo === 'Universitario' ? '#801B22' : '#14294A' : datos.formatoPlantilla >= 2 && datos.plantillaVisual === 'dorado' ? '#171717' : '#F6EFE5';
  let contenido = fondo ? `<rect width="${w}" height="${h}" fill="${fondo}"/>` : '';
  const encaje = datos.formatoPlantilla >= 2 ? encajePlantillaYoryo(datos, config).preserveAspectRatio : 'none';
  const imagenCompleta = (url, ajuste = encaje) => url ? `<image href="${escape(url)}" width="${w}" height="${h}" preserveAspectRatio="${ajuste}"/>` : '';
  if (!capas) contenido += imagenCompleta(plantilla.fondo, datos.formatoPlantilla >= 2 ? 'xMidYMid slice' : encaje);
  const baseSvg = contenido, superposicionSvg = imagenCompleta(plantilla.superposicion);
  let decoracionPendiente = superposicionSvg;
  const elementos = [];
  const registrar = (seccion, caja, svg) => {
    contenido += `<g data-yoryo-elemento="${seccion.id}" transform="translate(${caja.x * w} ${caja.y * h})">${svg}</g>`;
    elementos.push({ id: seccion.id, nombre: seccion.nombre, orden: seccion.orden ?? 3, margen: seccion.margen ?? .02, ...caja, fragmento: svg, anchoSvg: caja.w * w, altoSvg: caja.h * h });
  };
  const secciones = seccionesYoryo(datos, config).map((s) => ajusteSeccion(datos, s)).sort((a, b) => (a.orden ?? 3) - (b.orden ?? 3));
  for (const seccion of secciones) {
    if (seccion.indiceFoto === undefined && decoracionPendiente) { contenido += decoracionPendiente; decoracionPendiente = ''; }
    const a = ajusteSeccion(datos, seccion);
    const margen = a.margen ?? .02, limite = 1 - 2 * margen;
    const factor = margen === 0 ? Math.min(a.escala / 100, limite / a.w, limite / a.h) : a.escala / 100;
    const maxW = limitar(a.w * factor, .01, limite), maxH = limitar(a.h * factor, .01, limite);
    if (a.recurso) {
      const r = plantilla.capas?.[a.recurso];
      if (!r?.url) continue;
      const [rw, rh] = r.size;
      const [vx, vy, vw, vh] = a.recurso === 'fondo' ? [0, 0, 1, 1] : r.visible || [0, 0, 1, 1];
      const escala = Math.min(maxW * w / (rw * vw), maxH * h / (rh * vh));
      const caja = a.encaje === 'cubrir' ? cajaSeccion(a, maxW, maxH, margen) : cajaSeccion(a, rw * vw * escala / w, rh * vh * escala / h, margen);
      const ancho = caja.w * w, alto = caja.h * h;
      const svg = a.encaje === 'cubrir'
        ? `<image href="${escape(r.url)}" width="${ancho}" height="${alto}" preserveAspectRatio="xMidYMid slice"/>`
        : `<svg width="${ancho}" height="${alto}" viewBox="${vx * rw} ${vy * rh} ${vw * rw} ${vh * rh}" preserveAspectRatio="xMidYMid meet"><image href="${escape(r.url)}" width="${rw}" height="${rh}"/></svg>`;
      registrar(a, caja, svg); continue;
    }
    if (a.id === 'foto' || a.indiceFoto !== undefined) {
      const caja = cajaSeccion(a, maxW, maxH, margen), x = 0, y = 0, ancho = caja.w * w, alto = caja.h * h;
      const separacion = 12;
      const svg = a.indiceFoto !== undefined ? foto(fotos[a.indiceFoto], x, y, ancho, alto, a.id, datos.fotos?.[a.indiceFoto]?.encaje || a.encaje) : datos.plantilla === 'collage'
        ? foto(fotos[0], x, y, (ancho - separacion) / 2, (alto - separacion) / 2, 'foto0')
          + foto(fotos[1], x, y + (alto + separacion) / 2, (ancho - separacion) / 2, (alto - separacion) / 2, 'foto1')
          + foto(fotos[2], x + (ancho + separacion) / 2, y, (ancho - separacion) / 2, alto, 'foto2')
        : foto(fotos[0], x, y, ancho, alto, 'foto0', datos.fotos?.[0]?.encaje);
      registrar(a, caja, svg); continue;
    }
    if (a.id === 'escudo' && datos.plantilla === 'escudo' && datos.vector?.svg) {
      const [vx, vy, vw, vh] = datos.vector.viewBox;
      const escala = Math.min(maxW * w / vw, maxH * h / vh);
      const caja = cajaSeccion(a, vw * escala / w, vh * escala / h);
      const interior = datos.vector.svg.replace(/^<svg\b[^>]*>/, '').replace(/<\/svg>\s*$/, '');
      registrar(a, caja, `<g transform="scale(${escala}) translate(${-vx} ${-vy})">${interior}</g>`); continue;
    }
    let texto = a.id === 'escudo' ? datos.plantilla === 'iniciales' ? String(datos.nombre || '').trim().split(/\s+/).map((p) => p[0]).slice(0, 3).join('') : datos.equipo : a.id === 'fecha' ? datos.plantilla === 'equipo' ? datos.equipo : datos.fecha : datos[a.id];
    texto = textoLimpio(texto);
    if (!texto) continue;
    if (a.mayusculas) texto = texto.toLocaleUpperCase('es');
    const tipografia = fuentes[a.id] || fuente;
    const bloque = textoEnCaja(texto, tipografia, maxW * w, maxH * h, ['frase', 'titulo', 'dedicatoria'].includes(a.id));
    const anchoTexto = bloque.w * bloque.escala / w;
    const anclaje = a.alineacion === 'izquierda' ? a.x - maxW / 2 + anchoTexto / 2 : a.alineacion === 'derecha' ? a.x + maxW / 2 - anchoTexto / 2 : a.x;
    const caja = cajaSeccion({ ...a, x: anclaje }, anchoTexto, bloque.h * bloque.escala / h);
    const color = /^#[0-9a-f]{6}$/i.test(a.color) ? a.color : tinta;
    const rutas = bloque.rutas.map((p, i) => { const espacio = bloque.w - p.caja.x2 + p.caja.x1; const dx = a.alineacion === 'izquierda' ? 0 : a.alineacion === 'derecha' ? espacio : espacio / 2; return `<g transform="translate(${dx - p.caja.x1} ${i * (bloque.altura + 16) - p.caja.y1})"><path fill="${color}" d="${p.d}"/></g>`; }).join('');
    registrar(a, caja, `<g transform="scale(${bloque.escala})">${rutas}</g>`);
  }
  const medidas = config.produccion || {};
  const dimensiones = medidasConfirmadas(medidas) ? ` width="${Number(medidas.anchoMm)}mm" height="${Number(medidas.altoMm)}mm"` : '';
  return { svg: `<svg xmlns="http://www.w3.org/2000/svg"${dimensiones} viewBox="0 0 ${w} ${h}">${contenido}${decoracionPendiente}</svg>`, elementos, fondo, baseSvg, superposicionSvg, anchoSvg: w, altoSvg: h };
}
