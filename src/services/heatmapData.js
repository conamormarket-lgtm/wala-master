import { getCollectionPaginated } from './firebase/firestore';

/**
 * Servicio de datos para el VISOR DE MAPA DE CALOR.
 *
 * Lee la colección 'heatmap_events' (escrita por src/hooks/useHeatmapTracker.js).
 * Cada documento (LOTE de clics de una visita) tiene la forma:
 *   {
 *     events: [{ x, y, pageX, pageY, screenWidth, screenHeight, path, elementInfo, time }],
 *     timestamp,                                  // serverTimestamp del envío
 *     // Campos NUEVOS por lote (P1) — los lotes VIEJOS no los tienen:
 *     sessionId, uid, clientType ('APP'|'WEB'), device ('Mobile'|'Tablet'|'Desktop')
 *   }
 *
 * Capa 1 — fetchHeatmapBatches({startDateMs,endDateMs}): lectura PAGINADA por
 * rango de fechas (where sobre 'timestamp' + orderBy 'timestamp' desc + cursor),
 * NUNCA la colección entera, con caché en memoria por rango (TTL 30s, misma
 * convención que el lector legacy de analítica): cambiar filtros visuales NO
 * vuelve a leer Firestore.
 *
 * Capa 2 — aggregateHeatmapBatches(docs, filtros): agregación PURA en cliente.
 * Aplana los arrays .events, normaliza las coordenadas de clic respecto al
 * viewport (screenWidth/screenHeight), agrupa por 'path' (página) y aplica los
 * filtros de ORIGEN (clientType), DISPOSITIVO (device — solo lotes nuevos) y el
 * corte RETROACTIVO por ANCHO DE PANTALLA (screenWidth existe en cada clic
 * desde siempre, así que sirve también para el histórico).
 *
 * Además convierte el `elementInfo` crudo (ej. '[svg]', '[IMG]', '[path]',
 * '[BUTTON] "Mi cuenta"') en una ETIQUETA LEGIBLE para humanos, y mapea cada
 * ruta a un NOMBRE de página entendible.
 */

export const HEATMAP_COLLECTION = 'heatmap_events';

// Leemos solo los últimos N documentos para no traer toda la colección
// (cada doc agrupa varios clics, así que 300 docs ya son muchísimos clics).
// Este tope se CONSERVA en la lectura por rango: si el rango tiene más lotes,
// se recorta a los N más recientes y se avisa (flag `truncated`).
const DEFAULT_DOCS_LIMIT = 300;

// Tamaño de página del cursor (lecturas paginadas, nunca un getDocs gigante).
const PAGE_SIZE = 100;

// TTL de la caché en memoria por rango: 30s, la MISMA convención que la caché
// del lector legacy de analítica. Cambiar filtros visuales (origen/dispositivo/
// ancho/ruta) dentro de esa ventana no dispara ninguna lectura nueva.
const CACHE_TTL_MS = 30 * 1000;

// Tope de entradas de la caché (rangos distintos) para no crecer sin límite.
const CACHE_MAX_ENTRIES = 12;

// Caché en memoria: clave `${startMs}|${endMs}|${maxDocs}` -> { at, value }.
const batchesCache = new Map();

/* ------------------------------------------------------------------ *
 *  OPCIONES DE FILTRO (para la UI de DashHeatmap)
 * ------------------------------------------------------------------ */

/**
 * Corte RETROACTIVO por ancho de pantalla: usa `screenWidth`, presente en CADA
 * clic desde el primer día del tracker, por lo que funciona para TODO el
 * histórico (a diferencia de `device`, que solo existe en lotes nuevos).
 */
export const ANCHOS_PANTALLA = [
  { value: 'todos', label: 'Todos', title: 'Sin corte por ancho de pantalla' },
  { value: 'movil', label: 'Móvil', title: 'Pantallas de menos de 768 px' },
  { value: 'tablet', label: 'Tablet', title: 'Pantallas entre 768 y 1024 px' },
  { value: 'desktop', label: 'Desktop', title: 'Pantallas de más de 1024 px' },
];

