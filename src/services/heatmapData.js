import { getCollection } from './firebase/firestore';

/**
 * Servicio de datos para el VISOR DE MAPA DE CALOR.
 *
 * Lee la colección 'heatmap_events' (escrita por src/hooks/useHeatmapTracker.js).
 * Cada documento tiene la forma:
 *   {
 *     events: [{ x, y, pageX, pageY, screenWidth, screenHeight, path, elementInfo, time }],
 *     timestamp
 *   }
 *
 * Aplana todos los arrays .events, normaliza las coordenadas de clic respecto al
 * viewport (screenWidth/screenHeight) para poder pintarlas sobre un canvas de
 * proporción fija, y agrupa por 'path' (página).
 *
 * Además convierte el `elementInfo` crudo (ej. '[svg]', '[IMG]', '[path]',
 * '[BUTTON] "Mi cuenta"') en una ETIQUETA LEGIBLE para humanos, y mapea cada
 * ruta a un NOMBRE de página entendible.
 */

export const HEATMAP_COLLECTION = 'heatmap_events';

// Leemos solo los últimos N documentos para no traer toda la colección
// (cada doc agrupa varios clics, así que 300 docs ya son muchísimos clics).
const DEFAULT_DOCS_LIMIT = 300;

function clamp01(n) {
  if (!Number.isFinite(n)) return null;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

/**
 * Normaliza un evento de clic individual a coordenadas 0..1 respecto al viewport.
 * Devuelve null si el evento no es válido / no se puede normalizar.
 */
function normalizePoint(ev) {
  if (!ev || typeof ev !== 'object') return null;

  const width = Number(ev.screenWidth);
  const height = Number(ev.screenHeight);
  if (!Number.isFinite(width) || width <= 0) return null;
  if (!Number.isFinite(height) || height <= 0) return null;

  const rawX = Number(ev.x);
  const rawY = Number(ev.y);
  if (!Number.isFinite(rawX) || !Number.isFinite(rawY)) return null;

  const xNorm = clamp01(rawX / width);
  const yNorm = clamp01(rawY / height);
  if (xNorm === null || yNorm === null) return null;

  return { xNorm, yNorm, weight: 1 };
}

/* ------------------------------------------------------------------ *
 *  NOMBRES DE PÁGINA LEGIBLES
 * ------------------------------------------------------------------ */

// Rutas exactas -> nombre amigable.
const EXACT_PATH_NAMES = {
  '/': 'Inicio',
  '/tienda': 'Tienda',
  '/buscar': 'Buscador',
  '/carrito': 'Carrito',
  '/checkout': 'Pagar (checkout)',
  '/personalizar': 'Personalizar',
  '/nichos': 'Nichos',
  '/ofertas': 'Ofertas flash',
  '/suscripciones': 'Suscripciones',
  '/minijuegos': 'Minijuegos',
  '/ruleta': 'Ruleta',
  '/ball-sort': 'Ball Sort',
  '/palabra-del-dia': 'Palabra del día',
  '/login': 'Iniciar sesión',
  '/registro': 'Registro',
  '/completar-perfil': 'Completar perfil',
  '/recuperar-contrasena': 'Recuperar contraseña',
  '/regalos-con-amor': 'Regalos con amor',
  '/regalos-catas': 'Regalos / Catas',
  '/mussa': 'Mussa',
  '/wishlist': 'Lista de deseos',
  '/politicas-privacidad': 'Políticas de privacidad',
  '/terminos-y-condiciones': 'Términos y condiciones',
  '/libro-de-reclamaciones': 'Libro de reclamaciones',
  '/vendedor': 'Panel de vendedor',
  // Cuenta
  '/cuenta': 'Mi cuenta',
  '/cuenta/perfil': 'Mi perfil',
  '/cuenta/pedidos': 'Mis pedidos',
  '/cuenta/creaciones': 'Mis creaciones',
  '/cuenta/referidos': 'Mis referidos',
  '/cuenta/fechas-importantes': 'Fechas importantes',
  '/cuenta/misiones': 'Misiones',
  '/cuenta/catalogo': 'Catálogo de recompensas',
  '/cuenta/wishlist': 'Mi lista de deseos',
};

// Patrones con parámetros dinámicos -> nombre amigable.
// Se evalúan en orden; el primero que coincide gana.
const PATTERN_PATH_NAMES = [
  { re: /^\/producto\/[^/]+$/, name: 'Ficha de producto' },
  { re: /^\/editor\/[^/]+$/, name: 'Editor de producto' },
  { re: /^\/pago-rapido\/[^/]+$/, name: 'Pago rápido' },
  { re: /^\/pago-demo\/[^/]+$/, name: 'Pago (demo)' },
  { re: /^\/regalo\/[^/]+$/, name: 'Experiencia de regalo' },
  { re: /^\/wishlist\/[^/]+$/, name: 'Lista de deseos compartida' },
  { re: /^\/nicho\/[^/]+$/, name: 'Nicho' },
  { re: /^\/tienda-vendedor\/[^/]+$/, name: 'Tienda de vendedor' },
  { re: /^\/admin\/?$/, name: 'Admin' },
  { re: /^\/admin\/dashboard$/, name: 'Admin · Dashboard' },
  { re: /^\/admin\//, name: 'Admin' },
];

/**
 * Devuelve un nombre de página legible a partir de su path.
 */
export function prettyPageName(path) {
  if (!path || typeof path !== 'string') return 'Desconocida';
  if (path === 'unknown') return 'Desconocida';

  // Quitar query / hash y barra final sobrante.
  let clean = path.split('?')[0].split('#')[0];
  if (clean.length > 1 && clean.endsWith('/')) clean = clean.slice(0, -1);
  if (clean === '') clean = '/';

  if (EXACT_PATH_NAMES[clean]) return EXACT_PATH_NAMES[clean];

  for (const { re, name } of PATTERN_PATH_NAMES) {
    if (re.test(clean)) return name;
  }

  // Fallback: capitaliza el último segmento y reemplaza guiones.
  const segs = clean.split('/').filter(Boolean);
  if (segs.length === 0) return 'Inicio';
  const last = segs[segs.length - 1];
  const words = last
    .replace(/[-_]+/g, ' ')
    .trim()
    .split(' ')
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : ''))
    .join(' ');
  return words || clean;
}

