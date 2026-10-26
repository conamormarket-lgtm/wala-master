import { ajusteSeccion, cajaSeccion, limitar, seccionesYoryo } from '../../utils/distribucionYoryo.mjs';
import { medidasConfirmadas } from '../../utils/yoryoPersonalizacion.mjs';
import { serializarTrazos } from './trazosYoryo.mjs';

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

const foto = (url, x, y, w, h, id) => !url ? `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#DED9D0"/>` : `<defs><clipPath id="${id}"><rect x="${x}" y="${y}" width="${w}" height="${h}"/></clipPath></defs><image href="${escape(url)}" x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid slice" clip-path="url(#${id})"/>`;

export function componerEditableYoryo({ datos, config, fuente, fuentes = {}, fotos = [] }) {
  const w = 1000, h = Math.round(w * config.proporcion);
  const laser = config.tecnica === 'laser';
  const equipo = datos.plantilla === 'equipo';
  const tinta = !laser && equipo ? '#FFFFFF' : laser ? '#000000' : '#26342B';
  const fondo = laser ? '' : equipo ? datos.equipo === 'Universitario' ? '#801B22' : '#14294A' : '#F6EFE5';
  let contenido = fondo ? `<rect width="${w}" height="${h}" fill="${fondo}"/>` : '';
  const elementos = [];
  const registrar = (seccion, caja, svg) => {
    contenido += `<g data-yoryo-elemento="${seccion.id}" transform="translate(${caja.x * w} ${caja.y * h})">${svg}</g>`;
    elementos.push({ id: seccion.id, nombre: seccion.nombre, ...caja, fragmento: svg, anchoSvg: caja.w * w, altoSvg: caja.h * h });
  };
  for (const seccion of seccionesYoryo(datos, config)) {
    const a = ajusteSeccion(datos, seccion);
    const maxW = limitar(a.w * a.escala / 100, .01, .96), maxH = limitar(a.h * a.escala / 100, .01, .96);
    if (a.id === 'foto') {
      const caja = cajaSeccion(a, maxW, maxH), x = 0, y = 0, ancho = caja.w * w, alto = caja.h * h;
      const separacion = 12;
      const svg = datos.plantilla === 'collage'
        ? foto(fotos[0], x, y, (ancho - separacion) / 2, (alto - separacion) / 2, 'foto0')
          + foto(fotos[1], x, y + (alto + separacion) / 2, (ancho - separacion) / 2, (alto - separacion) / 2, 'foto1')
          + foto(fotos[2], x + (ancho + separacion) / 2, y, (ancho - separacion) / 2, alto, 'foto2')
        : foto(fotos[0], x, y, ancho, alto, 'foto0');
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
    const bloque = textoEnCaja(texto, tipografia, maxW * w, maxH * h, a.id === 'frase');
    const caja = cajaSeccion(a, bloque.w * bloque.escala / w, bloque.h * bloque.escala / h);
    const rutas = bloque.rutas.map((p, i) => `<g transform="translate(${(bloque.w - p.caja.x2 + p.caja.x1) / 2 - p.caja.x1} ${i * (bloque.altura + 16) - p.caja.y1})"><path fill="${tinta}" d="${p.d}"/></g>`).join('');
    registrar(a, caja, `<g transform="scale(${bloque.escala})">${rutas}</g>`);
  }
  const medidas = config.produccion || {};
  const dimensiones = medidasConfirmadas(medidas) ? ` width="${Number(medidas.anchoMm)}mm" height="${Number(medidas.altoMm)}mm"` : '';
  return { svg: `<svg xmlns="http://www.w3.org/2000/svg"${dimensiones} viewBox="0 0 ${w} ${h}">${contenido}</svg>`, elementos, fondo };
}
