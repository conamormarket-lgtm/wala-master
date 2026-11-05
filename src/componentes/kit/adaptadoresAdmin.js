/*
 * Adaptadores del panel administrativo (guía: guia/ADMIN.md). Aparte de
 * adaptadores.js para no ir en el archivo principal de la tienda. Sin
 * imports: se prueban solos (adaptadoresAdmin.test.mjs). Los íconos van como
 * nombre (`icono`); MarcoAdmin los dibuja con ICONOS_ADMIN.
 */

/* ── Menú y permisos ───────────────────────────────────── */

/*
 * Permisos (los de AdminConfiguracion): 'superadmin' lo abre todo.
 * Cada opción dice qué permiso pide (`permiso`: uno de la lista basta;
 * `todos`: hacen falta todos). Sin `permiso`, la ve cualquier admin.
 * Las reglas son las mismas de AdminLayout:
 *  - diseño (manage_design): recepción, pagos, sorteos, enlaces, avisos,
 *    datos para recomendar, editar la tienda, destacados, WhatsApp,
 *    backups, Kapi y los juegos
 *  - productos (manage_products): el catálogo y las recompensas; landing
 *    pages y temas piden además manage_landing_pages
 *  - inventario (manage_inventory): Productos, solo para cambiar el stock
 *    (Inventario se unió a Productos el 2026-11-04)
 *  - clientes (manage_clients): reclamos,
 *    referidos, encuesta, popups, fechas, retos, misiones
 *  - Resultados: diseño o clientes; Clientes y Opiniones, solo clientes
 *  - Configuración: solo superadmin
 * Diferencia a propósito: "Inicio" lo ve cualquier admin (antes el enlace
 * estaba en el grupo de diseño, aunque /admin ya abría para todos).
 */
const DISENO = ['manage_design'];
const PRODUCTOS = ['manage_products'];
// Productos también lleva el stock (Inventario se unió el 2026-11-04): quien solo tiene inventario lo cambia ahí.
const PRODUCTOS_O_STOCK = ['manage_products', 'manage_inventory'];
const CLIENTES = ['manage_clients'];

export const MENU_ADMIN = [
  {
    id: 'inicio', titulo: 'Inicio', icono: 'inicio', tono: 'degradado', suelto: true,
    items: [{ to: '/admin', texto: 'Inicio', icono: 'inicio', exacto: true }],
  },
  {
    id: 'pedidos', titulo: 'Pedidos y pagos', icono: 'pedidos', tono: 'menta',
    items: [
      { to: '/admin/recepcion-pedidos', texto: 'Recepción de pedidos', icono: 'pedidos', permiso: DISENO },
      { to: '/admin/gestion-pagos', texto: 'Gestión de pagos', icono: 'pagos', permiso: DISENO },
      { to: '/admin/libro-reclamaciones', texto: 'Libro de reclamaciones', icono: 'reclamos', permiso: CLIENTES },
    ],
  },
  {
    id: 'catalogo', titulo: 'Catálogo', icono: 'catalogo', tono: 'degradado',
    items: [
      { to: '/admin/productos', texto: 'Productos', icono: 'productos', permiso: PRODUCTOS_O_STOCK },
      // Destacados ordena la fila «Destacados» del inicio y las marcas (Productos solo marca cuáles).
      { to: '/admin/destacados', texto: 'Destacados', icono: 'destacados', permiso: DISENO },
      { to: '/admin/categorias', texto: 'Categorías', icono: 'categorias', permiso: PRODUCTOS },
      { to: '/admin/colecciones', texto: 'Colecciones', icono: 'colecciones', permiso: PRODUCTOS },
      { to: '/admin/marcas', texto: 'Marcas', icono: 'marcas', permiso: PRODUCTOS },
      { to: '/admin/atributos-catalogo', texto: 'Atributos del catálogo', icono: 'atributos', permiso: PRODUCTOS },
      { to: '/admin/envios', texto: 'Zonas de envío', icono: 'envios', permiso: PRODUCTOS },
      { to: '/admin/publico-productos', texto: 'Datos para recomendar', icono: 'recomendar', permiso: DISENO },
    ],
  },
  {
    // Una sola entrada (como Inicio): sus secciones son las pestañas de la página
    // (antes estaban también aquí, repetidas). `claves`: lo encuentra el buscador.
    id: 'resultados', titulo: 'Resultados', icono: 'resultados', tono: 'oro', suelto: true,
    items: [
      {
        to: '/admin/resultados', texto: 'Resultados', icono: 'resultados', permiso: [...DISENO, ...CLIENTES],
        claves: 'resumen métricas ventas productos más vistos visitantes clientes carritos abandonados cumpleaños opiniones encuestas detalle técnico mapa de calor',
      },
    ],
  },
  {
    id: 'clientes', titulo: 'Clientes', icono: 'clientes', tono: 'rosa',
    items: [
      { to: '/admin/referidos', texto: 'Referidos', icono: 'referidos', permiso: CLIENTES },
      { to: '/admin/recompensas', texto: 'Recompensas', icono: 'recompensas', permiso: PRODUCTOS },
      { to: '/admin/misiones', texto: 'Misiones diarias', icono: 'misiones', permiso: CLIENTES },
      { to: '/admin/retos', texto: 'Retos semanales', icono: 'retos', permiso: CLIENTES },
      { to: '/admin/notificaciones', texto: 'Notificaciones y ofertas', icono: 'notificaciones', permiso: DISENO },
      { to: '/admin/fechas-importantes', texto: 'Fechas importantes', icono: 'fechas', permiso: CLIENTES },
      { to: '/admin/encuestas', texto: 'Encuesta de suscripción', icono: 'encuesta', permiso: CLIENTES },
    ],
  },
  {
    id: 'campanas', titulo: 'Campañas', icono: 'campanas', tono: 'oro',
    items: [
      { to: '/admin/sorteos', texto: 'Sorteos y rifas', icono: 'sorteos', permiso: DISENO },
      { to: '/admin/sorteos-suscripcion', texto: 'Sorteo por suscripción', icono: 'suscripcion', permiso: DISENO },
      { to: '/admin/enlaces', texto: 'Enlaces útiles', icono: 'enlaces', permiso: DISENO },
      { to: '/admin/popups', texto: 'Popups y anuncios', icono: 'popups', permiso: CLIENTES },
      { to: '/admin/landing-pages', texto: 'Landing pages', icono: 'landings', permiso: [...PRODUCTOS, 'manage_landing_pages'], todos: true },
    ],
  },
  {
    id: 'diseno', titulo: 'Diseño y juegos', icono: 'diseno', tono: 'rosa',
    items: [
      { to: '/admin/wordle', texto: 'La Palabra del día', icono: 'palabra', permiso: DISENO },
      { to: '/admin/ruleta', texto: 'La Ruleta de Kapi', icono: 'ruleta', permiso: DISENO },
      { to: '/admin/bolitas', texto: 'Las Bolitas de Kapi', icono: 'bolitas', permiso: DISENO },
    ],
  },
  {
    id: 'ajustes', titulo: 'Ajustes', icono: 'ajustes', tono: 'plata',
    items: [
      { to: '/admin/configuracion', texto: 'Configuración', icono: 'admins', permiso: [] },
      { to: '/admin/whatsapp', texto: 'WhatsApp', icono: 'whatsapp', permiso: DISENO },
      { to: '/admin/backups', texto: 'Historial y backups', icono: 'historial', permiso: DISENO },
    ],
  },
];

/** ¿Estos permisos abren esta opción? `permiso: []` = solo superadmin. */
export function puedeVer(item, permisos = []) {
  const lista = Array.isArray(permisos) ? permisos : [];
  if (lista.includes('superadmin')) return true;
  if (!item.permiso) return true;
  if (!item.permiso.length) return false;
  return item.todos ? item.permiso.every((p) => lista.includes(p)) : item.permiso.some((p) => lista.includes(p));
}

/** El menú de un admin: solo las opciones que puede abrir; un grupo sin ninguna no sale. */
export function menuAdminPara(permisos, menu = MENU_ADMIN) {
  return menu
    .map((g) => ({ ...g, items: g.items.filter((it) => puedeVer(it, permisos)) }))
    .filter((g) => g.items.length);
}

/*
 * La barra inferior del celular: cuatro accesos fijos y "Más" (el menú).
 * Si un admin no puede abrir uno, entra el siguiente de la lista de
 * reserva que sí pueda.
 */
const ACCESOS = [
  { id: 'inicio', to: '/admin', texto: 'Inicio', icono: 'inicio', exacto: true },
  { id: 'pedidos', to: '/admin/recepcion-pedidos', texto: 'Pedidos', icono: 'pedidos', permiso: DISENO },
  { id: 'productos', to: '/admin/productos', texto: 'Productos', icono: 'productos', permiso: PRODUCTOS_O_STOCK },
  { id: 'resultados', to: '/admin/resultados', texto: 'Resultados', icono: 'resultados', permiso: [...DISENO, ...CLIENTES] },
  { id: 'reclamos', to: '/admin/libro-reclamaciones', texto: 'Reclamos', icono: 'reclamos', permiso: CLIENTES },
  { id: 'referidos', to: '/admin/referidos', texto: 'Referidos', icono: 'referidos', permiso: CLIENTES },
];

export function accesosAdminPara(permisos, cuantos = 4) {
  return ACCESOS.filter((a) => puedeVer(a, permisos)).slice(0, cuantos);
}

/** ¿La ruta `actual` es la de esta opción? (exacto: solo esa; si no, también sus hijas). */
export function esRutaActiva(item, actual = '') {
  if (!item?.to || !actual) return false;
  if (item.exacto) return actual === item.to;
  return actual === item.to || actual.startsWith(`${item.to}/`);
}

/** La opción del menú que corresponde a la ruta (la más larga que coincide). */
export function opcionActiva(grupos, actual) {
  let mejor = null;
  grupos.forEach((g) => g.items.forEach((it) => {
    if (esRutaActiva(it, actual) && (!mejor || it.to.length > mejor.item.to.length)) mejor = { grupo: g, item: it };
  }));
  return mejor;
}

/* ── Categorías ────────────────────────────────────────── */

/** Una categoría de `categories` → lo que muestra el admin. */
export function categoriaDesdeFirestore(doc = {}) {
  return {
    id: doc.id,
    nombre: doc.name || '',
    imagen: doc.imageUrl || '',
    orden: Number.isFinite(Number(doc.order)) ? Number(doc.order) : 0,
    marcas: Array.isArray(doc.brandIds) ? doc.brandIds : [],
    // El tipo de producto (productTypes): lo heredan sus productos (2026-11-04).
    tipo: doc.productType ? String(doc.productType) : '',
  };
}

/** Lo que guarda el formulario → los campos de `categories` (los mismos de AdminCategorias). */
export function categoriaAFirestore(c = {}) {
  return {
    name: String(c.nombre || '').trim(),
    order: Number(c.orden) || 0,
    imageUrl: c.imagen || '',
    brandIds: Array.isArray(c.marcas) ? [...new Set(c.marcas)] : [],
    productType: c.tipo || '',
  };
}

/**
 * La categoría que manda en un producto (la primera de `categories`, o
 * `categoryId`): de ella toma su tipo.
 */
export const categoriaPrincipalDe = (p = {}) => (Array.isArray(p.categories) && p.categories.length ? p.categories[0] : p.categoryId) || '';

/**
 * Los productos a los que hay que cambiarles el tipo al guardar la categoría
 * `id` con `tipo` ('' = sin tipo): los que la tienen de principal y no lo
 * tienen ya. → [{ id, productType }]
 */
export function tiposParaSincronizar(productos = [], id, tipo = '') {
  const actual = (p) => (p.productType && typeof p.productType === 'object' ? p.productType.id : p.productType) || '';
  return productos
    .filter((p) => p && p.deleted !== true && categoriaPrincipalDe(p) === id && actual(p) !== (tipo || ''))
    .map((p) => ({ id: p.id, productType: tipo || '' }));
}

/**
 * El tipo que sugiere una categoría sin tipo: el que más tienen sus productos
 * (los de antes lo ponían a mano). Map id → tipo.
 */
export function tiposSugeridosDeCategorias(productos = []) {
  const cuentas = new Map();
  productos.forEach((p) => {
    const c = categoriaPrincipalDe(p);
    const t = (p.productType && typeof p.productType === 'object' ? p.productType.id : p.productType) || '';
    if (!c || !t || p.deleted === true) return;
    if (!cuentas.has(c)) cuentas.set(c, new Map());
    cuentas.get(c).set(t, (cuentas.get(c).get(t) || 0) + 1);
  });
  return new Map([...cuentas].map(([c, m]) => [c, [...m].sort((a, b) => b[1] - a[1])[0][0]]));
}

/**
 * Reordenar una parte de la lista sin mover lo demás (las categorías de una
 * marca entre todas): los lugares que ocupan los de `parte` en `todos` (ids,
 * ya en su orden) se llenan con `parte` en su orden nuevo. Devuelve todos los
 * ids en el orden final (si `parte` no está entera en `todos`, sin cambios).
 */
export function ordenConParte(todos = [], parte = []) {
  const enParte = new Set(parte);
  const cola = todos.filter((id) => enParte.has(id)).length === parte.length ? [...parte] : null;
  if (!cola) return [...todos];
  return todos.map((id) => (enParte.has(id) ? cola.shift() : id));
}

/** Una marca de `tienda_brands` → lo justo para elegirla en el admin. */
export function marcaAdminDesdeFirestore(doc = {}) {
  return { id: doc.id, nombre: doc.name || 'Sin nombre', logo: doc.logoUrl || '' };
}

/** Mismo nombre sin tildes, mayúsculas ni espacios de más (para no repetir). */
export const mismoNombre = (a, b) => normalizarBusqueda(a) === normalizarBusqueda(b);

/* ── Colecciones ───────────────────────────────────────── */

export function coleccionDesdeFirestore(doc = {}) {
  return {
    id: doc.id,
    nombre: doc.name || '',
    imagen: doc.imageUrl || '',
    orden: Number.isFinite(Number(doc.order)) ? Number(doc.order) : 0,
  };
}

/** Los campos de `collections` (los mismos de AdminColecciones). */
export function coleccionAFirestore(c = {}) {
  return { name: String(c.nombre || '').trim(), order: Number(c.orden) || 0, imageUrl: c.imagen || '' };
}

/* ── Atributos del catálogo ────────────────────────────── */

/*
 * Tres listas con la misma forma: tipos de producto (`productTypes`, sin
 * marcas), etiquetas (`tags`) y personajes (`characters`), con marcas (sin
 * ninguna: de todas). `campo`: dónde los guarda un producto.
 */
export const ATRIBUTOS = {
  tipos: { titulo: 'Tipos de producto', singular: 'tipo de producto', plural: 'tipos de producto', campo: 'productType', conMarcas: false, ejemplo: 'Accesorio', ayuda: 'El filtro «Tipo de producto» de la tienda.' },
  etiquetas: { titulo: 'Etiquetas', singular: 'etiqueta', plural: 'etiquetas', campo: 'tags', conMarcas: true, ejemplo: 'Dragon Ball', ayuda: 'Palabras temáticas para clasificar y filtrar.' },
  personajes: { titulo: 'Personajes', singular: 'personaje', plural: 'personajes', campo: 'characters', conMarcas: true, ejemplo: 'Goku', ayuda: 'Los protagonistas de cada diseño.' },
};

const idDeValor = (v) => (v && typeof v === 'object' ? (v.id || v.slug || v.name || '') : v);

/** Cuántos productos usan cada valor de un atributo ({ id: n }). Cuenta también los ocultos. */
export function usosDeAtributo(productos = [], tipo) {
  const campo = ATRIBUTOS[tipo]?.campo;
  const usos = {};
  if (!campo) return usos;
  productos.forEach((p) => {
    const crudo = p?.[campo];
    const ids = new Set((Array.isArray(crudo) ? crudo : [crudo]).map(idDeValor).filter(Boolean));
    ids.forEach((id) => { usos[id] = (usos[id] || 0) + 1; });
  });
  return usos;
}

export function atributoDesdeFirestore(doc = {}, usos = {}) {
  return {
    id: doc.id,
    nombre: doc.name || doc.id || '',
    marcas: Array.isArray(doc.brandIds) ? doc.brandIds : [],
    usos: usos[doc.id] || 0,
  };
}

/** Tipos: solo el nombre; etiquetas y personajes, también sus marcas. */
export function atributoAFirestore(a = {}, tipo) {
  const name = String(a.nombre || '').trim();
  return ATRIBUTOS[tipo]?.conMarcas ? { name, brandIds: Array.isArray(a.marcas) ? [...new Set(a.marcas)] : [] } : { name };
}

/* ── Zonas de envío ────────────────────────────────────── */

export function zonaDesdeFirestore(doc = {}) {
  return {
    id: doc.id,
    nombre: doc.name || '',
    departamento: doc.departamento || '',
    costo: Number(doc.cost) || 0,
    dias: Number(doc.etaDays) || 0,
    orden: Number(doc.order) || 0,
    activa: doc.active !== false,
  };
}

/** Los campos de `shippingZones` (los mismos de AdminEnviosZonas). */
export function zonaAFirestore(z = {}) {
  return {
    name: String(z.nombre || '').trim(),
    departamento: String(z.departamento || '').trim(),
    cost: Number(z.costo) || 0,
    etaDays: Number(z.dias) || 0,
    order: Number(z.orden) || 0,
    active: z.activa !== false,
  };
}

/* ── Marcas ────────────────────────────────────────────── */

/** La parte de la dirección de una marca (wala.pe/<esto>): como brands.js y la cabecera. */
export function slugDeMarca(texto) {
  return String(texto || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '');
}

export const TOPE_MONEDAS_POR_DEFECTO = 50;

/** El % de monedas de una marca (como utils/topeMonedas: vacío o raro = 50; entre 0 y 100). */
export function topeMonedasDe(crudo) {
  if (crudo === null || crudo === undefined || crudo === '') return TOPE_MONEDAS_POR_DEFECTO;
  const n = Number(crudo);
  return Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : TOPE_MONEDAS_POR_DEFECTO;
}

/** Monedas por producto (entero, 0 o más); '' si no hay un número. */
export function monedasPorProductoDe(crudo) {
  if (crudo === null || crudo === undefined || crudo === '') return '';
  const n = Number(crudo);
  return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : '';
}

/**
 * El tope de una marca en palabras (la lista del admin): "Hasta 50 %",
 * "10 por producto" o null si no se puede pagar con monedas. Con 'monedas'
 * sin cantidad vale el % (como utils/topeMonedas).
 */
export function textoTopeMonedas({ tipoTope, topeMonedas, monedasPorProducto } = {}) {
  if (tipoTope === 'monedas' && monedasPorProducto !== '' && monedasPorProducto != null) {
    return Number(monedasPorProducto) > 0 ? `${monedasPorProducto} por producto` : null;
  }
  const pct = topeMonedasDe(topeMonedas);
  return pct > 0 ? `Hasta ${pct} %` : null;
}

export function marcaDesdeFirestore(doc = {}) {
  return {
    id: doc.id,
    nombre: doc.name || '',
    slug: doc.slug || '',
    logo: doc.logoUrl || '',
    orden: Number(doc.order) || 0,
    whatsapp: doc.whatsappNumber || '',
    mensajeVacio: doc.storeEmpty || '',
    topeMonedas: topeMonedasDe(doc.topeMonedasPct),
    // Cómo se cuenta el tope: un % del precio o monedas por producto (topeMonedasTipo).
    tipoTope: doc.topeMonedasTipo === 'monedas' ? 'monedas' : 'pct',
    monedasPorProducto: monedasPorProductoDe(doc.topeMonedasCantidad),
    fondo: doc.bgColor || '#ffffff',
    textura: doc.bgImage || '',
    opacidad: doc.bgOpacity ?? 100,
  };
}

/**
 * Los campos de `tienda_brands` que edita el admin (los mismos de
 * AdminMarcas). storeTitle y storeSubtitle no van: se conservan en el doc
 * (updateBrand solo escribe lo que llega) pero ya no se ven en la tienda.
 */
export function marcaAFirestore(m = {}) {
  return {
    name: String(m.nombre || '').trim(),
    slug: String(m.slug || '').trim(),
    logoUrl: String(m.logo || '').trim(),
    order: Number(m.orden) || 0,
    bgColor: m.fondo || '#ffffff',
    bgImage: String(m.textura || '').trim(),
    bgOpacity: Number(m.opacidad ?? 100),
    whatsappNumber: String(m.whatsapp || '').trim(),
    storeEmpty: String(m.mensajeVacio || '').trim(),
    topeMonedasPct: topeMonedasDe(m.topeMonedas),
    // Con el %, la cantidad se borra ('' → updateDocument quita el campo).
    topeMonedasTipo: m.tipoTope === 'monedas' ? 'monedas' : 'pct',
    topeMonedasCantidad: m.tipoTope === 'monedas' ? monedasPorProductoDe(m.monedasPorProducto) : '',
  };
}

/* ── Productos (lo justo para elegirlos en el admin) ───── */

/*
 * La personalización de antes (el editor viejo y Yoryo) que todavía tiene
 * un producto de la tienda: como tienePersonalizacionVieja de AdminProductos.
 */
function conPersonalizacionVieja(p) {
  if (p.esPrendaBase === true || p.deleted === true) return false;
  const items = Array.isArray(p.comboItems) ? p.comboItems : [];
  return p.customizable === true
    || (Array.isArray(p.customizationViews) && p.customizationViews.length > 0)
    || Boolean(p.YoryoPersonalizado)
    || items.some((it) => it?.customizable === true || Boolean(it?.YoryoPersonalizado));
}

/* La foto de la tarjeta del admin: la de la lista, la de su color principal, la principal o la primera. */
function fotoDeProducto(p) {
  const variantes = Array.isArray(p.variants) ? p.variants : [];
  const principal = variantes.find((v) => v.id === p.defaultVariantId) || variantes[0];
  return p.thumbnailImageUrl || principal?.imageUrl || p.mainImage || (Array.isArray(p.images) && p.images[0]) || '';
}

/**
 * Un producto de `productos_wala` para las listas del admin. Los
 * archivados (deleted) no se listan: null.
 */
export function productoAdminDesde(p = {}) {
  if (!p || p.deleted === true) return null;
  const precioLista = Number(p.price) || 0;
  const oferta = Number(p.salePrice) || 0;
  const conOferta = oferta > 0 && oferta < precioLista;
  return {
    id: p.id,
    nombre: p.name || 'Sin nombre',
    imagen: fotoDeProducto(p),
    precio: conOferta ? oferta : precioLista,
    precioLista,
    conOferta,
    oculto: p.visible === false,
    marcaId: p.brandId || '',
    destacado: p.featured === true,
    ordenDestacado: Number(p.featuredOrder) || 0,
    // Sin inStock (o vacío) no hay límite: el servidor deja comprar cuantos sean
    // (cartValidation). Antes se leía como 0 y salían "agotados" que se venden.
    stock: p.inStock === undefined || p.inStock === null || p.inStock === '' ? null : (Number.isFinite(Number(p.inStock)) ? Number(p.inStock) : 0),
    sku: p.sku || '',
    categorias: Array.isArray(p.categories) ? p.categories : (p.categoryId ? [p.categoryId] : []),
    colecciones: Array.isArray(p.collections) ? p.collections : [],
    tipo: (p.productType && typeof p.productType === 'object' ? p.productType.id : p.productType) || '',
    esCombo: p.isComboProduct === true,
    piezas: p.isComboProduct === true && Array.isArray(p.comboItems) ? p.comboItems.map((it) => it?.productId).filter(Boolean) : [],
    // Crear: una prenda personalizable, un pack de Crear y lo que reemplazó un personalizable.
    personalizable: p.esPrendaBase === true,
    talCual: p.seVendeTalCual === true,
    enTienda: p.enTienda === true,
    pack: p.esComboCrear === true,
    packPublicado: p.comboCrear?.publicado === true,
    reemplazado: Boolean(p.reemplazadoPor),
    personalizacionVieja: conPersonalizacionVieja(p),
    publico: p.publico || '',
    edadMinima: p.edadMinima ?? null,
    equipo: p.equipo || '',
  };
}

/* ── La papelera de productos ───────────────────────────── */

/** Los días que un producto pasa en la papelera antes de borrarse solo (functions/papeleraLogic.js, igual). */
export const DIAS_PAPELERA = 30;
const queEra = (p) => (p.esComboCrear === true ? 'Pack de Crear' : p.esPrendaBase === true ? 'Personalizable' : p.isComboProduct === true ? 'Combo' : 'Tienda');

/*
 * Quién nombra a quién: un combo a sus piezas (comboItems), un pack a sus
 * prendas (prendaId), una ficha vieja a la que la reemplaza (reemplazadoPor),
 * un producto a su prenda de Crear (personalizarEn: "/crear/<id>") y los
 * premios de la ruleta y de recompensas a su producto. Se buscan los ids
 * entre comillas o al final de una ruta, en el documento entero: así no se
 * escapa un campo nuevo. Igual que functions/papeleraLogic.js.
 */
