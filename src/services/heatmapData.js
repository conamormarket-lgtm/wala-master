import { getCollectionPaginated } from './firebase/firestore';

/**
 * Servicio de datos para el VISOR DE MAPA DE CALOR.
 *
 * Lee la colección 'heatmap_events' (escrita por src/hooks/useHeatmapTracker.js).
 * Cada documento (LOTE de clics de una visita) tiene la forma:
 *   {
 *     events: [{ x, y, pageX, pageY, pageHeight, screenWidth, screenHeight, path, elementInfo, time }],
 *     // pageHeight existe solo en clics registrados desde el 2026-10-15.
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
 * Aplana los arrays .events, ubica cada clic dentro de la página completa
 * (pageY / pageHeight; ver normalizePoint), agrupa por 'path' (página) y aplica los
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
  { value: 'todos', label: 'Todos', title: 'Todos los dispositivos' },
  { value: 'movil', label: 'Móvil', title: 'Pantallas de menos de 768 px' },
  { value: 'tablet', label: 'Tablet', title: 'Pantallas entre 768 y 1024 px' },
  { value: 'desktop', label: 'Computadora', title: 'Pantallas de más de 1024 px' },
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
// En la APP (Android: teléfonos y tablets) no hay "computadora": una tablet en
// horizontal pasa de 1024 px y se cuenta como tablet.
function bucketAncho(screenWidth, esApp = false) {
  const w = Number(screenWidth);
  if (!Number.isFinite(w) || w <= 0) return null;
  if (w < 768) return 'movil';
  if (w <= 1024 || esApp) return 'tablet';
  return 'desktop';
}

// Fecha en ms desde un Timestamp de Firestore, {seconds}, ISO o número.
function msDe(valor) {
  if (valor == null) return null;
  if (typeof valor.toMillis === 'function') return valor.toMillis();
  if (Number.isFinite(valor.seconds)) return valor.seconds * 1000;
  const ms = typeof valor === 'number' ? valor : Date.parse(valor);
  return Number.isFinite(ms) ? ms : null;
}

function clamp01(n) {
  if (!Number.isFinite(n)) return null;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

/**
 * Normaliza un evento de clic a una posición dentro de la PÁGINA COMPLETA:
 *   - xNorm:    0..1 del ancho de la pantalla.
 *   - yFrac:    0..1 del alto total de la página (pageY / pageHeight). Solo
 *               los clics nuevos traen pageHeight; los viejos dan null.
 *   - yScreens: cuántas pantallas por debajo del inicio cayó el clic
 *               (pageY / screenHeight). Sirve para ubicar de forma
 *               APROXIMADA los clics viejos, que no traen pageHeight.
 *   - ancho:    bucket de ancho de pantalla ('movil'|'tablet'|'desktop').
 *   - px/py:    pageX/pageY en px y sw/sh: ancho/alto de la pantalla. Con la
 *               vista previa cargada en ESA misma resolución, el clic se pinta
 *               en su pixel exacto (el layout es idéntico al del visitante).
 *   - sel/rx/ry: ANCLA (clics desde el 2026-10-15): ruta CSS del elemento
 *               clicado y posición relativa dentro de él. El visor busca ese
 *               elemento en la vista previa y pinta el punto encima: es la
 *               posición más fiable, sirva la pantalla que sirva.
 * Devuelve null si el evento no es válido / no se puede normalizar.
 */
