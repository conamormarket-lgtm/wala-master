// Buscador de regalos: recomienda productos del catálogo para una persona de
// "Fechas importantes" a partir de lo que el cliente contó de ella en la
// encuesta (equipo, anime, personaje, jugador…), su conjunto, a quién es, la
// ocasión, el género y el presupuesto. Puro: sin Firebase.
//
// ⚠️ COPIA GENERADA de src/utils/giftRecommender.mjs (la fuente es ese archivo).
// No la edites a mano: corre  npm run gen:gift-logic  después de cambiar el original.
// El test src/utils/giftRecommender.test.mjs verifica que ambas den lo mismo.
//
// Las etiquetas, personajes y colecciones de los productos se guardan como IDs;
// `dicts` trae sus nombres ({ tags:{id:nombre}, characters:{…}, collections:{…} }).

const STOP = new Set([
  'del', 'de', 'la', 'el', 'los', 'las', 'y', 'e', 'o', 'u', 'un', 'una', 'unos', 'que', 'me', 'mi', 'mis',
  'su', 'sus', 'es', 'en', 'por', 'con', 'para', 'al', 'lo', 'le', 'les', 'se', 'muy', 'mas', 'pero',
  'todo', 'todos', 'toda', 'ninguno', 'ninguna', 'nada', 'no', 'si', 'tambien', 'gusta', 'gustan', 'favorito',
  'favorita', 'equipo', 'hincha', 'juega', 'jugar', 'ver', 'serie', 'series', 'otro', 'otros', 'etc',
  'futbol', 'deporte', 'deportes', 'anime', 'animes',
]);

const PRESUPUESTOS = [
  { id: 'hasta50', label: 'Hasta S/ 50', min: 0, max: 50 },
  { id: '50a100', label: 'S/ 50 – 100', min: 50, max: 100 },
  { id: '100a200', label: 'S/ 100 – 200', min: 100, max: 200 },
  { id: 'mas200', label: 'Más de S/ 200', min: 200, max: Infinity },
];