const NOMBRADOS = /"([A-Za-z0-9_-]{1,64})"|\/(?:crear|combo)\/([A-Za-z0-9_-]{1,64})"/g;
function idsNombrados(texto, ids) {
  const vistos = new Set();
  for (const m of String(texto).matchAll(NOMBRADOS)) {
    const id = m[1] || m[2];
    if (ids.has(id)) vistos.add(id);
  }
  return vistos;
}

/**
 * Para cada producto, quién lo usa: Map id → [{ id, nombre, enPapelera, premio }].
 *  - productos: todos los crudos (vivos y en la papelera)
 *  - premios: [{ id, nombre, ...datos }] (ruletaPrizes y rewardsCatalog), opcional
 */
export function usosDeProductos(productos = [], premios = []) {
  const ids = new Set(productos.filter(Boolean).map((p) => p.id));
  const usos = new Map();
  const anotar = (quien, texto) => idsNombrados(texto, ids).forEach((id) => {
    if (id === quien.id) return;
    if (!usos.has(id)) usos.set(id, []);
    usos.get(id).push(quien);
  });
  productos.filter(Boolean).forEach((p) => anotar({ id: p.id, nombre: p.name || p.id, enPapelera: p.deleted === true }, JSON.stringify(p)));
  premios.filter(Boolean).forEach((x) => anotar({ id: x.id, nombre: x.nombre, enPapelera: false, premio: true }, JSON.stringify(x)));
  return usos;
}

/**
 * Lo que está en la papelera (los `deleted` de productos_wala), con:
 *  - seFue (ms): cuándo se movió · seBorra (ms) y dias: cuándo se borra solo
 *    (los de antes de la papelera, sin papeleraDesde, cuentan desde `ahora`:
 *    la función les pone la fecha la primera vez que pasa)
 *  - usos: quién lo nombra ([{ id, nombre, enPapelera, premio }]). Lo que usa
 *    algo que se queda no se borra (un combo que lo lleva de pieza, uno que
 *    lo reemplaza, un premio…); si quien lo usa también se borra, sí.
 *  - usadoPor: los nombres de los que lo usan y no están en la papelera
 *  - necesita: lo de la papelera que este nombra (sus piezas): al
 *    restaurarlo vuelven con él
 * `productos`: todos los crudos (vivos y borrados) · premios: como en usosDeProductos.
 */
export function papeleraDesde(productos = [], ahora = Date.now(), premios = []) {
  const usos = usosDeProductos(productos, premios);
  const enPapelera = productos.filter((p) => p && p.deleted === true);
  const idsPapelera = new Set(enPapelera.map((p) => p.id));
  return enPapelera.map((p) => {
    const desde = msDe(p.papeleraDesde);
    const seBorra = (desde ?? ahora) + DIAS_PAPELERA * DIA_MS;
    const suyos = usos.get(p.id) || [];
    return {
      id: p.id,
      nombre: p.name || 'Sin nombre',
      imagen: fotoDeProducto(p),
      que: queEra(p),
      seFue: msDe(p.deletedAt) ?? desde,
      seBorra,
      dias: Math.max(0, Math.ceil((seBorra - ahora) / DIA_MS)),
      visibleAntes: p.visibleAntes === true,
      usos: suyos,
      usadoPor: suyos.filter((u) => !u.enPapelera).map((u) => u.nombre),
      necesita: [...idsNombrados(JSON.stringify(p), idsPapelera)].filter((id) => id !== p.id),
    };
  });
}

/**
 * De `ids` (lo que se quiere borrar), cuáles se pueden: los que nadie usa, o
 * solo los usan otros que también se borran ahora. Lo demás se queda.
 */
export function borrablesDePapelera(papelera = [], ids = []) {
  const porId = new Map(papelera.map((p) => [p.id, p]));
  let quedan = new Set(ids.filter((id) => porId.has(id)));
  for (;;) {
    const siguen = new Set([...quedan].filter((id) => (porId.get(id).usos || []).every((u) => quedan.has(u.id))));
    if (siguen.size === quedan.size) return [...siguen];
    quedan = siguen;
  }
}

/** Lo que vuelve al restaurar `ids`: ellos y, de la papelera, lo que necesitan (sus piezas). */
export function restaurablesDePapelera(papelera = [], ids = []) {
  const porId = new Map(papelera.map((p) => [p.id, p]));
  const van = new Set();
  const sumar = (id) => {
    if (van.has(id) || !porId.has(id)) return;
    van.add(id);
    (porId.get(id).necesita || []).forEach(sumar);
  };
  ids.forEach(sumar);
  return [...van];
}

/** "Se borra hoy" · "en 1 día" · "en 12 días". */
export const textoSeBorra = (dias) => (dias <= 0 ? 'Hoy' : dias === 1 ? 'En 1 día' : `En ${dias} días`);

/*
 * Lo que se lista en "Tienda" (como `catalogo` de AdminProductos): sin lo
 * que reemplazó un personalizable, sin los packs de Crear y, de las
 * prendas personalizables, solo las que también se venden en la tienda.
 */
export const esDeLaTienda = (p) => p && !p.reemplazado && !p.pack && (!p.personalizable || p.enTienda);

/** Los ids que son pieza de algún combo de la lista. */
export const piezasDeCombos = (productos = []) => new Set(productos.filter((p) => p.esCombo).flatMap((p) => p.piezas));

/** Las etiquetas de la vista "Todos" (las mismas de ListaTodos). */
export function etiquetasDeProducto(p) {
  if (p.pack) return ['Pack de Crear', p.packPublicado ? 'En Crear' : 'Borrador', ...(p.packPublicado && p.enTienda ? ['En la tienda'] : [])];
  if (p.personalizable) return ['Personalizable', p.oculto ? 'Borrador' : 'En Crear', ...(!p.oculto && p.enTienda ? ['En la tienda'] : [])];
  if (p.reemplazado) return [...(p.esCombo ? ['Combo'] : []), 'Reemplazado por su personalizable'];
  return [...(p.esCombo ? ['Combo'] : []), p.oculto ? 'Oculto' : 'En la tienda'];
}

/** A dónde lleva un producto de "Todos": los packs a su lista, las prendas a su ficha de Crear, el resto a la ficha. */
export function rutaAdminDeProducto(p) {
  if (p.pack) return '/admin/productos?ver=packs';
  if (p.personalizable) return `/admin/prendas-crear/${p.id}`;
  return `/admin/productos/${p.id}`;
}

/* ── La ficha de un producto (D2b) ─────────────────────── */

/* Los tipos de cumplimiento (fulfillmentType); '' = que lo decida la tienda. */
export const CUMPLIMIENTOS = [
  { valor: '', texto: 'Automático' },
  { valor: 'stock', texto: 'Stock propio' },
  { valor: 'print_on_demand', texto: 'Se imprime al pedirlo' },
  { valor: 'made_to_order', texto: 'Se fabrica al pedirlo' },
  { valor: 'dropship', texto: 'Lo envía el proveedor' },
];

const lista = (v) => (Array.isArray(v) ? v : []);
const idDe = (v) => (v && typeof v === 'object' ? v.id || '' : v || '');

/**
 * Un producto de `productos_wala` → los datos de la ficha (lo mismo que
 * cargaba AdminProductoFormV2). Sin variantes y sin ser combo (los de
 * antes), se arma una "Principal" con su foto, su galería y sus tallas.
 * `nuevo`: { marcaId } para uno nuevo (la marca de ?brandId=).
 */
export function fichaDesdeProducto(p, nuevo = {}) {
  if (!p) {
    const id = `var_${Date.now()}`;
    return {
      nombre: '', precio: '', oferta: '', sku: '', stock: 0, descripcion: '',
      esCombo: false, cumplimiento: '', marcaId: nuevo.marcaId || '', categoria: '', colecciones: [], tipo: '', personajes: [], etiquetas: [],
      publico: '', edadMinima: null, equipo: '',
      whatsappActivo: true, whatsappNumero: '', whatsappMensaje: '',
      destacado: false, visible: true, personalizarEn: '',
      variantes: [{ id, nombre: 'Variante 1', color: '#cccccc', foto: '', encuadre: null, galeria: [], encuadres: {}, etiquetaTalla: 'Talla', tallas: [] }],
      principal: id,
      combo: { tallas: 'porPrenda', piezas: [], portada: '' },
      // Un personalizable de Crear (D2c): su prendaBase tal cual se edita.
      esPrenda: nuevo.prenda === true,
      prenda: { vistas: [], colores: {} },
      enTienda: false,
      talCual: false,
      ...(nuevo.prenda === true && { stock: '', visible: false }),
    };
  }
  let variantes = lista(p.variants).map((v) => ({
    id: v.id,
    nombre: v.name || '',
    color: v.colorHex || '#cccccc',
    foto: v.imageUrl || '',
    encuadre: v.thumbnailCrop || null,
    galeria: lista(v.images),
    encuadres: v.imagesCrops && typeof v.imagesCrops === 'object' ? v.imagesCrops : {},
    etiquetaTalla: v.sizeLabel || 'Talla',
    tallas: lista(v.sizes),
  }));
  if (!variantes.length && !p.isComboProduct) {
    variantes = [{
      id: p.defaultVariantId || `var_${Date.now()}`,
      nombre: 'Principal',
      color: '#cccccc',
      foto: p.mainImage || '',
      encuadre: p.thumbnailCrop || null,
      galeria: lista(p.images).filter((u) => u !== p.mainImage),
      encuadres: p.imagesCrops || {},
      etiquetaTalla: 'Talla',
      tallas: lista(p.mainSizes),
    }];
  }
  const principal = variantes.some((v) => v.id === p.defaultVariantId) ? p.defaultVariantId : variantes[0]?.id || '';
  return {
    nombre: p.name || '',
    precio: p.price ?? '',
    oferta: Number(p.salePrice) > 0 ? p.salePrice : '',
    sku: p.sku || '',
    // Un personalizable puede no tener stock (sin límite): vacío.
    stock: p.esPrendaBase === true && (p.inStock === null || p.inStock === undefined || p.inStock === '') ? '' : (Number.isFinite(Number(p.inStock)) ? Number(p.inStock) : 0),
    descripcion: p.description || '',
    esCombo: p.isComboProduct === true,
    cumplimiento: p.fulfillmentType || '',
    marcaId: p.brandId || '',
    categoria: lista(p.categories)[0] || p.categoryId || '',
    colecciones: lista(p.collections),
    tipo: idDe(p.productType),
    personajes: lista(p.characters).map(idDe).filter(Boolean),
    etiquetas: lista(p.tags).map(idDe).filter(Boolean),
    publico: p.publico || '',
    edadMinima: p.edadMinima ?? null,
    equipo: p.equipo || '',
    whatsappActivo: p.whatsappEnabled !== false,
    whatsappNumero: p.whatsappNumber || '',
    whatsappMensaje: p.whatsappMessage || '',
    destacado: p.featured === true,
    visible: p.visible !== false,
    personalizarEn: p.personalizarEn || '',
    variantes,
    principal,
    combo: {
      tallas: p.comboTallas || 'porPrenda',
      piezas: lista(p.comboItems).map((it, i) => ({
        uid: `${it.productId || 'pieza'}-${i}`,
        productoId: it.productId || '',
        nombre: it.name || '',
        foto: it.imageUrl || '',
        color: it.variantMapping?.color || '',
      })),
      portada: p.comboPreviewImage || '',
    },
    esPrenda: p.esPrendaBase === true && p.isComboProduct !== true,
    prenda: p.prendaBase && typeof p.prendaBase === 'object' ? { vistas: [], colores: {}, ...p.prendaBase } : { vistas: [], colores: {} },
    enTienda: p.enTienda === true,
    talCual: p.seVendeTalCual === true,
  };
}

/**
 * Los datos de la ficha → lo que AdminProductoFormV2 le pasaba a
 * createProduct / updateProduct (el servicio normaliza después). `original`:
 * el producto tal como estaba, para no perder lo que la ficha no muestra
 * (las copias chicas de cada foto, la configuración de Yoryo de una pieza).
 * Un personalizable lleva su prendaBase: `prendaBaseParaGuardar` (la de
 * PersonalizacionPrenda / utils) la limpia; sin ella va tal cual.
 */
export function fichaAProducto(f, original = {}, { prendaBaseParaGuardar } = {}) {
  const prenda = f.esPrenda === true && !f.esCombo;
  const fotoPrenda = prenda ? String(lista(f.prenda?.vistas)[0]?.imagen || '') : '';
  const viejas = new Map(lista(original.variants).map((v) => [v.id, v]));
  const variantes = f.esCombo ? [] : f.variantes.map((v) => {
    const antes = viejas.get(v.id) || {};
    const fotos = new Set([v.foto, ...v.galeria].filter(Boolean));
    return {
      id: v.id,
      name: String(v.nombre || '').trim(),
      colorHex: v.color || '#cccccc',
      // Un personalizable sin foto de tienda en un color usa la de su primera vista.
      imageUrl: v.foto || fotoPrenda,
      images: [...v.galeria],
      sizes: [...v.tallas],
      sizeLabel: String(v.etiquetaTalla || '').trim() || 'Talla',
      showSizeConfig: v.tallas.length > 0,
      thumbnailCrop: v.encuadre || null,
      // Solo los encuadres y las copias de fotos que siguen en la variante.
      imagesCrops: Object.fromEntries(Object.entries(v.encuadres || {}).filter(([url]) => fotos.has(url))),
      imagesVariantes: Object.fromEntries(Object.entries({ ...(antes.imagesVariantes || {}), ...(v.copias || {}) }).filter(([url]) => fotos.has(url))),
    };
  });
  const principal = variantes.find((v) => v.id === f.principal) || variantes[0];
  const piezasAntes = lista(original.comboItems);
  return {
    name: String(f.nombre || '').trim(),
    description: f.descripcion || '',
    price: Number(f.precio) || 0,
    salePrice: Number(f.oferta) || 0,
    inStock: prenda && f.stock === '' ? null : Number(f.stock) || 0,
    sku: String(f.sku || '').trim(),
    brandId: f.marcaId || '',
    fulfillmentType: f.cumplimiento || undefined,
    productType: f.tipo || '',
    categories: f.categoria ? [f.categoria] : [],
    collections: [...f.colecciones],
    mainImage: principal?.imageUrl || '',
    thumbnailWithDesignUrl: '',
    mainSizes: [],
    defaultVariantId: principal?.id || '',
    hasVariants: !f.esCombo && variantes.length > 0,
    customizable: false,
    customizationViews: [],
    esPrendaBase: prenda,
    ...(prenda && { prendaBase: prendaBaseParaGuardar ? prendaBaseParaGuardar(f.prenda, variantes) : f.prenda }),
    personalizarEn: prenda ? '' : f.personalizarEn || '',
    whatsappEnabled: f.whatsappActivo !== false,
    whatsappNumber: String(f.whatsappNumero || '').trim(),
    whatsappMessage: String(f.whatsappMensaje || '').trim(),
    isComboProduct: f.esCombo === true,
    comboItems: f.esCombo ? f.combo.piezas.map((pz, i) => {
      const antes = piezasAntes.find((it) => it.productId === pz.productoId) || {};
      return {
        ...antes,
        productId: pz.productoId,
        name: String(pz.nombre || '').trim(),
        imageUrl: pz.foto || '',
        position: i,
        scale: antes.scale ?? 1,
        variantMapping: { ...(antes.variantMapping || {}), color: pz.color || '' },
      };
    }) : [],
    comboTallas: f.combo.tallas,
    comboPreviewImage: f.esCombo ? f.combo.portada || '' : '',
    characters: [...f.personajes],
    tags: [...f.etiquetas],
    publico: f.publico || '',
    equipo: String(f.equipo || '').trim(),
    edadMinima: f.edadMinima,
    variants: variantes,
    visible: f.visible !== false,
    enTienda: prenda && f.enTienda === true,
    seVendeTalCual: prenda && f.enTienda === true && f.talCual === true,
    featured: f.destacado === true,
    // El orden de Destacados lo pone su página: sin esto, el servicio lo deja en 0
    // y guardar la ficha sube el producto al primer lugar (web y app ordenan por él).
    featuredOrder: Number(original.featuredOrder) || 0,
    isV2: true,
  };
}

/** Lo que falta en la ficha antes de guardar: { campo: mensaje } y en qué pestaña está. */
export function erroresDeFicha(f) {
  const e = {};
  if (!String(f.nombre || '').trim()) e.nombre = { texto: 'Escribe el nombre del producto.', pestana: 'general' };
  if (f.precio === '' || f.precio === null || !(Number(f.precio) >= 0)) e.precio = { texto: 'Escribe el precio (puede ser 0).', pestana: 'general' };
  if (f.oferta !== '' && Number(f.oferta) > 0 && Number(f.oferta) >= Number(f.precio)) e.oferta = { texto: 'La oferta tiene que ser menor que el precio (si no, no se guarda).', pestana: 'general' };
  if (Number(f.stock) < 0) e.stock = { texto: 'El stock no puede ser negativo.', pestana: 'general' };
  if (f.esCombo && !f.combo.piezas.length) e.piezas = { texto: 'Agrega al menos un producto al combo.', pestana: 'colores' };
  if (!f.esCombo && !f.variantes.length) e.variantes = { texto: 'Tiene que quedar al menos un color.', pestana: 'colores' };
  if (f.esPrenda && !f.esCombo) {
    const vistas = lista(f.prenda?.vistas);
    if (!vistas.length || vistas.some((v) => !v?.imagen || !(lista(v.zonas).length || v.zona))) {
      e.vistas = { texto: 'Cada vista necesita su foto y al menos una zona de impresión.', pestana: 'diseno' };
    }
  }
  return e;
}

/* ── Crear: personalizables y packs (D2c) ──────────────── */

const zonasDeVistaCruda = (v) => (Array.isArray(v?.zonas) && v.zonas.length ? v.zonas.length : v?.zona ? 1 : 0);
const plantillasValidas = (lista) => (Array.isArray(lista) ? lista : [])
  .filter((p) => p && p.id && p.capas && typeof p.capas === 'object' && Object.values(p.capas).some((c) => Array.isArray(c) && c.length));

/**
 * Un personalizable (esPrendaBase) para la lista de Crear: cuántos colores,
 * vistas, zonas y plantillas tiene, si le faltan vistas con foto y zonas, y
 * en qué packs está (como AdminPrendasCrear).
 *  - packs: los combos de Crear (getCombosCrear), para saber cuáles la usan
 */
export function personalizableDesde(p = {}, packs = []) {
  const variantes = lista(p.variants);
  const principal = variantes.find((v) => String(v.id) === String(p.defaultVariantId)) || variantes[0];
  const vistas = lista(p.prendaBase?.vistas);
  const usan = lista(packs).filter((c) => c.deleted !== true && lista(c.comboCrear?.piezas || c.piezas).some((pz) => pz?.prendaId === p.id));
  return {
    id: p.id,
    nombre: p.name || 'Sin nombre',
    foto: principal?.imageUrl || vistas[0]?.imagen || p.mainImage || '',
    colores: variantes.length,
    vistas: vistas.length,
    zonas: vistas.reduce((t, v) => t + zonasDeVistaCruda(v), 0),
    plantillas: plantillasValidas(p.prendaBase?.plantillas).length,
    faltanZonas: !vistas.length || vistas.some((v) => !v?.imagen || !zonasDeVistaCruda(v)),
    publicada: p.visible !== false,
    enTienda: p.enTienda === true,
    talCual: p.enTienda === true && p.seVendeTalCual === true,
    packs: usan.map((c) => ({ id: c.id, nombre: c.name || 'Pack', publicado: (c.comboCrear?.publicado ?? c.publicado) === true })),
  };
}

export const MODOS_TALLA_PACK = [
  { valor: 'auto', texto: 'Automático', ayuda: 'Prendas distintas (el conjunto de una persona): una talla. La misma prenda repetida (pareja, trío): una por prenda.' },
  { valor: 'porPrenda', texto: 'Una por prenda', ayuda: 'Cada prenda elige la suya: él y ella pueden ser de tallas distintas.' },
  { valor: 'una', texto: 'Una para todas', ayuda: 'Una sola talla que se aplica a todas las prendas.' },
];
export const MIN_PIEZAS_PACK = 2;
export const MAX_PIEZAS_PACK = 4;

/** Un pack de Crear (esComboCrear) → lo que edita el admin. */
export function packDesdeFirestore(c = {}) {
  const cc = c.comboCrear || {};
  return {
    id: c.id,
    nombre: c.name || '',
    descripcion: c.description || '',
    marcaId: c.brandId || '',
    categoria: lista(c.categories)[0] || '',
    // Todas las que tenía: si no se cambia la categoría, se guardan tal cual.
    categorias: lista(c.categories),
    portada: c.mainImage || '',
    precio: c.price ?? '',
    oferta: Number(c.salePrice) > 0 ? c.salePrice : '',
    publicado: (cc.publicado ?? c.publicado) === true,
    enTienda: c.enTienda === true,
    tallas: ['auto', 'una', 'porPrenda'].includes(cc.tallas) ? cc.tallas : 'auto',
    piezas: lista(cc.piezas || c.piezas).map((pz) => ({
      prendaId: pz?.prendaId || '',
      fija: pz?.fija === true,
      color: pz?.color ? { id: String(pz.color.id || ''), nombre: pz.color.nombre || '', hex: pz.color.hex || '' } : null,
      nombre: pz?.nombre || '',
      imagen: pz?.imagen || '',
    })),
  };
}

/** Lo del pack → lo que recibe guardarComboCrear (el formulario de AdminCombosCrear). */
export function packAGuardar(k = {}) {
  return {
    name: String(k.nombre || '').trim(),
    description: String(k.descripcion || '').trim(),
    price: Number(k.precio) || 0,
    salePrice: Number(k.oferta) > 0 ? Number(k.oferta) : '',
    publicado: k.publicado === true,
    enTienda: k.enTienda === true,
    tallas: k.tallas || 'auto',
    brandId: k.marcaId || '',
    mainImage: k.portada || '',
    // Como AdminCombosCrear: sin tocar la categoría, el pack conserva todas las suyas.
    categories: !k.categoria ? [] : lista(k.categorias)[0] === k.categoria ? [...k.categorias] : [k.categoria],
    piezas: lista(k.piezas).map((pz) => ({ prendaId: pz.prendaId, ...(pz.fija && { fija: true }), ...(pz.color && { color: pz.color }) })),
  };
}

/** Lo que falta en un pack (las reglas de AdminCombosCrear). */
export function erroresDePack(k) {
  const e = {};
  if (!String(k.nombre || '').trim()) e.nombre = 'Escribe el nombre del pack.';
  if (!(Number(k.precio) > 0)) e.precio = 'Escribe el precio del pack.';
  if (Number(k.oferta) > 0 && Number(k.oferta) >= Number(k.precio)) e.oferta = 'La oferta tiene que ser menor que el precio.';
  const piezas = lista(k.piezas);
  if (piezas.length < MIN_PIEZAS_PACK) e.piezas = `Un pack lleva al menos ${MIN_PIEZAS_PACK} piezas.`;
  else if (piezas.some((pz) => !pz.prendaId || (pz.fija && !pz.color))) e.piezas = 'Completa cada pieza (la que va tal cual necesita su color).';
  else if (!piezas.some((pz) => !pz.fija)) e.piezas = 'Al menos una pieza tiene que diseñarse.';
  return e;
}

/** El estado del stock: sin número, sin límite; 0 agotado, hasta 3 últimas, más disponible. */
export const estadoDeStock = (n) => (n === null || n === undefined ? 'sinLimite' : n <= 0 ? 'agotado' : n <= 3 ? 'ultimas' : 'disponible');

