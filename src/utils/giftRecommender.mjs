// Buscador de regalos: recomienda productos del catálogo para una persona de
// "Fechas importantes" a partir de lo que el cliente contó de ella en la
// encuesta (equipo, anime, personaje, jugador…), su conjunto, a quién es, la
// ocasión, el género y el presupuesto. Puro: sin Firebase.
//
// ⚠️ Hay una COPIA en functions/giftLogic.js (CommonJS, para el recordatorio de
// fechas del servidor). Si cambias la lógica, cámbiala en los dos; el test
// src/utils/giftRecommender.test.mjs compara que ambas den lo mismo.
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

export const PRESUPUESTOS = [
  { id: 'hasta50', label: 'Hasta S/ 50', min: 0, max: 50 },
  { id: '50a100', label: 'S/ 50 – 100', min: 50, max: 100 },
  { id: '100a200', label: 'S/ 100 – 200', min: 100, max: 200 },
  { id: 'mas200', label: 'Más de S/ 200', min: 200, max: Infinity },
];

export function normalizar(texto) {
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
export function textoProducto(p, dicts = {}) {
  return ` ${normalizar([
    p.name,
    ...nombres(p.tags, dicts.tags),
    ...nombres(p.characters, dicts.characters),
    ...nombres(p.collections, dicts.collections),
    String(p.description || '').slice(0, 300),
  ].join(' '))} `;
}

// Respuestas escritas de la persona → frases y palabras clave.
// Solo cuentan los conjuntos ENCENDIDOS: al apagar "Geek" sus respuestas quedan
// guardadas (por si se vuelve a encender) pero ya no influyen en las ideas.
export function respuestasDe(recipient) {
  const out = [];
  const porConjunto = (recipient && recipient.categoryAnswers) || {};
  const activos = recipient && Array.isArray(recipient.selectedCategories) ? new Set(recipient.selectedCategories) : null;
  Object.entries(porConjunto).forEach(([conjuntoId, campos]) => {
    if (activos && !activos.has(conjuntoId)) return;
    Object.values(campos || {}).forEach((v) => {
      const t = String(v || '').trim();
      if (t) out.push(t);
    });
  });
  return out;
}

export function palabrasClave(respuesta) {
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
const CONJUNTO = 'Va con lo que le gusta';

// Texto del "por qué" de una idea. Respuestas de opción como el tipo de piel
// no se leen bien como "Le gusta Mixta": se dicen como "Para piel mixta".
const TIPOS_PIEL = ['seca', 'grasa', 'mixta', 'sensible', 'normal'];
function motivoDe(respuesta) {
  const t = String(respuesta || '').trim();
  if (TIPOS_PIEL.includes(normalizar(t))) return `Para piel ${normalizar(t)}`;
  return `Le gusta ${t}`;
}
const MUJER = [' mujer', ' dama', ' femenin'];
const HOMBRE = [' hombre', ' caballero', ' masculin'];

// "Para quién es" el producto. Lo marca el admin en el campo `publico`
// ('hombre' | 'mujer' | 'unisex' | 'ninos', pantalla "Para quién es cada
// producto"); si no está marcado, se intenta deducir del texto (pocas fichas
// lo dicen, por eso conviene marcarlo).
export const PUBLICOS = [
  { id: 'mujer', label: 'Mujer' },
  { id: 'hombre', label: 'Hombre' },
  { id: 'unisex', label: 'Unisex' },
  { id: 'ninos', label: 'Niños' },
];
export function publicoDe(p, txt) {
  if (p && PUBLICOS.some((x) => x.id === p.publico)) return p.publico;
  const t = txt || ` ${normalizar(`${(p && p.name) || ''} ${String((p && p.description) || '').slice(0, 300)}`)} `;
  const m = MUJER.some((k) => t.includes(k));
  const h = HOMBRE.some((k) => t.includes(k));
  if (m && !h) return 'mujer';
  if (h && !m) return 'hombre';
  return null;
}

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
export function recomendarRegalos({
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
      // La frase completa solo cuenta si tiene alguna palabra útil: "Fútbol"
      // sola no debe recomendar productos de cualquier equipo.
      if (r.palabras.length > 0 && r.frase.trim().length >= 4 && txt.includes(r.frase)) s += 6;
      const aciertos = r.palabras.filter((w) => contiene(txt, w)).length;
      s += Math.min(aciertos, 3) * 8;
      if (s > mejorRespuesta) {
        mejorRespuesta = s;
        motivo = motivoDe(r.original);
      }
      score += s;
    }

    // 2) Conjunto ligado a categorías de la tienda. Pesa más que lo genérico de
    // pareja: si eligió "Belleza", primero van productos de belleza.
    if (categoriasLigadas.size && (p.categories || []).some((c) => categoriasLigadas.has(c))) {
      score += 7;
      if (!motivo) motivo = CONJUNTO;
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

    // 3b) Respaldo: etiquetado "Para regalar". Para alguien con género definido
    // solo vale si el producto está marcado para su género o unisex: sin esa
    // marca no se sabe si un reloj es de hombre o de mujer, y no se adivina.
    const publico = publicoDe(p, txt);
    const generoDefinido = genero === 'Femenino' || genero === 'Masculino';
    const publicoSirve = !generoDefinido || publico === 'unisex'
      || (publico === 'mujer' && genero === 'Femenino') || (publico === 'hombre' && genero === 'Masculino')
      || (publico === 'ninos' && ['hijos', 'sobrinos'].includes(recipient.roleKey));
    if (publicoSirve && REGALO.some((k) => txt.includes(k))) {
      score += 4;
      if (!motivo) motivo = GENERICO;
    }

    // 4) Para quién es: lo del género contrario NO se recomienda (un reloj de
    // hombre no es idea para ella), y lo de niños solo para hijos/sobrinos.
    if (publico === 'hombre' && genero === 'Femenino') continue;
    if (publico === 'mujer' && genero === 'Masculino') continue;
    if (publico === 'ninos' && !['hijos', 'sobrinos'].includes(recipient.roleKey)) continue;
    if ((publico === 'mujer' && genero === 'Femenino') || (publico === 'hombre' && genero === 'Masculino')) score += 2;

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
    // Las genéricas comparten motivo; ahí manda el tope por marca, no por motivo.
    // Lo del conjunto admite 3 (es justo lo que eligió).
    const maxMotivo = m === CONJUNTO ? 3 : 2;
    const topeMotivo = m !== GENERICO && (porMotivo[m] || 0) >= maxMotivo;
    if (topeMotivo || (b && (porMarca[b] || 0) >= 2)) {
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

// Palabras que "anclan" cada conjunto a una parte del catálogo, por nombre de
// etiqueta/colección. Ej. Deportes → productos con etiqueta "Fútbol".
const ANCLAS = {
  deport: ['futbol', 'deporte', 'deportes', 'voley', 'basquet', 'sport', 'hincha', 'camiseta'],
  geek: ['anime', 'animes', 'geek', 'manga', 'comic', 'comics', 'gamer', 'videojuego', 'marvel', 'superheroe', 'superheroes', 'supervillanos'],
};
// Etiquetas que no son un gusto (no se sugieren como respuesta).
const NO_GUSTO = new Set([
  'para regalar', 'regalo', 'personalizable', 'personalizad', 'promocion', 'tendencias', 'ejemplo',
  'parejas', 'pareja', 'amor', 'frases', 'humor', 'fotos', 'inicial', 'institucional', 'disruptivo',
]);

function anclasDe(conjunto) {
  const n = normalizar(conjunto && conjunto.name);
  const clave = Object.keys(ANCLAS).find((k) => n.includes(k));
  return clave ? ANCLAS[clave] : n.split(' ').filter((w) => w.length >= 4);
}

/**
 * Sugerencias para UNA pregunta de un conjunto: nombres sacados solo de los
 * productos de ese conjunto. Preguntas de personaje/jugador → personajes; de
 * deporte → el tipo de deporte; el resto (equipo, anime, franquicia…) →
 * etiquetas y colecciones de esos productos. Ordenadas por cuántos productos
 * las usan. Así "¿De qué equipo es hincha?" sugiere equipos, no "Dr.Althea".
 */
export function sugerenciasPorCampo({ conjunto, field, productos = [], dicts = {}, conjuntoCategorias = {} }) {
  const anclas = anclasDe(conjunto);
  const cats = new Set((conjunto && conjuntoCategorias[conjunto.id]) || []);
  const label = normalizar(field && field.label);
  const esAncla = (nombre) => {
    const n = ` ${normalizar(nombre)} `;
    return anclas.some((a) => n.includes(` ${a}`));
  };

  const delConjunto = productos.filter((p) => {
    if (!disponible(p)) return false;
    if ((p.categories || []).some((c) => cats.has(c))) return true;
    return [...nombres(p.tags, dicts.tags), ...nombres(p.collections, dicts.collections)].some(esAncla);
  });

  const conteo = new Map();
  const sumar = (nombre) => {
    const t = String(nombre || '').trim();
    const n = normalizar(t);
    if (t.length < 3 || t.length > 40 || NO_GUSTO.has(n)) return;
    conteo.set(t, (conteo.get(t) || 0) + 1);
  };
  const quierePersonaje = /personaje|jugador|idolo|artista|cantante/.test(label);
  const quiereDeporte = /deporte|disciplina/.test(label);
  delConjunto.forEach((p) => {
    if (quierePersonaje) {
      nombres(p.characters, dicts.characters).forEach(sumar);
      return;
    }
    const etiquetas = [...nombres(p.tags, dicts.tags), ...nombres(p.collections, dicts.collections)];
    etiquetas.filter((n) => (quiereDeporte ? esAncla(n) : !esAncla(n))).forEach(sumar);
  });

  return [...conteo.entries()]
    .sort((a, b) => (b[1] - a[1]) || a[0].localeCompare(b[0], 'es'))
    .map(([nombre]) => nombre)
    .slice(0, 40);
}

// Sugerencias para autocompletar las respuestas de la encuesta: los nombres de
// etiquetas, personajes y colecciones del catálogo, así lo que escriba el
// cliente coincide con cómo están nombrados los productos.
export function sugerenciasRespuestas(dicts = {}) {
  const set = new Set();
  ['tags', 'characters', 'collections'].forEach((k) => {
    Object.values(dicts[k] || {}).forEach((n) => {
      const t = String(n || '').trim();
      if (t.length >= 3 && t.length <= 40 && !/^[A-Z0-9 -]{12,}$/.test(t)) set.add(t);
    });
  });
  return [...set].sort((a, b) => a.localeCompare(b, 'es'));
}