function normalizePoint(ev, esApp = false) {
  if (!ev || typeof ev !== 'object') return null;

  const width = Number(ev.screenWidth);
  const height = Number(ev.screenHeight);
  if (!Number.isFinite(width) || width <= 0) return null;
  if (!Number.isFinite(height) || height <= 0) return null;

  const rawX = Number(ev.x);
  if (!Number.isFinite(rawX)) return null;
  const xNorm = clamp01(rawX / width);
  if (xNorm === null) return null;

  // pageY = posición en la página; si falta (no debería), cae a la de la ventana.
  const pageY = Number.isFinite(Number(ev.pageY)) ? Number(ev.pageY) : Number(ev.y);
  if (!Number.isFinite(pageY) || pageY < 0) return null;

  const pageHeight = Number(ev.pageHeight);
  const yFrac = Number.isFinite(pageHeight) && pageHeight > 0
    ? clamp01(pageY / pageHeight)
    : null;

  const pageX = Number.isFinite(Number(ev.pageX)) ? Number(ev.pageX) : rawX;

  return {
    xNorm,
    yFrac,
    yScreens: pageY / height,
    // Altura del clic dentro de la PANTALLA (0..1): sirve para ubicar los
    // clics en elementos fijos (barra de abajo, cabecera), que no se mueven.
    vy: Number.isFinite(Number(ev.y)) ? clamp01(Number(ev.y) / height) : null,
    ancho: bucketAncho(width, esApp),
    // Clic hecho desde la app de Android (el lote trae clientType 'APP').
    app: Boolean(esApp),
    px: pageX,
    py: pageY,
    sw: Math.round(width),
    sh: Math.round(height),
    sel: typeof ev.sel === 'string' && ev.sel ? ev.sel : null,
    // Sección del builder y ruta dentro de ella (clics nuevos en páginas del
    // builder): ubica el clic aunque la sección cambie de lugar.
    seccion: typeof ev.seccion === 'string' && ev.seccion ? ev.seccion : null,
    selSec: typeof ev.selSec === 'string' ? ev.selSec : null,
    // Versión de la página (fecha de su último guardado en el builder).
    version: ev.version != null && ev.version !== '' ? String(ev.version) : null,
    rx: Number.isFinite(Number(ev.rx)) ? Number(ev.rx) : 0.5,
    ry: Number.isFinite(Number(ev.ry)) ? Number(ev.ry) : 0.5,
    weight: 1,
  };
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

// Páginas cuya ruta lleva un CÓDIGO (id de producto, de diseño, de pedido…).
// Todas las de una misma plantilla comparten diseño, así que se AGRUPAN en una
// sola tarjeta con nombre legible (en vez de "ARsHnlp8ccNYTt…" o "PD MV8MWU6Q").
// La vista previa usa la página concreta con más clics del grupo.
const PLANTILLAS_CON_CODIGO = [
  { re: /^\/producto\/[^/]+$/, key: '/producto/:id', name: 'Ficha de producto' },
  { re: /^\/crear\/[^/]+$/, key: '/crear/:id', name: 'Crear · diseño' },
  { re: /^\/combo\/[^/]+$/, key: '/combo/:id', name: 'Crear · combo' },
  { re: /^\/ver\/[^/]+$/, key: '/ver/:id', name: 'Ver diseño' },
  { re: /^\/creacion\/[^/]+$/, key: '/creacion/:id', name: 'Creación compartida' },
  { re: /^\/editor\/[^/]+$/, key: '/editor/:id', name: 'Editor de producto' },
  { re: /^\/cuenta\/pedidos\/[^/]+$/, key: '/cuenta/pedidos/:id', name: 'Detalle de pedido' },
  { re: /^\/pago-rapido\/[^/]+$/, key: '/pago-rapido/:id', name: 'Pago rápido' },
  { re: /^\/pago-demo\/[^/]+$/, key: '/pago-demo/:id', name: 'Pago (demo)' },
  { re: /^\/regalo\/[^/]+$/, key: '/regalo/:id', name: 'Experiencia de regalo' },
  { re: /^\/regalar\/[^/]+$/, key: '/regalar/:codigo', name: 'Regalar a un amigo' },
  { re: /^\/invitar\/[^/]+$/, key: '/invitar/:codigo', name: 'Invitación de referido' },
  { re: /^\/wishlist\/[^/]+$/, key: '/wishlist/:codigo', name: 'Lista de deseos compartida' },
];

// Páginas con un SLUG legible (nicho, sorteo, landing…): se quedan separadas
// y el nombre incluye el slug ("Nicho · Mascotas").
const PATTERN_PATH_NAMES = [
  { re: /^\/nicho\/([^/]+)$/, name: 'Nicho' },
  { re: /^\/tienda-vendedor\/([^/]+)$/, name: 'Tienda' },
  { re: /^\/sorteos\/([^/]+)$/, name: 'Sorteo' },
  { re: /^\/suscrito-sorteo\/([^/]+)$/, name: 'Sorteo · suscrito' },
  { re: /^\/l\/([^/]+)$/, name: 'Enlaces' },
];

// Páginas del panel admin: no son de clientes, no se muestran en el mapa
// (y el tracker ya no las registra).
export function esRutaAdmin(path) {
  return typeof path === 'string' && /^\/admin(\/|$)/.test(path);
}

function limpiarRuta(path) {
  let clean = String(path).split('?')[0].split('#')[0];
  if (clean.length > 1 && clean.endsWith('/')) clean = clean.slice(0, -1);
  return clean === '' ? '/' : clean;
}

function slugLegible(slug) {
  let texto = slug;
  try {
    texto = decodeURIComponent(slug);
  } catch {
    /* slug mal codificado: se usa tal cual */
  }
  const words = texto.replace(/[-_]+/g, ' ').trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : slug;
}

/**
 * Clave de agrupación de una ruta: la plantilla ('/producto/:id') si lleva
 * código, o la ruta limpia si no. null = página que no se muestra (admin).
 */
export function claveDePagina(path) {
  if (!path || typeof path !== 'string' || path === 'unknown') return 'unknown';
  const clean = limpiarRuta(path);
  if (esRutaAdmin(clean)) return null;
  const plantilla = PLANTILLAS_CON_CODIGO.find(({ re }) => re.test(clean));
  return plantilla ? plantilla.key : clean;
}

/**
 * Devuelve un nombre de página legible a partir de su path.
 */
export function prettyPageName(path) {
  if (!path || typeof path !== 'string') return 'Desconocida';
  if (path === 'unknown') return 'Desconocida';

  const clean = limpiarRuta(path);

  if (EXACT_PATH_NAMES[clean]) return EXACT_PATH_NAMES[clean];

  const plantilla = PLANTILLAS_CON_CODIGO.find((t) => t.key === clean || t.re.test(clean));
  if (plantilla) return plantilla.name;

  for (const { re, name } of PATTERN_PATH_NAMES) {
    const m = clean.match(re);
    if (m) return `${name} · ${slugLegible(m[1])}`;
  }

  // Fallback (landings /:slug y rutas nuevas): el último segmento legible.
  const segs = clean.split('/').filter(Boolean);
  if (segs.length === 0) return 'Inicio';
  return slugLegible(segs[segs.length - 1]) || clean;
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

// Tipo legible del elemento según su etiqueta HTML.
function tipoDeTag(tag) {
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
    case 'LABEL':
      return 'Opción';
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
    case 'CANVAS':
      return 'Ícono';
    default:
      // Clic fuera de un botón/enlace (en un recuadro, un texto, un fondo).
      return 'Zona';
  }
}

// Texto visible limpio: sin emojis ni símbolos sueltos al inicio y con los
// espacios normalizados. null si no queda nada legible (el "!" de un globo de
// aviso, un contador "6 1"…): ese elemento se muestra como "sin texto".
function textoLegible(value) {
  if (!value) return null;
  const limpio = String(value)
    .replace(/[\p{Extended_Pictographic}\uFE0F\u200D]/gu, '')
    .replace(/\s+/g, ' ')
    .replace(/^[^\p{L}\p{N}]+/u, '')
    .trim();
  return /\p{L}/u.test(limpio) ? limpio : null;
}

/**
 * Deriva la ETIQUETA de un elemento clicado a partir del elementInfo crudo:
 *   { tipo: 'Enlace'|'Botón'|'Imagen'|'Ícono'|'Campo'|'Selector'|'Opción'|'Zona',
 *     texto: 'Crear' | null, label: 'Enlace: Crear', key, generic }
 * Los elementos con el mismo tipo y texto se agrupan (el "Crear" del menú y
 * el del pie suman juntos). Sin texto legible, cada elemento se separa por su
 * ancla (`sel`) si la hay; si no, uno por tipo.
 *
 * @param {string} raw  elementInfo tal cual viene de Firestore
 * @param {string|null} sel  ruta CSS del ancla del clic (clics nuevos)
 */
// Un mismo control con nombres distintos según la pantalla: se unen en uno.
// (Desde 2026-10-15 el botón lleva data-track y ya llega con el nombre bueno;
// esto une los clics anteriores.)
const ALIAS_ELEMENTOS = {
  'Botón:buscar': 'Abrir el buscador',
  'Botón:buscar productos, marcas y categorías': 'Abrir el buscador',
};

function deriveElementLabel(raw, sel, capa = null) {
  const parsed = parseElementInfo(raw);
  const tipo = tipoDeTag(parsed?.tag || '');

  let texto = null;
  if (parsed?.kind === 'text') texto = textoLegible(parsed.value);
  else if (parsed?.kind === 'track' || parsed?.kind === 'id') texto = textoLegible(humanizeToken(parsed.value));

  // El tracker corta el texto a 40 caracteres: se marca con "…" si llegó cortado.
  if (texto && String(parsed.value).length >= 39) texto = `${texto}…`;
  if (texto && ALIAS_ELEMENTOS[`${tipo}:${texto.toLowerCase()}`]) {
    texto = ALIAS_ELEMENTOS[`${tipo}:${texto.toLowerCase()}`];
  }

  // Clic dentro de una VENTANA (modal, panel del buscador…): se agrupa aparte
  // ("Cerrar" de una ventana no es el "Cerrar" de otra) y se nombra la ventana.
  const prefijo = capa ? `ventana:${capa.toLowerCase()}|` : '';
  if (texto) {
    return {
      tipo, texto, capa, label: `${tipo}: ${texto}`, key: `${prefijo}${tipo}:${texto.toLowerCase()}`, generic: false,
    };
  }
  return {
    tipo,
    texto: null,
    capa,
    label: `${tipo} sin texto`,
    key: `${prefijo}${sel ? `sel:${sel}` : `tipo:${tipo}`}`,
    generic: true,
  };
}

// Clics viejos sobre la barra de admin (antes se registraban): no son de clientes.
function esClicDeAdmin(ev) {
  return typeof ev?.elementInfo === 'string'
    && /Modo Administrador Activo|Panel de Administraci[oó]n|Edici[oó]n Visual/i.test(ev.elementInfo);
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
 *   pointsByPath: Record<string, Array<{xNorm,yFrac,yScreens,ancho,px,py,sw,sh,weight}>>,
 *   previewPathByPath: Record<string,string>,  // página concreta para la vista previa
 *   clicsAntesByPath: Record<string,number>,   // clics anteriores al último cambio del builder
 *   variantesByPath: Record<string,number>,    // nº de páginas concretas del grupo
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
  // Fecha del último cambio en el builder de cada página (ruta -> ms) y si se
  // quieren solo los clics hechos DESPUÉS de ese cambio (el diseño actual).
  // Un clic anterior al último cambio se hizo sobre otro diseño de la página.
  const versionesPorRuta = filtros.versionesPorRuta || null;
  const soloDisenoActual = Boolean(filtros.soloDisenoActual);
  const clicsAntesByPath = {};

  // pointsByPath: clave de página -> [{xNorm,yFrac,yScreens,ancho,px,py,sw,sh,weight}]
  // (la clave agrupa las páginas con código: '/producto/:id'; ver claveDePagina).
  const pointsByPath = {};
  // Clics por página CONCRETA dentro de cada clave (para elegir la vista previa).
  const concretasByPath = {};
  // elementsByPath: path -> Map(key -> { label, count, generic })
  const elementsByPath = {};
  // clickCountByPath: path -> número total de clics ubicables (para ordenar páginas)
  const clickCountByPath = new Map();

  let totalClicks = 0;
  // Métricas de HONESTIDAD: cuántos lotes del rango NO traen origen/dispositivo
  // (anteriores al despliegue de los campos nuevos) y cuántos clics contienen.
  let batchesSinMeta = 0;
  let clicksSinMeta = 0;
  let batchesUsados = 0;
  let batchesExcluidos = 0;

  const lista = Array.isArray(docs) ? docs : [];

  lista.forEach((docData) => {
    const tLote = msDe(docData?.timestamp);
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
      if (ancho !== 'todos' && bucketAncho(ev?.screenWidth, clientType === 'APP') !== ancho) return;

      const rawPath = (ev && typeof ev.path === 'string' && ev.path.trim()) ? ev.path.trim() : 'unknown';
      const path = claveDePagina(rawPath);
      if (path == null) return; // panel admin: fuera del mapa
      if (esClicDeAdmin(ev)) return; // barra de admin: fuera del mapa

      // ¿Clic anterior al último cambio de esta página en el builder?
      const t = msDe(ev?.time) ?? tLote;
      const version = versionesPorRuta
        ? (versionesPorRuta[path] ?? versionesPorRuta[path.toLowerCase()] ?? null)
        : null;
      const antes = Boolean(version && t && t < version);
      if (antes) clicsAntesByPath[path] = (clicsAntesByPath[path] || 0) + 1;
      if (antes && soloDisenoActual) return;

      if (!concretasByPath[path]) concretasByPath[path] = new Map();
      const concreta = rawPath === 'unknown' ? rawPath : limpiarRuta(rawPath);
      concretasByPath[path].set(concreta, (concretasByPath[path].get(concreta) || 0) + 1);

      const rawElement = (ev && typeof ev.elementInfo === 'string' && ev.elementInfo.trim())
        ? ev.elementInfo.trim()
        : null;
      const elemento = rawElement
        ? deriveElementLabel(
          rawElement,
          typeof ev.sel === 'string' ? ev.sel : null,
          typeof ev.capa === 'string' && ev.capa ? ev.capa : null
        )
        : null;

      const point = normalizePoint(ev, clientType === 'APP');
      if (point) {
        point.t = t;
        point.antes = antes;
      }
      if (point) {
        // `el` enlaza el punto con su fila del ranking (para señalarlo).
        point.el = elemento ? elemento.key : null;
        if (!pointsByPath[path]) pointsByPath[path] = [];
        pointsByPath[path].push(point);
        totalClicks += 1;
        clickCountByPath.set(path, (clickCountByPath.get(path) || 0) + 1);
      }

      if (!elemento) return;
      if (!elementsByPath[path]) elementsByPath[path] = new Map();
      const m = elementsByPath[path];
      const existing = m.get(elemento.key);
      if (existing) {
        existing.count += 1;
      } else {
        m.set(elemento.key, { ...elemento, count: 1 });
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

  // pageNames: clave -> nombre legible; vista previa = la página concreta
  // con más clics del grupo; variantes = cuántas páginas concretas agrupa.
  const pageNames = {};
  const previewPathByPath = {};
  const variantesByPath = {};
  paths.forEach((path) => {
    pageNames[path] = prettyPageName(path);
    const concretas = [...(concretasByPath[path] || new Map()).entries()].sort((a, b) => b[1] - a[1]);
    previewPathByPath[path] = concretas.length > 0 ? concretas[0][0] : path;
    variantesByPath[path] = concretas.length;
  });

  // Construir el ranking de elementos (etiquetas legibles) por página.
  const topElementsByPath = {};
  Object.entries(elementsByPath).forEach(([path, map]) => {
    const top = [...map.values()]
      .sort((a, b) => b.count - a.count)
      .slice(0, 25);
    // Varios "Ícono sin texto" distintos se numeran para poder distinguirlos.
    const totalSinTexto = {};
    top.forEach((e) => {
      if (!e.texto) totalSinTexto[e.tipo] = (totalSinTexto[e.tipo] || 0) + 1;
    });
    const vistos = {};
    top.forEach((e) => {
      if (e.texto || totalSinTexto[e.tipo] < 2) return;
      vistos[e.tipo] = (vistos[e.tipo] || 0) + 1;
      e.sufijo = vistos[e.tipo];
    });
    topElementsByPath[path] = top;
  });

  return {
    paths,
    pageNames,
    pointsByPath,
    previewPathByPath,
    variantesByPath,
    clicksByPath,
    maxClicks,
    topElementsByPath,
    totalClicks,
    totalDocs: lista.length,
    batchesUsados,
    batchesExcluidos,
    batchesSinMeta,
    clicksSinMeta,
    clicsAntesByPath,
  };
}

/**
 * Fecha del último cambio en el builder de cada página, por RUTA (en minúsculas):
 * los docs de la colección `pages` (id = 'home', 'tienda' o el slug de una
 * landing; updatedAt lo pone setDocument al guardar). 'home' es '/' y '/home'.
 * Sirve para saber si un clic se hizo sobre el diseño actual de la página.
 *
 * @param {Array<{id:string, updatedAt:any}>} paginas
 * @returns {Record<string, number>}
 */
export function versionesDesdePaginas(paginas = []) {
  const versiones = {};
  (Array.isArray(paginas) ? paginas : []).forEach((pagina) => {
    const ms = msDe(pagina?.updatedAt);
    if (!pagina?.id || !ms) return;
    const id = String(pagina.id).toLowerCase();
    if (id === 'home') {
      versiones['/'] = ms;
      versiones['/home'] = ms;
    } else {
      versiones[`/${id}`] = ms;
    }
  });
  return versiones;
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