/** Busca sin tildes ni mayúsculas. */
export function normalizarBusqueda(t) {
  return String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

/* ── Pedidos y pagos (D3) ──────────────────────────────── */

/*
 * Recepción de pedidos: los pedidos ya llegan como los deja
 * normalizarPedidoRecepcion (services/adminOrders.js, solo lectura del ERP);
 * aquí solo el estado para la insignia, los filtros, las cifras y la
 * dirección para copiar (el enlace de WhatsApp es utils/whatsappLink).
 */
export const ESTADOS_RECEPCION = {
  por_confirmar_pago: { texto: 'Por confirmar pago', tono: 'aviso' },
  pago_confirmado: { texto: 'Pago confirmado', tono: 'violeta' },
  en_preparacion: { texto: 'En producción', tono: 'violeta' },
  entregado: { texto: 'Entregado', tono: 'exito' },
  anulado: { texto: 'Anulado', tono: 'neutro' },
};

/* Los filtros de antes: "Por entregar" es todo lo que no está entregado ni anulado. */
export const FILTROS_RECEPCION = [
  { valor: 'por_entregar', texto: 'Por entregar' },
  { valor: 'en_preparacion', texto: 'En producción' },
  { valor: 'por_confirmar_pago', texto: 'Pago pendiente' },
  { valor: 'entregado', texto: 'Entregados' },
];

const porEntregar = (p) => p.estado?.key !== 'entregado' && p.estado?.key !== 'anulado';

/** ¿Entra el pedido en el filtro de estado? ('' = todos) */
export function pedidoEnFiltro(p, filtro) {
  if (!filtro) return true;
  if (filtro === 'por_entregar') return porEntregar(p);
  return p.estado?.key === filtro;
}

/** Los campos donde busca la recepción (código, cliente, teléfono, documento, dirección). */
export const textoDePedido = (p) => [
  p.codigo, p.clienteNombre, p.clienteContacto, p.clienteDocumento,
  p.entrega?.direccion, p.entrega?.distrito, p.entrega?.departamento,
].filter(Boolean).join(' ');

/**
 * Las cifras de arriba, como las calcula adminOrders, salvo "pendientes de
 * pago": sin los anulados (antes contaba todo lo no pagado y no cuadraba con
 * su filtro, "Pago pendiente").
 */
export function resumenRecepcion(pedidos = []) {
  const r = { total: 0, porEntregar: 0, pendientesPago: 0, enProduccion: 0, entregados: 0, montoTotal: 0 };
  for (const p of lista(pedidos)) {
    r.total += 1;
    r.montoTotal += Number(p.montoTotal) || 0;
    if (p.estado?.key === 'entregado') r.entregados += 1;
    if (p.estado?.key === 'en_preparacion') r.enProduccion += 1;
    if (!p.estado?.paid && p.estado?.key !== 'anulado') r.pendientesPago += 1;
    if (porEntregar(p)) r.porEntregar += 1;
  }
  r.montoTotal = Math.round(r.montoTotal * 100) / 100;
  return r;
}

/** La dirección para copiar y pegar en la agencia: dirección, distrito, departamento y a quién. */
export function direccionParaCopiar(p = {}) {
  const e = p.entrega || {};
  const para = p.esRegalo && p.regalo?.destinatario ? p.regalo.destinatario : p.clienteNombre;
  return [
    [e.direccion, e.distrito, e.departamento].filter(Boolean).join(', '),
    [para, p.clienteContacto].filter(Boolean).join(' · '),
  ].filter(Boolean).join('\n');
}

/*
 * Gestión de pagos (D3b): los enlaces llegan como los deja normalizarEnlace
 * (services/enlacesPago.js): { id, concepto, moneda 'PEN'|'USD'|null, monto,
 * estado 'pendiente'|'pagado', createdMs, pagadoMs, metodo, tiempoPagoMs }.
 */
const DIA_MS = 86400000;

/** Los periodos del historial; 'fechas' usa desde/hasta ('AAAA-MM-DD'). */
export const PERIODOS_PAGOS = [
  { valor: '7', texto: 'Últimos 7 días' },
  { valor: '30', texto: 'Últimos 30 días' },
  { valor: '90', texto: 'Últimos 90 días' },
  { valor: 'fechas', texto: 'Elegir fechas' },
];

/** El rango [desdeMs, hastaMs] de un periodo (hasta incluye el día entero; null = sin tope). */
export function rangoDePeriodo(periodo, { desde, hasta } = {}, ahora = Date.now()) {
  const diaLocal = (iso, fin) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
    if (!m) return null;
    return fin ? new Date(+m[1], m[2] - 1, +m[3], 23, 59, 59, 999).getTime() : new Date(+m[1], m[2] - 1, +m[3]).getTime();
  };
  if (periodo === 'fechas') return [diaLocal(desde, false), diaLocal(hasta, true)];
  const n = Number(periodo);
  if (!n) return [null, null];
  const hoy = new Date(ahora);
  return [new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - (n - 1)).getTime(), null];
}

/** ¿Entra el enlace? { estado, metodo, rango: [desde, hasta], q } ('' = todos). */
export function enlaceEnFiltro(e, { estado = '', metodo = '', rango = [null, null], q = '' } = {}) {
  if (estado && e.estado !== estado) return false;
  if (metodo && e.metodo !== metodo) return false;
  const [desde, hasta] = rango;
  if (desde != null && (e.createdMs == null || e.createdMs < desde)) return false;
  if (hasta != null && (e.createdMs == null || e.createdMs > hasta)) return false;
  return !q || normalizarBusqueda(e.concepto).includes(normalizarBusqueda(q));
}

/** Las cifras del historial (sobre lo filtrado), como antes: lo cobrado separado por moneda. */
export function resumenEnlaces(enlaces = []) {
  const todos = lista(enlaces);
  const pagados = todos.filter((e) => e.estado === 'pagado');
  const suma = (moneda) => Math.round(pagados.filter((e) => e.moneda === moneda && e.monto != null).reduce((a, e) => a + e.monto, 0) * 100) / 100;
  const tiempos = pagados.map((e) => e.tiempoPagoMs).filter((t) => t != null);
  return {
    generados: todos.length,
    pagados: pagados.length,
    conversion: todos.length ? (pagados.length / todos.length) * 100 : 0,
    cobradoPEN: suma('PEN'),
    cobradoUSD: suma('USD'),
    tiempoPromedio: tiempos.length ? tiempos.reduce((a, b) => a + b, 0) / tiempos.length : null,
  };
}

/**
 * Generados y pagados por día, **con los días sin nada en cero** (antes el
 * gráfico saltaba los días vacíos y juntaba fechas lejanas). Un pagado
 * cuenta el día en que se pagó. Hasta `maxDias` hacia atrás desde el último.
 */
export function serieDiariaEnlaces(enlaces = [], maxDias = 120) {
  const dia = (ms) => { const d = new Date(ms); return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(); };
  const generados = new Map();
  const pagados = new Map();
  const sumar = (m, k) => m.set(k, (m.get(k) || 0) + 1);
  for (const e of lista(enlaces)) {
    if (e.createdMs != null) sumar(generados, dia(e.createdMs));
    if (e.estado === 'pagado' && (e.pagadoMs ?? e.createdMs) != null) sumar(pagados, dia(e.pagadoMs ?? e.createdMs));
  }
  const dias = [...generados.keys(), ...pagados.keys()];
  if (!dias.length) return [];
  const fin = Math.max(...dias);
  const inicio = Math.max(Math.min(...dias), fin - (maxDias - 1) * DIA_MS);
  const serie = [];
  for (let d = new Date(inicio); d.getTime() <= fin; d.setDate(d.getDate() + 1)) {
    const k = d.getTime();
    serie.push({
      dia: k,
      etiqueta: `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`,
      valores: { generados: generados.get(k) || 0, pagados: pagados.get(k) || 0 },
    });
  }
  return serie;
}

/** "2d 4h", "3h 10m", "5m 2s", "40s" (como antes); null → '—'. */
export function duracionCorta(ms) {
  if (ms == null) return '—';
  const t = Math.max(0, Math.round(ms / 1000));
  const d = Math.floor(t / 86400);
  const h = Math.floor((t % 86400) / 3600);
  const m = Math.floor((t % 3600) / 60);
  if (d) return `${d}d ${h}h`;
  if (h) return `${h}h ${m}m`;
  if (m) return `${m}m ${t % 60}s`;
  return `${t}s`;
}

/** Lo que se guarda en `enlaces_pago` (como antes), o los errores del formulario. */
export function enlaceNuevo({ concepto = '', moneda = 'PEN', monto = '' } = {}) {
  const n = Number(String(monto).replace(',', '.'));
  const errores = {
    concepto: String(concepto).trim() ? undefined : 'Escribe qué se está cobrando.',
    monto: Number.isFinite(n) && n > 0 ? undefined : 'Pon un monto mayor a 0.',
  };
  if (errores.concepto || errores.monto) return { errores };
  const m = Math.round(n * 100) / 100;
  return { datos: { concepto: String(concepto).trim(), moneda, monto: m, ...(moneda === 'USD' ? { montoUSD: m } : { montoPEN: m }), estado: 'pendiente' } };
}

export const MENSAJE_PAGOS_POR_DEFECTO = 'Hola, quiero pagar mi saldo pendiente del pedido *#{id}*. Adjunto mi comprobante por S/ *{monto}*.';

/** La configuración de pagos desde los mensajes (`messages`); sin WhatsApp de pagos, el de la cuenta. */
export function configPagosDesde(m = {}) {
  const t = (k) => String(m[k] ?? '').trim();
  return {
    yapeNumero: t('yape_number'),
    yapeTitular: t('yape_name'),
    plinNumero: t('plin_number'),
    plinTitular: t('plin_name'),
    whatsapp: t('whatsapp_number_pagos') || t('whatsapp_number_cuenta'),
    mensaje: m.whatsapp_text_pagos || MENSAJE_PAGOS_POR_DEFECTO,
  };
}

/** Los mensajes que se guardan (las mismas claves de antes). */
export function configPagosAMensajes(c = {}) {
  const t = (v) => String(v ?? '').trim();
  return {
    yape_number: t(c.yapeNumero),
    yape_name: t(c.yapeTitular),
    plin_number: t(c.plinNumero),
    plin_name: t(c.plinTitular),
    whatsapp_number_pagos: t(c.whatsapp),
    whatsapp_text_pagos: c.mensaje || '',
  };
}

/*
 * Libro de reclamaciones (D3c): el documento de `libro_reclamaciones` que
 * guarda ReclamacionesDeTienda (código, estado, consumidor, bien, reclamo,
 * respuestaProveedor) y el plazo para responder (config/empresa.js:
 * plazoRespuestaDiasHabiles).
 */
const msDe = (v) => {
  if (v == null) return null;
  if (typeof v?.toMillis === 'function') return v.toMillis();
  if (typeof v?.toDate === 'function') return v.toDate().getTime();
  if (typeof v?.seconds === 'number') return v.seconds * 1000;
  const n = typeof v === 'string' ? Date.parse(v) : Number(v);
  return Number.isNaN(n) ? null : n;
};

/** Un reclamo como lo usa la página. */
export function reclamoDesdeFirestore(doc = {}) {
  const c = doc.consumidor || {};
  const b = doc.bien || {};
  const r = doc.reclamo || {};
  return {
    id: doc.id,
    codigo: doc.codigo || doc.id || '',
    creadoMs: msDe(doc.createdAt),
    estado: doc.estado === 'respondido' ? 'respondido' : 'pendiente',
    tipo: r.tipo === 'queja' ? 'queja' : 'reclamo',
    consumidor: {
      nombre: c.nombre || '',
      documento: [c.tipoDocumento, c.numeroDocumento].filter(Boolean).join(' '),
      email: c.email || '',
      telefono: c.telefono || '',
      domicilio: c.domicilio || '',
      esMenor: Boolean(c.esMenor),
      apoderado: c.apoderado || '',
    },
    bien: { tipo: b.tipo === 'servicio' ? 'servicio' : 'producto', descripcion: b.descripcion || '', monto: b.montoReclamado == null ? null : Number(b.montoReclamado) },
    detalle: r.detalle || '',
    pedido: r.pedido || '',
    respuesta: doc.respuestaProveedor || '',
    respondidoMs: msDe(doc.respondidoEn),
  };
}

/** Lo que se guarda al responder (como antes); sin texto, el error. */
export function respuestaDeReclamo(texto, ahora = new Date()) {
  const t = String(texto || '').trim();
  if (!t) return { error: 'Escribe la respuesta antes de marcarlo como respondido.' };
  return { datos: { estado: 'respondido', respuestaProveedor: t, respondidoEn: ahora.toISOString() } };
}

/** Días hábiles (lunes a viernes; los feriados no se descuentan) entre dos fechas, sin contar el primero. */
export function diasHabilesEntre(desdeMs, hastaMs) {
  if (desdeMs == null || hastaMs == null || hastaMs <= desdeMs) return 0;
  const d = new Date(desdeMs);
  d.setHours(0, 0, 0, 0);
  const fin = new Date(hastaMs);
  fin.setHours(0, 0, 0, 0);
  let n = 0;
  while (d < fin) {
    d.setDate(d.getDate() + 1);
    const dia = d.getDay();
    if (dia !== 0 && dia !== 6) n += 1;
  }
  return n;
}

/**
 * Cómo va un reclamo pendiente frente al plazo: { dias, quedan, estado }
 * con estado 'a_tiempo' | 'por_vencer' (3 días hábiles o menos) | 'vencido';
 * los respondidos, null.
 */
export function plazoDeReclamo(r, plazo = 15, ahora = Date.now()) {
  if (!r || r.estado === 'respondido' || r.creadoMs == null) return null;
  const dias = diasHabilesEntre(r.creadoMs, ahora);
  const quedan = plazo - dias;
  return { dias, quedan, estado: quedan < 0 ? 'vencido' : quedan <= 3 ? 'por_vencer' : 'a_tiempo' };
}

/** Lo que se busca en un reclamo: código, nombre, documento, correo y pedido. */
export const textoDeReclamo = (r) => [r.codigo, r.consumidor?.nombre, r.consumidor?.documento, r.consumidor?.email, r.pedido].filter(Boolean).join(' ');

/* ── Resultados (D4) ───────────────────────────────────── */

/*
 * Los datos llegan como los arma useDashboardAnalytics (dashboard/dashShared):
 * data.visitas.total.total, data.ventas.pedidos.total, data.ventas.ingresosCents.total
 * (céntimos), data.canales, data.visitasPorDia, data.otrosCobros…, y `anterior`
 * con el periodo de antes ({ visitas, pedidos, ingresosCents, diasConVentas }).
 * Las cuentas son las de antes (calcularDelta y calcularDeltaPuntos).
 */
const enteroPE = (n) => new Intl.NumberFormat('es-PE').format(Math.round(Number(n) || 0));
const solesDeCentimos = (c) => `S/ ${((Number(c) || 0) / 100).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const decimal = (v) => (Number(v) || 0).toLocaleString('es-PE', { maximumFractionDigits: 1 });

/** De cada 100 visitas, cuántas compran (un decimal). */
export const porCienVisitas = (pedidos, visitas) => (visitas > 0 ? Math.round((pedidos / visitas) * 1000) / 10 : 0);

/** El cambio en % contra el periodo anterior: { texto: '▲ 12%', bueno } (sin base previa, '▲ nuevo'). */
export function cambioPorcentual(actual, previo) {
  if (actual == null || previo == null) return null;
  const a = Number(actual) || 0;
  const b = Number(previo) || 0;
  if (b === 0) return a === 0 ? { texto: '= 0%', bueno: true } : { texto: '▲ nuevo', bueno: true };
  const pct = ((a - b) / b) * 100;
  if (Math.round(pct * 10) === 0) return { texto: '= 0%', bueno: true };
  return { texto: `${pct > 0 ? '▲' : '▼'} ${decimal(Math.abs(pct))}%`, bueno: pct > 0 };
}

/** El cambio de algo que ya es un porcentaje, en puntos: { texto: '▲ 0.4 pp', bueno }. */
export function cambioEnPuntos(actual, previo) {
  if (actual == null || previo == null) return null;
  const d = Math.round(((Number(actual) || 0) - (Number(previo) || 0)) * 10) / 10;
  if (d === 0) return { texto: '= 0 pp', bueno: true };
  return { texto: `${d > 0 ? '▲' : '▼'} ${decimal(Math.abs(d))} pp`, bueno: d > 0 };
}

const diferenciaCon = (actual, previo, formato) => {
  const d = (Number(actual) || 0) - (Number(previo) || 0);
  return d === 0 ? '=' : `${d > 0 ? '+' : '−'}${formato(Math.abs(d))}`;
};

/**
 * Las cuatro cifras del Resumen y la comparativa con el periodo anterior.
 *  - datos · anterior · comparar · canal: { canal, visitas, pedidos } (solo ese canal)
 *  → { cifras: [{ id, nombre, valor, cambio, explicacion }], comparativa: [{ nombre, actual, previo, diferencia, cambio }], hayAnterior }
 */
export function cifrasDelResumen({ datos, anterior, comparar = false, canal = null } = {}) {
  const visitas = datos?.visitas?.total?.total || 0;
  const pedidos = datos?.ventas?.pedidos?.total || 0;
  const ventas = datos?.ventas?.ingresosCents?.total || 0;
  const hayAnterior = Boolean(comparar && anterior && anterior.diasConVentas > 0);
  const vPrev = anterior?.visitas?.total || 0;
  const pPrev = anterior?.pedidos?.total || 0;
  const iPrev = anterior?.ingresosCents?.total || 0;
  const conv = porCienVisitas(pedidos, visitas);
  const convPrev = porCienVisitas(pPrev, vPrev);
  const con = (c) => (hayAnterior && !canal ? c : null);
  const nota = canal ? ` Solo visitas de ${canal.canal}.` : '';
  const cifras = [
    { id: 'visitas', nombre: 'Visitas', valor: enteroPE(canal ? canal.visitas : visitas), cambio: con(cambioPorcentual(visitas, vPrev)), explicacion: `Personas que entraron a la tienda o a la app. Si alguien vuelve antes de 30 minutos, es la misma visita. No cuenta robots ni al equipo.${nota}` },
    { id: 'pedidos', nombre: 'Pedidos', valor: enteroPE(canal ? canal.pedidos : pedidos), cambio: con(cambioPorcentual(pedidos, pPrev)), explicacion: `Pedidos enviados desde la tienda o la app, aunque todavía no estén pagados.${nota}` },
    { id: 'ventas', nombre: 'Ventas', valor: solesDeCentimos(ventas), cambio: con(cambioPorcentual(ventas, iPrev)), explicacion: `Suma de lo que llevan esos pedidos (precio por cantidad). No incluye sorteos, suscripciones ni pagos de saldo.${canal ? ' Las ventas no se separan por canal: es el total.' : ''}` },
    { id: 'conversion', nombre: 'De cada 100 visitas compran', valor: decimal(canal ? porCienVisitas(canal.pedidos, canal.visitas) : conv), cambio: con(cambioEnPuntos(conv, convPrev)), explicacion: `Pedidos ÷ visitas × 100.${nota}` },
  ];
  const comparativa = hayAnterior ? [
    { nombre: 'Visitas', actual: enteroPE(visitas), previo: enteroPE(vPrev), diferencia: diferenciaCon(visitas, vPrev, enteroPE), cambio: cambioPorcentual(visitas, vPrev) },
    { nombre: 'Pedidos', actual: enteroPE(pedidos), previo: enteroPE(pPrev), diferencia: diferenciaCon(pedidos, pPrev, enteroPE), cambio: cambioPorcentual(pedidos, pPrev) },
    { nombre: 'Ventas', actual: solesDeCentimos(ventas), previo: solesDeCentimos(iPrev), diferencia: diferenciaCon(ventas, iPrev, solesDeCentimos), cambio: cambioPorcentual(ventas, iPrev) },
    // En puntos el cambio ya es la diferencia: no se repite.
    { nombre: 'De cada 100 visitas compran', actual: decimal(conv), previo: decimal(convPrev), diferencia: null, cambio: cambioEnPuntos(conv, convPrev) },
  ] : [];
  return { cifras, comparativa, hayAnterior };
}

const NOMBRES_COBRO = {
  sorteo: ['ticket de sorteo', 'tickets de sorteo'],
  suscripcion: ['suscripción', 'suscripciones'],
  saldo: ['pago de saldo', 'pagos de saldo'],
  pago_rapido: ['pago rápido', 'pagos rápidos'],
  otro: ['otro cobro', 'otros cobros'],
};

/** "Otros cobros" (no son pedidos de la tienda): { montos: 'S/ 120.00 + USD 20.00', detalle: '3 tickets de sorteo · 1 pago de saldo' } o null. */
export function otrosCobrosDe(cobros = {}) {
  const fuentes = Object.entries(cobros || {}).filter(([, c]) => c?.cantidad > 0);
  if (!fuentes.length) return null;
  const porMoneda = {};
  fuentes.forEach(([, c]) => Object.entries(c.porMoneda || {}).forEach(([m, cents]) => { porMoneda[m] = (porMoneda[m] || 0) + cents; }));
  return {
    montos: Object.entries(porMoneda).map(([m, c]) => (m === 'PEN' ? solesDeCentimos(c) : `${m} ${((Number(c) || 0) / 100).toLocaleString('es-PE', { minimumFractionDigits: 2 })}`)).join(' + '),
    detalle: fuentes.map(([f, c]) => `${enteroPE(c.cantidad)} ${(NOMBRES_COBRO[f] || NOMBRES_COBRO.otro)[c.cantidad === 1 ? 0 : 1]}`).join(' · '),
  };
}

/** Visitas por día para GraficoTendencia: [{ etiqueta: 'DD/MM', valores: { visitas } }]. */
export const serieDeVisitas = (porDia = []) => lista(porDia).map((d) => ({ etiqueta: d.day ? `${d.day.slice(8, 10)}/${d.day.slice(5, 7)}` : '', valores: { visitas: Number(d.total) || 0 } }));

/** Los periodos de Resultados: hoy, ayer, 7, 30, 90 días o fechas. */
export const PERIODOS_RESULTADOS = [
  { id: 'hoy', texto: 'Hoy' },
  { id: 'ayer', texto: 'Ayer' },
  { id: '7', texto: '7 días' },
  { id: '30', texto: '30 días' },
  { id: '90', texto: '90 días' },
  { id: 'fechas', texto: 'Fechas' },
];

/*
 * Productos y Visitantes de Resultados (D4b): las filas de cada ranking
 * ({ id, nombre, valor, texto, sub, imagen }) para ListaBarras, desde el
 * mismo resumen diario. productoDe(id, nombre) → { nombre, imagen } (del
 * catálogo, con los ocultos) y nombreCategoria(id) → nombre los pone el conector.
 */
const cuentaDe = (n, uno, varios) => `${enteroPE(n)} ${Number(n) === 1 ? uno : varios}`;
const pctDe = (parte, total) => (total > 0 ? Math.round((parte / total) * 100) : 0);

/** Las listas de la pestaña Productos. medida: 'ingresos' | 'unidades' (cómo se ordenan los vendidos). */
export function listasDeProductos({ datos = {}, productoDe = (id, n) => ({ nombre: n || 'Producto que ya no está', imagen: '' }), nombreCategoria = (id) => id, medida = 'ingresos' } = {}) {
  const d = datos || {};
  // Sin nombre: el producto se borró (ya no está en el catálogo ni lo guardó el evento).
  const producto = (id, n) => {
    const p = productoDe(id, n) || {};
    return { nombre: p.nombre || n || 'Producto que ya no está', imagen: p.imagen || '' };
  };
  const vistos = lista(d.topProducts).map((p) => ({ id: p.productId || p.name, ...producto(p.productId, p.name), valor: p.total, texto: cuentaDe(p.total, 'vista', 'vistas') }));
  const vendidos = lista(d.topVendidos).map((p) => ({
    id: p.productId,
    ...producto(p.productId),
    valor: medida === 'ingresos' ? p.ingresosCents : p.unidades,
    texto: medida === 'ingresos' ? solesDeCentimos(p.ingresosCents) : `${enteroPE(p.unidades)} u.`,
    sub: cuentaDe(p.pedidos, 'pedido', 'pedidos'),
  })).sort((a, b) => b.valor - a.valor);
  const masMirados = lista(d.interes?.productos).map((p) => ({
    id: p.productId, ...producto(p.productId), valor: p.dwellMs, texto: duracionCorta(p.dwellMs),
    sub: p.personas ? `${cuentaDe(p.personas, 'persona', 'personas')} con cuenta` : 'Solo visitantes sin cuenta',
  }));
  const lineasVistas = lista(d.topCategoriesByViews).map((c) => ({ id: c.id || c.name, nombre: c.name || nombreCategoria(c.id), valor: c.total, texto: cuentaDe(c.total, 'vista', 'vistas') }));
  const porLinea = new Map();
  lista(d.topVendidos).forEach((p) => {
    const k = p.linea || 'Sin línea';
    const x = porLinea.get(k) || { cents: 0, unidades: 0 };
    x.cents += Number(p.ingresosCents) || 0;
    x.unidades += Number(p.unidades) || 0;
    porLinea.set(k, x);
  });
  const lineasVendidas = [...porLinea.entries()]
    .map(([k, x]) => ({ id: k, nombre: k === 'Sin línea' ? k : nombreCategoria(k), valor: x.cents, texto: solesDeCentimos(x.cents), sub: `${enteroPE(x.unidades)} u.` }))
    .sort((a, b) => b.valor - a.valor);
  const colecciones = lista(d.topCollectionsByViews).map((c) => ({ id: c.id || c.name, nombre: c.name || c.id, valor: c.total, texto: cuentaDe(c.total, 'vista', 'vistas') }));
  const busquedas = lista(d.topSearches).map((x) => ({ id: x.query, nombre: `«${x.query}»`, valor: x.total, texto: cuentaDe(x.total, 'vez', 'veces') }));
  const deseos = lista(d.deseos?.topProductos).map((p) => ({ id: p.productId, ...producto(p.productId, p.nombre), valor: p.agregados, texto: cuentaDe(p.agregados, 'vez', 'veces') }));
  return { vistos, vendidos, masMirados, lineasVistas, lineasVendidas, colecciones, busquedas, deseos };
}

const NOMBRES_DISPOSITIVO = { Mobile: 'Celular', Desktop: 'Computadora', Tablet: 'Tablet', Desconocido: 'No se sabe' };
const NOMBRES_CLIENTE = { APP: 'App Walá', WEB: 'Web (wala.pe)' };

/* Una lista con su parte del total: "41%" y "2,278 visitas" debajo. */
function conPorcentaje(filas = [], nombres = {}) {
  const suma = lista(filas).reduce((a, x) => a + (Number(x.count) || 0), 0);
  return lista(filas).map((x) => ({
    id: x.code || x.name,
    nombre: nombres[x.name] || (!x.name || /^(unknown|desconocido)$/i.test(x.name) ? 'No se sabe' : x.name),
    valor: x.count,
    texto: `${pctDe(x.count, suma)}%`,
    sub: cuentaDe(x.count, 'visita', 'visitas'),
  }));
}

/** La pestaña Visitantes: cifras, canal por canal, país (o el aproximado) y con qué entran. */
export function listasDeVisitantes(datos = {}) {
  const d = datos || {};
  const v = d.visitas || {};
  const visitas = v.total?.total || 0;
  // Con su nombre (Perú, Estados Unidos…), no el código.
  const conNombreDePais = (filas) => conPorcentaje(filas).map((f) => ({ ...f, nombre: /^[A-Za-z]{2}$/.test(f.nombre) ? nombreDePais(f.nombre) : f.nombre }));
  const paises = conNombreDePais(d.byCountry);
  const aprox = paises.length ? [] : conNombreDePais(d.byCountryAprox);
  return {
    cifras: [
      { id: 'visitas', nombre: 'Visitas', valor: enteroPE(visitas) },
      { id: 'personas', nombre: 'Personas distintas', valor: d.personas ? enteroPE(d.personas.total) : '—', ayuda: 'Mismo celular o computadora = 1' },
      { id: 'interaccion', nombre: 'Hicieron algo', valor: `${pctDe(v.conInteraccion?.total || 0, visitas)}%`, ayuda: 'Vieron 2+ páginas, 10 s o pidieron' },
      { id: 'paginas', nombre: 'Páginas por visita', valor: visitas ? decimal((v.paginas?.total || 0) / visitas) : '—' },
      { id: 'tiempo', nombre: 'Tiempo por visita', valor: visitas ? duracionCorta(Math.round((v.dwellMs?.total || 0) / visitas)) : '—' },
    ],
    canales: lista(d.canales).map((c) => ({
      id: c.canal, canal: c.canal, visitas: enteroPE(c.visitas), parte: `${pctDe(c.visitas, visitas)}%`,
      interaccion: `${pctDe(c.conInteraccion, c.visitas)}%`, pedidos: enteroPE(c.pedidos), conversion: decimal(porCienVisitas(c.pedidos, c.visitas)),
    })),
    paises: paises.length ? paises : aprox,
    paisAproximado: !paises.length && aprox.length > 0,
    dispositivos: conPorcentaje(d.byDevice, NOMBRES_DISPOSITIVO),
    clientes: conPorcentaje(d.byClientType, NOMBRES_CLIENTE),
  };
}

/*
 * Clientes de Resultados (D4c): los carritos abandonados (abandonedCarts del
 * resumen), los cumpleaños (getDatosPersonalesAggregate) y la ficha de un
 * cliente (getUserFicha + getUserAnalytics), como los usaba la pestaña de antes.
 */
const fechaCorta = (v) => {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString('es-PE', { day: 'numeric', month: 'short', year: 'numeric' });
};
const solesDe = (v) => `S/ ${(Number(v) || 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** "Hoy", "Mañana", "En 5 días". */
export const enDiasTexto = (n) => (n === 0 ? 'Hoy' : n === 1 ? 'Mañana' : `En ${n} días`);

/** Quién dejó un carrito: su nombre, el del perfil, su correo o "Visitante sin cuenta". */
export function quienDelCarrito(c = {}, perfil = null) {
  return c.displayName || perfil?.displayName || c.email || perfil?.email || (c.uid ? 'Cliente' : 'Visitante sin cuenta');
}

/** Los próximos cumpleaños: [{ id, enDias, cuando, pronto, quien, detalle }]. */
export function cumpleanosDe(lista_ = []) {
  return lista(lista_).map((c, i) => ({
    id: `${c.uid}-${c.fecha}-${c.dePersona}-${i}`,
    enDias: c.enDias,
    cuando: enDiasTexto(c.enDias),
    pronto: c.enDias <= 7,
    quien: c.esTitular ? c.nombre : c.dePersona,
    detalle: `${c.fechaLegible || c.fecha}${c.esTitular ? '' : ` · lo agendó ${c.nombre}`}`,
  }));
}

/**
 * Lo de arriba de la ficha y su resumen.
 *  - ficha (getUserFicha) · actividad (getUserAnalytics, puede faltar)
 *  → { contacto, chips: [texto], cifras: [{ nombre, valor, ayuda }], notas: [texto] }
 */
export function resumenDeFicha(ficha = {}, actividad = null) {
  const f = ficha || {};
  const m = actividad?.metrics || {};
  const telefono = f.phoneIntl?.full || f.phone || '';
  const sesionesApp = lista(actividad?.sessions).filter((x) => x.clientType === 'APP').length;
  const historico = actividad?.estimatedSummary?.isEstimated ? actividad.estimatedSummary : null;
  return {
    contacto: [f.email, f.dni && `${f.tipoDocumento || 'Doc.'} ${f.dni}`, telefono, f.country].filter(Boolean).join(' · ') || 'Sin datos de contacto',
    chips: [`${enteroPE(f.monedas)} monedas`, f.hasCompletedSurvey ? 'Completó la encuesta' : 'Sin encuesta', f.marketingConsent?.whatsapp === true ? 'Acepta WhatsApp' : 'No aceptó WhatsApp'],
    cifras: actividad ? [
      { nombre: 'Visitas', valor: enteroPE(m.totalSessions) },
      { nombre: 'Páginas vistas', valor: enteroPE(m.totalPageViews) },
      { nombre: 'Tiempo en la tienda', valor: duracionCorta(m.totalDwellMs || 0) },
      { nombre: 'Días que entró', valor: enteroPE(m.activeDays) },
      { nombre: 'Última vez', valor: fechaCorta(m.lastAccessAtMs) || '—' },
      { nombre: 'Usa la app', valor: sesionesApp ? 'Sí' : 'No', ayuda: sesionesApp ? `${enteroPE(sesionesApp)} ${sesionesApp === 1 ? 'visita' : 'visitas'} desde la app` : undefined },
    ] : [],
    notas: [
      [
        fechaCorta(f.createdAtMs) && `Cuenta creada el ${fechaCorta(f.createdAtMs)}`,
        `${enteroPE(f.wishlist?.count)} en su lista de deseos`,
        `${enteroPE(f.cart?.count)} en su carrito`,
        `${enteroPE(lista(f.giftRecipients).length)} personas agendadas`,
      ].filter(Boolean).join(' · '),
      historico && `Compras de antes de medir (estimado con los pedidos del ERP): ${enteroPE(historico.orderCount)} pedidos por ${solesDe(historico.totalSpent)}, del ${fechaCorta(historico.firstOrderAtMs) || '—'} al ${fechaCorta(historico.lastOrderAtMs) || '—'}.`,
    ].filter(Boolean),
  };
}

/** Las listas de la ficha: lo que mira, deseos, carrito y personas, listas para mostrar. */
export function listasDeFicha(ficha = {}, actividad = null, productoDe = () => null) {
  const f = ficha || {};
  return {
    mira: lista(actividad?.productInterest).slice(0, 8).map((r) => {
      const p = productoDe(r.productId) || {};
      return { id: r.productId, nombre: p.nombre || r.name || 'Producto', imagen: p.imagen || '', detalle: `${duracionCorta(r.dwellMs)} · ${enteroPE(r.views)} ${r.views === 1 ? 'vista' : 'vistas'}` };
    }),
    deseos: lista(f.wishlist?.items).map((it, i) => ({
      id: `${it.productId || 'p'}-${i}`, nombre: it.productName, imagen: it.productImage || '',
      detalle: [it.price > 0 ? solesDe(it.price) : null, fechaCorta(it.addedAt) && `agregado el ${fechaCorta(it.addedAt)}`].filter(Boolean).join(' · '),
      marca: it.isGifted ? `Ya se lo regalaron${it.giftedBy ? ` (${it.giftedBy})` : ''}` : null,
    })),
    carrito: lista(f.cart?.items).map((it, i) => ({
      id: `${it.productId || 'p'}-${i}`, nombre: it.productName, imagen: it.productImage || '',
      detalle: `${enteroPE(it.quantity)} × ${solesDe(it.price)} = ${solesDe(it.subtotal)}`,
      marca: it.selected === false ? 'Lo dejó para después' : null,
    })),
    carritoResumen: lista(f.cart?.items).length ? `${enteroPE(f.cart?.unidades)} unidades por unos ${solesDe(f.cart?.totalEstimado)}. Es lo que tiene ahora: cambia cada vez que navega o compra.` : '',
    personas: lista(f.giftRecipients).map((p, i) => ({
      id: p.id || `persona-${i}`, nombre: p.name, rol: p.roleDisplay,
      fechas: lista(p.events).length ? p.events.map((ev) => `${ev.label}: ${ev.dateLegible || ev.date || 'sin fecha'}`).join(' · ') : 'Sin fechas',
    })),
    cumpleanos: f.birthdayLegible ? `Su cumpleaños: ${f.birthdayLegible}` : 'No registró su cumpleaños.',
  };
}

/*
 * Detalle técnico de Resultados (D4d): la calidad de los datos y la
 * reconstrucción del resumen diario por tramos (BackfillAnaliticaButton:
 * aggregateAnalyticsDailyBackfill acepta hasta 120 días por llamada; se manda
 * de a 10 para ver el avance; el tope de la pantalla es 365).
 */
export const MAX_DIAS_RECONSTRUIR = 365;
const claveDia = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const esClaveDia = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s || '');

/** Los últimos n días hasta hoy (incluido): { desde, hasta } en 'AAAA-MM-DD'. */
export function ultimosDias(n, hoy = new Date()) {
  const desde = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - (n - 1));
  return { desde: claveDia(desde), hasta: claveDia(hoy) };
}

