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
  // "No sé", "nadie"…: no son gustos.
  'nose', 'sabe', 'nadie', 'idea', 'tiene', 'tienes', 'cualquier', 'cualquiera',
]);

// Formas en que la gente escribe lo mismo → cómo está nombrado en el catálogo.
// `club`: equipos de fútbol. Un producto de un equipo SOLO se recomienda a quien
// es hincha de ese equipo (a un hincha de la U no se le regala nada de Alianza),
// y "Alianza" solo cuenta en productos de fútbol (no en "Set Yoryo Alianza").
// `implica`: nombrar a ese jugador cuenta como ser hincha de su club.
export const SINONIMOS = [
  { canon: 'alianza lima', club: true, formas: ['alianza', 'grone', 'blanquiazul', 'aliancista', 'intimos', 'alianza lima'] },
  { canon: 'universitario', club: true, formas: ['la u', 'de la u', 'crema', 'cremas', 'universitario de deportes', 'u de deportes'] },
  { canon: 'sporting cristal', club: true, formas: ['cristal', 'sporting', 'celeste', 'celestes', 'rimense', 'rimenses'] },
  { canon: 'cienciano', club: true, formas: ['cienciano', 'cinciano'] },
  { canon: 'melgar', club: true, formas: ['melgar', 'dominos'] },
  { canon: 'barcelona', club: true, formas: ['barza', 'barca', 'barsa', 'fc barcelona'] },
  { canon: 'real madrid', club: true, formas: ['madrid', 'real madril', 'el madrid'] },
  // Un ídolo de un club cuenta como ser hincha de ese club.
  { canon: 'paolo guerrero', formas: ['guerrero', 'depredador'], implica: 'alianza lima' },
  { canon: 'dragon ball', formas: ['dbz', 'dragon ball z', 'dragon ball super', 'dragonball'] },
  { canon: 'spider man', formas: ['spiderman', 'hombre arana', 'miles morales'] },
  { canon: 'stitch', formas: ['stich', 'lilo y stitch', 'stitch y angel'] },
  { canon: 'demon slayer', formas: ['kimetsu', 'kimetsu no yaiba'] },
  { canon: 'jujutsu kaisen', formas: ['jjk', 'jujutsu'] },
  { canon: 'attack on titan', formas: ['shingeki', 'shingeki no kyojin', 'aot', 'ataque a los titanes', 'ataque de titanes'] },
  { canon: 'one piece', formas: ['onepiece'] },
];

// Palabras que solo nombran un equipo: fuera de un producto de fútbol no cuentan.
const PALABRAS_CLUB = new Set(SINONIMOS.filter((g) => g.club)
  .flatMap((g) => [g.canon, ...g.formas]).flatMap((f) => f.split(' ')).filter((w) => w.length >= 3));

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
    .replace(/[\u0300-\u036f]/g, '')
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

// Lo que el producto ES (nombre, etiquetas, personajes, colecciones): pesa
// completo. La descripción es ruido ("Polo Solo Vine a Ver" menciona "lentes")
// y casi no suma.
function partesProducto(p, dicts) {
  const entidades = [
    ...nombres(p.characters, dicts.characters),
    ...nombres(p.tags, dicts.tags),
    ...nombres(p.collections, dicts.collections),
  ];
  const fuerte = ` ${normalizar([p.name, ...entidades].join(' '))} `;
  return {
    entidades,
    fuerte,
    tokens: fuerte.trim().split(' '),
    debil: ` ${normalizar(String(p.description || '').slice(0, 300))} `,
  };
}

// Entidades que no son un gusto concreto (no sirven de "por qué").
const ENTIDAD_GENERICA = new Set(['geek', 'anime', 'futbol', 'futbol peruano', 'comics', 'supervillanos', 'para regalar', 'parejas', 'humor', 'frases']);

function distancia(a, b) {
  if (Math.abs(a.length - b.length) > 1) return 2;
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
    }
  }
  return prev[b.length];
}

// ¿La palabra está en el texto? Palabras cortas: exacta. Largas: también con
// una letra de diferencia ("Zenitzu" → "Zenitsu", "Guerreo" → "Guerrero",
// "gokus" → "goku"). No como inicio de otra palabra: "demon" no es "demonio".
function coincide(w, texto, tokens) {
  if (texto.includes(` ${w} `)) return true;
  if (w.length < 5) return false;
  return tokens.some((t) => t.length >= 5 && distancia(t, w) <= 1);
}