/* ------------------------------------------------------------------ *
 *  ETIQUETAS LEGIBLES DE ELEMENTOS
 * ------------------------------------------------------------------ */

// Tags considerados "genéricos / visuales" sin texto propio útil.
const GENERIC_TAGS = new Set(['SVG', 'PATH', 'IMG', 'IMAGE', 'USE', 'CANVAS', 'PICTURE', 'G', 'CIRCLE', 'RECT', 'POLYGON', 'LINE']);

/**
 * Parsea un string `elementInfo` con el formato producido por useHeatmapTracker:
 *   '[TAG]'                -> { tag, kind:'bare' }
 *   '[TAG] #id'            -> { tag, kind:'id',    value:'id' }
 *   '[TAG] data-track-val' -> { tag, kind:'track', value:'...' }   (no empieza por # ni " ni .)
 *   '[TAG] "texto"'        -> { tag, kind:'text',  value:'texto' }
 *   '[TAG] .clase'         -> { tag, kind:'class', value:'clase' }
 */
function parseElementInfo(raw) {
  if (typeof raw !== 'string') return null;
  const str = raw.trim();
  if (!str) return null;

  const m = str.match(/^\[([^\]]*)\]\s*(.*)$/);
  if (!m) {
    // No tiene el formato esperado: lo tratamos como texto plano.
    return { tag: '', kind: 'text', value: str };
  }
  const tag = (m[1] || '').trim().toUpperCase();
  const rest = (m[2] || '').trim();

  if (!rest) return { tag, kind: 'bare', value: '' };

  if (rest.startsWith('#')) return { tag, kind: 'id', value: rest.slice(1).trim() };
  if (rest.startsWith('.')) return { tag, kind: 'class', value: rest.slice(1).trim() };

  // Texto entre comillas: '[TAG] "..."'
  const quoted = rest.match(/^"([\s\S]*)"$/);
  if (quoted) return { tag, kind: 'text', value: quoted[1].trim() };

  // Resto: data-track (o aria-label/alt/title que el tracker pasa sin comillas).
  return { tag, kind: 'track', value: rest };
}