/** Cuántos días hay entre dos claves, las dos incluidas (null si no se puede). */
export function diasEntreClaves(desde, hasta) {
  if (!esClaveDia(desde) || !esClaveDia(hasta)) return null;
  const a = new Date(`${desde}T00:00:00`);
  const b = new Date(`${hasta}T00:00:00`);
  if (b < a) return null;
  return Math.round((b - a) / DIA_MS) + 1;
}

/** El rango partido en tramos seguidos de hasta `dias` días: [{ fromDay, toDay }]. */
export function tramosDeDias(desde, hasta, dias = 10) {
  const tramos = [];
  if (diasEntreClaves(desde, hasta) == null) return tramos;
  const cursor = new Date(`${desde}T00:00:00`);
  const fin = new Date(`${hasta}T00:00:00`);
  while (cursor <= fin) {
    const ini = claveDia(cursor);
    cursor.setDate(cursor.getDate() + dias - 1);
    tramos.push({ fromDay: ini, toDay: cursor < fin ? claveDia(cursor) : hasta });
    cursor.setDate(cursor.getDate() + 1);
  }
  return tramos;
}

/** La ayuda bajo las fechas de "Reconstruir": qué va a pasar o qué está mal. */
export function ayudaDeRango(desde, hasta) {
  const n = diasEntreClaves(desde, hasta);
  if (n == null) return { valido: false, texto: 'Elige las dos fechas, y que «Desde» no sea después de «Hasta».' };
  if (n > MAX_DIAS_RECONSTRUIR) return { valido: false, texto: `El rango (${n} días) supera el máximo de ${MAX_DIAS_RECONSTRUIR}. Divídelo en partes.` };
  return { valido: true, dias: n, texto: `Se reconstruirán ${n} ${n === 1 ? 'día' : 'días'}.` };
}

/** Las filas de "Calidad de los datos": de las pestañas registradas a las visitas. null si el periodo no se midió así. */
export function filasDeCalidad(calidad, visitas) {
  if (!(calidad?.diasMedidos > 0)) return null;
  return [
    { id: 'registradas', texto: 'Pestañas registradas', valor: enteroPE(calidad.sesionesRegistradas) },
    { id: 'robots', texto: '− Robots (buscadores y navegadores automáticos)', valor: enteroPE(calidad.sesionesBot) },
    { id: 'equipo', texto: '− Equipo admin', valor: enteroPE(calidad.sesionesAdmin) },
    { id: 'sinPaginas', texto: '− Sin ninguna página vista', valor: enteroPE(calidad.sinPaginas) },
    { id: 'unidas', texto: '− Otra pestaña de la misma visita (menos de 30 min)', valor: enteroPE(calidad.unidas) },
    { id: 'visitas', texto: '= Visitas', valor: enteroPE(visitas?.total?.total), total: true },
  ];
}

/*
 * Las pantallas técnicas (D4d): Páginas y tiempo, Uso y permanencia,
 * Navegador y sistema, sobre el mismo `data` de useDashboardAnalytics /
 * useGlobalAnalytics. Muchos números llegan como TAW ({ total, app, web }).
 * nombrePagina (prettyRouteName) y rutaCorta (shortPath) los pone el conector.
 */