// Edad de la persona si su cumpleaños tiene un año creíble (muchos guardan el
// año de la próxima fecha, no el de nacimiento: esos no cuentan).
export function edadDe(recipient, hoy = new Date()) {
  const ev = ((recipient && recipient.events) || []).find((e) => /cumplea/i.test(e.type || '') && e.date);
  const m = ev && /^(\d{4})-(\d{2})-(\d{2})/.exec(String(ev.date));
  if (!m) return null;
  const anio = Number(m[1]);
  if (anio < 1900 || anio >= hoy.getFullYear() - 1) return null;
  let edad = hoy.getFullYear() - anio;
  const mes = Number(m[2]);
  if (hoy.getMonth() + 1 < mes || (hoy.getMonth() + 1 === mes && hoy.getDate() < Number(m[3]))) edad -= 1;
  return edad;
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
// ('hombre' | 'mujer' | 'unisex' | 'ninos', pantalla "Datos para recomendar"
// o el formulario del producto); si no está marcado, se intenta deducir del texto (pocas fichas
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

// Ocasiones románticas: ahí un conjunto de pareja SÍ es una buena idea.
const ROMANTICO = /aniversario|san valentin|amor|enamorad|14 de febrero|boda|novios/;
const ROLES_NINOS = ['hijos', 'sobrinos', 'nietos'];

// ── Datos de recomendación de cada producto ────────────────────────────────
// Se marcan en /admin/publico-productos (y en el formulario del producto):
//   publico     'mujer' | 'hombre' | 'unisex' | 'ninos'
//   equipo      club o selección del producto ("Alianza Lima"); vacío = ninguno
//   edadMinima  0 (todas) | 13 | 18 (solo adultos)
// Si un producto todavía no los tiene, se DEDUCEN de sus etiquetas (por eso
// siguen funcionando los productos viejos), pero lo marcado manda siempre.

export const EDADES = [
  { id: 0, label: 'Todas las edades' },
  { id: 13, label: 'Desde 13 años' },
  { id: 18, label: 'Solo adultos' },
];
// Deducción de edad cuando no está marcada: lo que no se le regala a un niño,
// y lo de humor/disruptivo, que no es para menores.
const NO_NINOS = [' reloj', ' billetera', ' joyas', ' lentes', ' esclava', ' pareja', ' parejas', ' el & ella'];
const PICANTE = [' humor', ' disruptivo'];

const marcado = (v) => v !== undefined && v !== null && v !== '';

/** { valor: 0|13|18, deducida: bool } */
export function edadMinimaDe(p, txt) {
  const n = Number(p && p.edadMinima);
  if (p && marcado(p.edadMinima) && EDADES.some((e) => e.id === n)) return { valor: n, deducida: false };
  const t = txt || textoProducto(p || {});
  if (PICANTE.some((k) => t.includes(k))) return { valor: 18, deducida: true };
  if (NO_NINOS.some((k) => t.includes(k))) return { valor: 13, deducida: true };
  return { valor: 0, deducida: true };
}

// Palabras de nombres de equipo que por sí solas no identifican a ninguno.
const PALABRA_EQUIPO_COMUN = new Set(['club', 'deportivo', 'deportes', 'sport', 'sporting', 'atletico', 'union', 'real', 'futbol', 'seleccion', 'juniors', 'city', 'united']);

// Etiquetas que acompañan a "Fútbol" pero no son un equipo.
const NO_EQUIPO = new Set(['futbol', 'deporte', 'deportes', 'para regalar', 'regalo', 'personalizable', 'parejas', 'humor', 'frases', 'futbol peruano', 'sin personalizar']);

/**
 * Equipo del producto: el marcado; si no, el que dicen sus etiquetas (todo
 * producto con la etiqueta "Fútbol" es de un equipo: su otra etiqueta), o un
 * club conocido en su nombre. { nombre: 'Alianza Lima' | '', deducido: bool }
 */
export function equipoDe(p, dicts = {}) {
  if (p && marcado(p.equipo)) return { nombre: String(p.equipo).trim(), deducido: false };
  const etiquetas = nombres(p && p.tags, dicts.tags);
  if (etiquetas.some((t) => normalizar(t) === 'futbol')) {
    const otra = etiquetas.find((t) => !NO_EQUIPO.has(normalizar(t)));
    if (otra) return { nombre: otra, deducido: true };
  }
  const fuerte = ` ${normalizar([p && p.name, ...etiquetas, ...nombres(p && p.collections, dicts.collections)].join(' '))} `;
  const club = SINONIMOS.find((g) => g.club && fuerte.includes(` ${g.canon} `));
  if (club) {
    const bonito = etiquetas.find((t) => normalizar(t) === club.canon);
    return { nombre: bonito || club.canon.replace(/\b\w/g, (c) => c.toUpperCase()), deducido: true };
  }
  return { nombre: '', deducido: true };
}

// Respuesta → frase, palabras clave y entidades conocidas (equipos, animes…).
function prepararRespuesta(original) {
  const frase = ` ${normalizar(original)} `;
  const grupos = SINONIMOS.filter((g) => [g.canon, ...g.formas].some((f) => frase.includes(` ${normalizar(f)} `)));
  const piel = TIPOS_PIEL.find((t) => frase.trim() === t) || null;
  return { original, frase, palabras: palabrasClave(original), grupos, piel };
}

// El "por qué" de una idea: el nombre con que el catálogo llama a lo que le
// gusta ("Le gusta Dragon Ball"), no la respuesta entera ("Dragon Ball/Naruto").
function motivoPorGusto(r, entidades, acertadas) {
  if (r.piel) return `Para piel ${r.piel}`;
  let mejor = null;
  let mejorN = 0;
  for (const e of entidades) {
    const n = ` ${normalizar(e)} `;
    if (ENTIDAD_GENERICA.has(n.trim())) continue;
    const aciertos = acertadas.filter((w) => n.includes(` ${w}`)).length;
    if (aciertos > mejorN) {
      mejor = e;
      mejorN = aciertos;
    }
  }
  if (mejor) return `Le gusta ${mejor.charAt(0).toUpperCase()}${mejor.slice(1)}`;
  const t = String(r.original || '').trim();
  if (t.length <= 24 && !/[/,;]/.test(t)) return motivoDe(t);
  const w = acertadas.find((x) => !x.includes(' ')) || acertadas[0] || '';
  return `Le gusta ${w.charAt(0).toUpperCase()}${w.slice(1)}`;
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
 * @param {Date}   [opts.hoy]       para calcular la edad (tests)
 * @returns {Array<{producto, score, motivo, tipo}>}  tipo: 'gusto' (por lo que
 *   le gusta, su conjunto o la ocasión) | 'general' (idea de regalo genérica)
 *
 * Reglas para no recomendar cosas fuera de contexto:
 *  - Primero lo que le gusta. Las ideas genéricas ("Ideal para regalar") solo
 *    rellenan, y si contó sus gustos, como mucho 2.
 *  - Productos de un equipo (campo `equipo`, o etiqueta "Fútbol" + la del
 *    equipo): solo para hinchas de ESE equipo. Sirve para clubes nuevos sin
 *    tocar código.
 *  - Conjuntos de pareja: solo para su pareja o en una ocasión romántica.
 *  - Edad (campo `edadMinima`, o deducida): a un niño (por edad, o
 *    hijos/sobrinos sin edad) nada "desde 13" ni "solo adultos"; a un menor de
 *    18, nada "solo adultos". Como idea genérica, a un niño solo lo de "Niños".
 *  - Lo del género contrario y lo fuera de presupuesto no entra.
 */
export function recomendarRegalos({
  recipient, productos, dicts = {}, conjuntoCategorias = {}, ocasion = '', excluir = new Set(), limite = 4, hoy = new Date(),
}) {
  if (!recipient || !Array.isArray(productos)) return [];

  const respuestas = respuestasDe(recipient).map(prepararRespuesta);
  const contoGustos = respuestas.some((r) => r.palabras.length || r.grupos.length || r.piel);
  const clubesPersona = new Set(respuestas.flatMap((r) => r.grupos
    .map((g) => (g.club ? g.canon : g.implica)).filter(Boolean)));
  const categoriasLigadas = new Set(
    (recipient.selectedCategories || []).flatMap((c) => conjuntoCategorias[c] || []),
  );
  const romantico = ROMANTICO.test(normalizar(ocasion));
  // Ocasión como etiqueta del catálogo ("Día de la Madre", "Navidad").
  const ocasionN = normalizar(ocasion);
  const esPareja = recipient.roleKey === 'pareja';
  const genero = recipient.gender;
  const generoDefinido = genero === 'Femenino' || genero === 'Masculino';
  const rango = PRESUPUESTOS.find((r) => r.id === recipient.budget);
  const edad = edadDe(recipient, hoy);
  const esNino = edad != null ? edad < 13 : ROLES_NINOS.includes(recipient.roleKey);
  const esMenor = edad != null ? edad < 18 : esNino;

  // Equipo de cada producto (marcado o deducido). Las palabras de los equipos
  // del catálogo solo cuentan en productos de fútbol: "Alianza" no trae el
  // "Set Yoryo Alianza", ni "Boca" un labial.
  const equipos = new Map(productos.map((p) => [p, normalizar(equipoDe(p, dicts).nombre)]));
  const palabrasClub = new Set(PALABRAS_CLUB);
  equipos.forEach((e) => e.split(' ').filter((w) => w.length >= 3).forEach((w) => palabrasClub.add(w)));
  const esHincha = (equipo) => clubesPersona.has(equipo)
    || [...clubesPersona].some((c) => ` ${equipo} `.includes(` ${c} `) || ` ${c} `.includes(` ${equipo} `))
    || respuestas.some((r) => r.frase.includes(` ${equipo} `)
      || equipo.split(' ').some((w) => w.length >= 4 && !PALABRA_EQUIPO_COMUN.has(w) && r.frase.includes(` ${w} `)));

  const gustos = [];
  const generales = [];
  for (const p of productos) {
    if (!disponible(p) || excluir.has(String(p.id))) continue;
    const txt = textoProducto(p, dicts);
    const { entidades, fuerte, tokens, debil } = partesProducto(p, dicts);

    // ── Para quién es / contexto: lo que no corresponde no entra ──
    const publico = publicoDe(p, txt);
    if (publico === 'hombre' && genero === 'Femenino') continue;
    if (publico === 'mujer' && genero === 'Masculino') continue;
    if (publico === 'ninos' && !esNino) continue;
    const edadMin = edadMinimaDe(p, txt).valor;
    if (esNino && edadMin >= 13) continue;
    if (esMenor && edadMin >= 18) continue;

    const dePareja = PAREJA.some((k) => txt.includes(k));
    if (dePareja && !esPareja && !romantico) continue;

    // Producto de un equipo: solo para hinchas de ese equipo.
    const equipo = equipos.get(p);
    if (equipo && !esHincha(equipo)) continue;
    const esDeClub = Boolean(equipo);

    // ── 1) Lo que respondió (lo que más pesa) ──
    let score = 0;
    let motivo = null;
    let mejorRespuesta = 0;
    for (const r of respuestas) {
      let s = 0;
      const acertadas = [];
      for (const g of r.grupos) {
        if (g.club && !esDeClub) continue;
        if (fuerte.includes(` ${g.canon} `)) {
          s += 14;
          acertadas.push(g.canon);
        }
      }
      // La frase completa solo cuenta si tiene alguna palabra útil: "Fútbol"
      // sola no debe recomendar productos de cualquier equipo.
      if (r.palabras.length > 0 && r.frase.trim().length >= 4 && fuerte.includes(r.frase)) s += 6;
      const palabras = r.palabras.filter((w) => (esDeClub || !palabrasClub.has(w)) && coincide(w, fuerte, tokens));
      s += Math.min(palabras.length, 3) * 8;
      acertadas.push(...palabras);
      // Solo en la descripción: el tipo de piel sí (así lo describen los
      // productos de skincare); cualquier otra palabra casi no suma.
      if (!s && r.piel && debil.includes(` ${r.piel}`)) s += 8;
      else if (!s && r.palabras.some((w) => coincide(w, debil, []))) s += 3;
      if (s > mejorRespuesta) {
        mejorRespuesta = s;
        motivo = motivoPorGusto(r, entidades, acertadas);
      }
      score += s;
    }
    let relevante = mejorRespuesta >= 8;

    // ── 2) Conjunto ligado a categorías de la tienda ("Belleza" → skincare) ──
    if (categoriasLigadas.size && (p.categories || []).some((c) => categoriasLigadas.has(c))) {
      score += 7;
      relevante = true;
      if (!motivo) motivo = CONJUNTO;
    }

    // ── 3) Pareja en ocasión romántica: es justo lo que pide la ocasión ──
    if (dePareja && romantico) {
      score += 7;
      relevante = true;
      if (!motivo) motivo = 'Para regalar en pareja';
    }

    // ── 3b) Producto etiquetado para la ocasión ("Día de la Madre") ──
    if (ocasionN.length >= 6 && fuerte.includes(` ${ocasionN} `)) {
      score += 7;
      relevante = true;
      if (!motivo) motivo = `Para ${String(ocasion).trim()}`;
    }

    // ── 4) Respaldo genérico: pareja (sin ocasión romántica) o "Para regalar" ──
    // Con género definido, solo lo marcado para su género o unisex: sin marca no
    // se sabe si un reloj es de hombre o de mujer. A un niño, solo lo de niños.
    let generico = 0;
    let motivoGenerico = null;
    // Sin ocasión romántica, un conjunto de pareja solo no alcanza: tiene que
    // ser además algo "para regalar" (un set Él & Ella sí; un polo a juego, no).
    if (dePareja && !romantico) {
      generico += 2;
      motivoGenerico = 'Para regalar en pareja';
    }
    const publicoSirve = esNino ? publico === 'ninos'
      : (!generoDefinido || publico === 'unisex'
        || (publico === 'mujer' && genero === 'Femenino') || (publico === 'hombre' && genero === 'Masculino'));
    if (publicoSirve && REGALO.some((k) => txt.includes(k))) {
      generico += 4;
      if (!motivoGenerico) motivoGenerico = GENERICO;
    }
    if (esNino && publico !== 'ninos') generico = 0;
    if ((publico === 'mujer' && genero === 'Femenino') || (publico === 'hombre' && genero === 'Masculino')) score += 2;

    // ── 5) Presupuesto: hasta un 10 % de margen está bien; un poco más afuera
    // baja; muy afuera (más de 25 %) no se recomienda.
    let ajustePrecio = 0;
    if (rango) {
      const precio = precioDe(p);
      if (precio > rango.max * 1.25 || precio < rango.min * 0.75) continue;
      ajustePrecio = (precio < rango.min * 0.9 || precio > rango.max * 1.1) ? -8 : 1;
    }

    if (relevante) {
      gustos.push({ producto: p, score: score + generico + ajustePrecio, motivo: motivo || CONJUNTO, tipo: 'gusto' });
    } else if (generico >= 4 && generico + ajustePrecio + score >= 4) {
      generales.push({ producto: p, score: generico + score + ajustePrecio, motivo: motivoGenerico, tipo: 'general' });
    }
  }

  const orden = (a, b) => (b.score - a.score)
    || ((b.producto.featured ? 1 : 0) - (a.producto.featured ? 1 : 0))
    || (precioDe(a.producto) - precioDe(b.producto));
  gustos.sort(orden);
  generales.sort(orden);

  // Todo lo que le gusta va antes que cualquier idea genérica (con variedad:
  // primero 2 por motivo, después el resto). Las genéricas solo rellenan lo que
  // falte y, si contó sus gustos, como mucho 2.
  const { elegidos, sobrantes } = variar(gustos, limite);
  const porGusto = [...elegidos, ...sobrantes].slice(0, limite);
  const topeGenerales = contoGustos ? 2 : limite;
  const ideasGenerales = variar(generales, Math.min(topeGenerales, limite - porGusto.length)).elegidos;
  return [...porGusto, ...ideasGenerales];
}

// Variedad: como mucho 2 ideas por el mismo motivo ("Le gusta Spider Man"), y
// entre las ideas genéricas como mucho 2 de la misma marca, para no mostrar 4
// casacas de lo mismo ni 3 relojes de la misma línea.
function variar(ordenados, limite) {
  const elegidos = [];
  const sobrantes = [];
  const porMotivo = {};
  const porMarca = {};
  for (const r of ordenados) {
    if (elegidos.length >= limite) {
      sobrantes.push(r);
      continue;
    }
    const m = r.motivo;
    const b = r.tipo === 'general' ? (r.producto.brandId || '') : '';
    // Las genéricas comparten motivo; ahí manda el tope por marca, no por motivo.
    // Lo del conjunto admite 3 (es justo lo que eligió).
    const maxMotivo = m === CONJUNTO ? 3 : 2;
    const topeMotivo = r.tipo !== 'general' && (porMotivo[m] || 0) >= maxMotivo;
    if (topeMotivo || (b && (porMarca[b] || 0) >= 2)) {
      sobrantes.push(r);
      continue;
    }
    elegidos.push(r);
    porMotivo[m] = (porMotivo[m] || 0) + 1;
    if (b) porMarca[b] = (porMarca[b] || 0) + 1;
  }
  return { elegidos, sobrantes };
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