/**
 * Dispositivo del LOTE (campo nuevo `device`, valores del parser de UA:
 * 'Mobile'|'Tablet'|'Desktop'). Los lotes VIEJOS no lo tienen: la UI debe
 * avisarlo honestamente y ofrecer "incluir sin datos".
 */
export const DISPOSITIVOS_HEATMAP = [
  { value: 'todos', label: 'Todos', title: 'Sin filtro de dispositivo' },
  { value: 'Mobile', label: 'Móvil', title: 'Lotes registrados desde un móvil (solo lotes nuevos)' },
  { value: 'Tablet', label: 'Tablet', title: 'Lotes registrados desde una tablet (solo lotes nuevos)' },
  { value: 'Desktop', label: 'Desktop', title: 'Lotes registrados desde un escritorio (solo lotes nuevos)' },
];

// Clasifica un ancho de pantalla en su bucket ('movil' <768 / 'tablet' 768-1024
// / 'desktop' >1024). null = ancho inválido/ausente (no clasificable).
function bucketAncho(screenWidth) {
  const w = Number(screenWidth);
  if (!Number.isFinite(w) || w <= 0) return null;
  if (w < 768) return 'movil';
  if (w <= 1024) return 'tablet';
  return 'desktop';
}

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

/* ------------------------------------------------------------------ *
 *  CAPA 1 — LECTURA PAGINADA POR RANGO (con caché en memoria)
 * ------------------------------------------------------------------ */

/**
 * fetchHeatmapBatches — lee los LOTES de heatmap_events del rango indicado,
 * paginando con cursor (jamás la colección entera de una vez).
 *
 * Índice: el filtro de rango y el orderBy usan el MISMO campo único
 * ('timestamp'), así que basta el índice automático de campo único de
 * Firestore — NO requiere índice compuesto.
 *
 * Volumen: corta en `maxDocs` (mismo tope de 300 del lector original). Como el
 * orden es descendente, lo recortado son los lotes MÁS ANTIGUOS: `truncated`
 * avisa a la UI para mostrar "mostrando los N más recientes".
 *
 * Caché: en memoria por (rango, maxDocs) con TTL de 30s → cambiar los filtros
 * visuales (origen/dispositivo/ancho/ruta) NO relee Firestore.
 *
 * @param {Object} [options]
 * @param {number} [options.startDateMs]  Inicio del rango (epoch ms). Opcional.
 * @param {number} [options.endDateMs]    Fin del rango (epoch ms). Opcional.
 * @param {number} [options.maxDocs=300]  Tope duro de lotes a leer.
 * @returns {Promise<{ docs: Array<Object>, truncated: boolean, maxDocs: number, error: (string|null) }>}
 */