const totalTAW = (v) => (typeof v === 'number' ? v : Number(v?.total) || 0);
const msDeTs = (v) => {
  if (v == null) return null;
  if (typeof v?.toMillis === 'function') return v.toMillis();
  if (typeof v?.seconds === 'number') return v.seconds * 1000;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/**
 * Un TAW según el origen ('todos' | 'app' | 'web'), como segTAW: si el dato
 * no trae el corte, el total y sinDesglose. → { valor, sinDesglose }
 */
export function segunOrigen(taw, origen = 'todos') {
  if (origen !== 'app' && origen !== 'web') return { valor: totalTAW(taw), sinDesglose: false };
  const v = taw && typeof taw === 'object' ? taw[origen] : undefined;
  return v == null ? { valor: totalTAW(taw), sinDesglose: true } : { valor: Number(v) || 0, sinDesglose: false };
}

/** Las páginas vistas por día desde eventsForCharts: [{ etiqueta 'DD/MM', valores: { total, app, web } }] en orden. */
export function traficoPorDia(eventos = []) {
  const dias = new Map();
  for (const e of lista(eventos)) {
    if (e?.type !== 'page_view') continue;
    const ms = Number(e.clientTsMs) || msDeTs(e.createdAt);
    if (!ms) continue;
    const d = new Date(ms);
    const clave = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
    const x = dias.get(clave) || { etiqueta: clave, ts: new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(), valores: { total: 0, app: 0, web: 0 } };
    x.valores.total += 1;
    x.valores[e.clientType === 'APP' ? 'app' : 'web'] += 1;
    dias.set(clave, x);
  }
  return [...dias.values()].sort((a, b) => a.ts - b.ts);
}

/** El seguimiento de pedidos: orderTracking o, si no llegó, contado en eventsForCharts sobre /cuenta/pedidos (como antes). */
export function seguimientoDePedidos(datos = {}) {
  if (datos?.orderTracking) return datos.orderTracking;
  let views = 0;
  let totalDwellMs = 0;
  let conTiempo = 0;
  const personas = new Set();
  for (const e of lista(datos?.eventsForCharts)) {
    const ruta = typeof e.path === 'string' ? e.path.split('?')[0].split('#')[0] : '';
    if (ruta !== '/cuenta/pedidos' && !ruta.startsWith('/cuenta/pedidos/')) continue;
    if (e.type === 'page_view') views += 1;
    if (e.type === 'route_dwell') { totalDwellMs += Number(e.dwellMs) || 0; conTiempo += 1; }
    const quien = e.uid || e.anonymousId || e.email;
    if (quien) personas.add(quien);
  }
  return { views, uniqueUsers: personas.size, totalDwellMs, avgDwellMs: conTiempo ? Math.round(totalDwellMs / conTiempo) : 0 };
}

/** Páginas y tiempo: las rutas más vistas y lo más buscado como filas de ListaBarras, y el total de búsquedas. */
export function listasDePaginas(datos = {}, { nombrePagina = (p) => p, rutaCorta = (p) => p } = {}) {
  const rutas = lista(datos?.topRoutesByViews).map((r) => ({ id: r.path, nombre: nombrePagina(r.path), valor: totalTAW(r.views), texto: cuentaDe(totalTAW(r.views), 'vista', 'vistas'), sub: rutaCorta(r.path) }));
  const busquedas = lista(datos?.topSearches).map((x) => ({ id: x.query, nombre: x.query, valor: x.total, texto: enteroPE(x.total) }));
  return { rutas, busquedas, totalBusquedas: busquedas.reduce((a, b) => a + (Number(b.valor) || 0), 0) };
}

/** "anon_3f9a1b": la clave de un visitante sin cuenta, corta. */
export function claveAnonimaCorta(clave) {
  const s = String(clave || '');
  const partes = s.split('_');
  return `anon_${(partes[partes.length - 1] || s).slice(0, 6)}`;
}

/**
 * Uso y permanencia: las cuatro cifras cortadas por origen y las listas.
 *  - datos · origen · nombrePagina · rutaCorta · areas ([{ area, views }] de deriveAppUsage, del conector)
 */
export function listasDeUso({ datos = {}, origen = 'todos', nombrePagina = (p) => p, rutaCorta = (p) => p, areas = [] } = {}) {
  const d = datos || {};
  const sesiones = segunOrigen(d.totalSessions, origen);
  const paginas = d.__source === 'analytics_daily' ? segunOrigen(d.pageViews, origen) : (() => {
    const vistas = lista(d.eventsForCharts).filter((e) => e.type === 'page_view');
    const app = vistas.filter((e) => e.clientType === 'APP').length;
    return { valor: origen === 'app' ? app : origen === 'web' ? vistas.length - app : vistas.length, sinDesglose: false };
  })();
  const sd = d.scrollDepth || {};
  const scroll = origen === 'app' && sd.avgApp != null ? sd.avgApp : origen === 'web' && sd.avgWeb != null ? sd.avgWeb : sd.avgTotal;
  const tiempo = segunOrigen(d.avgDwellPerSessionMs, origen);
  const conRutas = (filas, campo, formato) => lista(filas)
    .map((r) => ({ id: r.path, nombre: nombrePagina(r.path), sub: rutaCorta(r.path), valor: segunOrigen(r[campo], origen).valor }))
    .filter((r) => origen === 'todos' || r.valor > 0)
    .sort((a, b) => b.valor - a.valor)
    .map((r) => ({ ...r, texto: formato(r.valor) }));
  const NOMBRES_FUNCION = { editor: 'Editor de prendas', minijuegos: 'Minijuegos', misiones: 'Misiones', wishlist: 'Lista de deseos', busqueda: 'Búsqueda' };
  return {
    sinDesglose: sesiones.sinDesglose || paginas.sinDesglose || tiempo.sinDesglose,
    cifras: [
      { id: 'sesiones', nombre: 'Sesiones', valor: enteroPE(sesiones.valor) },
      { id: 'paginas', nombre: 'Páginas vistas', valor: enteroPE(paginas.valor) },
      { id: 'scroll', nombre: 'Scroll medio', valor: `${enteroPE(scroll)}%` },
      { id: 'tiempo', nombre: 'Tiempo medio por sesión', valor: duracionCorta(tiempo.valor) },
    ],
    visitantes: [...lista(d.topIdentities)]
      .sort((a, b) => (Number(b.views) || 0) - (Number(a.views) || 0) || (Number(b.dwellMs) || 0) - (Number(a.dwellMs) || 0))
      .slice(0, 10)
      .map((v) => ({
        id: v.clave,
        nombre: v.logueado ? (v.nombre && v.nombre !== 'anónimo' ? v.nombre : 'Cliente logueado') : `Visitante anónimo (${claveAnonimaCorta(v.clave)})`,
        valor: Number(v.views) || 0,
        texto: cuentaDe(v.views, 'página', 'páginas'),
        sub: `${v.logueado ? 'Con cuenta' : 'Sin cuenta'} · ${duracionCorta(Number(v.dwellMs) || 0)} de permanencia`,
      })),
    areas: lista(areas).map((a) => ({ id: a.area, nombre: a.area, valor: a.views, texto: a.pct != null ? `${Math.round(a.pct)}%` : enteroPE(a.views), sub: cuentaDe(a.views, 'vista', 'vistas') })),
    funciones: lista(d.featureUsage).map((f) => ({ id: f.area, nombre: NOMBRES_FUNCION[f.area] || f.area, valor: f.total, texto: enteroPE(f.total) })),
    rutasVistas: conRutas(d.topRoutesByViews, 'views', (v) => cuentaDe(v, 'vista', 'vistas')),
    rutasTiempo: conRutas(d.topRoutesByDwell, 'dwellMs', duracionCorta),
    busquedas: lista(d.topSearches).map((x) => ({ id: x.query, nombre: x.query, valor: x.total, texto: enteroPE(x.total) })),
  };
}

/** El nombre de un país por su código (como DashOrigen): 'Perú', 'Sin identificar', 'Otros'. */
export function nombreDePais(code, guardado) {
  const c = String(code || '').toUpperCase();
  if (!c || c === 'UNKNOWN') return 'Sin identificar';
  if (c === 'OTROS') return 'Otros';
  if (guardado && guardado !== code) return guardado;
  try {
    const n = new Intl.DisplayNames(['es'], { type: 'region' }).of(c);
    if (n && n !== c) return n;
  } catch {
    // Un código que no es ISO: queda tal cual.
  }
  return c;
}

/* Filas con su parte del total: "41%" y debajo cuántos. */
const conParte = (filas, nombreDe, unidad = ['sesión', 'sesiones']) => {
  const suma = filas.reduce((a, x) => a + (Number(x.count) || 0), 0);
  return filas.map((x) => ({ id: x.code || x.name, nombre: nombreDe(x), valor: Number(x.count) || 0, texto: `${pctDe(x.count, suma)}%`, sub: cuentaDe(x.count, unidad[0], unidad[1]) }));
};

/** Navegador y sistema: cifras, aparatos, navegadores, sistemas, país (confiable y aproximado), app o web con su cambio, fuentes, campañas y regiones. */
export function listasDeNavegador({ datos = {}, anterior = null, comparar = false } = {}) {
  const d = datos || {};
  const fuente = lista(d.utmStats?.topSources)[0];
  const region = lista(d.geographyStats?.topRegions)[0];
  const app = lista(d.byClientType).find((x) => x.name === 'APP')?.count || 0;
  const web = lista(d.byClientType).find((x) => x.name === 'WEB')?.count || 0;
  const NOMBRES_TIPO = { APP: 'App (instalada)', WEB: 'Web (navegador)' };
  const cov = d.extendedCoverage || {};
  const sinDesglose = Math.max(0, (Number(cov.closedDocs) || 0) - (Number(cov.docsWithBreakdowns) || 0));
  let cambioTipo = null;
  if (comparar && anterior) {
    cambioTipo = anterior.daysWithData === 0 ? { sinDatos: true } : { app: cambioPorcentual(app, anterior.sessions?.app), web: cambioPorcentual(web, anterior.sessions?.web) };
  }
  return {
    cifras: [
      { id: 'vivo', nombre: 'Sesiones en vivo', valor: enteroPE(totalTAW(d.realtimeActiveSessions)) },
      { id: 'muestras', nombre: 'Muestras de dispositivo', valor: enteroPE(lista(d.byDevice).reduce((a, x) => a + (Number(x.count) || 0), 0)) },
      { id: 'fuente', nombre: fuente ? `Fuente líder · ${fuente.name}` : 'Fuente líder', valor: fuente ? enteroPE(fuente.value) : '—' },
      { id: 'region', nombre: region ? `Región líder · ${region.name}` : 'Región líder', valor: region ? enteroPE(region.count) : '—' },
    ],
    dispositivos: conParte(lista(d.byDevice), (x) => x.name),
    navegadores: conParte(lista(d.byBrowser), (x) => x.name),
    sistemas: conParte(lista(d.byOS), (x) => x.name),
    paises: conParte(lista(d.byCountry), (x) => nombreDePais(x.code, x.name)),
    paisesAprox: conParte(lista(d.byCountryAprox), (x) => nombreDePais(x.code, x.name)),
    diasSinPais: sinDesglose,
    primerDiaPais: cov.firstBreakdownDay || null,
    tipos: conParte(lista(d.byClientType), (x) => NOMBRES_TIPO[x.name] || x.name),
    cambioTipo,
    fuentes: lista(d.utmStats?.topSources).slice(0, 6).map((x) => ({ id: x.name, nombre: x.name, valor: x.value, texto: enteroPE(x.value) })),
    campanas: lista(d.utmStats?.topCampaigns).slice(0, 5).map((x) => ({ id: x.name, nombre: x.name, valor: x.count, texto: enteroPE(x.count) })),
    regiones: lista(d.geographyStats?.topRegions).slice(0, 6).map((x) => ({ id: x.name, nombre: x.name, valor: x.count, texto: enteroPE(x.count) })),
  };
}

/* ── Clientes y fidelidad (D5) ─────────────────────────── */

/*
 * Referidos (D5a): solo seguimiento. claimReferralSecure paga cuando el
 * pedido queda Finalizado en el ERP; aquí nadie aprueba nada.
 */
export const ESTADOS_REFERIDO = {
  sent: { texto: 'Enlace creado', tono: 'neutro', ayuda: 'Nadie lo abrió todavía' },
  clicked: { texto: 'Abrió el enlace', tono: 'neutro' },
  registered: { texto: 'Creó su cuenta', tono: 'violeta', ayuda: 'Por invitación' },
  purchased: { texto: 'Compró', tono: 'aviso', ayuda: 'Esperando la entrega' },
  completed: { texto: 'Aprobado', tono: 'exito', ayuda: 'Sistema anterior' },
  claimed: { texto: 'Monedas reclamadas', tono: 'exito' },
  ineligible: { texto: 'No califica', tono: 'peligro' },
};

/**
 * Un referido para la lista. estimar(total, referido) → monedas
 * (estimateReferralReward de services/referrals, la misma fórmula que paga el servidor).
 */
export function referidoDesdeFirestore(doc = {}, estimar = () => 0, nombreProducto = () => '') {
  const ms = msDeTs(doc.clickedAt) || msDeTs(doc.createdAt);
  const conPedido = Boolean(doc.orderId);
  const reclamado = doc.status === 'claimed';
  return {
    id: doc.id,
    creadoMs: ms,
    codigo: doc.referrerCode || '',
    enlace: doc.tipo === 'invitacion' ? 'Invitación'
      : doc.productId ? (nombreProducto(doc.productId) || `Producto ${doc.productId}`)
        : doc.linkId || !doc.tipo ? 'Enlace anterior' : 'Tienda',
    // Del sistema anterior: un registro por cada vez que alguien pulsó
    // compartir, aunque nadie lo abriera.
    anterior: Boolean(doc.linkId) || !doc.tipo,
    cuentaNueva: Boolean(doc.invitadoUid) || doc.status === 'registered',
    quien: doc.status === 'sent' ? '' : (doc.visitanteNombre || 'Visitante sin cuenta'),
    pedido: doc.orderId || '',
    venta: Number(doc.orderTotal) || 0,
    monedas: conPedido ? (reclamado ? Number(doc.earnedCoins) || 0 : estimar(doc.orderTotal, doc)) : null,
    estimado: conPedido && !reclamado,
    estado: ESTADOS_REFERIDO[doc.status] ? doc.status : 'sent',
  };
}

/** Monedas ya reclamadas y las que faltan (estimadas) de unos referidos. */
const monedasDe = (l) => ({
  pagadas: l.filter((r) => r.estado === 'claimed').reduce((a, r) => a + (r.monedas || 0), 0),
  porPagar: l.filter((r) => r.estimado && r.estado !== 'ineligible').reduce((a, r) => a + (r.monedas || 0), 0),
});

/**
 * Las cifras de arriba: cuántas personas comparten, cuántas visitas tuvieron
 * (sin los enlaces del sistema anterior que nadie abrió), cuentas nuevas,
 * compras y monedas.
 */
export function resumenReferidos(referidos = []) {
  const l = lista(referidos);
  return {
    personas: new Set(l.map((r) => r.codigo || '—')).size,
    entraron: l.filter((r) => r.estado !== 'sent').length,
    sinAbrir: l.filter((r) => r.estado === 'sent').length,
    cuentas: l.filter((r) => r.cuentaNueva).length,
    compraron: l.filter((r) => r.pedido).length,
    ...monedasDe(l),
  };
}

export const ESTADOS_REFERENTE = {
  compraron: { texto: 'Con compras', tono: 'exito' },
  visitas: { texto: 'Con visitas', tono: 'violeta' },
  sinVisitas: { texto: 'Sin visitas', tono: 'neutro', ayuda: 'Compartió, pero nadie abrió su enlace' },
};

/**
 * Una fila por persona que comparte (su código de referido), con sus
 * visitas dentro. perfiles: { CODIGO: { nombre, uid } } de portal_clientes_users.
 * Los enlaces del sistema anterior que nadie abrió solo se cuentan
 * (sinAbrir): no son visitas. Primero los que trajeron compras, después los
 * que tuvieron más visitas, después lo más reciente.
 */
export function referentesDesde(referidos = [], perfiles = {}) {
  const grupos = new Map();
  for (const r of lista(referidos)) {
    const codigo = r.codigo || '—';
    if (!grupos.has(codigo)) grupos.set(codigo, { codigo, todos: [] });
    grupos.get(codigo).todos.push(r);
  }
  return [...grupos.values()].map(({ codigo, todos }) => {
    const visitas = todos.filter((r) => r.estado !== 'sent').sort((a, b) => (b.creadoMs || 0) - (a.creadoMs || 0));
    const compras = todos.filter((r) => r.pedido);
    const perfil = perfiles[codigo] || {};
    return {
      id: codigo,
      codigo,
      nombre: perfil.nombre || '',
      uid: perfil.uid || '',
      visitas,
      abrieron: visitas.length,
      sinAbrir: todos.length - visitas.length,
      cuentas: todos.filter((r) => r.cuentaNueva).length,
      compraron: compras.length,
      ventas: compras.reduce((a, r) => a + (r.venta || 0), 0),
      ...monedasDe(todos),
      ultimoMs: Math.max(0, ...todos.map((r) => r.creadoMs || 0)),
      estado: compras.length ? 'compraron' : visitas.length ? 'visitas' : 'sinVisitas',
    };
  }).sort((a, b) => b.compraron - a.compraron || b.abrieron - a.abrieron || b.ultimoMs - a.ultimoMs);
}

/*
 * Misiones diarias (D5a): `missions` con su verificación (actionKey de
 * constants/missionActions; sin ella, el cliente la marca él mismo).
 */
export function misionDesdeFirestore(doc = {}) {
  return {
    id: doc.id,
    nombre: doc.title || '',
    descripcion: doc.description || '',
    monedas: Number(doc.rewardPoints) || 0,
    orden: Number(doc.order) || 0,
    activa: doc.active !== false,
    verificacion: doc.actionKey || '',
  };
}

/** Lo que se guarda (como antes: textos recortados y números). */
export function misionAFirestore(m = {}) {
  return {
    title: String(m.nombre || '').trim(),
    description: String(m.descripcion || '').trim(),
    rewardPoints: Number(m.monedas) || 0,
    order: Number(m.orden) || 0,
    active: m.activa !== false,
    actionKey: m.verificacion || '',
  };
}

/*
 * Retos semanales (D5a): el catálogo `weeklyChallenges`, el reto activo
 * (`globals/activeChallenge`, siete días) y las evidencias pendientes.
 */
export const RECOMPENSAS_RETO = [
  { valor: 'main', texto: 'Monedas' },
  { valor: 'kapi_double_3d', texto: 'Doble monedas al alimentar a Kapi (3 días)' },
];

/*
 * Qué cuenta en un reto. La tienda solo reporta sola "agregar a la Lista de
 * Deseos" (WishlistContext → recordChallengeEventSecure); lo demás se cumple
 * con evidencia: un actionType que empieza con 'manual_' hace que la ventana
 * de Kapi pida el enlace (retoDesdePerfil) y el admin lo aprueba.
 */
export const ACCIONES_RETO = [
  { valor: 'add_wishlist', texto: 'Agregar a la Lista de Deseos (cuenta solo)' },
  { valor: 'manual_evidencia', texto: 'Con evidencia: manda un enlace y tú lo apruebas' },
];
export const esRetoConEvidencia = (accion) => String(accion || '').startsWith('manual_');
/** El texto de "Qué cuenta"; uno viejo que no está en la lista sale con su id. */
export const textoAccionReto = (accion) => ACCIONES_RETO.find((a) => a.valor === accion)?.texto
  || (esRetoConEvidencia(accion) ? 'Con evidencia' : accion ? `${accion} (no cuenta solo)` : '—');

export const recompensaDeReto = (r = {}) => (r.tipo === 'kapi_double_3d' || r.rewardType === 'kapi_double_3d'
  ? 'Doble monedas al alimentar a Kapi (3 días)'
  : `${enteroPE(r.monedas ?? r.rewardCoins)} monedas`);

export function retoDesdeFirestore(doc = {}) {
  return {
    id: doc.id,
    nombre: doc.title || '',
    descripcion: doc.description || '',
    accion: doc.actionType || '',
    meta: Number(doc.goal) || 1,
    monedas: Number(doc.rewardCoins) || 0,
    tipo: doc.rewardType === 'kapi_double_3d' ? 'kapi_double_3d' : 'main',
  };
}

export function retoAFirestore(r = {}) {
  return {
    title: String(r.nombre || '').trim(),
    description: String(r.descripcion || '').trim(),
    actionType: String(r.accion || '').trim(),
    // Con evidencia se aprueba una vez: la meta es 1.
    goal: esRetoConEvidencia(r.accion) ? 1 : Math.max(1, Number(r.meta) || 1),
    rewardCoins: r.tipo === 'kapi_double_3d' ? 0 : Number(r.monedas) || 0,
    rewardType: r.tipo === 'kapi_double_3d' ? 'kapi_double_3d' : 'main',
  };
}

/** El documento de `globals/activeChallenge` para activar un reto desde ahora por siete días (como antes). */
export function retoActivoDesde(r = {}, ahora = new Date()) {
  const g = retoAFirestore(r);
  return {
    challengeId: r.id, title: g.title, description: g.description, actionType: g.actionType, goal: g.goal,
    rewardCoins: g.rewardCoins, rewardType: g.rewardType,
    startedAt: ahora.toISOString(), expiresAt: new Date(ahora.getTime() + 7 * DIA_MS).toISOString(),
  };
}

/** Una evidencia pendiente con la recompensa de su reto (la del catálogo o la del activo). */
export function evidenciaDesde(doc = {}, retos = [], activo = null) {
  const ref = lista(retos).find((r) => r.id === doc.challengeId) || (activo ? retoDesdeFirestore({ ...activo, id: activo.challengeId }) : null);
  return {
    id: doc.id,
    quien: doc.userName || 'Cliente',
    uid: doc.userId || '',
    reto: ref?.nombre || doc.challengeId || '',
    tipo: doc.evidenceType === 'image' ? 'imagen' : 'enlace',
    url: doc.evidenceUrl || '',
    enviadaMs: msDeTs(doc.submittedAt),
    monedas: ref ? ref.monedas : 0,
    tipoRecompensa: ref ? ref.tipo : 'main',
  };
}

/*
 * Recompensas (D5b): el catálogo `rewards` que el cliente canjea con sus
 * monedas. Lo que da cada una es un tipo: a mano (un código para el asesor)
 * o un cupón automático (descuento, en un producto, producto gratis, envío gratis).
 */
export const TIPOS_RECOMPENSA = [
  { valor: 'manual', texto: 'Se entrega a mano' },
  { valor: 'descuento', texto: 'Descuento en el pedido' },
  { valor: 'producto_descuento', texto: 'Descuento en un producto' },
  { valor: 'producto_gratis', texto: 'Producto gratis' },
  { valor: 'envio_gratis', texto: 'Envío gratis' },
  { valor: 'stickers_whatsapp', texto: 'Stickers de WhatsApp (en la app)' },
];
export const RECOMPENSA_CON_PRODUCTO = ['producto_descuento', 'producto_gratis'];
export const RECOMPENSA_CON_VIGENCIA = ['descuento', 'producto_descuento', 'producto_gratis', 'envio_gratis'];

/** Lo que ve el cliente que gana (textoPremio de utils/ruletaModel para estos tipos); a mano, ''. */
export function beneficioDeRecompensa(r = {}) {
  const pct = Number(r.descuentoPct) || 0;
  const tope = Number(r.topeDescuento) || 0;
  const deMarca = r.marcaId && r.marcaNombre ? ` en productos de ${r.marcaNombre}` : '';
  switch (r.tipo) {
    case 'descuento':
      return pct > 0 ? `${pct}% de descuento${deMarca}${tope > 0 ? ` (hasta S/ ${tope.toFixed(2)})` : ''}` : `S/ ${(Number(r.descuentoMonto) || 0).toFixed(2)} de descuento${deMarca}`;
    case 'producto_descuento':
      return `${pct}% en ${r.productoNombre || r.productName || 'un producto'}`;
    case 'producto_gratis':
      return `${r.productoNombre || r.productName || 'Un producto'} gratis`;
    case 'envio_gratis':
      return r.marcaId && r.marcaNombre ? `Envío gratis con productos de ${r.marcaNombre}` : 'Envío gratis';
    case 'stickers_whatsapp':
      return 'Stickers para WhatsApp, en la app de Walá';
    default:
      return '';
  }
}

export function recompensaAdminDesdeFirestore(doc = {}) {
  return {
    id: doc.id,
    nombre: doc.title || '',
    descripcion: doc.description || '',
    cuesta: Number(doc.cost) || 0,
    nota: doc.value || '',
    orden: Number(doc.order) || 0,
    activa: doc.active !== false,
    tipo: TIPOS_RECOMPENSA.some((t) => t.valor === doc.tipo) ? doc.tipo : 'manual',
    descuentoPct: Number(doc.descuentoPct) || 0,
    descuentoMonto: Number(doc.descuentoMonto) || 0,
    topeDescuento: Number(doc.topeDescuento) || 0,
    productoId: doc.productId || '',
    productoNombre: doc.productName || '',
    vigenciaDias: Number(doc.vigenciaDias) || 30,
    imagen: doc.imageUrl || '',
    packId: doc.packId || '',
    marcaId: doc.brandId || '',
    marcaNombre: doc.brandId ? doc.marcaNombre || '' : '',
  };
}

/** Lo que se guarda (como antes: sin producto si el tipo no lo pide). */
export function recompensaAdminAFirestore(r = {}) {
  const conProducto = RECOMPENSA_CON_PRODUCTO.includes(r.tipo);
  return {
    title: String(r.nombre || '').trim(),
    description: String(r.descripcion || '').trim(),
    cost: Number(r.cuesta) || 0,
    value: String(r.nota || '').trim(),
    order: Number(r.orden) || 0,
    active: r.activa !== false,
    tipo: r.tipo || 'manual',
    descuentoPct: Number(r.descuentoPct) || 0,
    descuentoMonto: Number(r.descuentoMonto) || 0,
    topeDescuento: Number(r.topeDescuento) || 0,
    productId: conProducto ? r.productoId || '' : '',
    productName: conProducto ? r.productoNombre || '' : '',
    vigenciaDias: Number(r.vigenciaDias) || 30,
    imageUrl: r.imagen || '',
    packId: r.tipo === 'stickers_whatsapp' ? r.packId || '' : '',
    // Un cupón de una marca: solo descuenta sus productos.
    brandId: CUPON_CON_MARCA.includes(r.tipo) ? r.marcaId || '' : '',
    marcaNombre: CUPON_CON_MARCA.includes(r.tipo) && r.marcaId ? r.marcaNombre || '' : '',
  };
}

/** Los errores del formulario (como antes, y el porcentaje no pasa de 100). */
export function erroresDeRecompensa(r = {}) {
  const pct = Number(r.descuentoPct) || 0;
  return {
    nombre: String(r.nombre || '').trim() ? undefined : 'Escribe el título de la recompensa.',
    packId: r.tipo === 'stickers_whatsapp' && !r.packId ? 'Elige el pack de stickers.' : undefined,
    productoId: RECOMPENSA_CON_PRODUCTO.includes(r.tipo) && !r.productoId ? 'Elige el producto de la recompensa.' : undefined,
    topeDescuento: r.tipo === 'descuento' && pct > 0 && !(Number(r.topeDescuento) > 0) ? 'Pon un tope en soles para el descuento por porcentaje.' : undefined,
    descuentoPct: (r.tipo === 'descuento' || r.tipo === 'producto_descuento') && (pct < 0 || pct > 100) ? 'El porcentaje va de 0 a 100.' : undefined,
  };
}

/*
 * Canjes del catálogo (Recompensas › Canjes): lo que dio canjesRecompensasSecure.
 * Los que se entregan a mano (cupón sin tipo) están por entregar hasta que el
 * equipo los marca; los de descuento y envío los usa el cliente en el carrito.
 */
export const ESTADOS_CANJE = {
  porEntregar: { texto: 'Por entregar', tono: 'aviso' },
  enLaApp: { texto: 'Falta añadirlos', tono: 'violeta', ayuda: 'Se añaden a WhatsApp desde la app' },
  entregado: { texto: 'Entregado', tono: 'exito' },
  sinUsar: { texto: 'Cupón sin usar', tono: 'violeta', ayuda: 'Lo aplica el cliente en el carrito' },
  usado: { texto: 'Cupón usado', tono: 'exito' },
  vencido: { texto: 'Venció', tono: 'neutro' },
};

/** wa.me sin el +: 9 dígitos de Perú llevan el 51 delante. */
const whatsappDeTelefono = (tel) => {
  const d = String(tel || '').replace(/\D/g, '');
  if (d.length < 7) return '';
  return `https://wa.me/${d.length === 9 ? `51${d}` : d}`;
};

/** hoy: 'AAAA-MM-DD' de Lima (los cupones vencen por día, como en el servidor). */
export function canjeDesde(c = {}, hoy = '') {
  const digital = c.entrega === 'stickers_whatsapp';
  const manual = !c.tipo && !digital;
  const usado = c.status === 'used' || Boolean(c.orderId);
  const estado = digital
    ? (usado ? 'entregado' : 'enLaApp')
    : manual
    ? (usado ? 'entregado' : 'porEntregar')
    : (usado ? 'usado' : c.expiraEn && hoy && c.expiraEn < hoy ? 'vencido' : 'sinUsar');
  const cliente = c.cliente || {};
  return {
    id: c.id,
    codigo: c.code || '',
    recompensa: c.titulo || 'Recompensa',
    manual,
    digital,
    estado,
    creadoMs: c.creadoMs || null,
    entregadoMs: c.entregadoMs || null,
    entregadoPor: c.entregadoPor === 'app' ? 'desde la app' : c.entregadoPor || '',
    pedido: c.orderId || '',
    cliente: cliente.nombre || cliente.email || 'Cliente sin nombre',
    telefono: cliente.telefono || '',
    email: cliente.email || '',
    whatsapp: whatsappDeTelefono(cliente.telefono),
  };
}

/** Primero los que hay que entregar; después, del más nuevo al más viejo. */
export function canjesDesde(lista_ = [], hoy = '') {
  return lista(lista_).map((c) => canjeDesde(c, hoy))
    .sort((a, b) => (b.estado === 'porEntregar') - (a.estado === 'porEntregar') || (b.creadoMs || 0) - (a.creadoMs || 0));
}

export function resumenCanjes(canjes = []) {
  const l = lista(canjes);
  const de = (e) => l.filter((c) => c.estado === e).length;
  return { porEntregar: de('porEntregar'), entregados: de('entregado'), sinUsar: de('sinUsar'), usados: de('usado'), total: l.length };
}

/* ── D5c · Fechas importantes ─────────────────────────── */

/*
 * Las reglas de las fechas festivas (cuándo caen, a quién le tocan) viven en
 * utils/fechasFestivas.mjs: la página las usa de ahí. Aquí va lo que el
 * admin necesita aparte: el mes del calendario, las fechas que anotaron los
 * clientes y sus paquetes de regalo.
 */
const DIA_FECHAS_MS = 24 * 60 * 60 * 1000;
const dosCifras = (n) => String(n).padStart(2, '0');
const isoDeUtc = (t) => {
  const d = new Date(t);
  return `${d.getUTCFullYear()}-${dosCifras(d.getUTCMonth() + 1)}-${dosCifras(d.getUTCDate())}`;
};
const utcDeIso = (iso) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
  return m ? Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
};
const MESES_FECHAS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

/**
 * Las semanas de un mes (lunes primero) para el calendario.
 *  - anio · mes (1-12) · hoy ('YYYY-MM-DD')
 * → { titulo: 'noviembre de 2026', semanas: [[{ iso, dia, delMes, hoy }]] }
 */
export function semanasDelMes(anio, mes, hoy = '') {
  const primero = Date.UTC(anio, mes - 1, 1);
  const ultimo = Date.UTC(anio, mes, 0);
  const atras = (new Date(primero).getUTCDay() + 6) % 7;
  const adelante = (7 - new Date(ultimo).getUTCDay()) % 7;
  const semanas = [];
  for (let t = primero - atras * DIA_FECHAS_MS; t <= ultimo + adelante * DIA_FECHAS_MS; t += DIA_FECHAS_MS) {
    if (!semanas.length || semanas[semanas.length - 1].length === 7) semanas.push([]);
    const d = new Date(t);
    const iso = isoDeUtc(t);
    semanas[semanas.length - 1].push({ iso, dia: d.getUTCDate(), delMes: d.getUTCMonth() === mes - 1, hoy: iso === hoy });
  }
  return { titulo: `${MESES_FECHAS[mes - 1]} de ${anio}`, semanas };
}

/** El mes de al lado: (2026, 12, +1) → { anio: 2027, mes: 1 }. */
export function mesVecino(anio, mes, paso) {
  const i = anio * 12 + (mes - 1) + paso;
  return { anio: Math.floor(i / 12), mes: (i % 12) + 1 };
}

/**
 * Una fecha que anotó un cliente (una fila de adminFechasDeUsuarios /
 * getUserDates) → lo que muestra el admin. `proxima` es la próxima vez que
 * se celebra (hoy cuenta; un 29 de febrero cae el 28 si el año no es bisiesto).
 */
export function fechaClienteDesde(f = {}, hoy = '') {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(f.eventDate || ''));
  const mes = m ? Number(m[2]) : 0;
  const dia = m ? Number(m[3]) : 0;
  let proxima = '';
  let dias = null;
  const base = utcDeIso(hoy);
  if (m && base != null) {
    const enAnio = (a) => Date.UTC(a, mes - 1, Math.min(dia, new Date(Date.UTC(a, mes, 0)).getUTCDate()));
    const anio = new Date(base).getUTCFullYear();
    let t = enAnio(anio);
    if (t < base) t = enAnio(anio + 1);
    proxima = isoDeUtc(t);
    dias = Math.round((t - base) / DIA_FECHAS_MS);
  }
  const anioNacio = m && m[1] !== '0000' ? Number(m[1]) : null;
  return {
    id: `${f.userId}_${f.recipientId}_${f.eventId || f.eventType}`,
    clienteId: f.userId || '',
    cliente: f.userEmail || 'Sin correo',
    personaId: f.recipientId || '',
    persona: f.recipientName || 'Sin nombre',
    relacion: f.recipientRole || 'Otro',
    rolClave: f.recipientRoleKey || 'otros',
    genero: f.recipientGender || '',
    presupuesto: f.recipientBudget || '',
    gustos: Array.isArray(f.selectedCategories) ? f.selectedCategories : [],
    respuestas: f.categoryAnswers || {},
    eventoId: f.eventId || '',
    evento: f.eventType || 'Fecha',
    fecha: m ? `${dia} de ${MESES_FECHAS[mes - 1]}${anioNacio ? ` de ${anioNacio}` : ''}` : 'Sin fecha',
    mesDia: m ? `${m[2]}-${m[3]}` : '',
    proxima,
    dias,
    cumple: anioNacio && proxima ? Number(proxima.slice(0, 4)) - anioNacio : null,
  };
}

/** "Hoy", "Mañana", "En 12 días" (o '' sin fecha). */
export function cuandoFecha(dias) {
  if (dias == null) return '';
  if (dias === 0) return 'Hoy';
  if (dias === 1) return 'Mañana';
  return `En ${dias} días`;
}

/** Los filtros de las fechas de clientes: ventanas desde hoy (hoy cuenta). */
export const FILTROS_FECHAS_CLIENTES = [
  { valor: '1', texto: 'Hoy y mañana' },
  { valor: '7', texto: 'Próximos 7 días' },
  { valor: '30', texto: 'Próximos 30 días' },
];
export const fechaEnVentana = (f, ventana) => !ventana || (f.dias != null && f.dias <= Number(ventana));

/** Un paquete de suggestedPackages → el admin. */
export function paqueteDesdeFirestore(p = {}) {
  return {
    id: p.id,
    clienteId: p.userId || '',
    personaId: p.recipientId || '',
    eventoId: p.eventId || '',
    evento: p.eventType || '',
    elegido: p.isSelected === true,
    estado: p.status || '',
    productos: (Array.isArray(p.products) ? p.products : []).map((x) => ({ id: x.id, nombre: x.name || 'Producto', precio: Number(x.price) || 0, imagen: x.image || '' })),
  };
}

/** Lo que se guarda de un paquete nuevo (el primero de una fecha sale ya elegido). */
export function paqueteAFirestore(productos = [], fecha = {}, primero = false) {
  return {
    userId: fecha.clienteId,
    recipientId: fecha.personaId,
    eventId: fecha.eventoId,
    eventType: fecha.evento,
    products: productos.map((x) => ({ id: x.id, name: x.nombre, price: Number(x.precio) || 0, image: x.imagen || '' })),
    status: 'pending_notification',
    isSelected: primero,
  };
}

/** Los paquetes de una fecha (mismo cliente, persona y tipo de fecha, como antes). */
export const paquetesDeFecha = (paquetes = [], f = {}) => paquetes.filter((p) => p.clienteId === f.clienteId && p.personaId === f.personaId && p.evento === f.evento);

/** Elegir uno como la oferta: los cambios que hay que guardar ([{ id, elegido }]). */
export function cambiosAlElegir(paquetes = [], id) {
  return paquetes.filter((p) => (p.id === id) !== p.elegido).map((p) => ({ id: p.id, elegido: p.id === id }));
}

/** Al borrar el elegido, el siguiente de la misma fecha pasa a elegido (id o null). */
export function siguienteElegido(paquetes = [], borrado = {}) {
  if (!borrado.elegido) return null;
  return paquetes.find((p) => p.id !== borrado.id)?.id || null;
}