// Convierte algunos ids/clases técnicos en algo un poco más presentable.
function humanizeToken(token) {
  if (!token) return '';
  return token
    .replace(/[-_]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2') // camelCase -> palabras
    .trim();
}

/* ------------------------------------------------------------------ *
 *  EMOJIS POR TIPO DE ELEMENTO
 *  Un prefijo visual ayuda a leer el ranking de un vistazo y evita
 *  mostrar etiquetas crudas tipo [svg] / [img].
 * ------------------------------------------------------------------ */

const EMOJI_BUTTON = '🔘';
const EMOJI_LINK = '🔗';
const EMOJI_IMAGE = '🖼️';
const EMOJI_INPUT = '📝';
const EMOJI_ICON = '🔣';
const EMOJI_GENERIC = '📦';

// Devuelve el emoji que mejor representa un tag concreto.
function emojiForTag(tag) {
  switch (tag) {
    case 'BUTTON':
      return EMOJI_BUTTON;
    case 'A':
      return EMOJI_LINK;
    case 'IMG':
    case 'IMAGE':
    case 'PICTURE':
      return EMOJI_IMAGE;
    case 'INPUT':
    case 'TEXTAREA':
    case 'SELECT':
      return EMOJI_INPUT;
    case 'SVG':
    case 'PATH':
    case 'USE':
    case 'G':
    case 'CIRCLE':
    case 'RECT':
    case 'POLYGON':
    case 'LINE':
      return EMOJI_ICON;
    case 'CANVAS':
      return EMOJI_ICON;
    default:
      return EMOJI_GENERIC;
  }
}

// Antepone un emoji a una etiqueta, evitando duplicarlo si ya empieza por uno.
function withEmoji(emoji, label) {
  const text = (label || '').trim();
  if (!emoji) return text;
  if (!text) return emoji;
  // Si la etiqueta ya arranca con el mismo emoji, no lo repetimos.
  if (text.startsWith(emoji)) return text;
  return `${emoji} ${text}`;
}

// Nombre amigable de un tag genérico cuando no hay texto.
function genericTagLabel(tag) {
  switch (tag) {
    case 'IMG':
    case 'IMAGE':
    case 'PICTURE':
      return 'Imagen';
    case 'SVG':
    case 'PATH':
    case 'USE':
    case 'G':
    case 'CIRCLE':
    case 'RECT':
    case 'POLYGON':
    case 'LINE':
      return 'Ícono';
    case 'CANVAS':
      return 'Lienzo';
    default:
      return 'Elemento';
  }
}

// Nombre amigable de un tag interactivo con texto.
function interactiveTagPrefix(tag) {
  switch (tag) {
    case 'A':
      return 'Enlace';
    case 'BUTTON':
      return 'Botón';
    case 'INPUT':
    case 'TEXTAREA':
      return 'Campo';
    case 'SELECT':
      return 'Selector';
    default:
      return null;
  }
}

/**
 * Deriva una ETIQUETA LEGIBLE y una CLAVE de agrupación a partir del elementInfo
 * crudo. La clave agrupa elementos equivalentes (mismo texto/acción) aunque el
 * string original difiera levemente.
 *
 * @param {string} raw       elementInfo tal cual viene de Firestore
 * @param {number} zoneIndex índice de "zona" para etiquetar genéricos sin texto
 * @returns {{ label:string, key:string, generic:boolean }}
 */
function deriveElementLabel(raw, zoneIndex) {
  const parsed = parseElementInfo(raw);

  if (!parsed) {
    return { label: `${EMOJI_GENERIC} Elemento sin identificar`, key: 'unknown', generic: true };
  }

  const { tag, kind, value } = parsed;

  // Guarda: si el elemento llegó SIN tag parseable y tampoco trae un texto/valor
  // útil, devolvemos SIEMPRE una etiqueta genérica con emoji (nunca un string
  // crudo). Evita que se filtren etiquetas tipo '[svg]' o basura sin formato.
  if (!tag && (!value || !String(value).trim())) {
    const zoneLabel = Number.isFinite(zoneIndex)
      ? `Elemento (zona ${zoneIndex})`
      : 'Elemento sin identificar';
    return { label: withEmoji(EMOJI_GENERIC, zoneLabel), key: 'unknown', generic: true };
  }

  // 1) Prioridad máxima: texto visible (enlace/botón) o data-track/aria/alt/title.
  if (kind === 'text' && value) {
    const clean = value.replace(/\s+/g, ' ').trim();
    const prefix = interactiveTagPrefix(tag);
    const base = prefix ? `${prefix}: ${clean}` : clean;
    const emoji = prefix ? emojiForTag(tag) : EMOJI_LINK;
    return { label: withEmoji(emoji, base), key: `text:${clean.toLowerCase()}`, generic: false };
  }

  if (kind === 'track' && value) {
    const human = humanizeToken(value);
    const clean = (human || value).replace(/\s+/g, ' ').trim();
    const emoji = tag ? emojiForTag(tag) : EMOJI_LINK;
    return { label: withEmoji(emoji, clean), key: `track:${value.toLowerCase()}`, generic: false };
  }

  // 2) Id legible (si parece descriptivo).
  if (kind === 'id' && value) {
    const human = humanizeToken(value);
    const emoji = tag ? emojiForTag(tag) : EMOJI_GENERIC;
    return { label: withEmoji(emoji, human || value), key: `id:${value.toLowerCase()}`, generic: false };
  }

  // 3) Genéricos / visuales sin texto: imagen / ícono por zona.
  const isGeneric = GENERIC_TAGS.has(tag) || kind === 'bare' || kind === 'class';
  if (isGeneric) {
    const base = genericTagLabel(tag);
    const emoji = emojiForTag(tag);
    // Si tenía una clase, la usamos como pista discreta.
    if (kind === 'class' && value) {
      const human = humanizeToken(value);
      if (human && human.length <= 22) {
        return {
          label: withEmoji(emoji, `${base} · ${human}`),
          key: `gen:${tag}:${value.toLowerCase()}`,
          generic: true,
        };
      }
    }
    const zoneLabel = Number.isFinite(zoneIndex) ? `${base} (zona ${zoneIndex})` : base;
    return { label: withEmoji(emoji, zoneLabel), key: `gen:${tag}:zone${zoneIndex}`, generic: true };
  }

  // 4) Fallback final.
  const fallback = humanizeToken(value) || tag || 'Elemento';
  const emoji = tag ? emojiForTag(tag) : EMOJI_GENERIC;
  return { label: withEmoji(emoji, fallback), key: `tag:${tag}:${(value || '').toLowerCase()}`, generic: false };
}

/**
 * Lee y agrega los clics de heatmap agrupados por página (path).
 *
 * @param {Object} [options]
 * @param {number} [options.docsLimit=300] Máximo de documentos a leer.
 * @returns {Promise<{
 *   paths: string[],
 *   pageNames: Record<string,string>,
 *   pointsByPath: Record<string, Array<{xNorm:number,yNorm:number,weight:number}>>,
 *   clicksByPath: Record<string, number>,
 *   maxClicks: number,
 *   topElementsByPath: Record<string, Array<{label:string,count:number,generic:boolean}>>,
 *   totalClicks: number,
 *   totalDocs: number,
 *   error: (string|null)
 * }>}
 */
export async function getHeatmapByPage(options = {}) {
  const docsLimit = Number.isFinite(options.docsLimit) ? options.docsLimit : DEFAULT_DOCS_LIMIT;

  const { data, error } = await getCollection(
    HEATMAP_COLLECTION,
    [],
    { field: 'timestamp', direction: 'desc' },
    docsLimit
  );

  // pointsByPath: path -> [{xNorm,yNorm,weight}]
  const pointsByPath = {};
  // elementsByPath: path -> Map(key -> { label, count, generic })
  const elementsByPath = {};
  // clickCountByPath: path -> número total de clics ubicables (para ordenar páginas)
  const clickCountByPath = new Map();
  // Contador de "zonas" genéricas por página (para etiquetar imágenes/íconos sin texto).
  const zoneCounterByPath = {};
  // Cache de zona por (path + tag) para que el mismo ícono caiga en la misma zona.
  const zoneAssignByPath = {};

  let totalClicks = 0;
  const docs = data || [];

  docs.forEach((docData) => {
    const events = Array.isArray(docData?.events) ? docData.events : [];
    events.forEach((ev) => {
      const path = (ev && typeof ev.path === 'string' && ev.path.trim()) ? ev.path : 'unknown';

      const point = normalizePoint(ev);
      if (point) {
        if (!pointsByPath[path]) pointsByPath[path] = [];
        pointsByPath[path].push(point);
        totalClicks += 1;
        clickCountByPath.set(path, (clickCountByPath.get(path) || 0) + 1);
      }

      const rawElement = (ev && typeof ev.elementInfo === 'string' && ev.elementInfo.trim())
        ? ev.elementInfo.trim()
        : null;
      if (!rawElement) return;

      // Asignación de "zona" estable por (path + tag genérico) para no inflar
      // el ranking con decenas de "Imagen (zona N)" distintas.
      const parsedTag = parseElementInfo(rawElement)?.tag || '';
      if (!zoneAssignByPath[path]) zoneAssignByPath[path] = new Map();
      if (!zoneCounterByPath[path]) zoneCounterByPath[path] = 0;
      let zoneIndex = zoneAssignByPath[path].get(parsedTag);
      if (zoneIndex == null) {
        zoneCounterByPath[path] += 1;
        zoneIndex = zoneCounterByPath[path];
        zoneAssignByPath[path].set(parsedTag, zoneIndex);
      }

      const { label, key, generic } = deriveElementLabel(rawElement, zoneIndex);

      if (!elementsByPath[path]) elementsByPath[path] = new Map();
      const m = elementsByPath[path];
      const existing = m.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        m.set(key, { label, count: 1, generic });
      }
    });
  });

  // Ordenar las páginas por cantidad de clics ubicables (descendente).
  const paths = [...clickCountByPath.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([path]) => path);

  // Asegurar que cualquier path que solo tenga elementos (sin puntos válidos)
  // también aparezca en la lista de páginas.
  Object.keys(elementsByPath).forEach((path) => {
    if (!paths.includes(path)) paths.push(path);
  });

  // clicksByPath: total de clics ubicables por página (para las mini-tarjetas).
  const clicksByPath = {};
  let maxClicks = 0;
  paths.forEach((path) => {
    const c = clickCountByPath.get(path) || 0;
    clicksByPath[path] = c;
    if (c > maxClicks) maxClicks = c;
  });

  // pageNames: path -> nombre legible.
  const pageNames = {};
  paths.forEach((path) => {
    pageNames[path] = prettyPageName(path);
  });

  // Construir el ranking de elementos (etiquetas legibles) por página.
  const topElementsByPath = {};
  Object.entries(elementsByPath).forEach(([path, map]) => {
    topElementsByPath[path] = [...map.values()]
      .sort((a, b) => b.count - a.count)
      .slice(0, 25);
  });

  return {
    paths,
    pageNames,
    pointsByPath,
    clicksByPath,
    maxClicks,
    topElementsByPath,
    totalClicks,
    totalDocs: docs.length,
    error: error || null,
  };
}

export default getHeatmapByPage;