export async function fetchHeatmapBatches(options = {}) {
  const startDateMs = Number.isFinite(options.startDateMs) ? options.startDateMs : null;
  const endDateMs = Number.isFinite(options.endDateMs) ? options.endDateMs : null;
  const maxDocs = Number.isFinite(options.maxDocs) && options.maxDocs > 0
    ? Math.round(options.maxDocs)
    : DEFAULT_DOCS_LIMIT;

  // Caché por rango: mismo rango dentro del TTL → cero lecturas nuevas.
  const cacheKey = `${startDateMs ?? ''}|${endDateMs ?? ''}|${maxDocs}`;
  const hit = batchesCache.get(cacheKey);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value;

  // El SDK convierte Date -> Timestamp de Firestore automáticamente.
  const filters = [];
  if (startDateMs != null) filters.push({ field: 'timestamp', operator: '>=', value: new Date(startDateMs) });
  if (endDateMs != null) filters.push({ field: 'timestamp', operator: '<=', value: new Date(endDateMs) });

  const docs = [];
  let lastDoc = null;
  let hasMore = true;
  let error = null;

  while (hasMore && docs.length < maxDocs) {
    const pageSize = Math.min(PAGE_SIZE, maxDocs - docs.length);
    // Secuencial a propósito: cada página necesita el cursor de la anterior.
    // eslint-disable-next-line no-await-in-loop
    const page = await getCollectionPaginated(
      HEATMAP_COLLECTION,
      filters,
      { field: 'timestamp', direction: 'desc' },
      pageSize,
      lastDoc
    );
    if (page.error) {
      error = page.error;
      break;
    }
    docs.push(...(page.data || []));
    lastDoc = page.lastDoc || null;
    hasMore = Boolean(page.hasMore && page.lastDoc);
  }

  // Aviso de recorte SIN falso positivo (FIX auditoría): `hasMore` de la última
  // página solo dice que vino llena (length === pageSize), lo que también pasa
  // cuando había EXACTAMENTE maxDocs lotes y no queda nada más. Sonda BARATA de
  // 1 doc con el cursor: el aviso solo se muestra si de verdad existe al menos
  // un lote más antiguo (máx. 1 lectura extra, y solo al alcanzar el tope).
  let truncated = false;
  if (!error && hasMore && docs.length >= maxDocs && lastDoc) {
    const probe = await getCollectionPaginated(
      HEATMAP_COLLECTION,
      filters,
      { field: 'timestamp', direction: 'desc' },
      1,
      lastDoc
    );
    // Si la sonda falla, preferimos avisar de más (posible recorte) que ocultar
    // un recorte real; la lectura principal ya terminó sin error.
    truncated = probe.error ? true : (probe.data || []).length > 0;
  }
  const value = { docs, truncated, maxDocs, error };

  // Solo cacheamos lecturas sin error (un error transitorio no debe "pegarse").
  if (!error) {
    if (batchesCache.size >= CACHE_MAX_ENTRIES) {
      // Descarta la entrada más vieja (los Map iteran en orden de inserción).
      const oldestKey = batchesCache.keys().next().value;
      batchesCache.delete(oldestKey);
    }
    batchesCache.set(cacheKey, { at: Date.now(), value });
  }
  return value;
}

/* ------------------------------------------------------------------ *
 *  CAPA 2 — AGREGACIÓN PURA CON FILTROS (sin lecturas)
 * ------------------------------------------------------------------ */

/**
 * aggregateHeatmapBatches — agrega los lotes YA LEÍDOS aplicando los filtros.
 * Función PURA (sin red): se puede re-ejecutar al vuelo con cada cambio de
 * filtro visual sin costo de lecturas.
 *
 * Filtros por LOTE (solo lotes nuevos traen los campos):
 *   - origen:      'todos'|'app'|'web'  vs. doc.clientType ('APP'|'WEB')
 *   - dispositivo: 'todos'|'Mobile'|'Tablet'|'Desktop' vs. doc.device
 *   - incluirSinMeta: si true, los lotes VIEJOS (sin clientType/device) se
 *     incluyen aunque haya filtro de origen/dispositivo activo (la UI lo
 *     ofrece junto al aviso honesto); si false (default), quedan fuera.
 *
 * Filtro por CLIC (retroactivo, funciona para todo el histórico):
 *   - ancho: 'todos'|'movil'|'tablet'|'desktop' según ev.screenWidth
 *     (<768 / 768–1024 / >1024).
 *
 * @param {Array<Object>} docs   Lotes crudos de fetchHeatmapBatches.
 * @param {Object} [filtros]
 * @returns {{
 *   paths: string[],
 *   pageNames: Record<string,string>,
 *   pointsByPath: Record<string, Array<{xNorm:number,yNorm:number,weight:number}>>,
 *   clicksByPath: Record<string, number>,
 *   maxClicks: number,
 *   topElementsByPath: Record<string, Array<{label:string,count:number,generic:boolean}>>,
 *   totalClicks: number,
 *   totalDocs: number,
 *   batchesUsados: number,
 *   batchesExcluidos: number,
 *   batchesSinMeta: number,
 *   clicksSinMeta: number
 * }}
 */