/** "Paquete elegido" · "2 borradores" · "Sin paquete". */
export function estadoDePaquetes(paquetes = []) {
  // Sin paquete no es "pendiente": le llegan las ideas automáticas del buscador de regalos.
  if (!paquetes.length) return { estado: 'sin', texto: 'Ideas automáticas' };
  if (paquetes.some((p) => p.elegido)) return { estado: 'elegido', texto: paquetes.length > 1 ? `Paquete del equipo (de ${paquetes.length})` : 'Paquete del equipo' };
  return { estado: 'borrador', texto: paquetes.length === 1 ? '1 borrador' : `${paquetes.length} borradores` };
}

/** "14, 7 2" → [14, 7, 2] (de mayor a menor, sin repetir; `min` 0 deja "el mismo día"). */
export function diasDesdeTexto(texto = '', min = 1) {
  return [...new Set(String(texto).split(/[,\s]+/).filter(Boolean).map(Number)
    .filter((n) => Number.isInteger(n) && n >= min && n <= 60))].sort((a, b) => b - a);
}

/** Un id para una fecha festiva nueva, a partir del nombre ("Día del Abuelo" → dia_del_abuelo). */
export function idDeFestiva(nombre, usados = []) {
  const base = String(nombre || 'fecha').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 30) || 'fecha';
  let id = base;
  let i = 2;
  while (usados.includes(id)) id = `${base}_${i++}`;
  return id;
}

/* ── D5d · Notificaciones y ofertas ───────────────────── */

/*
 * notification_settings/global: qué avisos automáticos salen, en qué horario
 * (hora de Lima) y con qué texto (dos textos = prueba A/B). Lo lee el motor
 * del servidor (functions/notificationsEngine.js): las claves no cambian.
 */
export const CATEGORIAS_NOTIF = [
  { clave: 'cart_abandoned', nombre: 'Carrito abandonado', detalle: 'Avisa a la 1 h, 24 h y 48 h a quien dejó productos en el carrito. Solo a quien tiene la app.', desde: '09:00', hasta: '21:00' },
  { clave: 'retention', nombre: 'Kapi te extraña', detalle: 'Avisa a quien no abre la app hace 7 o 14 días. Solo a quien tiene la app.', desde: '09:00', hasta: '21:00' },
  { clave: 'survey', nombre: 'Encuesta pendiente', detalle: 'Una vez al día: a quien creó su cuenta y no respondió la encuesta le recuerda a los 3 y a los 10 días. Después no insiste.', desde: '10:00', hasta: '20:00' },
  { clave: 'orders', nombre: 'Pedidos', detalle: 'Cuando se confirma el pago, entra a producción, sale a reparto y se entrega. Fuera de horario queda en la campanita y la push no sale.', desde: '08:00', hasta: '21:00' },
  { clave: 'product_views', nombre: 'Producto que estuvo mirando', detalle: 'Una vez al día: a quien miró un producto 3 veces o más (o más de 2 minutos) y no lo compró.', desde: '11:00', hasta: '20:00' },
  { clave: 'promos', nombre: 'Ofertas programadas', detalle: 'Las ofertas programadas solo salen en este horario; apagado, quedan en espera. «Enviar ahora» fuera de horario pide confirmación.', desde: '10:00', hasta: '20:00' },
];

const TEXTOS_NOTIF = {
  cart_1h: ['Tu regalo te está esperando.', '📦', '¿Terminamos?'],
  cart_24h: ['El box que elegiste sigue en tu carrito.', '🎁', '¿Terminamos de armarlo?'],
  cart_48h: ['Última oportunidad. Tu carrito se vacía mañana.', '⏳', '¿Lo completamos?'],
  retention_7d: ['Kapi te extraña mucho. Lleva varios días sin verte', '😢', 'Abre la app'],
  retention_14d: ['Tienes {monedas} monedas que se van a perder. Y Kapi está triste...', '💔', 'Sálvalas'],
  product_view: ['¿Te quedaste pensando en {producto}?', '👀', 'Sigue disponible'],
  survey_3d: ['Responde tu encuesta y te regalamos 15 monedas', '🪙', ''],
  survey_10d: ['Tu encuesta sigue pendiente. Respóndela y llévate 15 monedas', '🎁', ''],
};

/** Los avisos automáticos con texto editable, agrupados como los piensa el negocio. `titulo` lo pone el motor. */
export const GRUPOS_AVISOS = [
  { id: 'carrito', nombre: 'Carrito abandonado', detalle: 'Para quien agregó productos al carrito y no terminó de comprar.', avisos: [
    { clave: 'cart_1h', nombre: '1 hora después', cuando: 'Sale 1 hora después de que dejó el carrito.', titulo: '🛒 Tu Carrito' },
    { clave: 'cart_24h', nombre: 'Al día siguiente', cuando: 'Sale a las 24 horas, si todavía no compró.', titulo: '🛒 Tu Carrito' },
    { clave: 'cart_48h', nombre: 'Último aviso', cuando: 'Sale a las 48 horas: el último recordatorio del carrito.', titulo: '🛒 Tu Carrito' },
  ] },
  { id: 'mirando', nombre: 'Producto que estuvo mirando', detalle: 'Para quien miró un producto varias veces y no lo compró.', avisos: [
    { clave: 'product_view', nombre: 'Al día siguiente', cuando: 'Una vez al día a quien lo miró 3+ veces o más de 2 minutos. El mismo producto no se repite en 14 días.', titulo: '👀 Lo que estuviste viendo', conProducto: true },
  ] },
  { id: 'kapi', nombre: 'Kapi te extraña', detalle: 'Para quien dejó de abrir la app (Kapi es la mascota virtual).', avisos: [
    { clave: 'retention_7d', nombre: 'Después de 7 días', cuando: 'Sale cuando lleva 7 días sin abrir la app.', titulo: 'Mascota Hambrienta' },
    { clave: 'retention_14d', nombre: 'Después de 14 días', cuando: 'Sale cuando lleva 14 días sin abrir la app.', titulo: 'Kapi te extraña' },
  ] },
  { id: 'encuesta', nombre: 'Encuesta pendiente', detalle: 'Para quien creó su cuenta y no respondió la encuesta. Lleva a /encuesta-suscripcion.', avisos: [
    { clave: 'survey_3d', nombre: 'A los 3 días', cuando: 'Sale 3 días después de crear la cuenta, si no respondió.', titulo: '📝 Tu encuesta te espera', probable: true },
    { clave: 'survey_10d', nombre: 'A los 10 días', cuando: 'Sale a los 10 días, si sigue sin responder. Es el último.', titulo: '📝 Tu encuesta te espera', probable: true },
  ] },
];

const textoAviso = (v) => (v ? { texto: v.text || '', emoji: v.emoji || '', frase: v.cta || '' } : null);

/** notification_settings/global → { activos, horarios, textos } (lo que falta sale de los valores de siempre). */
export function configNotificacionesDesde(doc = {}) {
  const d = doc || {};
  const activos = {};
  const horarios = {};
  CATEGORIAS_NOTIF.forEach((c) => {
    activos[c.clave] = d.categories?.[c.clave] !== false;
    const h = d.schedules?.[c.clave] || {};
    horarios[c.clave] = { desde: h.start || c.desde, hasta: h.end || c.hasta };
  });
  const textos = {};
  Object.entries(TEXTOS_NOTIF).forEach(([clave, [texto, emoji, frase]]) => {
    const g = d.copys?.[clave];
    textos[clave] = { a: textoAviso(g?.a) || { texto, emoji, frase }, b: textoAviso(g?.b) };
  });
  return { activos, horarios, textos };
}

/** Lo que se guarda en notification_settings/global (las mismas claves del motor). */
export function configNotificacionesAFirestore(c = {}) {
  const deTexto = (v) => (v ? { text: String(v.texto || '').trim(), emoji: String(v.emoji || '').trim(), cta: String(v.frase || '').trim() } : null);
  const categories = {};
  const schedules = {};
  CATEGORIAS_NOTIF.forEach(({ clave }) => {
    categories[clave] = c.activos?.[clave] !== false;
    schedules[clave] = { start: c.horarios?.[clave]?.desde, end: c.horarios?.[clave]?.hasta };
  });
  const copys = {};
  Object.entries(c.textos || {}).forEach(([clave, v]) => { copys[clave] = { a: deTexto(v.a), b: deTexto(v.b) }; });
  return { categories, schedules, copys };
}

/** El mensaje como lo arma el motor (texto + frase + emoji), con datos de ejemplo. */
export function vistaPreviaAviso(v) {
  return [v?.texto, v?.frase, v?.emoji].map((x) => String(x || '').trim()).filter(Boolean).join(' ')
    .replace(/\{nombre\}/g, 'María').replace(/\{monedas\}/g, '25').replace(/\{producto\}/g, 'Casaca Dragon Ball · Gohan Beast');
}

/** Agrega {dato} al final del texto, con un espacio si hace falta. */
export const conDato = (texto = '', dato) => `${texto}${texto && !texto.endsWith(' ') ? ' ' : ''}{${dato}}`;

/** A quién le llega una oferta (lo filtra el servidor). */
export const SEGMENTOS_NOTIF = [
  { valor: 'all', texto: 'Todos', detalle: 'Todos los clientes' },
  { valor: 'vip', texto: 'VIP', detalle: 'Con 50 monedas o más' },
  { valor: 'inactive', texto: 'Inactivos', detalle: 'Sin abrir en 30 días o más' },
  { valor: 'cart', texto: 'Con carrito', detalle: 'Con productos en el carrito' },
  { valor: 'dates', texto: 'Con fechas', detalle: 'Con fechas importantes anotadas' },
];

export const ESTADOS_CAMPANA = {
  sent: { texto: 'Enviada', tono: 'exito' },
  scheduled: { texto: 'Programada', tono: 'violeta' },
  sending: { texto: 'Enviando', tono: 'aviso' },
  error: { texto: 'Con error', tono: 'peligro' },
  cancelled: { texto: 'Cancelada', tono: 'neutro' },
};

export const tasaTexto = (abiertos, enviados) => (enviados > 0 ? `${Math.round((abiertos / enviados) * 100)} %` : '—');

const msDeFecha = (v) => {
  if (!v) return 0;
  if (typeof v === 'number') return v;
  if (typeof v.toMillis === 'function') return v.toMillis();
  if (typeof v.seconds === 'number') return v.seconds * 1000;
  const n = Date.parse(v);
  return Number.isFinite(n) ? n : 0;
};

/** Una campaña (notification_campaigns) o una guardada (notification_drafts) → el admin. */
export function campanaDesde(c = {}) {
  const campanita = Number(c.inAppUsers) || 0;
  const abiertas = Number(c.opened) || 0;
  return {
    id: c.id,
    titulo: c.title || '',
    mensaje: c.body || '',
    enlace: c.link || '',
    imagen: c.image || '',
    segmento: SEGMENTOS_NOTIF.some((s) => s.valor === c.segment) ? c.segment : 'all',
    productoId: c.productId || '',
    productoNombre: c.productName || '',
    estado: c.status || '',
    fechaMs: msDeFecha(c.sentAt) || msDeFecha(c.scheduledAt) || msDeFecha(c.updatedAt) || msDeFecha(c.createdAt),
    push: c.pushUsers ?? null,
    campanita: c.inAppUsers ?? null,
    abiertas: c.status === 'sent' ? abiertas : null,
    tasa: c.status === 'sent' ? tasaTexto(abiertas, campanita) : '—',
  };
}

/** Lo que se guarda o se envía de una oferta (sin el cuándo). */
export function ofertaAFirestore(d = {}) {
  return {
    title: String(d.titulo || '').trim(),
    body: String(d.mensaje || '').trim(),
    link: String(d.enlace || '').trim(),
    image: d.imagen || '',
    segment: d.segmento || 'all',
    productId: d.productoId || '',
    productName: d.productoNombre || '',
  };
}

/** "Anunciar un producto" (productoAdminDesde): con oferta lo dice; si no, es una novedad. */
export function ofertaDeProducto(p = {}) {
  const s = (n) => (Number(n) || 0).toFixed(2).replace(/\.00$/, '');
  return {
    productoId: p.id,
    productoNombre: p.nombre,
    titulo: p.conOferta ? `🔥 Oferta: ${p.nombre}` : `✨ Nuevo: ${p.nombre}`,
    mensaje: p.conOferta ? `Ahora a S/ ${s(p.precio)} (antes S/ ${s(p.precioLista)}). Solo por tiempo limitado.` : `Llegó ${p.nombre}. Míralo antes de que se agote.`,
    enlace: `/producto/${p.id}`,
    ...(p.imagen ? { imagen: p.imagen } : {}),
  };
}

/** 'YYYY-MM-DD' + hora (0-23) en la hora del navegador → ISO (o '' si falta). */
export function programadaIso(dia, hora) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dia || ''));
  if (!m || hora === '' || hora == null) return '';
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(hora), 0, 0).toISOString();
}

/** Los errores de una oferta antes de enviarla (o de guardarla: `paraGuardar`). */
export function erroresDeOferta(d = {}, ahoraMs = Date.now(), paraGuardar = false) {
  const iso = d.cuando === 'programar' ? programadaIso(d.dia, d.hora) : '';
  return {
    titulo: String(d.titulo || '').trim() ? undefined : 'Escribe el título.',
    mensaje: String(d.mensaje || '').trim() ? undefined : 'Escribe el mensaje.',
    dia: paraGuardar || d.cuando !== 'programar' ? undefined
      : !iso ? 'Elige el día y la hora del envío.'
        : Date.parse(iso) <= ahoraMs ? 'Esa hora ya pasó: elige una que venga.' : undefined,
  };
}

/** Los nombres de los avisos en la tabla de "¿qué texto funciona mejor?". */
export const NOMBRES_AVISO = {
  cart_1h: 'Carrito 1 h', cart_24h: 'Carrito 24 h', cart_48h: 'Carrito 48 h',
  retention_7d: 'Kapi 7 días', retention_14d: 'Kapi 14 días',
  survey_3d: 'Encuesta 3 días', survey_10d: 'Encuesta 10 días',
  orders: 'Pedidos', product_view: 'Producto que estuvo mirando', fecha_recordatorio: 'Fechas importantes',
  fecha_festiva: 'Fechas festivas', manual_promo: 'Ofertas (campañas)',
};

/** Un doc de notification_stats → la fila de la comparación (con 50 envíos por texto ya se compara). */
export function filaDeEstadistica(st = {}) {
  const lado = (x = {}) => ({ enviados: Number(x.sent) || 0, abiertos: Number(x.opened) || 0, tasa: tasaTexto(Number(x.opened) || 0, Number(x.sent) || 0) });
  const a = lado(st.a);
  const b = lado(st.b);
  const ta = a.enviados ? a.abiertos / a.enviados : 0;
  const tb = b.enviados ? b.abiertos / b.enviados : 0;
  let mejor = '';
  if (b.enviados) mejor = a.enviados >= 50 && b.enviados >= 50 ? (ta === tb ? 'Empate' : ta > tb ? 'Texto 1' : 'Texto 2') : 'Faltan envíos';
  return { id: st.id, nombre: NOMBRES_AVISO[st.id] || st.id, a, b: b.enviados ? b : null, mejor };
}

/* ── D5e · Encuestas ──────────────────────────────────── */

/*
 * tienda_encuesta_config/global se edita TAL CUAL (la lee la encuesta del
 * cliente y el buscador de regalos): el kit no le cambia los nombres. Las
 * cuentas de las respuestas están en services/surveyResponses.mjs y
 * services/encuestaEntrega.mjs (puros): la página los usa de ahí.
 */
export const TIPOS_PREGUNTA = [
  { valor: 'text', texto: 'Texto corto' },
  { valor: 'textarea', texto: 'Texto largo' },
  { valor: 'select', texto: 'Opciones (botones de un toque)' },
];

/** Una pregunta nueva (`prefijo`: 'field' en Sobre ti, 'brandField' en un interés). */
export const preguntaNueva = (prefijo = 'field', ms = Date.now()) => ({ id: `${prefijo}_${ms}`, label: 'Nueva pregunta', type: 'text', required: false, options: [] });

/**
 * Las preguntas que salen y las que ya no, según lo GUARDADO: una que se
 * apaga no salta de lugar hasta guardar. Cada una con su índice real.
 */
export function separarPreguntas(campos = [], guardadas = []) {
  const retirada = (f) => (guardadas || []).some((g) => g.id === f.id && g.enEncuesta === false);
  const conIndice = (campos || []).map((f, i) => ({ pregunta: f, indice: i }));
  return { activas: conIndice.filter((x) => !retirada(x.pregunta)), retiradas: conIndice.filter((x) => retirada(x.pregunta)) };
}

/** Agrega una opción a una pregunta (sin vacías ni repetidas). */
export function conOpcion(opciones = [], nueva = '') {
  const t = String(nueva).trim();
  if (!t || opciones.some((o) => o.toLowerCase() === t.toLowerCase())) return opciones;
  return [...opciones, t];
}

export const OPCIONES_MEJORAR_ENTREGA = ['Tiempo de entrega', 'Calidad del producto', 'Empaque', 'Atención', 'Precio', 'Todo estuvo bien'];

/** entregaPanel ("¿Cómo te fue con tu pedido?"), como configEntregaPanel: monedas de 0 a 50 (5 si falta). */
export function entregaPanelDesde(raw) {
  const c = raw && typeof raw === 'object' ? raw : {};
  const monedas = Number(c.monedas);
  const opciones = Array.isArray(c.opcionesMejorar) ? c.opcionesMejorar.map((o) => String(o || '').trim()).filter(Boolean) : [];
  return {
    activo: c.activo !== false,
    // Igual que el servidor: null cuenta como 0 (Number(null)); solo si falta son 5.
    monedas: Number.isFinite(monedas) ? Math.max(0, Math.min(50, Math.round(monedas))) : 5,
    opcionesMejorar: opciones.length ? opciones : OPCIONES_MEJORAR_ENTREGA,
  };
}

/** El cambio del promedio de estrellas: "▲ 0.3 ★". */
export function cambioEstrellas(actual, previo) {
  if (actual == null || previo == null) return null;
  const d = Math.round(((Number(actual) || 0) - (Number(previo) || 0)) * 10) / 10;
  if (d === 0) return { texto: '= 0 ★', bueno: true };
  return { texto: `${d > 0 ? '▲' : '▼'} ${Math.abs(d)} ★`, bueno: d > 0 };
}

/** "★★★★☆" (con lo que falta en vacías). */
export const estrellasTexto = (n) => { const e = Math.max(0, Math.min(5, Math.round(Number(n) || 0))); return '★'.repeat(e) + '☆'.repeat(5 - e); };

/** Por día si el rango es corto (62 días o menos), si no por mes. Fechas 'YYYY-MM-DD'. */
export function unidadDeRango(desde, hasta) {
  if (!desde || !hasta) return 'mes';
  const d = (s) => Date.UTC(Number(s.slice(0, 4)), Number(s.slice(5, 7)) - 1, Number(s.slice(8, 10)));
  return Math.round((d(hasta) - d(desde)) / 86400000) + 1 <= 62 ? 'dia' : 'mes';
}

const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'set', 'oct', 'nov', 'dic'];
/** '2026-11-02' → '02/11' (día) · '2026-11' → 'nov 2026' (mes). */
export function etiquetaDePeriodo(valor = '', unidad = 'mes') {
  if (unidad === 'dia') { const [, m, d] = valor.split('-'); return `${d}/${m}`; }
  const [y, m] = valor.split('-');
  return `${MESES_CORTOS[Number(m) - 1]} ${y}`;
}

/** '2026-10-23' → '23/10/2026' ('' si no es una fecha). */
export const fechaDeDia = (dia) => (/^\d{4}-\d{2}-\d{2}/.test(dia || '') ? dia.slice(0, 10).split('-').reverse().join('/') : '');

/**
 * "Volver a preguntarla": la config con esa pregunta en la encuesta otra vez.
 *  - que: { tipo: 'basico', id } | { tipo: 'gusto', categoriaId, id } | { tipo: 'presupuesto' }
 * (el conector guarda el resultado con configConHistorial, que borra la fecha de retiro).
 */
export function configConPregunta(config = {}, que = {}) {
  const activar = (f) => (f.id === que.id ? { ...f, enEncuesta: true } : f);
  if (que.tipo === 'presupuesto') return { ...config, personPanel: { ...config.personPanel, budget: true } };
  if (que.tipo === 'basico') return { ...config, basicDataPanel: { ...config.basicDataPanel, fields: (config.basicDataPanel?.fields || []).map(activar) } };
  if (que.tipo === 'gusto') {
    return {
      ...config,
      brandsPanel: {
        ...config.brandsPanel,
        categories: (config.brandsPanel?.categories || []).map((c) => (c.id === que.categoriaId ? { ...c, fields: (c.fields || []).map(activar) } : c)),
      },
    };
  }
  return config;
}

/* ── D6a · Sorteos ────────────────────────────────────── */