function normalizar(texto) {
  return String(texto || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9& ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function nombres(ids, dict) {
  if (!Array.isArray(ids) || !dict) return [];
  return ids.map((id) => dict[id]).filter(Boolean);
}

// Texto buscable de un producto: nombre + etiquetas + personajes + colecciones
// + el inicio de la descripción.
function textoProducto(p, dicts = {}) {
  return ` ${normalizar([
    p.name,
    ...nombres(p.tags, dicts.tags),
    ...nombres(p.characters, dicts.characters),
    ...nombres(p.collections, dicts.collections),
    String(p.description || '').slice(0, 300),
  ].join(' '))} `;
}

// Respuestas escritas de la persona → frases y palabras clave.
function respuestasDe(recipient) {
  const out = [];
  const porConjunto = (recipient && recipient.categoryAnswers) || {};
  Object.values(porConjunto).forEach((campos) => {
    Object.values(campos || {}).forEach((v) => {
      const t = String(v || '').trim();
      if (t) out.push(t);
    });
  });
  return out;
}

function palabrasClave(respuesta) {
  return [...new Set(normalizar(respuesta).split(' ').filter((w) => w.length >= 3 && !STOP.has(w)))];
}

const precioDe = (p) => {
  const venta = Number(p.salePrice);
  return venta > 0 ? venta : Number(p.price) || 0;
};

const disponible = (p) => p && p.visible !== false && !p.deleted && p.inStock !== 0 && p.inStock !== false;

const contiene = (txt, w) => txt.includes(` ${w} `) || txt.includes(` ${w}`);

const PAREJA = [' pareja', ' parejas', ' el & ella', ' el y ella', ' duo ', ' novios', ' enamorados'];
// Productos que la tienda etiquetó para regalo: respaldo cuando no hay otra pista.
const REGALO = [' para regalar', ' regalo ', ' regalos '];
const GENERICO = 'Ideal para regalar';
const MUJER = [' mujer', ' dama', ' femenin', ' para ella '];
const HOMBRE = [' hombre', ' caballero', ' masculin', ' para el '];

/**
 * @param {object} opts
 * @param {object} opts.recipient   persona de giftRecipients
 * @param {Array}  opts.productos   catálogo
 * @param {object} [opts.dicts]     { tags, characters, collections } id → nombre
 * @param {object} [opts.conjuntoCategorias]  { cat_geek: [idCategoriaTienda…] }
 * @param {string} [opts.ocasion]   'Cumpleaños' | 'Aniversario' | …
 * @param {Set}    [opts.excluir]   productIds a no recomendar (ya comprados)
 * @param {number} [opts.limite]
 * @returns {Array<{producto, score, motivo}>}
 */
function recomendarRegalos({
  recipient, productos, dicts = {}, conjuntoCategorias = {}, ocasion = '', excluir = new Set(), limite = 4,
}) {
  if (!recipient || !Array.isArray(productos)) return [];

  const respuestas = respuestasDe(recipient).map((r) => ({
    original: r, frase: ` ${normalizar(r)} `, palabras: palabrasClave(r),
  }));
  const categoriasLigadas = new Set(
    (recipient.selectedCategories || []).flatMap((c) => conjuntoCategorias[c] || []),
  );
  const esPareja = recipient.roleKey === 'pareja' || /aniversario/i.test(ocasion || '');
  const genero = recipient.gender;
  const rango = PRESUPUESTOS.find((r) => r.id === recipient.budget);

  const resultados = [];
  for (const p of productos) {
    if (!disponible(p) || excluir.has(String(p.id))) continue;
    const txt = textoProducto(p, dicts);
    let score = 0;
    let motivo = null;
    let mejorRespuesta = 0;

    // 1) Lo que respondió (lo que más pesa).
    for (const r of respuestas) {
      let s = 0;
      if (r.frase.trim().length >= 4 && txt.includes(r.frase)) s += 6;
      const aciertos = r.palabras.filter((w) => contiene(txt, w)).length;
      s += Math.min(aciertos, 3) * 8;
      if (s > mejorRespuesta) {
        mejorRespuesta = s;
        motivo = `Le gusta ${r.original.trim()}`;
      }
      score += s;
    }

    // 2) Conjunto ligado a categorías de la tienda.
    if (categoriasLigadas.size && (p.categories || []).some((c) => categoriasLigadas.has(c))) {
      score += 4;
      if (!motivo) motivo = 'Va con lo que le gusta';
    }

    // 3) Pareja / aniversario. Lo pensado para parejas, a quien no es pareja
    // (un hermano, un amigo), baja: "Conjunto Pareja" no le sirve.
    const dePareja = PAREJA.some((k) => txt.includes(k));
    if (esPareja && dePareja) {
      score += 6;
      if (!motivo) motivo = 'Para regalar en pareja';
    } else if (!esPareja && dePareja) {
      score -= 10;
    }

    // 3b) Respaldo: etiquetado "Para regalar" (vale para cualquiera).
    if (REGALO.some((k) => txt.includes(k))) {
      score += 4;
      if (!motivo) motivo = GENERICO;
    }

    // 4) Género (solo si el producto es claramente de uno).
    const deMujer = MUJER.some((k) => txt.includes(k));
    const deHombre = HOMBRE.some((k) => txt.includes(k));
    if (deMujer !== deHombre) {
      if ((genero === 'Femenino' && deHombre) || (genero === 'Masculino' && deMujer)) score -= 8;
      else if (genero === 'Femenino' || genero === 'Masculino') score += 1;
    }

    // 5) Presupuesto: hasta un 10 % de margen está bien; un poco más afuera
    // baja; muy afuera (más de 25 %) no se recomienda.
    if (rango) {
      const precio = precioDe(p);
      if (precio > rango.max * 1.25 || precio < rango.min * 0.75) continue;
      if (precio < rango.min * 0.9 || precio > rango.max * 1.1) score -= 8;
      else score += 1;
    }

    if (score >= 4) resultados.push({ producto: p, score, motivo: motivo || 'Recomendado para esta persona' });
  }

  resultados.sort((a, b) => (b.score - a.score)
    || ((b.producto.featured ? 1 : 0) - (a.producto.featured ? 1 : 0))
    || (precioDe(a.producto) - precioDe(b.producto)));
  return variar(resultados, limite);
}

// Variedad: como mucho 2 ideas por el mismo motivo ("Le gusta Spider Man"), y
// entre las ideas genéricas ("Ideal para regalar") como mucho 2 de la misma
// marca, para no mostrar 4 casacas de lo mismo ni 3 relojes de la misma línea.
// Si no alcanza, se completa con las que quedaron (en orden).
function variar(ordenados, limite) {
  const elegidos = [];
  const sobrantes = [];
  const porMotivo = {};
  const porMarca = {};
  for (const r of ordenados) {
    const m = r.motivo;
    const b = m === GENERICO ? (r.producto.brandId || '') : '';
    if ((porMotivo[m] || 0) >= 2 || (b && (porMarca[b] || 0) >= 2)) {
      sobrantes.push(r);
      continue;
    }
    elegidos.push(r);
    porMotivo[m] = (porMotivo[m] || 0) + 1;
    if (b) porMarca[b] = (porMarca[b] || 0) + 1;
    if (elegidos.length >= limite) return elegidos;
  }
  return [...elegidos, ...sobrantes].slice(0, limite);
}

// Sugerencias para autocompletar las respuestas de la encuesta: los nombres de
// etiquetas, personajes y colecciones del catálogo, así lo que escriba el
// cliente coincide con cómo están nombrados los productos.
function sugerenciasRespuestas(dicts = {}) {
  const set = new Set();
  ['tags', 'characters', 'collections'].forEach((k) => {
    Object.values(dicts[k] || {}).forEach((n) => {
      const t = String(n || '').trim();
      if (t.length >= 3 && t.length <= 40 && !/^[A-Z0-9 -]{12,}$/.test(t)) set.add(t);
    });
  });
  return [...set].sort((a, b) => a.localeCompare(b, 'es'));
}

module.exports = { PRESUPUESTOS, normalizar, textoProducto, respuestasDe, palabrasClave, recomendarRegalos, sugerenciasRespuestas };