export function aggregateHeatmapBatches(docs = [], filtros = {}) {
  const origen = filtros.origen || 'todos';
  const dispositivo = filtros.dispositivo || 'todos';
  const ancho = filtros.ancho || 'todos';
  const incluirSinMeta = Boolean(filtros.incluirSinMeta);

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
  // Métricas de HONESTIDAD: cuántos lotes del rango NO traen origen/dispositivo
  // (anteriores al despliegue de los campos nuevos) y cuántos clics contienen.
  let batchesSinMeta = 0;
  let clicksSinMeta = 0;
  let batchesUsados = 0;
  let batchesExcluidos = 0;

  const lista = Array.isArray(docs) ? docs : [];

  lista.forEach((docData) => {
    const events = Array.isArray(docData?.events) ? docData.events : [];
    const clientType = typeof docData?.clientType === 'string'
      ? docData.clientType.trim().toUpperCase()
      : null;
    const device = typeof docData?.device === 'string' ? docData.device.trim() : null;

    // Lote VIEJO = sin ninguno de los campos nuevos (se escriben juntos).
    if (clientType == null && device == null) {
      batchesSinMeta += 1;
      clicksSinMeta += events.length;
    }

    // -- Filtros a nivel de LOTE (origen / dispositivo) --
    if (origen !== 'todos') {
      if (clientType == null) {
        if (!incluirSinMeta) {
          batchesExcluidos += 1;
          return;
        }
      } else if (clientType !== origen.toUpperCase()) {
        batchesExcluidos += 1;
        return;
      }
    }
    if (dispositivo !== 'todos') {
      if (device == null) {
        if (!incluirSinMeta) {
          batchesExcluidos += 1;
          return;
        }
      } else if (device !== dispositivo) {
        batchesExcluidos += 1;
        return;
      }
    }
    batchesUsados += 1;

    events.forEach((ev) => {
      // -- Filtro a nivel de CLIC: corte retroactivo por ancho de pantalla --
      if (ancho !== 'todos' && bucketAncho(ev?.screenWidth) !== ancho) return;

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
    totalDocs: lista.length,
    batchesUsados,
    batchesExcluidos,
    batchesSinMeta,
    clicksSinMeta,
  };
}

/**
 * getHeatmapByPage — API RETROCOMPATIBLE (lee + agrega en un paso).
 *
 * Sin opciones se comporta como siempre: últimos 300 lotes, sin filtros (modo
 * autónomo de HeatmapViewer). Acepta además rango y filtros para quien prefiera
 * el paso único; DashHeatmap usa las dos capas por separado para re-filtrar
 * sin releer.
 *
 * @param {Object} [options]
 * @param {number} [options.docsLimit=300]  Máximo de lotes a leer.
 * @param {number} [options.startDateMs]    Inicio del rango (epoch ms).
 * @param {number} [options.endDateMs]      Fin del rango (epoch ms).
 * @param {Object} [options.filtros]        Filtros de aggregateHeatmapBatches.
 * @returns {Promise<Object>} La salida de aggregateHeatmapBatches más
 *   { truncated, error }.
 */
export async function getHeatmapByPage(options = {}) {
  const docsLimit = Number.isFinite(options.docsLimit) ? options.docsLimit : DEFAULT_DOCS_LIMIT;
  const { docs, truncated, error } = await fetchHeatmapBatches({
    startDateMs: options.startDateMs,
    endDateMs: options.endDateMs,
    maxDocs: docsLimit,
  });
  const agregado = aggregateHeatmapBatches(docs, options.filtros || {});
  return {
    ...agregado,
    truncated,
    error: error || null,
  };
}

export default getHeatmapByPage;