/** Como slugify de AdminEnlaceEditor: minúsculas, sin tildes, guiones; sin cortar (un /l/… largo ya compartido no cambia). */
export const slugDeEnlace = (texto) => String(texto || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

/** Como slugifySorteo (services/sorteos): el mismo, hasta 60. */
export const slugDeSorteo = (texto) => slugDeEnlace(texto).slice(0, 60);

export const ESTADOS_SORTEO = {
  borrador: { texto: 'Borrador', tono: 'neutro' },
  activo: { texto: 'Activo', tono: 'exito' },
  cerrado: { texto: 'Cerrado', tono: 'violeta' },
  finalizado: { texto: 'Cerrado', tono: 'violeta' },
};

export const REQUISITOS_APP = [
  { valor: 'ninguno', texto: 'Sin requisito' },
  { valor: 'recomendado', texto: 'Recomienda usar la app' },
  { valor: 'obligatorio', texto: 'Solo desde la app' },
  // El servidor da +1 chance a quien entra desde la app y la tienda lo anuncia.
  { valor: 'chanceExtra', texto: '+1 chance desde la app' },
];

/** Un sorteo de Firestore → el admin. */
export function sorteoDesdeFirestore(s = {}) {
  return {
    id: s.id,
    nombre: s.titulo || '',
    slug: s.slug || '',
    descripcion: s.descripcion || '',
    tipo: s.tipo === 'pagado' ? 'pagado' : 'gratis',
    precioTicket: Number(s.precioTicket) || 0,
    requisitoApp: REQUISITOS_APP.some((r) => r.valor === s.requisitoApp) ? s.requisitoApp : 'ninguno',
    numGanadores: Number(s.numGanadores) || 1,
    premioNombre: s.premio?.nombre || '',
    premioImagen: s.premio?.imagenUrl || '',
    premioValor: Number(s.premio?.valor) || 0,
    portada: s.heroImagenUrl || '',
    inicio: s.fechaInicio || '',
    fin: s.fechaFin || '',
    estado: ESTADOS_SORTEO[s.estado] ? (s.estado === 'finalizado' ? 'cerrado' : s.estado) : 'borrador',
    chanceCompartir: Boolean(s.chanceExtraCompartir),
    chanceReferido: Boolean(s.chanceExtraReferido),
    participantes: Number.isFinite(Number(s.contadorParticipantes)) ? Number(s.contadorParticipantes) : null,
    ganadores: (Array.isArray(s.ganadores) ? s.ganadores : []).map((g) => ({ uid: g.uid || '', nombre: g.nombre || '', correo: g.correo || '', telefono: g.telefono || '' })),
    drawId: s.drawId || '',
  };
}

/** Lo que espera createSorteo / updateSorteo (sus nombres de formulario: el servicio arma el documento). */
export function sorteoAFormulario(d = {}) {
  return {
    titulo: String(d.nombre || '').trim(),
    slug: slugDeSorteo(d.slug || d.nombre),
    descripcion: String(d.descripcion || '').trim(),
    tipo: d.tipo === 'pagado' ? 'pagado' : 'gratis',
    precioTicket: d.tipo === 'pagado' ? Number(d.precioTicket) || 0 : 0,
    requisitoApp: d.requisitoApp || 'ninguno',
    numGanadores: Math.max(1, Math.round(Number(d.numGanadores) || 1)),
    premioNombre: String(d.premioNombre || '').trim(),
    premioImagenUrl: d.premioImagen || '',
    premioValor: Number(d.premioValor) || 0,
    heroImagenUrl: d.portada || '',
    fechaInicio: d.inicio || '',
    fechaFin: d.fin || '',
    estado: d.estado || 'borrador',
    chanceExtraCompartir: Boolean(d.chanceCompartir),
    chanceExtraReferido: Boolean(d.chanceReferido),
  };
}

/** Los errores del formulario (como antes, y las fechas en orden). */
export function erroresDeSorteo(d = {}) {
  return {
    nombre: String(d.nombre || '').trim() ? undefined : 'Escribe el título del sorteo.',
    precioTicket: d.tipo === 'pagado' && !(Number(d.precioTicket) > 0) ? 'Una rifa necesita un precio de ticket mayor a 0.' : undefined,
    numGanadores: Number(d.numGanadores) >= 1 ? undefined : 'Al menos un ganador.',
    fin: d.inicio && d.fin && d.fin < d.inicio ? 'Termina antes de empezar.' : undefined,
  };
}

/** "Gratis" · "Rifa · S/ 5". */
export const tipoDeSorteo = (s = {}) => (s.tipo === 'pagado' ? `Rifa · S/ ${Number(s.precioTicket) || 0}` : 'Gratis');

/** Un participante (sorteos/{id}/participantes). */
export function participanteDesde(p = {}) {
  return {
    id: p.id,
    nombre: p.nombre || '',
    correo: p.correo || '',
    telefono: p.telefono || '',
    dni: p.dni || '',
    tickets: Number(p.tickets) || 0,
    pagados: Number(p.ticketsPagados) || 0,
    chances: Number(p.chancesTotal) || 0,
    estado: p.estado || '',
    app: Boolean(p.origenApp),
  };
}

/** Lo que se manda al servidor para identificar a quién (sin vacíos). */
export const identificadorDe = (d = {}) => Object.fromEntries(['correo', 'telefono', 'dni']
  .map((k) => [k, String(d[k] || '').trim()]).filter(([, v]) => v));

/** Errores de "Sumar tickets" (cantidad > 0) o "Dar o quitar chances" (entero distinto de 0). */
export function erroresDeAjuste(d = {}, tipo = 'tickets') {
  const sinQuien = !Object.keys(identificadorDe(d)).length;
  const n = Number(tipo === 'tickets' ? d.cantidad : d.chances);
  return {
    correo: sinQuien ? 'Escribe su correo, teléfono o DNI.' : undefined,
    cantidad: tipo === 'tickets' && !(Number.isInteger(n) && n > 0) ? 'Un número entero mayor a 0.' : undefined,
    chances: tipo === 'chances' && !(Number.isInteger(n) && n !== 0) ? 'Un entero distinto de 0 (negativo resta).' : undefined,
  };
}

/* ── D6b · Sorteos de suscripción ─────────────────────── */

export const INTERVALOS_PLAN = [
  { valor: 'mensual', texto: 'Mensual (1 mes)', meses: 1 },
  { valor: 'trimestral', texto: 'Trimestral (3 meses)', meses: 3 },
  { valor: 'semestral', texto: 'Semestral (6 meses)', meses: 6 },
  { valor: 'anual', texto: 'Anual (12 meses)', meses: 12 },
];
export const mesesDeIntervalo = (v) => INTERVALOS_PLAN.find((i) => i.valor === v)?.meses || 1;
export const COLORES_CAMPANA = { primario: '#111111', fondo: '#ffffff', texto: '#111111', acento: '#e60023' };

const planDesde = (p = {}, i = 0) => {
  const meses = Number(p.meses) || mesesDeIntervalo(p.intervalo);
  return {
    id: p.id || `plan_${i}`,
    nombre: p.nombre || '',
    intervalo: INTERVALOS_PLAN.some((x) => x.valor === p.intervalo) ? p.intervalo : 'mensual',
    meses,
    precio: (Number(p.precioCentimos) || 0) / 100,
    precioUsd: Number(p.precioUsd) || 0,
    chances: Number(p.chancesPorCiclo) || meses,
    beneficios: Array.isArray(p.beneficios) ? p.beneficios.filter(Boolean) : [],
    destacado: Boolean(p.destacado),
    orden: Number(p.orden) || i,
  };
};

/** Una campaña de sorteos_suscripcion → el admin. */
export function campanaSuscripcionDesde(c = {}) {
  return {
    id: c.id,
    nombre: c.titulo || '',
    slug: c.slug || '',
    descripcion: c.descripcion || '',
    estado: ['borrador', 'activo', 'cerrado'].includes(c.estado) ? c.estado : 'borrador',
    numGanadores: Number(c.numGanadores) || 1,
    portada: c.heroImagenUrl || '',
    logo: c.logoUrl || '',
    colores: { ...COLORES_CAMPANA, ...(c.colores || {}) },
    premios: (Array.isArray(c.premios) ? c.premios : []).map((x) => ({ nombre: x.nombre || '', imagen: x.imagenUrl || '' })),
    planes: (Array.isArray(c.planes) ? c.planes : []).map(planDesde),
    suscriptores: Number.isFinite(Number(c.contadorSuscriptores)) ? Number(c.contadorSuscriptores) : null,
    ganadores: (Array.isArray(c.ganadores) ? c.ganadores : []).map((g) => ({ uid: g.uid || '', nombre: g.nombre || '', correo: g.correo || '', telefono: g.telefono || '' })),
  };
}

/** Lo que esperan createCampaign / updateCampaign (los soles pasan a céntimos). */
export function campanaSuscripcionAFormulario(d = {}) {
  return {
    titulo: String(d.nombre || '').trim(),
    slug: slugDeSorteo(d.slug || d.nombre),
    descripcion: String(d.descripcion || '').trim(),
    estado: d.estado || 'borrador',
    numGanadores: Math.max(1, Math.round(Number(d.numGanadores) || 1)),
    heroImagenUrl: d.portada || '',
    logoUrl: d.logo || '',
    colores: { ...COLORES_CAMPANA, ...(d.colores || {}) },
    premios: (d.premios || []).filter((x) => String(x.nombre || '').trim() || x.imagen).map((x) => ({ nombre: String(x.nombre || '').trim(), imagenUrl: x.imagen || '' })),
    planes: (d.planes || []).map((x, i) => ({
      id: x.id || `plan_${i}`,
      nombre: String(x.nombre || '').trim(),
      intervalo: x.intervalo || 'mensual',
      meses: mesesDeIntervalo(x.intervalo),
      precioCentimos: Math.round((Number(x.precio) || 0) * 100),
      precioUsd: Number(x.precioUsd) || 0,
      chancesPorCiclo: Number(x.chances) || mesesDeIntervalo(x.intervalo),
      beneficios: (x.beneficios || []).filter(Boolean),
      destacado: Boolean(x.destacado),
      orden: i,
    })),
  };
}

export const planNuevo = (ms = Date.now()) => ({ id: `plan_${ms}`, nombre: '', intervalo: 'mensual', meses: 1, precio: 0, precioUsd: 0, chances: 1, beneficios: [], destacado: false, orden: 0 });

/** Cambiar el ciclo: los meses van con él y las chances también, si seguían "una por mes". */
export function planConIntervalo(plan = {}, intervalo) {
  const meses = mesesDeIntervalo(intervalo);
  return { ...plan, intervalo, meses, chances: Number(plan.chances) === Number(plan.meses) ? meses : plan.chances };
}

/** Los errores (como antes: para activarla hace falta un plan con precio). */
export function erroresDeCampanaSuscripcion(d = {}) {
  const conPrecio = (d.planes || []).some((x) => Number(x.precio) > 0 || Number(x.precioUsd) > 0);
  return {
    nombre: String(d.nombre || '').trim() ? undefined : 'Escribe el título de la campaña.',
    numGanadores: Number(d.numGanadores) >= 1 ? undefined : 'Al menos un ganador.',
    planes: d.estado === 'activo' && !conPrecio ? 'Para activarla, agrega un plan con precio (S/ o USD) mayor a 0.' : undefined,
  };
}

/** "2 planes · desde S/ 19.90" · "Sin planes". */
export function textoDePlanes(planes = []) {
  if (!planes.length) return 'Sin planes';
  const precios = planes.map((x) => Number(x.precio) || 0).filter((x) => x > 0);
  return `${planes.length} ${planes.length === 1 ? 'plan' : 'planes'}${precios.length ? ` · desde S/ ${Math.min(...precios).toFixed(2)}` : ''}`;
}

export const ESTADOS_SUSCRIPTOR = {
  activo: { texto: 'Vigente', tono: 'exito' },
  pendiente_pago: { texto: 'Pago pendiente', tono: 'aviso' },
  vencido: { texto: 'Vencido', tono: 'neutro' },
  cancelado: { texto: 'Cancelado', tono: 'peligro' },
};

/** Un suscriptor (con el nombre y el precio de su plan). */
export function suscriptorDesde(s = {}, planes = []) {
  const plan = planes.find((x) => x.id === s.planId);
  const v = s.vigenciaHasta;
  return {
    id: s.id,
    nombre: s.nombre || s.nombres || '',
    correo: s.correo || '',
    telefono: s.telefono || '',
    dni: s.dni || '',
    plan: plan?.nombre || s.planId || '',
    precio: plan ? plan.precio : 0,
    estado: s.estado || '',
    vigenciaMs: v?.toMillis ? v.toMillis() : v?.seconds ? v.seconds * 1000 : typeof v === 'number' ? v : (Date.parse(v) || 0),
    chances: Number(s.chancesTotal) || 0,
    pago: s.metodoPago || '',
  };
}

/** Un beneficio (marcas y descuentos) → el admin, y de vuelta. */
export const beneficioDesde = (b = {}) => ({ id: b.id, marca: b.marca || '', nombre: b.titulo || '', descuento: b.descuento || '', imagen: b.imagenUrl || '', categoria: b.categoria || '', ubicacion: b.ubicacion || '', url: b.url || '', orden: Number(b.orden) || 0 });
export const beneficioAFirestore = (d = {}) => ({ marca: String(d.marca || '').trim(), titulo: String(d.nombre || '').trim(), descuento: String(d.descuento || '').trim(), imagenUrl: d.imagen || '', categoria: String(d.categoria || '').trim(), ubicacion: String(d.ubicacion || '').trim(), url: String(d.url || '').trim(), orden: Number(d.orden) || 0 });

/** Un ganador de antes (la galería de la página) → el admin, y de vuelta. */
export const ganadorGaleriaDesde = (g = {}) => ({ id: g.id, nombre: g.nombre || '', premio: g.premio || '', foto: g.fotoUrl || '', fecha: g.fecha || '', orden: Number(g.orden) || 0 });
export const ganadorGaleriaAFirestore = (d = {}) => ({ nombre: String(d.nombre || '').trim(), premio: String(d.premio || '').trim(), fotoUrl: d.foto || '', fecha: String(d.fecha || '').trim(), orden: Number(d.orden) || 0 });

/* ── D6c · Enlaces (link in bio) ──────────────────────── */

/*
 * Las páginas de /l/{slug}. El diseño se guarda con los nombres de siempre
 * (los lee la página pública con services/linkThemes, igual que la vista
 * previa del kit): solo los botones y las redes cambian de nombre aquí.
 */
export const DISENO_ENLACES = {
  buttonStyle: 'solid', cornerRoundness: 12, buttonShadow: 'soft', buttonColor: '#111827', buttonTextColor: '#ffffff',
  titleColor: '#111827', textColor: '#374151', textAlign: 'center', background: { type: 'color', value: '#f3f4f6', color: '#4B0055' }, fontFamily: '',
};

export const TIPOS_RED = [
  { valor: 'instagram', texto: 'Instagram' },
  { valor: 'facebook', texto: 'Facebook' },
  { valor: 'tiktok', texto: 'TikTok' },
  { valor: 'whatsapp', texto: 'WhatsApp' },
  { valor: 'custom', texto: 'Otra' },
];

const porOrdenDe = (lista) => (Array.isArray(lista) ? [...lista].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)) : []);

/** Como la hidratación del editor: lo que falta sale de los valores de siempre (y el título y el texto, del texto del botón en las viejas). */
export function disenoDeEnlaces(d = {}) {
  const x = d || {};
  return {
    buttonStyle: x.buttonStyle || DISENO_ENLACES.buttonStyle,
    cornerRoundness: typeof x.cornerRoundness === 'number' ? x.cornerRoundness : DISENO_ENLACES.cornerRoundness,
    buttonShadow: x.buttonShadow || DISENO_ENLACES.buttonShadow,
    buttonColor: x.buttonColor || DISENO_ENLACES.buttonColor,
    buttonTextColor: x.buttonTextColor || DISENO_ENLACES.buttonTextColor,
    titleColor: x.titleColor || x.buttonTextColor || DISENO_ENLACES.titleColor,
    textColor: x.textColor || x.buttonTextColor || DISENO_ENLACES.textColor,
    textAlign: ['left', 'center', 'right', 'justify'].includes(x.textAlign) ? x.textAlign : 'center',
    background: {
      type: x.background?.type || 'color',
      value: x.background?.value ?? DISENO_ENLACES.background.value,
      color: x.background?.color || DISENO_ENLACES.background.color,
    },
    fontFamily: x.fontFamily || '',
  };
}

/** Una página de enlaces (link_pages) → el admin. */
export function paginaEnlacesDesde(p = {}) {
  return {
    id: p.id,
    nombre: p.titulo || '',
    slug: p.slug || '',
    descripcion: p.descripcion || '',
    avatar: p.avatarUrl || '',
    estado: p.estado === 'borrador' ? 'borrador' : 'activo',
    visitas: Number(p.visitas) || 0,
    diseno: disenoDeEnlaces(p.diseno),
    botones: porOrdenDe(p.botones).map((b, i) => ({ id: b.id || `btn_${i}`, titulo: b.titulo || '', url: b.url || '', miniatura: b.thumbnailUrl || '' })),
    redes: porOrdenDe(p.redes).map((r, i) => ({ id: r.id || `red_${i}`, tipo: TIPOS_RED.some((x) => x.valor === r.tipo) ? r.tipo : 'custom', nombre: r.nombre || '', url: r.url || '', icono: r.iconUrl || '' })),
  };
}

/** Lo que se guarda (updateLinkPage normaliza el resto): el orden es el de la lista. */
export function paginaEnlacesAFirestore(d = {}) {
  return {
    titulo: String(d.nombre || '').trim(),
    slug: slugDeEnlace(d.slug || d.nombre),
    descripcion: d.descripcion || '',
    avatarUrl: d.avatar || '',
    estado: d.estado === 'borrador' ? 'borrador' : 'activo',
    diseno: d.diseno,
    botones: (d.botones || []).map((b, i) => ({ id: b.id, titulo: b.titulo || '', url: String(b.url || '').trim(), thumbnailUrl: b.miniatura || '', order: i })),
    redes: (d.redes || []).map((r, i) => ({ id: r.id, tipo: r.tipo || 'custom', nombre: r.nombre || '', url: String(r.url || '').trim(), iconUrl: r.icono || '', order: i })),
  };
}

const idEnlace = (prefijo, ms) => `${prefijo}_${ms}_${Math.random().toString(36).slice(2, 6)}`;
export const botonEnlaceNuevo = (ms = Date.now()) => ({ id: idEnlace('btn', ms), titulo: '', url: '', miniatura: '' });
export const redNueva = (ms = Date.now()) => ({ id: idEnlace('red', ms), tipo: 'instagram', nombre: '', url: '', icono: '' });

/** Errores: título, enlace y que ninguna OTRA página use el mismo enlace. */
export function erroresDeEnlaces(d = {}, otras = []) {
  const slug = slugDeEnlace(d.slug || d.nombre);
  return {
    nombre: String(d.nombre || '').trim() ? undefined : 'Escribe el título de la página.',
    slug: !slug ? 'Escribe el enlace.' : otras.some((p) => p.id !== d.id && String(p.slug || '').toLowerCase() === slug) ? `Ya hay otra página en /l/${slug}: elige otro.` : undefined,
  };
}

/** Los clics de cada botón y red, para la lista de Resultados. */
export function clicsDeEnlaces(clics = {}, botones = [], redes = []) {
  const filas = [
    ...botones.map((b) => ({ id: b.id, nombre: b.titulo || 'Botón sin título', valor: Number(clics[b.id]) || 0 })),
    ...redes.map((r) => ({ id: r.id, nombre: `Red: ${r.nombre || TIPOS_RED.find((x) => x.valor === r.tipo)?.texto || 'sin nombre'}`, valor: Number(clics[r.id]) || 0 })),
  ];
  const total = Object.values(clics || {}).reduce((n, v) => n + (Number(v) || 0), 0);
  return { filas: filas.map((f) => ({ ...f, texto: `${f.valor} · ${total ? Math.round((f.valor / total) * 100) : 0} %` })), total };
}

/* ── D6d · Popups y páginas ────────────────────── */

/*
 * Popups: storeConfig/popups se edita tal cual (lo lee la tienda con
 * services/popupsLogic.mjs, que la página también usa para normalizar).
 */
/** "a los 10 s" · "al bajar 40 %" · "al intentar salir" · "apenas entra". */
export function cuandoPopup(p = {}) {
  if (p.disparador === 'scroll') return `al bajar ${p.scrollPct} %`;
  if (p.disparador === 'salida') return 'al intentar salir';
  return Number(p.segundos) > 0 ? `a los ${p.segundos} s` : 'apenas entra';
}

/** Errores (como antes): el título; la imagen si es "solo imagen", el texto del botón si es tarjeta; el enlace si lleva a uno. */
export function erroresDePopup(p = {}) {
  const imagen = p.formato === 'imagen';
  return {
    titulo: String(p.titulo || '').trim() ? undefined : imagen ? 'Describe lo que dice la imagen.' : 'Escribe el título.',
    imagenUrl: imagen && !String(p.imagenUrl || '').trim() ? 'Sube la imagen o pega su enlace.' : undefined,
    botonTexto: !imagen && !String(p.botonTexto || '').trim() ? 'Escribe el texto del botón.' : undefined,
    botonUrl: p.objetivo === 'enlace' && !String(p.botonUrl || '').trim() ? 'Escribe a dónde lleva.' : undefined,
    rutas: p.paginas === 'elegidas' && !(p.rutas || []).length ? 'Elige al menos una página o no saldrá en ninguna.' : undefined,
    hasta: p.desde && p.hasta && p.hasta < p.desde ? 'Termina antes de empezar.' : undefined,
  };
}

/**
 * Los pasos del embudo de un popup (embudoPopupsSecure), en personas, con su
 * parte de las que lo vieron. Cerrar va aparte (no es un paso hacia el
 * objetivo). Sin `vieron` (las cifras viejas, solo veces) → [].
 *  - e: { vieron, cerraron, tocaron, empezaron (null si no aplica), cumplieron }
 *  - objetivo: 'encuesta' | 'registro' | 'enlace'
 */
export function pasosEmbudoPopup(e, objetivo) {
  if (!e || typeof e.vieron !== 'number') return [];
  const parte = (n) => (e.vieron > 0 ? Math.round((n / e.vieron) * 100) : 0);
  const cumplir = objetivo === 'encuesta' ? 'Terminaron la encuesta' : objetivo === 'registro' ? 'Crearon su cuenta' : null;
  return [
    { id: 'vieron', nombre: 'Lo vieron', total: e.vieron, porcentaje: 100 },
    { id: 'tocaron', nombre: objetivo === 'encuesta' ? 'Tocaron «Llenar»' : 'Tocaron el botón', total: e.tocaron, porcentaje: parte(e.tocaron) },
    ...(e.empezaron == null ? [] : [{ id: 'empezaron', nombre: 'Abrieron la encuesta', total: e.empezaron, porcentaje: parte(e.empezaron) }]),
    ...(cumplir ? [{ id: 'cumplieron', nombre: cumplir, total: e.cumplieron, porcentaje: parte(e.cumplieron), nota: 'En los 7 días después de tocar' }] : []),
    { id: 'cerraron', nombre: 'Lo cerraron', total: e.cerraron, porcentaje: parte(e.cerraron), aparte: true },
  ];
}

/* Páginas (landing pages): solo nombre, dirección y marca; el diseño, en la página con el editor. */

/** "/Promo Navidad " → "promo-navidad" (como antes: sin barra, minúsculas y guiones). */
export const slugDeLanding = (v) => String(v || '').replace(/^\/+/, '').toLowerCase().trim().replace(/\s+/g, '-');
const llaveSlug = (v) => String(v || '').toLowerCase().replace(/[^a-z0-9]/g, '');

/** Una landing (con `marcas` para saber si es la página de una marca, que se cambia en Marcas). */
export function landingDesde(p = {}, marcas = []) {
  const marca = p.brandId ? marcas.find((m) => m.id === p.brandId) : null;
  const deMarca = Boolean(marca && llaveSlug(marca.slug) === llaveSlug(p.slug || p.id));
  return {
    id: p.id,
    nombre: p.title || p.slug || '',
    slug: p.slug || '',
    marcaId: p.brandId || '',
    marcaNombre: marca?.name || '',
    deMarca,
    slugsAnteriores: Array.isArray(p.slugsAnteriores) ? p.slugsAnteriores : [],
    temaId: p.themeId || '',
  };
}

export function erroresDeLanding(d = {}, paginas = []) {
  const slug = d.deMarca ? d.slug : slugDeLanding(d.slug);
  return {
    nombre: String(d.nombre || '').trim() ? undefined : 'Escribe el nombre.',
    slug: !slug ? 'Escribe la dirección.' : paginas.some((p) => p.id !== d.id && p.slug === slug) ? 'Ya hay una página con esa dirección: escoge otra.' : undefined,
  };
}

/** Lo que se guarda: con la dirección vieja anotada para redirigir (el diseño lo mueve el conector). */
export function landingAFirestore(d = {}, previa = null) {
  const slug = d.deMarca ? d.slug : slugDeLanding(d.slug);
  const vieja = previa?.slug || '';
  let anteriores = previa?.slugsAnteriores || [];
  if (vieja && vieja !== slug) anteriores = [...new Set([...anteriores, vieja])];
  return { title: String(d.nombre || '').trim(), brandId: d.marcaId || '', slug, slugsAnteriores: anteriores.filter((x) => x !== slug) };
}

/* ── D7a · La Palabra del día y Las Bolitas ───────────── */

/** "Regalo" → "REGALO" (sin tildes, como la guarda el juego). */
// Sin tildes y en mayúsculas, pero con la Ñ (como normalizarPalabra del juego).
export const palabraLimpia = (w = '') => String(w).toUpperCase().replace(/Ñ/g, '\u0000').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\u0000/g, 'Ñ').trim();

/** Una palabra programada (daily_words/{YYYY-MM-DD}) → el admin, con si ya pasó. */
export function palabraDiaDesde(x = {}, hoy = '') {
  const fecha = x.id || '';
  return { id: fecha, fecha, palabra: x.word || '', estado: fecha === hoy ? 'hoy' : fecha < hoy ? 'paso' : 'programada' };
}

/**
 * Los errores: solo letras, de 5 a 8. Las de 5 tienen que estar en el
 * diccionario del juego (`existe(PALABRA)`: si no, nadie podría escribirla);
 * con 6 a 8 el juego acepta cualquier intento de ese largo. Y que ese día no tenga ya otra.
 */
export function erroresDePalabra(d = {}, lista = [], id = null, existe = null) {
  const w = String(d.palabra || '').trim();
  const limpia = palabraLimpia(w);
  return {
    fecha: !d.fecha ? 'Elige el día.' : lista.some((x) => x.id === d.fecha && x.id !== id) ? 'Ese día ya tiene palabra: edítala en la lista.' : undefined,
    palabra: !w ? 'Escribe la palabra.' : !/^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ]+$/.test(w) ? 'Solo letras, sin espacios.'
      : [...limpia].length < 5 || [...limpia].length > 8 ? 'De 5 a 8 letras.'
        : [...limpia].length === 5 && existe && !existe(limpia) ? 'No está en el diccionario del juego: nadie podría escribirla. Prueba con otra.' : undefined,
  };
}

/**
 * Por qué no se puede cambiar ni quitar la palabra de ese día (o null): uno
 * que ya pasó queda como se jugó, y la de hoy, si ya alguien la jugó (cambiarla
 * le dejaría su partida con otra palabra).
 *  - x: { estado } (palabraDiaDesde) · jugaronHoy: partidas guardadas hoy
 */
export function bloqueoPalabra(x = {}, jugaronHoy = 0) {
  if (x.estado === 'paso') return 'Ese día ya pasó: queda como se jugó.';
  if (x.estado === 'hoy' && jugaronHoy > 0) {
    return `Hoy ya ${jugaronHoy === 1 ? 'jugó 1 persona' : `jugaron ${jugaronHoy} personas`} con esta palabra: si la cambias, su partida queda con otra. Programa la tuya desde mañana.`;
  }
  return null;
}

/** 'YYYY-MM-DD' + n días (en UTC, sin horas: no se corre con el horario). */
const sumarDias = (dia, n) => {
  const [y, m, d] = String(dia).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
};

/**
 * Lo que sale en el juego: las palabras puestas a mano (todas) y, para los
 * próximos `dias` días que no tienen una, la que elige el juego solo
 * (`palabraAuto(fecha)`, la misma cuenta que el juego). Cada fila lleva
 * `automatica` y las automáticas un id 'auto-<fecha>' (editarla = ponerla a mano).
 */
export function palabrasConAutomaticas(manuales = [], hoy = '', dias = 14, palabraAuto = () => '') {
  const puestas = new Set(manuales.map((x) => x.fecha));
  const auto = [];
  for (let i = 0; i < dias && hoy; i += 1) {
    const fecha = sumarDias(hoy, i);
    if (puestas.has(fecha)) continue;
    auto.push({ id: `auto-${fecha}`, fecha, palabra: String(palabraAuto(fecha) || '').toUpperCase(), estado: i === 0 ? 'hoy' : 'programada', automatica: true });
  }
  return [...manuales.map((x) => ({ ...x, automatica: false })), ...auto];
}

/* Las Bolitas: los cupones los topa el servidor (50 % o S/ 100, 1000 por día). */
export const CUPON_JUEGO_VACIO = { tipo: 'descuento', descuentoPct: 10, descuentoMonto: 0, topeDescuento: 0, vigenciaDias: 15 };

/** 'pct' | 'monto' | 'envio' (como el formulario de antes). */
export function modoDeCupon(c = CUPON_JUEGO_VACIO) {
  if (c.tipo === 'envio_gratis') return 'envio';
  return Number(c.descuentoMonto) > 0 && !Number(c.descuentoPct) ? 'monto' : 'pct';
}

export function cuponConModo(c = CUPON_JUEGO_VACIO, modo) {
  if (modo === 'envio') return { ...c, tipo: 'envio_gratis' };
  if (modo === 'pct') return { ...c, tipo: 'descuento', descuentoPct: Number(c.descuentoPct) || 10, descuentoMonto: 0 };
  return { ...c, tipo: 'descuento', descuentoPct: 0, descuentoMonto: Number(c.descuentoMonto) || 10 };
}

/** "10 % (tope S/ 20) · 15 días" · "S/ 10 · 7 días" · "Envío gratis · 15 días". */
export function textoCuponJuego(c) {
  if (!c) return '—';
  if (c.tipo === 'envio_gratis') return `Envío gratis · ${c.vigenciaDias} días`;
  const valor = Number(c.descuentoPct) > 0 ? `${c.descuentoPct} %${Number(c.topeDescuento) ? ` (tope S/ ${c.topeDescuento})` : ''}` : `S/ ${c.descuentoMonto}`;
  return `${valor} · ${c.vigenciaDias} días`;
}

/** Los topes del servidor, dichos antes de guardar. */
export function erroresDeCupon(c = {}) {
  const modo = modoDeCupon(c);
  const v = Number(c.vigenciaDias);
  return {
    valor: modo === 'pct' && !(Number(c.descuentoPct) >= 1 && Number(c.descuentoPct) <= 50) ? 'De 1 a 50 %.'
      : modo === 'monto' && !(Number(c.descuentoMonto) >= 1 && Number(c.descuentoMonto) <= 100) ? 'De S/ 1 a S/ 100.' : undefined,
    vigencia: v >= 1 && v <= 90 ? undefined : 'De 1 a 90 días.',
  };
}

/** Un reto patrocinado (por día) → el admin. */
export function patrocinioDesde(p = {}, hoy = '') {
  return {
    id: p.fecha, fecha: p.fecha || '', marcaId: p.marcaId || '', marcaNombre: p.marcaNombre || '', cupo: Number(p.cupo) || 0,
    entregados: Number(p.entregados) || 0, activo: p.activo !== false, cupon: { ...CUPON_JUEGO_VACIO, ...(p.cupon || {}) }, hoy: p.fecha === hoy,
  };
}

export function erroresDePatrocinio(d = {}, lista = [], id = null, hoy = '') {
  const cupon = erroresDeCupon(d.cupon);
  return {
    fecha: !d.fecha ? 'Elige el día.' : d.fecha < hoy ? 'Ese día ya pasó.' : lista.some((x) => x.id === d.fecha && x.id !== id) ? 'Ese día ya tiene patrocinio: edítalo en la lista.' : undefined,
    marcaId: d.marcaId ? undefined : 'Elige la marca.',
    cupo: Number(d.cupo) >= 1 && Number(d.cupo) <= 1000 ? undefined : 'De 1 a 1000 cupones.',
    cuponValor: cupon.valor,
    cuponVigencia: cupon.vigencia,
  };
}

/** Los premios del ranking semanal (config del servidor) → el admin. */
export function premiosBolitasDesde(doc) {
  return {
    activo: Boolean(doc) && doc.activo !== false,
    puestos: (doc?.puestos || []).map((x) => ({ desde: Number(x.desde) || 1, hasta: Number(x.hasta) || Number(x.desde) || 1, marcaId: x.marcaId || '', cupon: { ...CUPON_JUEGO_VACIO, ...(x.cupon || {}) } })),
  };
}

export function premiosBolitasAFirestore(p = {}, marcas = []) {
  return {
    activo: Boolean(p.activo),
    puestos: (p.puestos || []).map((x) => ({ desde: Number(x.desde), hasta: Number(x.hasta), marcaId: x.marcaId || null, marcaNombre: marcas.find((m) => m.id === x.marcaId)?.name || null, cupon: x.cupon })),
  };
}

export const nuevoPuesto = (puestos = []) => { const desde = puestos.length ? Number(puestos[puestos.length - 1].hasta) + 1 : 1; return { desde, hasta: desde, marcaId: '', cupon: { ...CUPON_JUEGO_VACIO } }; };

/** Lo que está mal en los puestos: al revés o que se pisan (con su número de premio). */
export function erroresDePremios(p = {}) {
  const puestos = p.puestos || [];
  for (let i = 0; i < puestos.length; i += 1) {
    const a = puestos[i];
    if (!(Number(a.desde) >= 1) || Number(a.hasta) < Number(a.desde)) return `El premio ${i + 1}: «hasta» no puede ser menor que «desde».`;
    const cupon = erroresDeCupon(a.cupon);
    if (cupon.valor || cupon.vigencia) return `El premio ${i + 1}: ${cupon.valor || cupon.vigencia}`;
    for (let j = 0; j < i; j += 1) {
      const b = puestos[j];
      if (Number(a.desde) <= Number(b.hasta) && Number(b.desde) <= Number(a.hasta)) return `Los premios ${j + 1} y ${i + 1} se pisan en los puestos.`;
    }
  }
  return '';
}

/** Lo que devuelve adminBolitas('metricas'), sumado para las cifras y las listas. */
export function metricasBolitas(data = {}) {
  const porDia = data?.porDia || [];
  const niveles = {};
  const clicsMarca = {};
  let partidas = 0;
  let retos = 0;
  let clics = 0;
  porDia.forEach((d) => {
    partidas += Number(d.partidas) || 0;
    retos += Number(d.retos) || 0;
    clics += Number(d.clics) || 0;
    Object.entries(d.niveles || {}).forEach(([n, c]) => { niveles[n] = (niveles[n] || 0) + c; });
    Object.entries(d.clicsPorMarca || {}).forEach(([id, c]) => { clicsMarca[id] = (clicsMarca[id] || 0) + c; });
  });
  const j = data?.jugadores || {};
  const parte = (x = {}) => (x.base ? Math.round((x.cantidad / x.base) * 100) : null);
  return {
    partidas, retos, clics, clicsMarca,
    jugadores: Number(j.jugadores) || 0,
    vuelven: parte(j.vuelven),
    siguen7: parte(j.siguen7),
    trabados: Object.entries(j.trabados || {}).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([nivel, n]) => ({ nivel, n })),
    porDia: [...porDia].sort((a, b) => (a.fecha < b.fecha ? -1 : 1)).map((d) => ({ fecha: d.fecha, partidas: Number(d.partidas) || 0, retos: Number(d.retos) || 0, clics: Number(d.clics) || 0 })),
  };
}

/* ── D7b · La Ruleta de Kapi ──────────────────────────── */

/*
 * Los premios se editan con los nombres de utils/ruletaModel (normalizarPremio):
 * lo leen el servidor al sortear y la rueda del cliente.
 */
export const DIAS_RULETA = [
  { valor: 1, corto: 'L', largo: 'lunes' }, { valor: 2, corto: 'M', largo: 'martes' }, { valor: 3, corto: 'X', largo: 'miércoles' },
  { valor: 4, corto: 'J', largo: 'jueves' }, { valor: 5, corto: 'V', largo: 'viernes' }, { valor: 6, corto: 'S', largo: 'sábado' }, { valor: 0, corto: 'D', largo: 'domingo' },
];

/** "Todos los días" · "Solo lunes y viernes" (vacío o los siete = todos). */
export function textoDiasRuleta(dias = []) {
  if (!dias.length || dias.length === 7) return 'Todos los días';
  const n = DIAS_RULETA.filter((d) => dias.includes(d.valor)).map((d) => d.largo);
  return `Solo ${n.length === 1 ? n[0] : `${n.slice(0, -1).join(', ')} y ${n[n.length - 1]}`}`;
}

export const TIPOS_PREMIO_RULETA = [
  { valor: 'monedas', texto: 'Monedas (se acreditan solas)' },
  { valor: 'descuento', texto: 'Descuento en el pedido (cupón)' },
  { valor: 'producto_descuento', texto: 'Descuento en un producto (cupón)' },
  { valor: 'producto_gratis', texto: 'Producto gratis (cupón)' },
  { valor: 'envio_gratis', texto: 'Envío gratis (cupón)' },
  { valor: 'manual', texto: 'Un premio que entregas a mano' },
  { valor: 'nada', texto: 'Sin premio («sigue intentando»)' },
];
export const PREMIO_RULETA_CON_PRODUCTO = ['producto_descuento', 'producto_gratis'];
export const PREMIO_RULETA_CON_CUPON = ['descuento', 'producto_descuento', 'producto_gratis', 'envio_gratis'];
/** Los cupones que pueden ser de una marca (los de un producto ya son de la suya). */
export const CUPON_CON_MARCA = ['descuento', 'envio_gratis'];

/** Un premio normalizado → la hoja (los nulos vuelven a texto vacío). */
export const premioRuletaAFormulario = (p = {}) => ({
  ...p, color: p.color || '', desde: p.desde || '', hasta: p.hasta || '', productId: p.productId || '',
  stockTotal: p.stockTotal ?? '', maxPorUsuario: p.maxPorUsuario ?? '', dias: p.dias || [],
  brandId: p.brandId || '', marcaNombre: p.marcaNombre || '',
});

/** Lo que se guarda (saveRuletaPrize): vacíos como null, como antes. */
export function premioRuletaAFirestore(d = {}) {
  const { stockUsado, id, ...resto } = d;
  return {
    ...resto,
    nombre: String(d.nombre || '').trim(),
    etiqueta: String(d.etiqueta || '').trim(),
    probabilidad: Number(d.probabilidad) || 0,
    stockTotal: d.stockTotal === '' || d.stockTotal == null ? null : Number(d.stockTotal),
    maxPorUsuario: d.maxPorUsuario === '' || d.maxPorUsuario == null ? null : Number(d.maxPorUsuario),
    desde: d.desde || null,
    hasta: d.hasta || null,
    color: d.color || null,
    productId: PREMIO_RULETA_CON_PRODUCTO.includes(d.tipo) ? d.productId || null : null,
    productName: PREMIO_RULETA_CON_PRODUCTO.includes(d.tipo) ? d.productName || '' : '',
    brandId: CUPON_CON_MARCA.includes(d.tipo) ? d.brandId || null : null,
    marcaNombre: CUPON_CON_MARCA.includes(d.tipo) && d.brandId ? d.marcaNombre || '' : '',
  };
}

/** Los errores (como antes, y las fechas en orden). */
export function erroresDePremioRuleta(d = {}) {
  return {
    nombre: String(d.nombre || '').trim() ? undefined : 'Escribe el nombre del premio.',
    probabilidad: Number(d.probabilidad) > 0 ? undefined : 'Tiene que ser mayor que cero.',
    productId: PREMIO_RULETA_CON_PRODUCTO.includes(d.tipo) && !d.productId ? 'Elige el producto del premio.' : undefined,
    topeDescuento: d.tipo === 'descuento' && Number(d.descuentoPct) > 0 && !(Number(d.topeDescuento) > 0) ? 'Pon un tope en soles para el descuento por porcentaje.' : undefined,
    descuentoPct: Number(d.descuentoPct) > 100 ? 'El porcentaje va de 0 a 100.' : undefined,
    hasta: d.desde && d.hasta && d.hasta < d.desde ? 'Termina antes de empezar.' : undefined,
  };
}

/** Por qué un premio no sale hoy ('' si sale): lo mismo que mira el servidor, dicho en palabras. */
export function motivoRuletaHoy(p = {}, hoy = '', diaSemana = 0) {
  if (!p.activo) return 'Apagado';
  if (!(Number(p.probabilidad) > 0)) return 'Sin probabilidad';
  if (p.stockTotal != null && p.stockUsado >= p.stockTotal) return 'Agotado';
  if (p.desde && hoy < p.desde) return 'Todavía no empieza';
  if (p.hasta && hoy > p.hasta) return 'Ya terminó';
  if ((p.dias || []).length && !p.dias.includes(diaSemana)) return 'Hoy no es su día';
  return '';
}

/** Un premio ganado (ruletaWins) → la lista de entregas. */
export function ganadoRuletaDesde(g = {}) {
  const tipo = g.tipo || g.type || '';
  return {
    id: g.id, quien: g.displayName || '', correo: g.email || g.uid || '', premio: g.texto || g.name || '', tipo,
    cupon: g.cuponCode || '', semana: g.weekStart || '', entregado: Boolean(g.entregado), manual: tipo === 'manual',
  };
}

/* ── D8a · Configuración: el equipo, los bloqueos, las imágenes y los idiomas ── */

/** Los permisos de adminRoles (los mismos ids de siempre; el menú los lee con puedeVer). */
export const PERMISOS_ADMIN = [
  { valor: 'superadmin', texto: 'Super Admin', detalle: 'Todo, también el equipo y esta página.' },
  { valor: 'manage_design', texto: 'Diseño y pedidos', detalle: 'Pedidos y pagos, la tienda, campañas, WhatsApp y los juegos.' },
  { valor: 'manage_products', texto: 'Catálogo', detalle: 'Productos, categorías, marcas y recompensas.' },
  { valor: 'manage_inventory', texto: 'Inventario', detalle: 'El stock en Productos (sin crear ni editar).' },
  { valor: 'manage_clients', texto: 'Clientes', detalle: 'Reclamos, referidos, la encuesta, popups, fechas, retos y misiones.' },
  { valor: 'manage_landing_pages', texto: 'Landing pages', detalle: 'Con Catálogo: las landing pages y los temas.' },
];

const correoLimpio = (c) => String(c || '').trim().toLowerCase();

/** Un doc de adminRoles (el id es el correo) → la lista. */
export function adminDesdeFirestore(doc = {}) {
  const correo = correoLimpio(doc.email || doc.id);
  return { id: doc.id || correo, correo, nombre: String(doc.name || '').trim() || correo.split('@')[0], permisos: Array.isArray(doc.permissions) ? doc.permissions : [] };
}

/** La hoja → setAdminRole(correo, datos). Super Admin va solo: ya lo abre todo. */
export function adminAFirestore(d = {}) {
  const correo = correoLimpio(d.correo);
  const permisos = (d.permisos || []).includes('superadmin') ? ['superadmin'] : PERMISOS_ADMIN.map((x) => x.valor).filter((v) => (d.permisos || []).includes(v));
  return { correo, datos: { name: String(d.nombre || '').trim() || correo.split('@')[0], permissions: permisos } };
}

/** Los errores: el correo, al menos un permiso, no repetir a alguien y no quitarse el acceso a uno mismo. */
export function erroresDeAdmin(d = {}, { id, registros = [], yo = '' } = {}) {
  const correo = correoLimpio(d.correo);
  const valido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo);
  const repetido = !id && registros.some((r) => r.correo === correo);
  const esYo = Boolean(yo) && correo === correoLimpio(yo);
  return {
    correo: !correo ? 'Escribe el correo de Google de la persona.' : !valido ? 'Ese correo no está bien escrito.' : repetido ? 'Ya está en el equipo: edítalo en la lista.' : undefined,
    permisos: !(d.permisos || []).length ? 'Elige al menos un permiso.' : esYo && !d.permisos.includes('superadmin') ? 'Te quitarías el acceso a esta página: deja Super Admin.' : undefined,
  };
}

/** "Super Admin" · "Catálogo · Inventario" (con puntos: "Diseño y pedidos" ya lleva una "y") · "Sin permisos". */
export function textoPermisos(permisos = []) {
  if (permisos.includes('superadmin')) return 'Super Admin';
  const n = PERMISOS_ADMIN.filter((p) => permisos.includes(p.valor)).map((p) => p.texto);
  return n.length ? n.join(' · ') : 'Sin permisos';
}

/** Las páginas que se pueden bloquear en el editor: las tres fijas y las landing pages. */
export const PAGINAS_FIJAS = [
  { id: 'home', nombre: 'Página principal', ruta: '/' },
  { id: 'tienda', nombre: 'La tienda', ruta: '/tienda' },
  { id: 'footer', nombre: 'El pie de página', ruta: 'en todas las páginas' },
];

export function paginasBloqueables(landings = [], bloqueadas = []) {
  return [
    ...PAGINAS_FIJAS.map((p) => ({ ...p, tipo: 'fija' })),
    ...landings.map((l) => ({ id: l.id, nombre: l.title || l.nombre || l.slug || l.id, ruta: `/${l.slug || l.id}`, tipo: 'landing' })),
  ].map((p) => ({ ...p, bloqueada: bloqueadas.includes(p.id) }));
}

/** Bloquear o abrir una → la lista nueva (sin repetir; las que ya no existen se quedan). */
export const conBloqueo = (bloqueadas = [], id, bloquear) => (bloquear ? [...new Set([...bloqueadas, id])] : bloqueadas.filter((x) => x !== id));

const plural = (n, uno, varios) => `${new Intl.NumberFormat('es-PE').format(n)} ${n === 1 ? uno : varios}`;

/** El recuento de contarImagenesPorConvertir, en una frase. */
export function textoConteoImagenes(c = {}) {
  if (!c.imagenes) return 'No queda ninguna imagen por convertir.';
  const veces = c.apariciones && c.apariciones !== c.imagenes ? ` (aparecen ${plural(c.apariciones, 'vez', 'veces')}: una misma puede estar en varios sitios)` : '';
  return `Hay ${plural(c.imagenes, 'imagen', 'imágenes')} por revisar en ${plural(c.documentos || 0, 'documento', 'documentos')}${veces}. Solo se reescriben las que lo necesitan.`;
}

/** Lo que devolvió reconvertirImagenesAWebp, en una frase. */
export function textoResultadoImagenes(r = {}) {
  const base = `${plural(r.convertidas || 0, 'imagen convertida', 'imágenes convertidas')} en ${plural(r.documentos || 0, 'documento', 'documentos')}`;
  return r.saltadas ? `${base}; ${plural(r.saltadas, 'se dejó', 'se dejaron')} como estaba${r.saltadas === 1 ? '' : 'n'} (ya estaba${r.saltadas === 1 ? '' : 'n'} bien o el WebP no la${r.saltadas === 1 ? '' : 's'} mejoraba).` : `${base}.`;
}

export const NOMBRES_IDIOMA = { en: 'Inglés', pt: 'Portugués', es: 'Español' };

/** { en: 12, pt: 0 } → [{ idioma, nombre, cuantas }] (solo los que tienen algo). */
export const traduccionesPorIdioma = (pendientes = {}) => Object.entries(pendientes)
  .filter(([, n]) => Number(n) > 0)
  .map(([idioma, n]) => ({ idioma, nombre: NOMBRES_IDIOMA[idioma] || idioma.toUpperCase(), cuantas: Number(n) }));

/* ── D8b · WhatsApp y el historial ────────────────────── */

/*
 * Los números de WhatsApp (messages). El botón flotante usa el de su
 * sección o, vacío, el general (whatsapp_number, que es el de la tienda); las
 * marcas y los productos con número propio mandan sobre estos. El checkout
 * usa el de la tienda y su mensaje con {id}. Los mensajes de Crear y Mi
 * cuenta (whatsapp_text_crear / _cuenta) ya no los lee nadie: no se tocan.
 */
export const MENSAJE_PEDIDO_POR_DEFECTO = 'Solicitud de Pedido\n\nHola! Vengo de la tienda virtual y quiero confirmar mi pedido con código {id}.';

export const SECCIONES_WHATSAPP = [
  { clave: 'tienda', titulo: 'La tienda y el checkout', donde: 'La tienda, las fichas de producto y la confirmación del pedido.' },
  { clave: 'crear', titulo: 'Crear', donde: 'Personalizar y el editor de diseños.' },
  { clave: 'cuenta', titulo: 'Mi cuenta', donde: 'Mi cuenta, mis pedidos y el carrito.' },
];

/** Los mensajes guardados → la página. */
export function whatsappDesdeMensajes(m = {}) {
  const t = (k) => String(m[k] ?? '').trim();
  return {
    tienda: t('whatsapp_number_tienda') || t('whatsapp_number'),
    crear: t('whatsapp_number_crear'),
    cuenta: t('whatsapp_number_cuenta'),
    mensajePedido: m.whatsapp_text_tienda || MENSAJE_PEDIDO_POR_DEFECTO,
    enAcceso: m.whatsapp_mostrar_en_acceso === 'si',
  };
}

/** La página → los mensajes (las claves de antes; el general sigue al de la tienda). */
export function whatsappAMensajes(c = {}) {
  const t = (v) => String(v ?? '').trim();
  return {
    whatsapp_number_tienda: t(c.tienda),
    whatsapp_number_crear: t(c.crear),
    // Vacío no se guarda vacío (como la página vieja): "¿Problemas para pagar?" de
    // Mi cuenta usa este número de respaldo y no cae al general.
    whatsapp_number_cuenta: t(c.cuenta) || t(c.tienda),
    whatsapp_text_tienda: c.mensajePedido || '',
    whatsapp_mostrar_en_acceso: c.enAcceso ? 'si' : 'no',
    whatsapp_number: t(c.tienda),
  };
}

/** Mientras se escribe: solo números, espacios, +, - y paréntesis. */
export const telefonoEscrito = (v) => String(v || '').replace(/[^\d\s\-()+]/g, '');

/** Los errores: un número tiene de 9 a 15 dígitos (o va vacío); la tienda no puede ir vacía. */
export function erroresDeWhatsApp(c = {}) {
  const revisar = (v, obligatorio) => {
    const n = String(v || '').replace(/\D/g, '').length;
    if (!n) return obligatorio ? 'La tienda necesita un número: es el que usan el checkout y las demás secciones vacías.' : undefined;
    return n < 9 || n > 15 ? `Revisa el número: tiene ${n} dígito${n === 1 ? '' : 's'}.` : undefined;
  };
  return { tienda: revisar(c.tienda, true), crear: revisar(c.crear), cuenta: revisar(c.cuenta) };
}

/** El mensaje del pedido como lo verá el cliente (con un código de ejemplo). */
export const mensajePedidoDeEjemplo = (texto, id = 'WL-48213') => String(texto || '').replaceAll('{id}', id);

/*
 * El historial del diseño (storeConfigLogs): el editor guarda una copia en
 * cada guardado, así que la más nueva de cada página es la que está puesta.
 */
export function cambioDisenoDesde(log = {}) {
  const ms = typeof log.timestamp === 'number' ? log.timestamp : Date.parse(log.timestamp) || 0;
  const pagina = log.pageId || String(log.description || '').match(/Página: ([^)]+)\)/)?.[1] || 'home';
  return { id: log.id, cuando: ms, quien: log.user || 'Admin', pagina, descripcion: log.description || 'Guardado', config: log.config || null };
}

/** Marca la más nueva de cada página (`actual`); llegan de la más nueva a la más vieja. */
export function conVersionActual(cambios = []) {
  const vistas = new Set();
  return cambios.map((c) => {
    const actual = !vistas.has(c.pagina);
    vistas.add(c.pagina);
    return { ...c, actual };
  });
}

/** "Página principal" · "La tienda" · el slug de una landing. */
export const nombreDePaginaGuardada = (id) => PAGINAS_FIJAS.find((p) => p.id === id)?.nombre || `/${id}`;

/** Un cambio de stock (inventoryLogs) → la lista. null = sin límite (ni sube ni baja: cambia el límite). */
export function movimientoInventarioDesde(log = {}) {
  const num = (v) => (v === null || v === undefined || v === '' ? null : Number(v) || 0);
  const antes = num(log.oldStock);
  const despues = num(log.newStock);
  return {
    id: log.id, cuando: Number(log.timestamp) || 0, quien: log.userEmail || 'Desconocido',
    producto: log.productName || 'Producto', productoId: log.productId || '', antes, despues,
    cambio: antes === null || despues === null ? 0 : despues - antes,
  };
}

/** Un stock del historial: el número o "Sin límite". */
export const textoStock = (n) => (n === null || n === undefined ? 'Sin límite' : String(n));

/** "+3" · "−2" · "0". */
export const textoCambioStock = (n) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : '0');

/** Los movimientos en CSV (con la hora de Lima; las comillas, escapadas). */
export function csvInventario(movimientos = []) {
  const celda = (v) => {
    const s = String(v ?? '');
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const fecha = (ms, opciones) => new Date(ms).toLocaleString('es-PE', { timeZone: 'America/Lima', ...opciones });
  const filas = movimientos.map((m) => [
    fecha(m.cuando, { year: 'numeric', month: '2-digit', day: '2-digit' }),
    fecha(m.cuando, { hour: '2-digit', minute: '2-digit', hour12: false }),
    m.quien, m.producto, textoStock(m.antes), textoStock(m.despues), m.cambio,
  ].map(celda).join(','));
  return [['Fecha', 'Hora', 'Usuario', 'Producto', 'Stock anterior', 'Stock nuevo', 'Cambio'].join(','), ...filas].join('\n');
}
